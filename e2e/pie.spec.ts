import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const csv = 'Категория,Значение\nОбразование,45\nЗдоровье,30\nКультура,15\nСпорт,10'
const settled = async (page: import('@playwright/test').Page) => {
  await expect(page.locator('.chart-canvas-shell').first()).toHaveAttribute('data-render-status', 'settled')
  await expect(page.locator('.chart-error')).toHaveCount(0)
}

test('donut settings have no floating footer and keep stage navigation available while scrolling', async ({ page }) => {
  await page.goto('/editor')
  await page.locator('.upload-card input').setInputFiles({ name: 'shares.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  await page.getByRole('button', { name: 'Кольцевая', exact: true }).click()
  await page.getByRole('button', { name: 'Настроить оформление →' }).click()
  const settings = page.locator('details').filter({ has: page.getByText('Секторы и подписи', { exact: true }) })
  if (!(await settings.evaluate((element) => element.hasAttribute('open')))) await settings.locator(':scope > summary').click()
  await page.getByRole('combobox', { name: 'Положение подписей' }).selectOption('inside')
  await page.getByText('Название категории в подписи', { exact: true }).click()
  const panel = page.locator('.settings-panel')
  const navigation = page.getByRole('navigation', { name: 'Этапы создания графика' })
  const checkNavigation = async () => {
    await expect(panel.locator('.settings-footer')).toHaveCount(0)
    await expect(navigation.getByRole('button', { name: /Тип графика/ })).toBeVisible()
    await expect(navigation.getByRole('button', { name: /Проверка данных/ })).toBeVisible()
  }
  for (const height of [540, 600, 660, 720, 810, 900, 1080]) {
    await page.setViewportSize({ width: 1280, height })
    for (const scrollTop of [0, 150, 10000, 0]) {
      await panel.evaluate((element, top) => { element.scrollTop = top }, scrollTop)
      await checkNavigation()
      await expect.poll(() => panel.evaluate((element) => {
        const shell = element.querySelector('.settings-category-shell')!
        const settings = shell.querySelector('.visual-settings')!
        return settings.getBoundingClientRect().bottom - shell.getBoundingClientRect().bottom
      })).toBeLessThanOrEqual(1)
    }
  }
  await page.getByText('Стиль подписей', { exact: true }).click()
  await checkNavigation()
  await page.getByRole('tab', { name: 'Текст', exact: true }).click()
  await checkNavigation()
  await navigation.getByRole('button', { name: /Тип графика/ }).click()
  await expect(page.getByRole('heading', { name: 'Тип графика', exact: true })).toBeVisible()
  await navigation.getByRole('button', { name: /Проверка данных/ }).click()
  await expect(page.locator('.review-table')).toBeVisible()
})

test('pie and donut support category colors, labels, sector selection and SVG/PNG export', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/editor')
  await page.locator('.upload-card input').setInputFiles({ name: 'shares.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  await page.getByRole('button', { name: 'Круговая', exact: true }).click()
  await settled(page)
  await page.waitForTimeout(300)
  await page.screenshot({ path: '/tmp/viiiz-pie-outside.png', fullPage: true })
  await expect(page.locator('.chart-canvas svg text').filter({ hasText: /^45%$/ })).toHaveCount(1)
  await expect(page.locator('.chart-canvas svg path[fill="#9e0142"]')).toHaveCount(1) // sector; legend is off by default
  await page.getByRole('button', { name: 'Настроить оформление →' }).click()
  await expect(page.getByRole('tab', { name: 'Оси и шкалы', exact: true })).toHaveCount(0)
  await expect(page.locator('.series-style-list')).toContainText('Образование')
  const sector = page.locator('.chart-canvas svg path[fill="#9e0142"]').first()
  // Pick an interior point in the first sector, whose bounding box includes the center.
  const bounds = await page.locator('.chart-canvas svg').boundingBox()
  if (!bounds) throw new Error('No SVG')
  const geometry = await sector.evaluate((path) => ({ d: path.getAttribute('d'), bounds: path.getBoundingClientRect().toJSON() }))
  expect(geometry.d).toContain('A')
  await sector.click({ position: { x: geometry.bounds.width * .7, y: geometry.bounds.height * .4 } })
  await expect(page.locator('.element-editor')).toContainText('Образование')
  await page.getByRole('button', { name: 'Снять выделение', exact: true }).click()
  const sliceSettings = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: 'Секторы и подписи' }) })
  if (!(await sliceSettings.evaluate((details) => details.hasAttribute('open')))) await sliceSettings.locator(':scope > summary').click()
  await page.getByRole('combobox', { name: 'Положение подписей' }).selectOption('inside')
  await settled(page)
  await page.screenshot({ path: '/tmp/viiiz-pie-editor.png', fullPage: true })
  await page.locator('.export-menu > summary').click()
  const svgDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать SVG' }).click()
  const svg = await readFile((await (await svgDownload).path())!, 'utf8')
  expect(svg).toContain('45%')
  expect(svg).toContain('#9e0142')
  const pngDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать PNG' }).click()
  const png = await readFile((await (await pngDownload).path())!)
  expect(png.subarray(1, 4).toString()).toBe('PNG')
  await page.locator('.export-menu > summary').click()
  await page.getByRole('navigation', { name: 'Этапы создания графика' }).getByRole('button', { name: /Тип графика/ }).click()
  await page.getByRole('button', { name: 'Кольцевая', exact: true }).click()
  await page.getByRole('button', { name: 'Настроить оформление →' }).click()
  if (!(await sliceSettings.evaluate((details) => details.hasAttribute('open')))) await sliceSettings.locator(':scope > summary').click()
  await page.getByRole('spinbutton', { name: 'Размер отверстия, %' }).fill('70')
  await page.getByRole('spinbutton', { name: 'Размер отверстия, %' }).press('Tab')
  await settled(page)
  const donutPath = await page.locator('.chart-canvas svg path[fill="#9e0142"]').first().getAttribute('d')
  expect((donutPath?.match(/A/g) ?? []).length).toBe(2)
  await page.screenshot({ path: '/tmp/viiiz-donut-editor.png', fullPage: true })
  await page.getByRole('tab', { name: 'Текст', exact: true }).click()
  await page.getByText('Общий стиль текста', { exact: true }).click()
  await page.getByRole('combobox', { name: 'Шрифт всех надписей', exact: true }).selectOption({ label: 'Georgia' })
  await expect.poll(() => page.locator('.chart-canvas svg text').evaluateAll((texts) => texts.filter((text) => text.textContent?.trim()).every((text) => text.getAttribute('style')?.includes('Georgia') || text.getAttribute('font-family')?.includes('Georgia')))).toBe(true)
  expect(errors).toEqual([])
})

