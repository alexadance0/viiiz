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
import { getChartPlugin, getSeriesColor, hyphenateTreemapText, prepareButterflyChartData, prepareVisibleChartData, waterfallLabelPlacement, waterfallSteps, waterfallValueLabel } from '../core/chartRegistry'
import { barSeriesGeometry, valueLabelBoxPlacement } from '../core/chartLabels'
import { nearestPixelIndex, prepareChartData, segmentEndpointIndex } from '../core/chartData'
import { sanitizeAnnotationHtml } from '../core/annotationHtml'
import type { ChartAnnotation, ChartConfig, ChartDecoration, ChartElementSelection, ChartKind, ChartSeriesSelection, DataTable } from '../core/types'
import { DecorationOverlay } from './DecorationOverlay'
import { AnnotationDisplay, CanvasTextDisplay } from './ChartCanvasDisplays'
import { formatChartNumber } from '../core/numberFormat'
import { formatTimeValue } from '../core/timeFrequency'
import { measureTextWidth, wrapMeasuredText } from '../core/textMetrics'
import { planCategoryDateLabels } from '../core/chartDateAxis'
import { decorationGraphics, type PlotBounds } from './chartDecorations'
import { isAreaChart, isBarChart, isDistributionChart, isStackedBarChart, isStackedChart, usesHorizontalAxes } from '../core/chartKinds'
import type { ChartExportOptions, ExportTextBlock } from '../features/chart-export/chartExport'
import { DEFAULT_COMPOSITION_SPACING } from '../entities/chart/model/defaults'
import { renderScene } from '../features/chart-renderer/echarts/renderScene'
import { layoutText, plainTextDocument } from '../features/chart-layout/textLayout'
import { legacySelection, type ChartSelection } from '../entities/chart/model/ChartSelection'

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

export interface ChartCanvasHandle {
  exportSvg(options?: ChartExportOptions): Promise<void>
  exportPng(options?: ChartExportOptions): Promise<void>
}

export type ChartSettingsSection = 'title' | 'subtitle' | 'x-axis-title' | 'y-axis-title' | 'x-axis-labels' | 'y-axis-labels' | 'grid' | 'legend' | 'values' | 'note' | 'source' | 'series' | 'element'

const RHYTHM = { edge: DEFAULT_COMPOSITION_SPACING.canvasInsets.top, titleSubtitle: DEFAULT_COMPOSITION_SPACING.titleSubtitle, headerLegend: DEFAULT_COMPOSITION_SPACING.headerLegend, headerPlot: DEFAULT_COMPOSITION_SPACING.headerPlot, legendPlot: DEFAULT_COMPOSITION_SPACING.legendPlot, plotFooter: DEFAULT_COMPOSITION_SPACING.plotFooter, noteSource: DEFAULT_COMPOSITION_SPACING.noteSource } as const
export const heatmapScaleSideOffset = (config: ChartConfig) => config.kind === 'heatmap' && (config.heatmapShowScale ?? true) && (config.heatmapScalePosition ?? 'right') === config.yAxisPosition ? 80 : 0
interface HeatmapScaleAxisReserve { x: number; y: number }
export function positionHeatmapScaleGraphics(graphics: unknown[], config: ChartConfig, grid: { top?: number; right?: number; bottom?: number; left?: number }, canvasWidth: number, canvasHeight: number, axisReserve: HeatmapScaleAxisReserve = { x: 0, y: 0 }) {
  if (config.kind !== 'heatmap' || !(config.heatmapShowScale ?? true)) return graphics
  const position = config.heatmapScalePosition ?? 'right', vertical = position === 'left' || position === 'right'
  const plotLeft = Number(grid.left ?? 0), plotRight = canvasWidth - Number(grid.right ?? 0), plotTop = Number(grid.top ?? 0), plotBottom = canvasHeight - Number(grid.bottom ?? 0)
  const xReserve = position === config.xAxisPosition ? axisReserve.x : 0
  const yReserve = position === config.yAxisPosition ? axisReserve.y : 0
  const horizontalY = position === 'top' ? plotTop - xReserve - 48 : plotBottom + xReserve + 8
  const scaleLength = Math.min(180, Math.max(90, (plotBottom - plotTop) * .55)), verticalY = (plotTop + plotBottom - scaleLength) / 2
  const barX = position === 'left' ? config.canvasMarginLeft ?? 32 : position === 'right' ? plotRight + yReserve + 68 : plotLeft
  const barWidth = vertical ? 12 : scaleLength, barHeight = vertical ? scaleLength : 12
  return graphics.map((graphic) => {
    if (!graphic || typeof graphic !== 'object') return graphic
    const item = graphic as { id?: string; info?: { ratio?: number }; shape?: Record<string, number>; style?: Record<string, unknown> }
    if (item.id === 'heatmap-scale-bar') return { ...item, shape: { ...item.shape, x: barX, y: vertical ? verticalY : horizontalY + 24, width: barWidth, height: barHeight } }
    const match = item.id?.match(/^heatmap-scale-(tick|label)-(\d)$/)
    if (!match) return graphic
    const ratio = Number.isFinite(item.info?.ratio) ? item.info!.ratio! : Number(match[2]) / 2
    if (match[1] === 'tick') return { ...item, shape: vertical ? { x1: barX - 3, y1: verticalY + scaleLength * ratio, x2: barX + 15, y2: verticalY + scaleLength * ratio } : { x1: plotLeft + barWidth * ratio, y1: horizontalY + 14, x2: plotLeft + barWidth * ratio, y2: horizontalY + 22 } }
    return { ...item, style: vertical ? { ...item.style, x: position === 'left' ? barX + 20 : barX - 8, y: verticalY + scaleLength * ratio, align: position === 'left' ? 'left' : 'right' } : { ...item.style, x: plotLeft + barWidth * ratio, y: horizontalY + 5, align: 'center' } }
  })
}

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

