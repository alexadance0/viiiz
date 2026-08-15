import { formatXAxisNumber, formatYAxisNumber } from '../../../core/numberFormat'
import { absorbedBarLabelPlacement, barSeriesGeometry, denseValueLabelStride, showDenseValueLabel, valueLabelPosition } from '../../../core/chartLabels'
import { measureTextWidth } from '../../../core/textMetrics'
import type { ChartTextStyle } from '../../../core/types'
import type { CartesianBarPlotScene, NativeChartScene, ResolvedSceneGeometry } from '../../../entities/chart/model/ChartScene'
import type { ResolvedReservation } from '../../chart-layout/reservations'
import type { ResolvedComparisonStemScene } from '../../chart-types/comparison-stem/layout'

export type ResolvedNativeBarScene = NativeChartScene & { plot: CartesianBarPlotScene; geometry: ResolvedSceneGeometry; resolvedReservations: ResolvedReservation[] }
export const nativeTextStyle = (style: ChartTextStyle) => ({ color: style.color, fontFamily: style.fontFamily, fontSize: style.size, fontWeight: style.weight, fontStyle: style.italic ? 'italic' : 'normal', lineHeight: Math.round(style.size * style.lineHeight / 100), align: style.align })
export const nativeGraphicTextStyle = (style: ChartTextStyle) => { const { color, ...rest } = nativeTextStyle(style); return { ...rest, fill: color } }
const textStyle = nativeTextStyle
const graphicTextStyle = nativeGraphicTextStyle
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
const contrastText = (color: string) => {
  const match = color.match(/^#([\da-f]{6})$/i)
  if (!match) return '#ffffff'
  const rgb = [0, 2, 4].map((offset) => Number.parseInt(match[1].slice(offset, offset + 2), 16))
  return (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000 > 150 ? '#202027' : '#ffffff'
}

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
      data: [{ value: [mark.categoryIndex, mark.value], elementId: mark.id, datumId: mark.datumId, seriesId: mark.seriesId, elementKey: mark.legacyKey, sourceSeriesName: series.name, displayValue: mark.displayValue, displayCategory: mark.displayCategory, displayColor: mark.style.color, itemStyle: { color: mark.style.color, opacity: mark.style.opacity, borderColor: mark.style.borderColor, borderWidth: mark.style.borderWidth } }],
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
      name: `__bar-value-labels:${series.name}`, type: 'custom', coordinateSystem: 'cartesian2d', silent: true, tooltip: { show: false }, clip: false, z: 20,
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
        const width = measureTextWidth(mark.label.text, mark.label.style.size, mark.label.style.fontFamily, mark.label.style.weight)
        const height = Math.round(mark.label.style.size * mark.label.style.lineHeight / 100)
        const stride = denseValueLabelStride(horizontal, band, maximumLabelWidth, maximumLabelHeight, config.valueLabelHideOverlap ?? false)
        if (!showDenseValueLabel(categoryIndex, scene.plot.categories.length, stride)) return null
        const placement = absorbedBarLabelPlacement(horizontal, start[horizontal ? 0 : 1], end[horizontal ? 0 : 1], category, width, height, config.barValueLabelAbsorptionPadding ?? 10, config.barValueLabelInsidePosition ?? 'end', config.barValueLabelOutsidePosition ?? 'end', geometry.width)
        return { type: 'text', info: { elementId: mark.id, datumId: mark.datumId, seriesId: mark.seriesId, elementKey: mark.legacyKey, sourceSeriesName: series.name, displayValue: mark.displayValue, displayCategory: mark.displayCategory, displayColor: mark.style.color }, style: { x: placement.x, y: placement.y, text: mark.label.text, ...graphicTextStyle(mark.label.style), fill: placement.inside && mark.label.autoContrast ? contrastText(mark.style.color) : mark.label.style.color, align: placement.align, verticalAlign: placement.verticalAlign } }
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
  if (requested != null) return Math.max(0, Math.round(requested) - 1)
  const categories = scene.plot.categories
  const slot = (scene.plot.categoryAxis.orientation === 'horizontal' ? scene.geometry.plot.width : scene.geometry.plot.height) / Math.max(1, categories.length)
  const longest = Math.max(0, ...categories.map((category) => measureTextWidth(category.label, scene.plot.categoryAxis.labels.style.size, scene.plot.categoryAxis.labels.style.fontFamily, scene.plot.categoryAxis.labels.style.weight)))
  if (categories.every((category) => typeof category.value === 'string' || typeof category.value === 'boolean' || category.value == null)) return 0
  if (!categories.some((category) => category.value instanceof Date)) return Math.max(0, Math.ceil((longest + 12) / Math.max(1, slot)) - 1)
  const visible = categories.flatMap((category, index) => category.label ? [index] : [])
  const naturalGap = visible.slice(1).reduce((gap, index, position) => Math.min(gap, index - visible[position]), Number.POSITIVE_INFINITY)
  const stride = Math.max(1, Math.ceil((longest + 10) / Math.max(1, slot * (Number.isFinite(naturalGap) ? naturalGap : categories.length))))
  const displayed = new Set(visible.filter((_, ordinal) => ordinal % stride === 0))
  return (index: number) => displayed.has(index)
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
    return {
      type: 'category', boundaryGap: true, position: side, data: scene.plot.categories.map((category) => category.coordinate),
      name: axis.orientation === 'vertical' ? '' : axis.title?.visible ? axis.title.text : '', nameLocation: 'middle', nameGap, nameRotate: axis.orientation === 'vertical' ? 90 : 0, nameTextStyle: axis.title ? textStyle(axis.title.style) : undefined,
      axisLine: { show: axis.line.visible, onZero: false, lineStyle }, axisTick: { show: axis.ticks.visible, inside: false, alignWithLabel: true, interval, length: axis.ticks.length, lineStyle },
      axisLabel: { show: axis.labels.visible, inside: false, margin: axis.labels.gap, rotate: axis.labels.rotation ?? 0, interval, hideOverlap: false, width: config.xAxisLabelOverflow === 'wrap' ? Math.max(20, slot - 8) : undefined, overflow: config.xAxisLabelOverflow === 'wrap' ? 'break' : config.xAxisLabelOverflow === 'truncate' ? 'truncate' : undefined, formatter: (value: string, index: number) => scene.plot.categories[index]?.label ?? labels.get(value) ?? value, ...textStyle(axis.labels.style), align: axis.orientation === 'vertical' ? side === 'right' ? 'left' : 'right' : undefined },
      splitLine: { show: false, lineStyle: { color: config.gridColor, width: config.gridWidth, type: config.gridType } },
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
    axisLabel: { show: axis.labels.visible, margin: axis.labels.gap, formatter: (value: number) => { const position = tickPosition(value); return edgeOverlay && (config.yAxisAffixScope === position || config.yAxisAffixScope === 'edges' && position !== 'middle') ? formatYAxisNumber(value, { ...config, numberPrefix: '', numberSuffix: '', yAxisAffixScope: 'all' }) : formatter(value, config, position) }, ...textStyle(axis.labels.style), align: axis.orientation === 'vertical' ? side === 'right' ? 'left' : 'right' : undefined },
    splitLine: { show: scene.plot.orientation === 'horizontal' ? config.showVerticalGrid : config.showHorizontalGrid, lineStyle: { color: config.gridColor, width: config.gridWidth, type: config.gridType } },
  }
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
    const lastIndex = item.marks.reduce((result, mark, index) => mark.value == null ? result : index, -1)
    const seriesStyle = config.seriesStyles[item.name]
    const directStyle = seriesStyle?.directLabelText ?? config.directLabelText ?? config.legendText
    return {
      id: item.id, name: item.name, type: 'bar', stack: scene.plot.stacking === 'none' ? undefined : 'total', triggerEvent: true, clip: true,
      barCategoryGap: `${100 - Math.max(10, Math.min(100, scene.plot.barWidth))}%`, barGap: `${scene.plot.seriesGap}%`,
      itemStyle: { color: item.color, opacity: seriesStyle?.fillOpacity ?? config.barFillOpacity ?? 1, borderWidth: 0, borderRadius: config.barBorderRadius ?? 0 },
      label: { show: config.showValues && !config.barValueLabelAbsorption, position: valueLabelPosition(config, config.kind), formatter: (params: { dataIndex?: number; value?: unknown }) => params.dataIndex == null ? formatYAxisNumber(params.value, config) : item.marks[params.dataIndex]?.label.text ?? '', ...textStyle(config.valueText), color: (config.valueLabelPosition ?? '').startsWith('inside-') ? contrastText(item.color) : config.valueText.color, hideOverlap: config.valueLabelHideOverlap ?? false },
      labelLayout: () => ({ hideOverlap: config.valueLabelHideOverlap ?? false, moveOverlap: horizontal ? 'shiftY' : 'shiftX' }),
      markLine: config.showZeroLine && config.yAxisScaleType !== 'log' ? { silent: true, symbol: 'none', data: [{ [horizontal ? 'xAxis' : 'yAxis']: 0 }], lineStyle: { color: config.zeroLineColor, width: config.zeroLineWidth, type: config.zeroLineType }, label: { show: false } } : undefined,
      data: item.marks.map((mark, index) => {
        const pointLabel = { show: mark.label.visible, formatter: mark.label.text, position: valueLabelPosition(config, config.kind), ...textStyle(mark.label.style), color: mark.label.autoContrast && (config.valueLabelPosition ?? '').startsWith('inside-') ? contrastText(mark.style.color) : mark.label.style.color }
        const direct = config.showDirectLabels && seriesStyle?.showDirectLabel !== false && index === lastIndex
        const custom = mark.style.width != null || mark.style.borderWidth > 0
        return {
          value: mark.value, name: scene.plot.categories[index]?.coordinate, elementId: mark.id, datumId: mark.datumId, seriesId: mark.seriesId, elementKey: mark.legacyKey, sourceSeriesName: item.name, displayValue: mark.displayValue, displayCategory: mark.displayCategory, displayColor: mark.style.color,
          ...(custom ? { itemStyle: { color: 'rgba(0,0,0,0)', opacity: 1 } } : mark.style.color !== item.color || mark.style.opacity !== (seriesStyle?.fillOpacity ?? config.barFillOpacity ?? 1) ? { itemStyle: { color: mark.style.color, opacity: mark.style.opacity } } : {}),
          label: direct ? { show: true, position: horizontal ? 'top' : config.yAxisPosition === 'right' ? 'left' : 'right', distance: config.directLabelGap, formatter: seriesStyle?.legendLabel?.trim() || item.name, rich: { name: { color: directStyle.color, fontFamily: directStyle.fontFamily, fontSize: directStyle.size, fontWeight: directStyle.weight } }, ...textStyle(directStyle) } : config.barValueLabelAbsorption ? { show: false } : pointLabel,
          emphasis: { label: pointLabel },
          valueLabel: pointLabel, directLegendLabel: direct, barWidthIntent: mark.style.width,
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
  const verticalTitle = verticalAxisTitle?.visible && verticalAxisTitle.text ? [{ id: 'chart-y-axis-title', type: 'text', left: verticalAxis.placement.kind === 'side' && verticalAxis.placement.side === 'left' ? scene.geometry.content.x : undefined, right: verticalAxis.placement.kind === 'side' && verticalAxis.placement.side === 'right' ? canvas.width - scene.geometry.content.x - scene.geometry.content.width : undefined, top: 'middle', rotation: verticalAxis.placement.kind === 'side' && verticalAxis.placement.side === 'right' ? -Math.PI / 2 : Math.PI / 2, style: { text: verticalAxisTitle.text, ...graphicTextStyle(verticalAxisTitle.style), align: 'center', verticalAlign: 'middle' } }] : []
  return {
    animation: true, backgroundColor: scene.document.canvas.background, color: scene.plot.series.map((item) => item.color), textStyle: { fontFamily: scene.document.theme.fontFamily },
    title: { text: titleElement?.text ?? '', subtext: subtitleElement?.text ?? '', left: scene.geometry.content.x, top: Math.max(0, scene.geometry.content.y - 8), textStyle: titleElement ? textStyle(titleElement.style) : undefined, subtextStyle: subtitleElement ? textStyle(subtitleElement.style) : undefined, itemGap: scene.document.composition.titleSubtitle, triggerEvent: true },
    tooltip: { trigger: 'axis', formatter: (input: unknown) => { const items = (Array.isArray(input) ? input : [input]) as Array<{ dataIndex?: number; seriesName?: string; value?: unknown; data?: { displayValue?: string; displayCategory?: string } }>; const index = items[0]?.dataIndex ?? 0; return [`<b>${escapeHtml(items[0]?.data?.displayCategory ?? scene.plot.series[0]?.marks[index]?.displayCategory ?? '')}</b>`, ...items.filter((item) => item.seriesName).map((item) => `${escapeHtml(item.seriesName)}: <b>${escapeHtml(item.data?.displayValue ?? formatYAxisNumber(item.value, config))}</b>`)].join('<br/>') } },
    legend: { show: Boolean(legendGuide?.visible && legendItems.length), data: legendItems.map((item) => ({ name: item.rendererName, icon: config.legendMarker === 'circle' ? 'circle' : config.legendMarker === 'diamond' ? 'diamond' : config.legendMarker === 'triangle' ? 'triangle' : 'rect', itemStyle: { color: item.color, borderWidth: 0 } })), formatter: (name: string) => legendLabels.get(name) ?? name, orient: legendGuide?.kind === 'categorical-legend' && (legendGuide.position === 'left' || legendGuide.position === 'right') ? 'vertical' : 'horizontal', left: legendRail?.x ?? scene.geometry.content.x, top: legendRail?.y, right: legendGuide?.kind === 'categorical-legend' && legendGuide.position === 'right' ? canvas.width - (legendRail?.x ?? 0) - (legendRail?.width ?? 0) : undefined, itemWidth: 10, itemHeight: 10, itemGap: 18, textStyle: textStyle(config.legendText) },
    grid: { left: plot.x, top: plot.y, right: canvas.width - plot.x - plot.width, bottom: canvas.height - plot.y - plot.height, containLabel: false },
    xAxis: horizontal ? renderNativeCartesianAxis(scene, 'value') : renderNativeCartesianAxis(scene, 'category'),
    yAxis: horizontal ? renderNativeCartesianAxis(scene, 'category') : renderNativeCartesianAxis(scene, 'value'),
    series: [...series, ...customBarSeries(scene), ...absorbedLabelSeries(scene), ...valueEdgeAffixSeries(scene)],
    graphic: [...verticalTitle, ...footerGraphics],
  }
}
