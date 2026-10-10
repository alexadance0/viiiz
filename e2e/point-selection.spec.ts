import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

for (const scenario of [
  { kind: 'line', markers: false },
  { kind: 'line', markers: true },
  { kind: 'scatter', markers: true },
  { kind: 'bubble', markers: true },
] as const) {
  test(`${scenario.kind}: selection has its own frame without adding a value label (${scenario.markers})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route('**/src/main.tsx', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }))
    await page.goto('/editor')
    await page.evaluate(async ({ kind, markers }) => {
      await import('/src/index.css'); await import('/src/App.css')
      const fixture = await import('/src/test-fixtures/chartAudit.browser.tsx')
      fixture.renderInteractive(kind, { showValues: false, showLegend: false, showDirectLabels: false, seriesStyles: { Значение: { showMarker: markers, markerSize: 14 }, Другой: { showMarker: markers, markerSize: 14 } } })
    }, scenario)
    const canvas = page.locator('#chart-audit-host .chart-canvas-shell')
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    const svg = canvas.locator('.chart-canvas svg').first()
    const labels = await svg.locator('text').allTextContents()
    const markersBefore = await svg.evaluate((element) => [...element.querySelectorAll<SVGGeometryElement>('path,circle')].filter((shape) => {
      const box = shape.getBoundingClientRect()
      return Math.abs(box.width - 14) < 1 && Math.abs(box.height - 14) < 1
    }).length)
    if (scenario.kind === 'line') expect(markersBefore > 0).toBe(scenario.markers)
    const point = await svg.evaluate((element, kind) => {
      for (const shape of element.querySelectorAll<SVGGeometryElement>('path,circle')) {
        if (shape.closest('defs') || Number(shape.getAttribute('opacity') ?? 1) === 0) continue
        if (kind === 'line' && shape.tagName === 'path' && shape.getAttribute('stroke')?.startsWith('#') && Number(shape.getAttribute('stroke-width')) >= 2 && shape.getTotalLength() > 100) {
          const point = shape.getPointAtLength(0).matrixTransform(shape.getScreenCTM()!)
          return { x: point.x + 3, y: point.y + 3 }
        }
        const color = shape.getAttribute('fill'), box = shape.getBoundingClientRect()
        if (kind !== 'line' && color?.startsWith('#') && !['#fff', '#ffffff', '#000', '#202027', '#d9d7df'].includes(color) && box.width > 4 && box.width < 100 && box.height > 4 && box.height < 100) return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      }
      return null
    }, scenario.kind)
    expect(point).not.toBeNull()
    await page.mouse.click(point!.x, point!.y)
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    await page.mouse.click(point!.x, point!.y)
    await expect(canvas.locator('.chart-point-selection')).toBeVisible()
    await expect(page.locator('.chart-tooltip').first()).toBeHidden()
    await page.mouse.move(0, 0)
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    expect(await svg.locator('text').allTextContents()).toEqual(labels)
    if (scenario.kind === 'line') expect(await svg.evaluate((element) => [...element.querySelectorAll<SVGGeometryElement>('path,circle')].filter((shape) => {
      const box = shape.getBoundingClientRect()
      return Math.abs(box.width - 14) < 1 && Math.abs(box.height - 14) < 1
    }).length)).toBe(markersBefore)
    const framePath = await canvas.locator('.chart-point-selection path').last().getAttribute('d')
    await canvas.screenshot({ path: `output/point-selection-${scenario.kind}-${scenario.markers}.png` })
    const download = page.waitForEvent('download')
    await page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).exportSvg())
    const exported = await readFile((await (await download).path())!, 'utf8')
    expect(exported).not.toContain(framePath!)
    await page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).resetSelection())
    await expect(canvas.locator('.chart-point-selection')).toHaveCount(0)
    expect(errors).toEqual([])
  })
}
