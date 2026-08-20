import type { BreakdownRow, SeriesPoint } from './types'

export type FilterState = { channel: string; device: string; country: string }
export type MartResult = {
  current: Record<string, number>; previous: Record<string, number>; trend: SeriesPoint[]
  breakdown: BreakdownRow[]; detail: Record<string, string | number>[]
  context: { topDriver: string; topShare: number; rows: number }
}

let connectionPromise: Promise<import('@duckdb/duckdb-wasm').AsyncDuckDBConnection> | undefined
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`

async function connection() {
  if (!connectionPromise) connectionPromise = (async () => {
    const duckdb = await import('@duckdb/duckdb-wasm'); const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles())
    const workerUrl = URL.createObjectURL(new Blob([`importScripts("${bundle.mainWorker!}");`], { type: 'text/javascript' }))
    const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), new Worker(workerUrl)); await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
    await db.registerFileURL('growth.parquet', new URL('./data/mart_growth_sessions.parquet', window.location.href).href, duckdb.DuckDBDataProtocol.HTTP, false)
    return db.connect()
  })()
  return connectionPromise
}

const records = (table: { toArray: () => Record<string, unknown>[] }) => table.toArray().map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'bigint' ? Number(value) : value]))) as Record<string, string | number>[]

let queryQueue: Promise<void> = Promise.resolve()
export function queryMart(filters: FilterState, pageId: string): Promise<MartResult> {
  const result = queryQueue.then(() => runQuery(filters, pageId))
  queryQueue = result.then(() => undefined, () => undefined)
  return result
}
async function runQuery(filters: FilterState, pageId: string): Promise<MartResult> {
  const con = await connection()
  const clauses = [filters.channel && `channel=${literal(filters.channel)}`, filters.device && `device=${literal(filters.device)}`, filters.country && `country=${literal(filters.country)}`].filter(Boolean)
  const where = clauses.length ? `where ${clauses.join(' and ')}` : ''
  const metricSql = (period: 'current'|'previous') => `with base as (select * from read_parquet('growth.parquet') ${where}), bounds as (select min(event_date) lo,max(event_date) hi from base), scoped as (select b.* from base b,bounds where event_date ${period === 'current' ? '>=' : '<'} lo+((hi-lo)/2)::integer) select count(distinct user_id)::double users,count(*)::double sessions,count(distinct user_id) filter(where purchased=1)::double purchasers,sum(purchases)::double orders,sum(revenue)::double revenue,count(distinct event_date)::double active_days from scoped`
  const readMetrics = async (sql: string) => { const row=(await con.query(sql)).get(0) as Record<string,unknown>; const users=Number(row.users??0),purchasers=Number(row.purchasers??0); return {users,sessions:Number(row.sessions??0),conversion:users?purchasers/users:0,orders:Number(row.orders??0),revenue:Number(row.revenue??0),days:Number(row.active_days??0)} }
  const current=await readMetrics(metricSql('current')),previous=await readMetrics(metricSql('previous'))
  const trendTable=await con.query(`select strftime(event_date,'%b %d') period_label,count(distinct user_id)::double metric_value from read_parquet('growth.parquet') ${where} group by event_date order by event_date`)
  const dimension=pageId==='retention'?'device':pageId==='trust'?'country':'channel'
  const breakdownTable=await con.query(`select ${dimension} as driver_name,count(distinct user_id)::double as driver_value from read_parquet('growth.parquet') ${where} group by 1 order by driver_value desc limit 12`)
  const detailTable=await con.query(`select ${dimension} driver,count(distinct user_id)::double active_users,count(*)::double sessions,sum(purchases)::double purchases,round(sum(revenue),2)::double tracked_revenue,round(100*count(distinct user_id) filter(where purchased=1)/nullif(count(distinct user_id),0),1)::double conversion_pct from read_parquet('growth.parquet') ${where} group by 1 order by active_users desc limit 20`)
  const detail=records(detailTable),breakdown=records(breakdownTable).map(row=>({name:String(row.driver_name??'Unknown'),value:Number(row.driver_value??0)})); const total=breakdown.reduce((sum,row)=>sum+row.value,0)
  return {current,previous,trend:trendTable.toArray().map(row=>({label:String(row.period_label),value:Number(row.metric_value)})),breakdown,detail,context:{topDriver:breakdown[0]?.name??'N/A',topShare:total?breakdown[0].value/total:0,rows:current.sessions}}
}
