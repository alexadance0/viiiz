import { describe, expect, it } from 'vitest'
import { aggregateDatumId, markElementId, rawDatumId, seriesId, syntheticDatumId } from './ChartElement'

describe('scene identity', () => {
  it('creates deterministic typed raw, aggregate and synthetic identities', () => {
    expect(rawDatumId(3, 'revenue')).toBe(rawDatumId(3, 'revenue'))
    expect(aggregateDatumId('A', 'revenue')).toContain('aggregate:')
    expect(syntheticDatumId('bar', 'total')).toContain('synthetic:bar:')
    expect(markElementId(seriesId('measure', 'revenue'), aggregateDatumId('A', 'revenue'))).toContain('mark:')
  })
})
