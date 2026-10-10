import { test, expect } from '@playwright/test'

test('stream tooltip presents aligned values, colors and units at readable screen size', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/editor')
  await page.getByRole('button', { name: 'Музыка в США · 1973–2025', exact: true }).click()
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  await page.getByRole('button', { name: /Настроить оформление/ }).click()
  const canvas = page.locator('.chart-canvas-shell[data-chart-kind="stream-graph"]')
  await expect(canvas).toHaveAttribute('data-render-status', 'settled')
  await page.mouse.move(0, 0)
  const before = (await canvas.locator('svg text').filter({ hasText: /^2015$/ }).boundingBox())!
  const after = (await canvas.locator('svg text').filter({ hasText: /^2020$/ }).boundingBox())!
  const x = before.x + before.width / 2 + (after.x + after.width / 2 - before.x - before.width / 2) * .4
  const y = await canvas.locator('svg path:not([transform])[fill="#c65356"]').first().evaluate((element, x) => {
    const path = element as SVGGeometryElement, bounds = path.getBoundingClientRect(), inverse = path.getScreenCTM()!.inverse()
    const inside: number[] = []
    for (let y = bounds.top; y <= bounds.bottom; y += 1) if (path.isPointInFill(new DOMPoint(x, y).matrixTransform(inverse))) inside.push(y)
    return inside[Math.floor(inside.length / 2)]
  }, x)
  expect(y).toBeDefined()
  await page.mouse.move(x, y)
  const tooltip = page.locator('.chart-tooltip:visible .chart-tooltip-content')
  await expect(tooltip).toBeVisible()
  await expect(tooltip.locator('.chart-tooltip-header strong')).toHaveText('2017')
  await expect(tooltip.locator('.chart-tooltip-row')).toHaveCount(7)
  await expect(tooltip.locator('.chart-tooltip-unit')).toHaveText('млрд $')
  expect((await tooltip.innerText()).match(/млрд \$/g)).toHaveLength(1)
  await expect(tooltip.locator('[data-series="Загрузки"]')).toHaveAttribute('data-active', 'true')
  await expect(tooltip.locator('[data-series="Загрузки"] .chart-tooltip-swatch')).toHaveCSS('background-color', 'rgb(198, 83, 86)')
  await expect(tooltip.locator('.chart-tooltip-value').first()).toHaveCSS('text-align', 'right')
  await expect(page.locator('.chart-tooltip:visible')).toHaveCSS('font-size', '10.5px')
  expect(await tooltip.evaluate((element) => element.closest('.chart-canvas-shell') === null)).toBe(true)
  const size = (await tooltip.boundingBox())!
  expect(size.width).toBeLessThan(175)
  expect(size.height).toBeLessThan(165)
  await page.screenshot({ path: '/tmp/viiiz-stream-tooltip.png' })
  await page.mouse.move(0, 0)
  await expect(tooltip).not.toBeVisible()
  expect(errors).toEqual([])
})
