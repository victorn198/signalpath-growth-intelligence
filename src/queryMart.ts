import type { BreakdownRow, SeriesPoint } from './types'

export type FilterState = { channel: string; device: string; country: string; period: '7'|'30'|'all' }
export type DrillItem = { dimension: 'channel'|'device'|'country'; value: string }
export type MartResult = {
  current: Record<string, number>; previous: Record<string, number>; trend: SeriesPoint[]
  breakdown: BreakdownRow[]; detail: Record<string, string | number>[]
  context: { topDriver: string; topShare: number; rows: number; dimension: string; canDrill: boolean }
}

let connectionPromise: Promise<import('@duckdb/duckdb-wasm').AsyncDuckDBConnection> | undefined
let database: import('@duckdb/duckdb-wasm').AsyncDuckDB | undefined
const registeredMarts = new Set<string>()
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`

async function connection(pageId: string) {
  if (!connectionPromise) connectionPromise = (async () => {
    const duckdb = await import('@duckdb/duckdb-wasm'); const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles())
    const workerUrl = URL.createObjectURL(new Blob([`importScripts("${bundle.mainWorker!}");`], { type: 'text/javascript' }))
    const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), new Worker(workerUrl)); await db.instantiate(bundle.mainModule, bundle.pthreadWorker); database=db
    await db.registerFileURL('growth.parquet', new URL('./data/mart_growth_sessions.parquet', window.location.href).href, duckdb.DuckDBDataProtocol.HTTP, false)
    registeredMarts.add('growth.parquet')
    return db.connect()
  })()
  const con=await connectionPromise
  if(pageId==='products'&&!registeredMarts.has('products.parquet')){
    const duckdb=await import('@duckdb/duckdb-wasm')
    await database!.registerFileURL('products.parquet',new URL('./data/mart_growth_products.parquet',window.location.href).href,duckdb.DuckDBDataProtocol.HTTP,false)
    registeredMarts.add('products.parquet')
  }
  return con
}

const records = (table: { toArray: () => Record<string, unknown>[] }) => table.toArray().map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'bigint' ? Number(value) : value]))) as Record<string, string | number>[]

let queryQueue: Promise<void> = Promise.resolve()
export function queryMart(filters: FilterState, pageId: string, drillPath: DrillItem[] = []): Promise<MartResult> {
  const result = queryQueue.then(() => runQuery(filters, pageId, drillPath))
  queryQueue = result.then(() => undefined, () => undefined)
  return result
}
async function runQuery(filters: FilterState, pageId: string, drillPath: DrillItem[]): Promise<MartResult> {
  const con = await connection(pageId)
  const clauses = [filters.channel && `channel=${literal(filters.channel)}`, filters.device && `device=${literal(filters.device)}`, filters.country && `country=${literal(filters.country)}`,...drillPath.map(item=>`${item.dimension}=${literal(item.value)}`)].filter(Boolean)
  const where = clauses.length ? `where ${clauses.join(' and ')}` : ''
  const days=filters.period==='all'?0:Number(filters.period),range=`with base as (select * from read_parquet('growth.parquet') ${where}), bounds as (select min(event_date) lo,max(event_date) hi from base), ranges as(select ${days?`hi-${days-1}`:'lo'} current_start,hi current_end,${days?`hi-${days*2-1}`:'NULL::DATE'} previous_start,${days?`hi-${days}`:'NULL::DATE'} previous_end from bounds)`
  const productRange=`with product_base as (select * from read_parquet('products.parquet') ${where}), product_bounds as (select min(event_date) lo,max(event_date) hi from product_base), product_ranges as(select ${days?`hi-${days-1}`:'lo'} current_start,hi current_end,${days?`hi-${days*2-1}`:'NULL::DATE'} previous_start,${days?`hi-${days}`:'NULL::DATE'} previous_end from product_bounds)`
  const metricSql = (period: 'current'|'previous') => `${range}, scoped as (select b.* from base b,ranges where event_date between ${period}_start and ${period}_end), user_days as (select user_id,count(distinct event_date) activity_days from scoped group by user_id) select count(distinct user_id)::double users,count(distinct concat(user_id,'|',session_id))::double sessions,count(distinct user_id) filter(where purchased=1)::double purchasers,sum(purchases)::double orders,sum(revenue)::double revenue,sum(events)::double "rows",count(distinct event_date)::double active_days,(select count(*)::double from user_days where activity_days>1) returning_users from scoped`
  const readMetrics = async (sql: string) => { const row=(await con.query(sql)).get(0) as Record<string,unknown>; const users=Number(row.users??0),purchasers=Number(row.purchasers??0),returningUsers=Number(row.returning_users??0); return {users,sessions:Number(row.sessions??0),purchasers,conversion:users?purchasers/users:0,orders:Number(row.orders??0),revenue:Number(row.revenue??0),rows:Number(row.rows??0),days:Number(row.active_days??0),returningUsers,return:users?returningUsers/users:0} }
  const current=await readMetrics(metricSql('current')),previous=await readMetrics(metricSql('previous'))
  const trendSql:Record<string,string>={
    executive:`${range} select strftime(event_date,'%b %d') period_label,count(distinct user_id)::double metric_value from base,ranges where event_date between current_start and current_end group by event_date order by event_date`,
    funnel:`${range} select strftime(event_date,'%b %d') period_label,count(distinct user_id) filter(where purchased=1)::double metric_value from base,ranges where event_date between current_start and current_end group by event_date order by event_date`,
    acquisition:`${range} select strftime(event_date,'%b %d') period_label,count(distinct user_id) filter(where purchased=1)::double metric_value from base,ranges where event_date between current_start and current_end group by event_date order by event_date`,
    products:`${range} select strftime(event_date,'%b %d') period_label,round(sum(revenue),2)::double metric_value from base,ranges where event_date between current_start and current_end group by event_date order by event_date`,
    retention:`${range}, scoped as(select b.* from base b,ranges where event_date between current_start and current_end), returning_users as(select user_id from scoped group by user_id having count(distinct event_date)>1) select strftime(event_date,'%b %d') period_label,count(distinct user_id)::double metric_value from scoped join returning_users using(user_id) group by event_date order by event_date`,
    trust:`${range} select strftime(event_date,'%b %d') period_label,sum(events)::double metric_value from base,ranges where event_date between current_start and current_end group by event_date order by event_date`
  }
  const trendTable=await con.query(trendSql[pageId]??trendSql.executive)
  const hierarchies:Record<string,Array<'channel'|'device'|'country'>>={executive:['channel','device','country'],funnel:['device','channel','country'],acquisition:['channel','country','device'],products:['country','channel','device'],retention:['device','country','channel'],trust:['country','device','channel']}
  const hierarchy=hierarchies[pageId]??hierarchies.executive
  const dimension=hierarchy[Math.min(drillPath.length,hierarchy.length-1)]
  const breakdownSql:Record<string,string>={
    products:`${productRange} select product_type driver_name,sum(revenue) filter(where event_date between current_start and current_end)::double driver_value,sum(revenue) filter(where event_date between previous_start and previous_end)::double previous_value from product_base,product_ranges group by 1 order by driver_value desc limit 12`,
    retention:`${range}, windowed as (select device,user_id,event_date,'current' window_name from base,ranges where event_date between current_start and current_end union all select device,user_id,event_date,'previous' window_name from base,ranges where event_date between previous_start and previous_end), qualified as (select device,user_id,window_name from windowed group by device,user_id,window_name having count(distinct event_date)>1) select device driver_name,count(*) filter(where window_name='current')::double driver_value,count(*) filter(where window_name='previous')::double previous_value from qualified group by device order by driver_value desc limit 12`,
    trust:`${range} select ${dimension} driver_name,sum(events) filter(where event_date between current_start and current_end)::double driver_value,sum(events) filter(where event_date between previous_start and previous_end)::double previous_value from base,ranges group by 1 order by driver_value desc limit 12`
  }
  const defaultBreakdown=pageId==='acquisition'?`${range} select ${dimension} as driver_name,count(distinct user_id) filter(where purchased=1 and event_date between current_start and current_end)::double as driver_value,count(distinct user_id) filter(where purchased=1 and event_date between previous_start and previous_end)::double as previous_value from base,ranges group by 1 order by driver_value desc limit 12`:`${range} select ${dimension} as driver_name,count(distinct user_id) filter(where event_date between current_start and current_end)::double as driver_value,count(distinct user_id) filter(where event_date between previous_start and previous_end)::double as previous_value from base,ranges group by 1 order by driver_value desc limit 12`
  const breakdownTable=await con.query(breakdownSql[pageId]??defaultBreakdown)
  const detailSql=pageId==='products'?`${productRange} select item_name product,product_type category,round(sum(revenue),2)::double revenue,sum(units)::double units,sum(orders)::double orders from product_base,product_ranges where event_date between current_start and current_end group by 1,2 order by revenue desc limit 20`:pageId==='retention'?`${range}, scoped as(select b.* from base b,ranges where event_date between current_start and current_end), user_days as(select ${dimension} driver,user_id,count(distinct event_date) activity_days from scoped group by 1,2) select driver,count(*)::double active_users,count(*) filter(where activity_days>1)::double returning_users,round(100*count(*) filter(where activity_days>1)/nullif(count(*),0),1)::double return_pct from user_days group by 1 order by active_users desc limit 20`:`${range} select ${dimension} driver,count(distinct user_id)::double active_users,count(distinct concat(user_id,'|',session_id))::double sessions,count(distinct user_id) filter(where purchased=1)::double purchasers,sum(purchases)::double purchases,round(sum(revenue),2)::double tracked_revenue,round(100*count(distinct user_id) filter(where purchased=1)/nullif(count(distinct user_id),0),1)::double conversion_pct from base,ranges where event_date between current_start and current_end group by 1 order by active_users desc limit 20`
  const detailTable=await con.query(detailSql)
  const detail=records(detailTable),breakdown=records(breakdownTable).map(row=>({name:String(row.driver_name??'Unknown'),value:Number(row.driver_value??0),previous:filters.period==='all'?undefined:Number(row.previous_value??0)}))
  const denominator={acquisition:current.purchasers,products:current.revenue,retention:current.returningUsers,trust:current.rows}[pageId]??current.users
  return {current,previous,trend:trendTable.toArray().map(row=>({label:String(row.period_label),value:Number(row.metric_value)})),breakdown,detail,context:{topDriver:breakdown[0]?.name??'N/A',topShare:denominator?breakdown[0].value/denominator:0,rows:current.sessions,dimension:pageId==='products'?'product_type':dimension,canDrill:pageId!=='products'&&drillPath.length<hierarchy.length-1}}
}
