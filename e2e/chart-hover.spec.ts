import { expect, test } from '@playwright/test'

for (const kind of ['line', 'bar', 'area', 'stream-graph', 'scatter', 'pie', 'waffle', 'treemap', 'map-russia', 'sankey'] as const) {
  test(`${kind} keeps active colors and softly mutes peers without outlines`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route('**/src/main.tsx', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }))
    await page.goto('/editor')
    await page.evaluate(async (kind) => {
      await import('/src/index.css'); await import('/src/App.css')
      const fixture = await import('/src/test-fixtures/chartAudit.browser.tsx')
      fixture.renderConfig(kind, { showValues: false, showLegend: false, showDirectLabels: false })
    }, kind)
    const canvas = page.locator('#chart-audit-host .chart-canvas-shell')
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    await page.mouse.move(0, 0)
    const original = await canvas.locator('svg').evaluate((svg) => [...svg.querySelectorAll<SVGGeometryElement>('path,rect,circle,polygon')].filter((element) => !element.closest('defs')).map((element) => ({
      key: element.tagName + ['d', 'x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'points', 'transform'].map((key) => element.getAttribute(key)).join('|'),
      fill: element.getAttribute('fill'), stroke: element.getAttribute('stroke'), width: Number(element.getAttribute('stroke-width') ?? 1),
    })))
    const point = await canvas.locator('svg').evaluate((svg, kind) => {
      const ignored = ['none', 'transparent', '#fff', '#ffffff', '#202027', '#000', '#000000', '#d9d7df']
      for (const element of svg.querySelectorAll<SVGGeometryElement>('path,rect,circle,polygon')) {
        if (element.closest('defs') || Number(element.getAttribute('opacity') ?? 1) === 0 || Number(element.getAttribute('fill-opacity') ?? 1) === 0) continue
        if (kind === 'line' || kind === 'area') {
          const color = element.getAttribute('stroke')
          if (element.tagName !== 'path' || !color || ignored.includes(color) || Number(element.getAttribute('stroke-width') ?? 1) < 2 || element.getTotalLength() < 100) continue
          const point = element.getPointAtLength(element.getTotalLength() / 2).matrixTransform(element.getScreenCTM()!)
          return { x: point.x, y: point.y, color }
        }
        const color = element.getAttribute('fill'), bounds = element.getBoundingClientRect()
        if (!color || ignored.includes(color) || bounds.width < 4 || bounds.height < 4) continue
        const inverse = element.getScreenCTM()!.inverse()
        for (let row = 1; row < 5; row++) for (let column = 1; column < 5; column++) {
          const x = bounds.x + bounds.width * column / 5, y = bounds.y + bounds.height * row / 5
          if (element.isPointInFill(new DOMPoint(x, y).matrixTransform(inverse))) return { x, y, color }
        }
      }
      return null
    }, kind)
    expect(point).not.toBeNull()
    await page.mouse.move(point!.x, point!.y)
    await expect.poll(() => canvas.locator('svg').evaluate((svg, original) => [...svg.querySelectorAll('path,rect,circle,polygon')].filter((element) => !element.closest('defs')).some((element) => {
      const key = element.tagName + ['d', 'x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'points', 'transform'].map((key) => element.getAttribute(key)).join('|')
      const before = original.find((item) => item.key === key)
      return before && (before.fill !== element.getAttribute('fill') || before.stroke !== element.getAttribute('stroke'))
    }), original)).toBe(true)
    let activeColor = point!.color
    if (kind === 'map-russia') {
      const region = await page.locator('.chart-tooltip:visible .chart-tooltip-content b').first().innerText()
      activeColor = await page.evaluate(async (region) => {
        const { auditFixture } = await import('/src/test-fixtures/chartAudit.ts')
        const { getChartPlugin } = await import('/src/core/chartRegistry.ts')
        const fixture = auditFixture('map-russia'), scene = getChartPlugin('map-russia').compile(fixture.table, fixture.config)
        return scene.plot.regions.find((item: { name: string }) => item.name === region).color
      }, region)
    }
    expect(await canvas.locator('svg').evaluate((svg, color) => [...svg.querySelectorAll('path,rect,circle,polygon')].some((element) => element.getAttribute('fill') === color || element.getAttribute('stroke') === color), activeColor)).toBe(true)
    await page.mouse.move(0, 0)
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    expect(errors).toEqual([])
  })
}
