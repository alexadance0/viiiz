import type { ChartConfig, DataTable } from '../../core/types'
import { chartDocumentFromLegacy } from '../../entities/chart/model/legacyChartConfigAdapter'
import type { ChartElement } from '../../entities/chart/model/ChartElement'
import type { ChartScene, ResolvedScene } from '../../entities/chart/model/ChartScene'
import { resolveFrame } from '../chart-layout/frameLayout'

type LegacyOptionBuilder = (table: DataTable, config: ChartConfig) => Record<string, unknown>

function optionElements(option: Record<string, unknown>): ChartElement[] {
  const elements: ChartElement[] = []
  const visit = (value: unknown, seriesId = '') => {
    if (!value || typeof value !== 'object') return
    const item = value as { elementKey?: string; name?: string; data?: unknown[]; children?: unknown[] }
    const nextSeries = item.name ?? seriesId
    if (item.elementKey) elements.push({ id: `mark:${encodeURIComponent(item.elementKey)}`, role: 'mark', coordinateSpace: 'data', selectable: true, seriesId: nextSeries, datumId: item.elementKey })
    item.data?.forEach((child) => visit(child, nextSeries))
    item.children?.forEach((child) => visit(child, nextSeries))
  }
  ;(option.series as unknown[] | undefined)?.forEach((series) => visit(series))
  return elements
}

export function compileLegacyScene(table: DataTable, config: ChartConfig, buildOption: LegacyOptionBuilder): ChartScene {
  const document = chartDocumentFromLegacy(table, config)
  const legacyRendererPayload = buildOption(table, config)
  return { migrationMode: 'legacy', document, elements: optionElements(legacyRendererPayload), legacyRendererPayload }
}

export function resolveScene(scene: ChartScene): ResolvedScene {
  const frame = resolveFrame({ canvas: scene.document.canvas, spacing: scene.document.composition })
  return { ...scene, geometry: { canvas: frame.canvas, content: frame.content, plot: frame.plot, reservations: {}, axes: {}, elements: {}, guides: {} } } as ResolvedScene
}
