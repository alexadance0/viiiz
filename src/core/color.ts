export function mixHexColors(from: string, to: string, amount: number) {
  const parse = (color: string) => color.match(/^#([\da-f]{6})$/i)?.[1]
  const first = parse(from), second = parse(to)
  if (!first || !second) return amount < .5 ? from : to
  const ratio = Math.max(0, Math.min(1, amount))
  const channel = (index: number) => Math.round(Number.parseInt(first.slice(index, index + 2), 16) * (1 - ratio) + Number.parseInt(second.slice(index, index + 2), 16) * ratio).toString(16).padStart(2, '0')
  return `#${channel(0)}${channel(2)}${channel(4)}`
}

export function contrastText(color: string) {
  const hex = color.match(/^#([\da-f]{6})$/i)?.[1]
  if (!hex) return '#ffffff'
  const channels = [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255).map((channel) => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
  const luminance = channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722
  return 1.05 / (luminance + .05) >= 3 ? '#ffffff' : '#202027'
}
