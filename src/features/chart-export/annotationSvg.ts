import type { ChartAnnotation } from '../../core/types'
import { annotationTextHtml, sanitizeAnnotationHtml } from '../../core/annotationHtml'

const ns = 'http://www.w3.org/2000/svg'
// Use browser line breaking and glyph positions, the same as the editable canvas.
// This avoids treating a style change halfway through a word as a new word.
export function appendAnnotationText(svg: SVGSVGElement, annotations: ChartAnnotation[], options: { padding?: string; minHeight?: string; borderWidth?: number; fontWeight?: number; fontStyle?: string; lineHeight?: string } = {}) {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-20000px;top:0;visibility:hidden;pointer-events:none'
  document.body.append(host)
  const context = document.createElement('canvas').getContext('2d')
  try {
    annotations.filter((annotation) => !annotation.hidden).forEach((annotation) => {
      const box = document.createElement('div')
      Object.assign(box.style, { width: `${annotation.width}px`, height: annotation.height ? `${annotation.height}px` : 'auto', boxSizing: 'border-box', border: `${options.borderWidth ?? 1}px solid ${annotation.borderColor || 'transparent'}`, fontFamily: annotation.fontFamily, fontSize: `${annotation.fontSize}px`, lineHeight: options.lineHeight ?? '1.35', fontWeight: String(options.fontWeight ?? 400), fontStyle: options.fontStyle ?? 'normal', color: annotation.fragments[0]?.color ?? '#292929', textAlign: annotation.textAlign })
      const content = document.createElement('div')
      Object.assign(content.style, { padding: options.padding ?? '9px 11px', minHeight: options.minHeight ?? '42px', boxSizing: 'border-box', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', webkitTextStrokeColor: annotation.textStrokeColor ?? 'transparent', webkitTextStrokeWidth: `${annotation.textStrokeWidth ?? 0}px`, paintOrder: 'stroke fill' })
      content.innerHTML = sanitizeAnnotationHtml(annotation.html ?? annotationTextHtml(annotation.fragments.map((fragment) => fragment.text).join('')))
      box.append(content); host.append(box)
      const bounds = box.getBoundingClientRect()
      const group = document.createElementNS(ns, 'g')
      group.setAttribute('data-annotation-id', annotation.id)
      const backgrounds = document.createElementNS(ns, 'g'), outlines = document.createElementNS(ns, 'g'), foreground = document.createElementNS(ns, 'g')
      backgrounds.setAttribute('data-text-layer', 'background')
      outlines.setAttribute('data-text-layer', 'outline')
      foreground.setAttribute('data-text-layer', 'foreground')
      group.append(backgrounds, outlines, foreground)
      const rect = (x: number, y: number, width: number, height: number, fill: string) => {
        const element = document.createElementNS(ns, 'rect')
        for (const [key, value] of Object.entries({ x, y, width, height, fill })) element.setAttribute(key, String(value))
        backgrounds.append(element)
      }
      if (annotation.backgroundColor && annotation.backgroundColor !== 'transparent') rect(annotation.x, annotation.y, bounds.width, bounds.height, annotation.backgroundColor)
      const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT)
      let node: Node | null
      while ((node = walker.nextNode())) {
        const text = node.textContent ?? ''
        const style = getComputedStyle(node.parentElement!)
        let background = style.backgroundColor
        for (let parent = node.parentElement; parent && parent !== content && (background === 'rgba(0, 0, 0, 0)' || background === 'transparent'); parent = parent.parentElement) background = getComputedStyle(parent).backgroundColor
        const range = document.createRange()
        const size = Number.parseFloat(style.fontSize)
        if (context) context.font = `${style.fontStyle} ${style.fontWeight} ${size}px ${style.fontFamily}`
        const ascent = context?.measureText('Mg').fontBoundingBoxAscent ?? size * .8
        let part = '', first: DOMRect | null = null, previousRight = 0
        const flush = () => {
          if (!part || !first) return
          const x = annotation.x + first.left - bounds.left, y = annotation.y + first.top - bounds.top
          if (background !== 'rgba(0, 0, 0, 0)' && background !== 'transparent') rect(x, y, previousRight - first.left, first.height, background)
          const element = document.createElementNS(ns, 'text')
          for (const [key, value] of Object.entries({ x, y: y + ascent, fill: style.color, 'font-family': style.fontFamily, 'font-size': size, 'font-weight': style.fontWeight, 'font-style': style.fontStyle, 'xml:space': 'preserve' })) element.setAttribute(key, String(value))
          if (style.textDecorationLine.includes('underline') || node!.parentElement?.closest('u')) element.setAttribute('text-decoration', 'underline')
          const strokeWidth = Number.parseFloat(style.webkitTextStrokeWidth)
          element.textContent = part
          if (strokeWidth > 0) {
            const outline = element.cloneNode(true) as SVGTextElement
            outline.setAttribute('fill', 'none'); outline.setAttribute('stroke', style.webkitTextStrokeColor); outline.setAttribute('stroke-width', String(strokeWidth)); outline.setAttribute('stroke-linejoin', 'round')
            outlines.append(outline)
          }
          foreground.append(element); part = ''; first = null
        }
        let offset = 0
        for (const character of text) {
          range.setStart(node, offset); offset += character.length; range.setEnd(node, offset)
          const position = range.getBoundingClientRect()
          if (character === '\n' || position.height === 0) { flush(); continue }
          if (first && (Math.abs(first.top - position.top) > .5 || position.left < previousRight - 1)) flush()
          first ??= position; part += character; previousRight = position.right
        }
        flush()
      }
      svg.append(group); box.remove()
    })
  } finally { host.remove() }
}