function directLabelWidth(config: ChartConfig, names: string[]) {
  const canvasWidth = Math.min(1000, config.canvasWidth ?? 1000)
  const contentWidth = names.reduce((result, name) => {
    const seriesStyle = config.seriesStyles[name]
    const style = seriesStyle?.directLabelText ?? config.directLabelText ?? config.legendText
    const lineWidth = (value: string, size: number, weight: number) => Math.max(0, ...value.split('\n').map((line) => measureTextWidth(line, size, style.fontFamily, weight)))
    return Math.max(result, lineWidth(seriesStyle?.legendLabel?.trim() || name, style.size, style.weight), lineWidth(seriesStyle?.legendNote?.trim() || '', Math.max(8, style.size - 2), 400))
  }, 0)
  return Math.round(Math.min(Math.max(120, canvasWidth - 120), contentWidth + 10))
}
// oxlint-disable-next-line react/only-export-components -- exported for a renderer regression test
export function directLegendGraphics(instance: echarts.ECharts, table: DataTable, config: ChartConfig, onFocus?: (section: ChartSettingsSection) => void, selected = false) {
  if (!config.showDirectLabels || config.kind === 'scatter' || config.kind === 'bubble') return []
  const confidenceGroups = config.kind === 'confidence-line'
    ? (config.intervalGroups?.length ? config.intervalGroups : config.yFields.slice(0, Math.floor(config.yFields.length / 3) * 3).reduce<NonNullable<ChartConfig['intervalGroups']>>((groups, field, index, fields) => {
      if (index % 3 === 0 && fields[index + 1] && fields[index + 2]) groups.push({ main: field, lower: fields[index + 1], upper: fields[index + 2] })
      return groups
    }, []))
    : []
  const directNames = confidenceGroups.length ? new Set(confidenceGroups.flatMap((group) => [group.main, ...(group.showBounds ? [group.lower, group.upper] : [])])) : null
  const preparedRaw = config.kind === 'butterfly' ? prepareButterflyChartData(table, config) : prepareVisibleChartData(table, config)
  const directSeries = preparedRaw.series.flatMap((series, seriesIndex) => !directNames || directNames.has(series.name) ? [{ series, seriesIndex }] : [])
  const butterflyLeftFields = new Set(config.butterflyLeftFields?.length ? config.butterflyLeftFields : config.yFields.slice(0, 1))
  const visibleSeries = directSeries.filter(({ series }) => config.seriesStyles[series.name]?.showDirectLabel !== false)
  if (!visibleSeries.length) return []
  if (isHorizontalBar(config)) {
    const names = directSeries.map(({ series }) => series.name), width = directLabelWidth(config, names)
    const categoryPixels = preparedRaw.categories.map((_, index) => {
      try {
        const pixel = instance.convertToPixel({ yAxisIndex: 0 }, index)
        return typeof pixel === 'number' && Number.isFinite(pixel) ? pixel : null
      } catch { return null }
    })
    const visibleCategoryPixels = categoryPixels.filter((pixel): pixel is number => pixel != null)
    const band = visibleCategoryPixels.length > 1 ? Math.min(...visibleCategoryPixels.slice(1).map((pixel, index) => Math.abs(pixel - visibleCategoryPixels[index])).filter((value) => value > 0)) : 40
    const stacked = isStackedChart(config.kind)
    const topIndexes = [...preparedRaw.categories.keys()]
    if (!(config.categoryAxisInverse ?? true)) topIndexes.reverse()
    return visibleSeries.flatMap(({ series, seriesIndex }) => {
      const index = topIndexes.find((current) => series.data[current] != null) ?? -1
      if (index < 0) return []
      const value = series.data[index]
      if (value == null) return []
      const previousValue = stacked ? preparedRaw.series.slice(0, seriesIndex).reduce((sum, candidate) => {
        const part = candidate.data[index] ?? 0
        const sameSide = config.kind === 'butterfly' ? butterflyLeftFields.has(candidate.name) === butterflyLeftFields.has(series.name) : Math.sign(part) === Math.sign(value)
        return sameSide ? sum + part : sum
      }, 0) : 0
      const plottedValue = stacked ? previousValue + value : value
      const axisIndex = config.kind === 'butterfly' && !butterflyLeftFields.has(series.name) ? 1 : 0
      let startX: unknown, endX: unknown, categoryY: unknown
      try { startX = instance.convertToPixel({ xAxisIndex: axisIndex }, previousValue); endX = instance.convertToPixel({ xAxisIndex: axisIndex }, plottedValue); categoryY = instance.convertToPixel({ yAxisIndex: axisIndex }, index) } catch { return [] }
      if (typeof startX !== 'number' || typeof endX !== 'number' || typeof categoryY !== 'number' || !Number.isFinite(startX) || !Number.isFinite(endX) || !Number.isFinite(categoryY)) return []
      const { width: normalWidth, offset: rowOffset } = barSeriesGeometry(band, config, preparedRaw.series.length, seriesIndex, stacked)
      const rowCenterX = (startX + endX) / 2, rowTopY = categoryY + rowOffset - normalWidth / 2
      const color = getSeriesColor(config, series.name, seriesIndex), seriesStyle = config.seriesStyles[series.name], style = seriesStyle?.directLabelText ?? config.directLabelText ?? config.legendText, note = seriesStyle?.legendNote?.trim() ?? '', name = seriesStyle?.legendLabel?.trim() || series.name
      const lineHeight = Math.round(style.size * style.lineHeight / 100), noteSize = Math.max(8, style.size - 2), noteLineHeight = Math.round(noteSize * 1.25)
      const textColor = seriesStyle?.directLabelText?.color ?? color
      const noteHeight = note ? Math.max(1, note.split('\n').length) * noteLineHeight : 0
      const height = Math.max(1, name.split('\n').length) * lineHeight + (noteHeight ? 3 + noteHeight : 0)
      const x = Math.max(4, Math.min(instance.getWidth() - width - 4, rowCenterX - width / 2))
      const y = Math.max(4, rowTopY - height - Math.max(8, config.directLabelGap ?? 14))
      const graphics: Record<string, unknown>[] = []
      if (config.showDirectLabelLines || seriesStyle?.showLegendLine) graphics.push({ id: `direct-legend-line-${series.name}`, type: 'polyline', z: 75, silent: true, shape: { points: [[rowCenterX, rowTopY], [rowCenterX, y + height + 3], [x + width / 2, y + height + 3]] }, style: { stroke: color, fill: 'none', lineWidth: config.directLabelLineWidth ?? 1, lineDash: config.directLabelLineType === 'dashed' ? [6, 4] : config.directLabelLineType === 'dotted' ? [2, 3] : undefined } })
      if (selected) graphics.push({ id: `direct-legend-selection-${series.name}`, type: 'rect', left: x - 4, top: y - 2, z: 75, silent: true, shape: { x: 0, y: 0, width: width + 8, height: height + 4, r: 5 }, style: { fill: 'rgba(0,0,0,0)', stroke: '#6956e8', lineWidth: 1 } })
      graphics.push({ id: `direct-legend-name-${series.name}`, type: 'text', left: x, top: y, z: 76, cursor: 'pointer', style: { text: name, width, fill: textColor, fontFamily: style.fontFamily, fontSize: style.size, fontWeight: style.weight, fontStyle: style.italic ? 'italic' : 'normal', lineHeight, align: 'center', textAlign: 'center' }, onclick: () => onFocus?.('legend') })
      if (note) graphics.push({ id: `direct-legend-note-${series.name}`, type: 'text', left: x, top: y + height - noteHeight, z: 76, cursor: 'pointer', style: { text: note, width, fill: textColor, fontFamily: style.fontFamily, fontSize: noteSize, fontWeight: 400, fontStyle: 'normal', lineHeight: noteLineHeight, align: 'center', textAlign: 'center', opacity: .78 }, onclick: () => onFocus?.('legend') })
      return graphics
    })
  }
  let dataMin = Number.POSITIVE_INFINITY, dataMax = Number.NEGATIVE_INFINITY
  preparedRaw.series.forEach((series) => series.data.forEach((value) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return
    if (value < dataMin) dataMin = value
    if (value > dataMax) dataMax = value
  }))
  if (!Number.isFinite(dataMin) || !Number.isFinite(dataMax)) return []
  const current = instance.getOption() as unknown as { yAxis?: Array<{ min?: number; max?: number }> }, axis = current.yAxis?.[0]
  const yMin = Number.isFinite(Number(axis?.min)) ? Number(axis?.min) : Math.min(dataMin, 0), yMax = Number.isFinite(Number(axis?.max)) ? Number(axis?.max) : Math.max(dataMax, 0)
  let topPixel: unknown, bottomPixel: unknown
  try { topPixel = instance.convertToPixel({ yAxisIndex: 0 }, yMax); bottomPixel = instance.convertToPixel({ yAxisIndex: 0 }, yMin) } catch { return [] }
  if (typeof topPixel !== 'number' || typeof bottomPixel !== 'number' || !Number.isFinite(topPixel) || !Number.isFinite(bottomPixel)) return []
  const top = Math.min(topPixel, bottomPixel), bottom = Math.max(topPixel, bottomPixel)
  const names = directSeries.map(({ series }) => series.name), width = directLabelWidth(config, names)
  const leftSide = config.yAxisPosition === 'right' && !isHorizontalBar(config)
  const categoryValue = (index: number) => index
  const pixelAt = (index: number) => {
    if (index < 0) return undefined
    try {
      const pixel = instance.convertToPixel({ xAxisIndex: 0 }, categoryValue(index))
      return typeof pixel === 'number' && Number.isFinite(pixel) ? pixel : undefined
    } catch { return undefined }
  }
  const endpointX = pixelAt(leftSide ? 0 : preparedRaw.categories.length - 1), previousX = pixelAt(preparedRaw.categories.length - 2)
  const plotEdge = endpointX == null ? leftSide ? width + 8 : instance.getWidth() - width - 8 : endpointX + (!leftSide && isBarChart(config.kind) && previousX != null ? Math.abs(endpointX - previousX) / 2 : 0)
  const yTitleStyle = config.yAxisTitleText ?? config.axisTitleText
  const rightTitleInset = config.yAxisPosition === 'right' && config.showYAxisTitle && config.yAxisTitle
    ? Math.round(yTitleStyle.size * yTitleStyle.lineHeight / 100) * Math.max(1, config.yAxisTitle.split('\n').length) + config.yAxisTitleGap + 8
    : config.canvasMarginRight ?? 24
  const x = leftSide
    ? Math.max(config.canvasMarginLeft ?? 32, plotEdge - (config.directLabelGap ?? 14) - width)
    : Math.max(4, Math.min(instance.getWidth() - width - rightTitleInset, plotEdge + (config.directLabelGap ?? 14)))
  // Lay out every eligible series before removing disabled labels. This keeps
  // neighbouring labels stable while a single series is toggled on or off.
  const items = directSeries.flatMap(({ series, seriesIndex }) => {
    let index = -1
    if (leftSide) { for (let current = 0; current < series.data.length; current += 1) if (series.data[current] != null) { index = current; break } }
    else for (let current = series.data.length - 1; current >= 0; current -= 1) if (series.data[current] != null) { index = current; break }
    if (index < 0) return []
    const value = series.data[index]
    if (value == null) return []
    const previousValue = isStackedChart(config.kind) ? preparedRaw.series.slice(0, seriesIndex).reduce((sum, candidate) => {
      const part = candidate.data[index] ?? 0
      return Math.sign(part) === Math.sign(value) ? sum + part : sum
    }, 0) : isAreaChart(config.kind) ? yMin : 0
    const plottedValue = isStackedChart(config.kind) ? previousValue + value : value
    let pointX: unknown, pointY: unknown
    try { pointX = instance.convertToPixel({ xAxisIndex: 0 }, categoryValue(index)); pointY = instance.convertToPixel({ yAxisIndex: 0 }, plottedValue) } catch { return [] }
    if (typeof pointX !== 'number' || typeof pointY !== 'number' || !Number.isFinite(pointX) || !Number.isFinite(pointY)) return []
    const point = [pointX, pointY]
    if (isBarChart(config.kind) || isAreaChart(config.kind)) {
      let baseline: unknown
      try { baseline = instance.convertToPixel({ yAxisIndex: 0 }, previousValue) } catch { baseline = undefined }
      if (typeof baseline === 'number' && Number.isFinite(baseline)) point[1] = (point[1] + baseline) / 2
    }
    const seriesStyle = config.seriesStyles[series.name], style = seriesStyle?.directLabelText ?? config.directLabelText ?? config.legendText, note = seriesStyle?.legendNote?.trim() ?? ''
    const lineHeight = Math.round(style.size * style.lineHeight / 100), noteSize = Math.max(8, style.size - 2), noteLineHeight = Math.round(noteSize * 1.25)
    const name = seriesStyle?.legendLabel?.trim() || series.name
    const nameHeight = Math.max(1, name.split('\n').length) * lineHeight
    const noteHeight = note ? Math.max(1, note.split('\n').length) * noteLineHeight : 0
    return [{ series, seriesIndex, point, name, nameHeight, note, height: nameHeight + (noteHeight ? 3 + noteHeight : 0), targetY: point[1], style, lineHeight, noteSize, noteLineHeight }]
  }).sort((left, right) => left.targetY - right.targetY)
  const totalTextHeight = items.reduce((sum, item) => sum + item.height, 0)
  const availableHeight = Math.max(0, bottom - top)
  const gap = items.length > 1 ? Math.max(2, Math.min(8, (availableHeight - totalTextHeight) / (items.length - 1))) : 0
  items.forEach((item, index) => { item.targetY = Math.max(top + item.height / 2, item.targetY); if (index) { const previous = items[index - 1]; item.targetY = Math.max(item.targetY, previous.targetY + previous.height / 2 + item.height / 2 + gap) } })
  if (items.length) items[items.length - 1].targetY = Math.min(items[items.length - 1].targetY, bottom - items[items.length - 1].height / 2)
  for (let index = items.length - 2; index >= 0; index -= 1) { const next = items[index + 1], item = items[index]; item.targetY = Math.min(item.targetY, next.targetY - next.height / 2 - item.height / 2 - gap) }
  if (items.length && items[0].targetY < top + items[0].height / 2) { const shift = top + items[0].height / 2 - items[0].targetY; items.forEach((item) => { item.targetY += shift }) }
  return items.flatMap((item) => {
    if (config.seriesStyles[item.series.name]?.showDirectLabel === false) return []
    const color = getSeriesColor(config, item.series.name, item.seriesIndex), textColor = config.seriesStyles[item.series.name]?.directLabelText?.color ?? color, moved = Math.abs(item.targetY - item.point[1]) > 2
    const forced = config.seriesStyles[item.series.name]?.showLegendLine, showLine = forced ?? (config.showDirectLabelLines || moved)
    const graphics: Record<string, unknown>[] = []
    if (showLine) graphics.push({ id: `direct-legend-line-${item.series.name}`, type: 'polyline', z: 75, silent: true, shape: { points: leftSide ? [[item.point[0], item.point[1]], [x + width + 8, item.targetY], [x + width + 3, item.targetY]] : [[item.point[0], item.point[1]], [x - 8, item.targetY], [x - 3, item.targetY]] }, style: { stroke: color, fill: 'none', lineWidth: config.directLabelLineWidth ?? 1, lineDash: config.directLabelLineType === 'dashed' ? [6, 4] : config.directLabelLineType === 'dotted' ? [2, 3] : undefined } })
    const blockTop = item.targetY - item.height / 2
    if (selected) graphics.push({ id: `direct-legend-selection-${item.series.name}`, type: 'rect', left: x - 4, top: blockTop - 2, z: 75, silent: true, shape: { x: 0, y: 0, width: width + 8, height: item.height + 4, r: 5 }, style: { fill: 'rgba(0,0,0,0)', stroke: '#6956e8', lineWidth: 1 } })
    graphics.push({ id: `direct-legend-name-${item.series.name}`, type: 'text', left: x, top: blockTop, z: 76, cursor: 'pointer', style: { text: item.name, width, fill: textColor, fontFamily: item.style.fontFamily, fontSize: item.style.size, fontWeight: item.style.weight, fontStyle: item.style.italic ? 'italic' : 'normal', lineHeight: item.lineHeight, align: leftSide ? 'right' : 'left', textAlign: leftSide ? 'right' : 'left' }, onclick: () => onFocus?.('legend') })
    if (item.note) graphics.push({ id: `direct-legend-note-${item.series.name}`, type: 'text', left: x, top: blockTop + item.nameHeight + 3, z: 76, cursor: 'pointer', style: { text: item.note, width, fill: textColor, fontFamily: item.style.fontFamily, fontSize: item.noteSize, fontWeight: 400, fontStyle: 'normal', lineHeight: item.noteLineHeight, align: leftSide ? 'right' : 'left', textAlign: leftSide ? 'right' : 'left', opacity: .78 }, onclick: () => onFocus?.('legend') })
    return graphics
  })
}
function valueLabelHitGraphics(instance: echarts.ECharts, table: DataTable, config: ChartConfig, allSelected: boolean, onSelect?: (selection: ChartElementSelection) => void, onFocus?: (section: ChartSettingsSection) => void, selectedElementKey?: string | null, selectedElementTarget?: ChartElementSelection['target']) {
  if (config.kind === 'waterfall') {
    const prepared = prepareVisibleChartData(table, config), source = prepared.series[0]
    if (!source) return []
    const totalLabel = config.waterfallTotalLabel?.trim() || 'Итого'
    const { steps, total } = waterfallSteps(source.data)
    const entries = [
      ...steps.map((step, index) => ({ ...step, category: prepared.categories[index], label: String(prepared.categories[index] ?? ''), total: false })),
      ...((config.waterfallShowTotal ?? true) ? [{ delta: total, start: 0, end: total, category: totalLabel, label: totalLabel, total: true }] : []),
    ]
    const categoryPixels = entries.flatMap((_, index) => {
      try {
        const pixel = Number(instance.convertToPixel({ xAxisIndex: 0 }, index))
        return Number.isFinite(pixel) ? [pixel] : []
      } catch { return [] }
    })
    const plot = chartPlotBounds(instance, table, config)
    const band = categoryPixels.length > 1
      ? Math.min(...categoryPixels.slice(1).map((pixel, index) => Math.abs(pixel - categoryPixels[index])).filter((value) => value > 0))
      : ((plot?.right ?? instance.getWidth()) - (plot?.left ?? 0)) / Math.max(1, entries.length)
    const width = Math.max(1, band * Math.max(.1, Math.min(1, (config.barWidth ?? 68) / 100)))
    return entries.flatMap((entry, index) => {
      if (entry.delta == null) return []
      const key = `${source.name}\u001f${entry.category instanceof Date ? entry.category.toISOString() : `${typeof entry.category}:${String(entry.category)}`}`
      const color = config.elementStyles[key]?.color ?? (entry.total ? config.waterfallTotalColor ?? '#6956e8' : entry.delta >= 0 ? config.waterfallIncreaseColor ?? '#36a476' : config.waterfallDecreaseColor ?? '#db5a5a')
      let x: number, startY: number, endY: number
      try {
        x = Number(instance.convertToPixel({ xAxisIndex: 0 }, index))
        startY = Number(instance.convertToPixel({ yAxisIndex: 0 }, entry.start))
        endY = Number(instance.convertToPixel({ yAxisIndex: 0 }, entry.end))
      } catch { return [] }
      if (![x, startY, endY].every(Number.isFinite)) return []
      const select = (target?: ChartElementSelection['target']) => {
        onSelect?.({ key, seriesName: source.name, category: entry.label, value: waterfallValueLabel(entry.delta!, entry.end, entry.total, config), color, target })
        onFocus?.('element')
      }
      const graphics: Record<string, unknown>[] = [{
        id: `waterfall-hit-${index}`,
        type: 'rect',
        z: 130,
        cursor: 'pointer',
        shape: { x: x - width / 2, y: Math.min(startY, endY), width, height: Math.max(1, Math.abs(startY - endY)) },
        style: { fill: 'rgba(0,0,0,0)' },
        onclick: () => select(),
      }]
      const element = config.elementStyles[key]
      const showLabel = (element?.showLabel ?? config.showValues) && (!entry.total || (config.waterfallShowTotalValue ?? true))
      if (!showLabel) return graphics
      const style = element?.valueText ?? config.valueText
      const label = element?.label || waterfallValueLabel(entry.delta, entry.end, entry.total, config)
      const lineHeight = Math.round(style.size * style.lineHeight / 100)
      const labelWidth = Math.max(...label.split('\n').map((line) => measureTextWidth(line, style.size, style.fontFamily, style.weight)))
      const labelHeight = lineHeight * label.split('\n').length
      const labelStride = Math.max(1, Math.ceil((labelWidth + 8) / Math.max(1, band)))
      if (element?.showLabel !== true && (config.valueLabelHideOverlap ?? false) && !entry.total && index % labelStride !== 0) return graphics
      const requestedPosition = element?.waterfallLabelPosition ?? config.valueLabelPosition ?? 'auto'
      const position = entry.total ? requestedPosition === 'bottom' ? 'top' : requestedPosition === 'inside-bottom' ? 'inside-top' : requestedPosition : requestedPosition
      const placement = waterfallLabelPlacement(startY, endY, width, labelWidth, labelHeight, position, config.waterfallLabelGap ?? 6)
      const y = placement.verticalAlign === 'top' ? placement.y : placement.verticalAlign === 'bottom' ? placement.y - labelHeight : placement.y - labelHeight / 2
      graphics.push({
        id: `value-label-hit-waterfall-${index}`,
        type: 'rect',
        z: 131,
        cursor: 'pointer',
        shape: { x: x - labelWidth / 2 - 4, y: y - 2, width: labelWidth + 8, height: labelHeight + 4, r: 5 },
        style: selectedElementKey === key && selectedElementTarget === 'value-label'
          ? { fill: 'rgba(0,0,0,0)', stroke: '#6956e8', lineWidth: 1 }
          : { fill: 'rgba(0,0,0,0)' },
        onclick: () => select('value-label'),
      })
      return graphics
    })
  }
  if (config.kind === 'treemap' || !config.showValues && !Object.values(config.elementStyles).some((style) => style.showLabel)) return []
  const prepared = config.kind === 'butterfly' ? prepareButterflyChartData(table, config) : prepareVisibleChartData(table, config), horizontal = isHorizontalBar(config)
  const configured = config.valueLabelPosition ?? 'auto'
  const absorption = isBarChart(config.kind) && config.kind !== 'lollipop' && config.kind !== 'horizontal-lollipop' && Boolean(config.barValueLabelAbsorption)
  const categoryPixels = absorption ? prepared.categories.flatMap((_, index) => {
    try {
      const pixel = Number(instance.convertToPixel(horizontal ? { yAxisIndex: 0 } : { xAxisIndex: 0 }, index))
      return Number.isFinite(pixel) ? [pixel] : []
    } catch { return [] }
  }) : []
  const bounds = absorption ? chartPlotBounds(instance, table, config) : null
  const band = categoryPixels.length > 1
    ? Math.min(...categoryPixels.slice(1).map((pixel, index) => Math.abs(pixel - categoryPixels[index])).filter((value) => value > 0))
    : bounds ? (horizontal ? bounds.bottom - bounds.top : bounds.right - bounds.left) / Math.max(1, prepared.categories.length) : 0
  let baseline: number
  try { baseline = Number(instance.convertToPixel(horizontal ? { xAxisIndex: 0 } : { yAxisIndex: 0 }, 0)) } catch { return [] }
  if (!Number.isFinite(baseline)) return []
  return prepared.series.flatMap((series, seriesIndex) => series.data.flatMap((value, dataIndex) => {
    if (value == null) return []
    const category = prepared.categories[dataIndex], key = `${series.name}\u001f${category instanceof Date ? category.toISOString() : `${typeof category}:${String(category)}`}`
    const override = config.elementStyles[key]
    if (!(override?.showLabel ?? config.showValues)) return []
    const style = override?.valueText ?? config.valueText, label = override?.label || formatChartNumber(config.kind === 'butterfly' ? Math.abs(value) : value, config)
    const previousValue = isStackedChart(config.kind) ? prepared.series.slice(0, seriesIndex).reduce((sum, candidate) => {
      const part = candidate.data[dataIndex] ?? 0
      const leftFields = config.butterflyLeftFields?.length ? config.butterflyLeftFields : config.yFields.slice(0, 1)
      const sameSide = config.kind === 'butterfly' ? leftFields.includes(candidate.name) === leftFields.includes(series.name) : Math.sign(part) === Math.sign(value)
      return sameSide ? sum + part : sum
    }, 0) : 0
    const plottedValue = isStackedChart(config.kind) ? previousValue + value : value
    const axisIndex = config.kind === 'butterfly' && !(config.butterflyLeftFields?.length ? config.butterflyLeftFields : config.yFields.slice(0, 1)).includes(series.name) ? 1 : 0
    let categoryPixel: number, valuePixel: number
    try {
      categoryPixel = Number(instance.convertToPixel(horizontal ? { yAxisIndex: axisIndex } : { xAxisIndex: 0 }, dataIndex))
      valuePixel = Number(instance.convertToPixel(horizontal ? { xAxisIndex: axisIndex } : { yAxisIndex: 0 }, plottedValue))
      if (isStackedBarChart(config.kind)) baseline = Number(instance.convertToPixel(horizontal ? { xAxisIndex: axisIndex } : { yAxisIndex: 0 }, previousValue))
    } catch { return [] }
    if (!Number.isFinite(categoryPixel) || !Number.isFinite(valuePixel)) return []
    if (absorption) categoryPixel += barSeriesGeometry(band, config, prepared.series.length, seriesIndex, isStackedBarChart(config.kind)).offset
    const width = Math.max(18, measureTextWidth(label, style.size, style.fontFamily, style.weight) + 10)
    const height = Math.max(14, Math.round(style.size * style.lineHeight / 100) + 6)
    const { x, y } = valueLabelBoxPlacement({
      horizontal, configured, absorption, baseline, value: valuePixel, category: categoryPixel, width, height,
      padding: config.barValueLabelAbsorptionPadding ?? 10,
      insidePosition: config.barValueLabelInsidePosition ?? 'end',
      outsidePosition: config.barValueLabelOutsidePosition ?? 'end',
    })
    return [{ id: `value-label-hit-${seriesIndex}-${dataIndex}`, type: 'rect', z: 130, cursor: 'pointer', shape: { x, y, width, height }, style: { fill: 'rgba(0,0,0,0)' }, onclick: () => {
      if (!allSelected) { onFocus?.('values'); return }
      onSelect?.({ key, seriesName: series.name, category: category instanceof Date ? formatTimeValue(category, table.timeProfiles?.[config.xField], config.dateLabelFormat) : String(category ?? ''), value: formatChartNumber(value, config), color: override?.color ?? getSeriesColor(config, series.name, seriesIndex), target: 'value-label' })
      onFocus?.('element')
    } }]
  }))
}
// oxlint-disable-next-line react/only-export-components -- exported for date-layout regression tests
export function butterflyCategoryLayout(table: DataTable, config: ChartConfig) {
  const prepared = prepareVisibleChartData(table, config)
  const style = config.xAxisLabelText ?? config.axisLabelText
  const plannedLabels = planCategoryDateLabels(prepared.categories, table, config)
  const labels = prepared.categories.map((category, index) => {
    const key = category instanceof Date ? category.toISOString() : `${index}:${String(category ?? '')}`
    const label = config.categoryLabelOverrides?.y?.[key] ?? plannedLabels[index] ?? ''
    return { category, key, label }
  })
  const naturalGap = Math.max(60, ...labels.map(({ label }) => Math.max(...label.split('\n').map((line) => measureTextWidth(line, style.size, style.fontFamily, style.weight))) + 44))
  const maximumGap = Math.max(60, (config.canvasWidth ?? 1000) * .34)
  const gap = Math.min(naturalGap, maximumGap)
  return { prepared, style, labels, gap, wrapped: naturalGap > maximumGap }
}
function splitCenteredButterflyAxes(option: Record<string, unknown>, table: DataTable, config: ChartConfig) {
  if (config.kind !== 'butterfly' || (config.butterflyCategoryPosition ?? 'center') !== 'center' || Array.isArray(option.grid)) return
  const grid = option.grid as { left?: number; right?: number; top?: number; bottom?: number; containLabel?: boolean } | undefined
  const xAxis = option.xAxis as Record<string, unknown> | undefined
  const yAxis = option.yAxis as Record<string, unknown> | undefined
  if (!grid || !xAxis || !yAxis) return
  const canvasWidth = config.canvasWidth ?? 1000
  const valueLabelStyle = config.yAxisLabelText ?? config.axisLabelText
  const axisFormatter = (xAxis.axisLabel as { formatter?: (value: number) => string } | undefined)?.formatter
  const extent = Math.max(Math.abs(Number(xAxis.min) || 0), Math.abs(Number(xAxis.max) || 0), 1)
  const extentLabel = (direction: -1 | 1) => {
    const value = direction * extent
    return axisFormatter ? String(axisFormatter(value)) : String(Math.abs(value))
  }
  const edgeLabelHalf = (direction: -1 | 1) => (config.showYAxisLabels ?? true)
    ? Math.ceil(measureTextWidth(extentLabel(direction), valueLabelStyle.size, valueLabelStyle.fontFamily, valueLabelStyle.weight) / 2)
    : 0
  const left = Number(grid.left ?? 0) + edgeLabelHalf(-1), right = Number(grid.right ?? 0) + edgeLabelHalf(1)
  const gap = butterflyCategoryLayout(table, config).gap
  const half = Math.max(1, (canvasWidth - left - right - gap) / 2)
  const rightGridLeft = left + half + gap
  const leftNames = new Set(config.butterflyLeftFields?.length ? config.butterflyLeftFields : config.yFields.slice(0, 1))
  option.grid = [
    { ...grid, left, right: canvasWidth - left - half },
    { ...grid, left: rightGridLeft, right },
  ]
  option.xAxis = [
    { ...xAxis, gridIndex: 0, min: 0, max: extent, inverse: true },
    { ...xAxis, gridIndex: 1, min: 0, max: extent },
  ]
  option.yAxis = [
    { ...yAxis, gridIndex: 0, position: 'right', axisLabel: { ...(yAxis.axisLabel as object), show: false }, axisLine: { ...(yAxis.axisLine as object), onZero: true } },
    { ...yAxis, gridIndex: 1, position: 'left', axisLabel: { ...(yAxis.axisLabel as object), show: false }, axisLine: { ...(yAxis.axisLine as object), onZero: true } },
  ]
  const stackedBars: Array<{ sourceName: string; axisIndex: number; values: Array<number | null> }> = []
  ;(option.series as Array<Record<string, unknown>> | undefined)?.forEach((series) => {
    const firstPoint = (series.data as Array<{ sourceSeriesName?: string }> | undefined)?.[0]
    const sourceName = String(series.segmentOf ?? firstPoint?.sourceSeriesName ?? series.name ?? '').replace(/^__bar-value-labels:/, '')
    const axisIndex = leftNames.has(sourceName) ? 0 : 1
    series.xAxisIndex = axisIndex
    series.yAxisIndex = axisIndex
    if (series.type === 'bar') {
      const points = (series.data as Array<Record<string, unknown> | null> | undefined) ?? []
      const values = points.map((point) => typeof point?.value === 'number' ? point.value : null)
      const previous = values.map((_value, index) => stackedBars.filter((item) => item.axisIndex === axisIndex).reduce((sum, item) => sum + (item.values[index] ?? 0), 0))
      const seriesStyle = series.itemStyle as Record<string, unknown> | undefined
      const seriesLabel = series.label as Record<string, unknown> | undefined
      series.type = 'custom'
      series.coordinateSystem = 'cartesian2d'
      series.stack = undefined
      series.renderItem = (params: { dataIndex: number }, api: { value(index: number): number; coord(value: [number, number]): [number, number]; size(value: [number, number]): [number, number] }) => {
        const index = params.dataIndex, value = api.value(1)
        if (!Number.isFinite(value)) return null
        const start = api.coord([previous[index], index]), end = api.coord([previous[index] + value, index])
        const band = Math.abs(api.size([0, 1])[1])
        const height = Math.max(1, band * Math.max(.1, Math.min(1, (config.barWidth ?? 68) / 100)))
        const point = points[index] ?? {}, itemStyle = point.itemStyle as Record<string, unknown> | undefined
        const rect = {
          type: 'rect',
          shape: { x: Math.min(start[0], end[0]), y: end[1] - height / 2, width: Math.max(0, Math.abs(end[0] - start[0])), height, r: config.barBorderRadius ?? 0 },
          style: { fill: itemStyle?.color ?? seriesStyle?.color, opacity: itemStyle?.opacity ?? seriesStyle?.opacity ?? 1, stroke: itemStyle?.borderColor ?? seriesStyle?.borderColor, lineWidth: itemStyle?.borderWidth ?? seriesStyle?.borderWidth ?? 0 },
        }
        const label = (point.label as Record<string, unknown> | undefined) ?? seriesLabel
        if (!label?.show) return rect
        const formatter = label.formatter
        const text = typeof formatter === 'function' ? String(formatter({ value: [index, value], dataIndex: index })) : typeof formatter === 'string' ? formatter : String(point.displayValue ?? value)
        const position = String(label.position ?? (axisIndex === 0 ? 'left' : 'right')), distance = Number(label.distance ?? 5)
        const inside = position.startsWith('inside')
        const x = position === 'left' || position === 'insideLeft' ? Math.min(start[0], end[0]) + (inside ? distance : -distance)
          : position === 'right' || position === 'insideRight' ? Math.max(start[0], end[0]) + (inside ? -distance : distance)
          : (start[0] + end[0]) / 2
        const align = position === 'left' ? 'right' : position === 'right' ? 'left' : position === 'insideLeft' ? 'left' : position === 'insideRight' ? 'right' : 'center'
        return { type: 'group', children: [rect, { type: 'text', style: { x, y: end[1], text, fill: label.color, fontFamily: label.fontFamily, fontSize: label.fontSize, fontWeight: label.fontWeight, fontStyle: label.fontStyle, lineHeight: label.lineHeight, align, verticalAlign: 'middle' } }] }
      }
      series.data = points.map((point, index) => ({ ...point, value: [index, values[index]] }))
      stackedBars.push({ sourceName, axisIndex, values })
    }
  })
}
function butterflyCategoryGraphics(instance: echarts.ECharts, table: DataTable, config: ChartConfig, selectedSettingsSection?: ChartSettingsSection | null, onSelect?: (selection: ChartElementSelection) => void, onFocus?: (section: ChartSettingsSection) => void, selectedCategory?: string | null, clean = false) {
  if (config.kind !== 'butterfly' || config.showXAxisLabels === false || (config.butterflyCategoryPosition ?? 'center') !== 'center') return []
  const { prepared, style, labels, gap, wrapped } = butterflyCategoryLayout(table, config)
  let leftZero: unknown, rightZero: unknown
  try {
    leftZero = instance.convertToPixel({ xAxisIndex: 0 }, 0)
    rightZero = instance.convertToPixel({ xAxisIndex: 1 }, 0)
  } catch { return [] }
  if (typeof leftZero !== 'number' || typeof rightZero !== 'number' || !Number.isFinite(leftZero) || !Number.isFinite(rightZero)) return []
  const centerX = (leftZero + rightZero) / 2
  const points = prepared.categories.map((_, index) => {
    let y: unknown
    try { y = instance.convertToPixel({ yAxisIndex: 0 }, index) } catch { return null }
    return typeof y === 'number' && Number.isFinite(y) ? [centerX, y] as [number, number] : null
  })
  const validPoints = points.filter((point): point is [number, number] => Boolean(point))
  if (!validPoints.length) return []
  const band = validPoints.length > 1 ? Math.min(...validPoints.slice(1).map((point, index) => Math.abs(point[1] - validPoints[index][1]))) : instance.getHeight() / Math.max(1, prepared.categories.length)
  const top = Math.min(...validPoints.map((point) => point[1])) - band / 2
  const bottom = Math.max(...validPoints.map((point) => point[1])) + band / 2
  return [{
    id: 'butterfly-category-column',
    type: 'rect',
    z: 114,
    silent: true,
    shape: { x: centerX - gap / 2, y: top, width: gap, height: bottom - top },
    style: { fill: config.canvasBackground ?? '#ffffff' },
  }, ...labels.flatMap(({ key, label }, index) => {
    const point = points[index]
    if (!point) return []
    return [{
      id: `butterfly-category-${index}`,
      type: 'text',
      z: 120,
      silent: clean,
      cursor: clean ? undefined : 'pointer',
      style: {
        x: point[0],
        y: point[1],
        text: label,
        fill: style.color,
        fontFamily: style.fontFamily,
        fontSize: style.size,
        fontWeight: style.weight,
        fontStyle: style.italic ? 'italic' : 'normal',
        lineHeight: Math.round(style.size * style.lineHeight / 100),
        ...(wrapped ? { width: gap - 16, overflow: 'break' } : {}),
        align: 'center',
        verticalAlign: 'middle',
        backgroundColor: config.canvasBackground ?? '#ffffff',
        padding: [2, 7],
        opacity: !clean && selectedCategory === key ? 0 : 1,
      },
      onclick: clean ? undefined : () => {
        if (selectedSettingsSection !== 'y-axis-labels') { onFocus?.('y-axis-labels'); return }
        onSelect?.({ key: `category-label:y:${key}`, seriesName: '', category: key, value: label, target: 'category-label', axis: 'y' })
      },
    }]
  })]
}
function butterflyBarHitGraphics(instance: echarts.ECharts, table: DataTable, config: ChartConfig, selectedSeriesName?: string | null, onSeriesSelect?: (selection: ChartSeriesSelection) => void, onSelect?: (selection: ChartElementSelection) => void, onFocus?: (section: ChartSettingsSection) => void) {
  if (config.kind !== 'butterfly') return []
  const prepared = prepareButterflyChartData(table, config)
  const leftFields = new Set(config.butterflyLeftFields?.length ? config.butterflyLeftFields : config.yFields.slice(0, 1))
  const categoryPixels = prepared.categories.map((_, index) => Number(instance.convertToPixel({ yAxisIndex: 0 }, index)))
  const band = categoryPixels.length > 1 ? Math.min(...categoryPixels.slice(1).map((pixel, index) => Math.abs(pixel - categoryPixels[index]))) : instance.getHeight() / Math.max(1, prepared.categories.length)
  const height = Math.max(1, band * Math.max(.1, Math.min(1, (config.barWidth ?? 68) / 100)))
  return prepared.series.flatMap((series, seriesIndex) => series.data.flatMap((value, dataIndex) => {
    if (value == null) return []
    const category = prepared.categories[dataIndex]
    const axisIndex = leftFields.has(series.name) ? 0 : 1
    const previous = prepared.series.slice(0, seriesIndex).reduce((sum, candidate) => {
      const candidateValue = candidate.data[dataIndex] ?? 0
      return leftFields.has(candidate.name) === leftFields.has(series.name) ? sum + candidateValue : sum
    }, 0)
    const start = Number(instance.convertToPixel({ xAxisIndex: axisIndex }, previous))
    const end = Number(instance.convertToPixel({ xAxisIndex: axisIndex }, previous + value))
    const zero = Number(instance.convertToPixel({ xAxisIndex: axisIndex }, 0))
    const y = Number(instance.convertToPixel({ yAxisIndex: axisIndex }, dataIndex))
    if (![start, end, zero, y].every(Number.isFinite)) return []
    const visibleStart = start
    const visibleEnd = end
    const key = `${series.name}\u001f${category instanceof Date ? category.toISOString() : `${typeof category}:${String(category)}`}`
    const displayCategory = category instanceof Date ? formatTimeValue(category, table.timeProfiles?.[config.xField], config.dateLabelFormat) : String(category ?? '')
    return [{
      id: `butterfly-hit-${seriesIndex}-${dataIndex}`,
      type: 'rect',
      z: 115,
      cursor: 'pointer',
      shape: { x: Math.min(visibleStart, visibleEnd), y: y - height / 2, width: Math.max(1, Math.abs(visibleEnd - visibleStart)), height },
      style: { fill: 'rgba(0,0,0,0)' },
      onclick: () => {
        if (selectedSeriesName !== series.name) {
          onSeriesSelect?.({ name: series.name, color: getSeriesColor(config, series.name, seriesIndex) })
          onFocus?.('series')
          return
        }
        onSelect?.({ key, seriesName: series.name, category: displayCategory, value: formatChartNumber(Math.abs(value), config) })
        onFocus?.('element')
      },
    }]
  }))
}
function cloneChartOption<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => cloneChartOption(item)) as T
  if (value instanceof Date) return new Date(value.getTime()) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneChartOption(item)])) as T
  }
  return value
}
// oxlint-disable-next-line react/only-export-components -- exported for a renderer regression test
export function suppressBuiltInDirectLabels(option: Record<string, unknown>, config: ChartConfig) {
  if (!config.showDirectLabels) return
  const series = option.series as Array<{ endLabel?: { show?: boolean }; labelLine?: { show?: boolean }; data?: Array<(Record<string, unknown> & { valueLabel?: Record<string, unknown> }) | null> }> | undefined
  series?.forEach((item) => {
    if (item.endLabel) item.endLabel.show = false
    if (item.labelLine) item.labelLine.show = false
    item.data?.forEach((point) => {
      if (!point?.directLegendLabel) return
      if (config.barValueLabelAbsorption && isBarChart(config.kind) && config.kind !== 'lollipop' && config.kind !== 'horizontal-lollipop') {
        point.label = { show: false }
        return
      }
      point.label = point.valueLabel ?? { show: false }
      if (point.labelLine) point.labelLine = { ...(point.labelLine as object), show: false }
    })
  })
}

