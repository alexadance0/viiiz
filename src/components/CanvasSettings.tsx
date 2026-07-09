import type { ChartConfig, ChartTextStyle } from '../core/types'
import { NumberInput } from './NumberInput'
import { ColorControl } from './PickerControls'
import './CanvasSettings.css'

interface Props { config: ChartConfig; onChange(config: ChartConfig): void }
const formats = [
  { id: 'presentation-standard', label: '4:3', hint: 'Классический слайд', width: 1000, height: 750 },
  { id: 'presentation-wide', label: '16:9', hint: 'Широкий слайд', width: 1000, height: 563 },
  { id: 'square', label: 'Квадрат', hint: 'Пост', width: 1000, height: 1000 },
  { id: 'portrait', label: '4:5', hint: 'Вертикальный пост', width: 800, height: 1000 },
  { id: 'story', label: '9:16', hint: 'История', width: 562, height: 1000 },
] as const
const typeScales = {
  compact: { label: 'Компактная', sizes: [32, 19, 15, 14, 14, 13, 13, 11] },
  social: { label: 'Для постов', sizes: [48, 28, 20, 18, 19, 17, 17, 15] },
  presentation: { label: 'Для слайдов', sizes: [42, 25, 20, 18, 19, 17, 17, 15] },
} as const
const textKeys = ['titleText', 'subtitleText', 'axisTitleText', 'axisLabelText', 'legendText', 'valueText', 'noteText', 'sourceText'] as const

