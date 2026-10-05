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
  return Array.from({ length: count }, () => `#${Math.floor(Math.random() * 0x1000000).toString(16).padStart(6, '0')}`)
}

export const DEFAULT_GRADIENT_COLORS: [string, string] = ['#3b4cc0', '#b40426']

export const gradientPalette = (anchors: [string, string] | [string, string, string], count = 7) => {
  const steps = Number.isFinite(count) ? Math.max(2, Math.min(24, Math.round(count))) : 7
  return Array.from({ length: steps }, (_, index) => {
    const position = index / (steps - 1)
    if (anchors.length === 2) return mixColor(anchors[0], anchors[1], position)
    return position <= .5 ? mixColor(anchors[0], anchors[1], position * 2) : mixColor(anchors[1], anchors[2], (position - .5) * 2)
  })
}

export const chartPalettes = [
  { id: 'rose-purple', label: 'Сирень', colors: ['#59358b', '#884aa0', '#a85ca4', '#cb7faf', '#df97b5', '#f3b9c4', '#f9ddd9'] },
  { id: 'yellow-red', label: 'Пламя', colors: ['#870529', '#bc2300', '#e95d00', '#f39700', '#fac64a', '#ffe79b', '#ffffb2'] },
  { id: 'sunset', label: 'Закат', colors: ['#4c1d91', '#8e0e9c', '#c31a96', '#e73d87', '#f37c67', '#f2a75e', '#e5d49a'] },
  { id: 'yellow-blue', label: 'Океан', colors: ['#29175c', '#08639d', '#0094ad', '#16b7ae', '#99dbbf', '#d8f3cd', '#ffffdf'] },
  // ColorBrewer Spectral, eleven classes: github.com/axismaps/colorbrewer.
  { id: 'spectral-11', label: 'Spectral 11', colors: ['#9e0142', '#d53e4f', '#f46d43', '#fdae61', '#fee08b', '#ffffbf', '#e6f598', '#abdda4', '#66c2a5', '#3288bd', '#5e4fa2'] },
  { id: 'sequential', label: 'Viridis', colors: ['#440154', '#414487', '#2a788e', '#22a884', '#7ad151', '#fde725'] },
  { id: 'diverging', label: 'Градиент', colors: gradientPalette(DEFAULT_GRADIENT_COLORS) },
  { id: 'mono', label: 'Монохромная', colors: ['#202027', '#4c4b53', '#74727c', '#9d9ba3', '#c2c0c6', '#dedde1'] },
] as const