interface HeatmapModelSource { getModel(): { getComponent(type: string, index: number): unknown } }
export function heatmapPlotBounds(instance: HeatmapModelSource, config: ChartConfig): PlotBounds | null {
  if (config.kind !== 'heatmap') return null
  try {
    const component = instance.getModel().getComponent('grid', 0) as unknown as { coordinateSystem?: { getRect(): { x: number; y: number; width: number; height: number } } }
    const rect = component.coordinateSystem?.getRect()
    if (!rect || ![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) return null
    return { left: rect.x, right: rect.x + rect.width, top: rect.y, bottom: rect.y + rect.height }
  } catch { return null }
}

function chartPlotBounds(instance: echarts.ECharts, table: DataTable, config: ChartConfig): PlotBounds | null {
  const heatmapBounds = heatmapPlotBounds(instance as unknown as HeatmapModelSource, config)
  if (heatmapBounds) return heatmapBounds
  const option = instance.getOption() as unknown as { xAxis?: Array<{ min?: number; max?: number }>; yAxis?: Array<{ min?: number; max?: number }>; grid?: Array<{ left?: number; right?: number; top?: number; bottom?: number }> }
  if (isHorizontalBar(config)) {
    const firstGrid = option.grid?.[0], lastGrid = config.kind === 'butterfly' && option.grid?.[1] ? option.grid[1] : firstGrid
    const left = Number(firstGrid?.left), right = Number(lastGrid?.right), top = Number(firstGrid?.top), bottom = Number(firstGrid?.bottom)
    if ([left, right, top, bottom].every(Number.isFinite)) return { left, right: instance.getWidth() - right, top, bottom: instance.getHeight() - bottom }
  }
  const min = Number(option.yAxis?.[0]?.min), max = Number(option.yAxis?.[0]?.max)
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null
  try {
    const first = instance.convertToPixel({ yAxisIndex: 0 }, min), second = instance.convertToPixel({ yAxisIndex: 0 }, max)
    if (typeof first !== 'number' || typeof second !== 'number' || !Number.isFinite(first) || !Number.isFinite(second)) return null
    let left: number | undefined, right: number | undefined
    if (config.kind === 'scatter' || config.kind === 'bubble') {
      const xMin = Number(option.xAxis?.[0]?.min), xMax = Number(option.xAxis?.[0]?.max)
      if (Number.isFinite(xMin) && Number.isFinite(xMax)) {
        const firstX = instance.convertToPixel({ xAxisIndex: 0 }, xMin), secondX = instance.convertToPixel({ xAxisIndex: 0 }, xMax)
        if (typeof firstX === 'number' && typeof secondX === 'number' && Number.isFinite(firstX) && Number.isFinite(secondX)) { left = Math.min(firstX, secondX); right = Math.max(firstX, secondX) }
      }
    } else {
      const count = prepareVisibleChartData(table, config).categories.length
      if (count > 1) {
        const firstX = Number(instance.convertToPixel({ xAxisIndex: 0 }, 0)), lastX = Number(instance.convertToPixel({ xAxisIndex: 0 }, count - 1))
        if (Number.isFinite(firstX) && Number.isFinite(lastX)) {
          const step = count > 1 ? Math.abs(lastX - firstX) / (count - 1) : 0
          const padding = isBarChart(config.kind) ? step / 2 : 0
          left = Math.min(firstX, lastX) - padding; right = Math.max(firstX, lastX) + padding
        }
      }
    }
    if (left == null || right == null) {
      const grid = option.grid?.[0], fallbackLeft = Number(grid?.left), fallbackRight = Number(grid?.right)
      left = Number.isFinite(fallbackLeft) ? fallbackLeft : 32
      right = instance.getWidth() - (Number.isFinite(fallbackRight) ? fallbackRight : 30)
    }
    return { top: Math.min(first, second), bottom: Math.max(first, second), left: Math.max(0, Math.min(instance.getWidth(), left)), right: Math.max(0, Math.min(instance.getWidth(), right)) }
  } catch { return null }
}
// oxlint-disable-next-line react/only-export-components -- exported for grid alignment regression tests
export function barVerticalGridGraphics(instance: echarts.ECharts, table: DataTable, config: ChartConfig, bounds: PlotBounds | null) {
  if (!isBarChart(config.kind) || isHorizontalBar(config) || !config.showVerticalGrid || !bounds) return []
  const prepared = prepareVisibleChartData(table, config)
  const option = instance.getOption() as unknown as { xAxis?: Array<{ axisTick?: { interval?: 'auto' | number | ((index: number, value?: string) => boolean) } }> }
  const interval = option.xAxis?.[0]?.axisTick?.interval ?? 0
  const visible = (index: number) => typeof interval === 'function' ? interval(index) : typeof interval === 'number' ? index % (interval + 1) === 0 : true
  return prepared.categories.flatMap((_, index) => {
    if (!visible(index)) return []
    let x: unknown
    try { x = instance.convertToPixel({ xAxisIndex: 0 }, index) } catch { return [] }
    if (typeof x !== 'number' || !Number.isFinite(x)) return []
    return [{ id: `bar-vertical-grid-${index}`, type: 'line', z: 1, silent: true, shape: { x1: x, y1: bounds.top, x2: x, y2: bounds.bottom }, style: { stroke: config.gridColor, lineWidth: config.gridWidth, lineDash: config.gridType === 'dashed' ? [6, 4] : config.gridType === 'dotted' ? [2, 3] : undefined } }]
  })
}
function applyStyleOpacity(style: Record<string, unknown> | undefined, opacity: number) {
  if (!style) return undefined
  const current = typeof style?.opacity === 'number' ? style.opacity : 1
  return { ...style, opacity: Math.max(0, Math.min(1, current * opacity)) }
}
function applyPointOpacity(style: Record<string, unknown> | undefined, opacity: number, fallbackColor?: string) {
  return applyStyleOpacity(style, opacity) ?? (fallbackColor ? { color: fallbackColor, opacity } : undefined)
}
export function materializeTreemapHyphens(root: ParentNode | null) {
  // Treemap labels carry an explicit local x-coordinate. Keeping the repair
  // inside that set prevents title, subtitle and credit lines from being
  // mistaken for fragments of one hyphenated word.
  const nodes = [...(root?.querySelectorAll('text[x]') ?? [])]
  nodes.forEach((node) => {
    const value = node.textContent ?? ''
    const breaksHere = /\u00ad\ufeff$/.test(value)
    if (/[\u00ad\ufeff]/.test(value)) node.textContent = value.replaceAll(/[\u00ad\ufeff]/g, '') + (breaksHere ? '‐' : '')
  })
  const endWord = /[А-ЯЁа-яё]+$/u, startWord = /^[А-ЯЁа-яё]+/u
  for (let index = 0; index < nodes.length - 1; index += 1) {
    const first = nodes[index], firstPart = first.textContent?.match(endWord)?.[0]
    if (!firstPart) continue
    const chain = [first]
    const parts = [firstPart]
    let cursor = index
    while (cursor + 1 < nodes.length && nodes[cursor].nextElementSibling === nodes[cursor + 1]) {
      const next = nodes[cursor + 1], part = next.textContent?.match(startWord)?.[0]
      if (!part) break
      chain.push(next)
      parts.push(part)
      cursor += 1
      if (part.length !== (next.textContent ?? '').length) break
    }
    if (chain.length < 2) continue
    const word = parts.join('')
    const segments = hyphenateTreemapText(word, '\u0001').split('\u0001')
    if (segments.length < chain.length) continue
    const legalBreaks = segments.slice(0, -1).reduce<number[]>((positions, segment) => [...positions, (positions.at(-1) ?? 0) + segment.length], [])
    const desiredBreaks = parts.slice(0, -1).reduce<number[]>((positions, part) => [...positions, (positions.at(-1) ?? 0) + part.length], [])
    const chosen: number[] = []
    for (const desired of desiredBreaks) {
      const afterPrevious = legalBreaks.filter((position) => position > (chosen.at(-1) ?? 0))
      const safe = afterPrevious.filter((position) => position <= desired).at(-1) ?? afterPrevious[0]
      if (safe == null) break
      chosen.push(safe)
    }
    if (chosen.length !== chain.length - 1) continue
    const chunks = chosen.reduce<string[]>((result, position, chunkIndex) => [...result, word.slice(chunkIndex ? chosen[chunkIndex - 1] : 0, position)], [])
    chunks.push(word.slice(chosen.at(-1)))
    chain.forEach((node, chainIndex) => {
      const text = node.textContent ?? ''
      node.textContent = chainIndex === 0
        ? `${text.slice(0, -parts[0].length)}${chunks[0]}‐`
        : chainIndex === chain.length - 1
          ? `${chunks[chainIndex]}${text.slice(parts[chainIndex].length)}`
          : `${chunks[chainIndex]}‐`
    })
    index = cursor
  }
}
export function wrapTreemapLabelText(value: string, width: number, size: number, fontFamily: string, weight: number) {
  const measure = (text: string) => measureTextWidth(text, size, fontFamily, weight)
  const lines: string[] = []
  const pushWord = (word: string) => {
    const syllables = hyphenateTreemapText(word, '\u0001').split('\u0001')
    if (syllables.length < 2) {
      let fragment = ''
      for (const character of word) {
        if (fragment && measure(`${fragment}${character}‐`) > width) { lines.push(`${fragment}‐`); fragment = character }
        else fragment += character
      }
      return fragment
    }
    let fragment = ''
    syllables.forEach((syllable, index) => {
      const candidate = `${fragment}${syllable}`
      if (fragment && measure(`${candidate}‐`) > width) { lines.push(`${fragment}‐`); fragment = syllable }
      else fragment = candidate
      if (index === syllables.length - 1) return
    })
    return fragment
  }
  const paragraphs = value.split('\n')
  paragraphs.forEach((paragraph, paragraphIndex) => {
    let line = ''
    paragraph.trim().split(/\s+/).filter(Boolean).forEach((word) => {
      const candidate = line ? `${line} ${word}` : word
      if (measure(candidate) <= width) { line = candidate; return }
      if (line) { lines.push(`${line}\u200b`); line = '' }
      if (measure(word) <= width) line = word
      else line = pushWord(word) ?? ''
    })
    if (line) lines.push(`${line}${paragraphIndex < paragraphs.length - 1 ? '\u200b' : ''}`)
  })
  return lines
}
interface TreemapLabelFitSource {
  text: string
  renderedText: string
  fontSize: number
  lineHeight: number
}
const treemapLabelFitSources = new WeakMap<object, TreemapLabelFitSource>()

export function fitTreemapLabelBoxes(instance: echarts.ECharts) {
  type Rect = { x: number; y: number; width: number; height: number }
  type TextHost = {
    zlevel?: number
    getBoundingRect(): { width: number; height: number }
    getPaintRect(): Rect
    getTextContent?(): {
      style?: { text?: unknown; padding?: number | number[]; fontSize?: number; fontFamily?: string; fontWeight?: number; lineHeight?: number; verticalAlign?: string }
      setStyle(style: Record<string, unknown>): void
      markRedraw(): void
      getBoundingRect(): unknown
    } | null
  }
  const displayList = (instance.getZr().storage as unknown as { getDisplayList(update?: boolean): TextHost[] }).getDisplayList(true)
  const entries = displayList.flatMap((host) => {
    const label = host.getTextContent?.(), style = label?.style, text = style?.text
    return label && style && typeof text === 'string' && text ? [{ host, label, style, text, rect: host.getBoundingRect(), paint: host.getPaintRect() }] : []
  }).filter(({ rect }) => rect.width > 0 && rect.height > 0)
  const fit = (entry: typeof entries[number], reservedHeight = 0) => {
    const { label, rect, style, text: currentText } = entry
    let source = treemapLabelFitSources.get(label)
    if (!source || currentText !== source.renderedText) {
      const fontSize = Number(style.fontSize ?? 12)
      source = {
        text: currentText,
        renderedText: currentText,
        fontSize,
        lineHeight: Number(style.lineHeight ?? fontSize * 1.2),
      }
      treemapLabelFitSources.set(label, source)
    }
    const padding = style.padding
    const horizontal = typeof padding === 'number' ? padding * 2 : Array.isArray(padding) ? Number(padding[1] ?? 0) + Number(padding[3] ?? padding[1] ?? 0) : 0
    const vertical = typeof padding === 'number' ? padding * 2 : Array.isArray(padding) ? Number(padding[0] ?? 0) + Number(padding[2] ?? padding[0] ?? 0) : 0
    const width = Math.max(1, rect.width - horizontal), height = Math.max(1, rect.height - vertical - reservedHeight)
    const originalSize = source.fontSize, originalLineHeight = source.lineHeight
    const fontFamily = style.fontFamily ?? 'Arial, sans-serif', fontWeight = Number(style.fontWeight ?? 400)
    let fontSize = originalSize, lines = wrapTreemapLabelText(source.text, width, fontSize, fontFamily, fontWeight)
    while (fontSize > 5 && lines.length * originalLineHeight * fontSize / originalSize > height) {
      fontSize -= 1
      lines = wrapTreemapLabelText(source.text, width, fontSize, fontFamily, fontWeight)
    }
    const lineHeight = Math.max(6, Math.round(originalLineHeight * fontSize / originalSize))
    source.renderedText = lines.join('\n')
    label.setStyle({ width, height: Math.max(1, rect.height - vertical), text: source.renderedText, overflow: undefined, ellipsis: undefined, fontSize, lineHeight })
    label.getBoundingRect()
    label.markRedraw()
    return lines.length * lineHeight + vertical
  }
  const groups = entries.filter(({ host }) => (host.zlevel ?? 0) > 0).map((entry) => ({ ...entry, labelHeight: fit(entry) }))
  entries.filter(({ host }) => (host.zlevel ?? 0) === 0).forEach((entry) => {
    const group = groups.find(({ paint }) =>
      entry.paint.x >= paint.x - 1 && entry.paint.y >= paint.y - 1
      && entry.paint.x + entry.paint.width <= paint.x + paint.width + 1
      && entry.paint.y + entry.paint.height <= paint.y + paint.height + 1)
    if (!group) { fit(entry); return }
    const position = group.style.verticalAlign ?? 'top'
    const touchesLabelBand = position === 'bottom'
      ? entry.paint.y + entry.paint.height >= group.paint.y + group.paint.height - group.labelHeight - 1
      : position === 'middle'
        ? entry.paint.y < group.paint.y + (group.paint.height + group.labelHeight) / 2 && entry.paint.y + entry.paint.height > group.paint.y + (group.paint.height - group.labelHeight) / 2
        : entry.paint.y <= group.paint.y + group.labelHeight + 1
    fit(entry, touchesLabelBand ? group.labelHeight : 0)
  })
}
function applyTreemapLayout(instance: echarts.ECharts, root: ParentNode | null, selectedElementKey?: string | null) {
  fitTreemapLabelBoxes(instance)
  outlineSelectedTreemapGroup(instance, selectedElementKey)
  instance.getZr().refreshImmediately()
  materializeTreemapHyphens(root)
}
export function outlineSelectedTreemapGroup(instance: echarts.ECharts, selectedElementKey?: string | null) {
  type TreemapSeries = { name?: string }
  type TreemapModelSource = { getModel(): { getSeriesByIndex(index: number): { getData(): { getName(index: number): string } } | undefined } }
  type Displayable = {
    type?: string
    setStyle?(style: Record<string, unknown>): void
    markRedraw?(): void
  }
  const series = ((instance.getOption() as unknown as { series?: TreemapSeries[] }).series ?? [])
  const seriesIndex = series.findIndex((item) => item.name === '__treemap-groups')
  if (seriesIndex < 0) return
  const selectedName = selectedElementKey?.startsWith('treemap-group:') ? selectedElementKey.slice('treemap-group:'.length) : null
  const data = (instance as unknown as TreemapModelSource).getModel().getSeriesByIndex(seriesIndex)?.getData()
  const displayList = (instance.getZr().storage as unknown as { getDisplayList(update?: boolean): Displayable[] }).getDisplayList(true)
  displayList.forEach((host) => {
    const ecData = echarts.helper.getECData(host as never)
    if (host.type !== 'rect' || ecData.seriesIndex !== seriesIndex || typeof ecData.dataIndex !== 'number') return
    const selected = Boolean(selectedName && data?.getName(ecData.dataIndex) === selectedName)
    host.setStyle?.({
      fill: 'rgba(0,0,0,0)',
      stroke: selected ? '#6956e8' : 'rgba(0,0,0,0)',
      lineWidth: selected ? 3 : 0,
    })
    host.markRedraw?.()
  })
}
// oxlint-disable-next-line react/only-export-components -- exported for selection rendering regression tests
export function applySeriesVisualState(option: Record<string, unknown>, table: DataTable, config: ChartConfig, selectedSeriesName?: string | null, selectedElementKey?: string | null, hoveredSeriesName?: string | null) {
  const selectedElementSeriesName = selectedElementKey?.startsWith('treemap-group:') ? selectedElementKey.slice('treemap-group:'.length) : selectedElementKey?.split('\u001f')[0]
  const activeSeriesName = hoveredSeriesName ?? selectedSeriesName ?? selectedElementSeriesName ?? null
  const series = option.series as Array<{ name?: string; segmentOf?: string; customBarOf?: string; type?: string; silent?: boolean; z?: number; itemStyle?: Record<string, unknown>; lineStyle?: Record<string, unknown>; areaStyle?: Record<string, unknown>; emphasis?: Record<string, unknown>; blur?: Record<string, unknown>; data?: Array<Record<string, unknown> | null> }> | undefined
  if (config.kind === 'treemap') {
    const groupSelected = selectedElementKey?.startsWith('treemap-group:')
    if (groupSelected) return
    const visit = (points: Array<Record<string, unknown> | null>) => points.forEach((point) => {
      if (!point) return
      const selected = point.elementKey === selectedElementKey
      if (selected) {
        point.itemStyle = {
          ...point.itemStyle as object,
          borderColor: '#6956e8',
          borderWidth: Math.max(3, Number((point.itemStyle as { borderWidth?: number } | undefined)?.borderWidth ?? 0)),
        }
      }
      visit((point.children as Array<Record<string, unknown> | null> | undefined) ?? [])
    })
    series?.forEach((item) => visit(item.data ?? []))
    return
  }
  const seriesOrder = prepareVisibleChartData(table, config).series.map((item) => item.name)
  series?.forEach((item) => {
    if (item.emphasis) delete item.emphasis.focus
    delete item.blur
    const rawName = item.name ?? ''
    if (rawName.startsWith('__') && !rawName.startsWith('__hit__:')) return
    // Distribution dots deliberately keep the quiet Beeswarm appearance even
    // while their settings row or series is selected.
    if (isDistributionChart(config.kind)) return
    const name = item.name?.startsWith('__hit__:') ? item.name.slice(8) : item.segmentOf ?? item.customBarOf ?? item.name
    if (!name || (item.silent && !item.segmentOf && !item.customBarOf)) return
    const selectedElementSeries = selectedElementKey?.startsWith(`${name}\u001f`)
    const active = activeSeriesName === name
    const dimSeries = Boolean(activeSeriesName && !active)
    if (item.name?.startsWith('__hit__:')) return
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
      if (item.type === 'scatter') item.itemStyle = { ...item.itemStyle, opacity: 1, shadowColor: 'rgba(32,32,39,.18)', shadowBlur: 4 }
    }
    item.data?.forEach((point) => {
      if (!point || typeof point !== 'object') return
      const pointSelected = point.elementKey === selectedElementKey
      const pointDim = dimSeries || Boolean(selectedElementSeries && selectedElementKey && !pointSelected)
      const fallbackPointColor = item.type === 'bar' || item.type === 'scatter' ? seriesColor : undefined
      if (pointDim || pointSelected) point.itemStyle = applyPointOpacity(point.itemStyle as Record<string, unknown> | undefined, pointSelected ? 1 : dimSeries ? .22 : peerOpacity, fallbackPointColor)
      if (pointSelected) {
        const pointStyle = point.itemStyle as Record<string, unknown> | undefined
        const barLike = item.type === 'bar' || config.kind === 'waterfall'
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
}
export const ChartCanvas = forwardRef<ChartCanvasHandle, Props>(
  ({ table, config, onSelect, onTreemapMove, onSeriesSelect, onSettingsFocus, onClearSettingsFocus, selectedSettingsSection, selectedSeriesName, selectedElementKey, selectedElementTarget, selectedCategoryLabel: requestedCategoryLabel, onAnnotationSelect, onAnnotationChange, onAnnotationDuplicate, onAnnotationDelete, selectedAnnotationId, selectedDecorationId, onDecorationSelect, onDecorationChange, onRichTextChange, onCategoryLabelChange, onTextStyleChange, viewZoom = 1 }, ref) => {
    const container = useRef<HTMLDivElement>(null)
    const viewport = useRef<HTMLDivElement>(null)
    const [canvasScale, setCanvasScale] = useState(1)
    const [renderError, setRenderError] = useState('')
    const [readyKind, setReadyKind] = useState<ChartKind | null>(null)
    const [renderedChartKind, setRenderedChartKind] = useState<ChartKind | null>(null)
    const [plotBounds, setPlotBounds] = useState<PlotBounds | null>(null)
    const [richLayouts, setRichLayouts] = useState<Partial<Record<'title' | 'subtitle' | 'note' | 'source', RichLayout>>>({})
    const [categoryLabelLayout, setCategoryLabelLayout] = useState<CategoryLabelLayout | null>(null)
    const [, setTreemapLayoutRevision] = useState(0)
    const chart = useRef<echarts.ECharts | null>(null)
    const displayOption = useRef<Record<string, unknown> | null>(null)
    const exportOption = useRef<Record<string, unknown> | null>(null)
    const renderedKind = useRef<ChartKind | null>(null)
    const treemapLayout = useRef<{ table: DataTable; config: ChartConfig } | null>(null)
    const treemapLayoutToken = useRef(0)
    const clickedSeries = useRef<string | null>(null)
    const treemapDrag = useRef<{ source: ChartElementSelection; click: ChartElementSelection; start: [number, number]; moved: boolean; target?: ChartElementSelection; placement?: 'before' | 'after'; signature?: string } | null>(null)
    const suppressTreemapClick = useRef(false)
    const treemapDragPreview = useRef<HTMLDivElement | null>(null)
    const treemapDropIndicator = useRef<HTMLDivElement | null>(null)
    const lastPointer = useRef<[number, number] | null>(null)
    const selectedElementKeyRef = useRef(selectedElementKey)
    selectedElementKeyRef.current = selectedElementKey
    const [hoveredSeriesName, setHoveredSeriesName] = useState<string | null>(null)
    const selectedTreemapSeriesName = selectedElementKey?.startsWith('treemap-group:') ? selectedElementKey.slice('treemap-group:'.length) : selectedElementKey?.split('\u001f')[0]
    const activeCategoryLabel = useMemo(() => requestedCategoryLabel ?? (() => {
      const match = selectedElementTarget === 'category-label' && selectedElementKey?.match(/^category-label:([xy]):(.*)$/)
      return match ? { axis: match[1] as 'x' | 'y', category: match[2] } : null
    })(), [requestedCategoryLabel, selectedElementKey, selectedElementTarget])
    const selectedCategoryLabel = activeCategoryLabel
    const chartLayoutReady = renderedChartKind === config.kind && (config.kind !== 'treemap' || treemapLayout.current?.table === table && treemapLayout.current.config === config)

    useEffect(() => { clickedSeries.current = selectedSeriesName ?? null }, [selectedSeriesName])

    useEffect(() => {
      let active = true
      setReadyKind(null)
      loadEchartsForKind(config.kind)
        .then(() => { if (active) setReadyKind(config.kind) })
        .catch((cause) => { if (active) setRenderError(cause instanceof Error ? cause.message : 'Не удалось загрузить модуль графика') })
      return () => { active = false }
    }, [config.kind])

    useEffect(() => {
      if (!container.current) return
      const instance = echarts.init(container.current, undefined, { renderer: 'svg' })
      chart.current = instance
      let fitFrame = 0
      let active = true
      const fitTreemap = () => {
        cancelAnimationFrame(fitFrame)
        fitFrame = requestAnimationFrame(() => {
          if (!active || instance.isDisposed() || renderedKind.current !== 'treemap') return
          applyTreemapLayout(instance, container.current, selectedElementKeyRef.current)
        })
      }
      const resize = () => {
        if (instance.isDisposed()) return
        instance.resize({ animation: { duration: 0 } })
        fitTreemap()
      }
      const observer = new ResizeObserver(resize)
      observer.observe(container.current)
      window.addEventListener('resize', resize)
      void document.fonts.ready.then(fitTreemap)
      return () => { active = false; cancelAnimationFrame(fitFrame); observer.disconnect(); window.removeEventListener('resize', resize); if (!instance.isDisposed()) instance.dispose(); if (chart.current === instance) chart.current = null }
    }, [])

    useEffect(() => {
      const target = viewport.current
      if (!target) return
      let fitFrame = 0
      const updateScale = () => {
        const width = Math.max(1, Math.min(1000, config.canvasWidth ?? 1000))
        const height = Math.max(1, Math.min(1000, config.canvasHeight ?? 563))
        setCanvasScale(config.autoFitCanvas === false ? 1 : Math.min(1, target.clientWidth / width, target.clientHeight / height))
        const instance = chart.current
        if (!instance || instance.isDisposed()) return
        instance.resize({ width, height, animation: { duration: 0 } })
        cancelAnimationFrame(fitFrame)
        fitFrame = requestAnimationFrame(() => {
          if (instance.isDisposed() || renderedKind.current !== 'treemap') return
          applyTreemapLayout(instance, container.current, selectedElementKeyRef.current)
        })
      }
      const observer = new ResizeObserver(updateScale)
      observer.observe(target)
      updateScale()
      return () => { cancelAnimationFrame(fitFrame); observer.disconnect() }
    }, [config.autoFitCanvas, config.canvasHeight, config.canvasWidth])

    useEffect(() => {
      const instance = chart.current
      if (!instance || instance.isDisposed() || readyKind !== config.kind) return
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
      const rendererOwnsDirectLabels = compiledScene.migrationMode === 'native' && compiledScene.plot.kind !== 'bar'
      const option = renderScene(compiledScene) as Record<string, unknown> & { graphic?: unknown[] }
      const nativeLayoutSnapshot = plugin.compilerMode === 'native' ? cloneChartOption({ grid: option.grid, xAxis: option.xAxis, yAxis: option.yAxis, legend: option.legend }) : null
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const firstTreemapLayout = config.kind === 'treemap' && (treemapLayout.current?.table !== table || treemapLayout.current.config !== config)
      option.animation = !reducedMotion && !firstTreemapLayout
      option.animationDuration ??= reducedMotion ? 0 : 420
      option.animationDurationUpdate ??= reducedMotion ? 0 : 240
      option.animationEasing ??= 'cubicOut'
      option.animationEasingUpdate ??= 'cubicOut'
      for (const [axisKey, axisName] of plugin.compilerMode === 'legacy' ? [['xAxis', 'x'], ['yAxis', 'y']] as const : []) {
        const axis = option[axisKey] as { axisLabel?: Record<string, unknown> } | undefined
        if (!axis?.axisLabel) continue
        const original = axis.axisLabel.formatter
        const overrides = config.categoryLabelOverrides?.[axisName] ?? {}
        axis.axisLabel.formatter = (value: unknown, index: number) => {
          const source = String(value ?? '')
          const formatted = typeof original === 'function' ? original(value, index) : source
          if (activeCategoryLabel?.axis === axisName && activeCategoryLabel.category === source) return ''
          return Object.prototype.hasOwnProperty.call(overrides, source) ? overrides[source] : formatted
        }
      }
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
      const legend = option.legend as { show?: boolean; top?: number; bottom?: number; left?: number; right?: number; textStyle?: object } | undefined
      const titleBottom = visibleTitle ? marginTop + titleHeight : marginTop
      const subtitleTop = visibleSubtitle ? titleBottom + (visibleTitle ? config.titleSubtitleGap ?? RHYTHM.titleSubtitle : 0) : titleBottom
      const headerContentBottom = visibleSubtitle ? subtitleTop + subtitleHeight : titleBottom
      const standardLegend = config.showLegend && !config.showDirectLabels
      const legendPosition = config.legendPosition ?? 'top'
      const legendLineHeight = Math.round(renderConfig.legendText.size * renderConfig.legendText.lineHeight / 100)
      const legendNames = prepareVisibleChartData(table, config).series.map((series) => series.name)
      const legendItemWidth = (config.legendMarker ?? 'auto') === 'line' || ((config.legendMarker ?? 'auto') === 'auto' && !isBarChart(config.kind)) ? 24 : 10
      let legendRows = 1, occupied = 0
      legendNames.forEach((name) => { const itemWidth = legendItemWidth + 10 + measureTextWidth(name, renderConfig.legendText.size, renderConfig.legendText.fontFamily, renderConfig.legendText.weight) + 14; if (occupied && occupied + itemWidth > availableWidth) { legendRows += 1; occupied = itemWidth } else occupied += itemWidth })
      const legendHeight = legendNames.length ? legendRows * legendLineHeight + Math.max(0, legendRows - 1) * 7 : 0
      const sideLegendContentWidth = legendNames.reduce((result, name) => Math.max(result, legendItemWidth + 18 + measureTextWidth(name, renderConfig.legendText.size, renderConfig.legendText.fontFamily, renderConfig.legendText.weight)), 90)
      const sideLegendWidth = Math.min((container.current?.clientWidth ?? 1000) * .28, sideLegendContentWidth)
      const yTitleStyle = config.yAxisTitleText ?? config.axisTitleText
      const yTitleThickness = !editorialAxes && config.showYAxisTitle && config.yAxisTitle
        ? Math.round(yTitleStyle.size * yTitleStyle.lineHeight / 100) * Math.max(1, config.yAxisTitle.split('\n').length) + config.yAxisTitleGap
        : 0
      let grid = option.grid as { top?: number; bottom?: number; left?: number; right?: number; containLabel?: boolean } | undefined
      const heatmapScalePosition = config.heatmapScalePosition ?? 'right'
      const heatmapScaleVisible = config.kind === 'heatmap' && (config.heatmapShowScale ?? true)
      const heatmapYLabelStyle = config.yAxisLabelText ?? config.axisLabelText
      const heatmapXAxisReserve = ((config.showXAxisLabels ?? true) ? Math.round((config.xAxisLabelText ?? config.axisLabelText).size * (config.xAxisLabelText ?? config.axisLabelText).lineHeight / 100) + (config.xAxisLabelGap ?? 8) : 0) + (config.showXTicks ? config.tickLength : 0) + (config.showXAxisTitle && config.xAxisTitle ? Math.round((config.xAxisTitleText ?? config.axisTitleText).size * (config.xAxisTitleText ?? config.axisTitleText).lineHeight / 100) * Math.max(1, config.xAxisTitle.split('\n').length) + config.xAxisTitleGap : 0)
      const heatmapYAxisReserve = ((config.showYAxisLabels ?? true) ? legendNames.reduce((width, name) => Math.max(width, measureTextWidth(name, heatmapYLabelStyle.size, heatmapYLabelStyle.fontFamily, heatmapYLabelStyle.weight)), 0) + (config.yAxisLabelGap ?? 8) : 0) + (config.showYTicks ? config.tickLength : 0) + (config.showYAxisTitle && config.yAxisTitle ? yTitleThickness : 0)
      const heatmapAxisReserve = { x: heatmapXAxisReserve, y: heatmapYAxisReserve }
      if (grid && heatmapScaleVisible) {
        const registryReserve = heatmapScalePosition === 'left' || heatmapScalePosition === 'right' ? 80 : 60
        grid[heatmapScalePosition] = Math.max(0, Number(grid[heatmapScalePosition] ?? 0) - registryReserve)
      }
      const oldHeaderBase = visibleSubtitle || (standardLegend && legendPosition === 'top') ? 104 : 78
      const topAxisExtra = config.xAxisPosition === 'top' ? Math.max(0, Number(grid?.top ?? oldHeaderBase) - oldHeaderBase) : 0
      const hasHeader = Boolean(visibleTitle || visibleSubtitle)
      const topLegendY = headerContentBottom + (hasHeader ? config.headerLegendGap ?? RHYTHM.headerLegend : 0)
      if (legend && legend.show !== false && legendPosition === 'top') legend.top = topLegendY
      if (grid) grid.top = (standardLegend && legendPosition === 'top' ? topLegendY + legendHeight + (config.legendPlotGap ?? RHYTHM.legendPlot) : headerContentBottom + (hasHeader ? config.headerPlotGap ?? RHYTHM.headerPlot : 0)) + topAxisExtra
      const individualValueStyles = Object.values(config.elementStyles).flatMap((item) => item.showLabel || item.valueText ? [item.valueText ?? config.valueText] : [])
      const visibleValueStyles = config.showValues ? [config.valueText, ...individualValueStyles] : individualValueStyles
      const valueLabelSpace = visibleValueStyles.reduce((space, valueStyle) => Math.max(space, Math.round(valueStyle.size * valueStyle.lineHeight / 100) + 8), 0)
      if (grid && valueLabelSpace && isBarChart(config.kind) && config.kind !== 'waterfall' && config.kind !== 'butterfly' && config.barValueLabelAbsorption) {
        const values = prepareVisibleChartData(table, config).series.flatMap((series) => series.data)
        const hasPositive = values.some((value) => value != null && value >= 0)
        const hasNegative = values.some((value) => value != null && value < 0)
        if (isHorizontalBar(config)) {
          if (hasPositive) grid.right = Number(grid.right ?? 0) + valueLabelSpace
          if (hasNegative) grid.left = Number(grid.left ?? 0) + valueLabelSpace
        } else {
          if (hasPositive) grid.top = Number(grid.top ?? 0) + valueLabelSpace
          if (hasNegative) grid.bottom = Number(grid.bottom ?? 0) + valueLabelSpace
        }
      } else if (grid && config.kind === 'waterfall' && valueLabelSpace && !(config.valueLabelPosition ?? '').startsWith('inside-')) {
        const values = prepareVisibleChartData(table, config).series[0]?.data ?? []
        const outsidePrevious = config.valueLabelPosition === 'bottom'
        const total = values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
        const totalVisible = (config.waterfallShowTotal ?? true) && (config.waterfallShowTotalValue ?? true)
        const needsTop = values.some((value) => value != null && (outsidePrevious ? value < 0 : value >= 0)) || totalVisible && total >= 0
        const needsBottom = values.some((value) => value != null && (outsidePrevious ? value >= 0 : value < 0)) || totalVisible && total < 0
        if (needsTop) grid.top = Number(grid.top ?? 0) + valueLabelSpace
        if (needsBottom) grid.bottom = Number(grid.bottom ?? 0) + valueLabelSpace
      } else if (grid && config.kind !== 'treemap' && config.kind !== 'butterfly' && valueLabelSpace && !(config.valueLabelPosition ?? '').startsWith('inside-')) {
        const valuePosition = config.valueLabelPosition ?? 'auto'
        if (isHorizontalBar(config)) {
          if (valuePosition === 'bottom') grid.left = Number(grid.left ?? 0) + valueLabelSpace
          else grid.right = Number(grid.right ?? 0) + valueLabelSpace
        } else if (valuePosition === 'bottom') grid.bottom = Number(grid.bottom ?? 0) + valueLabelSpace
        else grid.top = Number(grid.top ?? 0) + valueLabelSpace
      }
      if (grid && config.showDirectLabels && isHorizontalBar(config)) {
        const horizontalSeries = prepareVisibleChartData(table, config).series
        const hasVisibleDirectRows = horizontalSeries.some((series) => config.seriesStyles[series.name]?.showDirectLabel !== false)
        const directRows = hasVisibleDirectRows ? horizontalSeries.reduce((height, series) => {
          const seriesStyle = config.seriesStyles[series.name]
          const directStyle = seriesStyle?.directLabelText ?? config.directLabelText ?? config.legendText
          const directLineHeight = Math.round(directStyle.size * directStyle.lineHeight / 100)
          const directNoteHeight = Math.max(8, directStyle.size - 2) * 1.25
          const label = seriesStyle?.legendLabel?.trim() || series.name
          const note = seriesStyle?.legendNote?.trim() || ''
          return Math.max(height, Math.max(1, label.split('\n').length) * directLineHeight + (note ? 3 + Math.max(1, note.split('\n').length) * directNoteHeight : 0))
        }, 0) : 0
        if (directRows) {
          const directReserve = Math.ceil(directRows + Math.max(8, config.directLabelGap ?? 14))
          grid.top = Number(grid.top ?? 0) + directReserve
          if (config.xAxisPosition === 'top') {
            const xAxis = option.xAxis as { nameGap?: number; axisLabel?: { margin?: number } } | undefined
            if (xAxis?.axisLabel) xAxis.axisLabel.margin = Number(xAxis.axisLabel.margin ?? config.xAxisLabelGap ?? 8) + directReserve
            if (xAxis) xAxis.nameGap = Number(xAxis.nameGap ?? 0) + directReserve
          }
        }
      }
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
      const footerContentHeight = noteHeight + sourceHeight + (visibleNote && visibleSource ? config.noteSourceGap ?? RHYTHM.noteSource : 0)
      const footerBlockHeight = visibleNote || visibleSource ? marginBottom + footerContentHeight : 0
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
      const bottomAxisReserve = config.xAxisPosition === 'bottom' ? xAxisTitleReserve + physicalXAxisOuterReserve : 0
      const editorialXStyle = isHorizontalBar(config) ? config.yAxisTitleText ?? config.axisTitleText : config.xAxisTitleText ?? config.axisTitleText
      const editorialYStyle = isHorizontalBar(config) ? config.xAxisTitleText ?? config.axisTitleText : config.yAxisTitleText ?? config.axisTitleText
      const editorialXText = isHorizontalBar(config) ? config.yAxisTitle : config.xAxisTitle
      const editorialYText = isHorizontalBar(config) ? config.xAxisTitle : config.yAxisTitle
      const showEditorialX = editorialAxes && (isHorizontalBar(config) ? config.showYAxisTitle : config.showXAxisTitle) && Boolean(editorialXText)
      const showEditorialY = editorialAxes && (isHorizontalBar(config) ? config.showXAxisTitle : config.showYAxisTitle) && Boolean(editorialYText)
      const editorialXHeight = showEditorialX ? Math.round(editorialXStyle.size * editorialXStyle.lineHeight / 100) * Math.max(1, editorialXText.split('\n').length) + 14 : 0
      const editorialYHeight = showEditorialY ? Math.round(editorialYStyle.size * editorialYStyle.lineHeight / 100) * Math.max(1, editorialYText.split('\n').length) + 12 : 0
      if (grid && editorialYHeight) grid.top = Number(grid.top ?? 0) + editorialYHeight
      if (grid && editorialXHeight && config.xAxisPosition === 'bottom') grid.bottom = Number(grid.bottom ?? 0) + editorialXHeight
      // Keep one editorial rhythm between the physical X-axis (including its title)
      // and the footer, regardless of chart orientation or the title's typography.
      if (grid && footerBlockHeight) grid.bottom = Math.max(Number(grid.bottom ?? 0), footerBlockHeight + (config.plotFooterGap ?? RHYTHM.plotFooter) + bottomAxisReserve + editorialXHeight)
      if (standardLegend && legendPosition === 'bottom') {
        const legendBottom = footerBlockHeight ? footerBlockHeight + (config.headerLegendGap ?? RHYTHM.headerLegend) : marginBottom
        if (legend) legend.bottom = legendBottom
        if (grid) grid.bottom = legendBottom + legendHeight + (config.legendPlotGap ?? RHYTHM.legendPlot) + bottomAxisReserve + editorialXHeight
      }
      if (standardLegend && legendPosition === 'left' && grid) grid.left = Math.max(Number(grid.left ?? 0), sideLegendWidth + marginLeft + (config.legendPlotGap ?? RHYTHM.legendPlot) + (config.yAxisPosition === 'left' ? yTitleThickness : 0))
      if (standardLegend && legendPosition === 'right' && grid) grid.right = Math.max(Number(grid.right ?? 0), sideLegendWidth + marginRight + (config.legendPlotGap ?? RHYTHM.legendPlot) + (config.yAxisPosition === 'right' ? yTitleThickness : 0))
      if (grid) {
        const canvasWidth = config.canvasWidth ?? container.current?.clientWidth ?? 1000
        // Keep requested spacing intact until the coordinate rectangle would be
        // invalid. A larger minimum used to shrink valid user-defined gaps.
        const minimumPlotWidth = 1
        const minimumPlotHeight = 1
        const left = Math.max(0, Number(grid.left ?? 0)), right = Math.max(0, Number(grid.right ?? 0))
        const top = Math.max(0, Number(grid.top ?? 0)), bottom = Math.max(0, Number(grid.bottom ?? 0))
        const horizontalOverflow = Math.max(0, left + right + minimumPlotWidth - canvasWidth)
        const verticalOverflow = Math.max(0, top + bottom + minimumPlotHeight - canvasHeight)
        grid.left = Math.max(0, Math.round(left - horizontalOverflow * left / Math.max(1, left + right)))
        grid.right = Math.max(0, Math.round(right - horizontalOverflow * right / Math.max(1, left + right)))
        grid.top = Math.max(0, Math.round(top - verticalOverflow * top / Math.max(1, top + bottom)))
        grid.bottom = Math.max(0, Math.round(bottom - verticalOverflow * bottom / Math.max(1, top + bottom)))
      }
      if (grid && heatmapScaleVisible) {
        const verticalScale = heatmapScalePosition === 'left' || heatmapScalePosition === 'right'
        const axisReserve = verticalScale
          ? heatmapScalePosition === 'right' && heatmapScalePosition === config.yAxisPosition ? heatmapYAxisReserve : 0
          : heatmapScalePosition === 'top' && heatmapScalePosition === config.xAxisPosition ? heatmapXAxisReserve : 0
        const finalReserve = (verticalScale ? 80 : 60) + axisReserve
        grid[heatmapScalePosition] = Number(grid[heatmapScalePosition] ?? 0) + finalReserve
      }
      if (grid && config.kind === 'treemap') {
        const treemapGrid = grid
        ;(option.series as Array<Record<string, unknown>> | undefined)?.forEach((series) => Object.assign(series, { left: treemapGrid.left, top: treemapGrid.top, right: treemapGrid.right, bottom: treemapGrid.bottom }))
      }
      if (nativeLayoutSnapshot) {
        option.grid = nativeLayoutSnapshot.grid
        option.xAxis = nativeLayoutSnapshot.xAxis
        option.yAxis = nativeLayoutSnapshot.yAxis
        option.legend = nativeLayoutSnapshot.legend
        grid = option.grid as typeof grid
        physicalXAxisOption = option.xAxis as typeof physicalXAxisOption
      }
      if (!rendererOwnsDirectLabels) suppressBuiltInDirectLabels(option, config)
      const cleanOption = cloneChartOption(option)
      applySeriesVisualState(option, table, config, selectedSeriesName, selectedElementKey, hoveredSeriesName)
      for (const axisKey of ['xAxis', 'yAxis'] as const) {
        const axis = option[axisKey] as { nameTextStyle?: object; axisLabel?: object } | undefined
        if (!axis) continue
        if (selectedSettingsSection === `${axisKey[0]}-axis-title`) axis.nameTextStyle = { ...axis.nameTextStyle, ...selectionStyle }
        if (selectedSettingsSection === `${axisKey[0]}-axis-labels` && plugin.compilerMode === 'legacy') axis.axisLabel = { ...axis.axisLabel, ...selectionStyle }
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
        const series = option.series as Array<{ name?: string; segmentOf?: string; type?: string; silent?: boolean; symbol?: string; symbolSize?: number; z?: number; itemStyle?: Record<string, unknown>; lineStyle?: Record<string, unknown>; emphasis?: Record<string, unknown> }> | undefined
        series?.forEach((item) => {
          if (item.name === `__hit__:${selectedSeriesName}`) {
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
        const series = option.series as Array<{ name?: string; type?: string; data?: unknown[] }> | undefined
        const visitSelected = (item: { name?: string; type?: string }, points: unknown[]) => points.forEach((point) => {
          if (!point || typeof point !== 'object') return
          const dataPoint = point as Record<string, unknown>
          if (dataPoint.elementKey === selectedElementKey && !item.name?.startsWith('__hit__:')) {
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
      const existing = [...positionHeatmapScaleGraphics(Array.isArray(option.graphic) ? option.graphic : [], config, grid ?? {}, config.canvasWidth ?? 1000, canvasHeight, heatmapAxisReserve), makeXAxisTitle()].filter(Boolean)
      const plotMiddleY = grid ? (Number(grid.top ?? 0) + canvasHeight - Number(grid.bottom ?? 0)) / 2 : canvasHeight / 2
      const yTitlePosition = config.kind === 'butterfly' && config.butterflyCategoryPosition && config.butterflyCategoryPosition !== 'center' ? config.butterflyCategoryPosition : config.yAxisPosition
      const yTitleSideOffset = standardLegend && legendPosition === yTitlePosition ? sideLegendWidth + (yTitlePosition === 'left' ? marginLeft : marginRight) + 8 : (yTitlePosition === 'left' ? marginLeft : marginRight) + heatmapScaleSideOffset(config)
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
        if (item.id === 'chart-y-axis-title') { const section = isHorizontalBar(config) ? 'x-axis-title' : 'y-axis-title'; return { ...item, left: undefined, right: undefined, top: undefined, x: yTitleX, y: plotMiddleY, cursor: 'pointer', style: { ...(item as { style?: object }).style, ...(selectedSettingsSection === section ? selectionStyle : {}) }, onclick: () => onSettingsFocus?.(section) } }
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
      const cleanLabels = [...positionHeatmapScaleGraphics(Array.isArray(cleanOption.graphic) ? cleanOption.graphic : [], config, grid ?? {}, config.canvasWidth ?? 1000, canvasHeight, heatmapAxisReserve), makeXAxisTitle(true)].filter(Boolean).map((graphic) => {
        if (!graphic || typeof graphic !== 'object') return graphic
        const item = graphic as { id?: string; style?: object }
        if (item.id === 'chart-y-axis-title') return { ...item, left: undefined, right: undefined, top: undefined, x: yTitleX, y: plotMiddleY }
        if (item.id === 'chart-note') return { ...item, left: undefined, right: undefined, x: textAnchor(config.noteText.align), bottom: visibleSource ? marginBottom + sourceHeight + (config.noteSourceGap ?? RHYTHM.noteSource) : marginBottom, style: { ...item.style, text: noteRich?.text ?? wrappedNote.text, width: availableWidth, align: config.noteText.align, textAlign: config.noteText.align, overflow: undefined, ...(noteRich ?? {}), opacity: config.noteHtml ? 0 : 1 } }
        if (item.id === 'chart-source') return { ...item, left: undefined, right: undefined, x: textAnchor(config.sourceText.align), bottom: marginBottom, style: { ...item.style, text: sourceRich?.text ?? wrappedSource.text, width: availableWidth, align: config.sourceText.align, textAlign: config.sourceText.align, overflow: undefined, ...(sourceRich ?? {}), opacity: config.sourceHtml ? 0 : 1 } }
        return item
      })
      cleanOption.graphic = [...cleanLabels, ...decorationGraphics(config.decorations ?? []), ...cleanTitleHits, ...annotations.map((annotation) => ({ ...annotation, style: { ...annotation.style, opacity: 1 } }))]
      splitCenteredButterflyAxes(option, table, config)
      splitCenteredButterflyAxes(cleanOption as Record<string, unknown>, table, config)
      const animateTreemapUpdate = config.kind === 'treemap' && renderedKind.current === 'treemap'
      if (animateTreemapUpdate) instance.setOption(option, { replaceMerge: ['series', 'graphic'] })
      else instance.setOption(option, true)
      renderedKind.current = config.kind
      setRenderedChartKind(config.kind)
      if (activeCategoryLabel && config.kind !== 'treemap') {
        const axisKey = activeCategoryLabel.axis === 'x' ? 'xAxis' : 'yAxis'
        const axisOption = option[axisKey] as { data?: unknown[]; position?: 'top' | 'bottom' | 'left' | 'right'; axisLabel?: { rotate?: number; show?: boolean } } | Array<{ data?: unknown[]; position?: 'top' | 'bottom' | 'left' | 'right'; axisLabel?: { rotate?: number; show?: boolean } }> | undefined
        const axis = Array.isArray(axisOption) ? axisOption[0] : axisOption
        const index = axis?.data?.findIndex((value) => String(value) === activeCategoryLabel.category) ?? -1
        const pixel = Number(instance.convertToPixel(activeCategoryLabel.axis === 'x' ? { xAxisIndex: 0 } : { yAxisIndex: 0 }, index >= 0 ? index : activeCategoryLabel.category))
        const categoryOnYAxis = activeCategoryLabel.axis === 'y' && isHorizontalBar(config)
        const baseStyle = categoryOnYAxis || activeCategoryLabel.axis === 'x' ? config.xAxisLabelText ?? config.axisLabelText : config.yAxisLabelText ?? config.axisLabelText
        const bounds = chartPlotBounds(instance, table, config)
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
        const butterflyGap = config.kind === 'butterfly' ? butterflyCategoryLayout(table, config).gap : 0
        const butterflyCenter = config.kind === 'butterfly' && (config.butterflyCategoryPosition ?? 'center') === 'center'
          ? (Number(instance.convertToPixel({ xAxisIndex: 0 }, 0)) + Number(instance.convertToPixel({ xAxisIndex: 1 }, 0))) / 2
          : 0
        if (axis?.axisLabel?.show === false && config.kind !== 'butterfly') setCategoryLabelLayout(null)
        else if (Number.isFinite(pixel) && bounds) setCategoryLabelLayout(activeCategoryLabel.axis === 'x'
          ? { axis: 'x', category: activeCategoryLabel.category, style: { ...baseStyle, align }, rotation, size: baseStyle.size, width, left: pixel - width / 2, top: axis?.position === 'top' ? bounds.top - (config.showXTicks ? config.tickLength : 0) - (config.xAxisLabelGap ?? 8) - textLayout.rotatedSize.height : bounds.bottom + (config.showXTicks ? config.tickLength : 0) + (config.xAxisLabelGap ?? 8) }
          : config.kind === 'butterfly' && (config.butterflyCategoryPosition ?? 'center') === 'center'
            ? { axis: 'y', category: activeCategoryLabel.category, style: { ...baseStyle, align: 'center' }, rotation: 0, size: baseStyle.size, width: butterflyGap - 16, left: butterflyCenter - (butterflyGap - 16) / 2, top: pixel - textLayout.size.height / 2 }
            : { axis: 'y', category: activeCategoryLabel.category, style: { ...baseStyle, align }, rotation: 0, size: baseStyle.size, width: axis?.position === 'right' ? Math.max(20, canvasWidth - bounds.right - (config.xAxisLabelGap ?? 8)) : Math.max(20, bounds.left - (config.xAxisLabelGap ?? 8)), left: axis?.position === 'right' ? bounds.right + (config.xAxisLabelGap ?? 8) : 0, top: pixel - textLayout.size.height / 2 })
        else setCategoryLabelLayout(null)
      } else setCategoryLabelLayout(null)
      const exactBounds = chartPlotBounds(instance, table, config)
      if (exactBounds) setPlotBounds((current) => current && Math.abs(current.top - exactBounds.top) < .5 && Math.abs(current.bottom - exactBounds.bottom) < .5 && Math.abs(current.left - exactBounds.left) < .5 && Math.abs(current.right - exactBounds.right) < .5 ? current : exactBounds)
      const withoutGeneratedGraphics = (graphics: unknown[]) => graphics.filter((graphic) => {
        if (!graphic || typeof graphic !== 'object') return true
        const id = String((graphic as { id?: string }).id ?? '')
        return !id.startsWith('decoration-') && !id.startsWith('bar-vertical-grid-') && !id.startsWith('value-label-hit-') && !id.startsWith('waterfall-hit-') && !id.startsWith('selection-')
      })
      const exactDisplayDecorations = decorationGraphics(config.decorations ?? [], exactBounds ?? undefined, selectDecoration)
      const exactCleanDecorations = decorationGraphics(config.decorations ?? [], exactBounds ?? undefined)
      const barGrid = barVerticalGridGraphics(instance, table, config, exactBounds)
      if (exactBounds) {
        const exactMiddleY = (exactBounds.top + exactBounds.bottom) / 2
        const exactGrid = { left: exactBounds.left, right: (config.canvasWidth ?? 1000) - exactBounds.right, top: exactBounds.top, bottom: canvasHeight - exactBounds.bottom }
        const positionPlotGraphics = (graphics: unknown[]) => positionHeatmapScaleGraphics(graphics, config, exactGrid, config.canvasWidth ?? 1000, canvasHeight, heatmapAxisReserve).map((graphic) => {
          if (!graphic || typeof graphic !== 'object') return graphic
          const item = graphic as { id?: string; style?: Record<string, unknown>; children?: Array<{ type?: string; shape?: { width?: number; height?: number } }> }
          if (item.id === 'chart-x-axis-title') return { ...item, x: (exactBounds.left + exactBounds.right) / 2, y: config.xAxisPosition === 'bottom' ? exactBounds.bottom + physicalXAxisLabelOffset + physicalXAxisTitleGap + xAxisTitleHeight / 2 : exactBounds.top - physicalXAxisLabelOffset - physicalXAxisTitleGap - xAxisTitleHeight / 2 }
          if (item.id === 'chart-y-axis-title') return { ...item, top: undefined, y: exactMiddleY }
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
      if (config.showDirectLabels && !rendererOwnsDirectLabels) {
        const displayDirect = directLegendGraphics(instance, table, config, onSettingsFocus, selectedSettingsSection === 'legend')
        const cleanDirect = directLegendGraphics(instance, table, config)
        option.graphic = [...(Array.isArray(option.graphic) ? option.graphic : []), ...displayDirect]
        cleanOption.graphic = [...(Array.isArray(cleanOption.graphic) ? cleanOption.graphic : []), ...cleanDirect]
        instance.setOption({ graphic: option.graphic }, { replaceMerge: ['graphic'] })
      }
      const valueLabelHits = valueLabelHitGraphics(instance, table, config, selectedSettingsSection === 'values', onSelect, onSettingsFocus, selectedElementKey, selectedElementTarget)
      if (valueLabelHits.length) {
        option.graphic = [...(Array.isArray(option.graphic) ? option.graphic : []), ...valueLabelHits]
        instance.setOption({ graphic: option.graphic }, { replaceMerge: ['graphic'] })
      }
      const butterflyCategories = butterflyCategoryGraphics(instance, table, config, selectedSettingsSection, onSelect, onSettingsFocus, activeCategoryLabel?.axis === 'y' ? activeCategoryLabel.category : null)
      const butterflyHits = butterflyBarHitGraphics(instance, table, config, selectedSeriesName, onSeriesSelect, onSelect, onSettingsFocus)
      if (butterflyCategories.length || butterflyHits.length) {
        option.graphic = [...(Array.isArray(option.graphic) ? option.graphic : []), ...butterflyHits, ...butterflyCategories]
        cleanOption.graphic = [...(Array.isArray(cleanOption.graphic) ? cleanOption.graphic : []), ...butterflyCategoryGraphics(instance, table, config, null, undefined, undefined, null, true)]
        instance.setOption({ graphic: option.graphic }, { replaceMerge: ['graphic'] })
      }
      displayOption.current = option
      exportOption.current = cleanOption
      instance.dispatchAction({ type: 'downplay' })
      instance.getZr().flush()
      if (config.kind === 'treemap') {
        const token = ++treemapLayoutToken.current
        const finish = () => {
          if (token !== treemapLayoutToken.current || instance.isDisposed() || chart.current !== instance) return
          applyTreemapLayout(instance, container.current, selectedElementKey)
          treemapLayout.current = { table, config }
          setTreemapLayoutRevision((revision) => revision + 1)
        }
        if (document.fonts.status === 'loaded') finish()
        else void document.fonts.ready.then(finish)
      } else {
        treemapLayout.current = null
        treemapLayoutToken.current += 1
      }
      setRenderError('')
      } catch (cause) {
        displayOption.current = null
        exportOption.current = null
        setRenderError(cause instanceof Error ? cause.message : 'Не удалось отрисовать график')
      }
    }, [activeCategoryLabel, table, config, hoveredSeriesName, onAnnotationSelect, onDecorationChange, onDecorationSelect, onSelect, onSeriesSelect, onSettingsFocus, readyKind, selectedAnnotationId, selectedElementKey, selectedElementTarget, selectedSeriesName, selectedSettingsSection])

    useEffect(() => {
      const instance = chart.current
      if (!instance || instance.isDisposed() || readyKind !== config.kind) return
      const canvas = container.current
      const pointerHandler = (event: MouseEvent) => {
        const bounds = canvas?.getBoundingClientRect()
        if (bounds && bounds.width > 0 && bounds.height > 0) {
          const logicalWidth = instance.getWidth(), logicalHeight = instance.getHeight()
          lastPointer.current = [
            (event.clientX - bounds.left) * logicalWidth / bounds.width,
            (event.clientY - bounds.top) * logicalHeight / bounds.height,
          ]
        }
      }
      const resetHover = () => { setHoveredSeriesName(null); instance.dispatchAction({ type: 'downplay' }) }
      const prepared = prepareVisibleChartData(table, config)
      const horizontalBar = isHorizontalBar(config)
      const categoryPixels = config.kind === 'treemap' ? [] : prepared.categories.map((_, index) => {
        try { return Number(instance.convertToPixel(horizontalBar ? { yAxisIndex: 0 } : { xAxisIndex: 0 }, index)) } catch { return Number.NaN }
      })
      const pointerCategory = (pointer: [number, number]) => pointer[horizontalBar ? 1 : 0]
      const nearestIndex = (pointer: [number, number]) => nearestPixelIndex(categoryPixels, pointerCategory(pointer))
      const clickedSegmentIndex = (pointer: [number, number]) => segmentEndpointIndex(categoryPixels, pointerCategory(pointer))
      const selectWaterfallAt = (pointer: [number, number], target?: ChartElementSelection['target']) => {
        if (config.kind !== 'waterfall') return
        const source = prepared.series[0]
        if (!source) return
        const { steps, total } = waterfallSteps(source.data)
        const totalLabel = config.waterfallTotalLabel?.trim() || 'Итого'
        const entries = [
          ...steps.map((step, index) => ({ ...step, category: prepared.categories[index], label: String(prepared.categories[index] ?? ''), total: false })),
          ...((config.waterfallShowTotal ?? true) ? [{ delta: total, start: 0, end: total, category: totalLabel, label: totalLabel, total: true }] : []),
        ]
        const pixels = entries.map((_, index) => {
          try { return Number(instance.convertToPixel({ xAxisIndex: 0 }, index)) } catch { return Number.NaN }
        })
        const index = nearestPixelIndex(pixels, pointer[0]), entry = entries[index]
        if (!entry || entry.delta == null) return
        const key = `${source.name}\u001f${entry.category instanceof Date ? entry.category.toISOString() : `${typeof entry.category}:${String(entry.category)}`}`
        let resolvedTarget = target
        if (!resolvedTarget && (config.elementStyles[key]?.showLabel ?? config.showValues) && (!entry.total || (config.waterfallShowTotalValue ?? true))) {
          const element = config.elementStyles[key], style = element?.valueText ?? config.valueText
          const label = element?.label || waterfallValueLabel(entry.delta, entry.end, entry.total, config)
          const lineHeight = Math.round(style.size * style.lineHeight / 100), labelHeight = lineHeight * label.split('\n').length
          const labelWidth = Math.max(...label.split('\n').map((line) => measureTextWidth(line, style.size, style.fontFamily, style.weight)))
          const band = pixels.length > 1 ? Math.min(...pixels.slice(1).map((pixel, current) => Math.abs(pixel - pixels[current])).filter((value) => value > 0)) : instance.getWidth()
          const width = band * Math.max(.1, Math.min(1, (config.barWidth ?? 68) / 100))
          let startY: number, endY: number
          try {
            startY = Number(instance.convertToPixel({ yAxisIndex: 0 }, entry.start))
            endY = Number(instance.convertToPixel({ yAxisIndex: 0 }, entry.end))
          } catch { return }
          const requested = element?.waterfallLabelPosition ?? config.valueLabelPosition ?? 'auto'
          const position = entry.total ? requested === 'bottom' ? 'top' : requested === 'inside-bottom' ? 'inside-top' : requested : requested
          const placement = waterfallLabelPlacement(startY, endY, width, labelWidth, labelHeight, position, config.waterfallLabelGap ?? 6)
          const top = placement.verticalAlign === 'top' ? placement.y : placement.verticalAlign === 'bottom' ? placement.y - labelHeight : placement.y - labelHeight / 2
          if (Math.abs(pointer[0] - pixels[index]) <= labelWidth / 2 + 4 && pointer[1] >= top - 2 && pointer[1] <= top + labelHeight + 2) resolvedTarget = 'value-label'
        }
        const color = config.elementStyles[key]?.color ?? (entry.total ? config.waterfallTotalColor ?? '#6956e8' : entry.delta >= 0 ? config.waterfallIncreaseColor ?? '#36a476' : config.waterfallDecreaseColor ?? '#db5a5a')
        onSelect?.({ key, seriesName: source.name, category: entry.label, value: waterfallValueLabel(entry.delta, entry.end, entry.total, config), color, target: resolvedTarget })
        onSettingsFocus?.('element')
      }
      const clickHandler = (event: MouseEvent) => {
        pointerHandler(event)
        if (config.kind !== 'waterfall' || !lastPointer.current) return
        const node = event.target as { tagName?: string; parentElement?: { tagName?: string }; getAttribute?: (name: string) => string | null }
        const text = node.tagName?.toLowerCase() === 'text' || node.tagName?.toLowerCase() === 'tspan' || node.parentElement?.tagName?.toLowerCase() === 'text'
        const filledPath = node.tagName?.toLowerCase() === 'path' && !['', 'none', 'transparent'].includes(node.getAttribute?.('fill') ?? '')
        if (text) selectWaterfallAt(lastPointer.current, 'value-label')
        else if (filledPath) selectWaterfallAt(lastPointer.current)
      }
      canvas?.addEventListener('click', clickHandler, true)
      const highlightGuide = (pointer: [number, number] | null) => {
        if (!pointer || !selectedSeriesName) return
        const current = instance.getOption() as { series?: Array<{ name?: string }> }
        const seriesIndex = current.series?.findIndex((item) => item.name === `__hit__:${selectedSeriesName}`) ?? -1
        if (seriesIndex < 0) return
        const dataIndex = nearestIndex(pointer)
        const category = prepared.categories[dataIndex]
        const guideKey = `${selectedSeriesName}\u001f${category instanceof Date ? category.toISOString() : `${typeof category}:${String(category)}`}`
        instance.dispatchAction({ type: 'downplay', seriesIndex })
        if (guideKey !== selectedElementKey) instance.dispatchAction({ type: 'highlight', seriesIndex, dataIndex })
      }
      const moveHandler = (event: MouseEvent) => { pointerHandler(event); highlightGuide(lastPointer.current) }
      const leaveHandler = () => {
        const current = instance.getOption() as { series?: Array<{ name?: string }> }
        const seriesIndex = current.series?.findIndex((item) => item.name === `__hit__:${selectedSeriesName}`) ?? -1
        if (seriesIndex >= 0) instance.dispatchAction({ type: 'downplay', seriesIndex })
        resetHover()
      }
      canvas?.addEventListener('mousemove', moveHandler)
      canvas?.addEventListener('mouseleave', leaveHandler)
      highlightGuide(lastPointer.current)
      const selectNearestValue = (seriesName: string) => {
        const pointer = lastPointer.current
        if (!pointer) return
        const series = prepared.series.find((item) => item.name === seriesName)
        if (!series) return
        const index = clickedSegmentIndex(pointer)
        const category = prepared.categories[index]
        const key = `${seriesName}\u001f${category instanceof Date ? category.toISOString() : `${typeof category}:${String(category)}`}`
        const value = series.data[index]
        const seriesIndex = prepared.series.findIndex((item) => item.name === seriesName)
        onSelect?.({ key, seriesName, category: String(category), value: value == null ? 'пропуск' : String(value), color: config.elementStyles[key]?.color ?? getSeriesColor(config, seriesName, Math.max(0, seriesIndex)) })
        onSettingsFocus?.('element')
      }
      const handler = (params: unknown) => {
        if (suppressTreemapClick.current) { suppressTreemapClick.current = false; return }
        type RendererPoint = { elementId?: string; datumId?: string; seriesId?: string; elementKey?: string; sourceSeriesName?: string; displayValue?: string; displayCategory?: string; displayLabel?: string; displayColor?: string; directLegendLabel?: boolean; itemStyle?: { color?: unknown } }
        const event = params as { componentType?: string; targetType?: string; seriesName?: string; name?: string; value?: unknown; color?: unknown; data?: RendererPoint; info?: RendererPoint; event?: { target?: { type?: string; parent?: { type?: string } }; topTarget?: { type?: string; parent?: { type?: string } } } }
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
        const pointData = event.info?.elementKey ? event.info : event.data
        const seriesName = pointData?.sourceSeriesName ?? event.seriesName.replace(/^__hit__:/, '')
        const pointColor = pointData?.displayColor ?? (typeof event.data?.itemStyle?.color === 'string' ? event.data.itemStyle.color : undefined) ?? (typeof event.color === 'string' ? event.color : undefined)
        const renderTarget = event.event?.target ?? event.event?.topTarget
        const clickedValueLabel = event.targetType === 'label' || renderTarget?.type === 'text' || renderTarget?.type === 'tspan' || renderTarget?.parent?.type === 'text'
        const nativeSelection = (target?: 'value-label') => {
          if (!pointData?.elementId) return undefined
          const selection: ChartSelection = { kind: 'element', id: pointData.elementId, role: target ?? 'mark', seriesId: pointData.seriesId, datumId: pointData.datumId, legacyKey: pointData.elementKey, series: seriesName, category: pointData.displayCategory ?? event.name ?? '', value: pointData.displayValue ?? String(event.value ?? ''), label: pointData.displayLabel, color: pointColor }
          return legacySelection(selection) as ChartElementSelection
        }
        if (clickedValueLabel && event.data?.directLegendLabel) { onSettingsFocus?.('legend'); return }
        if (config.kind === 'treemap' && selectedTreemapSeriesName !== seriesName) {
          onSelect?.({ key: `treemap-group:${seriesName}`, seriesName, category: seriesName, value: '', label: seriesName })
          onSettingsFocus?.('element')
          return
        }
        if (config.kind === 'waterfall') {
          if (pointData?.elementKey) onSelect?.({ key: pointData.elementKey, seriesName, category: pointData.displayCategory ?? event.name ?? '', value: pointData.displayValue ?? String(event.value ?? ''), label: pointData.displayLabel, color: pointColor, ...(clickedValueLabel ? { target: 'value-label' as const } : {}) })
          else selectNearestValue(seriesName)
          onSettingsFocus?.('element')
          return
        }
        if (clickedValueLabel && pointData?.elementKey) {
          if (config.kind !== 'treemap' && selectedSettingsSection !== 'values') { onSettingsFocus?.('values'); return }
          onSelect?.(nativeSelection('value-label') ?? { key: pointData.elementKey, seriesName, category: pointData.displayCategory ?? event.name ?? '', value: pointData.displayValue ?? String(event.value ?? ''), label: pointData.displayLabel, color: pointColor, target: 'value-label' })
          onSettingsFocus?.('element')
          return
        }
        if (clickedSeries.current !== seriesName) {
          const seriesIndex = prepareChartData(table, config).series.findIndex((item) => item.name === seriesName)
          onSeriesSelect?.({ name: seriesName, color: getSeriesColor(config, seriesName, Math.max(0, seriesIndex)) })
          clickedSeries.current = seriesName
          onSettingsFocus?.('series')
          return
        }
        if (!pointData?.elementKey) { selectNearestValue(seriesName); return }
        onSelect?.(nativeSelection() ?? { key: pointData.elementKey, seriesName, category: pointData.displayCategory ?? event.name ?? '', value: pointData.displayValue ?? String(event.value ?? ''), label: pointData.displayLabel, color: pointColor })
        onSettingsFocus?.('element')
      }
      const hoverHandler = (params: unknown) => {
        const event = params as { seriesName?: string; data?: { sourceSeriesName?: string } }
        const name = event.data?.sourceSeriesName ?? event.seriesName?.replace(/^__hit__:/, '')
        if (name && !name.startsWith('__')) setHoveredSeriesName((current) => current === name ? current : name)
      }
      const legendHandler = () => onSettingsFocus?.('legend')
      const backgroundHandler = (event: { target?: unknown }) => { if (!event.target) { onClearSettingsFocus?.(); onAnnotationSelect?.('') } }
      const waterfallElementHandler = (event: { target?: { type?: string; info?: { elementKey?: string; sourceSeriesName?: string; displayCategory?: string; displayValue?: string; displayColor?: string; selectionTarget?: ChartElementSelection['target'] }; parent?: { type?: string; info?: { elementKey?: string; sourceSeriesName?: string; displayCategory?: string; displayValue?: string; displayColor?: string; selectionTarget?: ChartElementSelection['target'] } } } }) => {
        if (config.kind !== 'waterfall') return
        const point = event.target?.info?.elementKey ? event.target.info : event.target?.parent?.info
        if (!point?.elementKey) return
        const target = point.selectionTarget ?? (event.target?.type === 'text' || event.target?.parent?.type === 'text' ? 'value-label' : undefined)
        onSelect?.({ key: point.elementKey, seriesName: point.sourceSeriesName ?? '', category: point.displayCategory ?? '', value: point.displayValue ?? '', color: point.displayColor, target })
        onSettingsFocus?.('element')
      }
      // Keep the renderer that was alive when the handlers were registered.
      // During StrictMode teardown the chart-init effect may dispose ECharts
      // before this effect gets a chance to remove its listeners, at which
      // point instance.getZr() returns null.
      const renderer = instance.getZr()
      const treemapSelection = (params: unknown, mode: 'source' | 'group' | 'leaf' = 'group') => {
        const event = params as { seriesName?: string; name?: string; value?: unknown; data?: { elementKey?: string; sourceSeriesName?: string; displayValue?: string; displayCategory?: string; displayLabel?: string }; event?: { offsetX?: number; offsetY?: number } }
        const point = event.data
        const category = point?.sourceSeriesName ?? event.seriesName
        if (config.kind !== 'treemap' || !category || category.startsWith('__')) return null
        const leafSelected = Boolean(point?.elementKey && !point.elementKey.startsWith('treemap-group:') && (mode === 'leaf' || mode === 'source' && selectedElementKey === point.elementKey))
        if (!leafSelected) return {
          selection: { key: `treemap-group:${category}`, seriesName: category, category, value: '', label: category } satisfies ChartElementSelection,
          point: [Number(event.event?.offsetX ?? 0), Number(event.event?.offsetY ?? 0)] as [number, number],
        }
        return {
          selection: { key: point!.elementKey!, seriesName: category, category: point?.displayCategory ?? event.name ?? '', value: point?.displayValue ?? String(event.value ?? ''), label: point?.displayLabel } satisfies ChartElementSelection,
          point: [Number(event.event?.offsetX ?? 0), Number(event.event?.offsetY ?? 0)] as [number, number],
        }
      }
      const treemapDown = (params: unknown) => {
        const item = treemapSelection(params, 'source')
        if (!item) return
        const click = treemapSelection(params, selectedTreemapSeriesName === item.selection.seriesName ? 'leaf' : 'group')?.selection ?? item.selection
        treemapDrag.current = { source: item.selection, click, start: item.point, moved: false }
      }
      const sendTreemapMove = (source: ChartElementSelection, target: ChartElementSelection, placement: 'before' | 'after') => {
        onTreemapMove?.(source, target, placement)
      }
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
        const canvasBounds = container.current?.getBoundingClientRect()
        if (!drag?.moved || !canvasBounds || !canvasBounds.width || !canvasBounds.height) return
        const clientX = canvasBounds.left + x / instance.getWidth() * canvasBounds.width
        const clientY = canvasBounds.top + y / instance.getHeight() * canvasBounds.height
        type TreemapPoint = { name?: string; elementKey?: string; sourceSeriesName?: string; displayCategory?: string; displayValue?: string; displayLabel?: string; children?: TreemapPoint[] }
        const mainSeries = (instance.getOption() as { series?: Array<{ data?: TreemapPoint[] }> }).series?.[0]
        const flattened: TreemapPoint[] = []
        const visit = (points: TreemapPoint[]) => points.forEach((point) => { flattened.push(point); visit(point.children ?? []) })
        visit(mainSeries?.data ?? [])
        const visiblePath = (path: SVGPathElement) => {
          const fill = path.getAttribute('fill') ?? ''
          return fill !== 'none' && fill !== '#ffffff' && !/^rgba?\(0,\s*0,\s*0(?:,\s*0)?\)$/i.test(fill)
        }
        const leafPaths = [...(container.current?.querySelectorAll('svg path') ?? [])].filter((path): path is SVGPathElement => path instanceof SVGPathElement && visiblePath(path))
        const leaves = flattened.filter((point) => !point.children?.length)
        const hitPath = leafPaths
          .map((path) => ({ path, box: path.getBoundingClientRect() }))
          .filter(({ box }) => clientX >= box.left && clientX <= box.right && clientY >= box.top && clientY <= box.bottom)
          .sort((a, b) => a.box.width * a.box.height - b.box.width * b.box.height)[0]?.path
        const hit = hitPath ? leaves[leafPaths.indexOf(hitPath)] : undefined
        if (!hit) return
        const sourceIsGroup = drag.source.key.startsWith('treemap-group:')
        const category = hit.sourceSeriesName ?? hit.name ?? ''
        const targetPoint = sourceIsGroup ? flattened.find((point) => point.elementKey === `treemap-group:${category}`) : hit
        if (!targetPoint?.elementKey || targetPoint.elementKey === drag.source.key || !sourceIsGroup && (targetPoint.elementKey.startsWith('treemap-group:') || category !== drag.source.seriesName)) return
        const targetPaths = sourceIsGroup
          ? leafPaths.filter((_path, pathIndex) => leaves[pathIndex]?.sourceSeriesName === category)
          : [hitPath]
        const boxes = targetPaths.flatMap((path) => path ? [path.getBoundingClientRect()] : [])
        if (!boxes.length) return
        const targetBounds = {
          left: Math.min(...boxes.map((box) => box.left)),
          top: Math.min(...boxes.map((box) => box.top)),
          right: Math.max(...boxes.map((box) => box.right)),
          bottom: Math.max(...boxes.map((box) => box.bottom)),
        }
        const scaleX = instance.getWidth() / canvasBounds.width, scaleY = instance.getHeight() / canvasBounds.height
        const rect = {
          left: (targetBounds.left - canvasBounds.left) * scaleX,
          top: (targetBounds.top - canvasBounds.top) * scaleY,
          width: (targetBounds.right - targetBounds.left) * scaleX,
          height: (targetBounds.bottom - targetBounds.top) * scaleY,
        }
        const horizontalSplit = rect.width >= rect.height
        const placement: 'before' | 'after' = horizontalSplit
          ? x < rect.left + rect.width / 2 ? 'before' : 'after'
          : y < rect.top + rect.height / 2 ? 'before' : 'after'
        showTreemapIndicator(horizontalSplit
          ? { left: placement === 'before' ? rect.left : rect.left + rect.width, top: rect.top, width: 3, height: rect.height }
          : { left: rect.left, top: placement === 'before' ? rect.top : rect.top + rect.height, width: rect.width, height: 3 })
        const target: ChartElementSelection = sourceIsGroup
          ? { key: targetPoint.elementKey, seriesName: category, category, value: '', label: targetPoint.displayLabel ?? category }
          : { key: targetPoint.elementKey, seriesName: category, category: targetPoint.displayCategory ?? targetPoint.name ?? '', value: targetPoint.displayValue ?? '', label: targetPoint.displayLabel ?? targetPoint.name }
        const signature = `${target.key}:${placement}`
        if (drag.signature === signature) return
        drag.target = target
        drag.placement = placement
        drag.signature = signature
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
      const finishTreemapDrag = (params?: unknown) => {
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
        if (!drag.target && params) {
          const sourceIsGroup = drag.source.key.startsWith('treemap-group:')
          const target = treemapSelection(params, sourceIsGroup ? 'group' : 'leaf')?.selection
          if (target && target.key !== drag.source.key && (sourceIsGroup || target.seriesName === drag.source.seriesName)) sendTreemapMove(drag.source, target, 'before')
        }
      }
      instance.on('click', handler)
      instance.on('mousedown', treemapDown)
      instance.on('mouseup', finishTreemapDrag)
      instance.on('mouseover', hoverHandler)
      instance.on('globalout', resetHover)
      instance.on('mouseout', resetHover)
      instance.on('legendselectchanged', legendHandler)
      renderer.on('click', waterfallElementHandler)
      renderer.on('click', backgroundHandler)
      renderer.on('mousemove', treemapMove)
      renderer.on('mouseup', finishTreemapDrag)
      return () => {
        canvas?.removeEventListener('click', clickHandler, true)
        canvas?.removeEventListener('mousemove', moveHandler)
        canvas?.removeEventListener('mouseleave', leaveHandler)
        if (!instance.isDisposed()) {
          instance.off('click', handler)
          instance.off('mousedown', treemapDown)
          instance.off('mouseup', finishTreemapDrag)
          instance.off('mouseover', hoverHandler)
          instance.off('globalout', resetHover)
          instance.off('mouseout', resetHover)
          instance.off('legendselectchanged', legendHandler)
        }
        renderer.off('click', waterfallElementHandler)
        renderer.off('click', backgroundHandler)
        renderer.off('mousemove', treemapMove)
        renderer.off('mouseup', finishTreemapDrag)
        if (!treemapDrag.current) clearTreemapDragVisuals()
      }
    }, [activeCategoryLabel?.axis, activeCategoryLabel?.category, config, onAnnotationSelect, onClearSettingsFocus, onSelect, onSeriesSelect, onSettingsFocus, onTreemapMove, readyKind, selectedElementKey, selectedSeriesName, selectedSettingsSection, selectedTreemapSeriesName, table])

    useImperativeHandle(ref, () => ({
      async exportSvg(options) {
        const instance = chart.current
        if (!instance || !exportOption.current) return
        await document.fonts.ready
        instance.setOption(exportOption.current, true)
        instance.getZr().flush()
        if (config.kind === 'treemap') applyTreemapLayout(instance, container.current)
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
          if (displayOption.current) { instance.setOption(displayOption.current, true); instance.getZr().flush(); if (config.kind === 'treemap') applyTreemapLayout(instance, container.current, selectedElementKey) }
        }
      },
      async exportPng(options) {
        const instance = chart.current
        if (!instance || !exportOption.current) return
        await document.fonts.ready
        instance.setOption(exportOption.current, true)
        instance.getZr().flush()
        if (config.kind === 'treemap') applyTreemapLayout(instance, container.current)
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
          if (displayOption.current) { instance.setOption(displayOption.current, true); instance.getZr().flush(); if (config.kind === 'treemap') applyTreemapLayout(instance, container.current, selectedElementKey) }
        }
      },
    }), [config, richLayouts, selectedElementKey])

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
        <div className={`chart-canvas-shell logical-canvas ${config.kind === 'treemap' && !chartLayoutReady ? 'layout-pending' : ''}`} data-layout-ready={chartLayoutReady ? 'true' : 'false'} aria-busy={!chartLayoutReady} style={{ width: canvasWidth, height: canvasHeight, transform: canvasTransform }}>
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
