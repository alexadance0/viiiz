import { describe, expect, it } from 'vitest'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import { compileNativeXYScene, validateNativeXYMapping } from './compiler'
import { inferScatterOrderField } from './inference'
import { renderScene } from '../../chart-renderer/echarts/renderScene'
import { applySeriesVisualState } from '../../../components/ChartCanvas'
import type { ChartConfig, DataTable } from '../../../core/types'

const config = (patch: Partial<ChartConfig> = {}): ChartConfig => ({ ...createDefaultChartConfig(), kind: 'connected-scatter', xField: 'x', yField: 'y', yFields: ['y'], aggregation: 'none', scatterOrderField: 'order', ...patch })
const table: DataTable = { name: 'trajectory', columns: ['x', 'y', 'order', 'group'], rows: [
  { x: 3, y: 4, order: 4, group: 'A' }, { x: 1, y: 2, order: 1, group: 'A' },
  { x: 4, y: 2, order: 3, group: 'A' }, { x: 1, y: 5, order: 2, group: 'A' },
] }
const coordinates = (source: DataTable, patch: Partial<ChartConfig> = {}) => compileNativeXYScene(source, config(patch)).plot.series.map((series) => series.connection!.points.map((point) => point ? [point.x, point.y] : null))

describe('connected scatter', () => {
  it('connects in third-variable order instead of X order and keeps repeated X points editable', () => {
    const scene = compileNativeXYScene(table, config())
    expect(coordinates(table)).toEqual([[[1, 2], [1, 5], [4, 2], [3, 4]]])
    expect(scene.plot.variant).toBe('connected-scatter')
    expect(scene.document.chart).toMatchObject({ family: 'scatter', orderField: 'order', orderDirection: 'asc' })
    const points = scene.plot.series[0].points
    expect(new Set(points.map((point) => point.legacyKey)).size).toBe(4)
    const edited = compileNativeXYScene(table, config({ elementStyles: { [points[1].legacyKey]: { label: 'Edited', color: '#74204f' } }, scatterOrderDirection: 'desc' }))
    expect(edited.plot.series[0].points[1]).toMatchObject({ id: points[1].id, label: { text: 'Edited' }, marker: { fill: '#74204f' } })
    expect(edited.plot.series[0].points[3].label.text).not.toBe('Edited')
  })

  it('supports descending order and source row order', () => {
    expect(coordinates(table, { scatterOrderDirection: 'desc' })).toEqual([[[3, 4], [4, 2], [1, 5], [1, 2]]])
    expect(coordinates(table, { scatterOrderField: undefined })).toEqual([[[3, 4], [1, 2], [4, 2], [1, 5]]])
    expect(coordinates(table, { scatterOrderField: undefined, scatterOrderDirection: 'desc' })).toEqual([[[1, 5], [4, 2], [1, 2], [3, 4]]])
  })

  it.each(['asc', 'desc'] as const)('keeps equal order values stable: %s', (scatterOrderDirection) => {
    expect(coordinates({ ...table, rows: table.rows.map((row) => ({ ...row, order: 1 })) }, { scatterOrderDirection })).toEqual([[[3, 4], [1, 2], [4, 2], [1, 5]]])
  })

  it('sorts dates and naturally ordered text, and infers a separate date field', () => {
    const dated: DataTable = { ...table, rows: table.rows.map((row) => ({ ...row, order: new Date(2020, 0, Number(row.order)) })) }
    expect(coordinates(dated)).toEqual(coordinates(table))
    expect(inferScatterOrderField(dated, 'x', ['y'])).toBe('order')
    expect(compileNativeXYScene(dated, config()).plot.series[0].points[0].displayOrder).toBe('04.01.2020')
    const text: DataTable = { ...table, rows: [{ x: 10, y: 1, order: 'step10' }, { x: 2, y: 1, order: 'step2' }, { x: 1, y: 1, order: 'step1' }] }
    expect(coordinates(text)).toEqual([[[1, 1], [2, 1], [10, 1]]])
  })

  it.each(['x', 'y'] as const)('breaks paths around missing %s and can explicitly connect gaps', (field) => {
    const incomplete: DataTable = { ...table, rows: [...table.rows, { x: 2, y: 3, order: 2.5, [field]: null }] }
    expect(coordinates(incomplete)).toEqual([[[1, 2], [1, 5], null, [4, 2], [3, 4]]])
    for (const missingMode of ['gap', 'connect'] as const) {
      const option = renderScene(compileNativeXYScene(incomplete, config({ missingMode }))) as { series: Array<{ segmentOf?: string; connectNulls?: boolean; data: unknown[] }> }
      const line = option.series.find((series) => series.segmentOf === 'y')!
      expect(line.connectNulls).toBe(missingMode === 'connect')
      expect(line.data).toContain(null)
    }
  })

  it('keeps points with missing order visible but outside the connection path', () => {
    const source = { ...table, rows: [...table.rows, { x: 8, y: 9, order: null }] }
    const scene = compileNativeXYScene(source, config())
    expect(scene.plot.series[0].points).toHaveLength(5)
    expect(scene.plot.series[0].connection!.points).toHaveLength(4)
    expect(validateNativeXYMapping(source, config({ scatterOrderField: 'absent' })).ok).toBe(false)
  })

  it('connects groups separately, shares series styles and dims paths with their owner on hover', () => {
    const source = { ...table, rows: [...table.rows, { x: 8, y: 2, order: 1, group: 'B' }, { x: 7, y: 3, order: 2, group: 'B' }] }
    const settings = config({ scatterColorField: 'group', scatterConnectionWidth: 4, scatterConnectionOpacity: .5, scatterConnectionType: 'dashed', seriesStyles: { A: { lineWidth: 3, lineType: 'dotted' } } })
    const scene = compileNativeXYScene(source, settings)
    expect(scene.plot.series.map((series) => series.connection!.points.length)).toEqual([4, 2])
    expect(scene.plot.series[0].connection!.stroke).toMatchObject({ width: 3, type: 'dotted', opacity: .5 })
    expect(scene.plot.series[1].connection!.stroke).toMatchObject({ width: 4, type: 'dashed' })
    const option = renderScene(scene) as { series: Array<{ type: string; segmentOf?: string; lineStyle?: { opacity: number } }> }
    expect(option.series.filter((series) => series.type === 'scatter')).toHaveLength(2)
    applySeriesVisualState(option, settings, null, null, 'A')
    expect(option.series.find((series) => series.segmentOf === 'A')!.lineStyle!.opacity).toBe(1)
    expect(option.series.find((series) => series.segmentOf === 'B')!.lineStyle!.opacity).toBeCloseTo(.11)
  })
})
