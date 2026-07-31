import { useCallback, useEffect, useRef, useState } from 'react'
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
  singleLine?: boolean
  rotation?: number
  onChange(html: string, text: string): void
  onStyleChange?(style: Partial<ChartTextStyle>): void
}

interface DisplayProps extends Omit<Props, 'id' | 'text' | 'customFonts' | 'onChange'> {
  html: string
  onSelect(): void
}

const blockStyle = (style: ChartTextStyle, left: number, top: number, width: number, rotation = 0): React.CSSProperties => ({
  left, top, width, fontFamily: style.fontFamily, fontSize: style.size, fontWeight: style.weight,
  fontStyle: style.italic ? 'italic' : 'normal', lineHeight: `${Math.round(style.size * style.lineHeight / 100)}px`,
  color: style.color, textAlign: style.align, transform: rotation ? `rotate(${rotation}deg)` : undefined, transformOrigin: rotation ? '50% 0' : undefined,
})
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

export function CanvasTextDisplay({ html, style, left, top, width, onSelect }: DisplayProps) {
  return <div className="canvas-rich-text-display" style={blockStyle(style, left, top, width)} onClick={(event) => { event.stopPropagation(); onSelect() }} dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(html) }}/>
}

export function CanvasTextOverlay({ id, text, html, style, left, top, width, customFonts, canvasBackground = '#ffffff', singleLine = false, rotation = 0, onChange, onStyleChange }: Props) {
  const inputText = id.startsWith('category-') ? text.replace(/^\d+:/, '') : text
  const editor = useRef<HTMLDivElement>(null), range = useRef<Range | null>(null), lastHtml = useRef(''), lastText = useRef('')
  const [toolbarStyle, setToolbarStyle] = useState(style)
  const [blockAlign, setBlockAlign] = useState(style.align)
  const syncToolbarStyle = useCallback(() => {
    const selectedNode = range.current?.startContainer
    const selectedElement = selectedNode && (selectedNode.nodeType === Node.ELEMENT_NODE ? selectedNode : selectedNode.parentElement) as HTMLElement | null
    const target = selectedElement && editor.current?.contains(selectedElement)
      ? selectedElement
      : editor.current?.querySelector<HTMLElement>('span[style], b, strong, i, em, u') ?? editor.current
    if (!target) return setToolbarStyle(style)
    const computed = window.getComputedStyle(target)
    setToolbarStyle({ ...style, fontFamily: computed.fontFamily || style.fontFamily, size: Math.round(Number.parseFloat(computed.fontSize)) || style.size, color: computed.color || style.color })
  }, [style])
  useEffect(() => {
    const incoming = sanitizeRichTextHtml(html ?? annotationTextHtml(inputText))
    if (editor.current && incoming !== lastHtml.current && inputText !== lastText.current) editor.current.innerHTML = incoming
    lastHtml.current = incoming
    lastText.current = inputText
    requestAnimationFrame(syncToolbarStyle)
  }, [html, id, inputText, syncToolbarStyle])
  useEffect(() => setToolbarStyle(style), [style])
  useEffect(() => setBlockAlign(style.align), [style.align])
  const remember = () => {
    const selection = window.getSelection()
    if (selection?.rangeCount && editor.current?.contains(selection.anchorNode)) {
      range.current = selection.getRangeAt(0).cloneRange()
      syncToolbarStyle()
    }
  }
  const save = () => {
    if (!editor.current) return
    const sanitized = sanitizeRichTextHtml(editor.current.innerHTML)
    lastHtml.current = sanitized
    const plain = editor.current.innerText.replace(/\n+$/, '')
    lastText.current = plain
    onChange(sanitized, plain)
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
  const selectedRange = () => (restore() && range.current && !range.current.collapsed ? range.current : null)
  const activeRange = () => selectedRange() ?? (selectAll() ? range.current : null)
  const syncBlockStyle = (values: Partial<CSSStyleDeclaration>) => {
    const next: Partial<ChartTextStyle> = {}
    if (values.fontFamily) next.fontFamily = values.fontFamily
    if (values.fontSize) next.size = Number.parseFloat(values.fontSize) || style.size
    if (values.color) next.color = values.color
    if (values.fontStyle) next.italic = values.fontStyle === 'italic'
    if (values.fontWeight) next.weight = Number(values.fontWeight) || style.weight
    if (!Object.keys(next).length) return false
    onStyleChange?.(next)
    save()
    return true
  }
  const apply = (values: Partial<CSSStyleDeclaration>) => {
    const selection = selectedRange()
    if (!selection && syncBlockStyle(values)) return
    const currentRange = selection ?? activeRange()
    if (!currentRange) return
    const span = document.createElement('span'); Object.assign(span.style, values)
    try { currentRange.surroundContents(span) } catch { span.append(currentRange.extractContents()); currentRange.insertNode(span) }
    span.querySelectorAll<HTMLElement>('*').forEach((element) => Object.assign(element.style, values))
    const next = document.createRange(); next.selectNodeContents(span); range.current = next; restore(); save()
    syncToolbarStyle()
  }
  const command = (name: 'bold' | 'italic' | 'underline') => {
    const currentRange = selectedRange()
    const node = currentRange?.startContainer ?? editor.current
    if (!node) return
    const element = (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement) as HTMLElement | null
    const computed = element ? window.getComputedStyle(element) : null
    if (name === 'bold') apply({ fontWeight: computed && (computed.fontWeight === 'bold' || Number(computed.fontWeight) >= 600) ? '400' : '700' })
    else if (name === 'italic') apply({ fontStyle: computed?.fontStyle === 'italic' ? 'normal' : 'italic' })
    else apply({ textDecoration: computed?.textDecorationLine.includes('underline') ? 'none' : 'underline' })
  }
  const setAlignment = (align: ChartTextStyle['align']) => {
    setBlockAlign(align); onStyleChange?.({ align })
    onChange(sanitizeRichTextHtml(editor.current?.innerHTML ?? html ?? annotationTextHtml(text)), editor.current?.innerText.replace(/\n+$/, '') ?? text)
  }
  return <div className="canvas-rich-text" style={blockStyle({ ...style, align: blockAlign }, left, top, width, rotation)}>
    {!id.startsWith('category-') && (
      <TextFragmentToolbar style={toolbarStyle} customFonts={customFonts} strokeColor={canvasBackground} below={top < 70} onBeforeAction={remember} onApply={apply} alignment={blockAlign} onAlignmentChange={setAlignment} onCommand={command}/>
    )}
    <div ref={editor} className="canvas-rich-text-content" style={singleLine ? { whiteSpace: 'pre', overflowWrap: 'normal' } : undefined} contentEditable suppressContentEditableWarning onInput={save} onMouseUp={remember} onKeyUp={remember} onPaste={(event) => { event.preventDefault(); document.execCommand('insertText', false, event.clipboardData.getData('text/plain')); save() }}/>
  </div>
}
