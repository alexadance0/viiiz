import { expect, test, type Locator } from '@playwright/test'

async function open(group: Locator) { if (!(await group.evaluate((element) => element.hasAttribute('open')))) await group.locator(':scope > summary').click() }
async function csv(page: import('@playwright/test').Page, kind: string) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/editor')
  await page.locator('.upload-card input').setInputFiles({ name: 'rows.csv', mimeType: 'text/csv', buffer: Buffer.from('Год,А,Б\n2020,10,20\n2021,15,25\n2022,20,30') })
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  await page.getByRole('button', { name: kind, exact: true }).click()
  const field = page.getByRole('checkbox', { name: 'Б', exact: true })
  if (await field.count() && !(await field.isChecked())) await field.press('Space')
  await page.getByRole('button', { name: 'Настроить оформление →' }).click()
  await expect(page.locator('.chart-canvas-shell')).toHaveAttribute('data-render-status', 'settled')
}

test('obsolete switches are removed and bar fill appears only once in its inspector', async ({ page }) => {
  await csv(page, 'Столбцы')
  await page.getByRole('tab', { name: 'Оси и шкалы', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Стиль заголовков осей', exact: true })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Холст', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: 'Вписывать холст в рабочую область', exact: true })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Столбцы', exact: true }).click()
  const appearance = page.locator('.bar-appearance-settings')
  await open(appearance)
  await appearance.getByText('Рамка столбцов', { exact: true }).click()
  await appearance.getByRole('spinbutton', { name: 'Толщина рамки, px', exact: true }).fill('3')
  await expect(page.locator('.chart-canvas-shell svg path[stroke-width="3"]')).not.toHaveCount(0)
  await open(page.locator('.series-settings'))
  await page.locator('.series-name-button').first().click()
  const editor = page.locator('.series-editor')
  await expect(editor.getByText('Цвет всего ряда', { exact: true })).toHaveCount(0)
  await expect(editor.locator('.bar-selection-fields')).toHaveCount(1)
  await expect(editor).toContainText('Заливка')
})

test('the full series block can be dragged and bottom list entries stay at the stack base', async ({ page }) => {
  await csv(page, 'Столбцы с накоплением')
  const rows = page.locator('.ordered-series-list > div')
  await expect(rows).toHaveCount(2)
  const names = await rows.locator('.series-name-button span').allTextContents()
  const fill = await rows.last().locator('i').evaluate((element) => (element as HTMLElement).style.backgroundColor)
  const atBase = async () => page.locator('.chart-canvas-shell svg').evaluate((svg, color) => {
    const paths = [...svg.querySelectorAll<SVGGraphicsElement>('path')].filter((path) => path.getBBox().width > 10 && path.getBBox().height > 10)
    const colored = paths.filter((path) => getComputedStyle(path).fill === color)
    return colored.some((path) => path.getBBox().y + path.getBBox().height >= Math.max(...paths.map((path) => path.getBBox().y + path.getBBox().height)) - 1)
  }, fill)
  expect(await atBase()).toBe(true)
  const source = (await rows.first().boundingBox())!, target = (await rows.last().boundingBox())!
  await page.mouse.move(source.x + 70, source.y + 12)
  await page.mouse.down()
  await page.mouse.move(target.x + 70, target.y + target.height - 8, { steps: 12 })
  await expect(rows.locator('.series-name-button span')).toHaveText([...names].reverse())
  await page.mouse.up()
  await expect(rows).toHaveCount(2)
  await expect(page.locator('.chart-canvas-shell')).toHaveAttribute('data-render-status', 'settled')
  await expect.poll(atBase).toBe(false)
})

test('scatter labels have one section and use the actual scatter visibility flag', async ({ page }) => {
  await csv(page, 'Точечный')
  await expect(page.locator('.scatter-settings').getByText('Подписи точек', { exact: true })).toHaveCount(0)
  const labels = page.locator('.value-label-settings')
  await open(labels)
  await labels.getByText('Показывать подписи значений', { exact: true }).click()
  await labels.getByRole('combobox', { name: 'Текст подписи', exact: true }).selectOption('Б')
  await expect(page.locator('.chart-canvas-shell svg text').filter({ hasText: /^25$/ }).first()).toBeVisible()
})

