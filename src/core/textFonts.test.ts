import { describe, expect, it } from 'vitest'
import { collectFontFamilies, fontCatalog, fontFamilyName, localFontFaces, textFonts } from './textFonts'

describe('font catalog', () => {
  it('keeps chart choices and critical local faces in one catalog', () => {
    expect(textFonts).toEqual(fontCatalog.filter(({ selectable }) => selectable !== false).map(({ value, label }) => [value, label]))
    expect(new Set(localFontFaces.map(({ family }) => family))).toEqual(new Set(['DM Sans', 'Manrope', 'Onest']))
    expect(fontCatalog.filter(({ source }) => source === 'local').map(({ family }) => family)).toEqual(['DM Sans', 'Manrope', 'Onest'])
  })

  it('collects normalized font families from nested chart configuration', () => {
    expect(collectFontFamilies({ titleText: { fontFamily: 'Onest, sans-serif' }, annotations: [{ fontFamily: '"Own Font", sans-serif' }], label: 'ignored' })).toEqual(['Onest', 'Own Font'])
    expect(fontFamilyName("'DM Sans', sans-serif")).toBe('DM Sans')
  })
})
