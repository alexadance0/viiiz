import { useLayoutEffect, useRef } from 'react'
import type { ChartAnnotation, ChartConfig } from '../core/types'
import { appendAnnotationText } from '../features/chart-export/annotationSvg'
import { collectFontFamilies, waitForChartFonts } from '../core/textFonts'

// Paint all outlines before any foreground glyphs. Inline fragments otherwise
// paint their stroke over the fill of the preceding fragment.
export function AnnotationHalo({ annotation, customFonts }: { annotation: ChartAnnotation; customFonts?: ChartConfig['customFonts'] }) {
  const halo = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const layer = halo.current, box = layer?.parentElement
    if (!layer || !box) return
    let active = true
    const render = () => {
      if (!active) return
      const width = Number.parseFloat(getComputedStyle(box).width), height = box.offsetHeight
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('width', String(width)); svg.setAttribute('height', String(height))
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
      Object.assign(svg.style, { position: 'absolute', left: '-1px', top: '-1px', overflow: 'visible' })
      appendAnnotationText(svg, [{ ...annotation, x: 0, y: 0, width, hidden: false }])
      const outlines = svg.querySelector('[data-text-layer="outline"]')
      const highlights = svg.querySelector('[data-text-layer="highlight"]')
      const foreground = svg.querySelector('[data-text-layer="foreground"]')
      svg.replaceChildren(...[outlines, highlights, foreground].filter((layer): layer is Element => layer != null))
      layer.replaceChildren(svg)
    }
    render()
    const observer = new ResizeObserver(render)
    observer.observe(box)
    document.fonts.addEventListener('loadingdone', render)
    void waitForChartFonts(collectFontFamilies(annotation), customFonts).then(render, () => {})
    return () => { active = false; observer.disconnect(); document.fonts.removeEventListener('loadingdone', render) }
  }, [annotation, customFonts])
  return <div ref={halo} aria-hidden="true" className="annotation-halo"/>
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
