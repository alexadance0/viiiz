import { expect, it, vi } from 'vitest'
import { randomPalette } from './colorPalettes'

it('generates distinct editable hex colors and varies palettes without changing their size', () => {
  let seed = 12345
  const random = vi.spyOn(Math, 'random').mockImplementation(() => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 2 ** 32
  })
  try {
    const first = randomPalette(10)
    expect(first).toHaveLength(10)
    expect(new Set(first).size).toBe(10)
    expect(first.every((color) => /^#[\da-f]{6}$/.test(color))).toBe(true)
    const next = randomPalette(10)
    expect(next).toHaveLength(10)
    expect(next).not.toEqual(first)
    expect(next.every((color) => /^#[\da-f]{6}$/.test(color))).toBe(true)
    const channels = first.map((color) => [1, 3, 5].map((start) => parseInt(color.slice(start, start + 2), 16) / 255))
    const lightness = channels.map((rgb) => (Math.max(...rgb) + Math.min(...rgb)) / 2)
    const saturation = channels.map((rgb, i) => (Math.max(...rgb) - Math.min(...rgb)) / (1 - Math.abs(2 * lightness[i] - 1)))
    expect(Math.max(...lightness) - Math.min(...lightness)).toBeGreaterThan(.3)
    expect(Math.max(...saturation) - Math.min(...saturation)).toBeGreaterThan(.4)
    channels.forEach((rgb, index) => channels.slice(0, index).forEach((previous) => {
      expect(Math.hypot(...rgb.map((channel, i) => (channel - previous[i]) * 255))).toBeGreaterThanOrEqual(60)
    }))
  } finally {
    random.mockRestore()
  }
})
