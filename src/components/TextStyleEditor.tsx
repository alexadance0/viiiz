import { ToggleButton, ToggleButtonGroup } from '@heroui/react'
import { AlignCenter, AlignLeft, AlignRight, Italic, Palette } from 'lucide-react'
import type { ChartConfig, ChartTextStyle } from '../core/types'
import { textFonts } from '../core/textFonts'
import { NumberInput } from './NumberInput'
import { ColorControl } from './PickerControls'

interface Props { label: string; value: ChartTextStyle; customFonts?: ChartConfig['customFonts']; onChange(value: ChartTextStyle): void; align?: boolean }

export function TextStyleEditor({ label, value, customFonts, onChange, align = false }: Props) {
  const set = <K extends keyof ChartTextStyle>(key: K, next: ChartTextStyle[K]) => onChange({ ...value, [key]: next })
  const ownFonts = [...new Set(customFonts?.map((font) => font.name) ?? [])]
  return <details className="text-style-editor"><summary>{label}<span style={{ fontFamily: value.fontFamily, color: value.color, fontSize: Math.min(value.size, 14), fontWeight: value.weight, fontStyle: value.italic ? 'italic' : 'normal' }}>Aa</span></summary><div>
    <label>Шрифт<select value={value.fontFamily} onChange={(event) => set('fontFamily', event.target.value)}>{!textFonts.some(([font]) => font === value.fontFamily) && !ownFonts.some((name) => value.fontFamily.startsWith(`"${name}"`)) && <option value={value.fontFamily}>{value.fontFamily.replaceAll('"', '').split(',')[0]} · свой</option>}{textFonts.map(([font, label]) => <option value={font} style={{ fontFamily: font }} key={font}>{label}</option>)}{ownFonts.map((name) => <option value={`"${name}", sans-serif`} style={{ fontFamily: `"${name}"` }} key={name}>{name} · свой</option>)}</select></label>
    <div className="text-control-row"><label>Размер<NumberInput min="6" max="72" value={value.size} onValueChange={(next) => set('size', next)}/></label><label>Цвет<ColorControl value={value.color} icon={<Palette size={14} />} onChange={(next) => set('color', next)}/></label></div>
    <div className="text-control-row"><label>Начертание<select value={value.weight} onChange={(event) => set('weight', Number(event.target.value))}><option value="300">Светлое</option><option value="400">Обычное</option><option value="500">Среднее</option><option value="600">Полужирное</option><option value="700">Жирное</option><option value="800">Очень жирное</option></select></label><label>Интерлиньяж, %<NumberInput min="80" max="250" value={value.lineHeight} onValueChange={(next) => set('lineHeight', next)}/></label></div>
    <div className="text-buttons"><button type="button" className={value.italic ? 'active' : ''} onClick={() => set('italic', !value.italic)}><Italic size={14} /> Курсив</button>{align && <ToggleButtonGroup aria-label="Выравнивание текста" selectionMode="single" disallowEmptySelection selectedKeys={[value.align]} className="text-align-buttons" onSelectionChange={(keys) => { const [next] = [...keys] as ChartTextStyle['align'][]; if (next) set('align', next) }}><ToggleButton id="left" aria-label="Слева"><AlignLeft size={14}/></ToggleButton><ToggleButton id="center" aria-label="По центру"><AlignCenter size={14}/></ToggleButton><ToggleButton id="right" aria-label="Справа"><AlignRight size={14}/></ToggleButton></ToggleButtonGroup>}</div>
  </div></details>
}
