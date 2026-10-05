import { missingCalendarPeriod } from '../../../core/chartDateAxis'
import { renderCartesianPointBase, type ResolvedPointScene } from './renderLineAreaScene'

export function renderStreamScene(scene: ResolvedPointScene): Record<string, unknown> {
  if (scene.plot.kind !== 'area') throw new Error('Stream Graph requires area geometry.')
  const config = scene.compatibilityConfig
  const midpointSeries = scene.plot.series.map((item) => ({ ...item, stroke: { ...item.stroke, opacity: 0 }, marker: { ...item.marker, visible: false }, points: item.points.map((point, index) => ({ ...point, marker: { ...point.marker, visible: false }, value: point.value == null ? null : (item.streamBands![index].lower + item.streamBands![index].upper) / 2 })) }))
  const option = renderCartesianPointBase({ ...scene, plot: { ...scene.plot, mode: 'line', stacking: 'none', series: midpointSeries } })
  const bands = scene.plot.series.map((item) => {
    const valid = item.points.flatMap((point, index) => point.value == null ? [] : [index])
    const runs: number[][] = []
    for (const index of valid) {
      const previous = runs.at(-1)?.at(-1)
      if (previous == null || item.missing !== 'connect' && index !== previous + 1 || item.missing === 'gap' && missingCalendarPeriod(scene.plot.categories[previous]?.value, scene.plot.categories[index]?.value, scene.plot.dateAxis?.frequency)) runs.push([index])
      else runs.at(-1)!.push(index)
    }
    const visibleRuns = runs.filter((run) => run.length > 1)
    const info = { seriesId: item.id, sourceSeriesName: item.name, displayColor: item.color, streamBand: true }
    return {
      id: `stream-band:${item.id}`, name: item.name, type: 'custom', coordinateSystem: 'cartesian2d', clip: true, triggerEvent: true, z: 10,
      itemStyle: { color: item.color }, tooltip: { show: false },
      data: visibleRuns.map((run) => ({ value: [run[0], run.at(-1)!], displayValue: item.points[run[0]].displayValue, ...info })),
      renderItem: (params: { dataIndex: number }, api: { coord(value: unknown[]): [number, number] }) => {
        const run = visibleRuns[params.dataIndex]
        const coordinate = (index: number, value: number) => api.coord([scene.plot.dateAxis ? Number(scene.plot.categories[index].value) : scene.plot.categories[index].coordinate, value])
        const edge = (indices: number[], side: 'lower' | 'upper') => indices.map((index, position) => {
          const [x, y] = coordinate(index, item.streamBands![index][side])
          if (!position || config.streamSmooth === false) return `L${x},${y}`
          const [previousX, previousY] = coordinate(indices[position - 1], item.streamBands![indices[position - 1]][side]), middle = (previousX + x) / 2
          return `C${middle},${previousY} ${middle},${y} ${x},${y}`
        }).join(' ')
        return { type: 'path', info, shape: { pathData: `${edge(run, 'upper').replace(/^L/, 'M')} ${edge([...run].reverse(), 'lower')} Z` }, style: { fill: item.fill.color, opacity: item.fill.opacity }, emphasis: { style: { opacity: 1 } } }
      },
    }
  })
  // Keep the shared points for value labels, direct labels, tooltips and selection.
  option.series = [...bands, ...(option.series as Array<Record<string, unknown>>).map((item) => ({ ...item, z: item.z ?? 30 }))]
  return option
}
