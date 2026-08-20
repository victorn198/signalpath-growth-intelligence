import { useMemo } from 'react'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { BarChart as EBarChart, LineChart as ELineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { LegacyGridContainLabel } from 'echarts/features'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { ArrowDownRight, ArrowUpRight, Database, MoveRight } from 'lucide-react'
import type { Lang, Metric, SeriesPoint, BreakdownRow } from './types'

echarts.use([EBarChart, ELineChart, GridComponent, TooltipComponent, LegacyGridContainLabel, CanvasRenderer])

const number = (value: number, format: Metric['format'], lang: Lang) => {
  const locale = lang === 'pt' ? 'pt-BR' : 'en-US'
  if (format === 'percent') return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(value)
  if (format === 'currency') return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
  return new Intl.NumberFormat(locale, { maximumFractionDigits: format === 'decimal' ? 1 : 0, notation: value > 999999 ? 'compact' : 'standard' }).format(value)
}

export function MetricCard({ metric, lang, prior }: { metric: Metric; lang: Lang; prior: string }) {
  const delta = metric.previous === 0 ? 0 : (metric.value - metric.previous) / Math.abs(metric.previous)
  const good = metric.improvement === 'up' ? delta >= 0 : delta <= 0
  const Icon = delta >= 0 ? ArrowUpRight : ArrowDownRight
  return <article className="metric-card">
    <div className="metric-label"><span>{metric.label[lang]}</span><Database size={15} aria-hidden="true" /></div>
    <strong>{number(metric.value, metric.format, lang)}</strong>
    <div className={`delta ${good ? 'good' : 'bad'}`}><Icon size={15} /><span>{number(Math.abs(delta), 'percent', lang)}</span><small>{prior}</small></div>
  </article>
}

export function TrendChart({ data, lang }: { data: SeriesPoint[]; lang: Lang }) {
  const option = { animationDuration: 450, grid: { left: 12, right: 22, top: 24, bottom: 18, containLabel: true }, tooltip: { trigger: 'axis', valueFormatter: (v: number) => new Intl.NumberFormat(lang === 'pt' ? 'pt-BR' : 'en-US').format(v) }, xAxis: { type: 'category', data: data.map(d => d.label), boundaryGap: false, axisLine: { lineStyle: { color: '#d9e2ef' } }, axisLabel: { color: '#697386' } }, yAxis: { type: 'value', splitLine: { lineStyle: { color: '#edf1f7' } }, axisLabel: { color: '#697386' } }, series: [{ type: 'line', data: data.map(d => d.value), smooth: .25, symbolSize: 6, lineStyle: { width: 3, color: '#625bf6' }, itemStyle: { color: '#625bf6' }, areaStyle: { color: 'rgba(98,91,246,.10)' } }] }
  return <ReactEChartsCore echarts={echarts} option={option} style={{ height: 280 }} />
}

export function BarChart({ data, lang }: { data: BreakdownRow[]; lang: Lang }) {
  const sorted = [...data].sort((a,b) => a.value - b.value).slice(-8)
  const compact = (value: number) => new Intl.NumberFormat(lang === 'pt' ? 'pt-BR' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
  const option = { animationDuration: 450, grid: { left: 12, right: 52, top: 12, bottom: 12, containLabel: true }, tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } }, xAxis: { type: 'value', splitNumber: 4, splitLine: { lineStyle: { color: '#edf1f7' } }, axisLabel: { color: '#697386', formatter: compact } }, yAxis: { type: 'category', data: sorted.map(d => d.name), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#27364b', width: 120, overflow: 'truncate' } }, series: [{ type: 'bar', data: sorted.map(d => d.value), barWidth: 12, itemStyle: { color: '#1f6feb', borderRadius: [0, 4, 4, 0] }, label: { show: true, position: 'right', color: '#415269', formatter: (p: { value: number }) => compact(p.value) } }] }
  return <ReactEChartsCore echarts={echarts} option={option} style={{ height: 280 }} />
}

export function DataGrid({ rows }: { rows: Record<string, string | number>[] }) {
  const columns = useMemo(() => Object.keys(rows[0] ?? {}).map(key => ({ accessorKey: key, header: key.replaceAll('_', ' ') })), [rows])
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() })
  return <div className="table-wrap"><table><thead>{table.getHeaderGroups().map(group => <tr key={group.id}>{group.headers.map(h => <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.slice(0, 10).map(row => <tr key={row.id}>{row.getVisibleCells().map(cell => <td key={cell.id}>{String(cell.getValue() ?? '')}</td>)}</tr>)}</tbody></table></div>
}

export function DecisionNote({ title, children, action = false }: { title: string; children: React.ReactNode; action?: boolean }) {
  return <div className={`decision-note ${action ? 'action' : ''}`}><span>{title}</span><p>{children}</p>{action && <MoveRight size={18} />}</div>
}
