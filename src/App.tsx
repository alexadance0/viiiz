import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import './components/SeriesOrder.css'
import type { ChartCanvasHandle, ChartSettingsSection } from './components/ChartCanvas'
import { NumberInput } from './components/NumberInput'
import { StyleTransferActions } from './components/StyleTransferActions'
import { prepareChartData } from './core/chartData'
import { slopePositionKey } from './core/chartScale'
import { convertColumn, editCell, inferTypes, profileData, renameColumn } from './core/dataProfile'
import { categoricalDemoTable, demoTable, distributionDemoTable, dumbbellDemoTable, entrepreneurshipDifficultiesDemoTable } from './core/demoData'
import { normalizeInWorker } from './core/workerClient'
import { removeColumns, removeDuplicateRows, removeRows, transposeTable } from './core/dataQuality'
import type { ChartAnnotation, ChartConfig, ChartDecoration, ChartElementSelection, ChartKind, ChartPlugin, ChartSeriesSelection, ColumnType, DataTable } from './core/types'
import { distributionVisualDefaults, isBarChart, isDistributionChart as isDistributionKind, isLineLikeChart, isLollipopChart } from './core/chartKinds'
import { createDefaultChartConfig } from './entities/chart/model/defaultChartConfig'
import { useEditorHistory } from './features/editor/model/useEditorHistory'
import { EditorHeader } from './features/editor/ui/EditorHeader'
import { EditorStepper, type EditorStep } from './features/editor/ui/EditorStepper'
import { CircleX, FileUp, History, Minus, Plus, RotateCcw, RotateCw, Sheet, ShieldCheck, SlidersHorizontal } from 'lucide-react'

const loadChartCanvas = () => import('./components/ChartCanvas')
const loadChartTypePicker = () => import('./features/editor/ui/ChartTypePicker')
const preloadChartEditor = () => Promise.all([
  loadChartCanvas(),
  loadChartTypePicker(),
  import('./components/echarts/loadEchartsForKind').then(({ preloadAllEcharts }) => preloadAllEcharts()),
])
const ChartCanvas = lazy(() => loadChartCanvas().then(({ ChartCanvas }) => ({ default: ChartCanvas })))
const DataReview = lazy(() => import('./components/DataReview').then(({ DataReview }) => ({ default: DataReview })))
const ChartTypePicker = lazy(() => loadChartTypePicker().then(({ ChartTypePicker }) => ({ default: ChartTypePicker })))
const DateFormatDialog = lazy(() => import('./components/DateFormatDialog').then(({ DateFormatDialog }) => ({ default: DateFormatDialog })))
const DataTransformDialog = lazy(() => import('./components/DataTransformDialog').then(({ DataTransformDialog }) => ({ default: DataTransformDialog })))
const ExcelSheetDialog = lazy(() => import('./components/ExcelSheetDialog').then(({ ExcelSheetDialog }) => ({ default: ExcelSheetDialog })))
const MarkerSettings = lazy(() => import('./components/MarkerSettings').then(({ MarkerSettings }) => ({ default: MarkerSettings })))
const SettingsQuickNav = lazy(() => import('./components/SettingsQuickNav').then(({ SettingsQuickNav }) => ({ default: SettingsQuickNav })))
const SettingsCheckbox = lazy(() => import('./components/SettingsCheckbox').then(({ SettingsCheckbox }) => ({ default: SettingsCheckbox })))
const BarSelectionControls = lazy(() => import('./components/BarSelectionControls').then(({ BarSelectionControls }) => ({ default: BarSelectionControls })))
const ValueLabelSelectionControls = lazy(() => import('./components/ValueLabelSelectionControls').then(({ ValueLabelSelectionControls }) => ({ default: ValueLabelSelectionControls })))
const TextStyleEditor = lazy(() => import('./components/TextStyleEditor').then(({ TextStyleEditor }) => ({ default: TextStyleEditor })))
const ColorControl = lazy(() => import('./components/PickerControls').then(({ ColorControl }) => ({ default: ColorControl })))
const ChartSettingsPanel = lazy(() => import('./components/ChartSettingsPanel').then(({ ChartSettingsPanel }) => ({ default: ChartSettingsPanel })))
const CanvasSettings = lazy(() => import('./components/CanvasSettings').then(({ CanvasSettings }) => ({ default: CanvasSettings })))
const NumberFormatSettings = lazy(() => import('./components/NumberFormatSettings').then(({ NumberFormatSettings }) => ({ default: NumberFormatSettings })))
const ScatterSettings = lazy(() => import('./components/ScatterSettings').then(({ ScatterSettings }) => ({ default: ScatterSettings })))
const BubbleSizeLegendSettings = lazy(() => import('./components/BubbleSizeLegendSettings').then(({ BubbleSizeLegendSettings }) => ({ default: BubbleSizeLegendSettings })))
const HeatmapSettings = lazy(() => import('./components/HeatmapSettings').then(({ HeatmapSettings }) => ({ default: HeatmapSettings })))
const TreemapSettings = lazy(() => import('./components/TreemapSettings').then(({ TreemapSettings }) => ({ default: TreemapSettings })))
const LollipopSettings = lazy(() => import('./components/LollipopSettings').then(({ LollipopSettings }) => ({ default: LollipopSettings })))
const DistributionSettings = lazy(() => import('./components/DistributionSettings').then(({ DistributionSettings }) => ({ default: DistributionSettings })))
const LineVariantSettings = lazy(() => import('./components/LineVariantSettings').then(({ LineVariantSettings }) => ({ default: LineVariantSettings })))

interface HistorySnapshot { table: DataTable; types: Record<string, ColumnType>; config: ChartConfig; label: string; time: number }
type CopiedStyle = { kind: 'series'; style: ChartConfig['seriesStyles'][string] } | { kind: 'element'; style: ChartConfig['elementStyles'][string] }
type ChartModeState = Pick<ChartConfig, 'showXAxisTitle' | 'showYAxisTitle' | 'showXAxisLine' | 'showYAxisLine' | 'showXTicks' | 'showYTicks' | 'showHorizontalGrid' | 'showVerticalGrid' | 'showValues' | 'showLegend' | 'showDirectLabels'>
const chartModeKeys = ['showXAxisTitle', 'showYAxisTitle', 'showXAxisLine', 'showYAxisLine', 'showXTicks', 'showYTicks', 'showHorizontalGrid', 'showVerticalGrid', 'showValues', 'showLegend', 'showDirectLabels'] as const
export const chartModeState = (config: ChartConfig) => Object.fromEntries(chartModeKeys.map((key) => [key, config[key]])) as ChartModeState
const axisGridDefaults = (kind: ChartKind): Partial<ChartModeState> => kind === 'scatter' || kind === 'bubble'
  ? { showXAxisLine: true, showYAxisLine: true, showHorizontalGrid: true, showVerticalGrid: true }
  : isDistributionKind(kind)
  ? { showXAxisLine: true, showYAxisLine: false, showXTicks: true, showYTicks: false, showHorizontalGrid: true, showVerticalGrid: false }
  : { showXAxisLine: true, showYAxisLine: false, showHorizontalGrid: true, showVerticalGrid: false }
