import { contrastText } from '../../../core/color'
import { legendLabelText } from '../../chart-layout/legendLayout'
import { formatXAxisNumber, formatYAxisNumber } from '../../../core/numberFormat'
import { absorbedBarLabelPlacement, barSeriesGeometry, denseValueLabelStride, showDenseValueLabel, valueLabelAlignment, valueLabelPosition } from '../../../core/chartLabels'
import { measureTextWidth, wrapMeasuredText } from '../../../core/textMetrics'
import type { ChartTextStyle } from '../../../core/types'
import type { CartesianBarPlotScene, NativeChartScene, ResolvedSceneGeometry } from '../../../entities/chart/model/ChartScene'
import type { ResolvedReservation } from '../../chart-layout/reservations'
import { horizontalCategoryLabelPlacement, verticalAxisLabelPlacement, reservedAxisLabelGap } from '../../chart-layout/axisLabelPlacement'
import type { ResolvedComparisonStemScene } from '../../chart-types/comparison-stem/layout'

export type ResolvedNativeBarScene = NativeChartScene & { plot: CartesianBarPlotScene; geometry: ResolvedSceneGeometry; resolvedReservations: ResolvedReservation[] }
export const nativeTextStyle = (style: ChartTextStyle) => ({ color: style.color, fontFamily: style.fontFamily, fontSize: style.size, fontWeight: style.weight, fontStyle: style.italic ? 'italic' : 'normal', lineHeight: Math.round(style.size * style.lineHeight / 100), align: style.align })
export const nativeGraphicTextStyle = (style: ChartTextStyle) => { const { color, ...rest } = nativeTextStyle(style); return { ...rest, fill: color } }
const textStyle = nativeTextStyle
const graphicTextStyle = nativeGraphicTextStyle
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)

function customBarSeries(scene: ResolvedNativeBarScene) {
  const config = scene.compatibilityConfig
  const stacked = scene.plot.stacking !== 'none'
  return scene.plot.series.flatMap((series, seriesIndex) => series.marks.flatMap((mark) => {
    if (mark.value == null || mark.style.width == null && mark.style.borderWidth <= 0) return []
    const previous = stacked ? scene.plot.series.slice(0, seriesIndex).reduce((sum, candidate) => {
      const value = candidate.marks[mark.categoryIndex]?.value ?? 0
      return Math.sign(value) === Math.sign(mark.value!) ? sum + value : sum
    }, 0) : 0
    return [{
      name: `__native-bar:${series.name}:${mark.categoryIndex}`, type: 'custom', coordinateSystem: 'cartesian2d', customBarOf: series.name, silent: false, z: 4,
      data: [{ id: mark.id, value: [mark.categoryIndex, mark.value], elementId: mark.id, datumId: mark.datumId, seriesId: mark.seriesId, elementKey: mark.legacyKey, sourceSeriesName: series.name, displayValue: mark.displayValue, displayCategory: mark.displayCategory, displayColor: mark.style.color, itemStyle: { color: mark.style.color, opacity: mark.style.opacity, borderColor: mark.style.borderColor, borderWidth: mark.style.borderWidth } }],
      renderItem: (_params: unknown, api: { value(index: number): number; coord(value: [number, number]): [number, number]; size(value: [number, number]): [number, number] }) => {
        const categoryIndex = api.value(0), value = api.value(1)
        const start = api.coord(scene.plot.orientation === 'horizontal' ? [previous, categoryIndex] : [categoryIndex, previous])
        const end = api.coord(scene.plot.orientation === 'horizontal' ? [previous + value, categoryIndex] : [categoryIndex, previous + value])
        const band = Math.abs(api.size(scene.plot.orientation === 'horizontal' ? [0, 1] : [1, 0])[scene.plot.orientation === 'horizontal' ? 1 : 0])
        const geometry = barSeriesGeometry(band, { ...config, barWidth: mark.style.width ?? scene.plot.barWidth }, scene.plot.series.length, seriesIndex, stacked)
        const shape = scene.plot.orientation === 'horizontal'
          ? { x: Math.min(start[0], end[0]), y: end[1] + geometry.offset - geometry.width / 2, width: Math.abs(end[0] - start[0]), height: geometry.width, r: mark.style.borderRadius }
          : { x: end[0] + geometry.offset - geometry.width / 2, y: Math.min(start[1], end[1]), width: geometry.width, height: Math.abs(end[1] - start[1]), r: mark.style.borderRadius }
        return { type: 'rect', info: { elementId: mark.id, datumId: mark.datumId, seriesId: mark.seriesId, elementKey: mark.legacyKey, sourceSeriesName: series.name, displayValue: mark.displayValue, displayCategory: mark.displayCategory, displayColor: mark.style.color }, shape, style: { fill: mark.style.color, opacity: mark.style.opacity, stroke: mark.style.borderColor, lineWidth: mark.style.borderWidth } }
      },
    }]
  }))
}

