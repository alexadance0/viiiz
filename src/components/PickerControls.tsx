import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColorChannel, ColorSpace } from '@heroui/react'
import { Calendar, ColorArea, ColorField, ColorPicker, ColorSlider, ColorSwatch, DateField, DatePicker, parseColor } from '@heroui/react'
import { getLocalTimeZone, parseDate, today } from '@internationalized/date'
import { CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, Pipette, Shuffle, X } from 'lucide-react'
import './PickerControls.css'

const safeColor = (value: string) => {
  try { return parseColor(value || '#202027') } catch { return parseColor('#202027') }
}
const safeDate = (value?: string) => {
  try { return value ? parseDate(value) : null } catch { return null }
}
const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
const channelLabels: Record<ColorChannel, string> = { hue: 'H', saturation: 'S', brightness: 'B', lightness: 'L', red: 'R', green: 'G', blue: 'B', alpha: 'A' }
const channelsBySpace: Record<ColorSpace, ColorChannel[]> = { hsb: ['hue', 'saturation', 'brightness'], hsl: ['hue', 'saturation', 'lightness'], rgb: ['red', 'green', 'blue'] }
const baseSwatches = ['#202027', '#55515e', '#777580', '#6956e8', '#36a476', '#e4a52c', '#db5a5a', '#ffffff']
const colorText = (color: ReturnType<typeof parseColor>) => color.getChannelValue('alpha') < 1 ? color.toString('css') : color.toString('hex')
const randomColor = () => `#${Math.floor(Math.random() * 0x1000000).toString(16).padStart(6, '0')}`
const recentColorsKey = 'datacanvas.recentColors'
const readRecentColors = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(recentColorsKey) ?? '[]')
    return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === 'string').slice(0, 12) : []
  } catch { return [] }
}

interface ColorControlProps {
  value: string
  code?: React.ReactNode
  icon?: React.ReactNode
  title?: string
  compact?: boolean
  swatches?: string[]
  popoverContent?: React.ReactNode
  onChange(value: string): void
}

export function ColorControl({ value, code, icon, title = 'Выбрать цвет', compact = false, swatches = [], popoverContent, onChange }: ColorControlProps) {
  const [color, setColor] = useState(() => safeColor(value).toFormat('hsb'))
  const colorRef = useRef(color)
  const [recentColors, setRecentColors] = useState<string[]>(() => readRecentColors())
  const [paletteSnapshot, setPaletteSnapshot] = useState<string[]>([])
  const [colorSpace, setColorSpace] = useState<ColorSpace>('hsl')
  useEffect(() => {
    const next = safeColor(value).toFormat('hsb')
    colorRef.current = next
    setColor(next)
  }, [value])
  const draft = colorText(color)
  const availablePalette = useMemo(() => [...new Set([...recentColors, ...swatches, ...baseSwatches].filter(Boolean))].slice(0, 18), [recentColors, swatches])
  const palette = paletteSnapshot.length ? paletteSnapshot : availablePalette
  const rememberColor = (next: string) => {
    setRecentColors((current) => {
      const colors = [next, ...current.filter((item) => item.toLowerCase() !== next.toLowerCase())].slice(0, 12)
      localStorage.setItem(recentColorsKey, JSON.stringify(colors))
      return colors
    })
  }
  const updateDraft = (next: ReturnType<typeof parseColor>) => {
    colorRef.current = next
    setColor(next)
  }
  const publish = (next = colorText(colorRef.current), remember = false) => {
    onChange(next)
    if (remember) rememberColor(next)
  }
  const commit = (next: string, remember = false) => {
    const parsed = safeColor(next).toFormat('hsb')
    updateDraft(parsed)
    publish(colorText(parsed), remember)
  }
  const finishGesture = () => requestAnimationFrame(() => publish())
  const pickScreenColor = async () => {
    const EyeDropper = (window as unknown as { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } }).EyeDropper
    if (!EyeDropper) return
    try { commit((await new EyeDropper().open()).sRGBHex, true) } catch { /* user cancelled */ }
  }
  return <div className={`color-control hero-color-control ${compact ? 'compact' : ''}`}>
    <ColorPicker aria-label={title} value={color} onChange={updateDraft} className="hero-color-picker">
      <ColorPicker.Trigger className="hero-color-trigger" aria-label={title} onPress={() => setPaletteSnapshot(availablePalette)}>
        <ColorSwatch color={color} />
        {icon && <span className="hero-color-icon">{icon}</span>}
        {!compact && <><code>{code ?? value}</code><ChevronDown className="hero-color-chevron" size={14} /></>}
      </ColorPicker.Trigger>
      <ColorPicker.Popover className="hero-color-popover" placement="bottom left"><div className="hero-color-popover-content" onBlurCapture={() => publish()}>
        <ColorArea aria-label={`${title}: насыщенность и яркость`} value={color} onChange={updateDraft} colorSpace="hsb" xChannel="saturation" yChannel="brightness" onPointerUp={finishGesture}><ColorArea.Thumb /></ColorArea>
        <ColorSlider aria-label={`${title}: оттенок`} value={color} onChange={updateDraft} colorSpace="hsb" channel="hue" onPointerUp={finishGesture}><span>Hue</span><ColorSlider.Track><ColorSlider.Thumb /></ColorSlider.Track></ColorSlider>
        <ColorSlider aria-label={`${title}: прозрачность`} value={color} onChange={updateDraft} colorSpace="hsb" channel="alpha" onPointerUp={finishGesture}><span>Alpha</span><ColorSlider.Track><ColorSlider.Thumb /></ColorSlider.Track></ColorSlider>
        <div className="hero-color-actions">
          <button type="button" onClick={pickScreenColor} disabled={!('EyeDropper' in window)} title="Взять цвет с экрана"><Pipette size={13} />Пипетка</button>
          <button type="button" onClick={() => commit(randomColor(), true)} title="Случайный цвет"><Shuffle size={13} />Рандом</button>
        </div>
        {popoverContent}
        <div className="hero-color-swatches">{palette.map((next) => <button type="button" key={next} aria-label={`Цвет ${next}`} className={next.toLowerCase() === draft.toLowerCase() ? 'active' : ''} onClick={() => commit(next)}><i style={{ background: next }} /></button>)}</div>
        <select aria-label="Цветовая модель" className="hero-color-space" value={colorSpace} onChange={(event) => setColorSpace(event.target.value as ColorSpace)}>
          <option value="hsl">HSL</option>
          <option value="hsb">HSB</option>
          <option value="rgb">RGB</option>
        </select>
        <div className="hero-color-fields" onBlurCapture={() => publish()}>
          {channelsBySpace[colorSpace].map((channel) => <ColorField key={channel} aria-label={`${title}: ${channel}`} channel={channel} colorSpace={colorSpace}>
            <ColorField.Group><ColorField.Prefix>{channelLabels[channel]}</ColorField.Prefix><ColorField.Input /></ColorField.Group>
          </ColorField>)}
        </div>
        <div onBlurCapture={() => publish()}><ColorField aria-label={`${title}: HEX`} value={color} onChange={(next) => next && updateDraft(next.toFormat('hsb'))}>
          <ColorField.Group><ColorField.Prefix>#</ColorField.Prefix><ColorField.Input /></ColorField.Group>
        </ColorField></div>
      </div></ColorPicker.Popover>
    </ColorPicker>
  </div>
}

