export function mixHexColors(from: string, to: string, amount: number) {
  const parse = (color: string) => color.match(/^#([\da-f]{6})$/i)?.[1]
  const first = parse(from), second = parse(to)
  if (!first || !second) return amount < .5 ? from : to
  const ratio = Math.max(0, Math.min(1, amount))
  const channel = (index: number) => Math.round(Number.parseInt(first.slice(index, index + 2), 16) * (1 - ratio) + Number.parseInt(second.slice(index, index + 2), 16) * ratio).toString(16).padStart(2, '0')
  return `#${channel(0)}${channel(2)}${channel(4)}`
}

function rgba(color: string): number[] | undefined {
  const hex = color.match(/^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i)?.[1]
  if (hex) {
    const expanded = hex.length <= 4 ? [...hex].map((channel) => channel.repeat(2)).join('') : hex
    return [0, 2, 4].map((index) => parseInt(expanded.slice(index, index + 2), 16)).concat(expanded.length === 8 ? parseInt(expanded.slice(6), 16) / 255 : 1)
  }
  const rgb = color.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i)
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), Number(rgb[4] ?? 1)] : undefined
}

export function contrastText(color: string, minimumContrast = 3, opacity = 1, background = '#ffffff') {
  const fill = rgba(color)
  if (!fill) return '#ffffff'
  const backdrop = rgba(background) ?? [255, 255, 255, 1]
  const alpha = Math.max(0, Math.min(1, opacity * fill[3]))
  const channels = fill.slice(0, 3).map((channel, index) => (channel * alpha + backdrop[index] * (1 - alpha)) / 255)
    .map((channel) => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
  const luminance = channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722
  return 1.05 / (luminance + .05) >= minimumContrast ? '#ffffff' : '#202027'
}
