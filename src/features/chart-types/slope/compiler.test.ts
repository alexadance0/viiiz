import { describe, expect, it } from 'vitest'
import { slopePositionKey } from '../../../core/chartScale'
import type { ChartConfig, DataTable } from '../../../core/types'
import { slopeConfig, slopeTable } from '../../../test-fixtures/charts/slope'
import { nativeMarkSelections } from '../../../entities/chart/model/sceneVisitors'
import { resolveNativeSlopeScene } from './layout'
import { compileNativeSlopeScene, prepareSlopeComparison } from './compiler'

const labels = (config: ChartConfig) => compileNativeSlopeScene(slopeTable, config).plot.endpointLabels.items

describe('native Slope compiler', () => {
  it('preserves natural order and typed identity for an explicit two-position selection', () => {
    const table: DataTable = { name: 'positions', columns: ['period', 'value'], rows: [
      { period: 1, value: 10 }, { period: '1', value: 20 }, { period: 2, value: 30 },
    ] }
    const config = slopeConfig({ xField: 'period', yField: 'value', yFields: ['value'], slopeXValues: [slopePositionKey(2), slopePositionKey(1)] })
    const prepared = prepareSlopeComparison(table, config)
    expect(prepared.categories).toEqual([1, 2])
    expect(prepared.series[0].data).toEqual([10, 30])
    expect(() => prepareSlopeComparison(table, { ...config, slopeXValues: ['number:1', 'string:1'] })).not.toThrow()
    expect(() => prepareSlopeComparison(table, { ...config, slopeXValues: ['number:1', 'number:1'] })).toThrow('Выберите две позиции')
    expect(() => prepareSlopeComparison(table, { ...config, slopeXValues: ['number:1', 'number:99'] })).toThrow('Выберите две позиции')
  })

  it('accepts naturally two positions, including dates, without an explicit selection', () => {
    const dates = [new Date(2025, 0, 1), new Date(2025, 6, 1)]
    const table: DataTable = { name: 'dates', columns: ['period', 'value'], rows: dates.map((period, index) => ({ period, value: index + 1 })) }
    const scene = compileNativeSlopeScene(table, slopeConfig({ xField: 'period', yField: 'value', yFields: ['value'], dateLabelFormat: 'month-context-ru' }))
    expect(scene.plot.positions.map((position) => position.value)).toEqual(dates)
    expect(scene.plot.positions.map((position) => position.ordinal)).toEqual(['start', 'end'])
    expect(scene.plot.positions[0].id).not.toBe(scene.plot.positions[1].id)
  })

  it('preserves multiline category overrides and rotated top-axis measurement', () => {
    const scene = compileNativeSlopeScene(slopeTable, slopeConfig({ xAxisPosition: 'top', xAxisLabelRotate: 45, categoryLabelOverrides: { x: { '0:Было': 'До\nизменения' } } }))
    expect(scene.plot.positions[0].label).toBe('До\nизменения')
    const resolved = resolveNativeSlopeScene(scene)
    expect(resolved.plot.categoryAxis.labels.rotation).toBe(45)
    expect(resolved.geometry.axes.category.height).toBeGreaterThan(scene.plot.categoryAxis.labels.gap)
  })

  it('does not mutate the table or config and leaves ordinary preparation intact', () => {
    const table: DataTable = { name: 'transition', columns: ['period', 'value'], rows: [
      { period: 'A', value: 1 }, { period: 'B', value: 2 }, { period: 'C', value: 3 },
    ] }
    const config = slopeConfig({ xField: 'period', yField: 'value', yFields: ['value'], slopeXValues: ['string:A', 'string:C'] })
    const beforeRows = structuredClone(table.rows), beforeConfig = structuredClone(config)
    expect(prepareSlopeComparison(table, config).categories).toEqual(['A', 'C'])
    expect(table.rows).toEqual(beforeRows)
    expect(config).toEqual(beforeConfig)
  })

  it.each([
    ['values and names', true, true, [['left', '12', undefined], ['right', '24', 'actual']]],
    ['values only', true, false, [['left', '12', undefined], ['right', '24', undefined]]],
    ['names only', false, true, [['right', undefined, 'actual']]],
    ['neither', false, false, []],
  ] as const)('models the endpoint-label matrix for %s', (_name, showValues, showNames, expected) => {
    const items = labels(slopeConfig({ yFields: ['actual'], slopeShowValues: showValues, slopeShowSeriesNames: showNames }))
    expect(items.map((item) => [item.side, item.valueText, item.seriesText])).toEqual(expected)
  })

  it('uses family label flags and ignores generic legend/direct/value-label modes', () => {
    const config = slopeConfig({ yFields: ['actual'], showValues: false, showLegend: true, showDirectLabels: true, slopeShowValues: true })
    const scene = compileNativeSlopeScene(slopeTable, config)
    expect(scene.plot.endpointLabels.items).toHaveLength(2)
    expect(scene.guides).toEqual([])
    expect(scene.compatibilityConfig).toMatchObject({ showLegend: true, showDirectLabels: true })
  })

  it('preserves formatting, renamed series identity, and dedicated Slope styles', () => {
    const config = slopeConfig({
      yFields: ['actual'], numberLocale: 'en-US', numberDecimals: 1, numberPrefix: '$', numberSuffix: 'm',
      seriesStyles: { actual: { color: '#6956e8', legendLabel: 'Actual result', lineWidth: 5, lineType: 'dashed', markerShape: 'diamond', markerSize: 15, markerFill: '#ffffff', markerBorder: '#6956e8', markerBorderWidth: 3 } },
    })
    const scene = compileNativeSlopeScene(slopeTable, config), series = scene.plot.series[0]
    expect(series).toMatchObject({ color: '#6956e8', stroke: { color: '#6956e8', width: 5, type: 'dashed' }, marker: { shape: 'diamond', size: 15, fill: '#ffffff', stroke: '#6956e8', strokeWidth: 3 } })
    expect(scene.plot.endpointLabels.items.map((item) => [item.valueText, item.seriesText])).toEqual([['$12.0m', undefined], ['$24.0m', 'Actual result']])
  })

  it('preserves aggregation, missing endpoints, percent mode, and series order', () => {
    const table: DataTable = { name: 'groups', columns: ['period', 'group', 'value'], rows: [
      { period: 'A', group: 'second', value: 5 }, { period: 'A', group: 'first', value: null },
      { period: 'B', group: 'second', value: 15 }, { period: 'B', group: 'first', value: 10 },
    ] }
    const scene = compileNativeSlopeScene(table, slopeConfig({ xField: 'period', yField: 'value', yFields: ['value'], seriesField: 'group', aggregation: 'sum', valueMode: 'percent', seriesOrder: ['first', 'second'] }))
    expect(scene.plot.series.map((series) => series.name)).toEqual(['first', 'second'])
    expect(scene.plot.series.map((series) => series.points.map((point) => point.value))).toEqual([[0, 40], [100, 60]])
  })

  it('models guides, manual domain, axes, and the characterized log-scale guide quirk', () => {
    const config = slopeConfig({ slopeShowYAxis: true, showYAxisLabels: true, showHorizontalGrid: false, showVerticalGrid: true, showXAxisLine: true, showYAxisLine: true, showYTicks: true, showYAxisTitle: true, yAxisPosition: 'right', xAxisPosition: 'top', yAxisMin: -10, yAxisMax: 30, yAxisStep: 5 })
    const scene = compileNativeSlopeScene(slopeTable, config)
    expect(scene.plot.valueDomain).toEqual({ min: -10, max: 30, step: 5 })
    expect(scene.plot.guides).toMatchObject({ horizontal: false, vertical: true, xAxisLine: true, internalValueLabels: true })
    expect(scene.plot.valueAxis).toMatchObject({ placement: { kind: 'side', side: 'right' }, line: { visible: true }, ticks: { visible: true }, title: { visible: true } })
    const log = resolveNativeSlopeScene(compileNativeSlopeScene(slopeTable, { ...config, yAxisScaleType: 'log', yAxisMin: 1, yAxisMax: 100 }))
    expect(log.slopeGeometry.valueScaleLabelRail).toBeUndefined()
  })

  it('keeps semantic identities stable across presentation and layout changes', () => {
    const base = compileNativeSlopeScene(slopeTable, slopeConfig())
    const changed = compileNativeSlopeScene(slopeTable, slopeConfig({ canvasWidth: 1600, xAxisPosition: 'top', numberPrefix: '€', title: 'Changed', showTitle: true }))
    expect(nativeMarkSelections(changed).map((mark) => mark.legacyKey)).toEqual(nativeMarkSelections(base).map((mark) => mark.legacyKey))
    expect(changed.plot.series.map((series) => series.id)).toEqual(base.plot.series.map((series) => series.id))
    expect(changed.plot.series.flatMap((series) => series.points.map((point) => point.id))).toEqual(base.plot.series.flatMap((series) => series.points.map((point) => point.id)))
  })

  it('resolves bounded comparison geometry without moving document anchors', () => {
    const scene = compileNativeSlopeScene(slopeTable, slopeConfig({ title: 'Title', note: 'Note', showTitle: true, showNote: true, slopeShowYAxis: true, showYAxisLabels: true }))
    const resolved = resolveNativeSlopeScene(scene), { content, plot } = resolved.geometry, slope = resolved.slopeGeometry
    expect(slope.guideLeft).toBeLessThan(slope.firstX)
    expect(slope.firstX).toBeLessThan(slope.lastX)
    expect(slope.lastX).toBeLessThan(slope.guideRight)
    expect(slope.guideLeft).toBeGreaterThanOrEqual(content.x)
    expect(slope.guideRight).toBeLessThanOrEqual(content.x + content.width)
    expect(slope.leftEndpointLabelRail!.x + slope.leftEndpointLabelRail!.width).toBeLessThan(slope.firstX)
    expect(slope.rightEndpointLabelRail!.x).toBeGreaterThan(slope.lastX)
    expect(slope.valueScaleLabelRail!.x + slope.valueScaleLabelRail!.width).toBeLessThanOrEqual(slope.leftEndpointLabelRail!.x)
    expect(slope.valueScaleLabelRail!.x + slope.valueScaleLabelRail!.width).toBeLessThan(slope.guideLeft)
    expect(slope.axisY).toBe(plot.y + plot.height)
    const top = resolveNativeSlopeScene(compileNativeSlopeScene(slopeTable, slopeConfig({ xAxisPosition: 'top' })))
    expect(top.slopeGeometry.axisY).toBe(top.geometry.plot.y)
    expect(resolved.geometry.content.x).toBe(scene.document.composition.canvasInsets.left)
  })

  it('resolves close endpoint-label collisions locally without changing the frame', () => {
    const crowded: DataTable = { name: 'crowded', columns: ['period', 'one', 'two', 'three'], rows: [
      { period: 'A', one: 10, two: 10, three: 10 }, { period: 'B', one: 20, two: 20, three: 20 },
    ] }
    const scene = compileNativeSlopeScene(crowded, slopeConfig({ yFields: ['one', 'two', 'three'] }))
    const resolved = resolveNativeSlopeScene(scene)
    const rightOffsets = scene.plot.endpointLabels.items.filter((item) => item.side === 'right').map((item) => resolved.slopeGeometry.endpointLabelOffsets[item.id])
    expect(new Set(rightOffsets).size).toBe(3)
    expect(resolveNativeSlopeScene(compileNativeSlopeScene(crowded, slopeConfig({ yFields: ['one'] }))).geometry.content).toEqual(resolved.geometry.content)
  })
})
