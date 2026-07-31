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
