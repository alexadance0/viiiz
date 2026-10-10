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

export function softenColor(color: string, background = '#ffffff', strength = 1) {
  const fill = rgba(color)
  if (!fill) return color
  const linear = (channel: number) => { const value = Math.max(0, Math.min(1, channel / 255)); return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4 }
  const luminance = (channels: number[]) => channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722
  const channels = fill.slice(0, 3).map(linear), lightness = luminance(channels)
  const backdrop = luminance((rgba(background) ?? [255, 255, 255]).slice(0, 3).map(linear))
  let target = lightness + (backdrop - lightness) * .04 * strength
  // Keep the existing light/dark text contrast when softening neighboring colors.
  if (lightness <= .183) target = Math.min(target, .183)
  else if (lightness >= .244) target = Math.max(target, .244)
  else target = lightness
  const rgb = channels.map((channel) => {
    const muted = target + (channel - lightness) * (1 - .7 * strength)
    const value = Math.max(0, Math.min(1, muted))
    return Math.round((value <= .0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - .055) * 255)
  })
  return fill[3] < 1 ? `rgba(${rgb.join(',')},${fill[3]})` : `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

function compositedRgb(color: string, opacity: number, background: string) {
  const fill = rgba(color)
  if (!fill) return undefined
  const backdrop = rgba(background) ?? [255, 255, 255, 1]
  const alpha = Math.max(0, Math.min(1, opacity * fill[3]))
  return fill.slice(0, 3).map((channel, index) => channel * alpha + backdrop[index] * (1 - alpha))
}

export function visibleFillColor(color: string, opacity = 1, background = '#ffffff') {
  const channels = compositedRgb(color, opacity, background)
  return channels ? `#${channels.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}` : color
}

export function contrastText(color: string, minimumContrast = 3, opacity = 1, background = '#ffffff') {
  const visible = compositedRgb(color, opacity, background)
  if (!visible) return '#ffffff'
  const channels = visible.map((channel) => channel / 255)
    .map((channel) => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
  const luminance = channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722
  const whiteContrast = 1.05 / (luminance + .05)
  // Compare against the actual graphite text, including on backgrounds darker than it.
  const inkChannels = [32, 32, 39].map((channel) => ((channel / 255 + .055) / 1.055) ** 2.4)
  const inkLuminance = inkChannels[0] * .2126 + inkChannels[1] * .7152 + inkChannels[2] * .0722
  const inkContrast = (Math.max(luminance, inkLuminance) + .05) / (Math.min(luminance, inkLuminance) + .05)
  return whiteContrast >= minimumContrast || inkContrast < minimumContrast && whiteContrast > inkContrast ? '#ffffff' : '#202027'
}