const defaultChartMode = chartModeState(createDefaultChartConfig())
export const chartModeDefaults = (kind: ChartKind): ChartModeState => ({
  ...defaultChartMode,
  ...axisGridDefaults(kind),
  ...(kind === 'histogram' || kind === 'kde-plot' ? { showLegend: true } : {}),
  ...(kind === 'slope' ? { showValues: true, showLegend: false, showDirectLabels: false, showYAxisTitle: false, showYAxisLine: false, showYTicks: false, showHorizontalGrid: false } : {}),
  ...(kind === 'heatmap' ? { showYAxisTitle: false } : {}),
  ...(kind === 'treemap' ? { showXAxisTitle: false, showYAxisTitle: false, showXAxisLine: false, showYAxisLine: false, showXTicks: false, showYTicks: false, showHorizontalGrid: false, showVerticalGrid: false, showValues: true, showLegend: false, showDirectLabels: false } : {}),
})
export const shouldHideXAxisTitle = (kind: ChartKind, xFieldType: ColumnType | undefined) => xFieldType === 'date' && kind !== 'scatter' && kind !== 'bubble'
export const compatibleMeasureSelection = (selected: string[], available: string[], fallback: string) => {
  const compatible = selected.filter((field) => available.includes(field))
  return compatible.length ? compatible : [available[0] ?? fallback]
}
export const moveTreemapItem = (items: string[], source: string, target?: string, placement: 'before' | 'after' = 'before') => {
  if (!items.includes(source) || source === target) return items
  const next = items.filter((item) => item !== source)
  const targetIndex = target ? next.indexOf(target) : -1
  next.splice(targetIndex < 0 ? next.length : targetIndex + (placement === 'after' ? 1 : 0), 0, source)
  return next
}
const changedKeys = (before: Record<string, unknown> = {}, after: Record<string, unknown> = {}) =>
  [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => before[key] !== after[key])

export const designChangeKey = (before: ChartConfig, after: ChartConfig) => changedKeys(before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>).flatMap((key) => {
  if (key !== 'elementStyles' && key !== 'seriesStyles' && key !== 'treemapLeafOrder') return [key]
  const previous = before[key] as Record<string, Record<string, unknown> | string[] | undefined> | undefined
  const next = after[key] as Record<string, Record<string, unknown> | string[] | undefined> | undefined
  return changedKeys(previous, next).flatMap((item) => {
    const previousItem = previous?.[item], nextItem = next?.[item]
    if (Array.isArray(previousItem) || Array.isArray(nextItem)) return [`${key}:${item}`]
    const properties = changedKeys(previousItem, nextItem)
    return properties.length ? properties.map((property) => `${key}:${item}:${property}`) : [`${key}:${item}`]
  })
}).sort().join('|')