function absorbedLabelSeries(scene: ResolvedNativeBarScene) {
  const config = scene.compatibilityConfig
  if (!config.barValueLabelAbsorption) return []
  const horizontal = scene.plot.orientation === 'horizontal', stacked = scene.plot.stacking !== 'none'
  return scene.plot.series.flatMap((series, seriesIndex) => {
    const marks = series.marks.filter((mark) => mark.value != null && mark.label.visible)
    if (!marks.length) return []
    const maximumLabelWidth = Math.max(...marks.map((mark) => measureTextWidth(mark.label.text, mark.label.style.size, mark.label.style.fontFamily, mark.label.style.weight)))
    const maximumLabelHeight = Math.max(...marks.map((mark) => Math.round(mark.label.style.size * mark.label.style.lineHeight / 100)))
    return [{
      name: `__bar-value-labels:${series.name}`, customBarOf: series.name, type: 'custom', coordinateSystem: 'cartesian2d', silent: true, tooltip: { show: false }, clip: false, z: 20,
      data: marks.map((mark) => ({ value: [mark.categoryIndex, mark.value], elementId: mark.id, elementKey: mark.legacyKey, sourceSeriesName: series.name, displayValue: mark.displayValue, displayCategory: mark.displayCategory })),
      renderItem: (_params: unknown, api: { value(index: number): number; coord(value: [number, number]): [number, number]; size(value: [number, number]): [number, number] }) => {
        const categoryIndex = api.value(0), value = api.value(1), mark = series.marks[categoryIndex]
        if (!mark) return null
        const previous = stacked ? scene.plot.series.slice(0, seriesIndex).reduce((sum, candidate) => {
          const part = candidate.marks[categoryIndex]?.value ?? 0
          return Math.sign(part) === Math.sign(value) ? sum + part : sum
        }, 0) : 0
        const start = api.coord(horizontal ? [previous, categoryIndex] : [categoryIndex, previous])
        const end = api.coord(horizontal ? [previous + value, categoryIndex] : [categoryIndex, previous + value])
        const band = Math.abs(api.size(horizontal ? [0, 1] : [1, 0])[horizontal ? 1 : 0])
        const geometry = barSeriesGeometry(band, { ...config, barWidth: mark.style.width ?? scene.plot.barWidth }, scene.plot.series.length, seriesIndex, stacked)
        const category = end[horizontal ? 1 : 0] + geometry.offset
        const width = Math.max(...mark.label.text.split('\n').map((line) => measureTextWidth(line, mark.label.style.size, mark.label.style.fontFamily, mark.label.style.weight)))
        const height = Math.round(mark.label.style.size * mark.label.style.lineHeight / 100) * mark.label.text.split('\n').length
        const stride = denseValueLabelStride(horizontal, band, maximumLabelWidth, maximumLabelHeight, config.valueLabelHideOverlap ?? false)
        if (!showDenseValueLabel(categoryIndex, scene.plot.categories.length, stride)) return null
        const placement = absorbedBarLabelPlacement(horizontal, start[horizontal ? 0 : 1], end[horizontal ? 0 : 1], category, width, height, config.barValueLabelAbsorptionPadding ?? 10, config.barValueLabelInsidePosition ?? 'end', config.barValueLabelOutsidePosition ?? 'end', geometry.width)
        return { type: 'text', info: { elementId: mark.id, datumId: mark.datumId, seriesId: mark.seriesId, elementKey: mark.legacyKey, sourceSeriesName: series.name, displayValue: mark.displayValue, displayCategory: mark.displayCategory, displayColor: mark.style.color }, style: { x: placement.x, y: placement.y, text: mark.label.text, ...graphicTextStyle(mark.label.style), fill: placement.inside && mark.label.autoContrast ? contrastText(mark.style.color, 4.5, mark.style.opacity, config.canvasBackground) : mark.label.style.color, align: placement.align, verticalAlign: placement.verticalAlign } }
      },
    }]
  })
}

