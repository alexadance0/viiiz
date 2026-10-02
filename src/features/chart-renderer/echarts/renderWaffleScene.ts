import type { NativeWaffleChartScene, ResolvedScene } from '../../../entities/chart/model/ChartScene'
import { pieFrameScene } from '../../chart-types/pie/layout'
import { resolveNativeCartesianScene } from '../../chart-types/bar/layout'
import { nativeGraphicTextStyle, renderNativeBarScene } from './renderBarScene'

export function resolveNativeWaffleScene(scene: NativeWaffleChartScene): ResolvedScene & NativeWaffleChartScene {
  const frame = resolveNativeCartesianScene(pieFrameScene(scene))
  return { ...scene, geometry: frame.geometry, resolvedReservations: frame.resolvedReservations }
}

export function renderWaffleScene(scene: ResolvedScene & NativeWaffleChartScene): Record<string, unknown> {
  const option = renderNativeBarScene({ ...pieFrameScene(scene), geometry: scene.geometry, resolvedReservations: scene.resolvedReservations })
  const { columns, rows, slices, counts } = scene.plot, plot = scene.geometry.plot
  const labels = slices.filter((slice) => slice.label.visible)
  const labelWidth = labels.length ? plot.width * .35 : 0
  const availableWidth = Math.max(1, plot.width - labelWidth - (labels.length ? 24 : 0))
  const pitch = Math.max(1, Math.min(availableWidth / columns, plot.height / rows))
  const gap = Math.min(scene.plot.gap, pitch * .6), size = pitch - gap
  const x = plot.x + (availableWidth - pitch * columns) / 2
  const y = plot.y + (plot.height - pitch * rows) / 2
  const cells = slices.flatMap((slice, index) => Array.from({ length: counts[index] }, () => slice))
  const bounds = (index: number) => ({ x: x + index % columns * pitch + gap / 2, y: y + (rows - 1 - Math.floor(index / columns)) * pitch + gap / 2, width: size, height: size })
  const selection = (slice: typeof slices[number]) => ({ elementKey: slice.legacyKey, sourceSeriesName: slice.name, displayCategory: slice.name, displayValue: slice.displayValue, displayColor: slice.color })
  const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
  return {
    ...option, animation: false, xAxis: undefined, yAxis: undefined,
    nativeSelectionHits: cells.map((slice, index) => ({ rect: bounds(index), info: selection(slice) })),
    legend: { ...(option.legend as Record<string, unknown>), selectedMode: false },
    tooltip: { trigger: 'item', confine: true, formatter: (params: { seriesIndex: number }) => { const slice = slices[params.seriesIndex]; return slice ? `<b>${escape(slice.name)}</b><br/>${escape(slice.displayValue)}` : '' } },
    graphic: [...(option.graphic as unknown[] ?? []), ...labels.map((slice, index) => ({
      id: `waffle-label:${slice.id}`, type: 'group', z: 20,
      children: [
        { type: 'rect', shape: { x: plot.x + plot.width - labelWidth, y: plot.y + (index + .5) * plot.height / labels.length - 5, width: 10, height: 10 }, style: { fill: slice.color } },
        { type: 'text', style: { ...nativeGraphicTextStyle(slice.label.style), x: plot.x + plot.width - labelWidth + 20, y: plot.y + (index + .5) * plot.height / labels.length, text: slice.label.text, fill: slice.label.color, align: 'left', verticalAlign: 'middle', width: Math.max(1, labelWidth - 20), height: plot.height / labels.length - 4, overflow: 'break', lineOverflow: 'truncate', ellipsis: '…' } },
      ],
    }))],
    series: slices.map((slice, sliceIndex) => {
      const offset = counts.slice(0, sliceIndex).reduce((sum, count) => sum + count, 0)
      const categoryCells = cells.slice(offset, offset + counts[sliceIndex])
      return {
      id: `waffle:${slice.id}`, animation: false, name: slice.name, itemStyle: { color: slice.color }, type: 'custom', coordinateSystem: 'none', triggerEvent: true,
      data: categoryCells.map((slice, index) => ({ value: index, elementId: slice.id, datumId: slice.datumId, seriesId: slice.seriesId, elementKey: slice.legacyKey, sourceSeriesName: slice.name, displayCategory: slice.name, displayValue: slice.displayValue, displayColor: slice.color })),
      renderItem: (params: { dataIndex: number }) => {
        const index = offset + params.dataIndex
        return { type: 'rect', info: { elementId: slice.id, datumId: slice.datumId, seriesId: slice.seriesId, elementKey: slice.legacyKey, sourceSeriesName: slice.name, displayCategory: slice.name, displayValue: slice.displayValue, displayColor: slice.color }, shape: { ...bounds(index), r: size * scene.plot.radius }, style: { fill: slice.color }, emphasis: { style: { stroke: scene.compatibilityConfig.axisLineColor, lineWidth: 1 } } }
      },
    } }),
  }
}
