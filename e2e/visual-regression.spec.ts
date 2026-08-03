import { expect, test, type Locator, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test.use({ viewport: { width: 1600, height: 1200 }, colorScheme: 'light', reducedMotion: 'reduce' })

const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const setCheckbox = async (checkbox: Locator, selected: boolean) => {
  if (await checkbox.isChecked() !== selected) await checkbox.press('Space')
}

const waitForLayout = async (page: Page) => {
  await page.evaluate(() => document.fonts.ready)
  await expect(page.locator('.chart-canvas-shell')).toHaveAttribute('data-layout-ready', 'true')
  await expect(page.locator('.chart-canvas svg')).toBeVisible()
  await expect(page.locator('.chart-canvas-shell')).toContainText('Источник:')
}

const openDemoChart = async (page: Page, demo: string, chart?: string) => {
  await page.goto('/editor')
  await page.getByRole('button', { name: demo, exact: true }).click()
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  if (chart) await page.locator('.chart-choice-grid button').filter({ has: page.locator('b').filter({ hasText: new RegExp(`^${escaped(chart)}$`) }) }).click()
  await waitForLayout(page)
}

const openDesign = async (page: Page) => {
  await page.getByRole('button', { name: /Настроить оформление/ }).click()
  await waitForLayout(page)
}

const openSettings = async (page: Page, name: string) => {
  const summary = page.locator('summary').filter({ hasText: new RegExp(`^${name}$`) })
  if (!(await summary.evaluate((element) => (element.parentElement as HTMLDetailsElement).open))) await summary.click()
}

test('Seasonal legend semantics stay visually stable', async ({ page }) => {
  await page.goto('/editor')
  await page.getByRole('button', { name: 'Временной ряд', exact: true }).click()
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  await page.getByLabel('Период / ось X').selectOption('month')
  await page.locator('.chart-choice-grid button').filter({ has: page.locator('b').filter({ hasText: /^Сравнение по годам$/ }) }).click()
  await waitForLayout(page)
  await openDesign(page)
  await openSettings(page, 'Легенда')

  const canvas = page.locator('.chart-canvas-shell')
  await page.getByText('Без легенды', { exact: true }).click()
  await expect(canvas).toHaveScreenshot('seasonal-none-accent.png')

  await page.getByText('Обычная', { exact: true }).click()
  await expect(page.locator('.chart-canvas svg text').filter({ hasText: /^Остальные$/ })).toBeVisible()
  await expect(canvas).toHaveScreenshot('seasonal-standard-one-accent.png')

  await openSettings(page, 'Сравнение по годам')
  await setCheckbox(page.locator('.line-variant-settings').getByRole('checkbox', { name: '2023', exact: true }), true)
  await expect(canvas).toHaveScreenshot('seasonal-standard-two-accents.png')

  await openSettings(page, 'Легенда')
  const standardCards = page.locator('.legend-settings .legend-options:not(.direct-legend-options) .series-label-card')
  await standardCards.last().getByLabel('Подпись').fill('Предыдущие периоды')
  await expect(page.locator('.chart-canvas svg text').filter({ hasText: /^Предыдущие периоды$/ })).toBeVisible()
  await expect(canvas).toHaveScreenshot('seasonal-standard-renamed-others.png')

  await setCheckbox(standardCards.last().getByRole('checkbox'), false)
  await expect(page.locator('.chart-canvas svg text').filter({ hasText: /^Предыдущие периоды$/ })).toHaveCount(0)
  await expect(canvas).toHaveScreenshot('seasonal-standard-hidden-others.png')

  await openSettings(page, 'Сравнение по годам')
  await setCheckbox(page.locator('.line-variant-settings').getByRole('checkbox', { name: '2023', exact: true }), false)
  await openSettings(page, 'Легенда')
  await page.getByText('Справа у рядов', { exact: true }).click()
  await expect(canvas).toHaveScreenshot('seasonal-direct-accent.png')

  const directCards = page.locator('.direct-legend-options .series-label-card')
  await setCheckbox(directCards.filter({ has: page.getByRole('checkbox', { name: '2023', exact: true }) }).getByRole('checkbox'), true)
  await expect(canvas).toHaveScreenshot('seasonal-direct-custom-series.png')
})

test('native Slope semantics stay visually stable', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/editor')
  await page.getByRole('button', { name: 'Временной ряд', exact: true }).click()
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  await page.getByLabel('Период / ось X').selectOption('month')
  await page.locator('.chart-choice-grid button').filter({ has: page.locator('b').filter({ hasText: /^Наклонный график$/ }) }).click()
  await waitForLayout(page)
  const canvas = page.locator('.chart-canvas-shell')
  await expect(canvas).toHaveScreenshot('slope-default.png')
  await expect(canvas).toHaveScreenshot('slope-endpoint-label-ownership.png')

  await openDesign(page)
  await openSettings(page, 'Наклонный график')
  const values = page.getByRole('checkbox', { name: 'Подписывать значения' })
  const names = page.getByRole('checkbox', { name: 'Подписывать названия рядов справа' })
  const scale = page.getByRole('checkbox', { name: 'Показывать подписи шкалы Y' })
  await setCheckbox(names, false)
  await expect(canvas).toHaveScreenshot('slope-values-only.png')
  await setCheckbox(values, false)
  await setCheckbox(names, true)
  await expect(canvas).toHaveScreenshot('slope-names-only.png')
  await setCheckbox(values, true)
  await setCheckbox(scale, true)
  await expect(canvas).toHaveScreenshot('slope-y-scale.png')

  await page.getByRole('button', { name: '← Тип графика' }).click()
  for (const measure of ['orders', 'profit', 'plan']) await setCheckbox(page.getByRole('checkbox', { name: measure, exact: true }), true)
  await page.locator('.chart-choice-grid button').filter({ has: page.locator('b').filter({ hasText: /^Наклонный график$/ }) }).click()
  await waitForLayout(page)
  await openDesign(page)
  await expect(canvas).toHaveScreenshot('slope-many-series-collision.png')
  await expect(canvas).toHaveScreenshot('slope-collision-leaders.png')

  await openSettings(page, 'Оси, шкалы и подписи')
  await page.getByLabel('Положение оси X').selectOption('top')
  await expect(canvas).toHaveScreenshot('slope-date-axis-top.png')
  await expect(canvas).toHaveScreenshot('slope-x-label-centered.png')

  await page.getByRole('button', { name: '← Тип графика' }).click()
  const positions = page.getByRole('group', { name: 'Позиции по оси X' }).getByRole('button')
  for (const index of [0, 35]) if (await positions.nth(index).getAttribute('aria-pressed') === 'true') await positions.nth(index).click()
  await positions.nth(3).click()
  await positions.nth(9).click()
  await page.locator('.chart-choice-grid button').filter({ has: page.locator('b').filter({ hasText: /^Наклонный график$/ }) }).click()
  await waitForLayout(page)
  await openDesign(page)
  await openSettings(page, 'Наклонный график')
  const slopeSettings = page.locator('.line-variant-settings')
  await setCheckbox(slopeSettings.getByRole('checkbox', { name: 'Показывать изменение' }), true)
  await setCheckbox(slopeSettings.getByRole('checkbox', { name: 'Цвет по направлению изменения' }), true)
  await expect(canvas).toHaveScreenshot('slope-change-increase-decrease.png')
  await expect(canvas).toHaveScreenshot('slope-change-neutral.png')
  await slopeSettings.locator('label').filter({ hasText: /^Формат/ }).locator('select').selectOption('percent')
  await slopeSettings.getByLabel('Знаков после запятой').fill('1')
  await expect(canvas).toHaveScreenshot('slope-change-percent.png')
  await slopeSettings.locator('label').filter({ hasText: /^Расположение/ }).locator('select').selectOption('end')
  await expect(canvas).toHaveScreenshot('slope-change-label-positions.png')
  await expect(canvas).toHaveScreenshot('slope-crossing-lines.png')

  await slopeSettings.getByRole('button', { name: 'Сбросить изменение' }).click()
  await page.getByRole('button', { name: '← Тип графика' }).click()
  const restoredPositions = page.getByRole('group', { name: 'Позиции по оси X' }).getByRole('button')
  for (const index of [3, 9]) if (await restoredPositions.nth(index).getAttribute('aria-pressed') === 'true') await restoredPositions.nth(index).click()
  await restoredPositions.nth(0).click()
  await restoredPositions.nth(35).click()
  await page.locator('.chart-choice-grid button').filter({ has: page.locator('b').filter({ hasText: /^Наклонный график$/ }) }).click()
  await waitForLayout(page)
  await openDesign(page)

  await openSettings(page, 'Ряды данных')
  await page.locator('.series-settings .series-name-button').filter({ hasText: /^revenue$/ }).click()
  const seriesEditor = page.locator('.series-editor')
  await expect(seriesEditor).toBeVisible()
  await seriesEditor.getByLabel('Толщина линии, px').fill('6')
  await seriesEditor.getByLabel('Тип линии').selectOption('dashed')
  await seriesEditor.getByLabel('Форма').selectOption('diamond')
  await seriesEditor.getByLabel('Размер, px').fill('16')
  await page.getByRole('button', { name: 'Снять выделение' }).click()
  await expect(canvas).toHaveScreenshot('slope-custom-series-styles.png')
})

