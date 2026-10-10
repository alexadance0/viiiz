import { describe, expect, it } from 'vitest'
import { applyCustomHover, nativeHoverStyle } from './chartHover'

describe('shared chart hover', () => {
  it('keeps every segment of a series active when its hover scope is series', () => {
    const item = { type: 'custom', hoverScope: 'series' as const, renderItem: () => ({ type: 'group', children: ['a', 'b'].map((elementKey) => ({ type: 'rect', info: { elementKey }, style: { fill: '#8067a5', opacity: .7 } })) }) }
    applyCustomHover(item, 'A', 'A', 'a', null, true)
    expect(item.renderItem().children.map((child) => child.style)).toEqual([
      { fill: '#8067a5', opacity: .7 }, { fill: '#8067a5', opacity: .7 },
    ])
  })
  it('keeps a selected element vivid and its series mildly muted even during hover', () => {
    const item = { type: 'custom', hoverScope: 'series' as const, renderItem: () => ({ type: 'group', children: ['a', 'b'].map((elementKey) => ({ type: 'rect', info: { elementKey }, style: { fill: '#8067a5', opacity: .7 } })) }) }
    applyCustomHover(item, 'A', 'A', 'b', 'a', true)
    const [selected, peer] = item.renderItem().children
    expect(selected.style).toEqual({ fill: '#8067a5', opacity: .7 })
    expect(peer.style.fill).not.toBe('#8067a5')
    expect(peer.style.opacity).toBe(.7)
    expect(peer).toMatchObject({ emphasis: { style: { fill: peer.style.fill } } })
  })
  it('keeps active marks in their own color without adding outlines or changing labels', () => {
    const geometry = { type: 'group', info: { sourceSeriesName: 'A', elementKey: 'a' }, children: [
      { type: 'rect', shape: { x: 0, y: 0, width: 30, height: 20 }, style: { fill: '#8067a5', opacity: .45 } },
      { type: 'text', style: { text: 'A', fill: '#fff' } },
    ] }
    const snapshot = structuredClone(geometry)
    const item = { type: 'custom', renderItem: () => geometry }
    applyCustomHover(item, 'A', 'A', 'a', null, true)
    const result = item.renderItem()
    expect(result.children[0].style).toEqual({ fill: '#8067a5', opacity: .45 })
    expect(result.children[1].style).toEqual(snapshot.children[1].style)
    expect(result).toMatchObject({ emphasisDisabled: true })
    result.children.forEach((child) => expect(child).toMatchObject({ emphasisDisabled: true }))
    expect(geometry).toEqual(snapshot)
  })
  it('softens peer colors while preserving authored opacity and stroke width', () => {
    const item = { type: 'custom', renderItem: () => ({ type: 'group', children: [
      { type: 'polyline', style: { stroke: '#084f91', opacity: .8, lineWidth: 2 } },
      { type: 'polygon', style: { fill: '#084f91', opacity: .3 } },
    ] }) }
    applyCustomHover(item, 'B', 'A', null, null, true)
    const result = item.renderItem()
    expect(result.children[0].style.opacity).toBe(.8)
    expect(result.children[0].style.lineWidth).toBe(2)
    expect(result.children[0].style.stroke).not.toBe('#084f91')
    expect(result.children[1].style.opacity).toBe(.3)
    expect(result.children[1].style.fill).not.toBe('#084f91')
  })
  it('uses element identity within mixed series and ignores transparent hit targets', () => {
    const item = { type: 'custom', data: [{ sourceSeriesName: 'B', elementKey: 'b' }], renderItem: () => ({ type: 'rect', style: { fill: '#fff', opacity: 0 } }) }
    applyCustomHover(item, 'map', 'B', 'b', null, true)
    expect(item.renderItem().style).toEqual({ fill: '#fff', opacity: 0 })
  })
  it('does not enlarge circles or replace a hollow point’s authored colors', () => {
    expect(nativeHoverStyle({ color: '#fff', borderColor: '#8067a5', opacity: .7 }, '#8067a5')).toMatchObject({ color: '#fff', borderColor: '#8067a5', opacity: .7, shadowBlur: 0 })
  })
})
