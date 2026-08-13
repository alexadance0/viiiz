import { describe, expect, it } from 'vitest'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import type { ChartConfig, DataTable } from '../../../core/types'
import { compileNativeDistributionScene, type NativeDistributionKind } from './compiler'
import { resolveNativeDistributionScene } from './layout'

const table: DataTable = { name: 'layout', columns: ['group', 'value'], rows: [1, 1, 1, 1, 2, 2].map((value, index) => ({ group: index % 2 ? 'B' : 'A', value })) }
const config = (kind: NativeDistributionKind, overrides: Partial<ChartConfig> = {}): ChartConfig => ({ ...createDefaultChartConfig(), kind, xField: 'group', yField: 'value', yFields: ['value'], aggregation: 'none', canvasWidth: 640, canvasHeight: 420, ...overrides })

describe('native Distribution layout', () => {
  it('maps semantic orientation once and resolves deterministic jitter pixels', () => {
    const horizontal = resolveNativeDistributionScene(compileNativeDistributionScene(table, config('jitter-plot', { distributionGroupField: 'group', distributionOrientation: 'horizontal' })))
    const again = resolveNativeDistributionScene(compileNativeDistributionScene(table, config('jitter-plot', { distributionGroupField: 'group', distributionOrientation: 'horizontal' })))
    expect(horizontal.distributionGeometry.marks.map((mark) => [mark.x, mark.y])).toEqual(again.distributionGeometry.marks.map((mark) => [mark.x, mark.y]))
    const vertical = resolveNativeDistributionScene(compileNativeDistributionScene(table, config('jitter-plot', { distributionGroupField: 'group', distributionOrientation: 'vertical' })))
    expect(horizontal.distributionGeometry.marks[0].valuePixel).toBe(horizontal.distributionGeometry.marks[0].x)
    expect(vertical.distributionGeometry.marks[0].valuePixel).toBe(vertical.distributionGeometry.marks[0].y)
  })

  it('packs all groups sharing a lane as one beeswarm cloud', () => {
    const scene = resolveNativeDistributionScene(compileNativeDistributionScene(table, config('beeswarm', { distributionGroupField: 'group', distributionPointSize: 10 })))
    const sameValue = scene.distributionGeometry.marks.filter((mark) => mark.mark.value === 1)
    expect(new Set(sameValue.map((mark) => mark.crossOffsetPixel)).size).toBe(sameValue.length)
    expect(Math.max(...sameValue.map((mark) => Math.abs(mark.crossOffsetPixel)))).toBeLessThanOrEqual(scene.distributionGeometry.laneBand * scene.plot.widthRatio / 2)
  })

  it('resolves semantic lane grid and compact/full lane bounds for every grid combination', () => {
    for (const distributionOrientation of ['horizontal', 'vertical'] as const) for (const showHorizontalGrid of [false, true]) for (const showVerticalGrid of [false, true]) {
      const scene = resolveNativeDistributionScene(compileNativeDistributionScene(table, config('strip-plot', { distributionOrientation, showHorizontalGrid, showVerticalGrid })))
      const laneVisible = distributionOrientation === 'horizontal' ? showHorizontalGrid : showVerticalGrid
      expect(scene.distributionGeometry.laneGrid).toHaveLength(laneVisible ? 1 : 0)
      expect(scene.plot.laneDomain).toEqual(showHorizontalGrid && showVerticalGrid ? { min: -1, max: 1, interval: 1 } : { min: -1, max: 1, interval: .5 })
    }
  })

  it('measures long lane labels and resolves barcode and summary endpoints before rendering', () => {
    const short = resolveNativeDistributionScene(compileNativeDistributionScene(table, config('barcode-plot')))
    const longTable: DataTable = { name: 'long', columns: ['A very long semantic lane label'], rows: [{ 'A very long semantic lane label': 1 }] }
    const long = resolveNativeDistributionScene(compileNativeDistributionScene(longTable, { ...config('barcode-plot'), yField: longTable.columns[0], yFields: longTable.columns }))
    expect(long.geometry.plot.x).toBeGreaterThan(short.geometry.plot.x)
    expect(short.distributionGeometry.marks.every((mark) => mark.line)).toBe(true)
    expect(short.distributionGeometry.summaries).toHaveLength(1)
  })
})
