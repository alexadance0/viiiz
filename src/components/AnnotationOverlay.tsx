import { AnnotationHalo, syncAnnotationHaloScroll } from './AnnotationHalo'
import { useEffect, useRef, useState } from 'react'
import { ToggleButton, ToggleButtonGroup } from '@heroui/react'
import { AlignCenter, AlignLeft, AlignRight, Copy, Trash2 } from 'lucide-react'
import type { ChartAnnotation, ChartConfig } from '../core/types'
import { annotationTextHtml, highlightTextRange, sanitizeAnnotationHtml } from '../core/annotationHtml'
import { TextFragmentToolbar } from './TextFragmentToolbar'
import './AnnotationText.css'
import { readAlignmentBoxes, snapAnnotationBox, type AlignmentProps } from './annotationAlignment'

interface Props extends AlignmentProps { annotation: ChartAnnotation; customFonts?: ChartConfig['customFonts']; canvasBackground?: string; onChange(value: ChartAnnotation): void; onDuplicate(): void; onDelete(): void; onClose(): void }

const annotationStyle = (annotation: ChartAnnotation, _canvasBackground = '#ffffff'): React.CSSProperties => {
  const hasBackground = annotation.backgroundColor && annotation.backgroundColor !== 'transparent'
  const maskColor = hasBackground ? annotation.backgroundColor : 'transparent'
  return { left: annotation.x, top: annotation.y, width: annotation.width, maxWidth: `calc(100% - ${Math.max(0, annotation.x)}px)`, boxSizing: 'border-box', fontFamily: annotation.fontFamily, fontSize: annotation.fontSize, color: annotation.fragments[0]?.color ?? '#292929', lineHeight: '1.35', textAlign: annotation.textAlign ?? 'left', background: maskColor, borderColor: annotation.borderColor }
}

const annotationTextStyle = (annotation: ChartAnnotation): React.CSSProperties => ({ color: annotation.fragments[0]?.color ?? '#292929', ...(annotation.textStrokeColor ? { WebkitTextStrokeColor: annotation.textStrokeColor, WebkitTextStrokeWidth: `${annotation.textStrokeWidth ?? 6}px`, paintOrder: 'stroke fill' } : {}) })

export function AnnotationDisplay({ annotation, customFonts, canvasBackground, onSelect }: { annotation: ChartAnnotation; customFonts?: ChartConfig['customFonts']; canvasBackground?: string; onSelect(): void }) {
  const html = sanitizeAnnotationHtml(annotation.html ?? annotationTextHtml(annotation.fragments.map((item) => item.text).join('')))
  return <div data-annotation-id={annotation.id} className="canvas-annotation annotation-display" style={annotationStyle(annotation, canvasBackground)} onClick={(event) => { event.stopPropagation(); onSelect() }}><AnnotationHalo annotation={annotation} customFonts={customFonts}/><div className="annotation-content annotation-foreground" onScroll={syncAnnotationHaloScroll} style={annotationTextStyle(annotation)} dangerouslySetInnerHTML={{ __html: html }}/></div>
}

