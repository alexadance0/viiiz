import { init } from 'echarts'
import { expect, it } from 'vitest'
import type { ChartDecoration } from '../core/types'
import { decorationGraphics } from './chartDecorations'

it('keeps area highlights behind even the lowest chart series in editor and export', () => {
  for (const type of ['line', 'bar'] as const) {
    for (const interactive of [false, true]) {
      const area: ChartDecoration = { id: 'background', type: 'area', x: 0, y: 0, width: 100, height: 100, color: '#e4a52c', opacity: .3, lineWidth: 1, lineType: 'solid' }
      const chart = init(null, undefined, { renderer: 'svg', ssr: true, width: 100, height: 100 })
      try {
        chart.setOption({ animation: false, xAxis: { type: 'category', data: ['A', 'B'] }, yAxis: {},
          series: [{ type, z: 0, data: [1, 2], itemStyle: { color: '#1677a6' }, lineStyle: { color: '#1677a6' } }],
          graphic: decorationGraphics([area], undefined, interactive ? () => {} : undefined),
        })
        const svg = chart.renderToSVGString()
        const areaPosition = svg.indexOf('#e4a52c')
        const markPosition = svg.indexOf('#1677a6')
        expect(areaPosition).toBeGreaterThan(0)
        expect(markPosition).toBeGreaterThan(areaPosition)
      } finally { chart.dispose() }
    }
  }
})

it('ends thick shafts at the base of filled heads for straight and curved arrows', () => {
  for (const type of ['arrow', 'curved-line'] as const) {
    const decoration: ChartDecoration = { id: 'thick', type, x: 10, y: 50, width: 300, height: 0, color: '#202027', opacity: 1, lineWidth: 12, lineType: 'solid', arrowPlacement: 'both', arrowHead: 'filled', controlPoints: { first: { x: 100, y: 0 }, second: { x: -100, y: 0 } } }
    const graphic = decorationGraphics([decoration])[0]
    if (!('children' in graphic)) throw new Error('Expected an arrow group')
    const shaft = graphic.children[0] as unknown as { shape: { x1: number; y1: number; x2: number; y2: number }; style: { opacity: number } }
    const inset = 12 * 3.5 * Math.cos(Math.PI / 6)
    expect(shaft.shape.x1).toBeCloseTo(10 + inset)
    expect(shaft.shape.x2).toBeCloseTo(310 - inset)
    expect(shaft.shape.y1).toBeCloseTo(50)
    expect(shaft.shape.y2).toBeCloseTo(50)
    expect(shaft.style.opacity).toBe(1)
  }
})

it('renders lines and every arrow head above chart marks in editor and export', () => {
  for (const type of ['line', 'arrow', 'curved-line'] as const) {
    for (const arrowHead of ['filled', 'open', 'circle', 'bar'] as const) {
      for (const interactive of [false, true]) {
        const decoration: ChartDecoration = { id: 'callout', type, x: 10, y: 10, width: 80, height: 80, color: '#ff0000', opacity: 1, lineWidth: 2, lineType: 'solid', arrowPlacement: 'both', arrowHead }
        const chart = init(null, undefined, { renderer: 'svg', ssr: true, width: 100, height: 100 })
        try {
          chart.setOption({ animation: false, graphic: [
            { type: 'rect', z: 40, shape: { x: 0, y: 0, width: 100, height: 100 }, style: { fill: '#0000ff' } },
            ...decorationGraphics([decoration], undefined, interactive ? () => {} : undefined),
          ] })
          const svg = chart.renderToSVGString()
          const markPosition = svg.indexOf('#0000ff')
          const calloutPositions = [...svg.matchAll(/#ff0000/g)].map((match) => match.index)
          expect(markPosition).toBeGreaterThan(0)
          expect(calloutPositions.length).toBeGreaterThanOrEqual(3)
          calloutPositions.forEach((position) => expect(position).toBeGreaterThan(markPosition))
        } finally { chart.dispose() }
      }
    }
  }
})
