import { resolveDecoration, type DecorationTarget } from './decorationGeometry'
import { appendAnnotationText } from '../features/chart-export/annotationSvg'
import { AnnotationPlacementOverlay } from './AnnotationPlacementOverlay'
import type { AnnotationPlacement, AnnotationTool } from './AnnotationSettings'
import { forwardRef, lazy, Suspense, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import './ChartCanvas.css'
import * as echarts from 'echarts/core'
import {
  AxisPointerComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import { LabelLayout, UniversalTransition } from 'echarts/features'
import { loadEchartsForKind } from './echarts/loadEchartsForKind'
import { getChartPlugin, getSeriesColor } from '../core/chartRegistry'
import { sanitizeAnnotationHtml } from '../core/annotationHtml'
import type { ChartAnnotation, ChartConfig, ChartDecoration, ChartElementSelection, ChartKind, ChartSeriesSelection, DataTable } from '../core/types'
import { DecorationAnchorPicker, DecorationTextAnchorPicker, DecorationOverlay } from './DecorationOverlay'
import { AnnotationDisplay, CanvasTextDisplay } from './ChartCanvasDisplays'
import { measureTextWidth, wrapMeasuredText } from '../core/textMetrics'
import { decorationGraphics, type PlotBounds } from './chartDecorations'
import { usesHorizontalAxes } from '../core/chartKinds'
import type { ChartExportOptions, ExportTextBlock } from '../features/chart-export/chartExport'
import { DEFAULT_COMPOSITION_SPACING } from '../entities/chart/model/defaults'
import { renderScene, resolveNativeScene } from '../features/chart-renderer/echarts/renderScene'
import { invalidateTextLayoutCache, layoutText, plainTextDocument } from '../features/chart-layout/textLayout'
import { legacySelection, type ChartSelection } from '../entities/chart/model/ChartSelection'
import { advanceChartRender, failChartRender, initialChartRenderLifecycle, settleChartRender, type ChartRenderStatus } from './chartRenderLifecycle'
import { collectFontFamilies, normalizeFontFamilies, waitForChartFonts } from '../core/textFonts'
import { CanvasTextOverlay } from './CanvasTextOverlay'

const AnnotationOverlay = lazy(() => import('./AnnotationOverlay').then(({ AnnotationOverlay: Component }) => ({ default: Component })))

echarts.use([
  GridComponent,
  TooltipComponent,
  AxisPointerComponent,
  LegendComponent,
  GraphicComponent,
  MarkLineComponent,
  TitleComponent,
  UniversalTransition,
  LabelLayout,
  SVGRenderer,
])

const isHorizontalBar = (config: ChartConfig) => usesHorizontalAxes(config)
const chartIsBusy = (instance: echarts.ECharts) => Boolean((instance as unknown as { __flagInMainProcess?: boolean }).__flagInMainProcess)

export const positionYAxisTitleGraphic = <T extends object>(graphic: T, x: number, y: number, native: boolean): T & { left?: unknown; right?: unknown; top?: unknown; x?: number; y?: number } => native
  ? { ...graphic, top: undefined, y }
  : { ...graphic, left: undefined, right: undefined, top: undefined, x, y }

export interface ChartCanvasHandle {
  getSvg(): Promise<SVGSVGElement>
  exportSvg(options?: ChartExportOptions): Promise<void>
  exportPng(options?: ChartExportOptions): Promise<void>
}

export type ChartSettingsSection = 'title' | 'subtitle' | 'x-axis-title' | 'y-axis-title' | 'x-axis-labels' | 'y-axis-labels' | 'grid' | 'legend' | 'values' | 'note' | 'source' | 'series' | 'element'
export type ChartTransitionMode = 'update' | 'morph' | 'fade' | 'none'
export const chartTransitionMode = (previous: ChartKind | null, next: ChartKind, reducedMotion: boolean): ChartTransitionMode => {
  if (reducedMotion) return 'none'
  if (!previous || previous === next) return 'update'
  const families: ChartKind[][] = [
    ['line', 'spline', 'step-line'],
    ['scatter', 'bubble', 'connected-scatter'],
    ['strip-plot', 'jitter-plot'],
    ['violinplot', 'raincloud'],
  ]
  return families.some((family) => family.includes(previous) && family.includes(next)) ? 'morph' : 'fade'
}

type CustomElementOption = Record<string, unknown> & { children?: CustomElementOption[]; shape?: Record<string, unknown>; style?: Record<string, unknown> }

const animateCustomElement = (element: CustomElementOption | null | undefined) => {
  if (!element) return element
  if (element.shape) element.shape = { transition: 'all', ...element.shape }
  if (element.style) element.style = { transition: 'all', enterFrom: { opacity: 0 }, ...element.style }
  element.children?.forEach(animateCustomElement)
  return element
}

// oxlint-disable-next-line react/only-export-components -- exported for the shared motion regression test
export function enableCustomSeriesTransitions(option: Record<string, unknown>, enabled: boolean) {
  if (!enabled) return
  const series = option.series as Array<{ type?: string; silent?: boolean; animation?: boolean; renderItem?: (...args: unknown[]) => CustomElementOption | null }> | undefined
  series?.forEach((item) => {
    if (item.type !== 'custom' || item.silent || item.animation === false || !item.renderItem) return
    const renderItem = item.renderItem
    item.renderItem = (...args) => animateCustomElement(renderItem(...args)) ?? null
  })
}

// oxlint-disable-next-line react/only-export-components -- exported for the export regression test
export function disableChartAnimations(option: Record<string, unknown>) {
  option.animation = false
  option.animationDuration = 0
  option.animationDurationUpdate = 0
  option.animationDelay = 0
  option.animationDelayUpdate = 0
  const series = option.series as Array<Record<string, unknown>> | undefined
  series?.forEach((item) => {
    item.animation = false
    item.animationDuration = 0
    item.animationDurationUpdate = 0
    item.animationDelay = 0
    item.animationDelayUpdate = 0
    item.progressive = 0
    delete item.universalTransition
  })
}

async function withExportSvg(option: Record<string, unknown>, width: number, height: number, exportFile: (svg: SVGSVGElement) => Promise<void>) {
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;visibility:hidden;pointer-events:none`
  document.body.append(host)
  const instance = echarts.init(host, undefined, { renderer: 'svg', width, height })
  try {
    instance.setOption(option, true)
    instance.getZr().flush()
    const svg = host.querySelector('svg')
    if (!svg) throw new Error('Не удалось подготовить график к экспорту')
    await exportFile(svg)
  } finally {
    instance.dispose()
    host.remove()
  }
}

function fadePreviousPlot(container: HTMLElement, bounds: PlotBounds, duration: number) {
  container.querySelectorAll('.chart-transition-snapshot').forEach((snapshot) => snapshot.remove())
  const source = container.querySelector('svg')
  if (!source) return
  const snapshot = source.cloneNode(true) as SVGElement
  const width = Math.max(1, source.clientWidth), height = Math.max(1, source.clientHeight)
  snapshot.classList.add('chart-transition-snapshot')
  snapshot.setAttribute('aria-hidden', 'true')
  snapshot.style.clipPath = `inset(${Math.max(0, bounds.top)}px ${Math.max(0, width - bounds.right)}px ${Math.max(0, height - bounds.bottom)}px ${Math.max(0, bounds.left)}px)`
  snapshot.style.setProperty('--chart-transition-duration', `${duration}ms`)
  container.append(snapshot)
  requestAnimationFrame(() => snapshot.classList.add('is-leaving'))
  window.setTimeout(() => snapshot.remove(), duration + 50)
}
const chartTransitionFamily = (kind: ChartKind) => {
  if (kind === 'line' || kind === 'spline' || kind === 'step-line') return 'line'
  if (kind === 'scatter' || kind === 'bubble' || kind === 'connected-scatter') return 'xy'
  if (kind === 'strip-plot' || kind === 'jitter-plot') return 'distribution-points'
  if (kind === 'violinplot' || kind === 'raincloud') return 'distribution-density'
  return kind
}

const RHYTHM = { edge: DEFAULT_COMPOSITION_SPACING.canvasInsets.top, titleSubtitle: DEFAULT_COMPOSITION_SPACING.titleSubtitle, headerLegend: DEFAULT_COMPOSITION_SPACING.headerLegend, headerPlot: DEFAULT_COMPOSITION_SPACING.headerPlot, legendPlot: DEFAULT_COMPOSITION_SPACING.legendPlot, plotFooter: DEFAULT_COMPOSITION_SPACING.plotFooter, noteSource: DEFAULT_COMPOSITION_SPACING.noteSource } as const
interface Props {
  table: DataTable
  config: ChartConfig
  onSelect?(selection: ChartElementSelection): void
  onTreemapMove?(source: ChartElementSelection, target: ChartElementSelection, placement: 'before' | 'after'): void
  onSeriesSelect?(selection: ChartSeriesSelection): void
  onSettingsFocus?(section: ChartSettingsSection): void
  onClearSettingsFocus?(): void
  selectedSettingsSection?: ChartSettingsSection | null
  selectedSeriesName?: string | null
  selectedElementKey?: string | null
  selectedElementTarget?: ChartElementSelection['target']
  selectedCategoryLabel?: { axis: 'x' | 'y'; category: string } | null
  onAnnotationSelect?(id: string): void
  onAnnotationChange?(annotation: ChartAnnotation): void
  onAnnotationDuplicate?(annotation: ChartAnnotation): void
  onAnnotationDelete?(id: string): void
  annotationTool?: AnnotationTool | null
  onAnnotationPlace?(value: AnnotationPlacement): void
  onAnnotationCancel?(): void
  selectedAnnotationId?: string | null
  pickingDecorationText?: boolean
  onDecorationTextPick?(id: string, position: { x: number; y: number }): void
  onDecorationAnchorRequest?(kind: 'text' | 'data', endpoint?: 'start' | 'end'): void
  pickingDecorationPoint?: boolean
  onDecorationPointPick?(key: string): void
  onDecorationPointCancel?(): void
  onDecorationLayout?(decorations: ChartDecoration[]): void
  selectedDecorationId?: string | null
  onDecorationSelect?(id: string): void
  onDecorationChange?(decoration: ChartDecoration): void
  onRichTextChange?(field: 'title' | 'subtitle' | 'note' | 'source', html: string, text: string): void
  onCategoryLabelChange?(axis: 'x' | 'y', category: string, text: string): void
  onTextStyleChange?(field: 'title' | 'subtitle' | 'note' | 'source', style: Partial<ChartConfig['titleText']>): void
  disableViewGestures?: boolean
  viewZoom?: number
}

interface AnnotationRun { text: string; color: string; bold: boolean; italic: boolean; underline?: boolean; backgroundColor?: string; textStrokeColor?: string; textStrokeWidth?: string; fontFamily?: string; fontSize?: number; fontWeight?: number }
interface RichLayout { left: number; top: number; width: number; size: number; baseSize: number }
interface CategoryLabelLayout extends Omit<RichLayout, 'baseSize'> { axis: 'x' | 'y'; category: string; style: ChartConfig['titleText']; rotation: number }
const richTextSize = (html: string | undefined, fallback: number) => Math.max(fallback, ...[...(html ?? '').matchAll(/font-size\s*:\s*([\d.]+)px/gi)].map((match) => Number(match[1]) || fallback))
function annotationRuns(annotation: ChartAnnotation, defaults: Omit<AnnotationRun, 'text'> = { color: '#292929', bold: false, italic: false, underline: false }): AnnotationRun[] {
  if (!annotation.html) return annotation.fragments.map(({ text, color, bold, italic, underline, backgroundColor }) => ({ text, color, bold, italic, underline, backgroundColor }))
  const root = document.createElement('div'); root.innerHTML = sanitizeAnnotationHtml(annotation.html)
  const runs: AnnotationRun[] = []
  const shadowColor = (value: string) => value.match(/#[\da-f]{3,8}|rgba?\([^)]+\)/i)?.[0]
  const walk = (node: Node, state: Omit<(typeof runs)[number], 'text'>) => {
    if (node.nodeType === Node.TEXT_NODE) { if (node.textContent) runs.push({ ...state, text: node.textContent }); return }
    if (!(node instanceof HTMLElement)) return
    if (node.tagName === 'BR') { runs.push({ ...state, text: '\n' }); return }
    const block = ['DIV', 'P'].includes(node.tagName)
    if (block && runs.length && !runs.at(-1)!.text.endsWith('\n')) runs.push({ ...state, text: '\n' })
    const start = runs.length
    const weight = node.style.fontWeight
    const decoration = node.style.textDecorationLine || node.style.textDecoration
    const explicitBold = weight ? Number(weight) >= 600 || weight === 'bold' : undefined
    const explicitItalic = node.style.fontStyle ? node.style.fontStyle === 'italic' : undefined
    const explicitUnderline = decoration ? decoration.includes('underline') : undefined
    const fontWeight = weight ? weight === 'normal' ? 400 : weight === 'bold' ? 700 : Number(weight) || state.fontWeight : ['B', 'STRONG'].includes(node.tagName) ? Math.max(700, state.fontWeight ?? 0) : state.fontWeight
    const next = { ...state, fontWeight, color: node.style.color || state.color, backgroundColor: node.style.backgroundColor ? (node.style.backgroundColor === 'transparent' ? undefined : node.style.backgroundColor) : state.backgroundColor, textStrokeColor: node.style.webkitTextStrokeColor || shadowColor(node.style.textShadow) || state.textStrokeColor, textStrokeWidth: node.style.webkitTextStrokeWidth || (node.style.textShadow ? '2' : state.textStrokeWidth), bold: ['B', 'STRONG'].includes(node.tagName) ? true : explicitBold ?? state.bold, italic: ['I', 'EM'].includes(node.tagName) ? true : explicitItalic ?? state.italic, underline: node.tagName === 'U' ? true : explicitUnderline ?? state.underline, fontFamily: node.style.fontFamily || state.fontFamily, fontSize: Number.parseFloat(node.style.fontSize) || state.fontSize }
    node.childNodes.forEach((child) => walk(child, next))
    if (block && (runs.length === start || !runs.at(-1)!.text.endsWith('\n'))) runs.push({ ...next, text: '\n' })
  }
  root.childNodes.forEach((node) => walk(node, { ...defaults, color: annotation.fragments[0]?.color ?? defaults.color }))
  while (runs.at(-1)?.text === '\n') runs.pop()
  const merged = runs.reduce<AnnotationRun[]>((result, run) => {
    const previous = result.at(-1)
    const sameStyle = previous && previous.color === run.color && previous.bold === run.bold && previous.italic === run.italic && previous.underline === run.underline && previous.backgroundColor === run.backgroundColor && previous.textStrokeColor === run.textStrokeColor && previous.textStrokeWidth === run.textStrokeWidth && previous.fontFamily === run.fontFamily && previous.fontSize === run.fontSize && previous.fontWeight === run.fontWeight
    if (sameStyle) previous.text += run.text
    else result.push({ ...run })
    return result
  }, [])
  return merged.length ? merged : annotation.fragments.map(({ text, color, bold, italic, underline, backgroundColor }) => ({ text, color, bold, italic, underline, backgroundColor }))
}
function richBlockStyle(html: string | undefined, plain: string, style: ChartConfig['titleText'], renderedSize = style.size) {
  if (!html) return null
  const runs = annotationRuns({ id: '', x: 0, y: 0, width: 0, fontFamily: style.fontFamily, fontSize: renderedSize, backgroundColor: 'transparent', borderColor: 'transparent', textAlign: style.align, fragments: [{ id: '', text: plain, color: style.color, bold: style.weight >= 600, italic: style.italic }], html }, { color: style.color, bold: style.weight >= 600, italic: style.italic, underline: false, fontFamily: style.fontFamily, fontSize: renderedSize })
  const richRuns = runs.map(({ textStrokeColor: _strokeColor, textStrokeWidth: _strokeWidth, ...run }) => run)
  const safe = (value: string) => value.replaceAll('{', '\\{').replaceAll('}', '\\}')
  return {
    text: richRuns.map((run, index) => `{fragment${index}|${safe(run.text)}}`).join(''),
    rich: Object.fromEntries(richRuns.map((run, index) => [`fragment${index}`, { fill: run.color, fontFamily: run.fontFamily ?? style.fontFamily, fontSize: run.fontSize ?? renderedSize, fontWeight: run.fontWeight ?? (run.bold ? 700 : 400), fontStyle: run.italic ? 'italic' : 'normal', textDecoration: run.underline ? 'underline' : 'none', backgroundColor: run.backgroundColor, padding: 0, lineHeight: Math.round((run.fontSize ?? renderedSize) * style.lineHeight / 100) }])),
  }
}

function exportRichBlock(html: string, plain: string, style: ChartConfig['titleText'], layout: RichLayout): ExportTextBlock {
  const runs = annotationRuns({ id: '', x: 0, y: 0, width: layout.width, fontFamily: style.fontFamily, fontSize: layout.baseSize, backgroundColor: 'transparent', borderColor: 'transparent', textAlign: style.align, fragments: [{ id: '', text: plain, color: style.color, bold: style.weight >= 600, italic: style.italic }], html }, { color: style.color, bold: style.weight >= 600, italic: style.italic, underline: false, fontFamily: style.fontFamily, fontSize: layout.baseSize })
  return {
    left: layout.left, top: layout.top, width: layout.width, style: { ...style, size: layout.baseSize },
    runs: runs.map((run) => ({ text: run.text, color: run.color, fontFamily: run.fontFamily, fontSize: run.fontSize, fontWeight: run.fontWeight ?? (run.bold ? Math.max(700, style.weight) : style.weight >= 600 ? 400 : style.weight), italic: run.italic, underline: run.underline, backgroundColor: run.backgroundColor })),
  }
}

function cloneChartOption<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => cloneChartOption(item)) as T
  if (value instanceof Date) return new Date(value.getTime()) as T
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneChartOption(item)])) as T
  return value
}
// oxlint-disable-next-line react/only-export-components -- exported for a renderer regression test
function applyStyleOpacity(style: Record<string, unknown> | undefined, opacity: number) {
  if (!style) return undefined
  const current = typeof style?.opacity === 'number' ? style.opacity : 1
  return { ...style, opacity: Math.max(0, Math.min(1, current * opacity)) }
}
function applyPointOpacity(style: Record<string, unknown> | undefined, opacity: number, fallbackColor?: string) {
  return applyStyleOpacity(style, opacity) ?? (fallbackColor ? { color: fallbackColor, opacity } : undefined)
}
// oxlint-disable-next-line react/only-export-components -- exported for selection rendering regression tests
export function applySeriesVisualState(option: Record<string, unknown>, config: ChartConfig, selectedSeriesName?: string | null, selectedElementKey?: string | null, hoveredSeriesName?: string | null) {
  const selectedElementSeriesName = selectedElementKey?.split('\u001f')[0]
  const activeSeriesName = hoveredSeriesName ?? selectedSeriesName ?? selectedElementSeriesName ?? null
  const series = option.series as Array<{ id?: string; name?: string; segmentOf?: string; customBarOf?: string; interactionLayer?: 'hit'; type?: string; silent?: boolean; z?: number; itemStyle?: Record<string, unknown>; lineStyle?: Record<string, unknown>; areaStyle?: Record<string, unknown>; emphasis?: Record<string, unknown>; blur?: Record<string, unknown>; data?: Array<Record<string, unknown> | null> }> | undefined
  const seriesOrder = [...new Set(series?.flatMap((item) => {
    const name = item.segmentOf ?? item.customBarOf ?? item.name
    return name && !name.startsWith('__') ? [name] : []
  }) ?? [])]
  series?.forEach((item) => {
    if (item.type === 'pie') {
      const selectedSlice = item.data?.find((point) => point?.elementKey === selectedElementKey)
      const activeName = hoveredSeriesName ?? selectedSeriesName ?? (typeof selectedSlice?.sourceSeriesName === 'string' ? selectedSlice.sourceSeriesName : undefined)
      item.data?.forEach((point) => {
        if (!point) return
        point.itemStyle = applyStyleOpacity(point.itemStyle as Record<string, unknown> | undefined, activeName && point.sourceSeriesName !== activeName ? .22 : 1)
      })
      return
    }
    if (item.emphasis) delete item.emphasis.focus
    delete item.blur
    const rawName = item.name ?? ''
    if (item.interactionLayer === 'hit' || rawName.startsWith('__') && !item.customBarOf && !item.segmentOf) return
    const name = item.segmentOf ?? item.customBarOf ?? item.name
    if (!name || (item.silent && !item.segmentOf && !item.customBarOf)) return
    const selectedElementSeries = selectedElementKey?.startsWith(`${name}\u001f`)
    const active = activeSeriesName === name
    const dimSeries = Boolean(activeSeriesName && !active)
    const seriesIndex = Math.max(0, seriesOrder.indexOf(name))
    const seriesColor = getSeriesColor(config, name, seriesIndex)
    const dimOpacity = dimSeries ? .22 : 1
    const peerOpacity = selectedElementSeries && selectedElementKey ? .62 : 1
    item.itemStyle = applyStyleOpacity(item.itemStyle, dimOpacity)
    item.lineStyle = applyStyleOpacity(item.lineStyle, dimOpacity)
    item.areaStyle = applyStyleOpacity(item.areaStyle, dimSeries ? .22 : 1)
    // ECharts merges matched series: omitted z would retain the hover layer.
    item.z = Number(item.z ?? 2)
    if (active) {
      item.z += 1000
      if (item.type === 'line') item.lineStyle = { ...item.lineStyle, width: Number(item.lineStyle?.width ?? 2) + .8, opacity: 1 }
      if (item.type === 'scatter' || item.type === 'custom') item.itemStyle = { ...item.itemStyle, opacity: 1, shadowColor: 'rgba(32,32,39,.18)', shadowBlur: 4 }
    }
    item.data?.forEach((point) => {
      if (!point || typeof point !== 'object') return
      const pointSelected = point.elementKey === selectedElementKey
      const pointDim = dimSeries || Boolean(selectedElementSeries && selectedElementKey && !pointSelected)
      const fallbackPointColor = item.type === 'bar' || item.type === 'scatter' ? seriesColor : undefined
      if (pointDim || pointSelected) point.itemStyle = applyPointOpacity(point.itemStyle as Record<string, unknown> | undefined, pointSelected ? 1 : dimSeries ? .22 : peerOpacity, fallbackPointColor)
      if (pointSelected) {
        const pointStyle = point.itemStyle as Record<string, unknown> | undefined
        const barLike = item.type === 'bar' || item.id === 'native-waterfall'
        const selectedBorderWidth = barLike ? Number(pointStyle?.borderWidth ?? 0) : Math.max(Number(pointStyle?.borderWidth ?? 0), item.type === 'line' ? 2.5 : 1.5)
        point.itemStyle = {
          ...pointStyle,
          opacity: 1,
          color: item.type === 'line' ? seriesColor : pointStyle?.color ?? seriesColor,
          borderColor: pointStyle?.borderColor ?? seriesColor,
          ...(selectedBorderWidth ? { borderWidth: selectedBorderWidth } : {}),
          shadowColor: seriesColor,
          shadowBlur: barLike ? 0 : 6,
        }
        if (item.type === 'line') {
          point.symbol = point.symbol ?? 'circle'
          if (!point.symbolSize || Number(point.symbolSize) < 11) point.symbolSize = 11
        }
        if (item.type === 'scatter') point.symbolSize = Math.max(Number(point.symbolSize ?? point.bubbleSize ?? config.scatterPointSize ?? 10), Number(point.bubbleSize ?? config.scatterPointSize ?? 10) + 3)
      }
    })
  })
  const graphics = option.graphic as Array<{ sourceSeriesName?: string; z?: number; comparisonConnectorSeriesNames?: string[]; children?: Array<{ style?: Record<string, unknown> }> }> | undefined
  graphics?.forEach((graphic) => {
    if (graphic.sourceSeriesName === activeSeriesName) graphic.z = 1000 + Number(graphic.z ?? 0)
    const names = graphic.comparisonConnectorSeriesNames
    if (!names?.length) return
    const opacity = activeSeriesName && !names.includes(activeSeriesName) ? .22 : 1
    graphic.children?.forEach((child) => { child.style = applyStyleOpacity(child.style, opacity) })
  })
}
export const ChartCanvas = forwardRef<ChartCanvasHandle, Props>(
  ({ pickingDecorationText, onDecorationTextPick, onDecorationAnchorRequest, pickingDecorationPoint, onDecorationPointPick, onDecorationPointCancel, annotationTool, onAnnotationPlace, onAnnotationCancel, table, config: inputConfig, onSelect, onTreemapMove, onSeriesSelect, onSettingsFocus, onClearSettingsFocus, selectedSettingsSection, selectedSeriesName, selectedElementKey, selectedElementTarget, selectedCategoryLabel: requestedCategoryLabel, onAnnotationSelect, onAnnotationChange, onAnnotationDuplicate, onAnnotationDelete, selectedAnnotationId, selectedDecorationId, onDecorationLayout, onDecorationSelect, onDecorationChange, onRichTextChange, onCategoryLabelChange, onTextStyleChange, viewZoom = 1, disableViewGestures = false }, ref) => {
    const config = useMemo(() => normalizeFontFamilies(inputConfig), [inputConfig])
    const container = useRef<HTMLDivElement>(null)
    const viewport = useRef<HTMLDivElement>(null)
    const [canvasScale, setCanvasScale] = useState(1)
    const [gestureZoom, setGestureZoom] = useState(viewZoom)
    const [viewPan, setViewPan] = useState({ x: 0, y: 0 })
    const [renderError, setRenderError] = useState('')
    const [readyKind, setReadyKind] = useState<ChartKind | null>(null)
    const [renderedChartKind, setRenderedChartKind] = useState<ChartKind | null>(null)
    const [renderedPlotKind, setRenderedPlotKind] = useState('')
    const [renderAnimationEnabled, setRenderAnimationEnabled] = useState(false)
    const [renderRetry, setRenderRetry] = useState(0)
    const [renderLifecycle, setRenderLifecycle] = useState(initialChartRenderLifecycle)
    const requestedFontFamilies = useMemo(() => collectFontFamilies(config), [config])
    const fontSignature = `${requestedFontFamilies.join('|')}|${(config.customFonts ?? []).map(({ name, dataUrl, weight, style }) => `${name}:${weight ?? 400}:${style ?? 'normal'}:${dataUrl}`).join('|')}`
    const fontRequest = useRef({ families: requestedFontFamilies, customFonts: config.customFonts })
    fontRequest.current = { families: requestedFontFamilies, customFonts: config.customFonts }
    const [readyFontSignature, setReadyFontSignature] = useState('')
    const [plotBounds, setPlotBounds] = useState<PlotBounds | null>(null)
    const [textAnchorHeights, setTextAnchorHeights] = useState<Record<string, number>>({})
    const [decorationTargets, setDecorationTargets] = useState<DecorationTarget[]>([])
    const [resolvedDecorations, setResolvedDecorations] = useState<ChartDecoration[]>([])
    const decorationTargetsRef = useRef<DecorationTarget[]>([])
    const [richLayouts, setRichLayouts] = useState<Partial<Record<'title' | 'subtitle' | 'note' | 'source', RichLayout>>>({})
    const [categoryLabelLayout, setCategoryLabelLayout] = useState<CategoryLabelLayout | null>(null)
    const chart = useRef<echarts.ECharts | null>(null)
    const gestureZoomRef = useRef(viewZoom)
    const spacePressed = useRef(false)
    const panDrag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
    const viewPanRef = useRef(viewPan)
    viewPanRef.current = viewPan
    const renderRevision = useRef(0)
    const displayOption = useRef<Record<string, unknown> | null>(null)
    const exportOption = useRef<Record<string, unknown> | null>(null)
    const renderedKind = useRef<ChartKind | null>(null)
    const nativeTreemapHits = useRef<Array<{ rect: { x: number; y: number; width: number; height: number }; info: { elementKey: string; sourceSeriesName: string; displayCategory: string; displayValue: string; displayLabel?: string; displayColor?: string } }>>([])
    const editableAxisLabels = useRef(new Map<string, { sourceKey: string; displayText: string }>())
    const clickedSeries = useRef<string | null>(null)
    const treemapDrag = useRef<{ source: ChartElementSelection; click: ChartElementSelection; start: [number, number]; moved: boolean; target?: ChartElementSelection; placement?: 'before' | 'after'; signature?: string } | null>(null)
    const suppressTreemapClick = useRef(false)
    const treemapDragPreview = useRef<HTMLDivElement | null>(null)
    const treemapDropIndicator = useRef<HTMLDivElement | null>(null)
    const [hoveredSeriesName, setHoveredSeriesName] = useState<string | null>(null)
    const selectedTreemapSeriesName = selectedElementKey?.startsWith('treemap-group:') ? selectedElementKey.slice('treemap-group:'.length) : selectedElementKey?.split('\u001f')[0]
    const activeCategoryLabel = useMemo(() => requestedCategoryLabel ?? (() => {
      const match = selectedElementTarget === 'category-label' && selectedElementKey?.match(/^category-label:([xy]):(.*)$/)
      return match ? { axis: match[1] as 'x' | 'y', category: match[2] } : null
    })(), [requestedCategoryLabel, selectedElementKey, selectedElementTarget])
    const selectedCategoryLabel = activeCategoryLabel
    const chartLayoutReady = renderedChartKind != null
    const beginRenderCycle = (status: ChartRenderStatus) => {
      const revision = ++renderRevision.current
      setRenderLifecycle((current) => ({ ...current, revision, status }))
      return revision
    }

    useEffect(() => { clickedSeries.current = selectedSeriesName ?? null }, [selectedSeriesName])

    useEffect(() => {
      let active = true
      beginRenderCycle('loading-modules')
      setReadyKind(null)
      setRenderError('')
      loadEchartsForKind(config.kind)
        .then(() => { if (active) setReadyKind(config.kind) })
        .catch((cause) => {
          if (!active) return
          setRenderLifecycle((current) => failChartRender(current, renderRevision.current))
          setRenderError(cause instanceof Error ? cause.message : 'Не удалось загрузить модуль графика')
        })
      return () => { active = false }
    }, [config.kind])

    useEffect(() => {
      let active = true
      const revision = beginRenderCycle('loading-fonts')
      setReadyFontSignature('')
      void waitForChartFonts(fontRequest.current.families, fontRequest.current.customFonts).then(() => {
        if (!active) return
        invalidateTextLayoutCache()
        setReadyFontSignature(fontSignature)
      }).catch(() => {
        if (active) setRenderLifecycle((current) => failChartRender(current, revision))
      })
      return () => { active = false }
    }, [fontSignature])

    useEffect(() => {
      if (!container.current || readyKind !== config.kind) return
      // ECharts captures registered layouts when the instance is created.
      // Recreate after loading a new chart kind so its layout is available.
      const instance = echarts.init(container.current, undefined, { renderer: 'svg' })
      chart.current = instance
      let resizeFrame = 0
      const resize = () => {
        cancelAnimationFrame(resizeFrame)
        resizeFrame = requestAnimationFrame(() => { if (!instance.isDisposed()) { if (chartIsBusy(instance)) resize(); else instance.resize({ animation: { duration: 0 } }) } })
      }
      const observer = new ResizeObserver(resize)
      observer.observe(container.current)
      window.addEventListener('resize', resize)
      return () => { observer.disconnect(); window.removeEventListener('resize', resize); cancelAnimationFrame(resizeFrame); if (!instance.isDisposed()) instance.dispose(); if (chart.current === instance) chart.current = null }
    }, [readyKind, config.kind])

    useEffect(() => {
      const target = viewport.current
      if (!target) return
      let resizeFrame = 0
      const updateScale = () => {
        const width = Math.max(1, Math.min(1000, config.canvasWidth ?? 1000))
        const height = Math.max(1, Math.min(1000, config.canvasHeight ?? 563))
        setCanvasScale(config.autoFitCanvas === false ? 1 : Math.min(1, target.clientWidth / width, target.clientHeight / height))
        cancelAnimationFrame(resizeFrame)
        resizeFrame = requestAnimationFrame(() => { const instance = chart.current; if (instance && !instance.isDisposed()) { if (chartIsBusy(instance)) updateScale(); else instance.resize({ width, height, animation: { duration: 0 } }) } })
      }
      const observer = new ResizeObserver(updateScale)
      observer.observe(target)
      updateScale()
      return () => { observer.disconnect(); cancelAnimationFrame(resizeFrame) }
    }, [config.autoFitCanvas, config.canvasHeight, config.canvasWidth])

    useEffect(() => { gestureZoomRef.current = viewZoom; setGestureZoom(viewZoom) }, [viewZoom])

    useEffect(() => {
      const target = viewport.current
      if (!target) return
      if (disableViewGestures) return
      const typing = (value: EventTarget | null) => value instanceof HTMLElement && (value.matches('input, textarea, select') || value.isContentEditable)
      const publishZoom = (zoom: number) => window.dispatchEvent(new CustomEvent('canvas-view-zoom', { detail: zoom }))
      const wheel = (event: WheelEvent) => {
        if (typing(document.activeElement) || (event.target as HTMLElement).closest('.canvas-floating-menu')) return
        event.preventDefault(); event.stopPropagation()
        if (Math.abs(event.deltaX) <= .5 && Math.abs(event.deltaY) <= .5) return
        if (event.ctrlKey || event.metaKey) {
          const current = gestureZoomRef.current, sensitivity = event.ctrlKey && !event.metaKey && /Mac|iPod|iPhone|iPad/.test(navigator.platform || '') ? .012 : .0012
          const next = Math.min(5, Math.max(.1, Math.round(current * Math.exp(-event.deltaY * sensitivity) * 100) / 100))
          if (next === current) return
          const bounds = target.getBoundingClientRect(), pointX = event.clientX - bounds.left - bounds.width / 2, pointY = event.clientY - bounds.top - bounds.height / 2, ratio = next / current
          gestureZoomRef.current = next; setGestureZoom(next); setViewPan((pan) => ({ x: pointX - (pointX - pan.x) * ratio, y: pointY - (pointY - pan.y) * ratio })); publishZoom(next)
        } else setViewPan((pan) => ({ x: pan.x - event.deltaX, y: pan.y - event.deltaY }))
      }
      const keyDown = (event: KeyboardEvent) => { if (event.code === 'Space' && !typing(event.target)) { spacePressed.current = true; target.classList.add('space-pan'); event.preventDefault() } }
      const keyUp = (event: KeyboardEvent) => { if (event.code === 'Space') { spacePressed.current = false; target.classList.remove('space-pan') } }
      const pointerDown = (event: PointerEvent) => { if (!(event.button === 1 || event.button === 0 && spacePressed.current)) return; const pan = viewPanRef.current; panDrag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }; target.classList.add('panning'); target.setPointerCapture(event.pointerId); event.preventDefault() }
      const pointerMove = (event: PointerEvent) => { const drag = panDrag.current; if (drag) setViewPan({ x: drag.panX + event.clientX - drag.x, y: drag.panY + event.clientY - drag.y }) }
      const pointerUp = (event: PointerEvent) => { if (!panDrag.current) return; panDrag.current = null; target.classList.remove('panning'); if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId) }
      const auxiliary = (event: MouseEvent) => { if (event.button === 1) event.preventDefault() }
      const reset = (event: MouseEvent) => { if (!(event.target as Element).closest('.category-label-editor, .chart-rich-editor')) { gestureZoomRef.current = 1; setGestureZoom(1); setViewPan({ x: 0, y: 0 }); publishZoom(1) } }
      target.addEventListener('wheel', wheel, { passive: false, capture: true }); target.addEventListener('pointerdown', pointerDown); target.addEventListener('pointermove', pointerMove); target.addEventListener('pointerup', pointerUp); target.addEventListener('pointercancel', pointerUp); target.addEventListener('auxclick', auxiliary); target.addEventListener('dblclick', reset); window.addEventListener('keydown', keyDown); window.addEventListener('keyup', keyUp)
      return () => { target.removeEventListener('wheel', wheel, true); target.removeEventListener('pointerdown', pointerDown); target.removeEventListener('pointermove', pointerMove); target.removeEventListener('pointerup', pointerUp); target.removeEventListener('pointercancel', pointerUp); target.removeEventListener('auxclick', auxiliary); target.removeEventListener('dblclick', reset); window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp) }
    }, [disableViewGestures])

    useEffect(() => {
      const instance = chart.current
      if (!instance || instance.isDisposed() || readyKind !== config.kind || readyFontSignature !== fontSignature) return
      if (chartIsBusy(instance)) { const retry = window.setTimeout(() => setRenderRetry((value) => value + 1), 0); return () => window.clearTimeout(retry) }
      const revision = beginRenderCycle('compiling')
      try {
      const selectDecoration = onDecorationSelect ?? ((id: string) => { const decoration = config.decorations?.find((item) => item.id === id); if (decoration) onDecorationChange?.(decoration) })
      const visibleTitle = config.showTitle === false ? '' : config.title
      const visibleSubtitle = config.showSubtitle === false ? '' : config.subtitle
      const visibleNote = config.showNote === false ? '' : config.note
      const visibleSource = config.showSource === false ? '' : config.source
      const marginTop = config.canvasMarginTop ?? RHYTHM.edge, marginRight = config.canvasMarginRight ?? RHYTHM.edge, marginBottom = config.canvasMarginBottom ?? RHYTHM.edge, marginLeft = config.canvasMarginLeft ?? 32
      const editorialAxes = config.axisTitleMode === 'editorial'
      const renderConfig = {
        ...config,
        title: visibleTitle,
        subtitle: visibleSubtitle,
        note: visibleNote,
        source: visibleSource,
        ...(editorialAxes ? { showXAxisTitle: false, showYAxisTitle: false } : {}),
      }
      const plugin = getChartPlugin(config.kind)
      const validation = plugin.validate(table, renderConfig)
      if (!validation.ok) throw new Error(validation.errors.map((error) => error.message).join(' '))
      const compiledScene = plugin.compile(table, renderConfig)
      const resolvedScene = resolveNativeScene(compiledScene)
      const plotKind = resolvedScene.plot.kind
      const editable = new Map<string, { sourceKey: string; displayText: string }>()
      if (resolvedScene.plot.kind === 'distribution' && resolvedScene.plot.variant !== 'histogram' && resolvedScene.plot.variant !== 'kde') {
        const axis = resolvedScene.plot.orientation === 'horizontal' ? 'y' : 'x'
        resolvedScene.plot.lanes.forEach((lane) => editable.set(`${axis}:${lane.index}`, { sourceKey: lane.sourceKey, displayText: lane.label }))
      } else if (resolvedScene.plot.kind === 'heatmap') {
        resolvedScene.plot.categories.filter((category) => typeof category.value === 'string').forEach((category) => editable.set(`x:${category.coordinate}`, { sourceKey: category.coordinate, displayText: category.label }))
        resolvedScene.plot.rows.forEach((row) => editable.set(`y:${row.sourceKey}`, { sourceKey: row.sourceKey, displayText: row.name }))
      } else if ('categories' in resolvedScene.plot && 'categoryAxis' in resolvedScene.plot) {
        const axis = resolvedScene.plot.categoryAxis.orientation === 'horizontal' ? 'x' : 'y'
        resolvedScene.plot.categories.filter((category) => typeof category.value === 'string').forEach((category) => editable.set(`${axis}:${category.coordinate}`, { sourceKey: category.coordinate, displayText: category.label }))
      } else if ('positions' in resolvedScene.plot && Array.isArray(resolvedScene.plot.positions)) {
        resolvedScene.plot.positions.filter((position) => typeof position.value === 'string').forEach((position) => editable.set(`x:${position.coordinate}`, { sourceKey: position.coordinate, displayText: position.label }))
      }
      editableAxisLabels.current = editable
      type NativeSelectionHit = { points?: Array<[number, number]>; rect: { x: number; y: number; width: number; height: number }; info: { elementKey: string; sourceSeriesName: string; displayCategory: string; displayValue: string; displayLabel?: string; displayColor?: string; selectionTarget?: ChartElementSelection['target']; axis?: 'x' | 'y'; selectionMode?: 'series-first' | 'axis-label' } }
      type NativeCategoryLayout = CategoryLabelLayout
      const option = renderScene(resolvedScene) as Record<string, unknown> & { graphic?: unknown[]; nativeSelectionHits?: NativeSelectionHit[]; nativeCategoryLayouts?: NativeCategoryLayout[]; nativeTreemapHits?: typeof nativeTreemapHits.current; nativePlotBounds?: PlotBounds }
      const nativeSelectionHits = option.nativeSelectionHits ?? []
      const nativeCategoryLayouts = option.nativeCategoryLayouts ?? []
      nativeTreemapHits.current = option.nativeTreemapHits ?? []
      const nativePlotBounds = option.nativePlotBounds ?? { left: resolvedScene.geometry.plot.x, right: resolvedScene.geometry.plot.x + resolvedScene.geometry.plot.width, top: resolvedScene.geometry.plot.y, bottom: resolvedScene.geometry.plot.y + resolvedScene.geometry.plot.height }
      delete option.nativeSelectionHits
      delete option.nativeCategoryLayouts
      delete option.nativeTreemapHits
      delete option.nativePlotBounds
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const transitionMode = chartTransitionMode(renderedKind.current, config.kind, reducedMotion)
      setRenderAnimationEnabled(!reducedMotion)
      option.animation = !reducedMotion
      option.animationDuration = reducedMotion ? 0 : 240
      option.animationDurationUpdate = reducedMotion ? 0 : 240
      option.animationEasing ??= 'quarticOut'
      option.animationEasingUpdate ??= 'quarticOut'
      const selectionStyle = { backgroundColor: 'rgba(0,0,0,0)', borderColor: '#1923e3', borderWidth: 1, borderRadius: 5, padding: [2, 4] }
      const labelSelectionStyle = { ...selectionStyle, padding: 0 }
      const availableWidth = Math.max(120, (config.canvasWidth ?? container.current?.clientWidth ?? 1000) - marginLeft - marginRight)
      let headerScale = 1, wrappedTitle = { text: '', lines: 0 }, wrappedSubtitle = { text: '', lines: 0 }, titleHeight = 0, subtitleHeight = 0
      const canvasHeight = container.current?.clientHeight ?? 563
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const titleSize = Math.max(12, Math.round(richTextSize(config.titleHtml, config.titleText.size) * headerScale))
        const subtitleSize = Math.max(10, Math.round(richTextSize(config.subtitleHtml, config.subtitleText.size) * headerScale))
        wrappedTitle = wrapMeasuredText(visibleTitle, titleSize, availableWidth, config.titleText.fontFamily, config.titleText.weight)
        wrappedSubtitle = wrapMeasuredText(visibleSubtitle, subtitleSize, availableWidth, config.subtitleText.fontFamily, config.subtitleText.weight)
        titleHeight = wrappedTitle.lines * Math.round(titleSize * config.titleText.lineHeight / 100)
        subtitleHeight = wrappedSubtitle.lines * Math.round(subtitleSize * config.subtitleText.lineHeight / 100)
        if (titleHeight + subtitleHeight + (visibleTitle && visibleSubtitle ? config.titleSubtitleGap ?? RHYTHM.titleSubtitle : 0) <= canvasHeight * .38 || headerScale <= .62) break
        headerScale -= .06
      }
      const renderedTitleSize = Math.max(12, Math.round(richTextSize(config.titleHtml, config.titleText.size) * headerScale))
      const renderedSubtitleSize = Math.max(10, Math.round(richTextSize(config.subtitleHtml, config.subtitleText.size) * headerScale))
      const renderedTitleBaseSize = Math.max(12, Math.round(config.titleText.size * headerScale))
      const renderedSubtitleBaseSize = Math.max(10, Math.round(config.subtitleText.size * headerScale))
      const titleOption = option.title as { text?: string; subtext?: string; textStyle?: Record<string, unknown>; subtextStyle?: Record<string, unknown> } | undefined
      if (titleOption) {
        titleOption.text = ''
        titleOption.subtext = ''
      }
      const titleBottom = visibleTitle ? marginTop + titleHeight : marginTop
      const subtitleTop = visibleSubtitle ? titleBottom + (visibleTitle ? config.titleSubtitleGap ?? RHYTHM.titleSubtitle : 0) : titleBottom
      const standardLegend = config.showLegend && !config.showDirectLabels
      const legendPosition = config.legendPosition ?? 'top'
      const legendRail = resolvedScene.geometry.reservations['guide:legend']
      const sideLegendWidth = legendRail?.width ?? 0
      let grid = option.grid as { top?: number; bottom?: number; left?: number; right?: number; containLabel?: boolean } | undefined
      const noteRenderSize = richTextSize(config.noteHtml, renderConfig.noteText.size)
      const sourceRenderSize = richTextSize(config.sourceHtml, renderConfig.sourceText.size)
      const wrappedNote = wrapMeasuredText(visibleNote, noteRenderSize, availableWidth, renderConfig.noteText.fontFamily, renderConfig.noteText.weight)
      const wrappedSource = wrapMeasuredText(visibleSource, sourceRenderSize, availableWidth, renderConfig.sourceText.fontFamily, renderConfig.sourceText.weight)
      const noteHeight = visibleNote ? wrappedNote.lines * Math.round(noteRenderSize * renderConfig.noteText.lineHeight / 100) : 0
      const sourceHeight = visibleSource ? wrappedSource.lines * Math.round(sourceRenderSize * renderConfig.sourceText.lineHeight / 100) : 0
      const nextRichLayouts = {
        title: { left: marginLeft, top: marginTop, width: availableWidth, size: renderedTitleSize, baseSize: renderedTitleBaseSize },
        subtitle: { left: marginLeft, top: subtitleTop, width: availableWidth, size: renderedSubtitleSize, baseSize: renderedSubtitleBaseSize },
        note: { left: marginLeft, top: canvasHeight - marginBottom - sourceHeight - (visibleSource ? config.noteSourceGap ?? RHYTHM.noteSource : 0) - noteHeight, width: availableWidth, size: noteRenderSize, baseSize: renderConfig.noteText.size },
        source: { left: marginLeft, top: canvasHeight - marginBottom - sourceHeight, width: availableWidth, size: sourceRenderSize, baseSize: renderConfig.sourceText.size },
      }
      setRichLayouts((current) => Object.keys(nextRichLayouts).every((key) => { const field = key as keyof typeof nextRichLayouts; return current[field] && Object.entries(nextRichLayouts[field]).every(([name, value]) => current[field]?.[name as keyof RichLayout] === value) }) ? current : nextRichLayouts)
      const xAxisTitleStyle = isHorizontalBar(config) ? config.yAxisTitleText ?? config.axisTitleText : config.xAxisTitleText ?? config.axisTitleText
      const physicalXAxisTitle = isHorizontalBar(config) ? config.yAxisTitle : config.xAxisTitle
      const showPhysicalXAxisTitle = isHorizontalBar(config) ? config.showYAxisTitle : config.showXAxisTitle
      const physicalXAxisTitleGap = isHorizontalBar(config) ? config.yAxisTitleGap : config.xAxisTitleGap
      const physicalXAxisOption = (Array.isArray(option.xAxis) ? option.xAxis[0] : option.xAxis) as { name?: string; nameGap?: number } | undefined
      const physicalXAxisLabelOffset = Math.max(0, Number(physicalXAxisOption?.nameGap ?? physicalXAxisTitleGap) - physicalXAxisTitleGap)
      const physicalXAxisOuterReserve = (Array.isArray(option.grid) ? option.grid[0]?.containLabel : grid?.containLabel) === false ? physicalXAxisLabelOffset : 0
      const xAxisTitleReserve = !editorialAxes && showPhysicalXAxisTitle && physicalXAxisTitle ? Math.round(xAxisTitleStyle.size * xAxisTitleStyle.lineHeight / 100) * Math.max(1, physicalXAxisTitle.split('\n').length) + physicalXAxisTitleGap : 0
      // With `containLabel`, ECharts reserves the label rail inside the grid.
      // Swapped horizontal axes opt out, so their rail belongs in the outer reserve.
      const editorialXStyle = isHorizontalBar(config) ? config.yAxisTitleText ?? config.axisTitleText : config.xAxisTitleText ?? config.axisTitleText
      const editorialYStyle = isHorizontalBar(config) ? config.xAxisTitleText ?? config.axisTitleText : config.yAxisTitleText ?? config.axisTitleText
      const editorialXText = isHorizontalBar(config) ? config.yAxisTitle : config.xAxisTitle
      const editorialYText = isHorizontalBar(config) ? config.xAxisTitle : config.yAxisTitle
      const showEditorialX = editorialAxes && (isHorizontalBar(config) ? config.showYAxisTitle : config.showXAxisTitle) && Boolean(editorialXText)
      const showEditorialY = editorialAxes && (isHorizontalBar(config) ? config.showXAxisTitle : config.showYAxisTitle) && Boolean(editorialYText)
      const cleanOption = cloneChartOption(option)
      disableChartAnimations(cleanOption)
      enableCustomSeriesTransitions(option, !reducedMotion)
      applySeriesVisualState(option, config, selectedSeriesName, selectedElementKey, hoveredSeriesName)
      for (const axisKey of ['xAxis', 'yAxis'] as const) {
        const axis = option[axisKey] as { nameTextStyle?: object; axisLabel?: object } | undefined
        if (!axis) continue
        if (selectedSettingsSection === `${axisKey[0]}-axis-title`) axis.nameTextStyle = { ...axis.nameTextStyle, ...selectionStyle }
      }
      if (selectedSettingsSection === 'legend') {
        const legend = option.legend as { textStyle?: object } | undefined
        if (legend) legend.textStyle = { ...legend.textStyle, ...selectionStyle }
        if (config.showDirectLabels) {
          const series = option.series as Array<{ endLabel?: Record<string, unknown>; data?: Array<Record<string, unknown> | null> }> | undefined
          series?.forEach((item) => {
            if (item.endLabel?.show) item.endLabel = { ...item.endLabel, ...selectionStyle }
            item.data?.forEach((point) => { if (point?.directLegendLabel && point.label) point.label = { ...(point.label as object), ...labelSelectionStyle } })
          })
        }
      }
      if (selectedSettingsSection === 'values') {
        const series = option.series as Array<{ label?: Record<string, unknown>; data?: Array<Record<string, unknown> | null> }> | undefined
        series?.forEach((item) => {
          if (item.label?.show) item.label = { ...item.label, ...labelSelectionStyle }
          item.data?.forEach((point) => { if (point?.label && (point.label as { show?: boolean }).show) point.label = { ...(point.label as object), ...labelSelectionStyle } })
        })
      }
      if (selectedSeriesName) {
        const series = option.series as Array<{ name?: string; segmentOf?: string; interactionLayer?: 'hit'; type?: string; silent?: boolean; symbol?: string; symbolSize?: number; z?: number; itemStyle?: Record<string, unknown>; lineStyle?: Record<string, unknown>; emphasis?: Record<string, unknown> }> | undefined
        series?.forEach((item) => {
          if (item.interactionLayer === 'hit') {
            item.emphasis = { disabled: true }
            return
          }
          if (item.segmentOf === selectedSeriesName) {
            item.z = 1000
            item.lineStyle = { ...item.lineStyle, width: Number(item.lineStyle?.width ?? 2) + 1 }
            return
          }
          if (item.name !== selectedSeriesName || item.silent) return
          if (item.type === 'line') { item.z = 1000; item.lineStyle = { ...item.lineStyle, width: Number(item.lineStyle?.width ?? 2) + 1 } }
        })
      }
      if (selectedElementKey) {
        const series = option.series as Array<{ name?: string; interactionLayer?: 'hit'; type?: string; data?: unknown[] }> | undefined
        const visitSelected = (item: { name?: string; interactionLayer?: 'hit'; type?: string }, points: unknown[]) => points.forEach((point) => {
          if (!point || typeof point !== 'object') return
          const dataPoint = point as Record<string, unknown>
          if (dataPoint.elementKey === selectedElementKey && item.interactionLayer !== 'hit') {
            if (selectedElementTarget === 'value-label') dataPoint.label = { ...((dataPoint.label ?? {}) as object), show: true, ...labelSelectionStyle }
            else if (item.type === 'line' && (!dataPoint.symbolSize || Number(dataPoint.symbolSize) < 8)) dataPoint.symbolSize = 8
          }
          visitSelected(item, (dataPoint.children as unknown[] | undefined) ?? [])
        })
        series?.forEach((item) => visitSelected(item, item.data ?? []))
      }
            const standardXAxisTitle = !editorialAxes && showPhysicalXAxisTitle && Boolean(physicalXAxisTitle)
      if (standardXAxisTitle) {
        for (const axes of [option.xAxis, cleanOption.xAxis]) {
          for (const axis of (Array.isArray(axes) ? axes : axes ? [axes] : []) as Array<{ name?: string }>) axis.name = ''
        }
      }
      const xAxisTitleHeight = xAxisTitleReserve ? xAxisTitleReserve - physicalXAxisTitleGap : 0
      const canvasWidth = config.canvasWidth ?? container.current?.clientWidth ?? 1000
      const xAxisTitleX = (nativePlotBounds.left + nativePlotBounds.right) / 2
      const xAxisTitleY = config.xAxisPosition === 'top'
        ? nativePlotBounds.top - physicalXAxisOuterReserve - physicalXAxisTitleGap - xAxisTitleHeight / 2
        : nativePlotBounds.bottom + physicalXAxisOuterReserve + physicalXAxisTitleGap + xAxisTitleHeight / 2
      const xAxisTitleSection = isHorizontalBar(config) ? 'y-axis-title' : 'x-axis-title'
      const makeXAxisTitle = (clean = false) => standardXAxisTitle && { id: 'chart-x-axis-title', type: 'text', x: xAxisTitleX, y: xAxisTitleY, z: 20, silent: clean, cursor: clean ? undefined : 'pointer', style: { text: physicalXAxisTitle, fill: xAxisTitleStyle.color, fontFamily: xAxisTitleStyle.fontFamily, fontSize: xAxisTitleStyle.size, fontWeight: xAxisTitleStyle.weight, fontStyle: xAxisTitleStyle.italic ? 'italic' : 'normal', lineHeight: Math.round(xAxisTitleStyle.size * xAxisTitleStyle.lineHeight / 100), align: 'center', textAlign: 'center', verticalAlign: 'middle', ...(!clean && selectedSettingsSection === xAxisTitleSection ? selectionStyle : {}) }, onclick: clean ? undefined : () => onSettingsFocus?.(xAxisTitleSection) }
      const existing = [...(Array.isArray(option.graphic) ? option.graphic : []), makeXAxisTitle()].filter(Boolean)
      const plotMiddleY = grid ? (Number(grid.top ?? 0) + canvasHeight - Number(grid.bottom ?? 0)) / 2 : canvasHeight / 2
      const yTitlePosition = config.yAxisPosition
      const yTitleSideOffset = standardLegend && legendPosition === yTitlePosition ? sideLegendWidth + (yTitlePosition === 'left' ? marginLeft : marginRight) + 8 : yTitlePosition === 'left' ? marginLeft : marginRight
      const yTitleLabelStyle = isHorizontalBar(config) ? config.xAxisTitleText ?? config.axisTitleText : config.yAxisTitleText ?? config.axisTitleText
      const yTitleEdgeThickness = Math.round(yTitleLabelStyle.size * yTitleLabelStyle.lineHeight / 100)
      const yTitleX = yTitlePosition === 'left' ? yTitleSideOffset + yTitleEdgeThickness / 2 : (config.canvasWidth ?? 1000) - yTitleSideOffset - yTitleEdgeThickness / 2
      const titleRich = richBlockStyle(config.titleHtml, visibleTitle, config.titleText, renderedTitleBaseSize)
      const subtitleRich = richBlockStyle(config.subtitleHtml, visibleSubtitle, config.subtitleText, renderedSubtitleBaseSize)
      const noteRich = richBlockStyle(config.noteHtml, visibleNote, config.noteText)
      const sourceRich = richBlockStyle(config.sourceHtml, visibleSource, config.sourceText)
      // Plain text alignment is relative to its anchor, even with a wrapping width.
      const textAnchor = (align: 'left' | 'center' | 'right') => marginLeft + (align === 'center' ? availableWidth / 2 : align === 'right' ? availableWidth : 0)
      const titleHits = [
        visibleTitle && { id: 'chart-title-hit', type: 'text', x: textAnchor(config.titleText.align), top: marginTop, z: 20, cursor: 'pointer', style: { text: titleRich?.text ?? wrappedTitle.text, width: availableWidth, fontFamily: config.titleText.fontFamily, fontSize: renderedTitleSize, fontWeight: config.titleText.weight, fontStyle: config.titleText.italic ? 'italic' : 'normal', lineHeight: Math.round(renderedTitleSize * config.titleText.lineHeight / 100), fill: config.titleText.color, align: config.titleText.align, textAlign: config.titleText.align, rich: titleRich?.rich, opacity: config.titleHtml || selectedSettingsSection === 'title' ? 0 : 1, ...(selectedSettingsSection === 'title' ? selectionStyle : {}) }, onclick: () => onSettingsFocus?.('title') },
        visibleSubtitle && { id: 'chart-subtitle-hit', type: 'text', x: textAnchor(config.subtitleText.align), top: subtitleTop, z: 20, cursor: 'pointer', style: { text: subtitleRich?.text ?? wrappedSubtitle.text, width: availableWidth, fontFamily: config.subtitleText.fontFamily, fontSize: renderedSubtitleSize, fontWeight: config.subtitleText.weight, fontStyle: config.subtitleText.italic ? 'italic' : 'normal', lineHeight: Math.round(renderedSubtitleSize * config.subtitleText.lineHeight / 100), fill: config.subtitleText.color, align: config.subtitleText.align, textAlign: config.subtitleText.align, rich: subtitleRich?.rich, opacity: config.subtitleHtml || selectedSettingsSection === 'subtitle' ? 0 : 1, ...(selectedSettingsSection === 'subtitle' ? selectionStyle : {}) }, onclick: () => onSettingsFocus?.('subtitle') },
      ].filter(Boolean)
      const annotations = config.annotations.filter((annotation) => !annotation.hidden).map((annotation) => {
        const runs = annotationRuns(annotation)
        return {
        id: `annotation-${annotation.id}`,
        type: 'text',
        x: annotation.x,
        y: annotation.y,
        z: 100,
        draggable: false,
        cursor: 'pointer',
        style: {
          text: runs.map((fragment, index) => `{fragment${index}|${fragment.text.replaceAll('{', '\\{').replaceAll('}', '\\}')}}`).join(''),
          width: Math.max(20, annotation.width - 24),
          overflow: 'break',
          backgroundColor: annotation.backgroundColor || 'transparent',
          borderWidth: 0,
          padding: [9, 11],
          opacity: 0,
          fontFamily: annotation.fontFamily,
          fontSize: annotation.fontSize,
          lineHeight: Math.round(annotation.fontSize * 1.35),
          align: annotation.textAlign ?? 'left',
          rich: Object.fromEntries(runs.map((fragment, index) => {
            const strokeColor = fragment.textStrokeColor ?? annotation.textStrokeColor
            return [`fragment${index}`, { fontFamily: fragment.fontFamily || annotation.fontFamily, fontSize: fragment.fontSize || annotation.fontSize, fill: fragment.color, fontWeight: fragment.bold ? 700 : 400, fontStyle: fragment.italic ? 'italic' : 'normal', textDecoration: fragment.underline ? 'underline' : 'none', backgroundColor: fragment.backgroundColor, textBorderColor: strokeColor, textBorderWidth: strokeColor ? annotation.textStrokeWidth ?? (Number.parseFloat(fragment.textStrokeWidth ?? '6') || 6) : 0, padding: 0, lineHeight: Math.round((fragment.fontSize || annotation.fontSize) * 1.35) }]
          })),
        },
        silent: annotation.locked, onclick: () => { if (!annotation.locked) onAnnotationSelect?.(annotation.id) },
        }
      })
      const chartLabels = existing.map((graphic) => {
        if (!graphic || typeof graphic !== 'object') return graphic
        const item = graphic as { id?: string }
        if (item.id === 'chart-y-axis-title') { const section = isHorizontalBar(config) ? 'x-axis-title' : 'y-axis-title'; return { ...positionYAxisTitleGraphic(item, yTitleX, plotMiddleY, true), cursor: 'pointer', style: { ...(item as { style?: object }).style, ...(selectedSettingsSection === section ? selectionStyle : {}) }, onclick: () => onSettingsFocus?.(section) } }
        if (item.id === 'chart-note') return { ...item, left: undefined, right: undefined, x: textAnchor(config.noteText.align), bottom: visibleSource ? marginBottom + sourceHeight + (config.noteSourceGap ?? RHYTHM.noteSource) : marginBottom, cursor: 'pointer', style: { ...(item as { style?: object }).style, text: noteRich?.text ?? wrappedNote.text, width: availableWidth, align: config.noteText.align, textAlign: config.noteText.align, overflow: undefined, ...(noteRich ?? {}), opacity: config.noteHtml || selectedSettingsSection === 'note' ? 0 : 1, ...(selectedSettingsSection === 'note' ? selectionStyle : {}) }, onclick: () => onSettingsFocus?.('note') }
        if (item.id === 'chart-source') return { ...item, left: undefined, right: undefined, x: textAnchor(config.sourceText.align), bottom: marginBottom, cursor: 'pointer', style: { ...(item as { style?: object }).style, text: sourceRich?.text ?? wrappedSource.text, width: availableWidth, align: config.sourceText.align, textAlign: config.sourceText.align, overflow: undefined, ...(sourceRich ?? {}), opacity: config.sourceHtml || selectedSettingsSection === 'source' ? 0 : 1, ...(selectedSettingsSection === 'source' ? selectionStyle : {}) }, onclick: () => onSettingsFocus?.('source') }
        return graphic
      })
      const annotationHeights: Record<string, number> = {}
      container.current?.parentElement?.querySelectorAll<HTMLElement>('[data-annotation-id]').forEach((element) => { annotationHeights[element.dataset.annotationId!] = element.offsetHeight })
      setTextAnchorHeights((current) => JSON.stringify(current) === JSON.stringify(annotationHeights) ? current : annotationHeights)
      const resolveDecorations = (targets: DecorationTarget[]) => (config.decorations ?? []).map((decoration) => resolveDecoration(decoration, config.annotations, targets, annotationHeights))
      const displayDecorations = decorationGraphics(resolveDecorations(decorationTargetsRef.current), undefined, selectDecoration)
      option.graphic = [...chartLabels, ...displayDecorations, ...titleHits, ...annotations]
      const cleanTitleHits = titleHits.map((graphic) => {
        if (!graphic || typeof graphic !== 'object') return graphic
        const item = graphic as { id?: string; style?: Record<string, unknown> }
        const style: Record<string, unknown> = { ...item.style, opacity: item.id === 'chart-title-hit' && config.titleHtml || item.id === 'chart-subtitle-hit' && config.subtitleHtml ? 0 : 1 }
        return { ...item, style }
      })
      const cleanLabels = [...(Array.isArray(cleanOption.graphic) ? cleanOption.graphic : []), makeXAxisTitle(true)].filter(Boolean).map((graphic) => {
        if (!graphic || typeof graphic !== 'object') return graphic
        const item = graphic as { id?: string; style?: object }
        if (item.id === 'chart-y-axis-title') return positionYAxisTitleGraphic(item, yTitleX, plotMiddleY, true)
        if (item.id === 'chart-note') return { ...item, left: undefined, right: undefined, x: textAnchor(config.noteText.align), bottom: visibleSource ? marginBottom + sourceHeight + (config.noteSourceGap ?? RHYTHM.noteSource) : marginBottom, style: { ...item.style, text: noteRich?.text ?? wrappedNote.text, width: availableWidth, align: config.noteText.align, textAlign: config.noteText.align, overflow: undefined, ...(noteRich ?? {}), opacity: config.noteHtml ? 0 : 1 } }
        if (item.id === 'chart-source') return { ...item, left: undefined, right: undefined, x: textAnchor(config.sourceText.align), bottom: marginBottom, style: { ...item.style, text: sourceRich?.text ?? wrappedSource.text, width: availableWidth, align: config.sourceText.align, textAlign: config.sourceText.align, overflow: undefined, ...(sourceRich ?? {}), opacity: config.sourceHtml ? 0 : 1 } }
        return item
      })
      cleanOption.graphic = [...cleanLabels, ...decorationGraphics(resolveDecorations(decorationTargetsRef.current)), ...cleanTitleHits]
      setRenderLifecycle((current) => advanceChartRender(current, revision, 'rendering'))
      {
        const series = option.series as Array<Record<string, unknown>> | undefined
        series?.forEach((item, index) => {
          const identity = item.id ?? item.name ?? item.type ?? 'series'
          // ECharts keeps the old component index when stable ids are supplied in
          // a different array order. Include the render position so reordering a
          // series also updates grouped-bar placement and stacking order.
          item.id = `${chartTransitionFamily(config.kind)}:${index}:${String(identity)}`
          if (transitionMode === 'morph' && item.silent !== true) item.universalTransition = { enabled: true, divideShape: 'clone' }
        })
      }
      if (transitionMode === 'fade' && plotBounds && container.current) fadePreviousPlot(container.current, plotBounds, 200)
      instance.setOption(option, { notMerge: false, replaceMerge: ['series', 'legend', 'xAxis', 'yAxis', 'graphic'] })
      renderedKind.current = config.kind
      setRenderedChartKind(config.kind)
      setRenderedPlotKind(plotKind)
      if (activeCategoryLabel && plotKind !== 'treemap') {
        const nativeCategoryLayout = nativeCategoryLayouts.find((item) => item.axis === activeCategoryLabel.axis && item.category === activeCategoryLabel.category)
        if (nativeCategoryLayout) setCategoryLabelLayout(nativeCategoryLayout)
        else {
        const axisKey = activeCategoryLabel.axis === 'x' ? 'xAxis' : 'yAxis'
        const axisOption = option[axisKey] as { data?: unknown[]; position?: 'top' | 'bottom' | 'left' | 'right'; axisLabel?: { rotate?: number; show?: boolean } } | Array<{ data?: unknown[]; position?: 'top' | 'bottom' | 'left' | 'right'; axisLabel?: { rotate?: number; show?: boolean } }> | undefined
        const axis = Array.isArray(axisOption) ? axisOption[0] : axisOption
        const index = axis?.data?.findIndex((value) => String(value) === activeCategoryLabel.category) ?? -1
        const pixel = Number(instance.convertToPixel(activeCategoryLabel.axis === 'x' ? { xAxisIndex: 0 } : { yAxisIndex: 0 }, index >= 0 ? index : activeCategoryLabel.category))
        const categoryOnYAxis = activeCategoryLabel.axis === 'y' && isHorizontalBar(config)
        const baseStyle = categoryOnYAxis || activeCategoryLabel.axis === 'x' ? config.xAxisLabelText ?? config.axisLabelText : config.yAxisLabelText ?? config.axisLabelText
        const bounds = nativePlotBounds
        const text = (config.categoryLabelOverrides?.[activeCategoryLabel.axis]?.[activeCategoryLabel.category] ?? activeCategoryLabel.category).replace(/^\d+:/, '')
        const rotation = Number(axis?.axisLabel?.rotate ?? 0)
        const neighbourPixels = axis?.data?.flatMap((_value, current) => {
          if (current === index) return []
          const candidate = Number(instance.convertToPixel(activeCategoryLabel.axis === 'x' ? { xAxisIndex: 0 } : { yAxisIndex: 0 }, current))
          return Number.isFinite(candidate) ? [Math.abs(candidate - pixel)] : []
        }) ?? []
        const categoryWidth = Math.max(24, (neighbourPixels.length ? Math.min(...neighbourPixels) : 120) - 6)
        const naturalWidth = Math.max(20, measureTextWidth(text, baseStyle.size, baseStyle.fontFamily, baseStyle.weight))
        const sideWidth = bounds ? axis?.position === 'right' ? Math.max(20, canvasWidth - bounds.right - (config.xAxisLabelGap ?? 8)) : Math.max(20, bounds.left - (config.xAxisLabelGap ?? 8)) : naturalWidth
        const width = config.xAxisLabelOverflow === 'wrap' ? activeCategoryLabel.axis === 'x' ? categoryWidth : sideWidth : naturalWidth
        const textLayout = layoutText({ document: plainTextDocument(text, baseStyle), maxWidth: width, wrap: config.xAxisLabelOverflow === 'wrap', rotation })
        const align = activeCategoryLabel.axis === 'x' ? 'center' : axis?.position === 'right' ? 'left' : 'right'
        if (axis?.axisLabel?.show === false) setCategoryLabelLayout(null)
        else if (Number.isFinite(pixel) && bounds) setCategoryLabelLayout(activeCategoryLabel.axis === 'x'
          ? { axis: 'x', category: activeCategoryLabel.category, style: { ...baseStyle, align }, rotation, size: baseStyle.size, width, left: pixel - width / 2, top: axis?.position === 'top' ? bounds.top - (config.showXTicks ? config.tickLength : 0) - (config.xAxisLabelGap ?? 8) - textLayout.rotatedSize.height : bounds.bottom + (config.showXTicks ? config.tickLength : 0) + (config.xAxisLabelGap ?? 8) }
          : { axis: 'y', category: activeCategoryLabel.category, style: { ...baseStyle, align }, rotation: 0, size: baseStyle.size, width: axis?.position === 'right' ? Math.max(20, canvasWidth - bounds.right - (config.xAxisLabelGap ?? 8)) : Math.max(20, bounds.left - (config.xAxisLabelGap ?? 8)), left: axis?.position === 'right' ? bounds.right + (config.xAxisLabelGap ?? 8) : 0, top: pixel - textLayout.size.height / 2 })
        else setCategoryLabelLayout(null)
        }
      } else setCategoryLabelLayout(null)
      const exactBounds = nativePlotBounds
      if (exactBounds) setPlotBounds((current) => current && Math.abs(current.top - exactBounds.top) < .5 && Math.abs(current.bottom - exactBounds.bottom) < .5 && Math.abs(current.left - exactBounds.left) < .5 && Math.abs(current.right - exactBounds.right) < .5 ? current : exactBounds)
      const withoutGeneratedGraphics = (graphics: unknown[]) => graphics.filter((graphic) => {
        if (!graphic || typeof graphic !== 'object') return true
        const id = String((graphic as { id?: string }).id ?? '')
        return !id.startsWith('decoration-') && !id.startsWith('bar-vertical-grid-') && !id.startsWith('value-label-hit-') && !id.startsWith('waterfall-hit-') && !id.startsWith('selection-')
      })
      const points = new Map<string, DecorationTarget>()
      nativeSelectionHits.filter((hit) => !hit.info.selectionTarget || hit.info.selectionTarget === 'element').forEach(({ rect, info }) => {
        const horizontal = usesHorizontalAxes(config)
        const negative = /^[-−]/.test(info.displayValue)
        points.set(info.elementKey, { key: info.elementKey, label: `${info.sourceSeriesName} · ${info.displayCategory}`, x: horizontal && plotKind !== 'distribution' ? rect.x + (negative ? 0 : rect.width) : rect.x + rect.width / 2, y: horizontal || plotKind === 'distribution' ? rect.y + rect.height / 2 : rect.y + (negative ? rect.height : 0) })
      })
      const series = (option.series ?? []) as Array<{ type?: string; data?: Array<{ elementKey?: string; value?: number | number[] | null; sourceSeriesName?: string; displayCategory?: string }>; interactionLayer?: string }>
      series.forEach((item, seriesIndex) => {
        if (item.type !== 'line' && item.type !== 'scatter' && item.type !== 'bar') return
        const data = (instance as unknown as { getModel(): { getSeriesByIndex(index: number): { getData(): { getLayout(key: string): ArrayLike<number> | undefined; getItemLayout(index: number): number[] | { x: number; y: number; width: number; height: number } | undefined } } } }).getModel().getSeriesByIndex(seriesIndex).getData()
        item.data?.forEach((datum, index) => {
          if (!datum?.elementKey || datum.value == null || points.has(datum.elementKey)) return
          const value = Array.isArray(datum.value) ? datum.value : [index, datum.value]
          const linePoints = item.type === 'line' ? data.getLayout('points') : undefined
          const layout = linePoints ? [linePoints[index * 2], linePoints[index * 2 + 1]] : data.getItemLayout(index)
          const pixel = Array.isArray(layout) ? layout : layout ? usesHorizontalAxes(config) ? [layout.x + layout.width, layout.y + layout.height / 2] : [layout.x + layout.width / 2, layout.y + layout.height] : instance.convertToPixel({ seriesIndex }, value) as number[]
          if (Array.isArray(pixel) && pixel.every(Number.isFinite)) points.set(datum.elementKey, { key: datum.elementKey, x: pixel[0], y: pixel[1], label: `${datum.sourceSeriesName ?? ''} · ${datum.displayCategory ?? index}` })
        })
      })
      const targets = [...points.values()]
      decorationTargetsRef.current = targets
      setDecorationTargets((current) => JSON.stringify(current) === JSON.stringify(targets) ? current : targets)
      const decorations = resolveDecorations(targets)
      setResolvedDecorations((current) => JSON.stringify(current) === JSON.stringify(decorations) ? current : decorations)
      const exactDisplayDecorations = decorationGraphics(decorations, exactBounds ?? undefined, selectDecoration)
      const exactCleanDecorations = decorationGraphics(decorations, exactBounds ?? undefined)
      const barGrid: unknown[] = []
      if (exactBounds) {
        const exactMiddleY = (exactBounds.top + exactBounds.bottom) / 2
        const positionPlotGraphics = (graphics: unknown[]) => graphics.map((graphic) => {
          if (!graphic || typeof graphic !== 'object') return graphic
          const item = graphic as { id?: string; style?: Record<string, unknown>; children?: Array<{ type?: string; shape?: { width?: number; height?: number } }> }
          if (item.id === 'chart-x-axis-title') return { ...item, x: (exactBounds.left + exactBounds.right) / 2, y: config.xAxisPosition === 'bottom' ? exactBounds.bottom + physicalXAxisLabelOffset + physicalXAxisTitleGap + xAxisTitleHeight / 2 : exactBounds.top - physicalXAxisLabelOffset - physicalXAxisTitleGap - xAxisTitleHeight / 2 }
          if (item.id === 'chart-y-axis-title') return positionYAxisTitleGraphic(item, yTitleX, exactMiddleY, true)
          if (item.id === 'bubble-size-legend') {
            const mask = item.children?.find((child) => child.type === 'rect')?.shape
            const width = Number(mask?.width ?? 160), height = Number(mask?.height ?? 90), pad = 12
            const position = config.scatterSizeLegendPosition ?? 'top-left'
            const left = position.endsWith('right') ? exactBounds.right - width - pad : exactBounds.left + pad
            const top = position.startsWith('bottom') ? exactBounds.bottom - height - pad : exactBounds.top + pad
            return {
              ...item,
              x: Math.max(exactBounds.left + pad, Math.min(exactBounds.right - width - pad, left)),
              y: Math.max(exactBounds.top + pad, Math.min(exactBounds.bottom - height - pad, top)),
            }
          }
          return graphic
        })
        option.graphic = positionPlotGraphics(Array.isArray(option.graphic) ? option.graphic : [])
        cleanOption.graphic = positionPlotGraphics(Array.isArray(cleanOption.graphic) ? cleanOption.graphic : [])
      }
      option.graphic = [...withoutGeneratedGraphics(Array.isArray(option.graphic) ? option.graphic : []), ...barGrid, ...exactDisplayDecorations]
      cleanOption.graphic = [...withoutGeneratedGraphics(Array.isArray(cleanOption.graphic) ? cleanOption.graphic : []), ...barGrid, ...exactCleanDecorations]
      if (editorialAxes && exactBounds) {
        const arrowColor = config.axisLineColor ?? '#777580'
        const titleWidth = Math.max(100, exactBounds.right - exactBounds.left)
        const arrow = (direction: 'right' | 'up') => direction === 'right'
          ? [
              { type: 'line', shape: { x1: 1, y1: 8, x2: 15, y2: 8 }, style: { stroke: arrowColor, lineWidth: 2, lineCap: 'round' } },
              { type: 'polyline', shape: { points: [[9, 2], [15, 8], [9, 14]] }, style: { stroke: arrowColor, fill: null, lineWidth: 2, lineCap: 'round', lineJoin: 'round' } },
            ]
          : [
              { type: 'line', shape: { x1: 8, y1: 15, x2: 8, y2: 1 }, style: { stroke: arrowColor, lineWidth: 2, lineCap: 'round' } },
              { type: 'polyline', shape: { points: [[2, 7], [8, 1], [14, 7]] }, style: { stroke: arrowColor, fill: null, lineWidth: 2, lineCap: 'round', lineJoin: 'round' } },
            ]
        const makeTitle = (axis: 'x' | 'y', clean = false) => {
          const isX = axis === 'x'
          const content = isX ? editorialXText : editorialYText
          const textStyle = isX ? editorialXStyle : editorialYStyle
          const visible = isX ? showEditorialX : showEditorialY
          if (!visible) return null
          const lineHeight = Math.round(textStyle.size * textStyle.lineHeight / 100)
          const lines = Math.max(1, content.split('\n').length)
          const height = Math.max(18, lineHeight * lines)
          const x = isX ? exactBounds.right : exactBounds.left
          const y = isX
            ? exactBounds.bottom + Math.max(18, (config.xAxisLabelText ?? config.axisLabelText).size * 1.5)
            : exactBounds.top - height - 8
          const selected = selectedSettingsSection === `${axis}-axis-title`
          return {
            id: `chart-${axis}-editorial-title`,
            type: 'group',
            x,
            y,
            z: 90,
            cursor: clean ? undefined : 'pointer',
            silent: clean,
            onclick: clean ? undefined : () => onSettingsFocus?.(`${axis}-axis-title`),
            children: [
              { type: 'rect', shape: { x: isX ? -titleWidth : 0, y: -4, width: titleWidth, height: height + 8, r: 4 }, style: clean || !selected ? { fill: 'transparent' } : selectionStyle },
              { type: 'group', x: isX ? -18 : 0, y: Math.max(0, (lineHeight - 16) / 2), children: arrow(isX ? 'right' : 'up') },
              { type: 'text', x: isX ? -24 : 22, y: 0, style: { text: content, fontFamily: textStyle.fontFamily, fontSize: textStyle.size, fontWeight: textStyle.weight, fontStyle: textStyle.italic ? 'italic' : 'normal', lineHeight, fill: textStyle.color, width: Math.max(70, titleWidth - 24), overflow: 'break', align: isX ? 'right' : 'left', verticalAlign: 'top' } },
            ],
          }
        }
        const displayEditorial = [makeTitle('y'), makeTitle('x')].filter(Boolean)
        const cleanEditorial = [makeTitle('y', true), makeTitle('x', true)].filter(Boolean)
        option.graphic = [...withoutGeneratedGraphics(option.graphic), ...displayEditorial]
        cleanOption.graphic = [...withoutGeneratedGraphics(cleanOption.graphic), ...cleanEditorial]
      }
      let refreshGraphics = Boolean(exactBounds || barGrid.length || exactDisplayDecorations.length)
      if (nativeSelectionHits.length) {
        const hits = nativeSelectionHits.map((hit, index) => ({ id: `native-selection-hit-${index}`, type: hit.points ? 'polygon' : 'rect', z: 140, cursor: 'pointer', shape: hit.points ? { points: hit.points } : hit.rect, style: hit.info.elementKey === selectedElementKey && hit.info.selectionTarget === selectedElementTarget ? { fill: 'rgba(0,0,0,0)', stroke: '#1923e3', lineWidth: 1 } : { fill: 'rgba(0,0,0,0)' }, onmousedown: (event: { offsetX?: number; offsetY?: number }) => {
          const point = hit.info, seriesName = point.sourceSeriesName
          if (plotKind !== 'treemap') return
          const group = { key: `treemap-group:${seriesName}`, seriesName, category: seriesName, value: '', label: seriesName } satisfies ChartElementSelection
          const leaf = { key: point.elementKey, seriesName, category: point.displayCategory, value: point.displayValue, label: point.displayLabel } satisfies ChartElementSelection
          const source = selectedElementKey === point.elementKey ? leaf : group
          treemapDrag.current = { source, click: selectedTreemapSeriesName === seriesName ? leaf : group, start: [Number(event.offsetX ?? 0), Number(event.offsetY ?? 0)], moved: false }
        }, onclick: () => {
          const point = hit.info, seriesName = point.sourceSeriesName
          if (plotKind === 'treemap') return
          if (point.selectionTarget === 'category-label') {
            const section = `${point.axis ?? 'y'}-axis-labels` as ChartSettingsSection
            if (point.selectionMode === 'axis-label' && selectedSettingsSection !== section) { onSettingsFocus?.(section); return }
            onClearSettingsFocus?.()
            onSelect?.({ key: point.elementKey, seriesName: '', category: point.displayCategory, value: point.displayValue, target: 'category-label', axis: point.axis })
            if (point.selectionMode !== 'axis-label') onSettingsFocus?.(section)
            return
          }
          onSelect?.({ key: point.elementKey, seriesName, category: point.displayCategory, value: point.displayValue, label: point.displayLabel, color: point.displayColor, target: point.selectionTarget })
          onSettingsFocus?.('element')
        } }))
        option.graphic = [...(Array.isArray(option.graphic) ? option.graphic : []), ...hits]
        refreshGraphics = true
      }
      if (refreshGraphics) {
        const refresh = () => { if (revision !== renderRevision.current || instance.isDisposed()) return; if (chartIsBusy(instance)) window.setTimeout(refresh, 0); else instance.setOption({ graphic: option.graphic }, { replaceMerge: ['graphic'] }) }
        window.setTimeout(refresh, 0)
      }
      displayOption.current = option
      exportOption.current = cleanOption
      setRenderLifecycle((current) => advanceChartRender(current, revision, 'post-processing'))
      instance.dispatchAction({ type: 'downplay' })
      instance.getZr().flush()
      setRenderError('')
      void (async () => {
        await document.fonts.ready
        if (revision !== renderRevision.current || instance.isDisposed() || chart.current !== instance) return
        if (!chartIsBusy(instance)) instance.resize({ width: Math.min(1000, config.canvasWidth ?? 1000), height: Math.min(1000, config.canvasHeight ?? 563), animation: { duration: 0 } })
        instance.getZr().flush()
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        if (revision !== renderRevision.current || instance.isDisposed() || chart.current !== instance) return
        instance.getZr().flush()
        setRenderLifecycle((current) => settleChartRender(current, revision))
      })()
      } catch (cause) {
        displayOption.current = null
        exportOption.current = null
        renderedKind.current = null
        setRenderedChartKind(null)
        setRenderedPlotKind('')
        setRenderLifecycle((current) => failChartRender(current, revision))
        setRenderError(cause instanceof Error ? cause.message : 'Не удалось отрисовать график')
      }
    }, [activeCategoryLabel, table, config, fontSignature, hoveredSeriesName, onAnnotationSelect, onDecorationChange, onDecorationSelect, onSelect, onSeriesSelect, onSettingsFocus, readyFontSignature, readyKind, renderRetry, selectedAnnotationId, selectedElementKey, selectedElementTarget, selectedSeriesName, selectedSettingsSection])

    useEffect(() => {
      const instance = chart.current
      if (!instance || instance.isDisposed() || readyKind !== config.kind) return
      const resetHover = () => { setHoveredSeriesName(null); instance.dispatchAction({ type: 'downplay' }) }
      type NativeRendererElement = { type?: string; info?: { elementId?: string; datumId?: string; seriesId?: string; elementKey?: string; sourceSeriesName?: string; displayCategory?: string; displayValue?: string; displayLabel?: string; displayColor?: string; selectionTarget?: ChartElementSelection['target'] }; parent?: NativeRendererElement; __hostTarget?: NativeRendererElement }
      const nativeRendererInfo = (target?: NativeRendererElement) => {
        let element = target
        for (let depth = 0; element && depth < 8; depth += 1, element = element.parent ?? element.__hostTarget) {
          if (element.info?.elementKey) return element.info
        }
        return undefined
      }
      const handler = (params: unknown) => {
        if (suppressTreemapClick.current) { suppressTreemapClick.current = false; return }
        type RendererPoint = { elementId?: string; datumId?: string; seriesId?: string; elementKey?: string; sourceSeriesName?: string; displayValue?: string; displayCategory?: string; displayLabel?: string; displayColor?: string; directLegendLabel?: boolean; selectionTarget?: ChartElementSelection['target']; itemStyle?: { color?: unknown } }
        const event = params as { componentType?: string; targetType?: string; seriesName?: string; name?: string; value?: unknown; color?: unknown; data?: RendererPoint; info?: RendererPoint; event?: { target?: NativeRendererElement; topTarget?: NativeRendererElement } }
        if (event.componentType === 'title') { onSettingsFocus?.(event.targetType === 'subtitle' || event.targetType === 'subtext' ? 'subtitle' : 'title'); return }
        if (event.componentType === 'xAxis' || event.componentType === 'yAxis') {
          const axis = event.componentType === 'xAxis' ? 'x' : 'y'
          const section = `${axis}-axis-labels` as ChartSettingsSection
          if (event.targetType === 'axisName') { onSettingsFocus?.(`${axis}-axis-title`); return }
          if (selectedSettingsSection !== section) { onSettingsFocus?.(section); return }
          const coordinate = String(event.value ?? event.name ?? '')
          const editable = editableAxisLabels.current.get(`${axis}:${coordinate}`)
          if (!editable) { onSettingsFocus?.(section); return }
          const category = editable.sourceKey
          onClearSettingsFocus?.()
          onSelect?.({ key: `category-label:${axis}:${category}`, seriesName: '', category, value: editable.displayText, target: 'category-label', axis })
          return
        }
        if (event.componentType === 'legend') { onSettingsFocus?.('legend'); return }
        if (event.targetType === 'endLabel') { onSettingsFocus?.('legend'); return }
        if (!event.seriesName) return
        const rendererPoint = nativeRendererInfo(event.event?.target) ?? nativeRendererInfo(event.event?.topTarget)
        const pointData = event.info?.elementKey ? event.info : rendererPoint?.elementKey ? rendererPoint : event.data
        const seriesName = pointData?.sourceSeriesName ?? event.seriesName
        const pointColor = pointData?.displayColor ?? (typeof event.data?.itemStyle?.color === 'string' ? event.data.itemStyle.color : undefined) ?? (typeof event.color === 'string' ? event.color : undefined)
        const renderTarget = event.event?.target ?? event.event?.topTarget
        const clickedValueLabel = event.targetType === 'label' || renderTarget?.type === 'text' || renderTarget?.type === 'tspan' || renderTarget?.parent?.type === 'text'
        if (pointData?.selectionTarget === 'guide' && pointData.elementKey) {
          onSettingsFocus?.('legend')
          return
        }
        const nativeSelection = (target?: 'value-label') => {
          if (!pointData?.elementId) return undefined
          const selection: ChartSelection = { kind: 'element', id: pointData.elementId, role: target ?? 'mark', seriesId: pointData.seriesId, datumId: pointData.datumId, legacyKey: pointData.elementKey, series: seriesName, category: pointData.displayCategory ?? event.name ?? '', value: pointData.displayValue ?? String(event.value ?? ''), label: pointData.displayLabel, color: pointColor }
          return legacySelection(selection) as ChartElementSelection
        }
        if (clickedValueLabel && event.data?.directLegendLabel) { onSettingsFocus?.('legend'); return }
        if (renderedPlotKind === 'treemap' && selectedTreemapSeriesName !== seriesName) {
          onSelect?.({ key: `treemap-group:${seriesName}`, seriesName, category: seriesName, value: '', label: seriesName })
          onSettingsFocus?.('element')
          return
        }
        if (clickedValueLabel && pointData?.elementKey) {
          onSelect?.(nativeSelection('value-label') ?? { key: pointData.elementKey, seriesName, category: pointData.displayCategory ?? event.name ?? '', value: pointData.displayValue ?? String(event.value ?? ''), label: pointData.displayLabel, color: pointColor, target: 'value-label' })
          onSettingsFocus?.('element')
          return
        }
        if (pointData?.elementKey) {
          onSelect?.(nativeSelection() ?? { key: pointData.elementKey, seriesName, category: pointData.displayCategory ?? event.name ?? '', value: pointData.displayValue ?? String(event.value ?? ''), label: pointData.displayLabel, color: pointColor })
          onSettingsFocus?.('element')
          return
        }
        if (clickedSeries.current !== seriesName) {
          onSeriesSelect?.({ name: seriesName, color: pointColor ?? getSeriesColor(config, seriesName, 0) })
          clickedSeries.current = seriesName
          onSettingsFocus?.('series')
          return
        }
      }
      const hoverHandler = (params: unknown) => {
        const event = params as { seriesName?: string; data?: { sourceSeriesName?: string; selectionTarget?: ChartElementSelection['target'] } }
        if (event.data?.selectionTarget === 'guide') { setHoveredSeriesName(null); return }
        const name = event.data?.sourceSeriesName ?? event.seriesName
        if (name && !name.startsWith('__')) setHoveredSeriesName((current) => current === name ? current : name)
      }
      const legendHandler = () => onSettingsFocus?.('legend')
      const backgroundHandler = (event: { target?: unknown }) => { if (!event.target) { onClearSettingsFocus?.(); onAnnotationSelect?.('') } }
      const nativeGuideHandler = (event: { target?: NativeRendererElement }) => {
        const point = nativeRendererInfo(event.target)
        if (point?.selectionTarget === 'guide') onSettingsFocus?.('legend')
      }
      // Keep the renderer that was alive when the handlers were registered.
      // During StrictMode teardown the chart-init effect may dispose ECharts
      // before this effect gets a chance to remove its listeners, at which
      // point instance.getZr() returns null.
      const renderer = instance.getZr()
      const sendTreemapMove = (source: ChartElementSelection, target: ChartElementSelection, placement: 'before' | 'after') => onTreemapMove?.(source, target, placement)
      const dragLayer = () => container.current?.parentElement
      const showTreemapPreview = (x: number, y: number, label: string) => {
        const layer = dragLayer()
        if (!layer) return
        const preview = treemapDragPreview.current ?? Object.assign(document.createElement('div'), { className: 'treemap-drag-preview' })
        if (!preview.parentElement) layer.append(preview)
        preview.textContent = label
        preview.style.transform = `translate(${x + 12}px, ${y + 12}px)`
        treemapDragPreview.current = preview
      }
      const showTreemapIndicator = (rect: { left: number; top: number; width: number; height: number }) => {
        const layer = dragLayer()
        if (!layer) return
        const indicator = treemapDropIndicator.current ?? Object.assign(document.createElement('div'), { className: 'treemap-drop-indicator' })
        if (!indicator.parentElement) layer.append(indicator)
        Object.assign(indicator.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` })
        treemapDropIndicator.current = indicator
      }
      const clearTreemapDragVisuals = () => {
        treemapDragPreview.current?.remove()
        treemapDropIndicator.current?.remove()
        treemapDragPreview.current = null
        treemapDropIndicator.current = null
      }
      const updateTreemapDropTarget = (x: number, y: number) => {
        const drag = treemapDrag.current
        if (!drag?.moved) return
        const hits = nativeTreemapHits.current
        const leaves = hits.filter((hit) => !hit.info.elementKey.startsWith('treemap-group:'))
        const hit = leaves.filter(({ rect }) => x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height).sort((left, right) => left.rect.width * left.rect.height - right.rect.width * right.rect.height)[0]
        if (!hit) return
        const sourceIsGroup = drag.source.key.startsWith('treemap-group:')
        const category = hit.info.sourceSeriesName
        const targetHit = sourceIsGroup ? hits.find((candidate) => candidate.info.elementKey === `treemap-group:${category}`) : hit
        if (!targetHit || targetHit.info.elementKey === drag.source.key || !sourceIsGroup && category !== drag.source.seriesName) return
        const rect = { left: targetHit.rect.x, top: targetHit.rect.y, width: targetHit.rect.width, height: targetHit.rect.height }
        const horizontalSplit = rect.width >= rect.height
        const placement: 'before' | 'after' = horizontalSplit ? x < rect.left + rect.width / 2 ? 'before' : 'after' : y < rect.top + rect.height / 2 ? 'before' : 'after'
        showTreemapIndicator(horizontalSplit ? { left: placement === 'before' ? rect.left : rect.left + rect.width, top: rect.top, width: 3, height: rect.height } : { left: rect.left, top: placement === 'before' ? rect.top : rect.top + rect.height, width: rect.width, height: 3 })
        const target: ChartElementSelection = { key: targetHit.info.elementKey, seriesName: category, category: targetHit.info.displayCategory, value: targetHit.info.displayValue, label: targetHit.info.displayLabel }
        const signature = `${target.key}:${placement}`
        if (drag.signature === signature) return
        drag.target = target; drag.placement = placement; drag.signature = signature
        sendTreemapMove(drag.source, target, placement)
      }
      const treemapMove = (event: { offsetX?: number; offsetY?: number }) => {
        const drag = treemapDrag.current
        if (!drag) return
        const x = Number(event.offsetX ?? 0), y = Number(event.offsetY ?? 0)
        const distance = Math.hypot(x - drag.start[0], y - drag.start[1])
        if (distance > 6) {
          instance.dispatchAction({ type: 'hideTip' })
          drag.moved = true
          renderer.setCursorStyle('grabbing')
          showTreemapPreview(x, y, drag.source.label ?? drag.source.seriesName)
          updateTreemapDropTarget(x, y)
        }
      }
      const finishTreemapDrag = () => {
        const drag = treemapDrag.current
        if (!drag) return
        treemapDrag.current = null
        renderer.setCursorStyle('default')
        clearTreemapDragVisuals()
        if (!drag.moved) {
          suppressTreemapClick.current = true
          onSelect?.(drag.click)
          onSettingsFocus?.('element')
          return
        }
        suppressTreemapClick.current = true
      }
      instance.on('click', handler)
      instance.on('mouseover', hoverHandler)
      instance.on('globalout', resetHover)
      instance.on('mouseout', resetHover)
      instance.on('legendselectchanged', legendHandler)
      renderer.on('click', nativeGuideHandler)
      renderer.on('click', backgroundHandler)
      renderer.on('mousemove', treemapMove)
      renderer.on('mouseup', finishTreemapDrag)
      return () => {
        if (!instance.isDisposed()) {
          instance.off('click', handler)
          instance.off('mouseover', hoverHandler)
          instance.off('globalout', resetHover)
          instance.off('mouseout', resetHover)
          instance.off('legendselectchanged', legendHandler)
        }
        renderer.off('click', nativeGuideHandler)
        renderer.off('click', backgroundHandler)
        renderer.off('mousemove', treemapMove)
        renderer.off('mouseup', finishTreemapDrag)
        if (!treemapDrag.current) clearTreemapDragVisuals()
      }
    }, [activeCategoryLabel?.axis, activeCategoryLabel?.category, config, onAnnotationSelect, onClearSettingsFocus, onSelect, onSeriesSelect, onSettingsFocus, onTreemapMove, readyKind, renderedPlotKind, selectedElementKey, selectedSeriesName, selectedSettingsSection, selectedTreemapSeriesName, table])

    useImperativeHandle(ref, () => ({
      async getSvg() {
        if (!exportOption.current || renderLifecycle.status !== 'settled') throw new Error('График ещё не готов к экспорту. Дождитесь завершения отрисовки.')
        await waitForChartFonts(requestedFontFamilies, config.customFonts)
        let result: SVGSVGElement | undefined
        await withExportSvg(exportOption.current, canvasWidth, canvasHeight, async (svg) => {
          result = svg.cloneNode(true) as SVGSVGElement
          appendAnnotationText(result, config.annotations)
          const { appendStyledText } = await import('../features/chart-export/chartExport')
          appendStyledText(result, (['title', 'subtitle', 'note', 'source'] as const).flatMap((field) => {
            const html = config[`${field}Html`], layout = richLayouts[field], style = config[`${field}Text`]
            const visible = field === 'title' ? config.showTitle !== false : field === 'subtitle' ? config.showSubtitle !== false : field === 'note' ? config.showNote !== false : config.showSource !== false
            return html && layout && visible ? [exportRichBlock(html, config[field], style, layout)] : []
          }))
        })
        return result!
      },
      async exportSvg(options) {
        if (!exportOption.current) return
        await waitForChartFonts(requestedFontFamilies, config.customFonts)
        const textBlocks = (['title', 'subtitle', 'note', 'source'] as const).flatMap((field) => {
          const html = config[`${field}Html` as const], layout = richLayouts[field], style = config[`${field}Text` as const]
          const visible = field === 'title' ? config.showTitle !== false : field === 'subtitle' ? config.showSubtitle !== false : field === 'note' ? config.showNote !== false : config.showSource !== false
          return html && layout && visible ? [exportRichBlock(html, config[field], style, layout)] : []
        })
        await withExportSvg(exportOption.current, canvasWidth, canvasHeight, async (svg) => {
          appendAnnotationText(svg, config.annotations)
          const { exportChartAsSvg } = await import('../features/chart-export/chartExport')
          await exportChartAsSvg(svg, { canvasWidth: config.canvasWidth, canvasHeight: config.canvasHeight, customFonts: config.customFonts }, options, textBlocks)
        })
      },
      async exportPng(options) {
        if (!exportOption.current) return
        await waitForChartFonts(requestedFontFamilies, config.customFonts)
        const textBlocks = (['title', 'subtitle', 'note', 'source'] as const).flatMap((field) => {
          const html = config[`${field}Html` as const], layout = richLayouts[field], style = config[`${field}Text` as const]
          const visible = field === 'title' ? config.showTitle !== false : field === 'subtitle' ? config.showSubtitle !== false : field === 'note' ? config.showNote !== false : config.showSource !== false
          return html && layout && visible ? [exportRichBlock(html, config[field], style, layout)] : []
        })
        await withExportSvg(exportOption.current, canvasWidth, canvasHeight, async (svg) => {
          appendAnnotationText(svg, config.annotations)
          const { exportChartAsPng } = await import('../features/chart-export/chartExport')
          await exportChartAsPng(svg, { canvasWidth: config.canvasWidth, canvasHeight: config.canvasHeight, customFonts: config.customFonts }, options, textBlocks)
        })
      },
    }), [config, requestedFontFamilies, richLayouts, selectedElementKey, renderLifecycle.status])

    const selected = config.annotations.find((annotation) => annotation.id === selectedAnnotationId && !annotation.hidden && !annotation.locked)
    useEffect(() => { onDecorationLayout?.(resolvedDecorations) }, [resolvedDecorations, onDecorationLayout])
    const selectedDecoration = resolvedDecorations.find((decoration) => decoration.id === selectedDecorationId && !decoration.hidden && !decoration.locked)
    const canvasWidth = Math.min(1000, config.canvasWidth ?? 1000), canvasHeight = Math.min(1000, config.canvasHeight ?? 563)
    const richCandidate = selectedSettingsSection === 'title' || selectedSettingsSection === 'subtitle' || selectedSettingsSection === 'note' || selectedSettingsSection === 'source' ? selectedSettingsSection : null
    const richField = richCandidate && (richCandidate === 'title' ? config.showTitle !== false : richCandidate === 'subtitle' ? config.showSubtitle !== false : richCandidate === 'note' ? config.showNote !== false : config.showSource !== false) ? richCandidate : null
    const richLayout = richField ? richLayouts[richField] : undefined
    const richText = richField ? config[richField] : ''
    const richHtml = richField ? config[`${richField}Html` as const] : undefined
    const richStyle = richField ? config[`${richField}Text` as const] : undefined
    const richDisplays = (['title', 'subtitle', 'note', 'source'] as const).flatMap((field) => {
      const html = config[`${field}Html` as const], layout = richLayouts[field], style = config[`${field}Text` as const]
      const visible = field === 'title' ? config.showTitle !== false : field === 'subtitle' ? config.showSubtitle !== false : field === 'note' ? config.showNote !== false : config.showSource !== false
      return html && layout && visible && field !== richField ? [{ field, html, layout, style }] : []
    })
    const safeZoom = Math.min(5, Math.max(.1, gestureZoom))
    const previewZoom = config.autoFitCanvas === false ? safeZoom : safeZoom * .9
    const canvasTransform = config.autoFitCanvas === false ? `translate(${viewPan.x}px, ${viewPan.y}px) scale(${previewZoom})` : `translate(calc(-50% + ${viewPan.x}px), calc(-50% + ${viewPan.y}px)) scale(${canvasScale * previewZoom})`
    return (
      <div className={`chart-canvas-viewport ${config.autoFitCanvas === false ? 'native-size' : ''}`} ref={viewport}>
        <div
          className={`chart-canvas-shell logical-canvas ${!chartLayoutReady && !renderError ? 'layout-pending' : ''}`}
          data-layout-ready={chartLayoutReady ? 'true' : 'false'}
          data-render-settled={renderLifecycle.status === 'settled' ? 'true' : 'false'}
          data-render-status={renderLifecycle.status}
          data-render-revision={renderLifecycle.settledRevision}
          data-render-pending-revision={renderLifecycle.revision}
          data-render-signature={`${renderedChartKind ?? 'none'}:${renderedPlotKind || 'none'}:${renderLifecycle.settledRevision}:${canvasWidth}x${canvasHeight}`}
          data-render-animation={renderAnimationEnabled ? 'on' : 'off'}
          data-chart-kind={renderedChartKind ?? ''}
          data-plot-kind={renderedPlotKind}
          aria-busy={renderLifecycle.status !== 'settled'}
          style={{ width: canvasWidth, height: canvasHeight, transform: canvasTransform }}
        >
          <div className="chart-canvas" ref={container}/>
          {annotationTool && onAnnotationPlace && <AnnotationPlacementOverlay key={annotationTool} tool={annotationTool} width={canvasWidth} height={canvasHeight} onPlace={onAnnotationPlace} onCancel={() => onAnnotationCancel?.()}/>}
          {pickingDecorationText && onDecorationTextPick && <DecorationTextAnchorPicker annotations={config.annotations} heights={textAnchorHeights} width={canvasWidth} height={canvasHeight} onSelect={onDecorationTextPick} onCancel={() => onDecorationPointCancel?.()}/>}
          {pickingDecorationPoint && onDecorationPointPick && <DecorationAnchorPicker points={decorationTargets} width={canvasWidth} height={canvasHeight} onSelect={onDecorationPointPick} onCancel={() => onDecorationPointCancel?.()}/>}
          {renderError && <div className="chart-render-error" role="alert"><strong>Не удалось отрисовать график</strong><span>{renderError}</span></div>}
          {richDisplays.map(({ field, html, layout, style }) => <CanvasTextDisplay key={field} block={exportRichBlock(html, config[field], style, layout)} onSelect={() => { onAnnotationSelect?.(''); onSettingsFocus?.(field) }}/>)}
          {selectedDecoration && onDecorationChange && <DecorationOverlay annotations={config.annotations} targets={decorationTargets} annotationHeights={textAnchorHeights} onPickAnchor={onDecorationAnchorRequest} decoration={selectedDecoration} canvasWidth={canvasWidth} canvasHeight={canvasHeight} plotTop={plotBounds?.top} plotBottom={plotBounds?.bottom} plotLeft={plotBounds?.left} plotRight={plotBounds?.right} onChange={onDecorationChange}/>}
          {config.annotations.filter((annotation) => !annotation.hidden && annotation.id !== selected?.id).map((annotation) => <AnnotationDisplay key={annotation.id} annotation={annotation} canvasBackground={config.canvasBackground} onSelect={() => { if (!annotation.locked) onAnnotationSelect?.(annotation.id) }}/>)}
          <Suspense fallback={null}>
            {categoryLabelLayout && selectedCategoryLabel && <CanvasTextOverlay id={`category-${categoryLabelLayout.axis}-${categoryLabelLayout.category}`} text={config.categoryLabelOverrides?.[categoryLabelLayout.axis]?.[categoryLabelLayout.category] ?? categoryLabelLayout.category} style={categoryLabelLayout.style} left={categoryLabelLayout.left} top={categoryLabelLayout.top} width={categoryLabelLayout.width} rotation={categoryLabelLayout.rotation} policy={{ richText: false, multiline: true, explicitNewlines: true, styleToolbar: false }} customFonts={config.customFonts} canvasBackground={config.canvasBackground} onChange={(_html, text) => onCategoryLabelChange?.(categoryLabelLayout.axis, categoryLabelLayout.category, text)}/>}
            {richField && richLayout && richStyle && <CanvasTextOverlay id={richField} text={richText} html={richHtml} style={{ ...richStyle, size: richLayout.baseSize }} left={richLayout.left} top={richLayout.top} width={richLayout.width} customFonts={config.customFonts} canvasBackground={config.canvasBackground} onChange={(html, text) => onRichTextChange?.(richField, html, text)} onStyleChange={(style) => onTextStyleChange?.(richField, style)}/>}
            {selected && <AnnotationOverlay annotation={selected} customFonts={config.customFonts} canvasBackground={config.canvasBackground} onChange={(annotation) => onAnnotationChange?.(annotation)} onDuplicate={() => onAnnotationDuplicate?.(selected)} onDelete={() => onAnnotationDelete?.(selected.id)} onClose={() => onAnnotationSelect?.('')}/>}
          </Suspense>
        </div>
      </div>
    )
  },
)
