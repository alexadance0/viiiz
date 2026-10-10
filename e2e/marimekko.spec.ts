import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { DEFAULT_CHART_PALETTE } from '../src/entities/chart/model/defaults'

async function loadMarkets(page: Page) {
  await page.locator('.upload-card input').setInputFiles({ name: 'markets.csv', mimeType: 'text/csv', buffer: Buffer.from('Рынок,Альфа,Бета,Гамма,Другие\nСмартфоны,180,120,60,40\nНоутбуки,60,80,30,30\nПланшеты,40,20,25,15\nЧасы,15,10,15,10') })
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  await page.getByRole('button', { name: 'Marimekko', exact: true }).click()
  const group = page.getByRole('group', { name: 'Сегменты / числовые показатели', exact: true })
  while (await group.getByRole('checkbox', { checked: false }).count()) await group.getByRole('checkbox', { checked: false }).first().press('Space')
}

for (const mode of ['normalized', 'absolute']) for (const orientation of ['vertical', 'horizontal']) test(`Marimekko hover keeps the whole series colored and lists every segment: ${mode} ${orientation}`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/editor')
  await page.locator('.upload-card input').setInputFiles({ name: 'hover.csv', mimeType: 'text/csv', buffer: Buffer.from('Группа,А,Б\nБольшая,60,30\nМалая,10,20') })
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  await page.getByRole('button', { name: 'Marimekko', exact: true }).click()
  await page.getByRole('combobox', { name: 'Значения Mekko', exact: true }).selectOption(mode)
  await page.getByRole('combobox', { name: 'Ориентация Mekko', exact: true }).selectOption(orientation)
  await page.getByRole('button', { name: 'Настроить оформление →' }).click()
  const canvas = page.locator('.chart-canvas-shell[data-plot-kind="bar"]')
  await expect(canvas).toHaveAttribute('data-render-status', 'settled')
  const activeColor = DEFAULT_CHART_PALETTE[0]
  const active = await canvas.locator('svg path').evaluateAll((elements, color) => elements.filter((element) => {
    const box = (element as SVGGraphicsElement).getBBox()
    return box.width > 20 && box.height > 20 && element.getAttribute('fill') === color
  }).map((element) => {
    const box = element.getBoundingClientRect()
    return { d: element.getAttribute('d'), x: box.x, y: box.y, width: box.width }
  }), activeColor)
  expect(active).toHaveLength(2)
  const peer = await canvas.locator('svg path').evaluateAll((elements, peerColor) => elements.filter((element) => {
    const box = (element as SVGGraphicsElement).getBBox()
    return box.width > 20 && box.height > 20 && element.getAttribute('fill') === peerColor
  }).map((element) => ({ d: element.getAttribute('d'), fill: element.getAttribute('fill') })), DEFAULT_CHART_PALETTE[1])
  expect(peer).toHaveLength(2)
  const box = active[0]
  await page.mouse.move(box.x + box.width / 2, box.y + 12)
  const tooltip = page.locator('.chart-tooltip-content')
  await expect(tooltip).toBeVisible()
  await expect(tooltip.locator('strong')).toHaveText('Большая')
  await expect(tooltip.locator('.chart-tooltip-row')).toHaveCount(2)
  await expect(tooltip.locator('[data-series="А"] .chart-tooltip-value')).toHaveText(mode === 'absolute' ? '60' : '60 · 66,67%')
  await expect(tooltip.locator('[data-series="Б"] .chart-tooltip-value')).toHaveText(mode === 'absolute' ? '30' : '30 · 33,33%')
  const activePaint = () => canvas.locator('svg path').evaluateAll((elements, { active, color }) => active.every((before) => elements.some((element) => element.getAttribute('d') === before.d && element.getAttribute('fill') === color)), { active, color: activeColor })
  await expect.poll(activePaint).toBe(true)
  await expect.poll(() => canvas.locator('svg path').evaluateAll((elements, peer) => peer.every((before) => elements.some((element) => element.getAttribute('d') === before.d && element.getAttribute('fill') !== before.fill)), peer)).toBe(true)
  await page.mouse.move(10, 10)
  await expect.poll(activePaint).toBe(true)
})

