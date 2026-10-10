import { test, expect, type Page } from '@playwright/test'
import { mkdir, readFile } from 'node:fs/promises'

async function loadMarkets(page: Page) {
  await page.locator('.upload-card input').setInputFiles({ name: 'markets.csv', mimeType: 'text/csv', buffer: Buffer.from('Рынок,Альфа,Бета,Гамма,Другие\nСмартфоны,180,120,60,40\nНоутбуки,60,80,30,30\nПланшеты,40,20,25,15\nЧасы,15,10,15,10') })
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  await page.getByRole('button', { name: 'Marimekko', exact: true }).click()
  const group = page.getByRole('group', { name: 'Сегменты / числовые показатели', exact: true })
  while (await group.getByRole('checkbox', { checked: false }).count()) await group.getByRole('checkbox', { checked: false }).first().press('Space')
}

const output = 'output/chart-layout-system-2026-10-04'
async function mount(page: Page) {
  await page.setViewportSize({ width: 1250, height: 950 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/src/main.tsx', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }))
  await page.goto('/editor')
  await page.evaluate(async () => {
    await import('/src/index.css')
    await import('/src/App.css')
    await import('/src/test-fixtures/chartAudit.browser.tsx')
  })
  await mkdir(output, { recursive: true })
}
const settled = (page: Page) => expect(page.locator('#chart-audit-host .chart-canvas-shell')).toHaveAttribute('data-render-status', 'settled')
const texts = (page: Page) => page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).textBounds())

test('butterfly reserves readable categories on both sides and uses one axis title', async ({ page }) => {
  await mount(page)
  for (const placement of ['left', 'right', 'center']) {
    await page.evaluate(async (placement) => {
      const { renderConfig } = await import('/src/test-fixtures/chartAudit.browser.tsx')
      const { marimekkoDemoTable } = await import('/src/core/demoData.ts')
      renderConfig('butterfly', { xField: 'Рынок', yFields: ['Альфа', 'Бета'], yField: 'Альфа', butterflyLeftFields: ['Альфа'], butterflyRightFields: ['Бета'], butterflyCategoryPosition: placement, xAxisLabelRotate: 0, xAxisLabelOverflow: 'wrap', yAxisTitle: 'Объём рынка', showYAxisTitle: true, showXAxisTitle: false, showLegend: true, legendPosition: 'right' }, marimekkoDemoTable)
    }, placement)
    await settled(page)
    const visible = await texts(page)
    for (const label of ['Смартфоны', 'Ноутбуки', 'Планшеты', 'Часы']) expect(visible.filter((item) => item.text === label), `${placement}: ${label}`).toHaveLength(1)
    expect(visible.filter((item) => item.text === 'Объём рынка')).toHaveLength(1)
    const category = visible.find((item) => item.text === 'Смартфоны')!
    const value = visible.find((item) => item.text === (placement === 'right' ? '120' : '180'))!
    if (placement === 'left') expect(category.x + category.width + 8).toBeLessThan(value.x)
    if (placement === 'right') expect(value.x + value.width + 8).toBeLessThan(category.x)
    expect(visible.some((item) => /[…]|\.\.\./.test(item.text))).toBe(false)
    expect(visible.filter((item) => item.outside)).toEqual([])
    await page.locator('#chart-audit-host .chart-canvas-shell').screenshot({ path: `${output}/butterfly-${placement}.png` })
  }
})

