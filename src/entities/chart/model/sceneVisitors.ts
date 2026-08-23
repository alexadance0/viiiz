import type { NativeChartScene } from './ChartScene'

export interface NativeMarkSelection {
  legacyKey: string
  seriesName: string
  displayCategory: string
  displayValue: string
  value: number | null
  color: string
  displayLabel?: string
}

export function nativeMarkSelections(scene: NativeChartScene): NativeMarkSelection[] {
  switch (scene.plot.kind) {
  case 'bar': return scene.plot.series.flatMap((series) => series.marks.map((mark) => ({ legacyKey: mark.legacyKey, seriesName: series.name, displayCategory: mark.displayCategory, displayValue: mark.displayValue, value: mark.value, color: mark.style.color })))
  case 'comparison-stem': return scene.plot.series.flatMap((series) => series.points.map((point) => ({ legacyKey: point.legacyKey, seriesName: series.name, displayCategory: point.displayCategory, displayValue: point.displayValue, value: point.value, color: point.marker.fill })))
  case 'waterfall': return scene.plot.marks.map((mark) => ({ legacyKey: mark.legacyKey, seriesName: scene.compatibilityConfig.yFields[0] ?? scene.compatibilityConfig.yField, displayCategory: mark.displayCategory, displayValue: mark.displayValue, value: mark.value, color: mark.style.color }))
  case 'butterfly': return scene.plot.series.flatMap((series) => series.marks.map((mark) => ({ legacyKey: mark.legacyKey, seriesName: series.name, displayCategory: mark.displayCategory, displayValue: mark.displayValue, value: mark.value, color: mark.style.color })))
  case 'heatmap': return scene.plot.rows.flatMap((row) => row.cells.map((cell) => ({ legacyKey: cell.legacyKey, seriesName: row.name, displayCategory: cell.displayCategory, displayValue: cell.displayValue, value: cell.value, color: cell.color })))
  case 'treemap': return scene.plot.nodes.flatMap((node) => [node, ...node.children].map((item) => ({ legacyKey: item.legacyKey, seriesName: item.groupName, displayCategory: item.displayCategory, displayValue: item.displayValue, displayLabel: item.displayLabel, value: item.value, color: item.color })))
  case 'smoothing': {
    const plot = scene.plot
    return plot.layers.filter((layer) => layer.role === 'raw').flatMap((layer) => {
      const source = plot.sourceGroups.find((group) => group.sourceSeriesId === layer.sourceSeriesId)
      return layer.points.filter((point) => point.editable).map((point) => ({ legacyKey: point.legacyKey, seriesName: source?.sourceName ?? layer.name, displayCategory: point.displayCategory, displayValue: point.displayValue, value: point.value, color: scene.compatibilityConfig.elementStyles[point.legacyKey]?.color ?? layer.color }))
    })
  }
  case 'interval': return scene.plot.series.filter((series) => series.visible).flatMap((series) => series.points.map((point) => ({ legacyKey: point.legacyKey, seriesName: series.name, displayCategory: point.displayCategory, displayValue: point.displayValue, value: point.value, color: scene.compatibilityConfig.elementStyles[point.legacyKey]?.color ?? series.color })))
  case 'xy': return scene.plot.series.flatMap((series) => series.points.map((point) => ({ legacyKey: point.legacyKey, seriesName: series.name, displayCategory: point.displayX, displayValue: point.displayY, value: point.y, color: series.color })))
  case 'distribution': {
    const groups = new Map(scene.plot.groups.map((group) => [group.id, group]))
    if (scene.plot.variant === 'box' || scene.plot.variant === 'violin' || scene.plot.variant === 'raincloud' || scene.plot.variant === 'ridgeline' || scene.plot.variant === 'histogram' || scene.plot.variant === 'kde') return scene.plot.groups.flatMap((group) => group.observations.map((mark) => ({ legacyKey: mark.legacyKey, seriesName: group.sourceSeriesName, displayCategory: mark.displayCategory, displayValue: mark.displayValue, displayLabel: mark.displayLabel, value: mark.value, color: mark.marker.fill })))
    return scene.plot.layers.flatMap((layer) => layer.kind === 'observations' || layer.kind === 'counts' || layer.kind === 'barcodes' ? layer.groups.flatMap((entry) => { const group = groups.get(entry.groupId); return entry.marks.map((mark) => ({ legacyKey: mark.legacyKey, seriesName: group?.sourceSeriesName ?? '', displayCategory: mark.displayCategory, displayValue: mark.displayValue, displayLabel: mark.displayLabel, value: mark.value, color: 'marker' in mark ? mark.marker.fill : mark.stroke.color })) }) : [])
  }
  case 'line':
  case 'area':
  case 'slope': return scene.plot.series.flatMap((series) => series.points.map((point) => ({ legacyKey: point.legacyKey, seriesName: series.name, displayCategory: point.displayCategory, displayValue: point.displayValue, value: point.value, color: scene.compatibilityConfig.elementStyles[point.legacyKey]?.color ?? series.color })))
  default: return scene.plot satisfies never
  }
}
