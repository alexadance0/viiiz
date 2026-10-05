import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('calendar boundaries between observations appear in category previews and exports', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1250, height: 950 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/src/main.tsx', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }))
  await page.goto('/editor')
  await page.evaluate(async () => {
    await import('/src/index.css')
    await import('/src/App.css')
    await import('/src/test-fixtures/chartAudit.browser.tsx')
  })
  for (const kind of ['bar', 'horizontal-bar', 'waterfall', 'heatmap', 'scatter', 'connected-scatter']) {
    await page.evaluate(async (kind) => {
      const { renderConfig } = await import('/src/test-fixtures/chartAudit.browser.tsx')
      renderConfig(kind, { xField: 'Дата', yField: 'Значение', yFields: ['Значение', 'Второе'], aggregation: 'none', dateLabelFormat: 'year-full', dateAxisStepUnit: 'year', xAxisStep: 1, showLegend: false, showValues: false, showDirectLabels: false, showXAxisTitle: false, showYAxisTitle: false, xAxisLabelRotate: 'auto' }, {
        name: 'Calendar boundaries', columns: ['Дата', 'Значение', 'Второе'], rows: [
          { Дата: new Date(2016, 11, 28), Значение: 10, Второе: 5 },
          { Дата: new Date(2017, 0, 9), Значение: 20, Второе: 10 },
          { Дата: new Date(2018, 0, 10), Значение: 30, Второе: 15 },
        ],
      })
    }, kind)
    const canvas = page.locator('#chart-audit-host .chart-canvas-shell')
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    await expect(page.locator('.chart-error')).toHaveCount(0)
    for (const year of ['2017', '2018']) await expect(canvas.locator('svg text').filter({ hasText: new RegExp(`^${year}$`) }), kind).toHaveCount(1)
    const bounds = await page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).textBounds())
    expect(bounds.filter((item) => item.outside), kind).toEqual([])
    const download = page.waitForEvent('download')
    await page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).exportSvg())
    const svg = await readFile((await (await download).path())!, 'utf8')
    for (const year of ['2017', '2018']) expect(svg, kind).toContain(`>${year}</text>`)
  }
})

for (const kind of ['line', 'scatter']) test(`${kind}: January at the left edge survives imported time components in preview and SVG`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/src/main.tsx', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }))
  await page.goto('/editor')
  await page.evaluate(async (kind) => {
    await import('/src/index.css')
    await import('/src/App.css')
    const { renderConfig } = await import('/src/test-fixtures/chartAudit.browser.tsx')
    renderConfig(kind, { xField: 'Дата', yField: 'Значение', yFields: ['Значение'], aggregation: 'none', dateLabelFormat: 'year-full', xAxisStep: 5, showLegend: false, showValues: false, showDirectLabels: false }, {
      name: 'Imported monthly dates', columns: ['Дата', 'Значение'], rows: Array.from({ length: 312 }, (_, month) => ({ Дата: new Date(2000, month, 1, 3), Значение: Math.sin(month / 12) })),
      timeProfiles: { Дата: { frequency: 'monthly', label: 'Месячные', confidence: 100, source: 'intervals' } },
    })
  }, kind)
  const canvas = page.locator('#chart-audit-host .chart-canvas-shell')
  await expect(canvas).toHaveAttribute('data-render-status', 'settled')
  const years = canvas.locator('svg text').filter({ hasText: /^(2000|2005|2010|2015|2020|2025)$/ })
  await expect(years).toHaveText(['2000', '2005', '2010', '2015', '2020', '2025'])
  const bounds = await page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).textBounds())
  expect(bounds.filter((item) => item.outside)).toEqual([])
  const download = page.waitForEvent('download')
  await page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).exportSvg())
  const svg = await readFile((await (await download).path())!, 'utf8')
  expect(svg).toContain('>2000</text>')
})
