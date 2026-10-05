import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

for (const [button, title, source] of [
  ['Ключевая ставка Банка России', 'Ключевая ставка Банка России (2020–2026)', 'Источник: Банк России'],
  ['Инфляция в США', 'Инфляция в США (1948–2026)', 'Источник: FRED'],
]) {
  test(`${button} opens a real-data chart with default presentation and exports its source`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/editor')
    await page.getByRole('button', { name: button, exact: true }).click()
    await expect(page.locator('.review-table')).toBeVisible()
    await expect(page.locator('.settings-panel')).toHaveCount(0)
    await page.getByRole('button', { name: /Выбрать график/ }).click()
    await expect(page.getByRole('button', { name: 'Настроить оформление →' })).toBeVisible()
    await page.getByRole('button', { name: 'Настроить оформление →' }).click()
    const canvas = page.locator('.chart-canvas-shell')
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    await expect(page.locator('.chart-error')).toHaveCount(0)
    await expect(canvas.locator('svg text').filter({ hasText: title }).first()).toBeVisible()
    await expect(canvas.locator('svg text').filter({ hasText: source }).first()).toBeVisible()
    await expect(canvas.locator('svg path[stroke="#1923e3"]').first()).toBeVisible()
    const dates = await canvas.locator('svg text').evaluateAll((labels) => labels.filter((label) => /^(\d{4}|\d{2}\.\d{2}\.\d{4}|[а-яё]+\.?(?:\s)\d{4} г\.)$/.test(label.textContent ?? '')).map((label) => ({ x: label.getBoundingClientRect().x, right: label.getBoundingClientRect().right })).sort((a, b) => a.x - b.x))
    expect(dates.length).toBeGreaterThan(1)
    for (let index = 1; index < dates.length; index++) expect(dates[index].x).toBeGreaterThanOrEqual(dates[index - 1].right)
    if (button === 'Ключевая ставка Банка России') {
      await expect(canvas.locator('svg text').filter({ hasText: /^\d{4}$/ })).toHaveText(Array.from({ length: 6 }, (_, index) => String(2021 + index)))
    }
    if (button === 'Инфляция в США') {
      const years = canvas.locator('svg text').filter({ hasText: /^\d{4}$/ })
      await expect(years).toHaveText(['1950', '1960', '1970', '1980', '1990', '2000', '2010', '2020'])
      await page.getByRole('tab', { name: 'Оси и шкалы', exact: true }).click()
      await page.locator('.axis-scale-settings > summary').click()
      await page.getByRole('combobox', { name: 'Точный формат', exact: true }).selectOption('year-full')
      await page.getByRole('combobox', { name: 'Единица интервала', exact: true }).selectOption('year')
      const step = page.getByRole('spinbutton', { name: /Показывать каждый N-й период/ })
      await step.fill('10')
      await step.press('Tab')
      await expect(canvas).toHaveAttribute('data-render-status', 'settled')
      await expect(years).toHaveText(['1950', '1960', '1970', '1980', '1990', '2000', '2010', '2020'])
      for (const label of await years.all()) {
        const rotated = await label.evaluate((node) => {
          const transform = node.getCTM()!
          return Math.abs(transform.b) > .001 || Math.abs(transform.c) > .001
        })
        expect(rotated).toBe(false)
      }
    }
    await page.screenshot({ path: `/tmp/viiiz-${button === 'Ключевая ставка Банка России' ? 'key-rate' : 'us-inflation'}.png` })
    await page.locator('.export-menu > summary').click()
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Скачать SVG', exact: true }).click()
    const svg = await readFile((await (await download).path())!, 'utf8')
    expect(svg).toContain(title)
    expect(svg).toContain(source)
    expect(svg).toContain('#1923e3')
    if (button === 'Ключевая ставка Банка России') {
      for (let year = 2021; year <= 2026; year++) expect(svg).toContain(`>${year}</text>`)
    }
  })
}
