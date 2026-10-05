import { test, expect } from '@playwright/test'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

test('each chart font preserves SVG and PNG export', async ({ page, context }) => {
  test.skip(process.env.CHART_AUDIT !== '1')
  test.setTimeout(240_000)
  const require = createRequire(import.meta.url)
  const { PNG } = require(join(dirname(require.resolve('playwright-core')), 'lib/utilsBundle.js'))
  const directory = 'output/chart-audit-2026-10-03/font-export'
  mkdirSync(directory, { recursive: true })
  await page.setViewportSize({ width: 1100, height: 850 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/editor')
  const catalog = await page.evaluate(async () => (await import('/src/core/textFonts.ts')).fontCatalog.map((font: { family: string; value: string }) => ({ family: font.family, value: font.value })))
  const fonts = [...catalog, ...catalog.filter((font) => ['Wix Madefor Text', 'Wix Madefor Display', 'Onest', 'Inter', 'Golos Text'].includes(font.family)).map((font) => ({ ...font, variant: 'italic', italic: true })), ...catalog.filter((font) => ['Wix Madefor Text', 'Onest'].includes(font.family)).map((font) => ({ ...font, variant: 'weight-800', weight: 800 }))]
  const results: unknown[] = []
  for (const font of fonts) {
    const record: Record<string, unknown> = { font: font.family, variant: font.variant ?? 'regular' }
    try {
      await page.evaluate(async (font) => {
        const { auditFixture } = await import('/src/test-fixtures/chartAudit.ts')
        const config = auditFixture('bar').config
        const patch = Object.fromEntries(Object.entries(config).filter(([key, value]) => key.endsWith('Text') && value && typeof value === 'object' && 'size' in value).map(([key, value]) => [key, { ...value, fontFamily: font.value, ...(font.italic ? { italic: true } : {}), ...(font.weight ? { weight: font.weight } : {}) }]))
        ;(await import('/src/test-fixtures/chartAudit.browser.tsx')).renderConfig('bar', patch)
      }, font)
      const shell = page.locator('#chart-audit-host .chart-canvas-shell')
      await expect(shell).toHaveAttribute('data-render-status', 'settled')
      const stem = `${directory}/${font.family.replaceAll(' ', '-')}${font.variant ? `-${font.variant}` : ''}`
      const preview = PNG.sync.read(await shell.screenshot({ path: `${stem}-preview.png`, animations: 'disabled' }))
      for (const format of ['svg', 'png']) {
        const download = page.waitForEvent('download')
        await page.evaluate(async (format) => { const module = await import('/src/test-fixtures/chartAudit.browser.tsx'); await (format === 'svg' ? module.exportSvg() : module.exportPng()) }, format)
        const path = `${stem}-export.${format}`
        await (await download).saveAs(path)
        let buffer: Buffer
        if (format === 'svg') {
          const exported = await context.newPage()
          await exported.setViewportSize({ width: 1100, height: 850 })
          await exported.setContent(`<style>body{margin:0}svg{display:block}</style>${readFileSync(path, 'utf8')}`)
          await exported.evaluate(() => document.fonts.ready)
          buffer = await exported.locator('svg').screenshot({ path: `${stem}-svg.png` })
          await exported.close()
        } else buffer = readFileSync(path)
        const image = PNG.sync.read(buffer)
        let pixels = 0
        if (image.width !== preview.width || image.height !== preview.height) record[`${format}Dimensions`] = [image.width, image.height]
        else {
          for (let offset = 0; offset < image.data.length; offset += 4) if (Math.max(...[0, 1, 2].map((channel) => Math.abs(image.data[offset + channel] - preview.data[offset + channel]))) > 24) pixels++
          record[`${format}Difference`] = pixels / (image.width * image.height)
        }
      }
    } catch (error) { record.error = String(error) }
    results.push(record)
    expect(record.error, `${font.family}: export must succeed`).toBeUndefined()
    expect(record.svgDifference, `${font.family}: SVG parity`).toBeLessThan(.0001)
    expect(record.pngDifference, `${font.family}: PNG parity`).toBeLessThan(.0001)
    writeFileSync(`${directory}/results.json`, JSON.stringify(results, null, 2))
  }
})
