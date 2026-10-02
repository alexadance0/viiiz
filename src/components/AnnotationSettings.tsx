import { useEffect, useRef } from 'react'
import { ArrowUpRight, Copy, Eye, EyeOff, LockKeyhole, Minus, MousePointer2, Plus, Square, Trash2, Type, UnlockKeyhole, X } from 'lucide-react'
import type { ChartAnnotation, ChartConfig, ChartDecoration, ChartElementSelection } from '../core/types'
import { decorationControls, detachDecorationText } from './decorationGeometry'
import { annotationTextHtml, clearInlineStyle, sanitizeAnnotationHtml } from '../core/annotationHtml'
import { textFonts } from '../core/textFonts'
import { ColorControl } from './PickerControls'
import { NumberInput } from './NumberInput'
import { SettingsCheckbox } from './SettingsCheckbox'
import './AnnotationSettings.css'

export type AnnotationTool = 'text' | 'line' | 'arrow' | 'area'
export interface AnnotationPlacement { x: number; y: number; width?: number; height?: number }
const tools = [
  { type: 'text', label: 'Текст', Icon: Type, instruction: 'Нажмите на холст, чтобы разместить текст.' },
  { type: 'arrow', label: 'Стрелка', Icon: ArrowUpRight, instruction: 'Протяните стрелку к нужной точке графика.' },
  { type: 'line', label: 'Линия', Icon: Minus, instruction: 'Протяните линию на холсте. Shift — по горизонтали или вертикали.' },
  { type: 'area', label: 'Область', Icon: Square, instruction: 'Протяните прямоугольник, чтобы выделить область.' },
] as const
const decorationLabels: Record<ChartDecoration['type'], string> = { area: 'Область', line: 'Линия', arrow: 'Стрелка', 'horizontal-line': 'Горизонтальная линия', 'vertical-line': 'Вертикальная линия', 'curved-line': 'Изогнутая линия' }

function annotationText(annotation: ChartAnnotation) {
  const element = document.createElement('div')
  element.innerHTML = sanitizeAnnotationHtml(annotation.html ?? annotationTextHtml(annotation.fragments.map((fragment) => fragment.text).join('')))
  return element.textContent?.trim() || 'Текст'
}

function AnnotationTextEditor({ value, onChange }: { value: ChartAnnotation; onChange(value: ChartAnnotation): void }) {
  const editor = useRef<HTMLDivElement>(null)
  const html = sanitizeAnnotationHtml(value.html ?? annotationTextHtml(value.fragments.map((fragment) => fragment.text).join('')))
  useEffect(() => { if (editor.current && editor.current.innerHTML !== html) editor.current.innerHTML = html }, [value.id, html])
  return <label>Содержание<div ref={editor} className="annotation-sidebar-text" role="textbox" aria-label="Текст аннотации" aria-multiline="true" contentEditable={!value.locked} suppressContentEditableWarning onInput={(event) => onChange({ ...value, html: sanitizeAnnotationHtml(event.currentTarget.innerHTML) })} onPaste={(event) => {
    event.preventDefault()
    const selection = window.getSelection()
    if (!selection?.rangeCount || !event.currentTarget.contains(selection.anchorNode)) return
    const range = selection.getRangeAt(0)
    range.deleteContents()
    const text = document.createTextNode(event.clipboardData.getData('text/plain'))
    range.insertNode(text); range.setStartAfter(text); range.collapse(true)
    selection.removeAllRanges(); selection.addRange(range)
    onChange({ ...value, html: sanitizeAnnotationHtml(event.currentTarget.innerHTML) })
  }}/></label>
}

interface Props {
  config: ChartConfig
  canvasWidth?: number
  canvasHeight?: number
  resolvedDecorations?: ChartDecoration[]
  pointLabels?: ChartElementSelection[]
  pickingAnchor?: 'text' | 'data' | null
  onPickAnchor?(kind: 'text' | 'data'): void
  onConnectText?(annotation: ChartAnnotation): void
  selectedAnnotation: string | null
  selectedDecoration: string | null
  tool: AnnotationTool | null
  onTool(tool: AnnotationTool | null): void
  onPlace(placement: AnnotationPlacement): void
  onSelect(kind: 'text' | 'decoration', id: string | null): void
  onChange(config: ChartConfig): void
}

