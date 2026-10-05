import { interiorAnchor, rectangleInsidePolygon } from './labelPlacement'
import { nonCartesianFrame } from '../nonCartesianFrame'
import { resolveNativeHeatmapScene } from '../heatmap/layout'
import type { NativeHeatmapChartScene, NativeMapChartScene, ResolvedScene } from '../../../entities/chart/model/ChartScene'
import type { Rect } from '../../chart-layout/geometry'
import { measureTextWidth, wrapMeasuredText } from '../../../core/textMetrics'
import { isTileMapChart } from './catalog'

export function mapFrame(scene: NativeMapChartScene): NativeHeatmapChartScene {
  const base = nonCartesianFrame(scene)
  return { ...base, plot: { kind: 'heatmap', categories: [], rows: [], categoryAxis: base.plot.categoryAxis, rowAxis: { ...base.plot.valueAxis, id: 'row', channel: 'lane' }, cellGap: 0, colorDomain: scene.plot.colorDomain } }
}

export type ResolvedMapScene = NativeMapChartScene & ResolvedScene & {
  geometry: ResolvedScene['geometry'] & {
    heatmap: ReturnType<typeof resolveNativeHeatmapScene>['geometry']['heatmap']
    map: Record<string, { path: string; rect: Rect; center: [number, number]; small: boolean; label?: Rect; labelText?: string; labelSize: number; leader?: [number, number][] }>
  }
}

export function resolveNativeMapScene(scene: NativeMapChartScene): ResolvedMapScene {
  const base = resolveNativeHeatmapScene(mapFrame(scene)), plot = base.geometry.plot
  const scale = Math.min(plot.width / scene.plot.width, plot.height / scene.plot.height)
  const dx = plot.x + (plot.width - scene.plot.width * scale) / 2, dy = plot.y + (plot.height - scene.plot.height * scale) / 2
  const project = (p: number[]): [number, number] => [dx + p[0] * scale, dy + p[1] * scale]
  const regions: ResolvedMapScene['geometry']['map'] = {}, labels: Rect[] = []
  const tiled = isTileMapChart(scene.compatibilityConfig.kind)
  const tileText = (region: NativeMapChartScene['plot']['regions'][number], size: number, width: number) => {
    const wrap = scene.compatibilityConfig.mapLabelFormat === 'name' || scene.compatibilityConfig.elementStyles[region.legacyKey]?.label
    const text = wrap ? wrapMeasuredText(region.label.text, size, Math.max(1, width - 4), region.label.style.fontFamily, region.label.style.weight).text : region.label.text
    return { text, width: Math.max(...text.split('\n').map((line) => measureTextWidth(line, size, region.label.style.fontFamily, region.label.style.weight))), height: text.split('\n').length * size * region.label.style.lineHeight / 100 }
  }
  // Fit the entire tile map together so every territory uses the same font size.
  let tileLabelSize = scene.compatibilityConfig.valueText.size
  if (tiled) {
    const visible = scene.plot.regions.filter((region) => region.label.visible && region.label.text)
    const minimum = Math.min(tileLabelSize, 8)
    while (tileLabelSize > minimum && visible.some((region) => {
      const side = Math.sqrt(region.area) * scale
      const text = tileText(region, tileLabelSize, side)
      return text.width + 4 > side || text.height + 4 > side
    })) tileLabelSize -= 1
  }
  for (const region of [...scene.plot.regions].sort((a, b) => Number(b.label.explicit) - Number(a.label.explicit) || b.area - a.area)) {
    const rings = region.polygons.flatMap((polygon) => polygon.map((ring) => ring.map(project)))
    const points = rings.flat(), xs = points.map((p) => p[0]), ys = points.map((p) => p[1])
    const rect = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }
    const anchor = interiorAnchor(region.polygons)
    const center = project(anchor.center), small = region.area * scale * scale < 9
    const textWidth = Math.max(...region.label.text.split('\n').map((text) => measureTextWidth(text, region.label.style.size, region.label.style.fontFamily, region.label.style.weight)))
    const textHeight = region.label.text.split('\n').length * region.label.style.size * region.label.style.lineHeight / 100
    const available = (r: Rect) => r.x >= plot.x && r.x + r.width <= plot.x + plot.width && r.y >= plot.y && r.y + r.height <= plot.y + plot.height && !labels.some((other) => r.x < other.x + other.width + 4 && r.x + r.width + 4 > other.x && r.y < other.y + other.height + 4 && r.y + r.height + 4 > other.y)
    let label: Rect | undefined, leader: [number, number][] | undefined
    let labelText = region.label.text
    let labelSize = tiled ? tileLabelSize : region.label.style.size
    if (region.label.visible && region.label.text) {
      {
        const size = labelSize
        const ratio = size / region.label.style.size
        const fitted = tiled ? tileText(region, size, rect.width) : { text: region.label.text, width: textWidth * ratio, height: textHeight * ratio }
        const { text, width, height } = fitted
        const candidate = { x: center[0] - width / 2, y: center[1] - height / 2, width, height }
        if (available(candidate) && rectangleInsidePolygon(anchor.center, (width + 4) / scale, (height + 4) / scale, anchor.polygon)) {
          label = candidate; labelText = text
        }
      }
      if (!label && region.label.explicit) {
        const width = textWidth * labelSize / region.label.style.size, height = textHeight * labelSize / region.label.style.size
        for (let gap = 12; gap <= 160 && !label; gap += 16) for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1]]) {
          const candidate = { x: center[0] + dx * (gap + width / 2) - width / 2, y: center[1] + dy * (gap + height / 2) - height / 2, width, height }
          if (!available(candidate)) continue
          label = candidate
          leader = [center, [Math.max(candidate.x, Math.min(candidate.x + width, center[0])), Math.max(candidate.y, Math.min(candidate.y + height, center[1]))]]
          break
        }
      }
    }
    if (label) labels.push(label)
    regions[region.id] = { path: rings.map((ring) => `M${ring.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join('L')}Z`).join(''), rect, center, small, label, labelText, labelSize, leader }
  }
  return { ...scene, resolvedReservations: base.resolvedReservations, geometry: { ...base.geometry, axes: {}, map: regions, elements: Object.fromEntries(Object.entries(regions).map(([id, geometry]) => [id, geometry.rect])) } }
}
