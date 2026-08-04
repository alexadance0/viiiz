import type { CartesianPointScene, NativeChartScene } from './ChartScene'

export interface NativeMarkSelection {
  legacyKey: string
  seriesName: string
  displayCategory: string
  displayValue: string
  value: number | null
  color: string
}

export function nativeMarkSelections(scene: NativeChartScene): NativeMarkSelection[] {
  if (scene.plot.kind === 'bar') return scene.plot.series.flatMap((series) => series.marks.map((mark) => ({ legacyKey: mark.legacyKey, seriesName: series.name, displayCategory: mark.displayCategory, displayValue: mark.displayValue, value: mark.value, color: mark.style.color })))
  if (scene.plot.kind === 'smoothing') {
    const plot = scene.plot
    return plot.layers.filter((layer) => layer.role === 'raw').flatMap((layer) => {
      const source = plot.sourceGroups.find((group) => group.sourceSeriesId === layer.sourceSeriesId)
      return layer.points.filter((point) => point.editable).map((point) => ({ legacyKey: point.legacyKey, seriesName: source?.sourceName ?? layer.name, displayCategory: point.displayCategory, displayValue: point.displayValue, value: point.value, color: scene.compatibilityConfig.elementStyles[point.legacyKey]?.color ?? layer.color }))
    })
  }
  if (scene.plot.kind === 'interval') return scene.plot.series.filter((series) => series.visible).flatMap((series) => series.points.map((point) => ({ legacyKey: point.legacyKey, seriesName: series.name, displayCategory: point.displayCategory, displayValue: point.displayValue, value: point.value, color: scene.compatibilityConfig.elementStyles[point.legacyKey]?.color ?? series.color })))
  return scene.plot.series.flatMap((series) => series.points.map((point) => ({ legacyKey: point.legacyKey, seriesName: series.name, displayCategory: point.displayCategory, displayValue: point.displayValue, value: point.value, color: scene.compatibilityConfig.elementStyles[point.legacyKey]?.color ?? series.color })))
}

export function nativePointSeries(scene: NativeChartScene): Array<{ name: string; points: CartesianPointScene[] }> {
  if (scene.plot.kind === 'bar') return []
  if (scene.plot.kind === 'smoothing') return scene.plot.layers
  if (scene.plot.kind === 'interval') return scene.plot.series.filter((series) => series.visible)
  return scene.plot.series
}
