const allowedTags = new Set(['SPAN', 'B', 'STRONG', 'I', 'EM', 'U', 'BR', 'DIV', 'P'])
const dangerousTags = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'IMG', 'SVG', 'MATH', 'LINK', 'META'])

export const annotationTextHtml = (text: string) => text.replace(/[&<>]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character]!)

export function sanitizeAnnotationHtml(html: string): string {
  const root = document.createElement('template')
  root.innerHTML = html
  ;[...root.content.querySelectorAll('*')].reverse().forEach((element) => {
    if (dangerousTags.has(element.tagName)) { element.remove(); return }
    if (!allowedTags.has(element.tagName)) { element.replaceWith(...element.childNodes); return }
    const style = element instanceof HTMLElement ? {
      color: element.style.color,
      backgroundColor: element.style.backgroundColor,
      fontWeight: element.style.fontWeight,
      fontStyle: element.style.fontStyle,
      textDecoration: element.style.textDecoration || element.style.textDecorationLine,
      fontFamily: element.style.fontFamily,
      fontSize: element.style.fontSize,
      textShadow: element.style.textShadow,
      webkitTextStrokeColor: element.style.webkitTextStrokeColor,
      webkitTextStrokeWidth: element.style.webkitTextStrokeWidth,
    } : null
    ;[...element.attributes].forEach((attribute) => element.removeAttribute(attribute.name))
    if (style && element instanceof HTMLElement) Object.entries(style).forEach(([property, value]) => { if (value) Object.assign(element.style, { [property]: value }) })
  })
  return root.innerHTML
}

export function clearInlineFontFamily(html: string | undefined): string | undefined {
  if (!html) return html
  const root = document.createElement('template')
  root.innerHTML = sanitizeAnnotationHtml(html)
  root.content.querySelectorAll<HTMLElement>('*').forEach((element) => {
    element.style.removeProperty('font-family')
    if (!element.getAttribute('style')?.trim()) element.removeAttribute('style')
  })
  return root.innerHTML
}