export function AnnotationOverlay({ annotation, customFonts, canvasBackground = '#ffffff', alignmentBoxes = [], onGuidesChange, onChange, onDuplicate, onDelete, onClose }: Props) {
  const editor = useRef<HTMLDivElement>(null)
  const dragCleanup = useRef<(() => void) | null>(null)
  useEffect(() => () => dragCleanup.current?.(), [annotation.id])
  const [editing, setEditing] = useState(false)
  const [moving, setMoving] = useState(false)
  useEffect(() => { setEditing(false) }, [annotation.id])
  const range = useRef<Range | null>(null)
  const [toolbarEdge, setToolbarEdge] = useState<'start' | 'end'>('start')
  const [toolbarStyle, setToolbarStyle] = useState({ fontFamily: annotation.fontFamily, size: annotation.fontSize, color: annotation.fragments[0]?.color ?? '#292929' })
  const syncToolbarStyle = () => {
    const target = editor.current?.querySelector<HTMLElement>('span[style], b, strong, i, em, u') ?? editor.current
    if (!target) return setToolbarStyle({ fontFamily: annotation.fontFamily, size: annotation.fontSize, color: annotation.fragments[0]?.color ?? '#292929' })
    const computed = window.getComputedStyle(target)
    setToolbarStyle({ fontFamily: computed.fontFamily || annotation.fontFamily, size: Math.round(Number.parseFloat(computed.fontSize)) || annotation.fontSize, color: computed.color || annotation.fragments[0]?.color || '#292929' })
  }
  // Keep the caret during canvas edits; sync only when the sidebar changes the HTML.
  useEffect(() => {
    const html = sanitizeAnnotationHtml(annotation.html ?? annotationTextHtml(annotation.fragments.map((item) => item.text).join('')))
    if (editor.current && editor.current.innerHTML !== html) editor.current.innerHTML = html
    requestAnimationFrame(syncToolbarStyle)
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [annotation.id, annotation.html, annotation.fontFamily, annotation.fontSize, annotation.fragments])
  useEffect(() => {
    const shell = editor.current?.closest('.chart-canvas-shell')
    setToolbarEdge(shell && annotation.x + 430 > shell.clientWidth ? 'end' : 'start')
  }, [annotation.x, annotation.width])
  const rememberSelection = () => {
    const selection = window.getSelection()
    if (selection?.rangeCount && editor.current?.contains(selection.anchorNode)) range.current = selection.getRangeAt(0).cloneRange()
  }
  const restoreSelection = () => {
    if (!range.current || !editor.current?.contains(range.current.commonAncestorContainer)) return false
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
    if (styles.backgroundColor) {
      range.current = highlightTextRange(currentRange, styles.backgroundColor)
      restoreSelection(); save(); syncToolbarStyle()
      return
    }
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
    if (event.button !== 0) return
    event.preventDefault(); event.stopPropagation()
    const startX = event.clientX, startY = event.clientY, originalX = annotation.x, originalY = annotation.y
    const shell = editor.current?.closest('.chart-canvas-shell')
    const scale = shell ? shell.getBoundingClientRect().width / Math.max(1, shell.clientWidth) : 1
    dragCleanup.current?.()
    const targets = readAlignmentBoxes(shell, alignmentBoxes, `text:${annotation.id}`)
    const height = editor.current?.parentElement?.offsetHeight ?? 50
    const move = (next: PointerEvent) => {
      if (Math.hypot(next.clientX - startX, next.clientY - startY) < 3) return
      setMoving(true)
      const maxX = Math.max(0, (shell?.clientWidth ?? Infinity) - annotation.width)
      const maxY = Math.max(0, (shell?.clientHeight ?? Infinity) - height)
      const box = { id: annotation.id, x: Math.min(maxX, Math.max(0, originalX + (next.clientX - startX) / scale)), y: Math.min(maxY, Math.max(0, originalY + (next.clientY - startY) / scale)), width: annotation.width, height }
      const snapped = next.shiftKey ? { ...box, guides: [] } : snapAnnotationBox(box, targets, 6 / scale)
      onGuidesChange?.(snapped.guides)
      onChange({ ...annotation, x: Math.min(maxX, Math.max(0, snapped.x)), y: Math.min(maxY, Math.max(0, snapped.y)) })
    }
    const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', cancel); window.removeEventListener('keydown', escape, true); onGuidesChange?.([]); setMoving(false); dragCleanup.current = null }
    const cancel = () => { onChange(annotation); end() }
    const escape = (next: KeyboardEvent) => { if (next.key === 'Escape') { next.preventDefault(); next.stopPropagation(); cancel() } }
    dragCleanup.current = end
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', cancel); window.addEventListener('keydown', escape, true)
  }
  const resize = (event: React.PointerEvent, horizontal: 'left' | 'right') => {
    event.preventDefault(); event.stopPropagation()
    const shell = editor.current?.closest('.chart-canvas-shell')
    const scale = shell ? shell.getBoundingClientRect().width / Math.max(1, shell.clientWidth) : 1
    const startX = event.clientX
    const original = annotation
    dragCleanup.current?.()
    const targets = readAlignmentBoxes(shell, alignmentBoxes, `text:${annotation.id}`)
    const move = (next: PointerEvent) => {
      const dx = (next.clientX - startX) / scale
      let x = original.x, width = original.width
      if (horizontal === 'left') { x = Math.min(original.x + original.width - 20, Math.max(0, original.x + dx)); width = original.width + original.x - x }
      else width = Math.max(20, Math.min((shell?.clientWidth ?? Infinity) - original.x, original.width + dx))
      const snapped = next.shiftKey ? { x, guides: [] } : snapAnnotationBox({ id: annotation.id, x, y: original.y, width, height: editor.current?.parentElement?.offsetHeight ?? 50 }, targets, 6 / scale, { x: [horizontal === 'left' ? 0 : 1], y: [], gaps: false })
      const correction = snapped.x - x
      if (horizontal === 'left') { x = Math.min(original.x + original.width - 20, Math.max(0, snapped.x)); width = original.x + original.width - x }
      else width = Math.max(20, Math.min((shell?.clientWidth ?? Infinity) - x, width + correction))
      onGuidesChange?.(snapped.guides)
      onChange({ ...original, x, width, height: undefined })
    }
    const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', cancel); window.removeEventListener('keydown', escape, true); onGuidesChange?.([]); dragCleanup.current = null }
    const cancel = () => { onChange(original); end() }
    const escape = (next: KeyboardEvent) => { if (next.key === 'Escape') { next.preventDefault(); next.stopPropagation(); cancel() } }
    dragCleanup.current = end
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', cancel); window.addEventListener('keydown', escape, true)
  }
  return <div data-annotation-id={annotation.id} className={`canvas-annotation selected${editing ? ' editing' : ''}${moving ? ' moving' : ''}`} style={annotationStyle(annotation, canvasBackground)} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); if (editing) setEditing(false); else onClose() } }}>
    {editing && <TextFragmentToolbar anchorRef={editor} style={toolbarStyle} customFonts={customFonts} strokeColor={(annotation.textStrokeColor ?? annotation.backgroundColor) || canvasBackground} strokeWidth={annotation.textStrokeWidth ?? 6} enableStroke below={annotation.y < 75} edge={toolbarEdge} onBeforeAction={rememberSelection} onApply={apply} onStrokeWidthChange={(textStrokeWidth) => {
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
    </TextFragmentToolbar>}
    <button type="button" className="annotation-move-edge" aria-label="Переместить аннотацию" title="Перетащите текст или рамку. Shift при перетаскивании — без привязки. Стрелки клавиатуры — переместить, Shift — шаг 10 px" onPointerDown={drag} onKeyDown={(event) => {
      const delta = event.shiftKey ? 10 : 1
      const moves: Record<string, [number, number]> = { ArrowLeft: [-delta, 0], ArrowRight: [delta, 0], ArrowUp: [0, -delta], ArrowDown: [0, delta] }
      const move = moves[event.key]
      if (!move) return
      event.preventDefault(); event.stopPropagation()
      const shell = editor.current?.closest('.chart-canvas-shell')
      onChange({ ...annotation, x: Math.max(0, Math.min((shell?.clientWidth ?? Infinity) - annotation.width, annotation.x + move[0])), y: Math.max(0, Math.min((shell?.clientHeight ?? Infinity) - (editor.current?.parentElement?.offsetHeight ?? 0), annotation.y + move[1])) })
    }}/>
    <AnnotationHalo annotation={annotation} customFonts={customFonts}/><div ref={editor} className="annotation-content annotation-foreground" onPointerDown={(event) => { if (!editing) drag(event) }} onScroll={syncAnnotationHaloScroll} style={annotationTextStyle(annotation)} contentEditable={editing} suppressContentEditableWarning tabIndex={0} role="textbox" aria-label="Аннотация на холсте" title="Перетащите — переместить. Shift — без привязки. Двойной клик — редактировать текст" onDoubleClick={() => { setEditing(true); requestAnimationFrame(() => editor.current?.focus()) }} onKeyDown={(event) => { if (event.key === 'Enter' && !editing) { event.preventDefault(); setEditing(true) } }} onMouseUp={rememberSelection} onKeyUp={rememberSelection} onPaste={pasteText} onInput={save}/>
    {(['left', 'right'] as const).map((side) => <button key={side} type="button" className={`annotation-resize horizontal ${side}`} aria-label={`Ширина аннотации: ${side === 'left' ? 'левый' : 'правый'} край`} onPointerDown={(event) => resize(event, side)} onKeyDown={(event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault()
      const delta = event.key === 'ArrowRight' ? 10 : -10
      const shell = editor.current?.closest('.chart-canvas-shell')
      const maxWidth = side === 'left' ? annotation.x + annotation.width : (shell?.clientWidth ?? Infinity) - annotation.x
      const width = Math.max(20, Math.min(maxWidth, annotation.width + (side === 'left' ? -delta : delta)))
      onChange({ ...annotation, x: side === 'left' ? annotation.x + annotation.width - width : annotation.x, width, height: undefined })
    }}/>)}
  </div>
}
