import type { ChartTextStyle } from '../../core/types'
import { measureTextWidth } from '../../core/textMetrics'
import type { ChartScene, ResolvedScene } from '../../entities/chart/model/ChartScene'

export function wrapSeriesLabel(text: string, style: ChartTextStyle, maxWidth = 160) {
  if (text.includes('\n') || measureTextWidth(text, style.size, style.fontFamily, style.weight) <= maxWidth) return text
  const words = text.trim().split(/\s+/)
  let best = text, bestWidth = Infinity
  for (let split = 1; split < words.length; split++) {
    const lines = [words.slice(0, split).join(' '), words.slice(split).join(' ')]
    const width = Math.max(...lines.map((line) => measureTextWidth(line, style.size, style.fontFamily, style.weight)))
    if (width < bestWidth) { best = lines.join('\n'); bestWidth = width }
  }
  return best
}

export function prepareDirectLabelLayout<T extends ChartScene | ResolvedScene>(scene: T): T {
  const config = scene.compatibilityConfig
  return { ...scene, guides: scene.guides.map((guide) => guide.kind !== 'direct-series' ? guide : {
    ...guide, items: guide.items.map((item) => {
      return { ...item, label: (config.directLabelWrap ?? true) ? wrapSeriesLabel(item.label, item.style, config.directLabelMaxWidth ?? 160) : item.label }
    }),
  }) }
}
