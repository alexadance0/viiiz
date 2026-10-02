import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

// Run against the local app: node scripts/capture-process.mjs
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
  await mkdir('public/images/process', { recursive: true })
  const capture = async (name) => {
    await page.evaluate(() => document.fonts.ready)
    await page.mouse.move(0, 0)
    await page.screenshot({ path: `public/images/process/${name}.png`, animations: 'disabled' })
  }
  await page.goto('http://127.0.0.1:5175/editor')
  await page.getByRole('heading', { name: 'Добавьте данные' }).waitFor()
  await capture('upload')
  await page.locator('input[type="file"]').setInputFiles({
    name: 'Выручка по месяцам.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Месяц,Выручка,План\nЯнварь,128,140\nФевраль,145,140\nМарт,138,150\nАпрель,167,160\nМай,182,175\nИюнь,174,180\nИюль,196,190\nАвгуст,214,200\nСентябрь,207,210\nОктябрь,238,230\nНоябрь,256,240\nДекабрь,284,260'),
  })
  await page.getByRole('heading', { name: 'Проверьте данные' }).waitFor()
  await capture('table')
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  await page.getByRole('heading', { name: 'Тип графика' }).waitFor()
  await page.getByRole('button', { name: /^Столбцы$/ }).click()
  await page.getByRole('heading', { name: 'Сравнение', exact: true }).scrollIntoViewIfNeeded()
  await page.locator('.chart-canvas-shell[data-render-status="settled"]').waitFor()
  await capture('charts')
  await page.getByRole('button', { name: /Настроить оформление/ }).click()
  await page.locator('.settings-panel').waitFor()
  await page.locator('.canvas-paper svg text').filter({ hasText: /^Заголовок графика$/ }).click()
  await page.locator('.canvas-rich-text-content').fill('Выручка по месяцам')
  await page.getByRole('button', { name: 'Снять выделение', exact: true }).click()
  await page.locator('.canvas-paper svg text').filter({ hasText: /^Подзаголовок графика$/ }).click()
  await page.locator('.canvas-rich-text-content').fill('2026 год · тыс. ₽')
  await page.getByRole('button', { name: 'Снять выделение', exact: true }).click()
  await page.getByRole('tab', { name: 'Столбцы', exact: true }).click()
  await page.locator('.chart-canvas-shell[data-render-status="settled"]').waitFor()
  await capture('settings')
} finally {
  await browser.close()
}
