import { formatYAxisNumber } from '../../../core/numberFormat'
import type { ChartTextStyle } from '../../../core/types'
import { slopeGuideValues, type ResolvedSlopeScene } from '../../chart-types/slope/layout'

const textStyle = (style: ChartTextStyle) => ({ color: style.color, fontFamily: style.fontFamily, fontSize: style.size, fontWeight: style.weight, fontStyle: style.italic ? 'italic' : 'normal', lineHeight: Math.round(style.size * style.lineHeight / 100), align: style.align })
const graphicTextStyle = (style: ChartTextStyle) => { const { color, ...rest } = textStyle(style); return { ...rest, fill: color } }
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
const lineDash = (type: 'solid' | 'dashed' | 'dotted') => type === 'dashed' ? [6, 4] : type === 'dotted' ? [2, 3] : undefined
const tickPosition = (value: number, min: number, max: number) => Math.abs(value - min) < 1e-9 ? 'first' as const : Math.abs(value - max) < 1e-9 ? 'last' as const : 'middle' as const

function valueY(scene: ResolvedSlopeScene, value: number) {
  const { min, max } = scene.plot.valueDomain
  const ratio = scene.compatibilityConfig.yAxisScaleType === 'log'
    ? (Math.log(value) - Math.log(min)) / Math.max(Number.EPSILON, Math.log(max) - Math.log(min))
    : (value - min) / Math.max(Number.EPSILON, max - min)
  return scene.geometry.plot.y + scene.geometry.plot.height * (1 - ratio)
}

function guideGraphics(scene: ResolvedSlopeScene) {
  const config = scene.compatibilityConfig, geometry = scene.slopeGeometry, plot = scene.geometry.plot
  const gridStyle = { stroke: scene.plot.guides.grid.color, lineWidth: scene.plot.guides.grid.width, lineDash: lineDash(scene.plot.guides.grid.type) }
  const axisStyle = { stroke: scene.plot.guides.axisLine.color, lineWidth: scene.plot.guides.axisLine.width, lineDash: lineDash(scene.plot.guides.axisLine.type) }
  const values = slopeGuideValues(scene)
  const valueStyle = scene.plot.valueAxis.labels.style
  const labelX = geometry.valueScaleLabelRail ? geometry.valueScaleLabelRail.x + geometry.valueScaleLabelRail.width : geometry.guideLeft - scene.plot.valueAxis.labels.gap
  return [
    ...values.flatMap((value) => {
      const y = valueY(scene, value)
      return [
        ...(scene.plot.guides.horizontal ? [{ id: `slope-guide:h:${value}`, type: 'line', silent: true, shape: { x1: geometry.guideLeft, y1: y, x2: geometry.guideRight, y2: y }, style: gridStyle }] : []),
        ...(scene.plot.guides.internalValueLabels ? [{ id: `slope-scale:${value}`, type: 'text', silent: true, style: { x: labelX, y, text: formatYAxisNumber(value, config, tickPosition(value, scene.plot.valueDomain.min, scene.plot.valueDomain.max)), ...graphicTextStyle(valueStyle), align: 'right', verticalAlign: 'middle' } }] : []),
      ]
    }),
    ...(scene.plot.guides.vertical ? [geometry.firstX, geometry.lastX].map((x, index) => ({ id: `slope-guide:v:${index}`, type: 'line', silent: true, shape: { x1: x, y1: plot.y, x2: x, y2: plot.y + plot.height }, style: gridStyle })) : []),
    ...(scene.plot.guides.xAxisLine ? [{ id: 'slope-axis:x', type: 'line', silent: true, shape: { x1: geometry.guideLeft, y1: geometry.axisY, x2: geometry.guideRight, y2: geometry.axisY }, style: axisStyle }] : []),
  ]
}

const endpointText = (valueText?: string, seriesText?: string) => [valueText, seriesText].filter(Boolean).join(' ')

