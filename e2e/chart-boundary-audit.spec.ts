import { test, expect } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

test('text control limits, spacing limits, custom font and data roles', async ({ page }) => {
  test.skip(process.env.CHART_AUDIT !== '1')
  test.setTimeout(240_000)
  const directory = 'output/chart-audit-2026-10-03'
  mkdirSync(`${directory}/boundaries`, { recursive: true })
  await page.setViewportSize({ width: 1100, height: 1100 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/editor')
  const scenarios = await page.evaluate(async () => {
    await (await import('/src/components/echarts/loadEchartsForKind.ts')).preloadAllEcharts()
    const { chartRegistry } = await import('/src/core/chartRegistry.ts')
    const { auditFixture } = await import('/src/test-fixtures/chartAudit.ts')
    const { fontCatalog } = await import('/src/core/textFonts.ts')
    return chartRegistry.flatMap((plugin: { id: string; settings: { sections: string[] } }) => {
      const fixture = auditFixture(plugin.id), config = fixture.config
      const fields = Object.entries(config).filter(([key, value]) => key.endsWith('Text') && value && typeof value === 'object' && 'size' in value).map(([key]) => key)
      const text = (changes: Record<string, unknown>) => Object.fromEntries(fields.map((key) => [key, { ...config[key], ...changes }]))
      const cases = [{ id: 'text-size-minimum-6', patch: text({ size: 6 }) }, { id: 'text-size-maximum-72', patch: text({ size: 72 }) }, { id: 'text-weight-300', patch: text({ weight: 300 }) }, { id: 'text-weight-800', patch: text({ weight: 800 }) }, { id: 'text-line-height-80', patch: text({ lineHeight: 80 }) }, { id: 'text-line-height-250', patch: text({ lineHeight: 250 }) }, { id: 'spacing-minimum', patch: { canvasMarginTop: 0, canvasMarginRight: 0, canvasMarginBottom: 0, canvasMarginLeft: 0, titleSubtitleGap: 0, headerPlotGap: 0, legendPlotGap: 0, plotFooterGap: 0, noteSourceGap: 0 } }, { id: 'spacing-maximum', patch: { canvasMarginTop: 200, canvasMarginRight: 200, canvasMarginBottom: 200, canvasMarginLeft: 200, titleSubtitleGap: 200, headerPlotGap: 200, legendPlotGap: 200, plotFooterGap: 200, noteSourceGap: 200 } }]
      for (const font of fontCatalog) cases.push({ id: `font-${font.family}`, patch: text({ fontFamily: font.value }) })
      if (fixture.table.columns.includes('Другой')) cases.push({ id: 'data-role-alternative', patch: { yField: 'Другой', yFields: ['Другой'], seriesField: 'Группа', preferredDataSelection: { xField: config.xField, yFields: ['Другой'], seriesField: 'Группа' }, scatterLabelField: 'Категория', scatterSizeField: 'Значение', scatterColorField: 'Категория', distributionLabelField: 'Категория', distributionGroupField: 'Группа', butterflyLeftFields: ['Другой'], butterflyRightFields: ['Значение'], dumbbellStartField: 'Значение', dumbbellEndField: 'Другой', rangeLowerField: 'Другой', rangeUpperField: 'Верхняя', intervalGroups: [{ main: 'Другой', lower: 'Нижняя', upper: 'Верхняя' }], treemapSubcategoryField: 'Подпись' } })
      return cases.map((scenario) => ({ kind: plugin.id, ...scenario }))
    })
  })
  const results: unknown[] = []
  for (const scenario of scenarios) {
    let record: Record<string, unknown> = { kind: scenario.kind, case: scenario.id, fields: Object.keys(scenario.patch) }
    try {
      await page.evaluate(async ({ kind, patch }) => (await import('/src/test-fixtures/chartAudit.browser.tsx')).renderConfig(kind, patch), scenario)
      const shell = page.locator('#chart-audit-host .chart-canvas-shell')
      await expect.poll(() => shell.getAttribute('data-render-status')).toMatch(/^(settled|error)$/)
      record = { ...record, status: await shell.getAttribute('data-render-status'), error: await shell.locator('.chart-render-error').count() ? await shell.locator('.chart-render-error').textContent() : null, outside: (await page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).textBounds())).filter((item: { outside: boolean }) => item.outside) }
      if (scenario.kind === 'bar' || scenario.kind === 'pie' || scenario.kind === 'map-world') await shell.screenshot({ path: `${directory}/boundaries/${scenario.kind}-${scenario.id}.png`, animations: 'disabled' })
    } catch (error) { record.error = String(error) }
    results.push(record)
  }
  const fontPath = 'public/fonts/onest-cyrillic.woff2'
  const dataUrl = `data:font/woff2;base64,${readFileSync(fontPath).toString('base64')}`
  await page.evaluate(async (dataUrl) => {
    const { auditFixture } = await import('/src/test-fixtures/chartAudit.ts')
    const base = auditFixture('bar').config
    const { renderConfig } = await import('/src/test-fixtures/chartAudit.browser.tsx')
    renderConfig('bar', { customFonts: [{ name: 'Audit Custom Font', dataUrl, fileName: 'onest-cyrillic.woff2' }], titleText: { ...base.titleText, fontFamily: 'Audit Custom Font, sans-serif' } })
  }, dataUrl)
  await expect(page.locator('#chart-audit-host .chart-canvas-shell')).toHaveAttribute('data-render-status', 'settled')
  for (const format of ['svg', 'png']) {
    const download = page.waitForEvent('download')
    await page.evaluate(async (format) => { const module = await import('/src/test-fixtures/chartAudit.browser.tsx'); await (format === 'svg' ? module.exportSvg() : module.exportPng()) }, format)
    await (await download).saveAs(`${directory}/boundaries/custom-font.${format}`)
  }
  results.push({ case: 'custom-font', fields: ['customFonts', 'titleText'], loaded: await page.evaluate(() => document.fonts.check('400 12px "Audit Custom Font"', 'АаБб')), fontFaces: await page.evaluate(() => [...document.fonts].map((face) => ({ family: face.family, weight: face.weight, style: face.style, status: face.status }))) })
  writeFileSync(`${directory}/boundaries/results.json`, JSON.stringify(results, null, 2))
})
