import type { ChartConfig, DataTable } from '../../../core/types'
import { formatChartNumber } from '../../../core/numberFormat'
import { getSeriesColor } from '../../../core/seriesColor'
import { chartDocumentFromLegacy } from '../../../entities/chart/model/legacyChartConfigAdapter'
import { markElementId, seriesId, syntheticDatumId } from '../../../entities/chart/model/ChartElement'
import type { NativeSankeyChartScene } from '../../../entities/chart/model/ChartScene'

export function sankeyGraph(table: DataTable, config: ChartConfig) {
  const weights = new Map<string, { source: string; target: string; value: number }>()
  for (const row of table.rows) {
    const source = String(row[config.xField] ?? '').trim(), target = String(row[config.sankeyTargetField ?? ''] ?? '').trim(), value = row[config.yField]
    if (!source || !target || typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue
    const key = JSON.stringify([source, target])
    weights.set(key, { source, target, value: (weights.get(key)?.value ?? 0) + value })
  }
  const links = [...weights.values()], names = [...new Set(links.flatMap((link) => [link.source, link.target]))]
  const incoming = new Map(names.map((name) => [name, 0])), outgoing = new Map(names.map((name) => [name, [] as typeof links]))
  links.forEach((link) => { incoming.set(link.target, incoming.get(link.target)! + 1); outgoing.get(link.source)!.push(link) })
  const queue = names.filter((name) => !incoming.get(name)), depths = new Map(names.map((name) => [name, 0]))
  for (let index = 0; index < queue.length; index++) {
    const name = queue[index]
    for (const link of outgoing.get(name)!) {
      depths.set(link.target, Math.max(depths.get(link.target)!, depths.get(name)! + 1))
      incoming.set(link.target, incoming.get(link.target)! - 1)
      if (!incoming.get(link.target)) queue.push(link.target)
    }
  }
  const values = new Map(names.map((name) => [name, Math.max(links.filter((link) => link.source === name).reduce((sum, link) => sum + link.value, 0), links.filter((link) => link.target === name).reduce((sum, link) => sum + link.value, 0))]))
  return { names, links, depths, values, overflow: !Number.isFinite(links.reduce((sum, link) => sum + link.value, 0)), cyclic: queue.length !== names.length }
}

export function validateNativeSankeyMapping(table: DataTable, config: ChartConfig) {
  const errors: Array<{ field: string; message: string }> = []
  if (!table.columns.includes(config.xField)) errors.push({ field: 'xField', message: 'Выберите колонку «Откуда».' })
  if (!config.sankeyTargetField || !table.columns.includes(config.sankeyTargetField) || config.sankeyTargetField === config.xField) errors.push({ field: 'sankeyTargetField', message: 'Выберите отдельную колонку «Куда».' })
  if (!table.columns.includes(config.yField) || config.yField === config.xField || config.yField === config.sankeyTargetField) errors.push({ field: 'yField', message: 'Выберите отдельную числовую колонку для величины потока.' })
  if (!errors.length) {
    if (table.rows.some((row) => String(row[config.xField] ?? '').trim() && String(row[config.sankeyTargetField!] ?? '').trim() && (typeof row[config.yField] !== 'number' || !Number.isFinite(row[config.yField]) || Number(row[config.yField]) < 0))) errors.push({ field: 'yField', message: 'Величины потоков должны быть конечными неотрицательными числами.' })
    const graph = sankeyGraph(table, config)
    if (!graph.links.length) errors.push({ field: 'yField', message: 'Добавьте хотя бы один поток с положительным значением.' })
    if (graph.overflow) errors.push({ field: 'yField', message: 'Сумма потоков слишком велика. Уменьшите единицы измерения значений.' })
    if (graph.cyclic) errors.push({ field: 'sankeyTargetField', message: 'Потоки не должны образовывать цикл. Для повторяющихся этапов используйте разные названия узлов.' })
  }
  return { ok: !errors.length, errors }
}

export function compileNativeSankeyScene(table: DataTable, config: ChartConfig): NativeSankeyChartScene {
  const graph = sankeyGraph(table, config)
  if (graph.overflow) throw new Error('Sankey flow totals must be finite.')
  if (graph.cyclic) throw new Error('Sankey flows must be acyclic.')
  const total = graph.links.filter((link) => graph.depths.get(link.source) === 0).reduce((sum, link) => sum + link.value, 0)
  const nodes = graph.names.map((name, index) => {
    const legacyKey = `sankey-node:${name}`, override = config.elementStyles[legacyKey], sid = seriesId('sankey', name), datumId = syntheticDatumId('sankey-node', name)
    const value = graph.values.get(name)!
    const parents = [...new Set(graph.links.filter((link) => link.target === name).map((link) => link.source))]
    const denominator = config.sankeyPercentBase === 'parent' && parents.length ? parents.reduce((sum, parent) => sum + graph.values.get(parent)!, 0) : total
    const percent = formatChartNumber(denominator ? value / denominator * 100 : 0, { ...config, valueMode: 'percent', numberOperation: 'none', numberFactor: 1, numberPrefix: '', numberSuffix: '', valueLabelAffixesLinked: true })
    const displayValue = config.sankeyValueFormat === 'percent' ? percent : config.sankeyValueFormat === 'both' ? `${formatChartNumber(value, config)} / ${percent}` : formatChartNumber(value, config)
    const displayLabel = override?.label ?? name
    return { id: markElementId(sid, datumId), seriesId: sid, datumId, legacyKey, name, depth: graph.depths.get(name)!, value, displayCategory: name, displayValue, displayLabel, color: override?.color ?? getSeriesColor(config, name, index), label: { visible: override?.showLabel !== false, text: [override?.showName ?? config.sankeyShowNames ?? true ? displayLabel : '', override?.showValue ?? config.showValues ? displayValue : ''].filter(Boolean).join('\n'), style: override?.valueText ?? config.valueText } }
  })
  const links = graph.links.map((link) => {
    const legacyKey = `sankey-link:${JSON.stringify([link.source, link.target])}`, sid = seriesId('sankey-link', link.source), datumId = syntheticDatumId('sankey-link', legacyKey)
    const override = config.elementStyles[legacyKey]
    const node = nodes.find((node) => node.name === (config.sankeyLinkColor === 'target' ? link.target : link.source))!
    return { ...link, id: markElementId(sid, datumId), seriesId: sid, datumId, legacyKey, color: override?.color ?? (config.sankeyLinkColor === 'single' ? config.color : node.color), displayCategory: `${link.source} → ${link.target}`, displayValue: formatChartNumber(link.value, config) }
  })
  const elements = [...nodes, ...links].map((item) => ({ id: item.id, role: 'mark' as const, coordinateSpace: 'data' as const, selectable: true, seriesId: item.seriesId, datumId: item.datumId, legacyKey: item.legacyKey }))
  const frameElements = ([['title', config.title, config.titleText], ['subtitle', config.subtitle, config.subtitleText], ['note', config.note, config.noteText], ['source', config.source, config.sourceText]] as const).filter(([, text], index) => Boolean(text) && (index === 0 ? config.showTitle !== false : index === 1 ? config.showSubtitle !== false : index === 2 ? config.showNote !== false : config.showSource !== false)).map(([role, text, style]) => ({ id: `frame:${role}`, role, text, style }))
  return { document: chartDocumentFromLegacy(table, config), compatibilityConfig: config, elements, guides: [], frameElements, plot: { kind: 'sankey', nodes, links, total } }
}
