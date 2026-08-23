import { describe, expect, it } from 'vitest'
import { lineAreaFixtures } from '../../../test-fixtures/charts/lineArea'
import { indexedTrendConfig, indexedTrendTable, seasonalTrendConfig, seasonalTrendTable } from '../../../test-fixtures/charts/specializedTrends'
import { SEASONAL_OTHERS_LEGEND_ITEM_ID } from '../../../core/legend'
import { resolveNativeCartesianScene } from '../bar/layout'
import { compileNativeLineScene, NATIVE_LINE_KINDS } from './compiler'
import { compileNativeAreaScene, NATIVE_AREA_KINDS } from '../area/compiler'

const specialized = (kind: 'indexed-line' | 'seasonal-line') => {
  const source = lineAreaFixtures[10]
  if (kind === 'indexed-line') return { table: source.table, config: { ...source.config, kind, indexBaseXValue: `date:${(source.table.rows[0].period as Date).toISOString()}` } }
  const table = { ...source.table, rows: [...source.table.rows, ...source.table.rows.map((row) => ({ ...row, period: new Date((row.period as Date).getFullYear() + 1, (row.period as Date).getMonth(), 1) }))] }
  return { table, config: { ...source.config, kind, seasonalAccentYears: ['2026'] } }
}
const seasonalThreeYearTable = { ...seasonalTrendTable, rows: [{ date: new Date(2022, 0, 1), value: 8 }, { date: new Date(2022, 1, 1), value: 12 }, ...seasonalTrendTable.rows] }

