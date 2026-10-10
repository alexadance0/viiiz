import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

for (const side of ['top', 'bottom', 'left', 'right'] as const) {
  test(`discrete tile-map scale at ${side} has joined bands, boundary ticks and an independent missing sample`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.route('**/src/main.tsx', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }))
    await page.goto('/editor')
    await page.evaluate(async (position) => {
      await import('/src/index.css'); await import('/src/App.css')
      const { renderConfig } = await import('/src/test-fixtures/chartAudit.browser.tsx')
      renderConfig('tilemap-russia', { xField: 'territory', yField: 'value', yFields: ['value'], aggregation: 'none', showValues: false, showLegend: true, mapShowNames: true, legendPosition: position, colorEncoding: { mode: 'bins', field: 'value', thresholds: [50, 100], binColors: ['#2196f3', '#a800ff', '#ff6666'], missingLabel: 'н/д', missingPattern: 'diagonal' } }, { name: 'Discrete scale', columns: ['territory', 'value'], rows: [{ territory: 'RU-MOW', value: 0 }, { territory: 'RU-SVE', value: 50 }, { territory: 'RU-BA', value: 108 }] })
    }, side)
    const canvas = page.locator('#chart-audit-host .chart-canvas-shell')
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    const bands = await canvas.locator('svg path').evaluateAll((nodes) => ['#2196f3', '#a800ff', '#ff6666'].map((color) => {
      const paths = nodes.filter((node) => node.getAttribute('fill') === color && (!node.hasAttribute('stroke') || node.getAttribute('stroke') === 'none') && !node.closest('defs'))
      if (paths.length !== 1) throw new Error(`Expected one scale band for ${color}, found ${paths.length}`)
      const bounds = (paths[0] as SVGGraphicsElement).getBBox()
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, path: paths[0].getAttribute('d')! }
    }))
    if (side === 'top' || side === 'bottom') {
      expect(bands[0].x + bands[0].width).toBeCloseTo(bands[1].x, 1)
      expect(bands[1].x + bands[1].width).toBeCloseTo(bands[2].x, 1)
      expect(bands[2].width / bands[0].width).toBeCloseTo(8 / 50, 2)
    } else {
      expect(bands[1].y + bands[1].height).toBeCloseTo(bands[0].y, 1)
      expect(bands[2].y + bands[2].height).toBeCloseTo(bands[1].y, 1)
    }
    for (const label of ['0', '50', '100', 'н/д']) await expect(canvas.locator('svg text').filter({ hasText: new RegExp(`^${label}$`) })).toHaveCount(1)
    const texts = await canvas.locator('svg text').evaluateAll((nodes) => nodes.map((node) => node.textContent))
    expect(texts.some((text) => /Менее|и более/.test(text ?? ''))).toBe(false)
    await canvas.screenshot({ path: `/tmp/viiiz-discrete-scale-${side}.png` })
    const svgDownload = page.waitForEvent('download')
    await page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).exportSvg())
    const svg = await readFile((await (await svgDownload).path())!, 'utf8')
    for (const band of bands) expect(svg).toContain(band.path)
    expect(svg).toContain('н/д')
    expect(svg).toContain('<pattern')
    if (side === 'bottom') {
      const pngDownload = page.waitForEvent('download')
      await page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).exportPng())
      expect((await readFile((await (await pngDownload).path())!)).subarray(1, 4).toString()).toBe('PNG')
    }
  })
}

test('continuous heatmap scale retains its original geometry on all sides', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/src/main.tsx', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }))
  await page.goto('/editor')
  await page.evaluate(async () => { await import('/src/index.css'); await import('/src/App.css') })
  const canvas = page.locator('#chart-audit-host .chart-canvas-shell')
  for (const side of ['top', 'bottom', 'left', 'right'] as const) {
    const expected = await page.evaluate(async (position) => {
      const { renderConfig } = await import('/src/test-fixtures/chartAudit.browser.tsx')
      const { auditFixture } = await import('/src/test-fixtures/chartAudit.ts')
      const { getChartPlugin } = await import('/src/core/chartRegistry.ts')
      const { resolveNativeScene } = await import('/src/features/chart-renderer/echarts/renderScene.ts')
      const table = { name: 'Continuous', columns: ['category', 'value'], rows: [{ category: 'A', value: 0 }, { category: 'B', value: 50 }, { category: 'C', value: 100 }] }
      const patch = { xField: 'category', yField: 'value', yFields: ['value'], heatmapScalePosition: position, showValues: false }
      renderConfig('heatmap', patch, table)
      const scene = resolveNativeScene(getChartPlugin('heatmap').compile(table, { ...auditFixture('heatmap').config, ...patch, autoFitCanvas: false }))
      const plot = scene.geometry.plot, rail = scene.geometry.reservations['guide:color-scale']
      const vertical = position === 'left' || position === 'right'
      const width = Math.min(360, plot.width * .6), height = Math.min(plot.height, Math.max(90, Math.min(360, plot.height * .6)))
      return vertical ? { x: position === 'left' ? rail.x + 8 : rail.x + rail.width - 20, y: plot.y + (plot.height - height) / 2, width: 12, height } : { x: plot.x + (plot.width - width) / 2, y: position === 'top' ? rail.y + rail.height - 20 : rail.y + 8, width, height: 12 }
    }, side)
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    const bounds = await canvas.locator('svg path').evaluateAll((nodes) => {
      const paths = nodes.filter((node) => node.getAttribute('fill')?.startsWith('url(') && !node.closest('defs'))
      if (paths.length !== 1) throw new Error(`Expected one gradient, found ${paths.length}`)
      const rect = (paths[0] as SVGGraphicsElement).getBBox()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    })
    for (const key of ['x', 'y', 'width', 'height'] as const) expect(bounds[key]).toBeCloseTo(expected[key], 1)
  }
})
