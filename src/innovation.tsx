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
const pct = (value: number | null) => value !== null && Number.isFinite(value) ? `${(100 * value).toFixed(1)}%` : '—'
const money = (value: number, lang: Lang) => new Intl.NumberFormat(
  lang === 'pt' ? 'pt-BR' : 'en-US',
  { style: 'currency', currency: 'USD', maximumFractionDigits: 0 },
).format(Number.isFinite(value) ? value : 0)
const num = (row: Record<string, string | number>, key: string) => Number(row[key] ?? 0)
const label = (row: Record<string, string | number>, key: string) => String(row[key] ?? '—')

export type StageReachGap = {
  from: string
  to: string
  fromUsers: number
  toUsers: number
  gap: number
  gapRate: number | null
}

const hasNumber = (row: Record<string, string | number>, key: string) =>
  (typeof row[key] === 'number' || (typeof row[key] === 'string' && row[key].trim() !== '')) && Number.isFinite(Number(row[key]))
const validStage = (row: Record<string, string | number>) => typeof row.stage === 'string' && row.stage.trim() !== '' && hasNumber(row, 'users') && num(row, 'users') >= 0

export function largestStageReachGap(rows: Record<string, string | number>[]): StageReachGap | null {
  if (rows.some(row => !validStage(row))) return null
  const stages = rows
    .map(row => ({ stage: label(row, 'stage'), users: num(row, 'users') }))
  if (stages.length < 2) return null
  return stages.slice(0, -1).map((row, index) => {
    const next = stages[index + 1]
    const gap = Math.abs(row.users - next.users)
    return {
      from: row.stage,
      to: next.stage,
      fromUsers: row.users,
      toUsers: next.users,
      gap,
      gapRate: row.users ? gap / row.users : null,
    }
  }).sort((a, b) => b.gap - a.gap)[0]
}

// Compatibility for callers being migrated; these are independent reach counts.
export const largestStageLeak = largestStageReachGap

export function rankSegments(rows: Record<string, string | number>[], rateKey: 'conversion_pct' | 'return_pct') {
  return rows.filter(row => typeof row.driver === 'string' && row.driver.trim() !== '' &&
    hasNumber(row, rateKey) && num(row, rateKey) >= 0 && num(row, rateKey) <= 100 &&
    hasNumber(row, 'active_users') && num(row, 'active_users') >= 100 &&
    (rateKey !== 'conversion_pct' || (hasNumber(row, 'purchasers') && num(row, 'purchasers') >= 5 && num(row, 'purchasers') <= num(row, 'active_users'))))
    .sort((a, b) => num(b, rateKey) - num(a, rateKey))
}

export function cappedScenario(users: number, count: number, uplift: number) {
  const base = Math.min(Math.max(0, count), Math.max(0, users))
  const simulated = Math.min(Math.max(0, users), base * (1 + Math.max(0, uplift) / 100))
  return { rate: users > 0 ? simulated / users : 0, incremental: simulated - base, relative: base > 0 ? (simulated - base) / base : 0 }
}

export function trendStats(rows: SeriesPoint[]) {
  const values = rows.map(row => Number(row.value)).filter(Number.isFinite)
  if (!values.length) return { mean: 0, cv: 0, first: 0, last: 0, change: null, points: 0 }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const sd = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length)
  const first = values[0]
  const last = values.at(-1) ?? 0
  return { mean, cv: mean ? sd / mean : 0, first, last, change: first && values.length > 1 ? (last - first) / first : null, points: values.length }
}

