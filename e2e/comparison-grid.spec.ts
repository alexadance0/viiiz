import { expect, test } from '@playwright/test'

test('comparison diagrams independently draw category and value grids in both orientations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/src/main.tsx', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }))
  await page.goto('/editor')
  await page.evaluate(async () => {
    await import('/src/index.css')
    await import('/src/App.css')
    await import('/src/test-fixtures/chartAudit.browser.tsx')
  })
  for (const kind of ['horizontal-lollipop', 'dumbbell', 'lollipop']) for (const horizontal of [false, true]) for (const vertical of [false, true]) {
    await page.evaluate(async ({ kind, horizontal, vertical }) => {
      const { renderConfig } = await import('/src/test-fixtures/chartAudit.browser.tsx')
      renderConfig(kind, { showHorizontalGrid: horizontal, showVerticalGrid: vertical, gridColor: '#c94f91', dumbbellConnectorColor: '#111111', showValues: false })
    }, { kind, horizontal, vertical })
    await expect(page.locator('#chart-audit-host .chart-canvas-shell')).toHaveAttribute('data-render-status', 'settled')
    const lines = await page.locator('#chart-audit-host svg path[stroke="#c94f91"]').evaluateAll((nodes) => nodes.map((node) => (node as SVGGraphicsElement).getBBox()).reduce((counts, rect) => {
      if (rect.width > 10 && rect.height < 1) counts.horizontal++
      if (rect.height > 10 && rect.width < 1) counts.vertical++
      return counts
    }, { horizontal: 0, vertical: 0 }))
    expect(lines.horizontal > 0, `${kind}: horizontal=${horizontal}`).toBe(horizontal)
    expect(lines.vertical > 0, `${kind}: vertical=${vertical}`).toBe(vertical)
  }
})

test('all horizontal chart types start with a vertical grid in the editor', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/editor')
  await page.getByRole('button', { name: /^Временной ряд$/ }).click()
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  const labels = await page.evaluate(async () => {
    const { chartRegistry } = await import('/src/core/chartRegistry.ts')
    return chartRegistry.filter((chart) => chart.category === 'bar-horizontal' || chart.id === 'dumbbell').map((chart) => chart.label)
  })
  expect(labels).toHaveLength(6)
  for (const label of labels) {
    await page.getByRole('button', { name: label, exact: true }).click()
    await expect(page.locator('.chart-canvas-shell')).toHaveAttribute('data-render-status', 'settled')
    const lines = await page.locator('.chart-canvas svg path[stroke="#d9d7df"]').evaluateAll((nodes) => nodes.filter((node) => Number(node.getAttribute('stroke-width') ?? 1) < 3).flatMap((node) => [...(node.getAttribute('d') ?? '').matchAll(/M\s*([-\d.e]+)[ ,]+([-\d.e]+)\s*L\s*([-\d.e]+)[ ,]+([-\d.e]+)/gi)].map((match) => ({ width: Math.abs(Number(match[3]) - Number(match[1])), height: Math.abs(Number(match[4]) - Number(match[2])) }))))
    expect(lines.length, label).toBeGreaterThan(0)
    expect(lines.every((line) => line.width < 1 && line.height > 10), label).toBe(true)
  }
})
