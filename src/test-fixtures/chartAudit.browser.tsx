import { createElement, createRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { ChartCanvas, type ChartCanvasHandle } from '../components/ChartCanvas'
import { auditFixture, auditCases, browserAuditCases, type AuditSetting } from './chartAudit'
import { chartRegistry } from '../core/chartRegistry'
import type { DataTable, ChartKind, ChartConfig, ChartElementSelection, ChartSeriesSelection } from '../core/types'

document.getElementById('chart-audit-host')?.remove()
const host = document.createElement('div')
host.id = 'chart-audit-host'
host.style.cssText = 'position:fixed;inset:0;background:white;z-index:100;overflow:auto'
document.body.append(host)
const root = createRoot(host)
import.meta.hot?.dispose(() => { root.unmount(); host.remove() })
const ref = createRef<ChartCanvasHandle>()
let revision = 0
export let editSelected: (values: Partial<ChartConfig['elementStyles'][string]>) => void
export let resetSelection: () => void

function InteractiveCanvas({ table, initialConfig }: { table: DataTable; initialConfig: ChartConfig }) {
  const [config, setConfig] = useState(initialConfig)
  const [series, setSeries] = useState<ChartSeriesSelection | null>(null)
  const [element, setElement] = useState<ChartElementSelection | null>(null)
  host.dataset.selection = JSON.stringify({ series, element })
  editSelected = (values) => { if (element) setConfig((current) => ({ ...current, elementStyles: { ...current.elementStyles, [element.key]: { ...current.elementStyles[element.key], ...values } } })) }
  resetSelection = () => { setElement(null); setSeries(null) }
  return createElement(ChartCanvas, { ref, table, config, disableViewGestures: true, viewZoom: 1, selectedSeriesName: series?.name, selectedElementKey: element?.key, selectedElementTarget: element?.target, onSeriesSelect: (series) => { setSeries(series); setElement(null) }, onSelect: setElement })
}

export function renderInteractive(kind: ChartKind, patch: Partial<ChartConfig> = {}) {
  const fixture = auditFixture(kind), config = { ...fixture.config, ...patch, autoFitCanvas: false }
  host.style.width = `${config.canvasWidth! + 32}px`
  host.style.height = `${config.canvasHeight! + 32}px`
  flushSync(() => root.render(createElement(InteractiveCanvas, { key: ++revision, table: fixture.table, initialConfig: config })))
}

export const catalog = chartRegistry.map((plugin) => ({ id: plugin.id, label: plugin.label, cases: browserAuditCases(plugin.id).map((scenario) => ({ id: scenario.id, export: scenario.export })) }))

export function render(kind: ChartKind, scenarioId: string) {
  const scenario = browserAuditCases(kind).find((scenario) => scenario.id === scenarioId)!
  return renderConfig(kind, scenario.patch)
}

export function renderConfig(kind: ChartKind, patch: Partial<ChartConfig>, table?: DataTable) {
  const fixture = auditFixture(kind)
  const config = { ...fixture.config, ...patch, autoFitCanvas: false }
  host.style.width = `${config.canvasWidth! + 32}px`
  host.style.height = `${config.canvasHeight! + 32}px`
  flushSync(() => root.render(createElement(ChartCanvas, { key: ++revision, ref, table: table ?? fixture.table, config, disableViewGestures: true, viewZoom: 1 })))
  return { width: config.canvasWidth!, height: config.canvasHeight! }
}

export function configurationCases(kind: ChartKind, settings: AuditSetting[]) {
  const fixture = auditFixture(kind), plugin = chartRegistry.find((plugin) => plugin.id === kind)!
  return auditCases(kind, settings).filter((scenario) => !scenario.id.startsWith('axes-') && (!scenario.id.includes(':font=') || kind === 'bar')).map((scenario) => ({ ...scenario, validation: plugin.validate(fixture.table, { ...fixture.config, ...scenario.patch }).errors ?? [] }))
}

export async function exportSvg() { await ref.current!.exportSvg({ scale: 1 }) }
export async function exportPng() { await ref.current!.exportPng({ scale: 1 }) }

export function textBounds() {
  const canvas = host.querySelector('.chart-canvas-shell')!
  const bounds = canvas.getBoundingClientRect()
  return [...canvas.querySelectorAll('svg text')].flatMap((element) => {
    const rect = element.getBoundingClientRect(), style = getComputedStyle(element)
    if (!element.textContent?.trim() || Number(style.opacity) === 0 || style.display === 'none' || rect.width < .1 || rect.height < .1) return []
    return [{ text: element.textContent.slice(0, 160), x: rect.x - bounds.x, y: rect.y - bounds.y, width: rect.width, height: rect.height, outside: rect.x < bounds.x - 1 || rect.y < bounds.y - 1 || rect.right > bounds.right + 1 || rect.bottom > bounds.bottom + 1 }]
  })
}
