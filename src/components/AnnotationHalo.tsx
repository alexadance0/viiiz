import type { ChartAnnotation } from '../core/types'
import { annotationTextHtml, sanitizeAnnotationHtml } from '../core/annotationHtml'

// Paint all outlines before any foreground glyphs. Inline fragments otherwise
// paint their stroke over the fill of the preceding fragment.
export function AnnotationHalo({ annotation }: { annotation: ChartAnnotation }) {
  const html = sanitizeAnnotationHtml(annotation.html ?? annotationTextHtml(annotation.fragments.map((fragment) => fragment.text).join('')))
  return <div aria-hidden="true" className="annotation-halo" style={{ WebkitTextStrokeColor: annotation.textStrokeColor ?? 'transparent', WebkitTextStrokeWidth: `${annotation.textStrokeColor ? annotation.textStrokeWidth ?? 6 : 0}px`, paintOrder: 'stroke fill' }} dangerouslySetInnerHTML={{ __html: html }}/>
}

// oxlint-disable-next-line react/only-export-components -- shared scroll handling for editable and display layers
export function syncAnnotationHaloScroll(event: React.UIEvent<HTMLDivElement>) {
  const foreground = event.currentTarget
  const halo = foreground.previousElementSibling
  if (halo instanceof HTMLElement && halo.classList.contains('annotation-halo')) {
    halo.scrollTop = foreground.scrollTop
    halo.scrollLeft = foreground.scrollLeft
  }
}
