import { useEffect, type ReactNode } from 'react'
import type { ChartConfig, ChartPlugin, ChartSettingsCapabilities, ChartTextStyle } from '../core/types'
import { NumberInput } from './NumberInput'
import { TextStyleEditor } from './TextStyleEditor'
import { ColorControl } from './PickerControls'
import './LegendSettings.css'
import { textFonts } from '../core/textFonts'
import { clearInlineFontFamily } from '../core/annotationHtml'

interface Props {
  config: ChartConfig
  plugin: ChartPlugin
  seriesNames: string[]
  onChange(config: ChartConfig): void
}

type Section = ChartSettingsCapabilities['sections'][number]
const textStyleKeys = ['titleText', 'subtitleText', 'axisTitleText', 'axisLabelText', 'legendText', 'valueText', 'noteText', 'sourceText'] as const
type TextStyleKey = typeof textStyleKeys[number] | 'xAxisTitleText' | 'yAxisTitleText' | 'xAxisLabelText' | 'yAxisLabelText'
const palettes = [
  { id: 'okabe-ito', label: 'Okabe-Ito', colors: ['#0072b2', '#e69f00', '#009e73', '#d55e00', '#cc79a7', '#56b4e9', '#f0e442'] },
  { id: 'tableau', label: 'Tableau', colors: ['#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#b07aa1', '#76b7b2', '#edc948'] },
  { id: 'categorical', label: 'Категории', colors: ['#1b9e77', '#d95f02', '#7570b3', '#e7298a', '#66a61e', '#e6ab02', '#a6761d'] },
  { id: 'sequential', label: 'Последовательная', colors: ['#eff3ff', '#c6dbef', '#9ecae1', '#6baed6', '#3182bd', '#08519c'] },
  { id: 'diverging', label: 'Отклонения', colors: ['#b2182b', '#ef8a62', '#fddbc7', '#d1e5f0', '#67a9cf', '#2166ac'] },
  { id: 'mono', label: 'Монохромная', colors: ['#202027', '#4c4b53', '#74727c', '#9d9ba3', '#c2c0c6', '#dedde1'] },
] as const
const fontWeight = (name: string) => /thin/i.test(name) ? 100 : /extra.?light/i.test(name) ? 200 : /light/i.test(name) ? 300 : /medium/i.test(name) ? 500 : /semi.?bold/i.test(name) ? 600 : /extra.?bold/i.test(name) ? 800 : /black|heavy/i.test(name) ? 900 : /bold/i.test(name) ? 700 : 400
const fontFamilyName = (fileName: string) => fileName.replace(/\.(woff2?|ttf|otf)$/i, '').replace(/(thin|extra.?light|light|regular|normal|medium|semi.?bold|extra.?bold|bold|black|heavy|italic|oblique)/ig, '').replace(/[-_]+/g, ' ').replace(/["'\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80)
const mixColor = (first: string, second: string, amount: number) => {
  const channels = (color: string) => [1, 3, 5].map((index) => Number.parseInt(color.slice(index, index + 2), 16))
  const left = channels(first), right = channels(second)
  return `#${left.map((value, index) => Math.round(value + (right[index] - value) * amount).toString(16).padStart(2, '0')).join('')}`
}
const monochromePalette = (base: string) => [mixColor(base, '#000000', .42), mixColor(base, '#000000', .2), base, mixColor(base, '#ffffff', .25), mixColor(base, '#ffffff', .5), mixColor(base, '#ffffff', .7)]
const defaultText = (size: number, weight = 400, color = '#2b2b2b'): ChartTextStyle => ({ fontFamily: 'DM Sans, sans-serif', size, color, weight, italic: false, lineHeight: 120, align: 'left' })
const Hint = ({ text }: { text: string }) => <span className="setting-hint" title={text} aria-label={text}>?</span>
const LabelText = ({ children, hint }: { children: ReactNode; hint: string }) => <span className="setting-label-text">{children}<Hint text={hint}/></span>

export function ChartSettingsPanel({ config, plugin, seriesNames, onChange }: Props) {
  const patch = (values: Partial<ChartConfig>) => onChange({ ...config, ...values })
  const richHtmlKey: Partial<Record<TextStyleKey, 'titleHtml' | 'subtitleHtml' | 'noteHtml' | 'sourceHtml'>> = { titleText: 'titleHtml', subtitleText: 'subtitleHtml', noteText: 'noteHtml', sourceText: 'sourceHtml' }
  const updateText = (key: TextStyleKey, value: ChartTextStyle) => {
    const htmlKey = richHtmlKey[key]
    patch({ [key]: value, ...(htmlKey && config[key]?.fontFamily !== value.fontFamily ? { [htmlKey]: clearInlineFontFamily(config[htmlKey]) } : {}) })
  }
  const updateAllText = (values: Partial<ChartTextStyle>) => {
    const resetsInlineFonts = values.fontFamily != null
    patch({
      ...Object.fromEntries(textStyleKeys.map((key) => [key, { ...config[key], ...values }])),
      xAxisTitleText: { ...(config.xAxisTitleText ?? config.axisTitleText), ...values }, yAxisTitleText: { ...(config.yAxisTitleText ?? config.axisTitleText), ...values },
      xAxisLabelText: { ...(config.xAxisLabelText ?? config.axisLabelText), ...values }, yAxisLabelText: { ...(config.yAxisLabelText ?? config.axisLabelText), ...values },
      directLabelText: { ...(config.directLabelText ?? config.legendText), ...values },
      ...(resetsInlineFonts ? { titleHtml: clearInlineFontFamily(config.titleHtml), subtitleHtml: clearInlineFontFamily(config.subtitleHtml), noteHtml: clearInlineFontFamily(config.noteHtml), sourceHtml: clearInlineFontFamily(config.sourceHtml) } : {}),
    } as Partial<ChartConfig>)
  }
  const legendMode = config.showDirectLabels ? 'direct' : config.showLegend ? 'standard' : 'none'
  const pickerSwatches = config.palette?.length ? config.palette : [config.color]
  const horizontalBar = plugin.category === 'bar-horizontal' || (plugin.settings.features.barLayout && config.barOrientation === 'horizontal')
  const setLegendMode = (mode: 'none' | 'standard' | 'direct') => patch({ showLegend: mode === 'standard', showDirectLabels: mode === 'direct' })
  const updateSeriesLegend = (name: string, values: Partial<ChartConfig['seriesStyles'][string]>) => patch({ seriesStyles: { ...config.seriesStyles, [name]: { ...config.seriesStyles[name], ...values } } })
  useEffect(() => { config.customFonts?.forEach(({ name, dataUrl, weight = 400, style = 'normal' }) => { if (!document.fonts.check(`${style} ${weight} 12px "${name}"`)) new FontFace(name, `url(${dataUrl})`, { weight: String(weight), style }).load().then((font) => document.fonts.add(font)).catch(() => undefined) }) }, [config.customFonts])
  useEffect(() => { if (!plugin.settings.features.directLabels && config.showDirectLabels) onChange({ ...config, showDirectLabels: false }) }, [config, onChange, plugin.settings.features.directLabels])
  const addFonts = async (files: FileList | null) => {
    const loaded = await Promise.all([...files ?? []].filter((file) => file.size <= 5 * 1024 * 1024).map((file) => new Promise<NonNullable<ChartConfig['customFonts']>[number] | null>((resolve) => {
      const reader = new FileReader()
      reader.onload = async () => {
        const dataUrl = String(reader.result), name = fontFamilyName(file.name) || 'Свой шрифт', weight = fontWeight(file.name), style = /italic|oblique/i.test(file.name) ? 'italic' as const : 'normal' as const
        try { document.fonts.add(await new FontFace(name, `url(${dataUrl})`, { weight: String(weight), style }).load()); resolve({ name, dataUrl, fileName: file.name, weight, style }) } catch { resolve(null) }
      }
      reader.onerror = () => resolve(null); reader.readAsDataURL(file)
    })))
    const faces = loaded.filter((face): face is NonNullable<typeof face> => Boolean(face))
    if (faces.length) patch({ customFonts: [...(config.customFonts ?? []).filter((old) => !faces.some((face) => face.fileName === old.fileName)), ...faces] })
  }
  const updateFontFace = (index: number, values: Partial<NonNullable<ChartConfig['customFonts']>[number]>) => patch({ customFonts: config.customFonts?.map((face, current) => current === index ? { ...face, ...values } : face) })
  const applyPalette = (name: string, colors: string[]) => patch({ paletteName: name, palette: colors, color: colors[0], seriesStyles: Object.fromEntries(Object.entries(config.seriesStyles).map(([series, style]) => { const { color: _color, ...rest } = style; return [series, rest] })) })
  const applyMonochrome = (base = config.paletteBaseColor ?? '#596273') => {
    const colors = monochromePalette(base)
    patch({ paletteName: 'mono', paletteBaseColor: base, palette: colors, color: colors[0], seriesStyles: Object.fromEntries(Object.entries(config.seriesStyles).map(([series, style]) => { const { color: _color, ...rest } = style; return [series, rest] })) })
  }
  const resetSection = (section: 'grid' | 'headings' | 'axes' | 'legend-values' | 'credits' | 'bars') => {
    if (section === 'grid') patch({ showHorizontalGrid: true, showVerticalGrid: false, gridColor: '#d9d7df', gridWidth: 1, gridType: 'solid' })
    if (section === 'headings') patch({ showTitle: true, showSubtitle: true, titleText: defaultText(42, 700), subtitleText: defaultText(25, 400, '#666666'), titleHtml: undefined, subtitleHtml: undefined })
    if (section === 'axes') patch({ xAxisPosition: 'bottom', yAxisPosition: 'left', showXAxisLine: true, showYAxisLine: false, showXTicks: true, showYTicks: false, tickLength: 6, axisLineColor: '#55515e', axisLineWidth: 1, axisLineType: 'solid', xAxisTitleGap: 14, yAxisTitleGap: 14, yAxisScaleType: 'linear', showZeroLine: false, zeroLineColor: '#8a8791', zeroLineWidth: 1, zeroLineType: 'solid', xAxisTitleText: defaultText(20, 600), yAxisTitleText: defaultText(20, 600), xAxisLabelText: defaultText(18, 400, '#555555'), yAxisLabelText: defaultText(18, 400, '#555555') })
    if (section === 'legend-values') patch({ showLegend: false, showDirectLabels: false, legendPosition: 'top', showValues: false, legendText: defaultText(19), directLabelText: defaultText(19, 600), directLabelGap: 16, showDirectLabelLines: false, directLabelLineWidth: 1, directLabelLineType: 'solid', valueText: defaultText(17, 600), valueLabelPosition: 'auto', valueLabelAutoContrast: true, valueLabelHideOverlap: true, seriesStyles: Object.fromEntries(Object.entries(config.seriesStyles).map(([name, style]) => { const { legendLabel: _label, legendNote: _note, showLegendLine: _line, ...rest } = style; return [name, rest] })) })
    if (section === 'credits') patch({ showNote: true, showSource: true, noteText: defaultText(18, 400, '#666666'), sourceText: defaultText(18, 400, '#666666'), noteHtml: undefined, sourceHtml: undefined })
    if (section === 'bars') patch({ barFillColor: undefined, barFillOpacity: 1, barWidth: 68, barBorderColor: config.color, barBorderWidth: 0, barBorderRadius: 0, barSeriesGap: 30 })
  }

  const sections: Record<Exclude<Section, 'series' | 'annotations'>, React.ReactNode> = {
    grid: <details className="settings-group grid-settings" key="grid"><summary>Сетка</summary><div>
      <label className="check"><input type="checkbox" checked={config.showHorizontalGrid} onChange={(event) => patch({ showHorizontalGrid: event.target.checked })}/>Горизонтальные линии</label>
      <label className="check"><input type="checkbox" checked={config.showVerticalGrid} onChange={(event) => patch({ showVerticalGrid: event.target.checked })}/>Вертикальные линии</label>
      <label>Тип линии<select value={config.gridType} onChange={(event) => patch({ gridType: event.target.value as ChartConfig['gridType'] })}><option value="solid">Сплошная</option><option value="dashed">Пунктирная</option><option value="dotted">Точечная</option></select></label>
      <label>Толщина, px<NumberInput min="0.5" max="8" step="0.5" value={config.gridWidth} onValueChange={(gridWidth) => patch({ gridWidth })}/></label>
      <label>Цвет<ColorControl value={config.gridColor} swatches={pickerSwatches} onChange={(gridColor) => patch({ gridColor })}/></label>
      <button type="button" className="reset-element" onClick={() => resetSection('grid')}>Сбросить раздел</button>
    </div></details>,
    text: <details className="settings-group general-text-settings" key="text"><summary>Общий стиль текста</summary><div>
      <label>Шрифт всех надписей<select value={config.titleText.fontFamily} onChange={(event) => updateAllText({ fontFamily: event.target.value })}>{textFonts.map(([value, label]) => <option value={value} key={value}>{label}</option>)}{[...new Set(config.customFonts?.map((font) => font.name) ?? [])].map((name) => <option value={`"${name}", sans-serif`} key={name}>{name} · свой</option>)}</select></label>
      <label className="custom-font-upload">Добавить семейство шрифтов<input multiple type="file" accept=".woff,.woff2,.ttf,.otf" onChange={(event) => { void addFonts(event.target.files); event.currentTarget.value = '' }}/><span>＋ Выбрать Regular, Bold, Italic…</span></label>
      <small className="font-upload-hint">Можно выбрать несколько файлов одного семейства. Начертания определяются по именам файлов.</small>
      {!!config.customFonts?.length && <div className="custom-font-list">{config.customFonts.map((font, index) => <div className="custom-font-face" key={`${font.fileName ?? font.name}-${index}`}><div><input aria-label="Название семейства" value={font.name} style={{ fontFamily: `"${font.name}"`, fontWeight: font.weight ?? 400, fontStyle: font.style ?? 'normal' }} onChange={(event) => updateFontFace(index, { name: event.target.value.replace(/["'\\]/g, '').slice(0, 80) })}/><small>{font.fileName ?? 'Загруженный файл'}</small></div><select aria-label="Начертание" value={font.weight ?? 400} onChange={(event) => updateFontFace(index, { weight: Number(event.target.value) })}><option value="300">Light</option><option value="400">Regular</option><option value="500">Medium</option><option value="600">SemiBold</option><option value="700">Bold</option><option value="800">ExtraBold</option><option value="900">Black</option></select><button type="button" className={font.style === 'italic' ? 'active' : ''} title="Курсив" onClick={() => updateFontFace(index, { style: font.style === 'italic' ? 'normal' : 'italic' })}><i>К</i></button><button type="button" title="Удалить файл" onClick={() => patch({ customFonts: config.customFonts?.filter((_, current) => current !== index) })}>×</button></div>)}</div>}
      <label>Цвет всех надписей<ColorControl value={config.titleText.color} swatches={pickerSwatches} onChange={(color) => updateAllText({ color })}/></label>
    </div></details>,
    headings: <details className="settings-group heading-settings" key="headings"><summary>Заголовок и подзаголовок</summary><div>
      <label className="check"><input type="checkbox" checked={config.showTitle ?? true} onChange={(event) => patch({ showTitle: event.target.checked })}/>Показывать заголовок</label>
      {(config.showTitle ?? true) && <><label>Заголовок<textarea value={config.title} onChange={(event) => patch({ title: event.target.value, titleHtml: undefined })}/></label><TextStyleEditor label="Стиль заголовка" value={config.titleText} customFonts={config.customFonts} onChange={(value) => updateText('titleText', value)} align/></>}
      <label className="check"><input type="checkbox" checked={config.showSubtitle ?? true} onChange={(event) => patch({ showSubtitle: event.target.checked })}/>Показывать подзаголовок</label>
      {(config.showSubtitle ?? true) && <><label>Подзаголовок<textarea value={config.subtitle} onChange={(event) => patch({ subtitle: event.target.value, subtitleHtml: undefined })}/></label><TextStyleEditor label="Стиль подзаголовка" value={config.subtitleText} customFonts={config.customFonts} onChange={(value) => updateText('subtitleText', value)} align/></>}
      <button type="button" className="reset-element" onClick={() => resetSection('headings')}>Сбросить оформление раздела</button>
    </div></details>,
    axes: <details className="settings-group axes-settings" key="axes"><summary>Оси</summary><div>
      <label>Положение {horizontalBar ? 'горизонтальной оси значений' : 'оси X'}<select value={config.xAxisPosition} onChange={(event) => patch({ xAxisPosition: event.target.value as ChartConfig['xAxisPosition'] })}><option value="bottom">Снизу</option><option value="top">Сверху</option></select></label>
      <label>Положение {horizontalBar ? 'вертикальной оси категорий' : 'оси Y'}<select value={config.yAxisPosition} onChange={(event) => patch({ yAxisPosition: event.target.value as ChartConfig['yAxisPosition'] })}><option value="left">Слева</option><option value="right">Справа</option></select></label>
      {horizontalBar && <label className="check"><input type="checkbox" checked={config.categoryAxisInverse ?? true} onChange={(event) => patch({ categoryAxisInverse: event.target.checked })}/><LabelText hint="Для линейчатых диаграмм первая категория обычно находится сверху, как в таблице.">Категории и даты сверху вниз</LabelText></label>}
      <label className="check"><input type="checkbox" checked={config.showXAxisTitle} onChange={(event) => patch({ showXAxisTitle: event.target.checked })}/>Заголовок {horizontalBar ? 'вертикальной оси категорий' : 'оси X'}</label>
      {config.showXAxisTitle && <><label>Текст {horizontalBar ? 'вертикальной оси категорий' : 'оси X'}<input className="text-input" value={config.xAxisTitle} onChange={(event) => patch({ xAxisTitle: event.target.value })}/></label><label>Расстояние до {horizontalBar ? 'вертикальной оси' : 'оси X'}, px<NumberInput min="0" max="100" value={config.xAxisTitleGap} onValueChange={(xAxisTitleGap) => patch({ xAxisTitleGap })}/></label></>}
      <label className="check"><input type="checkbox" checked={config.showYAxisTitle} onChange={(event) => patch({ showYAxisTitle: event.target.checked })}/>Заголовок {horizontalBar ? 'горизонтальной оси значений' : 'оси Y'}</label>
      {config.showYAxisTitle && <><label>Текст {horizontalBar ? 'горизонтальной оси значений' : 'оси Y'}<input className="text-input" value={config.yAxisTitle} onChange={(event) => patch({ yAxisTitle: event.target.value })}/></label><label>Расстояние до {horizontalBar ? 'горизонтальной оси' : 'оси Y'}, px<NumberInput min="0" max="120" value={config.yAxisTitleGap} onValueChange={(yAxisTitleGap) => patch({ yAxisTitleGap })}/></label></>}
      <strong className="axis-settings-heading">{horizontalBar ? 'Вертикальная ось категорий' : 'Ось X'}</strong>
      <TextStyleEditor label={horizontalBar ? 'Заголовок вертикальной оси категорий' : 'Заголовок оси X'} value={config.xAxisTitleText ?? config.axisTitleText} customFonts={config.customFonts} onChange={(value) => updateText('xAxisTitleText', value)}/>
      <TextStyleEditor label={horizontalBar ? 'Подписи категорий' : 'Подписи шкалы X'} value={config.xAxisLabelText ?? config.axisLabelText} customFonts={config.customFonts} onChange={(value) => updateText('xAxisLabelText', value)}/>
      <strong className="axis-settings-heading">{horizontalBar ? 'Горизонтальная ось значений' : 'Ось Y'}</strong>
      <TextStyleEditor label={horizontalBar ? 'Заголовок горизонтальной оси значений' : 'Заголовок оси Y'} value={config.yAxisTitleText ?? config.axisTitleText} customFonts={config.customFonts} onChange={(value) => updateText('yAxisTitleText', value)}/>
      <TextStyleEditor label={horizontalBar ? 'Подписи значений на оси' : 'Подписи шкалы Y'} value={config.yAxisLabelText ?? config.axisLabelText} customFonts={config.customFonts} onChange={(value) => updateText('yAxisLabelText', value)}/>
      <div className="settings-divider"/>
      <label className="check"><input type="checkbox" checked={config.showXAxisLine} onChange={(event) => patch({ showXAxisLine: event.target.checked })}/>Линия оси X</label>
      <label className="check"><input type="checkbox" checked={config.showYAxisLine} onChange={(event) => patch({ showYAxisLine: event.target.checked })}/>Линия оси Y</label>
      <label className="check"><input type="checkbox" checked={config.showXTicks} onChange={(event) => patch({ showXTicks: event.target.checked })}/>Засечки на оси X</label>
      <label className="check"><input type="checkbox" checked={config.showYTicks} onChange={(event) => patch({ showYTicks: event.target.checked })}/>Засечки на оси Y</label>
      {(config.showXTicks || config.showYTicks) && <label>Длина засечек, px<NumberInput min="1" max="20" value={config.tickLength} onValueChange={(tickLength) => patch({ tickLength })}/></label>}
      <label>Тип линий осей<select value={config.axisLineType} onChange={(event) => patch({ axisLineType: event.target.value as ChartConfig['axisLineType'] })}><option value="solid">Сплошная</option><option value="dashed">Пунктирная</option><option value="dotted">Точечная</option></select></label>
      <label>Толщина осей, px<NumberInput min="0.5" max="8" step="0.5" value={config.axisLineWidth} onValueChange={(axisLineWidth) => patch({ axisLineWidth })}/></label>
      <label>Цвет осей<ColorControl value={config.axisLineColor} swatches={pickerSwatches} onChange={(axisLineColor) => patch({ axisLineColor })}/></label>
      <button type="button" className="reset-element" onClick={() => resetSection('axes')}>Сбросить раздел</button>
    </div></details>,
    'legend-values': <details className="settings-group legend-value-settings" key="legend-values"><summary>Легенда и значения</summary><div>
      <fieldset className="legend-mode"><legend>Способ обозначения рядов <Hint text="Direct labels подписывают линии или ряды прямо на графике и часто заменяют отдельную легенду."/></legend>{([['none', 'Без легенды'], ['standard', 'Обычная'], ...(!plugin.settings.features.directLabels ? [] : [['direct', horizontalBar ? 'Над рядами' : 'Справа у рядов'] as const])] as const).map(([value, label]) => <button type="button" key={value} className={legendMode === value ? 'active' : ''} onClick={() => setLegendMode(value)}>{label}</button>)}</fieldset>
      {legendMode === 'standard' && <div className="legend-options"><label>Расположение<select value={config.legendPosition ?? 'top'} onChange={(event) => patch({ legendPosition: event.target.value as ChartConfig['legendPosition'] })}><option value="top">Сверху</option><option value="bottom">Снизу</option><option value="left">Слева</option><option value="right">Справа</option></select></label><TextStyleEditor label="Текст легенды" value={config.legendText} customFonts={config.customFonts} onChange={(value) => updateText('legendText', value)}/></div>}
      {legendMode === 'direct' && <div className="legend-options direct-legend-options">
        <TextStyleEditor label={horizontalBar ? 'Стиль подписей над рядами' : 'Стиль правых подписей'} value={config.directLabelText ?? config.legendText} customFonts={config.customFonts} onChange={(directLabelText) => patch({ directLabelText })}/>
        <label><LabelText hint={horizontalBar ? 'Увеличьте, если подписи над рядами близко к подзаголовку или столбцам.' : 'Увеличьте, если правые подписи слишком близко к последним точкам.'}>{horizontalBar ? 'Отступ от ряда' : 'Отступ от графика'}, px</LabelText><NumberInput min="4" max="80" value={config.directLabelGap ?? 14} onValueChange={(directLabelGap) => patch({ directLabelGap })}/></label>
        <label className="check"><input type="checkbox" checked={config.showDirectLabelLines ?? false} onChange={(event) => patch({ showDirectLabelLines: event.target.checked })}/><LabelText hint="Выноски помогают связать подпись с рядом, если автоматическое расположение сдвинуло текст.">Всегда показывать выноски</LabelText></label>
        {(config.showDirectLabelLines ?? false) && <div className="legend-line-grid"><label>Толщина, px<NumberInput min="0.5" max="5" step="0.5" value={config.directLabelLineWidth ?? 1} onValueChange={(directLabelLineWidth) => patch({ directLabelLineWidth })}/></label><label>Тип<select value={config.directLabelLineType ?? 'solid'} onChange={(event) => patch({ directLabelLineType: event.target.value as ChartConfig['directLabelLineType'] })}><option value="solid">Сплошная</option><option value="dashed">Пунктирная</option><option value="dotted">Точечная</option></select></label></div>}
        <div className="series-label-list"><span>Тексты по рядам</span>{seriesNames.map((name) => { const style = config.seriesStyles[name]; const lineMode = style?.showLegendLine == null ? 'auto' : style.showLegendLine ? 'on' : 'off'; return <div className="series-label-card" key={name}><strong>{name}</strong><label>Подпись<input className="text-input" value={style?.legendLabel ?? ''} placeholder={name} onChange={(event) => updateSeriesLegend(name, { legendLabel: event.target.value })}/></label><label>Примечание<textarea rows={2} value={style?.legendNote ?? ''} placeholder="Необязательное примечание · Enter для переноса" onChange={(event) => updateSeriesLegend(name, { legendNote: event.target.value })}/></label><label>Выноска<select value={lineMode} onChange={(event) => updateSeriesLegend(name, { showLegendLine: event.target.value === 'auto' ? undefined : event.target.value === 'on' })}><option value="auto">Общая настройка</option><option value="on">Всегда</option><option value="off">Выключена</option></select></label></div> })}</div>
      </div>}
      <label className="check"><input type="checkbox" checked={config.showValues} onChange={(event) => patch({ showValues: event.target.checked })}/>Подписи значений</label>
      <TextStyleEditor label="Подписи значений" value={config.valueText} customFonts={config.customFonts} onChange={(value) => updateText('valueText', value)}/>
      <label>Положение подписей<select value={config.valueLabelPosition ?? 'auto'} onChange={(event) => patch({ valueLabelPosition: event.target.value as ChartConfig['valueLabelPosition'] })}><option value="auto">Автоматически</option><option value="top">{horizontalBar ? 'Снаружи справа' : 'Снаружи сверху'}</option><option value="inside-top">{horizontalBar ? 'Внутри справа' : 'Внутри сверху'}</option><option value="inside-center">Внутри по центру</option><option value="inside-bottom">{horizontalBar ? 'Внутри слева' : 'Внутри снизу'}</option><option value="bottom">{horizontalBar ? 'Снаружи слева' : 'Снаружи снизу'}</option></select></label>
      <label className="check"><input type="checkbox" checked={config.valueLabelAutoContrast ?? true} onChange={(event) => patch({ valueLabelAutoContrast: event.target.checked })}/><LabelText hint="Если подпись находится внутри цветного столбца, цвет текста автоматически меняется на читаемый.">Автоконтраст внутри столбцов</LabelText></label>
      <label className="check"><input type="checkbox" checked={config.valueLabelHideOverlap ?? true} onChange={(event) => patch({ valueLabelHideOverlap: event.target.checked })}/><LabelText hint="Включите для чистого графика, выключите если важнее показать все значения.">Скрывать пересекающиеся подписи</LabelText></label>
      <button type="button" className="reset-element" onClick={() => resetSection('legend-values')}>Сбросить легенду и подписи</button>
    </div></details>,
    credits: <details className="settings-group credits-settings" key="credits"><summary>Комментарий и источник</summary><div>
      <label className="check"><input type="checkbox" checked={config.showNote ?? true} onChange={(event) => patch({ showNote: event.target.checked })}/>Показывать комментарий</label>
      {(config.showNote ?? true) && <label>Комментарий<textarea value={config.note} onChange={(event) => patch({ note: event.target.value, noteHtml: undefined })}/></label>}
      <label className="check"><input type="checkbox" checked={config.showSource ?? true} onChange={(event) => patch({ showSource: event.target.checked })}/>Показывать источник</label>
      {(config.showSource ?? true) && <label>Источник<input className="text-input" value={config.source} onChange={(event) => patch({ source: event.target.value, sourceHtml: undefined })} placeholder="Источник: Росстат"/></label>}
      {(config.showNote ?? true) && <TextStyleEditor label="Стиль комментария" value={config.noteText} customFonts={config.customFonts} onChange={(noteText) => updateText('noteText', noteText)} align/>}
      {(config.showSource ?? true) && <TextStyleEditor label="Стиль источника" value={config.sourceText} customFonts={config.customFonts} onChange={(sourceText) => updateText('sourceText', sourceText)} align/>}
      <button type="button" className="reset-element" onClick={() => resetSection('credits')}>Сбросить оформление раздела</button>
    </div></details>,
  }

  return <>{plugin.settings.sections.includes('series') && <details className="settings-group palette-settings"><summary>Палитра</summary><div><div className="palette-presets">{palettes.map((palette) => <button type="button" className={config.paletteName === palette.id ? 'active' : ''} key={palette.id} onClick={() => palette.id === 'mono' ? applyMonochrome() : applyPalette(palette.id, [...palette.colors])}><span>{(palette.id === 'mono' && config.paletteName === 'mono' ? config.palette ?? palette.colors : palette.colors).map((color) => <i style={{ background: color }} key={color}/>)}</span><b>{palette.label}</b></button>)}</div>{config.paletteName === 'mono' && <label>Базовый цвет<div className="palette-base-color"><ColorControl value={config.paletteBaseColor ?? '#55515e'} swatches={pickerSwatches} onChange={applyMonochrome}/><span>{monochromePalette(config.paletteBaseColor ?? '#55515e').map((color) => <i style={{ background: color }} key={color}/>)}</span></div></label>}<label>Своя палитра<div className="custom-palette">{(config.palette?.length ? config.palette : [config.color]).map((color, index, colors) => <span key={`${index}-${color}`}><ColorControl compact value={color} swatches={colors} onChange={(nextColor) => { const next = [...colors]; next[index] = nextColor; applyPalette('custom', next) }}/>{colors.length > 1 && <button type="button" onClick={() => applyPalette('custom', colors.filter((_, current) => current !== index))}>×</button>}</span>)}{(config.palette?.length ?? 1) < 10 && <button type="button" onClick={() => applyPalette('custom', [...(config.palette?.length ? config.palette : [config.color]), '#777580'])}>＋</button>}</div></label></div></details>}{plugin.settings.features.barLayout && <details className="settings-group bar-settings"><summary>Компоновка столбцов</summary><div><label><LabelText hint="Общая ширина всех столбцов внутри одной категории. Меньше — больше воздуха, больше — плотнее сравнение.">Ширина группы, %</LabelText><NumberInput min="10" max="95" step="1" value={config.barWidth ?? 68} onValueChange={(barWidth) => patch({ barWidth })}/></label><label><LabelText hint="Отрицательные значения сближают ряды, положительные добавляют расстояние между ними.">Расстояние между рядами, %</LabelText><NumberInput min="-90" max="100" value={config.barSeriesGap ?? 30} onValueChange={(barSeriesGap) => patch({ barSeriesGap })}/></label><label>Скругление углов, px<NumberInput min="0" max="80" value={config.barBorderRadius ?? 0} onValueChange={(barBorderRadius) => patch({ barBorderRadius })}/></label><small className="bar-selection-hint">Заливка, рамка и индивидуальная ширина настраиваются после выбора ряда или отдельного столбца на холсте.</small><button type="button" className="reset-element" onClick={() => resetSection('bars')}>Сбросить компоновку</button></div></details>}{plugin.settings.features.areaLayout && <details className="settings-group area-settings"><summary>Заливка области</summary><div><label>Прозрачность заливки<NumberInput min="0.05" max="1" step="0.05" value={config.areaFillOpacity ?? .32} onValueChange={(areaFillOpacity) => patch({ areaFillOpacity })}/></label><label>Пропуски в области<select value={config.missingMode} onChange={(event) => patch({ missingMode: event.target.value as ChartConfig['missingMode'] })}><option value="gap">Оставлять разрывы</option><option value="zero">Заменять нулём</option><option value="connect">Соединять соседние значения</option></select></label><small>Цвет области наследуется от цвета соответствующего ряда.</small></div></details>}{plugin.settings.sections.filter((section): section is Exclude<Section, 'series' | 'annotations'> => section !== 'series' && section !== 'annotations').map((section) => sections[section])}</>
}
