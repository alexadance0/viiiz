import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('US birthplace example: review, map preview and SVG export', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/editor')
  await page.getByRole('button', { name: 'Родившиеся в своём штате — США, 2024', exact: true }).click()
  await expect(page.locator('.review-table')).toBeVisible()
  await expect(page.locator('.settings-panel')).toHaveCount(0)
  await expect(page.locator('.review-table')).toContainText('Алабама')
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  await expect(page.getByRole('combobox', { name: 'Штат', exact: true })).toHaveValue('Штат')
  await page.getByRole('button', { name: 'Настроить оформление →' }).click()
  const canvas = page.locator('.chart-canvas-shell')
  await expect(canvas).toHaveAttribute('data-render-status', 'settled')
  await expect(page.locator('.chart-error')).toHaveCount(0)
  for (const text of ['Где родился, там и пригодился', 'Доля жителей каждого штата США', 'Источник: U.S. Census Bureau']) {
    await expect(canvas.locator('svg text').filter({ hasText: text }).first()).toBeVisible()
  }
  await canvas.screenshot({ path: '/tmp/viiiz-us-born-in-same-state.png' })
  await page.locator('.export-menu > summary').click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать SVG', exact: true }).click()
  const svg = await readFile((await (await download).path())!, 'utf8')
  expect(svg).toContain('Где родился, там и пригодился')
  expect(svg).toContain('Источник: U.S. Census Bureau')
})
