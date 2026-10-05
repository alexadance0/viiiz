import { describe, expect, it } from 'vitest'
import { collectFontFamilies, fontCatalog, fontFamilyName, localFontFaces, normalizeFontFamilies, textFonts } from './textFonts'

describe('font catalog', () => {
  it('keeps chart choices and critical local faces in one catalog', () => {
    expect(textFonts).toEqual(fontCatalog.filter(({ selectable }) => selectable !== false).map(({ value, label }) => [value, label]))
    expect(new Set(localFontFaces.map(({ family }) => family))).toEqual(new Set(['Wix Madefor Text', 'Wix Madefor Display', 'Onest']))
    expect(fontCatalog.filter(({ source }) => source === 'local').map(({ family }) => family)).toEqual(['Wix Madefor Text', 'Wix Madefor Display', 'Onest'])
  })

  it('repairs numeric names in saved chart styles without changing dates or the input', () => {
    const date = new Date('2026-01-01')
    const input = { titleText: { fontFamily: 'Source Sans 3, sans-serif' }, annotations: [{ fontFamily: 'Custom 2026, serif' }], date }
    expect(normalizeFontFamilies(input)).toEqual({ titleText: { fontFamily: '"Source Sans 3", sans-serif' }, annotations: [{ fontFamily: '"Custom 2026", serif' }], date })
    expect(input.titleText.fontFamily).toBe('Source Sans 3, sans-serif')
    expect(normalizeFontFamilies(input).date).toBe(date)
  })

  it('includes fonts used only inside formatted text', () => {
    expect(collectFontFamilies({ html: '<span style="font-family: Georgia, serif">A</span><span style="font-family: &quot;Own Font&quot;, sans-serif; color:red">B</span>' })).toEqual(['Georgia', 'Own Font'])
  })

  it('collects normalized font families from nested chart configuration', () => {
    expect(collectFontFamilies({ titleText: { fontFamily: 'Onest, sans-serif' }, annotations: [{ fontFamily: '"Own Font", sans-serif' }], label: 'ignored' })).toEqual(['Onest', 'Own Font'])
    expect(fontFamilyName("'Wix Madefor Text', sans-serif")).toBe('Wix Madefor Text')
  })
})
