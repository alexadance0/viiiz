import { test, expect, type Page } from '@playwright/test'
import { mkdir, readFile } from 'node:fs/promises'

const output = 'output/chart-value-labels-2026-10-04'
async function mount(page: Page) {
  await page.setViewportSize({ width: 1250, height: 950 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/src/main.tsx', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }))
  await page.goto('/editor')
  await page.evaluate(async () => {
    await import('/src/index.css')
    await import('/src/App.css')
    await import('/src/test-fixtures/chartAudit.browser.tsx')
  })
  await mkdir(output, { recursive: true })
}
async function render(page: Page, kind: string, patch: object, leadingGap = false) {
  await page.evaluate(async ({ kind, patch, leadingGap }) => {
    const { renderConfig } = await import('/src/test-fixtures/chartAudit.browser.tsx')
    renderConfig(kind, { canvasWidth: 900, canvasHeight: 650, xField: 'category', yField: 'revenue', yFields: ['revenue'], aggregation: 'none', missingMode: 'gap', showLegend: false, showValues: true, valueLabelHideOverlap: false, showXAxisTitle: false, showYAxisTitle: false, palette: ['#550099'], ...patch }, { name: 'values', columns: ['category', 'revenue'], rows: [{ category: 'США', revenue: leadingGap ? null : 29.2 }, { category: 'Китай', revenue: 18.7 }, { category: 'Германия', revenue: 4.7 }] })
  }, { kind, patch, leadingGap })
  await expect(page.locator('#chart-audit-host .chart-canvas-shell')).toHaveAttribute('data-render-status', 'settled')
}
const valueTexts = (page: Page) => page.locator('#chart-audit-host svg text').filter({ hasText: /^(29,2|18,7|4,7)$/ })
async function values(page: Page) {
  return valueTexts(page).evaluateAll((nodes) => nodes.map((node) => {
    const r = node.getBoundingClientRect()
    return { text: node.textContent, x: r.x, y: r.y, width: r.width, height: r.height, fill: node.getAttribute('fill') }
  }))
}
async function exported(page: Page, name: string) {
  const download = page.waitForEvent('download')
  await page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).exportSvg())
  const path = `${output}/${name}.svg`
  await (await download).saveAs(path)
  const svg = await readFile(path, 'utf8')
  for (const value of ['29,2', '18,7', '4,7']) expect(svg.match(new RegExp(`>${value}<`, 'g')), value).toHaveLength(1)
}

test('inside left and right reserve the full value on opaque and translucent fills', async ({ page }) => {
  await mount(page)
  for (const position of ['inside-top', 'inside-bottom']) for (const opacity of [1, .1]) {
    await render(page, 'horizontal-bar', { barOrientation: 'horizontal', valueLabelPosition: position, barFillOpacity: opacity })
    const labels = await values(page)
    expect(labels).toHaveLength(3)
    const bars = await page.locator('#chart-audit-host svg path[fill="#550099"]').evaluateAll((nodes) => nodes.map((node) => {
      const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }
    }).filter((r) => r.width > 20 && r.height > 10))
    expect(bars).toHaveLength(3)
    for (const label of labels) {
      const bar = bars.find((bar) => Math.abs(bar.y + bar.height / 2 - label.y - label.height / 2) < 2)!
      expect(bar).toBeDefined()
      expect(label.x).toBeGreaterThanOrEqual(bar.x)
      expect(label.x + label.width).toBeLessThanOrEqual(bar.x + bar.width)
      expect(label.fill).toBe(opacity === 1 ? '#ffffff' : '#202027')
    }
    await exported(page, `${position}-${opacity}`)
    await page.locator('#chart-audit-host .chart-canvas-shell').screenshot({ path: `${output}/${position}-${opacity}.png` })
  }
})

