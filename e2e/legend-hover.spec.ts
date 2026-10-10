import { expect, test } from '@playwright/test'

for (const side of ['left', 'right'] as const) for (const kind of ['line', 'spline', 'step-line', 'area', 'stacked-area', 'moving-average-line'] as const) {
  test(`${kind} keeps ${side} direct series names on hover and suppresses tooltips outside the plot`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route('**/src/main.tsx', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }))
    await page.goto('/editor')
    await page.evaluate(async ({ kind, side }) => {
      await import('/src/index.css'); await import('/src/App.css')
      const fixture = await import('/src/test-fixtures/chartAudit.browser.tsx')
      fixture.renderConfig(kind, { yAxisPosition: side === 'left' ? 'right' : 'left', xField: 'Год', yField: 'Индия', yFields: ['Индия', 'Пакистан'], movingAverageWindow: 2, showDirectLabels: true, showLegend: false, showValues: false }, {
        name: 'legend', columns: ['Год', 'Индия', 'Пакистан'], rows: [
          { Год: 2021, Индия: 70, Пакистан: 40 }, { Год: 2022, Индия: 80, Пакистан: 75 }, { Год: 2023, Индия: 85, Пакистан: 35 }, { Год: 2024, Индия: 87.37, Пакистан: 10 }, { Год: 2025, Индия: null, Пакистан: null },
        ],
      })
    }, { kind, side })
    const canvas = page.locator('#chart-audit-host .chart-canvas-shell')
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    const name = canvas.locator('svg text').filter({ hasText: /^Индия$/ }).first()
    await expect(name).toBeVisible()
    const line = await canvas.locator('svg').evaluate((svg) => {
      const path = [...svg.querySelectorAll<SVGGeometryElement>('path')].find((path) => path.getAttribute('stroke')?.startsWith('#') && Number(path.getAttribute('stroke-width')) >= 2 && Number(path.getAttribute('opacity') ?? 1) > 0 && path.getTotalLength() > 100)!
      const point = path.getPointAtLength(path.getTotalLength() / 2).matrixTransform(path.getScreenCTM()!)
      return { x: point.x, y: point.y }
    })
    await page.mouse.move(line.x, line.y)
    await expect(name).toBeVisible()
    await expect(canvas.locator('svg text').filter({ hasText: /^87,37$/ })).toHaveCount(0)
    const box = (await name.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await expect(name).toBeVisible()
    await expect(page.locator('.chart-tooltip:visible')).toHaveCount(0)
    await expect(canvas.locator('svg text').filter({ hasText: /^87,37$/ })).toHaveCount(0)
    expect(errors).toEqual([])
  })
}

for (const position of ['top', 'bottom', 'left', 'right'] as const) {
  test(`ordinary legend at ${position} never opens a data tooltip`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.route('**/src/main.tsx', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }))
    await page.goto('/editor')
    await page.evaluate(async (position) => {
      await import('/src/index.css'); await import('/src/App.css')
      const fixture = await import('/src/test-fixtures/chartAudit.browser.tsx')
      fixture.renderConfig('line', { showDirectLabels: false, showLegend: true, showValues: false, legendPosition: position, seriesStyles: { Значение: { legendLabel: 'Ряд в легенде' } } })
    }, position)
    const canvas = page.locator('#chart-audit-host .chart-canvas-shell')
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    const name = canvas.locator('svg text').filter({ hasText: /^Ряд в легенде$/ })
    const box = (await name.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await expect(name).toBeVisible()
    await expect(page.locator('.chart-tooltip:visible')).toHaveCount(0)
  })
}
