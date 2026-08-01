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
  return scene.plot.series.flatMap((series) => series.points.map((point) => ({ legacyKey: point.legacyKey, seriesName: series.name, displayCategory: point.displayCategory, displayValue: point.displayValue, value: point.value, color: scene.compatibilityConfig.elementStyles[point.legacyKey]?.color ?? series.color })))
}

export function nativePointSeries(scene: NativeChartScene): Array<{ name: string; points: CartesianPointScene[] }> {
  return scene.plot.kind === 'bar' ? [] : scene.plot.series
}
