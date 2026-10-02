import { expect, it, vi } from 'vitest'
import { randomPalette } from './colorPalettes'

it('generates distinct editable hex colors and varies palettes without changing their size', () => {
  const random = vi.spyOn(Math, 'random').mockReturnValue(0)
  try {
    const first = randomPalette(10)
    expect(first).toHaveLength(10)
    expect(new Set(first).size).toBe(10)
    expect(first.every((color) => /^#[\da-f]{6}$/.test(color))).toBe(true)
    random.mockReturnValue(.99)
    const next = randomPalette(10)
    expect(next).toHaveLength(10)
    expect(next).not.toEqual(first)
    expect(next.every((color) => /^#[\da-f]{6}$/.test(color))).toBe(true)
  } finally {
    random.mockRestore()
  }
})
