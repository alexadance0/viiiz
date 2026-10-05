import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

for (const [chart, filename, csv, field, selected, totals, outside] of [
  ['Карта мира', 'owid.csv', 'Entity,Code,Value\nNamibia,NAM,20\nKosovo,OWID_KOS,30\nNorth America,OWID_NAM,99999\nWorld,OWID_WRL,99999\nUSSR,OWID_USS,99999\nGibraltar,GIB,99999', 'Code', 'Страна', 2, 1],
  ['Карта США', 'census.csv', 'Value,state\n97,06\n5,48\n99999,72\n99999,0100000US', 'state', 'Штат', 1, 1],
] as const) {
  test(`${filename}: provider codes, totals and map coverage`, async ({ page }) => {
    await page.goto('/editor')
    await page.locator('.upload-card input').setInputFiles({ name: filename, mimeType: 'text/csv', buffer: Buffer.from(csv) })
    await page.getByRole('button', { name: /Выбрать график/ }).click()
    await page.getByRole('button', { name: chart, exact: true }).click()
    await expect(page.getByRole('combobox', { name: selected, exact: true })).toHaveValue(field)
    await expect(page.getByText(`Пропущены общие итоги: ${totals}`)).toBeVisible()
    await expect(page.getByText(`За пределами выбранной карты: ${outside}`)).toBeVisible()
    if (filename === 'owid.csv') await expect(page.getByText('Пропущены исторические территории: 1')).toBeVisible()
    await expect(page.getByText(/Не найдены на карте:/)).toHaveCount(0)
    await page.getByRole('button', { name: 'Настроить оформление →' }).click()
    const canvas = page.locator('.chart-canvas-shell[data-plot-kind="map"]')
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    await expect(canvas.locator('svg path[fill="#1923e3"]')).toHaveCount(1)
  })
}

