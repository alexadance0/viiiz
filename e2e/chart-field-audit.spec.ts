import { test, expect } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'

test('close the inventory for data roles, element styles and existing composition tests', async ({ page }) => {
  test.skip(process.env.CHART_AUDIT !== '1')
  await page.setViewportSize({ width: 1100, height: 850 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/editor')
  await page.evaluate(async () => (await import('/src/components/echarts/loadEchartsForKind.ts')).preloadAllEcharts())
  const scenarios = await page.evaluate(async () => {
    const { auditFixture } = await import('/src/test-fixtures/chartAudit.ts')
    const { legacyBarElementKey } = await import('/src/features/chart-types/bar/compiler.ts')
    const sankey = auditFixture('sankey').config
    return [
      { kind: 'bar', patch: { xField: 'X' } },
      { kind: 'bar', patch: { kind: 'horizontal-bar' } },
      { kind: 'bar', patch: { elementStyles: { [legacyBarElementKey('Значение', 'Категория 1')]: { color: '#74204f', borderWidth: 2, borderColor: '#202027' } } } },
      { kind: 'sankey', patch: { sankeyTargetField: sankey.xField, xField: sankey.sankeyTargetField } },
      { kind: 'sankey', patch: { sankeyTargetField: sankey.yField }, expectedStatus: 'error' },
      { kind: 'raincloud', patch: { distributionGroupField: 'Категория' } },
      { kind: 'range-line', patch: { rangeUpperField: 'Другой', intervalGroups: [] } },
    ]
  })
  const results: unknown[] = []
  for (const scenario of scenarios) {
    await page.evaluate(async ({ kind, patch }) => (await import('/src/test-fixtures/chartAudit.browser.tsx')).renderConfig(kind, patch), scenario)
    const shell = page.locator('#chart-audit-host .chart-canvas-shell')
    await expect(shell).toHaveAttribute('data-render-status', scenario.expectedStatus ?? 'settled')
    if (scenario.patch.elementStyles) await expect(shell.locator('svg [fill="#74204f"]')).not.toHaveCount(0)
    results.push({ ...scenario, fields: Object.keys(scenario.patch), status: await shell.getAttribute('data-render-status'), renderedKind: await shell.getAttribute('data-chart-kind') })
  }
  const baseline = JSON.parse(readFileSync('output/chart-audit-2026-10-03/baseline.json', 'utf8'))
  const composition: Array<{ title: string; status: string }> = []
  const visit = (suites: Array<Record<string, any>>) => {
    for (const suite of suites) {
      if (suite.file === 'multiples.spec.ts') for (const spec of suite.specs ?? []) for (const item of spec.tests) composition.push({ title: spec.title, status: item.status })
      visit(suite.suites ?? [])
    }
  }
  visit(baseline.suites)
  expect(composition.length).toBeGreaterThanOrEqual(9)
  expect(composition.every((item) => item.status === 'expected')).toBe(true)
  results.push({ fields: ['multiples'], existingCompositionTests: composition })
  writeFileSync('output/chart-audit-2026-10-03/remaining-fields.json', JSON.stringify(results, null, 2))
})

test('review truncation semantics and CSS font syntax', async ({ page }) => {
  test.skip(process.env.CHART_AUDIT !== '1')
  await page.setViewportSize({ width: 1100, height: 850 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/editor')
  await page.evaluate(async () => (await import('/src/components/echarts/loadEchartsForKind.ts')).preloadAllEcharts())
  const fonts = await page.evaluate(async () => (await import('/src/core/textFonts.ts')).fontCatalog.map((font: { family: string; value: string }) => ({ family: font.family, value: font.value, supported: CSS.supports('font-family', font.value) })))
  expect(fonts.every((font: { supported: boolean }) => font.supported)).toBe(true)
  const results: unknown[] = []
  for (const overflow of ['auto', 'truncate']) {
    await page.evaluate(async (overflow) => {
      const overrides = Object.fromEntries(Array.from({ length: 6 }, (_, index) => [`${index}:Категория ${index + 1}`, `Длинное название категории номер ${index + 1} с подробным пояснением`]))
      ;(await import('/src/test-fixtures/chartAudit.browser.tsx')).renderConfig('bar', { xAxisLabelOverflow: overflow, xAxisLabelRotate: 0, categoryLabelOverrides: { x: overrides } })
    }, overflow)
    const shell = page.locator('#chart-audit-host .chart-canvas-shell')
    await expect(shell).toHaveAttribute('data-render-status', 'settled')
    const text = (await page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).textBounds())).filter((item: { text: string }) => /^Дл/.test(item.text))
    await shell.screenshot({ path: `output/chart-audit-2026-10-03/boundaries/truncation-${overflow}.png`, animations: 'disabled' })
    if (overflow === 'truncate') {
      expect(text).toHaveLength(6)
      expect(text.every((item: { text: string; outside: boolean }) => item.text.endsWith('...') && !item.outside)).toBe(true)
    }
    results.push({ overflow, text })
  }
  writeFileSync('output/chart-audit-2026-10-03/text-semantics.json', JSON.stringify({ fonts, results }, null, 2))
})
