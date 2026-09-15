import { useMemo } from 'react'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { BarChart as EBarChart, LineChart as ELineChart, ScatterChart as EScatterChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { LegacyGridContainLabel } from 'echarts/features'
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type SortingState } from '@tanstack/react-table'
import { ArrowDownRight, ArrowUpRight, Database, Download, MoveRight } from 'lucide-react'
import { useState } from 'react'
import type { Lang, Metric, SeriesPoint, BreakdownRow } from './types'

echarts.use([EBarChart, ELineChart, EScatterChart, GridComponent, TooltipComponent, LegacyGridContainLabel, CanvasRenderer])

const number = (value: number, format: Metric['format'], lang: Lang) => {
  const locale = lang === 'pt' ? 'pt-BR' : 'en-US'
  if (format === 'percent') return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(value)
  if (format === 'currency') return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
  return new Intl.NumberFormat(locale, { maximumFractionDigits: format === 'decimal' ? 1 : 0, notation: value > 999999 ? 'compact' : 'standard' }).format(value)
}

export function MetricCard({ metric, lang, prior, comparisonAvailable = true }: { metric: Metric; lang: Lang; prior: string; comparisonAvailable?: boolean }) {
  const hasBase = metric.previous !== 0
  const delta = hasBase ? (metric.value - metric.previous) / Math.abs(metric.previous) : 0
  const good = metric.improvement === 'up' ? delta >= 0 : delta <= 0
  const Icon = delta >= 0 ? ArrowUpRight : ArrowDownRight
  return <article className="metric-card">
    <div className="metric-label"><span>{metric.label[lang]}</span><Database size={15} aria-hidden="true" /></div>
    <strong>{number(metric.value, metric.format, lang)}</strong>
    {comparisonAvailable && hasBase ? <div className={`delta ${delta===0?'neutral':good ? 'good' : 'bad'}`}><Icon size={15} /><span>{number(Math.abs(delta), 'percent', lang)}</span><small>{prior}</small></div> : <div className="delta neutral"><span>{comparisonAvailable ? (lang==='pt'?'base anterior zero':'prior base zero') : '—'}</span><small>{prior}</small></div>}
  </article>
}

export function TrendChart({ data, lang }: { data: SeriesPoint[]; lang: Lang }) {
  const [mode,setMode]=useState<'value'|'index'|'change'>('value')
  const first=data[0]?.value??0
  const values=data.map((point,index)=>mode==='index'?(first?100*point.value/first:null):mode==='change'?(index&&data[index-1].value?100*(point.value-data[index-1].value)/data[index-1].value:null):point.value)
  const option = { animationDuration: 350, grid: { left: 12, right: 22, top: 24, bottom: 18, containLabel: true }, tooltip: { trigger: 'axis', valueFormatter: (v: number) => mode==='change'?`${Number(v).toFixed(1)}%`:new Intl.NumberFormat(lang === 'pt' ? 'pt-BR' : 'en-US',{maximumFractionDigits:1}).format(v) }, xAxis: { type: 'category', data: data.map(d => d.label), boundaryGap: false, axisLine: { lineStyle: { color: '#d9e2ef' } }, axisLabel: { color: '#697386' } }, yAxis: { type: 'value', splitLine: { lineStyle: { color: '#edf1f7' } }, axisLabel: { color: '#697386',formatter:(v:number)=>mode==='change'?`${v}%`:v } }, series: [{ type: 'line', data: values, smooth: .25, symbolSize: 6, lineStyle: { width: 3, color: '#625bf6' }, itemStyle: { color: '#625bf6' }, areaStyle: { color: 'rgba(98,91,246,.10)' },markLine:mode==='index'?{symbol:'none',data:[{yAxis:100}],lineStyle:{type:'dashed',color:'#9aa7b8'}}:undefined }] }
  const labels=lang==='pt'?{value:'Valor',index:'Índice 100',change:'Variação %'}:{value:'Value',index:'Index 100',change:'Change %'}
  return <><div className="chart-modes" aria-label={lang==='pt'?'Modo de comparação':'Comparison mode'}>{(['value','index','change'] as const).map(item=><button className={mode===item?'active':''} onClick={()=>setMode(item)} key={item}>{labels[item]}</button>)}</div><div className="chart-viewport" data-series-signature={values.join(',')}><ReactEChartsCore echarts={echarts} option={option} style={{ height: 300, width:'100%' }} /></div></>
}