test('absorbed values keep exactly one position through real hover and export', async ({ page }) => {
  await mount(page)
  for (const kind of ['bar', 'horizontal-bar', 'stacked-bar', 'horizontal-stacked-bar', 'normalized-stacked-bar', 'horizontal-normalized-stacked-bar']) {
    await render(page, kind, { barOrientation: kind.startsWith('horizontal') ? 'horizontal' : 'vertical', barValueLabelAbsorption: true, barValueLabelInsidePosition: 'end', barValueLabelOutsidePosition: 'end', showDirectLabels: true })
    const before = await values(page)
    // Normalized bars display percentages instead of absolute values.
    const text = page.locator('#chart-audit-host svg text')
    const beforeAll = (await text.allTextContents()).sort()
    if (!kind.includes('normalized')) expect(before).toHaveLength(3)
    const bar = page.locator('#chart-audit-host svg path[fill="#550099"]').first()
    const bounds = await bar.boundingBox()
    await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2)
    await expect(page.locator('#chart-audit-host .chart-canvas-shell')).toHaveAttribute('data-render-status', 'settled')
    for (const phase of ['hover', 'leave']) {
      if (phase === 'leave') {
        const revision = await page.locator('#chart-audit-host .chart-canvas-shell').getAttribute('data-render-revision')
        await page.mouse.move(1200, 900)
        await expect(page.locator('#chart-audit-host .chart-canvas-shell')).not.toHaveAttribute('data-render-revision', revision!)
        await expect(page.locator('#chart-audit-host .chart-canvas-shell')).toHaveAttribute('data-render-status', 'settled')
      }
      await expect.poll(async () => (await text.allTextContents()).sort()).toEqual(beforeAll)
      expect(await values(page)).toEqual(before)
      const paintOrder = await page.locator('#chart-audit-host svg').evaluate((svg) => {
        const elements = [...svg.querySelectorAll('path, text')]
        return elements.flatMap((node, index) => {
          if (node.tagName !== 'text' || !/^(29,2|18,7|4,7|100%)$/.test(node.textContent ?? '')) return []
          const text = node.getBoundingClientRect()
          const coveringBar = elements.findIndex((candidate) => {
            if (candidate.getAttribute('fill') !== '#550099') return false
            const bar = candidate.getBoundingClientRect()
            return bar.left <= text.left && bar.right >= text.right && bar.top <= text.top && bar.bottom >= text.bottom
          })
          return coveringBar < 0 ? [] : [{ text: node.textContent, aboveBar: index > coveringBar }]
        })
      })
      expect(paintOrder.length).toBeGreaterThan(0)
      for (const label of paintOrder) expect(label.aboveBar, `${kind}/${phase}: ${label.text} paints above its bar`).toBe(true)
    }
    if (!kind.includes('normalized')) await exported(page, `${kind}-hover`)
    await page.locator('#chart-audit-host .chart-canvas-shell').screenshot({ path: `${output}/${kind}-hover.png` })
    await page.mouse.move(1200, 900)
  }
})

test('direct series guides coexist with every value without absorption on both orientations', async ({ page }) => {
  await mount(page)
  for (const kind of ['bar', 'horizontal-bar']) for (const side of ['left', 'right']) {
    await render(page, kind, { barOrientation: kind.startsWith('horizontal') ? 'horizontal' : 'vertical', barValueLabelAbsorption: false, showDirectLabels: true, yAxisPosition: side })
    await expect(valueTexts(page)).toHaveCount(3)
    await expect(page.locator('#chart-audit-host svg text').filter({ hasText: /^revenue$/ })).toHaveCount(1)
    await exported(page, `${kind}-direct-${side}`)
  }
})

test('line direct guides preserve endpoint values on either side and after leading gaps', async ({ page }) => {
  await mount(page)
  for (const kind of ['line', 'spline', 'area', 'stacked-area']) for (const side of ['left', 'right']) for (const leadingGap of [false, true]) {
    await render(page, kind, { showDirectLabels: true, yAxisPosition: side }, leadingGap)
    await expect(valueTexts(page)).toHaveCount(leadingGap ? 2 : 3)
    await expect(page.locator('#chart-audit-host svg text').filter({ hasText: /^revenue$/ })).toHaveCount(1)
    if (!leadingGap) await exported(page, `${kind}-direct-${side}`)
  }
})
