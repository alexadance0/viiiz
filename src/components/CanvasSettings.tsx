import type { ChartConfig, ChartTextStyle } from '../core/types'
import { usesHorizontalAxes } from '../core/chartKinds'
import { NumberInput } from './NumberInput'
import { ColorControl } from './PickerControls'
import { SettingsCheckbox } from './SettingsCheckbox'
import './CanvasSettings.css'

interface Props { config: ChartConfig; onChange(config: ChartConfig): void }
const formats = [
  { id: 'presentation-standard', label: '4:3', hint: 'Классический слайд', width: 1000, height: 750 },
  { id: 'presentation-wide', label: '16:9', hint: 'Широкий слайд', width: 1000, height: 563 },
  { id: 'square', label: 'Квадрат', hint: 'Пост', width: 1000, height: 1000 },
  { id: 'portrait', label: '4:5', hint: 'Вертикальный пост', width: 800, height: 1000 },
] as const
const typeScales = {
  compact: { label: 'Компактная', sizes: [32, 19, 15, 14, 14, 13, 13, 11] },
  social: { label: 'Для постов', sizes: [48, 28, 20, 18, 19, 17, 17, 15] },
  presentation: { label: 'Для слайдов', sizes: [42, 25, 20, 18, 19, 17, 17, 15] },
} as const
const textKeys = ['titleText', 'subtitleText', 'axisTitleText', 'axisLabelText', 'legendText', 'valueText', 'noteText', 'sourceText'] as const
const spacingDefaults = { canvasMarginTop: 24, canvasMarginRight: 24, canvasMarginBottom: 24, canvasMarginLeft: 32, titleSubtitleGap: 12, headerPlotGap: 28, headerLegendGap: 20, legendPlotGap: 24, plotFooterGap: 24, noteSourceGap: 10, xAxisTitleGap: 14, yAxisTitleGap: 14, xAxisLabelGap: 8, yAxisLabelGap: 8 } satisfies Partial<ChartConfig>
type SpacingKey = keyof typeof spacingDefaults
type FlowItem = { type: 'block'; id: string; label: string; tone?: 'plot' | 'axis' | 'meta' } | { type: 'gap'; key: SpacingKey; label: string; value: number }