test('critical chart-label layouts stay visually stable', async ({ page }) => {
  await openDemoChart(page, 'Топ стран', 'Столбцы')
  await setCheckbox(page.getByRole('checkbox', { name: 'place', exact: true }), true)
  await openDesign(page)
  await openSettings(page, 'Компоновка столбцов')
  await page.getByLabel('Ширина группы, %').fill('100')
  await page.getByLabel('Расстояние между рядами, %').fill('0')
  await openSettings(page, 'Легенда')
  await page.getByText('Справа у рядов', { exact: true }).click()
  await openSettings(page, 'Подписи значений')
  await setCheckbox(page.getByRole('checkbox', { name: 'Показывать подписи значений' }), true)

  await page.getByLabel('Положение подписей').selectOption('inside-bottom')
  await expect(page.locator('.chart-canvas-shell')).toHaveScreenshot('grouped-bar-direct-inside.png')

  await page.getByLabel('Положение подписей').selectOption('top')
  await expect(page.locator('.chart-canvas-shell')).toHaveScreenshot('grouped-bar-direct-outside.png')

  await setCheckbox(page.getByRole('checkbox', { name: 'Автоматически помещать подпись внутрь' }), true)
  await expect(page.locator('.chart-canvas-shell')).toHaveScreenshot('grouped-bar-absorbed.png')
})

