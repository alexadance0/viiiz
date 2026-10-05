import { describe, expect, it } from 'vitest'
import { gradientPalette, threeColorPalette } from '../core/colorPalettes'

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

describe('gradientPalette', () => {
  it('starts with two anchors and retains the existing three-anchor format', () => {
    const two = gradientPalette(['#000000', '#ffffff'])
    expect(two).toHaveLength(7)
    expect(two[0]).toBe('#000000')
    expect(two[3]).toBe('#808080')
    expect(two[6]).toBe('#ffffff')
    expect(gradientPalette(['#000000', '#ff0000', '#ffffff'])[3]).toBe('#ff0000')
  })
  it('supports a chosen number of shades and includes endpoints for two or three anchors', () => {
    expect(gradientPalette(['#000000', '#ffffff'], 2)).toEqual(['#000000', '#ffffff'])
    expect(gradientPalette(['#000000', '#ff0000', '#ffffff'], 3)).toEqual(['#000000', '#ff0000', '#ffffff'])
    const even = gradientPalette(['#000000', '#ff0000', '#ffffff'], 4)
    expect(even).toEqual(['#000000', '#aa0000', '#ff5555', '#ffffff'])
    expect(gradientPalette(['#000000', '#ffffff'], 24)).toHaveLength(24)
    expect(gradientPalette(['#000000', '#ffffff'], 0)).toHaveLength(2)
  })

})
