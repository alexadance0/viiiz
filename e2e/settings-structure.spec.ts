import { expect, test } from '@playwright/test'

async function openGroup(group: ReturnType<import('@playwright/test').Page['locator']>) {
  if (!(await group.evaluate((element) => element.hasAttribute('open')))) await group.locator(':scope > summary').click()
}

for (const columns of ['Месяц,А\nЯнварь,10\nФевраль,20', 'Месяц,А,Б\nЯнварь,10,15\nФевраль,20,5']) {
  test(`colors and line appearance keep the same locations for ${columns.includes(',Б') ? 'multiple' : 'one'} series`, async ({ page }) => {
    await page.goto('/editor')
    await page.locator('.upload-card input').setInputFiles({ name: 'series.csv', mimeType: 'text/csv', buffer: Buffer.from(columns) })
    await page.getByRole('button', { name: /Выбрать график/ }).click()
    await page.getByRole('button', { name: 'Линия', exact: true }).click()
    if (columns.includes(',Б')) await page.getByRole('checkbox', { name: 'Б', exact: true }).press('Space')
    await page.getByRole('button', { name: 'Настроить оформление →' }).click()
    await expect(page.locator('summary').filter({ hasText: /^Основное$/ })).toHaveCount(0)
    const colors = page.locator('.palette-settings')
    await expect(colors.locator('summary')).toHaveText('Цвета')
    await openGroup(colors)
    await expect(colors.locator('.series-color-list .hero-color-control')).toHaveCount(columns.includes(',Б') ? 2 : 1)
    await expect(page.locator('.ordered-series-list .hero-color-control')).toHaveCount(0)
    const appearance = page.locator('.line-appearance-settings')
    await openGroup(appearance)
    await expect(appearance.getByRole('spinbutton', { name: 'Толщина линии, px', exact: true })).toBeVisible()
    await appearance.getByText('Показывать маркеры', { exact: true }).click()
    await expect(appearance.getByRole('combobox', { name: 'Форма', exact: true })).toBeVisible()
  })
}

for (const kind of ['scatter', 'bubble', 'connected-scatter'] as const) {
  test(`${kind} always exposes point appearance in both the menu and the selected-series inspector`, async ({ page }) => {
    await page.goto('/editor')
    await page.locator('.upload-card input').setInputFiles({ name: 'points.csv', mimeType: 'text/csv', buffer: Buffer.from('X,А,Б\n1,10,15\n2,20,5\n3,15,25') })
    await page.getByRole('button', { name: /Выбрать график/ }).click()
    const name = { scatter: 'Точечный', bubble: 'Пузырьковая диаграмма', 'connected-scatter': 'Соединённая диаграмма рассеивания' }[kind]
    await page.getByRole('button', { name, exact: true }).click()
    await page.getByRole('button', { name: 'Настроить оформление →' }).click()
    const canvas = page.locator('.chart-canvas-shell')
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    const points = page.locator('.scatter-settings')
    await openGroup(points)
    await expect(points.locator('summary')).toHaveText('Точки')
    await expect(points.getByRole('checkbox', { name: /Показывать маркеры/ })).toHaveCount(0)
    const shape = points.getByRole('combobox', { name: 'Форма', exact: true })
    await expect(shape).toBeVisible()
    await shape.selectOption('diamond')
    await expect(points.getByRole('spinbutton', { name: 'Толщина рамки, px', exact: true })).toBeVisible()
    if (kind !== 'bubble') await points.getByRole('spinbutton', { name: 'Размер, px', exact: true }).fill('18')
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    await page.screenshot({ path: `/tmp/viiiz-${kind}-point-settings.png` })
    const point = await canvas.locator('svg path').evaluateAll((elements) => {
      const point = elements.find((element) => {
        const box = element.getBoundingClientRect(), fill = element.getAttribute('fill')
        return fill?.startsWith('#') && !['#fff', '#ffffff', '#202027', '#000000'].includes(fill) && box.width >= 4 && box.width <= 120 && box.height >= 4 && box.height <= 120
      })!
      const box = point.getBoundingClientRect()
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    })
    await page.mouse.click(point.x, point.y)
    const inspector = page.locator('.series-editor')
    await expect(inspector.getByRole('combobox', { name: 'Форма', exact: true })).toBeVisible()
    await expect(inspector.getByRole('checkbox', { name: /Показывать маркеры/ })).toHaveCount(0)
  })
}
