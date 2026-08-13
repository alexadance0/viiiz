import { describe, expect, it } from 'vitest'
import { fitSwarmClouds, fitSwarmOffsets, packSwarmOffsets } from './swarm'

describe('distribution swarm packing', () => {
  it('packs deterministically without collisions and fits multiple clouds to one width', () => {
    const positions = [0, 0, 1, 1, 2], diameter = 4, offsets = packSwarmOffsets(positions, diameter)
    expect(offsets).toEqual(packSwarmOffsets(positions, diameter))
    positions.forEach((position, index) => positions.slice(0, index).forEach((other, previous) => expect((position - other) ** 2 + (offsets[index] - offsets[previous]) ** 2).toBeGreaterThanOrEqual((diameter - .01) ** 2)))
    expect(fitSwarmOffsets(Array(20).fill(0), 10, 12).diameter).toBeLessThan(10)
    const fitted = fitSwarmClouds([Array(12).fill(0), [0, 2, 4]], 8, 10)
    expect(Math.max(...fitted.offsets.flat().map(Math.abs))).toBeLessThanOrEqual(10)
  })
})
