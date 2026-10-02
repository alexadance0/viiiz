export const mixColor = (first: string, second: string, amount: number) => {
  const channels = (color: string) => [1, 3, 5].map((index) => Number.parseInt(color.slice(index, index + 2), 16))
  const left = channels(first), right = channels(second)
  return `#${left.map((value, index) => Math.round(value + (right[index] - value) * amount).toString(16).padStart(2, '0')).join('')}`
}

export const threeColorPalette = ([start, middle, end]: [string, string, string]) => [
  start,
  mixColor(start, middle, 1 / 3),
  mixColor(start, middle, 2 / 3),
  middle,
  mixColor(middle, end, 1 / 3),
  mixColor(middle, end, 2 / 3),
  end,
]

export function randomPalette(count = 7): string[] {
  const hue = Math.random() * 360
  const saturation = .55 + Math.random() * .25
  const lightness = .42 + Math.random() * .16
  const amplitude = saturation * Math.min(lightness, 1 - lightness)
  return Array.from({ length: count }, (_, index) => {
    const nextHue = (hue + index * 137.508) % 360
    // Convert HSL to hex so generated colors work with pickers, contrast and export.
    const channel = (offset: number) => {
      const step = (offset + nextHue / 30) % 12
      return Math.round(255 * (lightness - amplitude * Math.max(-1, Math.min(step - 3, 9 - step, 1)))).toString(16).padStart(2, '0')
    }
    return `#${channel(0)}${channel(8)}${channel(4)}`
  })
}
