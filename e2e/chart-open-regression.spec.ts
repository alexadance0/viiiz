import { test, expect } from '@playwright/test'

test('editor opens a chart without ECharts module errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(process.env.CHART_TEST_URL ?? '/editor')
  await page.getByRole('button', { name: /^Временной ряд$/ }).click()
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  const canvas = page.locator('.chart-canvas-shell')
  await expect(canvas).toHaveAttribute('data-render-status', 'settled')
  expect(errors).toEqual([])
})
