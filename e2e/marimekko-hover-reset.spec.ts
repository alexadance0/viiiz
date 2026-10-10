import { expect, test } from '@playwright/test'

for (const reducedMotion of ['reduce', 'no-preference'] as const) {
  test(`Marimekko clears the previous segment on hover transitions (${reducedMotion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion })
    await page.route('**/src/main.tsx', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }))
    await page.goto('/editor')
    await page.evaluate(async () => {
      await import('/src/index.css'); await import('/src/App.css')
      const fixture = await import('/src/test-fixtures/chartAudit.browser.tsx')
      fixture.renderInteractive('marimekko', { showValues: true, showLegend: false, showDirectLabels: false })
    })
    const canvas = page.locator('#chart-audit-host .chart-canvas-shell')
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    await page.mouse.move(0, 0)
    const svg = canvas.locator('.chart-canvas svg').first()
    const marks = await svg.evaluate((svg) => [...svg.querySelectorAll<SVGGeometryElement>('path,rect')].flatMap((element) => {
      const fill = element.getAttribute('fill'), bounds = element.getBoundingClientRect()
      if (!fill?.startsWith('#') || ['#fff', '#ffffff', '#202027', '#000', '#d9d7df'].includes(fill) || bounds.width < 15 || bounds.height < 15 || Number(element.getAttribute('opacity') ?? 1) === 0) return []
      return [{ key: element.tagName + ['d', 'x', 'y', 'width', 'height'].map((name) => element.getAttribute(name)).join('|'), fill: getComputedStyle(element).fill, x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }]
    }))
    expect(marks.length).toBeGreaterThan(2)
    const first = marks[0], other = marks.find((mark) => mark.fill !== first.fill)!
    expect(other).toBeTruthy()
    await page.mouse.click(first.x, first.y)
    for (const target of [first, other, first, other, first, other]) {
      await page.mouse.move(target.x, target.y)
      await expect.poll(() => svg.evaluate((svg, input) => {
        const current = [...svg.querySelectorAll('path,rect')].map((element) => ({ key: element.tagName + ['d', 'x', 'y', 'width', 'height'].map((name) => element.getAttribute(name)).join('|'), fill: getComputedStyle(element).fill }))
        return input.marks.every((mark) => {
          const painted = current.find((item) => item.key === mark.key)
          return painted && (mark.fill === input.color ? painted.fill === mark.fill : painted.fill !== mark.fill)
        })
      }, { marks, color: target.fill })).toBe(true)
    }
    for (const target of [first, other, first, other]) await page.mouse.move(target.x, target.y)
    await expect.poll(() => svg.evaluate((svg, marks) => {
      const otherColor = marks.find((mark) => mark.fill !== marks[0].fill)!.fill
      const current = [...svg.querySelectorAll('path,rect')].map((element) => ({ key: element.tagName + ['d', 'x', 'y', 'width', 'height'].map((name) => element.getAttribute(name)).join('|'), fill: getComputedStyle(element).fill }))
      return marks.every((mark) => {
        const painted = current.find((item) => item.key === mark.key)
        return painted && (mark.fill === otherColor ? painted.fill === mark.fill : painted.fill !== mark.fill)
      })
    }, marks)).toBe(true)
    await canvas.screenshot({ path: `output/marimekko-hover-reset-${reducedMotion}.png` })
    await page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).resetSelection())
    await page.mouse.move(0, 0)
    await expect.poll(() => svg.evaluate((svg, marks) => {
      const current = [...svg.querySelectorAll('path,rect')].map((element) => ({ key: element.tagName + ['d', 'x', 'y', 'width', 'height'].map((name) => element.getAttribute(name)).join('|'), fill: getComputedStyle(element).fill }))
      return marks.every((mark) => current.find((item) => item.key === mark.key)?.fill === mark.fill)
    }, marks)).toBe(true)
  })
}
