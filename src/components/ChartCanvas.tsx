import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import * as echarts from 'echarts'
import { getChartPlugin, getSeriesColor, prepareVisibleChartData } from '../core/chartRegistry'
import { nearestPixelIndex, prepareChartData, segmentEndpointIndex } from '../core/chartData'
import { sanitizeAnnotationHtml } from '../core/annotationHtml'
import type { ChartAnnotation, ChartConfig, ChartDecoration, ChartElementSelection, ChartSeriesSelection, DataTable } from '../core/types'
import { AnnotationDisplay, AnnotationOverlay } from './AnnotationOverlay'
import { DecorationOverlay } from './DecorationOverlay'
import { CanvasTextDisplay, CanvasTextOverlay } from './CanvasTextOverlay'
import { formatChartNumber, formatXAxisNumber } from '../core/numberFormat'
import { formatTimeValue } from '../core/timeFrequency'
import { measureTextWidth, measuredTextHeight, wrapMeasuredText } from '../core/textMetrics'
import { decorationGraphics, type PlotBounds } from './chartDecorations'
import { isAreaChart, isBarChart, isHorizontalBarChart, isStackedBarChart, isStackedChart } from '../core/chartKinds'

const isHorizontalBar = (config: ChartConfig) => isBarChart(config.kind) && (isHorizontalBarChart(config.kind) || config.barOrientation === 'horizontal')

export interface ChartCanvasHandle {
  exportSvg(): void
  exportPng(): Promise<void>
}

export type ChartSettingsSection = 'title' | 'subtitle' | 'x-axis-title' | 'y-axis-title' | 'x-axis-labels' | 'y-axis-labels' | 'grid' | 'legend' | 'values' | 'note' | 'source' | 'series' | 'element'

const RHYTHM = { edge: 24, titleSubtitle: 12, headerLegend: 20, headerPlot: 28, legendPlot: 24, plotFooter: 24, noteSource: 10 } as const

const download = (href: string, filename: string) => {
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = filename
  anchor.click()
}

export const customFontCss = (fonts: ChartConfig['customFonts']) => (fonts ?? []).map(({ name, dataUrl, weight = 400, style = 'normal' }) =>
  `@font-face{font-family:"${name.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}";src:url("${dataUrl}");font-weight:${weight};font-style:${style};}`
).join('')

const embedCustomFonts = (svg: SVGSVGElement, fonts: ChartConfig['customFonts']) => {
  const css = customFontCss(fonts)
  if (!css) return
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  style.textContent = css
  svg.prepend(style)
}

interface Props {
  table: DataTable
  config: ChartConfig
  onSelect?(selection: ChartElementSelection): void
  onSeriesSelect?(selection: ChartSeriesSelection): void
  onSettingsFocus?(section: ChartSettingsSection): void
  onClearSettingsFocus?(): void
  selectedSettingsSection?: ChartSettingsSection | null
  selectedSeriesName?: string | null
  selectedElementKey?: string | null
  selectedElementTarget?: ChartElementSelection['target']
  onAnnotationSelect?(id: string): void
  onAnnotationChange?(annotation: ChartAnnotation): void
  onAnnotationDuplicate?(annotation: ChartAnnotation): void
  onAnnotationDelete?(id: string): void
  selectedAnnotationId?: string | null
  selectedDecorationId?: string | null
  onDecorationSelect?(id: string): void
  onDecorationChange?(decoration: ChartDecoration): void
  onRichTextChange?(field: 'title' | 'subtitle' | 'note' | 'source', html: string, text: string): void
  viewZoom?: number
}

interface AnnotationRun { text: string; color: string; bold: boolean; italic: boolean; underline?: boolean; backgroundColor?: string; textStrokeColor?: string; textStrokeWidth?: string; fontFamily?: string; fontSize?: number }
interface RichLayout { left: number; top: number; width: number; size: number }
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

