import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('dense spline has no per-sample plateaus and exports the same curve', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/src/main.tsx', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }))
  await page.goto('/editor')
  await page.evaluate(async () => {
    await import('/src/index.css')
    await import('/src/App.css')
    const { renderConfig } = await import('/src/test-fixtures/chartAudit.browser.tsx')
    renderConfig('spline', { xField: 'period', yField: 'value', yFields: ['value'], showValues: false, showLegend: false, showDirectLabels: false, showPointMarkers: false }, { name: 'Dense slope', columns: ['period', 'value'], rows: Array.from({ length: 60 }, (_, i) => ({ period: `${i + 1}`, value: i * 2 + 10 })) })
  })
  const canvas = page.locator('#chart-audit-host .chart-canvas-shell')
  await expect(canvas).toHaveAttribute('data-render-status', 'settled')
  const curves = await canvas.locator('svg path').evaluateAll((nodes) => nodes.filter((node) => node.getAttribute('fill') === 'none' && Number(node.getAttribute('stroke-opacity') ?? 1) > 0 && /C/.test(node.getAttribute('d') ?? '')).map((node) => node.getAttribute('d')!))
  expect(curves.length).toBeGreaterThan(0)
  for (const path of curves) {
    const segments = [...path.matchAll(/C([^CLMZ]+)/g)].map((match) => match[1].trim().split(/[\s,]+/).map(Number))
    expect(segments.length).toBeGreaterThan(20)
    for (const [x1, y1, x2, y2, x, y] of segments.slice(1, -1)) {
      expect(Math.abs(y - y2)).toBeGreaterThan(.1)
      expect(Math.abs((y2 - y1) / (x2 - x1) - (y - y2) / (x - x2))).toBeLessThan(.03)
    }
  }
  await canvas.screenshot({ path: '/tmp/viiiz-dense-spline.png' })
  const download = page.waitForEvent('download')
  await page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).exportSvg())
  const svg = await readFile((await (await download).path())!, 'utf8')
  for (const path of curves) expect(svg).toContain(path)
})
