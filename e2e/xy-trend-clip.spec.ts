import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

for (const kind of ['scatter', 'bubble', 'connected-scatter']) test(`${kind} clips confidence bands and trend lines in preview and SVG export`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/src/main.tsx', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }))
  await page.goto('/editor')
  await page.evaluate(async (kind) => {
    await import('/src/index.css')
    await import('/src/App.css')
    const { renderConfig } = await import('/src/test-fixtures/chartAudit.browser.tsx')
    renderConfig(kind, { xField: 'x', yField: 'y', yFields: ['y'], scatterSizeField: 'size', scatterTrendline: true, scatterTrendBand: true, scatterTrendColor: '#9b5803', scatterTrendBandOpacity: .25, xAxisMin: '20', xAxisMax: '80', yAxisMin: '20', yAxisMax: '80', showValues: false, scatterShowLabels: false, showLegend: false }, { name: 'Trend', columns: ['x', 'y', 'size'], rows: [{ x: 30, y: 10, size: 2 }, { x: 40, y: 35, size: 3 }, { x: 50, y: 40, size: 4 }, { x: 60, y: 65, size: 5 }, { x: 70, y: 70, size: 6 }] })
  }, kind)
  const canvas = page.locator('#chart-audit-host .chart-canvas-shell')
  await expect(canvas).toHaveAttribute('data-render-status', 'settled')
  const inspect = (svg: string) => {
    const document = new DOMParser().parseFromString(svg, 'image/svg+xml')
    return [...document.querySelectorAll('path')].filter((node) => node.getAttribute('fill') === '#9b5803' || node.getAttribute('stroke') === '#9b5803').map((node) => {
      let parent: Element | null = node
      while (parent && !parent.hasAttribute('clip-path')) parent = parent.parentElement
      const id = parent?.getAttribute('clip-path')?.match(/#([^)]*)/)?.[1]
      const shape = id ? document.getElementById(id)?.firstElementChild : null
      return { d: node.getAttribute('d'), clip: shape?.outerHTML ?? null }
    })
  }
  const preview = await canvas.locator('svg').evaluate((node) => node.outerHTML)
  const layers = await page.evaluate(inspect, preview)
  expect(layers).toHaveLength(2)
  expect(layers.every((layer) => layer.clip)).toBe(true)
  // The interval really extends above and below the plot; clipping must hide it,
  // rather than changing the regression or clamping its confidence bounds.
  const band = layers[0]
  const values = [...band.d!.matchAll(/[ML]\s*([-\d.e]+)[ ,]+([-\d.e]+)/gi)].map((match) => ({ x: Number(match[1]), y: Number(match[2]) }))
  const rectangle = band.clip!.match(/M[-\d.e]+ ([-\d.e]+)l[-\d.e]+ 0l0 ([-\d.e]+)/)!
  const edge = [Number(rectangle[1]), Number(rectangle[1]) + Number(rectangle[2])]
  expect(Math.min(...values.map((point) => point.y))).toBeLessThan(Math.min(...edge))
  expect(Math.max(...values.map((point) => point.y))).toBeGreaterThan(Math.max(...edge))
  await page.screenshot({ path: `/tmp/viiiz-${kind}-trend-clipped.png` })
  const download = page.waitForEvent('download')
  await page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).exportSvg())
  const svg = await readFile((await (await download).path())!, 'utf8')
  expect(await page.evaluate(inspect, svg)).toEqual(layers)
})
