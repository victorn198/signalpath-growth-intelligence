import { useEffect, useState } from 'react'
import { Activity, ChevronDown, ExternalLink, Languages, RotateCcw, Route, Sparkles } from 'lucide-react'
import { BarChart, DataGrid, DecisionNote, MetricCard, TrendChart } from './components'
import { ui } from './i18n'
import { MartVerifier } from './MartVerifier'
import { queryMart, type MartResult } from './queryMart'
import { GrowthDriverTree } from './innovation'
import type { DashboardData, Lang } from './types'

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('signalpath-lang') as Lang) || 'en')
  const [pageId, setPageId] = useState('executive')
  const [filters, setFilters] = useState({ channel: '', device: '', country: '' })
  const [mart, setMart] = useState<MartResult | null>(null)
  const [queryState, setQueryState] = useState<'loading'|'ready'|'error'>('loading')
  useEffect(() => { fetch('./data/dashboard.json').then(r => r.json()).then(setData) }, [])
  useEffect(() => { localStorage.setItem('signalpath-lang', lang); document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en' }, [lang])
  useEffect(() => { let active=true; setQueryState('loading'); queryMart(filters,pageId).then(result=>{if(active){setMart(result);setQueryState('ready')}}).catch(error=>{console.error(error);if(active)setQueryState('error')});return()=>{active=false} }, [filters.channel, filters.device, filters.country, pageId])
  if (!data) return <main className="loading"><Activity className="spin" /> Loading SignalPath...</main>
  const page = data.pages.find(p => p.id === pageId) ?? data.pages[0]
  const metrics = page.metrics.map(metric => mart?.current[metric.id] === undefined ? metric : { ...metric, value: mart.current[metric.id], previous: mart.previous[metric.id] ?? metric.previous })
  const trend = mart?.trend.length ? mart.trend : page.trend
  const breakdown = mart?.breakdown.length ? mart.breakdown : page.breakdown
  const detail = mart?.detail.length ? mart.detail : page.detail
  const finding = mart ? (lang==='pt'?`${mart.context.topDriver} lidera o recorte com ${(mart.context.topShare*100).toFixed(1)}% do sinal analisado.`:`${mart.context.topDriver} leads the selected scope with ${(mart.context.topShare*100).toFixed(1)}% of the analyzed signal.`) : page.finding[lang]
  const action = mart ? (lang==='pt'?'Investigue a passagem entre usuários, sessões e compras antes de ampliar investimento.':'Inspect the transition between users, sessions and purchases before scaling investment.') : page.action[lang]
  const t = ui[lang]
  const driverValues=Object.fromEntries(metrics.map(metric=>[metric.id,metric.value]))
  const select = (label: string, key: keyof typeof filters, values: string[]) => <label className="filter"><span>{label}</span><div><select disabled={queryState==='loading'} value={filters[key]} onChange={e => setFilters(v => ({ ...v, [key]: e.target.value }))}><option value="">{t.all}</option>{values.map(v => <option key={v}>{v}</option>)}</select><ChevronDown size={15} /></div></label>
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#top"><span className="brand-mark"><Route /></span><span><b>SignalPath</b><small>Growth Intelligence</small></span></a><nav>{data.pages.map(p => <button className={p.id === page.id ? 'active' : ''} onClick={() => setPageId(p.id)} key={p.id}>{p.title[lang]}</button>)}</nav><button className="language" onClick={() => setLang(lang === 'en' ? 'pt' : 'en')}><Languages size={17} />{lang === 'en' ? 'PT' : 'EN'}</button></header>
    <main id="top">
      <section className="page-head"><div><span className="eyebrow"><Sparkles size={15} />{page.eyebrow[lang]}</span><h1>{page.title[lang]}</h1><p>{page.question[lang]}</p></div><div className="source-stamp"><span>{t.source}</span><b>{data.meta.source}</b><small>{data.meta.period}</small></div></section>
      <section className="filterbar"><div className="filter-heading"><span>{t.filters}</span><small>{data.meta.rows.toLocaleString()} rows</small></div>{select(t.channel, 'channel', data.filters.channels)}{select(t.device, 'device', data.filters.devices)}{select(t.country, 'country', data.filters.countries)}<button className="reset" onClick={() => setFilters({ channel: '', device: '', country: '' })}><RotateCcw size={15} />{t.reset}</button></section>
      <section className="metrics">{metrics.map(metric => <MetricCard key={metric.id} metric={metric} lang={lang} prior={t.prior} />)}</section>
      {queryState==='error'&&<div className="query-error" role="alert">{lang==='pt'?'O recorte não pôde ser recalculado. A visão base foi mantida.':'The selected scope could not be recalculated. The baseline view is shown.'}</div>}
      <GrowthDriverTree values={mart?.current??driverValues} lang={lang}/>
      <section className={`decision-strip ${queryState==='loading'?'is-loading':''}`}><DecisionNote title={t.finding}>{finding}</DecisionNote><DecisionNote title={t.action} action>{action}</DecisionNote></section>
      <section className="analysis-grid"><article className="panel wide"><div className="panel-title"><h2>{page.trendTitle[lang]}</h2><span>Daily signal</span></div><TrendChart data={trend} lang={lang} /></article><article className="panel"><div className="panel-title"><h2>{page.breakdownTitle[lang]}</h2><span>Top drivers</span></div><BarChart data={breakdown} lang={lang} /></article></section>
      <section className="panel detail"><div className="panel-title"><h2>{page.detailTitle[lang]}</h2><span>{t.details}</span></div><DataGrid rows={detail} /></section>
      <section className="trust"><div><h2>{t.trust}</h2><p>{data.meta.limitations[lang]}</p>{page.id === 'trust' && <MartVerifier file="mart_growth_sessions.parquet" lang={lang}/>}</div><div><span>Built</span><b>{data.meta.builtAt}</b></div><div><span>Rows</span><b>{data.meta.rows.toLocaleString()}</b></div></section>
    </main>
    <footer><span>SignalPath · Portfolio case by Victor N.</span><a href="mailto:comercial@wickoai.com.br">{t.contact}<ExternalLink size={14} /></a></footer>
  </div>
}
