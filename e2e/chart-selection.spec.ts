import { expect, test, type Page } from '@playwright/test'

async function selection(page: Page) {
  return page.locator('#chart-audit-host').evaluate((host) => JSON.parse((host as HTMLElement).dataset.selection!))
}

for (const kind of ['line', 'spline', 'step-line', 'slope', 'bump', 'indexed-line', 'seasonal-line', 'range-line', 'confidence-line', 'moving-average-line', 'moving-average-scatter', 'bar', 'stacked-bar', 'normalized-stacked-bar', 'horizontal-bar', 'waterfall', 'lollipop', 'dumbbell', 'dot-plot', 'arrow-plot', 'heatmap', 'marimekko', 'area', 'stream-graph', 'scatter', 'bubble', 'connected-scatter', 'pie', 'donut', 'waffle', 'treemap', 'map-russia', 'sankey', 'jitter-plot', 'boxplot', 'violinplot', 'raincloud', 'histogram', 'kde-plot', 'ridgeline', 'beeswarm', 'strip-plot', 'counts-plot', 'barcode-plot', 'stacked-area', 'normalized-stacked-area', 'horizontal-stacked-bar', 'horizontal-normalized-stacked-bar', 'horizontal-lollipop', 'butterfly', 'step-range-line', 'map-usa', 'map-europe', 'map-world', 'tilemap-russia', 'tilemap-usa', 'tilemap-europe', 'tilemap-world'] as const) {
  test(`${kind}: first click selects the series, second selects its element`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route('**/src/main.tsx', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }))
    await page.goto('/editor')
    await page.evaluate(async (kind) => {
      await import('/src/index.css'); await import('/src/App.css')
      const fixture = await import('/src/test-fixtures/chartAudit.browser.tsx')
      fixture.renderInteractive(kind, { showValues: false, showLegend: false, showDirectLabels: false })
    }, kind)
    const canvas = page.locator('#chart-audit-host .chart-canvas-shell')
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    const point = await canvas.locator('svg').evaluate((svg, kind) => {
      const ignored = ['none', 'transparent', '#fff', '#ffffff', '#202027', '#000', '#000000', '#d9d7df']
      for (const element of svg.querySelectorAll<SVGGeometryElement>('path,rect,circle,polygon')) {
        if (element.closest('defs') || Number(element.getAttribute('opacity') ?? 1) === 0 || Number(element.getAttribute('fill-opacity') ?? 1) === 0) continue
        if ((kind === 'arrow-plot' || kind === 'barcode-plot') && element.tagName === 'path' && ['none', null].includes(element.getAttribute('fill')) && element.getAttribute('stroke')?.startsWith('#') && Number(element.getAttribute('stroke-width')) >= 2 && element.getTotalLength() < (kind === 'barcode-plot' ? 200 : 40)) {
          const point = element.getPointAtLength(element.getTotalLength() / 2).matrixTransform(element.getScreenCTM()!)
          return { x: point.x, y: point.y }
        }
        if (['line', 'spline', 'step-line', 'area', 'slope', 'bump', 'indexed-line', 'seasonal-line', 'moving-average-line', 'range-line', 'step-range-line', 'confidence-line', 'stacked-area', 'normalized-stacked-area'].includes(kind)) {
          const color = element.getAttribute('stroke')
          if (element.tagName !== 'path' || !color || ignored.includes(color) || Number(element.getAttribute('stroke-width') ?? 1) < 2 || element.getTotalLength() < 100) continue
          const point = element.getPointAtLength(0).matrixTransform(element.getScreenCTM()!)
          return { x: point.x + 3, y: point.y + 3 }
        }
        const color = element.getAttribute('fill'), bounds = element.getBoundingClientRect()
        if (!color || ignored.includes(color) || bounds.width < 4 || bounds.height < 4) continue
        const inverse = element.getScreenCTM()!.inverse()
        for (let row = 1; row < 5; row++) for (let column = 1; column < 5; column++) {
          const x = bounds.x + bounds.width * column / 5, y = bounds.y + bounds.height * row / 5
          if (element.isPointInFill(new DOMPoint(x, y).matrixTransform(inverse))) return { x, y }
        }
      }
      return null
    }, kind)
    expect(point).not.toBeNull()
    await page.mouse.click(point!.x, point!.y)
    await expect.poll(async () => (await selection(page)).series?.name).toBeTruthy()
    const first = await selection(page)
    expect(first.series.name).not.toContain('__')
    expect(first.element).toBeNull()
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    await page.mouse.click(point!.x, point!.y)
    await expect.poll(async () => (await selection(page)).element?.key).toBeTruthy()
    const second = await selection(page)
    expect(second.element.seriesName).toBe(first.series.name)
    expect(second.element.key).not.toContain('__hit__')
    await page.mouse.move(0, 0)
    if (kind === 'marimekko') await canvas.screenshot({ path: '/tmp/viiiz-marimekko-element-selection.png' })
    if (kind !== 'sankey') {
      await page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).editSelected({ color: '#202027', label: 'Я', showLabel: true, showName: true, showValue: true, showMarker: true }))
      await expect(canvas.locator('svg text').filter({ hasText: /Я/ }).first()).toBeVisible()
    }
    await page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).resetSelection())
    await expect.poll(async () => (await selection(page)).series).toBeNull()
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    expect(errors).toEqual([])
  })
}

