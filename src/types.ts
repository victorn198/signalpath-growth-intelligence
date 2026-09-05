export type Lang = 'en' | 'pt'
export type Localized = { en: string; pt: string }
export type Metric = {
  id: string
  label: Localized
  value: number
  previous: number
  format: 'integer' | 'percent' | 'currency' | 'decimal'
  improvement: 'up' | 'down'
}
export type SeriesPoint = { label: string; value: number; secondary?: number }
export type BreakdownRow = { name: string; value: number; previous?: number; share?: number; note?: string }
export type PageData = {
  id: string
  title: Localized
  eyebrow: Localized
  question: Localized
  metrics: Metric[]
  trendTitle: Localized
  trend: SeriesPoint[]
  breakdownTitle: Localized
  breakdown: BreakdownRow[]
  detailTitle: Localized
  detail: Record<string, string | number>[]
  finding: Localized
  action: Localized
}
export type DashboardData = {
  meta: { source: string; period: string; builtAt: string; rows: number; limitations: Localized }
  filters: { channels: string[]; devices: string[]; countries: string[] }
  pages: PageData[]
}
