const allowedTags = new Set(['SPAN', 'B', 'STRONG', 'I', 'EM', 'U', 'BR', 'DIV', 'P'])
const dangerousTags = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'IMG', 'SVG', 'MATH', 'LINK', 'META'])

export const annotationTextHtml = (text: string) => text.replace(/[&<>]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character]!)

export function highlightTextRange(range: Range, color: string): Range {
  const span = document.createElement('span')
  span.style.backgroundColor = color
  try { range.surroundContents(span) } catch { span.append(range.extractContents()); range.insertNode(span) }
  span.querySelectorAll<HTMLElement>('*').forEach((element) => element.style.removeProperty('background-color'))
  // Split surrounding inline styles so an old background cannot show through the new alpha.
  for (let parent = span.parentElement; parent && ['SPAN', 'B', 'STRONG', 'I', 'EM', 'U'].includes(parent.tagName); parent = span.parentElement) {
    const before = range.cloneRange(), after = range.cloneRange()
    before.selectNodeContents(parent); before.setEndBefore(span)
    after.selectNodeContents(parent); after.setStartAfter(span)
    const prefix = parent.cloneNode(false) as HTMLElement, suffix = parent.cloneNode(false) as HTMLElement
    prefix.append(before.cloneContents()); suffix.append(after.cloneContents())
    const inherited = parent.cloneNode(false) as HTMLElement
    inherited.style.removeProperty('background-color')
    inherited.append(...span.childNodes); span.append(inherited)
    parent.replaceWith(...(prefix.textContent || prefix.querySelector('br') ? [prefix] : []), span, ...(suffix.textContent || suffix.querySelector('br') ? [suffix] : []))
  }
  const next = document.createRange()
  next.selectNodeContents(span)
  return next
}

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

export function clearInlineStyle(html: string | undefined, property: string): string | undefined {
  if (!html) return html
  const root = document.createElement('template')
  root.innerHTML = sanitizeAnnotationHtml(html)
  root.content.querySelectorAll<HTMLElement>('*').forEach((element) => {
    element.style.removeProperty(property)
    if (!element.getAttribute('style')?.trim()) element.removeAttribute('style')
  })
  return root.innerHTML
}

export const clearInlineFontFamily = (html: string | undefined) => clearInlineStyle(html, 'font-family')
export const clearInlineTextColor = (html: string | undefined) => clearInlineStyle(html, 'color')
