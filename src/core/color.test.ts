import { describe, expect, it } from 'vitest'
import { contrastText, visibleFillColor, softenColor } from './color'

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
  it('chooses the stronger contrast when neither white nor graphite reaches the target', () => {
    expect(contrastText('#c65356', 4.5)).toBe('#ffffff')
    expect(contrastText('#2b82d9', 4.5)).toBe('#202027')
    expect(contrastText('#de5b00', 4.5)).toBe('#202027')
  })
  it('keeps dark text on bright colors and prefers readable white on dark fills', () => {
    expect(contrastText('#35a58e', 4.5)).toBe('#202027')
    expect(contrastText('#ee7b2c', 4.5)).toBe('#202027')
    expect(contrastText('#8067a5', 4.5)).toBe('#ffffff')
    expect(contrastText('#084f91', 4.5)).toBe('#ffffff')
  })
  it('uses the visible fill when choosing a fallback and respects stricter targets', () => {
    expect(contrastText('rgba(198,83,86,1)', 4.5)).toBe('#ffffff')
    expect(contrastText('#c65356', 4.5, .4)).toBe('#202027')
    expect(contrastText('#202027', 21)).toBe('#ffffff')
    expect(contrastText('#ffffff', 21)).toBe('#202027')
  })
})

describe('visible fill color', () => {
  it('matches a translucent category over the canvas without adding another alpha layer', () => {
    expect(visibleFillColor('#c65356', .5)).toBe('#e3a9ab')
    expect(visibleFillColor('#c65356', .5, '#202027')).toBe('#733a3f')
    expect(visibleFillColor('#c65356', 1)).toBe('#c65356')
  })
  it('combines color alpha with fill opacity', () => {
    expect(visibleFillColor('rgba(198,83,86,.5)', .5)).toBe('#f1d4d5')
    expect(visibleFillColor('#0008', 1)).toBe('#777777')
    expect(visibleFillColor('#00000080', 1)).toBe('#7f7f7f')
    expect(visibleFillColor('#c65356', 0, '#202027')).toBe('#202027')
  })
})


describe('softening chart colors', () => {
  it('reduces color separation without making dark surfaces too light for white text', () => {
    const color = softenColor('#8067a5')
    expect(color).not.toBe('#8067a5')
    expect(contrastText(color, 4.5)).toBe('#ffffff')
    expect(contrastText(softenColor('#084f91'), 4.5)).toBe('#ffffff')
    expect(contrastText(softenColor('#ee7b2c'), 4.5)).toBe('#202027')
  })
  it('supports short hex and alpha, and leaves unsupported colors unchanged', () => {
    expect(softenColor('#f00')).not.toBe('#f00')
    expect(softenColor('rgba(128,103,165,.5)')).toMatch(/^rgba\(.*,0\.5\)$/)
    expect(softenColor('var(--series-color)')).toBe('var(--series-color)')
  })
})
