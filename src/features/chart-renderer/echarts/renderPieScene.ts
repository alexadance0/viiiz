import type { NativePieChartScene, ResolvedScene } from '../../../entities/chart/model/ChartScene'
import { pieFrameScene } from '../../chart-types/pie/layout'
import { nativeTextStyle, renderNativeBarScene } from './renderBarScene'

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)

export function renderPieScene(scene: ResolvedScene & NativePieChartScene): Record<string, unknown> {
  const config = scene.compatibilityConfig
  const option = renderNativeBarScene({ ...pieFrameScene(scene), geometry: scene.geometry, resolvedReservations: scene.resolvedReservations })
  const plot = scene.geometry.plot, outside = scene.plot.labelPosition === 'outside'
  const radius = Math.max(0, Math.min(plot.height / 2 - (outside ? config.valueText.size * 1.3 : 4), plot.width * (outside ? .3 : .48)))
  return {
    ...option,
    // Legend clicks open its editor without changing the denominator of the shares.
    legend: { ...(option.legend as Record<string, unknown>), selectedMode: false },
    xAxis: undefined,
    yAxis: undefined,
    tooltip: {
      trigger: 'item', confine: true,
      formatter: (params: { dataIndex: number }) => {
        const slice = scene.plot.slices[params.dataIndex]
        return slice ? `<b>${escapeHtml(slice.name)}</b><br/>${escapeHtml(slice.displayValue)}` : ''
      },
    },
    series: [{
      id: 'native-pie', name: config.yField, type: 'pie',
      center: ['50%', '50%'], radius: [radius * scene.plot.innerRadius, radius],
      left: plot.x, top: plot.y, width: plot.width, height: plot.height,
      avoidLabelOverlap: true, stillShowZeroSum: false, minShowLabelAngle: 0,
      selectedMode: false, emphasis: { scale: false }, labelLayout: { hideOverlap: false },
      label: {
        position: scene.plot.labelPosition, alignTo: outside ? 'edge' : undefined,
        edgeDistance: 6, bleedMargin: 0,
        width: outside ? undefined : Math.max(30, radius * (1 - scene.plot.innerRadius)),
        overflow: outside ? 'none' : 'truncate', ellipsis: '…', ...nativeTextStyle(config.valueText),
      },
      labelLine: { show: outside, length: 12, length2: 8 },
      itemStyle: { borderColor: config.canvasBackground, borderWidth: 2 },
      data: scene.plot.slices.map((slice) => ({
        name: slice.name, value: slice.value,
        elementId: slice.id, datumId: slice.datumId, seriesId: slice.seriesId, elementKey: slice.legacyKey,
        sourceSeriesName: slice.name, displayCategory: slice.name, displayValue: slice.displayValue, displayColor: slice.color,
        itemStyle: { color: slice.color },
        label: { show: slice.label.visible, formatter: () => slice.label.text, ...nativeTextStyle(slice.label.style), color: slice.label.color },
      })),
    }],
  }
}