test('side legends reserve complete names including multiline and long labels', async ({ page }) => {
  await mount(page)
  for (const kind of ['horizontal-normalized-stacked-bar', 'line', 'pie']) for (const side of ['left', 'right']) {
    await page.evaluate(async ({ kind, side }) => {
      const { renderConfig } = await import('/src/test-fixtures/chartAudit.browser.tsx')
      const { marimekkoDemoTable } = await import('/src/core/demoData.ts')
      renderConfig(kind, { xField: 'Рынок', yField: 'Альфа', yFields: kind === 'pie' ? ['Альфа'] : ['Альфа', 'Бета', 'Гамма', 'Другие'], showXAxisTitle: false, showYAxisTitle: false, showValues: false, showLegend: true, legendPosition: side, seriesStyles: { Другие: { legendLabel: 'Остальные производители' }, Бета: { legendLabel: 'Бета\nРоссийский рынок' } }, xAxisLabelRotate: 'auto', xAxisLabelOverflow: 'auto' }, marimekkoDemoTable)
    }, { kind, side })
    await settled(page)
    const visible = await texts(page)
    if (kind !== 'pie') expect(visible.filter((item) => item.text === 'Остальные производители')).toHaveLength(1)
    expect(visible.some((item) => /[…]|\.\.\./.test(item.text))).toBe(false)
    expect(visible.filter((item) => item.outside)).toEqual([])
    await page.locator('#chart-audit-host .chart-canvas-shell').screenshot({ path: `${output}/${kind}-${side}.png` })
  }
})

test('all point-category dynamics keep Y labels on the document margin', async ({ page }) => {
  test.setTimeout(90_000)
  await mount(page)
  for (const kind of ['line', 'spline', 'step-line', 'indexed-line', 'area', 'stacked-area', 'normalized-stacked-area', 'range-line', 'step-range-line', 'confidence-line', 'moving-average-line', 'moving-average-scatter']) {
    await page.evaluate(async (kind) => {
      const { renderConfig } = await import('/src/test-fixtures/chartAudit.browser.tsx')
      const { marimekkoDemoTable } = await import('/src/core/demoData.ts')
      renderConfig(kind, { xField: 'Рынок', yField: 'Альфа', yFields: ['Альфа', 'Бета'], rangeLowerField: 'Бета', rangeUpperField: 'Альфа', intervalGroups: [{ main: 'Альфа', lower: 'Бета', upper: 'Гамма' }], indexBaseXValue: 'string:Смартфоны', movingAverageWindow: 2, showXAxisTitle: false, showYAxisTitle: false, showValues: false, showLegend: false, showDirectLabels: false, xAxisLabelRotate: 0, xAxisLabelOverflow: 'auto' }, marimekkoDemoTable)
    }, kind)
    await settled(page)
    const visible = await texts(page)
    const ticks = visible.filter((item) => /^\d+[.,]?\d*%?$/.test(item.text))
    expect(ticks.length, kind).toBeGreaterThan(1)
    for (const tick of ticks) expect(Math.abs(tick.x - 32), `${kind}: ${tick.text}`).toBeLessThan(1)
    expect(visible.filter((item) => item.outside), kind).toEqual([])
  }
  await page.locator('#chart-audit-host .chart-canvas-shell').screenshot({ path: `${output}/categorical-dynamics.png` })
})

test('rotated edge categories fit both X sides without moving Y labels', async ({ page }) => {
  await mount(page)
  for (const rotation of [0, 45, 90]) for (const side of ['top', 'bottom']) {
    await page.evaluate(async ({ rotation, side }) => {
      const { renderConfig } = await import('/src/test-fixtures/chartAudit.browser.tsx')
      const { marimekkoDemoTable } = await import('/src/core/demoData.ts')
      renderConfig('line', { xField: 'Рынок', yField: 'Альфа', yFields: ['Альфа'], xAxisLabelRotate: rotation, xAxisPosition: side, xAxisLabelOverflow: 'auto', showXAxisTitle: false, showYAxisTitle: false, showLegend: false, showValues: false }, marimekkoDemoTable)
    }, { rotation, side })
    await settled(page)
    const visible = await texts(page)
    expect(visible.filter((item) => item.outside)).toEqual([])
    expect(visible.filter((item) => item.text === 'Смартфоны')).toHaveLength(1)
    for (const tick of visible.filter((item) => /^\d+$/.test(item.text))) expect(Math.abs(tick.x - 32)).toBeLessThan(1)
  }
})