function directLabelSeries(scene: ResolvedNativeBarScene) {
  const config = scene.compatibilityConfig
  const guide = scene.guides.find((item) => item.kind === 'direct-series')
  if (!config.showDirectLabels || guide?.kind !== 'direct-series') return []
  const horizontal = scene.plot.orientation === 'horizontal'
  return scene.plot.series.flatMap((series, seriesIndex) => {
    const item = guide.items.find((candidate) => candidate.seriesId === series.id)
    const index = horizontal ? series.marks.findIndex((mark) => mark.value != null) : series.marks.findLastIndex((mark) => mark.value != null)
    const mark = series.marks[index]
    if (!item?.visible || !mark || mark.value == null) return []
    const previous = scene.plot.stacking === 'none' ? config.yAxisScaleType === 'log' ? scene.plot.valueDomain.min : 0 : scene.plot.series.slice(0, seriesIndex).reduce((sum, candidate) => {
      const value = candidate.marks[index]?.value ?? 0
      return Math.sign(value) === Math.sign(mark.value!) ? sum + value : sum
    }, 0)
    const data = { value: [index, (previous + (scene.plot.stacking === 'none' ? mark.value : previous + mark.value)) / 2], elementId: mark.id, elementKey: mark.legacyKey, sourceSeriesName: series.name, directLegendLabel: true, selectionTarget: 'guide' }
    return [{
      name: `__bar-direct-label:${series.name}`, customBarOf: series.name, type: 'custom', coordinateSystem: 'cartesian2d', clip: false, z: 30, tooltip: { show: false }, data: [data],
      renderItem: (_params: unknown, api: { coord(value: [number, number]): [number, number]; size(value: [number, number]): [number, number] }) => {
        const anchor = api.coord(horizontal ? [data.value[1], index] : [index, data.value[1]])
        const band = Math.abs(api.size(horizontal ? [0, 1] : [1, 0])[horizontal ? 1 : 0])
        const geometry = barSeriesGeometry(band, { ...config, barWidth: mark.style.width ?? scene.plot.barWidth }, scene.plot.series.length, seriesIndex, scene.plot.stacking !== 'none')
        const gap = config.directLabelGap ?? 14
        const left = guide.side === 'left'
        const labelWidth = Math.max(40, Math.floor(scene.geometry.plot.width / Math.max(1, scene.plot.series.length)) - 12)
        const labelText = `${item.label}${item.note ? `\n${item.note}` : ''}`
        return { type: 'text', info: data, style: {
          ...graphicTextStyle(item.style), text: horizontal ? wrapMeasuredText(labelText, item.style.size, labelWidth, item.style.fontFamily, item.style.weight, false).text : labelText,
          x: horizontal ? anchor[0] : anchor[0] + geometry.offset + (left ? -1 : 1) * (geometry.width / 2 + gap),
          y: horizontal ? anchor[1] + geometry.offset - geometry.width / 2 - gap : anchor[1],
          align: horizontal ? 'center' : left ? 'right' : 'left', verticalAlign: horizontal ? 'bottom' : 'middle',
        } }
      },
    }]
  })
}

function valueEdgeAffixSeries(scene: ResolvedNativeBarScene) {
  const config = scene.compatibilityConfig
  if (scene.plot.orientation !== 'vertical' || !(config.showYAxisLabels ?? true) || !config.yAxisAffixScope || config.yAxisAffixScope === 'all' || !(config.numberPrefix || config.numberSuffix)) return []
  const positions = config.yAxisAffixScope === 'first' ? [['first', scene.plot.valueDomain.min] as const] : config.yAxisAffixScope === 'last' ? [['last', scene.plot.valueDomain.max] as const] : [['first', scene.plot.valueDomain.min] as const, ['last', scene.plot.valueDomain.max] as const]
  const style = config.yAxisLabelText ?? config.axisLabelText
  return [{
    name: '__y-axis-edge-affixes', type: 'custom', coordinateSystem: 'cartesian2d', silent: true, tooltip: { show: false }, clip: false, z: 100,
    data: positions.map(([position, value]) => [0, value, position === 'first' ? 0 : 1]),
    renderItem: (params: { coordSys: { x: number; width: number } }, api: { value(index: number): number; coord(value: [number, number]): [number, number] }) => {
      const value = Number(api.value(1)), position = api.value(2) === 0 ? 'first' : 'last'
      const bare = formatYAxisNumber(value, { ...config, numberPrefix: '', numberSuffix: '', yAxisAffixScope: 'all' })
      const label = formatYAxisNumber(value, config, position)
      const prefix = config.numberPrefix && label.startsWith(config.numberPrefix) ? config.numberPrefix : ''
      const bareWidth = measureTextWidth(bare, style.size, style.fontFamily, style.weight) + measureTextWidth(prefix, style.size, style.fontFamily, style.weight)
      const left = config.yAxisPosition === 'left'
      const edge = left ? params.coordSys.x - (config.yAxisLabelGap ?? 8) : params.coordSys.x + params.coordSys.width + (config.yAxisLabelGap ?? 8)
      return { type: 'text', style: { x: left ? edge - bareWidth : edge + bareWidth, y: api.coord([0, value])[1], text: label, ...graphicTextStyle(style), align: left ? 'left' : 'right', verticalAlign: 'middle', backgroundColor: config.canvasBackground, padding: left ? [1, 3, 1, 0] : [1, 0, 1, 3] } }
    },
  }]
}

