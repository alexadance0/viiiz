import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import './App.css'
import './components/SeriesOrder.css'
import { ChartCanvas, type ChartCanvasHandle, type ChartSettingsSection } from './components/ChartCanvas'
import { DataReview } from './components/DataReview'
import { DateFormatDialog } from './components/DateFormatDialog'
import { DataTransformDialog } from './components/DataTransformDialog'
import { ExcelSheetDialog } from './components/ExcelSheetDialog'
import { NumberInput } from './components/NumberInput'
import { MarkerSettings } from './components/MarkerSettings'
import { AxisScaleSettings } from './components/AxisScaleSettings'
import { ChartSettingsPanel } from './components/ChartSettingsPanel'
import { CanvasSettings } from './components/CanvasSettings'
import { NumberFormatSettings } from './components/NumberFormatSettings'
import { SettingsQuickNav } from './components/SettingsQuickNav'
import { BarSelectionControls } from './components/BarSelectionControls'
import { StyleTransferActions } from './components/StyleTransferActions'
import { ValueLabelSelectionControls } from './components/ValueLabelSelectionControls'
import { ScatterSettings } from './components/ScatterSettings'
import { LineVariantSettings } from './components/LineVariantSettings'
import { ColorControl } from './components/PickerControls'
import { chartRegistry, getChartPlugin, getSeriesColor } from './core/chartRegistry'
import { prepareChartData } from './core/chartData'
import { convertColumn, editCell, inferTypes, profileData, renameColumn } from './core/dataProfile'
import { categoricalDemoTable, demoTable, importExcelSheets, importFile, importGoogleSheet } from './core/importers'
import { normalizeInWorker } from './core/workerClient'
import { removeDuplicateRows, removeRows } from './core/dataQuality'
import type { ChartAnnotation, ChartConfig, ChartDecoration, ChartElementSelection, ChartKind, ChartSeriesSelection, ChartTextStyle, ColumnType, DataTable } from './core/types'
import { isBarChart, isLineLikeChart } from './core/chartKinds'
import { CircleX, Minus, Plus, RotateCcw, RotateCw } from 'lucide-react'

type EditorStep = 'source' | 'data' | 'chart' | 'design'
interface HistorySnapshot { table: DataTable; types: Record<string, ColumnType>; config: ChartConfig; label: string; time: number }
type CopiedStyle = { kind: 'series'; style: ChartConfig['seriesStyles'][string] } | { kind: 'element'; style: ChartConfig['elementStyles'][string] }
type AxisGridState = Pick<ChartConfig, 'showXAxisTitle' | 'showYAxisTitle' | 'showXAxisLine' | 'showYAxisLine' | 'showXTicks' | 'showYTicks' | 'showHorizontalGrid' | 'showVerticalGrid'>
const axisGridKeys = ['showXAxisTitle', 'showYAxisTitle', 'showXAxisLine', 'showYAxisLine', 'showXTicks', 'showYTicks', 'showHorizontalGrid', 'showVerticalGrid'] as const
const axisGridState = (config: ChartConfig) => Object.fromEntries(axisGridKeys.map((key) => [key, config[key]])) as AxisGridState
const axisGridDefaults = (kind: ChartKind): Partial<AxisGridState> => kind === 'scatter' || kind === 'bubble'
  ? { showXAxisTitle: true, showXAxisLine: true, showYAxisLine: true, showHorizontalGrid: true, showVerticalGrid: true }
  : { showXAxisLine: true, showYAxisLine: false, showHorizontalGrid: true, showVerticalGrid: false }
const steps: { id: EditorStep; number: string; label: string }[] = [
  { id: 'source', number: '01', label: 'Загрузка' },
  { id: 'data', number: '02', label: 'Проверка данных' },
  { id: 'chart', number: '03', label: 'Тип графика' },
  { id: 'design', number: '04', label: 'Настройка' },
]
const categories = [
  { id: 'comparison', label: 'Сравнение', hint: 'Сопоставить значения' },
  { id: 'bar-horizontal', label: 'Линейчатые', hint: 'Сравнить категории по горизонтали' },
  { id: 'trend', label: 'Динамика', hint: 'Изменения во времени' },
  { id: 'area', label: 'Области', hint: 'Показать объём и структуру' },
  { id: 'relationship', label: 'Связи', hint: 'Найти зависимости' },
] as const

const textStyle = (size: number, weight = 400, color = '#2b2b2b'): ChartTextStyle => ({ fontFamily: 'DM Sans, sans-serif', size, color, weight, italic: false, lineHeight: 120, align: 'left' })
const defaultPalette = ['#0072b2', '#e69f00', '#009e73', '#d55e00', '#cc79a7', '#56b4e9', '#f0e442']
const initialConfig: ChartConfig = {
  canvasPreset: 'presentation-standard', canvasWidth: 1000, canvasHeight: 750, canvasBackground: '#ffffff', autoFitCanvas: true, canvasMarginTop: 24, canvasMarginRight: 24, canvasMarginBottom: 24, canvasMarginLeft: 32,
  kind: 'bar', xField: 'month', yField: 'revenue', yFields: ['revenue'], seriesField: '', aggregation: 'none', valueMode: 'absolute', missingMode: 'gap', title: 'Заголовок графика', showTitle: true, showSubtitle: true, showNote: true, showSource: true,
  subtitle: 'Подзаголовок графика', note: 'Комментарий к графику', source: 'Источник: данные пользователя', titleText: textStyle(42, 700), subtitleText: textStyle(25, 400, '#666666'), axisTitleText: textStyle(20, 600), axisLabelText: textStyle(18, 400, '#555555'), xAxisTitleText: textStyle(20, 600), yAxisTitleText: textStyle(20, 600), xAxisLabelText: textStyle(18, 400, '#555555'), yAxisLabelText: textStyle(18, 400, '#555555'), legendText: textStyle(19), valueText: textStyle(17, 600), noteText: textStyle(18, 400, '#666666'), sourceText: textStyle(18, 400, '#666666'), showValues: false, numberLocale: 'ru-RU', numberDecimals: null, numberOperation: 'none', numberFactor: 1, numberPrefix: '', numberSuffix: '', numberGrouping: true, valueLabelPosition: 'auto', valueLabelAutoContrast: true, valueLabelHideOverlap: true, xAxisTitle: 'Подпись оси X', yAxisTitle: 'Подпись оси Y', xAxisTitleGap: 14, yAxisTitleGap: 14, xAxisPosition: 'bottom', yAxisPosition: 'left', showXAxisTitle: true, showYAxisTitle: true, showXAxisLine: true, showYAxisLine: false, axisLineColor: '#55515e', axisLineWidth: 1, axisLineType: 'solid', showXTicks: true, showYTicks: false, tickLength: 6, yAxisScaleType: 'linear', showZeroLine: false, zeroLineColor: '#8a8791', zeroLineWidth: 1, zeroLineType: 'solid', xAxisLabelRotate: 0, xAxisLabelOverflow: 'auto', elementStyles: {}, seriesStyles: {}, annotations: [],
  color: defaultPalette[0], paletteName: 'okabe-ito', palette: defaultPalette, barWidth: 68, barFillOpacity: 1, barBorderColor: defaultPalette[0], barBorderWidth: 0, barBorderRadius: 0, barSeriesGap: 30, barOrientation: 'vertical', areaFillOpacity: .32, stepPosition: 'end', intervalFillOpacity: .18, showLegend: false, legendPosition: 'top', showDirectLabels: false, directLabelText: textStyle(19, 600), directLabelGap: 16, showDirectLabelLines: false, directLabelLineWidth: 1, directLabelLineType: 'solid',
  scatterPointSize: 10, scatterSizeMin: 6, scatterSizeMax: 42, scatterSizeLegend: true, scatterSizeLegendTitle: 'Размер', scatterSizeLegendPosition: 'top-left', scatterOpacity: .78, scatterBorderWidth: 1, scatterHollow: false, scatterShowLabels: false, scatterLabelPosition: 'right', scatterTrendline: false, scatterTrendColor: '#77727f', scatterTrendWidth: 2, scatterTrendType: 'dashed', scatterTrendBand: false, scatterTrendBandOpacity: .12, scatterXReference: null, scatterYReference: null, scatterReferenceColor: '#8a8791', scatterReferenceWidth: 1.5, scatterReferenceType: 'dashed', scatterQuadrants: false, scatterQuadrantColors: ['#dfeee8', '#e7eef8', '#f8e5e3', '#f2eadb'], scatterQuadrantLabels: ['', '', '', ''], scatterDiagonal: false, scatterDiagonalColor: '#8a8791', scatterDiagonalWidth: 1.5, scatterDiagonalType: 'dashed', axisTitleMode: 'standard',
  showHorizontalGrid: true, showVerticalGrid: false, gridColor: '#d9d7df', gridWidth: 1, gridType: 'solid',
  xAxisMin: '', xAxisMax: '', xAxisStep: null, dateAxisStepUnit: 'auto', yAxisMin: null, yAxisMax: null, yAxisStep: null, dateLabelFormat: 'auto',
}