test('automatic rotation uses the final plot width and never breaks country names', async ({ page }) => {
  await mount(page)
  await page.evaluate(async () => {
    const { renderConfig } = await import('/src/test-fixtures/chartAudit.browser.tsx')
    const names = ['США', 'Китай', 'Германия', 'Япония', 'Индия', 'Великобритания', 'Франция', 'Италия', 'Канада', 'Бразилия']
    renderConfig('bar', { canvasWidth: 800, xField: 'Страна', yField: 'ВВП', yFields: ['ВВП'], aggregation: 'none', showXAxisTitle: false, showYAxisTitle: false, showLegend: false, xAxisLabelRotate: 'auto', xAxisLabelOverflow: 'auto' }, { name: 'GDP', columns: ['Страна', 'ВВП'], rows: names.map((Страна, index) => ({ Страна, ВВП: 29 - index * 2 })) })
  })
  await settled(page)
  const visible = await texts(page)
  expect(visible.filter((item) => item.text === 'Великобритания')).toHaveLength(1)
  expect(visible.filter((item) => item.outside)).toEqual([])
  const category = page.locator('#chart-audit-host svg text').filter({ hasText: /^Великобритания$/ })
  const bounds = await category.boundingBox()
  expect(bounds!.height).toBeGreaterThan(bounds!.width * 2)
  await page.locator('#chart-audit-host .chart-canvas-shell').screenshot({ path: `${output}/gdp-auto-rotation.png` })
  const download = page.waitForEvent('download')
  await page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).exportSvg())
  await (await download).saveAs(`${output}/gdp-auto-rotation.svg`)
})


test('real editor chart switches reset legends, values and wrapping', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/editor')
  await loadMarkets(page)
  await page.getByRole('button', { name: /^Столбцы$/ }).click()
  await expect(page.locator('.chart-canvas-shell')).toHaveAttribute('data-render-status', 'settled')
  // Marimekko enables values and its legend by default. Neither leaks into Bar.
  const bars = page.locator('.canvas-paper svg text')
  await expect(bars.filter({ hasText: /^Альфа$/ })).toHaveCount(0)
  await expect(bars.filter({ hasText: /^180$/ })).toHaveCount(0)
  await expect(bars.filter({ hasText: /^Смартфоны$/ })).toHaveCount(1)
  await page.getByRole('button', { name: /^Marimekko$/ }).click()
  await expect(page.locator('.chart-canvas-shell')).toHaveAttribute('data-render-status', 'settled')
  await expect(page.locator('.canvas-paper svg text').filter({ hasText: /^Альфа$/ })).toHaveCount(1)
  await page.getByRole('button', { name: /^Линия$/ }).click()
  await expect(page.locator('.chart-canvas-shell')).toHaveAttribute('data-render-status', 'settled')
  await expect(page.locator('.canvas-paper svg text').filter({ hasText: /^Альфа$/ })).toHaveCount(0)
})


test('edge category labels remain editable in the real editor', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/editor')
  await loadMarkets(page)
  await page.getByRole('button', { name: /^Линия$/ }).click()
  await expect(page.locator('.chart-canvas-shell')).toHaveAttribute('data-render-status', 'settled')
  const label = page.locator('.canvas-paper svg text').filter({ hasText: /^Смартфоны$/ })
  const revision = Number(await page.locator('.chart-canvas-shell').getAttribute('data-render-revision'))
  await label.click({ force: true })
  await expect.poll(async () => Number(await page.locator('.chart-canvas-shell').getAttribute('data-render-revision'))).toBeGreaterThan(revision)
  await expect(page.locator('.chart-canvas-shell')).toHaveAttribute('data-render-status', 'settled')
  await label.click({ force: true })
  await expect(page.locator('.canvas-rich-text-content')).toBeVisible()
  await expect(page.locator('.canvas-rich-text-content')).toHaveText('Смартфоны')
})