export function BarChart({ data, lang, onSelect }: { data: BreakdownRow[]; lang: Lang; onSelect?:(name:string)=>void }) {
  const [measure,setMeasure]=useState<'value'|'share'>('value'),[visual,setVisual]=useState<'bar'|'dot'>('bar')
  const sorted = [...data].sort((a,b) => a.value - b.value).slice(-8)
  const compact = (value: number) => new Intl.NumberFormat(lang === 'pt' ? 'pt-BR' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
  const total=data.reduce((sum,row)=>sum+row.value,0),previousTotal=data.reduce((sum,row)=>sum+(row.previous??0),0),format=(value:number)=>measure==='share'?`${value.toFixed(1)}%`:compact(value),seriesData=sorted.map(row=>{const value=measure==='share'?(total?100*row.value/total:0):row.value,hasPrevious=row.previous!==undefined&&(measure!=='share'||previousTotal>0),previous=measure==='share'?(previousTotal?100*(row.previous??0)/previousTotal:0):(row.previous??0),delta=measure==='share'?value-previous:previous?100*(value-previous)/Math.abs(previous):0;return{value,previous,delta,hasPrevious,isNew:hasPrevious&&previous===0&&value>0&&measure!=='share'}})
  type LabelPoint={data:{value:number;previous:number;delta:number;hasPrevious?:boolean;isNew?:boolean}}
  const comparison=(point:LabelPoint,rich=false)=>{const data=point.data;const unit=measure==='share'?' p.p.':'%';if(!data.hasPrevious)return rich?`{neutral|${lang==='pt'?'sem anterior':'no prior'}}`:(lang==='pt'?'sem anterior':'no prior');if(data.isNew)return rich?`{new|${lang==='pt'?'base zero':'zero base'}}`:(lang==='pt'?'base zero':'zero base');if(Math.abs(data.delta)<.05)return rich?`{neutral|• 0.0${unit}}`:`• 0.0${unit}`;const direction=data.delta>0?'▲':'▼',text=`${direction} ${Math.abs(data.delta).toFixed(1)}${unit}`;return rich?`{${data.delta>0?'up':'down'}|${text}}`:text}
  const label=(point:LabelPoint)=>`{value|${format(point.data.value)}} {divider||} ${comparison(point,true)}`
  const priorSeries=visual==='bar'?{name:lang==='pt'?'Período anterior':'Prior period',type:'bar',data:seriesData.map(row=>row.hasPrevious?row.previous:null),barWidth:18,itemStyle:{color:'rgba(31,111,235,.07)',borderColor:'#9bb7df',borderWidth:1,borderRadius:[0,4,4,0]},silent:true,tooltip:{show:false},z:1}:{name:lang==='pt'?'Período anterior':'Prior period',type:'scatter',data:seriesData.map(row=>row.hasPrevious?row.previous:null),symbolSize:15,itemStyle:{color:'#fff',borderColor:'#9bb7df',borderWidth:2},silent:true,tooltip:{show:false},z:1}
  const currentSeries=visual==='bar'?{type:'bar',data:seriesData,barWidth:10,barGap:'-78%',itemStyle:{color:'#1f6feb',borderRadius:[0,4,4,0]},emphasis:{disabled:true},z:2,label:{show:true,position:'right',formatter:label,rich:{value:{color:'#415269'},divider:{color:'#aab4c3'},up:{color:'#07855b',fontWeight:700},down:{color:'#d9364f',fontWeight:700},new:{color:'#1f6feb',fontWeight:700},neutral:{color:'#7c8798'}}}}:{type:'scatter',data:seriesData,symbolSize:11,itemStyle:{color:'#625bf6'},emphasis:{disabled:true},z:2,label:{show:true,position:'right',formatter:label,rich:{value:{color:'#415269'},divider:{color:'#aab4c3'},up:{color:'#07855b',fontWeight:700},down:{color:'#d9364f',fontWeight:700},new:{color:'#1f6feb',fontWeight:700},neutral:{color:'#7c8798'}}}}
  const option = { animationDuration: 350, grid: { left: 12, right: 120, top: 12, bottom: 12, containLabel: true }, tooltip: { trigger: 'item',formatter:(p:{name:string}&LabelPoint)=>`${p.name}<br/>${format(p.data.value)} | ${comparison(p)}` }, xAxis: { type: 'value', max:measure==='share'?100:undefined,splitNumber:4,splitLine:{lineStyle:{color:'#edf1f7'}},axisLabel:{color:'#697386',formatter:format}},yAxis:{type:'category',data:sorted.map(d=>d.name),axisLine:{show:false},axisTick:{show:false},axisLabel:{color:'#27364b',width:140,overflow:'truncate'}},series:[priorSeries,currentSeries] }
  const m=lang==='pt'?{value:'Valor',share:'Participação',bar:'Barras',dot:'Pontos'}:{value:'Value',share:'Share',bar:'Bars',dot:'Dots'}
  return <><div className="chart-modes split"><div>{(['value','share'] as const).map(item=><button className={measure===item?'active':''} onClick={()=>setMeasure(item)} key={item}>{m[item]}</button>)}</div><small className="comparison-key">{lang==='pt'?'Cheio: atual · contorno: anterior':'Filled: current · outline: prior'}</small><div>{(['bar','dot'] as const).map(item=><button className={visual===item?'active':''} onClick={()=>setVisual(item)} key={item}>{m[item]}</button>)}</div></div><div className="chart-viewport" data-breakdown-signature={sorted.map(row=>`${row.name}:${row.value}:${row.previous??'none'}`).join('|')}><ReactEChartsCore echarts={echarts} option={option} onEvents={onSelect?{click:(params:{name:string})=>onSelect(params.name)}:undefined} style={{height:300,width:'100%'}}/></div></>
}

export function DataGrid({ rows, lang = 'en' }: { rows: Record<string, string | number>[]; lang?: Lang }) {
  const [sorting,setSorting]=useState<SortingState>([])
  const columns = useMemo(() => Object.keys(rows[0] ?? {}).map(key => ({ accessorKey: key, header: key.replaceAll('_', ' '), cell: (info: { getValue: () => unknown }) => { const value=info.getValue(); return typeof value==='number'?new Intl.NumberFormat(lang==='pt'?'pt-BR':'en-US',{maximumFractionDigits:key.endsWith('_pct')?2:Number.isInteger(value)?0:2}).format(value)+(key.endsWith('_pct')?'%':''):String(value??'') } })), [rows,lang])
  const table=useReactTable({data:rows,columns,state:{sorting},onSortingChange:setSorting,getCoreRowModel:getCoreRowModel(),getSortedRowModel:getSortedRowModel()})
  const download=()=>{const keys=Object.keys(rows[0]??{}),csv=[keys.join(','),...rows.map(row=>keys.map(k=>JSON.stringify(row[k]??'')).join(','))].join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='signalpath-detail.csv';a.click();URL.revokeObjectURL(a.href)}
  if(!rows.length)return <div className="empty-state">No data for this scope.</div>
  return <><button className="export" onClick={download}><Download size={14}/>Export CSV</button><div className="table-wrap"><table><thead>{table.getHeaderGroups().map(group => <tr key={group.id}>{group.headers.map(h => <th key={h.id} onClick={h.column.getToggleSortingHandler()}>{flexRender(h.column.columnDef.header, h.getContext())}{h.column.getIsSorted()==='asc'?' ↑':h.column.getIsSorted()==='desc'?' ↓':''}</th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.slice(0,20).map(row=><tr key={row.id}>{row.getVisibleCells().map(cell=><td key={cell.id}>{flexRender(cell.column.columnDef.cell,cell.getContext())}</td>)}</tr>)}</tbody></table></div></>
}

export function DecisionNote({ title, children, action = false }: { title: string; children: React.ReactNode; action?: boolean }) {
  return <div className={`decision-note ${action ? 'action' : ''}`}><span>{title}</span><p>{children}</p>{action && <MoveRight size={18} />}</div>
}
