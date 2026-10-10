import { describe, expect, it } from 'vitest'
import type { ChartAnnotation, ChartDecoration } from '../core/types'
import { decorationControls, resolveDecoration, decorationSnapTargets, nearestDecorationTarget, detachDecorationText } from './decorationGeometry'

const line: ChartDecoration = { id: 'line', type: 'curved-line', x: 0, y: 0, width: 400, height: 200, color: '#777', opacity: 1, lineWidth: 1, lineType: 'solid', startAnchor: { annotationId: 'text', side: 'right' }, endAnchor: { elementKey: 'point' } }
const text: ChartAnnotation = { id: 'text', x: 100, y: 50, width: 100, fontFamily: 'Arial', fontSize: 20, textAlign: 'left', backgroundColor: 'transparent', borderColor: 'transparent', fragments: [] }

describe('attached callouts', () => {
  it('moves the text attachment while keeping the data endpoint fixed', () => {
    const points = [{ key: 'point', label: 'Peak', x: 400, y: 200 }]
    const before = resolveDecoration(line, [text], points, { text: 60 })
    const after = resolveDecoration(line, [{ ...text, x: 150, y: 70 }], points, { text: 60 })
    expect([before.x, before.y]).toEqual([201, 80])
    expect([after.x, after.y]).toEqual([251, 100])
    expect([after.x + after.width, after.y + after.height]).toEqual([400, 200])
  })
  it('follows changes in data coordinates and picks the nearest text side', () => {
    const resolved = resolveDecoration({ ...line, startAnchor: { annotationId: 'text', side: 'auto' } }, [text], [{ key: 'point', label: 'Peak', x: 150, y: 300 }], { text: 60 })
    expect([resolved.x, resolved.y]).toEqual([150, 111])
    expect([resolved.x + resolved.width, resolved.y + resolved.height]).toEqual([150, 300])
  })
  it('follows a fixed corner when the text moves, resizes or wraps', () => {
    const anchored = { ...line, startAnchor: { annotationId: 'text', side: 'auto' as const, position: { x: 1, y: 1 } } }
    const before = resolveDecoration(anchored, [text], [], { text: 60 })
    const after = resolveDecoration(anchored, [{ ...text, x: 150, y: 70, width: 140 }], [], { text: 100 })
    expect([before.x, before.y]).toEqual([201, 111])
    expect([after.x, after.y]).toEqual([291, 171])
    expect([after.x + after.width, after.y + after.height]).toEqual([400, 200])
  })
  it('keeps custom control offsets attached to their own endpoints', () => {
    const resolved = resolveDecoration({ ...line, controlPoints: { first: { x: 50, y: 0 }, second: { x: 0, y: -80 } } }, [text], [{ key: 'point', label: 'Peak', x: 600, y: 300 }], { text: 60 })
    expect(decorationControls(resolved)).toEqual({ first: { x: 251, y: 80 }, second: { x: 600, y: 220 } })
  })
  it('supports reversed endpoints, screen-distance snapping and detaches deleted text without moving the curve', () => {
    const points = [{ key: 'point', label: 'Peak', x: 400, y: 200 }]
    const targets = decorationSnapTargets([text, { ...text, id: 'hidden', hidden: true }], points, { text: 60 })
    expect(targets).toHaveLength(9)
    expect(nearestDecorationTarget({ x: 420, y: 200 }, targets, .5, .5)?.anchor).toEqual({ elementKey: 'point' })
    expect(nearestDecorationTarget({ x: 420, y: 200 }, targets, 1, 1)).toBeNull()
    const reversed = { ...line, startAnchor: { elementKey: 'point' }, endAnchor: { annotationId: 'text', side: 'auto' as const, position: { x: 0, y: .5 } } }
    const resolved = resolveDecoration(reversed, [text], points, { text: 60 })
    expect([resolved.x, resolved.y, resolved.x + resolved.width, resolved.y + resolved.height]).toEqual([400, 200, 99, 80])
    const detached = detachDecorationText(reversed, 'text', resolved)
    expect(detached.endAnchor).toBeUndefined()
    expect(detached.startAnchor).toEqual({ elementKey: 'point' })
    expect(resolveDecoration(detached, [], points)).toEqual(detached)
  })
  it('preserves the geometry of saved quadratic curves', () => {
    const controls = decorationControls({ ...line, x: 0, y: 0, width: 300, height: 0, curvature: .3 })
    expect(controls).toEqual({ first: { x: 100, y: 60 }, second: { x: 200, y: 60 } })
  })
})
