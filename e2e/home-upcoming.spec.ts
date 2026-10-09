import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('viiiz:home-intro-seen', '1'))
})

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  test(`upcoming logo draws in place and plays only once at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')
    const section = page.getByRole('region', { name: 'Скоро', exact: true })
    await expect(section).toHaveAttribute('data-animate', 'true')
    const logo = section.getByRole('img', { name: 'вииииз', exact: true })
    const verticals = logo.locator('.brand-logo-guide-vertical')
    const pixels = logo.locator('.brand-logo-pixel')
    await expect(pixels).toHaveCount(936)
    await expect(pixels.first()).toHaveCSS('opacity', '0')
    expect(await pixels.evaluateAll((cells) => cells.every((cell) => cell.getAttribute('fill') === '#FF5964'))).toBe(true)
    const centerPixel = pixels.nth(18 * 26 + 5)
    expect(Number(await centerPixel.getAttribute('fill-opacity'))).toBeGreaterThan(Number(await pixels.first().getAttribute('fill-opacity')))
    expect(await centerPixel.evaluate((cell) => parseFloat((cell as SVGElement).style.animationDelay))).toBeLessThan(await pixels.first().evaluate((cell) => parseFloat((cell as SVGElement).style.animationDelay)))
    expect(await pixels.evaluateAll((cells) => Math.max(...cells.map((cell) => Number(cell.getAttribute('y')))) - Math.min(...cells.map((cell) => Number(cell.getAttribute('y')))))).toBeGreaterThan(750)
    const guides = logo.locator('.brand-logo-guide-pair')
    expect(await guides.evaluateAll((pairs) => pairs.map((pair) => getComputedStyle(pair).transform))).toEqual(['none', 'none'])
    await page.evaluate(() => document.fonts.ready)
    await expect(verticals.first()).toHaveCSS('stroke-dashoffset', '1px')
    const scrollNear = async () => {
      await logo.evaluate((element) => {
        const top = element.getBoundingClientRect().top + scrollY
        window.scrollTo(0, top - innerHeight + 20)
      })
    }
    const scrollIntoView = async () => {
      await logo.evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        window.scrollTo(0, scrollY + bounds.top + bounds.height / 2 - innerHeight * 0.6)
      })
    }
    await scrollNear()
    await expect(verticals.first()).toHaveCSS('stroke-dashoffset', '1px')
    await scrollIntoView()
    await expect.poll(() => logo.evaluate((element) => element.getAnimations({ subtree: true }).some((animation) => animation.playState === 'running'))).toBe(true)
    const scrollPosition = await page.evaluate(() => scrollY)
    await expect.poll(() => verticals.first().evaluate((line) => parseFloat(getComputedStyle(line).strokeDashoffset))).toBeLessThan(0.9)
    const offsets = await verticals.evaluateAll((lines) => lines.map((line) => getComputedStyle(line).strokeDashoffset))
    expect(new Set(offsets).size).toBe(1)
    expect(await guides.evaluateAll((pairs) => pairs.map((pair) => getComputedStyle(pair).transform))).toEqual(['none', 'none'])
    await logo.evaluate((element) => element.getAnimations({ subtree: true }).forEach((animation) => {
      animation.pause()
      animation.currentTime = 1020
    }))
    const incoming = logo.locator('.brand-logo-incoming-line')
    await expect(incoming.first()).toHaveCSS('opacity', '1')
    const incomingHeight = await incoming.first().evaluate((line) => (line as SVGGraphicsElement).getBBox().height)
    expect(incomingHeight).toBeGreaterThan(350)
    expect(incomingHeight).toBeLessThan(450)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width)
    await page.screenshot({ path: `output/home-upcoming-incoming-${viewport.width}.png` })
    const initialTail = await incoming.first().evaluate((line) => ({
      length: parseFloat(getComputedStyle(line).strokeDasharray),
      start: -parseFloat(getComputedStyle(line).strokeDashoffset),
    }))
    await logo.evaluate((element) => element.getAnimations({ subtree: true }).forEach((animation) => { animation.currentTime = 1275 }))
    const shorterTail = await incoming.first().evaluate((line) => ({
      length: parseFloat(getComputedStyle(line).strokeDasharray),
      start: -parseFloat(getComputedStyle(line).strokeDashoffset),
    }))
    expect(shorterTail.length).toBeLessThan(initialTail.length)
    expect(shorterTail.start).toBeGreaterThan(initialTail.start)
    await expect(incoming.first()).toHaveCSS('opacity', '1')
    const latePositions = await logo.evaluate((element) => {
      const line = element.querySelector('.brand-logo-guide-diagonal')!
      const animation = line.getAnimations()[0]
      return [1037, 1122, 1292, 1377].map((time) => {
        animation.currentTime = time
        return parseFloat(getComputedStyle(line).strokeDashoffset)
      })
    })
    expect(latePositions[2] - latePositions[3]).toBeGreaterThan(latePositions[0] - latePositions[1])
    await logo.evaluate((element) => element.getAnimations({ subtree: true }).forEach((animation) => { animation.currentTime = 1386 }))
    expect(await logo.locator('.brand-logo-guide-draw').evaluateAll((lines) => lines.every((line) => parseFloat(getComputedStyle(line).strokeDashoffset) === 0))).toBe(true)
    expect(await logo.locator('.brand-logo-upcoming-solids path, .brand-logo-upcoming-edges .brand-logo-edge').evaluateAll((letters) => letters.every((letter) => getComputedStyle(letter).opacity === '0'))).toBe(true)
    expect(await pixels.evaluateAll((cells) => cells.every((cell) => getComputedStyle(cell).opacity === '0'))).toBe(true)
    await logo.evaluate((element) => element.getAnimations({ subtree: true }).forEach((animation) => animation.play()))
    await expect.poll(() => logo.evaluate((element) => element.getAnimations({ subtree: true }).every((animation) => animation.playState === 'finished'))).toBe(true)
    expect(await page.evaluate(() => scrollY)).toBe(scrollPosition)
    await expect(verticals.first()).toHaveCSS('stroke-dashoffset', '0px')
    await expect(incoming.first()).toHaveCSS('opacity', '0')
    await expect(logo.locator('.brand-logo-upcoming-solids path').first()).toHaveCSS('opacity', '1')
    expect(await pixels.evaluateAll((cells) => cells.every((cell) => getComputedStyle(cell).opacity === '1'))).toBe(true)
    await page.screenshot({ path: `output/home-upcoming-${viewport.width}.png` })
    const finishedTimes = await logo.evaluate((element) => element.getAnimations({ subtree: true }).map((animation) => animation.currentTime))
    await scrollNear()
    await expect(verticals.first()).toHaveCSS('stroke-dashoffset', '0px')
    await expect(logo.locator('.brand-logo-upcoming-solids path').first()).toHaveCSS('opacity', '1')
    await scrollIntoView()
    await expect(verticals.first()).toHaveCSS('stroke-dashoffset', '0px')
    expect(await logo.evaluate((element) => element.getAnimations({ subtree: true }).map((animation) => animation.currentTime))).toEqual(finishedTimes)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(section).toHaveAttribute('data-animate', 'false')
    expect(await logo.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await expect(section).toHaveAttribute('data-animate', 'false')
  })
}

test('reduced motion shows the complete logo on mobile without animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const section = page.getByRole('region', { name: 'Скоро', exact: true })
  await section.scrollIntoViewIfNeeded()
  await expect(section.getByRole('img')).toBeVisible()
  await expect(section).toHaveAttribute('data-animate', 'false')
  expect(await section.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0)
  await expect(section.locator('.brand-logo-guide-vertical').first()).toHaveCSS('stroke-dashoffset', '0px')
  await expect(section.locator('.brand-logo-pixel').first()).toHaveCSS('opacity', '1')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  await section.screenshot({ path: 'output/home-upcoming-mobile.png' })
})
