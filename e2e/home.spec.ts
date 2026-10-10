import { expect, test } from '@playwright/test'

test('home hero renders the symbol trail and click impulse', async ({ page }) => {
  await page.goto('/')
  const heading = page.getByRole('heading', { name: /виииз/i })
  await expect(heading).toBeVisible()
  await expect(page.getByText('Визуализация данных без кода')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Посмотреть возможности' })).toHaveCount(0)
  await expect(page.getByText('Проведите курсором')).toHaveCount(0)

  const canvas = page.locator('.symbol-trail-canvas')
  const box = await canvas.boundingBox()
  expect(box?.width).toBeGreaterThan(300)
  expect(box?.height).toBeGreaterThan(500)

  await page.mouse.move(100, 270)
  await page.mouse.move(1_100, 270, { steps: 18 })
  await page.mouse.move(1_100, 365)
  await page.mouse.move(100, 365, { steps: 18 })
  await page.mouse.move(100, 440)
  await page.mouse.move(1_100, 440, { steps: 18 })
  await page.waitForTimeout(100)

  const hasVisiblePixels = await canvas.evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext('2d')
    return context ? context.getImageData(0, 0, element.width, element.height).data.some((channel, index) => index % 4 === 3 && channel > 0) : false
  })
  expect(hasVisiblePixels).toBe(true)

  const headingBox = await heading.evaluate((element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    const bounds = range.getBoundingClientRect()
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
  })
  const hasTrailBehindHeading = await canvas.evaluate((element: HTMLCanvasElement, bounds) => {
    const context = element.getContext('2d')
    const canvasBounds = element.getBoundingClientRect()
    if (!context) return false
    const scaleX = element.width / canvasBounds.width
    const scaleY = element.height / canvasBounds.height
    const x = Math.ceil((bounds.x - canvasBounds.x) * scaleX) + 1
    const y = Math.ceil((bounds.y - canvasBounds.y) * scaleY) + 1
    const width = Math.floor(bounds.width * scaleX) - 2
    const height = Math.floor(bounds.height * scaleY) - 2
    const pixels = context.getImageData(x, y, width, height).data
    return pixels.some((channel, index) => index % 4 === 3 && channel > 0)
  }, headingBox)
  expect(hasTrailBehindHeading).toBe(true)

  await page.mouse.move(250, 200)
  await page.waitForTimeout(1_400)
  await page.mouse.click(250, 200)
  await page.waitForTimeout(120)
  const clickCreatesImpulse = await canvas.evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext('2d')
    if (!context) return false
    const scaleX = element.width / element.getBoundingClientRect().width
    const scaleY = element.height / element.getBoundingClientRect().height
    const pixels = context.getImageData(50 * scaleX, 0, 400 * scaleX, 400 * scaleY).data
    return pixels.some((channel, index) => index % 4 === 3 && channel > 0)
  })
  expect(clickCreatesImpulse).toBe(true)
})

test('process section connects four workflow stages with the scroll stream', async ({ page }) => {
  await page.goto('/')
  const headings = [
    'Загрузите данные',
    'Проверьте и подготовьте данные',
    'Выберите подходящий график',
    'Настройте визуализацию',
  ]
  for (const name of headings) await expect(page.getByRole('heading', { name })).toBeAttached()
  await expect(page.getByText('Четыре этапа')).toHaveCount(0)
  const stream = page.locator('.process-stream-symbols')
  await expect(stream.locator('text').first()).toBeAttached()
  await page.getByRole('heading', { name: headings[1] }).scrollIntoViewIfNeeded()
  await expect(page.locator('.process-preview').nth(1)).toHaveCSS('opacity', '1')
  await expect(stream.locator('.process-stream-source').first()).toBeAttached()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await page.getByRole('heading', { name: headings[1] }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(120)
  const secondStage = page.locator('[data-process-stage]').nth(1)
  const copyBox = await secondStage.locator('.process-copy').boundingBox()
  const previewBox = await secondStage.locator('.process-preview').boundingBox()
  expect(previewBox?.y).toBeGreaterThan(copyBox?.y ?? Infinity)
})

test('chart gallery runs three alternating vertical marquees and pauses on hover', async ({ page }) => {
  await page.goto('/')
  const gallery = page.locator('.chart-gallery-section')
  await gallery.scrollIntoViewIfNeeded()
  await expect(page.getByRole('region', { name: 'Примеры графиков' })).toBeVisible()
  await expect(gallery.locator('.chart-marquee')).toHaveCount(3)
  await expect(gallery.locator('.chart-marquee-group')).toHaveCount(6)

  const firstMarquee = gallery.locator('.chart-marquee').first()
  const firstCard = firstMarquee.locator('.chart-gallery-card').first()
  await firstMarquee.hover()
  await firstCard.hover()
  await expect(gallery.locator('.chart-marquee-track').first()).toHaveCSS('animation-play-state', 'paused')
  await expect(firstCard).toHaveCSS('opacity', '1')
  await expect(firstCard.locator('img')).toHaveAttribute('src', '/chart-gallery/01.png')
})
