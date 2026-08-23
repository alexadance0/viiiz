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
import { loadEchartsForKind } from './echarts/loadEchartsForKind'
import { getChartPlugin, getSeriesColor } from '../core/chartRegistry'
import { sanitizeAnnotationHtml } from '../core/annotationHtml'
import type { ChartAnnotation, ChartConfig, ChartDecoration, ChartElementSelection, ChartKind, ChartSeriesSelection, DataTable } from '../core/types'
import { DecorationOverlay } from './DecorationOverlay'
import { AnnotationDisplay, CanvasTextDisplay } from './ChartCanvasDisplays'
import { measureTextWidth, wrapMeasuredText } from '../core/textMetrics'
import { decorationGraphics, type PlotBounds } from './chartDecorations'
import { isDistributionChart, usesHorizontalAxes } from '../core/chartKinds'
import type { ChartExportOptions, ExportTextBlock } from '../features/chart-export/chartExport'
import { DEFAULT_COMPOSITION_SPACING } from '../entities/chart/model/defaults'
import { renderScene, resolveNativeScene } from '../features/chart-renderer/echarts/renderScene'
import { invalidateTextLayoutCache, layoutText, plainTextDocument } from '../features/chart-layout/textLayout'
import { legacySelection, type ChartSelection } from '../entities/chart/model/ChartSelection'
import { advanceChartRender, failChartRender, initialChartRenderLifecycle, settleChartRender, type ChartRenderStatus } from './chartRenderLifecycle'
import { collectFontFamilies, waitForChartFonts } from '../core/textFonts'

const AnnotationOverlay = lazy(() => import('./AnnotationOverlay').then(({ AnnotationOverlay: Component }) => ({ default: Component })))
const CanvasTextOverlay = lazy(() => import('./CanvasTextOverlay').then(({ CanvasTextOverlay: Component }) => ({ default: Component })))

echarts.use([
  GridComponent,
  TooltipComponent,
  AxisPointerComponent,
  LegendComponent,
  GraphicComponent,
  MarkLineComponent,
  TitleComponent,
  SVGRenderer,
])

const isHorizontalBar = (config: ChartConfig) => usesHorizontalAxes(config)

export const positionYAxisTitleGraphic = <T extends object>(graphic: T, x: number, y: number, native: boolean): T & { left?: unknown; right?: unknown; top?: unknown; x?: number; y?: number } => native
  ? { ...graphic, top: undefined, y }
  : { ...graphic, left: undefined, right: undefined, top: undefined, x, y }

export interface ChartCanvasHandle {
  exportSvg(options?: ChartExportOptions): Promise<void>
  exportPng(options?: ChartExportOptions): Promise<void>
}

export type ChartSettingsSection = 'title' | 'subtitle' | 'x-axis-title' | 'y-axis-title' | 'x-axis-labels' | 'y-axis-labels' | 'grid' | 'legend' | 'values' | 'note' | 'source' | 'series' | 'element'

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
  selectedAnnotationId?: string | null
  selectedDecorationId?: string | null
  onDecorationSelect?(id: string): void
  onDecorationChange?(decoration: ChartDecoration): void
  onRichTextChange?(field: 'title' | 'subtitle' | 'note' | 'source', html: string, text: string): void
  onCategoryLabelChange?(axis: 'x' | 'y', category: string, text: string): void
  onTextStyleChange?(field: 'title' | 'subtitle' | 'note' | 'source', style: Partial<ChartConfig['titleText']>): void
  viewZoom?: number
}

