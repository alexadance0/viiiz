import { describe, expect, it } from 'vitest'
import { createDefaultChartConfig } from '../../entities/chart/model/defaultChartConfig'
import { parseProject, serializeProject, validateProject, type EditorProject } from './project'

function fixture(): EditorProject {
  const table = { name: 'Исследование', columns: ['date', 'value'], rows: [{ date: new Date('2025-04-02T00:00:00Z'), value: 42 }], rawRows: [{ date: '02.04.2025', value: '42' }], dateRules: { date: { format: 'DD.MM.YYYY', twoDigitYearPivot: 50, invalid: 'keep' as const } }, imputedCells: { value: { 0: { method: 'linear' as const, generatedPeriod: false } } } }
  return { format: 'viiiz-project', version: 1, updatedAt: '2026-10-09T12:00:00Z', table, types: { date: 'date', value: 'number' }, config: { ...createDefaultChartConfig(), xField: 'date', yField: 'value', yFields: ['value'], xAxisLabelRotate: 45 }, step: 'design', multiplesMode: false }
}

describe('project files', () => {
  it('round-trips dates, raw data, preprocessing metadata and chart settings', () => {
    const project = fixture()
    expect(parseProject(serializeProject(project))).toEqual(project)
    expect(parseProject(serializeProject(project)).table.rows[0].date).toBeInstanceOf(Date)
  })

  it('preserves panels, annotations, custom fonts and optional appearance', () => {
    const project = fixture()
    project.config.annotations = [{ id: 'note', x: .4, y: .2, width: .3, fontFamily: 'Onest', fontSize: 20, backgroundColor: '#fff', borderColor: '#000', textAlign: 'left', fragments: [{ id: 'text', text: 'Пик роста', color: '#000', bold: true, italic: false }], html: '<b>Пик роста</b>' }]
    project.config.customFonts = [{ name: 'Мой шрифт', dataUrl: 'data:font/woff2;base64,AA==' }]
    project.config.directLabelPositions = { revenue: { x: 20, y: 30 } }
    project.config.colorEncoding = { mode: 'bins', field: 'value', thresholds: [10], binColors: ['#000', '#fff'] }
    project.config.multiples = { rows: 1, columns: 2, gap: 24, sharedValueScale: true, panels: [{ id: 'a', config: { ...createDefaultChartConfig(), kind: 'line', xField: 'date', yField: 'value', yFields: ['value'] } }, null] }
    project.multiplesMode = true
    expect(parseProject(serializeProject(project))).toEqual(project)
  })

  it('rejects malformed project data rather than partially loading it', () => {
    for (const patch of [{ version: 2 }, { format: 'csv' }, { types: {} }, { table: { ...fixture().table, columns: ['date', 'date'] } }, { config: { ...fixture().config, annotations: [{ id: 'broken' }] } }, { config: { ...fixture().config, kind: 'unknown' } }, { config: { ...fixture().config, titleText: null } }]) {
      expect(() => validateProject({ ...fixture(), ...patch })).toThrow()
    }
    expect(() => parseProject('not json')).toThrow('Не удалось прочитать')
    expect(() => parseProject(serializeProject(fixture()).replace('2025-04-02T00:00:00.000Z', 'not-a-date'))).toThrow()
  })

  it('rejects unsafe keys and non-finite values', () => {
    expect(() => validateProject(JSON.parse('{"__proto__":{"polluted":true}}'))).toThrow('Недопустимое поле')
    const project = fixture()
    project.table.rows[0].value = Infinity
    expect(() => serializeProject(project)).toThrow('Некорректное число')
  })

  it('preserves ordinary columns named constructor and prototype', () => {
    const project = fixture()
    project.table = { name: 'Столбцы', columns: ['constructor', 'prototype'], rows: [{ constructor: 'category', prototype: 10 }] }
    project.types = { constructor: 'text' as const, prototype: 'number' as const }
    expect(parseProject(serializeProject(project)).table).toEqual(project.table)
    expect(() => validateProject({ ...project, types: { prototype: 'number' } })).toThrow()
  })

  it('restores missing optional settings with defaults without losing new settings', () => {
    const project = fixture()
    delete project.config.scatterOpacity
    const restored = validateProject(project)
    expect(restored.config.scatterOpacity).toBe(createDefaultChartConfig().scatterOpacity)
    expect(restored.config.xAxisLabelRotate).toBe(45)
  })
})