type ResolvedCartesianAxisScene = ResolvedNativeBarScene | ResolvedComparisonStemScene
function categoryLabelInterval(scene: ResolvedCartesianAxisScene) {
  const requested = scene.compatibilityConfig.xAxisStep
  const categories = scene.plot.categories
  if (categories.some((category) => category.value instanceof Date)) return (index: number) => Boolean(categories[index]?.label)
  if (requested != null) return Math.max(0, Math.round(requested) - 1)
  const slot = (scene.plot.categoryAxis.orientation === 'horizontal' ? scene.geometry.plot.width : scene.geometry.plot.height) / Math.max(1, categories.length)
  const longest = Math.max(0, ...categories.map((category) => measureTextWidth(category.label, scene.plot.categoryAxis.labels.style.size, scene.plot.categoryAxis.labels.style.fontFamily, scene.plot.categoryAxis.labels.style.weight)))
  if (categories.every((category) => typeof category.value === 'string' || typeof category.value === 'boolean' || category.value == null)) return 0
  return Math.max(0, Math.ceil((longest + 12) / Math.max(1, slot)) - 1)
}

function categoryGridGraphics(scene: ResolvedNativeBarScene) {
  const config = scene.compatibilityConfig
  const horizontal = scene.plot.orientation === 'horizontal'
  if (!(horizontal ? config.showHorizontalGrid : config.showVerticalGrid)) return []
  const interval = categoryLabelInterval(scene)
  const visible = (index: number) => typeof interval === 'function' ? interval(index) : index % (interval + 1) === 0
  const plot = scene.geometry.plot, count = Math.max(1, scene.plot.categories.length)
  const lineDash = config.gridType === 'dashed' ? [6, 4] : config.gridType === 'dotted' ? [2, 3] : undefined
  return scene.plot.categories.flatMap((category, index) => {
    if (scene.plot.categoryAxis.calendarTicks && category.value instanceof Date) return []
    if (!category.label || !visible(index)) return []
    const coordinate = horizontal ? plot.y + (index + .5) * plot.height / count : plot.x + (index + .5) * plot.width / count
    return [{ id: `bar-category-grid:${category.id}`, type: 'line', silent: true, z: 1, shape: horizontal ? { x1: plot.x, y1: coordinate, x2: plot.x + plot.width, y2: coordinate } : { x1: coordinate, y1: plot.y, x2: coordinate, y2: plot.y + plot.height }, style: { stroke: config.gridColor, lineWidth: config.gridWidth, lineDash } }]
  })
}

export function calendarCategoryGraphics(scene: ResolvedCartesianAxisScene) {
  const axis = scene.plot.categoryAxis, config = scene.compatibilityConfig, plot = scene.geometry.plot
  if (!axis.calendarTicks) return []
  const horizontal = axis.orientation === 'horizontal', side = axis.placement.kind === 'side' ? axis.placement.side : horizontal ? 'bottom' : 'left'
  const rotation = axis.labels.rotation ?? 0, count = Math.max(1, scene.plot.categories.length)
  const grid = horizontal ? config.showVerticalGrid : config.showHorizontalGrid
  const dash = (type: string) => type === 'dashed' ? [6, 4] : type === 'dotted' ? [2, 3] : undefined
  const vertical = verticalAxisLabelPlacement(side as 'left' | 'right', axis.labels.size, reservedAxisLabelGap(axis, plot, scene.geometry.axes.category), axis.ticks.visible ? axis.ticks.length : 0, config.categoryAxisLabelAlignment)
  return axis.calendarTicks.flatMap((tick) => {
    const fraction = (tick.position + .5) / count
    const coordinate = horizontal ? plot.x + plot.width * fraction : plot.y + plot.height * ((config.categoryAxisInverse ?? true) ? fraction : 1 - fraction)
    const edge = horizontal ? side === 'top' ? plot.y : plot.y + plot.height : side === 'left' ? plot.x : plot.x + plot.width
    const outward = side === 'top' || side === 'left' ? -1 : 1
    const id = `calendar-category:${tick.value}`
    return [
      ...(grid ? [{ id: `${id}:grid`, type: 'line', silent: true, z: 1, shape: horizontal ? { x1: coordinate, y1: plot.y, x2: coordinate, y2: plot.y + plot.height } : { x1: plot.x, y1: coordinate, x2: plot.x + plot.width, y2: coordinate }, style: { stroke: config.gridColor, lineWidth: config.gridWidth, lineDash: dash(config.gridType) } }] : []),
      ...(axis.ticks.visible ? [{ id: `${id}:tick`, type: 'line', silent: true, shape: horizontal ? { x1: coordinate, y1: edge, x2: coordinate, y2: edge + outward * axis.ticks.length } : { x1: edge, y1: coordinate, x2: edge + outward * axis.ticks.length, y2: coordinate }, style: { stroke: config.axisLineColor, lineWidth: config.axisLineWidth, lineDash: dash(config.axisLineType) } }] : []),
      ...(axis.labels.visible ? [{ id: `${id}:label`, type: 'text', silent: true, z: 30, x: horizontal ? coordinate : edge + outward * vertical.margin, y: horizontal ? edge + outward * axis.labels.gap : coordinate, rotation: horizontal ? rotation * Math.PI / 180 : 0, style: { text: tick.label, ...graphicTextStyle(axis.labels.style), ...(horizontal ? horizontalCategoryLabelPlacement(side as 'top' | 'bottom', rotation) : { align: vertical.align, verticalAlign: 'middle' }) } }] : []),
    ]
  })
}