interface AnnotationRun { text: string; color: string; bold: boolean; italic: boolean; underline?: boolean; backgroundColor?: string; textStrokeColor?: string; textStrokeWidth?: string; fontFamily?: string; fontSize?: number }
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
    const weight = node.style.fontWeight
    const decoration = node.style.textDecorationLine || node.style.textDecoration
    const explicitBold = weight ? Number(weight) >= 600 || weight === 'bold' : undefined
    const explicitItalic = node.style.fontStyle ? node.style.fontStyle === 'italic' : undefined
    const explicitUnderline = decoration ? decoration.includes('underline') : undefined
    const next = { ...state, color: node.style.color || state.color, backgroundColor: node.style.backgroundColor ? (node.style.backgroundColor === 'transparent' ? undefined : node.style.backgroundColor) : state.backgroundColor, textStrokeColor: node.style.webkitTextStrokeColor || shadowColor(node.style.textShadow) || state.textStrokeColor, textStrokeWidth: node.style.webkitTextStrokeWidth || (node.style.textShadow ? '2' : state.textStrokeWidth), bold: ['B', 'STRONG'].includes(node.tagName) ? true : explicitBold ?? state.bold, italic: ['I', 'EM'].includes(node.tagName) ? true : explicitItalic ?? state.italic, underline: node.tagName === 'U' ? true : explicitUnderline ?? state.underline, fontFamily: node.style.fontFamily || state.fontFamily, fontSize: Number.parseFloat(node.style.fontSize) || state.fontSize }
    node.childNodes.forEach((child) => walk(child, next))
    if (['DIV', 'P'].includes(node.tagName)) runs.push({ ...next, text: '\n' })
  }
  root.childNodes.forEach((node) => walk(node, defaults))
  while (runs.at(-1)?.text === '\n') runs.pop()
  const merged = runs.reduce<AnnotationRun[]>((result, run) => {
    const previous = result.at(-1)
    const sameStyle = previous && previous.color === run.color && previous.bold === run.bold && previous.italic === run.italic && previous.underline === run.underline && previous.backgroundColor === run.backgroundColor && previous.textStrokeColor === run.textStrokeColor && previous.textStrokeWidth === run.textStrokeWidth && previous.fontFamily === run.fontFamily && previous.fontSize === run.fontSize
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
    rich: Object.fromEntries(richRuns.map((run, index) => [`fragment${index}`, { fill: run.color, fontFamily: run.fontFamily ?? style.fontFamily, fontSize: run.fontSize ?? renderedSize, fontWeight: run.bold ? 700 : 400, fontStyle: run.italic ? 'italic' : 'normal', textDecoration: run.underline ? 'underline' : 'none', backgroundColor: run.backgroundColor, padding: 0, lineHeight: Math.round((run.fontSize ?? renderedSize) * style.lineHeight / 100) }])),
  }
}

