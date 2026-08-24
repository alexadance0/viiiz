import { describe, expect, it } from 'vitest'
import { mergeRecentColor, normalizeRecentColor } from './PickerControls'

describe('color picker recent colors', () => {
  it('deduplicates equivalent colors, keeps newest first and bounds the list', () => {
    expect(normalizeRecentColor('#FF0000')).toBe(normalizeRecentColor('rgb(255, 0, 0)'))
    expect(mergeRecentColor(['#00ff00', '#ff0000', '#0000ff'], 'rgb(255, 0, 0)', 3)).toEqual(['#ff0000', '#00ff00', '#0000ff'])
  })
})