test('pie and donut render and export together in multiples', async ({ page }) => {
  await page.goto('/editor')
  await page.locator('.upload-card input').setInputFiles({ name: 'shares.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  await page.getByRole('button', { name: 'Сетка графиков', exact: true }).click()
  await page.getByRole('button', { name: 'Добавить график в ячейку 1' }).click()
  await page.getByRole('button', { name: 'Круговая', exact: true }).click()
  await page.getByRole('button', { name: 'Добавить график в ячейку 2' }).click()
  await page.getByRole('button', { name: 'Кольцевая', exact: true }).click()
  await page.getByRole('button', { name: 'Настроить оформление →' }).click()
  await expect(page.locator('.multiples-cell .chart-canvas-shell[data-plot-kind="pie"][data-render-status="settled"]')).toHaveCount(2)
  await expect(page.locator('.multiples-cell svg text').filter({ hasText: /^45%$/ })).toHaveCount(2)
  await page.screenshot({ path: '/tmp/viiiz-pie-multiples.png', fullPage: true })
  await page.locator('.export-menu > summary').click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать SVG' }).click()
  const content = await readFile((await (await download).path())!, 'utf8')
  expect((content.match(/45%/g) ?? []).length).toBe(2)
})

for (const [label, kind] of [['Круговая', 'pie'], ['Кольцевая', 'donut']] as const) {
  test(`${kind} keeps labels for every small sector inside and in SVG export`, async ({ page }) => {
    await page.goto('/editor')
    const data = 'Категория,Значение\nОсновная,91\n' + Array.from({ length: 9 }, (_, index) => `Категория ${index + 1},1`).join('\n')
    await page.locator('.upload-card input').setInputFiles({ name: 'small-shares.csv', mimeType: 'text/csv', buffer: Buffer.from(data) })
    await page.getByRole('button', { name: /Выбрать график/ }).click()
    await page.getByRole('button', { name: label, exact: true }).click()
    await page.getByRole('button', { name: 'Настроить оформление →' }).click()
    const details = page.locator('details').filter({ has: page.getByText('Секторы и подписи', { exact: true }) })
    if (!(await details.evaluate((element) => element.hasAttribute('open')))) await details.locator(':scope > summary').click()
    await page.getByRole('combobox', { name: 'Положение подписей' }).selectOption('inside')
    await page.getByText('Название категории в подписи', { exact: true }).click()
    await expect(page.locator('.chart-canvas svg text').filter({ hasText: /^\d+(?:,\d+)?%$/ })).toHaveCount(10)
    await page.locator('.export-menu > summary').click()
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Скачать SVG' }).click()
    const svg = await readFile((await (await download).path())!, 'utf8')
    expect((svg.match(/>1%<\/text>/g) ?? []).length).toBe(9)
  })
}
