import { describe, expect, it } from 'vitest'
import { createDefaultChartConfig } from '../../entities/chart/model/defaultChartConfig'
import { applyTemplate, applyTemplateToComposition, createTemplate, createCompositionTemplate, parseTemplate, templateAppearanceSignature } from './templates'

describe('style templates', () => {
  it('saves reusable appearance without data roles, content, named colors or calculations', () => {
    const config = { ...createDefaultChartConfig(), xField: 'secret column', title: 'Confidential', titleHtml: '<b>Confidential</b>', yAxisMax: 999, numberFactor: 100, annotations: [{ id: 'secret note' }] as never, seriesStyles: { revenue: { color: '#ff0000', lineWidth: 5, markerSize: 12, legendLabel: 'Secret label' } } }
    const template = createTemplate(config, ' My style ', false, ['revenue'])
    const json = JSON.stringify(template)
    expect(template.name).toBe('My style')
    for (const secret of ['Confidential', 'secret column', 'secret note', 'revenue', 'Secret label', 'yAxisMax', 'numberFactor', 'canvasWidth', '#ff0000']) expect(json).not.toContain(secret)
    expect(template.seriesAppearance).toEqual([{ lineWidth: 5, markerSize: 12 }])
  })

  it('applies appearance atomically while retaining data, annotations, scales and local content', () => {
    const source = createDefaultChartConfig(), target = { ...source, title: 'Current title', xField: 'date', yAxisMax: 123, barCategorySort: 'value-desc' as const, canvasWidth: 1400, seriesStyles: { revenue: { color: '#123456', lineWidth: 9, legendLabel: 'Current label' } } }
    source.titleText.size = 55; source.barWidth = 22
    const template = createTemplate(source, 'Style', false)
    const snapshot = structuredClone(target), result = applyTemplate(target, template)
    expect(target).toEqual(snapshot)
    expect(result).toMatchObject({ title: 'Current title', xField: 'date', yAxisMax: 123, barCategorySort: 'value-desc', canvasWidth: 1400, titleText: { size: 55 }, barWidth: 22 })
    expect(result.annotations).toBe(target.annotations)
    expect(result.seriesStyles.revenue).toMatchObject({ color: '#123456', legendLabel: 'Current label' })
    expect(result.seriesStyles.revenue.lineWidth).toBeUndefined()
    result.titleText.size = 12
    expect(template.style.titleText?.size).toBe(55)
  })

  it('applies dimensions only by choice and skips properties of another chart type', () => {
    const source = { ...createDefaultChartConfig(), canvasWidth: 1600, barWidth: 15 }
    const template = createTemplate(source, 'With size', true)
    const target = { ...createDefaultChartConfig(), kind: 'spline' as const, barWidth: 60, canvasWidth: 900 }
    expect(applyTemplate(target, template)).toMatchObject({ kind: 'spline', barWidth: 60, canvasWidth: 1600 })
    expect(applyTemplate(target, template, [], false).canvasWidth).toBe(900)
  })

  it('round-trips exported files and rejects malformed or unsupported versions', () => {
    const template = createTemplate(createDefaultChartConfig(), 'Test', false)
    expect(parseTemplate(JSON.parse(JSON.stringify(template)))).toEqual(template)
    expect(() => parseTemplate({ ...template, version: 2 })).toThrow()
    expect(() => parseTemplate({ ...template, style: { palette: 'red' } })).toThrow()
    expect(() => parseTemplate({ ...template, style: { gridType: 'unknown' } })).toThrow()
    expect(() => parseTemplate({ ...template, style: { waffleRows: 10000 } })).toThrow()
    expect(() => parseTemplate({ ...template, style: { titleText: { ...template.style.titleText, size: -1 } } })).toThrow()
    expect(() => parseTemplate({ ...template, style: { customFonts: [{ name: 'Test', dataUrl: 'https://example.com/font' }] } })).toThrow()
    expect(parseTemplate({ ...template, style: { ...template.style, title: 'injected', yAxisMax: 999 } }).style).not.toHaveProperty('title')
  })

  it('retains fonts needed by existing annotations and includes uploaded template fonts', () => {
    const existing = { name: 'Existing', dataUrl: 'data:font/woff2;base64,AAAA' }, added = { name: 'Template font', dataUrl: 'data:font/woff2;base64,BBBB' }
    const source = { ...createDefaultChartConfig(), customFonts: [added] }, target = { ...createDefaultChartConfig(), customFonts: [existing] }
    const template = createTemplate(source, 'Fonts', false)
    expect(applyTemplate(target, template).customFonts).toEqual([existing, added])
    expect(applyTemplate(target, createTemplate(createDefaultChartConfig(), 'Default', false)).customFonts).toEqual([existing])
  })

  it('captures each chart type once and applies a composition without transferring its layout or content', () => {
    const base = createDefaultChartConfig()
    const source = { ...base, canvasWidth: 1600, title: 'Private heading', multiples: { columns: 3, rows: 1, gap: 50, panels: [
      { id: 'private-bar', config: { ...base, title: 'Private bar', barWidth: 12, titleText: { ...base.titleText, size: 18 } } },
      { id: 'private-line', config: { ...base, kind: 'spline' as const, title: 'Private line', seriesStyles: { revenue: { lineWidth: 6, showMarker: true } } } },
      { id: 'second-bar', config: { ...base, barWidth: 29 } },
    ] } }
    const template = createCompositionTemplate(source, 'Composite', true, (config) => config.yFields)
    expect(template.variants?.map((variant) => variant.sourceKind)).toEqual(['bar', 'spline'])
    expect(template.variants?.[0].style.barWidth).toBe(12)
    expect(JSON.stringify(template)).not.toMatch(/Private|private-bar|private-line|revenue|columns|gap":50/)
    const target = { ...base, title: 'Current', multiples: { columns: 2, rows: 2, gap: 16, sharedValueScale: true, valueMax: 99, panels: [
      { id: 'bar', config: { ...base, barWidth: 80, yAxisMax: 77 } },
      { id: 'line', config: { ...base, kind: 'spline' as const, canvasWidth: 500 } }, null,
    ] } }
    const snapshot = structuredClone(target)
    const next = applyTemplateToComposition(target, parseTemplate(JSON.parse(JSON.stringify(template))), (config) => config.yFields)
    expect(target).toEqual(snapshot)
    expect(next).toMatchObject({ title: 'Current', canvasWidth: 1600, multiples: { columns: 2, rows: 2, gap: 16, sharedValueScale: true, valueMax: 99 } })
    expect(next.multiples!.panels[0]).toMatchObject({ id: 'bar', config: { kind: 'bar', barWidth: 12, yAxisMax: 77, titleText: { size: 18 } } })
    expect(next.multiples!.panels[1]).toMatchObject({ id: 'line', config: { kind: 'spline', canvasWidth: 500, seriesStyles: { revenue: { lineWidth: 6, showMarker: true } } } })
    expect(next.multiples!.panels[2]).toBeNull()
    expect(applyTemplate(target.multiples.panels[1]!.config, template).seriesStyles.revenue.lineWidth).toBe(6)
    const changed = structuredClone(source)
    changed.multiples.panels[2].config.barWidth = 33
    expect(templateAppearanceSignature(changed, false, (config) => config.yFields)).not.toBe(templateAppearanceSignature(source, false, (config) => config.yFields))
  })

  it('keeps panel margins and text visibility when applying a standalone template to a grid', () => {
    const base = createDefaultChartConfig()
    const template = createTemplate(base, 'Single', false)
    const target = { ...base, multiples: { columns: 1, rows: 1, gap: 10, panels: [{ id: 'cell', config: { ...base, canvasMarginLeft: 8, showSubtitle: false } }] } }
    expect(applyTemplateToComposition(target, template, (config) => config.yFields).multiples!.panels[0]!.config).toMatchObject({ canvasMarginLeft: 8, showSubtitle: false })
  })
})