test('canvas interaction chrome follows custom dark backgrounds', async ({ page }) => {
  await csv(page, 'Линия')
  await page.getByRole('tab', { name: 'Холст', exact: true }).click()
  await open(page.locator('.canvas-settings'))
  await page.getByText('Тёмная тема холста', { exact: true }).click()
  const canvas = page.locator('.chart-canvas-shell')
  await expect.poll(() => canvas.evaluate((element) => getComputedStyle(element).getPropertyValue('--canvas-ui-ink').trim())).toBe('#ffffff')
  await canvas.locator('svg text').filter({ hasText: /^Заголовок графика$/ }).click()
  await expect(canvas.locator('.canvas-rich-text-content')).toHaveCSS('border-top-color', 'rgb(255, 255, 255)')
  await page.screenshot({ path: '/tmp/viiiz-dark-canvas-editor.png' })
})

for (const border of [0, 2]) test(`axis tooltip does not brighten peers at the hovered date, border=${border}`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/src/main.tsx', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }))
  await page.goto('/editor')
  await page.evaluate(async (border) => {
    await import('/src/index.css'); await import('/src/App.css')
    const fixture = await import('/src/test-fixtures/chartAudit.browser.tsx')
    fixture.renderConfig('stacked-bar', { palette: ['#1677a6', '#db5a5a'], showValues: false, showLegend: false, showDirectLabels: false, barBorderColor: undefined, barBorderWidth: border })
  }, border)
  const canvas = page.locator('#chart-audit-host .chart-canvas-shell')
  await expect(canvas).toHaveAttribute('data-render-status', 'settled')
  const peerPaths = await canvas.locator('svg path[fill="#db5a5a"]').evaluateAll((elements) => elements.map((element) => element.getAttribute('d')))
  expect(peerPaths.length).toBeGreaterThan(0)
  const box = (await canvas.locator('svg path[fill="#1677a6"]').first().boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await expect(page.locator('.chart-tooltip:visible')).toBeVisible()
  const muted = await page.evaluate(async () => (await import('/src/core/color.ts')).softenColor('#db5a5a'))
  await expect.poll(() => canvas.locator('svg path').evaluateAll((elements, { peerPaths, muted }) => peerPaths.every((d) => elements.some((element) => element.getAttribute('d') === d && element.getAttribute('fill') === muted)), { peerPaths, muted })).toBe(true)
})

test('the moving axis guide adapts to a dark custom background even with the light theme selected', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/src/main.tsx', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }))
  await page.goto('/editor')
  await page.evaluate(async () => {
    await import('/src/index.css'); await import('/src/App.css')
    const fixture = await import('/src/test-fixtures/chartAudit.browser.tsx')
    fixture.renderConfig('line', { canvasTheme: 'light', canvasBackground: '#121827', showValues: false, showLegend: false, showDirectLabels: false })
  })
  const canvas = page.locator('#chart-audit-host .chart-canvas-shell')
  await expect(canvas).toHaveAttribute('data-render-status', 'settled')
  const point = await canvas.locator('svg').evaluate((svg) => {
    const path = [...svg.querySelectorAll<SVGGeometryElement>('path')].find((path) => Number(path.getAttribute('stroke-width')) >= 2 && path.getAttribute('stroke')?.startsWith('#') && path.getTotalLength() > 100)!
    const point = path.getPointAtLength(path.getTotalLength() / 2).matrixTransform(path.getScreenCTM()!)
    return { x: point.x, y: point.y }
  })
  await page.mouse.move(point.x, point.y)
  await expect(canvas.locator('svg path[stroke="#ffffff"][stroke-dasharray]')).not.toHaveCount(0)
})
