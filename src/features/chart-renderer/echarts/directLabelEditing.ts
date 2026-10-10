import { helper, type ECharts } from 'echarts/core'
import type Text from 'zrender/lib/graphic/Text.js'
import type Polyline from 'zrender/lib/graphic/shape/Polyline.js'
import type { ChartConfig } from '../../../core/types'
import type { ResolvedScene } from '../../../entities/chart/model/ChartScene'
import type { Rect } from '../../chart-layout/geometry'

export interface EditableDirectLabel { id: string; name: string; bounds: Rect; texts: Text[]; leaders: Polyline[] }
const automaticPositions = new WeakMap<Text, { x: number; y: number }>()
const automaticLeaders = new WeakMap<Polyline, number[][]>()
const normalize = (text: string) => text.replace(/\{[^{}|]+\|([^{}]*)\}/g, '$1').replace(/\s+/g, ' ').trim()
const bounds = (text: Text): Rect => {
  const rect = text.getBoundingRect().clone()
  rect.applyTransform(text.getComputedTransform())
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
}
const union = (rects: Rect[]): Rect => {
  const x = Math.min(...rects.map((rect) => rect.x)), y = Math.min(...rects.map((rect) => rect.y))
  return { x, y, width: Math.max(...rects.map((rect) => rect.x + rect.width)) - x, height: Math.max(...rects.map((rect) => rect.y + rect.height)) - y }
}

export function collectDirectLabels(instance: ECharts, scene: ResolvedScene): EditableDirectLabel[] {
  const guide = scene.guides.find((guide) => guide.kind === 'direct-series')
  if (!guide?.visible) return []
  const texts = new Set<Text>()
  for (const element of instance.getZr().storage.getDisplayList(true)) {
    if (element.type === 'tspan' && element.parent?.type === 'text' && !element.ignore && !element.invisible) texts.add(element.parent as unknown as Text)
  }
  const seriesOptions = instance.getOption().series as Array<{ id?: string; name?: string; segmentOf?: string; customBarOf?: string }>
  const owners = new Map<Text, { id?: string; name?: string }>()
  for (const text of texts) {
    let element = text as unknown as { parent?: unknown; __hostTarget?: unknown; info?: { seriesId?: string; sourceSeriesName?: string } }
    for (let depth = 0; element && depth < 12; depth++) {
      if (element.info?.seriesId || element.info?.sourceSeriesName) { owners.set(text, { id: element.info.seriesId, name: element.info.sourceSeriesName }); break }
      const index = helper.getECData(element as unknown as Parameters<typeof helper.getECData>[0]).seriesIndex
      if (index != null && seriesOptions[index]) {
        const series = seriesOptions[index]
        owners.set(text, { id: series.id, name: series.segmentOf ?? series.customBarOf ?? series.name }); break
      }
      element = (element.parent ?? element.__hostTarget) as typeof element
    }
  }
  return guide.items.filter((item) => item.visible).flatMap((item) => {
    const sources = 'series' in scene.plot && Array.isArray(scene.plot.series) ? scene.plot.series : 'layers' in scene.plot && Array.isArray(scene.plot.layers) ? scene.plot.layers : []
    const source = sources.find((series) => 'id' in series && series.id === item.seriesId)
    const sourceName = source && 'name' in source ? source.name : undefined
    const expected = [item.label, `${item.label}${item.note ? `\n${item.note}` : ''}`, ...(item.note ? [item.note] : [])].map(normalize)
    const matches = [...texts].filter((text) => {
      const owner = owners.get(text)
      return expected.includes(normalize(String(text.style.text ?? ''))) && (!owner || owner.id === item.seriesId || owner.id?.endsWith(`:${item.seriesId}`) || sourceName != null && owner.name === sourceName)
    })
    const groups: Text[][] = []
    for (const text of matches.sort((a, b) => bounds(a).x - bounds(b).x)) {
      const box = bounds(text)
      const group = groups.find((group) => {
        const other = union(group.map(bounds))
        return Math.abs(box.x - other.x) < Math.max(box.width, other.width) && Math.abs(box.y - other.y) < Math.max(40, box.height + other.height)
      })
      if (group) group.push(text); else groups.push([text])
    }
    return groups.map((texts, index) => {
      const leaders = new Set<Polyline>()
      for (const text of texts) {
        const line = text.__hostTarget?.getTextGuideLine()
        if (line?.type === 'polyline') leaders.add(line as Polyline)
      }
      for (const element of instance.getZr().storage.getDisplayList()) {
        if (element.type === 'polyline' && String(element.id).includes(`direct-guide-line:${item.seriesId}`)) leaders.add(element as unknown as Polyline)
      }
      return { id: `${scene.compatibilityConfig.kind}:${item.seriesId}:${index}`, name: normalize(item.label), texts, leaders: [...leaders], bounds: union(texts.map(bounds)) }
    })
  })
}

export function moveDirectLabel(label: EditableDirectLabel, x: number, y: number) {
  const dx = x - label.bounds.x - label.bounds.width / 2, dy = y - label.bounds.y - label.bounds.height / 2
  for (const text of label.texts) {
    if (!automaticPositions.has(text)) automaticPositions.set(text, { x: Number(text.style.x ?? 0), y: Number(text.style.y ?? 0) })
    const origin = text.transformCoordToLocal(0, 0), target = text.transformCoordToLocal(dx, dy)
    text.setStyle({ x: Number(text.style.x ?? 0) + target[0] - origin[0], y: Number(text.style.y ?? 0) + target[1] - origin[1] })
  }
  for (const leader of label.leaders) {
    const points = leader.shape.points.map((point) => [...point])
    if (!points.length) continue
    if (!automaticLeaders.has(leader)) automaticLeaders.set(leader, points.map((point) => [...point]))
    const last = points.at(-1)!
    last[0] += dx; last[1] += dy
    leader.setShape({ points })
  }
  label.bounds = { ...label.bounds, x: label.bounds.x + dx, y: label.bounds.y + dy }
}

// Native end labels reuse their Text objects; clear our offsets before ECharts lays them out again.
export function restoreDirectLabelPositions(instance: ECharts) {
  for (const element of instance.getZr().storage.getDisplayList()) {
    const line = element as unknown as Polyline, points = automaticLeaders.get(line)
    if (points) { line.setShape({ points }); automaticLeaders.delete(line) }
    if (element.parent?.type !== 'text') continue
    const text = element.parent as unknown as Text, position = automaticPositions.get(text)
    if (position) { text.setStyle(position); automaticPositions.delete(text) }
  }
}

export function applyDirectLabelPositions(instance: ECharts, scene: ResolvedScene, config: ChartConfig) {
  const labels = collectDirectLabels(instance, scene)
  for (const label of labels) {
    const position = config.directLabelPositions?.[label.id]
    if (position && Number.isFinite(position.x) && Number.isFinite(position.y)) moveDirectLabel(label, position.x * instance.getWidth(), position.y * instance.getHeight())
  }
  instance.getZr().flush()
  return labels
}
