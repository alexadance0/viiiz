import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

for (const [name, code, other, label, regionName, count, preset] of [
  ['Плиточная карта России', '45000000000', '46000000000', 'Мск', 'Москва', 89, 'russia'],
  ['Плиточная карта США', '0400000US06', '48', 'CA', 'California', 51, 'usa'],
  ['Плиточная карта Европы', 'DEU', 'FRA', 'DEU', 'Германия', 50, 'europe'],
  ['Плиточная карта мира', 'BRA', 'IRN', 'BR', 'Бразилия', 241, 'world'],
] as const) {
  test(`${name}: square tiles, centered labels, click, gutters and export`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/editor')
    await page.locator('.upload-card input').setInputFiles({ name: 'tiles.csv', mimeType: 'text/csv', buffer: Buffer.from(`Code,Value\n${code},97\n${other},5`) })
    await page.getByRole('button', { name: /Выбрать график/ }).click()
    await page.getByRole('button', { name, exact: true }).click()
    await page.getByRole('button', { name: 'Настроить оформление →' }).click()
    const canvas = page.locator('.chart-canvas-shell[data-plot-kind="map"]')
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    const tiles = canvas.locator('svg path[fill]').filter({ hasNot: page.locator('defs') })
    const dimensions = await tiles.evaluateAll((elements) => elements.filter((element) => element.getAttribute('fill') !== 'none').map((element) => {
      const box = (element as SVGGraphicsElement).getBBox()
      return { width: box.width, height: box.height }
    }))
    const squares = dimensions.filter((box) => box.width > 1 && Math.abs(box.width - box.height) < .1)
    expect(squares.length).toBeGreaterThanOrEqual(count)
    const text = canvas.locator('svg text').filter({ hasText: new RegExp(`^${label}$`) })
    await expect(text).toBeVisible()
    const high = canvas.locator('svg path[fill="#1677a6"]')
    await expect(high).toHaveCount(1)
    const box = await high.boundingBox()
    if (!box) throw new Error('Tile missing')
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(page.locator('.element-editor strong')).toHaveText(regionName)
    await page.getByRole('checkbox', { name: 'Показывать значение', exact: true }).press('Space')
    await expect(canvas.locator('svg text[text-anchor="middle"]').filter({ hasText: /^97$/ })).toBeVisible()
    await page.getByRole('button', { name: 'Снять выделение', exact: true }).click()
    await page.locator('details.map-settings > summary').click()
    await expect(page.getByRole('checkbox', { name: 'Подписывать территории' })).toBeChecked()
    const gap = page.getByRole('spinbutton', { name: 'Зазор между плитками, %' })
    await gap.fill('12')
    await gap.blur()
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    await page.mouse.move(20, 130)
    await page.screenshot({ path: `/tmp/viiiz-tilemap-${preset}.png`, fullPage: true })
    await page.locator('.export-menu > summary').click()
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Скачать SVG' }).click()
    const svg = await readFile((await (await download).path())!, 'utf8')
    expect(svg).toContain(label)
    expect(svg).toContain('97')
    await page.setViewportSize({ width: 900, height: 800 })
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    await expect(text).toBeVisible()
    expect(errors).toEqual([])
  })
}

test('tile map presets remain available with distinct grid icons', async ({ page }) => {
  await page.goto('/editor')
  for (const name of ['Плиточная карта России', 'Плиточная карта США', 'Плиточная карта Европы', 'Продолжительность жизни']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible()
  }
  await page.getByRole('button', { name: 'Продолжительность жизни', exact: true }).click()
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  const glyphs: string[] = []
  for (const name of ['Плиточная карта России', 'Плиточная карта США', 'Плиточная карта Европы', 'Плиточная карта мира']) {
    const button = page.getByRole('button', { name, exact: true })
    glyphs.push(await button.locator('svg').innerHTML())
  }
  expect(new Set(glyphs).size).toBe(4)
  expect(glyphs.every((glyph) => glyph.includes('<rect'))).toBe(true)
  await page.getByRole('button', { name: 'Плиточная карта мира', exact: true }).click()
  await page.getByRole('button', { name: 'Настроить оформление →' }).click()
  await expect(page.locator('.chart-canvas-shell[data-plot-kind="map"]')).toHaveAttribute('data-render-status', 'settled')
  await page.screenshot({ path: '/tmp/viiiz-tilemap-world-demo.png', fullPage: true })
})


test('changing map types restores the label default for geographical and tile maps', async ({ page }) => {
  await page.goto('/editor')
  await page.getByRole('button', { name: 'Плиточная карта США', exact: true }).click()
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  await page.getByRole('button', { name: 'Настроить оформление →' }).click()
  await page.locator('details.map-settings > summary').click()
  const labels = page.getByRole('checkbox', { name: 'Подписывать территории' })
  await expect(labels).toBeChecked()
  await labels.press('Space')
  await page.getByRole('navigation', { name: 'Этапы создания графика' }).getByRole('button', { name: /Тип графика/ }).click()
  await page.getByRole('button', { name: 'Плиточная карта Европы', exact: true }).click()
  await page.getByRole('button', { name: 'Настроить оформление →' }).click()
  await page.locator('details.map-settings > summary').click()
  await expect(labels).toBeChecked()
  await page.getByRole('navigation', { name: 'Этапы создания графика' }).getByRole('button', { name: /Тип графика/ }).click()
  await page.getByRole('button', { name: 'Карта Европы', exact: true }).click()
  await page.getByRole('button', { name: 'Настроить оформление →' }).click()
  await page.locator('details.map-settings > summary').click()
  await expect(labels).not.toBeChecked()
  await labels.press('Space')
  await page.getByRole('navigation', { name: 'Этапы создания графика' }).getByRole('button', { name: /Тип графика/ }).click()
  await page.getByRole('button', { name: 'Карта мира', exact: true }).click()
  await page.getByRole('button', { name: 'Настроить оформление →' }).click()
  await page.locator('details.map-settings > summary').click()
  await expect(labels).not.toBeChecked()
})