describe('native line and area compilers', () => {
  it.each(NATIVE_LINE_KINDS)('%s produces a semantic line plot', (kind) => {
    const source = kind === 'indexed-line' || kind === 'seasonal-line' ? specialized(kind) : { table: lineAreaFixtures[0].table, config: { ...lineAreaFixtures[0].config, kind } }
    const scene = compileNativeLineScene(source.table, source.config)
    expect(scene.plot).toMatchObject({ kind: 'line', categoryPlacement: 'point' })
    expect(scene.plot.series[0].points[0]).toMatchObject({ type: 'point', legacyKey: expect.any(String), datumId: expect.any(String) })
  })

  it.each(NATIVE_AREA_KINDS)('%s produces a semantic area plot', (kind) => {
    const source = lineAreaFixtures[13], scene = compileNativeAreaScene(source.table, { ...source.config, kind })
    expect(scene.plot).toMatchObject({ kind: 'area', categoryPlacement: 'point', stacking: kind === 'area' ? 'none' : kind === 'stacked-area' ? 'stacked' : 'normalized' })
    expect(scene.plot.series[0].fill).toEqual(expect.objectContaining({ color: expect.any(String), opacity: expect.any(Number) }))
  })

  it.each(lineAreaFixtures)('compiles fixture: $name', ({ table, config }) => {
    const scene = config.kind === 'area' || config.kind === 'stacked-area' || config.kind === 'normalized-stacked-area' ? compileNativeAreaScene(table, config) : compileNativeLineScene(table, config)
    expect(scene.plot.categories).toHaveLength(table.rows.length)
    expect(new Set(scene.elements.map((element) => element.id)).size).toBe(scene.elements.length)
  })

  it('models interpolation, missing data, segment overrides, and normalized values explicitly', () => {
    const spline = compileNativeLineScene(lineAreaFixtures[3].table, lineAreaFixtures[3].config)
    const step = compileNativeLineScene(lineAreaFixtures[4].table, lineAreaFixtures[4].config)
    const edited = compileNativeLineScene(lineAreaFixtures[7].table, lineAreaFixtures[7].config)
    const normalized = compileNativeAreaScene(lineAreaFixtures[14].table, lineAreaFixtures[14].config)
    expect(spline.plot.series[0]).toMatchObject({ interpolation: 'spline', missing: 'gap', segments: [] })
    expect(step.plot.series[0].interpolation).toBe('step-start')
    expect(edited.plot.series[0].segments[0]?.stroke).toMatchObject({ color: '#6956e8', width: 5, type: 'dashed' })
    expect(normalized.plot.valueDomain).toMatchObject({ min: -100, max: 100, step: 20 })
  })

  it('indexes prepared values without changing ordinary Line identities or source data', () => {
    const snapshot = structuredClone(indexedTrendTable)
    const indexed = compileNativeLineScene(indexedTrendTable, indexedTrendConfig)
    const ordinary = compileNativeLineScene(indexedTrendTable, { ...indexedTrendConfig, kind: 'line' })
    expect(indexed.plot.series[0].points.map((point) => point.value)).toEqual([100, 150, null, 50])
    expect(indexed.plot.series[1].points.map((point) => point.value)).toEqual([100, 50, -0, 200])
    expect(indexed.plot.series.map((series) => series.id)).toEqual(ordinary.plot.series.map((series) => series.id))
    expect(indexed.plot.series.flatMap((series) => series.points.map((point) => [point.id, point.datumId, point.legacyKey]))).toEqual(ordinary.plot.series.flatMap((series) => series.points.map((point) => [point.id, point.datumId, point.legacyKey])))
    expect(indexedTrendTable).toEqual(snapshot)
  })

  it('selects an indexed date base by stable identity when rendered labels are ambiguous', () => {
    const table = { name: 'ambiguous dates', columns: ['date', 'value'], rows: [{ date: new Date(2023, 0, 1), value: 10 }, { date: new Date(2024, 0, 1), value: 20 }] }
    const scene = compileNativeLineScene(table, { ...indexedTrendConfig, yFields: ['value'], dateLabelFormat: 'month-only-ru', indexBaseXValue: `date:${(table.rows[1].date as Date).toISOString()}` })
    expect(scene.plot.categories.map((category) => category.label)).toEqual(['янв.', 'янв.'])
    expect(scene.plot.series[0].points.map((point) => point.value)).toEqual([50, 100])
  })

  it('keeps a zero-base series invalid without discarding valid sibling series', () => {
    const table = { name: 'mixed bases', columns: ['period', 'zero', 'valid'], rows: [{ period: 'base', zero: 0, valid: 5 }, { period: 'after', zero: 10, valid: 10 }] }
    const scene = compileNativeLineScene(table, { ...indexedTrendConfig, xField: 'period', yField: 'zero', yFields: ['zero', 'valid'], indexBaseXValue: 'string:base' })
    expect(scene.plot.series[0].points.map((point) => point.value)).toEqual([null, null])
    expect(scene.plot.series[1].points.map((point) => point.value)).toEqual([100, 200])
  })

  it('compiles Seasonal into deterministic month/year Line semantics and presentation', () => {
    const scene = compileNativeLineScene(seasonalTrendTable, seasonalTrendConfig)
    const direct = scene.guides.find((guide) => guide.kind === 'direct-series')!
    const legend = scene.guides.find((guide) => guide.kind === 'categorical-legend')!
    expect(scene.plot).toMatchObject({ kind: 'line', categoryPlacement: 'point' })
    expect(scene.plot.categories).toHaveLength(12)
    expect(scene.plot.categories.map((category) => category.id)).toEqual(scene.plot.categories.map((_, month) => `synthetic:month:number%3A${month}`))
    expect(scene.plot.series.map((series) => series.name)).toEqual(['2023', '2024'])
    expect(scene.plot.series[0].points.slice(0, 3).map((point) => point.value)).toEqual([15, null, 30])
    expect(scene.plot.series[0]).toMatchObject({ color: '#d9d7df', presentation: { emphasis: 'muted', opacity: .45 } })
    expect(scene.plot.series[1]).toMatchObject({ color: seasonalTrendConfig.color, presentation: { emphasis: 'accent', opacity: 1, layerPriority: 1 } })
    expect(direct).toMatchObject({ visible: false, side: 'right', items: [{ label: '2023', visible: false }, { label: '2024', visible: false }] })
    expect(legend).toMatchObject({ visible: true, items: [
      { label: '2024', color: seasonalTrendConfig.color, target: { kind: 'series' } },
      { id: SEASONAL_OTHERS_LEGEND_ITEM_ID, label: 'Остальные', color: '#d9d7df', target: { kind: 'group', seriesIds: [scene.plot.series[0].id] } },
    ] })
    expect(scene.plot.categories.map((category) => category.label).filter(Boolean)).toEqual(['янв.', 'февр.', 'мар.', 'апр.', 'май', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'])
  })

  it('gives explicit seasonal colors precedence and measures only semantic direct items', () => {
    const config = { ...seasonalTrendConfig, showLegend: false, showDirectLabels: true, seriesStyles: { '2023': { color: '#123456' }, '2024': { legendLabel: 'Акцентный год', legendNote: 'Комментарий', directLabelText: { ...(seasonalTrendConfig.directLabelText ?? seasonalTrendConfig.legendText), size: 23 } } } }
    const scene = compileNativeLineScene(seasonalTrendTable, config)
    expect(scene.plot.series[0]).toMatchObject({ color: '#123456', presentation: { opacity: 1 } })
    const direct = scene.guides.find((guide) => guide.kind === 'direct-series')!
    expect(direct.items.filter((item) => item.visible)).toMatchObject([{ label: 'Акцентный год', note: 'Комментарий', style: { size: 23 } }])
    expect(resolveNativeCartesianScene(scene).geometry.reservations['guide:direct-series']?.width).toBeGreaterThan(80)
  })

  it('keeps accent visual-only when legend mode is none', () => {
    const none = { ...seasonalTrendConfig, showLegend: false, showDirectLabels: false }
    const muted = compileNativeLineScene(seasonalTrendTable, { ...none, seasonalAccentYears: [] })
    const accent = compileNativeLineScene(seasonalTrendTable, none)
    expect(accent.guides.find((guide) => guide.kind === 'categorical-legend')?.visible).toBe(false)
    expect(accent.guides.find((guide) => guide.kind === 'direct-series')?.visible).toBe(false)
    expect(resolveNativeCartesianScene(accent).geometry.plot).toEqual(resolveNativeCartesianScene(muted).geometry.plot)
    expect(accent.plot.series[1].presentation?.emphasis).toBe('accent')
  })

  it('builds deterministic Seasonal standard legend groups for one, many, all, or no accents', () => {
    const labels = (seasonalAccentYears: string[]) => {
      const scene = compileNativeLineScene(seasonalThreeYearTable, { ...seasonalTrendConfig, seasonalAccentYears })
      return scene.guides.find((guide) => guide.kind === 'categorical-legend')!.items.map((item) => item.label)
    }
    expect(labels(['2024'])).toEqual(['2024', 'Остальные'])
    expect(labels(['2023', '2024'])).toEqual(['2023', '2024', 'Остальные'])
    expect(labels(['2022', '2023', '2024'])).toEqual(['2022', '2023', '2024'])
    expect(labels([])).toEqual(['Остальные'])
  })

  it('persists stable ordinary legend edits without changing plot series', () => {
    const config = { ...seasonalTrendConfig, legendItemOverrides: { [SEASONAL_OTHERS_LEGEND_ITEM_ID]: { label: 'Предыдущие годы', visible: false } }, seriesStyles: { '2024': { legendLabel: 'Текущий год', showLegendItem: false } } }
    const first = compileNativeLineScene(seasonalThreeYearTable, config)
    const changedAccent = compileNativeLineScene(seasonalThreeYearTable, { ...config, seasonalAccentYears: ['2023', '2024'] })
    const replaced = compileNativeLineScene({ ...seasonalThreeYearTable, rows: seasonalThreeYearTable.rows.filter((row) => (row.date as Date).getFullYear() !== 2022).concat([{ date: new Date(2025, 0, 1), value: 50 }]) }, config)
    for (const scene of [first, changedAccent, replaced]) {
      const others = scene.guides.find((guide) => guide.kind === 'categorical-legend')!.items.find((item) => item.id === SEASONAL_OTHERS_LEGEND_ITEM_ID)
      expect(others).toMatchObject({ id: SEASONAL_OTHERS_LEGEND_ITEM_ID, label: 'Предыдущие годы', visible: false, target: { kind: 'group' } })
      expect(scene.plot.series.every((series) => series.name !== 'Остальные' && series.name !== 'Предыдущие годы')).toBe(true)
    }
    expect(first.guides.find((guide) => guide.kind === 'categorical-legend')!.items[0]).toMatchObject({ label: 'Текущий год', visible: false })
  })

  it('keeps custom non-accent identities truthful in the standard legend', () => {
    const scene = compileNativeLineScene(seasonalThreeYearTable, { ...seasonalTrendConfig, seasonalMutedColor: '#bababa', seriesStyles: { '2022': { color: '#cc0000' } } })
    const items = scene.guides.find((guide) => guide.kind === 'categorical-legend')!.items
    expect(items.map((item) => [item.label, item.color])).toEqual([['2024', seasonalTrendConfig.color], ['2022', '#cc0000'], ['Остальные', '#bababa']])
    expect(items.at(-1)?.target).toMatchObject({ kind: 'group', seriesIds: [scene.plot.series.find((series) => series.name === '2023')!.id] })
  })

  it('uses accent defaults and explicit overrides only when direct mode is selected', () => {
    const direct = (seriesStyles: typeof seasonalTrendConfig.seriesStyles = {}) => compileNativeLineScene(seasonalThreeYearTable, { ...seasonalTrendConfig, showLegend: false, showDirectLabels: true, seriesStyles }).guides.find((guide) => guide.kind === 'direct-series')!
    expect(direct().items.map((item) => [item.label, item.visible])).toEqual([['2022', false], ['2023', false], ['2024', true]])
    expect(direct({ '2022': { showDirectLabel: true }, '2024': { showDirectLabel: false } }).items.map((item) => [item.label, item.visible])).toEqual([['2022', true], ['2023', false], ['2024', false]])
    const noAccents = compileNativeLineScene(seasonalThreeYearTable, { ...seasonalTrendConfig, showLegend: false, showDirectLabels: true, seasonalAccentYears: [] }).guides.find((guide) => guide.kind === 'direct-series')!
    expect(noAccents.visible).toBe(false)
  })

  it.each(['top', 'right', 'bottom', 'left'] as const)('measures visible standard legend items at %s without a direct rail', (legendPosition) => {
    const scene = compileNativeLineScene(seasonalThreeYearTable, { ...seasonalTrendConfig, legendPosition, canvasWidth: 460, canvasHeight: 720, legendItemOverrides: { [SEASONAL_OTHERS_LEGEND_ITEM_ID]: { label: 'Очень длинная подпись предыдущих лет' } }, seriesStyles: { '2024': { legendLabel: 'Очень длинная подпись текущего года' } } })
    const resolved = resolveNativeCartesianScene(scene)
    expect(resolved.geometry.reservations['guide:legend']).toBeTruthy()
    expect(resolved.geometry.reservations['guide:direct-series']).toBeUndefined()
    expect(resolved.geometry.plot.width).toBeGreaterThan(0)
    expect(resolved.geometry.plot.height).toBeGreaterThan(0)
  })

  it('keeps seasonal category and series IDs stable across presentation-only changes', () => {
    const first = compileNativeLineScene(seasonalTrendTable, seasonalTrendConfig)
    const second = compileNativeLineScene(seasonalTrendTable, { ...seasonalTrendConfig, canvasWidth: 720, xAxisPosition: 'top', yAxisPosition: 'right', showLegend: false, seasonalAccentYears: ['2023'], dateLabelFormat: 'iso' })
    expect(second.plot.categories.map((category) => category.id)).toEqual(first.plot.categories.map((category) => category.id))
    expect(second.plot.series.map((series) => series.id)).toEqual(first.plot.series.map((series) => series.id))
    expect(second.plot.series.flatMap((series) => series.points.map((point) => point.datumId))).toEqual(first.plot.series.flatMap((series) => series.points.map((point) => point.datumId)))
  })

  it('applies seasonal month settings locally without mutating saved ordinary Line settings', () => {
    const config = { ...seasonalTrendConfig, dateLabelFormat: 'iso' as const, dateAxisStepUnit: 'day' as const, dateAxisAnchor: '2023-01-15', xAxisMin: '2023-01-01', xAxisMax: '2024-12-31', xAxisStep: 3 }
    const snapshot = structuredClone(config)
    const seasonal = compileNativeLineScene(seasonalTrendTable, config)
    expect(seasonal.plot.categories[0].label).toBe('янв.')
    expect(config).toEqual(snapshot)
    const ordinary = compileNativeLineScene(seasonalTrendTable, { ...config, kind: 'line' })
    expect(ordinary.compatibilityConfig).toMatchObject({ dateLabelFormat: 'iso', dateAxisStepUnit: 'day', dateAxisAnchor: '2023-01-15', xAxisMin: '2023-01-01', xAxisMax: '2024-12-31', xAxisStep: 3 })
  })

  it('keeps the Cartesian rail origin invariant for ordinary, indexed, and seasonal Lines', () => {
    const ordinary = resolveNativeCartesianScene(compileNativeLineScene(indexedTrendTable, { ...indexedTrendConfig, kind: 'line' }))
    const indexed = resolveNativeCartesianScene(compileNativeLineScene(indexedTrendTable, indexedTrendConfig))
    const seasonal = resolveNativeCartesianScene(compileNativeLineScene(seasonalTrendTable, seasonalTrendConfig))
    expect(indexed.geometry.axes.value.x).toBe(ordinary.geometry.axes.value.x)
    expect(seasonal.geometry.axes.value.x).toBe(seasonal.geometry.content.x)
    expect(seasonal.geometry.reservations['axis:category-edge-left']).toBeUndefined()
    expect(seasonal.geometry.reservations['axis:category-edge']).toBeUndefined()
  })

  it.each([
    ['bottom', 'left'], ['top', 'left'], ['bottom', 'right'],
  ] as const)('uses shared indexed geometry with X %s and Y %s', (xAxisPosition, yAxisPosition) => {
    const first = indexedTrendTable.rows[0].date as Date
    const config = { ...indexedTrendConfig, xAxisPosition, yAxisPosition, xAxisLabelRotate: 45 as const, yAxisMin: -50, yAxisMax: 250, categoryLabelOverrides: { x: { [first.toISOString()]: 'Long\nbase label' } } }
    const scene = resolveNativeCartesianScene(compileNativeLineScene(indexedTrendTable, config))
    expect(scene.plot.valueDomain).toMatchObject({ min: -50, max: 250 })
    expect(scene.geometry.reservations['axis:category-edge-left']).toBeUndefined()
    expect(scene.geometry.reservations['axis:category-edge']).toBeUndefined()
    if (yAxisPosition === 'left') expect(scene.geometry.axes.value.x).toBe(scene.geometry.content.x)
    else expect(scene.geometry.axes.value.x + scene.geometry.axes.value.width).toBe(scene.geometry.content.x + scene.geometry.content.width)
  })

  it('keeps ordinary Line direct identification fully semantic', () => {
    const source = lineAreaFixtures[9]
    const scene = compileNativeLineScene(source.table, { ...source.config, seriesStyles: { first: { showDirectLabel: false }, second: { legendLabel: 'Second label', legendNote: 'Note', showLegendLine: true } } })
    expect(scene.guides.find((guide) => guide.kind === 'direct-series')).toMatchObject({ side: 'right', items: [
      { label: 'first', visible: false }, { label: 'Second label', note: 'Note', visible: true, leaderLine: true },
    ] })
  })

  it('keeps compiled specialized scenes free from ECharts option vocabulary', () => {
    for (const scene of [compileNativeLineScene(indexedTrendTable, indexedTrendConfig), compileNativeLineScene(seasonalTrendTable, seasonalTrendConfig)]) {
      expect(JSON.stringify(scene)).not.toMatch(/endLabel|labelLayout|smoothMonotone|zlevel|boundaryGap|connectNulls/)
    }
  })

  it('rejects every kind outside its explicit family boundary', () => {
    const source = lineAreaFixtures[0]
    expect(() => compileNativeLineScene(source.table, { ...source.config, kind: 'slope' })).toThrow(/cannot compile slope/)
    expect(() => compileNativeAreaScene(source.table, { ...source.config, kind: 'confidence-line' })).toThrow(/cannot compile confidence-line/)
  })
})
