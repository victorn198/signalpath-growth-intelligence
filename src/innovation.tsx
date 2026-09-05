import { useState, type ReactNode } from 'react'
import {
  Activity, ArrowRight, BarChart3, CircleDollarSign, DatabaseZap,
  FlaskConical, Gauge, MousePointerClick, Repeat2, ShoppingBag, Target, Users,
} from 'lucide-react'
import type { BreakdownRow, Lang, SeriesPoint } from './types'

const compact = (value: number, lang: Lang) => new Intl.NumberFormat(
  lang === 'pt' ? 'pt-BR' : 'en-US',
  { notation: 'compact', maximumFractionDigits: 1 },
).format(Number.isFinite(value) ? value : 0)
const pct = (value: number) => `${(100 * (Number.isFinite(value) ? value : 0)).toFixed(1)}%`
const money = (value: number, lang: Lang) => new Intl.NumberFormat(
  lang === 'pt' ? 'pt-BR' : 'en-US',
  { style: 'currency', currency: 'USD', maximumFractionDigits: 0 },
).format(Number.isFinite(value) ? value : 0)
const num = (row: Record<string, string | number>, key: string) => Number(row[key] ?? 0)
const label = (row: Record<string, string | number>, key: string) => String(row[key] ?? '—')

export type StageLeak = {
  from: string
  to: string
  fromUsers: number
  toUsers: number
  loss: number
  lossRate: number
}

export function largestStageLeak(rows: Record<string, string | number>[]): StageLeak | null {
  const stages = rows
    .map(row => ({ stage: label(row, 'stage'), users: num(row, 'users') }))
    .filter(row => row.users >= 0)
  if (stages.length < 2) return null
  return stages.slice(0, -1).map((row, index) => {
    const next = stages[index + 1]
    const loss = Math.max(0, row.users - next.users)
    return {
      from: row.stage,
      to: next.stage,
      fromUsers: row.users,
      toUsers: next.users,
      loss,
      lossRate: row.users ? loss / row.users : 0,
    }
  }).sort((a, b) => b.loss - a.loss)[0]
}

export function trendStats(rows: SeriesPoint[]) {
  const values = rows.map(row => Number(row.value)).filter(Number.isFinite)
  if (!values.length) return { mean: 0, cv: 0, first: 0, last: 0, change: 0, points: 0 }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const sd = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length)
  const first = values[0]
  const last = values.at(-1) ?? 0
  return { mean, cv: mean ? sd / mean : 0, first, last, change: first ? (last - first) / first : 0, points: values.length }
}

