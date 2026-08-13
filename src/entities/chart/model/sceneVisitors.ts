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
  switch (scene.plot.kind) {
  case 'bar': return scene.plot.series.flatMap((series) => series.marks.map((mark) => ({ legacyKey: mark.legacyKey, seriesName: series.name, displayCategory: mark.displayCategory, displayValue: mark.displayValue, value: mark.value, color: mark.style.color })))
  case 'smoothing': {
    const plot = scene.plot
    return plot.layers.filter((layer) => layer.role === 'raw').flatMap((layer) => {
      const source = plot.sourceGroups.find((group) => group.sourceSeriesId === layer.sourceSeriesId)
      return layer.points.filter((point) => point.editable).map((point) => ({ legacyKey: point.legacyKey, seriesName: source?.sourceName ?? layer.name, displayCategory: point.displayCategory, displayValue: point.displayValue, value: point.value, color: scene.compatibilityConfig.elementStyles[point.legacyKey]?.color ?? layer.color }))
    })
  }
  case 'interval': return scene.plot.series.filter((series) => series.visible).flatMap((series) => series.points.map((point) => ({ legacyKey: point.legacyKey, seriesName: series.name, displayCategory: point.displayCategory, displayValue: point.displayValue, value: point.value, color: scene.compatibilityConfig.elementStyles[point.legacyKey]?.color ?? series.color })))
  case 'xy': return scene.plot.series.flatMap((series) => series.points.map((point) => ({ legacyKey: point.legacyKey, seriesName: series.name, displayCategory: point.displayX, displayValue: point.displayY, value: point.y, color: series.color })))
  case 'line':
  case 'area':
  case 'slope': return scene.plot.series.flatMap((series) => series.points.map((point) => ({ legacyKey: point.legacyKey, seriesName: series.name, displayCategory: point.displayCategory, displayValue: point.displayValue, value: point.value, color: scene.compatibilityConfig.elementStyles[point.legacyKey]?.color ?? series.color })))
  default: return scene.plot satisfies never
  }
}

export function nativePointSeries(scene: NativeChartScene): Array<{ name: string; points: CartesianPointScene[] }> {
  switch (scene.plot.kind) {
  case 'bar':
  case 'xy': return []
  case 'smoothing': return scene.plot.layers
  case 'interval': return scene.plot.series.filter((series) => series.visible)
  case 'line':
  case 'area':
  case 'slope': return scene.plot.series
  default: return scene.plot satisfies never
  }
}
