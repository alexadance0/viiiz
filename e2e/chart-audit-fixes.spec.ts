import { test, expect } from '@playwright/test'

const mount = async (page: import('@playwright/test').Page) => {
  await page.setViewportSize({ width: 1100, height: 850 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  // No App preload: this page starts with only the modules requested by ChartCanvas.
  await page.route('**/src/main.tsx', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }))
  await page.goto('/editor')
  await page.evaluate(async () => {
    await import('/src/index.css')
    await import('/src/App.css')
    await import('/src/test-fixtures/chartAudit.browser.tsx')
  })
}

test('moving average scatter renders on a cold module load', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', (error) => errors.push(error.message))
  await mount(page)
  await page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).renderConfig('moving-average-scatter', {}))
  await expect(page.locator('#chart-audit-host .chart-canvas-shell')).toHaveAttribute('data-render-status', 'settled')
  expect(errors).toEqual([])
})

test('shared plain text alignment stays inside the canvas for every chart', async ({ page }) => {
  test.setTimeout(120_000)
  await mount(page)
  await page.evaluate(async () => (await import('/src/components/echarts/loadEchartsForKind.ts')).preloadAllEcharts())
  const failures = await page.evaluate(async () => {
    const { catalog, renderConfig, textBounds } = await import('/src/test-fixtures/chartAudit.browser.tsx')
    const { auditFixture } = await import('/src/test-fixtures/chartAudit.ts')
    const failures: unknown[] = []
    for (const { id } of catalog) for (const align of ['left', 'center', 'right']) {
      const config = auditFixture(id).config
      const patch = Object.fromEntries(['title', 'subtitle', 'note', 'source'].map((field) => [`${field}Text`, { ...config[`${field}Text`], align }]))
      renderConfig(id, patch)
      await new Promise<void>((resolve, reject) => {
        const deadline = Date.now() + 10_000
        const poll = () => {
          if (document.querySelector('#chart-audit-host .chart-canvas-shell')?.getAttribute('data-render-status') === 'settled') resolve()
          else if (Date.now() > deadline) reject(new Error(`${id}: render timeout`))
          else setTimeout(poll, 10)
        }
        poll()
      })
      const outside = textBounds().filter((item) => item.outside && /^(Заголовок|Подзаголовок|Примечание|Источник)/.test(item.text))
      if (outside.length) failures.push({ id, align, outside })
    }
    return failures
  })
  expect(failures).toEqual([])
})

test('horizontal category labels use the available rail on a narrow canvas', async ({ page }) => {
  await mount(page)
  await page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).render('horizontal-bar', 'combined-narrow-wrap'))
  const shell = page.locator('#chart-audit-host .chart-canvas-shell')
  await expect(shell).toHaveAttribute('data-render-status', 'settled')
  const texts = await page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).textBounds())
  const categories = texts.filter((item) => /^Категория \d$/.test(item.text))
  expect(categories).toHaveLength(6)
  expect(categories.every((item) => !item.outside)).toBe(true)
  for (let index = 1; index < categories.length; index++) expect(categories[index].y).toBeGreaterThan(categories[index - 1].y + categories[index - 1].height)
})

test('formatted text preserves fragment size, weight and background after editing', async ({ page }) => {
  await mount(page)
  await page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).renderConfig('bar', {
    title: 'Жирный крупный', titleHtml: '<p><span style="font-weight:900;background-color:rgba(219,90,90,.5)">Жирный</span> <span style="font-size:32px">крупный</span></p>',
  }))
  const shell = page.locator('#chart-audit-host .chart-canvas-shell')
  await expect(shell).toHaveAttribute('data-render-status', 'settled')
  const display = shell.locator('.canvas-rich-text-display')
  await expect(display.locator('text').filter({ hasText: /^Жирный$/ })).toHaveAttribute('font-weight', '900')
  await expect(display.locator('text').filter({ hasText: /^крупный$/ })).toHaveAttribute('font-size', '32')
  await expect(display.locator('rect[fill]').first()).toHaveAttribute('fill', 'rgba(219, 90, 90, 0.5)')
})
