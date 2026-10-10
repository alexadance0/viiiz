import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

for (const preset of ['europe', 'world'] as const) {
  test(`${preset} renders the updated geography without dashed overlays in the editor and exports`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.route('**/src/main.tsx', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }))
    await page.goto('/editor')
    await page.evaluate(async (area) => {
      await import('/src/index.css'); await import('/src/App.css')
      const { mapDemoTables } = await import('/src/core/demoData.ts')
      const { renderConfig } = await import('/src/test-fixtures/chartAudit.browser.tsx')
      const source = mapDemoTables[area]
      const table = { ...source, columns: [...source.columns, 'Group'], rows: source.rows.map((row, index) => ({ ...row, Group: row.Территория === 'Россия' ? 'A' : row.Территория === 'Украина' ? 'B' : ['A', 'B', 'C', 'D'][index % 4] })) }
      renderConfig(area === 'europe' ? 'map-europe' : 'map-world', { xField: 'Территория', yField: 'Значение', yFields: ['Значение'], showValues: false, mapShowNames: false, showLegend: false, canvasWidth: 1000, canvasHeight: area === 'europe' ? 900 : 640, title: area === 'europe' ? 'Европа' : 'Мир', subtitle: '', note: '', source: '', colorEncoding: { mode: 'categories', field: 'Group', categories: [{ value: 'A', color: '#246c7e' }, { value: 'B', color: '#f2c34b' }, { value: 'C', color: '#d94772' }, { value: 'D', color: '#68b3a2' }] } }, table)
    }, preset)
    const canvas = page.locator('#chart-audit-host .chart-canvas-shell')
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    await expect(canvas.locator('svg path[stroke-dasharray]')).toHaveCount(0)
    await canvas.screenshot({ path: `/tmp/viiiz-geographic-${preset}.png` })
    const download = page.waitForEvent('download')
    await page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).exportSvg())
    const svg = await readFile((await (await download).path())!, 'utf8')
    expect(svg).not.toContain('stroke-dasharray')
    const pngDownload = page.waitForEvent('download')
    await page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).exportPng())
    expect((await readFile((await (await pngDownload).path())!)).subarray(1, 4).toString()).toBe('PNG')
  })
}
