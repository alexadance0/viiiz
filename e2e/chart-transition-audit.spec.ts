import { test, expect } from '@playwright/test'
import { writeFileSync } from 'node:fs'

test('attribute chart picker runtime errors to the selected chart', async ({ page }) => {
  test.skip(process.env.CHART_AUDIT !== '1')
  test.setTimeout(120_000)
  const errors: Array<{ chart: string; message: string }> = [], states: unknown[] = []
  let selected = 'initial'
  page.on('console', (message) => { if (message.type() === 'error') errors.push({ chart: selected, message: message.text() }) })
  page.on('pageerror', (error) => errors.push({ chart: selected, message: error.message }))
  await page.goto('/editor')
  await page.getByRole('button', { name: /^Временной ряд$/ }).click()
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  const names = await page.locator('.chart-choice-grid button b').allTextContents()
  for (const name of names) {
    selected = name
    const before = errors.length
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const button = page.locator('.chart-choice-grid button').filter({ has: page.locator('b').filter({ hasText: new RegExp(`^${escaped}$`) }) })
    await button.scrollIntoViewIfNeeded()
    await button.click()
    const canvas = page.locator('.chart-canvas-shell')
    await expect.poll(() => canvas.getAttribute('data-render-status')).toMatch(/^(settled|error)$/)
    states.push({ name, status: await canvas.getAttribute('data-render-status'), kind: await canvas.getAttribute('data-chart-kind'), errors: errors.slice(before) })
  }
  writeFileSync('output/chart-audit-2026-10-03/picker-transitions.json', JSON.stringify({ states, errors }, null, 2))
  expect(errors).toEqual([])
})
