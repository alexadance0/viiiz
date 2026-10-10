import { contrastText } from '../../../core/color'
import { measureTextWidth, wrapMeasuredText } from '../../../core/textMetrics'
import { nativeGraphicTextStyle, renderNativeBarScene, type ResolvedNativeBarScene } from './renderBarScene'
import { horizontalCategoryLabelPlacement, verticalAxisLabelPlacement, reservedAxisLabelGap } from '../../chart-layout/axisLabelPlacement'
import { seriesTooltip } from './chartTooltip'

export function renderMarimekkoScene(scene: ResolvedNativeBarScene): Record<string, unknown> {
  const config = scene.compatibilityConfig, plot = scene.geometry.plot
  const option = renderNativeBarScene(scene)
  const axis = scene.plot.categoryAxis
  const horizontal = scene.plot.orientation === 'horizontal'
  const right = axis.placement.kind === 'side' && axis.placement.side === 'right'
  const top = axis.placement.kind === 'side' && axis.placement.side === 'top'
  const categoryGraphics = scene.plot.categories.flatMap((category) => {
    const bounds = scene.geometry.elements[`category-label:${category.id}`]
    if (!bounds || (horizontal ? bounds.height : bounds.width) < (horizontal || axis.labels.rotation ? Math.round(axis.labels.style.size * axis.labels.style.lineHeight / 100) : axis.labels.style.size * 2) + 8) return []
    const x = horizontal ? right ? plot.x + plot.width : plot.x : bounds.x + bounds.width / 2
    const y = horizontal ? bounds.y + bounds.height / 2 : top ? plot.y : plot.y + plot.height
    const rotation = horizontal ? 0 : axis.labels.rotation ?? 0
    const text = config.xAxisLabelOverflow === 'wrap' && !rotation ? wrapMeasuredText(category.label, axis.labels.style.size, Math.max(1, bounds.width - (horizontal ? 0 : 8)), axis.labels.style.fontFamily, axis.labels.style.weight, false).text : category.label
    const tick = axis.ticks.visible ? axis.ticks.length : 0
    const verticalPlacement = verticalAxisLabelPlacement(right ? 'right' : 'left', axis.labels.size, reservedAxisLabelGap(axis, plot, scene.geometry.axes.category), tick, config.categoryAxisLabelAlignment)
    const labelX = horizontal ? x + (right ? 1 : -1) * verticalPlacement.margin : x
    const labelY = horizontal ? y : y + (top ? -1 : 1) * (axis.labels.gap + tick)
    return [
      ...(axis.labels.visible ? [{ id: `category-label:${category.id}`, type: 'text', z: 30, rotation: rotation * Math.PI / 180, x: labelX, y: labelY, info: { selectionTarget: 'category-label', elementKey: `category-label:${horizontal ? 'y' : 'x'}:${category.coordinate}`, displayCategory: category.coordinate, displayValue: category.label, axis: horizontal ? 'y' : 'x' }, style: { text, ...nativeGraphicTextStyle(axis.labels.style), ...(horizontal ? { align: verticalPlacement.align, verticalAlign: 'middle' } : horizontalCategoryLabelPlacement(top ? 'top' : 'bottom', rotation)), ...(config.xAxisLabelOverflow === 'truncate' && !rotation ? { width: Math.max(1, bounds.width - (horizontal ? 0 : 8)), overflow: 'truncate' } : {}) } }] : []),
      ...(axis.ticks.visible ? [{ type: 'line', silent: true, shape: { x1: x, y1: y, x2: horizontal ? x + (right ? tick : -tick) : x, y2: horizontal ? y : y + (top ? -tick : tick) }, style: { stroke: config.axisLineColor, lineWidth: config.axisLineWidth } }] : []),
      ...((horizontal ? config.showHorizontalGrid : config.showVerticalGrid) ? [{ type: 'line', silent: true, z: 1, shape: horizontal ? { x1: plot.x, y1: y, x2: plot.x + plot.width, y2: y } : { x1: x, y1: plot.y, x2: x, y2: plot.y + plot.height }, style: { stroke: config.gridColor, lineWidth: config.gridWidth } }] : []),
    ]
  })
  const series = scene.plot.series.map((series, seriesIndex) => ({
    id: series.id, name: series.name, type: 'custom', hoverScope: 'series', coordinateSystem: 'cartesian2d', triggerEvent: true, clip: true, z: 4,
    itemStyle: { color: series.color },
    data: series.marks.flatMap((mark) => {
      if (mark.value == null || mark.value <= 0) return []
      const span = scene.plot.categories[mark.categoryIndex].span!
      const lower = scene.plot.series.slice(0, seriesIndex).reduce((sum, series) => sum + (series.marks[mark.categoryIndex]?.value ?? 0), 0)
      return [{ id: mark.id, value: [span.start, span.end, lower, lower + mark.value, mark.categoryIndex], elementId: mark.id, datumId: mark.datumId, seriesId: mark.seriesId, elementKey: mark.legacyKey, sourceSeriesName: series.name, displayCategory: mark.displayCategory, displayValue: mark.displayValue, displayColor: mark.style.color, markIndex: mark.categoryIndex }]
    }),
    renderItem: (_params: unknown, api: { value(index: number): number; coord(value: [number, number]): [number, number] }) => {
      const first = api.coord(horizontal ? [api.value(2), api.value(0)] : [api.value(0), api.value(3)]), last = api.coord(horizontal ? [api.value(3), api.value(1)] : [api.value(1), api.value(2)])
      const mark = series.marks[api.value(4)]
      const shape = { x: Math.min(first[0], last[0]), y: Math.min(first[1], last[1]), width: Math.abs(last[0] - first[0]), height: Math.abs(last[1] - first[1]) }
      const info = { elementId: mark.id, datumId: mark.datumId, seriesId: mark.seriesId, elementKey: mark.legacyKey, sourceSeriesName: series.name, displayValue: mark.displayValue, displayCategory: mark.displayCategory, displayColor: mark.style.color }
      const width = Math.max(...mark.label.text.split('\n').map((line) => measureTextWidth(line, mark.label.style.size, mark.label.style.fontFamily, mark.label.style.weight)))
      const height = mark.label.text.split('\n').length * mark.label.style.size * mark.label.style.lineHeight / 100
      const label = mark.label.visible && width + 8 <= shape.width && height + 8 <= shape.height
      return { type: 'group', children: [
        { type: 'rect', info, shape, style: { fill: mark.style.color, opacity: mark.style.opacity, stroke: mark.style.borderWidth > 0 ? mark.style.borderColor : scene.document.canvas.background, lineWidth: mark.style.borderWidth > 0 ? mark.style.borderWidth : 1 } },
        ...(label ? [{ type: 'text', info, style: { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2, text: mark.label.text, ...nativeGraphicTextStyle(mark.label.style), fill: mark.label.autoContrast ? contrastText(mark.style.color, 4.5, mark.style.opacity, config.canvasBackground) : mark.label.style.color, align: 'center', verticalAlign: 'middle' } }] : []),
      ] }
    },
  }))
  const xAxis = option.xAxis as Record<string, unknown>
  const yAxis = option.yAxis as Record<string, unknown>
  const categoryAxis = { ...(horizontal ? yAxis : xAxis), type: 'value', min: 0, max: 100, interval: undefined, inverse: horizontal ? config.categoryAxisInverse ?? true : false, boundaryGap: [0, 0], data: undefined, axisLabel: { show: false }, axisTick: { show: false }, splitLine: { show: false } }
  const valueAxis = horizontal ? xAxis : yAxis
  return { ...option, animation: false,
    xAxis: horizontal ? valueAxis : categoryAxis,
    yAxis: horizontal ? categoryAxis : valueAxis,
    tooltip: { trigger: 'item', formatter: (input: { data?: { markIndex?: number } }) => {
      const index = input.data?.markIndex
      if (index == null || !scene.plot.categories[index]) return ''
      return seriesTooltip(scene.plot.series.flatMap((series) => {
        const mark = series.marks[index]
        return mark ? [{ seriesName: series.name, dataIndex: index, data: { displayCategory: mark.displayCategory, displayValue: mark.displayValue, displayColor: mark.style.color } }] : []
      }), config, scene.plot.series, (index) => scene.plot.categories[index].label)
    } },
    series, graphic: [...(option.graphic as Array<{ id?: string }>).filter((graphic) => !graphic.id?.startsWith('bar-category-grid:')), ...categoryGraphics],
  }
}
