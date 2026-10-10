import type { ChartConfig } from '../../../core/types'
import type { ColorScaleGeometry, ColorScaleGuide } from '../../chart-layout/guides/colorScale'

export function renderColorScale(guide: ColorScaleGuide | undefined, scale: ColorScaleGeometry | undefined, config: ChartConfig) {
  if (!guide?.visible || !scale) return []
  const vertical = guide.position === 'left' || guide.position === 'right', style = guide.style ?? config.legendText
  const textStyle = { fill: style.color, fontFamily: style.fontFamily, fontSize: style.size, fontWeight: style.weight, fontStyle: style.italic ? 'italic' : 'normal', lineHeight: Math.round(style.size * style.lineHeight / 100) }
  const blocks = guide.segments ? guide.segments.map((segment, index) => {
    const from = (segment.from - guide.minimum) / (guide.maximum - guide.minimum), to = (segment.to - guide.minimum) / (guide.maximum - guide.minimum)
    const shape = vertical ? { x: scale.bar.x, y: scale.bar.y + scale.bar.height * (1 - to), width: scale.bar.width, height: scale.bar.height * (to - from) } : { x: scale.bar.x + scale.bar.width * from, y: scale.bar.y, width: scale.bar.width * (to - from), height: scale.bar.height }
    return { id: `heatmap-scale-segment-${index}`, type: 'rect', silent: true, z: 90, shape, style: { fill: segment.color } }
  }) : [{ id: 'heatmap-scale-bar', type: 'rect', silent: true, z: 90, shape: scale.bar, style: { fill: { type: 'linear', x: 0, y: 0, x2: vertical ? 0 : 1, y2: vertical ? 1 : 0, colorStops: (guide.stops ?? []).map((stop) => vertical ? { offset: 1 - stop.offset, color: stop.color } : stop).sort((a, b) => a.offset - b.offset) } } }]
  const ticks = scale.ticks.flatMap((tick, index) => [
    ...(!guide.intervalLabels ? [{ id: `heatmap-scale-tick-${index}`, type: 'line', silent: true, z: 91, shape: vertical ? { x1: scale.bar.x - 3, y1: tick.y, x2: scale.bar.x + scale.bar.width + 3, y2: tick.y } : { x1: tick.x, y1: scale.bar.y - 3, x2: tick.x, y2: scale.bar.y + scale.bar.height + 3 }, style: { stroke: style.color, lineWidth: 1 } }] : []),
    { id: `heatmap-scale-label-${index}`, type: 'text', silent: true, z: 91, style: { x: tick.x, y: tick.y, text: tick.label, ...textStyle, align: tick.align, verticalAlign: tick.verticalAlign } },
  ])
  const missing = guide.missing && scale.missing ? [{ id: 'heatmap-scale-missing', type: 'group', silent: true, z: 91, clipPath: { type: 'rect', shape: scale.missing.bar }, children: [
    { type: 'rect', shape: scale.missing.bar, style: { fill: guide.missing.color } },
    ...(guide.missing.pattern ? Array.from({ length: Math.ceil((scale.missing.bar.width + scale.missing.bar.height) / 6) + 1 }, (_, i) => ({ type: 'line', shape: { x1: scale.missing!.bar.x - scale.missing!.bar.height + i * 6, y1: scale.missing!.bar.y + scale.missing!.bar.height, x2: scale.missing!.bar.x + i * 6, y2: scale.missing!.bar.y }, style: { stroke: config.axisLineColor, lineWidth: 1, opacity: .5 } })) : []),
  ] }, { id: 'heatmap-scale-missing-label', type: 'text', silent: true, z: 91, style: { x: scale.missing.label.x, y: scale.missing.label.y, text: scale.missing.label.label, ...textStyle, align: scale.missing.label.align, verticalAlign: scale.missing.label.verticalAlign } }] : []
  return [...blocks, ...ticks, ...missing]
}
