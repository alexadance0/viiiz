import type { ChartAnnotation, ChartTextStyle } from '../core/types'
import { annotationTextHtml, sanitizeAnnotationHtml } from '../core/annotationHtml'

const annotationStyle = (annotation: ChartAnnotation, canvasBackground = '#ffffff'): React.CSSProperties => {
  const sameAsCanvas = annotation.backgroundColor?.toLowerCase() === canvasBackground.toLowerCase()
  const hasBackground = annotation.backgroundColor && annotation.backgroundColor !== 'transparent' && !sameAsCanvas
  return {
    left: annotation.x,
    top: annotation.y,
    width: annotation.width,
    maxWidth: `calc(100% - ${Math.max(0, annotation.x)}px)`,
    height: annotation.height,
    boxSizing: 'border-box',
    fontFamily: annotation.fontFamily,
    fontSize: annotation.fontSize,
    lineHeight: `${Math.round(annotation.fontSize * 1.35)}px`,
    textAlign: annotation.textAlign ?? 'left',
    background: hasBackground ? annotation.backgroundColor : 'transparent',
    borderColor: annotation.borderColor,
  }
}

export function AnnotationDisplay({ annotation, canvasBackground, onSelect }: { annotation: ChartAnnotation; canvasBackground?: string; onSelect(): void }) {
  const html = sanitizeAnnotationHtml(annotation.html ?? annotationTextHtml(annotation.fragments.map((item) => item.text).join('')))
  const textStyle = annotation.textStrokeColor ? { WebkitTextStrokeColor: annotation.textStrokeColor, WebkitTextStrokeWidth: `${annotation.textStrokeWidth ?? 6}px`, paintOrder: 'stroke fill' } : undefined
  return <div className="canvas-annotation annotation-display" style={annotationStyle(annotation, canvasBackground)} onClick={(event) => { event.stopPropagation(); onSelect() }}><div className="annotation-content" style={textStyle} dangerouslySetInnerHTML={{ __html: html }}/></div>
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
