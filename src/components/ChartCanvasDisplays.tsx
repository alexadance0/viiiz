import { useLayoutEffect, useRef } from 'react'
import { appendStyledText, type ExportTextBlock } from '../features/chart-export/chartExport'
import { AnnotationHalo, syncAnnotationHaloScroll } from './AnnotationHalo'
import type { ChartAnnotation } from '../core/types'
import { annotationTextHtml, sanitizeAnnotationHtml } from '../core/annotationHtml'

const annotationStyle = (annotation: ChartAnnotation, _canvasBackground = '#ffffff'): React.CSSProperties => {
  const hasBackground = annotation.backgroundColor && annotation.backgroundColor !== 'transparent'
  return {
    left: annotation.x,
    top: annotation.y,
    width: annotation.width,
    maxWidth: `calc(100% - ${Math.max(0, annotation.x)}px)`,
    height: annotation.height,
    boxSizing: 'border-box',
    fontFamily: annotation.fontFamily,
    fontSize: annotation.fontSize,
    color: annotation.fragments[0]?.color ?? '#292929',
    lineHeight: '1.35',
    textAlign: annotation.textAlign ?? 'left',
    background: hasBackground ? annotation.backgroundColor : 'transparent',
    borderColor: annotation.borderColor,
  }
}

export function AnnotationDisplay({ annotation, canvasBackground, onSelect }: { annotation: ChartAnnotation; canvasBackground?: string; onSelect(): void }) {
  const html = sanitizeAnnotationHtml(annotation.html ?? annotationTextHtml(annotation.fragments.map((item) => item.text).join('')))
  const textStyle = annotation.textStrokeColor ? { WebkitTextStrokeColor: annotation.textStrokeColor, WebkitTextStrokeWidth: `${annotation.textStrokeWidth ?? 6}px`, paintOrder: 'stroke fill' } : undefined
  return <div data-annotation-id={annotation.id} className="canvas-annotation annotation-display" style={annotationStyle(annotation, canvasBackground)} onClick={(event) => { event.stopPropagation(); onSelect() }}><AnnotationHalo annotation={annotation}/><div className="annotation-content annotation-foreground" onScroll={syncAnnotationHaloScroll} style={{ ...textStyle, color: annotation.fragments[0]?.color ?? '#292929' }} dangerouslySetInnerHTML={{ __html: html }}/></div>
}

export function CanvasTextDisplay({ block, onSelect }: { block: ExportTextBlock; onSelect(): void }) {
  const ref = useRef<SVGSVGElement>(null)
  useLayoutEffect(() => {
    const svg = ref.current
    if (!svg) return
    svg.replaceChildren()
    const height = appendStyledText(svg, [{ ...block, left: 0, top: 0 }])
    svg.setAttribute('height', String(height))
  }, [block])
  return <svg ref={ref} className="canvas-rich-text-display" width={block.width} style={{ left: block.left, top: block.top, overflow: 'visible', fontFamily: block.style.fontFamily, fontSize: block.style.size, fontWeight: block.style.weight, fontStyle: block.style.italic ? 'italic' : 'normal', lineHeight: `${Math.round(block.style.size * block.style.lineHeight / 100)}px`, textAlign: block.style.align }} onClick={(event) => { event.stopPropagation(); onSelect() }}/>
}
