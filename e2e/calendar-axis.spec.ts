import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

for (const kind of ['lollipop', 'horizontal-lollipop', 'dumbbell', 'dot-plot', 'arrow-plot', 'waterfall', 'heatmap', 'butterfly', 'line', 'moving-average-line', 'range-line', 'scatter']) test(`${kind}: clustered dates use calendar spacing in preview and export`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/src/main.tsx', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }))
  await page.goto('/editor')
  await page.evaluate(async (kind) => {
    await import('/src/index.css')
    await import('/src/App.css')
    const { renderConfig } = await import('/src/test-fixtures/chartAudit.browser.tsx')
    const dates = [new Date(1950, 0, 1), new Date(2010, 0, 1), ...Array.from({ length: 120 }, (_, index) => new Date(2016, index, 1))]
    renderConfig(kind, { canvasWidth: 1000, xField: 'Дата', yField: 'Значение', yFields: ['Значение', 'Другое'], butterflyLeftFields: ['Значение'], butterflyRightFields: ['Другое'], aggregation: 'none', dateLabelFormat: 'year-full', xAxisLabelRotate: 'auto', showValues: false, showLegend: false, showDirectLabels: false, waterfallShowTotal: false, dumbbellStartField: 'Значение', dumbbellEndField: 'Другое', rangeLowerField: 'Значение', rangeUpperField: 'Другое' }, {
      name: 'Clustered timeline', columns: ['Дата', 'Значение', 'Другое'], rows: dates.map((Дата) => ({ Дата, Значение: 1, Другое: 2 })),
    })
  }, kind)
  const canvas = page.locator('#chart-audit-host .chart-canvas-shell')
  await expect(canvas).toHaveAttribute('data-render-status', 'settled')
  await expect(page.locator('.chart-render-error')).toHaveCount(0)
  const labels = canvas.locator('svg text').filter({ hasText: /^\d{4}$/ })
  const years = (await labels.allTextContents()).map(Number).sort((a, b) => a - b)
  expect(years.length).toBeGreaterThanOrEqual(3)
  const steps = years.slice(1).map((year, index) => year - years[index])
  expect(new Set(steps).size).toBe(1)
  const vertical = ['horizontal-lollipop', 'dumbbell', 'dot-plot', 'arrow-plot', 'butterfly'].includes(kind)
  const bounds = await labels.evaluateAll((elements, vertical) => elements.map((element) => {
    const rect = element.getBoundingClientRect()
    return { center: vertical ? rect.y + rect.height / 2 : rect.x + rect.width / 2, start: vertical ? rect.top : rect.left, end: vertical ? rect.bottom : rect.right }
  }).sort((a, b) => a.center - b.center), vertical)
  for (let index = 1; index < bounds.length; index++) expect(bounds[index].start - bounds[index - 1].end).toBeGreaterThan(4)
  const gaps = bounds.slice(1).map((bound, index) => bound.center - bounds[index].center)
  expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(2)
  if (kind === 'lollipop') await canvas.screenshot({ path: 'output/calendar-lollipop.png' })
  const download = page.waitForEvent('download')
  await page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).exportSvg())
  const svg = await readFile((await (await download).path())!, 'utf8')
  for (const year of years) expect(svg).toContain(`>${year}</text>`)
})

test('calendar bars retain custom borders, absorbed values and stacks', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/src/main.tsx', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }))
  await page.goto('/editor')
  for (const kind of ['bar', 'horizontal-bar', 'stacked-bar']) {
    await page.evaluate(async (kind) => {
      await import('/src/index.css')
      await import('/src/App.css')
      const { renderConfig } = await import('/src/test-fixtures/chartAudit.browser.tsx')
      renderConfig(kind, { xField: 'Дата', yField: 'Значение', yFields: ['Значение', 'Другое'], aggregation: 'none', barBorderWidth: 2, barValueLabelAbsorption: true, showValues: true, showDirectLabels: false, dateLabelFormat: 'year-full', xAxisStep: 5, xAxisMin: '2000-01-01', xAxisMax: '2030-01-01' }, {
        name: 'Custom time bars', columns: ['Дата', 'Значение', 'Другое'], rows: [2005, 2010, 2025].map((year, index) => ({ Дата: new Date(year, 0, 1), Значение: 101 * (index + 1), Другое: 11 * (index + 1) })),
      })
    }, kind)
    const canvas = page.locator('#chart-audit-host .chart-canvas-shell')
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    await expect(page.locator('.chart-render-error')).toHaveCount(0)
    for (const value of ['101', '202', '303']) await expect(canvas.locator('svg text').filter({ hasText: new RegExp(`^${value}$`) }), kind).toHaveCount(1)
    const download = page.waitForEvent('download')
    await page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).exportSvg())
    const svg = await readFile((await (await download).path())!, 'utf8')
    for (const value of ['101', '202', '303']) expect(svg, kind).toContain(`>${value}</text>`)
  }
})

for (const width of [480, 1000]) test(`clustered observations keep calendar labels apart at ${width}px`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/src/main.tsx', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }))
  await page.goto('/editor')
  await page.evaluate(async (canvasWidth) => {
    await import('/src/index.css')
    await import('/src/App.css')
    const { renderConfig } = await import('/src/test-fixtures/chartAudit.browser.tsx')
    const dates = [1950, 1960, 1970, 1980, 1990, 2000, 2010].map((year) => new Date(year, 0, 1))
    dates.push(...Array.from({ length: 600 }, (_, index) => new Date(2010, 0, 2 + index * 10)))
    renderConfig('bar', { canvasWidth, xField: 'Дата', yField: 'Значение', yFields: ['Значение'], aggregation: 'none', dateLabelFormat: 'year-full', dateAxisStepUnit: 'year', xAxisStep: 10, showValues: false, showLegend: false, showDirectLabels: false, xAxisLabelRotate: 'auto' }, {
      name: 'Clustered dates', columns: ['Дата', 'Значение'], rows: dates.map((Дата, index) => ({ Дата, Значение: index + 1 })),
    })
  }, width)
  const canvas = page.locator('#chart-audit-host .chart-canvas-shell')
  await expect(canvas).toHaveAttribute('data-render-status', 'settled')
  const labels = canvas.locator('svg text').filter({ hasText: /^\d{4}$/ })
  const texts = await labels.allTextContents()
  expect(texts.length).toBeGreaterThan(2)
  if (width === 1000) expect(texts).toEqual(['1950', '1960', '1970', '1980', '1990', '2000', '2010', '2020'])
  const bounds = await labels.evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect()
    return { left: rect.left, right: rect.right, center: rect.left + rect.width / 2 }
  }).sort((a, b) => a.left - b.left))
  for (let index = 1; index < bounds.length; index++) expect(bounds[index].left - bounds[index - 1].right).toBeGreaterThanOrEqual(7)
  if (width === 1000) {
    const gaps = bounds.slice(1).map((bound, index) => bound.center - bounds[index].center)
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(2)
  }
  const download = page.waitForEvent('download')
  await page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).exportSvg())
  const svg = await readFile((await (await download).path())!, 'utf8')
  for (const text of texts) expect(svg).toContain(`>${text}</text>`)
})

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
