import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

for (const scope of ['composition', 'panel', 'annotation', 'single'] as const) {
  test(`${scope} highlighting replaces its background and keeps alpha in preview`, async ({ page }) => {
    await page.goto('/editor')
    if (scope === 'single') {
      await page.locator('.upload-card input').setInputFiles({ name: 'shares.csv', mimeType: 'text/csv', buffer: Buffer.from('Категория,Значение\nА,60\nБ,40') })
      await page.getByRole('button', { name: /Выбрать график/ }).click()
      await page.getByRole('button', { name: 'Кольцевая', exact: true }).click()
      await page.getByRole('button', { name: 'Настроить оформление →' }).click()
      await page.locator('.chart-canvas svg text').filter({ hasText: /^Заголовок графика$/ }).click()
    } else {
      await page.getByRole('button', { name: 'Группы респондентов', exact: true }).click()
      if (scope === 'composition') await page.locator('[data-composition-text="title"] .canvas-rich-text-display').click()
      else {
        await page.getByRole('button', { name: /Выбрать график 2: По полу/ }).click()
        if (scope === 'panel') await page.locator('.multiples-cell.selected svg text').filter({ hasText: /^По полу$/ }).click()
        else {
          await page.getByRole('tab', { name: 'Аннотации и акценты', exact: true }).click()
          await page.getByRole('button', { name: 'Текст', exact: true }).click()
          await page.getByRole('button', { name: 'Добавить в центр', exact: true }).click()
          await page.locator('.canvas-annotation .annotation-content').dblclick()
        }
      }
    }
    const editor = scope === 'annotation' ? page.locator('.annotation-content[contenteditable="true"]') : page.locator('.canvas-rich-text-content')
    await editor.evaluate((element) => {
      element.innerHTML = '<b style="font-family: Georgia">Полупрозрачный</b> фон'
      element.dispatchEvent(new InputEvent('input', { bubbles: true }))
      const range = document.createRange(); range.selectNodeContents(element)
      const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range)
      element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })
    await page.getByRole('button', { name: 'Фон текста', exact: true }).click()
    await page.getByRole('button', { name: 'Цвет #db5a5a', exact: true }).click()
    const slider = page.getByRole('slider', { name: 'Фон текста: прозрачность', exact: true })
    await slider.press('Home')
    await slider.press('PageUp')
    await slider.press('PageUp')
    await slider.press('PageUp')
    await slider.press('PageUp')
    await slider.press('PageUp')
    await slider.press('Tab')
    await page.keyboard.press('Escape')
    await expect.poll(() => editor.evaluate((element) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
      const text = walker.nextNode()
      const backgrounds: string[] = []
      for (let parent = text?.parentElement; parent && parent !== element; parent = parent.parentElement) {
        const color = getComputedStyle(parent).backgroundColor
        if (color !== 'rgba(0, 0, 0, 0)') backgrounds.push(color)
      }
      return backgrounds
    })).toEqual(['rgba(219, 90, 90, 0.5)'])
    if (scope === 'composition') {
      await editor.evaluate((element) => {
        const text = document.createTreeWalker(element, NodeFilter.SHOW_TEXT).nextNode()!
        const range = document.createRange(); range.setStart(text, 0); range.setEnd(text, 6)
        const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range)
        element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      })
      await page.getByRole('button', { name: 'Фон текста', exact: true }).click()
      await page.getByRole('button', { name: 'Цвет #36a476', exact: true }).click()
      await slider.press('Home')
      for (let step = 0; step < 5; step++) await slider.press('PageUp')
      await slider.press('Tab')
      await page.keyboard.press('Escape')
      await expect.poll(() => editor.evaluate((element) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
        const runs: Array<{ text: string; backgrounds: string[]; weight: string }> = []
        for (let text = walker.nextNode(); text; text = walker.nextNode()) {
          if (!text.textContent) continue
          const backgrounds: string[] = []
          for (let parent = text.parentElement; parent && parent !== element; parent = parent.parentElement) {
            const color = getComputedStyle(parent).backgroundColor
            if (color !== 'rgba(0, 0, 0, 0)') backgrounds.push(color)
          }
          runs.push({ text: text.textContent, backgrounds, weight: getComputedStyle(text.parentElement!).fontWeight })
        }
        return runs
      })).toEqual([
        { text: 'Полупр', backgrounds: ['rgba(54, 164, 118, 0.5)'], weight: '900' },
        { text: 'озрачный', backgrounds: ['rgba(219, 90, 90, 0.5)'], weight: '900' },
        { text: ' фон', backgrounds: ['rgba(219, 90, 90, 0.5)'], weight: '700' },
      ])
    }
    await page.getByRole('button', { name: 'Снять выделение', exact: true }).click()
    const display = scope === 'annotation' ? page.locator('.annotation-display .annotation-content') : page.locator('.canvas-rich-text-display')
    await expect(display.filter({ hasText: 'Полупрозрачный фон' }).locator('span[style]').first()).toHaveCSS('background-color', scope === 'composition' ? 'rgba(54, 164, 118, 0.5)' : 'rgba(219, 90, 90, 0.5)')
    await page.locator('.export-menu > summary').click()
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Скачать SVG', exact: true }).click()
    const svg = await readFile((await (await download).path())!, 'utf8')
    expect(svg).toContain('rgba(219, 90, 90, 0.5)')
    if (scope === 'composition') expect(svg).toContain('rgba(54, 164, 118, 0.5)')
  })
}
