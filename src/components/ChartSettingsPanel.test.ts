import { describe, expect, it } from 'vitest'
import { threeColorPalette } from '../core/colorPalettes'

describe('threeColorPalette', () => {
  it('keeps all three anchors and interpolates evenly between them', () => {
    expect(threeColorPalette(['#000000', '#808080', '#ffffff'])).toEqual([
      '#000000',
      '#2b2b2b',
      '#555555',
      '#808080',
      '#aaaaaa',
      '#d5d5d5',
      '#ffffff',
    ])
  })
})
