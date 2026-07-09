import { expect, test, type Page } from '@playwright/test'

const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

async function failOnRuntimeErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning' && message.text().includes("Can't get DOM width or height")) errors.push(message.text())
  })
  return () => expect(errors).toEqual([])
}

async function loadDemo(page: Page) {
  await page.goto('/editor')
  await page.getByRole('button', { name: /Демо временного ряда/ }).click()
  await expect(page.getByRole('heading', { name: 'Проверьте данные' })).toBeVisible()
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  await expect(page.getByRole('heading', { name: 'Тип графика' })).toBeVisible()
}

async function expectRenderedChart(page: Page) {
  const svg = page.locator('.canvas-paper svg').first()
  await expect(svg).toBeVisible()
  const box = await svg.boundingBox()
  expect(box?.width).toBeGreaterThan(200)
  expect(box?.height).toBeGreaterThan(150)
}

test('editor opens demo data, renders charts and exposes export actions', async ({ page }) => {
  const assertNoErrors = await failOnRuntimeErrors(page)
  await loadDemo(page)

  await page.getByRole('button', { name: /^Столбцы$/ }).click()
  await expect(page.getByRole('button', { name: 'Скачать PNG' })).toBeVisible()
  await expectRenderedChart(page)

  await page.getByRole('button', { name: /^SVG$/ }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать PNG' }).click()
  await expect((await download).suggestedFilename()).toMatch(/\.png$/)

  assertNoErrors()
})

test('every chart type in the picker renders without runtime errors', async ({ page }) => {
  const assertNoErrors = await failOnRuntimeErrors(page)
  await loadDemo(page)

  const chartNames = await page.locator('.chart-choice-grid button b').allTextContents()
  for (const name of chartNames) {
    if (!await page.locator('.chart-picker').isVisible()) await page.getByRole('button', { name: '← Тип графика' }).click()
    const button = page.locator('.chart-choice-grid button').filter({ has: page.locator('b').filter({ hasText: new RegExp(`^${escaped(name)}$`) }) })
    await button.scrollIntoViewIfNeeded()
    await button.click()
    await expectRenderedChart(page)
  }

  assertNoErrors()
})

test('scatter and bubble defaults keep axis/grid controls available on the editor canvas', async ({ page }) => {
  const assertNoErrors = await failOnRuntimeErrors(page)
  await loadDemo(page)

  await page.getByRole('button', { name: 'Точечный' }).click()
  await expectRenderedChart(page)
  await expect(page.getByRole('button', { name: 'Скачать PNG' })).toBeVisible()

  await page.getByRole('button', { name: '← Тип графика' }).click()
  await page.getByRole('button', { name: 'Пузырьковая диаграмма' }).click()
  await expectRenderedChart(page)
  await page.locator('summary').filter({ hasText: /^Точки и зависимости$/ }).click()
  await expect(page.getByText('Заголовки осей')).toBeVisible()

  assertNoErrors()
})

test('chart choice and design inspector stay focused and keyboard accessible', async ({ page }) => {
  await loadDemo(page)
  await expect(page.locator('.chart-picker')).toBeVisible()
  await expect(page.locator('.settings-panel')).toBeHidden()

  await page.getByRole('button', { name: /^Линия$/ }).click()
  await expect(page.locator('.chart-picker')).toBeHidden()
  await expect(page.locator('.settings-panel')).toBeVisible()

  const markers = page.getByRole('checkbox', { name: 'Показывать маркеры' })
  await markers.focus()
  await page.keyboard.press('Space')
  await expect(markers).toBeChecked()
  await expect(markers).toBeFocused()
})

test('mobile chart choice keeps the preview before the long chart catalogue', async ({ page }) => {
  const assertNoErrors = await failOnRuntimeErrors(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await loadDemo(page)
  await expect(page.locator('.chart-picker')).toBeVisible()
  await expect(page.locator('.stage')).toBeVisible()
  const preview = await page.locator('.stage').boundingBox()
  const firstCategory = await page.locator('.chart-category').first().boundingBox()
  expect(preview?.y).toBeLessThan(firstCategory?.y ?? Infinity)

  await page.getByRole('button', { name: /^Линия$/ }).click()
  await expect(page.locator('.stage')).toBeVisible()
  await expect(page.locator('.settings-panel')).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  assertNoErrors()
})
