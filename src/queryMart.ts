import type { BreakdownRow, SeriesPoint } from './types'

export type FilterState = { channel: string; device: string; country: string; period: '7' | '30' | 'all' }
export type DrillItem = { dimension: 'channel' | 'device' | 'country'; value: string }
export type MartResult = {
  current: Record<string, number>; previous: Record<string, number>; trend: SeriesPoint[]
  breakdown: BreakdownRow[]; detail: Record<string, string | number>[]
  context: {
    topDriver: string; topShare: number; rows: number; dimension: string; canDrill: boolean
    comparisonAvailable: boolean; currentStart: string; currentEnd: string; previousStart: string; previousEnd: string
    breakdownTotal: number; previousBreakdownTotal: number
  }
}

let connectionPromise: Promise<import('@duckdb/duckdb-wasm').AsyncDuckDBConnection> | undefined
let database: import('@duckdb/duckdb-wasm').AsyncDuckDB | undefined
const registeredMarts = new Set<string>()
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`

async function connection() {
  if (!connectionPromise) connectionPromise = (async () => {
    const duckdb = await import('@duckdb/duckdb-wasm')
    const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles())
    const workerUrl = URL.createObjectURL(new Blob([`importScripts("${bundle.mainWorker!}");`], { type: 'text/javascript' }))
    const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), new Worker(workerUrl))
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
    URL.revokeObjectURL(workerUrl)
    database = db
    await db.registerFileURL('growth.parquet', new URL('./data/mart_growth_sessions.parquet', window.location.href).href, duckdb.DuckDBDataProtocol.HTTP, false)
    registeredMarts.add('growth.parquet')
    return db.connect()
  })().catch(error => { connectionPromise = undefined; throw error })
  const con = await connectionPromise
  // The compact item mart is the revenue authority; session revenue is non-additive across days.
  if (!registeredMarts.has('products.parquet')) {
    const duckdb = await import('@duckdb/duckdb-wasm')
    await database!.registerFileURL('products.parquet', new URL('./data/mart_growth_products.parquet', window.location.href).href, duckdb.DuckDBDataProtocol.HTTP, false)
    registeredMarts.add('products.parquet')
  }
  return con
}

const records = (table: { toArray: () => Record<string, unknown>[] }) => table.toArray().map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'bigint' ? Number(value) : value]))) as Record<string, string | number>[]

// Global dates prevent a segment with no recent activity from moving the reporting window.
export function buildMartQueries(filters: FilterState, pageId: string, drillPath: DrillItem[] = []) {
  const clauses = [filters.channel && `channel=${literal(filters.channel)}`, filters.device && `device=${literal(filters.device)}`, filters.country && `country=${literal(filters.country)}`, ...drillPath.map(item => `${item.dimension}=${literal(item.value)}`)].filter(Boolean)
  const where = clauses.length ? `where ${clauses.join(' and ')}` : ''
  const days = filters.period === 'all' ? 0 : Number(filters.period)
  const bounds = `bounds as (select min(event_date) lo,max(event_date) hi from read_parquet('growth.parquet')), ranges as (select ${days ? `greatest(lo,hi-${days - 1})` : 'lo'} current_start,hi current_end,${days ? `hi-${days * 2 - 1}` : 'NULL::DATE'} previous_start,${days ? `hi-${days}` : 'NULL::DATE'} previous_end,${days ? `lo<=hi-${days * 2 - 1}` : 'false'} comparison_available from bounds)`
  const range = `with ${bounds}, base as (select * from read_parquet('growth.parquet') ${where})`
  const productRange = `with ${bounds}, base as (select * from read_parquet('products.parquet') ${where})`
  const inWindow = (period: string) => `event_date between ${period}_start and ${period}_end`
  const hierarchies: Record<string, DrillItem['dimension'][]> = { executive: ['channel', 'device', 'country'], funnel: ['device', 'channel', 'country'], acquisition: ['channel', 'country', 'device'], products: ['country', 'channel', 'device'], retention: ['device', 'country', 'channel'], trust: ['country', 'device', 'channel'] }
  const hierarchy = hierarchies[pageId] ?? hierarchies.executive
  const dimension = hierarchy[Math.min(drillPath.length, hierarchy.length - 1)]
  const metric = (period: string) => `${range}, scoped as (select b.* from base b,ranges where ${inWindow(period)}), user_days as (select user_id,count(distinct event_date) activity_days from scoped group by user_id) select count(distinct user_id)::double users,count(distinct (user_id,session_id)) filter(where user_id is not null and session_id is not null)::double sessions,count(distinct user_id) filter(where purchased=1)::double purchasers,coalesce(sum(purchases),0)::double orders,coalesce(sum(revenue),0)::double revenue,coalesce(sum(events),0)::double as "rows",count(distinct event_date)::double as days,(select count(*)::double from user_days where user_id is not null and activity_days>1) returningUsers from scoped`
  const productMetric = (period: string) => `${productRange} select coalesce(sum(revenue),0)::double productRevenue,coalesce(sum(units),0)::double productUnits from base,ranges where ${inWindow(period)}`
  const trendMetric = pageId === 'executive' ? 'count(distinct user_id)' : ['funnel', 'acquisition'].includes(pageId) ? 'count(distinct user_id) filter(where purchased=1)' : pageId === 'products' ? 'sum(revenue)' : pageId === 'trust' ? 'sum(events)' : 'count(distinct user_id)'
  const returnScope = pageId === 'retention' ? ', qualified as (select user_id from base,ranges where event_date between current_start and current_end group by user_id having count(distinct event_date)>1)' : ''
  const trend = `${pageId === 'products' ? productRange : range}${returnScope}, calendar as (select unnest(generate_series(current_start,current_end,interval 1 day))::date event_date from ranges), daily as (select event_date,${trendMetric}::double as value from base${pageId === 'retention' ? ' join qualified using(user_id)' : ''},ranges where ${inWindow('current')} group by event_date) select strftime(c.event_date,'%Y-%m-%d') as label,coalesce(d.value,0)::double as value from calendar c left join daily d using(event_date) order by c.event_date`
  const groupMetric = pageId === 'trust' ? 'sum(events)' : pageId === 'acquisition' ? 'count(distinct user_id) filter(where purchased=1)' : 'count(distinct user_id)'
  const groupSql = (period: string) => `${range} select ${dimension} as name,${groupMetric}::double as value from base,ranges where ${inWindow(period)} group by 1`
  const repeatGroup = (period: string) => `${range}, qualified as (select ${dimension},user_id from base,ranges where ${inWindow(period)} and user_id is not null group by 1,2 having count(distinct event_date)>1) select ${dimension} as name,count(*)::double as value from qualified group by 1`
  const productGroup = (period: string) => `${productRange} select product_type as name,sum(revenue)::double as value from base,ranges where ${inWindow(period)} group by 1`
  const groups = (period: string) => pageId === 'products' ? productGroup(period) : pageId === 'retention' ? repeatGroup(period) : groupSql(period)
  // Include disappeared segments so a decline is not erased by a current-only ranking.
  const breakdown = `with current_groups as (${groups('current')}), previous_groups as (${groups('previous')}) select coalesce(c.name,p.name) as name,coalesce(c.value,0) as value,coalesce(p.value,0) as previous from current_groups c full outer join previous_groups p on c.name=p.name order by value desc,name`
  const detail = pageId === 'products' ? `${productRange} select item_name product,product_type category,round(sum(revenue),2)::double revenue,sum(units)::double units,sum(orders)::double product_order_occurrences from base,ranges where ${inWindow('current')} group by 1,2 order by revenue desc limit 20` : pageId === 'retention' ? `${range}, user_days as (select ${dimension} driver,user_id,count(distinct event_date) activity_days from base,ranges where ${inWindow('current')} and user_id is not null group by 1,2) select driver,count(*)::double active_users,count(*) filter(where activity_days>1)::double returning_users,100.0*count(*) filter(where activity_days>1)/nullif(count(*),0) return_pct from user_days group by 1 order by active_users desc` : `${range}, item_base as (select * from read_parquet('products.parquet') ${where}), item_totals as (select ${dimension} driver,sum(revenue) item_revenue from item_base,ranges where ${inWindow('current')} group by 1), audience as (select ${dimension} driver,count(distinct user_id)::double active_users,count(distinct (user_id,session_id)) filter(where user_id is not null and session_id is not null)::double sessions,count(distinct user_id) filter(where purchased=1)::double purchasers,sum(purchases)::double purchase_records,100.0*count(distinct user_id) filter(where purchased=1)/nullif(count(distinct user_id),0) conversion_pct from base,ranges where ${inWindow('current')} group by 1) select audience.*,coalesce(item_revenue,0)::double item_revenue from audience left join item_totals using(driver) order by active_users desc`
  return { current: metric('current'), previous: metric('previous'), productCurrent: productMetric('current'), productPrevious: productMetric('previous'), trend, breakdown, detail, bounds: `with ${bounds} select strftime(current_start,'%Y-%m-%d') current_start,strftime(current_end,'%Y-%m-%d') current_end,strftime(previous_start,'%Y-%m-%d') previous_start,strftime(previous_end,'%Y-%m-%d') previous_end,comparison_available from ranges`, dimension: pageId === 'products' ? 'product_type' : dimension, canDrill: pageId !== 'products' && drillPath.length < hierarchy.length - 1 }
}

let queryQueue: Promise<void> = Promise.resolve()
const resultCache = new Map<string, MartResult>()
export function queryMart(filters: FilterState, pageId: string, drillPath: DrillItem[] = []): Promise<MartResult> {
  const key = JSON.stringify([filters, pageId, drillPath])
  const cached = resultCache.get(key)
  if (cached) return Promise.resolve(cached)
  const result = queryQueue.then(async () => {
    const existing = resultCache.get(key)
    if (existing) return existing
    const value = await runQuery(filters, pageId, drillPath)
    resultCache.set(key, value)
    return value
  })
  queryQueue = result.then(() => undefined, () => undefined)
  return result
}
async function runQuery(filters: FilterState, pageId: string, drillPath: DrillItem[]): Promise<MartResult> {
  const con = await connection()
  const q = buildMartQueries(filters, pageId, drillPath)
  const bounds = (await con.query(q.bounds)).get(0) as Record<string, unknown>
  const comparisonAvailable = Boolean(bounds.comparison_available)
  const readMetrics = async (sql: string) => {
    const row = (await con.query(sql)).get(0) as Record<string, unknown>
    return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value ?? 0)]))
  }
  const current = await readMetrics(q.current), previous = await readMetrics(q.previous)
  for (const metrics of [current, previous]) {
    metrics.conversion = metrics.users ? metrics.purchasers / metrics.users : 0
    metrics.return = metrics.users ? metrics.returningUsers / metrics.users : 0
  }
  Object.assign(current, await readMetrics(q.productCurrent))
  Object.assign(previous, await readMetrics(q.productPrevious))
  for (const metrics of [current, previous]) {
    metrics.sessionRevenue = metrics.revenue
    metrics.revenue = metrics.productRevenue
  }
  const trend = records(await con.query(q.trend)).map(row => ({ label: String(row.label), value: Number(row.value) }))
  const breakdown = records(await con.query(q.breakdown)).map(row => ({ name: String(row.name ?? 'Unknown'), value: Number(row.value), previous: comparisonAvailable ? Number(row.previous) : undefined }))
  const detail = records(await con.query(q.detail))
  const breakdownTotal = breakdown.reduce((sum, row) => sum + row.value, 0)
  const previousBreakdownTotal = breakdown.reduce((sum, row) => sum + (row.previous ?? 0), 0)
  return { current, previous, trend, breakdown, detail, context: { topDriver: breakdown[0]?.name ?? 'N/A', topShare: breakdownTotal ? (breakdown[0]?.value ?? 0) / breakdownTotal : 0, rows: current.rows, dimension: q.dimension, canDrill: q.canDrill, comparisonAvailable, currentStart: String(bounds.current_start ?? ''), currentEnd: String(bounds.current_end ?? ''), previousStart: String(bounds.previous_start ?? ''), previousEnd: String(bounds.previous_end ?? ''), breakdownTotal, previousBreakdownTotal } }
}
