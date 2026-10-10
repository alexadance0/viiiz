import { softenColor, visibleFillColor } from '../../../core/color'

type ElementInfo = { elementKey?: string; sourceSeriesName?: string; labelHalo?: boolean; displayColor?: string; fillOpacity?: number }
type HoverElement = { type?: string; style?: Record<string, unknown>; info?: ElementInfo; children?: HoverElement[]; emphasis?: { style?: Record<string, unknown>; [key: string]: unknown }; [key: string]: unknown }
type CustomSeries = { hoverScope?: 'series' | 'element'; itemStyle?: Record<string, unknown>; type?: string; renderItem?: unknown; data?: Array<Record<string, unknown> | null> }

export function softenedStyle(style: Record<string, unknown> | undefined, background: string, strength = 1) {
  if (!style) return style
  const result = { ...style }
  for (const key of ['color', 'borderColor', 'fill', 'stroke']) if (typeof result[key] === 'string') result[key] = softenColor(result[key] as string, background, strength)
  return result
}

export function applyCustomHover(series: CustomSeries, name: string, activeName: string | null, hoveredKey: string | null, selectedKey: string | null, _hovering: boolean, background = '#ffffff') {
  if (series.type !== 'custom' || typeof series.renderItem !== 'function') return
  const baseOpacity = Number(series.itemStyle?.opacity ?? 1)
  const render = series.renderItem as (...args: unknown[]) => HoverElement | null
  const decorate = (element: HoverElement, inherited: ElementInfo): HoverElement => {
    const info = { ...inherited, ...element.info }
    if (element.type === 'group') return { ...element, emphasisDisabled: true, children: element.children?.map((child) => decorate(child, info)) }
    if (!element.style) return element
    const original = element.style, owner = info.sourceSeriesName ?? name
    const active = Boolean(activeName && owner === activeName && (selectedKey ? info.elementKey === selectedKey : series.hoverScope === 'series' || !hoveredKey || !info.elementKey || info.elementKey === hoveredKey))
    const strength = !activeName || active ? 0 : selectedKey && owner === activeName ? .45 : 1
    if (element.type === 'text') {
      if (strength && info.labelHalo && info.displayColor) {
        const color = visibleFillColor(softenColor(info.displayColor, background, strength), info.fillOpacity ?? 1, background)
        return { ...element, emphasisDisabled: true, style: { ...original, fill: color, stroke: color } }
      }
      return { ...element, emphasisDisabled: true }
    }
    const style: Record<string, unknown> = { ...(strength ? softenedStyle(original, background, strength) : original), opacity: Number(original.opacity ?? baseOpacity) }
    // Hover keeps the original paint: no outlines, lift colors, resizing or extra opacity.
    const emphasis = { ...element.emphasis, style: { ...style, stroke: style.stroke ?? null, lineWidth: style.lineWidth ?? 0, shadowBlur: 0 } }
    return { ...element, style, emphasisDisabled: true, emphasis, clipPath: element.clipPath ?? false }
  }
  series.renderItem = (...args: unknown[]) => {
    const element = render(...args)
    if (!element) return element
    const params = args[0] as { dataIndex?: number } | undefined
    const data = series.data?.[params?.dataIndex ?? 0] as ElementInfo | null | undefined
    return decorate(element, data ?? {})
  }
}

export function nativeHoverStyle(style: Record<string, unknown> | undefined, color: unknown) {
  return { ...style, color: style?.color ?? color, opacity: style?.opacity ?? 1, shadowBlur: 0, shadowColor: 'transparent' }
}
