import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

async function droppedFile(page: import('@playwright/test').Page, files: Array<{ name: string; bytes: number[]; type: string }>) {
  return page.evaluateHandle((files) => {
    const transfer = new DataTransfer()
    for (const file of files) transfer.items.add(new File([new Uint8Array(file.bytes)], file.name, { type: file.type }))
    return transfer
  }, files)
}

test('files dropped outside the upload card import through the same flow as the picker', async ({ page }) => {
  await page.goto('/editor')
  const transfer = await droppedFile(page, [{ name: 'streams.csv', bytes: Array.from(Buffer.from('Период,Значение\nЯнварь,10\nФевраль,20')), type: 'text/csv' }])
  const heading = page.getByRole('heading', { name: 'Добавьте данные', exact: true })
  await heading.dispatchEvent('dragenter', { dataTransfer: transfer })
  await expect(page.locator('.source-step')).toHaveClass(/file-dragging/)
  await expect(page.getByText('Отпустите файл для загрузки', { exact: true })).toBeVisible()
  await page.locator('.upload-card').dispatchEvent('dragenter', { dataTransfer: transfer })
  await heading.dispatchEvent('dragleave', { dataTransfer: transfer })
  await expect(page.locator('.source-step')).toHaveClass(/file-dragging/)
  await heading.dispatchEvent('drop', { dataTransfer: transfer })
  await expect(page.getByRole('heading', { name: 'Проверьте данные' })).toBeVisible()
  await expect(page.locator('.review-table')).toContainText('Январь')
  await expect(page.locator('.review-table')).toContainText('20')
  expect(page.url()).toContain('/editor')
  await transfer.dispose()
})

test('leaving the page clears the highlight and multiple files do not silently lose data', async ({ page }) => {
  await page.goto('/editor')
  const transfer = await droppedFile(page, ['a.csv', 'b.csv'].map((name) => ({ name, bytes: Array.from(Buffer.from('x,y\n1,2')), type: 'text/csv' })))
  const heading = page.getByRole('heading', { name: 'Добавьте данные', exact: true })
  await heading.dispatchEvent('dragenter', { dataTransfer: transfer })
  await heading.dispatchEvent('dragleave', { dataTransfer: transfer })
  await expect(page.locator('.source-step')).not.toHaveClass(/file-dragging/)
  await heading.dispatchEvent('drop', { dataTransfer: transfer })
  await expect(page.getByRole('alert')).toHaveText('Перетащите один файл за раз.')
  await expect(heading).toBeVisible()
  await transfer.dispose()
})

test('the supplied Excel workbook opens all 43 sheets after dropping it on the page', async ({ page }) => {
  test.skip(!process.env.EXCEL_REGRESSION_FILE, 'Set EXCEL_REGRESSION_FILE to the reported workbook')
  const bytes = await readFile(process.env.EXCEL_REGRESSION_FILE!)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/editor')
  const transfer = await droppedFile(page, [{ name: 'KT3_graph_datasets.xlsx', bytes: Array.from(bytes), type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }])
  await page.getByRole('heading', { name: 'Добавьте данные', exact: true }).dispatchEvent('drop', { dataTransfer: transfer })
  await expect(page.getByRole('dialog', { name: 'Выберите лист' })).toBeVisible()
  await expect(page.locator('.sheet-list > button')).toHaveCount(43)
  await page.getByRole('button', { name: /^01_Численность/ }).click()
  await expect(page.getByRole('heading', { name: 'Проверьте данные' })).toBeVisible()
  await expect(page.locator('.review-table tbody tr')).toHaveCount(3)
  expect(errors).toEqual([])
  await transfer.dispose()
})

test('file dragging draws the landing-page symbols in green and dropping fades the effect', async ({ page }) => {
  await page.goto('/editor')
  const transfer = await droppedFile(page, [{ name: 'data.csv', bytes: Array.from(Buffer.from('x,y\nA,10\nB,20')), type: 'text/csv' }])
  const heading = page.getByRole('heading', { name: 'Добавьте данные', exact: true })
  await heading.dispatchEvent('dragenter', { dataTransfer: transfer, clientX: 70, clientY: 350 })
  const card = page.locator('.upload-card')
  const effect = card.locator('.file-drop-effect canvas')
  await expect(effect).toBeVisible()
  const box = (await card.boundingBox())!
  const canvasBox = (await effect.boundingBox())!
  expect(canvasBox.x).toBeGreaterThanOrEqual(box.x)
  expect(canvasBox.y).toBeGreaterThanOrEqual(box.y)
  expect(canvasBox.x + canvasBox.width).toBeLessThanOrEqual(box.x + box.width)
  expect(canvasBox.y + canvasBox.height).toBeLessThanOrEqual(box.y + box.height)
  await card.dispatchEvent('dragover', { dataTransfer: transfer, clientX: box.x + 30, clientY: box.y + box.height - 30 })
  await expect.poll(() => effect.evaluate((canvas) => {
    const element = canvas as HTMLCanvasElement
    const pixels = element.getContext('2d')!.getImageData(0, 0, element.width, element.height).data
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] > 20 && pixels[i + 1] > pixels[i] + 30 && pixels[i + 1] > pixels[i + 2] + 20) return true
    return false
  })).toBe(true)
  expect(await effect.evaluate((canvas) => (canvas as HTMLCanvasElement).getContext('2d')!.font)).toContain('11px')
  await page.screenshot({ path: '/tmp/viiiz-file-drag-symbols.png' })
  await heading.dispatchEvent('drop', { dataTransfer: transfer, clientX: 130, clientY: 390 })
  await expect(page.getByRole('heading', { name: 'Проверьте данные' })).toBeVisible()
  await expect(page.locator('.file-drop-effect')).toHaveCount(0)
  await transfer.dispose()
})

test('reduced motion retains the file-drop feedback without animating symbols', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/editor')
  const transfer = await droppedFile(page, [{ name: 'data.csv', bytes: Array.from(Buffer.from('x,y\nA,10')), type: 'text/csv' }])
  const heading = page.getByRole('heading', { name: 'Добавьте данные', exact: true })
  await heading.dispatchEvent('dragenter', { dataTransfer: transfer, clientX: 70, clientY: 350 })
  await expect(page.getByText('Отпустите файл для загрузки', { exact: true })).toBeVisible()
  await expect(page.locator('.file-drop-effect canvas')).not.toBeVisible()
  await heading.dispatchEvent('dragleave', { dataTransfer: transfer })
  await transfer.dispose()
})
