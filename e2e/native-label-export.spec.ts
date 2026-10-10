import { expect, test } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const { PNG } = require(join(dirname(require.resolve('playwright-core')), 'lib/utilsBundle.js'))
const directory = 'output/native-label-export'

for (const kind of ['waffle', 'pie', 'line', 'treemap'] as const) test(`${kind} labels preserve spaces and rounded outlines in editor, SVG and PNG`, async ({ page, context }) => {
  await mkdir(directory, { recursive: true })
  await page.setViewportSize({ width: 1040, height: 790 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/src/main.tsx', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }))
  await page.goto('/editor')
  await page.evaluate(async (kind) => {
    await import('/src/index.css')
    await import('/src/App.css')
    const { renderConfig } = await import('/src/test-fixtures/chartAudit.browser.tsx')
    const { auditFixture } = await import('/src/test-fixtures/chartAudit.ts')
    const labelStyle = { ...auditFixture(kind).config.valueText, fontFamily: 'Onest, sans-serif', size: 36 }
    renderConfig(kind, { canvasWidth: 1000, canvasHeight: 750, xField: 'category', yField: 'value', yFields: ['value'], seriesField: '', aggregation: 'none', palette: ['#db5a5a', '#1677a6'], showTitle: false, showSubtitle: false, showNote: false, showSource: false, showLegend: false, showValues: true, showXAxisTitle: false, showYAxisTitle: false,
      valueText: labelStyle, waffleLabelPosition: 'inside', waffleShowValues: false, waffleLabelBackground: true, waffleLabelColor: 'text', pieLabelPosition: 'inside', pieShowNames: true, treemapSubcategoryField: kind === 'treemap' ? 'leaf' : '', treemapShowGroupLabels: true, treemapShowLeafLabels: true,
      elementStyles: { 'value\u001fstring:МММ   ё···…': { label: 'МММ   ё···…', showLabel: true } },
    }, { name: 'labels', columns: ['category', 'value', 'leaf'], rows: [{ category: 'МММ   ё···…', value: 64, leaf: 'Блок   ё: :::' }, { category: 'М   ё', value: 32, leaf: 'Блок   М.' }] })
  }, kind)
  const shell = page.locator('#chart-audit-host .chart-canvas-shell')
  await expect(shell).toHaveAttribute('data-render-status', 'settled')
  const labels = shell.locator('.chart-canvas svg text').filter({ hasText: /МММ|ё/ })
  expect(await labels.count()).toBeGreaterThan(0)
  await expect(labels.first()).toHaveCSS('white-space', 'pre')
  await expect(labels.first()).toHaveCSS('stroke-linejoin', 'round')
  if (kind === 'waffle') expect(await shell.locator('.chart-canvas svg text[stroke]').count()).toBeGreaterThan(0)
  const regions = await labels.evaluateAll((nodes) => nodes.map((node) => {
    const canvas = node.closest('.chart-canvas-shell')!.getBoundingClientRect(), box = node.getBoundingClientRect()
    const pad = Math.max(12, Number.parseFloat(getComputedStyle(node).strokeWidth) / 2 + 2)
    return { x: box.x - canvas.x - pad, y: box.y - canvas.y - pad, right: box.right - canvas.x + pad, bottom: box.bottom - canvas.y + pad }
  }))
  const preview = PNG.sync.read(await shell.screenshot({ path: `${directory}/${kind}-editor.png`, animations: 'disabled' }))
  const results: Record<string, number> = {}
  for (const format of ['svg', 'png']) {
    const download = page.waitForEvent('download')
    await page.evaluate(async (format) => { const fixture = await import('/src/test-fixtures/chartAudit.browser.tsx'); await (format === 'svg' ? fixture.exportSvg() : fixture.exportPng()) }, format)
    const path = `${directory}/${kind}.${format}`
    await (await download).saveAs(path)
    let buffer: Buffer
    if (format === 'svg') {
      const source = await readFile(path, 'utf8')
      const exported = await context.newPage()
      await exported.setViewportSize({ width: 1040, height: 790 })
      await exported.setContent(`<style>body{margin:0}svg{display:block}</style>${source}`)
      await exported.evaluate(() => document.fonts.ready)
      await expect(exported.locator('svg text').filter({ hasText: /МММ|ё/ }).first()).toHaveCSS('stroke-linejoin', 'round')
      buffer = await exported.locator('svg').screenshot({ path: `${directory}/${kind}-svg.png` })
      await exported.close()
    } else buffer = await readFile(path)
    const image = PNG.sync.read(buffer)
    expect([image.width, image.height]).toEqual([preview.width, preview.height])
    let difference = 0, labelDifference = 0, labelPixels = 0
    for (let offset = 0; offset < image.data.length; offset += 4) {
      const x = offset / 4 % image.width, y = Math.floor(offset / 4 / image.width)
      const inLabel = regions.some((region) => x >= region.x && x <= region.right && y >= region.y && y <= region.bottom)
      if (inLabel) labelPixels++
      if (Math.max(...[0, 1, 2].map((channel) => Math.abs(image.data[offset + channel] - preview.data[offset + channel]))) > 24) { difference++; if (inLabel) labelDifference++ }
    }
    results[format] = difference / (image.width * image.height)
    results[`${format}Labels`] = labelDifference / labelPixels
  }
  await writeFile(`${directory}/${kind}-comparison.json`, JSON.stringify(results, null, 2))
  // Pie arc edges can rasterize differently; the labels themselves must match.
  expect(results.svgLabels).toBeLessThan(.0001)
  expect(results.pngLabels).toBeLessThan(.0001)
  if (kind !== 'pie') { expect(results.svg).toBeLessThan(.0001); expect(results.png).toBeLessThan(.0001) }
})
