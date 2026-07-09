import { useEffect, useRef, useState } from 'react'
import { ToggleButton, ToggleButtonGroup } from '@heroui/react'
import { AlignCenter, AlignLeft, AlignRight, Copy, GripVertical, Trash2 } from 'lucide-react'
import type { ChartAnnotation, ChartConfig } from '../core/types'
import { annotationTextHtml, sanitizeAnnotationHtml } from '../core/annotationHtml'
import { TextFragmentToolbar } from './TextFragmentToolbar'

interface Props { annotation: ChartAnnotation; customFonts?: ChartConfig['customFonts']; canvasBackground?: string; onChange(value: ChartAnnotation): void; onDuplicate(): void; onDelete(): void; onClose(): void }

const annotationStyle = (annotation: ChartAnnotation, canvasBackground = '#ffffff'): React.CSSProperties => {
  const sameAsCanvas = annotation.backgroundColor?.toLowerCase() === canvasBackground.toLowerCase()
  const hasBackground = annotation.backgroundColor && annotation.backgroundColor !== 'transparent' && !sameAsCanvas
  const maskColor = hasBackground ? annotation.backgroundColor : 'transparent'
  return { left: annotation.x, top: annotation.y, width: annotation.width, maxWidth: `calc(100% - ${Math.max(0, annotation.x)}px)`, height: annotation.height, boxSizing: 'border-box', fontFamily: annotation.fontFamily, fontSize: annotation.fontSize, lineHeight: `${Math.round(annotation.fontSize * 1.35)}px`, textAlign: annotation.textAlign ?? 'left', background: maskColor, borderColor: annotation.borderColor }
}

const annotationTextStyle = (annotation: ChartAnnotation): React.CSSProperties => annotation.textStrokeColor
  ? { WebkitTextStrokeColor: annotation.textStrokeColor, WebkitTextStrokeWidth: `${annotation.textStrokeWidth ?? 6}px`, paintOrder: 'stroke fill' }
  : {}

export function AnnotationDisplay({ annotation, canvasBackground, onSelect }: { annotation: ChartAnnotation; canvasBackground?: string; onSelect(): void }) {
  const html = sanitizeAnnotationHtml(annotation.html ?? annotationTextHtml(annotation.fragments.map((item) => item.text).join('')))
  return <div className="canvas-annotation annotation-display" style={annotationStyle(annotation, canvasBackground)} onClick={(event) => { event.stopPropagation(); onSelect() }}><div className="annotation-content" style={annotationTextStyle(annotation)} dangerouslySetInnerHTML={{ __html: html }}/></div>
}