function App() {
  const [step, setStep] = useState<EditorStep>('source')
  const [hasData, setHasData] = useState(false)
  const [table, setTable] = useState<DataTable>(demoTable)
  const [types, setTypes] = useState<Record<string, ColumnType>>(inferTypes(demoTable))
  const [config, setConfig] = useState(initialConfig)
  const [sheetUrl, setSheetUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [dateFormatColumn, setDateFormatColumn] = useState<string | null>(null)
  const [showTransformDialog, setShowTransformDialog] = useState(false)
  const [excelWorkbook, setExcelWorkbook] = useState<{ fileName: string; sheets: Awaited<ReturnType<typeof importExcelSheets>> } | null>(null)
  const [selectedElement, setSelectedElement] = useState<ChartElementSelection | null>(null)
  const [selectedSeries, setSelectedSeries] = useState<ChartSeriesSelection | null>(null)
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null)
  const [selectedDecoration, setSelectedDecoration] = useState<string | null>(null)
  const [selectedSettingsSection, setSelectedSettingsSection] = useState<ChartSettingsSection | null>(null)
  const [copiedStyle, setCopiedStyle] = useState<CopiedStyle | null>(null)
  const [canvasZoom, setCanvasZoom] = useState(1)
  const [past, setPast] = useState<HistorySnapshot[]>([])
  const [future, setFuture] = useState<HistorySnapshot[]>([])
  const [designPast, setDesignPast] = useState<ChartConfig[]>([])
  const [designFuture, setDesignFuture] = useState<ChartConfig[]>([])
  const previousDesignConfig = useRef(config)
  const skipDesignHistory = useRef(false)
  const lastDesignCommit = useRef(0)
  const processingController = useRef<AbortController | null>(null)
  const importSequence = useRef(0)
  const chartRef = useRef<ChartCanvasHandle>(null)
  const axisGridByKind = useRef<Partial<Record<ChartKind, Partial<AxisGridState>>>>({})
  const issues = useMemo(() => profileData(table, types), [table, types])
  const numericColumns = useMemo(() => table.columns.filter((column) => types[column] === 'number'), [table.columns, types])
  const chartSeries = useMemo(() => {
    const series = prepareChartData(table, config).series
    if (!config.seriesOrder?.length) return series
    const positions = new Map(config.seriesOrder.map((name, index) => [name, index]))
    return [...series].sort((left, right) => (positions.get(left.name) ?? Number.MAX_SAFE_INTEGER) - (positions.get(right.name) ?? Number.MAX_SAFE_INTEGER))
  }, [table, config])
  const chartPlugin = useMemo(() => getChartPlugin(config.kind), [config.kind])
  const currentIndex = steps.findIndex((item) => item.id === step)
  const xFieldType = types[config.xField]

  useEffect(() => {
    if (config.kind === 'scatter' || config.kind === 'bubble') return
    if (xFieldType !== 'date') return
    setConfig((current) => current.showXAxisTitle ? { ...current, showXAxisTitle: false } : current)
  }, [config.kind, config.xField, xFieldType])

  useEffect(() => {
    if (config.kind !== 'scatter' && config.kind !== 'bubble') return
    setConfig((current) => current.showXAxisTitle && current.showXAxisLine && current.showYAxisLine && current.showHorizontalGrid && current.showVerticalGrid
      ? current
      : { ...current, showXAxisTitle: true, showXAxisLine: true, showYAxisLine: true, showHorizontalGrid: true, showVerticalGrid: true })
  }, [config.kind])

  useEffect(() => {
    if (!isLineLikeChart(config.kind)) return
    setConfig((current) => {
      let changed = false
      const seriesStyles = { ...current.seriesStyles }
      chartSeries.forEach(({ name }) => { if (seriesStyles[name]?.lineWidth == null) { seriesStyles[name] = { ...seriesStyles[name], lineWidth: 3 }; changed = true } })
      return changed ? { ...current, seriesStyles } : current
    })
  }, [chartSeries, config.kind])

  useEffect(() => () => processingController.current?.abort(), [])

  useEffect(() => {
    if (skipDesignHistory.current) { skipDesignHistory.current = false; previousDesignConfig.current = config; return }
    if (step !== 'chart' && step !== 'design') { previousDesignConfig.current = config; return }
    const previous = previousDesignConfig.current
    if (previous === config) return
    const now = Date.now()
    if (now - lastDesignCommit.current > 350) setDesignPast((items) => [...items.slice(-99), structuredClone(previous)])
    lastDesignCommit.current = now
    setDesignFuture([])
    previousDesignConfig.current = config
  }, [config, step])

  const undoDesign = () => {
    const previous = designPast.at(-1); if (!previous) return
    skipDesignHistory.current = true; lastDesignCommit.current = 0
    setDesignPast((items) => items.slice(0, -1)); setDesignFuture((items) => [...items, structuredClone(config)])
    setConfig(previous)
  }
  const redoDesign = () => {
    const next = designFuture.at(-1); if (!next) return
    skipDesignHistory.current = true; lastDesignCommit.current = 0
    setDesignFuture((items) => items.slice(0, -1)); setDesignPast((items) => [...items, structuredClone(config)])
    setConfig(next)
  }
  const clearCanvasSelection = () => {
    setSelectedElement(null); setSelectedSeries(null); setSelectedAnnotation(null); setSelectedDecoration(null); setSelectedSettingsSection(null)
  }
  const changeCanvasZoom = (next: number) => setCanvasZoom(Math.min(2, Math.max(.5, Number(next.toFixed(2)))))

  useEffect(() => {
    if (step !== 'chart' && step !== 'design') return
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return
      event.preventDefault()
      if (event.shiftKey) redoDesign(); else undoDesign()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const focusSettings = (section: ChartSettingsSection) => {
    setSelectedAnnotation(null); setSelectedDecoration(null)
    if (section === 'values') { setSelectedElement(null); setSelectedSeries(null) }
    const sectionCapability: Partial<Record<ChartSettingsSection, (typeof chartPlugin.settings.sections)[number]>> = {
      title: 'headings', subtitle: 'headings', 'x-axis-title': 'axes', 'y-axis-title': 'axes', 'x-axis-labels': 'axes', 'y-axis-labels': 'axes', grid: 'grid', legend: 'legend-values', values: 'legend-values', note: 'credits', source: 'credits', series: 'series', element: 'series',
    }
    const capability = sectionCapability[section]
    if (capability && !chartPlugin.settings.sections.includes(capability)) return
    setSelectedSettingsSection(section)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (section === 'series' || section === 'element') {
        document.querySelector(`.settings-panel .${section === 'series' ? 'series-editor' : 'element-editor'}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        return
      }
      const targets: Record<Exclude<ChartSettingsSection, 'series' | 'element'>, { group: string; field?: string }> = {
        title: { group: 'Заголовок и подзаголовок', field: 'Заголовок' }, subtitle: { group: 'Заголовок и подзаголовок', field: 'Подзаголовок' },
        'x-axis-title': { group: 'Оси', field: 'Текст оси X' }, 'y-axis-title': { group: 'Оси', field: 'Текст оси Y' },
        'x-axis-labels': { group: 'Оси', field: 'Подписи шкалы X' }, 'y-axis-labels': { group: 'Оси', field: 'Подписи шкалы Y' },
        grid: { group: 'Сетка' }, legend: { group: 'Легенда и значения', field: 'Показывать легенду' }, values: { group: 'Легенда и значения', field: 'Подписи значений' },
        note: { group: 'Комментарий и источник', field: 'Комментарий' }, source: { group: 'Комментарий и источник', field: 'Источник' },
      }
      const target = targets[section]
      const details = [...document.querySelectorAll<HTMLDetailsElement>('.settings-panel details')]
        .find((item) => item.querySelector(':scope > summary')?.textContent?.trim() === target.group)
      if (!details) return
      details.open = true
      const field = target.field ? [...details.querySelectorAll<HTMLElement>('label, .text-style-editor > summary')].find((item) => item.textContent?.trim().startsWith(target.field!)) : null
      ;(field ?? details).scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }))
  }

  const commitTable = (nextTable: DataTable, nextTypes: Record<string, ColumnType>, label: string, nextConfig = config) => {
    setPast((items) => [...items, { table, types, config, label, time: Date.now() }].slice(-20))
    setFuture([]); setTable(nextTable); setTypes(nextTypes); setConfig(nextConfig)
  }
  const undo = () => {
    const snapshot = past.at(-1); if (!snapshot) return
    setFuture((items) => [...items, { table, types, config, label: snapshot.label, time: Date.now() }])
    setPast((items) => items.slice(0, -1)); setTable(snapshot.table); setTypes(snapshot.types); setConfig(snapshot.config)
  }
  const redo = () => {
    const snapshot = future.at(-1); if (!snapshot) return
    setPast((items) => [...items, { table, types, config, label: snapshot.label, time: Date.now() }].slice(-20))
    setFuture((items) => items.slice(0, -1)); setTable(snapshot.table); setTypes(snapshot.types); setConfig(snapshot.config)
  }
  const reconcileChartConfig = (nextTable: DataTable, nextTypes: Record<string, ColumnType>): ChartConfig => {
    const numeric = nextTable.columns.filter((column) => nextTypes[column] === 'number')
    const yFields = config.yFields.filter((column) => numeric.includes(column))
    const selected = yFields.length ? yFields : numeric.slice(0, 1)
    const xField = nextTable.columns.includes(config.xField) ? config.xField : nextTable.columns[0]
    return {
      ...config,
      xField,
      yField: selected[0] ?? nextTable.columns[0],
      yFields: selected.length ? selected : [nextTable.columns[0]],
      seriesField: nextTable.columns.includes(config.seriesField) ? config.seriesField : '',
      xAxisTitle: nextTable.columns.includes(config.xField) ? config.xAxisTitle : xField,
      yAxisTitle: selected.includes(config.yField) ? config.yAxisTitle : selected[0] ?? nextTable.columns[0],
    }
  }

  const applyTable = async (next: DataTable) => {
    if (!next.columns.length || !next.rows.length) throw new Error('В таблице нет данных')
    processingController.current?.abort()
    const controller = new AbortController()
    processingController.current = controller
    setProcessingProgress(1)
    const normalized = await normalizeInWorker(next, navigator.language || 'ru-RU', setProcessingProgress, controller.signal)
    const nextTypes = inferTypes(normalized)
    const numeric = normalized.columns.find((column) => nextTypes[column] === 'number') ?? normalized.columns[1] ?? normalized.columns[0]
    setTable(normalized); setTypes(nextTypes); setPast([]); setFuture([]); setDesignPast([]); setDesignFuture([]); setHasData(true); setStep('data')
    setConfig((value) => ({ ...value, xField: normalized.columns[0], yField: numeric, yFields: [numeric], seriesField: '', xAxisTitle: normalized.columns[0], yAxisTitle: numeric }))
    setProcessingProgress(100)
  }

  const run = async (task: () => Promise<DataTable>) => {
    const sequence = ++importSequence.current
    processingController.current?.abort()
    setLoading(true); setError('')
    try {
      const next = await task()
      if (sequence !== importSequence.current) return
      await applyTable(next)
    } catch (cause) {
      if (sequence === importSequence.current && !(cause instanceof DOMException && cause.name === 'AbortError')) setError(cause instanceof Error ? cause.message : 'Ошибка импорта')
    } finally {
      if (sequence === importSequence.current) { setLoading(false); processingController.current = null }
    }
  }

  const openFile = async (file: File) => {
    if (file.name.toLowerCase().endsWith('.xlsx')) {
      const sequence = ++importSequence.current
      processingController.current?.abort()
      setLoading(true); setError('')
      try {
        const sheets = await importExcelSheets(file)
        if (sequence !== importSequence.current) return
        const available = sheets.filter(({ table: item }) => item.columns.length && item.rows.length)
        if (!available.length) throw new Error('В книге Excel нет непустых листов')
        if (available.length === 1) await applyTable(available[0].table)
        else setExcelWorkbook({ fileName: file.name, sheets: available })
      } catch (cause) { if (sequence === importSequence.current && !(cause instanceof DOMException && cause.name === 'AbortError')) setError(cause instanceof Error ? cause.message : 'Ошибка чтения Excel') }
      finally { if (sequence === importSequence.current) { setLoading(false); processingController.current = null } }
      return
    }
    run(() => importFile(file))
  }

  const changeType = (column: string, type: ColumnType) => {
    commitTable(convertColumn(table, column, type), { ...types, [column]: type }, `Тип «${column}» → ${type}`)
  }

  const changeName = (oldName: string, newName: string) => {
    const renamed = renameColumn(table, oldName, newName)
    if (renamed === table) return
    const clean = newName.trim()
    const nextTypes = { ...types, [clean]: types[oldName] }; delete nextTypes[oldName]
    const renamesSeries = !config.seriesField && config.yFields.includes(oldName)
    const seriesStyles = renamesSeries && config.seriesStyles[oldName]
      ? Object.fromEntries(Object.entries(config.seriesStyles).map(([name, style]) => [name === oldName ? clean : name, style]))
      : config.seriesStyles
    const elementStyles = renamesSeries
      ? Object.fromEntries(Object.entries(config.elementStyles).map(([key, style]) => [key.startsWith(`${oldName}\u001f`) ? `${clean}${key.slice(oldName.length)}` : key, style]))
      : config.elementStyles
    const seriesOrder = renamesSeries ? config.seriesOrder?.map((name) => name === oldName ? clean : name) : config.seriesOrder
    const intervalGroups = config.intervalGroups?.map((group) => ({ ...group, main: group.main === oldName ? clean : group.main, lower: group.lower === oldName ? clean : group.lower, upper: group.upper === oldName ? clean : group.upper }))
    const nextConfig = { ...config, xField: config.xField === oldName ? clean : config.xField, yField: config.yField === oldName ? clean : config.yField, yFields: config.yFields.map((field) => field === oldName ? clean : field), seriesField: config.seriesField === oldName ? clean : config.seriesField, xAxisTitle: config.xAxisTitle === oldName ? clean : config.xAxisTitle, yAxisTitle: config.yAxisTitle === oldName ? clean : config.yAxisTitle, seriesStyles, elementStyles, seriesOrder, intervalGroups }
    commitTable(renamed, nextTypes, `Столбец «${oldName}» переименован`, nextConfig)
  }

  const chooseChart = (kind: ChartKind) => {
    const plugin = getChartPlugin(kind)
    const supportsDirectLabels = plugin.settings.features.directLabels
    setConfig((value) => {
      axisGridByKind.current[value.kind] = axisGridState(value)
      const savedAxisGrid = axisGridByKind.current[kind] ?? {}
      return {
        ...value,
        kind,
        ...axisGridDefaults(kind),
        ...savedAxisGrid,
        ...(plugin.category === 'bar-horizontal' ? { barOrientation: 'horizontal' as const, categoryAxisInverse: value.categoryAxisInverse ?? true } : isBarChart(kind) ? { barOrientation: 'vertical' as const } : {}),
        ...(!supportsDirectLabels && value.showDirectLabels ? { showDirectLabels: false, showLegend: true } : {}),
      }
    })
    setSelectedSeries(null); setSelectedElement(null); setStep('design')
    requestAnimationFrame(() => window.scrollTo({ top: 0 }))
  }
  const toggleYField = (field: string) => {
    const selected = config.seriesField ? [field] : config.yFields.includes(field) ? config.yFields.filter((item) => item !== field) : [...config.yFields, field]
    if (!selected.length) return
    setConfig({ ...config, yFields: selected, yField: selected[0], yAxisTitle: config.yAxisTitle === config.yField ? selected[0] : config.yAxisTitle })
  }
  const canVisit = (target: EditorStep) => target === 'source' || hasData
  const updateElement = (values: Partial<ChartConfig['elementStyles'][string]>) => selectedElement && setConfig((current) => ({ ...current, elementStyles: { ...current.elementStyles, [selectedElement.key]: { ...current.elementStyles[selectedElement.key], ...values } } }))
  const updateSeries = (values: Partial<ChartConfig['seriesStyles'][string]>) => selectedSeries && setConfig((current) => ({ ...current, seriesStyles: { ...current.seriesStyles, [selectedSeries.name]: { ...current.seriesStyles[selectedSeries.name], ...values } } }))
  const copyElementStyle = () => selectedElement && setCopiedStyle({ kind: 'element', style: structuredClone(config.elementStyles[selectedElement.key] ?? {}) })
  const pasteElementStyle = () => selectedElement && copiedStyle?.kind === 'element' && setConfig((current) => ({ ...current, elementStyles: { ...current.elementStyles, [selectedElement.key]: structuredClone(copiedStyle.style) } }))
  const copySeriesStyle = () => selectedSeries && setCopiedStyle({ kind: 'series', style: structuredClone(config.seriesStyles[selectedSeries.name] ?? {}) })
  const pasteSeriesStyle = () => selectedSeries && copiedStyle?.kind === 'series' && setConfig((current) => ({ ...current, seriesStyles: { ...current.seriesStyles, [selectedSeries.name]: structuredClone(copiedStyle.style) } }))
  const moveSeries = (name: string, targetIndex: number) => setConfig((current) => {
    const names = chartSeries.map((series) => series.name)
    const from = names.indexOf(name)
    if (from < 0) return current
    names.splice(from, 1)
    names.splice(Math.max(0, Math.min(targetIndex, names.length)), 0, name)
    const seriesStyles = { ...current.seriesStyles }
    chartSeries.forEach((series, index) => { seriesStyles[series.name] = { ...seriesStyles[series.name], color: getSeriesColor(current, series.name, index) } })
    return { ...current, seriesOrder: names, seriesStyles }
  })
  const addAnnotation = () => {
    const id = crypto.randomUUID()
    const annotation: ChartAnnotation = { id, x: 110, y: 145, width: 240, fontFamily: config.titleText.fontFamily, fontSize: 14, backgroundColor: 'transparent', borderColor: 'transparent', textStrokeColor: config.canvasBackground ?? '#ffffff', textStrokeWidth: 6, textAlign: 'left', html: 'Текст аннотации', fragments: [{ id: crypto.randomUUID(), text: 'Текст аннотации', color: config.titleText.color, bold: false, italic: false }] }
    setConfig((current) => ({ ...current, annotations: [...current.annotations, annotation] })); setSelectedAnnotation(id); setSelectedDecoration(null); setSelectedElement(null)
  }
  const duplicateAnnotation = (source: ChartAnnotation) => {
    const id = crypto.randomUUID(), canvasWidth = config.canvasWidth ?? 1000, canvasHeight = config.canvasHeight ?? 563
    const annotation: ChartAnnotation = { ...structuredClone(source), id, x: Math.min(Math.max(0, canvasWidth - source.width), source.x + 20), y: Math.min(Math.max(0, canvasHeight - 50), source.y + 20), fragments: source.fragments.map((fragment) => ({ ...fragment, id: crypto.randomUUID() })) }
    setConfig((current) => ({ ...current, annotations: [...current.annotations, annotation] }))
    setSelectedAnnotation(id)
  }
  const addDecoration = (type: ChartDecoration['type']) => {
    const id = crypto.randomUUID(), canvasWidth = config.canvasWidth ?? 1000, canvasHeight = config.canvasHeight ?? 563
    const common = { id, type, x: Math.round(canvasWidth * .3), y: Math.round(canvasHeight * .35), color: type === 'area' ? '#6956e8' : '#4f4b59', opacity: type === 'area' ? .16 : .9, lineWidth: type === 'area' ? 1 : 2, lineType: 'solid' as const, endArrow: type === 'arrow', arrowPlacement: type === 'arrow' ? 'end' as const : 'none' as const, arrowHead: 'filled' as const }
    const decoration: ChartDecoration = type === 'area' ? { ...common, width: Math.round(canvasWidth * .3), height: Math.round(canvasHeight * .22), fitToPlot: true, fitToPlotWidth: false }
      : type === 'horizontal-line' ? { ...common, width: Math.round(canvasWidth * .42), height: 0 }
      : type === 'vertical-line' ? { ...common, width: 0, height: Math.round(canvasHeight * .38) }
      : type === 'curved-line' ? { ...common, width: Math.round(canvasWidth * .18), height: -Math.round(canvasHeight * .12), curvature: .28 }
      : { ...common, width: Math.round(canvasWidth * .15), height: -Math.round(canvasHeight * .12) }
    setConfig((current) => ({ ...current, decorations: [...(current.decorations ?? []), decoration] }))
    setSelectedDecoration(id); setSelectedAnnotation(null); setSelectedElement(null); setSelectedSeries(null)
  }
  const updateDecoration = (changed: ChartDecoration) => {
    setConfig((current) => ({ ...current, decorations: (current.decorations ?? []).map((item) => item.id === changed.id ? changed : item) }))
    setSelectedDecoration(changed.id); setSelectedAnnotation(null); setSelectedElement(null); setSelectedSeries(null)
  }
  const decorationLabels: Record<ChartDecoration['type'], string> = { area: 'Цветная область', line: 'Прямая линия', 'horizontal-line': 'Горизонтальная линия', 'vertical-line': 'Вертикальная линия', arrow: 'Прямая линия', 'curved-line': 'Плавная линия' }
  const activeDecoration = config.decorations?.find((decoration) => decoration.id === selectedDecoration)
  const pickerSwatches = config.palette?.length ? config.palette : [config.color]
  const zoomPercent = `${Math.round(canvasZoom * 100)}%`

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/"><span className="brand-mark">D</span><span>DataCanvas</span></Link>
        <div className="project-name"><span className="status-dot" />{hasData ? table.name : 'Новый проект'}<small>{hasData ? `${table.rows.length.toLocaleString('ru-RU')} строк` : 'не сохранён'}</small></div>
        <div className="export-actions">{step === 'design' && <><button className="button subtle" onClick={() => chartRef.current?.exportSvg()}>SVG</button><button className="button primary" onClick={() => chartRef.current?.exportPng()}>Скачать PNG</button></>}<Link className="close-editor" to="/projects">×</Link></div>
      </header>

      <nav className="stepper">{steps.map((item, index) => <button key={item.id} disabled={!canVisit(item.id)} className={`${step === item.id ? 'active' : ''} ${index < currentIndex ? 'done' : ''}`} onClick={() => canVisit(item.id) && setStep(item.id)}><span>{index < currentIndex ? '✓' : item.number}</span><b>{item.label}</b></button>)}</nav>

      {step === 'source' && <main className="source-step">
        <div className="step-heading"><span className="eyebrow">Шаг 1 из 4</span><h1>Загрузите данные</h1><p>Данные обрабатываются локально в вашем браузере и никуда не отправляются.</p></div>
        <div className="source-grid">
          <label className="source-card upload-card"><input type="file" accept=".csv,.xlsx,.parquet" onChange={(event) => { const file = event.target.files?.[0]; if (file) openFile(file); event.target.value = '' }} /><span className="source-icon">↑</span><strong>{loading ? 'Читаем данные…' : 'Загрузить файл'}</strong><p>Перетащите сюда или выберите на компьютере</p><div><b>CSV</b><b>XLSX</b><b>PARQUET</b></div></label>
          <div className="source-card sheet-card"><span className="source-icon sheets">▦</span><strong>Google Sheets</strong><p>Вставьте публичную ссылку на таблицу</p><input className="text-input" value={sheetUrl} onChange={(event) => setSheetUrl(event.target.value)} placeholder="https://docs.google.com/spreadsheets/…"/><button className="button full" disabled={!sheetUrl || loading} onClick={() => run(() => importGoogleSheet(sheetUrl))}>Подключить таблицу</button></div>
        </div>
        {error && <p className="source-error">⚠ {error}</p>}
        {loading && <div className="processing-progress"><div><span>Обработка данных</span><b>{processingProgress}%</b></div><progress max="100" value={processingProgress}/><button onClick={() => processingController.current?.abort()}>Отменить</button></div>}
        <div className="demo-links"><button className="demo-link" disabled={loading} onClick={() => run(() => Promise.resolve(demoTable))}>Демо временного ряда →</button><button className="demo-link" disabled={loading} onClick={() => run(() => Promise.resolve(categoricalDemoTable))}>Топ стран →</button></div>
      </main>}

      {step === 'data' && <main className="data-step">
        <div className="data-step-header"><div><span className="eyebrow">Шаг 2 из 4</span><h1>Проверьте данные</h1><p>Проверьте типы, переименуйте столбцы и исправьте отмеченные проблемы.</p></div><div className="quality-legend"><span><i className="green"/>Всё хорошо</span><span><i className="yellow"/>Нужно проверить</span><span><i className="red"/>Критично</span></div></div>
        <div className="history-toolbar"><div><button disabled={!past.length} onClick={undo} title="Отменить">↶</button><button disabled={!future.length} onClick={redo} title="Повторить">↷</button></div><button className="transform-open" onClick={() => setShowTransformDialog(true)}>∿ Настроить временной ряд</button><details><summary>История изменений <b>{past.length}</b></summary><div>{past.length ? [...past].reverse().map((entry, index) => <div className="history-entry" key={`${entry.time}-${index}`}><span>{entry.label}</span><time>{new Date(entry.time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</time></div>) : <p>Изменений пока нет</p>}</div></details><span>{past.at(-1)?.label ?? 'Исходные данные'}</span></div>
        <DataReview table={table} types={types} issues={issues} onRename={changeName} onType={changeType} onConfigureDate={setDateFormatColumn} onEditCell={(row, column, value) => commitTable(editCell(table, row, column, value, types[column]), types, `Изменена ячейка ${column}, строка ${row + 1}`)} onRemoveDuplicates={() => commitTable(removeDuplicateRows(table), types, 'Удалены точные дубликаты')} onDeleteRows={(indices) => commitTable(removeRows(table, indices), types, `Удалено строк: ${indices.length}`)}/>
        <div className="step-footer"><button className="button" onClick={() => setStep('source')}>← Другой источник</button><div><span>{issues.filter((item) => item.severity === 'critical').length ? 'Есть критические проблемы — можно продолжить, но проверьте данные' : 'Данные готовы к визуализации'}</span><button className="button primary" onClick={() => setStep('chart')}>Выбрать график →</button></div></div>
      </main>}
      {dateFormatColumn && <DateFormatDialog table={table} column={dateFormatColumn} onClose={() => setDateFormatColumn(null)} onApply={(next) => { commitTable(next, { ...types, [dateFormatColumn]: 'date' }, `Настроен формат «${dateFormatColumn}»`); setDateFormatColumn(null) }}/>} 
      {excelWorkbook && <ExcelSheetDialog fileName={excelWorkbook.fileName} sheets={excelWorkbook.sheets} onClose={() => setExcelWorkbook(null)} onSelect={(selected) => { setExcelWorkbook(null); run(() => Promise.resolve(selected)) }}/>} 
      {showTransformDialog && <DataTransformDialog table={table} types={types} onClose={() => setShowTransformDialog(false)} onApply={(next, label) => { const nextTypes = inferTypes(next); commitTable(next, nextTypes, label, reconcileChartConfig(next, nextTypes)); setShowTransformDialog(false) }}/>} 

      {(step === 'chart' || step === 'design') && <main className={`chart-workspace step-${step}`}>
        {step === 'chart' && <aside className="chart-picker">
          <div className="panel-title"><span className="eyebrow">Шаг 3 из 4</span><h2>Тип графика</h2><p>Выберите способ показать данные</p></div>
          <section className="chart-data-section"><div><strong>Данные графика</strong><small>Что будет показано</small></div><label>Период / ось X<select value={config.xField} onChange={(event) => { const xField = event.target.value; setConfig({ ...config, xField, xAxisTitle: config.xAxisTitle === config.xField ? xField : config.xAxisTitle }) }}>{table.columns.map((column) => <option key={column}>{column}</option>)}</select></label><label>Показатели<div className="y-field-list">{(numericColumns.length ? numericColumns : table.columns).map((column) => <button type="button" className={config.yFields.includes(column) ? 'active' : ''} onClick={() => toggleYField(column)} key={column}><span>{config.yFields.includes(column) ? '✓' : ''}</span>{column}</button>)}</div></label>{chartPlugin.settings.features.dataPreparation && <details className="chart-data-advanced"><summary>Подготовка рядов</summary><div><label>Разделить на ряды<select value={config.seriesField} onChange={(event) => setConfig({ ...config, seriesField: event.target.value, seriesOrder: undefined, ...(event.target.value ? { yFields: [config.yFields[0]], yField: config.yFields[0] } : {}) })}><option value="">Не разделять</option>{table.columns.filter((column) => column !== config.xField && !config.yFields.includes(column)).map((column) => <option value={column} key={column}>{column}</option>)}</select></label><label>Повторяющиеся значения X<select value={config.aggregation} onChange={(event) => setConfig({ ...config, aggregation: event.target.value as ChartConfig['aggregation'] })}><option value="none">Брать первое значение</option><option value="sum">Сумма</option><option value="average">Среднее</option><option value="min">Минимум</option><option value="max">Максимум</option><option value="count">Количество</option></select></label>{chartPlugin.settings.features.normalizedStack ? <div className="normalized-stack-note"><strong>Каждый столбец — 100%</strong><small>Значения автоматически пересчитываются в доли внутри категории.</small></div> : <label>Представление значений<select value={config.valueMode} onChange={(event) => setConfig({ ...config, valueMode: event.target.value as ChartConfig['valueMode'] })}><option value="absolute">Исходные значения</option><option value="percent">Доли по категории, %</option></select></label>}{(config.kind === 'line' || config.kind === 'spline') && <label>Пропуски в рядах<select value={config.missingMode} onChange={(event) => setConfig({ ...config, missingMode: event.target.value as ChartConfig['missingMode'] })}><option value="gap">Оставлять разрывы</option><option value="zero">Заменять нулём</option><option value="connect">Соединять соседние значения</option></select></label>}</div></details>}</section>
          {categories.map((category) => <section className="chart-category" key={category.id}><div><strong>{category.label}</strong><small>{category.hint}</small></div><div className="chart-choice-grid">{chartRegistry.filter((plugin) => plugin.category === category.id).map((plugin) => <button key={plugin.id} className={config.kind === plugin.id ? 'active' : ''} onClick={() => chooseChart(plugin.id)}><span className={`chart-icon ${plugin.id}`}/><b>{plugin.label}</b></button>)}</div></section>)}
        </aside>}

        <section className="stage"><div className="stage-toolbar"><span>{step === 'chart' ? 'Предпросмотр графика' : `${config.canvasWidth ?? 1000} × ${config.canvasHeight ?? 563} px`}</span></div><div className="canvas-floating-menu" aria-label="Управление холстом"><button type="button" disabled={canvasZoom <= .5} onClick={() => changeCanvasZoom(canvasZoom - .1)} title="Уменьшить масштаб" aria-label="Уменьшить масштаб" data-tip="Уменьшить"><Minus size={14}/></button><span className="canvas-zoom-value">{zoomPercent}</span><button type="button" disabled={canvasZoom >= 2} onClick={() => changeCanvasZoom(canvasZoom + .1)} title="Увеличить масштаб" aria-label="Увеличить масштаб" data-tip="Увеличить"><Plus size={14}/></button><span className="canvas-action-divider"/><button type="button" disabled={!designPast.length} onClick={undoDesign} title="Отменить (Ctrl/⌘ Z)" aria-label="Отменить" data-tip="Отменить"><RotateCcw size={13}/></button><button type="button" disabled={!designFuture.length} onClick={redoDesign} title="Повторить (Ctrl/⌘ Shift Z)" aria-label="Повторить" data-tip="Повторить"><RotateCw size={13}/></button><button type="button" className="clear-selection-button" onClick={clearCanvasSelection} title="Снять выделение" aria-label="Снять выделение" data-tip="Снять выделение"><CircleX size={13}/></button></div><div className="paper-frame"><div className="paper canvas-paper"><ChartCanvas ref={chartRef} table={table} config={config} viewZoom={canvasZoom} selectedSettingsSection={selectedSettingsSection} onSettingsFocus={focusSettings} onClearSettingsFocus={() => setSelectedSettingsSection(null)} onRichTextChange={(field, html, text) => setConfig((current) => ({ ...current, [field]: text, [`${field}Html`]: html }))} selectedSeriesName={selectedSeries?.name} selectedElementKey={selectedElement?.key} selectedElementTarget={selectedElement?.target} selectedAnnotationId={selectedAnnotation} selectedDecorationId={selectedDecoration} onDecorationChange={updateDecoration} onSeriesSelect={(selection) => { setSelectedSeries(selection); setSelectedElement(null); setSelectedAnnotation(null); setSelectedDecoration(null) }} onSelect={(selection) => { setSelectedElement(selection); setSelectedAnnotation(null); setSelectedDecoration(null) }} onAnnotationSelect={(id) => { setSelectedAnnotation(id); setSelectedSettingsSection(null); setSelectedDecoration(null); setSelectedElement(null); setSelectedSeries(null) }} onAnnotationChange={(changed) => setConfig((current) => ({ ...current, annotations: current.annotations.map((item) => item.id === changed.id ? changed : item) }))} onAnnotationDuplicate={duplicateAnnotation} onAnnotationDelete={(id) => { setConfig((current) => ({ ...current, annotations: current.annotations.filter((item) => item.id !== id) })); setSelectedAnnotation(null) }}/></div></div><p className="stage-hint">Один клик выбирает ряд · повторный клик выбирает отдельный элемент</p></section>

        {step === 'design' && <aside className="settings-panel"><div className="panel-title"><span className="eyebrow">Шаг 4 из 4</span><h2>Оформление</h2><p>Настройте график и выбранные элементы</p></div><SettingsQuickNav features={chartPlugin.settings.features} showSeries={chartSeries.length > 1}/><section className="form-section visual-settings" onToggle={(event) => { const opened = event.target as HTMLDetailsElement; if (opened.tagName !== 'DETAILS' || !opened.open || opened.parentElement !== event.currentTarget) return; event.currentTarget.querySelectorAll<HTMLDetailsElement>(':scope > details[open]').forEach((details) => { if (details !== opened) details.open = false }) }}>
          <CanvasSettings config={config} onChange={setConfig}/>
          {chartPlugin.settings.sections.includes('axes') && <AxisScaleSettings config={config} xKind={types[config.xField] === 'date' ? 'date' : types[config.xField] === 'number' ? 'number' : 'other'} frequency={table.timeProfiles?.[config.xField]?.frequency} onChange={setConfig}/>} 
          <NumberFormatSettings config={config} onChange={setConfig}/>
          {activeDecoration && <section className="element-editor decoration-editor"><header><div><span>Выбран визуальный акцент</span><strong>{decorationLabels[activeDecoration.type]}</strong><small>Перетащите объект на холсте или задайте точные координаты</small></div><button onClick={() => setSelectedDecoration(null)}>×</button></header><div>
            <label>Цвет<ColorControl value={activeDecoration.color} swatches={pickerSwatches} onChange={(color) => updateDecoration({ ...activeDecoration, color })}/></label>
            <div className="fred-grid"><label>X, px<NumberInput disabled={activeDecoration.type === 'area' && activeDecoration.fitToPlotWidth} min="0" max={config.canvasWidth ?? 1000} value={Math.round(activeDecoration.x)} onValueChange={(x) => updateDecoration({ ...activeDecoration, x })}/></label><label>Y, px<NumberInput disabled={activeDecoration.type === 'area' && activeDecoration.fitToPlot} min="0" max={config.canvasHeight ?? 563} value={Math.round(activeDecoration.y)} onValueChange={(y) => updateDecoration({ ...activeDecoration, y })}/></label></div>
            {activeDecoration.type === 'area' && <label className="check"><input type="checkbox" checked={activeDecoration.fitToPlot ?? false} onChange={(event) => updateDecoration({ ...activeDecoration, fitToPlot: event.target.checked })}/>По высоте области графика</label>}
            {activeDecoration.type === 'area' && <label className="check"><input type="checkbox" checked={activeDecoration.fitToPlotWidth ?? false} onChange={(event) => updateDecoration({ ...activeDecoration, fitToPlotWidth: event.target.checked })}/>По ширине области графика</label>}
            {activeDecoration.type === 'area' && <div className="fred-grid"><label>Ширина, px<NumberInput disabled={activeDecoration.fitToPlotWidth} min="10" max="1000" value={Math.round(activeDecoration.width)} onValueChange={(width) => updateDecoration({ ...activeDecoration, width })}/></label><label>Высота, px<NumberInput disabled={activeDecoration.fitToPlot} min="10" max="1000" value={Math.round(activeDecoration.height)} onValueChange={(height) => updateDecoration({ ...activeDecoration, height })}/></label></div>}
            {activeDecoration.type === 'horizontal-line' && <label>Длина, px<NumberInput min="10" max="1000" value={Math.round(activeDecoration.width)} onValueChange={(width) => updateDecoration({ ...activeDecoration, width })}/></label>}
            {activeDecoration.type === 'vertical-line' && <label>Длина, px<NumberInput min="10" max="1000" value={Math.round(activeDecoration.height)} onValueChange={(height) => updateDecoration({ ...activeDecoration, height })}/></label>}
            {(activeDecoration.type === 'line' || activeDecoration.type === 'arrow' || activeDecoration.type === 'curved-line') && <div className="fred-grid"><label>Смещение X<NumberInput min="-1000" max="1000" value={Math.round(activeDecoration.width)} onValueChange={(width) => updateDecoration({ ...activeDecoration, width })}/></label><label>Смещение Y<NumberInput min="-1000" max="1000" value={Math.round(activeDecoration.height)} onValueChange={(height) => updateDecoration({ ...activeDecoration, height })}/></label></div>}
            {activeDecoration.type === 'curved-line' && <label>Изгиб линии<NumberInput min="-1" max="1" step="0.05" value={activeDecoration.curvature ?? .28} onValueChange={(curvature) => updateDecoration({ ...activeDecoration, curvature })}/></label>}
            <label>Прозрачность<NumberInput min="0.05" max="1" step="0.05" value={activeDecoration.opacity} onValueChange={(opacity) => updateDecoration({ ...activeDecoration, opacity })}/></label>
            <label>{activeDecoration.type === 'area' ? 'Толщина границы, px' : 'Толщина, px'}<NumberInput min="0.5" max="12" step="0.5" value={activeDecoration.lineWidth} onValueChange={(lineWidth) => updateDecoration({ ...activeDecoration, lineWidth })}/></label>
            <label>Тип линии<select value={activeDecoration.lineType} onChange={(event) => updateDecoration({ ...activeDecoration, lineType: event.target.value as ChartDecoration['lineType'] })}><option value="solid">Сплошная</option><option value="dashed">Пунктирная</option><option value="dotted">Точечная</option></select></label>
            {activeDecoration.type !== 'area' && <label>Наконечник<select value={activeDecoration.arrowPlacement ?? ((activeDecoration.endArrow || activeDecoration.type === 'arrow') ? 'end' : 'none')} onChange={(event) => { const arrowPlacement = event.target.value as NonNullable<ChartDecoration['arrowPlacement']>; updateDecoration({ ...activeDecoration, arrowPlacement, endArrow: arrowPlacement !== 'none' }) }}><option value="none">Без наконечника</option><option value="start">В начале</option><option value="end">В конце</option><option value="both">С двух сторон</option></select></label>}
            {activeDecoration.type !== 'area' && (activeDecoration.arrowPlacement ?? ((activeDecoration.endArrow || activeDecoration.type === 'arrow') ? 'end' : 'none')) !== 'none' && <label>Вид наконечника<select value={activeDecoration.arrowHead ?? 'filled'} onChange={(event) => updateDecoration({ ...activeDecoration, arrowHead: event.target.value as NonNullable<ChartDecoration['arrowHead']> })}><option value="open">Открытая стрелка</option><option value="filled">Заполненная стрелка</option><option value="circle">Круг</option><option value="bar">Поперечная засечка</option></select></label>}
            <button className="delete-decoration" onClick={() => { setConfig((current) => ({ ...current, decorations: (current.decorations ?? []).filter((item) => item.id !== activeDecoration.id) })); setSelectedDecoration(null) }}>Удалить объект</button>
          </div></section>}
          {chartPlugin.settings.sections.includes('series') && <>
          {selectedElement?.target === "value-label" && <ValueLabelSelectionControls config={config} element={selectedElement} canPaste={copiedStyle?.kind === 'element'} onCopy={copyElementStyle} onPaste={pasteElementStyle} onChange={updateElement} onClose={() => setSelectedElement(null)}/>}
          {selectedElement && selectedElement.target !== "value-label" && <section className="element-editor"><header><div><span>Выбран элемент</span><strong>{selectedElement.category}</strong><small>{selectedElement.seriesName} · {selectedElement.value}</small></div><button onClick={() => setSelectedElement(null)}>×</button></header><div><label>Цвет элемента<ColorControl value={config.elementStyles[selectedElement.key]?.color ?? config.seriesStyles[selectedElement.seriesName]?.color ?? selectedSeries?.color ?? config.color} swatches={pickerSwatches} onChange={(color) => updateElement({ color })}/></label>{config.kind === 'line' && <><div className="element-note">Настройки применяются к участку линии, ведущему к выбранной точке.</div><label>Толщина участка, px<NumberInput min="0.5" max="12" step="0.5" value={config.elementStyles[selectedElement.key]?.lineWidth ?? config.seriesStyles[selectedElement.seriesName]?.lineWidth ?? 2} onValueChange={(value) => updateElement({ lineWidth: value })}/></label><label>Тип участка<select value={config.elementStyles[selectedElement.key]?.lineType ?? config.seriesStyles[selectedElement.seriesName]?.lineType ?? 'solid'} onChange={(event) => updateElement({ lineType: event.target.value as 'solid' | 'dashed' | 'dotted' })}><option value="solid">Сплошной</option><option value="dashed">Пунктирный</option><option value="dotted">Точечный</option></select></label></>}{(isLineLikeChart(config.kind) || config.kind === 'scatter' || config.kind === 'bubble') && <MarkerSettings individual value={config.elementStyles[selectedElement.key] ?? {}} lineColor={config.elementStyles[selectedElement.key]?.color ?? config.seriesStyles[selectedElement.seriesName]?.color ?? selectedSeries?.color ?? config.color} onChange={updateElement}/>}<label className="check"><input type="checkbox" checked={config.elementStyles[selectedElement.key]?.showLabel ?? false} onChange={(event) => updateElement({ showLabel: event.target.checked })}/>Показать значение только здесь</label><label>Собственная подпись<input className="text-input" value={config.elementStyles[selectedElement.key]?.label ?? ''} onChange={(event) => updateElement({ label: event.target.value, showLabel: true })} placeholder={selectedElement.value}/></label><StyleTransferActions canPaste={copiedStyle?.kind === "element"} onCopy={copyElementStyle} onPaste={pasteElementStyle}/><button className="reset-element" onClick={() => setConfig((current) => { const elementStyles = { ...current.elementStyles }; delete elementStyles[selectedElement.key]; return { ...current, elementStyles } })}>Сбросить настройки элемента</button></div></section>}
          {selectedSeries && !selectedElement && <section className="element-editor series-editor"><header><div><span>Выбран ряд</span><strong>{selectedSeries.name}</strong><small>Повторно нажмите на точку или столбец для выбора элемента</small></div><button onClick={() => setSelectedSeries(null)}>×</button></header><div><label>Цвет всего ряда<ColorControl value={config.seriesStyles[selectedSeries.name]?.color ?? selectedSeries.color} swatches={pickerSwatches} onChange={(color) => updateSeries({ color })}/></label>{isLineLikeChart(config.kind) && <><label>Толщина линии, px<NumberInput min="0.5" max="12" step="0.5" value={config.seriesStyles[selectedSeries.name]?.lineWidth ?? 2} onValueChange={(value) => updateSeries({ lineWidth: value })}/></label><label>Тип линии<select value={config.seriesStyles[selectedSeries.name]?.lineType ?? 'solid'} onChange={(event) => updateSeries({ lineType: event.target.value as 'solid' | 'dashed' | 'dotted' })}><option value="solid">Сплошная</option><option value="dashed">Пунктирная</option><option value="dotted">Точечная</option></select></label></>}{(isLineLikeChart(config.kind) || config.kind === 'scatter' || config.kind === 'bubble') && <MarkerSettings value={config.seriesStyles[selectedSeries.name] ?? {}} lineColor={config.seriesStyles[selectedSeries.name]?.color ?? selectedSeries.color} onChange={updateSeries}/>}<StyleTransferActions canPaste={copiedStyle?.kind === "series"} onCopy={copySeriesStyle} onPaste={pasteSeriesStyle}/><button className="reset-element" onClick={() => { setConfig((current) => { const seriesStyles = { ...current.seriesStyles }; delete seriesStyles[selectedSeries.name]; return { ...current, seriesStyles } }); setSelectedSeries(null) }}>Вернуть настройки палитры</button></div></section>}
          {chartSeries.length > 1 && <details className="settings-group series-settings" open><summary>Ряды данных</summary><div><p className="series-order-hint">Выше в списке — ближе к переднему плану. Перетаскивайте ряды или используйте стрелки.</p><div className="series-style-list ordered-series-list">{chartSeries.map((series, index) => { const color = getSeriesColor(config, series.name, index); return <div className={selectedSeries?.name === series.name ? 'active' : ''} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', series.name) }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }} onDrop={(event) => { event.preventDefault(); const name = event.dataTransfer.getData('text/plain'); if (name) moveSeries(name, index) }} key={series.name}><span className="series-drag" title="Перетащить">⠿</span><button className="series-name-button" onClick={() => { setSelectedSeries({ name: series.name, color }); setSelectedElement(null); setSelectedAnnotation(null) }}><i style={{ background: color }}/><span>{series.name}</span><small>{index === 0 ? 'Передний план' : index === chartSeries.length - 1 ? 'Задний план' : `Слой ${index + 1}`}</small></button><div className="series-order-buttons"><button disabled={index === 0} onClick={() => moveSeries(series.name, index - 1)} title="Переместить вперёд">↑</button><button disabled={index === chartSeries.length - 1} onClick={() => moveSeries(series.name, index + 1)} title="Переместить назад">↓</button></div><ColorControl compact title={`Цвет ряда ${series.name}`} value={color} swatches={pickerSwatches} onChange={(nextColor) => setConfig((current) => ({ ...current, seriesStyles: { ...current.seriesStyles, [series.name]: { ...current.seriesStyles[series.name], color: nextColor } } }))}/></div> })}</div></div></details>}
          </>}
          {chartPlugin.settings.sections.includes('annotations') && <div className="annotation-add-wrap"><div className="annotation-tools"><button onClick={addAnnotation}>＋ Текст</button><button onClick={() => addDecoration('area')}>▧ Фон</button><button onClick={() => addDecoration('line')}>╱ Прямая</button><button onClick={() => addDecoration('horizontal-line')}>— Горизонталь</button><button onClick={() => addDecoration('vertical-line')}>│ Вертикаль</button><button onClick={() => addDecoration('curved-line')}>⌒ Плавная</button></div><small>Текст, фоновые области и линии с настраиваемыми наконечниками</small>{!!config.decorations?.length && <div className="decoration-list">{config.decorations.map((decoration, index) => <button type="button" className={selectedDecoration === decoration.id ? 'active' : ''} key={decoration.id} onClick={() => { setSelectedDecoration(decoration.id); setSelectedAnnotation(null); setSelectedElement(null); setSelectedSeries(null) }}><i style={{ background: decoration.color }}/><span>{decorationLabels[decoration.type]} {index + 1}</span></button>)}</div>}</div>}
          {chartPlugin.settings.sections.includes('series') && <>
          {chartSeries.length <= 1 && <details className="settings-group" open><summary>Основное</summary><div><label>Цвет ряда<ColorControl value={config.seriesStyles[chartSeries[0]?.name ?? config.yField]?.color ?? config.color} swatches={pickerSwatches} onChange={(color) => setConfig((current) => ({ ...current, color, seriesStyles: { ...current.seriesStyles, [chartSeries[0]?.name ?? current.yField]: { ...current.seriesStyles[chartSeries[0]?.name ?? current.yField], color } } }))}/></label>{(isLineLikeChart(config.kind) || config.kind === 'scatter' || config.kind === 'bubble') && <MarkerSettings value={config.seriesStyles[chartSeries[0]?.name ?? config.yField] ?? {}} lineColor={config.seriesStyles[chartSeries[0]?.name ?? config.yField]?.color ?? config.color} onChange={(values) => setConfig((current) => ({ ...current, seriesStyles: { ...current.seriesStyles, [chartSeries[0]?.name ?? config.yField]: { ...current.seriesStyles[chartSeries[0]?.name ?? config.yField], ...values } } }))}/>}</div></details>}
          </>}
          {isBarChart(config.kind) && selectedElement?.target !== "value-label" && <BarSelectionControls config={config} element={selectedElement} series={selectedSeries} onElementChange={updateElement} onSeriesChange={updateSeries}/>} 
          {chartPlugin.settings.features.scatterLayout && <ScatterSettings config={config} columns={table.columns} numericColumns={numericColumns} table={table} onChange={setConfig}/>} 
          {chartPlugin.settings.features.lineVariant && <LineVariantSettings config={config} numericColumns={numericColumns} onChange={setConfig}/>} 
          <ChartSettingsPanel config={config} plugin={chartPlugin} seriesNames={chartSeries.map((series) => series.name)} onChange={setConfig}/>
        </section><div className="settings-footer"><button className="button" onClick={() => setStep('chart')}>← Тип графика</button><button className="button" onClick={() => setStep('data')}>Данные</button></div></aside>}
      </main>}
    </div>
  )
}

export default App
