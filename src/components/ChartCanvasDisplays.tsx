import { AnnotationHalo, syncAnnotationHaloScroll } from './AnnotationHalo'
import type { ChartAnnotation, ChartTextStyle } from '../core/types'
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

const sanitizeRichTextHtml = (html: string) => {
  const root = document.createElement('template')
  root.innerHTML = sanitizeAnnotationHtml(html)
  root.content.querySelectorAll<HTMLElement>('*').forEach((element) => {
    element.style.removeProperty('text-shadow')
    element.style.removeProperty('-webkit-text-stroke-color')
    element.style.removeProperty('-webkit-text-stroke-width')
    element.style.removeProperty('text-align')
  })
  return root.innerHTML
}

export function CanvasTextDisplay({ html, style, left, top, width, onSelect }: { html: string; style: ChartTextStyle; left: number; top: number; width: number; onSelect(): void }) {
  return <div className="canvas-rich-text-display" style={{ left, top, width, fontFamily: style.fontFamily, fontSize: style.size, fontWeight: style.weight, fontStyle: style.italic ? 'italic' : 'normal', lineHeight: `${Math.round(style.size * style.lineHeight / 100)}px`, color: style.color, textAlign: style.align }} onClick={(event) => { event.stopPropagation(); onSelect() }} dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(html) }}/>
}
