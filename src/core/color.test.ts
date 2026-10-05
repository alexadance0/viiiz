import { describe, expect, it } from 'vitest'
import { contrastText } from './color'

describe('visible fill contrast', () => {
  it.each(['#fff', '#ffffff', 'rgb(255, 255, 255)', 'rgba(255,255,255,1)'])('uses dark text on %s', (fill) => {
    expect(contrastText(fill, 4.5)).toBe('#202027')
  })
  it('accounts for both fill opacity and alpha against the canvas', () => {
    expect(contrastText('#500099', 4.5)).toBe('#ffffff')
    expect(contrastText('#500099', 4.5, .1)).toBe('#202027')
    expect(contrastText('rgba(80,0,153,.1)', 4.5)).toBe('#202027')
    expect(contrastText('#000', 4.5, .1, '#000')).toBe('#ffffff')
  })
})
