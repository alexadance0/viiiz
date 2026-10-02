import { expect, test } from '@playwright/test'

test.use({ deviceScaleFactor: 2 })

test('stream remains fixed to the cards while scrolling and adapts to mobile', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const stream = page.locator('.process-stream-symbols')
  await expect(stream.locator('text').first()).toBeAttached()
  await expect(page.locator('.home-intro')).toHaveCount(0)
  await expect(page.getByText('Весь путь — в одном редакторе, без кода и переключения между инструментами.')).toHaveCount(0)
  await page.evaluate(() => document.fonts.ready)
  const screenshots = page.locator('.process-preview img')
  await expect(screenshots).toHaveCount(4)
  for (const screenshot of await screenshots.all()) {
    await screenshot.scrollIntoViewIfNeeded()
    await expect.poll(() => screenshot.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 2000 && image.naturalHeight === 1520)).toBe(true)
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const tile = stream.locator('rect').first()
  expect(await tile.getAttribute('width')).toBe(await tile.getAttribute('height'))

  for (const width of [1280, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await expect.poll(() => stream.getAttribute('width')).toBe(String(width))
    await expect(page.locator('.process-number')).toHaveText(['1', '2', '3', '4'])
    expect(await stream.locator('.process-stream-source').count()).toBeGreaterThan(5)
    const centered = await page.locator('.process-stage-heading').evaluateAll((headings) => headings.every((heading) => {
      const number = heading.querySelector('.process-number')!.getBoundingClientRect()
      const title = heading.querySelector('h3')!.getBoundingClientRect()
      return Math.abs(number.top + number.height / 2 - title.top - title.height / 2) < 1
    }))
    expect(centered).toBe(true)
    await page.locator('.process-preview').first().scrollIntoViewIfNeeded()
    const before = await stream.evaluate((node) => node.innerHTML)
    const position = await stream.locator('text').first().evaluate((node) => {
      const box = node.getBoundingClientRect()
      return { x: box.x, y: box.y + scrollY }
    })
    await page.evaluate(() => window.scrollBy(0, 137))
    await page.waitForTimeout(150)
    expect(await stream.evaluate((node) => node.innerHTML)).toBe(before)
    expect(await stream.locator('text').first().evaluate((node) => {
      const box = node.getBoundingClientRect()
      return { x: box.x, y: box.y + scrollY }
    })).toEqual(position)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    if (width === 1280) {
      await page.evaluate(() => {
        const box = document.querySelector('.process-preview')!.getBoundingClientRect()
        window.scrollBy(0, box.bottom - 240)
      })
    } else await page.locator('.process-preview').first().scrollIntoViewIfNeeded()
    await page.screenshot({ path: `/tmp/branching-process-${width}.png` })
    await page.locator('.process-stage').first().screenshot({ path: `/tmp/branching-opening-${width}.png` })
    await page.locator('.process-stage').last().screenshot({ path: `/tmp/process-interface-${width}.png` })
    await page.evaluate(() => document.querySelector('.process-section')!.scrollIntoView())
    await page.screenshot({ path: `/tmp/adjusted-intro-${width}.png` })
  }
})

test('hero trail responds to the pointer with the same typography as the stream', async ({ page }) => {
  await page.goto('/')
  const streamText = page.locator('.process-stream-symbols text').first()
  await expect(streamText).toBeAttached()
  await expect(page.locator('.home-intro')).toHaveCount(0, { timeout: 10_000 })
  const font = await streamText.evaluate((node) => getComputedStyle(node).font)
  await page.mouse.move(170, 210)
  await page.mouse.move(360, 310, { steps: 15 })
  const hero = page.locator('.symbol-trail-canvas')
  await expect.poll(() => hero.evaluate((node: HTMLCanvasElement) => node.getContext('2d')!.font)).toBe(font)
  await expect.poll(() => hero.evaluate((node: HTMLCanvasElement) => {
    const pixels = node.getContext('2d')!.getImageData(0, 0, node.width, node.height).data
    return pixels.some((value, index) => index % 4 === 3 && value > 0)
  })).toBe(true)
  await page.screenshot({ path: '/tmp/unified-hero-symbols.png' })
})