function SpacingControl({ label, value, shortLabel, compact = false, min = 0, max = 200, onChange }: { label: string; value: number; shortLabel?: string; compact?: boolean; min?: number; max?: number; onChange(value: number): void }) {
  return <label className={`spacing-control ${compact ? 'compact' : 'gap'}`} title={label}>
    {shortLabel && <span>{shortLabel}</span>}
    <NumberInput aria-label={label} min={min} max={max} value={value} onValueChange={onChange}/>
    {!compact && <small>px</small>}
  </label>
}

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
    const fontFactor = format.id === 'portrait' ? .9 : format.id === 'presentation-wide' ? .9 : 1
    patch({ canvasPreset: format.id, canvasWidth: format.width, canvasHeight: format.height, xAxisTitleGap: 14, yAxisTitleGap: 14, tickLength: 6, directLabelGap: 16, ...scaledObjects(format.width, format.height), ...typographyPatch(typography, fontFactor) })
  }
  const applyCustomSize = (width: number, height: number) => {
    const portrait = height > width * 1.15
    const preset = portrait ? 'social' : 'presentation'
    const factor = Math.max(.65, Math.min(1, Math.min(width / 800, height / 560)))
    patch({ canvasPreset: 'custom', canvasWidth: width, canvasHeight: height, xAxisTitleGap: Math.max(8, Math.round(14 * factor)), yAxisTitleGap: Math.max(8, Math.round(14 * factor)), tickLength: Math.max(3, Math.round(6 * factor)), directLabelGap: Math.max(8, Math.round(16 * factor)), ...scaledObjects(width, height), ...typographyPatch(preset, factor) })
  }
  const showTitle = (config.showTitle ?? true) && Boolean(config.title)
  const showSubtitle = (config.showSubtitle ?? true) && Boolean(config.subtitle)
  const showNote = (config.showNote ?? true) && Boolean(config.note)
  const showSource = (config.showSource ?? true) && Boolean(config.source)
  const standardLegend = config.showLegend && !config.showDirectLabels
  const legendPosition = config.legendPosition ?? 'top'
  const horizontal = usesHorizontalAxes(config)
  const physicalXAxis = horizontal ? 'Y' : 'X'
  const physicalYAxis = horizontal ? 'X' : 'Y'
  const physicalXAxisLabelGap: SpacingKey = horizontal ? 'yAxisLabelGap' : 'xAxisLabelGap'
  const physicalXAxisTitleGap: SpacingKey = horizontal ? 'yAxisTitleGap' : 'xAxisTitleGap'
  const physicalYAxisLabelGap: SpacingKey = horizontal ? 'xAxisLabelGap' : 'yAxisLabelGap'
  const physicalYAxisTitleGap: SpacingKey = horizontal ? 'xAxisTitleGap' : 'yAxisTitleGap'
  const showPhysicalXAxisTitle = horizontal ? config.showYAxisTitle && Boolean(config.yAxisTitle) : config.showXAxisTitle && Boolean(config.xAxisTitle)
  const showPhysicalYAxisTitle = horizontal ? config.showXAxisTitle && Boolean(config.xAxisTitle) : config.showYAxisTitle && Boolean(config.yAxisTitle)
  const showPhysicalXAxisLabels = horizontal ? (config.showYAxisLabels ?? true) : (config.showXAxisLabels ?? true)
  const showPhysicalYAxisLabels = horizontal ? (config.showXAxisLabels ?? true) : (config.showYAxisLabels ?? true)
  const showPhysicalXAxis = showPhysicalXAxisTitle || showPhysicalXAxisLabels
  const showPhysicalYAxis = showPhysicalYAxisTitle || showPhysicalYAxisLabels
  const flow: FlowItem[] = []
  const addBlock = (id: string, label: string, tone?: Extract<FlowItem, { type: 'block' }>['tone'], gapKey?: SpacingKey) => {
    const previous = [...flow].reverse().find((item): item is Extract<FlowItem, { type: 'block' }> => item.type === 'block')
    if (previous && gapKey) flow.push({ type: 'gap', key: gapKey, label: `${previous.label} → ${label}`, value: config[gapKey] ?? spacingDefaults[gapKey] ?? 0 })
    flow.push({ type: 'block', id, label, tone })
  }
  if (showTitle) addBlock('title', 'Заголовок')
  if (showSubtitle) addBlock('subtitle', 'Подзаголовок', undefined, showTitle ? 'titleSubtitleGap' : undefined)
  if (standardLegend && legendPosition === 'top') addBlock('legend-top', 'Легенда', 'meta', showTitle || showSubtitle ? 'headerLegendGap' : undefined)
  const hasTopContent = flow.length > 0
  if (config.xAxisPosition === 'top') {
    if (showPhysicalXAxis) {
      addBlock('x-axis', `Ось ${physicalXAxis}`, 'axis', hasTopContent ? standardLegend && legendPosition === 'top' ? 'legendPlotGap' : 'headerPlotGap' : undefined)
      addBlock('plot', 'График', 'plot')
    } else addBlock('plot', 'График', 'plot', hasTopContent ? standardLegend && legendPosition === 'top' ? 'legendPlotGap' : 'headerPlotGap' : undefined)
  } else {
    addBlock('plot', 'График', 'plot', hasTopContent ? standardLegend && legendPosition === 'top' ? 'legendPlotGap' : 'headerPlotGap' : undefined)
    if (showPhysicalXAxis) addBlock('x-axis', `Ось ${physicalXAxis}`, 'axis')
  }
  if (standardLegend && legendPosition === 'bottom') addBlock('legend-bottom', 'Легенда', 'meta', 'legendPlotGap')
  const firstFooterGap = standardLegend && legendPosition === 'bottom' ? 'headerLegendGap' : 'plotFooterGap'
  if (showNote) addBlock('note', 'Комментарий', 'meta', firstFooterGap)
  if (showSource) addBlock('source', 'Источник', 'meta', showNote ? 'noteSourceGap' : firstFooterGap)
  const setSpacing = (key: SpacingKey) => (value: number) => patch({ [key]: value })
  const sideAxis = (side: 'left' | 'right') => <div className={`spacing-axis-rail ${side}`}>
    <strong>Ось {physicalYAxis}</strong>
    {showPhysicalYAxisTitle && <SpacingControl compact shortLabel="заг." label={side === 'left' ? `Заголовок оси ${physicalYAxis} → подписи` : `Подписи оси ${physicalYAxis} → заголовок`} value={config[physicalYAxisTitleGap] ?? spacingDefaults[physicalYAxisTitleGap]} max={120} onChange={setSpacing(physicalYAxisTitleGap)}/>}
    {showPhysicalYAxisLabels && <SpacingControl compact shortLabel="подп." label={side === 'left' ? `Подписи оси ${physicalYAxis} → график` : `График → подписи оси ${physicalYAxis}`} value={config[physicalYAxisLabelGap] ?? spacingDefaults[physicalYAxisLabelGap]} max={80} onChange={setSpacing(physicalYAxisLabelGap)}/>}
  </div>
  const horizontalAxis = <div className={`spacing-axis-rail horizontal ${Number(showPhysicalXAxisTitle) + Number(showPhysicalXAxisLabels) === 1 ? 'single' : ''}`}>
    <strong>Ось {physicalXAxis}</strong>
    {showPhysicalXAxisLabels && <SpacingControl compact shortLabel="подп." label={config.xAxisPosition === 'bottom' ? `График → Подписи оси ${physicalXAxis}` : `Подписи оси ${physicalXAxis} → график`} value={config[physicalXAxisLabelGap] ?? spacingDefaults[physicalXAxisLabelGap]} max={80} onChange={setSpacing(physicalXAxisLabelGap)}/>}
    {showPhysicalXAxisTitle && <SpacingControl compact shortLabel="заг." label={config.xAxisPosition === 'bottom' ? `Подписи оси ${physicalXAxis} → заголовок` : `Заголовок оси ${physicalXAxis} → подписи`} value={config[physicalXAxisTitleGap] ?? spacingDefaults[physicalXAxisTitleGap]} max={120} onChange={setSpacing(physicalXAxisTitleGap)}/>}
  </div>
  return <><details className="settings-group canvas-settings"><summary>Холст</summary><div>
    <div className="canvas-presets">{formats.map((format) => <button type="button" className={config.canvasPreset === format.id ? 'active' : ''} key={format.id} onClick={() => applyFormat(format)}><strong>{format.label}</strong><small>{format.hint}<br/>{format.width} × {format.height}</small></button>)}</div>
    <button type="button" className={`canvas-custom-toggle ${config.canvasPreset === 'custom' ? 'active' : ''}`} onClick={() => patch({ canvasPreset: 'custom' })}>Свой размер</button>
    {config.canvasPreset === 'custom' && <div className="canvas-size-grid"><label>Ширина, px<NumberInput min="320" max="1000" step="10" value={Math.min(1000, config.canvasWidth ?? 1000)} onValueChange={(canvasWidth) => applyCustomSize(canvasWidth, config.canvasHeight ?? 563)}/></label><span>×</span><label>Высота, px<NumberInput min="320" max="1000" step="10" value={Math.min(1000, config.canvasHeight ?? 563)} onValueChange={(canvasHeight) => applyCustomSize(config.canvasWidth ?? 1000, canvasHeight)}/></label></div>}
    <SettingsCheckbox isSelected={config.autoFitCanvas ?? true} onChange={(autoFitCanvas) => patch({ autoFitCanvas })}>Вписывать холст в рабочую область</SettingsCheckbox>
    <small>{config.autoFitCanvas ?? true ? 'Масштаб предпросмотра подстраивается под доступное место. Экспортный размер не меняется.' : 'Холст показывается в масштабе 100%; при необходимости используйте прокрутку.'}</small>
    <label>Фон холста<div className="canvas-background-control"><ColorControl value={config.canvasBackground ?? '#ffffff'} onChange={(canvasBackground) => patch({ canvasBackground })}/><button type="button" className="canvas-background-reset" onClick={() => patch({ canvasBackground: '#ffffff' })}>Сбросить</button></div></label>
  </div></details><details className="settings-group spacing-settings"><summary>Отступы и расстояния</summary><div>
    <div className="spacing-map" aria-label="Схема расстояний на холсте">
      <div className="spacing-margin-panel"><strong>Поля холста</strong><div>
        <SpacingControl compact shortLabel="сверху" label="Поле холста сверху" value={config.canvasMarginTop ?? 24} max={160} onChange={setSpacing('canvasMarginTop')}/>
        <SpacingControl compact shortLabel="справа" label="Поле холста справа" value={config.canvasMarginRight ?? 24} max={160} onChange={setSpacing('canvasMarginRight')}/>
        <SpacingControl compact shortLabel="снизу" label="Поле холста снизу" value={config.canvasMarginBottom ?? 24} max={160} onChange={setSpacing('canvasMarginBottom')}/>
        <SpacingControl compact shortLabel="слева" label="Поле холста слева" value={config.canvasMarginLeft ?? 32} max={160} onChange={setSpacing('canvasMarginLeft')}/>
      </div></div>
      <div className="spacing-flow">{flow.map((item, index) => item.type === 'block'
        ? item.tone === 'plot' ? <div className="spacing-plot-row" key={item.id}>
            {standardLegend && legendPosition === 'left' && <><div className="spacing-block side-legend">Легенда</div><SpacingControl compact label="Легенда → график" value={config.legendPlotGap ?? 24} onChange={setSpacing('legendPlotGap')}/></>}
            {showPhysicalYAxis && config.yAxisPosition === 'left' && sideAxis('left')}
            <div className="spacing-block plot"><span>График</span></div>
            {showPhysicalYAxis && config.yAxisPosition === 'right' && sideAxis('right')}
            {standardLegend && legendPosition === 'right' && <><SpacingControl compact label="График → легенда" value={config.legendPlotGap ?? 24} onChange={setSpacing('legendPlotGap')}/><div className="spacing-block side-legend">Легенда</div></>}
          </div>
        : item.id === 'x-axis' ? <div key={item.id}>{horizontalAxis}</div> : <div className={`spacing-block ${item.tone ?? ''}`} key={item.id}><span>{item.label}</span></div>
        : <SpacingControl key={`${item.key}-${index}`} label={item.label} value={item.value} max={item.key.endsWith('LabelGap') ? 80 : item.key.endsWith('TitleGap') ? 120 : 200} onChange={setSpacing(item.key)}/>)}</div>
    </div>
    <small className="spacing-map-hint">Все значения меняются прямо на схеме.</small>
    <button type="button" className="reset-element" onClick={() => patch(spacingDefaults)}>Сбросить расстояния</button>
  </div></details></>
}