test('normalized and horizontal bars keep their label geometry', async ({ page }) => {
  await openDemoChart(page, 'Временной ряд', 'Нормированные столбцы')
  await setCheckbox(page.getByRole('checkbox', { name: 'orders', exact: true }), true)
  await openDesign(page)
  await openSettings(page, 'Легенда')
  await page.getByText('Справа у рядов', { exact: true }).click()
  await openSettings(page, 'Подписи значений')
  await setCheckbox(page.getByRole('checkbox', { name: 'Показывать подписи значений' }), true)
  await setCheckbox(page.getByRole('checkbox', { name: 'Автоматически помещать подпись внутрь' }), true)
  await setCheckbox(page.getByRole('checkbox', { name: 'Скрывать пересекающиеся подписи' }), true)
  const valueLabels = await page.locator('.chart-canvas svg text').evaluateAll((nodes) => nodes.flatMap((node) => {
    const text = node.textContent?.trim() ?? ''
    if (!/^-?\d+,\d+%$/.test(text)) return []
    const box = node.getBoundingClientRect()
    return [{ text, left: box.left, right: box.right, top: box.top, bottom: box.bottom }]
  }))
  const overlaps = valueLabels.flatMap((label, index) => valueLabels.slice(index + 1).flatMap((other) =>
    Math.min(label.right, other.right) - Math.max(label.left, other.left) > 1
      && Math.min(label.bottom, other.bottom) - Math.max(label.top, other.top) > 1
      ? [[label, other]] : []))
  expect(overlaps, JSON.stringify(valueLabels)).toEqual([])
  await expect(page.locator('.chart-canvas-shell')).toHaveScreenshot('normalized-bar-absorbed-direct.png')

  await page.getByRole('button', { name: '← Тип графика' }).click()
  await page.getByRole('button', { name: 'Линейчатая', exact: true }).click()
  await openDesign(page)
  await openSettings(page, 'Легенда')
  await page.getByText('Над рядами', { exact: true }).click()
  await openSettings(page, 'Подписи значений')
  await setCheckbox(page.getByRole('checkbox', { name: 'Показывать подписи значений' }), true)
  await setCheckbox(page.getByRole('checkbox', { name: 'Автоматически помещать подпись внутрь' }), false)
  await page.getByLabel('Положение подписей').selectOption('inside-top')
  await expect(page.locator('.chart-canvas-shell')).toHaveScreenshot('horizontal-bar-direct-inside.png')

  await page.getByRole('button', { name: '← Тип графика' }).click()
  await page.getByRole('button', { name: 'Леденцовая', exact: true }).click()
  await openDesign(page)
  await openSettings(page, 'Подписи значений')
  await setCheckbox(page.getByRole('checkbox', { name: 'Показывать подписи значений' }), true)
  const lollipopValueSizes = await page.locator('.chart-canvas svg text').evaluateAll((nodes) => [...new Set(nodes.flatMap((node) =>
    ['202', '218', '83', '95'].includes(node.textContent?.trim() ?? '') ? [Number.parseFloat(getComputedStyle(node).fontSize)] : []))])
  expect(lollipopValueSizes).toEqual([17])
  await expect(page.locator('.chart-canvas-shell')).toHaveScreenshot('dense-lollipop-adaptive-labels.png')
})