function labelGraphics(scene: ResolvedSlopeScene) {
  const items = new Map(scene.plot.endpointLabels.items.map((item) => [item.id, item]))
  const series = new Map(scene.plot.series.map((item) => [item.id, item]))
  return [
    ...Object.values(scene.slopeGeometry.endpointLabels).flatMap((placement) => {
      const item = items.get(placement.id)
      if (!item) return []
      const color = series.get(placement.seriesId)?.change?.resolvedColor ?? item.color
      return [
        ...(placement.leaderRequired ? [{ id: `slope-label-leader:${placement.id}`, type: 'line', silent: true, shape: { x1: placement.anchorX, y1: placement.anchorY, x2: placement.x, y2: placement.y }, style: { stroke: color, lineWidth: 1, opacity: .52 } }] : []),
        { id: placement.id, type: 'text', silent: true, style: { x: placement.x, y: placement.y, text: endpointText(item.valueText, item.seriesText), ...graphicTextStyle(item.style), fill: item.color, align: placement.side === 'left' ? 'right' : 'left', verticalAlign: 'middle' } },
      ]
    }),
    ...Object.values(scene.slopeGeometry.changeLabels).map((placement) => ({
      id: `slope-change:${placement.seriesId}`, type: 'text', silent: true,
      style: { x: placement.x + placement.width / 2, y: placement.y + placement.height / 2, text: placement.text, ...graphicTextStyle(scene.compatibilityConfig.valueText), fill: placement.color, align: 'center', verticalAlign: 'middle', backgroundColor: scene.document.canvas.background, padding: [2, 4] },
    })),
  ]
}

