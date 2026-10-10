import { createElement, createRef } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { ChartCanvas, type ChartCanvasHandle } from '../components/ChartCanvas'
import { auditFixture } from './chartAudit'
import { getChartPlugin } from '../core/chartRegistry'
import { getInstanceByDom, type ECElementEvent } from 'echarts/core'
import type { ChartConfig } from '../core/types'

const host = document.createElement('div')
host.style.cssText = 'position:fixed;inset:0;background:white;width:1032px;height:782px'
document.body.append(host)
const root = createRoot(host), ref = createRef<ChartCanvasHandle>()
const fixture = auditFixture('line')
let config: ChartConfig = { ...fixture.config, kind: 'line', xField: 'x', yField: 'y', yFields: ['y'], seriesField: '', aggregation: 'none', autoFitCanvas: false, canvasWidth: 1000, canvasHeight: 750, showValues: false }
const table = { name: 'large', columns: ['x', 'y'], rows: Array.from({ length: 3000 }, (_, x) => ({ x, y: 50 + Math.sin(x / 40) * 20 })) }
let selection: { selectedElementKey?: string | null; selectedSeriesName?: string | null; selectedSettingsSection?: 'element' | 'title' | null } = {}
export const measurements = { compiles: 0, compileMs: 0, seriesUpdates: 0 }
let observing = false
function observeUpdates() {
  if (observing) return
  const chart = getInstanceByDom(host.querySelector<HTMLElement>('.chart-canvas')!)
  if (!chart) return
  observing = true
  const setOption = chart.setOption.bind(chart)
  chart.setOption = (option, ...args) => {
    if (option.series) measurements.seriesUpdates++
    return Reflect.apply(setOption, chart, [option, ...args])
  }
}
const plugin = getChartPlugin('line'), compile = plugin.compile
plugin.compile = (...args) => {
  const start = performance.now()
  measurements.compiles++
  try { return compile(...args) } finally { measurements.compileMs += performance.now() - start }
}
function draw() { flushSync(() => root.render(createElement(ChartCanvas, { ref, table, config, ...selection }))) }
export function update(patch: Partial<ChartConfig>) { observeUpdates(); config = { ...config, ...patch }; draw() }
export function select(next: typeof selection) { observeUpdates(); selection = next; draw() }
export function selectPoint() {
  const chart = getInstanceByDom(host.querySelector<HTMLElement>('.chart-canvas')!)!
  const series = chart.getOption().series as Array<{ data: Array<{ elementKey?: string }> }>
  const point = series.flatMap((item) => item.data).find((point) => point.elementKey)
  if (!point) throw new Error('Missing chart point')
  select({ selectedElementKey: point.elementKey, selectedSettingsSection: 'element' })
}
export function hover(name: string | null) {
  observeUpdates()
  const chart = getInstanceByDom(host.querySelector<HTMLElement>('.chart-canvas')!)!
  flushSync(() => chart.trigger(name ? 'mouseover' : 'globalout', (name ? { seriesName: name } : {}) as ECElementEvent))
}
export async function svg() { return (await ref.current!.getSvg()).outerHTML }
draw()
