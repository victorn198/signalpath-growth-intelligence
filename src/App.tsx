import { useEffect, useState } from 'react'
import { Activity, ChevronDown, ChevronUp, ExternalLink, Languages, RotateCcw, Route, Sparkles } from 'lucide-react'
import { BarChart, DataGrid, DecisionNote, MetricCard, TrendChart } from './components'
import { ui } from './i18n'
import { MartVerifier } from './MartVerifier'
import { queryMart, type DrillItem, type MartResult } from './queryMart'
import { largestStageLeak, PageInsight } from './innovation'
import type { DashboardData, Lang } from './types'

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('signalpath-lang') as Lang) || 'en')
  const [pageId, setPageId] = useState('executive')
  const [filters, setFilters] = useState({ channel: '', device: '', country: '', period: '30' as '7'|'30'|'all' })
  const [mart, setMart] = useState<MartResult | null>(null)
  const [queryState, setQueryState] = useState<'loading'|'ready'|'error'>('loading')
  const [drillPath,setDrillPath]=useState<DrillItem[]>([])
  useEffect(() => { fetch('./data/dashboard.json').then(r => { if (!r.ok) throw new Error('Metadata unavailable'); return r.json() }).then(setData).catch(() => setLoadError(true)) }, [])
  useEffect(() => { localStorage.setItem('signalpath-lang', lang); document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en' }, [lang])
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }) }, [pageId])
  useEffect(() => { let active=true; setMart(null); setQueryState('loading'); queryMart(filters,pageId,drillPath).then(result=>{if(active){setMart(result);setQueryState('ready')}}).catch(error=>{console.error(error);if(active)setQueryState('error')});return()=>{active=false} }, [filters.channel, filters.device, filters.country, filters.period, pageId, drillPath])
  if (!data) return <main className="loading" role={loadError ? 'alert' : 'status'}>{loadError ? 'SignalPath metadata could not be loaded. Reload to retry.' : <><Activity className="spin" /> Loading SignalPath...</>}</main>
  const page = data.pages.find(p => p.id === pageId) ?? data.pages[0]
  const pageTitle=page.id==='funnel'?{en:'Journey Evidence',pt:'Evidência de Jornada'}:page.title
  const metricDefinitions=page.id==='trust'?page.metrics.map(metric=>metric.id==='engaged'?{...metric,id:'sessions',label:{en:'Distinct sessions',pt:'Sessões distintas'},format:'integer' as const}:metric):page.metrics
  const metrics = metricDefinitions.map(metric => {
    const id = page.id === 'products' && metric.id === 'revenue' ? 'productRevenue' : metric.id
    const label = metric.id === 'users' ? { en: 'Observed users', pt: 'Usuários observados' } : metric.id === 'orders' ? { en: 'Purchase records', pt: 'Registros de compra' } : id === 'productRevenue' ? { en: 'Item revenue', pt: 'Receita dos itens' } : metric.label
    return { ...metric, label, value: mart?.current[id] ?? 0, previous: mart?.previous[id] ?? 0 }
  })
  const trend = mart?.trend ?? []
  const breakdown = mart?.breakdown ?? []
  const detail = mart?.detail ?? []
  const stageName=(value:string)=>({session_start:lang==='pt'?'Início da sessão':'Session start',view_item:lang==='pt'?'Visualização do produto':'Product view',add_to_cart:lang==='pt'?'Adição ao carrinho':'Add to cart',begin_checkout:lang==='pt'?'Início do checkout':'Checkout start',purchase:lang==='pt'?'Compra':'Purchase'}[value]??value.replaceAll('_',' '))
  const displayedDetail=page.id==='funnel'?page.detail.map(row=>({...row,stage:stageName(String(row.stage??''))})):detail
  const displayedBreakdown=breakdown
  const breakdownSupportsDrill=page.id!=='products'
  const breakdownTitles:Record<string,{pt:string;en:string}>={
    funnel:{pt:'Usuários observados',en:'Observed users'},
    acquisition:{pt:'Compradores observados',en:'Observed purchasers'},
    retention:{pt:'Usuários recorrentes no segmento',en:'Within-segment returning users'},
    trust:{pt:'Volume de eventos',en:'Source event volume'}
  }
  const displayedBreakdownTitle=(breakdownTitles[page.id]?.[lang]??page.breakdownTitle[lang])+(page.id!=='products'?` · ${mart?.context.dimension??''}`:'')
  const liveValues=mart?.current??{}
  const leak=largestStageLeak(page.id==='funnel'?page.detail:[])
  const findingByPage:Record<string,{en:string;pt:string}>={
    executive:{en:`${mart?.context.topDriver??'N/A'} represents ${((mart?.context.topShare??0)*100).toFixed(1)}% of user-segment memberships; users can occur in several segments. Scoped user conversion is ${((liveValues.conversion??0)*100).toFixed(1)}%.`,pt:`${mart?.context.topDriver??'N/A'} representa ${((mart?.context.topShare??0)*100).toFixed(1)}% dos vínculos usuário-segmento; um usuário pode estar em vários segmentos. A conversão do recorte é ${((liveValues.conversion??0)*100).toFixed(1)}%.`},
    funnel:{en:`Scoped conversion is ${((liveValues.conversion??0)*100).toFixed(1)}%. The full-source event-reach gap is largest between ${leak?`${stageName(leak.from)} and ${stageName(leak.to)}`:'unavailable stages'}. Independent audiences do not measure sequential abandonment.`,pt:`A conversão do recorte é ${((liveValues.conversion??0)*100).toFixed(1)}%. A maior diferença de alcance na fonte completa está entre ${leak?`${stageName(leak.from)} e ${stageName(leak.to)}`:'etapas indisponíveis'}. Audiências independentes não medem abandono sequencial.`},
    acquisition:{en:`${mart?.context.topDriver??'N/A'} represents ${((mart?.context.topShare??0)*100).toFixed(1)}% of purchaser-segment memberships, not exclusive customer attribution.`,pt:`${mart?.context.topDriver??'N/A'} representa ${((mart?.context.topShare??0)*100).toFixed(1)}% dos vínculos comprador-segmento, não uma atribuição exclusiva de clientes.`},
    products:{en:`${mart?.context.topDriver??'N/A'} contributes ${((mart?.context.topShare??0)*100).toFixed(1)}% of ranked product revenue in the selected window.`,pt:`${mart?.context.topDriver??'N/A'} contribui com ${((mart?.context.topShare??0)*100).toFixed(1)}% da receita de produtos ranqueada na janela.`},
    retention:{en:`${((liveValues.return??0)*100).toFixed(1)}% of scoped users were active on more than one day; this is repeat-day behavior, not contractual retention.`,pt:`${((liveValues.return??0)*100).toFixed(1)}% dos usuários estiveram ativos em mais de um dia; isso é recorrência diária, não retenção contratual.`},
    trust:{en:`${(liveValues.rows??0).toLocaleString()} events across ${liveValues.days??0} days were queried from the public session mart.`,pt:`${(liveValues.rows??0).toLocaleString('pt-BR')} eventos em ${liveValues.days??0} dias foram consultados no mart público de sessões.`},
  }
  const actionByPage:Record<string,{en:string;pt:string}>={
    executive:{en:'Compare purchaser growth by channel before allocating more acquisition budget.',pt:'Compare o crescimento de compradores por canal antes de aumentar a verba de aquisição.'},
    funnel:{en:'Instrument intermediate stage flags in the scoped mart before using filtered stage-level diagnosis in production.',pt:'Inclua flags das etapas intermediárias no mart antes de usar diagnóstico filtrado por etapa em produção.'},
    acquisition:{en:`Review conversion and purchase volume for ${mart?.context.topDriver??'the leading channel'} before running a scale test.`,pt:`Revise conversão e volume de compras de ${mart?.context.topDriver??'o canal líder'} antes de testar escala.`},
    products:{en:`Validate demand durability for ${mart?.context.topDriver??'the leading group'} before changing merchandising exposure.`,pt:`Valide a durabilidade da demanda de ${mart?.context.topDriver??'o grupo líder'} antes de alterar sua exposição.`},
    retention:{en:'Segment multi-day behavior by device and channel, then test a measurable second-visit intervention.',pt:'Segmente a recorrência por dispositivo e canal e teste uma intervenção mensurável para a segunda visita.'},
    trust:{en:'Treat the obfuscated sample as a modeling demonstration and reconcile identities and revenue against a production backend.',pt:'Trate a amostra ofuscada como demonstração de modelagem e reconcilie identidades e receita com um backend de produção.'},
  }
  const finding=(mart?findingByPage[page.id]:undefined)?.[lang]??page.finding[lang]
  const action=(mart?actionByPage[page.id]:undefined)?.[lang]??page.action[lang]
  const t = ui[lang]
  const comparisonAvailable=mart?.context.comparisonAvailable??false
  const comparisonLabel=comparisonAvailable?`vs. ${mart?.context.previousStart} — ${mart?.context.previousEnd}`:(lang==='pt'?'sem janela anterior completa':'no complete prior window')
  const driverValues=Object.fromEntries(metrics.map(metric=>[metric.id,metric.value]))
  const select = (label: string, key: keyof typeof filters, values: string[]) => <label className="filter"><span>{label}</span><div><select disabled={queryState==='loading'} value={filters[key]} onChange={e => {setDrillPath([]);setFilters(v => ({ ...v, [key]: e.target.value }))}}><option value="">{t.all}</option>{values.map(v => <option key={v}>{v}</option>)}</select><ChevronDown size={15} /></div></label>
  const changePage=(id:string)=>{setPageId(id);setDrillPath([])}
  const drill=(name:string)=>{if(mart?.context.canDrill)setDrillPath(path=>[...path,{dimension:mart.context.dimension as DrillItem['dimension'],value:name}])}
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#top"><span className="brand-mark"><Route /></span><span><b>SignalPath</b><small>Growth Intelligence</small></span></a><nav>{data.pages.map(p => {const title=p.id==='funnel'?{en:'Journey Evidence',pt:'Evidência de Jornada'}:p.title;return <button className={p.id === page.id ? 'active' : ''} onClick={() => changePage(p.id)} key={p.id}>{title[lang]}</button>})}</nav><button className="language" onClick={() => setLang(lang === 'en' ? 'pt' : 'en')}><Languages size={17} />{lang === 'en' ? 'PT' : 'EN'}</button></header>
    <main id="top">
      <section className="page-head"><div><span className="eyebrow"><Sparkles size={15} />{page.eyebrow[lang]}</span><h1>{pageTitle[lang]}</h1><p>{page.id==='funnel'?(lang==='pt'?'Como o alcance dos eventos e a conversão variam entre segmentos?':'How do event reach and conversion differ across segments?'):page.question[lang]}</p></div><div className="source-stamp"><span>{t.source}</span><b>{data.meta.source}</b><small>{data.meta.period}</small></div></section>
      <section className="filterbar"><div className="filter-heading"><span>{t.filters}</span><small>{data.meta.rows.toLocaleString()} rows</small></div><label className="filter"><span>{lang==='pt'?'Período':'Period'}</span><div><select value={filters.period} onChange={e=>{setDrillPath([]);setFilters(v=>({...v,period:e.target.value as typeof filters.period}))}}><option value="7">{lang==='pt'?'Últimos 7 dias':'Last 7 days'}</option><option value="30">{lang==='pt'?'Últimos 30 dias':'Last 30 days'}</option><option value="all">{lang==='pt'?'Todo histórico (sem comparação)':'All history (no comparison)'}</option></select><ChevronDown size={15}/></div></label>{select(t.channel, 'channel', data.filters.channels)}{select(t.device, 'device', data.filters.devices)}{select(t.country, 'country', data.filters.countries)}<button className="reset" onClick={() => {setDrillPath([]);setFilters({ channel: '', device: '', country: '', period:'30' })}}><RotateCcw size={15} />{t.reset}</button></section>
      {queryState==='loading'&&<div className="loading" role="status">{lang==='pt'?'Calculando o recorte selecionado...':'Calculating selected scope...'}</div>}
      {queryState==='error'&&<div className="query-error" role="alert">{lang==='pt'?'Não foi possível consultar os dados. Nenhum número de referência foi substituído pelo recorte. Restaure a visão para tentar novamente.':'Data could not be queried. No baseline figures are shown as filtered results. Restore the view to retry.'}</div>}
      {queryState==='ready'&&mart&&<>
      <p className="scope-caption">{mart.context.currentStart} — {mart.context.currentEnd} · {lang==='pt'?'Janela histórica da amostra':'Historical sample window'} · {comparisonLabel}</p>
      <section className="metrics">{metrics.map(metric => <MetricCard key={metric.id} metric={metric} lang={lang} prior={comparisonLabel} comparisonAvailable={comparisonAvailable} />)}</section>
      {mart.current.users===0?<div className="empty-state" role="status">{lang==='pt'?'Sem observações neste recorte. Altere os filtros.':'No observations in this scope. Change the filters.'}</div>:<>
      <section className="decision-strip"><DecisionNote title={t.finding}>{finding}</DecisionNote><DecisionNote title={t.action} action>{action}</DecisionNote></section>
      <section className="analysis-grid"><article className="panel wide"><div className="panel-title"><h2>{page.trendTitle[lang]}</h2><span>{lang==='pt'?'Comparação temporal':'Time comparison'}</span></div><TrendChart data={trend} lang={lang} /></article><article className="panel"><div className="panel-title"><h2>{displayedBreakdownTitle}</h2><span>{breakdownSupportsDrill?(lang==='pt'?'Clique em uma barra para detalhar':'Click a bar to drill down'):(comparisonAvailable?(lang==='pt'?'Período selecionado vs. anterior':'Selected vs. prior period'):(lang==='pt'?'Todo o histórico':'All history'))}</span></div>{breakdownSupportsDrill&&<div className="drillbar"><span>{lang==='pt'?'Caminho':'Path'}: <b>{mart?.context.dimension??'channel'}</b>{drillPath.map(item=><i key={`${item.dimension}-${item.value}`}> / {item.value}</i>)}</span><div><button disabled={!drillPath.length} onClick={()=>setDrillPath(path=>path.slice(0,-1))}><ChevronUp/>{lang==='pt'?'Voltar nível':'Drill up'}</button><button disabled={!drillPath.length} onClick={()=>setDrillPath([])}><RotateCcw/>{lang==='pt'?'Início':'Reset'}</button></div></div>}<BarChart data={displayedBreakdown} lang={lang} onSelect={breakdownSupportsDrill?drill:undefined}/></article></section>
      <PageInsight key={page.id} pageId={page.id} values={mart.current??driverValues} breakdown={displayedBreakdown} detail={detail} referenceDetail={page.detail} trend={trend} lang={lang}/>
      <section className="panel detail"><div className="panel-title"><h2>{page.id==='funnel'?(lang==='pt'?'Detalhe dos eventos da jornada':'Journey event detail'):page.id==='products'?page.detailTitle[lang]:`${lang==='pt'?'Detalhe por segmento':'Segment detail'} · ${mart.context.dimension}`}</h2><span>{page.id==='funnel'?(lang==='pt'?'Referência arquivada · não revalidada':'Full-source reference · not revalidated'):t.details}</span></div><DataGrid rows={displayedDetail} lang={lang} /></section>
      </>}
      </>}
      <section className="trust"><div><h2>{t.trust}</h2><p>{data.meta.limitations[lang]}</p>{page.id === 'trust' && <MartVerifier file="mart_growth_sessions.parquet" lang={lang}/>}</div><div><span>Built</span><b>{data.meta.builtAt}</b></div><div><span>Rows</span><b>{data.meta.rows.toLocaleString()}</b></div></section>
    </main>
    <footer><span>SignalPath · Portfolio case by Victor N.</span><a href="mailto:victorn198@outlook.com">{t.contact}<ExternalLink size={14} /></a></footer>
  </div>
}
