import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { Tabs } from '@heroui/react'
import type { ChartConfig, ChartElementSelection, ChartPlugin, ChartSettingsCapabilities, ChartTextStyle, TimeFrequency } from '../core/types'
import { NumberInput } from './NumberInput'
import { TextStyleEditor } from './TextStyleEditor'
import { ColorControl } from './PickerControls'
import { AxisScaleFields } from './AxisScaleSettings'
import { SettingsCheckbox } from './SettingsCheckbox'
import './LegendSettings.css'
import { textFonts } from '../core/textFonts'
import { clearInlineFontFamily } from '../core/annotationHtml'
import { ValueLabelFields } from './ValueLabelSelectionControls'
import { mixColor, threeColorPalette } from '../core/colorPalettes'
import { DEFAULT_COMPOSITION_SPACING } from '../entities/chart/model/defaults'
import { SEASONAL_OTHERS_LEGEND_ITEM_ID, SEASONAL_OTHERS_LEGEND_LABEL } from '../core/legend'

interface Props {
  config: ChartConfig
  plugin: ChartPlugin
  seriesNames: string[]
  valueLabels: ChartElementSelection[]
  xKind: 'date' | 'number' | 'other'
  frequency?: TimeFrequency
  onChange(config: ChartConfig): void
}

type Section = ChartSettingsCapabilities['sections'][number]
const textStyleKeys = ['titleText', 'subtitleText', 'axisTitleText', 'axisLabelText', 'legendText', 'valueText', 'noteText', 'sourceText'] as const
type TextStyleKey = typeof textStyleKeys[number] | 'xAxisTitleText' | 'yAxisTitleText' | 'xAxisLabelText' | 'yAxisLabelText'
const palettes = [
  { id: 'okabe-ito', label: 'Okabe-Ito', colors: ['#0072b2', '#e69f00', '#009e73', '#d55e00', '#cc79a7', '#56b4e9', '#f0e442'] },
  { id: 'tableau', label: 'Tableau', colors: ['#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#b07aa1', '#76b7b2', '#edc948'] },
  { id: 'categorical', label: 'Set2', colors: ['#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f', '#e5c494', '#b3b3b3'] },
  { id: 'sequential', label: 'Viridis', colors: ['#440154', '#414487', '#2a788e', '#22a884', '#7ad151', '#fde725'] },
  { id: 'diverging', label: 'Трёхцветный градиент', colors: ['#3b4cc0', '#7b83d0', '#b8bae1', '#f7f7f7', '#dfada9', '#c75e64', '#b40426'] },
  { id: 'mono', label: 'Монохромная', colors: ['#202027', '#4c4b53', '#74727c', '#9d9ba3', '#c2c0c6', '#dedde1'] },
] as const
const defaultGradientColors: [string, string, string] = ['#3b4cc0', '#f7f7f7', '#b40426']
const fontWeight = (name: string) => /thin/i.test(name) ? 100 : /extra.?light/i.test(name) ? 200 : /light/i.test(name) ? 300 : /medium/i.test(name) ? 500 : /semi.?bold/i.test(name) ? 600 : /extra.?bold/i.test(name) ? 800 : /black|heavy/i.test(name) ? 900 : /bold/i.test(name) ? 700 : 400
const fontFamilyName = (fileName: string) => fileName.replace(/\.(woff2?|ttf|otf)$/i, '').replace(/(thin|extra.?light|light|regular|normal|medium|semi.?bold|extra.?bold|bold|black|heavy|italic|oblique)/ig, '').replace(/[-_]+/g, ' ').replace(/["'\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80)
const monochromePalette = (base: string) => [mixColor(base, '#000000', .42), mixColor(base, '#000000', .2), base, mixColor(base, '#ffffff', .25), mixColor(base, '#ffffff', .5), mixColor(base, '#ffffff', .7)]
const defaultText = (size: number, weight = 400, color = '#2b2b2b'): ChartTextStyle => ({ fontFamily: 'Onest, sans-serif', size, color, weight, italic: false, lineHeight: 120, align: 'left' })
const Hint = ({ text }: { text: string }) => <span className="setting-hint" title={text} aria-label={text}>?</span>
const LabelText = ({ children, hint }: { children: ReactNode; hint: string }) => <span className="setting-label-text">{children}<Hint text={hint}/></span>

function SeriesLegendItemSettings({ name, config, onChange }: { name: string; config: ChartConfig; onChange(values: Partial<ChartConfig['seriesStyles'][string]>): void }) {
  const style = config.seriesStyles[name]
  const visible = style?.showLegendItem ?? true
  return <div className={`series-label-card${visible ? '' : ' disabled'}`}>
    <SettingsCheckbox className="series-label-toggle" isSelected={visible} onChange={(showLegendItem) => onChange({ showLegendItem })}><strong>{style?.legendLabel?.trim() || name}</strong></SettingsCheckbox>
    {visible && <label>Подпись<input className="text-input" value={style?.legendLabel ?? ''} placeholder={name} onChange={(event) => onChange({ legendLabel: event.target.value })}/></label>}
  </div>
}

function SeriesDirectLabelSettings({ name, config, defaultVisible = true, onChange }: { name: string; config: ChartConfig; defaultVisible?: boolean; onChange(values: Partial<ChartConfig['seriesStyles'][string]>): void }) {
  const style = config.seriesStyles[name]
  const visible = style?.showDirectLabel ?? defaultVisible
  const lineMode = style?.showLegendLine == null ? 'auto' : style.showLegendLine ? 'on' : 'off'
  return <div className={`series-label-card${visible ? '' : ' disabled'}`}>
    <SettingsCheckbox className="series-label-toggle" isSelected={visible} onChange={(showDirectLabel) => onChange({ showDirectLabel })}><strong>{name}</strong></SettingsCheckbox>
    {visible && <>
      <label>Подпись<input className="text-input" value={style?.legendLabel ?? ''} placeholder={name} onChange={(event) => onChange({ legendLabel: event.target.value })}/></label>
      <label>Примечание<textarea rows={2} value={style?.legendNote ?? ''} placeholder="Необязательное примечание · Enter для переноса" onChange={(event) => onChange({ legendNote: event.target.value })}/></label>
      <TextStyleEditor label="Индивидуальный стиль" value={style?.directLabelText ?? config.directLabelText ?? config.legendText} customFonts={config.customFonts} onChange={(directLabelText) => onChange({ directLabelText })}/>
      {style?.directLabelText && <button type="button" className="reset-element compact" onClick={() => onChange({ directLabelText: undefined })}>Использовать общий стиль</button>}
      <label>Выноска<select value={lineMode} onChange={(event) => onChange({ showLegendLine: event.target.value === 'auto' ? undefined : event.target.value === 'on' })}><option value="auto">Общая настройка</option><option value="on">Всегда</option><option value="off">Выключена</option></select></label>
    </>}
  </div>
}

export function ChartSettingsPanel({ config, plugin, seriesNames, valueLabels, xKind, frequency, onChange }: Props) {
  const [selectedValueLabelKey, setSelectedValueLabelKey] = useState('')
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
      treemapGroupText: { ...(config.treemapGroupText ?? config.valueText), ...values },
      treemapLeafText: { ...(config.treemapLeafText ?? config.valueText), ...values },
      ...(resetsInlineFonts ? { titleHtml: clearInlineFontFamily(config.titleHtml), subtitleHtml: clearInlineFontFamily(config.subtitleHtml), noteHtml: clearInlineFontFamily(config.noteHtml), sourceHtml: clearInlineFontFamily(config.sourceHtml) } : {}),
    } as Partial<ChartConfig>)
  }
  const legendMode = config.showDirectLabels ? 'direct' : config.showLegend ? 'standard' : 'none'
  const pickerSwatches = config.palette?.length ? config.palette : [config.color]
  const distribution = plugin.settings.features.distributionLayout
  const barChart = plugin.settings.features.barLayout
  const horizontalBar = plugin.category === 'bar-horizontal' || (barChart && config.barOrientation === 'horizontal') || (distribution && (config.distributionOrientation ?? 'horizontal') === 'horizontal')
  const butterflyLayoutControl = <label>Положение категорий<select value={config.butterflyCategoryPosition ?? 'center'} onChange={(event) => {
    const butterflyCategoryPosition = event.target.value as NonNullable<ChartConfig['butterflyCategoryPosition']>
    patch({ butterflyCategoryPosition, ...(butterflyCategoryPosition === 'center' ? {} : { yAxisPosition: butterflyCategoryPosition }) })
  }}><option value="center">По центру, между сторонами</option><option value="left">Слева от графика</option><option value="right">Справа от графика</option></select></label>
  const slope = config.kind === 'slope'
  const setLegendMode = (mode: 'none' | 'standard' | 'direct') => patch({ showLegend: mode === 'standard', showDirectLabels: mode === 'direct' })
  const legendTabs = [['none', 'Без легенды'], ['standard', 'Обычная'], ...(!plugin.settings.features.directLabels ? [] : [['direct', horizontalBar ? 'Над рядами' : config.yAxisPosition === 'right' ? 'Слева у рядов' : 'Справа у рядов']])] as const
  const updateSeriesLegend = (name: string, values: Partial<ChartConfig['seriesStyles'][string]>) => patch({ seriesStyles: { ...config.seriesStyles, [name]: { ...config.seriesStyles[name], ...values } } })
  const updateLegendItem = (id: string, values: NonNullable<ChartConfig['legendItemOverrides']>[string]) => patch({ legendItemOverrides: { ...config.legendItemOverrides, [id]: { ...config.legendItemOverrides?.[id], ...values } } })
  const seasonalAccents = new Set(config.seasonalAccentYears ?? [])
  const standardSeriesNames = config.kind === 'seasonal-line'
    ? [...seriesNames.filter((name) => seasonalAccents.has(name)), ...seriesNames.filter((name) => !seasonalAccents.has(name) && config.seriesStyles[name]?.color != null)]
    : seriesNames
  const seasonalOthers = config.kind === 'seasonal-line' && seriesNames.some((name) => !seasonalAccents.has(name) && config.seriesStyles[name]?.color == null)
  const selectedValueLabel = valueLabels.find((label) => label.key === selectedValueLabelKey)
  const updateValueLabel = (values: Partial<ChartConfig['elementStyles'][string]>) => selectedValueLabel && patch({ elementStyles: { ...config.elementStyles, [selectedValueLabel.key]: { ...config.elementStyles[selectedValueLabel.key], ...values } } })
  useEffect(() => { config.customFonts?.forEach(({ name, dataUrl, weight = 400, style = 'normal' }) => { if (!document.fonts.check(`${style} ${weight} 12px "${name}"`)) new FontFace(name, `url(${dataUrl})`, { weight: String(weight), style }).load().then((font) => document.fonts.add(font)).catch(() => undefined) }) }, [config.customFonts])
  useEffect(() => { if (selectedValueLabelKey && !selectedValueLabel) setSelectedValueLabelKey('') }, [selectedValueLabel, selectedValueLabelKey])
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
  const applyGradient = (anchors = config.paletteGradientColors ?? defaultGradientColors) => {
    const colors = threeColorPalette(anchors)
    patch({ paletteName: 'diverging', paletteGradientColors: anchors, palette: colors, color: colors[0], seriesStyles: Object.fromEntries(Object.entries(config.seriesStyles).map(([series, style]) => { const { color: _color, ...rest } = style; return [series, rest] })) })
  }
  const updateGradientColor = (index: number, color: string) => {
    const anchors: [string, string, string] = [...(config.paletteGradientColors ?? defaultGradientColors)]
    anchors[index] = color
    applyGradient(anchors)
  }
  const resetSection = (section: 'grid' | 'headings' | 'axes' | 'legend' | 'values' | 'credits' | 'bars') => {
    if (section === 'grid') patch({ showHorizontalGrid: true, showVerticalGrid: false, gridColor: '#d9d7df', gridWidth: 1, gridType: 'solid' })
    if (section === 'headings') patch({ showTitle: true, showSubtitle: true, titleText: defaultText(42, 700), subtitleText: defaultText(25, 400, '#666666'), titleHtml: undefined, subtitleHtml: undefined })
    if (section === 'axes') patch({ xAxisPosition: 'bottom', yAxisPosition: 'left', showXAxisTitle: false, showYAxisTitle: false, showXAxisLabels: true, showYAxisLabels: true, showXAxisLine: true, showYAxisLine: false, showXTicks: true, showYTicks: false, tickLength: DEFAULT_COMPOSITION_SPACING.tickLength, axisLineColor: '#55515e', axisLineWidth: 1, axisLineType: 'solid', xAxisTitleGap: DEFAULT_COMPOSITION_SPACING.xAxisLabelTitle, yAxisTitleGap: DEFAULT_COMPOSITION_SPACING.yAxisLabelTitle, xAxisLabelGap: DEFAULT_COMPOSITION_SPACING.axisTickLabel, yAxisLabelGap: DEFAULT_COMPOSITION_SPACING.axisTickLabel, yAxisScaleType: 'linear', showZeroLine: false, zeroLineColor: '#8a8791', zeroLineWidth: 1, zeroLineType: 'solid', xAxisTitleText: defaultText(20, 600), yAxisTitleText: defaultText(20, 600), xAxisLabelText: defaultText(18, 400, '#555555'), yAxisLabelText: defaultText(18, 400, '#555555') })
    if (section === 'legend') patch({ showLegend: false, showDirectLabels: false, legendPosition: 'top', legendText: defaultText(19), directLabelText: defaultText(19, 600), directLabelGap: DEFAULT_COMPOSITION_SPACING.directLabelPlot, showDirectLabelLines: false, directLabelLineWidth: 1, directLabelLineType: 'solid', legendItemOverrides: undefined, seriesStyles: Object.fromEntries(Object.entries(config.seriesStyles).map(([name, style]) => { const { legendLabel: _label, showLegendItem: _legend, legendNote: _note, showDirectLabel: _show, directLabelText: _text, showLegendLine: _line, ...rest } = style; return [name, rest] })) })
    if (section === 'values') patch({ showValues: false, valueText: defaultText(17, 600), valueLabelPosition: 'auto', valueLabelAutoContrast: true, valueLabelHideOverlap: false, barValueLabelAbsorption: false, barValueLabelInsidePosition: 'end', barValueLabelOutsidePosition: 'end', barValueLabelAbsorptionPadding: 10, waterfallLabelContent: 'change', waterfallSignMode: 'negative-only', waterfallPositivePrefix: '', waterfallNegativePrefix: '', waterfallShowTotalValue: true, waterfallLabelGap: 6, treemapShowGroupValues: false, treemapShowLeafValues: false, treemapGroupText: defaultText(16, 700), treemapLeafText: defaultText(14, 400) })
    if (section === 'credits') patch({ showNote: true, showSource: true, noteText: defaultText(18, 400, '#666666'), sourceText: defaultText(18, 400, '#666666'), noteHtml: undefined, sourceHtml: undefined })
    if (section === 'bars') patch({ barFillColor: undefined, barFillOpacity: 1, barWidth: 68, barBorderColor: config.color, barBorderWidth: 0, barBorderRadius: 0, barSeriesGap: 30, barCategorySort: 'none', barCategorySortSeries: '', ...(config.kind === 'butterfly' ? { butterflyCategoryPosition: 'center' } : {}) })
  }

  const sections: Record<Exclude<Section, 'series' | 'annotations'>, React.ReactNode> = {
    grid: <details className="settings-group grid-settings" key="grid"><summary>Сетка</summary><div>
      <SettingsCheckbox isSelected={config.showHorizontalGrid} onChange={(showHorizontalGrid) => patch({ showHorizontalGrid })}>Горизонтальные линии</SettingsCheckbox>
      <SettingsCheckbox isSelected={config.showVerticalGrid} onChange={(showVerticalGrid) => patch({ showVerticalGrid })}>Вертикальные линии</SettingsCheckbox>
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
      <SettingsCheckbox isSelected={config.showTitle ?? true} onChange={(showTitle) => patch({ showTitle })}>Показывать заголовок</SettingsCheckbox>
      {(config.showTitle ?? true) && <><label>Заголовок<textarea value={config.title} onChange={(event) => patch({ title: event.target.value, titleHtml: undefined })}/></label><TextStyleEditor label="Стиль заголовка" value={config.titleText} customFonts={config.customFonts} onChange={(value) => updateText('titleText', value)} align/></>}
      <SettingsCheckbox isSelected={config.showSubtitle ?? true} onChange={(showSubtitle) => patch({ showSubtitle })}>Показывать подзаголовок</SettingsCheckbox>
      {(config.showSubtitle ?? true) && <><label>Подзаголовок<textarea value={config.subtitle} onChange={(event) => patch({ subtitle: event.target.value, subtitleHtml: undefined })}/></label><TextStyleEditor label="Стиль подзаголовка" value={config.subtitleText} customFonts={config.customFonts} onChange={(value) => updateText('subtitleText', value)} align/></>}
      <button type="button" className="reset-element" onClick={() => resetSection('headings')}>Сбросить оформление раздела</button>
    </div></details>,
    axes: <details className="settings-group axes-settings" key="axes"><summary>Оси, шкалы и подписи</summary><div>
      {config.kind === 'butterfly' && butterflyLayoutControl}
      <label>Стиль заголовков осей<select value={config.axisTitleMode ?? 'standard'} onChange={(event) => patch({ axisTitleMode: event.target.value as ChartConfig['axisTitleMode'] })}><option value="standard">Классический</option><option value="editorial">Редакционный — у краёв со стрелками</option></select></label>
      <label>Положение {horizontalBar ? 'горизонтальной оси значений' : 'оси X'}<select value={config.xAxisPosition} onChange={(event) => patch({ xAxisPosition: event.target.value as ChartConfig['xAxisPosition'] })}><option value="bottom">Снизу</option><option value="top">Сверху</option></select></label>
      <label>Положение {horizontalBar ? 'вертикальной оси категорий' : 'оси Y'}<select value={config.yAxisPosition} onChange={(event) => patch({ yAxisPosition: event.target.value as ChartConfig['yAxisPosition'] })}><option value="left">Слева</option><option value="right">Справа</option></select></label>
      {horizontalBar && <SettingsCheckbox isSelected={config.categoryAxisInverse ?? true} onChange={(categoryAxisInverse) => patch({ categoryAxisInverse })}><LabelText hint="Для линейчатых диаграмм первая категория обычно находится сверху, как в таблице.">Категории и даты сверху вниз</LabelText></SettingsCheckbox>}
      <SettingsCheckbox isSelected={config.showXAxisTitle} onChange={(showXAxisTitle) => patch({ showXAxisTitle })}>Заголовок {horizontalBar ? 'вертикальной оси категорий' : 'оси X'}</SettingsCheckbox>
      {config.showXAxisTitle && <label>Текст {horizontalBar ? 'вертикальной оси категорий' : 'оси X'}<textarea rows={2} value={config.xAxisTitle} onChange={(event) => patch({ xAxisTitle: event.target.value })}/></label>}
      <SettingsCheckbox isSelected={config.showXAxisLabels ?? true} onChange={(showXAxisLabels) => patch({ showXAxisLabels })}>Подписи {horizontalBar ? 'вертикальной оси категорий' : 'оси X'}</SettingsCheckbox>
      <SettingsCheckbox isSelected={config.showYAxisTitle} onChange={(showYAxisTitle) => patch({ showYAxisTitle })}>Заголовок {horizontalBar ? 'горизонтальной оси значений' : 'оси Y'}</SettingsCheckbox>
      {config.showYAxisTitle && <label>Текст {horizontalBar ? 'горизонтальной оси значений' : 'оси Y'}<textarea rows={2} value={config.yAxisTitle} onChange={(event) => patch({ yAxisTitle: event.target.value })}/></label>}
      <SettingsCheckbox isSelected={config.showYAxisLabels ?? true} onChange={(showYAxisLabels) => patch({ showYAxisLabels })}>Подписи {horizontalBar ? 'горизонтальной оси значений' : 'оси Y'}</SettingsCheckbox>
      <strong className="axis-settings-heading">{horizontalBar ? 'Вертикальная ось категорий' : 'Ось X'}</strong>
      <TextStyleEditor label={horizontalBar ? 'Заголовок вертикальной оси категорий' : 'Заголовок оси X'} value={config.xAxisTitleText ?? config.axisTitleText} customFonts={config.customFonts} onChange={(value) => updateText('xAxisTitleText', value)} align/>
      {(config.showXAxisLabels ?? true) && <TextStyleEditor label={horizontalBar ? 'Подписи категорий' : 'Подписи шкалы X'} value={config.xAxisLabelText ?? config.axisLabelText} customFonts={config.customFonts} onChange={(value) => updateText('xAxisLabelText', value)}/>}
      <strong className="axis-settings-heading">{horizontalBar ? 'Горизонтальная ось значений' : 'Ось Y'}</strong>
      <TextStyleEditor label={horizontalBar ? 'Заголовок горизонтальной оси значений' : 'Заголовок оси Y'} value={config.yAxisTitleText ?? config.axisTitleText} customFonts={config.customFonts} onChange={(value) => updateText('yAxisTitleText', value)} align/>
      {(config.showYAxisLabels ?? true) && <TextStyleEditor label={horizontalBar ? 'Подписи значений на оси' : 'Подписи шкалы Y'} value={config.yAxisLabelText ?? config.axisLabelText} customFonts={config.customFonts} onChange={(value) => updateText('yAxisLabelText', value)}/>}
      <div className="settings-divider"/>
      <SettingsCheckbox isSelected={config.showXAxisLine} onChange={(showXAxisLine) => patch({ showXAxisLine })}>Линия оси X</SettingsCheckbox>
      <SettingsCheckbox isSelected={config.showYAxisLine} onChange={(showYAxisLine) => patch({ showYAxisLine })}>Линия оси Y</SettingsCheckbox>
      <SettingsCheckbox isSelected={config.showXTicks} onChange={(showXTicks) => patch({ showXTicks })}>Засечки на оси X</SettingsCheckbox>
      <SettingsCheckbox isSelected={config.showYTicks} onChange={(showYTicks) => patch({ showYTicks })}>Засечки на оси Y</SettingsCheckbox>
      {(config.showXTicks || config.showYTicks) && <label>Длина засечек, px<NumberInput min="1" max="20" value={config.tickLength} onValueChange={(tickLength) => patch({ tickLength })}/></label>}
      <label>Тип линий осей<select value={config.axisLineType} onChange={(event) => patch({ axisLineType: event.target.value as ChartConfig['axisLineType'] })}><option value="solid">Сплошная</option><option value="dashed">Пунктирная</option><option value="dotted">Точечная</option></select></label>
      <label>Толщина осей, px<NumberInput min="0.5" max="8" step="0.5" value={config.axisLineWidth} onValueChange={(axisLineWidth) => patch({ axisLineWidth })}/></label>
      <label>Цвет осей<ColorControl value={config.axisLineColor} swatches={pickerSwatches} onChange={(axisLineColor) => patch({ axisLineColor })}/></label>
      <div className="settings-divider"/>
      <AxisScaleFields config={config} xKind={xKind} frequency={frequency} distributionOrientation={distribution ? config.distributionOrientation ?? 'horizontal' : undefined} onChange={onChange}/>
      <button type="button" className="reset-element" onClick={() => resetSection('axes')}>Сбросить раздел</button>
    </div></details>,
    'legend-values': <Fragment key="legend-values">
    <details className="settings-group legend-settings"><summary>Легенда</summary><div>
      {!slope && config.kind !== 'heatmap' && config.kind !== 'treemap' && <><div className="legend-mode-label">Способ обозначения рядов <Hint text="Прямые подписи называют линии или ряды прямо на графике и часто заменяют отдельную легенду."/></div><Tabs className="settings-tabs legend-mode" selectedKey={legendMode} onSelectionChange={(key) => setLegendMode(String(key) as 'none' | 'standard' | 'direct')}>
        <Tabs.ListContainer><Tabs.List aria-label="Способ обозначения рядов">{legendTabs.map(([value, label]) => <Tabs.Tab id={value} key={value}><Tabs.Indicator/>{label}</Tabs.Tab>)}</Tabs.List></Tabs.ListContainer>
        <Tabs.Panel id="none">{null}</Tabs.Panel>
        <Tabs.Panel id="standard"><div className="legend-options"><label>Расположение<select value={config.legendPosition ?? 'top'} onChange={(event) => patch({ legendPosition: event.target.value as ChartConfig['legendPosition'] })}><option value="top">Сверху</option><option value="bottom">Снизу</option><option value="left">Слева</option><option value="right">Справа</option></select></label><label>Маркер<select value={config.legendMarker ?? 'auto'} onChange={(event) => patch({ legendMarker: event.target.value as ChartConfig['legendMarker'] })}><option value="auto">По типу графика</option><option value="circle">Круг</option><option value="square">Квадрат</option><option value="line">Линия</option><option value="diamond">Ромб</option><option value="triangle">Треугольник</option></select></label><TextStyleEditor label="Текст легенды" value={config.legendText} customFonts={config.customFonts} onChange={(value) => updateText('legendText', value)}/><div className="series-label-list"><span>Элементы легенды</span>{standardSeriesNames.map((name) => <SeriesLegendItemSettings name={name} config={config} onChange={(values) => updateSeriesLegend(name, values)} key={name}/>)}{seasonalOthers && <div className={`series-label-card${config.legendItemOverrides?.[SEASONAL_OTHERS_LEGEND_ITEM_ID]?.visible === false ? ' disabled' : ''}`}><SettingsCheckbox className="series-label-toggle" isSelected={config.legendItemOverrides?.[SEASONAL_OTHERS_LEGEND_ITEM_ID]?.visible ?? true} onChange={(visible) => updateLegendItem(SEASONAL_OTHERS_LEGEND_ITEM_ID, { visible })}><strong>{config.legendItemOverrides?.[SEASONAL_OTHERS_LEGEND_ITEM_ID]?.label?.trim() || SEASONAL_OTHERS_LEGEND_LABEL}</strong></SettingsCheckbox>{config.legendItemOverrides?.[SEASONAL_OTHERS_LEGEND_ITEM_ID]?.visible !== false && <label>Подпись<input className="text-input" value={config.legendItemOverrides?.[SEASONAL_OTHERS_LEGEND_ITEM_ID]?.label ?? ''} placeholder={SEASONAL_OTHERS_LEGEND_LABEL} onChange={(event) => updateLegendItem(SEASONAL_OTHERS_LEGEND_ITEM_ID, { label: event.target.value })}/></label>}</div>}</div></div></Tabs.Panel>
        {plugin.settings.features.directLabels && <Tabs.Panel id="direct"><div className="legend-options direct-legend-options">
          <TextStyleEditor label={horizontalBar ? 'Стиль подписей над рядами' : config.yAxisPosition === 'right' ? 'Стиль левых подписей' : 'Стиль правых подписей'} value={config.directLabelText ?? config.legendText} customFonts={config.customFonts} onChange={(directLabelText) => patch({ directLabelText })}/>
          <label><LabelText hint={horizontalBar ? 'Увеличьте, если подписи над рядами близко к подзаголовку или столбцам.' : `Увеличьте, если подписи слишком близко к ${config.yAxisPosition === 'right' ? 'начальным' : 'последним'} точкам.`}>{horizontalBar ? 'Отступ от ряда' : 'Отступ от графика'}, px</LabelText><NumberInput min="4" max="80" value={config.directLabelGap ?? 14} onValueChange={(directLabelGap) => patch({ directLabelGap })}/></label>
          <SettingsCheckbox isSelected={config.showDirectLabelLines ?? false} onChange={(showDirectLabelLines) => patch({ showDirectLabelLines })}><LabelText hint="Выноски помогают связать подпись с рядом, если автоматическое расположение сдвинуло текст.">Всегда показывать выноски</LabelText></SettingsCheckbox>
          {(config.showDirectLabelLines ?? false) && <div className="legend-line-grid"><label>Толщина, px<NumberInput min="0.5" max="5" step="0.5" value={config.directLabelLineWidth ?? 1} onValueChange={(directLabelLineWidth) => patch({ directLabelLineWidth })}/></label><label>Тип<select value={config.directLabelLineType ?? 'solid'} onChange={(event) => patch({ directLabelLineType: event.target.value as ChartConfig['directLabelLineType'] })}><option value="solid">Сплошная</option><option value="dashed">Пунктирная</option><option value="dotted">Точечная</option></select></label></div>}
          <div className="series-label-list"><span>Подписи по рядам</span>{seriesNames.map((name) => <SeriesDirectLabelSettings name={name} config={config} defaultVisible={config.kind !== 'seasonal-line' || seasonalAccents.has(name)} onChange={(values) => updateSeriesLegend(name, values)} key={name}/>)}</div>
        </div></Tabs.Panel>}
      </Tabs></>}
      {config.kind === 'heatmap' && <small className="settings-note">Шкала интенсивности формируется автоматически из минимального и максимального значений.</small>}
      {config.kind === 'treemap' && <small className="settings-note">Цвета обозначают общие категории, а площадь — величину значения.</small>}
      {slope && <small className="settings-note">Названия рядов выводятся рядом с конечными значениями, поэтому отдельная легенда не используется.</small>}
      <button type="button" className="reset-element" onClick={() => resetSection('legend')}>Сбросить легенду</button>
    </div></details>
    {config.kind !== 'treemap' && <details className="settings-group value-label-settings"><summary>Подписи значений</summary><div>
      <SettingsCheckbox isSelected={config.showValues} onChange={(showValues) => patch({ showValues })}>Показывать подписи значений</SettingsCheckbox>
      {config.showValues && <><TextStyleEditor label="Стиль подписей" value={config.valueText} customFonts={config.customFonts} onChange={(value) => updateText('valueText', value)}/>
      {config.kind === 'waterfall' ? <div className="chart-role-fields waterfall-label-settings">
        <label>Что показывать<select value={config.waterfallLabelContent ?? 'change'} onChange={(event) => patch({ waterfallLabelContent: event.target.value as NonNullable<ChartConfig['waterfallLabelContent']> })}><option value="change">Изменение шага</option><option value="cumulative">Накопленный итог</option><option value="both">Изменение → итог</option></select></label>
        <label>Положение<select value={config.valueLabelPosition ?? 'auto'} onChange={(event) => patch({ valueLabelPosition: event.target.value as ChartConfig['valueLabelPosition'] })}><option value="auto">Автоматически: внутри или снаружи</option><option value="top">Снаружи у нового итога</option><option value="inside-top">Внутри у нового итога</option><option value="inside-center">Внутри по центру</option><option value="inside-bottom">Внутри у предыдущего итога</option><option value="bottom">Снаружи у предыдущего итога</option></select></label>
        <label>Знаки изменений<select value={config.waterfallSignMode ?? 'negative-only'} onChange={(event) => patch({ waterfallSignMode: event.target.value as NonNullable<ChartConfig['waterfallSignMode']> })}><option value="negative-only">Минус у снижения</option><option value="plus-minus">Плюс и минус</option><option value="none">Без знаков</option><option value="custom">Свои префиксы</option></select></label>
        {config.waterfallSignMode === 'custom' && <div className="fred-grid"><label>Префикс роста<input maxLength={20} placeholder="+" value={config.waterfallPositivePrefix ?? ''} onChange={(event) => patch({ waterfallPositivePrefix: event.target.value })}/></label><label>Префикс снижения<input maxLength={20} placeholder="−" value={config.waterfallNegativePrefix ?? ''} onChange={(event) => patch({ waterfallNegativePrefix: event.target.value })}/></label></div>}
        <label>Отступ подписи, px<NumberInput min="0" max="40" value={config.waterfallLabelGap ?? 6} onValueChange={(waterfallLabelGap) => patch({ waterfallLabelGap })}/></label>
        {(config.waterfallShowTotal ?? true) && <SettingsCheckbox isSelected={config.waterfallShowTotalValue ?? true} onChange={(waterfallShowTotalValue) => patch({ waterfallShowTotalValue })}>Показывать значение итога</SettingsCheckbox>}
        <small>Префикс и суффикс единиц измерения задаются в разделе «Формат чисел». Свои префиксы роста и снижения добавляются перед ними.</small>
      </div> : barChart && <SettingsCheckbox isSelected={config.barValueLabelAbsorption ?? false} onChange={(barValueLabelAbsorption) => patch({ barValueLabelAbsorption })}><LabelText hint="Подпись сохраняет заданный размер: помещается внутрь, если хватает места, иначе переносится наружу.">Автоматически помещать подпись внутрь</LabelText></SettingsCheckbox>}
      {config.kind !== 'waterfall' && barChart && config.barValueLabelAbsorption ? <div className="chart-role-fields">
        <label>Положение внутри<select value={config.barValueLabelInsidePosition ?? 'end'} onChange={(event) => patch({ barValueLabelInsidePosition: event.target.value as NonNullable<ChartConfig['barValueLabelInsidePosition']> })}><option value="end">У края значения</option><option value="center">По центру</option><option value="start">У нулевой линии</option></select></label>
        <label>Положение снаружи<select value={config.barValueLabelOutsidePosition ?? 'end'} onChange={(event) => patch({ barValueLabelOutsidePosition: event.target.value as NonNullable<ChartConfig['barValueLabelOutsidePosition']> })}><option value="end">За краем значения</option><option value="start">Перед нулевой линией</option></select></label>
        <label>Свободное место вокруг подписи, px<NumberInput min="2" max="32" value={config.barValueLabelAbsorptionPadding ?? 10} onValueChange={(barValueLabelAbsorptionPadding) => patch({ barValueLabelAbsorptionPadding })}/></label>
      </div> : config.kind !== 'waterfall' && <label>Положение подписей<select value={config.valueLabelPosition ?? 'auto'} onChange={(event) => patch({ valueLabelPosition: event.target.value as ChartConfig['valueLabelPosition'] })}><option value="auto">Автоматически</option><option value="top">{horizontalBar ? 'Снаружи справа' : 'Снаружи сверху'}</option><option value="inside-top">{horizontalBar ? 'Внутри справа' : 'Внутри сверху'}</option><option value="inside-center">Внутри по центру</option><option value="inside-bottom">{horizontalBar ? 'Внутри слева' : 'Внутри снизу'}</option><option value="bottom">{horizontalBar ? 'Снаружи слева' : 'Снаружи снизу'}</option></select></label>}
      <SettingsCheckbox isSelected={config.valueLabelAutoContrast ?? true} onChange={(valueLabelAutoContrast) => patch({ valueLabelAutoContrast })}><LabelText hint="Если подпись находится внутри цветного столбца, цвет текста автоматически меняется на читаемый.">Автоконтраст внутри столбцов</LabelText></SettingsCheckbox>
      <SettingsCheckbox isSelected={config.valueLabelHideOverlap ?? false} onChange={(valueLabelHideOverlap) => patch({ valueLabelHideOverlap })}><LabelText hint="Если включить, часть пересекающихся подписей будет скрыта. Размер остальных подписей не меняется.">Скрывать пересекающиеся подписи</LabelText></SettingsCheckbox></>}
      {!!valueLabels.length && <div className="individual-value-labels">
        <div><strong>Индивидуальные подписи</strong><small>{valueLabels.length} элементов</small></div>
        <label>{config.kind === 'waterfall' ? 'Выберите столбец' : 'Выберите элемент'}<select value={selectedValueLabelKey} onChange={(event) => setSelectedValueLabelKey(event.target.value)}><option value="">Не выбран</option>{[...new Set(valueLabels.map((label) => label.seriesName))].map((seriesName) => <optgroup label={seriesName} key={seriesName}>{valueLabels.filter((label) => label.seriesName === seriesName).map((label) => <option value={label.key} key={label.key}>{label.label || label.category || label.value} · {label.value}</option>)}</optgroup>)}</select></label>
        {selectedValueLabel && <div className="individual-value-label-editor"><ValueLabelFields config={config} element={selectedValueLabel} onChange={updateValueLabel}/><button type="button" className="reset-element compact" onClick={() => updateValueLabel({ valueText: undefined, label: undefined, labelPosition: undefined, waterfallLabelPosition: undefined, treemapLabelPosition: undefined, showLabel: undefined, showName: undefined, showValue: undefined })}>Вернуть общие настройки</button></div>}
      </div>}
      <button type="button" className="reset-element" onClick={() => resetSection('values')}>Сбросить подписи</button>
    </div></details>}</Fragment>,
    credits: <details className="settings-group credits-settings" key="credits"><summary>Комментарий и источник</summary><div>
      <SettingsCheckbox isSelected={config.showNote ?? true} onChange={(showNote) => patch({ showNote })}>Показывать комментарий</SettingsCheckbox>
      {(config.showNote ?? true) && <label>Комментарий<textarea value={config.note} onChange={(event) => patch({ note: event.target.value, noteHtml: undefined })}/></label>}
      <SettingsCheckbox isSelected={config.showSource ?? true} onChange={(showSource) => patch({ showSource })}>Показывать источник</SettingsCheckbox>
      {(config.showSource ?? true) && <label>Источник<input className="text-input" value={config.source} onChange={(event) => patch({ source: event.target.value, sourceHtml: undefined })} placeholder="Источник: Росстат"/></label>}
      {(config.showNote ?? true) && <TextStyleEditor label="Стиль комментария" value={config.noteText} customFonts={config.customFonts} onChange={(noteText) => updateText('noteText', noteText)} align/>}
      {(config.showSource ?? true) && <TextStyleEditor label="Стиль источника" value={config.sourceText} customFonts={config.customFonts} onChange={(sourceText) => updateText('sourceText', sourceText)} align/>}
      <button type="button" className="reset-element" onClick={() => resetSection('credits')}>Сбросить оформление раздела</button>
    </div></details>,
  }

  return <>{plugin.settings.sections.includes('series') && <details className="settings-group palette-settings"><summary>Палитра</summary><div><div className="palette-presets">{palettes.map((palette) => <button type="button" className={config.paletteName === palette.id ? 'active' : ''} key={palette.id} onClick={() => palette.id === 'mono' ? applyMonochrome() : palette.id === 'diverging' ? applyGradient() : applyPalette(palette.id, [...palette.colors])}><span>{((palette.id === 'mono' || palette.id === 'diverging') && config.paletteName === palette.id ? config.palette ?? palette.colors : palette.colors).map((color) => <i style={{ background: color }} key={color}/>)}</span><b>{palette.label}</b></button>)}</div>{config.paletteName === 'mono' && <label>Базовый цвет<div className="palette-base-color"><ColorControl value={config.paletteBaseColor ?? '#55515e'} swatches={pickerSwatches} onChange={applyMonochrome}/><span aria-label="Предпросмотр оттенков">{monochromePalette(config.paletteBaseColor ?? '#55515e').map((color) => <i style={{ background: color }} key={color}/>)}</span></div></label>}{config.paletteName === 'diverging' && <div className="palette-gradient-colors">{(['Начальный', 'Средний', 'Конечный'] as const).map((label, index) => <label key={label}>{label} цвет<ColorControl value={(config.paletteGradientColors ?? defaultGradientColors)[index]} swatches={pickerSwatches} onChange={(color) => updateGradientColor(index, color)}/></label>)}</div>}<label>Своя палитра<div className="custom-palette">{(config.palette?.length ? config.palette : [config.color]).map((color, index, colors) => <span key={index}><ColorControl compact title={`Цвет палитры ${index + 1}`} value={color} swatches={colors} onChange={(nextColor) => { const next = [...colors]; next[index] = nextColor; applyPalette('custom', next) }}/>{colors.length > 1 && <button type="button" className="palette-remove" aria-label={`Удалить цвет ${index + 1}`} title={`Удалить цвет ${index + 1}`} onClick={() => applyPalette('custom', colors.filter((_, current) => current !== index))}>×</button>}</span>)}{(config.palette?.length ?? 1) < 10 && <button type="button" aria-label="Добавить цвет" title="Добавить цвет" onClick={() => applyPalette('custom', [...(config.palette?.length ? config.palette : [config.color]), '#777580'])}>＋</button>}</div></label></div></details>}{plugin.settings.features.barLayout && <details className="settings-group bar-settings"><summary>Компоновка столбцов</summary><div>{config.kind === 'waterfall' ? <><SettingsCheckbox isSelected={config.waterfallShowTotal ?? true} onChange={(waterfallShowTotal) => patch({ waterfallShowTotal })}>Показывать итоговый столбец</SettingsCheckbox>{(config.waterfallShowTotal ?? true) && <label>Подпись итога<input value={config.waterfallTotalLabel ?? 'Итого'} onChange={(event) => patch({ waterfallTotalLabel: event.target.value })}/></label>}<label>Рост<ColorControl value={config.waterfallIncreaseColor ?? '#36a476'} swatches={pickerSwatches} onChange={(waterfallIncreaseColor) => patch({ waterfallIncreaseColor })}/></label><label>Снижение<ColorControl value={config.waterfallDecreaseColor ?? '#db5a5a'} swatches={pickerSwatches} onChange={(waterfallDecreaseColor) => patch({ waterfallDecreaseColor })}/></label><label>Итог<ColorControl value={config.waterfallTotalColor ?? '#6956e8'} swatches={pickerSwatches} onChange={(waterfallTotalColor) => patch({ waterfallTotalColor })}/></label><label>Соединители<ColorControl value={config.waterfallConnectorColor ?? '#8a8791'} swatches={pickerSwatches} onChange={(waterfallConnectorColor) => patch({ waterfallConnectorColor })}/></label></> : xKind === 'other' && <><label>Сортировка категорий<select value={config.barCategorySort ?? 'none'} onChange={(event) => patch({ barCategorySort: event.target.value as NonNullable<ChartConfig['barCategorySort']> })}><option value="none">Как в данных</option><option value="value-desc">По значению: от большего</option><option value="value-asc">По значению: от меньшего</option><option value="name-asc">По названию: А → Я</option><option value="name-desc">По названию: Я → А</option></select></label>{seriesNames.length > 1 && (config.barCategorySort === 'value-asc' || config.barCategorySort === 'value-desc') && <label>Основа сортировки<select value={config.barCategorySortSeries ?? ''} onChange={(event) => patch({ barCategorySortSeries: event.target.value })}><option value="">Сумма всех рядов</option>{seriesNames.map((name) => <option value={name} key={name}>{name}</option>)}</select></label>}</>}<label><LabelText hint="Общая ширина всех столбцов внутри одной категории. Меньше — больше воздуха, больше — плотнее сравнение.">Ширина группы, %</LabelText><NumberInput min="10" max="100" step="1" value={config.barWidth ?? 68} onValueChange={(barWidth) => patch({ barWidth })}/></label>{config.kind !== 'waterfall' && <label><LabelText hint="Отрицательные значения сближают ряды, положительные добавляют расстояние между ними.">Расстояние между рядами, %</LabelText><NumberInput min="-90" max="100" value={config.barSeriesGap ?? 30} onValueChange={(barSeriesGap) => patch({ barSeriesGap })}/></label>}<label>Скругление углов, px<NumberInput min="0" max="80" value={config.barBorderRadius ?? 0} onValueChange={(barBorderRadius) => patch({ barBorderRadius })}/></label><small className="bar-selection-hint">Заливка, рамка и индивидуальная ширина настраиваются после выбора ряда или отдельного столбца на холсте.</small><button type="button" className="reset-element" onClick={() => resetSection('bars')}>Сбросить компоновку</button></div></details>}{plugin.settings.features.areaLayout && <details className="settings-group area-settings"><summary>Заливка области</summary><div><label>Прозрачность заливки<NumberInput min="0.05" max="1" step="0.05" value={config.areaFillOpacity ?? .32} onValueChange={(areaFillOpacity) => patch({ areaFillOpacity })}/></label><label>Пропуски в области<select value={config.missingMode} onChange={(event) => patch({ missingMode: event.target.value as ChartConfig['missingMode'] })}><option value="gap">Оставлять разрывы</option><option value="zero">Заменять нулём</option><option value="connect">Соединять соседние значения</option></select></label><small>Цвет области наследуется от цвета соответствующего ряда.</small></div></details>}{plugin.settings.sections.filter((section): section is Exclude<Section, 'series' | 'annotations'> => section !== 'series' && section !== 'annotations').map((section) => sections[section])}</>
}