export function CanvasSettings({ config, onChange }: Props) {
  const patch = (values: Partial<ChartConfig>) => onChange({ ...config, ...values })
  const scaledObjects = (width: number, height: number): Partial<ChartConfig> => {
    const scaleX = width / Math.max(1, config.canvasWidth ?? 1000), scaleY = height / Math.max(1, config.canvasHeight ?? 563)
    return {
      annotations: config.annotations.map((annotation) => ({ ...annotation, x: annotation.x * scaleX, y: annotation.y * scaleY, width: Math.max(80, annotation.width * scaleX), height: annotation.height == null ? undefined : Math.max(60, annotation.height * scaleY) })),
      decorations: config.decorations?.map((decoration) => ({ ...decoration, x: decoration.x * scaleX, y: decoration.y * scaleY, width: decoration.width * scaleX, height: decoration.height * scaleY })),
    }
  }
  const typographyPatch = (preset: keyof typeof typeScales, factor = 1) => {
    const values = typeScales[preset].sizes
    const size = (value: number) => Math.max(8, Math.round(value * factor))
    const styles = Object.fromEntries(textKeys.map((key, index) => [key, { ...config[key], size: size(values[index]), lineHeight: index < 2 ? 115 : 125 } satisfies ChartTextStyle]))
    const footerStyle = { ...config.noteText, size: 18, color: '#666666', lineHeight: 125 }
    return { ...styles, xAxisTitleText: { ...(config.xAxisTitleText ?? config.axisTitleText), size: size(values[2]), lineHeight: 125 }, yAxisTitleText: { ...(config.yAxisTitleText ?? config.axisTitleText), size: size(values[2]), lineHeight: 125 }, xAxisLabelText: { ...(config.xAxisLabelText ?? config.axisLabelText), size: size(values[3]), lineHeight: 125 }, yAxisLabelText: { ...(config.yAxisLabelText ?? config.axisLabelText), size: size(values[3]), lineHeight: 125 }, noteText: footerStyle, sourceText: footerStyle, directLabelText: { ...(config.directLabelText ?? config.legendText), size: size(values[4]), lineHeight: 125 } } as Partial<ChartConfig>
  }
  const applyFormat = (format: typeof formats[number]) => {
    const typography = format.id === 'presentation-wide' || format.id === 'presentation-standard' ? 'presentation' : 'social'
    const fontFactor = format.id === 'story' ? .76 : format.id === 'portrait' ? .9 : format.id === 'presentation-wide' ? .9 : 1
    patch({ canvasPreset: format.id, canvasWidth: format.width, canvasHeight: format.height, xAxisTitleGap: 14, yAxisTitleGap: 14, tickLength: 6, directLabelGap: 16, ...scaledObjects(format.width, format.height), ...typographyPatch(typography, fontFactor) })
  }
  const applyCustomSize = (width: number, height: number) => {
    const portrait = height > width * 1.15
    const preset = portrait ? 'social' : 'presentation'
    const factor = Math.max(.65, Math.min(1, Math.min(width / 800, height / 560)))
    patch({ canvasPreset: 'custom', canvasWidth: width, canvasHeight: height, xAxisTitleGap: Math.max(8, Math.round(14 * factor)), yAxisTitleGap: Math.max(8, Math.round(14 * factor)), tickLength: Math.max(3, Math.round(6 * factor)), directLabelGap: Math.max(8, Math.round(16 * factor)), ...scaledObjects(width, height), ...typographyPatch(preset, factor) })
  }
  return <details className="settings-group canvas-settings"><summary>Холст</summary><div>
    <div className="canvas-presets">{formats.map((format) => <button type="button" className={config.canvasPreset === format.id ? 'active' : ''} key={format.id} onClick={() => applyFormat(format)}><strong>{format.label}</strong><small>{format.hint}<br/>{format.width} × {format.height}</small></button>)}</div>
    <button type="button" className={`canvas-custom-toggle ${config.canvasPreset === 'custom' ? 'active' : ''}`} onClick={() => patch({ canvasPreset: 'custom' })}>Свой размер</button>
    {config.canvasPreset === 'custom' && <div className="canvas-size-grid"><label>Ширина, px<NumberInput min="320" max="1000" step="10" value={Math.min(1000, config.canvasWidth ?? 1000)} onValueChange={(canvasWidth) => applyCustomSize(canvasWidth, config.canvasHeight ?? 563)}/></label><span>×</span><label>Высота, px<NumberInput min="320" max="1000" step="10" value={Math.min(1000, config.canvasHeight ?? 563)} onValueChange={(canvasHeight) => applyCustomSize(config.canvasWidth ?? 1000, canvasHeight)}/></label></div>}
    <label className="check"><input type="checkbox" checked={config.autoFitCanvas ?? true} onChange={(event) => patch({ autoFitCanvas: event.target.checked })}/>Вписывать холст в рабочую область</label>
    <small>{config.autoFitCanvas ?? true ? 'Масштаб предпросмотра подстраивается под доступное место. Экспортный размер не меняется.' : 'Холст показывается в масштабе 100%; при необходимости используйте прокрутку.'}</small>
    <div className="canvas-margin-control"><div><strong>Внешние поля, px</strong><button type="button" onClick={() => patch({ canvasMarginTop: 24, canvasMarginRight: 24, canvasMarginBottom: 24, canvasMarginLeft: 32 })}>Сбросить</button></div><div className="canvas-margin-grid"><label>Сверху<NumberInput min="0" max="160" value={config.canvasMarginTop ?? 24} onValueChange={(canvasMarginTop) => patch({ canvasMarginTop })}/></label><label>Справа<NumberInput min="0" max="160" value={config.canvasMarginRight ?? 24} onValueChange={(canvasMarginRight) => patch({ canvasMarginRight })}/></label><label>Снизу<NumberInput min="0" max="160" value={config.canvasMarginBottom ?? 24} onValueChange={(canvasMarginBottom) => patch({ canvasMarginBottom })}/></label><label>Слева<NumberInput min="0" max="160" value={config.canvasMarginLeft ?? 32} onValueChange={(canvasMarginLeft) => patch({ canvasMarginLeft })}/></label></div><small>Поля задают безопасное расстояние от текста и графика до краёв холста.</small></div>
    <label>Фон холста<div className="canvas-background-control"><ColorControl value={config.canvasBackground ?? '#ffffff'} onChange={(canvasBackground) => patch({ canvasBackground })}/><button type="button" onClick={() => patch({ canvasBackground: '#ffffff' })}>Сбросить</button></div></label>
  </div></details>
}
