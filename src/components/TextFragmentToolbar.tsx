import { useEffect, useState } from 'react'
import { Toolbar, ToggleButton, ToggleButtonGroup } from '@heroui/react'
import { Bold, Highlighter, Italic, PenLine, Type, Underline } from 'lucide-react'
import type { ChartConfig, ChartTextStyle } from '../core/types'
import { textFonts } from '../core/textFonts'
import { ColorControl } from './PickerControls'

interface Props {
  style: Pick<ChartTextStyle, 'fontFamily' | 'size' | 'color'>
  customFonts?: ChartConfig['customFonts']
  strokeColor?: string
  strokeWidth?: number
  enableStroke?: boolean
  below?: boolean
  edge?: 'start' | 'end'
  onBeforeAction?(): void
  onApply(values: Partial<CSSStyleDeclaration>): void
  onStrokeWidthChange?(value: number): void
  onCommand(command: 'bold' | 'italic' | 'underline'): void
  children?: React.ReactNode
}

const fontLabel = (fontFamily: string, ownFonts: string[]) => {
  const known = textFonts.find(([value]) => value === fontFamily)?.[1]
  if (known) return known
  const own = ownFonts.find((name) => fontFamily.startsWith(`"${name}"`))
  return own ? `${own} · свой` : fontFamily.replaceAll('"', '').split(',')[0]
}

export function TextFragmentToolbar({ style, customFonts, strokeColor = '#ffffff', strokeWidth = 6, enableStroke = false, below, edge = 'start', onBeforeAction, onApply, onStrokeWidthChange, onCommand, children }: Props) {
  const ownFonts = [...new Set(customFonts?.map((font) => font.name) ?? [])]
  const [fontFamily, setFontFamily] = useState(style.fontFamily)
  const [textColor, setTextColor] = useState(style.color)
  const [highlightColor, setHighlightColor] = useState('#fff1a8')
  const [outlineColor, setOutlineColor] = useState(strokeColor)
  const [fontSize, setFontSize] = useState(String(style.size))
  useEffect(() => setFontFamily(style.fontFamily), [style.fontFamily])
  useEffect(() => setTextColor(style.color), [style.color])
  useEffect(() => setOutlineColor(strokeColor), [strokeColor])
  useEffect(() => setFontSize(String(style.size)), [style.size])
  const applySize = (next: number) => {
    if (!Number.isFinite(next) || next < 8 || next > 96) return
    setFontSize(String(next))
    onApply({ fontSize: `${next}px` })
  }
  const currentSize = Number(fontSize) || style.size
  return <Toolbar aria-label="Форматирование фрагмента" className={`annotation-floating-toolbar text-fragment-toolbar ${below ? 'below' : ''} ${edge === 'end' ? 'align-end' : ''}`} onPointerDownCapture={() => onBeforeAction?.()} onMouseDown={(event) => event.stopPropagation()}>
    <select title="Шрифт текста" value={fontFamily} aria-label={`Шрифт: ${fontLabel(fontFamily, ownFonts)}`} onChange={(event) => { setFontFamily(event.target.value); onApply({ fontFamily: event.target.value }) }}>{!textFonts.some(([value]) => value === fontFamily) && !ownFonts.some((name) => fontFamily.startsWith(`"${name}"`)) && <option value={fontFamily}>{fontLabel(fontFamily, ownFonts)}</option>}{textFonts.map(([value, label]) => <option value={value} key={value}>{label}</option>)}{ownFonts.map((name) => <option value={`"${name}", sans-serif`} key={name}>{name} · свой</option>)}</select>
    <div className="text-size-field" aria-label="Размер текста">
      <button type="button" aria-label="Уменьшить размер" onClick={() => applySize(currentSize - 1)}>−</button>
      <input inputMode="numeric" value={fontSize} onChange={(event) => { const next = event.target.value.replace(/[^\d]/g, '').slice(0, 2); setFontSize(next); if (next) applySize(Number(next)) }} onBlur={() => { if (!fontSize) setFontSize(String(style.size)) }} />
      <button type="button" aria-label="Увеличить размер" onClick={() => applySize(currentSize + 1)}>+</button>
    </div>
    <ToggleButtonGroup selectionMode="multiple" className="annotation-format-group">
      <ToggleButton id="bold" aria-label="Жирный" onPress={() => onCommand('bold')}><Bold size={14} /></ToggleButton>
      <ToggleButton id="italic" aria-label="Курсив" onPress={() => onCommand('italic')}><Italic size={14} /></ToggleButton>
      <ToggleButton id="underline" aria-label="Подчёркивание" onPress={() => onCommand('underline')}><Underline size={14} /></ToggleButton>
    </ToggleButtonGroup>
    <span className="toolbar-color-control text-color-control"><ColorControl compact title="Цвет текста" value={textColor} icon={<Type size={14} />} onChange={(next) => { setTextColor(next); onApply({ color: next }) }}/></span>
    <span className="toolbar-color-control highlight-color-control"><ColorControl compact title="Фон текста" value={highlightColor} icon={<Highlighter size={14} />} onChange={(next) => { setHighlightColor(next); onApply({ backgroundColor: next }) }}/></span>
    {enableStroke && <span className="toolbar-color-control stroke-color-control"><ColorControl compact title="Обводка букв" value={outlineColor} icon={<PenLine size={14} />} popoverContent={<label className="stroke-width-control"><span>Толщина силуэта</span><input type="range" min="1" max="12" step="1" value={strokeWidth} onChange={(event) => onStrokeWidthChange?.(Number(event.target.value))}/><output>{strokeWidth} px</output></label>} onChange={(next) => { setOutlineColor(next); onApply({ textShadow: '', webkitTextStrokeColor: next, webkitTextStrokeWidth: `${strokeWidth}px`, paintOrder: 'stroke fill' }) }}/></span>}
    {children}
  </Toolbar>
}
