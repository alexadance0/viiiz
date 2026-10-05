import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('F1 constructors: supplied places, team colors, labels and SVG export', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/editor')
  await page.getByRole('button', { name: 'Места команд в Кубке конструкторов F1 — 2021–2025', exact: true }).click()
  await expect(page.locator('.review-table')).toBeVisible()
  await expect(page.locator('.settings-panel')).toHaveCount(0)
  await expect(page.locator('.review-table')).toContainText('McLaren')
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  await expect(page.getByRole('combobox', { name: 'Данные рейтинга', exact: true })).toHaveValue('rank')
  await page.getByRole('button', { name: 'Настроить оформление →' }).click()
  const canvas = page.locator('.chart-canvas-shell')
  await expect(canvas).toHaveAttribute('data-render-status', 'settled')
  await expect(page.locator('.chart-error')).toHaveCount(0)
  for (const text of ['Борьба за Кубок конструкторов', 'McLaren', 'Mercedes', 'Red Bull', 'Ferrari', 'Sauber', 'Источник: Formula 1']) {
    await expect(canvas.locator('svg text').filter({ hasText: text }).first()).toBeVisible()
  }
  await expect(canvas.locator('svg text').filter({ hasText: /^McLaren$/ })).toHaveCount(1)
  await canvas.screenshot({ path: '/tmp/viiiz-f1-constructors.png' })
  await page.locator('.export-menu > summary').click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать SVG', exact: true }).click()
  const svg = await readFile((await (await download).path())!, 'utf8')
  expect(svg).toContain('Источник: Formula 1')
  expect(svg.toLowerCase()).toContain('#ff8000')
  expect(svg.toLowerCase()).toContain('#e8002d')
})
