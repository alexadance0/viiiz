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
  const colors: number[][] = []
  for (let index = 0; index < count; index++) {
    let best: number[] = [], bestDistance = -1
    // Bound retries even if the random source produces repeated candidates.
    for (let attempt = 0; attempt < 24; attempt++) {
      const hue = Math.random() * 360
      const saturation = .08 + Math.random() * .82
      const lightness = .18 + Math.random() * .66
      const amplitude = saturation * Math.min(lightness, 1 - lightness)
      const candidate = [0, 8, 4].map((offset) => {
        const step = (offset + hue / 30) % 12
        return Math.round(255 * (lightness - amplitude * Math.max(-1, Math.min(step - 3, 9 - step, 1))))
      })
      const distance = Math.min(Infinity, ...colors.map((color) => Math.hypot(...candidate.map((channel, i) => channel - color[i]))))
      if (distance > bestDistance) { best = candidate; bestDistance = distance }
      if (distance >= 60) break
    }
    colors.push(best)
  }
  return colors.map((color) => `#${color.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`)
}