export function AnnotationOverlay({ annotation, customFonts, canvasBackground = '#ffffff', onChange, onDuplicate, onDelete, onClose }: Props) {
  const editor = useRef<HTMLDivElement>(null)
  const range = useRef<Range | null>(null)
  const [toolbarEdge, setToolbarEdge] = useState<'start' | 'end'>('start')
  const [toolbarStyle, setToolbarStyle] = useState({ fontFamily: annotation.fontFamily, size: annotation.fontSize, color: annotation.fragments[0]?.color ?? '#292929' })
  const syncToolbarStyle = () => {
    const target = editor.current?.querySelector<HTMLElement>('span[style], b, strong, i, em, u') ?? editor.current
    if (!target) return setToolbarStyle({ fontFamily: annotation.fontFamily, size: annotation.fontSize, color: annotation.fragments[0]?.color ?? '#292929' })
    const computed = window.getComputedStyle(target)
    setToolbarStyle({ fontFamily: computed.fontFamily || annotation.fontFamily, size: Math.round(Number.parseFloat(computed.fontSize)) || annotation.fontSize, color: computed.color || annotation.fragments[0]?.color || '#292929' })
  }
  // Инициализируем HTML только при выборе другого блока, иначе React сбросит выделение во время ввода.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (editor.current) editor.current.innerHTML = sanitizeAnnotationHtml(annotation.html ?? annotationTextHtml(annotation.fragments.map((item) => item.text).join(''))); requestAnimationFrame(syncToolbarStyle) }, [annotation.id])
  useEffect(() => {
    const shell = editor.current?.closest('.chart-canvas-shell')
    setToolbarEdge(shell && annotation.x + 430 > shell.clientWidth ? 'end' : 'start')
  }, [annotation.x, annotation.width])
  const rememberSelection = () => {
    const selection = window.getSelection()
    if (selection?.rangeCount && editor.current?.contains(selection.anchorNode)) range.current = selection.getRangeAt(0).cloneRange()
  }
  const restoreSelection = () => {
    if (!range.current) return false
    const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range.current)
    return true
  }
  const save = () => editor.current && onChange({ ...annotation, html: sanitizeAnnotationHtml(editor.current.innerHTML) })
  const pasteText = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault()
    const selection = window.getSelection()
    if (!selection?.rangeCount || !editor.current?.contains(selection.anchorNode)) return
    const current = selection.getRangeAt(0)
    current.deleteContents()
    const node = document.createTextNode(event.clipboardData.getData('text/plain'))
    current.insertNode(node); current.setStartAfter(node); current.collapse(true)
    selection.removeAllRanges(); selection.addRange(current); range.current = current.cloneRange(); save()
  }
  const selectAll = () => {
    if (!editor.current) return false
    const next = document.createRange()
    next.selectNodeContents(editor.current)
    range.current = next
    restoreSelection()
    return true
  }
  const activeRange = () => (restoreSelection() && range.current && !range.current.collapsed ? range.current : selectAll() ? range.current : null)
  const apply = (styles: Partial<CSSStyleDeclaration>) => {
    const currentRange = activeRange()
    if (!currentRange) return
    const span = document.createElement('span')
    Object.assign(span.style, styles)
    try { currentRange.surroundContents(span) } catch { span.append(currentRange.extractContents()); currentRange.insertNode(span) }
    span.querySelectorAll<HTMLElement>('*').forEach((element) => Object.assign(element.style, styles))
    const next = document.createRange(); next.selectNodeContents(span); range.current = next
    restoreSelection(); save(); syncToolbarStyle()
  }
  const toggle = (command: 'bold' | 'italic' | 'underline') => {
    const currentRange = activeRange()
    if (!currentRange) return
    const node = currentRange.startContainer
    const element = (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement) as HTMLElement | null
    const computed = element ? window.getComputedStyle(element) : null
    if (command === 'bold') apply({ fontWeight: computed && (computed.fontWeight === 'bold' || Number(computed.fontWeight) >= 600) ? '400' : '700' })
    else if (command === 'italic') apply({ fontStyle: computed?.fontStyle === 'italic' ? 'normal' : 'italic' })
    else apply({ textDecoration: computed?.textDecorationLine.includes('underline') ? 'none' : 'underline' })
  }
  const drag = (event: React.PointerEvent) => {
    event.preventDefault()
    const startX = event.clientX, startY = event.clientY, originalX = annotation.x, originalY = annotation.y
    const shell = editor.current?.closest('.chart-canvas-shell')
    const scale = shell ? shell.getBoundingClientRect().width / Math.max(1, shell.clientWidth) : 1
    const move = (next: PointerEvent) => {
      const maxX = Math.max(0, (shell?.clientWidth ?? Infinity) - annotation.width)
      const maxY = Math.max(0, (shell?.clientHeight ?? Infinity) - (editor.current?.parentElement?.offsetHeight ?? 50))
      onChange({ ...annotation, x: Math.min(maxX, Math.max(0, originalX + (next.clientX - startX) / scale)), y: Math.min(maxY, Math.max(0, originalY + (next.clientY - startY) / scale)) })
    }
    const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end)
  }
  const resize = (event: React.PointerEvent, horizontal: 'left' | 'right', vertical: 'top' | 'bottom') => {
    event.preventDefault(); event.stopPropagation()
    const shell = editor.current?.closest('.chart-canvas-shell')
    const scale = shell ? shell.getBoundingClientRect().width / Math.max(1, shell.clientWidth) : 1
    const startX = event.clientX, startY = event.clientY
    const original = annotation
    const originalHeight = annotation.height ?? Math.max(60, editor.current?.parentElement?.offsetHeight ?? 80)
    const move = (next: PointerEvent) => {
      const dx = (next.clientX - startX) / scale, dy = (next.clientY - startY) / scale
      let x = original.x, y = original.y, width = original.width, height = originalHeight
      if (horizontal === 'left') { x = Math.min(original.x + original.width - 100, Math.max(0, original.x + dx)); width = original.width + original.x - x }
      else width = Math.max(100, Math.min((shell?.clientWidth ?? Infinity) - original.x, original.width + dx))
      if (vertical === 'top') { y = Math.min(original.y + originalHeight - 60, Math.max(0, original.y + dy)); height = originalHeight + original.y - y }
      else height = Math.max(60, Math.min((shell?.clientHeight ?? Infinity) - original.y, originalHeight + dy))
      onChange({ ...original, x, y, width, height })
    }
    const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end)
  }
  return <div className="canvas-annotation selected" style={annotationStyle(annotation, canvasBackground)} onKeyDown={(event) => event.key === 'Escape' && onClose()}>
    <TextFragmentToolbar style={toolbarStyle} customFonts={customFonts} strokeColor={(annotation.textStrokeColor ?? annotation.backgroundColor) || canvasBackground} strokeWidth={annotation.textStrokeWidth ?? 6} enableStroke below={annotation.y < 75} edge={toolbarEdge} onBeforeAction={rememberSelection} onApply={apply} onStrokeWidthChange={(textStrokeWidth) => {
      editor.current?.querySelectorAll<HTMLElement>('[style*="text-stroke"]').forEach((element) => { element.style.webkitTextStrokeWidth = `${textStrokeWidth}px`; element.style.paintOrder = 'stroke fill' })
      onChange({ ...annotation, textStrokeWidth, html: editor.current ? sanitizeAnnotationHtml(editor.current.innerHTML) : annotation.html })
    }} onCommand={toggle}>
      <ToggleButtonGroup aria-label="Выравнивание текста" selectionMode="single" disallowEmptySelection selectedKeys={[annotation.textAlign ?? 'left']} className="annotation-align" onSelectionChange={(keys) => { const [textAlign] = [...keys] as ChartAnnotation['textAlign'][]; if (textAlign) onChange({ ...annotation, textAlign }) }}>
        <ToggleButton id="left" aria-label="По левому краю"><AlignLeft size={14} /></ToggleButton>
        <ToggleButton id="center" aria-label="По центру"><AlignCenter size={14} /></ToggleButton>
        <ToggleButton id="right" aria-label="По правому краю"><AlignRight size={14} /></ToggleButton>
      </ToggleButtonGroup>
      <button type="button" title="Дублировать аннотацию" onMouseDown={(event) => event.preventDefault()} onClick={onDuplicate}><Copy size={14} /></button>
      <button type="button" className="annotation-delete" title="Удалить аннотацию" onMouseDown={(event) => event.preventDefault()} onClick={onDelete}><Trash2 size={14} /></button>
    </TextFragmentToolbar>
    <div className="annotation-drag-handle" onPointerDown={drag}><span><GripVertical size={13} /></span><b>Переместить</b></div>
    <div ref={editor} className="annotation-content" style={annotationTextStyle(annotation)} contentEditable suppressContentEditableWarning onMouseUp={rememberSelection} onKeyUp={rememberSelection} onPaste={pasteText} onInput={save}/>
    <i className="annotation-resize nw" onPointerDown={(event) => resize(event, 'left', 'top')}/><i className="annotation-resize ne" onPointerDown={(event) => resize(event, 'right', 'top')}/><i className="annotation-resize sw" onPointerDown={(event) => resize(event, 'left', 'bottom')}/><i className="annotation-resize se" onPointerDown={(event) => resize(event, 'right', 'bottom')}/>
  </div>
}