test('direct series labels preserve whole words in preview and export', async ({ page }) => {
  await mount(page)
  await page.evaluate(async () => {
    const { renderConfig } = await import('/src/test-fixtures/chartAudit.browser.tsx')
    const { marimekkoDemoTable } = await import('/src/core/demoData.ts')
    renderConfig('normalized-stacked-area', {
      xField: 'Рынок', yField: 'Альфа', yFields: ['Альфа', 'Бета', 'Гамма', 'Другие'],
      showXAxisTitle: false, showYAxisTitle: false, showValues: false,
      showLegend: false, showDirectLabels: true,
      seriesStyles: { Другие: { legendLabel: 'Текущий год' } },
    }, marimekkoDemoTable)
  })
  await settled(page)
  const visible = await texts(page)
  for (const name of ['Альфа', 'Бета', 'Гамма', 'Текущий год']) expect(visible.filter((item) => item.text === name)).toHaveLength(1)
  expect(visible.filter((item) => item.outside)).toEqual([])
  await page.locator('#chart-audit-host .chart-canvas-shell').screenshot({ path: `${output}/direct-labels.png` })
  const download = page.waitForEvent('download')
  await page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).exportSvg())
  const svgPath = `${output}/direct-labels.svg`
  await (await download).saveAs(svgPath)
  const svg = await readFile(svgPath, 'utf8')
  expect(svg).toContain('Текущий год')
})

test('every horizontal category family rotates complete country names when slots are too narrow', async ({ page }) => {
  test.setTimeout(120_000)
  await mount(page)
  const kinds = ['bar', 'stacked-bar', 'normalized-stacked-bar', 'marimekko', 'waterfall', 'lollipop', 'dumbbell', 'line', 'spline', 'step-line', 'indexed-line', 'bump', 'area', 'stacked-area', 'normalized-stacked-area', 'range-line', 'step-range-line', 'confidence-line', 'moving-average-line', 'moving-average-scatter', 'heatmap', 'boxplot', 'violinplot', 'strip-plot', 'jitter-plot', 'beeswarm', 'raincloud', 'ridgeline', 'barcode-plot', 'counts-plot']
  for (const kind of kinds) for (const side of ['top', 'bottom']) {
    await page.evaluate(async ({ kind, side }) => {
      const { renderConfig } = await import('/src/test-fixtures/chartAudit.browser.tsx')
      const names = ['США', 'Китай', 'Германия', 'Япония', 'Индия', 'Великобритания', 'Франция', 'Италия', 'Канада', 'Бразилия']
      renderConfig(kind, {
        canvasWidth: 800, xField: 'Страна', yField: 'ВВП', yFields: ['ВВП', 'place'],
        aggregation: 'none', showXAxisTitle: false, showYAxisTitle: false,
        showLegend: false, showDirectLabels: false, showValues: false,
        xAxisPosition: side, xAxisLabelRotate: 0, xAxisLabelOverflow: 'wrap',
        distributionGroupField: 'Страна', distributionLayoutMode: 'categories', distributionOrientation: 'vertical',
        heatmapYField: 'Группа', dumbbellOrientation: 'vertical', dumbbellStartField: 'ВВП', dumbbellEndField: 'place',
        rangeLowerField: 'place', rangeUpperField: 'ВВП', intervalGroups: kind === 'confidence-line' ? [{ main: 'ВВП', lower: 'place', upper: 'upper' }] : [],
        movingAverageWindow: 2, indexBaseXValue: 'string:США',
      }, { name: 'Countries', columns: ['Страна', 'ВВП', 'place', 'upper', 'Группа'], rows: names.map((Страна, index) => ({ Страна, ВВП: 29 - index * 2, place: index + 1, upper: 39 - index * 2, Группа: 'Группа' })) })
    }, { kind, side })
    await settled(page)
    const visible = await texts(page)
    const country = visible.filter((item) => item.text === 'Великобритания')
    expect(country, `${kind} ${side}`).toHaveLength(1)
    expect(country[0].height, `${kind} ${side}: rotation`).toBeGreaterThan(country[0].width * 2)
    expect(visible.filter((item) => item.outside), `${kind} ${side}: bounds`).toEqual([])
    if (['waterfall', 'marimekko'].includes(kind) && side === 'bottom') await page.locator('#chart-audit-host .chart-canvas-shell').screenshot({ path: `${output}/${kind}-countries-fit.png` })
  }
})