export function AnnotationSettings({ config, canvasWidth, canvasHeight, resolvedDecorations, pointLabels = [], pickingAnchor, onPickAnchor, onConnectText, selectedAnnotation, selectedDecoration, tool, onTool, onPlace, onSelect, onChange }: Props) {
  const annotation = config.annotations.find((item) => item.id === selectedAnnotation)
  const storedDecoration = config.decorations?.find((item) => item.id === selectedDecoration)
  const layout = resolvedDecorations?.find((item) => item.id === storedDecoration?.id)
  const decoration = storedDecoration ? { ...storedDecoration, ...(layout ? { x: layout.x, y: layout.y, width: layout.width, height: layout.height } : {}) } : undefined
  const anchorLabel = (anchor: ChartDecoration['startAnchor']) => {
    if (anchor?.annotationId) {
      const text = config.annotations.find((item) => item.id === anchor.annotationId)
      return text ? text.name || annotationText(text) : 'Текст недоступен'
    }
    const point = pointLabels.find((item) => item.key === anchor?.elementKey)
    return point ? `${point.seriesName} · ${point.category} · ${point.value}` : 'Точка недоступна'
  }
  const hasTextAnchors = config.annotations.some((item) => !item.hidden)
  const attached = !!(decoration?.startAnchor || decoration?.endAnchor)
  const selected = annotation ?? decoration
  const width = canvasWidth ?? Math.min(1000, config.canvasWidth ?? 1000), height = canvasHeight ?? Math.min(1000, config.canvasHeight ?? 563)
  const updateAnnotation = (value: ChartAnnotation) => onChange({ ...config, annotations: config.annotations.map((item) => item.id === value.id ? value : item) })
  const updateDecoration = (value: ChartDecoration) => onChange({ ...config, decorations: config.decorations?.map((item) => item.id === value.id ? value : item) })
  const objects = [
    ...config.annotations.map((value) => ({ value, kind: 'text' as const, label: annotationText(value), Icon: Type })),
    ...(config.decorations ?? []).map((value) => ({ value, kind: 'decoration' as const, label: decorationLabels[value.type], Icon: value.type === 'area' ? Square : value.arrowPlacement && value.arrowPlacement !== 'none' || value.type === 'arrow' ? ArrowUpRight : Minus })),
  ]
  const updateObject = (id: string, patch: Partial<ChartAnnotation & ChartDecoration>) => onChange({ ...config, annotations: config.annotations.map((item) => item.id === id ? { ...item, ...patch } : item), decorations: config.decorations?.map((item) => item.id === id ? { ...item, ...patch } : item) })
  const duplicate = () => {
    if (!selected) return
    const id = crypto.randomUUID()
    const copy = { ...structuredClone(selected), id, name: selected.name ? `${selected.name} — копия` : undefined, hidden: false, locked: false, x: Math.min(Math.max(0, width - Math.max(0, selected.width)), selected.x + 20), y: Math.min(Math.max(0, height - Math.max(40, selected.height ?? 40)), selected.y + 20) }
    if (annotation) onChange({ ...config, annotations: [...config.annotations, { ...copy as ChartAnnotation, fragments: annotation.fragments.map((fragment) => ({ ...fragment, id: crypto.randomUUID() })) }] })
    else onChange({ ...config, decorations: [...(config.decorations ?? []), copy as ChartDecoration] })
    onSelect(annotation ? 'text' : 'decoration', id)
  }
  const remove = () => {
    if (!selected) return
    onChange({ ...config, annotations: config.annotations.filter((item) => item.id !== selected.id), decorations: config.decorations?.filter((item) => item.id !== selected.id).map((item) => detachDecorationText(item, selected.id, resolvedDecorations?.find((layout) => layout.id === item.id))) })
    onSelect(annotation ? 'text' : 'decoration', null)
  }
  const textStyle = (patch: Partial<ChartAnnotation>, properties: string[] = []) => annotation && updateAnnotation({ ...annotation, ...patch, html: properties.reduce((html, property) => clearInlineStyle(html, property), annotation.html) })
  const placeInCenter = () => onPlace(tool === 'text' ? { x: Math.round(Math.max(0, width - 240) / 2), y: Math.round(Math.max(0, height - 60) / 2) } : tool === 'area' ? { x: Math.round(width * .35), y: Math.round(height * .39) } : { x: Math.round(width * .425), y: Math.round(height * .56) })
  const swatches = config.palette?.length ? config.palette : [config.color]
  return <div className="annotation-settings">
    <div className="annotation-create"><h3>Добавить на график</h3><div className="annotation-tool-grid" role="group" aria-label="Добавить аннотацию">{tools.map(({ type, label, Icon }) => <button type="button" key={type} aria-pressed={tool === type} onClick={() => onTool(tool === type ? null : type)}><Icon size={18}/><span>{label}</span></button>)}</div>
      {tool && <div className="annotation-placement-hint" role="status"><MousePointer2 size={16}/><p>{tools.find((item) => item.type === tool)?.instruction}</p><button type="button" aria-label="Отменить добавление" onClick={() => onTool(null)}><X size={16}/></button><button type="button" className="annotation-place-center" onClick={placeInCenter}>Добавить в центр</button></div>}
    </div>
    <div className="annotation-objects"><header><h3>Объекты</h3><span>{objects.length}</span></header>
      {!objects.length ? <p className="annotation-empty">Добавьте пояснение, укажите на важную точку или выделите область. Объекты появятся здесь.</p> : <ul aria-label="Аннотации на графике">{objects.map(({ value, kind, label, Icon }) => <li key={value.id} className={selected?.id === value.id ? 'selected' : ''}>
        <button type="button" className="annotation-object-select" aria-pressed={selected?.id === value.id} onClick={() => onSelect(kind, value.id)}><Icon size={15}/><span>{value.name || label}</span></button>
        <button type="button" aria-label={`${value.hidden ? 'Показать' : 'Скрыть'}: ${value.name || label}`} title={value.hidden ? 'Показать' : 'Скрыть'} aria-pressed={!!value.hidden} onClick={() => updateObject(value.id, { hidden: !value.hidden })}>{value.hidden ? <EyeOff size={15}/> : <Eye size={15}/>}</button>
        <button type="button" aria-label={`${value.locked ? 'Разблокировать' : 'Заблокировать'}: ${value.name || label}`} title={value.locked ? 'Разблокировать' : 'Заблокировать'} aria-pressed={!!value.locked} onClick={() => updateObject(value.id, { locked: !value.locked })}>{value.locked ? <LockKeyhole size={15}/> : <UnlockKeyhole size={15}/>}</button>
      </li>)}</ul>}
    </div>
    {selected ? <section className="annotation-properties" aria-label="Свойства аннотации"><header><h3>{annotation ? 'Текст' : decorationLabels[decoration!.type]}</h3><div><button type="button" aria-label="Дублировать объект" title="Дублировать" onClick={duplicate}><Copy size={16}/></button><button type="button" aria-label="Удалить объект" title="Удалить" disabled={selected.locked} onClick={remove}><Trash2 size={16}/></button><button type="button" aria-label="Закрыть свойства" onClick={() => onSelect(annotation ? 'text' : 'decoration', null)}><X size={16}/></button></div></header>
      {selected.locked && <p className="annotation-state-note">Объект заблокирован. Разблокируйте его в списке, чтобы изменить.</p>}
      {selected.hidden && <p className="annotation-state-note">Объект скрыт на холсте и при экспорте.</p>}
      <fieldset disabled={selected.locked}>
        <label>Название в списке<input value={selected.name ?? ''} placeholder={annotation ? annotationText(annotation) : decorationLabels[decoration!.type]} onChange={(event) => updateObject(selected.id, { name: event.target.value })}/></label>
        {annotation && <>
          <button type="button" className="annotation-pick-point" onClick={() => onConnectText?.(annotation)}><ArrowUpRight size={15}/>Добавить стрелку к тексту</button>
          <AnnotationTextEditor value={annotation} onChange={updateAnnotation}/>
          <label>Шрифт<select value={annotation.fontFamily} onChange={(event) => textStyle({ fontFamily: event.target.value }, ['font-family'])}>{!textFonts.some(([font]) => font === annotation.fontFamily) && <option value={annotation.fontFamily}>{annotation.fontFamily.split(',')[0]}</option>}{textFonts.map(([font, label]) => <option key={font} value={font}>{label}</option>)}{config.customFonts?.map((font) => <option key={font.name} value={`"${font.name}", sans-serif`}>{font.name}</option>)}</select></label>
          <div className="annotation-field-row"><label>Размер, px<NumberInput min={6} max={120} value={annotation.fontSize} onValueChange={(fontSize) => textStyle({ fontSize }, ['font-size'])}/></label><label>Цвет текста<ColorControl value={annotation.fragments[0]?.color ?? config.titleText.color} swatches={swatches} onChange={(color) => textStyle({ fragments: annotation.fragments.map((fragment) => ({ ...fragment, color })) }, ['color'])}/></label></div>
          <label>Выравнивание<select value={annotation.textAlign} onChange={(event) => textStyle({ textAlign: event.target.value as ChartAnnotation['textAlign'] })}><option value="left">Слева</option><option value="center">По центру</option><option value="right">Справа</option></select></label>
          <label>Подложка текста<ColorControl value={annotation.backgroundColor === 'transparent' ? config.canvasBackground ?? '#ffffff' : annotation.backgroundColor} swatches={swatches} onChange={(backgroundColor) => textStyle({ backgroundColor })}/></label>
          <SettingsCheckbox isSelected={annotation.backgroundColor !== 'transparent'} onChange={(enabled) => textStyle({ backgroundColor: enabled ? config.canvasBackground ?? '#ffffff' : 'transparent' })}>Подложка под текстом</SettingsCheckbox>
          <SettingsCheckbox isSelected={(annotation.textStrokeWidth ?? 0) > 0} onChange={(enabled) => textStyle({ textStrokeColor: config.canvasBackground ?? '#ffffff', textStrokeWidth: enabled ? 6 : 0 }, ['-webkit-text-stroke-width', '-webkit-text-stroke-color', 'text-shadow'])}>Контур для читаемости</SettingsCheckbox>
          <p className="annotation-editor-note">Выделите часть текста на холсте, чтобы настроить её отдельно.</p>
        </>}
        {decoration && <>
          {decoration.type !== 'area' && <div className="annotation-attachment-fields">
            <div className="annotation-anchor-field"><strong>Начало линии</strong><button type="button" className="annotation-pick-point" disabled={!hasTextAnchors} aria-pressed={pickingAnchor === 'text'} onClick={() => onPickAnchor?.('text')}><MousePointer2 size={15}/>{pickingAnchor === 'text' ? 'Отменить выбор у текста' : 'Выбрать точку у текста'}</button>
              {decoration.startAnchor && <div className="annotation-anchor-value"><span>{anchorLabel(decoration.startAnchor)}</span><button type="button" aria-label={decoration.startAnchor.annotationId ? 'Отвязать от текста' : 'Отвязать от графика'} title="Отвязать начало линии" onClick={() => { updateDecoration({ ...decoration, startAnchor: undefined }); if (pickingAnchor === 'text') onPickAnchor?.('text') }}><X size={14}/></button></div>}
              {pickingAnchor === 'text' && <p className="annotation-editor-note" role="status">Нажмите на точку вокруг нужного текста. Esc — отменить.</p>}
              {!hasTextAnchors && <p className="annotation-editor-note">Сначала добавьте текст на холст.</p>}
            </div>
            {(pointLabels.length > 0 || decoration.endAnchor) && <div className="annotation-anchor-field"><strong>Конец линии</strong><button type="button" className="annotation-pick-point" aria-pressed={pickingAnchor === 'data'} onClick={() => onPickAnchor?.('data')}><MousePointer2 size={15}/>{pickingAnchor === 'data' ? 'Отменить выбор точки' : 'Выбрать точку на графике'}</button>
              {decoration.endAnchor && <div className="annotation-anchor-value"><span>{anchorLabel(decoration.endAnchor)}</span><button type="button" aria-label={decoration.endAnchor.annotationId ? 'Отвязать от текста' : 'Отвязать от графика'} title="Отвязать конец линии" onClick={() => { updateDecoration({ ...decoration, endAnchor: undefined }); if (pickingAnchor === 'data') onPickAnchor?.('data') }}><X size={14}/></button></div>}
              {pickingAnchor === 'data' && <p className="annotation-editor-note" role="status">Нажмите на отмеченную точку графика. Esc — отменить.</p>}
            </div>}
            <p className="annotation-editor-note">Перетащите любой конец линии к тексту или точке графика. Shift — без привязки, Esc — отменить.</p>
          </div>}
          {decoration.type !== 'area' && <label>Форма<select value={decoration.type === 'arrow' ? 'line' : decoration.type} onChange={(event) => { const type = event.target.value as ChartDecoration['type']; updateDecoration({ ...decoration, type, width: type === 'vertical-line' ? 0 : decoration.width || 200, height: type === 'horizontal-line' ? 0 : decoration.height || 120 }) }}><option value="line">Прямая</option><option value="horizontal-line" disabled={attached}>Горизонтальная</option><option value="vertical-line" disabled={attached}>Вертикальная</option><option value="curved-line">Изогнутая</option></select></label>}
          <label>{decoration.type === 'area' ? 'Заливка' : 'Цвет линии'}<ColorControl value={decoration.color} swatches={swatches} onChange={(color) => updateDecoration({ ...decoration, color })}/></label>
          <div className="annotation-field-row"><label>Прозрачность, %<NumberInput min={0} max={100} value={Math.round((1 - decoration.opacity) * 100)} onValueChange={(transparency) => updateDecoration({ ...decoration, opacity: 1 - transparency / 100 })}/></label><label>{decoration.type === 'area' ? 'Граница, px' : 'Толщина, px'}<NumberInput min={decoration.type === 'area' ? 0 : .5} max={12} step={.5} value={decoration.lineWidth} onValueChange={(lineWidth) => updateDecoration({ ...decoration, lineWidth })}/></label></div>
          <label>Стиль линии<select value={decoration.lineType} onChange={(event) => updateDecoration({ ...decoration, lineType: event.target.value as ChartDecoration['lineType'] })}><option value="solid">Сплошная</option><option value="dashed">Пунктир</option><option value="dotted">Точки</option></select></label>
          {decoration.type !== 'area' && <><label>Наконечники<select value={decoration.arrowPlacement ?? (decoration.endArrow || decoration.type === 'arrow' ? 'end' : 'none')} onChange={(event) => { const arrowPlacement = event.target.value as ChartDecoration['arrowPlacement']; updateDecoration({ ...decoration, arrowPlacement, endArrow: arrowPlacement !== 'none' }) }}><option value="none">Без наконечника</option><option value="end">В конце</option><option value="start">В начале</option><option value="both">С двух сторон</option></select></label>{(decoration.arrowPlacement ?? (decoration.endArrow || decoration.type === 'arrow' ? 'end' : 'none')) !== 'none' && <label>Вид наконечника<select value={decoration.arrowHead ?? 'filled'} onChange={(event) => updateDecoration({ ...decoration, arrowHead: event.target.value as ChartDecoration['arrowHead'] })}><option value="filled">Стрелка</option><option value="open">Открытая стрелка</option><option value="circle">Точка</option><option value="bar">Засечка</option></select></label>}</>}
          {decoration.type === 'curved-line' && <><label>Форма изгиба<select value={decoration.controlPoints ? 'custom' : 'smooth'} onChange={(event) => {
            const shape = event.target.value
            if (shape === 'smooth') { updateDecoration({ ...decoration, controlPoints: undefined, curvature: .28 }); return }
            const dx = decoration.width, dy = decoration.height
            const controlPoints = shape === 'horizontal' ? { first: { x: dx * .65, y: 0 }, second: { x: -dx * .15, y: -dy * .65 } } : shape === 'vertical' ? { first: { x: 0, y: dy * .65 }, second: { x: -dx * .65, y: 0 } } : { first: { x: dx * .7, y: 0 }, second: { x: -dx * .7, y: 0 } }
            updateDecoration({ ...decoration, controlPoints })
          }}><option value="smooth">Плавная дуга</option><option value="horizontal">Выход по горизонтали</option><option value="vertical">Выход по вертикали</option><option value="s">S-образная</option>{decoration.controlPoints && <option value="custom">Своя форма</option>}</select></label><p className="annotation-editor-note">Два управляющих узла на холсте задают изгиб у начала и конца линии.</p><details className="annotation-position"><summary>Управляющие узлы</summary><div>{(['first', 'second'] as const).map((key, index) => { const controls = decorationControls(decoration); const offset = { x: controls[key].x - decoration.x - (index ? decoration.width : 0), y: controls[key].y - decoration.y - (index ? decoration.height : 0) }; return <div className="annotation-field-row" key={key}>{(['x', 'y'] as const).map((axis) => <label key={axis}>Узел {index + 1}: {axis.toUpperCase()}<NumberInput min={-width} max={width} value={Math.round(offset[axis])} onValueChange={(value) => { const first = { x: controls.first.x - decoration.x, y: controls.first.y - decoration.y }, second = { x: controls.second.x - decoration.x - decoration.width, y: controls.second.y - decoration.y - decoration.height }; const changed = key === 'first' ? first : second; changed[axis] = value; updateDecoration({ ...decoration, controlPoints: { first, second } }) }}/></label>)}</div> })}</div></details></>}
          {decoration.type === 'area' && <><SettingsCheckbox isSelected={decoration.fitToPlot ?? false} onChange={(fitToPlot) => updateDecoration({ ...decoration, fitToPlot })}>На всю высоту графика</SettingsCheckbox><SettingsCheckbox isSelected={decoration.fitToPlotWidth ?? false} onChange={(fitToPlotWidth) => updateDecoration({ ...decoration, fitToPlotWidth })}>На всю ширину графика</SettingsCheckbox></>}
        </>}
        <details className="annotation-position"><summary>Положение и размер</summary><div>{attached && <p className="annotation-editor-note">Положение определяется привязками. Отключите их, чтобы изменить координаты вручную.</p>}
          <div className="annotation-field-row"><label>X, px<NumberInput min={0} max={width} disabled={attached || decoration?.fitToPlotWidth} value={Math.round(selected.x)} onValueChange={(x) => updateObject(selected.id, { x })}/></label><label>Y, px<NumberInput min={0} max={height} disabled={attached || decoration?.fitToPlot} value={Math.round(selected.y)} onValueChange={(y) => updateObject(selected.id, { y })}/></label></div>
          <div className="annotation-field-row"><label>{decoration && decoration.type !== 'area' ? 'Смещение X, px' : 'Ширина, px'}<NumberInput min={decoration && decoration.type !== 'area' ? -width : 20} max={width} disabled={attached || decoration?.fitToPlotWidth || decoration?.type === 'vertical-line'} value={Math.round(selected.width)} onValueChange={(nextWidth) => updateObject(selected.id, { width: nextWidth })}/></label>{decoration && <label>{decoration.type === 'area' ? 'Высота, px' : 'Смещение Y, px'}<NumberInput min={decoration.type === 'area' ? 10 : -height} max={height} disabled={attached || decoration.fitToPlot || decoration.type === 'horizontal-line'} value={Math.round(decoration.height)} onValueChange={(nextHeight) => updateDecoration({ ...decoration, height: nextHeight })}/></label>}</div>
        </div></details>
      </fieldset>
    </section> : objects.length > 0 && <p className="annotation-select-hint"><Plus size={15}/>Выберите объект в списке или на холсте, чтобы изменить его.</p>}
  </div>
}
