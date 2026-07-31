import { describe, expect, it } from 'vitest'
import { axisReservation, resolveLogicalAxes, type AxisSpec } from './axisLayout'
import { resolveFrame } from './frameLayout'
import { layoutText, plainTextDocument } from './textLayout'
import { defaultChartTextStyle } from '../../entities/chart/model/defaults'
import { guideReservation } from './guides/types'
import { compositionSpacing } from './spacing'
import { createDefaultChartConfig } from '../../entities/chart/model/defaultChartConfig'
import { chartDocumentFromLegacy } from '../../entities/chart/model/legacyChartConfigAdapter'
import { getChartPlugin } from '../../core/chartRegistry'

describe('frame layout contracts', () => {
  it('applies visible outside reservations once and keeps plot inside canvas', () => {
    const frame = resolveFrame({
      canvas: { width: 1000, height: 750 },
      spacing: compositionSpacing({}),
      reservations: [
        { id: 'header', side: 'top', size: 40, gap: 12, mode: 'outside', priority: 1 },
        { id: 'y-axis', side: 'left', size: 80, gap: 8, mode: 'outside', priority: 2 },
        { id: 'hidden-footer', side: 'bottom', size: 0, gap: 50, mode: 'outside', priority: 3 },
      ],
    })
    expect(frame.content).toEqual({ x: 32, y: 24, width: 944, height: 702 })
    expect(frame.plot).toEqual({ x: 120, y: 76, width: 856, height: 650 })
  })

  it('allocates same-side rails deterministically without overlap', () => {
    const frame = resolveFrame({ canvas: { width: 500, height: 400 }, spacing: compositionSpacing({}), reservations: [
      { id: 'labels', side: 'left', size: 60, gap: 8, mode: 'outside', priority: 20 },
      { id: 'title', side: 'left', size: 20, gap: 12, mode: 'outside', priority: 10 },
    ] })
    expect(frame.resolvedReservations.map(({ reservation }) => reservation.id)).toEqual(['title', 'labels'])
    expect(frame.resolvedReservations[0].bounds.x + frame.resolvedReservations[0].bounds.width).toBeLessThan(frame.resolvedReservations[1].bounds.x)
  })
})

describe('axis layout contracts', () => {
  const style = defaultChartTextStyle(18)
  const axis = (side: 'top' | 'right' | 'bottom' | 'left'): AxisSpec => ({ id: 'category', channel: 'category', orientation: side === 'top' || side === 'bottom' ? 'horizontal' : 'vertical', placement: { kind: 'side', side }, line: { visible: true }, ticks: { visible: true, length: 6 }, labels: { visible: true, size: 22, gap: 8, style }, title: { visible: true, text: 'Title', size: 24, gap: 14, style } })

  it.each(['top', 'right', 'bottom', 'left'] as const)('reserves the resolved %s rail', (side) => {
    expect(axisReservation(axis(side))).toMatchObject({ id: 'axis:category', side, size: 74, mode: 'outside' })
  })

  it('removes hidden label/title rails and keeps internal butterfly axes inside', () => {
    const hidden = axis('left'); hidden.labels.visible = false; hidden.title!.visible = false; hidden.ticks.visible = false
    expect(axisReservation(hidden)).toBeUndefined()
    hidden.placement = { kind: 'internal', anchor: 'center' }
    hidden.labels.visible = true
    expect(axisReservation(hidden)).toBeUndefined()
  })

  it('maps semantic channels to physical axes by orientation', () => {
    expect(resolveLogicalAxes('vertical', 'bottom', 'left')).toMatchObject({ category: { orientation: 'horizontal' }, value: { orientation: 'vertical' } })
    expect(resolveLogicalAxes('horizontal', 'left', 'bottom')).toMatchObject({ category: { orientation: 'vertical' }, value: { orientation: 'horizontal' } })
  })
})

describe('text layout contracts', () => {
  const style = defaultChartTextStyle(10)
  const measure = (text: string) => text.length * 10

  it('distinguishes automatic wrapping from explicit line breaks', () => {
    const automatic = layoutText({ document: plainTextDocument('one two three', style), maxWidth: 70 }, measure)
    const explicit = layoutText({ document: plainTextDocument('one two\nthree', style), maxWidth: 200 }, measure)
    expect(automatic.lines).toEqual(['one two', 'three'])
    expect(automatic.sourceText).toBe('one two three')
    expect(explicit.lines).toEqual(['one two', 'three'])
    expect(explicit.sourceText).toBe('one two\nthree')
  })

  it('breaks long tokens and resolves a rotated bounding box', () => {
    const result = layoutText({ document: plainTextDocument('abcdefgh', style), maxWidth: 30, rotation: 90 }, measure)
    expect(result.lines).toEqual(['abc', 'def', 'gh'])
    expect(result.rotatedSize.width).toBeCloseTo(result.size.height)
    expect(result.rotatedSize.height).toBeCloseTo(result.size.width)
  })

  it('measures styled runs with their own typography', () => {
    const result = layoutText({ document: { baseStyle: style, blocks: [{ runs: [{ text: 'small ' }, { text: 'BIG', style: { size: 20, lineHeight: 140, weight: 700 } }] }] }, maxWidth: 200 }, (text, runStyle) => text.length * runStyle.size)
    expect(result.size.width).toBe(120)
    expect(result.size.height).toBe(28)
    expect(result.lineRuns[0][1].style.weight).toBe(700)
  })
})

describe('guide contracts', () => {
  it('keeps guide strategies distinct', () => {
    expect(guideReservation({ id: 'legend', kind: 'categorical-legend', visible: true, coordinateSpace: 'content', position: 'top', items: [] }, 30, 12)).toMatchObject({ side: 'top' })
    expect(guideReservation({ id: 'direct', kind: 'direct-series', visible: true, coordinateSpace: 'plot', side: 'right', style: defaultChartTextStyle(14), leaderLines: true }, 80, 16)).toMatchObject({ side: 'right' })
    expect(guideReservation({ id: 'size', kind: 'size-scale', visible: true, coordinateSpace: 'plot', position: 'top-left', minimum: 1, maximum: 10 }, 50, 8)).toBeUndefined()
  })
})

describe('legacy document and compiler adapters', () => {
  const table = { name: 'data', columns: ['category', 'value'], rows: [{ category: 'A', value: 2 }] }

  it('normalizes family semantics without exposing another family spec', () => {
    const config = { ...createDefaultChartConfig(), kind: 'horizontal-normalized-stacked-bar' as const, xField: 'category', yField: 'value', yFields: ['value'] }
    const document = chartDocumentFromLegacy(table, config)
    expect(document.chart).toMatchObject({ family: 'bar', orientation: 'horizontal', stacking: 'normalized' })
    expect('heatmapMidpoint' in document.chart).toBe(false)
  })

  it('compiles stable semantic scene elements while retaining the renderer payload', () => {
    const config = { ...createDefaultChartConfig(), xField: 'category', yField: 'value', yFields: ['value'] }
    const scene = getChartPlugin('bar').compile(table, config)
    expect(scene.document.chart.family).toBe('bar')
    expect(scene.elements.some((element) => element.role === 'mark' && element.id.startsWith('mark:'))).toBe(true)
    expect(scene.migrationMode).toBe('native')
    if (scene.migrationMode === 'native') expect(scene.plot.series).toHaveLength(1)
  })
})