export function renderNativeSlopeScene(scene: ResolvedSlopeScene): Record<string, unknown> {
  const config = scene.compatibilityConfig, plot = scene.geometry.plot, canvas = scene.geometry.canvas
  const title = scene.frameElements.find((item) => item.role === 'title'), subtitle = scene.frameElements.find((item) => item.role === 'subtitle')
  const footer = scene.frameElements.filter((item) => item.role === 'note' || item.role === 'source').map((item, index, items) => ({ id: `chart-${item.role}`, type: 'text', left: scene.geometry.content.x, bottom: canvas.height - scene.geometry.content.y - scene.geometry.content.height + (items.length - index - 1) * (Math.round(item.style.size * item.style.lineHeight / 100) + scene.document.composition.noteSource), style: { text: item.text, width: scene.geometry.content.width, overflow: 'break', ...graphicTextStyle(item.style) } }))
  const verticalTitle = scene.plot.valueAxis.title?.visible && scene.plot.valueAxis.title.text ? [{ id: 'chart-y-axis-title', type: 'text', left: config.yAxisPosition === 'left' ? scene.geometry.content.x : undefined, right: config.yAxisPosition === 'right' ? canvas.width - scene.geometry.content.x - scene.geometry.content.width : undefined, top: 'middle', rotation: config.yAxisPosition === 'right' ? -Math.PI / 2 : Math.PI / 2, style: { text: scene.plot.valueAxis.title.text, ...graphicTextStyle(scene.plot.valueAxis.title.style), align: 'center', verticalAlign: 'middle' } }] : []
  const series = scene.plot.series.map((item) => ({
    id: item.id, name: item.name, type: 'line', triggerEvent: true, clip: false, showSymbol: true, symbol: item.marker.shape, symbolSize: item.marker.size, connectNulls: false,
    lineStyle: item.stroke, itemStyle: { color: item.marker.fill, borderColor: item.marker.stroke, borderWidth: item.marker.strokeWidth },
    data: item.points.map((point) => {
      return {
        value: point.value, name: scene.plot.positions[point.categoryIndex].coordinate,
        elementId: point.id, datumId: point.datumId, seriesId: point.seriesId, elementKey: point.legacyKey, sourceSeriesName: item.name, displayValue: point.displayValue, displayCategory: point.displayCategory, displayColor: item.color,
        symbolSize: point.value == null ? 0 : item.marker.size,
        itemStyle: { color: item.marker.fill, borderColor: item.marker.stroke, borderWidth: item.marker.strokeWidth },
        label: { show: false },
      }
    }),
  }))
  const hits = scene.plot.series.map((item) => ({ name: `__hit__:${item.name}`, interactionLayer: 'hit', type: 'line', triggerEvent: true, silent: false, symbolSize: Math.max(14, item.marker.size), lineStyle: { color: 'rgba(0,0,0,0)', width: 14, opacity: 0 }, itemStyle: { opacity: 0 }, tooltip: { show: false }, z: 100, data: item.points.map((point) => ({ value: point.value, name: scene.plot.positions[point.categoryIndex].coordinate, elementId: point.id, datumId: point.datumId, seriesId: point.seriesId, elementKey: point.legacyKey, sourceSeriesName: item.name, displayValue: point.displayValue, displayCategory: point.displayCategory })) }))
  const category = scene.plot.categoryAxis, value = scene.plot.valueAxis
  const categorySide = category.placement.kind === 'side' ? category.placement.side : 'bottom'
  const valueSide = value.placement.kind === 'side' ? value.placement.side : 'left'
  const axisLineStyle = { color: config.axisLineColor, width: config.axisLineWidth, type: config.axisLineType }
  const categoryNameGap = (category.ticks.visible ? category.ticks.length : 0) + (category.labels.visible ? category.labels.gap + category.labels.size : 0) + (category.title?.gap ?? 0)
  return {
    animation: true, backgroundColor: scene.document.canvas.background, color: scene.plot.series.map((item) => item.change?.resolvedColor ?? item.color), textStyle: { fontFamily: scene.document.theme.fontFamily },
    title: { text: title?.text ?? '', subtext: subtitle?.text ?? '', left: scene.geometry.content.x, top: Math.max(0, scene.geometry.content.y - 8), textStyle: title ? textStyle(title.style) : undefined, subtextStyle: subtitle ? textStyle(subtitle.style) : undefined, itemGap: scene.document.composition.titleSubtitle, triggerEvent: true },
    tooltip: { trigger: 'axis', formatter: (input: unknown) => { const items = (Array.isArray(input) ? input : [input]) as Array<{ seriesName?: string; data?: { displayCategory?: string; displayValue?: string } }>; const visible = items.filter((entry) => entry.seriesName && !entry.seriesName.startsWith('__')); return [`<b>${escapeHtml(visible[0]?.data?.displayCategory ?? '')}</b>`, ...visible.flatMap((entry) => { const change = scene.plot.series.find((series) => series.name === entry.seriesName)?.change; return [`${escapeHtml(entry.seriesName)}: <b>${escapeHtml(entry.data?.displayValue ?? '')}</b>`, ...(change ? [`Изменение: <b>${escapeHtml(change.label)}</b>`] : [])] })].join('<br/>') } },
    legend: { show: false },
    grid: { left: plot.x, top: plot.y, right: canvas.width - plot.x - plot.width, bottom: canvas.height - plot.y - plot.height, containLabel: false },
    xAxis: { type: 'category', boundaryGap: true, position: categorySide, data: scene.plot.positions.map((position) => position.coordinate), triggerEvent: true, name: category.title?.visible ? category.title.text : '', nameLocation: 'middle', nameGap: categoryNameGap, nameTextStyle: category.title ? textStyle(category.title.style) : undefined, axisLine: { show: false, onZero: false, lineStyle: axisLineStyle }, axisTick: { show: category.ticks.visible, alignWithLabel: true, length: category.ticks.length, lineStyle: axisLineStyle }, axisLabel: { show: category.labels.visible, margin: category.labels.gap, rotate: category.labels.rotation ?? 0, interval: 0, hideOverlap: false, formatter: (_label: string, index: number) => scene.plot.positions[index]?.label ?? '', ...textStyle(category.labels.style), align: 'center' }, splitLine: { show: false } },
    yAxis: { type: config.yAxisScaleType === 'log' ? 'log' : 'value', logBase: config.yAxisScaleType === 'log' ? 10 : undefined, position: valueSide, min: scene.plot.valueDomain.min, max: scene.plot.valueDomain.max, interval: config.yAxisScaleType === 'log' ? undefined : scene.plot.valueDomain.step, name: '', axisLine: { show: value.line.visible, onZero: false, lineStyle: axisLineStyle }, axisTick: { show: value.ticks.visible, length: value.ticks.length, lineStyle: axisLineStyle }, axisLabel: { show: false }, splitLine: { show: false } },
    series: [...series, ...hits], graphic: [...verticalTitle, ...guideGraphics(scene), ...labelGraphics(scene), ...footer],
  }
}
