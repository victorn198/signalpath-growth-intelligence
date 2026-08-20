import { useState } from 'react'
import { CheckCircle2, DatabaseZap, LoaderCircle } from 'lucide-react'
import type { Lang } from './types'

export function MartVerifier({ file, lang }: { file: string; lang: Lang }) {
  const [state, setState] = useState<'idle'|'loading'|'ready'|'error'>('idle')
  const [rows, setRows] = useState(0)
  const verify = async () => {
    setState('loading')
    try {
      const duckdb = await import('@duckdb/duckdb-wasm')
      const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles())
      const workerUrl = URL.createObjectURL(new Blob([`importScripts("${bundle.mainWorker!}");`], { type: 'text/javascript' }))
      const worker = new Worker(workerUrl)
      const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), worker)
      await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
      const url = new URL(`./data/${file}`, window.location.href).href
      await db.registerFileURL('public_mart.parquet', url, duckdb.DuckDBDataProtocol.HTTP, false)
      const connection = await db.connect()
      const result = await connection.query("select count(*) as rows from read_parquet('public_mart.parquet')")
      setRows(Number(result.get(0)?.rows ?? 0))
      await connection.close(); await db.terminate(); URL.revokeObjectURL(workerUrl); setState('ready')
    } catch { setState('error') }
  }
  return <button className={`mart-verify ${state}`} onClick={verify} disabled={state === 'loading'}>
    {state === 'loading' ? <LoaderCircle className="spin" size={17}/> : state === 'ready' ? <CheckCircle2 size={17}/> : <DatabaseZap size={17}/>}
    {state === 'ready' ? `${rows.toLocaleString()} ${lang === 'pt' ? 'linhas verificadas no navegador' : 'rows verified in-browser'}` : state === 'error' ? (lang === 'pt' ? 'Falha na verificação local' : 'Local verification failed') : (lang === 'pt' ? 'Verificar mart com DuckDB-WASM' : 'Verify mart with DuckDB-WASM')}
  </button>
}
