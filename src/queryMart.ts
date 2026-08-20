import type { SeriesPoint } from './types'

export type FilterState = { channel: string; device: string; country: string }
export type MartResult = { current: Record<string, number>; previous: Record<string, number>; trend: SeriesPoint[] }

let connectionPromise: Promise<import('@duckdb/duckdb-wasm').AsyncDuckDBConnection> | undefined
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`

async function connection() {
  if (!connectionPromise) connectionPromise = (async () => {
    const duckdb = await import('@duckdb/duckdb-wasm')
    const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles())
    const workerUrl = URL.createObjectURL(new Blob([`importScripts("${bundle.mainWorker!}");`], { type: 'text/javascript' }))
    const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), new Worker(workerUrl))
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
    await db.registerFileURL('growth.parquet', new URL('./data/mart_growth_sessions.parquet', window.location.href).href, duckdb.DuckDBDataProtocol.HTTP, false)
    return db.connect()
  })()
  return connectionPromise
}

export async function queryMart(filters: FilterState): Promise<MartResult> {
  const con = await connection()
  const clauses = [filters.channel && `channel=${literal(filters.channel)}`, filters.device && `device=${literal(filters.device)}`, filters.country && `country=${literal(filters.country)}`].filter(Boolean)
  const where = clauses.length ? `where ${clauses.join(' and ')}` : ''
  const metricSql = (period: 'current'|'previous') => `with base as (select * from read_parquet('growth.parquet') ${where}), bounds as (select min(event_date) lo,max(event_date) hi from base), scoped as (select b.* from base b,bounds where event_date ${period === 'current' ? '>=' : '<'} lo+((hi-lo)/2)::integer) select count(distinct user_id)::double users,count(*)::double sessions,count(distinct user_id) filter(where purchased=1)::double purchasers,sum(purchases)::double orders,sum(revenue)::double revenue,count(distinct event_date)::double active_days from scoped`
  const readMetrics = async (sql: string) => {
    const row = (await con.query(sql)).get(0) as Record<string, unknown>
    const users=Number(row.users??0), purchasers=Number(row.purchasers??0)
    return { users, sessions:Number(row.sessions??0), conversion:users?purchasers/users:0, orders:Number(row.orders??0), revenue:Number(row.revenue??0), days:Number(row.active_days??0) }
  }
  const current=await readMetrics(metricSql('current')), previous=await readMetrics(metricSql('previous'))
  const table=await con.query(`select strftime(event_date,'%b %d') as period_label,count(distinct user_id)::double as metric_value from read_parquet('growth.parquet') ${where} group by event_date order by event_date`)
  return { current, previous, trend: table.toArray().map(row => ({ label:String(row.period_label), value:Number(row.metric_value) })) }
}