function directLabelWidth(config: ChartConfig, names: string[]) {
  const style = config.directLabelText ?? config.legendText, canvasWidth = Math.min(1000, config.canvasWidth ?? 1000)
  const noteSize = Math.max(8, style.size - 2)
  const lineWidth = (value: string, size: number, weight: number) => Math.max(0, ...value.split('\n').map((line) => measureTextWidth(line, size, style.fontFamily, weight)))
  const contentWidth = names.reduce((result, name) => {
    const label = config.seriesStyles[name]?.legendLabel?.trim() || name
    const note = config.seriesStyles[name]?.legendNote?.trim() || ''
    return Math.max(result, lineWidth(label, style.size, style.weight), lineWidth(note, noteSize, 400))
  }, 0)
  return Math.round(Math.min(Math.max(120, canvasWidth - 120), Math.max(style.size * 3, contentWidth + 10)))
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
  const preparedRaw = prepareVisibleChartData(table, config)
  const prepared = directNames ? { ...preparedRaw, series: preparedRaw.series.filter((series) => directNames.has(series.name)) } : preparedRaw
  const style = config.directLabelText ?? config.legendText
  if (!prepared.series.length) return []
  if (isHorizontalBar(config)) {
    const names = prepared.series.map((series) => series.name), width = directLabelWidth(config, names), lineHeight = Math.round(style.size * style.lineHeight / 100), noteSize = Math.max(8, style.size - 2), noteLineHeight = Math.round(noteSize * 1.25)
    const categoryPixels = prepared.categories.map((_, index) => {
      try {
        const pixel = instance.convertToPixel({ yAxisIndex: 0 }, index)
        return typeof pixel === 'number' && Number.isFinite(pixel) ? pixel : null
      } catch { return null }
    })
    const visibleCategoryPixels = categoryPixels.filter((pixel): pixel is number => pixel != null)
    const band = visibleCategoryPixels.length > 1 ? Math.min(...visibleCategoryPixels.slice(1).map((pixel, index) => Math.abs(pixel - visibleCategoryPixels[index])).filter((value) => value > 0)) : 40
    const stacked = isStackedChart(config.kind), count = stacked ? 1 : Math.max(1, prepared.series.length), gapRatio = Math.max(-.9, (config.barSeriesGap ?? 30) / 100)
    const groupWidth = band * Math.max(.1, Math.min(.95, (config.barWidth ?? 68) / 100)), normalWidth = groupWidth / Math.max(.1, count + Math.max(0, count - 1) * gapRatio)
    const topIndexes = [...prepared.categories.keys()]
    if (!(config.categoryAxisInverse ?? true)) topIndexes.reverse()
    return prepared.series.flatMap((series, seriesIndex) => {
      const index = topIndexes.find((current) => series.data[current] != null) ?? -1
      if (index < 0) return []
      const value = series.data[index]
      if (value == null) return []
      const previousValue = stacked ? prepared.series.slice(0, seriesIndex).reduce((sum, candidate) => {
        const part = candidate.data[index] ?? 0
        return Math.sign(part) === Math.sign(value) ? sum + part : sum
      }, 0) : 0
      const plottedValue = stacked ? previousValue + value : value
      let startX: unknown, endX: unknown, categoryY: unknown
      try { startX = instance.convertToPixel({ xAxisIndex: 0 }, previousValue); endX = instance.convertToPixel({ xAxisIndex: 0 }, plottedValue); categoryY = instance.convertToPixel({ yAxisIndex: 0 }, index) } catch { return [] }
      if (typeof startX !== 'number' || typeof endX !== 'number' || typeof categoryY !== 'number' || !Number.isFinite(startX) || !Number.isFinite(endX) || !Number.isFinite(categoryY)) return []
      const rowOffset = stacked ? 0 : -groupWidth / 2 + normalWidth / 2 + seriesIndex * normalWidth * (1 + gapRatio)
      const rowCenterX = (startX + endX) / 2, rowTopY = categoryY + rowOffset - normalWidth / 2
      const color = getSeriesColor(config, series.name, seriesIndex), seriesStyle = config.seriesStyles[series.name], note = seriesStyle?.legendNote?.trim() ?? '', name = seriesStyle?.legendLabel?.trim() || series.name
      const noteHeight = note ? Math.max(1, note.split('\n').length) * noteLineHeight : 0
      const height = Math.max(1, name.split('\n').length) * lineHeight + (noteHeight ? 3 + noteHeight : 0)
      const x = Math.max(4, Math.min(instance.getWidth() - width - 4, rowCenterX - width / 2))
      const y = Math.max(4, rowTopY - height - Math.max(8, config.directLabelGap ?? 14))
      const graphics: Record<string, unknown>[] = []
      if (config.showDirectLabelLines || seriesStyle?.showLegendLine) graphics.push({ id: `direct-legend-line-${series.name}`, type: 'polyline', z: 75, silent: true, shape: { points: [[rowCenterX, rowTopY], [rowCenterX, y + height + 3], [x + width / 2, y + height + 3]] }, style: { stroke: color, fill: 'none', lineWidth: config.directLabelLineWidth ?? 1, lineDash: config.directLabelLineType === 'dashed' ? [6, 4] : config.directLabelLineType === 'dotted' ? [2, 3] : undefined } })
      if (selected) graphics.push({ id: `direct-legend-selection-${series.name}`, type: 'rect', left: x - 4, top: y - 2, z: 75, silent: true, shape: { x: 0, y: 0, width: width + 8, height: height + 4, r: 5 }, style: { fill: 'rgba(0,0,0,0)', stroke: '#6956e8', lineWidth: 1 } })
      graphics.push({ id: `direct-legend-name-${series.name}`, type: 'text', left: x, top: y, z: 76, cursor: 'pointer', style: { text: name, width, fill: color, fontFamily: style.fontFamily, fontSize: style.size, fontWeight: style.weight, fontStyle: style.italic ? 'italic' : 'normal', lineHeight, align: 'center', textAlign: 'center' }, onclick: () => onFocus?.('legend') })
      if (note) graphics.push({ id: `direct-legend-note-${series.name}`, type: 'text', left: x, top: y + height - noteHeight, z: 76, cursor: 'pointer', style: { text: note, width, fill: color, fontFamily: style.fontFamily, fontSize: noteSize, fontWeight: 400, fontStyle: 'normal', lineHeight: noteLineHeight, align: 'center', textAlign: 'center', opacity: .78 }, onclick: () => onFocus?.('legend') })
      return graphics
    })
  }
  let dataMin = Number.POSITIVE_INFINITY, dataMax = Number.NEGATIVE_INFINITY
  prepared.series.forEach((series) => series.data.forEach((value) => {
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
  const names = prepared.series.map((series) => series.name), width = directLabelWidth(config, names)
  const categoryValue = (index: number) => index
  const pixelAt = (index: number) => {
    if (index < 0) return undefined
    try {
      const pixel = instance.convertToPixel({ xAxisIndex: 0 }, categoryValue(index))
      return typeof pixel === 'number' && Number.isFinite(pixel) ? pixel : undefined
    } catch { return undefined }
  }
  const lastX = pixelAt(prepared.categories.length - 1), previousX = pixelAt(prepared.categories.length - 2)
  const plotRight = lastX == null ? instance.getWidth() - width - 8 : lastX + (isBarChart(config.kind) && previousX != null ? Math.abs(lastX - previousX) / 2 : 0)
  const yTitleStyle = config.yAxisTitleText ?? config.axisTitleText
  const rightTitleInset = config.yAxisPosition === 'right' && config.showYAxisTitle && config.yAxisTitle
    ? Math.round(yTitleStyle.size * yTitleStyle.lineHeight / 100) * Math.max(1, config.yAxisTitle.split('\n').length) + config.yAxisTitleGap + 8
    : config.canvasMarginRight ?? 24
  const x = Math.max(4, Math.min(instance.getWidth() - width - rightTitleInset, plotRight + (config.directLabelGap ?? 14)))
  const lineHeight = Math.round(style.size * style.lineHeight / 100), noteSize = Math.max(8, style.size - 2), noteLineHeight = Math.round(noteSize * 1.25)
  const items = prepared.series.flatMap((series, seriesIndex) => {
    let index = -1
    for (let current = series.data.length - 1; current >= 0; current -= 1) if (series.data[current] != null) { index = current; break }
    if (index < 0) return []
    const value = series.data[index]
    if (value == null) return []
    const previousValue = isStackedChart(config.kind) ? prepared.series.slice(0, seriesIndex).reduce((sum, candidate) => {
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
    const seriesStyle = config.seriesStyles[series.name], note = seriesStyle?.legendNote?.trim() ?? ''
    const name = seriesStyle?.legendLabel?.trim() || series.name
    const nameHeight = Math.max(1, name.split('\n').length) * lineHeight
    const noteHeight = note ? Math.max(1, note.split('\n').length) * noteLineHeight : 0
    return [{ series, seriesIndex, point, name, nameHeight, note, height: nameHeight + (noteHeight ? 3 + noteHeight : 0), targetY: point[1] }]
  }).sort((left, right) => left.targetY - right.targetY)
  const totalTextHeight = items.reduce((sum, item) => sum + item.height, 0)
  const availableHeight = Math.max(0, bottom - top)
  const gap = items.length > 1 ? Math.max(2, Math.min(8, (availableHeight - totalTextHeight) / (items.length - 1))) : 0
  items.forEach((item, index) => { item.targetY = Math.max(top + item.height / 2, item.targetY); if (index) { const previous = items[index - 1]; item.targetY = Math.max(item.targetY, previous.targetY + previous.height / 2 + item.height / 2 + gap) } })
  if (items.length) items[items.length - 1].targetY = Math.min(items[items.length - 1].targetY, bottom - items[items.length - 1].height / 2)
  for (let index = items.length - 2; index >= 0; index -= 1) { const next = items[index + 1], item = items[index]; item.targetY = Math.min(item.targetY, next.targetY - next.height / 2 - item.height / 2 - gap) }
  if (items.length && items[0].targetY < top + items[0].height / 2) { const shift = top + items[0].height / 2 - items[0].targetY; items.forEach((item) => { item.targetY += shift }) }
  return items.flatMap((item) => {
    const color = getSeriesColor(config, item.series.name, item.seriesIndex), moved = Math.abs(item.targetY - item.point[1]) > 2
    const forced = config.seriesStyles[item.series.name]?.showLegendLine, showLine = forced ?? (config.showDirectLabelLines || moved)
    const graphics: Record<string, unknown>[] = []
    if (showLine) graphics.push({ id: `direct-legend-line-${item.series.name}`, type: 'polyline', z: 75, silent: true, shape: { points: [[item.point[0], item.point[1]], [x - 8, item.targetY], [x - 3, item.targetY]] }, style: { stroke: color, fill: 'none', lineWidth: config.directLabelLineWidth ?? 1, lineDash: config.directLabelLineType === 'dashed' ? [6, 4] : config.directLabelLineType === 'dotted' ? [2, 3] : undefined } })
    const blockTop = item.targetY - item.height / 2
    if (selected) graphics.push({ id: `direct-legend-selection-${item.series.name}`, type: 'rect', left: x - 4, top: blockTop - 2, z: 75, silent: true, shape: { x: 0, y: 0, width: width + 8, height: item.height + 4, r: 5 }, style: { fill: 'rgba(0,0,0,0)', stroke: '#6956e8', lineWidth: 1 } })
    graphics.push({ id: `direct-legend-name-${item.series.name}`, type: 'text', left: x, top: blockTop, z: 76, cursor: 'pointer', style: { text: item.name, width, fill: color, fontFamily: style.fontFamily, fontSize: style.size, fontWeight: style.weight, fontStyle: style.italic ? 'italic' : 'normal', lineHeight, align: 'left', textAlign: 'left' }, onclick: () => onFocus?.('legend') })
    if (item.note) graphics.push({ id: `direct-legend-note-${item.series.name}`, type: 'text', left: x, top: blockTop + item.nameHeight + 3, z: 76, cursor: 'pointer', style: { text: item.note, width, fill: color, fontFamily: style.fontFamily, fontSize: noteSize, fontWeight: 400, fontStyle: 'normal', lineHeight: noteLineHeight, align: 'left', textAlign: 'left', opacity: .78 }, onclick: () => onFocus?.('legend') })
    return graphics
  })
}
function valueLabelHitGraphics(instance: echarts.ECharts, table: DataTable, config: ChartConfig, allSelected: boolean, onSelect?: (selection: ChartElementSelection) => void, onFocus?: (section: ChartSettingsSection) => void) {
  if (!config.showValues && !Object.values(config.elementStyles).some((style) => style.showLabel)) return []
  const prepared = prepareVisibleChartData(table, config), horizontal = isHorizontalBar(config)
  const configured = config.valueLabelPosition ?? 'auto'
  const inside = configured.startsWith('inside-')
  let baseline: number
  try { baseline = Number(instance.convertToPixel(horizontal ? { xAxisIndex: 0 } : { yAxisIndex: 0 }, 0)) } catch { return [] }
  if (!Number.isFinite(baseline)) return []
  return prepared.series.flatMap((series, seriesIndex) => series.data.flatMap((value, dataIndex) => {
    if (value == null) return []
    const category = prepared.categories[dataIndex], key = `${series.name}\u001f${category instanceof Date ? category.toISOString() : `${typeof category}:${String(category)}`}`
    const override = config.elementStyles[key]
    if (!(override?.showLabel ?? config.showValues)) return []
    const style = override?.valueText ?? config.valueText, label = override?.label || formatChartNumber(value, config)
    const previousValue = isStackedChart(config.kind) ? prepared.series.slice(0, seriesIndex).reduce((sum, candidate) => {
      const part = candidate.data[dataIndex] ?? 0
      return Math.sign(part) === Math.sign(value) ? sum + part : sum
    }, 0) : 0
    const plottedValue = isStackedChart(config.kind) ? previousValue + value : value
    let categoryPixel: number, valuePixel: number
    try {
      categoryPixel = Number(instance.convertToPixel(horizontal ? { yAxisIndex: 0 } : { xAxisIndex: 0 }, dataIndex))
      valuePixel = Number(instance.convertToPixel(horizontal ? { xAxisIndex: 0 } : { yAxisIndex: 0 }, plottedValue))
      if (isStackedBarChart(config.kind)) baseline = Number(instance.convertToPixel(horizontal ? { xAxisIndex: 0 } : { yAxisIndex: 0 }, previousValue))
    } catch { return [] }
    if (!Number.isFinite(categoryPixel) || !Number.isFinite(valuePixel)) return []
    const width = Math.max(18, measureTextWidth(label, style.size, style.fontFamily, style.weight) + 10)
    const height = Math.max(14, Math.round(style.size * style.lineHeight / 100) + 6)
    let x = categoryPixel - width / 2, y = valuePixel - height - 3
    if (horizontal) {
      x = valuePixel + 3; y = categoryPixel - height / 2
      if (inside) x = configured === 'inside-center' ? (baseline + valuePixel) / 2 - width / 2 : configured === 'inside-bottom' ? baseline + (valuePixel >= baseline ? 3 : -width - 3) : valuePixel + (valuePixel >= baseline ? -width - 3 : 3)
      else if (configured === 'bottom') x = baseline + (valuePixel >= baseline ? -width - 3 : 3)
    } else if (inside) {
      y = configured === 'inside-center' ? (baseline + valuePixel) / 2 - height / 2 : configured === 'inside-bottom' ? baseline + (valuePixel <= baseline ? -height - 3 : 3) : valuePixel + (valuePixel <= baseline ? 3 : -height - 3)
    } else if (configured === 'bottom') y = baseline + (valuePixel <= baseline ? 3 : -height - 3)
    return [{ id: `value-label-hit-${seriesIndex}-${dataIndex}`, type: 'rect', z: 130, cursor: 'pointer', shape: { x, y, width, height }, style: { fill: 'rgba(0,0,0,0)' }, onclick: () => {
      if (!allSelected) { onFocus?.('values'); return }
      onSelect?.({ key, seriesName: series.name, category: category instanceof Date ? formatTimeValue(category, table.timeProfiles?.[config.xField], config.dateLabelFormat) : String(category ?? ''), value: formatChartNumber(value, config), target: 'value-label' })
      onFocus?.('element')
    } }]
  }))
}
// oxlint-disable-next-line react/only-export-components -- exported for axis-affix rendering regression tests
export function axisAffixGraphics(instance: echarts.ECharts, config: ChartConfig, bounds: PlotBounds | null) {
  if ((!config.numberPrefix && !config.numberSuffix) || !bounds || isHorizontalBar(config)) return []
  const option = instance.getOption() as unknown as { yAxis?: Array<{ max?: number }> }
  const maximum = Number(option.yAxis?.[0]?.max)
  if (!Number.isFinite(maximum)) return []
  const style = config.yAxisLabelText ?? config.axisLabelText
  const number = formatChartNumber(maximum, config), lineHeight = Math.round(style.size * style.lineHeight / 100)
  const numberWidth = measureTextWidth(number, style.size, style.fontFamily, style.weight)
  const opticalTop = bounds.top - lineHeight / 2
  const anchor = config.yAxisPosition === 'right' ? bounds.right + 8 : bounds.left - 8
  const numberLeft = config.yAxisPosition === 'right' ? anchor : anchor - numberWidth
  const baseStyle = { fill: style.color, fontFamily: style.fontFamily, fontSize: style.size, fontWeight: style.weight, fontStyle: style.italic ? 'italic' : 'normal', lineHeight, padding: 0 }
  const prefixWidth = config.numberPrefix ? measureTextWidth(config.numberPrefix, style.size, style.fontFamily, style.weight) : 0
  const suffixWidth = config.numberSuffix ? measureTextWidth(config.numberSuffix, style.size, style.fontFamily, style.weight) : 0
  const graphics: Array<Record<string, unknown>> = [{ id: 'axis-y-top-background', type: 'rect', z: 124, silent: true, shape: { x: numberLeft - 6, y: opticalTop - 2, width: prefixWidth + numberWidth + suffixWidth + 12, height: lineHeight + 4, r: 2 }, style: { fill: config.canvasBackground ?? '#ffffff' } }, { id: 'axis-y-top-number', type: 'text', z: 125, silent: true, left: numberLeft + prefixWidth, top: opticalTop, style: { ...baseStyle, text: number } }]
  if (config.numberPrefix) {
    graphics.push({ id: 'axis-y-top-prefix', type: 'text', z: 125, silent: true, left: numberLeft, top: opticalTop, style: { ...baseStyle, text: config.numberPrefix } })
  }
  if (config.numberSuffix) graphics.push({ id: 'axis-y-top-suffix', type: 'text', z: 125, silent: true, left: numberLeft + prefixWidth + numberWidth, top: opticalTop, style: { ...baseStyle, text: config.numberSuffix } })
  return graphics
}
// oxlint-disable-next-line react/only-export-components -- exported for axis-affix rendering regression tests
export function xAxisEdgeGraphics(instance: echarts.ECharts, table: DataTable, config: ChartConfig, bounds: PlotBounds | null) {
  if ((!config.xAxisStartLabel && !config.xAxisEndLabel) || !bounds) return []
  const continuous = config.kind === 'scatter' || config.kind === 'bubble' || isHorizontalBar(config)
  const prepared = prepareVisibleChartData(table, config)
  const categoryEndpoints = prepared.categories.flatMap((value, index) => typeof value === 'number' && Number.isFinite(value) ? [{ value, index }] : [])
  const option = instance.getOption() as unknown as { xAxis?: Array<{ min?: number; max?: number }> }
  const axisMin = Number(option.xAxis?.[0]?.min), axisMax = Number(option.xAxis?.[0]?.max)
  if (continuous ? !Number.isFinite(axisMin) || !Number.isFinite(axisMax) : !categoryEndpoints.length) return []
  const style = config.xAxisLabelText ?? config.axisLabelText
  const lineHeight = Math.round(style.size * style.lineHeight / 100)
  const labelTop = config.xAxisPosition === 'top' ? bounds.top - (config.showXTicks ? config.tickLength : 0) - 8 - lineHeight : bounds.bottom + (config.showXTicks ? config.tickLength : 0) + 6
  const baseStyle = { fill: style.color, fontFamily: style.fontFamily, fontSize: style.size, fontWeight: style.weight, fontStyle: style.italic ? 'italic' : 'normal', lineHeight, verticalAlign: 'top', backgroundColor: config.canvasBackground ?? '#ffffff', padding: 0 }
  const endpoints = continuous
    ? [{ id: 'start', value: axisMin, pixelValue: axisMin, label: config.xAxisStartLabel }, { id: 'end', value: axisMax, pixelValue: axisMax, label: config.xAxisEndLabel }]
    : [{ id: 'start', value: categoryEndpoints[0].value, pixelValue: categoryEndpoints[0].index, label: config.xAxisStartLabel }, { id: 'end', value: categoryEndpoints.at(-1)!.value, pixelValue: categoryEndpoints.at(-1)!.index, label: config.xAxisEndLabel }]
  return endpoints.flatMap(({ id, value, pixelValue, label }) => {
    if (!label) return []
    let pixel: number
    try { pixel = Number(instance.convertToPixel({ xAxisIndex: 0 }, pixelValue)) } catch { return [] }
    if (!Number.isFinite(pixel)) return []
    const number = formatXAxisNumber(value, config), numberWidth = measureTextWidth(number, style.size, style.fontFamily, style.weight)
    const numberLeft = pixel - numberWidth / 2
    return [
      { id: `axis-x-edge-${id}-number`, type: 'text', z: 125, silent: true, x: numberLeft, y: labelTop, style: { ...baseStyle, text: number } },
      { id: `axis-x-edge-${id}-label`, type: 'text', z: 125, silent: true, x: numberLeft + numberWidth, y: labelTop, style: { ...baseStyle, text: label } },
    ]
  })
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
  const series = option.series as Array<{ endLabel?: { show?: boolean }; labelLine?: { show?: boolean }; data?: Array<Record<string, unknown> | null> }> | undefined
  series?.forEach((item) => {
    if (item.endLabel) item.endLabel.show = false
    if (item.labelLine) item.labelLine.show = false
    item.data?.forEach((point) => {
      if (!point?.directLegendLabel) return
      const override = config.elementStyles[String(point.elementKey ?? '')]
      const valueText = override?.valueText ?? config.valueText
      point.label = { show: override?.showLabel ?? config.showValues, position: 'top', formatter: override?.label || undefined, fontFamily: valueText.fontFamily, fontSize: valueText.size, color: valueText.color, fontWeight: valueText.weight, fontStyle: valueText.italic ? 'italic' : 'normal', lineHeight: Math.round(valueText.size * valueText.lineHeight / 100) }
      if (point.labelLine) point.labelLine = { ...(point.labelLine as object), show: false }
    })
  })
}

function chartPlotBounds(instance: echarts.ECharts, table: DataTable, config: ChartConfig): PlotBounds | null {
  const option = instance.getOption() as unknown as { xAxis?: Array<{ min?: number; max?: number }>; yAxis?: Array<{ min?: number; max?: number }>; grid?: Array<{ left?: number; right?: number; top?: number; bottom?: number }> }
  if (isHorizontalBar(config)) {
    const grid = option.grid?.[0], left = Number(grid?.left), right = Number(grid?.right), top = Number(grid?.top), bottom = Number(grid?.bottom)
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
// oxlint-disable-next-line react/only-export-components -- exported for selection rendering regression tests
export function applySeriesVisualState(option: Record<string, unknown>, table: DataTable, config: ChartConfig, selectedSeriesName?: string | null, selectedElementKey?: string | null, hoveredSeriesName?: string | null) {
  const activeSeriesName = hoveredSeriesName ?? selectedSeriesName ?? selectedElementKey?.split('\u001f')[0] ?? null
  const series = option.series as Array<{ name?: string; segmentOf?: string; customBarOf?: string; type?: string; silent?: boolean; z?: number; itemStyle?: Record<string, unknown>; lineStyle?: Record<string, unknown>; areaStyle?: Record<string, unknown>; emphasis?: Record<string, unknown>; blur?: Record<string, unknown>; data?: Array<Record<string, unknown> | null> }> | undefined
  const seriesOrder = prepareVisibleChartData(table, config).series.map((item) => item.name)
  series?.forEach((item) => {
    if (item.emphasis) delete item.emphasis.focus
    delete item.blur
    const rawName = item.name ?? ''
    if (rawName.startsWith('__') && !rawName.startsWith('__hit__:')) return
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
        const selectedBorderWidth = item.type === 'bar' ? Number(pointStyle?.borderWidth ?? 0) : Math.max(Number(pointStyle?.borderWidth ?? 0), item.type === 'line' ? 2.5 : 1.5)
        point.itemStyle = {
          ...pointStyle,
          opacity: 1,
          color: item.type === 'line' ? seriesColor : pointStyle?.color ?? seriesColor,
          borderColor: pointStyle?.borderColor ?? seriesColor,
          ...(selectedBorderWidth ? { borderWidth: selectedBorderWidth } : {}),
          shadowColor: seriesColor,
          shadowBlur: item.type === 'bar' ? 0 : 6,
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
  ({ table, config, onSelect, onSeriesSelect, onSettingsFocus, onClearSettingsFocus, selectedSettingsSection, selectedSeriesName, selectedElementKey, selectedElementTarget, onAnnotationSelect, onAnnotationChange, onAnnotationDuplicate, onAnnotationDelete, selectedAnnotationId, selectedDecorationId, onDecorationSelect, onDecorationChange, onRichTextChange, viewZoom = 1 }, ref) => {
    const container = useRef<HTMLDivElement>(null)
    const viewport = useRef<HTMLDivElement>(null)
    const [canvasScale, setCanvasScale] = useState(1)
    const [renderError, setRenderError] = useState('')
    const [plotBounds, setPlotBounds] = useState<PlotBounds | null>(null)
    const [richLayouts, setRichLayouts] = useState<Partial<Record<'title' | 'subtitle' | 'note' | 'source', RichLayout>>>({})
    const chart = useRef<echarts.ECharts | null>(null)
    const displayOption = useRef<Record<string, unknown> | null>(null)
    const exportOption = useRef<Record<string, unknown> | null>(null)
    const clickedSeries = useRef<string | null>(null)
    const lastPointer = useRef<[number, number] | null>(null)
    const [hoveredSeriesName, setHoveredSeriesName] = useState<string | null>(null)

    useEffect(() => { clickedSeries.current = selectedSeriesName ?? null }, [selectedSeriesName])

    useEffect(() => {
      if (!container.current) return
      const instance = echarts.init(container.current, undefined, { renderer: 'svg' })
      chart.current = instance
      const resize = () => { if (!instance.isDisposed()) instance.resize() }
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
        if (chart.current && !chart.current.isDisposed()) chart.current.resize({ width, height })
      }
      const observer = new ResizeObserver(updateScale)
      observer.observe(target)
      updateScale()
      return () => observer.disconnect()
    }, [config.autoFitCanvas, config.canvasHeight, config.canvasWidth])

    useEffect(() => {
      const instance = chart.current
      if (!instance || instance.isDisposed()) return
      try {
      const selectDecoration = onDecorationSelect ?? ((id: string) => { const decoration = config.decorations?.find((item) => item.id === id); if (decoration) onDecorationChange?.(decoration) })
      const visibleTitle = config.showTitle === false ? '' : config.title
      const visibleSubtitle = config.showSubtitle === false ? '' : config.subtitle
      const visibleNote = config.showNote === false ? '' : config.note
      const visibleSource = config.showSource === false ? '' : config.source
      const marginTop = config.canvasMarginTop ?? RHYTHM.edge, marginRight = config.canvasMarginRight ?? RHYTHM.edge, marginBottom = config.canvasMarginBottom ?? RHYTHM.edge, marginLeft = config.canvasMarginLeft ?? 32
      const renderConfig = { ...config, title: visibleTitle, subtitle: visibleSubtitle, note: visibleNote, source: visibleSource }
      const option = getChartPlugin(config.kind).buildOption(table, renderConfig) as Record<string, unknown> & { graphic?: unknown[] }
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
        if (titleHeight + subtitleHeight + (visibleTitle && visibleSubtitle ? RHYTHM.titleSubtitle : 0) <= canvasHeight * .38 || headerScale <= .62) break
        headerScale -= .06
      }
      const renderedTitleSize = Math.max(12, Math.round(richTextSize(config.titleHtml, config.titleText.size) * headerScale))
      const renderedSubtitleSize = Math.max(10, Math.round(richTextSize(config.subtitleHtml, config.subtitleText.size) * headerScale))
      const titleOption = option.title as { text?: string; subtext?: string; textStyle?: Record<string, unknown>; subtextStyle?: Record<string, unknown> } | undefined
      if (titleOption) {
        titleOption.text = ''
        titleOption.subtext = ''
      }
      const legend = option.legend as { show?: boolean; top?: number; bottom?: number; left?: number; right?: number; textStyle?: object } | undefined
      const titleBottom = visibleTitle ? marginTop + titleHeight : marginTop
      const subtitleTop = visibleSubtitle ? titleBottom + (visibleTitle ? RHYTHM.titleSubtitle : 0) : titleBottom
      const headerContentBottom = visibleSubtitle ? subtitleTop + subtitleHeight : titleBottom
      const standardLegend = config.showLegend && !config.showDirectLabels
      const legendPosition = config.legendPosition ?? 'top'
      const legendLineHeight = Math.round(renderConfig.legendText.size * renderConfig.legendText.lineHeight / 100)
      const legendNames = prepareVisibleChartData(table, config).series.map((series) => series.name)
      const legendItemWidth = isBarChart(config.kind) ? 10 : 24
      let legendRows = 1, occupied = 0
      legendNames.forEach((name) => { const itemWidth = legendItemWidth + 10 + measureTextWidth(name, renderConfig.legendText.size, renderConfig.legendText.fontFamily, renderConfig.legendText.weight) + 14; if (occupied && occupied + itemWidth > availableWidth) { legendRows += 1; occupied = itemWidth } else occupied += itemWidth })
      const legendHeight = legendNames.length ? legendRows * legendLineHeight + Math.max(0, legendRows - 1) * 7 : 0
      const sideLegendContentWidth = legendNames.reduce((result, name) => Math.max(result, legendItemWidth + 18 + measureTextWidth(name, renderConfig.legendText.size, renderConfig.legendText.fontFamily, renderConfig.legendText.weight)), 90)
      const sideLegendWidth = Math.min((container.current?.clientWidth ?? 1000) * .28, sideLegendContentWidth)
      const yTitleStyle = config.yAxisTitleText ?? config.axisTitleText
      const yTitleThickness = config.showYAxisTitle && config.yAxisTitle
        ? Math.round(yTitleStyle.size * yTitleStyle.lineHeight / 100) * Math.max(1, config.yAxisTitle.split('\n').length) + config.yAxisTitleGap
        : 0
      const grid = option.grid as { top?: number; bottom?: number; left?: number; right?: number } | undefined
      const oldHeaderBase = visibleSubtitle || (standardLegend && legendPosition === 'top') ? 104 : 78
      const topAxisExtra = config.xAxisPosition === 'top' ? Math.max(0, Number(grid?.top ?? oldHeaderBase) - oldHeaderBase) : 0
      const hasHeader = Boolean(visibleTitle || visibleSubtitle)
      const topLegendY = headerContentBottom + (hasHeader ? RHYTHM.headerLegend : 0)
      if (legend && legend.show !== false && legendPosition === 'top') legend.top = topLegendY
      if (grid) grid.top = (standardLegend && legendPosition === 'top' ? topLegendY + legendHeight + RHYTHM.legendPlot : headerContentBottom + (hasHeader ? RHYTHM.headerPlot : 0)) + topAxisExtra
      const individualValueStyles = Object.values(config.elementStyles).flatMap((item) => item.showLabel || item.valueText ? [item.valueText ?? config.valueText] : [])
      const visibleValueStyles = config.showValues ? [config.valueText, ...individualValueStyles] : individualValueStyles
      const valueLabelSpace = visibleValueStyles.reduce((space, valueStyle) => Math.max(space, Math.round(valueStyle.size * valueStyle.lineHeight / 100) + 8), 0)
      if (grid && valueLabelSpace && !(config.valueLabelPosition ?? '').startsWith('inside-')) {
        const valuePosition = config.valueLabelPosition ?? 'auto'
        if (isHorizontalBar(config)) {
          if (valuePosition === 'bottom') grid.left = Number(grid.left ?? 0) + valueLabelSpace
          else grid.right = Number(grid.right ?? 0) + valueLabelSpace
        } else if (valuePosition === 'bottom') grid.bottom = Number(grid.bottom ?? 0) + valueLabelSpace
        else grid.top = Number(grid.top ?? 0) + valueLabelSpace
      }
      if (grid && config.showDirectLabels && isHorizontalBar(config)) {
        const directStyle = config.directLabelText ?? config.legendText
        const directLineHeight = Math.round(directStyle.size * directStyle.lineHeight / 100)
        const directNoteHeight = Math.max(8, directStyle.size - 2) * 1.25
        const directRows = prepareVisibleChartData(table, config).series.reduce((height, series) => {
          const label = config.seriesStyles[series.name]?.legendLabel?.trim() || series.name
          const note = config.seriesStyles[series.name]?.legendNote?.trim() || ''
          return Math.max(height, Math.max(1, label.split('\n').length) * directLineHeight + (note ? 3 + Math.max(1, note.split('\n').length) * directNoteHeight : 0))
        }, 0)
        grid.top = Number(grid.top ?? 0) + Math.ceil(directRows + Math.max(8, config.directLabelGap ?? 14))
      }
      const noteRenderSize = richTextSize(config.noteHtml, renderConfig.noteText.size)
      const sourceRenderSize = richTextSize(config.sourceHtml, renderConfig.sourceText.size)
      const noteHeight = measuredTextHeight(visibleNote, noteRenderSize, renderConfig.noteText.lineHeight, availableWidth, renderConfig.noteText.fontFamily, renderConfig.noteText.weight)
      const sourceHeight = measuredTextHeight(visibleSource, sourceRenderSize, renderConfig.sourceText.lineHeight, availableWidth, renderConfig.sourceText.fontFamily, renderConfig.sourceText.weight)
      const nextRichLayouts = {
        title: { left: marginLeft, top: marginTop, width: availableWidth, size: renderedTitleSize },
        subtitle: { left: marginLeft, top: subtitleTop, width: availableWidth, size: renderedSubtitleSize },
        note: { left: marginLeft, top: canvasHeight - marginBottom - sourceHeight - (visibleSource ? RHYTHM.noteSource : 0) - noteHeight, width: availableWidth, size: noteRenderSize },
        source: { left: marginLeft, top: canvasHeight - marginBottom - sourceHeight, width: availableWidth, size: sourceRenderSize },
      }
      setRichLayouts((current) => Object.keys(nextRichLayouts).every((key) => { const field = key as keyof typeof nextRichLayouts; return current[field] && Object.entries(nextRichLayouts[field]).every(([name, value]) => current[field]?.[name as keyof RichLayout] === value) }) ? current : nextRichLayouts)
      const footerContentHeight = noteHeight + sourceHeight + (visibleNote && visibleSource ? RHYTHM.noteSource : 0)
      const footerBlockHeight = visibleNote || visibleSource ? marginBottom + footerContentHeight : 0
      const xAxisTitleStyle = isHorizontalBar(config) ? config.yAxisTitleText ?? config.axisTitleText : config.xAxisTitleText ?? config.axisTitleText
      const physicalXAxisTitle = isHorizontalBar(config) ? config.yAxisTitle : config.xAxisTitle
      const showPhysicalXAxisTitle = isHorizontalBar(config) ? config.showYAxisTitle : config.showXAxisTitle
      const physicalXAxisTitleGap = isHorizontalBar(config) ? config.yAxisTitleGap : config.xAxisTitleGap
      const xAxisTitleReserve = showPhysicalXAxisTitle && physicalXAxisTitle ? Math.round(xAxisTitleStyle.size * xAxisTitleStyle.lineHeight / 100) * Math.max(1, physicalXAxisTitle.split('\n').length) + physicalXAxisTitleGap : 0
      const bottomAxisReserve = config.xAxisPosition === 'bottom' ? xAxisTitleReserve : 0
      if (grid && footerBlockHeight) grid.bottom = Math.max(Number(grid.bottom ?? 0), footerBlockHeight + 12 + bottomAxisReserve)
      if (standardLegend && legendPosition === 'bottom') {
        const legendBottom = footerBlockHeight ? footerBlockHeight + RHYTHM.headerLegend : marginBottom
        if (legend) legend.bottom = legendBottom
        if (grid) grid.bottom = legendBottom + legendHeight + RHYTHM.legendPlot
      }
      if (standardLegend && legendPosition === 'left' && grid) grid.left = Math.max(Number(grid.left ?? 0), sideLegendWidth + marginLeft + (config.yAxisPosition === 'left' ? yTitleThickness : 0))
      if (standardLegend && legendPosition === 'right' && grid) grid.right = Math.max(Number(grid.right ?? 0), sideLegendWidth + marginRight + (config.yAxisPosition === 'right' ? yTitleThickness : 0))
      if (grid) {
        const canvasWidth = config.canvasWidth ?? container.current?.clientWidth ?? 1000
        const minimumPlotWidth = Math.min(220, canvasWidth * .45)
        const minimumPlotHeight = Math.min(180, canvasHeight * .42)
        const left = Math.max(0, Number(grid.left ?? 0)), right = Math.max(0, Number(grid.right ?? 0))
        const top = Math.max(0, Number(grid.top ?? 0)), bottom = Math.max(0, Number(grid.bottom ?? 0))
        const horizontalOverflow = Math.max(0, left + right + minimumPlotWidth - canvasWidth)
        const verticalOverflow = Math.max(0, top + bottom + minimumPlotHeight - canvasHeight)
        grid.left = Math.max(0, Math.round(left - horizontalOverflow * left / Math.max(1, left + right)))
        grid.right = Math.max(0, Math.round(right - horizontalOverflow * right / Math.max(1, left + right)))
        grid.top = Math.max(0, Math.round(top - verticalOverflow * top / Math.max(1, top + bottom)))
        grid.bottom = Math.max(0, Math.round(bottom - verticalOverflow * bottom / Math.max(1, top + bottom)))
      }
      suppressBuiltInDirectLabels(option, config)
      const cleanOption = cloneChartOption(option)
      applySeriesVisualState(option, table, config, selectedSeriesName, selectedElementKey, hoveredSeriesName)
      for (const axisKey of ['xAxis', 'yAxis'] as const) {
        const axis = option[axisKey] as { nameTextStyle?: object; axisLabel?: object } | undefined
        if (!axis) continue
        if (selectedSettingsSection === `${axisKey[0]}-axis-title`) axis.nameTextStyle = { ...axis.nameTextStyle, ...selectionStyle }
        if (selectedSettingsSection === `${axisKey[0]}-axis-labels`) axis.axisLabel = { ...axis.axisLabel, ...selectionStyle }
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
        series?.forEach((item) => item.data?.forEach((point) => {
          if (!point || typeof point !== 'object') return
          const dataPoint = point as Record<string, unknown>
          if (dataPoint.elementKey !== selectedElementKey || item.name?.startsWith('__hit__:')) return
          if (selectedElementTarget === 'value-label') {
            dataPoint.label = { ...((dataPoint.label ?? {}) as object), show: true, ...labelSelectionStyle }
            return
          }
          if (item.type === 'line' && (!dataPoint.symbolSize || Number(dataPoint.symbolSize) < 8)) dataPoint.symbolSize = 8
        }))
      }
      const existing = Array.isArray(option.graphic) ? option.graphic : []
      const plotMiddleY = grid ? (Number(grid.top ?? 0) + canvasHeight - Number(grid.bottom ?? 0)) / 2 : canvasHeight / 2
      const yTitleSideOffset = standardLegend && legendPosition === config.yAxisPosition ? sideLegendWidth + (config.yAxisPosition === 'left' ? marginLeft : marginRight) + 8 : config.yAxisPosition === 'left' ? marginLeft : marginRight
      const yTitleX = config.yAxisPosition === 'left' ? yTitleSideOffset : (config.canvasWidth ?? 1000) - yTitleSideOffset
      const titleRich = richBlockStyle(config.titleHtml, visibleTitle, config.titleText, renderedTitleSize)
      const subtitleRich = richBlockStyle(config.subtitleHtml, visibleSubtitle, config.subtitleText, renderedSubtitleSize)
      const noteRich = richBlockStyle(config.noteHtml, visibleNote, config.noteText)
      const sourceRich = richBlockStyle(config.sourceHtml, visibleSource, config.sourceText)
      const titleHits = [
        visibleTitle && { id: 'chart-title-hit', type: 'text', left: config.titleText.align === 'left' ? marginLeft : config.titleText.align === 'center' ? 'center' : undefined, right: config.titleText.align === 'right' ? marginRight : undefined, top: marginTop, z: 20, cursor: 'pointer', style: { text: titleRich?.text ?? wrappedTitle.text, width: availableWidth, overflow: 'break', fontFamily: config.titleText.fontFamily, fontSize: renderedTitleSize, fontWeight: config.titleText.weight, fontStyle: config.titleText.italic ? 'italic' : 'normal', lineHeight: Math.round(renderedTitleSize * config.titleText.lineHeight / 100), fill: config.titleText.color, align: config.titleText.align, rich: titleRich?.rich, opacity: config.titleHtml || selectedSettingsSection === 'title' ? 0 : 1, ...(selectedSettingsSection === 'title' ? selectionStyle : {}) }, onclick: () => onSettingsFocus?.('title') },
        visibleSubtitle && { id: 'chart-subtitle-hit', type: 'text', left: config.subtitleText.align === 'left' ? marginLeft : config.subtitleText.align === 'center' ? 'center' : undefined, right: config.subtitleText.align === 'right' ? marginRight : undefined, top: subtitleTop, z: 20, cursor: 'pointer', style: { text: subtitleRich?.text ?? wrappedSubtitle.text, width: availableWidth, overflow: 'break', fontFamily: config.subtitleText.fontFamily, fontSize: renderedSubtitleSize, fontWeight: config.subtitleText.weight, fontStyle: config.subtitleText.italic ? 'italic' : 'normal', lineHeight: Math.round(renderedSubtitleSize * config.subtitleText.lineHeight / 100), fill: config.subtitleText.color, align: config.subtitleText.align, rich: subtitleRich?.rich, opacity: config.subtitleHtml || selectedSettingsSection === 'subtitle' ? 0 : 1, ...(selectedSettingsSection === 'subtitle' ? selectionStyle : {}) }, onclick: () => onSettingsFocus?.('subtitle') },
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
        if (item.id === 'chart-y-axis-title') return { ...item, left: undefined, right: undefined, top: undefined, x: yTitleX, y: plotMiddleY, cursor: 'pointer', style: { ...(item as { style?: object }).style, ...(selectedSettingsSection === 'y-axis-title' ? selectionStyle : {}) }, onclick: () => onSettingsFocus?.('y-axis-title') }
        if (item.id === 'chart-note') return { ...item, left: marginLeft, bottom: visibleSource ? marginBottom + sourceHeight + RHYTHM.noteSource : marginBottom, cursor: 'pointer', style: { ...(item as { style?: object }).style, width: availableWidth, overflow: 'break', ...(noteRich ?? {}), opacity: config.noteHtml || selectedSettingsSection === 'note' ? 0 : 1, ...(selectedSettingsSection === 'note' ? selectionStyle : {}) }, onclick: () => onSettingsFocus?.('note') }
        if (item.id === 'chart-source') return { ...item, left: marginLeft, bottom: marginBottom, cursor: 'pointer', style: { ...(item as { style?: object }).style, width: availableWidth, overflow: 'break', ...(sourceRich ?? {}), opacity: config.sourceHtml || selectedSettingsSection === 'source' ? 0 : 1, ...(selectedSettingsSection === 'source' ? selectionStyle : {}) }, onclick: () => onSettingsFocus?.('source') }
        return graphic
      })
      const displayDecorations = decorationGraphics(config.decorations ?? [], undefined, selectDecoration)
      option.graphic = [...chartLabels, ...displayDecorations, ...titleHits, ...annotations]
      const cleanTitleHits = titleHits.map((graphic) => {
        if (!graphic || typeof graphic !== 'object') return graphic
        const item = graphic as { style?: Record<string, unknown> }
        const style: Record<string, unknown> = { ...item.style, opacity: 1 }
        for (const key of ['backgroundColor', 'borderColor', 'borderWidth', 'borderRadius', 'padding']) delete style[key]
        return { ...item, style }
      })
      const cleanLabels = (Array.isArray(cleanOption.graphic) ? cleanOption.graphic : []).map((graphic) => {
        if (!graphic || typeof graphic !== 'object') return graphic
        const item = graphic as { id?: string; style?: object }
        if (item.id === 'chart-y-axis-title') return { ...item, left: undefined, right: undefined, top: undefined, x: yTitleX, y: plotMiddleY }
        if (item.id === 'chart-note') return { ...item, left: marginLeft, bottom: visibleSource ? marginBottom + sourceHeight + RHYTHM.noteSource : marginBottom, style: { ...item.style, width: availableWidth, overflow: 'break', ...(noteRich ?? {}) } }
        if (item.id === 'chart-source') return { ...item, left: marginLeft, bottom: marginBottom, style: { ...item.style, width: availableWidth, overflow: 'break', ...(sourceRich ?? {}) } }
        return item
      })
      cleanOption.graphic = [...cleanLabels, ...decorationGraphics(config.decorations ?? []), ...cleanTitleHits, ...annotations.map((annotation) => ({ ...annotation, style: { ...annotation.style, opacity: 1 } }))]
      instance.setOption(option, true)
      const exactBounds = chartPlotBounds(instance, table, config)
      if (exactBounds) setPlotBounds((current) => current && Math.abs(current.top - exactBounds.top) < .5 && Math.abs(current.bottom - exactBounds.bottom) < .5 && Math.abs(current.left - exactBounds.left) < .5 && Math.abs(current.right - exactBounds.right) < .5 ? current : exactBounds)
      const withoutGeneratedGraphics = (graphics: unknown[]) => graphics.filter((graphic) => {
        if (!graphic || typeof graphic !== 'object') return true
        const id = String((graphic as { id?: string }).id ?? '')
        return !id.startsWith('decoration-') && !id.startsWith('bar-vertical-grid-') && !id.startsWith('value-label-hit-') && !id.startsWith('axis-y-top-') && !id.startsWith('axis-x-edge-') && !id.startsWith('selection-')
      })
      const exactDisplayDecorations = decorationGraphics(config.decorations ?? [], exactBounds ?? undefined, selectDecoration)
      const exactCleanDecorations = decorationGraphics(config.decorations ?? [], exactBounds ?? undefined)
      const suffixGraphics = axisAffixGraphics(instance, config, exactBounds)
      const edgeGraphics = xAxisEdgeGraphics(instance, table, config, exactBounds)
      const barGrid = barVerticalGridGraphics(instance, table, config, exactBounds)
      if (exactBounds) {
        const exactMiddleY = (exactBounds.top + exactBounds.bottom) / 2
        const positionPlotGraphics = (graphics: unknown[]) => graphics.map((graphic) => {
          if (!graphic || typeof graphic !== 'object') return graphic
          const item = graphic as { id?: string; style?: Record<string, unknown>; children?: Array<{ type?: string; shape?: { width?: number; height?: number } }> }
          if (item.id === 'chart-y-axis-title') return { ...item, top: undefined, y: exactMiddleY }
          if (item.id === 'scatter-y-editorial-title') {
            const style = item.style ?? {}, fontSize = Number(style.fontSize ?? (config.yAxisTitleText ?? config.axisTitleText).size)
            const lineHeight = Number(style.lineHeight ?? Math.round(fontSize * 1.2))
            return { ...item, left: exactBounds.left, top: Math.max(marginTop, exactBounds.top - lineHeight - 8), style: { ...style, width: Math.max(80, exactBounds.right - exactBounds.left), align: 'left' } }
          }
          if (item.id === 'scatter-x-editorial-title') {
            const style = item.style ?? {}, fontSize = Number(style.fontSize ?? (config.xAxisTitleText ?? config.axisTitleText).size)
            const lineHeight = Number(style.lineHeight ?? Math.round(fontSize * 1.2))
            const width = Math.max(80, Math.min(Number(style.width ?? 320), exactBounds.right - exactBounds.left))
            return { ...item, left: exactBounds.right - width, top: exactBounds.bottom - lineHeight - 6, style: { ...style, width, align: 'right' } }
          }
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
      option.graphic = [...withoutGeneratedGraphics(Array.isArray(option.graphic) ? option.graphic : []), ...barGrid, ...exactDisplayDecorations, ...suffixGraphics, ...edgeGraphics]
      cleanOption.graphic = [...withoutGeneratedGraphics(Array.isArray(cleanOption.graphic) ? cleanOption.graphic : []), ...barGrid, ...exactCleanDecorations, ...suffixGraphics, ...edgeGraphics]
      if (exactBounds || barGrid.length || exactDisplayDecorations.length || suffixGraphics.length || edgeGraphics.length) instance.setOption({ graphic: option.graphic }, { replaceMerge: ['graphic'] })
      if (config.showDirectLabels) {
        const displayDirect = directLegendGraphics(instance, table, config, onSettingsFocus, selectedSettingsSection === 'legend')
        const cleanDirect = directLegendGraphics(instance, table, config)
        option.graphic = [...(Array.isArray(option.graphic) ? option.graphic : []), ...displayDirect]
        cleanOption.graphic = [...(Array.isArray(cleanOption.graphic) ? cleanOption.graphic : []), ...cleanDirect]
        instance.setOption({ graphic: option.graphic }, { replaceMerge: ['graphic'] })
      }
      const valueLabelHits = valueLabelHitGraphics(instance, table, config, selectedSettingsSection === 'values', onSelect, onSettingsFocus)
      if (valueLabelHits.length) {
        option.graphic = [...(Array.isArray(option.graphic) ? option.graphic : []), ...valueLabelHits]
        instance.setOption({ graphic: option.graphic }, { replaceMerge: ['graphic'] })
      }
      displayOption.current = option
      exportOption.current = cleanOption
      instance.dispatchAction({ type: 'downplay' })
      setRenderError('')
      } catch (cause) {
        displayOption.current = null
        exportOption.current = null
        setRenderError(cause instanceof Error ? cause.message : 'Не удалось отрисовать график')
      }
    }, [table, config, hoveredSeriesName, onAnnotationSelect, onDecorationChange, onDecorationSelect, onSelect, onSettingsFocus, selectedAnnotationId, selectedElementKey, selectedElementTarget, selectedSeriesName, selectedSettingsSection])

    useEffect(() => {
      const instance = chart.current
      if (!instance) return
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
      canvas?.addEventListener('click', pointerHandler, true)
      const resetHover = () => { setHoveredSeriesName(null); instance.dispatchAction({ type: 'downplay' }) }
      const prepared = prepareVisibleChartData(table, config)
      const horizontalBar = isHorizontalBar(config)
      const categoryPixels = prepared.categories.map((_, index) => Number(instance.convertToPixel(horizontalBar ? { yAxisIndex: 0 } : { xAxisIndex: 0 }, index)))
      const pointerCategory = (pointer: [number, number]) => pointer[horizontalBar ? 1 : 0]
      const nearestIndex = (pointer: [number, number]) => nearestPixelIndex(categoryPixels, pointerCategory(pointer))
      const clickedSegmentIndex = (pointer: [number, number]) => segmentEndpointIndex(categoryPixels, pointerCategory(pointer))
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
        onSelect?.({ key, seriesName, category: String(category), value: value == null ? 'пропуск' : String(value) })
        onSettingsFocus?.('element')
      }
      const handler = (params: unknown) => {
        const event = params as { componentType?: string; targetType?: string; seriesName?: string; name?: string; value?: unknown; data?: { elementKey?: string; sourceSeriesName?: string; displayValue?: string; displayCategory?: string; directLegendLabel?: boolean }; event?: { target?: { type?: string; parent?: { type?: string } }; topTarget?: { type?: string; parent?: { type?: string } } } }
        if (event.componentType === 'title') { onSettingsFocus?.(event.targetType === 'subtitle' || event.targetType === 'subtext' ? 'subtitle' : 'title'); return }
        if (event.componentType === 'xAxis' || event.componentType === 'yAxis') { const axis = event.componentType === 'xAxis' ? 'x' : 'y'; onSettingsFocus?.(event.targetType === 'axisName' ? `${axis}-axis-title` : `${axis}-axis-labels`); return }
        if (event.componentType === 'legend') { onSettingsFocus?.('legend'); return }
        if (event.targetType === 'endLabel') { onSettingsFocus?.('legend'); return }
        if (!event.seriesName) return
        const seriesName = event.data?.sourceSeriesName ?? event.seriesName.replace(/^__hit__:/, '')
        const renderTarget = event.event?.target ?? event.event?.topTarget
        const clickedValueLabel = event.targetType === 'label' || renderTarget?.type === 'text' || renderTarget?.type === 'tspan' || renderTarget?.parent?.type === 'text'
        if (clickedValueLabel && event.data?.directLegendLabel) { onSettingsFocus?.('legend'); return }
        if (clickedValueLabel && event.data?.elementKey) {
          if (selectedSettingsSection !== 'values') { onSettingsFocus?.('values'); return }
          onSelect?.({ key: event.data.elementKey, seriesName, category: event.data.displayCategory ?? event.name ?? '', value: event.data.displayValue ?? String(event.value ?? ''), target: 'value-label' })
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
        if (!event.data?.elementKey) { selectNearestValue(seriesName); return }
        onSelect?.({ key: event.data.elementKey, seriesName, category: event.data.displayCategory ?? event.name ?? '', value: event.data.displayValue ?? String(event.value ?? '') })
        onSettingsFocus?.('element')
      }
      const hoverHandler = (params: unknown) => {
        const event = params as { seriesName?: string; data?: { sourceSeriesName?: string } }
        const name = event.data?.sourceSeriesName ?? event.seriesName?.replace(/^__hit__:/, '')
        if (name && !name.startsWith('__')) setHoveredSeriesName((current) => current === name ? current : name)
      }
      const legendHandler = () => onSettingsFocus?.('legend')
      const backgroundHandler = (event: { target?: unknown }) => { if (!event.target) { onClearSettingsFocus?.(); onAnnotationSelect?.('') } }
      // Keep the renderer that was alive when the handlers were registered.
      // During StrictMode teardown the chart-init effect may dispose ECharts
      // before this effect gets a chance to remove its listeners, at which
      // point instance.getZr() returns null.
      const renderer = instance.getZr()
      instance.on('click', handler)
      instance.on('mouseover', hoverHandler)
      instance.on('globalout', resetHover)
      instance.on('mouseout', resetHover)
      instance.on('legendselectchanged', legendHandler)
      renderer.on('click', backgroundHandler)
      return () => {
        canvas?.removeEventListener('click', pointerHandler, true)
        canvas?.removeEventListener('mousemove', moveHandler)
        canvas?.removeEventListener('mouseleave', leaveHandler)
        if (!instance.isDisposed()) {
          instance.off('click', handler)
          instance.off('mouseover', hoverHandler)
          instance.off('globalout', resetHover)
          instance.off('mouseout', resetHover)
          instance.off('legendselectchanged', legendHandler)
        }
        renderer.off('click', backgroundHandler)
      }
    }, [config, onAnnotationSelect, onClearSettingsFocus, onSelect, onSeriesSelect, onSettingsFocus, selectedElementKey, selectedSeriesName, selectedSettingsSection, table])

    useImperativeHandle(ref, () => ({
      exportSvg() {
        const instance = chart.current
        if (!instance || !exportOption.current) return
        instance.setOption(exportOption.current, true)
        instance.getZr().flush()
        try {
          const svg = container.current?.querySelector('svg')
          if (!svg) return
          const exported = svg.cloneNode(true) as SVGSVGElement
          const targetWidth = Math.min(1000, Math.round(config.canvasWidth ?? svg.clientWidth))
          const targetHeight = Math.min(1000, Math.round(config.canvasHeight ?? svg.clientHeight))
          exported.setAttribute('viewBox', `0 0 ${svg.clientWidth} ${svg.clientHeight}`)
          exported.setAttribute('width', String(targetWidth))
          exported.setAttribute('height', String(targetHeight))
          embedCustomFonts(exported, config.customFonts)
          const blob = new Blob([new XMLSerializer().serializeToString(exported)], { type: 'image/svg+xml' })
          const url = URL.createObjectURL(blob)
          download(url, 'chart.svg')
          setTimeout(() => URL.revokeObjectURL(url), 1000)
        } finally {
          if (displayOption.current) { instance.setOption(displayOption.current, true); instance.getZr().flush() }
        }
      },
      async exportPng() {
        const instance = chart.current
        if (!instance || !exportOption.current) return
        instance.setOption(exportOption.current, true)
        instance.getZr().flush()
        try {
          const svg = container.current?.querySelector('svg')
          if (!svg) return
          const targetWidth = Math.min(1000, Math.round(config.canvasWidth ?? svg.clientWidth))
          const targetHeight = Math.min(1000, Math.round(config.canvasHeight ?? svg.clientHeight))
          const exportScale = Math.max(2, Math.ceil(window.devicePixelRatio || 1))
          const exported = svg.cloneNode(true) as SVGSVGElement
          exported.setAttribute('viewBox', `0 0 ${svg.clientWidth} ${svg.clientHeight}`)
          exported.setAttribute('width', String(targetWidth * exportScale))
          exported.setAttribute('height', String(targetHeight * exportScale))
          embedCustomFonts(exported, config.customFonts)
          const source = new XMLSerializer().serializeToString(exported)
          const image = new Image()
          const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }))
          try {
            await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Не удалось подготовить PNG')); image.src = url })
            const canvas = document.createElement('canvas')
            canvas.width = targetWidth * exportScale
            canvas.height = targetHeight * exportScale
            const context = canvas.getContext('2d')
            if (!context) throw new Error('Браузер не поддерживает экспорт PNG')
            context.imageSmoothingEnabled = true
            context.imageSmoothingQuality = 'high'
            context.drawImage(image, 0, 0, canvas.width, canvas.height)
            download(canvas.toDataURL('image/png'), 'chart.png')
          } finally { URL.revokeObjectURL(url) }
        } finally {
          if (displayOption.current) { instance.setOption(displayOption.current, true); instance.getZr().flush() }
        }
      },
    }), [config.canvasHeight, config.canvasWidth, config.customFonts])

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
    return <div className={`chart-canvas-viewport ${config.autoFitCanvas === false ? 'native-size' : ''}`} ref={viewport}><div className="chart-canvas-shell logical-canvas" style={{ width: canvasWidth, height: canvasHeight, transform: canvasTransform }}><div className="chart-canvas" ref={container}/>{renderError && <div className="chart-render-error" role="alert"><strong>Не удалось отрисовать график</strong><span>{renderError}</span></div>}{richDisplays.map(({ field, html, layout, style }) => <CanvasTextDisplay key={field} html={html} style={{ ...style, size: layout.size }} left={layout.left} top={layout.top} width={layout.width} onSelect={() => { onAnnotationSelect?.(''); onSettingsFocus?.(field) }}/>)}{richField && richLayout && richStyle && <CanvasTextOverlay id={richField} text={richText} html={richHtml} style={{ ...richStyle, size: richLayout.size }} left={richLayout.left} top={richLayout.top} width={richLayout.width} customFonts={config.customFonts} canvasBackground={config.canvasBackground} onChange={(html, text) => onRichTextChange?.(richField, html, text)}/>} {selectedDecoration && onDecorationChange && <DecorationOverlay decoration={selectedDecoration} canvasWidth={canvasWidth} canvasHeight={canvasHeight} plotTop={plotBounds?.top} plotBottom={plotBounds?.bottom} plotLeft={plotBounds?.left} plotRight={plotBounds?.right} onChange={onDecorationChange}/>} {config.annotations.filter((annotation) => annotation.id !== selectedAnnotationId).map((annotation) => <AnnotationDisplay key={annotation.id} annotation={annotation} canvasBackground={config.canvasBackground} onSelect={() => onAnnotationSelect?.(annotation.id)}/>)}{selected && <AnnotationOverlay annotation={selected} customFonts={config.customFonts} canvasBackground={config.canvasBackground} onChange={(annotation) => onAnnotationChange?.(annotation)} onDuplicate={() => onAnnotationDuplicate?.(selected)} onDelete={() => onAnnotationDelete?.(selected.id)} onClose={() => onAnnotationSelect?.('')}/>}</div></div>
  },
)