export function renderNativeCartesianAxis(scene: ResolvedCartesianAxisScene, channel: 'category' | 'value') {
  const config = scene.compatibilityConfig
  const axis = channel === 'category' ? scene.plot.categoryAxis : scene.plot.valueAxis
  const side = axis.placement.kind === 'side' ? axis.placement.side : undefined
  const lineStyle = { color: config.axisLineColor, width: config.axisLineWidth, type: config.axisLineType }
  const nameGap = (axis.ticks.visible ? axis.ticks.length : 0) + (axis.labels.visible ? axis.labels.gap + axis.labels.size : 0) + (axis.title?.gap ?? 0)
  if (channel === 'category') {
    const labels = new Map(scene.plot.categories.map((category) => [category.coordinate, category.label]))
    const slot = (axis.orientation === 'horizontal' ? scene.geometry.plot.width : scene.geometry.plot.height) / Math.max(1, scene.plot.categories.length)
    const interval = categoryLabelInterval(scene)
    const rotated = Boolean(axis.labels.rotation)
    const wrap = config.xAxisLabelOverflow === 'wrap' && !rotated
    const formatCategory = (value: string, index: number) => {
      if (axis.calendarTicks && scene.plot.categories[index]?.value instanceof Date) return ''
      const text = scene.plot.categories[index]?.label ?? labels.get(value) ?? value
      if (!wrap) return text
      const style = axis.labels.style
      return wrapMeasuredText(text, style.size, axis.orientation === 'vertical' ? axis.labels.size : Math.max(20, slot - 8), style.fontFamily, style.weight, false).text
    }
    return {
      type: 'category', boundaryGap: true, position: side, data: scene.plot.categories.map((category) => category.coordinate),
      name: axis.orientation === 'vertical' ? '' : axis.title?.visible ? axis.title.text : '', nameLocation: 'middle', nameGap, nameRotate: axis.orientation === 'vertical' ? 90 : 0, nameTextStyle: axis.title ? textStyle(axis.title.style) : undefined,
      axisLine: { show: axis.line.visible, onZero: false, lineStyle }, axisTick: { show: axis.ticks.visible, inside: false, alignWithLabel: true, interval: axis.calendarTicks ? (index: number) => !(scene.plot.categories[index]?.value instanceof Date) : interval, length: axis.ticks.length, lineStyle },
      axisLabel: { show: axis.labels.visible, inside: false, rotate: axis.labels.rotation ?? 0, interval, hideOverlap: false, width: !rotated && config.xAxisLabelOverflow === 'truncate' ? axis.orientation === 'vertical' ? Math.max(20, axis.labels.size) : Math.max(20, slot - 8) : undefined, overflow: config.xAxisLabelOverflow === 'truncate' ? 'truncate' : undefined, formatter: formatCategory, ...textStyle(axis.labels.style), ...(axis.orientation === 'vertical' ? verticalAxisLabelPlacement(side as 'left' | 'right' | undefined, axis.labels.size, reservedAxisLabelGap(axis, scene.geometry.plot, scene.geometry.axes[channel]), axis.ticks.visible ? axis.ticks.length : 0, config.categoryAxisLabelAlignment) : { margin: axis.labels.gap, ...horizontalCategoryLabelPlacement(side as 'top' | 'bottom' | undefined, axis.labels.rotation ?? 0) }) },
      splitLine: { show: false },
      inverse: scene.plot.orientation === 'horizontal' ? config.categoryAxisInverse ?? true : false,
      triggerEvent: true,
    }
  }
  const formatter = scene.plot.kind === 'bar' && scene.plot.stacking === 'normalized' ? formatYAxisNumber : scene.plot.orientation === 'horizontal' ? formatXAxisNumber : formatYAxisNumber
  const tickPosition = (value: number) => Math.abs(value - scene.plot.valueDomain.min) < 1e-9 ? 'first' : Math.abs(value - scene.plot.valueDomain.max) < 1e-9 ? 'last' : 'middle'
  const edgeOverlay = scene.plot.orientation === 'vertical' && config.yAxisAffixScope != null && config.yAxisAffixScope !== 'all' && Boolean(config.numberPrefix || config.numberSuffix)
  return {
    type: config.yAxisScaleType === 'log' ? 'log' : 'value', position: side, min: scene.plot.valueDomain.min, max: scene.plot.valueDomain.max, interval: config.yAxisScaleType === 'log' ? undefined : scene.plot.valueDomain.step,
    name: axis.orientation === 'vertical' ? '' : axis.title?.visible ? axis.title.text : '', nameLocation: 'middle', nameGap, nameRotate: axis.orientation === 'vertical' ? 90 : 0, nameTextStyle: axis.title ? textStyle(axis.title.style) : undefined,
    axisLine: { show: axis.line.visible, lineStyle }, axisTick: { show: axis.ticks.visible, inside: false, length: axis.ticks.length, lineStyle },
    axisLabel: { show: axis.labels.visible, hideOverlap: axis.orientation === 'horizontal', formatter: (value: number) => { const position = tickPosition(value); return edgeOverlay && (config.yAxisAffixScope === position || config.yAxisAffixScope === 'edges' && position !== 'middle') ? formatYAxisNumber(value, { ...config, numberPrefix: '', numberSuffix: '', yAxisAffixScope: 'all' }) : formatter(value, config, position) }, ...textStyle(axis.labels.style), ...(axis.orientation === 'vertical' ? verticalAxisLabelPlacement(side as 'left' | 'right' | undefined, axis.labels.size, reservedAxisLabelGap(axis, scene.geometry.plot, scene.geometry.axes[channel]), axis.ticks.visible ? axis.ticks.length : 0, 'outer') : { margin: axis.labels.gap, align: 'center' as const }) },
    splitLine: { show: scene.plot.orientation === 'horizontal' ? config.showVerticalGrid : config.showHorizontalGrid, lineStyle: { color: config.gridColor, width: config.gridWidth, type: config.gridType } },
  }
}