export function changeDrivers(rows: BreakdownRow[]) {
  return rows
    .filter(row => row.previous !== undefined)
    .map(row => ({ ...row, change: row.value - (row.previous ?? 0) }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
}

export function concentrationStats(rows: BreakdownRow[], denominator?: number) {
  const ranked = [...rows].sort((a, b) => b.value - a.value)
  const displayed = ranked.reduce((sum, row) => sum + row.value, 0)
  const total = denominator && denominator > 0 ? denominator : displayed
  return {
    leader: ranked[0],
    top3Share: total ? ranked.slice(0, 3).reduce((sum, row) => sum + row.value, 0) / total : 0,
    displayedShare: total ? Math.min(1, displayed / total) : 0,
  }
}

function Stat({ value, children, tone }: { value: string; children: ReactNode; tone?: 'positive' | 'negative' }) {
  return <article><strong className={tone}>{value}</strong><span>{children}</span></article>
}

function DriverList({ rows, lang, inverse = false }: { rows: ReturnType<typeof changeDrivers>; lang: Lang; inverse?: boolean }) {
  const shown = rows.slice(0, 4)
  const max = Math.max(...shown.map(row => Math.abs(row.change)), 1)
  return <div className="page-driver-list">{shown.map(row => {
    const positive = inverse ? row.change <= 0 : row.change >= 0
    return <div key={row.name}><span>{row.name}</span><i><b style={{ width: `${100 * Math.abs(row.change) / max}%` }} /></i><strong className={positive ? 'positive' : 'negative'}>{row.change >= 0 ? '▲' : '▼'} {compact(Math.abs(row.change), lang)}</strong></div>
  })}</div>
}

type ExecutiveLens = 'efficiency' | 'drivers' | 'anomalies' | 'concentration' | 'scenario'
function DriverTree({ values, breakdown, trend, lang }: { values: Record<string, number>; breakdown: BreakdownRow[]; trend: SeriesPoint[]; lang: Lang }) {
  const [lens, setLens] = useState<ExecutiveLens>('drivers')
  const [uplift, setUplift] = useState(10)
  const users = values.users || 0
  const sessions = values.sessions || 0
  const purchasers = values.purchasers ?? users * (values.conversion || 0)
  const orders = values.orders || 0
  const revenue = values.revenue || 0
  const efficiency = [
    { text: lang === 'pt' ? 'Sessões por usuário' : 'Sessions per user', value: `${(users ? sessions / users : 0).toFixed(2)}×`, icon: MousePointerClick },
    { text: lang === 'pt' ? 'Usuários que compram' : 'Users who purchase', value: pct(users ? purchasers / users : 0), icon: Users },
    { text: lang === 'pt' ? 'Compras por comprador' : 'Purchases per buyer', value: `${(purchasers ? orders / purchasers : 0).toFixed(2)}×`, icon: ShoppingBag },
    { text: lang === 'pt' ? 'Receita por compra' : 'Revenue per purchase', value: money(orders ? revenue / orders : 0, lang), icon: CircleDollarSign },
  ]
  const drivers = changeDrivers(breakdown)
  const stats = trendStats(trend)
  const concentration = concentrationStats(breakdown, users)
  const tabs = [
    ['efficiency', lang === 'pt' ? 'Eficiência' : 'Efficiency', Target],
    ['drivers', lang === 'pt' ? 'Drivers da mudança' : 'Change drivers', BarChart3],
    ['anomalies', lang === 'pt' ? 'Estabilidade' : 'Stability', Activity],
    ['concentration', lang === 'pt' ? 'Concentração' : 'Concentration', Gauge],
    ['scenario', lang === 'pt' ? 'Cenário' : 'Scenario', FlaskConical],
  ] as const
  return <section className="decision-lab"><div className="lab-head"><div><span>{lang === 'pt' ? 'LABORATÓRIO EXECUTIVO · MÉTODOS TRANSPARENTES' : 'EXECUTIVE LAB · TRANSPARENT METHODS'}</span><h2>{lang === 'pt' ? 'Cinco lentes para decidir' : 'Five lenses for a decision'}</h2></div><div className="lab-tabs" role="tablist">{tabs.map(([id, text, Icon]) => <button role="tab" aria-selected={lens === id} className={lens === id ? 'active' : ''} onClick={() => setLens(id)} key={id}><Icon />{text}</button>)}</div></div><div className="lab-body">
    {lens === 'efficiency' && <div className="efficiency-chain">{efficiency.map(({ text, value, icon: Icon }, index) => <div className="driver-step" key={text}><article><Icon size={18} /><small>{text}</small><strong>{value}</strong></article>{index < efficiency.length - 1 && <ArrowRight className="driver-arrow" size={20} />}</div>)}</div>}
    {lens === 'drivers' && <div className="driver-analysis"><div className="lab-copy"><b>{lang === 'pt' ? 'Quais canais moveram compradores?' : 'Which channels moved purchasers?'}</b><p>{lang === 'pt' ? 'Variação absoluta de compradores contra a janela anterior.' : 'Absolute purchaser change versus the prior window.'}</p></div><DriverList rows={drivers} lang={lang} /></div>}
    {lens === 'anomalies' && <div className="anomaly-analysis"><div className="lab-copy"><b>{lang === 'pt' ? 'O sinal diário está estável?' : 'Is the daily signal stable?'}</b><p>{lang === 'pt' ? 'Variabilidade descritiva; períodos curtos não sustentam detecção robusta de anomalias.' : 'Descriptive variability; short windows do not support robust anomaly detection.'}</p></div><Stat value={pct(stats.cv)}>{lang === 'pt' ? 'coeficiente de variação' : 'coefficient of variation'}</Stat><Stat value={compact(stats.mean, lang)}>{lang === 'pt' ? 'média diária' : 'daily average'}</Stat></div>}
    {lens === 'concentration' && <div className="concentration-analysis"><div className="lab-copy"><b>{lang === 'pt' ? 'O alcance depende de poucos canais?' : 'Does reach depend on a few channels?'}</b><p>{lang === 'pt' ? 'Participação calculada contra todos os usuários do recorte.' : 'Share calculated against all users in scope.'}</p></div><Stat value={pct(concentration.top3Share)}>Top 3</Stat><Stat value={concentration.leader?.name ?? '—'}>{lang === 'pt' ? 'canal líder' : 'leading channel'}</Stat></div>}
    {lens === 'scenario' && <div className="scenario-analysis"><div className="lab-copy"><b>{lang === 'pt' ? 'E se a conversão melhorar?' : 'What if conversion improves?'}</b><p>{lang === 'pt' ? 'Sensibilidade linear baseada no recorte, não previsão.' : 'Linear sensitivity based on the scope, not a forecast.'}</p></div><label><span>{lang === 'pt' ? 'Aumento relativo' : 'Relative uplift'} <b>{uplift}%</b></span><input type="range" min="1" max="30" value={uplift} onChange={event => setUplift(Number(event.target.value))} /></label><Stat value={pct((values.conversion || 0) * (1 + uplift / 100))}>{lang === 'pt' ? 'conversão projetada' : 'projected conversion'}</Stat><Stat value={`+${compact(purchasers * uplift / 100, lang)}`}>{lang === 'pt' ? 'compradores incrementais' : 'incremental purchasers'}</Stat><Stat value={`+${money(revenue * uplift / 100, lang)}`}>{lang === 'pt' ? 'receita incremental' : 'incremental revenue'}</Stat></div>}
  </div></section>
}

type PageLens = 0 | 1 | 2 | 3 | 4
const pageCopy: Record<string, { title: [string, string]; tabs: [string, string][] }> = {
  funnel: { title: ['Five lenses for journey performance', 'Cinco lentes para desempenho da jornada'], tabs: [['Full-source stages', 'Etapas da fonte completa'], ['Biggest leak', 'Maior abandono'], ['Purchaser trend', 'Tendência de compradores'], ['Segment gap', 'Gap por segmento'], ['Conversion recovery', 'Recuperação de conversão']] },
  acquisition: { title: ['Five lenses for acquisition quality', 'Cinco lentes para qualidade de aquisição'], tabs: [['Channel quality', 'Qualidade'], ['Qualified-user change', 'Mudança qualificada'], ['Journey efficiency', 'Eficiência'], ['Qualified concentration', 'Concentração'], ['Reach scenario', 'Cenário de alcance']] },
  products: { title: ['Five lenses for product performance', 'Cinco lentes para desempenho de produto'], tabs: [['Portfolio mix', 'Mix do portfólio'], ['Revenue change', 'Mudança de receita'], ['Concentration', 'Concentração'], ['Basket velocity', 'Velocidade'], ['Leader scenario', 'Cenário do líder']] },
  retention: { title: ['Five lenses for return behavior', 'Cinco lentes para comportamento de retorno'], tabs: [['Repeat health', 'Saúde do retorno'], ['Repeat gap', 'Gap de retorno'], ['Returning trend', 'Tendência'], ['Device spread', 'Dispersão'], ['Repeat recovery', 'Recuperação']] },
  trust: { title: ['Five lenses for data trust', 'Cinco lentes para confiança dos dados'], tabs: [['Query coverage', 'Cobertura'], ['Volume stability', 'Estabilidade'], ['Grain controls', 'Controle de grão'], ['Reconciliation scope', 'Reconciliação'], ['Decision readiness', 'Prontidão']] },
}

function PageLab({ pageId, values, breakdown, detail, referenceDetail, trend, lang }: { pageId: string; values: Record<string, number>; breakdown: BreakdownRow[]; detail: Record<string, string | number>[]; referenceDetail: Record<string, string | number>[]; trend: SeriesPoint[]; lang: Lang }) {
  const [lens, setLens] = useState<PageLens>(0)
  const [uplift, setUplift] = useState(10)
  const copy = pageCopy[pageId] ?? pageCopy.trust
  const stats = trendStats(trend)
  const drivers = changeDrivers(breakdown)
  const users = values.users || 0
  const purchasers = values.purchasers ?? users * (values.conversion || 0)
  const orders = values.orders || 0
  const revenue = values.revenue || 0
  const concentration = concentrationStats(breakdown, pageId === 'products' ? revenue : undefined)
  const segmentRows = detail.filter(row => num(row, pageId === 'retention' ? 'return_pct' : 'conversion_pct') >= 0)
  const rateKey = pageId === 'retention' ? 'return_pct' : 'conversion_pct'
  const rankedSegments = [...segmentRows].sort((a, b) => num(b, rateKey) - num(a, rateKey))
  const bestSegment = rankedSegments[0]
  const worstSegment = rankedSegments.at(-1)
  const stageRows = referenceDetail.filter(row => 'stage' in row && 'users' in row)
  const leak = largestStageLeak(stageRows)
  const finalStageRate = stageRows.length && num(stageRows[0], 'users') ? num(stageRows.at(-1)!, 'users') / num(stageRows[0], 'users') : 0
  const returningUsers = values.returningUsers ?? users * (values.return || 0)

  const commonTrend = <><Stat value={pct(stats.change)} tone={stats.change >= 0 ? 'positive' : 'negative'}>{lang === 'pt' ? 'primeiro ao último ponto' : 'first to last point'}</Stat><Stat value={pct(stats.cv)}>{lang === 'pt' ? 'variabilidade relativa' : 'relative variability'}</Stat><Stat value={compact(stats.mean, lang)}>{lang === 'pt' ? 'média do período' : 'period average'}</Stat></>
  let question = ''
  let note = lang === 'pt' ? 'Calculado para o recorte e período selecionados.' : 'Calculated for the selected scope and period.'
  let content: ReactNode

  if (pageId === 'funnel') {
    const views: ReactNode[] = [
      <><Stat value={compact(num(stageRows[0] ?? {}, 'users'), lang)}>{lang === 'pt' ? 'usuários no início · fonte completa' : 'users at start · full source'}</Stat><Stat value={pct(finalStageRate)}>{lang === 'pt' ? 'alcance da compra · fonte completa' : 'purchase reach · full source'}</Stat><Stat value={String(stageRows.length)}>{lang === 'pt' ? 'etapas instrumentadas' : 'instrumented stages'}</Stat></>,
      <><Stat value={leak ? `${leak.from} → ${leak.to}` : '—'}>{lang === 'pt' ? 'transição crítica · fonte completa' : 'critical transition · full source'}</Stat><Stat value={compact(leak?.loss ?? 0, lang)}>{lang === 'pt' ? 'usuários perdidos' : 'users lost'}</Stat><Stat value={pct(leak?.lossRate ?? 0)}>{lang === 'pt' ? 'abandono na etapa' : 'stage abandonment'}</Stat></>,
      commonTrend,
      <><Stat value={bestSegment ? label(bestSegment, 'driver') : '—'}>{lang === 'pt' ? 'melhor conversão' : 'best conversion'}</Stat><Stat value={bestSegment ? pct(num(bestSegment, rateKey) / 100) : '—'}>{lang === 'pt' ? 'taxa do melhor segmento' : 'best segment rate'}</Stat><Stat value={bestSegment && worstSegment ? `${(num(bestSegment, rateKey) - num(worstSegment, rateKey)).toFixed(1)} p.p.` : '—'}>{lang === 'pt' ? 'distância melhor–pior' : 'best–worst gap'}</Stat></>,
      <><label><span>{lang === 'pt' ? 'Melhoria relativa' : 'Relative improvement'} <b>{uplift}%</b></span><input type="range" min="1" max="30" value={uplift} onChange={event => setUplift(Number(event.target.value))} /></label><Stat value={`+${compact(purchasers * uplift / 100, lang)}`}>{lang === 'pt' ? 'compradores incrementais' : 'incremental purchasers'}</Stat><Stat value={`+${compact(orders * uplift / 100, lang)}`}>{lang === 'pt' ? 'compras incrementais' : 'incremental purchases'}</Stat><Stat value={`+${money(revenue * uplift / 100, lang)}`}>{lang === 'pt' ? 'receita incremental' : 'incremental revenue'}</Stat></>,
    ]
    question = [lang === 'pt' ? 'Como as etapas da fonte completa se comportam?' : 'How do full-source stages perform?', lang === 'pt' ? 'Onde está a maior perda observada?' : 'Where is the largest observed loss?', lang === 'pt' ? 'Compradores estão ganhando ou perdendo ritmo?' : 'Are purchasers gaining or losing momentum?', lang === 'pt' ? 'Qual é a diferença de conversão entre segmentos?' : 'How wide is the segment conversion gap?', lang === 'pt' ? 'Qual seria o impacto de elevar a conversão?' : 'What is the impact of higher conversion?'][lens]
    if (lens < 2) note = lang === 'pt' ? 'Benchmark descritivo da fonte completa; os filtros não alteram estas etapas porque o mart público não preserva flags intermediárias.' : 'Descriptive full-source benchmark; filters do not alter these stages because the public mart does not preserve intermediate flags.'
    content = views[lens]
  } else if (pageId === 'acquisition') {
    const best = rankedSegments[0]
    const views: ReactNode[] = [
      <><Stat value={best ? label(best, 'driver') : '—'}>{lang === 'pt' ? 'canal com maior conversão' : 'highest-converting channel'}</Stat><Stat value={best ? pct(num(best, 'conversion_pct') / 100) : '—'}>{lang === 'pt' ? 'conversão do canal' : 'channel conversion'}</Stat><Stat value={best ? compact(num(best, 'active_users'), lang) : '—'}>{lang === 'pt' ? 'usuários avaliados' : 'users assessed'}</Stat></>,
      <DriverList rows={drivers} lang={lang} />,
      <><Stat value={pct(values.conversion || 0)}>{lang === 'pt' ? 'conversão de usuários' : 'user conversion'}</Stat><Stat value={`${(users ? values.sessions / users : 0).toFixed(2)}×`}>{lang === 'pt' ? 'sessões por usuário' : 'sessions per user'}</Stat><Stat value={`${(purchasers ? orders / purchasers : 0).toFixed(2)}×`}>{lang === 'pt' ? 'compras por comprador' : 'purchases per buyer'}</Stat></>,
      <><Stat value={pct(concentration.top3Share)}>Top 3</Stat><Stat value={concentration.leader?.name ?? '—'}>{lang === 'pt' ? 'líder em compradores' : 'purchaser leader'}</Stat><Stat value={pct(concentration.displayedShare)}>{lang === 'pt' ? 'cobertura exibida' : 'displayed coverage'}</Stat></>,
      <><label><span>{lang === 'pt' ? 'Alcance qualificado' : 'Qualified reach'} <b>+{uplift}%</b></span><input type="range" min="1" max="30" value={uplift} onChange={event => setUplift(Number(event.target.value))} /></label><Stat value={`+${compact(purchasers * uplift / 100, lang)}`}>{lang === 'pt' ? 'compradores potenciais' : 'potential purchasers'}</Stat><Stat value={`+${money(revenue * uplift / 100, lang)}`}>{lang === 'pt' ? 'receita linear' : 'linear revenue'}</Stat></>,
    ]
    question = [lang === 'pt' ? 'Qual canal combina escala e intenção?' : 'Which channel combines scale and intent?', lang === 'pt' ? 'Quais canais moveram compradores?' : 'Which channels moved purchasers?', lang === 'pt' ? 'Com que eficiência o alcance converte?' : 'How efficiently does reach convert?', lang === 'pt' ? 'Compradores dependem de poucos canais?' : 'Do purchasers depend on a few channels?', lang === 'pt' ? 'E se o alcance qualificado crescer?' : 'What if qualified reach grows?'][lens]
    content = views[lens]
  } else if (pageId === 'products') {
    const productRows = detail
    const units = productRows.reduce((sum, row) => sum + num(row, 'units'), 0)
    const productOrders = productRows.reduce((sum, row) => sum + num(row, 'orders'), 0)
    const leader = concentration.leader
    const views: ReactNode[] = [
      <><Stat value={leader?.name ?? '—'}>{lang === 'pt' ? 'grupo líder em receita' : 'leading revenue group'}</Stat><Stat value={pct(revenue ? (leader?.value ?? 0) / revenue : 0)}>{lang === 'pt' ? 'participação do líder' : 'leader share'}</Stat><Stat value={String(breakdown.length)}>{lang === 'pt' ? 'grupos exibidos' : 'groups displayed'}</Stat></>,
      <DriverList rows={drivers} lang={lang} />,
      <><Stat value={pct(concentration.top3Share)}>Top 3</Stat><Stat value={pct(concentration.displayedShare)}>{lang === 'pt' ? 'receita coberta no ranking' : 'ranked revenue coverage'}</Stat><Stat value={money(revenue, lang)}>{lang === 'pt' ? 'receita total do recorte' : 'total scoped revenue'}</Stat></>,
      <><Stat value={money(productOrders ? revenue / productOrders : 0, lang)}>{lang === 'pt' ? 'receita por compra' : 'revenue per purchase'}</Stat><Stat value={`${(productOrders ? units / productOrders : 0).toFixed(2)}×`}>{lang === 'pt' ? 'unidades por compra' : 'units per purchase'}</Stat><Stat value={compact(productOrders, lang)}>{lang === 'pt' ? 'compras cobertas no detalhe' : 'purchases covered in detail'}</Stat></>,
      <><label><span>{lang === 'pt' ? 'Crescimento do líder' : 'Leader growth'} <b>+{uplift}%</b></span><input type="range" min="1" max="30" value={uplift} onChange={event => setUplift(Number(event.target.value))} /></label><Stat value={`+${money((leader?.value ?? 0) * uplift / 100, lang)}`}>{lang === 'pt' ? 'receita incremental linear' : 'linear incremental revenue'}</Stat><Stat value={money(revenue + (leader?.value ?? 0) * uplift / 100, lang)}>{lang === 'pt' ? 'receita total simulada' : 'simulated total revenue'}</Stat></>,
    ]
    question = [lang === 'pt' ? 'Quais grupos criam valor?' : 'Which groups create value?', lang === 'pt' ? 'Quais grupos moveram a receita?' : 'Which groups moved revenue?', lang === 'pt' ? 'A receita depende de poucos grupos?' : 'Does revenue depend on a few groups?', lang === 'pt' ? 'Qual é a velocidade da cesta?' : 'What is basket velocity?', lang === 'pt' ? 'E se o grupo líder crescer?' : 'What if the leading group grows?'][lens]
    content = views[lens]
  } else if (pageId === 'retention') {
    const views: ReactNode[] = [
      <><Stat value={pct(values.return || 0)}>{lang === 'pt' ? 'usuários em vários dias' : 'multi-day users'}</Stat><Stat value={compact(returningUsers, lang)}>{lang === 'pt' ? 'usuários recorrentes' : 'returning users'}</Stat><Stat value={compact(users, lang)}>{lang === 'pt' ? 'usuários avaliados' : 'users assessed'}</Stat></>,
      <><Stat value={compact(Math.max(0, users - returningUsers), lang)}>{lang === 'pt' ? 'usuários de um único dia' : 'single-day users'}</Stat><Stat value={pct(1 - (values.return || 0))}>{lang === 'pt' ? 'gap de retorno' : 'repeat gap'}</Stat><Stat value={`${(users && returningUsers ? users / returningUsers : 0).toFixed(1)}×`}>{lang === 'pt' ? 'alcance por recorrente' : 'reach per returning user'}</Stat></>,
      commonTrend,
      <><Stat value={bestSegment ? label(bestSegment, 'driver') : '—'}>{lang === 'pt' ? 'melhor retorno' : 'best return rate'}</Stat><Stat value={bestSegment ? pct(num(bestSegment, 'return_pct') / 100) : '—'}>{lang === 'pt' ? 'taxa do melhor segmento' : 'best segment rate'}</Stat><Stat value={bestSegment && worstSegment ? `${(num(bestSegment, 'return_pct') - num(worstSegment, 'return_pct')).toFixed(1)} p.p.` : '—'}>{lang === 'pt' ? 'distância melhor–pior' : 'best–worst gap'}</Stat></>,
      <><label><span>{lang === 'pt' ? 'Melhoria do retorno' : 'Return improvement'} <b>+{uplift}%</b></span><input type="range" min="1" max="30" value={uplift} onChange={event => setUplift(Number(event.target.value))} /></label><Stat value={`+${compact(returningUsers * uplift / 100, lang)}`}>{lang === 'pt' ? 'recorrentes incrementais' : 'incremental returning users'}</Stat><Stat value={pct(Math.min(1, (values.return || 0) * (1 + uplift / 100)))}>{lang === 'pt' ? 'taxa simulada' : 'simulated rate'}</Stat></>,
    ]
    question = [lang === 'pt' ? 'Quanto do alcance retorna em outro dia?' : 'How much reach returns on another day?', lang === 'pt' ? 'Qual é o tamanho do gap de retorno?' : 'How large is the repeat gap?', lang === 'pt' ? 'A atividade recorrente está melhorando?' : 'Is returning activity improving?', lang === 'pt' ? 'Quais dispositivos têm maior retorno?' : 'Which devices have stronger return?', lang === 'pt' ? 'E se a recorrência melhorar?' : 'What if repeat activity improves?'][lens]
    content = views[lens]
  } else {
    const views: ReactNode[] = [
      <><Stat value={compact(values.rows || 0, lang)}>{lang === 'pt' ? 'eventos consultados' : 'events queried'}</Stat><Stat value={compact(values.days || 0, lang)}>{lang === 'pt' ? 'dias cobertos' : 'days covered'}</Stat><Stat value={compact(users, lang)}>{lang === 'pt' ? 'usuários distintos' : 'distinct users'}</Stat></>,
      commonTrend,
      <><Stat value={compact(values.sessions || 0, lang)}>{lang === 'pt' ? 'sessões distintas' : 'distinct sessions'}</Stat><Stat value="session-day">{lang === 'pt' ? 'grão do mart público' : 'public mart grain'}</Stat><Stat value={String(detail.length)}>{lang === 'pt' ? 'grupos inspecionados' : 'groups inspected'}</Stat></>,
      <><Stat value={compact(orders, lang)}>{lang === 'pt' ? 'compras no mart de sessões' : 'purchases in session mart'}</Stat><Stat value={money(revenue, lang)}>{lang === 'pt' ? 'receita rastreada' : 'tracked revenue'}</Stat><Stat value="Scoped">{lang === 'pt' ? 'totais recalculados no navegador' : 'totals recalculated in browser'}</Stat></>,
      <><Stat value={values.rows > 0 && values.days > 0 ? (lang === 'pt' ? 'Com ressalvas' : 'Qualified') : (lang === 'pt' ? 'Bloqueado' : 'Blocked')}>{lang === 'pt' ? 'prontidão para decisão' : 'decision readiness'}</Stat><Stat value="GA4 sample">{lang === 'pt' ? 'amostra ofuscada e histórica' : 'obfuscated historical sample'}</Stat><Stat value="No causality">{lang === 'pt' ? 'limite de interpretação' : 'interpretation boundary'}</Stat></>,
    ]
    question = [lang === 'pt' ? 'Quanto do recorte foi consultado?' : 'How much of the scope was queried?', lang === 'pt' ? 'O volume diário é estável?' : 'Is daily volume stable?', lang === 'pt' ? 'O grão está explícito?' : 'Is the grain explicit?', lang === 'pt' ? 'Quais totais são reconciliados?' : 'Which totals are reconciled?', lang === 'pt' ? 'A evidência sustenta decisão?' : 'Can the evidence support a decision?'][lens]
    content = views[lens]
  }

  const icons = [Target, BarChart3, Activity, Gauge, pageId === 'trust' ? DatabaseZap : FlaskConical]
  return <section className="decision-lab secondary-lab"><div className="lab-head"><div><span>{lang === 'pt' ? 'LABORATÓRIO DA PÁGINA · MÉTODOS TRANSPARENTES' : 'PAGE LAB · TRANSPARENT METHODS'}</span><h2>{copy.title[lang === 'pt' ? 1 : 0]}</h2></div><div className="lab-tabs" role="tablist">{copy.tabs.map((tab, index) => { const Icon = icons[index]; return <button role="tab" aria-selected={lens === index} className={lens === index ? 'active' : ''} onClick={() => setLens(index as PageLens)} key={tab[0]}><Icon />{tab[lang === 'pt' ? 1 : 0]}</button> })}</div></div><div className="page-lens-content"><div className="lab-copy"><b>{question}</b><p>{note}</p></div>{content}</div></section>
}

export function PageInsight({ pageId, values, breakdown, detail, referenceDetail, trend, lang }: { pageId: string; values: Record<string, number>; breakdown: BreakdownRow[]; detail: Record<string, string | number>[]; referenceDetail: Record<string, string | number>[]; trend: SeriesPoint[]; lang: Lang }) {
  if (pageId === 'executive') return <DriverTree values={values} breakdown={breakdown} trend={trend} lang={lang} />
  return <PageLab pageId={pageId} values={values} breakdown={breakdown} detail={detail} referenceDetail={referenceDetail} trend={trend} lang={lang} />
}
