import { test, expect } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const directory = 'output/chart-audit-2026-10-03'
const require = createRequire(import.meta.url)
const { PNG } = require(join(dirname(require.resolve('playwright-core')), 'lib/utilsBundle.js'))
const enabled = process.env.CHART_AUDIT === '1'
const inventory = enabled ? JSON.parse(readFileSync(`${directory}/settings-inventory.json`, 'utf8')) : null
const kinds: string[] = inventory?.fields.find((field: { name: string }) => field.name === 'kind').values ?? []

function compare(actual: Buffer, expected: Buffer) {
  const a = PNG.sync.read(actual), b = PNG.sync.read(expected)
  if (a.width !== b.width || a.height !== b.height) return { dimensionMismatch: true, actual: [a.width, a.height], expected: [b.width, b.height] }
  let pixels = 0
  for (let offset = 0; offset < a.data.length; offset += 4) {
    if (Math.max(...[0, 1, 2].map((channel) => Math.abs(a.data[offset + channel] - b.data[offset + channel]))) > 24) pixels++
  }
  return { pixels, ratio: pixels / (a.width * a.height), width: a.width, height: a.height }
}

for (const kind of kinds) test(`audit ${kind}: layouts and actual SVG/PNG export`, async ({ page, context }) => {
  test.skip(!enabled, 'Explicit audit only')
  test.setTimeout(240_000)
  mkdirSync(`${directory}/browser/${kind}`, { recursive: true })
  await page.setViewportSize({ width: 1100, height: 850 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto('/editor')
  if (process.env.CHART_AUDIT_WARM === '1') await page.evaluate(async () => (await import('/src/components/echarts/loadEchartsForKind.ts')).preloadAllEcharts())
  const scenarios = await page.evaluate(async (kind) => {
    const module = await import('/src/test-fixtures/chartAudit.browser.tsx')
    return module.catalog.find((item: { id: string }) => item.id === kind)!.cases
  }, kind)
  const results: Array<Record<string, any>> = []
  for (const scenario of scenarios) {
    const before = errors.length
    const record: Record<string, unknown> = { case: scenario.id }
    try {
      await page.evaluate(async ({ kind, id }) => (await import('/src/test-fixtures/chartAudit.browser.tsx')).render(kind, id), { kind, id: scenario.id })
      const shell = page.locator('#chart-audit-host .chart-canvas-shell')
      await expect(shell).toHaveAttribute('data-render-status', 'settled', { timeout: 20_000 })
      await page.evaluate(() => document.fonts.ready)
      record.outsideText = (await page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).textBounds())).filter((text: { outside: boolean }) => text.outside)
      if (scenario.export) {
        const prefix = `${directory}/browser/${kind}/${scenario.id}`
        const preview = await shell.screenshot({ path: `${prefix}-preview.png`, animations: 'disabled' })
        for (const format of ['svg', 'png']) {
          const downloadPromise = page.waitForEvent('download', { timeout: 30_000 })
          await page.evaluate(async (format) => {
            const module = await import('/src/test-fixtures/chartAudit.browser.tsx')
            await (format === 'svg' ? module.exportSvg() : module.exportPng())
          }, format)
          const download = await downloadPromise
          const path = `${prefix}-export.${format}`
          await download.saveAs(path)
          let raster: Buffer
          if (format === 'svg') {
            const exported = await context.newPage()
            await exported.setViewportSize({ width: 1100, height: 850 })
            await exported.setContent(`<style>body{margin:0}svg{display:block}</style>${readFileSync(path, 'utf8')}`)
            await exported.evaluate(() => document.fonts.ready)
            raster = await exported.locator('svg').screenshot({ path: `${prefix}-svg.png`, animations: 'disabled' })
            await exported.close()
          } else raster = readFileSync(path)
          record[`${format}Difference`] = compare(raster, preview)
        }
      }
    } catch (error) { record.error = String(error) }
    record.consoleErrors = errors.slice(before)
    results.push(record)
    writeFileSync(`${directory}/browser/${kind}/results.json`, JSON.stringify({ kind, results }, null, 2))
  }
  expect(results.filter((record) => record.error || record.consoleErrors.length || record.outsideText?.length)).toEqual([])
  for (const record of results.filter((record) => record.svgDifference)) {
    expect(record.svgDifference.dimensionMismatch).toBeUndefined()
    expect(record.pngDifference.dimensionMismatch).toBeUndefined()
    expect(record.svgDifference.ratio).toBeLessThan(.002)
    expect(record.pngDifference.ratio).toBeLessThan(.002)
  }
})
