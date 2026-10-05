import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('Russia turnout example: data review, map preview and export', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/editor')
  await page.getByRole('button', { name: 'Явка на выборах в Госдуму (2026)', exact: true }).click()
  await expect(page.locator('.review-table')).toBeVisible()
  await expect(page.locator('.settings-panel')).toHaveCount(0)
  await expect(page.locator('.review-table')).toContainText('Чечня')
  await expect(page.locator('.review-table')).not.toContainText('rank_high_to_low')
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  await expect(page.getByRole('combobox', { name: 'Регион', exact: true })).toHaveValue('Регион')
  await page.getByRole('button', { name: 'Настроить оформление →' }).click()
  const canvas = page.locator('.chart-canvas-shell')
  await expect(canvas).toHaveAttribute('data-render-status', 'settled')
  await expect(page.locator('.chart-error')).toHaveCount(0)
  for (const text of ['Явка на выборах в Госдуму', '(2026)', 'Доля проголосовавших избирателей', 'Источник: ЦИК', 'Данные на 20 сентября']) {
    await expect(canvas.locator('svg text').filter({ hasText: text }).first()).toBeVisible()
  }
  await canvas.screenshot({ path: '/tmp/viiiz-russia-turnout.png' })
  await page.locator('.export-menu > summary').click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать SVG', exact: true }).click()
  const svg = await readFile((await (await download).path())!, 'utf8')
  expect(svg).toContain('Явка на выборах в Госдуму')
  expect(svg).toContain('Источник: ЦИК')
  expect(svg).toContain('Данные на 20 сентября')
})