test('line element editor changes its marker and label and keeps them in SVG export', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/editor')
  await page.locator('.upload-card input').setInputFiles({ name: 'points.csv', mimeType: 'text/csv', buffer: Buffer.from('Год,А,Б\n2020,10,15\n2021,20,10\n2022,15,25') })
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  await page.getByRole('button', { name: 'Линия', exact: true }).click()
  await page.getByRole('button', { name: 'Настроить оформление →' }).click()
  const canvas = page.locator('.chart-canvas-shell')
  await expect(canvas).toHaveAttribute('data-render-status', 'settled')
  const point = await canvas.locator('svg path').evaluateAll((elements) => {
    const line = elements.find((element) => {
      const path = element as SVGGeometryElement
      return Number(element.getAttribute('stroke-width')) >= 2 && element.getAttribute('stroke')?.startsWith('#') && path.getTotalLength() > 100
    }) as SVGGeometryElement
    const point = line.getPointAtLength(0).matrixTransform(line.getScreenCTM()!)
    return { x: point.x + 3, y: point.y + 9 }
  })
  await page.mouse.click(point.x, point.y)
  await expect(page.locator('.series-editor')).toBeVisible()
  await expect(page.locator('.series-editor')).not.toContainText('__hit__')
  await page.mouse.click(point.x, point.y)
  const editor = page.locator('.element-editor:not(.series-editor)')
  await expect(editor).toBeVisible()
  await expect(editor).toContainText('Цвет элемента')
  await editor.getByText('Показывать маркер', { exact: true }).click()
  await expect(editor.getByRole('checkbox', { name: 'Показывать маркер', exact: true })).toBeChecked()
  await editor.getByRole('combobox', { name: 'Форма', exact: true }).selectOption('triangle')
  await editor.getByRole('spinbutton', { name: 'Размер, px', exact: true }).fill('16')
  await editor.getByRole('textbox', { name: 'Текст подписи', exact: true }).fill('Моя точка')
  await editor.getByRole('combobox', { name: 'Положение', exact: true }).selectOption('bottom')
  await expect(canvas.locator('svg text').filter({ hasText: /^Моя точка$/ })).toBeVisible()
  await page.getByRole('button', { name: 'Снять выделение', exact: true }).click()
  await page.mouse.move(0, 0)
  await expect(canvas.locator('svg text').filter({ hasText: /^Моя точка$/ })).toBeVisible()
  await page.locator('.export-menu > summary').click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать SVG', exact: true }).click()
  const { readFile } = await import('node:fs/promises')
  const svg = await readFile((await (await download).path())!, 'utf8')
  expect(svg).toContain('Моя точка')
  expect(svg).not.toContain('native-selection-hit')
})