function directLeaderGraphics(scene: ResolvedNativeBarScene) {
  const config = scene.compatibilityConfig
  if (!config.showDirectLabels) return []
  const plot = scene.geometry.plot
  const horizontal = scene.plot.orientation === 'horizontal'
  const guide = scene.guides.find((item) => item.kind === 'direct-series')
  const rail = scene.geometry.reservations['guide:direct-series']
  const project = (value: number) => config.yAxisScaleType === 'log'
    ? (Math.log(value) - Math.log(scene.plot.valueDomain.min)) / Math.max(1e-9, Math.log(scene.plot.valueDomain.max) - Math.log(scene.plot.valueDomain.min))
    : (value - scene.plot.valueDomain.min) / Math.max(1e-9, scene.plot.valueDomain.max - scene.plot.valueDomain.min)
  const valuePixel = (value: number) => horizontal ? plot.x + plot.width * project(value) : plot.y + plot.height * (1 - project(value))
  return scene.plot.series.flatMap((series, seriesIndex) => {
    const style = config.seriesStyles[series.name]
    const guideItem = guide?.kind === 'direct-series' ? guide.items.find((item) => item.seriesId === series.id) : undefined
    if (!guideItem?.visible || !(style?.showLegendLine ?? config.showDirectLabelLines)) return []
    const index = horizontal ? series.marks.findIndex((mark) => mark.value != null) : series.marks.findLastIndex((mark) => mark.value != null)
    const value = series.marks[index]?.value
    if (index < 0 || value == null) return []
    const previous = scene.plot.stacking === 'none' ? config.yAxisScaleType === 'log' ? scene.plot.valueDomain.min : 0 : scene.plot.series.slice(0, seriesIndex).reduce((sum, candidate) => {
      const part = candidate.marks[index]?.value ?? 0
      return Math.sign(part) === Math.sign(value) ? sum + part : sum
    }, 0)
    const endpoint = scene.plot.stacking === 'none' ? value : previous + value
    const middle = (valuePixel(previous) + valuePixel(endpoint)) / 2
    if (!Number.isFinite(middle)) return []
    const dash = config.directLabelLineType === 'dashed' ? [6, 4] : config.directLabelLineType === 'dotted' ? [2, 3] : undefined
    const categoryBand = plot.height / Math.max(1, scene.plot.categories.length)
    const barGeometry = barSeriesGeometry(categoryBand, config, scene.plot.series.length, seriesIndex, scene.plot.stacking !== 'none')
    const points: Array<[number, number]> = horizontal
      ? [[middle, plot.y + (index + 0.5) * categoryBand + barGeometry.offset], [middle, plot.y - Math.max(3, config.directLabelGap ?? 14)]]
      : guide?.kind === 'direct-series' && guide.side === 'left'
        ? [[plot.x, middle], [(rail?.x ?? plot.x) + (rail?.width ?? 0), middle]]
        : [[plot.x + plot.width, middle], [rail?.x ?? plot.x + plot.width, middle]]
    return [{ id: `direct-guide-line:${series.id}`, type: 'polyline', silent: true, z: 75, shape: { points }, style: { stroke: series.color, fill: 'none', lineWidth: config.directLabelLineWidth ?? 1, lineDash: dash } }]
  })
}