export function changeDrivers(rows: BreakdownRow[]) {
  return rows
    .filter(row => row.name.trim() !== '' && row.previous !== undefined && Number.isFinite(row.previous) && Number.isFinite(row.value))
    .map(row => ({ ...row, change: row.value - (row.previous ?? 0) }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
}

export function concentrationStats(rows: BreakdownRow[], denominator?: number) {
  const ranked = [...rows].sort((a, b) => b.value - a.value)
  // queryMart supplies all groups, so this sum counts memberships, not unique people.
  const memberships = ranked.reduce((sum, row) => sum + row.value, 0)
  const sharesAvailable = ranked.length > 0 && ranked.every(row => row.share !== undefined && Number.isFinite(row.share) && row.share >= 0)
  const shareOf = (subset: BreakdownRow[]) => denominator !== undefined
    ? (denominator > 0 ? subset.reduce((sum, row) => sum + row.value, 0) / denominator : null)
    : (sharesAvailable ? subset.reduce((sum, row) => sum + row.share!, 0) : memberships > 0 ? subset.reduce((sum, row) => sum + row.value, 0) / memberships : null)
  return {
    leader: ranked[0],
    top3Share: shareOf(ranked.slice(0, 3)),
    displayedShare: shareOf(ranked),
  }
}

function Stat({ value, children, tone }: { value: string; children: ReactNode; tone?: 'positive' | 'negative' }) {
  return <article><strong className={tone}>{value}</strong><span>{children}</span></article>
}

function DriverList({ rows, lang, inverse = false }: { rows: ReturnType<typeof changeDrivers>; lang: Lang; inverse?: boolean }) {
  const shown = rows.slice(0, 4)
  if (!shown.length) return <div className="page-driver-list">{lang === 'pt' ? 'Sem comparação disponível.' : 'No comparison available.'}</div>
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
    { text: lang === 'pt' ? 'Registros de compra por comprador' : 'Purchase records per buyer', value: `${(purchasers ? orders / purchasers : 0).toFixed(2)}×`, icon: ShoppingBag },
    { text: lang === 'pt' ? 'Receita por registro de compra' : 'Revenue per purchase record', value: money(orders ? revenue / orders : 0, lang), icon: CircleDollarSign },
  ]
  const drivers = changeDrivers(breakdown)
  const stats = trendStats(trend)
  const concentration = concentrationStats(breakdown)
  const scenario = cappedScenario(users, purchasers, uplift)
  const tabs = [
    ['efficiency', lang === 'pt' ? 'Eficiência' : 'Efficiency', Target],
    ['drivers', lang === 'pt' ? 'Drivers da mudança' : 'Change drivers', BarChart3],
    ['anomalies', lang === 'pt' ? 'Estabilidade' : 'Stability', Activity],
    ['concentration', lang === 'pt' ? 'Concentração' : 'Concentration', Gauge],
    ['scenario', lang === 'pt' ? 'Cenário' : 'Scenario', FlaskConical],
  ] as const
  return <section className="decision-lab"><div className="lab-head"><div><span>{lang === 'pt' ? 'LABORATÓRIO EXECUTIVO · MÉTODOS TRANSPARENTES' : 'EXECUTIVE LAB · TRANSPARENT METHODS'}</span><h2>{lang === 'pt' ? 'Cinco lentes para decidir' : 'Five lenses for a decision'}</h2></div><div className="lab-tabs" role="tablist">{tabs.map(([id, text, Icon]) => <button role="tab" aria-selected={lens === id} className={lens === id ? 'active' : ''} onClick={() => setLens(id)} key={id}><Icon />{text}</button>)}</div></div><div className="lab-body">
    {lens === 'efficiency' && <div className="efficiency-chain">{efficiency.map(({ text, value, icon: Icon }, index) => <div className="driver-step" key={text}><article><Icon size={18} /><small>{text}</small><strong>{value}</strong></article>{index < efficiency.length - 1 && <ArrowRight className="driver-arrow" size={20} />}</div>)}</div>}
    {lens === 'drivers' && <div className="driver-analysis"><div className="lab-copy"><b>{lang === 'pt' ? 'Quais segmentos moveram usuários?' : 'Which segments moved users?'}</b><p>{lang === 'pt' ? 'Variação absoluta de usuários por segmento contra a janela anterior; segmentos podem se sobrepor.' : 'Absolute segment-user change versus the prior window; segments may overlap.'}</p></div><DriverList rows={drivers} lang={lang} /></div>}
    {lens === 'anomalies' && <div className="anomaly-analysis"><div className="lab-copy"><b>{lang === 'pt' ? 'O sinal diário está estável?' : 'Is the daily signal stable?'}</b><p>{lang === 'pt' ? 'Variabilidade descritiva; períodos curtos não sustentam detecção robusta de anomalias.' : 'Descriptive variability; short windows do not support robust anomaly detection.'}</p></div><Stat value={pct(stats.cv)}>{lang === 'pt' ? 'coeficiente de variação' : 'coefficient of variation'}</Stat><Stat value={compact(stats.mean, lang)}>{lang === 'pt' ? 'média diária' : 'daily average'}</Stat></div>}
    {lens === 'concentration' && <div className="concentration-analysis"><div className="lab-copy"><b>{lang === 'pt' ? 'O alcance depende de poucos canais?' : 'Does reach depend on a few channels?'}</b><p>{lang === 'pt' ? 'Participação na soma de vínculos usuário-segmento, não em usuários únicos; inclui todos os grupos.' : 'Share of summed user-segment memberships, not unique users; includes all groups.'}</p></div><Stat value={pct(concentration.top3Share)}>{lang === 'pt' ? 'Top 3 · participação' : 'Top 3 · share'}</Stat><Stat value={concentration.leader?.name ?? '—'}>{lang === 'pt' ? 'canal líder' : 'leading channel'}</Stat></div>}
    {lens === 'scenario' && <div className="scenario-analysis"><div className="lab-copy"><b>{lang === 'pt' ? 'E se a conversão melhorar?' : 'What if conversion improves?'}</b><p>{lang === 'pt' ? 'Sensibilidade com mix constante e receita por comprador constante; conversão limitada a 100%. Não é previsão.' : 'Sensitivity with constant mix and constant revenue per purchaser; conversion capped at 100%. Not a forecast.'}</p></div><label><span>{lang === 'pt' ? 'Aumento relativo' : 'Relative uplift'} <b>{uplift}%</b></span><input type="range" min="1" max="30" value={uplift} onChange={event => setUplift(Number(event.target.value))} /></label><Stat value={pct(scenario.rate)}>{lang === 'pt' ? 'conversão simulada' : 'simulated conversion'}</Stat><Stat value={`+${compact(scenario.incremental, lang)}`}>{lang === 'pt' ? 'compradores incrementais' : 'incremental purchasers'}</Stat><Stat value={`+${money(revenue * scenario.relative, lang)}`}>{lang === 'pt' ? 'receita incremental' : 'incremental revenue'}</Stat></div>}
  </div></section>
}

type PageLens = 0 | 1 | 2 | 3 | 4
const pageCopy: Record<string, { title: [string, string]; tabs: [string, string][] }> = {
  funnel: { title: ['Five lenses for journey performance', 'Cinco lentes para desempenho da jornada'], tabs: [['Full-source stages', 'Etapas da fonte completa'], ['Reach gap', 'Gap de alcance'], ['Purchaser trend', 'Tendência de compradores'], ['Segment gap', 'Gap por segmento'], ['Conversion recovery', 'Recuperação de conversão']] },
  acquisition: { title: ['Five lenses for acquisition quality', 'Cinco lentes para qualidade de aquisição'], tabs: [['Channel quality', 'Qualidade'], ['Qualified-user change', 'Mudança qualificada'], ['Journey efficiency', 'Eficiência'], ['Qualified concentration', 'Concentração'], ['Reach scenario', 'Cenário de alcance']] },
  products: { title: ['Five lenses for product performance', 'Cinco lentes para desempenho de produto'], tabs: [['Portfolio mix', 'Mix do portfólio'], ['Revenue change', 'Mudança de receita'], ['Concentration', 'Concentração'], ['Purchase and item totals', 'Totais de compras e itens'], ['Leader scenario', 'Cenário do líder']] },
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
  const productRevenue = values.productRevenue
  const concentration = concentrationStats(breakdown, pageId === 'products' ? productRevenue : undefined)
  const scenario = cappedScenario(users, purchasers, uplift)
  const returnScenario = cappedScenario(users, values.returningUsers ?? users * (values.return || 0), uplift)
  const rateKey = pageId === 'retention' ? 'return_pct' : 'conversion_pct'
  const rankedSegments = rankSegments(detail, rateKey)
  const bestSegment = rankedSegments[0]
  const worstSegment = rankedSegments.at(-1)
  const stageRows = referenceDetail.filter(validStage)
  const reachGap = largestStageReachGap(referenceDetail)
  const sessionStage = stageRows.find(row => row.stage === 'session_start')
  const purchaseStage = stageRows.find(row => row.stage === 'purchase')
  const returningUsers = values.returningUsers ?? users * (values.return || 0)
  const stageName = (value: string) => ({
    session_start: lang === 'pt' ? 'Início da sessão' : 'Session start',
    view_item: lang === 'pt' ? 'Visualização do produto' : 'Product view',
    add_to_cart: lang === 'pt' ? 'Adição ao carrinho' : 'Add to cart',
    begin_checkout: lang === 'pt' ? 'Início do checkout' : 'Checkout start',
    purchase: lang === 'pt' ? 'Compra' : 'Purchase',
  }[value] ?? value.replaceAll('_', ' '))

  const commonTrend = <><Stat value={pct(stats.change)} tone={stats.change === null ? undefined : stats.change >= 0 ? 'positive' : 'negative'}>{lang === 'pt' ? 'primeiro ao último ponto (exige base não zero)' : 'first to last point (requires nonzero base)'}</Stat><Stat value={pct(stats.cv)}>{lang === 'pt' ? 'variabilidade relativa' : 'relative variability'}</Stat><Stat value={compact(stats.mean, lang)}>{lang === 'pt' ? 'média do período' : 'period average'}</Stat></>
  let question = ''
  let note = lang === 'pt' ? 'Calculado para o recorte e período selecionados.' : 'Calculated for the selected scope and period.'
  let content: ReactNode

  if (pageId === 'funnel') {
    const views: ReactNode[] = [
      <><Stat value={sessionStage ? compact(num(sessionStage, 'users'), lang) : '—'}>{lang === 'pt' ? 'usuários que iniciaram sessão · fonte completa' : 'users who started a session · full source'}</Stat><Stat value={purchaseStage ? compact(num(purchaseStage, 'users'), lang) : '—'}>{lang === 'pt' ? 'usuários com compra · fonte completa' : 'users with a purchase · full source'}</Stat><Stat value={String(stageRows.length)}>{lang === 'pt' ? 'etapas instrumentadas' : 'instrumented stages'}</Stat></>,
      <><Stat value={reachGap ? `${stageName(reachGap.from)} → ${stageName(reachGap.to)}` : '—'}>{lang === 'pt' ? 'eventos comparados · fonte completa' : 'compared events · full source'}</Stat><Stat value={reachGap ? compact(reachGap.gap, lang) : '—'}>{lang === 'pt' ? 'diferença absoluta de alcance' : 'absolute reach difference'}</Stat><Stat value={pct(reachGap?.gapRate ?? null)}>{lang === 'pt' ? 'gap relativo ao primeiro evento' : 'gap relative to first event'}</Stat></>,
      commonTrend,
      <><Stat value={bestSegment ? label(bestSegment, 'driver') : '—'}>{lang === 'pt' ? 'melhor conversão' : 'best conversion'}</Stat><Stat value={bestSegment ? pct(num(bestSegment, rateKey) / 100) : '—'}>{lang === 'pt' ? 'taxa do melhor segmento' : 'best segment rate'}</Stat><Stat value={bestSegment && worstSegment ? `${(num(bestSegment, rateKey) - num(worstSegment, rateKey)).toFixed(1)} p.p.` : '—'}>{lang === 'pt' ? 'distância melhor–pior' : 'best–worst gap'}</Stat></>,
      <><label><span>{lang === 'pt' ? 'Melhoria relativa' : 'Relative improvement'} <b>{uplift}%</b></span><input type="range" min="1" max="30" value={uplift} onChange={event => setUplift(Number(event.target.value))} /></label><Stat value={`+${compact(scenario.incremental, lang)}`}>{lang === 'pt' ? 'compradores incrementais' : 'incremental purchasers'}</Stat><Stat value={`+${compact(orders * scenario.relative, lang)}`}>{lang === 'pt' ? 'registros de compra incrementais' : 'incremental purchase records'}</Stat><Stat value={`+${money(revenue * scenario.relative, lang)}`}>{lang === 'pt' ? 'receita incremental' : 'incremental revenue'}</Stat></>,
    ]
    question = [lang === 'pt' ? 'Como as etapas da fonte completa se comportam?' : 'How do full-source stages perform?', lang === 'pt' ? 'Qual par adjacente tem maior diferença de alcance?' : 'Which adjacent pair has the largest reach difference?', lang === 'pt' ? 'Compradores estão ganhando ou perdendo ritmo?' : 'Are purchasers gaining or losing momentum?', lang === 'pt' ? 'Qual é a diferença de conversão entre segmentos?' : 'How wide is the segment conversion gap?', lang === 'pt' ? 'Qual seria o impacto de elevar a conversão?' : 'What is the impact of higher conversion?'][lens]
    if (lens < 2) note = lang === 'pt' ? 'Contagens independentes por evento, não funil ordenado ou abandono. Referência arquivada sem revalidação dos fatos brutos; filtros não alteram estes eventos.' : 'Independent event-user counts, not an ordered funnel or abandonment. Archived full-source reference, not revalidated against raw facts; filters do not alter these events.'
    content = views[lens]
  } else if (pageId === 'acquisition') {
    const best = rankedSegments[0]
    const views: ReactNode[] = [
      <><Stat value={best ? label(best, 'driver') : '—'}>{lang === 'pt' ? 'canal com maior conversão' : 'highest-converting channel'}</Stat><Stat value={best ? pct(num(best, 'conversion_pct') / 100) : '—'}>{lang === 'pt' ? 'conversão do canal' : 'channel conversion'}</Stat><Stat value={best ? compact(num(best, 'active_users'), lang) : '—'}>{lang === 'pt' ? 'usuários avaliados' : 'users assessed'}</Stat></>,
      <DriverList rows={drivers} lang={lang} />,
      <><Stat value={pct(values.conversion || 0)}>{lang === 'pt' ? 'conversão de usuários' : 'user conversion'}</Stat><Stat value={`${(users ? values.sessions / users : 0).toFixed(2)}×`}>{lang === 'pt' ? 'sessões por usuário' : 'sessions per user'}</Stat><Stat value={`${(purchasers ? orders / purchasers : 0).toFixed(2)}×`}>{lang === 'pt' ? 'registros de compra por comprador' : 'purchase records per buyer'}</Stat></>,
      <><Stat value={pct(concentration.top3Share)}>{lang === 'pt' ? 'Top 3 · participação' : 'Top 3 · share'}</Stat><Stat value={concentration.leader?.name ?? '—'}>{lang === 'pt' ? 'líder em compradores' : 'purchaser leader'}</Stat><Stat value={pct(concentration.displayedShare)}>{lang === 'pt' ? 'vínculos comprador-segmento exibidos' : 'displayed purchaser-segment memberships'}</Stat></>,
      <><label><span>{lang === 'pt' ? 'Alcance qualificado' : 'Qualified reach'} <b>+{uplift}%</b></span><input type="range" min="1" max="30" value={uplift} onChange={event => setUplift(Number(event.target.value))} /></label><Stat value={`+${compact(purchasers * uplift / 100, lang)}`}>{lang === 'pt' ? 'compradores potenciais' : 'potential purchasers'}</Stat><Stat value={`+${money(revenue * uplift / 100, lang)}`}>{lang === 'pt' ? 'receita linear' : 'linear revenue'}</Stat></>,
    ]
    question = [lang === 'pt' ? 'Qual canal combina escala e intenção?' : 'Which channel combines scale and intent?', lang === 'pt' ? 'Quais segmentos moveram compradores?' : 'Which segments moved purchasers?', lang === 'pt' ? 'Com que eficiência o alcance converte?' : 'How efficiently does reach convert?', lang === 'pt' ? 'Compradores dependem de poucos canais?' : 'Do purchasers depend on a few channels?', lang === 'pt' ? 'E se o alcance qualificado crescer?' : 'What if qualified reach grows?'][lens]
    content = views[lens]
  } else if (pageId === 'products') {
    const leader = concentration.leader
    const views: ReactNode[] = [
      <><Stat value={leader?.name ?? '—'}>{lang === 'pt' ? 'grupo líder em receita' : 'leading revenue group'}</Stat><Stat value={pct(productRevenue > 0 && leader ? leader.value / productRevenue : null)}>{lang === 'pt' ? 'participação do líder' : 'leader share'}</Stat><Stat value={String(breakdown.length)}>{lang === 'pt' ? 'grupos exibidos' : 'groups displayed'}</Stat></>,
      <DriverList rows={drivers} lang={lang} />,
      <><Stat value={pct(concentration.top3Share)}>{lang === 'pt' ? 'Top 3 · participação' : 'Top 3 · share'}</Stat><Stat value={pct(concentration.displayedShare)}>{lang === 'pt' ? 'receita coberta no ranking' : 'ranked revenue coverage'}</Stat><Stat value={productRevenue === undefined ? '—' : money(productRevenue, lang)}>{lang === 'pt' ? 'receita de itens · mart completo' : 'item revenue · full mart'}</Stat></>,
      <><Stat value={orders > 0 ? money(revenue / orders, lang) : '—'}>{lang === 'pt' ? 'receita por registro de compra' : 'revenue per purchase record'}</Stat><Stat value={values.productUnits === undefined ? '—' : compact(values.productUnits, lang)}>{lang === 'pt' ? 'unidades de itens · mart completo' : 'item units · full mart'}</Stat><Stat value={productRevenue === undefined ? '—' : money(productRevenue, lang)}>{lang === 'pt' ? 'receita de itens · mart completo' : 'item revenue · full mart'}</Stat></>,
      <><label><span>{lang === 'pt' ? 'Crescimento do líder' : 'Leader growth'} <b>+{uplift}%</b></span><input type="range" min="1" max="30" value={uplift} onChange={event => setUplift(Number(event.target.value))} /></label><Stat value={`+${money((leader?.value ?? 0) * uplift / 100, lang)}`}>{lang === 'pt' ? 'receita incremental linear' : 'linear incremental revenue'}</Stat><Stat value={productRevenue === undefined ? '—' : money(productRevenue + (leader?.value ?? 0) * uplift / 100, lang)}>{lang === 'pt' ? 'receita de itens simulada' : 'simulated item revenue'}</Stat></>,
    ]
    question = [lang === 'pt' ? 'Quais grupos criam valor?' : 'Which groups create value?', lang === 'pt' ? 'Quais grupos moveram a receita?' : 'Which groups moved revenue?', lang === 'pt' ? 'A receita depende de poucos grupos?' : 'Does revenue depend on a few groups?', lang === 'pt' ? 'Qual é a receita por registro de compra e o total de itens?' : 'What is revenue per purchase record and the item total?', lang === 'pt' ? 'E se o grupo líder crescer?' : 'What if the leading group grows?'][lens]
    content = views[lens]
  } else if (pageId === 'retention') {
    const views: ReactNode[] = [
      <><Stat value={pct(values.return || 0)}>{lang === 'pt' ? 'usuários em vários dias' : 'multi-day users'}</Stat><Stat value={compact(returningUsers, lang)}>{lang === 'pt' ? 'usuários recorrentes' : 'returning users'}</Stat><Stat value={compact(users, lang)}>{lang === 'pt' ? 'usuários avaliados' : 'users assessed'}</Stat></>,
      <><Stat value={compact(Math.max(0, users - returningUsers), lang)}>{lang === 'pt' ? 'usuários de um único dia' : 'single-day users'}</Stat><Stat value={pct(1 - (values.return || 0))}>{lang === 'pt' ? 'gap de retorno' : 'repeat gap'}</Stat><Stat value={`${(users && returningUsers ? users / returningUsers : 0).toFixed(1)}×`}>{lang === 'pt' ? 'alcance por recorrente' : 'reach per returning user'}</Stat></>,
      commonTrend,
      <><Stat value={bestSegment ? label(bestSegment, 'driver') : '—'}>{lang === 'pt' ? 'melhor retorno' : 'best return rate'}</Stat><Stat value={bestSegment ? pct(num(bestSegment, 'return_pct') / 100) : '—'}>{lang === 'pt' ? 'taxa do melhor segmento' : 'best segment rate'}</Stat><Stat value={bestSegment && worstSegment ? `${(num(bestSegment, 'return_pct') - num(worstSegment, 'return_pct')).toFixed(1)} p.p.` : '—'}>{lang === 'pt' ? 'distância melhor–pior' : 'best–worst gap'}</Stat></>,
      <><label><span>{lang === 'pt' ? 'Melhoria do retorno' : 'Return improvement'} <b>+{uplift}%</b></span><input type="range" min="1" max="30" value={uplift} onChange={event => setUplift(Number(event.target.value))} /></label><Stat value={`+${compact(returnScenario.incremental, lang)}`}>{lang === 'pt' ? 'recorrentes incrementais' : 'incremental returning users'}</Stat><Stat value={pct(returnScenario.rate)}>{lang === 'pt' ? 'taxa simulada' : 'simulated rate'}</Stat></>,
    ]
    question = [lang === 'pt' ? 'Quanto do alcance retorna em outro dia?' : 'How much reach returns on another day?', lang === 'pt' ? 'Qual é o tamanho do gap de retorno?' : 'How large is the repeat gap?', lang === 'pt' ? 'A atividade recorrente está melhorando?' : 'Is returning activity improving?', lang === 'pt' ? 'Quais dispositivos têm maior retorno?' : 'Which devices have stronger return?', lang === 'pt' ? 'E se a recorrência melhorar?' : 'What if repeat activity improves?'][lens]
    content = views[lens]
  } else {
    const views: ReactNode[] = [
      <><Stat value={compact(values.rows || 0, lang)}>{lang === 'pt' ? 'eventos consultados' : 'events queried'}</Stat><Stat value={compact(values.days || 0, lang)}>{lang === 'pt' ? 'dias cobertos' : 'days covered'}</Stat><Stat value={compact(users, lang)}>{lang === 'pt' ? 'usuários distintos' : 'distinct users'}</Stat></>,
      commonTrend,
      <><Stat value={compact(values.sessions || 0, lang)}>{lang === 'pt' ? 'sessões distintas' : 'distinct sessions'}</Stat><Stat value="session-day">{lang === 'pt' ? 'grão do mart público' : 'public mart grain'}</Stat><Stat value={String(detail.length)}>{lang === 'pt' ? 'grupos inspecionados' : 'groups inspected'}</Stat></>,
      <><Stat value={values.sessionRevenue === undefined ? '—' : money(values.sessionRevenue, lang)}>{lang === 'pt' ? 'receita legada · sessões-dia' : 'legacy revenue · session-days'}</Stat><Stat value={productRevenue === undefined ? '—' : money(productRevenue, lang)}>{lang === 'pt' ? 'receita de itens · mart completo' : 'item revenue · full mart'}</Stat><Stat value={values.sessionRevenue === undefined || productRevenue === undefined ? '—' : money(values.sessionRevenue - productRevenue, lang)}>{lang === 'pt' ? 'divergência · sessões menos itens' : 'discrepancy · sessions minus items'}</Stat></>,
      <><Stat value={values.rows > 0 && values.days > 0 ? (lang === 'pt' ? 'Com ressalvas' : 'Qualified') : (lang === 'pt' ? 'Bloqueado' : 'Blocked')}>{lang === 'pt' ? 'prontidão para decisão' : 'decision readiness'}</Stat><Stat value="GA4 sample">{lang === 'pt' ? 'amostra ofuscada e histórica' : 'obfuscated historical sample'}</Stat><Stat value="No causality">{lang === 'pt' ? 'limite de interpretação' : 'interpretation boundary'}</Stat></>,
    ]
    question = [lang === 'pt' ? 'Quanto do recorte foi consultado?' : 'How much of the scope was queried?', lang === 'pt' ? 'O volume diário é estável?' : 'Is daily volume stable?', lang === 'pt' ? 'O grão está explícito?' : 'Is the grain explicit?', lang === 'pt' ? 'Qual é a divergência entre os marts?' : 'What is the discrepancy between marts?', lang === 'pt' ? 'A evidência sustenta decisão?' : 'Can the evidence support a decision?'][lens]
    content = views[lens]
  }

  if ((pageId === 'funnel' && lens === 3) || (pageId === 'acquisition' && lens === 0) || (pageId === 'retention' && lens === 3)) {
    note = lang === 'pt'
      ? `Ranking apenas dos segmentos exibidos com pelo menos 100 usuários${rateKey === 'conversion_pct' ? ' e 5 compradores' : ''}; sem amostra elegível, sem ranking.`
      : `Ranks only displayed segments with at least 100 users${rateKey === 'conversion_pct' ? ' and 5 purchasers' : ''}; no eligible sample, no ranking.`
  }
  if (pageId === 'acquisition' && lens === 3) note = lang === 'pt'
    ? 'Participação na soma de vínculos comprador-segmento de todos os grupos, não em compradores únicos.'
    : 'Share of summed purchaser-segment memberships across all groups, not unique purchasers.'
  if (pageId === 'products' && lens === 3) note = lang === 'pt'
    ? 'Média = receita de itens / registros de compra por sessão-dia, não pedidos únicos certificados. Totais de itens do mart completo; não medem tamanho da cesta.'
    : 'Average = item revenue / session-day purchase records, not certified unique orders. Full-mart item totals do not measure basket size.'
  if (lens === 4 && pageId !== 'trust') note = lang === 'pt'
    ? 'Sensibilidade, não previsão. Mix e receita por comprador constantes; crescimento do líder mantém demais grupos fixos. Conversão e retorno limitados a 100%; alcance pode crescer.'
    : 'Sensitivity, not a forecast. Constant mix and revenue per purchaser; leader growth holds other groups fixed. Conversion and return capped at 100%; reach may grow.'

  if (pageId === 'trust' && lens >= 3) note = lang === 'pt'
    ? 'Fatos brutos indisponíveis: a fonte e pedidos únicos não podem ser certificados. A receita legada de sessões é duplicada entre dias; a diferença para itens é uma divergência, não reconciliação concluída.'
    : 'Raw facts unavailable: the source and unique orders cannot be certified. Legacy session revenue is duplicated across days; the item difference is a discrepancy, not completed reconciliation.'

  const icons = [Target, BarChart3, Activity, Gauge, pageId === 'trust' ? DatabaseZap : FlaskConical]
  return <section className="decision-lab secondary-lab"><div className="lab-head"><div><span>{lang === 'pt' ? 'LABORATÓRIO DA PÁGINA · MÉTODOS TRANSPARENTES' : 'PAGE LAB · TRANSPARENT METHODS'}</span><h2>{copy.title[lang === 'pt' ? 1 : 0]}</h2></div><div className="lab-tabs" role="tablist">{copy.tabs.map((tab, index) => { const Icon = icons[index]; return <button role="tab" aria-selected={lens === index} className={lens === index ? 'active' : ''} onClick={() => setLens(index as PageLens)} key={tab[0]}><Icon />{tab[lang === 'pt' ? 1 : 0]}</button> })}</div></div><div className="page-lens-content"><div className="lab-copy"><b>{question}</b><p>{note}</p></div>{content}</div></section>
}

export function PageInsight({ pageId, values, breakdown, detail, referenceDetail, trend, lang }: { pageId: string; values: Record<string, number>; breakdown: BreakdownRow[]; detail: Record<string, string | number>[]; referenceDetail: Record<string, string | number>[]; trend: SeriesPoint[]; lang: Lang }) {
  if (pageId === 'executive') return <DriverTree values={values} breakdown={breakdown} trend={trend} lang={lang} />
  return <PageLab pageId={pageId} values={values} breakdown={breakdown} detail={detail} referenceDetail={referenceDetail} trend={trend} lang={lang} />
}