function exportRichBlock(html: string, plain: string, style: ChartConfig['titleText'], layout: RichLayout): ExportTextBlock {
  const runs = annotationRuns({ id: '', x: 0, y: 0, width: layout.width, fontFamily: style.fontFamily, fontSize: layout.baseSize, backgroundColor: 'transparent', borderColor: 'transparent', textAlign: style.align, fragments: [{ id: '', text: plain, color: style.color, bold: style.weight >= 600, italic: style.italic }], html }, { color: style.color, bold: style.weight >= 600, italic: style.italic, underline: false, fontFamily: style.fontFamily, fontSize: layout.baseSize })
  return {
    left: layout.left, top: layout.top, width: layout.width, style: { ...style, size: layout.baseSize },
    runs: runs.map((run) => ({ text: run.text, color: run.color, fontFamily: run.fontFamily, fontSize: run.fontSize, fontWeight: run.bold ? Math.max(700, style.weight) : style.weight >= 600 ? 400 : style.weight, italic: run.italic, underline: run.underline, backgroundColor: run.backgroundColor })),
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
    if (item.emphasis) delete item.emphasis.focus
    delete item.blur
    const rawName = item.name ?? ''
    if (item.interactionLayer === 'hit' || rawName.startsWith('__')) return
    // Distribution dots deliberately keep the quiet Beeswarm appearance even
    // while their settings row or series is selected.
    if (isDistributionChart(config.kind)) return
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
    if (active) {
      item.z = Math.max(Number(item.z ?? 0), 1000)
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
  const graphics = option.graphic as Array<{ comparisonConnectorSeriesNames?: string[]; children?: Array<{ style?: Record<string, unknown> }> }> | undefined
  graphics?.forEach((graphic) => {
    const names = graphic.comparisonConnectorSeriesNames
    if (!names?.length) return
    const opacity = activeSeriesName && !names.includes(activeSeriesName) ? .22 : 1
    graphic.children?.forEach((child) => { child.style = applyStyleOpacity(child.style, opacity) })
  })
}
export const ChartCanvas = forwardRef<ChartCanvasHandle, Props>(
  ({ table, config, onSelect, onTreemapMove, onSeriesSelect, onSettingsFocus, onClearSettingsFocus, selectedSettingsSection, selectedSeriesName, selectedElementKey, selectedElementTarget, selectedCategoryLabel: requestedCategoryLabel, onAnnotationSelect, onAnnotationChange, onAnnotationDuplicate, onAnnotationDelete, selectedAnnotationId, selectedDecorationId, onDecorationSelect, onDecorationChange, onRichTextChange, onCategoryLabelChange, onTextStyleChange, viewZoom = 1 }, ref) => {
    const container = useRef<HTMLDivElement>(null)
    const viewport = useRef<HTMLDivElement>(null)
    const [canvasScale, setCanvasScale] = useState(1)
    const [renderError, setRenderError] = useState('')
    const [readyKind, setReadyKind] = useState<ChartKind | null>(null)
    const [renderedChartKind, setRenderedChartKind] = useState<ChartKind | null>(null)
    const [renderedPlotKind, setRenderedPlotKind] = useState('')
    const [renderAnimationEnabled, setRenderAnimationEnabled] = useState(false)
    const [renderLifecycle, setRenderLifecycle] = useState(initialChartRenderLifecycle)
    const requestedFontFamilies = useMemo(() => collectFontFamilies(config), [config])
    const fontSignature = `${requestedFontFamilies.join('|')}|${(config.customFonts ?? []).map(({ name, dataUrl, weight, style }) => `${name}:${weight ?? 400}:${style ?? 'normal'}:${dataUrl}`).join('|')}`
    const fontRequest = useRef({ families: requestedFontFamilies, customFonts: config.customFonts })
    fontRequest.current = { families: requestedFontFamilies, customFonts: config.customFonts }
    const [readyFontSignature, setReadyFontSignature] = useState('')
    const [plotBounds, setPlotBounds] = useState<PlotBounds | null>(null)
    const [richLayouts, setRichLayouts] = useState<Partial<Record<'title' | 'subtitle' | 'note' | 'source', RichLayout>>>({})
    const [categoryLabelLayout, setCategoryLabelLayout] = useState<CategoryLabelLayout | null>(null)
    const chart = useRef<echarts.ECharts | null>(null)
    const renderRevision = useRef(0)
    const displayOption = useRef<Record<string, unknown> | null>(null)
    const exportOption = useRef<Record<string, unknown> | null>(null)
    const renderedKind = useRef<ChartKind | null>(null)
    const nativeTreemapHits = useRef<Array<{ rect: { x: number; y: number; width: number; height: number }; info: { elementKey: string; sourceSeriesName: string; displayCategory: string; displayValue: string; displayLabel?: string; displayColor?: string } }>>([])
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
    const chartLayoutReady = renderedChartKind === config.kind
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
      if (!container.current) return
      const instance = echarts.init(container.current, undefined, { renderer: 'svg' })
      chart.current = instance
      const resize = () => {
        if (instance.isDisposed()) return
        instance.resize({ animation: { duration: 0 } })
      }
      const observer = new ResizeObserver(resize)
      observer.observe(container.current)
      window.addEventListener('resize', resize)
      return () => { observer.disconnect(); window.removeEventListener('resize', resize); if (!instance.isDisposed()) instance.dispose(); if (chart.current === instance) chart.current = null }
    }, [])

    useEffect(() => {
      const target = viewport.current
      if (!target) return
      const updateScale = () => {
        const width = Math.max(1, Math.min(1000, config.canvasWidth ?? 1000))
        const height = Math.max(1, Math.min(1000, config.canvasHeight ?? 563))
        setCanvasScale(config.autoFitCanvas === false ? 1 : Math.min(1, target.clientWidth / width, target.clientHeight / height))
        const instance = chart.current
        if (!instance || instance.isDisposed()) return
        instance.resize({ width, height, animation: { duration: 0 } })
      }
      const observer = new ResizeObserver(updateScale)
      observer.observe(target)
      updateScale()
      return () => { observer.disconnect() }
    }, [config.autoFitCanvas, config.canvasHeight, config.canvasWidth])

    useEffect(() => {
      const instance = chart.current
      if (!instance || instance.isDisposed() || readyKind !== config.kind || readyFontSignature !== fontSignature) return
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
      type NativeSelectionHit = { rect: { x: number; y: number; width: number; height: number }; info: { elementKey: string; sourceSeriesName: string; displayCategory: string; displayValue: string; displayLabel?: string; displayColor?: string; selectionTarget?: ChartElementSelection['target']; axis?: 'x' | 'y'; selectionMode?: 'series-first' } }
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
      setRenderAnimationEnabled(!reducedMotion)
      option.animation = !reducedMotion
      option.animationDuration ??= reducedMotion ? 0 : 420
      option.animationDurationUpdate ??= reducedMotion ? 0 : 240
      option.animationEasing ??= 'cubicOut'
      option.animationEasingUpdate ??= 'cubicOut'
      const selectionStyle = { backgroundColor: 'rgba(0,0,0,0)', borderColor: '#6956e8', borderWidth: 1, borderRadius: 5, padding: [2, 4] }
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
      let physicalXAxisOption = option.xAxis as { name?: string; nameGap?: number } | undefined
      const physicalXAxisLabelOffset = Math.max(0, Number(physicalXAxisOption?.nameGap ?? physicalXAxisTitleGap) - physicalXAxisTitleGap)
      const physicalXAxisOuterReserve = grid?.containLabel === false ? physicalXAxisLabelOffset : 0
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
      const cleanPhysicalXAxisOption = cleanOption.xAxis as { name?: string } | undefined
      const standardXAxisTitle = !editorialAxes && showPhysicalXAxisTitle && Boolean(physicalXAxisTitle)
      if (standardXAxisTitle) { if (physicalXAxisOption) physicalXAxisOption.name = ''; if (cleanPhysicalXAxisOption) cleanPhysicalXAxisOption.name = '' }
      const xAxisTitleHeight = xAxisTitleReserve ? xAxisTitleReserve - physicalXAxisTitleGap : 0
      const canvasWidth = config.canvasWidth ?? container.current?.clientWidth ?? 1000
      const xAxisTitleX = (Number(grid?.left ?? marginLeft) + canvasWidth - Number(grid?.right ?? marginRight)) / 2
      const xAxisTitleY = config.xAxisPosition === 'top'
        ? Number(grid?.top ?? marginTop) - physicalXAxisOuterReserve - physicalXAxisTitleGap - xAxisTitleHeight / 2
        : canvasHeight - Number(grid?.bottom ?? marginBottom) + physicalXAxisOuterReserve + physicalXAxisTitleGap + xAxisTitleHeight / 2
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
      // ZRender aligns text inside `style.width`; changing the x coordinate as
      // well double-applies centre/right alignment and pushes text off-canvas.
      const textAnchor = (_align: 'left' | 'center' | 'right') => marginLeft
      const titleHits = [
        visibleTitle && { id: 'chart-title-hit', type: 'text', x: textAnchor(config.titleText.align), top: marginTop, z: 20, cursor: 'pointer', style: { text: titleRich?.text ?? wrappedTitle.text, width: availableWidth, fontFamily: config.titleText.fontFamily, fontSize: renderedTitleSize, fontWeight: config.titleText.weight, fontStyle: config.titleText.italic ? 'italic' : 'normal', lineHeight: Math.round(renderedTitleSize * config.titleText.lineHeight / 100), fill: config.titleText.color, align: config.titleText.align, textAlign: config.titleText.align, rich: titleRich?.rich, opacity: config.titleHtml || selectedSettingsSection === 'title' ? 0 : 1, ...(selectedSettingsSection === 'title' ? selectionStyle : {}) }, onclick: () => onSettingsFocus?.('title') },
        visibleSubtitle && { id: 'chart-subtitle-hit', type: 'text', x: textAnchor(config.subtitleText.align), top: subtitleTop, z: 20, cursor: 'pointer', style: { text: subtitleRich?.text ?? wrappedSubtitle.text, width: availableWidth, fontFamily: config.subtitleText.fontFamily, fontSize: renderedSubtitleSize, fontWeight: config.subtitleText.weight, fontStyle: config.subtitleText.italic ? 'italic' : 'normal', lineHeight: Math.round(renderedSubtitleSize * config.subtitleText.lineHeight / 100), fill: config.subtitleText.color, align: config.subtitleText.align, textAlign: config.subtitleText.align, rich: subtitleRich?.rich, opacity: config.subtitleHtml || selectedSettingsSection === 'subtitle' ? 0 : 1, ...(selectedSettingsSection === 'subtitle' ? selectionStyle : {}) }, onclick: () => onSettingsFocus?.('subtitle') },
      ].filter(Boolean)
      const annotations = config.annotations.map((annotation) => {
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
          backgroundColor: 'transparent',
          borderWidth: 0,
          padding: 0,
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
        onclick: () => onAnnotationSelect?.(annotation.id),
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
      const displayDecorations = decorationGraphics(config.decorations ?? [], undefined, selectDecoration)
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
      cleanOption.graphic = [...cleanLabels, ...decorationGraphics(config.decorations ?? []), ...cleanTitleHits, ...annotations.map((annotation) => ({ ...annotation, style: { ...annotation.style, opacity: 1 } }))]
      setRenderLifecycle((current) => advanceChartRender(current, revision, 'rendering'))
      instance.setOption(option, true)
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
      const exactDisplayDecorations = decorationGraphics(config.decorations ?? [], exactBounds ?? undefined, selectDecoration)
      const exactCleanDecorations = decorationGraphics(config.decorations ?? [], exactBounds ?? undefined)
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
      if (exactBounds || barGrid.length || exactDisplayDecorations.length) instance.setOption({ graphic: option.graphic }, { replaceMerge: ['graphic'] })
      if (nativeSelectionHits.length) {
        const hits = nativeSelectionHits.map((hit, index) => ({ id: `native-selection-hit-${index}`, type: 'rect', z: 140, cursor: 'pointer', shape: hit.rect, style: hit.info.elementKey === selectedElementKey && hit.info.selectionTarget === selectedElementTarget ? { fill: 'rgba(0,0,0,0)', stroke: '#6956e8', lineWidth: 1 } : { fill: 'rgba(0,0,0,0)' }, onmousedown: (event: { offsetX?: number; offsetY?: number }) => {
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
            onSelect?.({ key: point.elementKey, seriesName: '', category: point.displayCategory, value: point.displayValue, target: 'category-label', axis: point.axis })
            onSettingsFocus?.(`${point.axis ?? 'y'}-axis-labels`)
            return
          }
          if (point.selectionMode === 'series-first' && clickedSeries.current !== seriesName) {
            onSeriesSelect?.({ name: seriesName, color: point.displayColor ?? getSeriesColor(config, seriesName, 0) })
            clickedSeries.current = seriesName
            onSettingsFocus?.('series')
            return
          }
          onSelect?.({ key: point.elementKey, seriesName, category: point.displayCategory, value: point.displayValue, color: point.displayColor, target: point.selectionTarget })
          onSettingsFocus?.('element')
        } }))
        option.graphic = [...(Array.isArray(option.graphic) ? option.graphic : []), ...hits]
        instance.setOption({ graphic: option.graphic }, { replaceMerge: ['graphic'] })
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
        instance.resize({ width: Math.min(1000, config.canvasWidth ?? 1000), height: Math.min(1000, config.canvasHeight ?? 563), animation: { duration: 0 } })
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
    }, [activeCategoryLabel, table, config, fontSignature, hoveredSeriesName, onAnnotationSelect, onDecorationChange, onDecorationSelect, onSelect, onSeriesSelect, onSettingsFocus, readyFontSignature, readyKind, selectedAnnotationId, selectedElementKey, selectedElementTarget, selectedSeriesName, selectedSettingsSection])

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
          const category = String(event.value ?? event.name ?? '')
          onClearSettingsFocus?.()
          onSelect?.({ key: `category-label:${axis}:${category}`, seriesName: '', category, value: config.categoryLabelOverrides?.[axis]?.[category] ?? category, target: 'category-label', axis })
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
          if (renderedPlotKind !== 'treemap' && selectedSettingsSection !== 'values') { onSettingsFocus?.('values'); return }
          onSelect?.(nativeSelection('value-label') ?? { key: pointData.elementKey, seriesName, category: pointData.displayCategory ?? event.name ?? '', value: pointData.displayValue ?? String(event.value ?? ''), label: pointData.displayLabel, color: pointColor, target: 'value-label' })
          onSettingsFocus?.('element')
          return
        }
        if (clickedSeries.current !== seriesName) {
          onSeriesSelect?.({ name: seriesName, color: pointColor ?? getSeriesColor(config, seriesName, 0) })
          clickedSeries.current = seriesName
          onSettingsFocus?.('series')
          return
        }
        if (!pointData?.elementKey) return
        onSelect?.(nativeSelection() ?? { key: pointData.elementKey, seriesName, category: pointData.displayCategory ?? event.name ?? '', value: pointData.displayValue ?? String(event.value ?? ''), label: pointData.displayLabel, color: pointColor })
        onSettingsFocus?.('element')
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
      async exportSvg(options) {
        const instance = chart.current
        if (!instance || !exportOption.current) return
        const revision = beginRenderCycle('post-processing')
        await waitForChartFonts(requestedFontFamilies, config.customFonts)
        instance.setOption(exportOption.current, true)
        instance.getZr().flush()
        try {
          const svg = container.current?.querySelector('svg')
          if (!svg) return
          const textBlocks = (['title', 'subtitle', 'note', 'source'] as const).flatMap((field) => {
            const html = config[`${field}Html` as const], layout = richLayouts[field], style = config[`${field}Text` as const]
            const visible = field === 'title' ? config.showTitle !== false : field === 'subtitle' ? config.showSubtitle !== false : field === 'note' ? config.showNote !== false : config.showSource !== false
            return html && layout && visible ? [exportRichBlock(html, config[field], style, layout)] : []
          })
          const { exportChartAsSvg } = await import('../features/chart-export/chartExport')
          await exportChartAsSvg(svg, { canvasWidth: config.canvasWidth, canvasHeight: config.canvasHeight, customFonts: config.customFonts }, options, textBlocks)
        } finally {
          if (displayOption.current) { instance.setOption(displayOption.current, true); instance.getZr().flush() }
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
          if (!instance.isDisposed() && chart.current === instance && revision === renderRevision.current) setRenderLifecycle((current) => settleChartRender(current, revision))
        }
      },
      async exportPng(options) {
        const instance = chart.current
        if (!instance || !exportOption.current) return
        const revision = beginRenderCycle('post-processing')
        await waitForChartFonts(requestedFontFamilies, config.customFonts)
        instance.setOption(exportOption.current, true)
        instance.getZr().flush()
        try {
          const svg = container.current?.querySelector('svg')
          if (!svg) return
          const textBlocks = (['title', 'subtitle', 'note', 'source'] as const).flatMap((field) => {
            const html = config[`${field}Html` as const], layout = richLayouts[field], style = config[`${field}Text` as const]
            const visible = field === 'title' ? config.showTitle !== false : field === 'subtitle' ? config.showSubtitle !== false : field === 'note' ? config.showNote !== false : config.showSource !== false
            return html && layout && visible ? [exportRichBlock(html, config[field], style, layout)] : []
          })
          const { exportChartAsPng } = await import('../features/chart-export/chartExport')
          await exportChartAsPng(svg, { canvasWidth: config.canvasWidth, canvasHeight: config.canvasHeight, customFonts: config.customFonts }, options, textBlocks)
        } finally {
          if (displayOption.current) { instance.setOption(displayOption.current, true); instance.getZr().flush() }
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
          if (!instance.isDisposed() && chart.current === instance && revision === renderRevision.current) setRenderLifecycle((current) => settleChartRender(current, revision))
        }
      },
    }), [config, requestedFontFamilies, richLayouts, selectedElementKey])

    const selected = config.annotations.find((annotation) => annotation.id === selectedAnnotationId)
    const selectedDecoration = config.decorations?.find((decoration) => decoration.id === selectedDecorationId)
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
    const safeZoom = Math.min(2, Math.max(.5, viewZoom))
    const canvasTransform = config.autoFitCanvas === false ? `scale(${safeZoom})` : `translate(-50%, -50%) scale(${canvasScale * safeZoom})`
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
          {renderError && <div className="chart-render-error" role="alert"><strong>Не удалось отрисовать график</strong><span>{renderError}</span></div>}
          {richDisplays.map(({ field, html, layout, style }) => <CanvasTextDisplay key={field} html={html} style={{ ...style, size: layout.baseSize }} left={layout.left} top={layout.top} width={layout.width} onSelect={() => { onAnnotationSelect?.(''); onSettingsFocus?.(field) }}/>)}
          {selectedDecoration && onDecorationChange && <DecorationOverlay decoration={selectedDecoration} canvasWidth={canvasWidth} canvasHeight={canvasHeight} plotTop={plotBounds?.top} plotBottom={plotBounds?.bottom} plotLeft={plotBounds?.left} plotRight={plotBounds?.right} onChange={onDecorationChange}/>}
          {config.annotations.filter((annotation) => annotation.id !== selectedAnnotationId).map((annotation) => <AnnotationDisplay key={annotation.id} annotation={annotation} canvasBackground={config.canvasBackground} onSelect={() => onAnnotationSelect?.(annotation.id)}/>)}
          <Suspense fallback={null}>
            {categoryLabelLayout && selectedCategoryLabel && <CanvasTextOverlay id={`category-${categoryLabelLayout.axis}-${categoryLabelLayout.category}`} text={config.categoryLabelOverrides?.[categoryLabelLayout.axis]?.[categoryLabelLayout.category] ?? categoryLabelLayout.category} style={categoryLabelLayout.style} left={categoryLabelLayout.left} top={categoryLabelLayout.top} width={categoryLabelLayout.width} rotation={categoryLabelLayout.rotation} policy={{ richText: false, multiline: true, explicitNewlines: true, styleToolbar: false }} customFonts={config.customFonts} canvasBackground={config.canvasBackground} onChange={(_html, text) => onCategoryLabelChange?.(categoryLabelLayout.axis, categoryLabelLayout.category, text)}/>}
            {richField && richLayout && richStyle && <CanvasTextOverlay id={richField} text={richText} html={richHtml} style={{ ...richStyle, size: richLayout.baseSize }} left={richLayout.left} top={richLayout.top} width={richLayout.width} customFonts={config.customFonts} canvasBackground={config.canvasBackground} onChange={(html, text) => onRichTextChange?.(richField, html, text)} onStyleChange={(style) => { const key = `${richField}Text` as 'titleText' | 'subtitleText' | 'noteText' | 'sourceText'; (config as unknown as Record<typeof key, ChartConfig['titleText']>)[key] = { ...config[key], ...style }; onTextStyleChange?.(richField, style) }}/>}
            {selected && <AnnotationOverlay annotation={selected} customFonts={config.customFonts} canvasBackground={config.canvasBackground} onChange={(annotation) => onAnnotationChange?.(annotation)} onDuplicate={() => onAnnotationDuplicate?.(selected)} onDelete={() => onAnnotationDelete?.(selected.id)} onClose={() => onAnnotationSelect?.('')}/>}
          </Suspense>
        </div>
      </div>
    )
  },
)
