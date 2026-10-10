import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

async function exportFile(page: Page, format: 'SVG' | 'PNG') {
  await page.locator('.export-menu > summary').click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: `Скачать ${format}`, exact: true }).click()
  const file = await readFile((await (await download).path())!)
  await page.locator('.export-menu > summary').click()
  return file
}
async function upload(page: Page, csv: string) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/editor')
  await page.locator('.upload-card input').setInputFiles({ name: 'categories.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await page.getByRole('button', { name: /Выбрать график/ }).click()
}

test('bar colors use a separate category or numeric field, ordered legend and exported missing-data hatching', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await upload(page, 'Country,Value,Group,Ratio\nA,20,High,0\nB,30,Low,2\nC,40,High,4\nD,50,,')
  await page.getByRole('button', { name: 'Настроить оформление →' }).click()
  const canvas = page.locator('.stage .chart-canvas-shell')
  await expect(canvas).toHaveAttribute('data-render-status', 'settled')
  const heights = () => canvas.locator('svg path').evaluateAll((nodes) => nodes.filter((node) => {
    const box = (node as SVGGraphicsElement).getBBox()
    return !node.closest('defs') && node.getAttribute('fill')?.startsWith('#') && box.width > 20 && box.height > 20
  }).map((node) => (node as SVGGraphicsElement).getBBox().height).sort((a, b) => a - b))
  const before = await heights()
  const settings = page.locator('.color-encoding-settings')
  if (!(await settings.evaluate((node) => node.hasAttribute('open')))) await settings.locator('summary').click()
  await settings.getByRole('combobox', { name: 'Способ окраски', exact: true }).selectOption('categories')
  await settings.getByRole('combobox', { name: 'Категория цвета', exact: true }).selectOption('Group')
  await expect(canvas.locator('svg text').filter({ hasText: /^High$/ })).toHaveCount(1)
  await expect(canvas.locator('svg text').filter({ hasText: /^Low$/ })).toHaveCount(1)
  await expect(canvas.locator('svg text').filter({ hasText: /^Нет данных$/ })).toHaveCount(1)
  await settings.getByRole('button', { name: 'Поднять категорию Low', exact: true }).click()
  await settings.getByRole('textbox', { name: 'Подпись категории Low', exact: true }).fill('Низкий доход')
  await expect(canvas.locator('svg text').filter({ hasText: /^Низкий доход$/ })).toBeVisible()
  await expect(canvas).toHaveAttribute('data-render-status', 'settled')
  await canvas.screenshot({ path: '/tmp/viiiz-categorical-bars.png' })
  // Adding a legend changes plot height, but preserves the ratios of the data.
  const after = await heights()
  expect(after).toHaveLength(before.length)
  for (let i = 1; i < after.length; i++) expect(after[i] / after[0]).toBeCloseTo(before[i] / before[0], 2)
  const svg = (await exportFile(page, 'SVG')).toString()
  expect(svg).toContain('Низкий доход')
  expect(svg).toContain('<pattern')
  expect((await exportFile(page, 'PNG')).subarray(1, 4).toString()).toBe('PNG')
  await settings.getByRole('combobox', { name: 'Способ окраски', exact: true }).selectOption('bins')
  await settings.getByRole('combobox', { name: 'Показатель для цвета', exact: true }).selectOption('Ratio')
  await settings.getByRole('textbox', { name: 'Границы интервалов', exact: true }).fill('0; 2; 4')
  await settings.getByRole('textbox', { name: 'Границы интервалов', exact: true }).press('Tab')
  await expect(settings.locator('.color-bin-row')).toHaveCount(4)
  await settings.getByRole('textbox', { name: 'Подпись интервала 2', exact: true }).fill('От нуля до двух')
  await expect(canvas.locator('svg text').filter({ hasText: /^От нуля до двух$/ })).toBeVisible()
  await expect(canvas.locator('svg text').filter({ hasText: /^Нет данных$/ })).toHaveCount(1)
  await settings.getByRole('textbox', { name: 'Границы интервалов', exact: true }).fill('4; 2')
  await settings.getByRole('textbox', { name: 'Границы интервалов', exact: true }).press('Tab')
  await expect(settings.getByRole('alert')).toContainText('по возрастанию')
  await expect(settings.locator('.color-bin-row')).toHaveCount(4)
  expect(errors).toEqual([])
})

test('categorical world maps work without a numeric measure and preserve missing regions in SVG and PNG', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await upload(page, 'Country,Group\nUS,High\nFR,Low\nJP,High')
  await page.getByRole('button', { name: 'Карта мира', exact: true }).click()
  await page.getByRole('combobox', { name: 'Окраска карты', exact: true }).selectOption('categories')
  await page.getByRole('combobox', { name: 'Категория цвета', exact: true }).selectOption('Group')
  await page.getByRole('button', { name: 'Настроить оформление →' }).click()
  const canvas = page.locator('.chart-canvas-shell[data-plot-kind="map"]')
  await expect(canvas).toHaveAttribute('data-render-status', 'settled')
  await expect(canvas.locator('svg text').filter({ hasText: /^High$/ })).toHaveCount(1)
  await expect(canvas.locator('svg text').filter({ hasText: /^Low$/ })).toHaveCount(1)
  await expect(canvas.locator('svg text').filter({ hasText: /^Нет данных$/ })).toHaveCount(1)
  await canvas.screenshot({ path: '/tmp/viiiz-categorical-world-map.png' })
  const svg = (await exportFile(page, 'SVG')).toString()
  expect(svg).toContain('<pattern')
  expect(svg).toContain('High')
  expect(svg).toContain('Low')
  expect((await exportFile(page, 'PNG')).subarray(1, 4).toString()).toBe('PNG')
  expect(errors).toEqual([])
})
