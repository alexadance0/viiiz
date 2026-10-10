import { describe, expect, it } from 'vitest'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import { colorScaleReservation, layoutColorScale, type ColorScaleGuide } from './colorScale'
import { renderColorScale } from '../../chart-renderer/echarts/renderColorScale'

const config = createDefaultChartConfig()
const plot = { x: 100, y: 100, width: 800, height: 500 }
const guide: ColorScaleGuide = { id: 'color-scale', kind: 'color-scale', coordinateSpace: 'content', visible: true, position: 'top', minimum: 0, maximum: 108, colors: ['blue', 'violet', 'red'], segments: [{ from: 0, to: 50, color: 'blue' }, { from: 50, to: 100, color: 'violet' }, { from: 100, to: 108, color: 'red' }], ticks: [0, 50, 100].map((value) => ({ value, offset: value / 108, label: String(value) })), missing: { color: '#e8e7eb', label: 'н/д', pattern: 'diagonal' }, style: config.legendText }

describe('shared discrete color scale', () => {
  it.each(['top', 'bottom', 'left', 'right'] as const)('joins colored segments, places boundary ticks and separates missing data at %s', (position) => {
    const source = { ...guide, position }, rail = { x: 40, y: 40, width: 900, height: 70 }
    const scale = layoutColorScale(source, plot, rail, config)
    const graphics = renderColorScale(source, scale, config) as Array<{ id: string; shape?: { x: number; y: number; width: number; height: number }; style?: { fill?: unknown } }>
    const segments = graphics.filter((item) => item.id.startsWith('heatmap-scale-segment'))
    expect(segments.map((item) => item.style!.fill)).toEqual(guide.colors)
    expect(graphics.some((item) => item.id === 'heatmap-scale-bar')).toBe(false)
    expect(scale.missing).toBeDefined()
    if (position === 'top' || position === 'bottom') {
      expect(segments[0].shape!.x + segments[0].shape!.width).toBeCloseTo(segments[1].shape!.x)
      expect(segments[1].shape!.x + segments[1].shape!.width).toBeCloseTo(segments[2].shape!.x)
      expect(scale.ticks[1].x).toBeCloseTo(segments[1].shape!.x)
      expect(scale.missing!.bar.x).toBeGreaterThan(scale.bar.x + scale.bar.width)
      expect(segments[2].shape!.width / segments[0].shape!.width).toBeCloseTo(8 / 50)
    } else {
      expect(segments[1].shape!.y + segments[1].shape!.height).toBeCloseTo(segments[0].shape!.y)
      expect(scale.ticks[1].y).toBeCloseTo(segments[0].shape!.y)
      expect(scale.missing!.bar.y).toBeGreaterThan(scale.bar.y + scale.bar.height)
    }
  })

  it('keeps the original continuous scale geometry and gradient', () => {
    const source = { ...guide, segments: undefined, missing: undefined, stops: [{ offset: 0, color: 'blue' }, { offset: 1, color: 'red' }] }
    const scale = layoutColorScale(source, plot, { x: 40, y: 30, width: 900, height: 70 }, config)
    expect(scale.bar).toEqual({ x: 320, y: 80, width: 360, height: 12 })
    expect(renderColorScale(source, scale, config)[0]).toMatchObject({ id: 'heatmap-scale-bar', style: { fill: { colorStops: source.stops } } })
    expect(colorScaleReservation(source, config, 800)?.size).toBe(Math.round(config.legendText.size * config.legendText.lineHeight / 100) + 42)
  })
})
