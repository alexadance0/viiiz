import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import type { ChartConfig, DataTable } from '../../../core/types'
import { compileNativeButterflyScene, validateNativeButterflyMapping } from './compiler'
import { resolveNativeButterflyScene } from './layout'
import { getChartPlugin } from '../../../core/chartRegistry'
import { renderButterflyScene } from '../../chart-renderer/echarts/renderButterflyScene'

const table: DataTable = { name: 'butterfly', columns: ['group', 'leftA', 'leftB', 'rightA', 'rightB'], rows: [{ group: 'A', leftA: 20, leftB: 35, rightA: 30, rightB: 50 }, { group: 'B', leftA: -15, leftB: 10, rightA: 25, rightB: 5 }] }
const config = (overrides: Partial<ChartConfig> = {}): ChartConfig => ({ ...createDefaultChartConfig(), kind: 'butterfly', xField: 'group', yField: 'leftA', yFields: ['leftA', 'leftB', 'rightA', 'rightB'], butterflyLeftFields: ['leftA', 'leftB'], butterflyRightFields: ['rightA', 'rightB'], aggregation: 'none', ...overrides })

describe('native Butterfly compiler and layout', () => {
  it('emits independent left/right stacks with a symmetric semantic domain', () => {
    const scene = compileNativeButterflyScene(table, config())
    expect(scene.plot.kind).toBe('butterfly')
    expect(scene.plot.series.map((series) => series.side)).toEqual(['left', 'left', 'right', 'right'])
    expect(scene.plot.series.map((series) => series.marks[0].stackEnd)).toEqual([20, 55, 30, 80])
    expect(scene.plot.valueDomain.min).toBe(-scene.plot.valueDomain.max)
    expect(validateNativeButterflyMapping(table, config({ butterflyRightFields: ['leftA'] })).ok).toBe(false)
  })

  it.each(['center', 'left', 'right'] as const)('resolves mirrored rectangles and %s category placement', (placement) => {
    const resolved = resolveNativeButterflyScene(compileNativeButterflyScene(table, config({ butterflyCategoryPosition: placement })))
    expect(Object.keys(resolved.butterflyGeometry.marks)).toHaveLength(8)
    expect(resolved.butterflyGeometry.centerGap > 0).toBe(placement === 'center')
    const left = resolved.butterflyGeometry.marks[resolved.plot.series[0].marks[0].id], right = resolved.butterflyGeometry.marks[resolved.plot.series[2].marks[0].id]
    expect(left.x + left.width).toBeLessThanOrEqual(right.x)
  })

  it('stacks same-side segments in one row with touching cumulative edges', () => {
    const resolved = resolveNativeButterflyScene(compileNativeButterflyScene(table, config()))
    const [leftA, leftB, rightA, rightB] = resolved.plot.series.map((series) => resolved.butterflyGeometry.marks[series.marks[0].id])
    expect([leftA.y, leftB.y, rightA.y, rightB.y]).toEqual([leftA.y, leftA.y, leftA.y, leftA.y])
    expect([leftA.height, leftB.height, rightA.height, rightB.height]).toEqual([leftA.height, leftA.height, leftA.height, leftA.height])
    expect(leftB.x + leftB.width).toBeCloseTo(leftA.x)
    expect(rightA.x + rightA.width).toBeCloseTo(rightB.x)
  })

  it('preserves Butterfly document semantics and combines generic duplicate-category validation', () => {
    const scene = compileNativeButterflyScene(table, config())
    expect(scene.document.chart).toMatchObject({ family: 'butterfly', kind: 'butterfly', categoryPlacement: 'center' })
    expect(scene.plot.categoryAxis.placement).toEqual({ kind: 'internal', anchor: 'center' })
    const duplicate: DataTable = { ...table, rows: [...table.rows, { ...table.rows[0] }] }
    const validation = getChartPlugin('butterfly').validate(duplicate, config())
    expect(validation.ok).toBe(false)
    expect(validation.errors.some((error) => error.field === 'aggregation')).toBe(true)
  })

  it('mirrors label placements, applies inside contrast, and exports selectable center-category metadata', () => {
    const source = config({ showValues: true, valueLabelPosition: 'inside-center', seriesStyles: { leftA: { color: '#ffffff' }, rightA: { color: '#000000' } }, butterflyLeftFields: ['leftA'], butterflyRightFields: ['rightA'], yFields: ['leftA', 'rightA'] })
    const resolved = resolveNativeButterflyScene(compileNativeButterflyScene(table, source))
    const left = resolved.plot.series[0].marks[0], right = resolved.plot.series[1].marks[0]
    expect(resolved.butterflyGeometry.labels[left.id]).toMatchObject({ align: 'center', inside: true })
    expect(resolved.butterflyGeometry.labels[right.id]).toMatchObject({ align: 'center', inside: true })
    const option = renderButterflyScene(resolved) as { graphic: Array<{ id?: string; style?: { fill?: string } }>; nativeSelectionHits: Array<{ info: { selectionTarget?: string; axis?: string; elementKey: string } }>; nativeCategoryLayouts: Array<{ category: string; width: number }> }
    expect(option.graphic.find((item) => item.id === `value-label:${left.id}`)?.style?.fill).toBe('#202027')
    expect(option.graphic.find((item) => item.id === `value-label:${right.id}`)?.style?.fill).toBe('#fff')
    expect(option.nativeSelectionHits.some((hit) => hit.info.selectionTarget === 'category-label' && hit.info.axis === 'y' && hit.info.elementKey.startsWith('category-label:y:'))).toBe(true)
    expect(option.nativeCategoryLayouts.every((layout) => layout.width > 0)).toBe(true)
  })

  it.each(['auto', 'top', 'bottom', 'inside-top', 'inside-center', 'inside-bottom'] as const)('mirrors the %s value-label mode on both sides', (valueLabelPosition) => {
    const resolved = resolveNativeButterflyScene(compileNativeButterflyScene(table, config({ showValues: true, valueLabelPosition, butterflyLeftFields: ['leftA'], butterflyRightFields: ['rightA'], yFields: ['leftA', 'rightA'] })))
    const leftMark = resolved.plot.series[0].marks[0], rightMark = resolved.plot.series[1].marks[0]
    const leftRect = resolved.butterflyGeometry.marks[leftMark.id], rightRect = resolved.butterflyGeometry.marks[rightMark.id]
    const left = resolved.butterflyGeometry.labels[leftMark.id], right = resolved.butterflyGeometry.labels[rightMark.id]
    expect(left.inside).toBe(valueLabelPosition.startsWith('inside-'))
    expect(right.inside).toBe(valueLabelPosition.startsWith('inside-'))
    if (valueLabelPosition === 'auto' || valueLabelPosition === 'top') {
      expect(left.x).toBeLessThan(leftRect.x)
      expect(right.x).toBeGreaterThan(rightRect.x + rightRect.width)
    } else if (valueLabelPosition === 'bottom') {
      expect(left.x).toBeGreaterThan(leftRect.x + leftRect.width)
      expect(right.x).toBeLessThan(rightRect.x)
    } else {
      expect(left.x).toBeGreaterThanOrEqual(leftRect.x)
      expect(left.x).toBeLessThanOrEqual(leftRect.x + leftRect.width)
      expect(right.x).toBeGreaterThanOrEqual(rightRect.x)
      expect(right.x).toBeLessThanOrEqual(rightRect.x + rightRect.width)
    }
  })

  it('renders bottom labels from both halves outside clipped mark series', () => {
    const resolved = resolveNativeButterflyScene(compileNativeButterflyScene(table, config({ showValues: true, valueLabelPosition: 'bottom', butterflyLeftFields: ['leftA'], butterflyRightFields: ['rightA'], yFields: ['leftA', 'rightA'] })))
    const option = renderButterflyScene(resolved) as { series: Array<{ clip?: boolean; renderItem(params: { dataIndex: number }): { type: string } }>; graphic: Array<{ id?: string; style?: { x?: number } }> }
    const left = resolved.plot.series[0].marks[0], right = resolved.plot.series[1].marks[0]
    const leftLabel = option.graphic.find((item) => item.id === `value-label:${left.id}`)!, rightLabel = option.graphic.find((item) => item.id === `value-label:${right.id}`)!
    const category = resolved.butterflyGeometry.categories[0]
    expect(option.series.every((series) => series.clip === true && series.renderItem({ dataIndex: 0 }).type === 'rect')).toBe(true)
    expect(leftLabel.style?.x).toBeGreaterThan(resolved.butterflyGeometry.marks[left.id].x + resolved.butterflyGeometry.marks[left.id].width)
    expect(rightLabel.style?.x).toBeLessThan(resolved.butterflyGeometry.marks[right.id].x)
    expect(leftLabel.style!.x! + resolved.butterflyGeometry.labels[left.id].width).toBeLessThan(category.x + category.width / 2 - 4)
    expect(rightLabel.style!.x! - resolved.butterflyGeometry.labels[right.id].width).toBeGreaterThan(category.x + category.width / 2 + 4)
  })

  it.each(['left', 'right'] as const)('resolves the category-axis title on the semantic %s side', (placement) => {
    const resolved = resolveNativeButterflyScene(compileNativeButterflyScene(table, config({ butterflyCategoryPosition: placement, showXAxisTitle: true, xAxisTitle: 'Categories', yAxisPosition: placement === 'left' ? 'right' : 'left' })))
    const option = renderButterflyScene(resolved) as { graphic: Array<{ id?: string; left?: number; right?: number }> }
    const title = option.graphic.find((item) => item.id === 'chart-y-axis-title')!
    expect(title[placement]).toBeTypeOf('number')
    expect(title[placement === 'left' ? 'right' : 'left']).toBeUndefined()
  })

  it('keeps compiler independent of ECharts and fails closed through the legacy guard', () => {
    expect(readFileSync(new URL('./compiler.ts', import.meta.url), 'utf8')).not.toMatch(/echarts|renderButterflyScene|buildOption/)
  })
})