test('treemap preview and exports keep complete labels and matching dimensions', async ({ page, context }) => {
  await openDemoChart(page, 'Трудности бизнеса')
  await openDesign(page)

  const previewText = (await page.locator('.chart-canvas svg text').allTextContents()).join(' ').replaceAll('\u200b', '')
  expect(previewText).toContain('Затрудняюсь ответить')
  expect(previewText).toContain('Нестабильность')
  expect(previewText).not.toContain('…')
  const footerBoxes = await page.locator('.chart-canvas svg text').evaluateAll((nodes) => nodes.flatMap((node) => {
    const text = node.textContent?.replaceAll('\u200b', '') ?? ''
    if (!text.startsWith('Молодые предприниматели') && !text.startsWith('Источник:')) return []
    const box = node.getBoundingClientRect()
    return [{ text, x: box.x, y: box.y, width: box.width, height: box.height }]
  }))
  const noteBox = footerBoxes.find(({ text }) => text.startsWith('Молодые предприниматели'))
  const sourceBox = footerBoxes.find(({ text }) => text.startsWith('Источник:'))
  expect(noteBox).toBeDefined()
  expect(sourceBox).toBeDefined()
  expect(sourceBox!.y).toBeGreaterThanOrEqual(noteBox!.y + noteBox!.height + 4)
  await expect(page.locator('.chart-canvas-shell')).toHaveScreenshot('treemap-long-russian-labels.png')

  await page.locator('.export-menu > summary').click()
  const svgDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать SVG' }).click()
  const svg = await readFile(await (await svgDownload).path()!, 'utf8')
  expect(svg).toContain('Затрудняюсь')
  expect(svg).toContain('ответить')
  expect(svg).not.toContain('…')
  expect(svg).toMatch(/width="1000"/)
  expect(svg).toMatch(/height="750"/)

  const svgPage = await context.newPage()
  await svgPage.setContent(`<style>html,body{margin:0;background:white}</style>${svg}`)
  await expect(svgPage.locator('svg')).toHaveScreenshot('treemap-export-svg.png')
  await svgPage.close()

  const pngDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать PNG' }).click()
  const png = await readFile(await (await pngDownload).path()!)
  expect(png.readUInt32BE(16)).toBe(2000)
  expect(png.readUInt32BE(20)).toBe(1500)
  const pngPage = await context.newPage()
  await pngPage.setContent(`<style>html,body{margin:0;background:white}img{display:block;width:1000px;height:750px}</style><img src="data:image/png;base64,${png.toString('base64')}">`)
  await expect(pngPage.locator('img')).toHaveScreenshot('treemap-export-png.png')
  await pngPage.close()
})
