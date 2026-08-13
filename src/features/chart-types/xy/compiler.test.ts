import { describe, expect, it } from 'vitest'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import { nativeMarkSelections, nativePointSeries } from '../../../entities/chart/model/sceneVisitors'
import type { ChartConfig, DataTable } from '../../../core/types'
import { compileNativeXYScene, validateNativeXYMapping } from './compiler'
import { inferBubbleSizeField, inferScatterLabelField } from './inference'
import { resolveNativeXYScene } from './layout'
import { legacyRelationshipBuilderGuard } from '../../../core/chartRegistry'

const config = (kind: 'scatter' | 'bubble', overrides: Partial<ChartConfig> = {}): ChartConfig => ({ ...createDefaultChartConfig(), kind, xField: 'x', yField: 'y', yFields: ['y'], aggregation: 'none', ...overrides })
const table: DataTable = { name: 'xy', columns: ['x', 'y', 'size', 'other', 'label', 'group'], rows: [
  { x: 1, y: 2, size: 0, other: 10, label: 'A', group: null },
  { x: 1, y: 4, size: -25, other: 20, label: 'B', group: 1 },
  { x: 3, y: 7, size: 100, other: 30, label: 'C', group: '1' },
] }

describe('native XY compiler', () => {
  it('compiles continuous axes and unique row identities while retaining ambiguous legacy keys', () => {
    const scene = compileNativeXYScene(table, config('scatter', { scatterShowLabels: true }))
    expect(scene.plot).toMatchObject({ kind: 'xy', variant: 'scatter', xScale: { type: 'linear' }, yScale: { type: 'linear' } })
    const points = scene.plot.series[0].points
    expect(new Set(points.map((point) => point.id)).size).toBe(3)
    expect(points[0].legacyKey).toBe(points[1].legacyKey)
    expect(points.map((point) => point.label.text)).toEqual(['A', 'B', 'C'])
    expect(nativeMarkSelections(scene)).toHaveLength(3)
    expect(nativePointSeries(scene)).toEqual([])
  })

  it('preserves string grouping, color precedence, size encoding and guide coexistence', () => {
    const scene = compileNativeXYScene(table, config('bubble', { scatterSizeField: 'size', scatterColorField: 'group', scatterSizeMin: 42, scatterSizeMax: 6, showLegend: true, seriesStyles: { 'Без категории': { color: '#36a476' }, '1': { color: '#6956e8' } } }))
    expect(scene.plot.series.map((series) => series.name)).toEqual(['Без категории', '1'])
    expect(scene.plot.series.map((series) => series.points.length)).toEqual([1, 2])
    expect(scene.plot.sizeEncoding).toMatchObject({ scale: 'sqrt-absolute', range: { minimumDiameter: 6, maximumDiameter: 42 } })
    expect(scene.plot.series.flatMap((series) => series.points).map((point) => point.marker.size).sort((a, b) => a - b)).toEqual([6, 24, 42])
    expect(scene.guides.map((guide) => guide.kind)).toEqual(['categorical-legend', 'size-scale'])
    expect(scene.plot.series.every((series) => !series.name.startsWith('__'))).toBe(true)
  })

  it('compiles trends, references, diagonal and clipped quadrants as derived layers', () => {
    const scene = compileNativeXYScene(table, config('scatter', { scatterTrendline: true, scatterTrendBand: true, scatterXReference: 2, scatterYReference: 4, scatterQuadrants: true, scatterDiagonal: true, showZeroLine: true }))
    expect(scene.plot.analyticalLayers.filter((layer) => layer.kind === 'trend')[0]).toMatchObject({ samples: expect.arrayContaining([expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })]), confidenceBand: { samples: expect.any(Array) } })
    expect(scene.plot.analyticalLayers.filter((layer) => layer.kind === 'reference').map((layer) => layer.axis)).toEqual(['x', 'y', 'y', 'diagonal'])
    const quadrants = scene.plot.analyticalLayers.find((layer) => layer.kind === 'quadrants')
    expect(quadrants?.kind === 'quadrants' && quadrants.regions).toHaveLength(4)
  })

  it('supports time X without a nonsensical equality diagonal and resolves guide pixels inside plot', () => {
    const dated: DataTable = { name: 'dated', columns: ['date', 'y', 'size'], rows: [{ date: new Date(2025, 0, 1), y: 1, size: 10 }, { date: new Date(2025, 1, 1), y: 2, size: 20 }] }
    const scene = compileNativeXYScene(dated, { ...config('bubble', { xField: 'date', scatterSizeField: 'size', scatterDiagonal: true }), xAxisMin: '2025-01-15' })
    expect(scene.plot.xScale).toMatchObject({ type: 'time', minimum: new Date(2025, 0, 15).getTime() })
    expect(scene.plot.analyticalLayers.some((layer) => layer.kind === 'reference' && layer.axis === 'diagonal')).toBe(false)
    const resolved = resolveNativeXYScene(scene), guide = resolved.geometry.guides['size-scale']
    expect(guide.x).toBeGreaterThanOrEqual(resolved.geometry.plot.x)
    expect(guide.y).toBeGreaterThanOrEqual(resolved.geometry.plot.y)
  })

  it('centralizes label and bubble-field inference and preserves validation messages', () => {
    expect(inferScatterLabelField(table, 'x', ['y'], 'size', 'group')).toBe('label')
    expect(inferBubbleSizeField(table, 'x', ['y'], 'size')).toBe('size')
    expect(inferBubbleSizeField(table, 'x', ['y'], 'y')).toBe('size')
    expect(validateNativeXYMapping(table, config('bubble'))).toMatchObject({ ok: false, errors: [{ field: 'scatterSizeField', message: 'Выберите числовую колонку для размера пузырька.' }] })
    expect(legacyRelationshipBuilderGuard).toThrow('Legacy Scatter/Bubble builder was removed')
  })
})
