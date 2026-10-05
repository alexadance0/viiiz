import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('AI example: data review, calendar X, logarithmic Y and SVG export', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/editor')
  await expect(page.getByRole('button', { name: 'Возраст шин и время круга — Монца, 2026', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Вычисления для обучения ИИ — 1950–2026', exact: true }).click()
  await expect(page.locator('.review-table')).toBeVisible()
  await expect(page.locator('.settings-panel')).toHaveCount(0)
  await expect(page.locator('.review-table')).toContainText('Система')
  await expect(page.locator('.review-table')).toContainText('Дата публикации')
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  await page.getByRole('button', { name: 'Настроить оформление →' }).click()
  const canvas = page.locator('.chart-canvas-shell')
  await expect(canvas).toHaveAttribute('data-render-status', 'settled')
  await expect(page.locator('.chart-error')).toHaveCount(0)
  for (const text of ['Как росли вычисления для обучения ИИ', 'Дата публикации', 'Вычисления, петаFLOP', 'Источник: Epoch AI, Our World in Data']) {
    await expect(canvas.locator('svg text').filter({ hasText: text }).first()).toBeVisible()
  }
  await expect(canvas.locator('svg text').filter({ hasText: /^1E-\d+$/ }).first()).toBeVisible()
  await expect(canvas.locator('svg text').filter({ hasText: /^2000$/ })).toBeVisible()
  await canvas.screenshot({ path: '/tmp/viiiz-ai-compute-scatter.png' })
  await page.locator('.export-menu > summary').click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать SVG', exact: true }).click()
  const svg = await readFile((await (await download).path())!, 'utf8')
  expect(svg).toContain('Как росли вычисления для обучения ИИ')
  expect(svg).toContain('Источник: Epoch AI, Our World in Data')
  expect(svg).toMatch(/1E-\d+/)
})
