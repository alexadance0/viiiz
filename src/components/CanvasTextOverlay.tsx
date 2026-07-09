import { useEffect, useRef, useState } from 'react'
import type { ChartConfig, ChartTextStyle } from '../core/types'
import { annotationTextHtml, sanitizeAnnotationHtml } from '../core/annotationHtml'
import { TextFragmentToolbar } from './TextFragmentToolbar'

interface Props {
  id: string
  text: string
  html?: string
  style: ChartTextStyle
  left: number
  top: number
  width: number
  customFonts?: ChartConfig['customFonts']
  canvasBackground?: string
  onChange(html: string, text: string): void
}

interface DisplayProps extends Omit<Props, 'id' | 'text' | 'customFonts' | 'onChange'> {
  html: string
  onSelect(): void
}

const blockStyle = (style: ChartTextStyle, left: number, top: number, width: number): React.CSSProperties => ({
  left, top, width, fontFamily: style.fontFamily, fontSize: style.size, fontWeight: style.weight,
  fontStyle: style.italic ? 'italic' : 'normal', lineHeight: `${Math.round(style.size * style.lineHeight / 100)}px`,
  color: style.color, textAlign: style.align,
})
const sanitizeRichTextHtml = (html: string) => {
  const root = document.createElement('template')
  root.innerHTML = sanitizeAnnotationHtml(html)
  root.content.querySelectorAll<HTMLElement>('*').forEach((element) => {
    element.style.removeProperty('text-shadow')
    element.style.removeProperty('-webkit-text-stroke-color')
    element.style.removeProperty('-webkit-text-stroke-width')
  })
  return root.innerHTML
}

export function CanvasTextDisplay({ html, style, left, top, width, onSelect }: DisplayProps) {
  return <div className="canvas-rich-text-display" style={blockStyle(style, left, top, width)} onClick={(event) => { event.stopPropagation(); onSelect() }} dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(html) }}/>
}

export function CanvasTextOverlay({ id, text, html, style, left, top, width, customFonts, canvasBackground = '#ffffff', onChange }: Props) {
  const editor = useRef<HTMLDivElement>(null), range = useRef<Range | null>(null), lastHtml = useRef('')
  const [toolbarStyle, setToolbarStyle] = useState(style)
  const syncToolbarStyle = () => {
    const target = editor.current?.querySelector<HTMLElement>('span[style], b, strong, i, em, u') ?? editor.current
    if (!target) return setToolbarStyle(style)
    const computed = window.getComputedStyle(target)
    setToolbarStyle({ ...style, fontFamily: computed.fontFamily || style.fontFamily, size: Math.round(Number.parseFloat(computed.fontSize)) || style.size, color: computed.color || style.color })
  }
  useEffect(() => {
    const incoming = sanitizeRichTextHtml(html ?? annotationTextHtml(text))
    if (editor.current && incoming !== lastHtml.current) editor.current.innerHTML = incoming
    lastHtml.current = incoming
    requestAnimationFrame(syncToolbarStyle)
  }, [html, id, text])
  useEffect(() => setToolbarStyle(style), [style])
  const remember = () => {
    const selection = window.getSelection()
    if (selection?.rangeCount && editor.current?.contains(selection.anchorNode)) range.current = selection.getRangeAt(0).cloneRange()
  }
  const save = () => {
    if (!editor.current) return
    const sanitized = sanitizeRichTextHtml(editor.current.innerHTML)
    lastHtml.current = sanitized
    onChange(sanitized, editor.current.innerText.replace(/\n+$/, ''))
  }
  const restore = () => {
    if (!range.current) return false
    const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range.current)
    return true
  }
  const selectAll = () => {
    if (!editor.current) return false
    const next = document.createRange()
    next.selectNodeContents(editor.current)
    range.current = next
    restore()
    return true
  }
  const activeRange = () => (restore() && range.current && !range.current.collapsed ? range.current : selectAll() ? range.current : null)
  const apply = (values: Partial<CSSStyleDeclaration>) => {
    const currentRange = activeRange()
    if (!currentRange) return
    const span = document.createElement('span'); Object.assign(span.style, values)
    try { currentRange.surroundContents(span) } catch { span.append(currentRange.extractContents()); currentRange.insertNode(span) }
    span.querySelectorAll<HTMLElement>('*').forEach((element) => Object.assign(element.style, values))
    const next = document.createRange(); next.selectNodeContents(span); range.current = next; restore(); save()
    syncToolbarStyle()
  }
  const command = (name: 'bold' | 'italic' | 'underline') => {
    const currentRange = activeRange()
    if (!currentRange) return
    const node = currentRange.startContainer
    const element = (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement) as HTMLElement | null
    const computed = element ? window.getComputedStyle(element) : null
    if (name === 'bold') apply({ fontWeight: computed && (computed.fontWeight === 'bold' || Number(computed.fontWeight) >= 600) ? '400' : '700' })
    else if (name === 'italic') apply({ fontStyle: computed?.fontStyle === 'italic' ? 'normal' : 'italic' })
    else apply({ textDecoration: computed?.textDecorationLine.includes('underline') ? 'none' : 'underline' })
  }
  return <div className="canvas-rich-text" style={blockStyle(style, left, top, width)}>
    <TextFragmentToolbar style={toolbarStyle} customFonts={customFonts} strokeColor={canvasBackground} below={top < 70} onBeforeAction={remember} onApply={apply} onCommand={command}/>
    <div ref={editor} className="canvas-rich-text-content" contentEditable suppressContentEditableWarning onInput={save} onMouseUp={remember} onKeyUp={remember} onPaste={(event) => { event.preventDefault(); document.execCommand('insertText', false, event.clipboardData.getData('text/plain')); save() }}/>
  </div>
}