function App() {
  const [step, setStep] = useState<EditorStep>('source')
  const [hasData, setHasData] = useState(false)
  const [table, setTable] = useState<DataTable>(demoTable)
  const [types, setTypes] = useState<Record<string, ColumnType>>(inferTypes(demoTable))
  const [config, setConfig] = useState(createDefaultChartConfig)
  const [sheetUrl, setSheetUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [dateFormatColumn, setDateFormatColumn] = useState<string | null>(null)
  const [showTransformDialog, setShowTransformDialog] = useState(false)
  const [excelWorkbook, setExcelWorkbook] = useState<{ fileName: string; sheets: Array<{ name: string; table: DataTable }>; source?: string } | null>(null)
  const [selectedElement, setSelectedElement] = useState<ChartElementSelection | null>(null)
  const [selectedSeries, setSelectedSeries] = useState<ChartSeriesSelection | null>(null)
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null)
  const [selectedDecoration, setSelectedDecoration] = useState<string | null>(null)
  const [selectedSettingsSection, setSelectedSettingsSection] = useState<ChartSettingsSection | null>(null)
  const [copiedStyle, setCopiedStyle] = useState<CopiedStyle | null>(null)
  const [canvasZoom, setCanvasZoom] = useState(1)
  const [chartModule, setChartModule] = useState<typeof import('./core/chartRegistry') | null>(null)
  const dataHistory = useEditorHistory<HistorySnapshot>(20)
  const designHistory = useEditorHistory<ChartConfig>(100)
  const { past, future } = dataHistory
  const { past: designPast, future: designFuture } = designHistory
  const { push: pushDesignHistory, discardFuture: discardDesignFuture } = designHistory
  const previousDesignConfig = useRef(config)
  const skipDesignHistory = useRef(false)
  const lastDesignCommit = useRef(0)
  const lastDesignChange = useRef('')
  const processingController = useRef<AbortController | null>(null)
  const importSequence = useRef(0)
  const chartRef = useRef<ChartCanvasHandle>(null)
  const issues = useMemo(() => profileData(table, types), [table, types])
  const numericColumns = useMemo(() => table.columns.filter((column) => types[column] === 'number'), [table.columns, types])
  const chartSeries = useMemo(() => {
    if (step !== 'chart' && step !== 'design') return []
    const series = prepareChartData(table, config).series
    if (!config.seriesOrder?.length) return series
    const positions = new Map(config.seriesOrder.map((name, index) => [name, index]))
    return [...series].sort((left, right) => (positions.get(left.name) ?? Number.MAX_SAFE_INTEGER) - (positions.get(right.name) ?? Number.MAX_SAFE_INTEGER))
  }, [step, table, config])
  const chartPlugin = useMemo(() => chartModule?.getChartPlugin(config.kind) ?? null, [chartModule, config.kind])
  const valueLabels = useMemo(() => step === 'chart' || step === 'design' ? chartModule?.chartValueLabelSelections(table, config) ?? [] : [], [step, chartModule, table, config])
  const moveTreemapElement = (source: ChartElementSelection, target: ChartElementSelection, placement: 'before' | 'after') => {
    setConfig((current) => {
      if (source.key.startsWith('treemap-group:')) {
        const groups = valueLabels.filter((item) => item.key.startsWith('treemap-group:')).map((item) => item.seriesName)
        return { ...current, treemapGroupOrder: moveTreemapItem(groups, source.seriesName, target.seriesName, placement) }
      }
      const leaves = valueLabels.filter((item) => !item.key.startsWith('treemap-group:') && item.seriesName === source.seriesName).map((item) => item.label ?? item.category)
      return { ...current, treemapLeafOrder: { ...current.treemapLeafOrder, [source.seriesName]: moveTreemapItem(leaves, source.label ?? source.category, target.label ?? target.category, placement) } }
    })
  }

  useEffect(() => {
    if (chartModule || step !== 'chart' && step !== 'design') return
    void import('./core/chartRegistry').then((module) => setChartModule(module))
  }, [chartModule, step])

  useEffect(() => {
    if (step !== 'data') return
    const timer = window.setTimeout(() => { void preloadChartEditor() }, 150)
    return () => window.clearTimeout(timer)
  }, [step])

  useEffect(() => {
    requestAnimationFrame(() => window.scrollTo({ top: 0 }))
  }, [step])

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
    const change = designChangeKey(previous, config)
    if (change !== lastDesignChange.current || now - lastDesignCommit.current > 350) pushDesignHistory(structuredClone(previous))
    else discardDesignFuture()
    lastDesignCommit.current = now
    lastDesignChange.current = change
    previousDesignConfig.current = config
  }, [config, discardDesignFuture, pushDesignHistory, step])

  const undoDesign = () => {
    const previous = designHistory.undo(structuredClone(config)); if (!previous) return
    skipDesignHistory.current = true; lastDesignCommit.current = 0; lastDesignChange.current = ''
    setConfig(previous)
  }
  const redoDesign = () => {
    const next = designHistory.redo(structuredClone(config)); if (!next) return
    skipDesignHistory.current = true; lastDesignCommit.current = 0; lastDesignChange.current = ''
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
    if (!chartPlugin) return
    setSelectedAnnotation(null); setSelectedDecoration(null)
    if (section === 'values') { setSelectedElement(null); setSelectedSeries(null) }
    const sectionCapability: Partial<Record<ChartSettingsSection, ChartPlugin['settings']['sections'][number]>> = {
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
        'x-axis-title': { group: 'Оси, шкалы и подписи', field: 'Текст оси X' }, 'y-axis-title': { group: 'Оси, шкалы и подписи', field: 'Текст оси Y' },
        'x-axis-labels': { group: 'Оси, шкалы и подписи', field: 'Подписи шкалы X' }, 'y-axis-labels': { group: 'Оси, шкалы и подписи', field: 'Подписи шкалы Y' },
        grid: { group: 'Сетка' }, legend: { group: 'Легенда' }, values: { group: 'Подписи значений' },
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
    dataHistory.push({ table, types, config, label, time: Date.now() })
    setTable(nextTable); setTypes(nextTypes); setConfig(nextConfig)
  }
  const undo = () => {
    const target = past.at(-1); if (!target) return
    const snapshot = dataHistory.undo({ table, types, config, label: target.label, time: Date.now() }); if (!snapshot) return
    setTable(snapshot.table); setTypes(snapshot.types); setConfig(snapshot.config)
  }
  const redo = () => {
    const target = future.at(-1); if (!target) return
    const snapshot = dataHistory.redo({ table, types, config, label: target.label, time: Date.now() }); if (!snapshot) return
    setTable(snapshot.table); setTypes(snapshot.types); setConfig(snapshot.config)
  }
  const reconcileChartConfig = (nextTable: DataTable, nextTypes: Record<string, ColumnType>): ChartConfig => {
    const numeric = nextTable.columns.filter((column) => nextTypes[column] === 'number')
    const yFields = config.yFields.filter((column) => numeric.includes(column))
    const selected = yFields.length ? yFields : numeric.slice(0, 1)
    const butterflyLeft = (config.butterflyLeftFields ?? config.yFields.slice(0, 1)).filter((field) => numeric.includes(field))
    const butterflyRight = (config.butterflyRightFields ?? config.yFields.slice(1, 2)).filter((field) => numeric.includes(field) && !butterflyLeft.includes(field))
    if (config.kind === 'butterfly' && !butterflyLeft.length) {
      const replacement = numeric.find((field) => !butterflyRight.includes(field))
      if (replacement) butterflyLeft.push(replacement)
    }
    if (config.kind === 'butterfly' && !butterflyRight.length) {
      const replacement = numeric.find((field) => !butterflyLeft.includes(field))
      if (replacement) butterflyRight.push(replacement)
    }
    const reconciledFields = config.kind === 'butterfly' ? [...butterflyLeft, ...butterflyRight] : selected
    const xField = nextTable.columns.includes(config.xField) ? config.xField : nextTable.columns[0]
    return {
      ...config,
      xField,
      yField: reconciledFields[0] ?? nextTable.columns[0],
      yFields: reconciledFields.length ? reconciledFields : [nextTable.columns[0]],
      seriesField: nextTable.columns.includes(config.seriesField) ? config.seriesField : '',
      scatterSizeField: numeric.includes(config.scatterSizeField ?? '') ? config.scatterSizeField : undefined,
      scatterColorField: nextTable.columns.includes(config.scatterColorField ?? '') ? config.scatterColorField : undefined,
      rangeLowerField: numeric.includes(config.rangeLowerField ?? '') ? config.rangeLowerField : undefined,
      rangeUpperField: numeric.includes(config.rangeUpperField ?? '') ? config.rangeUpperField : undefined,
      dumbbellStartField: numeric.includes(config.dumbbellStartField ?? '') ? config.dumbbellStartField : undefined,
      dumbbellEndField: numeric.includes(config.dumbbellEndField ?? '') ? config.dumbbellEndField : undefined,
      butterflyLeftFields: config.kind === 'butterfly' ? butterflyLeft : config.butterflyLeftFields?.filter((field) => numeric.includes(field)),
      butterflyRightFields: config.kind === 'butterfly' ? butterflyRight : config.butterflyRightFields?.filter((field) => numeric.includes(field)),
      scatterLabelField: nextTable.columns.includes(config.scatterLabelField ?? '') ? config.scatterLabelField : undefined,
      distributionLabelField: nextTable.columns.includes(config.distributionLabelField ?? '') ? config.distributionLabelField : undefined,
      distributionGroupField: nextTable.columns.includes(config.distributionGroupField ?? '') ? config.distributionGroupField : undefined,
      heatmapYField: nextTable.columns.includes(config.heatmapYField ?? '') ? config.heatmapYField : undefined,
      treemapSubcategoryField: nextTable.columns.includes(config.treemapSubcategoryField ?? '') ? config.treemapSubcategoryField : undefined,
      intervalGroups: config.intervalGroups?.filter((group) => numeric.includes(group.main) && numeric.includes(group.lower) && numeric.includes(group.upper)),
      xAxisTitle: nextTable.columns.includes(config.xField) ? config.xAxisTitle : xField,
      yAxisTitle: reconciledFields.includes(config.yField) ? config.yAxisTitle : reconciledFields[0] ?? nextTable.columns[0],
    }
  }

  const applyTable = async (next: DataTable, initialKind?: ChartKind) => {
    if (!next.columns.length || !next.rows.length) throw new Error('В таблице нет данных')
    processingController.current?.abort()
    const controller = new AbortController()
    processingController.current = controller
    setProcessingProgress(1)
    const normalized = await normalizeInWorker(next, navigator.language || 'ru-RU', setProcessingProgress, controller.signal)
    const nextTypes = inferTypes(normalized)
    const numeric = normalized.columns.find((column) => nextTypes[column] === 'number') ?? normalized.columns[1] ?? normalized.columns[0]
    setTable(normalized); setTypes(nextTypes); dataHistory.clear(); designHistory.clear(); setHasData(true); setStep('data')
    setConfig((value) => ({ ...value, ...(initialKind ? { kind: initialKind, ...chartModeDefaults(initialKind), ...(isDistributionKind(initialKind) ? distributionVisualDefaults(initialKind) : {}), ...(initialKind === 'treemap' ? { treemapSubcategoryField: normalized.columns[1], aggregation: 'sum' as const, title: 'Трудности бизнеса', subtitle: 'Открытый вопрос, до 5 ответов, % от всех опрошенных', note: 'Молодые предприниматели 18–35 лет, 30 апреля — 9 мая 2025 года, n = 923', source: 'Источник: ВЦИОМ, 2025' } : {}) } : {}), xField: normalized.columns[0], yField: numeric, yFields: initialKind && isDistributionKind(initialKind) ? normalized.columns.filter((column) => nextTypes[column] === 'number') : [numeric], seriesField: '', distributionGroupField: undefined, xAxisTitle: normalized.columns[0], yAxisTitle: numeric }))
    setProcessingProgress(100)
  }

  const run = async (task: () => Promise<DataTable>, initialKind?: ChartKind) => {
    const sequence = ++importSequence.current
    processingController.current?.abort()
    setLoading(true); setError('')
    try {
      const next = await task()
      if (sequence !== importSequence.current) return
      await applyTable(next, initialKind)
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
        const { importExcelSheets } = await import('./core/importers')
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
    run(async () => {
      const { importFile } = await import('./core/importers')
      return importFile(file)
    })
  }

  const openGoogleSheet = async () => {
    const sequence = ++importSequence.current
    processingController.current?.abort()
    setLoading(true); setError('')
    try {
      const { importGoogleSheets } = await import('./core/importers')
      const sheets = await importGoogleSheets(sheetUrl)
      if (sequence !== importSequence.current) return
      const available = sheets.filter(({ table: item }) => item.columns.length && item.rows.length)
      if (!available.length) throw new Error('В Google Sheets нет непустых листов')
      if (available.length === 1) await applyTable(available[0].table)
      else setExcelWorkbook({ fileName: 'Google Sheets', sheets: available, source: 'Google Sheets' })
    } catch (cause) { if (sequence === importSequence.current && !(cause instanceof DOMException && cause.name === 'AbortError')) setError(cause instanceof Error ? cause.message : 'Ошибка импорта Google Sheets') }
    finally { if (sequence === importSequence.current) { setLoading(false); processingController.current = null } }
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
    const nextConfig = { ...config, xField: config.xField === oldName ? clean : config.xField, yField: config.yField === oldName ? clean : config.yField, yFields: config.yFields.map((field) => field === oldName ? clean : field), seriesField: config.seriesField === oldName ? clean : config.seriesField, butterflyLeftFields: config.butterflyLeftFields?.map((field) => field === oldName ? clean : field), butterflyRightFields: config.butterflyRightFields?.map((field) => field === oldName ? clean : field), heatmapYField: config.heatmapYField === oldName ? clean : config.heatmapYField, treemapSubcategoryField: config.treemapSubcategoryField === oldName ? clean : config.treemapSubcategoryField, rangeLowerField: config.rangeLowerField === oldName ? clean : config.rangeLowerField, rangeUpperField: config.rangeUpperField === oldName ? clean : config.rangeUpperField, dumbbellStartField: config.dumbbellStartField === oldName ? clean : config.dumbbellStartField, dumbbellEndField: config.dumbbellEndField === oldName ? clean : config.dumbbellEndField, scatterLabelField: config.scatterLabelField === oldName ? clean : config.scatterLabelField, distributionLabelField: config.distributionLabelField === oldName ? clean : config.distributionLabelField, xAxisTitle: config.xAxisTitle === oldName ? clean : config.xAxisTitle, yAxisTitle: config.yAxisTitle === oldName ? clean : config.yAxisTitle, seriesStyles, elementStyles, seriesOrder, intervalGroups }
    commitTable(renamed, nextTypes, `Столбец «${oldName}» переименован`, nextConfig)
  }

  const chooseChart = (kind: ChartKind) => {
    const plugin = chartModule?.getChartPlugin(kind)
    if (!plugin) return
    setConfig((value) => {
      const targetXField = kind === 'seasonal-line' && types[value.xField] !== 'date' ? table.columns.find((column) => types[column] === 'date') ?? value.xField : value.xField
      const distributionKind = isDistributionKind(kind)
      const measures = distributionKind ? numericColumns : numericColumns.filter((column) => column !== targetXField)
      const preservedMeasures = compatibleMeasureSelection(value.yFields, measures, value.yField)
      const pair = [value.yFields.find((field) => measures.includes(field)), ...measures].filter((field, index, fields): field is string => Boolean(field) && fields.indexOf(field) === index).slice(0, 2)
      const triple = [...value.yFields.filter((field) => measures.includes(field)), ...measures].filter((field, index, fields) => fields.indexOf(field) === index).slice(0, 3)
      const roleDefaults = kind === 'seasonal-line'
        ? { xField: targetXField, yFields: preservedMeasures, yField: preservedMeasures[0] }
        : kind === 'heatmap'
        ? { yFields: preservedMeasures, yField: preservedMeasures[0] }
        : kind === 'waterfall'
        ? { yFields: [preservedMeasures[0]], yField: preservedMeasures[0], seriesField: '', showLegend: false }
        : kind === 'butterfly'
        ? { yFields: pair, yField: pair[0], butterflyLeftFields: pair.slice(0, 1), butterflyRightFields: pair.slice(1, 2), butterflyCategoryPosition: value.butterflyCategoryPosition ?? 'center' as const, seriesField: '', showLegend: true }
        : kind === 'treemap'
        ? { yFields: [preservedMeasures[0]], yField: preservedMeasures[0], aggregation: 'sum' as const, showValues: true, showLegend: false, showDirectLabels: false, treemapSubcategoryField: value.treemapSubcategoryField && table.columns.includes(value.treemapSubcategoryField) && value.treemapSubcategoryField !== value.xField ? value.treemapSubcategoryField : undefined }
        : distributionKind
        ? { ...distributionVisualDefaults(kind), yFields: preservedMeasures, yField: preservedMeasures[0], distributionGroupField: value.distributionGroupField && table.columns.includes(value.distributionGroupField) ? value.distributionGroupField : undefined, distributionLayoutMode: value.distributionGroupField && table.columns.includes(value.distributionGroupField) ? kind === 'raincloud' || kind === 'ridgeline' ? 'categories' as const : 'measures' as const : value.distributionLayoutMode, showLegend: kind === 'histogram' || kind === 'kde-plot' }
        : kind === 'dumbbell'
        ? { dumbbellStartField: value.dumbbellStartField && measures.includes(value.dumbbellStartField) ? value.dumbbellStartField : pair[0], dumbbellEndField: value.dumbbellEndField && measures.includes(value.dumbbellEndField) ? value.dumbbellEndField : pair[1] }
        : kind === 'range-line' || kind === 'step-range-line'
          ? { rangeLowerField: value.rangeLowerField && measures.includes(value.rangeLowerField) ? value.rangeLowerField : pair[0], rangeUpperField: value.rangeUpperField && measures.includes(value.rangeUpperField) ? value.rangeUpperField : pair[1] }
          : kind === 'confidence-line' && triple.length === 3
            ? { intervalGroups: [{ main: triple[0], lower: triple[1], upper: triple[2] }] }
            : {}
      const slopePositions = kind === 'slope'
        ? [...new Map(table.rows.map((row) => [slopePositionKey(row[targetXField]), row[targetXField]])).keys()]
        : undefined
      const indexPositions = kind === 'indexed-line' ? [...new Map(table.rows.map((row) => [slopePositionKey(row[targetXField]), row[targetXField]])).entries()].sort(([, left], [, right]) => left instanceof Date && right instanceof Date ? left.getTime() - right.getTime() : typeof left === 'number' && typeof right === 'number' ? left - right : 0).map(([key]) => key) : undefined
      const seasonalYears = kind === 'seasonal-line' ? [...new Set(table.rows.flatMap((row) => row[targetXField] instanceof Date ? [String((row[targetXField] as Date).getFullYear())] : []))].sort() : undefined
      return {
        ...value,
        kind,
        ...roleDefaults,
        ...(slopePositions ? { slopeXValues: slopePositions.length > 1 ? [slopePositions[0], slopePositions.at(-1)!] : slopePositions } : {}),
        ...(indexPositions && !indexPositions.includes(value.indexBaseXValue ?? '') ? { indexBaseXValue: indexPositions[0] } : {}),
        ...(seasonalYears && !value.seasonalAccentYears?.length ? { seasonalAccentYears: seasonalYears.slice(-1), seasonalMutedColor: '#d9d7df', seasonalMutedOpacity: .45 } : {}),
        ...(kind === 'slope' ? { slopeShowValues: value.slopeShowValues ?? true, slopeShowSeriesNames: value.slopeShowSeriesNames ?? true, slopeShowYAxis: value.slopeShowYAxis ?? false } : {}),
        ...((kind === 'moving-average-line' || kind === 'moving-average-scatter') ? { movingAverageWindow: value.movingAverageWindow ?? 12, movingAverageRawOpacity: value.movingAverageRawOpacity ?? .22 } : {}),
        ...(kind === 'heatmap' ? { heatmapScaleMode: value.heatmapScaleMode ?? 'diverging' as const, heatmapLowColor: value.heatmapLowColor ?? '#2c6aa8', heatmapMidColor: value.heatmapMidColor ?? '#f5f5f2', heatmapHighColor: value.heatmapHighColor ?? '#c83e4d', heatmapMidpoint: value.heatmapMidpoint ?? 0, heatmapShowScale: value.heatmapShowScale ?? true, heatmapScalePosition: value.heatmapScalePosition ?? 'right' as const, heatmapCellGap: value.heatmapCellGap ?? 1, heatmapRowSort: value.heatmapRowSort ?? 'none' as const, heatmapRowSortDirection: value.heatmapRowSortDirection ?? 'descending' as const, heatmapMissingColor: value.heatmapMissingColor ?? '#e8e7eb', heatmapMissingLabel: value.heatmapMissingLabel ?? '—' } : {}),
        ...(kind === 'treemap' ? { treemapGap: value.treemapGap ?? 2, treemapGroupGap: value.treemapGroupGap ?? 5, treemapShowGroupLabels: value.treemapShowGroupLabels ?? true } : {}),
        ...(plugin.category === 'bar-horizontal' ? { barOrientation: 'horizontal' as const, categoryAxisInverse: value.categoryAxisInverse ?? true } : isBarChart(kind) ? { barOrientation: 'vertical' as const } : {}),
      }
    })
    setSelectedSeries(null); setSelectedElement(null)
  }
  const openDesign = () => {
    setStep('design')
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
    chartSeries.forEach((series, index) => { seriesStyles[series.name] = { ...seriesStyles[series.name], color: chartModule?.getSeriesColor(current, series.name, index) ?? current.color } })
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
  const selectedElementStyle = selectedElement ? config.elementStyles[selectedElement.key] : undefined
  const selectedElementColor = selectedElementStyle?.color
    ?? selectedElement?.color
    ?? (selectedElement ? chartModule?.chartElementColor(table, config, selectedElement.key) : undefined)
    ?? (selectedElement ? chartModule?.getSeriesColor(config, selectedElement.seriesName, Math.max(0, chartSeries.findIndex((series) => series.name === selectedElement.seriesName))) : undefined)
    ?? config.color
  const selectedElementLabelShown = selectedElementStyle?.showLabel ?? (config.kind === 'scatter' || config.kind === 'bubble' ? config.scatterShowLabels ?? config.showValues : isDistributionKind(config.kind) ? config.distributionShowLabels ?? false : config.showValues)
  const selectedElementLabelPosition = selectedElementStyle?.labelPosition ?? (config.kind === 'scatter' || config.kind === 'bubble' ? config.scatterLabelPosition ?? 'right' : isDistributionKind(config.kind) ? config.distributionLabelPosition ?? ((config.distributionOrientation ?? 'horizontal') === 'horizontal' ? 'right' : 'top') : 'top')

  return (
    <div className="app-shell">
      <EditorHeader projectName={hasData ? table.name : 'Новый проект'} projectMeta={hasData ? `${table.rows.length.toLocaleString('ru-RU')} строк` : 'не сохранён'} canExport={step === 'design'} onExportSvg={(options) => { void chartRef.current?.exportSvg(options) }} onExportPng={(options) => { void chartRef.current?.exportPng(options) }}/>
      <EditorStepper step={step} canVisit={canVisit} onChange={setStep}/>

      {step === 'source' && <main className="source-step">
        <div className="step-heading"><h1>Добавьте данные</h1><p>Загрузите файл или подключите публичную таблицу Google Sheets.</p></div>
        <div className="source-grid">
          <label className="source-card upload-card"><input type="file" accept=".csv,.xlsx,.parquet" onChange={(event) => { const file = event.target.files?.[0]; if (file) openFile(file); event.target.value = '' }} /><span className="source-icon"><FileUp size={22}/></span><strong>{loading ? 'Читаем данные…' : 'Загрузить файл'}</strong><p>CSV, XLSX или Parquet</p><span className="source-card-action">{loading ? 'Подождите…' : 'Выбрать с компьютера'}</span></label>
          <div className="source-card sheet-card"><span className="source-icon sheets"><Sheet size={21}/></span><strong>Google Sheets</strong><p>Вставьте ссылку на таблицу с доступом для просмотра</p><div className="source-sheet-form"><input className="text-input" aria-label="Ссылка на Google Sheets" value={sheetUrl} onChange={(event) => setSheetUrl(event.target.value)} placeholder="https://docs.google.com/spreadsheets/…"/><button className="button primary" disabled={!sheetUrl || loading} onClick={openGoogleSheet}>Подключить</button></div></div>
        </div>
        {error && <p className="source-error">⚠ {error}</p>}
        {loading && <div className="processing-progress"><div><span>Обработка данных</span><b>{processingProgress}%</b></div><progress max="100" value={processingProgress}/><button onClick={() => processingController.current?.abort()}>Отменить</button></div>}
        <div className="source-examples"><span>Примеры</span><div className="demo-links"><button className="demo-link" disabled={loading} onClick={() => run(() => Promise.resolve(demoTable))}>Временной ряд</button><button className="demo-link" disabled={loading} onClick={() => run(() => Promise.resolve(categoricalDemoTable))}>Топ стран</button><button className="demo-link" disabled={loading} onClick={() => run(() => Promise.resolve(dumbbellDemoTable))}>До → после</button><button className="demo-link" disabled={loading} onClick={() => run(() => Promise.resolve(distributionDemoTable), 'boxplot')}>Распределения</button><button className="demo-link" disabled={loading} onClick={() => run(() => Promise.resolve(entrepreneurshipDifficultiesDemoTable), 'treemap')}>Трудности бизнеса</button></div></div>
        <p className="source-privacy"><ShieldCheck size={16}/> Файлы обрабатываются в браузере и не загружаются на сервер</p>
      </main>}

      {step === 'data' && <Suspense fallback={<main className="data-step" aria-busy="true">Подготовка таблицы…</main>}><main className="data-step">
        <div className="data-step-header"><div><h1>Проверьте данные</h1><p>Проверьте типы и значения перед построением графика.</p></div></div>
        <div className="history-toolbar"><div><button aria-label="Отменить" disabled={!past.length} onClick={undo} title="Отменить"><RotateCcw size={15}/></button><button aria-label="Повторить" disabled={!future.length} onClick={redo} title="Повторить"><RotateCw size={15}/></button></div><button className="transform-open" onClick={() => setShowTransformDialog(true)}><SlidersHorizontal size={14}/>Настроить временной ряд</button><details><summary><History size={14}/>История <b>{past.length}</b></summary><div>{past.length ? [...past].reverse().map((entry, index) => <div className="history-entry" key={`${entry.time}-${index}`}><span>{entry.label}</span><time>{new Date(entry.time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</time></div>) : <p>Изменений пока нет</p>}</div></details>{past.length > 0 && <span className="history-current">{past.at(-1)?.label}</span>}</div>
        <DataReview table={table} types={types} issues={issues} onRename={changeName} onType={changeType} onConfigureDate={setDateFormatColumn} onEditCell={(row, column, value) => commitTable(editCell(table, row, column, value, types[column]), types, `Изменена ячейка ${column}, строка ${row + 1}`)} onRemoveDuplicates={() => commitTable(removeDuplicateRows(table), types, 'Удалены точные дубликаты')} onDeleteRows={(indices) => commitTable(removeRows(table, indices), types, `Удалено строк: ${indices.length}`)} onDeleteColumns={(columns) => { const next = removeColumns(table, columns); const nextTypes = Object.fromEntries(Object.entries(types).filter(([column]) => next.columns.includes(column))); commitTable(next, nextTypes, `Удалено столбцов: ${columns.length}`, reconcileChartConfig(next, nextTypes)) }} onTranspose={() => { const next = transposeTable(table); const nextTypes = inferTypes(next); commitTable(next, nextTypes, 'Таблица транспонирована', reconcileChartConfig(next, nextTypes)) }}/>
        <div className="step-footer"><button className="button" onClick={() => setStep('source')}>← Другой источник</button><button className="button primary" onPointerEnter={() => { void preloadChartEditor() }} onFocus={() => { void preloadChartEditor() }} onClick={() => setStep('chart')}>Выбрать график →</button></div>
      </main></Suspense>}
      <Suspense fallback={null}>
        {dateFormatColumn && <DateFormatDialog table={table} column={dateFormatColumn} onClose={() => setDateFormatColumn(null)} onApply={(next) => { commitTable(next, { ...types, [dateFormatColumn]: 'date' }, `Настроен формат «${dateFormatColumn}»`); setDateFormatColumn(null) }}/>}
        {excelWorkbook && <ExcelSheetDialog fileName={excelWorkbook.fileName} sheets={excelWorkbook.sheets} source={excelWorkbook.source} onClose={() => setExcelWorkbook(null)} onSelect={(selected) => { setExcelWorkbook(null); run(() => Promise.resolve(selected)) }}/>}
        {showTransformDialog && <DataTransformDialog table={table} types={types} onClose={() => setShowTransformDialog(false)} onApply={(next, label) => { const nextTypes = inferTypes(next); commitTable(next, nextTypes, label, reconcileChartConfig(next, nextTypes)); setShowTransformDialog(false) }}/>}
      </Suspense>

      {(step === 'chart' || step === 'design') && !chartPlugin && <main className={`chart-workspace step-${step}`} aria-busy="true">Подготовка редактора графика…</main>}
      {(step === 'chart' || step === 'design') && chartPlugin && <main className={`chart-workspace step-${step}`}>
        {step === 'chart' && <Suspense fallback={<aside className="chart-picker" aria-busy="true">Загрузка типов графиков…</aside>}><ChartTypePicker table={table} numericColumns={numericColumns} config={config} onChange={setConfig} onToggleField={toggleYField} onChooseChart={chooseChart}/></Suspense>}

        <section className="stage"><div className="stage-toolbar"><span>{step === 'chart' ? 'Предпросмотр графика' : `${config.canvasWidth ?? 1000} × ${config.canvasHeight ?? 563} px`}</span></div><div className="canvas-floating-menu" aria-label="Управление холстом"><button type="button" disabled={canvasZoom <= .5} onClick={() => changeCanvasZoom(canvasZoom - .1)} title="Уменьшить масштаб" aria-label="Уменьшить масштаб" data-tip="Уменьшить"><Minus size={14}/></button><span className="canvas-zoom-value">{zoomPercent}</span><button type="button" disabled={canvasZoom >= 2} onClick={() => changeCanvasZoom(canvasZoom + .1)} title="Увеличить масштаб" aria-label="Увеличить масштаб" data-tip="Увеличить"><Plus size={14}/></button><span className="canvas-action-divider"/><button type="button" disabled={!designPast.length} onClick={undoDesign} title="Отменить (Ctrl/⌘ Z)" aria-label="Отменить" data-tip="Отменить"><RotateCcw size={13}/></button><button type="button" disabled={!designFuture.length} onClick={redoDesign} title="Повторить (Ctrl/⌘ Shift Z)" aria-label="Повторить"><RotateCw size={13}/></button><button type="button" className="clear-selection-button" onClick={clearCanvasSelection} title="Снять выделение" aria-label="Снять выделение" data-tip="Снять выделение"><CircleX size={13}/></button></div><div className="paper-frame"><div className="paper canvas-paper"><Suspense fallback={<div className="chart-canvas" aria-busy="true">Подготовка графика…</div>}><ChartCanvas ref={chartRef} table={table} config={config} viewZoom={canvasZoom} selectedSettingsSection={selectedSettingsSection} onSettingsFocus={focusSettings} onClearSettingsFocus={() => setSelectedSettingsSection(null)} onRichTextChange={(field, html, text) => setConfig((current) => ({ ...current, [field]: text, [`${field}Html`]: html }))} onCategoryLabelChange={(axis, category, text) => setConfig((current) => ({ ...current, categoryLabelOverrides: { ...current.categoryLabelOverrides, [axis]: { ...current.categoryLabelOverrides?.[axis], [category]: text } } }))} onTreemapMove={moveTreemapElement} selectedSeriesName={selectedSeries?.name} selectedElementKey={selectedElement?.key} selectedElementTarget={selectedElement?.target} selectedAnnotationId={selectedAnnotation} selectedDecorationId={selectedDecoration} onDecorationChange={updateDecoration} onSeriesSelect={(selection) => { setSelectedSeries(selection); setSelectedElement(null); setSelectedAnnotation(null); setSelectedDecoration(null) }} onSelect={(selection) => { const resolved = valueLabels.find((item) => item.key === selection.key); setSelectedElement(resolved ? { ...resolved, target: selection.target } : selection); setSelectedAnnotation(null); setSelectedDecoration(null) }} onAnnotationSelect={(id) => { setSelectedAnnotation(id); setSelectedSettingsSection(null); setSelectedDecoration(null); setSelectedElement(null); setSelectedSeries(null) }} onAnnotationChange={(changed) => setConfig((current) => ({ ...current, annotations: current.annotations.map((item) => item.id === changed.id ? changed : item) }))} onAnnotationDuplicate={duplicateAnnotation} onAnnotationDelete={(id) => { setConfig((current) => ({ ...current, annotations: current.annotations.filter((item) => item.id !== id) })); setSelectedAnnotation(null) }}/></Suspense></div></div><p className="stage-hint">{config.kind === 'treemap' ? 'Один клик выбирает категорию · повторный клик выбирает блок' : 'Один клик выбирает ряд · повторный клик выбирает отдельный элемент'}</p>{step === 'chart' && <div className="chart-preview-actions"><div><small>Выбранный тип</small><strong>{chartPlugin.label}</strong></div><button type="button" className="button primary" onClick={openDesign}>Настроить оформление →</button></div>}</section>

        {step === 'design' && <Suspense fallback={<aside className="settings-panel" aria-busy="true">Загрузка настроек…</aside>}><aside className="settings-panel"><div className="panel-title"><span className="eyebrow">Шаг 4 из 4</span><h2>Оформление</h2><p>Настройте график и выбранные элементы</p></div><SettingsQuickNav features={chartPlugin.settings.features} showSeries={chartSeries.length > 1}/><section className="form-section visual-settings" onToggle={(event) => { const opened = event.target as HTMLDetailsElement; if (opened.tagName !== 'DETAILS' || !opened.open || opened.parentElement !== event.currentTarget) return; event.currentTarget.querySelectorAll<HTMLDetailsElement>(':scope > details[open]').forEach((details) => { if (details !== opened) details.open = false }) }}>
          <CanvasSettings config={config} onChange={setConfig}/>
          <NumberFormatSettings config={config} onChange={setConfig}/>
          {activeDecoration && <section className="element-editor decoration-editor"><header><div><span>Выбран визуальный акцент</span><strong>{decorationLabels[activeDecoration.type]}</strong><small>Перетащите объект на холсте или задайте точные координаты</small></div><button onClick={() => setSelectedDecoration(null)}>×</button></header><div>
            <label>Цвет<ColorControl value={activeDecoration.color} swatches={pickerSwatches} onChange={(color) => updateDecoration({ ...activeDecoration, color })}/></label>
            <div className="fred-grid"><label>X, px<NumberInput disabled={activeDecoration.type === 'area' && activeDecoration.fitToPlotWidth} min="0" max={config.canvasWidth ?? 1000} value={Math.round(activeDecoration.x)} onValueChange={(x) => updateDecoration({ ...activeDecoration, x })}/></label><label>Y, px<NumberInput disabled={activeDecoration.type === 'area' && activeDecoration.fitToPlot} min="0" max={config.canvasHeight ?? 563} value={Math.round(activeDecoration.y)} onValueChange={(y) => updateDecoration({ ...activeDecoration, y })}/></label></div>
            {activeDecoration.type === 'area' && <SettingsCheckbox isSelected={activeDecoration.fitToPlot ?? false} onChange={(fitToPlot) => updateDecoration({ ...activeDecoration, fitToPlot })}>По высоте области графика</SettingsCheckbox>}
            {activeDecoration.type === 'area' && <SettingsCheckbox isSelected={activeDecoration.fitToPlotWidth ?? false} onChange={(fitToPlotWidth) => updateDecoration({ ...activeDecoration, fitToPlotWidth })}>По ширине области графика</SettingsCheckbox>}
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
          {selectedElement && (selectedElement.target === "value-label" || config.kind === 'treemap') && <ValueLabelSelectionControls config={config} element={selectedElement} color={config.kind === 'treemap' ? selectedElementColor : undefined} swatches={pickerSwatches} canPaste={copiedStyle?.kind === 'element'} onCopy={copyElementStyle} onPaste={pasteElementStyle} onChange={updateElement} onClose={() => setSelectedElement(null)} onReset={config.kind === 'treemap' ? () => setConfig((current) => { const elementStyles = { ...current.elementStyles }; delete elementStyles[selectedElement.key]; return { ...current, elementStyles } }) : undefined}/>}
          {selectedElement && selectedElement.target !== "value-label" && config.kind !== 'treemap' && <section className="element-editor"><header><div><span>Выбран элемент</span><strong>{selectedElement.label || selectedElement.category}</strong><small>{selectedElement.seriesName} · {selectedElement.value}</small></div><button onClick={() => setSelectedElement(null)}>×</button></header><div><label>Цвет элемента<ColorControl value={selectedElementColor} swatches={pickerSwatches} onChange={(color) => updateElement({ color })}/></label>{config.kind === 'line' && <><div className="element-note">Настройки применяются к участку линии, ведущему к выбранной точке.</div><label>Толщина участка, px<NumberInput min="0.5" max="12" step="0.5" value={selectedElementStyle?.lineWidth ?? config.seriesStyles[selectedElement.seriesName]?.lineWidth ?? 2} onValueChange={(value) => updateElement({ lineWidth: value })}/></label><label>Тип участка<select value={selectedElementStyle?.lineType ?? config.seriesStyles[selectedElement.seriesName]?.lineType ?? 'solid'} onChange={(event) => updateElement({ lineType: event.target.value as 'solid' | 'dashed' | 'dotted' })}><option value="solid">Сплошной</option><option value="dashed">Пунктирный</option><option value="dotted">Точечный</option></select></label></>}{(isLineLikeChart(config.kind) || config.kind === 'scatter' || config.kind === 'bubble') && <MarkerSettings individual value={selectedElementStyle ?? {}} lineColor={selectedElementColor} onChange={updateElement}/>}<fieldset><legend>Подпись выбранного элемента</legend><SettingsCheckbox isSelected={selectedElementLabelShown} onChange={(showLabel) => updateElement({ showLabel })}>Показывать подпись</SettingsCheckbox><label>Текст подписи<input className="text-input" value={selectedElementStyle?.label ?? ''} onChange={(event) => updateElement({ label: event.target.value, showLabel: true })} placeholder={selectedElement.label ?? selectedElement.value}/></label>{(config.kind === 'scatter' || config.kind === 'bubble' || isDistributionKind(config.kind)) && <label>Положение<select value={selectedElementLabelPosition} onChange={(event) => updateElement({ labelPosition: event.target.value as NonNullable<ChartConfig['elementStyles'][string]['labelPosition']>, showLabel: true })}><option value="top">Сверху</option><option value="right">Справа</option><option value="bottom">Снизу</option><option value="left">Слева</option></select></label>}<TextStyleEditor label="Стиль этой подписи" value={selectedElementStyle?.valueText ?? config.valueText} customFonts={config.customFonts} onChange={(valueText) => updateElement({ valueText, showLabel: true })} align={!(config.kind === 'scatter' || config.kind === 'bubble' || isDistributionKind(config.kind))}/></fieldset><StyleTransferActions canPaste={copiedStyle?.kind === "element"} onCopy={copyElementStyle} onPaste={pasteElementStyle}/><button className="reset-element" onClick={() => setConfig((current) => { const elementStyles = { ...current.elementStyles }; delete elementStyles[selectedElement.key]; return { ...current, elementStyles } })}>Сбросить настройки элемента</button></div></section>}
          {selectedSeries && !selectedElement && <section className="element-editor series-editor"><header><div><span>Выбран ряд</span><strong>{selectedSeries.name}</strong><small>Повторно нажмите на точку или столбец для выбора элемента</small></div><button onClick={() => setSelectedSeries(null)}>×</button></header><div><label>Цвет всего ряда<ColorControl value={config.seriesStyles[selectedSeries.name]?.color ?? selectedSeries.color} swatches={pickerSwatches} onChange={(color) => updateSeries({ color })}/></label>{isDistributionKind(config.kind) && <><label>{config.distributionSummaryStatistic === 'mean' ? 'Цвет линии среднего' : 'Цвет линии медианы'}<ColorControl value={config.seriesStyles[selectedSeries.name]?.distributionSummaryColor ?? config.seriesStyles[selectedSeries.name]?.color ?? selectedSeries.color} swatches={pickerSwatches} onChange={(distributionSummaryColor) => updateSeries({ distributionSummaryColor })}/></label><div className="settings-pair"><label>Толщина, px<NumberInput min="0.5" max="12" step="0.5" value={config.seriesStyles[selectedSeries.name]?.distributionSummaryWidth ?? config.distributionSummaryWidth ?? 3} onValueChange={(distributionSummaryWidth) => updateSeries({ distributionSummaryWidth })}/></label><label>Длина, %<NumberInput min="20" max="200" step="5" value={config.seriesStyles[selectedSeries.name]?.distributionSummaryLength ?? config.distributionSummaryLength ?? 100} onValueChange={(distributionSummaryLength) => updateSeries({ distributionSummaryLength })}/></label></div></>}{isLineLikeChart(config.kind) && <><label>Толщина линии, px<NumberInput min="0.5" max="12" step="0.5" value={config.seriesStyles[selectedSeries.name]?.lineWidth ?? (config.kind === 'slope' ? 2.5 : 2)} onValueChange={(value) => updateSeries({ lineWidth: value })}/></label><label>Тип линии<select value={config.seriesStyles[selectedSeries.name]?.lineType ?? 'solid'} onChange={(event) => updateSeries({ lineType: event.target.value as 'solid' | 'dashed' | 'dotted' })}><option value="solid">Сплошная</option><option value="dashed">Пунктирная</option><option value="dotted">Точечная</option></select></label></>}{(isLineLikeChart(config.kind) || config.kind === 'scatter' || config.kind === 'bubble') && <MarkerSettings value={config.seriesStyles[selectedSeries.name] ?? {}} lineColor={config.seriesStyles[selectedSeries.name]?.color ?? selectedSeries.color} onChange={updateSeries} alwaysVisible={config.kind === 'slope'} defaultSize={config.kind === 'slope' ? 11 : 8}/>}<StyleTransferActions canPaste={copiedStyle?.kind === "series"} onCopy={copySeriesStyle} onPaste={pasteSeriesStyle}/><button className="reset-element" onClick={() => { setConfig((current) => { const seriesStyles = { ...current.seriesStyles }; delete seriesStyles[selectedSeries.name]; return { ...current, seriesStyles } }); setSelectedSeries(null) }}>Вернуть настройки палитры</button></div></section>}
          {chartSeries.length > 1 && <details className="settings-group series-settings" open><summary>Ряды данных</summary><div><p className="series-order-hint">Перетаскивайте ряды или используйте стрелки, чтобы изменить порядок.</p><div className="series-style-list ordered-series-list">{chartSeries.map((series, index) => { const color = chartModule?.getSeriesColor(config, series.name, index) ?? config.color; return <div className={selectedSeries?.name === series.name ? 'active' : ''} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', series.name) }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }} onDrop={(event) => { event.preventDefault(); const name = event.dataTransfer.getData('text/plain'); if (name) moveSeries(name, index) }} key={series.name}><span className="series-drag" title="Перетащить">⠿</span><button className="series-name-button" onClick={() => { setSelectedSeries({ name: series.name, color }); setSelectedElement(null); setSelectedAnnotation(null) }}><i style={{ background: color }}/><span>{series.name}</span></button><div className="series-order-buttons"><button disabled={index === 0} onClick={() => moveSeries(series.name, index - 1)} title="Переместить вперёд">↑</button><button disabled={index === chartSeries.length - 1} onClick={() => moveSeries(series.name, index + 1)} title="Переместить назад">↓</button></div><ColorControl compact title={`Цвет ряда ${series.name}`} value={color} swatches={pickerSwatches} onChange={(nextColor) => setConfig((current) => ({ ...current, seriesStyles: { ...current.seriesStyles, [series.name]: { ...current.seriesStyles[series.name], color: nextColor } } }))}/></div> })}</div></div></details>}
          </>}
          {chartPlugin.settings.sections.includes('annotations') && <div className="annotation-add-wrap"><div className="annotation-tools"><button onClick={addAnnotation}>＋ Текст</button><button onClick={() => addDecoration('area')}>▧ Фон</button><button onClick={() => addDecoration('line')}>╱ Прямая</button><button onClick={() => addDecoration('horizontal-line')}>— Горизонталь</button><button onClick={() => addDecoration('vertical-line')}>│ Вертикаль</button><button onClick={() => addDecoration('curved-line')}>⌒ Плавная</button></div><small>Текст, фоновые области и линии с настраиваемыми наконечниками</small>{!!config.decorations?.length && <div className="decoration-list">{config.decorations.map((decoration, index) => <button type="button" className={selectedDecoration === decoration.id ? 'active' : ''} key={decoration.id} onClick={() => { setSelectedDecoration(decoration.id); setSelectedAnnotation(null); setSelectedElement(null); setSelectedSeries(null) }}><i style={{ background: decoration.color }}/><span>{decorationLabels[decoration.type]} {index + 1}</span></button>)}</div>}</div>}
          {chartPlugin.settings.sections.includes('series') && <>
          {chartSeries.length <= 1 && config.kind !== 'waterfall' && <details className="settings-group" open><summary>Основное</summary><div><label>Цвет ряда<ColorControl value={config.seriesStyles[chartSeries[0]?.name ?? config.yField]?.color ?? config.color} swatches={pickerSwatches} onChange={(color) => setConfig((current) => ({ ...current, color, seriesStyles: { ...current.seriesStyles, [chartSeries[0]?.name ?? current.yField]: { ...current.seriesStyles[chartSeries[0]?.name ?? current.yField], color } } }))}/></label>{(isLineLikeChart(config.kind) || config.kind === 'scatter' || config.kind === 'bubble') && <MarkerSettings value={config.seriesStyles[chartSeries[0]?.name ?? config.yField] ?? {}} lineColor={config.seriesStyles[chartSeries[0]?.name ?? config.yField]?.color ?? config.color} onChange={(values) => setConfig((current) => ({ ...current, seriesStyles: { ...current.seriesStyles, [chartSeries[0]?.name ?? config.yField]: { ...current.seriesStyles[chartSeries[0]?.name ?? config.yField], ...values } } }))} alwaysVisible={config.kind === 'slope'} defaultSize={config.kind === 'slope' ? 11 : 8}/>}</div></details>}
          </>}
          {isBarChart(config.kind) && !isLollipopChart(config.kind) && selectedElement?.target !== "value-label" && <BarSelectionControls config={config} element={selectedElement} series={selectedSeries} color={selectedElement ? selectedElementColor : selectedSeries?.color} onElementChange={updateElement} onSeriesChange={updateSeries}/>}
          {chartPlugin.settings.features.scatterLayout && <ScatterSettings config={config} columns={table.columns} numericColumns={numericColumns} table={table} onChange={setConfig}/>}
          {config.kind === 'bubble' && <BubbleSizeLegendSettings config={config} onChange={setConfig}/>}
          {config.kind === 'heatmap' && <HeatmapSettings config={config} onChange={setConfig}/>}
          {config.kind === 'treemap' && <TreemapSettings config={config} onChange={setConfig}/>}
          {chartPlugin.settings.features.distributionLayout && <DistributionSettings config={config} table={table} onChange={setConfig}/>}
          {isLollipopChart(config.kind) && <LollipopSettings config={config} seriesNames={chartSeries.map((series) => series.name)} xKind={types[config.xField] === 'date' ? 'date' : types[config.xField] === 'number' ? 'number' : 'other'} onChange={setConfig}/>}
          {chartPlugin.settings.features.lineVariant && <LineVariantSettings config={config} numericColumns={numericColumns} table={table} onChange={setConfig}/>}
          <ChartSettingsPanel config={config} plugin={chartPlugin} seriesNames={chartSeries.map((series) => series.name)} valueLabels={valueLabels} xKind={types[config.xField] === 'date' ? 'date' : types[config.xField] === 'number' ? 'number' : 'other'} frequency={table.timeProfiles?.[config.xField]?.frequency} onChange={setConfig}/>
        </section><div className="settings-footer"><button className="button" onClick={() => setStep('chart')}>← Тип графика</button><button className="button" onClick={() => setStep('data')}>Данные</button></div></aside></Suspense>}
      </main>}
    </div>
  )
}

export default App