test('outer category alignment follows the document edge with and without ticks', async ({ page }) => {
  await mount(page)
  for (const side of ['left', 'right']) for (const ticks of [false, true]) for (const gap of [4, 16]) {
    await page.evaluate(async ({ side, ticks, gap }) => {
      const { renderConfig } = await import('/src/test-fixtures/chartAudit.browser.tsx')
      const { marimekkoDemoTable } = await import('/src/core/demoData.ts')
      renderConfig('horizontal-bar', { xField: 'Рынок', yField: 'Альфа', yFields: ['Альфа'], showLegend: false, showValues: false, showXAxisTitle: false, showYAxisTitle: false, yAxisPosition: side, categoryAxisLabelAlignment: 'outer', showXTicks: ticks, tickLength: 12, xAxisLabelGap: gap }, marimekkoDemoTable)
    }, { side, ticks, gap })
    await settled(page)
    const visible = await texts(page)
    const categories = visible.filter((item) => ['Смартфоны', 'Ноутбуки', 'Планшеты', 'Часы'].includes(item.text))
    expect(categories).toHaveLength(4)
    for (const label of categories) expect(Math.abs((side === 'left' ? label.x : label.x + label.width) - (side === 'left' ? 32 : 776)), `${side} ticks=${ticks} gap=${gap} ${JSON.stringify(label)}`).toBeLessThan(1)
  }
})

test('waterfall keeps numeric Y labels on the document line and exports the resolved axes', async ({ page }) => {
  await mount(page)
  await page.evaluate(async () => {
    const { renderConfig } = await import('/src/test-fixtures/chartAudit.browser.tsx')
    const names = ['США', 'Китай', 'Германия', 'Япония', 'Индия', 'Великобритания', 'Франция', 'Италия', 'Канада', 'Бразилия']
    renderConfig('waterfall', { canvasWidth: 800, xField: 'Страна', yField: 'ВВП', yFields: ['ВВП'], showXAxisTitle: false, showYAxisTitle: false, showValues: false, showLegend: false, showYTicks: true, tickLength: 12, xAxisLabelRotate: 'auto' }, { name: 'GDP', columns: ['Страна', 'ВВП'], rows: names.map((Страна, index) => ({ Страна, ВВП: 29 - index * 2 })) })
  })
  await settled(page)
  const visible = await texts(page)
  const yLabels = visible.filter((item) => /^\d+$/.test(item.text))
  expect(yLabels.length).toBeGreaterThan(2)
  for (const label of yLabels) expect(Math.abs(label.x - 32)).toBeLessThan(1)
  const download = page.waitForEvent('download')
  await page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).exportSvg())
  await (await download).saveAs(`${output}/waterfall-countries-fit.svg`)
})

test('slope and seasonal category labels use the shared fitting rule', async ({ page }) => {
  await mount(page)
  for (const kind of ['slope', 'seasonal-line']) for (const side of ['top', 'bottom']) {
    await page.evaluate(async ({ kind, side }) => {
      const { renderConfig } = await import('/src/test-fixtures/chartAudit.browser.tsx')
      const { auditFixture } = await import('/src/test-fixtures/chartAudit.ts')
      const { getChartPlugin } = await import('/src/core/chartRegistry.ts')
      const fixture = auditFixture(kind)
      const source = getChartPlugin(kind).compile(fixture.table, fixture.config)
      const categories = source.plot.kind === 'slope' ? source.plot.positions : source.plot.categories
      const overrides = Object.fromEntries(categories.map((category) => [category.coordinate, 'Великобритания — начало наблюдений']))
      renderConfig(kind, { canvasWidth: 460, canvasHeight: 900, xAxisPosition: side, showXAxisTitle: false, showYAxisTitle: false, showYAxisLabels: false, showValues: false, showLegend: false, showDirectLabels: false, xAxisLabelRotate: 0, xAxisLabelOverflow: 'wrap', categoryLabelOverrides: { x: overrides } })
    }, { kind, side })
    await settled(page)
    const labels = (await texts(page)).filter((item) => item.text === 'Великобритания — начало наблюдений')
    expect(labels.length, kind).toBeGreaterThan(0)
    for (const label of labels) expect(label.height, kind).toBeGreaterThan(label.width * 2)
    expect((await texts(page)).filter((item) => item.outside), kind).toEqual([])
  }
})
