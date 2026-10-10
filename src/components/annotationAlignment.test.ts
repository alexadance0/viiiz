import { describe, expect, it } from 'vitest'
import { snapAnnotationBox, type AlignmentBox } from './annotationAlignment'

const box = (id: string, x: number, y = 100, width = 20, height = 20): AlignmentBox => ({ id, x, y, width, height })

describe('annotation alignment', () => {
  it('snaps edges and centers independently and leaves distant positions alone', () => {
    const target = box('target', 200, 300, 100, 80)
    expect(snapAnnotationBox(box('moving', 203, 338), [target], 6)).toMatchObject({ x: 200, y: 340 })
    expect(snapAnnotationBox(box('moving', 242, 150), [target], 6)).toMatchObject({ x: 240, y: 150 })
    expect(snapAnnotationBox(box('moving', 50, 150), [target], 6).guides).toEqual([])
  })

  it('suggests equal gaps between neighbors and when extending a row or column', () => {
    const neighbors = [box('a', 0), box('b', 100)]
    const middle = snapAnnotationBox(box('moving', 53), neighbors, 6)
    expect(middle.x).toBe(50)
    expect(middle.guides.filter((guide) => guide.gap != null).map((guide) => guide.gap)).toEqual([30, 30])
    const after = snapAnnotationBox(box('moving', 198), neighbors, 6)
    expect(after.x).toBe(200)
    expect(after.guides.filter((guide) => guide.gap != null).map((guide) => guide.gap)).toEqual([80, 80])
    const vertical = snapAnnotationBox(box('moving', 100, 198), [box('a', 100, 0), box('b', 100, 100)], 6)
    expect(vertical.y).toBe(200)
    expect(vertical.guides.some((guide) => guide.axis === 'y' && guide.gap === 80)).toBe(true)
  })

  it('excludes reference boxes from spacing and ignores neighbors in another row', () => {
    expect(snapAnnotationBox(box('moving', 53), [box('a', 0), { ...box('b', 100), reference: true }], 6).guides.some((guide) => guide.gap != null)).toBe(false)
    expect(snapAnnotationBox(box('moving', 53, 300), [box('a', 0), box('b', 100)], 6).x).toBe(53)
  })

  it('snaps only the dragged resize edge and supports screen-space thresholds', () => {
    const target = box('target', 100, 100)
    expect(snapAnnotationBox(box('moving', 83, 103), [target], 6, { x: [1], y: [], gaps: false })).toMatchObject({ x: 80, y: 103 })
    expect(snapAnnotationBox(box('moving', 110), [box('target', 100)], 3).x).toBe(110)
    expect(snapAnnotationBox(box('moving', 110), [box('target', 100)], 12).guides.length).toBeGreaterThan(0)
  })
})