test('Marimekko demo preserves widths, edits a segment and exports SVG and PNG', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/editor')
  await loadMarkets(page)
  await expect(page.getByRole('button', { name: 'Marimekko', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('group', { name: 'Сегменты / числовые показатели', exact: true }).getByRole('checkbox', { checked: true })).toHaveCount(4)
  await page.getByRole('button', { name: 'Настроить оформление →' }).click()
  const canvas = page.locator('.chart-canvas-shell[data-plot-kind="bar"]')
  await expect(canvas).toHaveAttribute('data-render-status', 'settled')
  await expect(canvas.locator('svg text').filter({ hasText: /^45%$/ })).toBeVisible()
  const rectangles = canvas.locator('svg path[fill="#9e0142"]')
  const boxes = await rectangles.evaluateAll((elements) => elements.map((element) => {
    const box = (element as SVGGraphicsElement).getBBox()
    return { width: box.width, height: box.height }
  }).filter((box) => box.width > 20 && box.height > 20))
  const widths = [...new Set(boxes.map((box) => Math.round(box.width)))].sort((a, b) => b - a)
  expect(widths).toHaveLength(4)
  expect(widths[0] / widths[1]).toBeCloseTo(2, 1)
  expect(widths[0] / widths[3]).toBeCloseTo(8, 0)
  await canvas.locator('svg text').filter({ hasText: /^45%$/ }).click()
  await canvas.locator('svg text').filter({ hasText: /^45%$/ }).click()
  await expect(page.locator('.element-editor')).toContainText('Смартфоны')
  await expect(page.getByRole('spinbutton', { name: 'Ширина, %', exact: true })).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Текст подписи', exact: true }).fill('Лидер')
  await expect(canvas.locator('svg text').filter({ hasText: /^Лидер$/ })).toBeVisible()
  await page.getByRole('button', { name: 'Снять выделение', exact: true }).click()
  await page.mouse.move(20, 130)
  await page.screenshot({ path: '/tmp/viiiz-marimekko-demo.png', fullPage: true })
  await page.locator('.export-menu > summary').click()
  let download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать SVG' }).click()
  const svg = await readFile((await (await download).path())!, 'utf8')
  expect(svg).toContain('Лидер')
  expect(svg).toContain('Смартфоны')
  download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать PNG' }).click()
  const png = await readFile((await (await download).path())!)
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  await page.setViewportSize({ width: 900, height: 800 })
  await expect(canvas).toHaveAttribute('data-render-status', 'settled')
  await expect(canvas.locator('svg text').filter({ hasText: /^Лидер$/ })).toBeVisible()
  expect(errors).toEqual([])
})

test('Marimekko accepts long-format groups and segments', async ({ page }) => {
  await page.goto('/editor')
  await page.locator('.upload-card input').setInputFiles({ name: 'market.csv', mimeType: 'text/csv', buffer: Buffer.from('Группа,Бренд,Объём\nБольшая,Альфа,60\nБольшая,Бета,30\nМалая,Альфа,10\nМалая,Бета,20') })
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  await page.getByRole('button', { name: 'Marimekko', exact: true }).click()
  await page.getByRole('combobox', { name: 'Сегменты', exact: true }).selectOption('Бренд')
  await page.getByRole('button', { name: 'Настроить оформление →' }).click()
  const canvas = page.locator('.chart-canvas-shell[data-plot-kind="bar"]')
  await expect(canvas).toHaveAttribute('data-render-status', 'settled')
  await expect(canvas.locator('svg text').filter({ hasText: /^66,67%$/ })).toHaveCount(2)
  await expect(canvas.locator('svg text').filter({ hasText: /^Большая$/ })).toBeVisible()
  await expect(canvas.locator('svg text').filter({ hasText: /^Малая$/ })).toBeVisible()
})

test('Marimekko explains why negative volumes cannot be plotted', async ({ page }) => {
  await page.goto('/editor')
  await page.locator('.upload-card input').setInputFiles({ name: 'negative.csv', mimeType: 'text/csv', buffer: Buffer.from('Группа,А,Б\nРынок,10,-5') })
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  await page.getByRole('button', { name: 'Marimekko', exact: true }).click()
  await expect(page.getByText('Для Marimekko нужны неотрицательные значения. Уберите отрицательные значения или выберите другой график.', { exact: true })).toBeVisible()
})

for (const mode of ['normalized', 'absolute']) for (const orientation of ['vertical', 'horizontal']) {
  test(`Mekko ${mode} ${orientation} keeps values, proportions and exports`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/editor')
    await page.locator('.upload-card input').setInputFiles({ name: 'mekko.csv', mimeType: 'text/csv', buffer: Buffer.from('Группа,А,Б\nБольшая,60,30\nМалая,10,20') })
    await page.getByRole('button', { name: /Выбрать график/ }).click()
    await page.getByRole('button', { name: 'Marimekko', exact: true }).click()
    await page.getByRole('combobox', { name: 'Значения Mekko', exact: true }).selectOption(mode)
    await page.getByRole('combobox', { name: 'Ориентация Mekko', exact: true }).selectOption(orientation)
    await page.getByRole('button', { name: 'Настроить оформление →' }).click()
    const canvas = page.locator('.chart-canvas-shell[data-plot-kind="bar"]')
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    const label = mode === 'absolute' ? '60' : '66,67%'
    await expect(canvas.locator('svg text').filter({ hasText: new RegExp(`^${label}$`) }).first()).toBeVisible()
    await expect(canvas.locator('svg text').filter({ hasText: /^Большая$/ })).toBeVisible()
    await expect(canvas.locator('svg text').filter({ hasText: /^Малая$/ })).toBeVisible()
    if (mode === 'absolute') expect(await canvas.locator('svg text').allTextContents()).not.toEqual(expect.arrayContaining([expect.stringContaining('%')]))
    await page.mouse.move(10, 10)
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    const boxes = await canvas.locator('svg path[fill="#9e0142"]').evaluateAll((elements) => elements.map((element) => {
      const box = (element as SVGGraphicsElement).getBBox()
      return { width: box.width, height: box.height }
    }).filter((box) => box.width > 20 && box.height > 20))
    expect(boxes).toHaveLength(2)
    const dimension = orientation === 'horizontal' ? 'height' : 'width'
    expect(boxes[0][dimension] / boxes[1][dimension]).toBeCloseTo(3, 1)
    const valueDimension = orientation === 'horizontal' ? 'width' : 'height'
    expect(boxes[0][valueDimension] / boxes[1][valueDimension]).toBeCloseTo(mode === 'absolute' ? 6 : 2, 1)
    await page.mouse.move(10, 10)
    await page.screenshot({ path: `/tmp/viiiz-mekko-${mode}-${orientation}.png`, fullPage: true })
    await page.locator('.export-menu > summary').click()
    let download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Скачать SVG' }).click()
    const svg = await readFile((await (await download).path())!, 'utf8')
    expect(svg).toContain(label)
    expect(svg).toContain('Большая')
    const exported = await page.evaluate(({ svg }) => {
      const document = new DOMParser().parseFromString(svg, 'image/svg+xml')
      return [...document.querySelectorAll('path[fill="#9e0142"]')].map((element) => element.getAttribute('d'))
    }, { svg })
    expect(exported.sort()).toEqual(await canvas.locator('svg path[fill="#9e0142"]').evaluateAll((elements) => elements.map((element) => element.getAttribute('d')).sort()))
    download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Скачать PNG' }).click()
    const png = await readFile((await (await download).path())!)
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(errors).toEqual([])
  })
}
