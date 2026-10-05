import { it, expect } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { chartRegistry } from '../core/chartRegistry'
import { renderScene, resolveNativeScene } from '../features/chart-renderer/echarts/renderScene'
import { auditCases, auditFixture, type AuditSetting } from './chartAudit'

it.skipIf(process.env.CHART_AUDIT !== '1')('audits every chart and applicable configuration field without modifying product code', () => {
  const directory = 'output/chart-audit-2026-10-03'
  const settings = JSON.parse(readFileSync(`${directory}/settings-inventory.json`, 'utf8')).fields as AuditSetting[]
  const findings: Array<{ kind: string; case: string; fields: string[]; type: string; detail: unknown }> = []
  const coverage: Array<{ kind: string; label: string; cases: number; fields: string[]; invalid: number }> = []
  let checked = 0
  for (const plugin of chartRegistry) {
    const fixture = auditFixture(plugin.id), scenarios = auditCases(plugin.id, settings)
    let invalid = 0
    for (const scenario of scenarios) {
      const config = { ...fixture.config, ...scenario.patch }
      const report = (type: string, detail: unknown) => findings.push({ kind: plugin.id, case: scenario.id, fields: scenario.fields, type, detail })
      try {
        const validation = plugin.validate(fixture.table, config)
        if (!validation.ok) { invalid += 1; report('validation', validation.errors); continue }
        const scene = resolveNativeScene(plugin.compile(fixture.table, config))
        const { canvas, plot, content } = scene.geometry
        for (const [name, rect] of Object.entries({ canvas, plot, content })) {
          if (!Object.values(rect).every(Number.isFinite)) report('nonfinite-geometry', { name, rect })
          if (rect.width <= 0 || rect.height <= 0) report('nonpositive-geometry', { name, rect })
          if (rect.x < -.5 || rect.y < -.5 || rect.x + rect.width > canvas.width + .5 || rect.y + rect.height > canvas.height + .5) report('outside-canvas', { name, rect, canvas })
        }
        if (plot.width < 40 || plot.height < 40) report('collapsed-plot', { plot, canvas })
        const option = renderScene(scene)
        if (!Array.isArray(option.series) || !option.series.length) report('empty-series', null)
        const serialized = JSON.stringify(option)
        if (/NaN|Infinity/.test(serialized)) report('nonfinite-option', serialized.match(/.{0,70}(NaN|Infinity).{0,70}/)?.[0])
        checked += 1
      } catch (cause) { report('exception', cause instanceof Error ? cause.stack : String(cause)) }
    }
    coverage.push({ kind: plugin.id, label: plugin.label, cases: scenarios.length, fields: [...new Set(scenarios.flatMap((scenario) => scenario.fields))], invalid })
  }
  writeFileSync(`${directory}/compiler-matrix.json`, JSON.stringify({ date: '2026-10-03', checked, total: coverage.reduce((sum, item) => sum + item.cases, 0), coverage, findings }, null, 2))
  expect(coverage).toHaveLength(chartRegistry.length)
  expect(checked).toBeGreaterThan(chartRegistry.length * 100)
}, 240_000)
