import { expect, it, vi } from 'vitest'
import { randomPalette } from './colorPalettes'

it('allows the full RGB range and repeated colors without filtering or extra random draws', () => {
  const random = vi.spyOn(Math, 'random').mockReturnValue(0)
  try {
    expect(randomPalette(3)).toEqual(['#000000', '#000000', '#000000'])
    expect(random).toHaveBeenCalledTimes(3)
    random.mockReturnValue(1 - Number.EPSILON)
    expect(randomPalette(1)).toEqual(['#ffffff'])
    random.mockReturnValue(.5)
    expect(randomPalette(1)).toEqual(['#800000'])
  } finally {
    random.mockRestore()
  }
})