test('Rosstat names and codes distinguish territorial values from inclusive totals', async ({ page }) => {
  await page.goto('/editor')
  await page.locator('.upload-card input').setInputFiles({ name: 'rosstat.csv', mimeType: 'text/csv', buffer: Buffer.from([
    'Регион,Значение', 'Российская Федерация,999999', 'Уральский федеральный округ,888888',
    'Тюменская область (с автономными округами),300', 'ХМАО — Югра,150', 'ЯНАО,100', 'Тюменская обл. (без автономных округов),50',
    'г.Москва,33', '46000000000,44', '03000000000,55', 'Неизвестный регион,9999',
  ].join('\n')) })
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  await page.getByRole('button', { name: 'Карта России', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Регион', exact: true })).toHaveValue('Регион')
  await expect(page.getByText('Пропущены общие итоги: 2')).toBeVisible()
  await expect(page.getByText('Пропущены итоги областей с автономными округами', { exact: true })).toBeVisible()
  await expect(page.getByText('Не найдены на карте: 1')).toBeVisible()
  await expect(page.getByText('Уточните состав территории', { exact: true })).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Повторяющиеся территории', exact: true }).selectOption('none')
  await page.getByRole('button', { name: 'Настроить оформление →' }).click()
  const canvas = page.locator('.chart-canvas-shell[data-plot-kind="map"]')
  await expect(canvas).toHaveAttribute('data-render-status', 'settled')
  const high = canvas.locator('svg path[fill="#1923e3"]')
  await expect(high).toHaveCount(1)
  const point = await high.evaluate((element) => {
    const path = element as SVGGeometryElement, box = path.getBBox(), matrix = path.getScreenCTM()!
    for (const x of [.5, .4, .6, .3, .7]) for (const y of [.5, .4, .6, .3, .7]) {
      const local = new DOMPoint(box.x + box.width * x, box.y + box.height * y)
      if (path.isPointInFill(local)) { const screen = local.matrixTransform(matrix); return { x: screen.x, y: screen.y } }
    }
    throw new Error('No interior click point')
  })
  await page.mouse.click(point.x, point.y)
  await expect(page.locator('.element-editor strong')).toHaveText('Ханты-Мансийский автономный округ — Югра')
  await page.getByRole('checkbox', { name: 'Показывать значение', exact: true }).press('Space')
  await expect(canvas.locator('svg text[text-anchor="middle"]').filter({ hasText: /^150$/ })).toBeVisible()
})

test('map chart types have distinct geographical icons', async ({ page }) => {
  await page.goto('/editor')
  await page.getByRole('button', { name: 'Продолжительность жизни', exact: true }).click()
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  const maps = page.locator('.chart-category').filter({ has: page.getByRole('heading', { name: 'Карты', exact: true }) })
  await expect(maps.locator('svg.chart-type-icon')).toHaveCount(8)
  const glyphs = await maps.locator('svg.chart-type-icon').evaluateAll((icons) => icons.map((icon) => icon.innerHTML))
  expect(new Set(glyphs).size).toBe(8)
  expect(glyphs.every((glyph) => /<(?:path|rect)/.test(glyph))).toBe(true)
  await maps.screenshot({ path: '/tmp/viiiz-map-type-icons.png' })
  await page.setViewportSize({ width: 900, height: 800 })
  await maps.screenshot({ path: '/tmp/viiiz-map-type-icons-narrow.png' })
})

for (const [name, territory, other] of [['Карта России', 'Свердловская область', 'Московская область'], ['Карта США', 'California', 'Texas'], ['Карта Европы', 'France', 'Germany'], ['Карта США', 'DC', 'California'], ['Карта мира', 'Brazil', 'China']] as const) {
  test(`${name}: ${territory} click enables its value without a custom label`, async ({ page }) => {
    await page.goto('/editor')
    await page.locator('.upload-card input').setInputFiles({ name: 'territories.csv', mimeType: 'text/csv', buffer: Buffer.from(`Территория,Значение\n${territory},97\n${other},5`) })
    await page.getByRole('button', { name: /Выбрать график/ }).click()
    await page.getByRole('button', { name, exact: true }).click()
    await page.getByRole('button', { name: 'Настроить оформление →' }).click()
    const canvas = page.locator('.chart-canvas-shell[data-plot-kind="map"]')
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    const point = await canvas.locator('svg path[fill="#1923e3"]').first().evaluate((element) => {
      const path = element as SVGGeometryElement, box = path.getBBox(), matrix = path.getScreenCTM()!
      for (const step of [.5, .4, .6, .3, .7]) for (const row of [.5, .4, .6, .3, .7]) {
        const local = new DOMPoint(box.x + box.width * step, box.y + box.height * row)
        if (path.isPointInFill(local)) { const screen = local.matrixTransform(matrix); return { x: screen.x, y: screen.y } }
      }
      throw new Error('No interior click point')
    })
    await page.mouse.click(point.x, point.y)
    const valueToggle = page.getByRole('checkbox', { name: 'Показывать значение', exact: true })
    await expect(valueToggle).not.toBeChecked()
    await valueToggle.press('Space')
    const value = canvas.locator('svg text[text-anchor="middle"]').filter({ hasText: /^97$/ })
    await expect(value).toBeVisible()
    await page.getByRole('checkbox', { name: 'Показывать название', exact: true }).press('Space')
    await expect(value).toBeVisible()
    await page.getByRole('checkbox', { name: 'Показывать название', exact: true }).press('Space')
    await expect(value).toBeVisible()
    await page.mouse.move(20, 130)
    await page.screenshot({ path: `/tmp/viiiz-map-value-${name}-${territory}.png`, fullPage: true })
    await valueToggle.press('Space')
    await expect(value).toHaveCount(0)
  })
}

for (const [name, count, file] of [['Карта России', 89, 'russia'], ['Карта США', 51, 'usa'], ['Карта Европы', 50, 'europe'], ['Карта мира', 241, 'world']] as const) {
  test(`${name}: preview, labels, resize and SVG/PNG export`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/editor')
    await page.getByRole('button', { name, exact: true }).click()
    await page.getByRole('button', { name: /Выбрать график/ }).click()
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Настроить оформление →' }).click()
    const canvas = page.locator('.chart-canvas-shell[data-plot-kind="map"]')
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    expect(await canvas.locator('svg path[fill]').count()).toBeGreaterThanOrEqual(count)
    if (file === 'russia') await expect(canvas.locator('svg text').filter({ hasText: /оспариваемым статусом/ })).toHaveCount(0)
    if (file === 'usa') {
      await expect(canvas.locator('svg text').filter({ hasText: /^Аляска$/ })).toBeVisible()
      await expect(canvas.locator('svg text').filter({ hasText: /^Гавайи$/ })).toBeVisible()
    }
    await page.screenshot({ path: `/tmp/viiiz-map-${file}.png`, fullPage: true })
    await page.locator('details.map-settings > summary').click()
    await page.getByRole('checkbox', { name: 'Подписывать территории' }).press('Space')
    await expect(canvas.locator('svg text').filter({ hasText: file === 'usa' ? /^TX$/ : file === 'europe' ? /^DE$/ : file === 'world' ? /^BR$/ : /^KYA$/ })).toBeVisible()
    await page.locator('.export-menu > summary').click()
    const svgDownload = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Скачать SVG' }).click()
    const svg = await readFile((await (await svgDownload).path())!, 'utf8')
    expect(svg).toContain('<svg')
    expect(svg).not.toContain('opacity="0.62"')
    expect(svg).not.toContain('оспариваемым статусом')
    if (file === 'usa') expect(svg).toContain('Аляска')
    const pngDownload = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Скачать PNG' }).click()
    expect((await readFile((await (await pngDownload).path())!)).subarray(1, 4).toString()).toBe('PNG')
    await page.setViewportSize({ width: 900, height: 800 })
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    await page.screenshot({ path: `/tmp/viiiz-map-${file}-narrow.png`, fullPage: true })
    expect(errors).toEqual([])
  })
}

test('map matches aliases, exposes unmatched rows, edits a territory and restores its style', async ({ page }) => {
  await page.goto('/editor')
  await page.locator('.upload-card input').setInputFiles({ name: 'states.csv', mimeType: 'text/csv', buffer: Buffer.from('Штат,Продажи\nCA,10\nКалифорния,20\nTexas,100\nAtlantis,9999') })
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  await page.getByRole('button', { name: 'Карта США', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Штат', exact: true })).toHaveValue('Штат')
  await expect(page.getByText('Не найдены на карте: 1')).toBeVisible()
  await page.getByRole('button', { name: 'Настроить оформление →' }).click()
  const canvas = page.locator('.chart-canvas-shell[data-plot-kind="map"]')
  await expect(canvas).toHaveAttribute('data-render-status', 'settled')
  const texas = canvas.locator('svg path[fill="#1923e3"]')
  await expect(texas).toHaveCount(1)
  const box = await texas.boundingBox()
  if (!box) throw new Error('Texas is missing')
  await page.mouse.click(box.x + box.width * .65, box.y + box.height * .5)
  await expect(page.locator('.element-editor strong')).toHaveText('Texas')
  await page.getByRole('checkbox', { name: 'Показывать значение', exact: true }).press('Space')
  await expect(canvas.locator('svg text[text-anchor="middle"]').filter({ hasText: /^100$/ })).toBeVisible()
  await page.getByRole('textbox', { name: 'Текст подписи', exact: true }).fill('Texas\n100')
  await expect(canvas.locator('svg text').filter({ hasText: /^Texas$/ })).toBeVisible()
  await page.getByRole('button', { name: 'Сбросить настройки элемента', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Текст подписи', exact: true })).toHaveValue('')
  await page.getByRole('textbox', { name: 'Текст подписи', exact: true }).fill('Texas\n100')
  await page.getByRole('button', { name: 'Снять выделение', exact: true }).click()
  await page.locator('.export-menu > summary').click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать SVG' }).click()
  expect(await readFile((await (await download).path())!, 'utf8')).toContain('Texas')
})


test('plain Tyumen and Arkhangelsk names retain values alongside autonomous districts', async ({ page }) => {
  await page.goto('/editor')
  await page.locator('.upload-card input').setInputFiles({ name: 'oblasts.csv', mimeType: 'text/csv', buffer: Buffer.from('Регион,Значение\nТюменская область,150\nАрхангельская область,100\nХМАО,50\nЯНАО,30\nНАО,20') })
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  await page.getByRole('button', { name: 'Карта России', exact: true }).click()
  await expect(page.getByText('Пропущены итоги областей с автономными округами', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Уточните состав территории', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Настроить оформление →' }).click()
  const canvas = page.locator('.chart-canvas-shell[data-plot-kind="map"]')
  await expect(canvas).toHaveAttribute('data-render-status', 'settled')
  await expect(canvas.locator('svg path[fill="#1923e3"]')).toHaveCount(1)
})
