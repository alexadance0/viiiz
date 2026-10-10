export interface AlignmentBox { id: string; x: number; y: number; width: number; height: number; reference?: boolean }
export interface AlignmentGuide { axis: 'x' | 'y'; position: number; start: number; end: number; gap?: number }
export interface AlignmentProps { alignmentBoxes?: AlignmentBox[]; onGuidesChange?(guides: AlignmentGuide[]): void }

export function readAlignmentBoxes(shell: Element | null | undefined, boxes: AlignmentBox[], exclude: string): AlignmentBox[] {
  const text = [...(shell?.querySelectorAll<HTMLElement>('.canvas-annotation[data-annotation-id]') ?? [])].map((element) => ({ id: `text:${element.dataset.annotationId}`, x: element.offsetLeft, y: element.offsetTop, width: element.offsetWidth, height: element.offsetHeight }))
  return [...boxes, ...text].filter((box) => box.id !== exclude)
}

// Threshold is in logical coordinates; callers convert from screen pixels.
export function snapAnnotationBox(box: AlignmentBox, targets: AlignmentBox[], threshold: number, options: { x?: number[]; y?: number[]; gaps?: boolean } = {}) {
  const guides: AlignmentGuide[] = []
  const result = { x: box.x, y: box.y, guides }
  for (const axis of ['x', 'y'] as const) {
    const size = axis === 'x' ? 'width' : 'height', cross = axis === 'x' ? 'y' : 'x', crossSize = axis === 'x' ? 'height' : 'width'
    const features = options[axis] ?? [0, .5, 1]
    let distance = threshold, correction = 0, chosen: AlignmentGuide[] = []
    const consider = (delta: number, nextGuides: AlignmentGuide[]) => {
      if (Math.abs(delta) < distance) { distance = Math.abs(delta); correction = delta; chosen = nextGuides }
    }
    for (const target of targets) for (const sourcePart of features) for (const targetPart of [0, .5, 1]) {
      const position = target[axis] + target[size] * targetPart
      consider(position - box[axis] - box[size] * sourcePart, [{ axis, position, start: Math.min(box[cross], target[cross]), end: Math.max(box[cross] + box[crossSize], target[cross] + target[crossSize]) }])
    }
    if (options.gaps !== false && features.length === 3) {
      const neighbors = targets.filter((target) => !target.reference && target[cross] < box[cross] + box[crossSize] && target[cross] + target[crossSize] > box[cross]).sort((a, b) => a[axis] - b[axis])
      const gapGuide = (start: number, end: number): AlignmentGuide => ({ axis, position: box[cross] + box[crossSize] / 2, start, end, gap: end - start })
      for (let i = 1; i < neighbors.length; i++) {
        const a = neighbors[i - 1], b = neighbors[i], aEnd = a[axis] + a[size], bEnd = b[axis] + b[size], gap = b[axis] - aEnd
        if (gap < 0) continue
        const middle = (aEnd + b[axis] - box[size]) / 2
        if (middle >= aEnd && middle + box[size] <= b[axis]) consider(middle - box[axis], [gapGuide(aEnd, middle), gapGuide(middle + box[size], b[axis])])
        const after = bEnd + gap
        consider(after - box[axis], [gapGuide(aEnd, b[axis]), gapGuide(bEnd, after)])
        const before = a[axis] - gap - box[size]
        consider(before - box[axis], [gapGuide(before + box[size], a[axis]), gapGuide(aEnd, b[axis])])
      }
    }
    result[axis] += correction
    guides.push(...chosen)
  }
  return result
}
