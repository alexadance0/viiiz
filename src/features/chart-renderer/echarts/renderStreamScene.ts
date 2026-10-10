import { missingCalendarPeriod } from '../../../core/chartDateAxis'
import { renderCartesianPointBase, type ResolvedPointScene } from './renderLineAreaScene'
import { streamBoundaryTangents } from './streamCurve'
import { contrastText, visibleFillColor } from '../../../core/color'
import { measureTextWidth } from '../../../core/textMetrics'
import { nativeGraphicTextStyle } from './renderBarScene'
import { placeStreamLabel, type StreamLabelSegment } from './streamLabelPlacement'

export function renderStreamScene(scene: ResolvedPointScene): Record<string, unknown> {
  if (scene.plot.kind !== 'area') throw new Error('Stream Graph requires area geometry.')
  const plot = scene.plot
  const config = scene.compatibilityConfig
  const midpointSeries = plot.series.map((item) => ({ ...item, stroke: { ...item.stroke, opacity: 0 }, marker: { ...item.marker, visible: false }, points: item.points.map((point, index) => ({ ...point, marker: { ...point.marker, visible: config.elementStyles[point.legacyKey]?.showMarker ?? false }, value: point.value == null ? null : (item.streamBands![index].lower + item.streamBands![index].upper) / 2 })) }))
  const option = renderCartesianPointBase({ ...scene, plot: { ...scene.plot, mode: 'line', stacking: 'none', series: midpointSeries } })
  const curveCache = new Map<string, { x: number[]; tangents: number[][] }>()
  const directGuide = scene.guides.find((guide) => guide.kind === 'direct-series')
  const labels: Array<Record<string, unknown>> = []
  const bands = plot.series.map((item, layerIndex) => {
    const valid = item.points.flatMap((point, index) => point.value == null ? [] : [index])
    const runs: number[][] = []
    for (const index of valid) {
      const previous = runs.at(-1)?.at(-1)
      if (previous == null || item.missing !== 'connect' && index !== previous + 1 || item.missing === 'gap' && missingCalendarPeriod(plot.categories[previous]?.value, plot.categories[index]?.value, plot.dateAxis?.frequency)) runs.push([index])
      else runs.at(-1)!.push(index)
    }
    const visibleRuns = runs.filter((run) => run.length > 1)
    const curves = visibleRuns.map((run) => {
      const key = run.join(',')
      if (!curveCache.has(key)) {
        const x = run.map((index) => plot.dateAxis ? Number(plot.categories[index].value) : index)
        curveCache.set(key, { x, tangents: streamBoundaryTangents(x, plot.series.map((layer) => run.map((index) => layer.streamBands![index]))) })
      }
      return curveCache.get(key)!
    })
    const info = { seriesId: item.id, sourceSeriesName: item.name, displayColor: item.color, streamBand: true }
    const label = directGuide?.items.find((label) => label.seriesId === item.id)
    if (directGuide?.visible && label?.visible) {
      const text = `${label.label}${label.note ? `\n${label.note}` : ''}`
      const style = label.style
      const width = Math.max(...text.split('\n').map((line) => measureTextWidth(line, style.size, style.fontFamily, style.weight)))
      const height = text.split('\n').length * style.size * style.lineHeight / 100
      labels.push({
        id: `stream-label:${item.id}`, labelLayer: true, name: item.name, type: 'custom', coordinateSystem: 'cartesian2d', clip: false, silent: true, z: 100,
        tooltip: { show: false }, data: [[0]],
        renderItem: (_params: unknown, api: { coord(value: unknown[]): [number, number] }) => {
          let best: ReturnType<typeof placeStreamLabel>
          for (const [runIndex, run] of visibleRuns.entries()) {
            const curve = curves[runIndex]
            const coordinate = (position: number, value: number) => api.coord([plot.dateAxis ? Number(plot.categories[run[position]].value) : plot.categories[run[position]].coordinate, value])
            const segments: StreamLabelSegment[] = run.slice(1).flatMap((index, segmentIndex) => {
              const next = segmentIndex + 1, previous = run[segmentIndex]
              const [x0] = coordinate(segmentIndex, 0), [x1] = coordinate(next, 0)
              if (x0 === x1) return []
              const delta = (curve.x[next] - curve.x[segmentIndex]) / 3
              const boundary = (side: 'lower' | 'upper'): StreamLabelSegment['top'] => {
                const start = item.streamBands![previous][side], end = item.streamBands![index][side]
                const y0 = coordinate(segmentIndex, start)[1], y1 = coordinate(next, end)[1]
                const tangents = curve.tangents[layerIndex + (side === 'upper' ? 1 : 0)]
                const points: StreamLabelSegment['top'] = config.streamSmooth === false ? [y0, y0 + (y1 - y0) / 3, y0 + (y1 - y0) * 2 / 3, y1] : [y0, coordinate(segmentIndex, start + delta * tangents[segmentIndex])[1], coordinate(next, end - delta * tangents[next])[1], y1]
                return x0 < x1 ? points : [points[3], points[2], points[1], points[0]]
              }
              const upper = boundary('upper'), lower = boundary('lower')
              const inverted = plot.valueAxisInverse
              return [{ left: Math.min(x0, x1), right: Math.max(x0, x1), top: inverted ? lower : upper, bottom: inverted ? upper : lower }]
            }).sort((a, b) => a.left - b.left)
            const placement = placeStreamLabel(segments, width, height, scene.geometry.plot, true)
            if (placement && (!best || placement.clearance > best.clearance)) best = placement
          }
          if (!best) return null
          const silhouetteColor = visibleFillColor(item.fill.color, item.fill.opacity, config.canvasBackground ?? '#ffffff')
          const color = config.seriesStyles[item.name]?.directLabelText?.color ?? contrastText(item.fill.color, 4.5, item.fill.opacity, config.canvasBackground ?? '#ffffff')
          const textStyle = { ...nativeGraphicTextStyle({ ...style, color }), text, x: best.x, y: best.y, align: 'center', verticalAlign: 'middle' }
          const pinned = config.directLabelPositions?.[`${config.kind}:${item.id}:0`]
          if (!best.overflow && !pinned) return { type: 'text', style: textStyle }
          // Match annotation silhouettes: a filled outline beneath untouched foreground glyphs.
          return { type: 'group', children: [
            { type: 'text', info: { labelHalo: true, displayColor: item.fill.color, fillOpacity: item.fill.opacity }, style: { ...textStyle, fill: silhouetteColor, stroke: silhouetteColor, lineWidth: Math.max(3, style.size * .35) } },
            { type: 'text', style: textStyle },
          ] }
        },
      })
    }
    return {
      id: `stream-band:${item.id}`, name: item.name, type: 'custom', coordinateSystem: 'cartesian2d', clip: true, triggerEvent: true, z: 10,
      itemStyle: { color: item.color }, tooltip: { show: false },
      data: visibleRuns.map((run) => ({ value: [run[0], run.at(-1)!], displayValue: item.points[run[0]].displayValue, ...info })),
      renderItem: (params: { dataIndex: number }, api: { coord(value: unknown[]): [number, number] }) => {
        const run = visibleRuns[params.dataIndex]
        const curve = curves[params.dataIndex]
        const coordinate = (index: number, value: number) => api.coord([plot.dateAxis ? Number(plot.categories[index].value) : plot.categories[index].coordinate, value])
        const edge = (side: 'lower' | 'upper', reverse = false) => (reverse ? [...run].reverse() : run).map((index, position, indices) => {
          const [x, y] = coordinate(index, item.streamBands![index][side])
          if (!position || config.streamSmooth === false) return `L${x},${y}`
          const previous = indices[position - 1]
          const from = reverse ? run.length - position : position - 1, to = reverse ? from - 1 : position
          const delta = (curve.x[to] - curve.x[from]) / 3
          const tangents = curve.tangents[layerIndex + (side === 'upper' ? 1 : 0)]
          const [previousX] = coordinate(previous, item.streamBands![previous][side])
          const [, controlY1] = coordinate(previous, item.streamBands![previous][side] + delta * tangents[from])
          const [, controlY2] = coordinate(index, item.streamBands![index][side] - delta * tangents[to])
          return `C${previousX + (x - previousX) / 3},${controlY1} ${x - (x - previousX) / 3},${controlY2} ${x},${y}`
        }).join(' ')
        return { type: 'path', info, shape: { pathData: `${edge('upper').replace(/^L/, 'M')} ${edge('lower', true)} Z` }, style: { fill: item.fill.color, opacity: item.fill.opacity }, emphasis: { style: { opacity: 1 } } }
      },
    }
  })
  // Keep the shared points for value labels, tooltips and selection.
  option.series = [...bands, ...labels, ...(option.series as Array<Record<string, unknown>>).map((item) => ({ ...item, z: item.z ?? 30 }))]
  return option
}
