import { test, expect } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const directory = 'output/chart-audit-2026-10-03'
const enabled = process.env.CHART_AUDIT === '1'
const settings = enabled ? JSON.parse(readFileSync(`${directory}/settings-inventory.json`, 'utf8')).fields : []
const kinds: string[] = (settings.find((field: { name: string }) => field.name === 'kind')?.values ?? []).filter((kind: string) => !process.env.CHART_AUDIT_KINDS || process.env.CHART_AUDIT_KINDS.split(',').includes(kind))

for (const kind of kinds) test(`configuration audit ${kind}`, async ({ page }) => {
  test.setTimeout(360_000)
  mkdirSync(`${directory}/settings-browser`, { recursive: true })
  await page.setViewportSize({ width: 1100, height: 1100 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto('/editor')
  const scenarios = await page.evaluate(async ({ kind, settings }) => {
    await (await import('/src/components/echarts/loadEchartsForKind.ts')).preloadAllEcharts()
    const module = await import('/src/test-fixtures/chartAudit.browser.tsx')
    return module.configurationCases(kind, settings)
  }, { kind, settings })
  const findings: unknown[] = [], rejected: unknown[] = [], covered: string[] = []
  let checked = 0, screenshots = 0
  const started = Date.now()
  for (const scenario of scenarios) {
    if (scenario.validation.length) { rejected.push({ case: scenario.id, validation: scenario.validation }); continue }
    const before = errors.length
    try {
      await page.evaluate(async ({ kind, patch }) => (await import('/src/test-fixtures/chartAudit.browser.tsx')).renderConfig(kind, patch), { kind, patch: scenario.patch })
      const shell = page.locator('#chart-audit-host .chart-canvas-shell')
      await expect(shell).toHaveAttribute('data-render-status', 'settled', { timeout: 8_000 })
      const outside = (await page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).textBounds())).filter((text: { outside: boolean }) => text.outside)
      const runtime = errors.slice(before)
      if (outside.length || runtime.length) {
        let screenshot: string | undefined
        if (screenshots < 3) {
          screenshot = `${directory}/settings-browser/${kind}-${screenshots++}.png`
          await shell.screenshot({ path: screenshot, animations: 'disabled' })
        }
        findings.push({ case: scenario.id, fields: scenario.fields, outside, runtime, screenshot })
      }
      checked++
      covered.push(...scenario.fields)
    } catch (error) {
      findings.push({ case: scenario.id, fields: scenario.fields, error: String(error), runtime: errors.slice(before) })
    }
    if (checked % 25 === 0) writeFileSync(`${directory}/settings-browser/${kind}.json`, JSON.stringify({ kind, checked, total: scenarios.length, rejected, findings, fields: [...new Set(covered)], duration: Date.now() - started }, null, 2))
  }
  writeFileSync(`${directory}/settings-browser/${kind}.json`, JSON.stringify({ kind, checked, total: scenarios.length, rejected, findings, fields: [...new Set(covered)], duration: Date.now() - started }, null, 2))
})