interface DateControlProps {
  value?: string
  min?: string
  max?: string
  label: string
  onChange(value: string): void
}

export function DateControl({ value = '', min, max, label, onChange }: DateControlProps) {
  const date = safeDate(value)
  const dateKey = date?.toString() ?? ''
  const [focusedDate, setFocusedDate] = useState(date ?? today(getLocalTimeZone()))
  const [yearOpen, setYearOpen] = useState(false)
  const [monthOpen, setMonthOpen] = useState(false)
  useEffect(() => { const next = safeDate(dateKey); if (next) setFocusedDate(next) }, [dateKey])
  const years = useMemo(() => {
    const start = safeDate(min)?.year ?? 1900, end = safeDate(max)?.year ?? 2099
    return Array.from({ length: Math.max(1, end - start + 1) }, (_, index) => start + index)
  }, [max, min])
  const pickYear = (year: number) => { setFocusedDate(focusedDate.set({ year })); setYearOpen(false) }
  const pickMonth = (month: number) => { setFocusedDate(focusedDate.set({ month })); setMonthOpen(false) }
  return <DatePicker aria-label={label} value={date} minValue={safeDate(min)} maxValue={safeDate(max)} onOpenChange={(open) => { if (!open) { setYearOpen(false); setMonthOpen(false) } }} onChange={(next) => onChange(next?.toString() ?? '')} className="hero-date-picker">
    <DateField.Group className={`hero-date-group ${value ? '' : 'empty'}`} fullWidth>
      <DateField.Input className="hero-date-input">{(segment) => <DateField.Segment className="hero-date-segment" segment={segment} />}</DateField.Input>
      {!value && <span className="hero-date-placeholder">Авто</span>}
      <DateField.Suffix className="hero-date-suffix">
        <DatePicker.Trigger className="hero-date-trigger" aria-label={label}>
          <DatePicker.TriggerIndicator><CalendarIcon size={14} /></DatePicker.TriggerIndicator>
        </DatePicker.Trigger>
      </DateField.Suffix>
    </DateField.Group>
    <DatePicker.Popover className="hero-date-popover" placement="bottom left">
      <Calendar aria-label={label} focusedValue={focusedDate} onFocusChange={setFocusedDate}>
        <Calendar.Header>
          <button type="button" className="hero-date-year-trigger" onClick={() => { setMonthOpen(false); setYearOpen((open) => !open) }}>{focusedDate.year}<ChevronDown size={13} /></button>
          <button type="button" className="hero-date-month-trigger" onClick={() => { setYearOpen(false); setMonthOpen((open) => !open) }}>{monthNames[focusedDate.month - 1]}<ChevronDown size={13} /></button>
          <Calendar.NavButton slot="previous"><ChevronLeft size={14} /></Calendar.NavButton>
          <Calendar.NavButton slot="next"><ChevronRight size={14} /></Calendar.NavButton>
        </Calendar.Header>
        {!monthOpen && !yearOpen && <Calendar.Grid>
          <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
          <Calendar.GridBody>{(day) => <Calendar.Cell date={day} />}</Calendar.GridBody>
        </Calendar.Grid>}
        {yearOpen && <div className="hero-date-year-grid">{years.map((year) => <button type="button" className={focusedDate.year === year ? 'active' : ''} key={year} onClick={() => pickYear(year)}>{year}</button>)}</div>}
        {monthOpen && <div className="hero-date-month-grid">{monthNames.map((month, index) => <button type="button" className={focusedDate.month === index + 1 ? 'active' : ''} key={month} onClick={() => pickMonth(index + 1)}>{month}</button>)}</div>}
      </Calendar>
      {value && <button type="button" className="hero-date-clear" onClick={() => onChange('')}><X size={13} />Очистить</button>}
    </DatePicker.Popover>
  </DatePicker>
}