export function renderNativeBarScene(scene: ResolvedNativeBarScene): Record<string, unknown> {
  const config = scene.compatibilityConfig
  const horizontal = scene.plot.orientation === 'horizontal'
  const legendGuide = scene.guides.find((guide) => guide.kind === 'categorical-legend')
  const seriesNames = new Map(scene.plot.series.map((item) => [item.id, item.name]))
  const legendItems = legendGuide?.items.flatMap((item) => item.visible && item.target.kind === 'series' ? [{ ...item, rendererName: seriesNames.get(item.target.seriesId) ?? item.target.seriesId }] : []) ?? []
  const legendLabels = new Map(legendItems.map((item) => [item.rendererName, item.label]))
  const legendRail = scene.geometry.reservations['guide:legend']
  const series = scene.plot.series.map((item) => {
    const seriesStyle = config.seriesStyles[item.name]
    const resolvedLabelPosition = valueLabelPosition(config, config.kind)
    return {
      id: item.id, name: item.name, type: 'bar', stack: scene.plot.stacking === 'none' ? undefined : 'total', triggerEvent: true, clip: true,
      barCategoryGap: `${100 - Math.max(10, Math.min(100, scene.plot.barWidth))}%`, barGap: `${scene.plot.seriesGap}%`,
      itemStyle: { color: item.color, opacity: seriesStyle?.fillOpacity ?? config.barFillOpacity ?? 1, borderWidth: 0, borderRadius: config.barBorderRadius ?? 0 },
      label: { show: config.showValues && !config.barValueLabelAbsorption, position: resolvedLabelPosition, formatter: (params: { dataIndex?: number; value?: unknown }) => params.dataIndex == null ? formatYAxisNumber(params.value, config) : item.marks[params.dataIndex]?.label.text ?? '', ...textStyle(config.valueText), ...valueLabelAlignment(resolvedLabelPosition), color: config.valueLabelAutoContrast !== false && (config.valueLabelPosition ?? '').startsWith('inside-') ? contrastText(item.color, 4.5, seriesStyle?.fillOpacity ?? config.barFillOpacity ?? 1, config.canvasBackground) : config.valueText.color, hideOverlap: config.valueLabelHideOverlap ?? false },
      labelLayout: () => ({ hideOverlap: config.valueLabelHideOverlap ?? false, moveOverlap: horizontal && config.showDirectLabels ? 'shiftX' : horizontal ? 'shiftY' : 'shiftX' }),
      markLine: config.showZeroLine && config.yAxisScaleType !== 'log' ? { silent: true, symbol: 'none', data: [{ [horizontal ? 'xAxis' : 'yAxis']: 0 }], lineStyle: { color: config.zeroLineColor, width: config.zeroLineWidth, type: config.zeroLineType }, label: { show: false } } : undefined,
      data: item.marks.map((mark, index) => {
        const pointLabel = { show: mark.label.visible, formatter: mark.label.text, position: resolvedLabelPosition, ...textStyle(mark.label.style), ...valueLabelAlignment(resolvedLabelPosition), color: mark.label.autoContrast && (config.valueLabelPosition ?? '').startsWith('inside-') ? contrastText(mark.style.color, 4.5, mark.style.opacity, config.canvasBackground) : mark.label.style.color }

        const custom = mark.style.width != null || mark.style.borderWidth > 0
        return {
          id: mark.id, value: mark.value, name: scene.plot.categories[index]?.coordinate, elementId: mark.id, datumId: mark.datumId, seriesId: mark.seriesId, elementKey: mark.legacyKey, sourceSeriesName: item.name, displayValue: mark.displayValue, displayCategory: mark.displayCategory, displayColor: mark.style.color,
          ...(custom ? { itemStyle: { color: 'rgba(0,0,0,0)', opacity: 1 } } : mark.style.color !== item.color || mark.style.opacity !== (seriesStyle?.fillOpacity ?? config.barFillOpacity ?? 1) ? { itemStyle: { color: mark.style.color, opacity: mark.style.opacity } } : {}),
          label: config.barValueLabelAbsorption ? { show: false } : pointLabel,
          emphasis: { label: config.barValueLabelAbsorption ? { show: false } : pointLabel },
          valueLabel: pointLabel, barWidthIntent: mark.style.width,
        }
      }),
    }
  })
  const plot = scene.geometry.plot, canvas = scene.geometry.canvas
  const titleElement = scene.frameElements.find((item) => item.role === 'title')
  const subtitleElement = scene.frameElements.find((item) => item.role === 'subtitle')
  const footerGraphics = scene.frameElements.filter((item) => item.role === 'note' || item.role === 'source').map((item, index, items) => ({ id: `chart-${item.role}`, type: 'text', left: scene.geometry.content.x, bottom: canvas.height - scene.geometry.content.y - scene.geometry.content.height + (items.length - index - 1) * (Math.round(item.style.size * item.style.lineHeight / 100) + scene.document.composition.noteSource), style: { text: item.text, width: scene.geometry.content.width, overflow: 'break', ...graphicTextStyle(item.style) } }))
  const verticalAxis = horizontal ? scene.plot.categoryAxis : scene.plot.valueAxis
  const verticalAxisTitle = verticalAxis.title
  const verticalTitle = verticalAxisTitle?.visible && verticalAxisTitle.text ? [{ id: 'chart-y-axis-title', type: 'text', left: verticalAxis.placement.kind === 'internal' || verticalAxis.placement.side === 'left' ? scene.geometry.content.x : undefined, right: verticalAxis.placement.kind === 'side' && verticalAxis.placement.side === 'right' ? canvas.width - scene.geometry.content.x - scene.geometry.content.width : undefined, top: 'middle', rotation: verticalAxis.placement.kind === 'side' && verticalAxis.placement.side === 'right' ? -Math.PI / 2 : Math.PI / 2, style: { text: verticalAxisTitle.text, ...graphicTextStyle(verticalAxisTitle.style), align: 'center', verticalAlign: 'middle' } }] : []
  return {
    animation: true, backgroundColor: scene.document.canvas.background, color: scene.plot.series.map((item) => item.color), textStyle: { fontFamily: scene.document.theme.fontFamily },
    title: { text: titleElement?.text ?? '', subtext: subtitleElement?.text ?? '', left: scene.geometry.content.x, top: Math.max(0, scene.geometry.content.y - 8), textStyle: titleElement ? textStyle(titleElement.style) : undefined, subtextStyle: subtitleElement ? textStyle(subtitleElement.style) : undefined, itemGap: scene.document.composition.titleSubtitle, triggerEvent: true },
    tooltip: { trigger: 'axis', formatter: (input: unknown) => { const items = (Array.isArray(input) ? input : [input]) as Array<{ dataIndex?: number; seriesName?: string; value?: unknown; data?: { displayValue?: string; displayCategory?: string } }>; const index = items[0]?.dataIndex ?? 0; return [`<b>${escapeHtml(items[0]?.data?.displayCategory ?? scene.plot.series[0]?.marks[index]?.displayCategory ?? '')}</b>`, ...items.filter((item) => item.seriesName).map((item) => `${escapeHtml(item.seriesName)}: <b>${escapeHtml(item.data?.displayValue ?? formatYAxisNumber(item.value, config))}</b>`)].join('<br/>') } },
    legend: { show: Boolean(legendGuide?.visible && legendItems.length), data: legendItems.map((item) => ({ name: item.rendererName, icon: config.legendMarker === 'circle' ? 'circle' : config.legendMarker === 'diamond' ? 'diamond' : config.legendMarker === 'triangle' ? 'triangle' : 'rect', itemStyle: { color: item.color, borderWidth: 0 } })), formatter: (name: string) => legendLabelText(legendLabels.get(name) ?? name, config.legendText, legendRail, config.legendPosition), orient: legendGuide?.kind === 'categorical-legend' && (legendGuide.position === 'left' || legendGuide.position === 'right') ? 'vertical' : 'horizontal', left: legendRail?.x ?? scene.geometry.content.x, top: legendRail?.y, right: legendGuide?.kind === 'categorical-legend' && legendGuide.position === 'right' ? canvas.width - (legendRail?.x ?? 0) - (legendRail?.width ?? 0) : undefined, itemWidth: 10, itemHeight: 10, itemGap: 18, textStyle: textStyle(config.legendText) },
    grid: { left: plot.x, top: plot.y, right: canvas.width - plot.x - plot.width, bottom: canvas.height - plot.y - plot.height, containLabel: false, outerBoundsMode: 'none' },
    xAxis: horizontal ? renderNativeCartesianAxis(scene, 'value') : renderNativeCartesianAxis(scene, 'category'),
    yAxis: horizontal ? renderNativeCartesianAxis(scene, 'category') : renderNativeCartesianAxis(scene, 'value'),
    series: [...series, ...customBarSeries(scene), ...absorbedLabelSeries(scene), ...directLabelSeries(scene), ...valueEdgeAffixSeries(scene)],
    graphic: [...categoryGridGraphics(scene), ...calendarCategoryGraphics(scene), ...verticalTitle, ...footerGraphics, ...directLeaderGraphics(scene)],
  }
}
