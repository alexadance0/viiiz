import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('Putin visits to Europe example: review, map preview and SVG export', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/editor')
  await page.getByRole('button', { name: 'Визиты Путина в Европу — 2000–2026', exact: true }).click()
  await expect(page.locator('.review-table')).toBeVisible()
  await expect(page.locator('.settings-panel')).toHaveCount(0)
  await expect(page.locator('.review-table')).toContainText('Бельгия')
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  await expect(page.getByRole('combobox', { name: 'Страна', exact: true })).toHaveValue('Страна')
  await page.getByRole('button', { name: 'Настроить оформление →' }).click()
  const canvas = page.locator('.chart-canvas-shell')
  await expect(canvas).toHaveAttribute('data-render-status', 'settled')
  await expect(page.locator('.chart-error')).toHaveCount(0)
  for (const text of ['Визиты Путина в страны Европы', 'Число президентских визитов', '7 мая 2000 — сентябрь 2026', 'Поездки в должности премьер-министра', 'Источник: Wikipedia']) {
    await expect(canvas.locator('svg text').filter({ hasText: text }).first()).toBeVisible()
  }
  await canvas.screenshot({ path: '/tmp/viiiz-putin-visits-europe.png' })
  await page.locator('.export-menu > summary').click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать SVG', exact: true }).click()
  const svg = await readFile((await (await download).path())!, 'utf8')
  expect(svg).toContain('Визиты Путина в страны Европы')
  expect(svg).toContain('Источник: Wikipedia')
  expect(svg).toContain('2008–2012')
})
