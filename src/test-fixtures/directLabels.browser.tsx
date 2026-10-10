import { createElement, createRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { ChartCanvas, type ChartCanvasHandle } from '../components/ChartCanvas'
import { auditFixture } from './chartAudit'
import type { ChartConfig, ChartKind } from '../core/types'

const host = document.createElement('div')
host.id = 'direct-label-test-host'
host.style.cssText = 'position:fixed;inset:0;background:white;overflow:auto'
document.body.append(host)
const root = createRoot(host), ref = createRef<ChartCanvasHandle>()
let current: ChartConfig
function Fixture({ initial, kind }: { initial: ChartConfig; kind: ChartKind }) {
  const [config, setConfig] = useState(initial)
  const [controlsHost, setControlsHost] = useState<HTMLDivElement | null>(null)
  current = config
  return <><section className="legend-settings"><div ref={setControlsHost}/></section><ChartCanvas directLabelControlsHost={controlsHost} ref={ref} table={auditFixture(kind).table} config={config} disableViewGestures onDirectLabelPositionsChange={(directLabelPositions) => setConfig((config) => ({ ...config, directLabelPositions }))}/></>
}
export function render(kind: ChartKind) {
  const fixture = auditFixture(kind)
  const names = fixture.config.yFields.length ? fixture.config.yFields : [fixture.config.yField]
  const config = { ...fixture.config, autoFitCanvas: false, showLegend: false, showDirectLabels: true, showValues: false, showDirectLabelLines: kind === 'bar' || kind === 'horizontal-bar', directLabelMaxWidth: 100, movingAverageWindow: 2, seriesStyles: { ...fixture.config.seriesStyles, [names[0]]: { ...fixture.config.seriesStyles[names[0]], legendLabel: 'Выручка от цифровой музыки' } } }
  if (kind === 'line' || kind === 'stream-graph') config.seriesStyles[names[1]] = { ...fixture.config.seriesStyles[names[1]], legendLabel: 'Выручка от цифровой музыки' }
  flushSync(() => root.render(createElement(Fixture, { key: kind, initial: config, kind })))
}
export function configuration() { return current }
export async function exportSvg() { await ref.current!.exportSvg({ scale: 1 }) }
