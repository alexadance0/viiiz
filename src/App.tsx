import { SankeySettings } from './components/SankeySettings'
import { detachDecorationText } from './components/decorationGeometry'
import { samePlotConfig } from './core/chartPlotConfig'
import { AnnotationSettings, type AnnotationTool, type AnnotationPlacement } from './components/AnnotationSettings'
import { WaffleSettings } from './components/WaffleSettings'
import { isScatterChart, isPairedComparisonChart, isCompositionChart, isHorizontalChart } from './core/chartKinds'
import { PieSettings } from './components/PieSettings'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction, type Ref } from 'react'
import './App.css'
import './components/SeriesOrder.css'
import type { ChartCanvasHandle, ChartSettingsSection } from './components/ChartCanvas'
import { NumberInput } from './components/NumberInput'
import { DataReview } from './components/DataReview'
import { StyleTransferActions } from './components/StyleTransferActions'
import { MarkerSettings } from './components/MarkerSettings'
import { ChartTemplates } from './components/ChartTemplates'
import { SettingsCategoryTabs, type SettingsCategory } from './components/SettingsCategoryTabs'
import { SettingsCheckbox } from './components/SettingsCheckbox'
import { BarSelectionControls } from './components/BarSelectionControls'
import { BarAppearanceSettings } from './components/BarAppearanceSettings'
import { SeriesOrderList } from './components/SeriesOrderList'
import { ValueLabelFields, ValueLabelSelectionControls } from './components/ValueLabelSelectionControls'
import { TextStyleEditor } from './components/TextStyleEditor'
import { ColorControl } from './components/PickerControls'
import { ChartSettingsPanel } from './components/ChartSettingsPanel'
import { LineAppearanceFields, LineAppearanceSettings } from './components/LineAppearanceSettings'
import { HeroSymbolTrail } from './components/HeroSymbolTrail'
import './components/FileDropEffect.css'
import { CanvasSettings } from './components/CanvasSettings'
import { NumberFormatSettings } from './components/NumberFormatSettings'
import { ScatterSettings } from './components/ScatterSettings'
import { BubbleSizeLegendSettings } from './components/BubbleSizeLegendSettings'
import { ColorEncodingSettings } from './components/ColorEncodingSettings'
import { isNativeBarKind } from './features/chart-types/bar/compiler'
import { MapSettings } from './components/MapSettings'
import { inferMapRegionField, isMapChart, isTileMapChart, mapPresetForKind, mapChartPresets } from './features/chart-types/map/catalog'
import { HeatmapSettings } from './components/HeatmapSettings'
import { TreemapSettings } from './components/TreemapSettings'
import { LollipopSettings } from './components/LollipopSettings'
import { DistributionSettings } from './components/DistributionSettings'
import { LineVariantSettings } from './components/LineVariantSettings'
import { prepareChartData } from './core/chartData'
import { slopePositionKey } from './core/chartScale'
import { convertColumn, editCell, inferTypes, profileData, renameColumn } from './core/dataProfile'
import { mapDemoTables, sankeyDemoTable, categoricalDemoTable, demoTable, distributionDemoTable, dumbbellDemoTable, entrepreneurshipDifficultiesDemoTable } from './core/demoData'
import { normalizeInWorker } from './core/workerClient'
import { removeColumns, removeDuplicateRows, removeRows, transposeTable } from './core/dataQuality'
import type { ChartAnnotation, ChartConfig, ChartDecoration, ChartElementSelection, ChartKind, ChartPlugin, ChartSeriesSelection, ColumnType, DataTable } from './core/types'
import { distributionVisualDefaults, isBarChart, isDistributionChart as isDistributionKind, isLineLikeChart, isLollipopChart, isAreaChart, isStackedChart } from './core/chartKinds'
import { createDefaultChartConfig } from './entities/chart/model/defaultChartConfig'
import { useEditorHistory } from './features/editor/model/useEditorHistory'
import { EditorHeader } from './features/editor/ui/EditorHeader'
import { EditorStepper, type EditorStep } from './features/editor/ui/EditorStepper'
import { MultiplesControls } from './features/editor/ui/MultiplesControls'
import { MultiplesCanvas } from './features/editor/ui/MultiplesCanvas'
import { createPanelConfig, resizeMultiples, type Multiples } from './features/editor/model/multiples'
import { createRespondentGroupsDemoConfig, respondentGroupsDemoTable } from './features/editor/model/respondentGroupsDemo'
import { createTimeSeriesDemoConfig, keyRateDemoTable, usInflationDemoTable } from './features/editor/model/timeSeriesDemo'
import { createLifeExpectancyDemoConfig, lifeExpectancyDemoTable } from './features/editor/model/lifeExpectancyDemo'
import { createZywooDemoConfig, zywooDemoTable } from './features/editor/model/zywooDemo'
import { createRussiaTurnoutDemoConfig, russiaTurnoutDemoTable } from './features/editor/model/russiaTurnoutDemo'
import { createUsBornInSameStateDemoConfig, usBornInSameStateDemoTable } from './features/editor/model/usBornInSameStateDemo'
import { createPutinVisitsEuropeDemoConfig, putinVisitsEuropeDemoTable } from './features/editor/model/putinVisitsEuropeDemo'
import { createAiComputeScatterDemoConfig, aiComputeScatterDemoTable } from './features/editor/model/aiComputeScatterDemo'
import { createF1ConstructorsDemoConfig, f1ConstructorsDemoTable } from './features/editor/model/f1ConstructorsDemo'
import { createTrumpSankeyDemoConfig } from './features/editor/model/trumpSankeyDemo'
import { createStreamGraphDemoConfig, streamGraphDemoTable } from './features/editor/model/streamGraphDemo'
import { ChartTypePicker } from './features/editor/ui/ChartTypePicker'
import { inferScatterOrderField, inferBubbleSizeField } from './features/chart-types/xy/inference'
import { CircleAlert, CircleX, FileUp, History, Minus, Plus, RotateCcw, RotateCw, Sheet, SlidersHorizontal } from 'lucide-react'

const loadChartCanvas = () => import('./components/ChartCanvas')
const loadChartRegistry = () => import('./core/chartRegistry')
const preloadChartEditor = () => Promise.all([
  loadChartCanvas(),
  loadChartRegistry(),
  import('./components/echarts/loadEchartsForKind').then(({ preloadAllEcharts }) => preloadAllEcharts()),
])
const ChartCanvas = lazy(() => loadChartCanvas().then(({ ChartCanvas }) => ({ default: ChartCanvas })))
const DateFormatDialog = lazy(() => import('./components/DateFormatDialog').then(({ DateFormatDialog }) => ({ default: DateFormatDialog })))
const DataTransformDialog = lazy(() => import('./components/DataTransformDialog').then(({ DataTransformDialog }) => ({ default: DataTransformDialog })))
const ExcelSheetDialog = lazy(() => import('./components/ExcelSheetDialog').then(({ ExcelSheetDialog }) => ({ default: ExcelSheetDialog })))

interface HistorySnapshot { table: DataTable; types: Record<string, ColumnType>; config: ChartConfig; label: string; time: number }
type CopiedStyle = { kind: 'series'; style: ChartConfig['seriesStyles'][string] } | { kind: 'element'; style: ChartConfig['elementStyles'][string] }
type ChartModeState = Pick<ChartConfig, 'showXAxisTitle' | 'showYAxisTitle' | 'showXAxisLine' | 'showYAxisLine' | 'showXTicks' | 'showYTicks' | 'showHorizontalGrid' | 'showVerticalGrid' | 'showValues' | 'showLegend' | 'showDirectLabels'>
const chartModeKeys = ['showXAxisTitle', 'showYAxisTitle', 'showXAxisLine', 'showYAxisLine', 'showXTicks', 'showYTicks', 'showHorizontalGrid', 'showVerticalGrid', 'showValues', 'showLegend', 'showDirectLabels'] as const
export const chartModeState = (config: ChartConfig) => Object.fromEntries(chartModeKeys.map((key) => [key, config[key]])) as ChartModeState
const axisGridDefaults = (kind: ChartKind): Partial<ChartModeState> => isScatterChart(kind)
  ? { showXAxisLine: true, showYAxisLine: true, showHorizontalGrid: true, showVerticalGrid: true }
  : isHorizontalChart(kind)
  ? { showXAxisLine: true, showYAxisLine: false, showHorizontalGrid: false, showVerticalGrid: true }
  : isDistributionKind(kind)
  ? { showXAxisLine: true, showYAxisLine: false, showXTicks: true, showYTicks: false, showHorizontalGrid: true, showVerticalGrid: false }
  : { showXAxisLine: true, showYAxisLine: false, showHorizontalGrid: true, showVerticalGrid: false }
const defaultChartMode = chartModeState(createDefaultChartConfig())
export const chartModeDefaults = (kind: ChartKind): ChartModeState => ({
  ...defaultChartMode,
  ...axisGridDefaults(kind),
  ...(kind === 'histogram' || kind === 'kde-plot' ? { showLegend: true } : {}),
  ...(kind === 'slope' ? { showValues: true, showLegend: false, showDirectLabels: false, showYAxisTitle: false, showYAxisLine: false, showYTicks: false, showHorizontalGrid: false } : {}),
  ...(kind === 'marimekko' ? { showValues: true, showLegend: true, showDirectLabels: false, showXAxisTitle: false, showYAxisTitle: false, showXTicks: false, showHorizontalGrid: false } : {}),
  ...(kind === 'stream-graph' ? { showLegend: false, showDirectLabels: true, showValues: false, showYAxisLabels: false, showYAxisTitle: false, showYAxisLine: false, showYTicks: false, showHorizontalGrid: false } : {}),
  ...(kind === 'bump' ? { showLegend: false, showDirectLabels: true, showValues: false } : {}),
  ...(kind === 'heatmap' ? { showYAxisTitle: false } : {}),
  ...(isMapChart(kind) || kind === 'treemap' || kind === 'sankey' ? { showXAxisTitle: false, showYAxisTitle: false, showXAxisLine: false, showYAxisLine: false, showXTicks: false, showYTicks: false, showHorizontalGrid: false, showVerticalGrid: false, showValues: !isMapChart(kind), showLegend: false, showDirectLabels: false } : {}),
})
// A chart switch keeps the document and data, but starts a fresh visual setup.
export function resetChartPresentation(previous: ChartConfig): ChartConfig {
  const next = createDefaultChartConfig()
  const documentKeys = [
    'canvasPreset', 'canvasWidth', 'canvasHeight', 'canvasBackground', 'autoFitCanvas',
    'canvasMarginTop', 'canvasMarginRight', 'canvasMarginBottom', 'canvasMarginLeft',
    'title', 'subtitle', 'note', 'source', 'titleHtml', 'subtitleHtml', 'noteHtml', 'sourceHtml',
    'titleText', 'subtitleText', 'noteText', 'sourceText', 'showTitle', 'showSubtitle', 'showNote', 'showSource',
    'titleSubtitleGap', 'headerPlotGap', 'headerLegendGap', 'legendPlotGap', 'plotFooterGap', 'noteSourceGap',
    'palette', 'paletteName', 'paletteBaseColor', 'paletteGradientColors', 'paletteGradientSteps', 'paletteReversed', 'color', 'customFonts',
    'xField', 'yField', 'yFields', 'seriesField', 'preferredDataSelection', 'aggregation', 'distributionGroupField',
  ] as const
  return { ...next, ...Object.fromEntries(documentKeys.map((key) => [key, previous[key]])), xAxisTitle: previous.xField, yAxisTitle: previous.yField } as ChartConfig
}
export const shouldHideXAxisTitle = (kind: ChartKind, xFieldType: ColumnType | undefined) => xFieldType === 'date' && !isScatterChart(kind)
export const compatibleMeasureSelection = (selected: string[], available: string[], fallback: string) => {
  const compatible = selected.filter((field) => available.includes(field))
  return compatible.length ? compatible : [available[0] ?? fallback]
}
export const rememberDataSelection = (previous: ChartConfig, next: ChartConfig): ChartConfig => {
  if (previous.xField === next.xField && previous.yFields === next.yFields && previous.seriesField === next.seriesField) return next
  return { ...next, preferredDataSelection: { xField: next.xField, yFields: [...next.yFields], seriesField: next.seriesField } }
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
  const [documentConfig, setDocumentConfig] = useState(createDefaultChartConfig)
  const [wantsMultiples, setMultiplesMode] = useState(false)
  const multiplesMode = wantsMultiples && !!documentConfig.multiples
  const [selectedPanel, setSelectedPanel] = useState<number | null>(null)
  const lastSelectedPanel = useRef<number | null>(null)
  const activePanel = multiplesMode && (step === 'chart' || step === 'design') && selectedPanel !== null ? documentConfig.multiples?.panels[selectedPanel] : null
  const config = activePanel?.config ?? documentConfig
  const plotConfigRef = useRef(config)
  if (!samePlotConfig(plotConfigRef.current, config)) plotConfigRef.current = config
  const plotConfig = plotConfigRef.current
  const editingPanelIndex = activePanel ? selectedPanel : null
  const setConfig: Dispatch<SetStateAction<ChartConfig>> = useCallback((action) => setDocumentConfig((current) => {
    const panel = editingPanelIndex !== null ? current.multiples?.panels[editingPanelIndex] : null
    if (!panel || editingPanelIndex === null || !current.multiples) return typeof action === 'function' ? action(current) : action
    const next = typeof action === 'function' ? action(panel.config) : action
    return { ...current, multiples: { ...current.multiples, panels: current.multiples.panels.map((item, index) => index === editingPanelIndex ? { ...panel, config: next } : item) } }
  }), [editingPanelIndex])
  const [sheetUrl, setSheetUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [dateFormatColumn, setDateFormatColumn] = useState<string | null>(null)
  const [showTransformDialog, setShowTransformDialog] = useState(false)
  const [excelWorkbook, setExcelWorkbook] = useState<{ fileName: string; sheets: Array<{ name: string; table: DataTable }>; source?: string } | null>(null)
  const [directLabelControlsHost, setDirectLabelControlsHost] = useState<HTMLDivElement | null>(null)
  const [fileDragging, setFileDragging] = useState(false)
  const fileDragDepth = useRef(0)
  const fileDragOrigin = useRef<{ x: number; y: number } | null>(null)
  const [fileDropBurst, setFileDropBurst] = useState(false)
  const fileDropBurstTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (fileDropBurstTimer.current) clearTimeout(fileDropBurstTimer.current) }, [])
  const [selectedElement, setSelectedElement] = useState<ChartElementSelection | null>(null)
  const [selectedSeries, setSelectedSeries] = useState<ChartSeriesSelection | null>(null)
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null)
  const [decorationLayouts, setDecorationLayouts] = useState<ChartDecoration[]>([])
  const updateDecorationLayouts = useCallback((layouts: ChartDecoration[]) => setDecorationLayouts((current) => JSON.stringify(current) === JSON.stringify(layouts) ? current : layouts), [])
  const [pickingDecorationEndpoint, setPickingDecorationEndpoint] = useState<'start' | 'end'>('end')
  const [pickingDecorationAnchor, setPickingDecorationAnchor] = useState<'text' | 'data' | null>(null)
  const [annotationTool, setAnnotationTool] = useState<AnnotationTool | null>(null)
  const [panelCanvasSize, setPanelCanvasSize] = useState({ width: 1000, height: 563 })
  const updatePanelCanvasSize = useCallback((width: number, height: number) => setPanelCanvasSize((current) => current.width === width && current.height === height ? current : { width, height }), [])
  const annotationCanvasWidth = activePanel ? panelCanvasSize.width : Math.min(1000, config.canvasWidth ?? 1000)
  const annotationCanvasHeight = activePanel ? panelCanvasSize.height : Math.min(1000, config.canvasHeight ?? 563)
  const [selectedDecoration, setSelectedDecoration] = useState<string | null>(null)
  const [selectedSettingsSection, setSelectedSettingsSection] = useState<ChartSettingsSection | null>(null)
  const [settingsCategory, setSettingsCategory] = useState<SettingsCategory>('chart')
  useEffect(() => { if (settingsCategory !== 'annotations' || step !== 'design') { setAnnotationTool(null); setPickingDecorationAnchor(null) } }, [settingsCategory, step])
  useEffect(() => {
    const decoration = config.decorations?.find((item) => item.id === selectedDecoration)
    if (pickingDecorationAnchor && (!decoration || decoration.hidden || decoration.locked || pickingDecorationAnchor === 'text' && !config.annotations.some((item) => !item.hidden))) setPickingDecorationAnchor(null)
  }, [config.annotations, config.decorations, selectedDecoration, pickingDecorationAnchor])
  const [copiedStyle, setCopiedStyle] = useState<CopiedStyle | null>(null)
  const [canvasZoom, setCanvasZoom] = useState(1)
  const [showCanvasHint, setShowCanvasHint] = useState(() => {
    try { return window.localStorage.getItem('viiiz-canvas-hint-seen') !== '1' } catch { return true }
  })
  const [chartModule, setChartModule] = useState<typeof import('./core/chartRegistry') | null>(null)
  const dataHistory = useEditorHistory<HistorySnapshot>(20)
  const designHistory = useEditorHistory<ChartConfig>(100)
  const { past, future } = dataHistory
  const { past: designPast, future: designFuture } = designHistory
  const { push: pushDesignHistory, discardFuture: discardDesignFuture } = designHistory
  const previousDesignConfig = useRef(documentConfig)
  const skipDesignHistory = useRef(false)
  const lastDesignCommit = useRef(0)
  const lastDesignChange = useRef('')
  const processingController = useRef<AbortController | null>(null)
  const importSequence = useRef(0)
  const chartRef = useRef<ChartCanvasHandle>(null)
  const multiplesRef = useRef<ChartCanvasHandle>(null)
  const issues = useMemo(() => profileData(table, types), [table, types])
  const numericColumns = useMemo(() => table.columns.filter((column) => types[column] === 'number'), [table.columns, types])
  const chartSeries = useMemo(() => {
    const config = plotConfig
    if (step !== 'chart' && step !== 'design') return []
    if (isCompositionChart(config.kind)) {
      const plugin = chartModule?.getChartPlugin(config.kind)
      if (!plugin?.validate(table, config).ok) return []
      const plot = plugin.compile(table, config).plot
      return (plot.kind === 'pie' || plot.kind === 'waffle') ? plot.slices.map((slice) => ({ name: slice.name, data: [slice.value] })) : []
    }
    if (isScatterChart(config.kind)) {
      const plugin = chartModule?.getChartPlugin(config.kind)
      if (!plugin?.validate(table, config).ok) return []
      const plot = plugin.compile(table, config).plot
      return plot.kind === 'xy' ? plot.series.map((series) => ({ name: series.name, color: series.color, data: series.points.map((point) => point.y) })) : []
    }
    if (config.kind === 'stream-graph' && chartModule) {
      const plugin = chartModule.getChartPlugin(config.kind)
      if (!plugin.validate(table, config).ok) return []
      const plot = plugin.compile(table, config).plot
      if (plot.kind === 'area') return [...plot.series].reverse().map((series) => ({ name: series.name, color: series.color, data: series.points.map((point) => point.value) }))
    }
    const series = prepareChartData(table, config).series.map((series, index) => ({ ...series, color: chartModule?.getSeriesColor(config, series.name, index) ?? config.color }))
    if (!config.seriesOrder?.length) return isStackedChart(config.kind) ? [...series].reverse() : series
    const positions = new Map(config.seriesOrder.map((name, index) => [name, index]))
    const ordered = [...series].sort((left, right) => (positions.get(left.name) ?? Number.MAX_SAFE_INTEGER) - (positions.get(right.name) ?? Number.MAX_SAFE_INTEGER))
    return isStackedChart(config.kind) ? ordered.reverse() : ordered
  }, [step, table, plotConfig, chartModule])
  const chartPlugin = useMemo(() => chartModule?.getChartPlugin(config.kind) ?? null, [chartModule, config.kind])
  const valueLabels = useMemo(() => step === 'chart' || step === 'design' ? chartModule?.chartValueLabelSelections(table, plotConfig) ?? [] : [], [step, chartModule, table, plotConfig])
  useEffect(() => { if ((isMapChart(config.kind) || config.kind === 'sankey' || config.kind === 'treemap' || isCompositionChart(config.kind)) && settingsCategory === 'axes') setSettingsCategory('chart') }, [config.kind, settingsCategory])
  useEffect(() => { if (selectedSeries || selectedElement) setSettingsCategory('chart') }, [selectedElement, selectedSeries])
  useEffect(() => { if (selectedAnnotation || selectedDecoration) setSettingsCategory('annotations') }, [selectedAnnotation, selectedDecoration])
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
    void loadChartRegistry().then((module) => setChartModule(module))
  }, [chartModule, step])

  useEffect(() => {
    if (step !== 'data') return
    let active = true
    const timer = window.setTimeout(() => {
      void preloadChartEditor().then(([, module]) => {
        if (active) setChartModule((current) => current ?? module)
      })
    }, 150)
    return () => { active = false; window.clearTimeout(timer) }
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
  }, [chartSeries, config.kind, setConfig])

  useEffect(() => () => processingController.current?.abort(), [])

  useEffect(() => { const update = (event: Event) => setCanvasZoom((event as CustomEvent<number>).detail); window.addEventListener('canvas-view-zoom', update); return () => window.removeEventListener('canvas-view-zoom', update) }, [])

  useEffect(() => {
    if (skipDesignHistory.current) { skipDesignHistory.current = false; previousDesignConfig.current = documentConfig; return }
    if (step !== 'chart' && step !== 'design') { previousDesignConfig.current = documentConfig; return }
    const previous = previousDesignConfig.current
    if (previous === documentConfig) return
    const now = Date.now()
    const change = designChangeKey(previous, documentConfig) + (documentConfig.multiples !== previous.multiples ? `:${selectedPanel}:${JSON.stringify([documentConfig.multiples?.columns, documentConfig.multiples?.rows, documentConfig.multiples?.gap, documentConfig.multiples?.panels.map((panel) => panel?.id)])}:${activePanel && selectedPanel !== null && previous.multiples?.panels[selectedPanel] ? designChangeKey(previous.multiples.panels[selectedPanel]!.config, activePanel.config) : ''}` : '')
    if (change !== lastDesignChange.current || now - lastDesignCommit.current > 350) pushDesignHistory(structuredClone(previous))
    else discardDesignFuture()
    lastDesignCommit.current = now
    lastDesignChange.current = change
    previousDesignConfig.current = documentConfig
  }, [documentConfig, discardDesignFuture, pushDesignHistory, step, selectedPanel, activePanel])

  const undoDesign = () => {
    const previous = designHistory.undo(structuredClone(documentConfig)); if (!previous) return
    skipDesignHistory.current = true; lastDesignCommit.current = 0; lastDesignChange.current = ''
    setDocumentConfig(previous)
  }
  const redoDesign = () => {
    const next = designHistory.redo(structuredClone(documentConfig)); if (!next) return
    skipDesignHistory.current = true; lastDesignCommit.current = 0; lastDesignChange.current = ''
    setDocumentConfig(next)
  }
  const clearCanvasSelection = () => {
    setAnnotationTool(null); setPickingDecorationAnchor(null)
    setSelectedElement(null); setSelectedSeries(null); setSelectedAnnotation(null); setSelectedDecoration(null); setSelectedSettingsSection(null)
  }
  const selectPanel = (index: number | null) => { clearCanvasSelection(); if (index !== null) lastSelectedPanel.current = index; setSelectedPanel(index) }
  const selectLastPanel = () => {
    const panels = documentConfig.multiples?.panels ?? []
    const previous = lastSelectedPanel.current
    const index = previous !== null && panels[previous] ? previous : panels.findIndex(Boolean)
    selectPanel(index >= 0 ? index : null)
  }
  const updateMultiples: Dispatch<SetStateAction<Multiples>> = (action) => setDocumentConfig((current) => ({ ...current, multiples: typeof action === 'function' ? action(current.multiples!) : action }))
  const addPanel = (index: number) => {
    const grid = documentConfig.multiples!
    const panels = [...grid.panels]
    const base = { ...documentConfig, multiples: undefined }
    panels[index] = { id: crypto.randomUUID(), config: createPanelConfig(base, `График ${index + 1}`) }
    updateMultiples(resizeMultiples({ ...grid, panels }, grid.columns, grid.rows)); selectPanel(index)
  }
  const changeCompositionMode = (enabled: boolean) => {
    clearCanvasSelection(); setSelectedPanel(null); setMultiplesMode(enabled)
    if (enabled && !documentConfig.multiples) setDocumentConfig((current) => ({ ...current, multiples: { columns: 2, rows: 2, gap: 24, panels: [null, null, null, null] } }))
  }
  const modeControls = <div className="composition-mode" role="group" aria-label="Композиция"><button aria-pressed={!multiplesMode} onClick={() => changeCompositionMode(false)}>Один график</button><button aria-pressed={multiplesMode} onClick={() => changeCompositionMode(true)}>Сетка графиков</button></div>
  const designScopeControls = multiplesMode && <div className="design-scope-switch"><div className="composition-mode" role="group" aria-label="Область настройки"><button aria-pressed={!!activePanel} disabled={!documentConfig.multiples?.panels.some(Boolean)} onClick={selectLastPanel}>Графики</button><button aria-pressed={!activePanel} onClick={() => selectPanel(null)}>Вся композиция</button></div></div>
  const compositionControls = multiplesMode && documentConfig.multiples ? <MultiplesControls config={documentConfig} selected={activePanel ? selectedPanel : null} scope={step === 'design' ? activePanel ? 'graphs' : 'composition' : 'setup'} onChange={updateMultiples} onSelect={selectPanel} onAdd={addPanel}/> : null
  const dismissCanvasHint = () => {
    setShowCanvasHint(false)
    try { window.localStorage.setItem('viiiz-canvas-hint-seen', '1') } catch { /* Storage may be unavailable in private contexts. */ }
  }
  const changeCanvasZoom = (next: number) => setCanvasZoom(Math.min(5, Math.max(.1, Number(next.toFixed(2)))))

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
    dismissCanvasHint()
    setSelectedAnnotation(null); setSelectedDecoration(null)
    if (section === 'values') { setSelectedElement(null); setSelectedSeries(null) }
    const sectionCapability: Partial<Record<ChartSettingsSection, ChartPlugin['settings']['sections'][number]>> = {
      title: 'headings', subtitle: 'headings', 'x-axis-title': 'axes', 'y-axis-title': 'axes', 'x-axis-labels': 'axes', 'y-axis-labels': 'axes', grid: 'grid', legend: 'legend-values', values: 'legend-values', note: 'credits', source: 'credits', series: 'series', element: 'series',
    }
    const capability = sectionCapability[section]
    if (capability && !chartPlugin.settings.sections.includes(capability)) return
    setSettingsCategory(section === 'title' || section === 'subtitle' || section === 'note' || section === 'source' ? 'text'
      : section === 'x-axis-title' || section === 'y-axis-title' || section === 'x-axis-labels' || section === 'y-axis-labels' || section === 'grid' ? 'axes'
      : 'chart')
    setSelectedSettingsSection(section)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (section === 'series' || section === 'element') {
        document.querySelector(`.settings-panel .${section === 'series' ? 'series-editor' : 'element-editor'}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        return
      }
      const targets: Record<Exclude<ChartSettingsSection, 'series' | 'element'>, { group: string; field?: string }> = {
        title: { group: 'Заголовок и подзаголовок', field: 'Заголовок' }, subtitle: { group: 'Заголовок и подзаголовок', field: 'Подзаголовок' },
        'x-axis-title': { group: 'Положение и подписи', field: 'Текст оси X' }, 'y-axis-title': { group: 'Положение и подписи', field: 'Текст оси Y' },
        'x-axis-labels': { group: 'Стиль текста осей', field: 'Подписи шкалы X' }, 'y-axis-labels': { group: 'Стиль текста осей', field: 'Подписи шкалы Y' },
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
  const reconcileChartConfig = (nextTable: DataTable, nextTypes: Record<string, ColumnType>, config: ChartConfig = documentConfig): ChartConfig => {
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
    const preferred = config.preferredDataSelection ?? { xField: config.xField, yFields: config.yFields, seriesField: config.seriesField }
    return {
      ...config,
      multiples: config.multiples ? { ...config.multiples, panels: config.multiples.panels.map((panel) => panel ? { ...panel, config: reconcileChartConfig(nextTable, nextTypes, panel.config) } : null) } : undefined,
      preferredDataSelection: {
        xField: nextTable.columns.includes(preferred.xField) ? preferred.xField : xField,
        yFields: compatibleMeasureSelection(preferred.yFields, numeric, reconciledFields[0] ?? nextTable.columns[0]),
        seriesField: nextTable.columns.includes(preferred.seriesField) ? preferred.seriesField : '',
      },
      xField,
      yField: reconciledFields[0] ?? nextTable.columns[0],
      yFields: reconciledFields.length ? reconciledFields : [nextTable.columns[0]],
      seriesField: nextTable.columns.includes(config.seriesField) ? config.seriesField : '',
      scatterSizeField: numeric.includes(config.scatterSizeField ?? '') ? config.scatterSizeField : undefined,
      scatterOrderField: nextTable.columns.includes(config.scatterOrderField ?? '') ? config.scatterOrderField : undefined,
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
      sankeyTargetField: nextTable.columns.includes(config.sankeyTargetField ?? '') ? config.sankeyTargetField : undefined,
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
    lastSelectedPanel.current = null
    setMultiplesMode(false); setSelectedPanel(null); setTable(normalized); setTypes(nextTypes); dataHistory.clear(); designHistory.clear(); setHasData(true); setStep('data')
    setConfig((previous) => { const value = initialKind && previous.kind !== initialKind ? resetChartPresentation(previous) : previous; const yFields = initialKind === 'bump' || initialKind === 'marimekko' ? normalized.columns.filter((column) => nextTypes[column] === 'number' && column !== normalized.columns[0]) : initialKind && isDistributionKind(initialKind) ? normalized.columns.filter((column) => nextTypes[column] === 'number') : [numeric]; return { ...value, multiples: undefined, ...(initialKind ? { kind: initialKind, ...chartModeDefaults(initialKind), ...(isDistributionKind(initialKind) ? distributionVisualDefaults(initialKind) : {}), ...(initialKind && isMapChart(initialKind) ? { heatmapScaleMode: 'sequential' as const, heatmapLowColor: '#edf2f7', heatmapHighColor: '#1923e3', aggregation: 'sum' as const, mapShowNames: isTileMapChart(initialKind), title: mapChartPresets.find((preset) => preset.kind === initialKind)?.label ?? 'Карта', subtitle: 'Сравнение территорий · условные данные', note: '', source: initialKind === 'tilemap-world' ? 'Раскладка: Jon Schwabish / Mustafa Saifee · CC BY-SA 4.0' : initialKind.startsWith('tilemap-') ? '' : 'Геометрия: Natural Earth' } : {}), ...(initialKind === 'marimekko' ? { aggregation: 'sum' as const, yAxisScaleType: 'linear' as const, xAxisLabelRotate: 0 as const, xAxisLabelOverflow: 'wrap' as const, title: 'Размер рынков и доли брендов', subtitle: 'Ширина — объём рынка · высота — доля бренда', note: '', source: 'Условные данные' } : {}), ...(initialKind === 'bump' ? { bumpMode: 'value' as const, title: 'Как менялись позиции брендов', subtitle: 'Рейтинг по продажам · условные данные', note: '', source: '' } : {}), ...(initialKind === 'sankey' ? { sankeyTargetField: normalized.columns[1], aggregation: 'sum' as const, title: 'Как распределяется поток', subtitle: '', note: '', source: '' } : {}), ...(initialKind === 'treemap' ? { treemapSubcategoryField: normalized.columns[1], aggregation: 'sum' as const, title: 'Трудности бизнеса', subtitle: 'Открытый вопрос, до 5 ответов, % от всех опрошенных', note: 'Молодые предприниматели 18–35 лет, 30 апреля — 9 мая 2025 года, n = 923', source: 'Источник: ВЦИОМ, 2025' } : {}) } : {}), preferredDataSelection: { xField: normalized.columns[0], yFields, seriesField: '' }, xField: normalized.columns[0], yField: numeric, yFields, seriesField: '', distributionGroupField: undefined, xAxisTitle: normalized.columns[0], yAxisTitle: numeric } })
    setProcessingProgress(100)
  }

  const run = async (task: () => Promise<DataTable>, initialKind?: ChartKind, initialConfig?: ChartConfig) => {
    const sequence = ++importSequence.current
    processingController.current?.abort()
    setLoading(true); setError('')
    try {
      const next = await task()
      if (initialConfig) await preloadChartEditor()
      if (sequence !== importSequence.current) return
      await applyTable(next, initialKind)
      if (initialConfig && sequence === importSequence.current) {
        skipDesignHistory.current = true
        clearCanvasSelection(); setDocumentConfig(initialConfig); setMultiplesMode(!!initialConfig.multiples); setSelectedPanel(null); setStep(initialConfig.multiples ? 'design' : 'data')
      }
    } catch (cause) {
      if (sequence === importSequence.current && !(cause instanceof DOMException && cause.name === 'AbortError')) setError(cause instanceof Error ? cause.message : 'Ошибка импорта')
    } finally {
      if (sequence === importSequence.current) { setLoading(false); processingController.current = null }
    }
  }

  const openFile = async (file: File) => {
    setExcelWorkbook(null)
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

  const fileDropHandler = useRef(openFile)
  fileDropHandler.current = openFile
  useEffect(() => {
    if (step !== 'source') { fileDragDepth.current = 0; setFileDragging(false); return }
    const isFile = (event: DragEvent) => event.dataTransfer?.types.includes('Files')
    const enter = (event: DragEvent) => {
      if (!isFile(event)) return
      event.preventDefault(); fileDragDepth.current += 1
      if (fileDragDepth.current === 1) fileDragOrigin.current = { x: event.clientX, y: event.clientY }
      if (!loading) setFileDragging(true)
    }
    const over = (event: DragEvent) => {
      if (!isFile(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = loading ? 'none' : 'copy'
    }
    const leave = () => {
      fileDragDepth.current = Math.max(0, fileDragDepth.current - 1)
      if (!fileDragDepth.current) setFileDragging(false)
    }
    const drop = (event: DragEvent) => {
      if (!isFile(event)) return
      const wasDragging = fileDragDepth.current > 0
      event.preventDefault(); fileDragDepth.current = 0; setFileDragging(false)
      if (loading) return
      const files = event.dataTransfer?.files
      if (!files?.length) return
      if (files.length > 1) { setError('Перетащите один файл за раз.'); return }
      if (!wasDragging) fileDragOrigin.current = { x: event.clientX || window.innerWidth / 2, y: event.clientY || window.innerHeight / 2 }
      if (fileDropBurstTimer.current) clearTimeout(fileDropBurstTimer.current)
      setFileDropBurst(true)
      fileDropBurstTimer.current = setTimeout(() => setFileDropBurst(false), 850)
      void fileDropHandler.current(files[0])
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [step, loading])

  const changeType = (column: string, type: ColumnType) => {
    commitTable(convertColumn(table, column, type), { ...types, [column]: type }, `Тип «${column}» → ${type}`)
  }

  const changeName = (oldName: string, newName: string) => {
    const renamed = renameColumn(table, oldName, newName)
    if (renamed === table) return
    const clean = newName.trim()
    const nextTypes = { ...types, [clean]: types[oldName] }; delete nextTypes[oldName]
    const renameConfigFields = (config: ChartConfig): ChartConfig => {
      const renamesSeries = !config.seriesField && config.yFields.includes(oldName)
      const seriesStyles = renamesSeries && config.seriesStyles[oldName]
        ? Object.fromEntries(Object.entries(config.seriesStyles).map(([name, style]) => [name === oldName ? clean : name, style]))
        : config.seriesStyles
      const elementStyles = renamesSeries
        ? Object.fromEntries(Object.entries(config.elementStyles).map(([key, style]) => [key.startsWith(`${oldName}\u001f`) ? `${clean}${key.slice(oldName.length)}` : key, style]))
        : config.elementStyles
      const seriesOrder = renamesSeries ? config.seriesOrder?.map((name) => name === oldName ? clean : name) : config.seriesOrder
      const intervalGroups = config.intervalGroups?.map((group) => ({ ...group, main: group.main === oldName ? clean : group.main, lower: group.lower === oldName ? clean : group.lower, upper: group.upper === oldName ? clean : group.upper }))
      const preferredDataSelection = config.preferredDataSelection ? { xField: config.preferredDataSelection.xField === oldName ? clean : config.preferredDataSelection.xField, yFields: config.preferredDataSelection.yFields.map((field) => field === oldName ? clean : field), seriesField: config.preferredDataSelection.seriesField === oldName ? clean : config.preferredDataSelection.seriesField } : undefined
      const nextConfig = { ...config, colorEncoding: config.colorEncoding?.field === oldName ? { ...config.colorEncoding, field: clean } : config.colorEncoding, xField: config.xField === oldName ? clean : config.xField, yField: config.yField === oldName ? clean : config.yField, yFields: config.yFields.map((field) => field === oldName ? clean : field), seriesField: config.seriesField === oldName ? clean : config.seriesField, preferredDataSelection, butterflyLeftFields: config.butterflyLeftFields?.map((field) => field === oldName ? clean : field), butterflyRightFields: config.butterflyRightFields?.map((field) => field === oldName ? clean : field), sankeyTargetField: config.sankeyTargetField === oldName ? clean : config.sankeyTargetField, heatmapYField: config.heatmapYField === oldName ? clean : config.heatmapYField, treemapSubcategoryField: config.treemapSubcategoryField === oldName ? clean : config.treemapSubcategoryField, rangeLowerField: config.rangeLowerField === oldName ? clean : config.rangeLowerField, rangeUpperField: config.rangeUpperField === oldName ? clean : config.rangeUpperField, dumbbellStartField: config.dumbbellStartField === oldName ? clean : config.dumbbellStartField, dumbbellEndField: config.dumbbellEndField === oldName ? clean : config.dumbbellEndField, scatterOrderField: config.scatterOrderField === oldName ? clean : config.scatterOrderField, scatterLabelField: config.scatterLabelField === oldName ? clean : config.scatterLabelField, distributionLabelField: config.distributionLabelField === oldName ? clean : config.distributionLabelField, xAxisTitle: config.xAxisTitle === oldName ? clean : config.xAxisTitle, yAxisTitle: config.yAxisTitle === oldName ? clean : config.yAxisTitle, seriesStyles, elementStyles, seriesOrder, intervalGroups }
      return { ...nextConfig, multiples: config.multiples ? { ...config.multiples, panels: config.multiples.panels.map((panel) => panel ? { ...panel, config: renameConfigFields(panel.config) } : null) } : undefined }
    }
    const nextConfig = renameConfigFields(config)
    commitTable(renamed, nextTypes, `Столбец «${oldName}» переименован`, nextConfig)
  }

  const chooseChart = (kind: ChartKind) => {
    const plugin = chartModule?.getChartPlugin(kind)
    if (!plugin) return
    setConfig((previous) => {
      if (previous.kind === kind) return previous
      const value = resetChartPresentation(previous)
      const connectedXField = numericColumns.includes(value.xField) ? value.xField : numericColumns.length >= 2 ? numericColumns[0] : types[value.xField] === 'date' ? value.xField : numericColumns[0] ?? value.xField
      const targetXField = kind === 'connected-scatter' ? connectedXField : isMapChart(kind) ? inferMapRegionField(table, mapPresetForKind(kind)) : kind === 'seasonal-line' && types[value.xField] !== 'date' ? table.columns.find((column) => types[column] === 'date') ?? value.xField : value.xField
      const distributionKind = isDistributionKind(kind)
      const measures = distributionKind ? numericColumns : numericColumns.filter((column) => column !== targetXField)
      const preferred = value.preferredDataSelection ?? { xField: value.xField, yFields: value.yFields, seriesField: value.seriesField }
      const preservedMeasures = compatibleMeasureSelection(preferred.yFields, measures, value.yField)
      const pair = [...preservedMeasures, ...measures].filter((field, index, fields) => fields.indexOf(field) === index).slice(0, 2)
      const triple = [...preservedMeasures, ...measures].filter((field, index, fields) => fields.indexOf(field) === index).slice(0, 3)
      const bubbleSizeField = inferBubbleSizeField(table, targetXField, preservedMeasures, value.scatterSizeField)
      const roleDefaults = isMapChart(kind)
        ? { ...chartModeDefaults(kind), mapShowNames: isTileMapChart(kind), xField: targetXField, yFields: [preservedMeasures[0]], yField: preservedMeasures[0], seriesField: '', aggregation: 'sum' as const, heatmapScaleMode: isMapChart(value.kind) || value.kind === 'heatmap' ? value.heatmapScaleMode ?? 'sequential' as const : 'sequential' as const, heatmapLowColor: isMapChart(value.kind) || value.kind === 'heatmap' ? value.heatmapLowColor ?? '#edf2f7' : '#edf2f7', heatmapHighColor: isMapChart(value.kind) || value.kind === 'heatmap' ? value.heatmapHighColor ?? '#1923e3' : '#1923e3' }
        : kind === 'marimekko'
        ? { ...chartModeDefaults(kind), xField: targetXField, yFields: preferred.seriesField ? preservedMeasures.slice(0, 1) : preservedMeasures.length >= 2 ? preservedMeasures : pair, yField: preservedMeasures[0], seriesField: preferred.seriesField && table.columns.includes(preferred.seriesField) ? preferred.seriesField : '', aggregation: 'sum' as const, yAxisScaleType: 'linear' as const, xAxisLabelRotate: 0 as const, xAxisLabelOverflow: 'wrap' as const }
        : kind === 'bump'
        ? { ...chartModeDefaults(kind), yFields: preferred.seriesField ? preservedMeasures.slice(0, 1) : preservedMeasures.length >= 2 ? preservedMeasures : pair, yField: preservedMeasures[0], seriesField: preferred.seriesField && table.columns.includes(preferred.seriesField) ? preferred.seriesField : '' }
        : kind === 'seasonal-line'
        ? { xField: targetXField, yFields: [preservedMeasures[0]], yField: preservedMeasures[0] }
        : kind === 'connected-scatter'
        ? { xField: targetXField, yFields: preservedMeasures, yField: preservedMeasures[0], seriesField: '', aggregation: 'none' as const, scatterOrderField: value.scatterOrderField && table.columns.includes(value.scatterOrderField) ? value.scatterOrderField : inferScatterOrderField(table, targetXField, preservedMeasures) }
        : kind === 'bubble'
        ? { yFields: preservedMeasures, yField: preservedMeasures[0], scatterSizeField: bubbleSizeField }
        : kind === 'heatmap'
        ? { yFields: preservedMeasures, yField: preservedMeasures[0] }
        : kind === 'waterfall'
        ? { yFields: [preservedMeasures[0]], yField: preservedMeasures[0], seriesField: '', showLegend: false }
        : kind === 'butterfly'
        ? { yFields: pair, yField: pair[0], butterflyLeftFields: pair.slice(0, 1), butterflyRightFields: pair.slice(1, 2), butterflyCategoryPosition: value.butterflyCategoryPosition ?? 'center' as const, seriesField: '', showLegend: true }
        : isCompositionChart(kind)
        ? { yFields: [preservedMeasures[0]], yField: preservedMeasures[0], seriesField: '', aggregation: 'sum' as const, showValues: true, showLegend: kind === 'waffle', showDirectLabels: false }
        : kind === 'sankey'
        ? { ...chartModeDefaults(kind), yFields: [preservedMeasures[0]], yField: preservedMeasures[0], seriesField: '', aggregation: 'sum' as const, sankeyTargetField: value.sankeyTargetField && table.columns.includes(value.sankeyTargetField) && value.sankeyTargetField !== targetXField && value.sankeyTargetField !== preservedMeasures[0] ? value.sankeyTargetField : table.columns.find((column) => column !== targetXField && column !== preservedMeasures[0]) }
        : kind === 'treemap'
        ? { yFields: [preservedMeasures[0]], yField: preservedMeasures[0], aggregation: 'sum' as const, showValues: true, showLegend: false, showDirectLabels: false, treemapSubcategoryField: value.treemapSubcategoryField && table.columns.includes(value.treemapSubcategoryField) && value.treemapSubcategoryField !== value.xField ? value.treemapSubcategoryField : undefined }
        : distributionKind
        ? { ...distributionVisualDefaults(kind), yFields: preservedMeasures, yField: preservedMeasures[0], distributionGroupField: value.distributionGroupField && table.columns.includes(value.distributionGroupField) ? value.distributionGroupField : undefined, distributionLayoutMode: value.distributionGroupField && table.columns.includes(value.distributionGroupField) ? kind === 'raincloud' || kind === 'ridgeline' ? 'categories' as const : 'measures' as const : value.distributionLayoutMode, showLegend: kind === 'histogram' || kind === 'kde-plot' }
        : isPairedComparisonChart(kind)
        ? { yFields: pair, yField: pair[0], dumbbellStartField: value.dumbbellStartField && measures.includes(value.dumbbellStartField) ? value.dumbbellStartField : pair[0], dumbbellEndField: value.dumbbellEndField && measures.includes(value.dumbbellEndField) ? value.dumbbellEndField : pair[1] }
        : kind === 'range-line' || kind === 'step-range-line'
          ? { yFields: pair, yField: pair[0], rangeLowerField: value.rangeLowerField && measures.includes(value.rangeLowerField) ? value.rangeLowerField : pair[0], rangeUpperField: value.rangeUpperField && measures.includes(value.rangeUpperField) ? value.rangeUpperField : pair[1] }
          : kind === 'confidence-line' && triple.length === 3
            ? { yFields: triple, yField: triple[0], intervalGroups: [{ main: triple[0], lower: triple[1], upper: triple[2] }] }
            : { yFields: preservedMeasures, yField: preservedMeasures[0], xField: preferred.xField && table.columns.includes(preferred.xField) ? preferred.xField : targetXField, seriesField: preferred.seriesField && table.columns.includes(preferred.seriesField) ? preferred.seriesField : '' }
      const slopePositions = kind === 'slope'
        ? [...new Map(table.rows.map((row) => [slopePositionKey(row[targetXField]), row[targetXField]])).keys()]
        : undefined
      const indexPositions = kind === 'indexed-line' ? [...new Map(table.rows.map((row) => [slopePositionKey(row[targetXField]), row[targetXField]])).entries()].sort(([, left], [, right]) => left instanceof Date && right instanceof Date ? left.getTime() - right.getTime() : typeof left === 'number' && typeof right === 'number' ? left - right : 0).map(([key]) => key) : undefined
      const seasonalYears = kind === 'seasonal-line' ? [...new Set(table.rows.flatMap((row) => row[targetXField] instanceof Date ? [String((row[targetXField] as Date).getFullYear())] : []))].sort() : undefined
      return {
        ...value,
        ...plugin.defaultConfig,
        kind,
        ...chartModeDefaults(kind),
        ...roleDefaults,
        ...((isMapChart(kind) || isNativeBarKind(kind)) && previous.colorEncoding ? { colorEncoding: previous.colorEncoding, showLegend: previous.showLegend, showDirectLabels: false } : {}),
        xAxisTitle: roleDefaults.xField ?? targetXField,
        yAxisTitle: roleDefaults.yField ?? value.yField,
        ...(slopePositions ? { slopeXValues: value.slopeXValues?.length === 2 && value.slopeXValues.every((key) => slopePositions.includes(key)) ? value.slopeXValues : slopePositions.length > 1 ? [slopePositions[0], slopePositions.at(-1)!] : slopePositions } : {}),
        ...(indexPositions && !indexPositions.includes(value.indexBaseXValue ?? '') ? { indexBaseXValue: indexPositions[0] } : {}),
        ...(seasonalYears && !value.seasonalAccentYears?.length ? { seasonalAccentYears: seasonalYears.slice(-1), seasonalMutedColor: '#d9d7df', seasonalMutedOpacity: .45 } : {}),
        ...(kind === 'slope' ? { slopeShowValues: value.slopeShowValues ?? true, slopeShowSeriesNames: value.slopeShowSeriesNames ?? true, slopeShowYAxis: value.slopeShowYAxis ?? false, slopeShowChange: value.slopeShowChange ?? false, slopeChangeFormat: value.slopeChangeFormat ?? 'absolute' as const, slopeChangePosition: value.slopeChangePosition ?? 'middle' as const, slopeChangePercentDecimals: value.slopeChangePercentDecimals ?? 0, slopeColorByChange: value.slopeColorByChange ?? false, slopeIncreaseColor: value.slopeIncreaseColor ?? '#168a72', slopeDecreaseColor: value.slopeDecreaseColor ?? '#db5a5a', slopeNeutralColor: value.slopeNeutralColor ?? '#777580' } : {}),
        ...((kind === 'moving-average-line' || kind === 'moving-average-scatter') ? { movingAverageWindow: value.movingAverageWindow ?? 12, movingAverageRawOpacity: value.movingAverageRawOpacity ?? .22 } : {}),
        ...(kind === 'heatmap' ? { heatmapScaleMode: value.heatmapScaleMode ?? 'diverging' as const, heatmapLowColor: value.heatmapLowColor ?? '#2c6aa8', heatmapMidColor: value.heatmapMidColor ?? '#f5f5f2', heatmapHighColor: value.heatmapHighColor ?? '#c83e4d', heatmapMidpoint: value.heatmapMidpoint ?? 0, heatmapShowScale: value.heatmapShowScale ?? true, heatmapScalePosition: value.heatmapScalePosition ?? 'right' as const, heatmapCellGap: value.heatmapCellGap ?? 1, heatmapRowSort: value.heatmapRowSort ?? 'none' as const, heatmapRowSortDirection: value.heatmapRowSortDirection ?? 'descending' as const, heatmapMissingColor: value.heatmapMissingColor ?? '#e8e7eb', heatmapMissingLabel: value.heatmapMissingLabel ?? '—' } : {}),
        ...(kind === 'treemap' ? { treemapGap: value.treemapGap ?? 2, treemapGroupGap: value.treemapGroupGap ?? 5, treemapShowGroupLabels: value.treemapShowGroupLabels ?? true } : {}),
        ...(plugin.category === 'bar-horizontal' ? { barOrientation: 'horizontal' as const, categoryAxisInverse: value.categoryAxisInverse ?? true } : isBarChart(kind) ? { barOrientation: 'vertical' as const } : {}),
      }
    })
    setSelectedSeries(null); setSelectedElement(null)
  }
  const openDesign = () => setStep('design')
  const toggleYField = (field: string) => {
    const selected = config.seriesField ? [field] : config.yFields.includes(field) ? config.yFields.filter((item) => item !== field) : [...config.yFields, field]
    if (!selected.length) return
    setConfig((current) => rememberDataSelection(current, { ...current, yFields: selected, yField: selected[0], yAxisTitle: current.yAxisTitle === current.yField ? selected[0] : current.yAxisTitle }))
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
    const to = Math.max(0, Math.min(targetIndex, names.length))
    if (from === to) return current
    names.splice(to, 0, name)
    const seriesStyles = { ...current.seriesStyles }
    chartSeries.forEach((series, index) => { seriesStyles[series.name] = { ...seriesStyles[series.name], color: 'color' in series && typeof series.color === 'string' ? series.color : chartModule?.getSeriesColor(current, series.name, index) ?? current.color } })
    return { ...current, seriesOrder: isStackedChart(current.kind) ? [...names].reverse() : names, seriesStyles }
  })
  const addAnnotation = (placement: AnnotationPlacement) => {
    const id = crypto.randomUUID()
    const annotation: ChartAnnotation = { id, x: Math.min(placement.x, Math.max(0, annotationCanvasWidth - 240)), y: Math.min(placement.y, Math.max(0, annotationCanvasHeight - 60)), width: Math.min(240, annotationCanvasWidth), fontFamily: config.titleText.fontFamily, fontSize: 14, backgroundColor: 'transparent', borderColor: 'transparent', textStrokeColor: config.canvasBackground ?? '#ffffff', textStrokeWidth: 6, textAlign: 'left', html: 'Текст аннотации', fragments: [{ id: crypto.randomUUID(), text: 'Текст аннотации', color: config.titleText.color, bold: false, italic: false }] }
    setConfig((current) => ({ ...current, annotations: [...current.annotations, annotation] })); setSettingsCategory('annotations'); setSelectedAnnotation(id); setSelectedDecoration(null); setSelectedElement(null)
  }
  const duplicateAnnotation = (source: ChartAnnotation) => {
    const id = crypto.randomUUID(), canvasWidth = annotationCanvasWidth, canvasHeight = annotationCanvasHeight
    const annotation: ChartAnnotation = { ...structuredClone(source), id, x: Math.min(Math.max(0, canvasWidth - source.width), source.x + 20), y: Math.min(Math.max(0, canvasHeight - 50), source.y + 20), fragments: source.fragments.map((fragment) => ({ ...fragment, id: crypto.randomUUID() })) }
    setConfig((current) => ({ ...current, annotations: [...current.annotations, annotation] }))
    setSelectedAnnotation(id)
  }
  const addDecoration = (type: ChartDecoration['type'], placement: AnnotationPlacement) => {
    const id = crypto.randomUUID(), canvasWidth = annotationCanvasWidth, canvasHeight = annotationCanvasHeight
    const common = { id, type, x: placement.x, y: placement.y, color: type === 'area' ? '#1923e3' : '#4f4b59', opacity: type === 'area' ? .16 : 1, lineWidth: type === 'area' ? 0 : 2, lineType: 'solid' as const, endArrow: type === 'arrow', arrowPlacement: type === 'arrow' ? 'end' as const : 'none' as const, arrowHead: 'filled' as const }
    let decoration: ChartDecoration = type === 'area' ? { ...common, width: Math.round(canvasWidth * .3), height: Math.round(canvasHeight * .22), fitToPlot: false, fitToPlotWidth: false }
      : type === 'horizontal-line' ? { ...common, width: Math.round(canvasWidth * .42), height: 0 }
      : type === 'vertical-line' ? { ...common, width: 0, height: Math.round(canvasHeight * .38) }
      : type === 'curved-line' ? { ...common, width: Math.round(canvasWidth * .18), height: -Math.round(canvasHeight * .12), curvature: .28 }
      : { ...common, width: Math.round(canvasWidth * .15), height: -Math.round(canvasHeight * .12) }
    if (placement.width !== undefined && placement.height !== undefined) decoration = { ...decoration, width: placement.width, height: placement.height }
    else decoration = { ...decoration, x: Math.min(placement.x, Math.max(0, canvasWidth - Math.max(0, decoration.width))), y: Math.min(Math.max(-Math.min(0, decoration.height), placement.y), Math.max(0, canvasHeight - Math.max(0, decoration.height))) }
    setConfig((current) => ({ ...current, decorations: [...(current.decorations ?? []), decoration] }))
    setSettingsCategory('annotations'); setSelectedDecoration(id); setSelectedAnnotation(null); setSelectedElement(null); setSelectedSeries(null)
  }
  const updateDecoration = (changed: ChartDecoration) => {
    setConfig((current) => ({ ...current, decorations: (current.decorations ?? []).map((item) => item.id === changed.id ? changed : item) }))
    setSettingsCategory('annotations'); setSelectedDecoration(changed.id); setSelectedAnnotation(null); setSelectedElement(null); setSelectedSeries(null)
  }
  const placeAnnotation = (placement: AnnotationPlacement) => {
    if (!annotationTool) return
    if (annotationTool === 'text') addAnnotation(placement)
    else addDecoration(annotationTool, placement)
    setAnnotationTool(null)
  }
  const chooseAnnotation = (kind: 'text' | 'decoration', id: string | null) => {
    clearCanvasSelection()
    if (kind === 'text') setSelectedAnnotation(id)
    else setSelectedDecoration(id)
  }
  const connectAnnotation = (annotation: ChartAnnotation) => {
    const id = crypto.randomUUID()
    const decoration: ChartDecoration = { id, type: 'curved-line', x: annotation.x + annotation.width + 1, y: annotation.y + (annotation.fontSize * 1.35 + 6) / 2, width: 80, height: 80, color: annotation.fragments[0]?.color ?? '#4f4b59', opacity: 1, lineWidth: 1.5, lineType: 'solid', arrowPlacement: 'end', arrowHead: 'filled', startAnchor: { annotationId: annotation.id, side: 'auto' }, controlPoints: { first: { x: 50, y: 0 }, second: { x: 0, y: -50 } } }
    setConfig((current) => ({ ...current, decorations: [...(current.decorations ?? []), decoration] }))
    chooseAnnotation('decoration', id)
    if (valueLabels.length && !isCompositionChart(config.kind) && config.kind !== 'treemap' && config.kind !== 'heatmap') { setPickingDecorationEndpoint('end'); setPickingDecorationAnchor('data') }
  }
  const pickerSwatches = config.palette?.length ? config.palette : [config.color]
  const zoomPercent = `${Math.round(canvasZoom * 100)}%`
  const selectedElementStyle = selectedElement ? config.elementStyles[selectedElement.key] : undefined
  const selectedElementColor = selectedElementStyle?.color
    ?? (selectedElement?.color || undefined)
    ?? (selectedElement ? chartModule?.chartElementColor(table, config, selectedElement.key) : undefined)
    ?? (selectedElement ? chartModule?.getSeriesColor(config, selectedElement.seriesName, Math.max(0, chartSeries.findIndex((series) => series.name === selectedElement.seriesName))) : undefined)
    ?? config.color
  const selectedElementLabelShown = selectedElementStyle?.showLabel ?? (isMapChart(config.kind) ? Boolean((config.mapShowNames ?? isTileMapChart(config.kind)) || config.showValues) : isScatterChart(config.kind) ? config.scatterShowLabels ?? config.showValues : isDistributionKind(config.kind) ? config.distributionShowLabels ?? false : config.kind === 'slope' ? config.slopeShowValues ?? true : config.showValues)
  const selectedElementLabelPosition = selectedElementStyle?.labelPosition ?? (isScatterChart(config.kind) ? config.scatterLabelPosition ?? 'right' : isDistributionKind(config.kind) ? config.distributionLabelPosition ?? ((config.distributionOrientation ?? 'horizontal') === 'horizontal' ? 'right' : 'top') : 'top')
  const chartSelectionActive = settingsCategory === 'chart' && Boolean(selectedElement || selectedSeries)

  const exportCanvas = async (format: 'svg' | 'png', options: import('./features/chart-export/chartExport').ChartExportOptions) => {
    try {
      setError('')
      const handle = multiplesMode ? multiplesRef.current : chartRef.current
      if (format === 'svg') await handle?.exportSvg(options); else await handle?.exportPng(options)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Ошибка экспорта') }
  }
  const renderCanvas = (panelConfig: ChartConfig, ref: Ref<ChartCanvasHandle>, active: boolean) => <ChartCanvas directLabelControlsHost={active ? directLabelControlsHost : null} onDirectLabelPositionsChange={active ? (directLabelPositions) => setConfig((current) => ({ ...current, directLabelPositions })) : undefined} onDecorationLayout={active ? updateDecorationLayouts : undefined} pickingDecorationText={active && pickingDecorationAnchor === 'text'} onDecorationAnchorRequest={(kind, endpoint) => { setPickingDecorationEndpoint(endpoint ?? (kind === 'text' ? 'start' : 'end')); setPickingDecorationAnchor(kind) }} onDecorationTextPick={(annotationId, position) => { const decoration = decorationLayouts.find((item) => item.id === selectedDecoration); if (decoration) updateDecoration({ ...decoration, type: decoration.type === 'horizontal-line' || decoration.type === 'vertical-line' ? 'line' : decoration.type, [pickingDecorationEndpoint === 'start' ? 'startAnchor' : 'endAnchor']: { annotationId, position, side: 'auto' } }); setPickingDecorationAnchor(null) }} pickingDecorationPoint={active && pickingDecorationAnchor === 'data'} onDecorationPointCancel={() => setPickingDecorationAnchor(null)} onDecorationPointPick={(elementKey) => { const decoration = decorationLayouts.find((item) => item.id === selectedDecoration); if (decoration) updateDecoration({ ...decoration, type: decoration.type === 'horizontal-line' || decoration.type === 'vertical-line' ? 'line' : decoration.type, [pickingDecorationEndpoint === 'start' ? 'startAnchor' : 'endAnchor']: { elementKey } }); setPickingDecorationAnchor(null) }} annotationTool={active ? annotationTool : null} onAnnotationPlace={placeAnnotation} onAnnotationCancel={() => setAnnotationTool(null)} ref={ref} table={table} config={panelConfig} disableViewGestures={multiplesMode} viewZoom={multiplesMode ? 1 : canvasZoom} selectedSettingsSection={active ? selectedSettingsSection : null} onSettingsFocus={focusSettings} onClearSettingsFocus={() => setSelectedSettingsSection(null)} onTextStyleChange={(field, style) => setConfig((current) => { const key = `${field}Text` as 'titleText' | 'subtitleText' | 'noteText' | 'sourceText'; return { ...current, [key]: { ...current[key], ...style } } })} onRichTextChange={(field, html, text) => setConfig((current) => ({ ...current, [field]: text, [`${field}Html`]: html }))} onCategoryLabelChange={(axis, category, text) => setConfig((current) => ({ ...current, categoryLabelOverrides: { ...current.categoryLabelOverrides, [axis]: { ...current.categoryLabelOverrides?.[axis], [category]: text } } }))} onTreemapMove={moveTreemapElement} selectedSeriesName={active ? selectedSeries?.name : undefined} selectedElementKey={active ? selectedElement?.key : undefined} selectedElementTarget={active ? selectedElement?.target : undefined} selectedAnnotationId={active ? selectedAnnotation : null} selectedDecorationId={active ? selectedDecoration : null} onDecorationChange={updateDecoration} onSeriesSelect={(selection) => { dismissCanvasHint(); setSettingsCategory('chart'); setSelectedSeries(selection); setSelectedElement(config.kind === 'treemap' ? { key: `treemap-group:${selection.name}`, seriesName: selection.name, category: selection.name, value: '', color: selection.color, target: 'value-label' } : null); setSelectedAnnotation(null); setSelectedDecoration(null) }} onSelect={(selection) => { dismissCanvasHint(); setSettingsCategory('chart'); const resolved = valueLabels.find((item) => item.key === selection.key); setSelectedElement({ ...resolved, ...selection, target: selection.target ?? 'element' }); setSelectedAnnotation(null); setSelectedDecoration(null) }} onAnnotationSelect={(id) => { dismissCanvasHint(); setSettingsCategory('annotations'); setSelectedAnnotation(id); setSelectedSettingsSection(null); setSelectedDecoration(null); setSelectedElement(null); setSelectedSeries(null) }} onAnnotationChange={(changed) => setConfig((current) => ({ ...current, annotations: current.annotations.map((item) => item.id === changed.id ? changed : item) }))} onAnnotationDuplicate={duplicateAnnotation} onAnnotationDelete={(id) => { setConfig((current) => ({ ...current, annotations: current.annotations.filter((item) => item.id !== id), decorations: current.decorations?.map((item) => detachDecorationText(item, id, decorationLayouts.find((layout) => layout.id === item.id))) })); setSelectedAnnotation(null) }}/>

  return (
    <div className="app-shell">
      <EditorHeader projectName={hasData ? table.name : 'Новый проект'} projectMeta={hasData ? `${table.rows.length.toLocaleString('ru-RU')} строк` : 'не сохранён'} canExport={step === 'design' && (!multiplesMode || !!documentConfig.multiples?.panels.some(Boolean))} onExportSvg={(options) => { void exportCanvas('svg', options) }} onExportPng={(options) => { void exportCanvas('png', options) }}/>
      <EditorStepper step={step} canVisit={canVisit} onChange={(next) => { clearCanvasSelection(); setStep(next) }}/>{error && (step === 'chart' || step === 'design') && <p className="source-error" role="alert">{error}</p>}

      {step === 'source' && <main className={`source-step${fileDragging ? ' file-dragging' : ''}`} aria-busy={loading}>
        <div className="step-heading"><h1>Добавьте данные</h1><p>Перетащите файл на страницу или подключите публичную таблицу Google Sheets.</p></div>
        <div className="source-grid">
          <label className="source-card upload-card">{(fileDragging || fileDropBurst) && <div className="file-drop-effect" aria-hidden="true"><HeroSymbolTrail fileDrop initialPoint={fileDragOrigin.current}/></div>}<input type="file" accept=".csv,.xlsx,.parquet" disabled={loading} onChange={(event) => { const file = event.target.files?.[0]; if (file) openFile(file); event.target.value = '' }} /><span className="source-icon"><FileUp size={22}/></span><strong aria-live="polite">{loading ? 'Читаем данные…' : fileDragging ? 'Отпустите файл для загрузки' : 'Загрузить файл'}</strong><p>CSV, XLSX или Parquet</p><span className="source-card-action">{loading ? 'Подождите…' : 'Выбрать с компьютера'}</span></label>
          <div className="source-card sheet-card"><span className="source-icon sheets"><Sheet size={21}/></span><strong>Google Sheets</strong><p>Вставьте ссылку на таблицу с доступом для просмотра</p><div className="source-sheet-form"><input className="text-input" aria-label="Ссылка на Google Sheets" value={sheetUrl} disabled={loading} onChange={(event) => setSheetUrl(event.target.value)} placeholder="https://docs.google.com/spreadsheets/…"/><button className="button primary" disabled={!sheetUrl || loading} onClick={openGoogleSheet}>Подключить</button></div></div>
        </div>
        {error && <p className="source-error" role="alert"><CircleAlert size={16}/>{error}</p>}
        {loading && <div className="processing-progress"><div><span>Обработка данных</span><b>{processingProgress}%</b></div><progress max="100" value={processingProgress}/><button onClick={() => processingController.current?.abort()}>Отменить</button></div>}
        <div className="source-examples"><span>Примеры</span><div className="demo-links"><button className="demo-link" disabled={loading} onClick={() => run(() => Promise.resolve(aiComputeScatterDemoTable), 'scatter', createAiComputeScatterDemoConfig())}>{aiComputeScatterDemoTable.name}</button><button className="demo-link" disabled={loading} onClick={() => run(() => Promise.resolve(zywooDemoTable), 'marimekko', createZywooDemoConfig())}>Арсенал ZywOo</button><button className="demo-link" disabled={loading} onClick={() => run(() => Promise.resolve(keyRateDemoTable), 'step-line', createTimeSeriesDemoConfig('step-line'))}>Ключевая ставка Банка России</button><button className="demo-link" disabled={loading} onClick={() => run(() => Promise.resolve(usInflationDemoTable), 'line', createTimeSeriesDemoConfig('line'))}>Инфляция в США</button><button className="demo-link" disabled={loading} onClick={() => run(() => Promise.resolve(demoTable))}>Временной ряд</button><button className="demo-link" disabled={loading} onClick={() => run(() => Promise.resolve(categoricalDemoTable))}>Топ стран</button><button className="demo-link" disabled={loading} onClick={() => run(() => Promise.resolve(dumbbellDemoTable))}>До → после</button><button className="demo-link" disabled={loading} onClick={() => run(() => Promise.resolve(distributionDemoTable), 'boxplot')}>Распределения</button>{mapChartPresets.filter((preset) => preset.kind !== 'tilemap-world').map((preset) => <button key={preset.kind} className="demo-link" disabled={loading} onClick={() => preset.kind === 'map-russia' ? run(() => Promise.resolve(russiaTurnoutDemoTable), preset.kind, createRussiaTurnoutDemoConfig()) : preset.kind === 'map-usa' ? run(() => Promise.resolve(usBornInSameStateDemoTable), preset.kind, createUsBornInSameStateDemoConfig()) : preset.kind === 'map-europe' ? run(() => Promise.resolve(putinVisitsEuropeDemoTable), preset.kind, createPutinVisitsEuropeDemoConfig()) : preset.kind === 'map-world' ? run(() => Promise.resolve(lifeExpectancyDemoTable), preset.kind, createLifeExpectancyDemoConfig(preset.kind)) : run(() => Promise.resolve(mapDemoTables[preset.id]), preset.kind)}>{preset.kind === 'map-russia' ? russiaTurnoutDemoTable.name : preset.kind === 'map-usa' ? usBornInSameStateDemoTable.name : preset.kind === 'map-europe' ? putinVisitsEuropeDemoTable.name : preset.kind === 'map-world' ? 'Продолжительность жизни' : preset.label}</button>)}<button className="demo-link" disabled={loading} onClick={() => run(() => Promise.resolve(f1ConstructorsDemoTable), 'bump', createF1ConstructorsDemoConfig())}>{f1ConstructorsDemoTable.name}</button><button className="demo-link" disabled={loading} onClick={() => run(() => Promise.resolve(sankeyDemoTable), 'sankey', createTrumpSankeyDemoConfig())}>Трамп · Санкей</button><button className="demo-link" disabled={loading} onClick={() => run(() => Promise.resolve(streamGraphDemoTable), 'stream-graph', createStreamGraphDemoConfig())}>{streamGraphDemoTable.name}</button><button className="demo-link" disabled={loading} onClick={() => run(() => Promise.resolve(entrepreneurshipDifficultiesDemoTable), 'treemap')}>Трудности бизнеса</button><button className="demo-link" disabled={loading} onClick={() => run(() => Promise.resolve(respondentGroupsDemoTable), undefined, createRespondentGroupsDemoConfig())}>Группы респондентов</button></div></div>
      </main>}

      {step === 'data' && <main className="data-step">
        <div className="data-step-header"><div><h1>Проверьте данные</h1><p>Проверьте типы и значения перед построением графика.</p></div></div>
        <div className="history-toolbar"><div><button aria-label="Отменить" disabled={!past.length} onClick={undo} title="Отменить"><RotateCcw size={15}/></button><button aria-label="Повторить" disabled={!future.length} onClick={redo} title="Повторить"><RotateCw size={15}/></button></div><button className="transform-open" onClick={() => setShowTransformDialog(true)}><SlidersHorizontal size={14}/>Настроить временной ряд</button><details><summary><History size={14}/>История <b>{past.length}</b></summary><div>{past.length ? [...past].reverse().map((entry, index) => <div className="history-entry" key={`${entry.time}-${index}`}><span>{entry.label}</span><time>{new Date(entry.time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</time></div>) : <p>Изменений пока нет</p>}</div></details>{past.length > 0 && <span className="history-current">{past.at(-1)?.label}</span>}</div>
        <DataReview table={table} types={types} issues={issues} onRename={changeName} onType={changeType} onConfigureDate={setDateFormatColumn} onEditCell={(row, column, value) => commitTable(editCell(table, row, column, value, types[column]), types, `Изменена ячейка ${column}, строка ${row + 1}`)} onRemoveDuplicates={() => commitTable(removeDuplicateRows(table), types, 'Удалены точные дубликаты')} onDeleteRows={(indices) => commitTable(removeRows(table, indices), types, `Удалено строк: ${indices.length}`)} onDeleteColumns={(columns) => { const next = removeColumns(table, columns); const nextTypes = Object.fromEntries(Object.entries(types).filter(([column]) => next.columns.includes(column))); commitTable(next, nextTypes, `Удалено столбцов: ${columns.length}`, reconcileChartConfig(next, nextTypes)) }} onTranspose={() => { const next = transposeTable(table); const nextTypes = inferTypes(next); commitTable(next, nextTypes, 'Таблица транспонирована', reconcileChartConfig(next, nextTypes)) }}/>
        <div className="step-footer"><button className="button" onClick={() => setStep('source')}>← Другой источник</button><button className="button primary" onPointerEnter={() => { void preloadChartEditor() }} onFocus={() => { void preloadChartEditor() }} onClick={() => setStep('chart')}>Выбрать график →</button></div>
      </main>}
      <Suspense fallback={<div className="dialog-backdrop" aria-busy="true" aria-label="Подготовка окна"><div className="dialog-skeleton"><span/><span/><span/><span/></div></div>}>
        {dateFormatColumn && <DateFormatDialog table={table} column={dateFormatColumn} onClose={() => setDateFormatColumn(null)} onApply={(next) => { commitTable(next, { ...types, [dateFormatColumn]: 'date' }, `Настроен формат «${dateFormatColumn}»`); setDateFormatColumn(null) }}/>}
        {excelWorkbook && <ExcelSheetDialog fileName={excelWorkbook.fileName} sheets={excelWorkbook.sheets} source={excelWorkbook.source} onClose={() => setExcelWorkbook(null)} onSelect={(selected) => { setExcelWorkbook(null); run(() => Promise.resolve(selected)) }}/>}
        {showTransformDialog && <DataTransformDialog table={table} types={types} onClose={() => setShowTransformDialog(false)} onApply={(next, label) => { const nextTypes = inferTypes(next); commitTable(next, nextTypes, label, reconcileChartConfig(next, nextTypes)); setShowTransformDialog(false) }}/>}
      </Suspense>

      {(step === 'chart' || step === 'design') && !chartPlugin && <main className={`chart-workspace step-${step} editor-workspace-skeleton`} aria-busy="true" aria-label="Подготовка редактора графика"><aside><span/><span/><span/><span/><span/></aside><section className="stage"><div className="paper"><div className="chart-canvas chart-skeleton"><span/><span/><span/><span/></div></div></section></main>}
      {(step === 'chart' || step === 'design') && chartPlugin && <main className={`chart-workspace step-${step}${multiplesMode ? ' has-multiples' : ''}`}>
        {step === 'chart' && (multiplesMode ? <div className="multiples-picker-shell">{modeControls}{compositionControls}{activePanel ? <ChartTypePicker table={table} numericColumns={numericColumns} config={config} onChange={(action) => setConfig((current) => rememberDataSelection(current, typeof action === 'function' ? action(current) : action))} onToggleField={toggleYField} onChooseChart={chooseChart}/> : <div className="multiples-instructions"><h2>Соберите композицию</h2><p>Выберите сетку, затем нажмите на свободную ячейку. Для каждого графика можно назначить свои данные и тип.</p><small>Все графики используют загруженную таблицу.</small></div>}</div> : <ChartTypePicker header={modeControls} table={table} numericColumns={numericColumns} config={config} onChange={(action) => setConfig((current) => rememberDataSelection(current, typeof action === 'function' ? action(current) : action))} onToggleField={toggleYField} onChooseChart={chooseChart}/>)}

        <section className="stage"><div className="stage-toolbar"><span>{step === 'chart' ? 'Предпросмотр графика' : `${config.canvasWidth ?? 1000} × ${config.canvasHeight ?? 563} px`}</span></div><div className="canvas-floating-menu" aria-label="Управление холстом"><button type="button" disabled={canvasZoom <= .5} onClick={() => changeCanvasZoom(canvasZoom - .1)} title="Уменьшить масштаб" aria-label="Уменьшить масштаб" data-tip="Уменьшить"><Minus size={14}/></button><span className="canvas-zoom-value">{zoomPercent}</span><button type="button" disabled={canvasZoom >= 2} onClick={() => changeCanvasZoom(canvasZoom + .1)} title="Увеличить масштаб" aria-label="Увеличить масштаб" data-tip="Увеличить"><Plus size={14}/></button><span className="canvas-action-divider"/><button type="button" disabled={!designPast.length} onClick={undoDesign} title="Отменить (Ctrl/⌘ Z)" aria-label="Отменить" data-tip="Отменить"><RotateCcw size={13}/></button><button type="button" disabled={!designFuture.length} onClick={redoDesign} title="Повторить (Ctrl/⌘ Shift Z)" aria-label="Повторить"><RotateCw size={13}/></button><button type="button" className="clear-selection-button" disabled={!selectedElement && !selectedSeries && !selectedAnnotation && !selectedDecoration && !selectedSettingsSection} onClick={clearCanvasSelection} title="Снять выделение" aria-label="Снять выделение" data-tip="Снять выделение"><CircleX size={13}/></button></div><div className="paper-frame"><div className="paper canvas-paper"><Suspense fallback={<div className="chart-canvas chart-skeleton" aria-busy="true" aria-label="Подготовка графика"><span/><span/><span/><span/></div>}>{multiplesMode && documentConfig.multiples ? <MultiplesCanvas selectedText={!activePanel && (selectedSettingsSection === 'title' || selectedSettingsSection === 'subtitle' || selectedSettingsSection === 'note' || selectedSettingsSection === 'source') ? selectedSettingsSection : null} onTextSelect={(field) => { selectPanel(null); setSettingsCategory('text'); setSelectedSettingsSection(field) }} onTextChange={(values) => setDocumentConfig((current) => ({ ...current, ...values }))} onPanelSizeChange={updatePanelCanvasSize} ref={multiplesRef} table={table} config={documentConfig} selected={activePanel ? selectedPanel : null} zoom={canvasZoom} onSelect={selectPanel} onAdd={addPanel} renderPanel={renderCanvas}/> : renderCanvas(config, chartRef, true)}</Suspense></div></div>{step === 'design' && !multiplesMode && showCanvasHint && <p className="stage-hint"><span>{config.kind === 'treemap' ? 'Один клик выбирает категорию · повторный — блок' : 'Нажмите на элемент графика, чтобы настроить его отдельно'}</span><button type="button" onClick={dismissCanvasHint} aria-label="Больше не показывать подсказку">×</button></p>}{step === 'chart' && <div className="chart-preview-actions"><div><small>Выбранный тип</small><strong>{multiplesMode ? `${documentConfig.multiples?.panels.filter(Boolean).length ?? 0} графиков в композиции` : chartPlugin.label}</strong></div><button type="button" className="button primary" disabled={multiplesMode && !documentConfig.multiples?.panels.some(Boolean)} onClick={openDesign}>Настроить оформление →</button></div>}</section>

        {step === 'design' && <aside className="settings-panel">{designScopeControls}<div className="panel-title"><h2>Оформление</h2><p>{multiplesMode ? activePanel ? `График ${(selectedPanel ?? 0) + 1} · ${config.title}` : 'Вся композиция' : 'Настройте график и выбранные элементы'}</p><ChartTemplates config={config} table={table} seriesNames={chartSeries.map((series) => series.name)} documentConfig={multiplesMode ? documentConfig : undefined} selectedPanel={activePanel ? selectedPanel : null} onApplyDocument={(next) => { clearCanvasSelection(); setDocumentConfig(next) }} onApply={(next) => { clearCanvasSelection(); setConfig(next) }}/></div>{compositionControls}{multiplesMode && activePanel && (documentConfig.multiples?.sharedValueScale || documentConfig.multiples?.sharedXScale) && <p className="multiples-inherited-note">Общие шкалы имеют приоритет над индивидуальными границами. Индивидуальные значения сохраняются и снова действуют после отключения общих шкал.</p>}{multiplesMode && !activePanel ? <><CanvasSettings config={documentConfig} onChange={setDocumentConfig}/><ChartSettingsPanel category="text" config={documentConfig} plugin={chartPlugin} seriesNames={[]} valueLabels={[]} xKind="other" onChange={setDocumentConfig}/></> : <SettingsCategoryTabs value={settingsCategory} chartLabel={chartPlugin.label} showAxes={!isMapChart(config.kind) && config.kind !== 'sankey' && config.kind !== 'treemap' && !isCompositionChart(config.kind)} onChange={setSettingsCategory}><section className="form-section visual-settings" onToggle={(event) => { const opened = event.target as HTMLDetailsElement; if (opened.tagName !== 'DETAILS' || !opened.open || opened.parentElement !== event.currentTarget) return; event.currentTarget.querySelectorAll<HTMLDetailsElement>(':scope > details[open]').forEach((details) => { if (details !== opened) details.open = false }) }}>
          {settingsCategory === 'canvas' && <CanvasSettings config={config} onChange={setConfig} sizeLocked={multiplesMode}/>}
          {settingsCategory === 'axes' && <NumberFormatSettings config={config} onChange={setConfig}/>}
          {settingsCategory === 'chart' && chartPlugin.settings.sections.includes('series') && <>
          {selectedElement && config.kind === 'treemap' && <ValueLabelSelectionControls config={config} element={selectedElement} color={isMapChart(config.kind) || config.kind === 'treemap' || config.kind === 'sankey' ? selectedElementColor : undefined} swatches={pickerSwatches} canPaste={copiedStyle?.kind === 'element'} onCopy={copyElementStyle} onPaste={pasteElementStyle} onChange={updateElement} onClose={() => setSelectedElement(null)} onReset={config.kind === 'treemap' ? () => setConfig((current) => { const elementStyles = { ...current.elementStyles }; delete elementStyles[selectedElement.key]; return { ...current, elementStyles } }) : undefined}/>}
          {selectedElement && config.kind !== 'treemap' && <section className="element-editor"><header><div><span>Выбран элемент</span><strong>{selectedElement.label || selectedElement.category}</strong><small>{selectedElement.seriesName} · {selectedElement.value}</small></div><button type="button" aria-label="Снять выделение элемента" onClick={() => setSelectedElement(null)}>×</button></header><div>{isBarChart(config.kind) && !isLollipopChart(config.kind) ? <BarSelectionControls config={config} element={selectedElement} series={selectedSeries} color={selectedElementColor} onElementChange={updateElement} onSeriesChange={updateSeries}/> : <label>Цвет элемента<ColorControl value={selectedElementColor} swatches={pickerSwatches} onChange={(color) => updateElement({ color })}/></label>}{(isAreaChart(config.kind) || config.kind === 'spline') && <div className="element-note">Цвет элемента применяется к маркеру выбранного значения.</div>}{config.kind === 'line' && <><div className="element-note">Настройки применяются к участку линии, ведущему к выбранной точке.</div><label>Толщина участка, px<NumberInput min="0.5" max="12" step="0.5" value={selectedElementStyle?.lineWidth ?? config.seriesStyles[selectedElement.seriesName]?.lineWidth ?? 2} onValueChange={(value) => updateElement({ lineWidth: value })}/></label><label>Тип участка<select value={selectedElementStyle?.lineType ?? config.seriesStyles[selectedElement.seriesName]?.lineType ?? 'solid'} onChange={(event) => updateElement({ lineType: event.target.value as 'solid' | 'dashed' | 'dotted' })}><option value="solid">Сплошной</option><option value="dashed">Пунктирный</option><option value="dotted">Точечный</option></select></label></>}{(isLineLikeChart(config.kind) || isScatterChart(config.kind) || isLollipopChart(config.kind) || isPairedComparisonChart(config.kind) || isDistributionKind(config.kind) && ['boxplot', 'violinplot', 'raincloud', 'beeswarm', 'strip-plot', 'jitter-plot', 'counts-plot'].includes(config.kind) && !selectedElement.key.includes('string:group:')) && <MarkerSettings individual value={{ ...config.seriesStyles[selectedElement.seriesName], ...selectedElementStyle }} lineColor={selectedElementColor} onChange={updateElement} defaultSize={config.seriesStyles[selectedElement.seriesName]?.markerSize ?? (isScatterChart(config.kind) ? config.scatterPointSize ?? 10 : isDistributionKind(config.kind) ? config.distributionPointSize ?? 9 : isLollipopChart(config.kind) || isPairedComparisonChart(config.kind) ? 12 : config.kind === 'slope' ? 11 : 8)} defaultVisible={config.seriesStyles[selectedElement.seriesName]?.showMarker ?? config.kind === 'bump'} alwaysVisible={isScatterChart(config.kind) || isDistributionKind(config.kind) || isLollipopChart(config.kind) || isPairedComparisonChart(config.kind) || config.kind === 'slope' || config.kind === 'moving-average-scatter'}/>}{config.kind === 'sankey' && selectedElement.key.startsWith('sankey-link:') && <label>Непрозрачность потока, %<NumberInput min="0" max="100" value={Math.round((selectedElementStyle?.fillOpacity ?? config.sankeyLinkOpacity ?? .45) * 100)} onValueChange={(value) => updateElement({ fillOpacity: value / 100 })}/></label>}{!(config.kind === 'sankey' && selectedElement.key.startsWith('sankey-link:')) && <fieldset><legend>Подпись выбранного элемента</legend>{isMapChart(config.kind) || isBarChart(config.kind) ? <ValueLabelFields config={config} element={selectedElement} onChange={updateElement}/> : <><SettingsCheckbox isSelected={selectedElementLabelShown} onChange={(showLabel) => updateElement({ showLabel })}>Показывать подпись</SettingsCheckbox><label>Текст подписи{isMapChart(config.kind) || config.kind === 'waffle' || config.kind === 'sankey' ? <textarea rows={3} value={selectedElementStyle?.label ?? ''} onChange={(event) => updateElement({ label: event.target.value || undefined, showLabel: true })} placeholder={selectedElement.label ?? selectedElement.value}/> : <input className="text-input" value={selectedElementStyle?.label ?? ''} onChange={(event) => updateElement({ label: event.target.value, showLabel: true })} placeholder={selectedElement.label ?? selectedElement.value}/>}</label>{(isScatterChart(config.kind) || isDistributionKind(config.kind) || isLineLikeChart(config.kind) || isPairedComparisonChart(config.kind)) && <label>Положение<select value={selectedElementLabelPosition} onChange={(event) => updateElement({ labelPosition: event.target.value as NonNullable<ChartConfig['elementStyles'][string]['labelPosition']>, showLabel: true })}><option value="top">Сверху</option><option value="right">Справа</option><option value="bottom">Снизу</option><option value="left">Слева</option></select></label>}<TextStyleEditor label="Стиль этой подписи" value={selectedElementStyle?.valueText ?? config.valueText} customFonts={config.customFonts} onChange={(valueText) => updateElement({ valueText, showLabel: true })} align={!(isScatterChart(config.kind) || isDistributionKind(config.kind))}/></>}</fieldset>}<StyleTransferActions canPaste={copiedStyle?.kind === "element"} onCopy={copyElementStyle} onPaste={pasteElementStyle}/><button className="reset-element" onClick={() => setConfig((current) => { const elementStyles = { ...current.elementStyles }; delete elementStyles[selectedElement.key]; return { ...current, elementStyles } })}>Сбросить настройки элемента</button></div></section>}
          {selectedSeries && !selectedElement && <section className="element-editor series-editor"><header><div><span>Выбран ряд</span><strong>{selectedSeries.name}</strong><small>Нажмите на элемент этого ряда, чтобы настроить его отдельно</small></div><button type="button" aria-label="Снять выделение ряда" onClick={() => setSelectedSeries(null)}>×</button></header><div>{isBarChart(config.kind) && !isLollipopChart(config.kind) ? <BarSelectionControls config={config} element={null} series={selectedSeries} color={selectedSeries.color} onElementChange={updateElement} onSeriesChange={updateSeries}/> : <label>Цвет всего ряда<ColorControl value={config.seriesStyles[selectedSeries.name]?.color ?? selectedSeries.color} swatches={pickerSwatches} onChange={(color) => updateSeries({ color })}/></label>}{isDistributionKind(config.kind) && <><label>{config.distributionSummaryStatistic === 'mean' ? 'Цвет линии среднего' : 'Цвет линии медианы'}<ColorControl value={config.seriesStyles[selectedSeries.name]?.distributionSummaryColor ?? config.seriesStyles[selectedSeries.name]?.color ?? selectedSeries.color} swatches={pickerSwatches} onChange={(distributionSummaryColor) => updateSeries({ distributionSummaryColor })}/></label><div className="settings-pair"><label>Толщина, px<NumberInput min="0.5" max="12" step="0.5" value={config.seriesStyles[selectedSeries.name]?.distributionSummaryWidth ?? config.distributionSummaryWidth ?? 3} onValueChange={(distributionSummaryWidth) => updateSeries({ distributionSummaryWidth })}/></label><label>Длина, %<NumberInput min="20" max="200" step="5" value={config.seriesStyles[selectedSeries.name]?.distributionSummaryLength ?? config.distributionSummaryLength ?? 100} onValueChange={(distributionSummaryLength) => updateSeries({ distributionSummaryLength })}/></label></div></>}{config.kind !== 'stream-graph' && (isLineLikeChart(config.kind) || config.kind === 'connected-scatter') && <LineAppearanceFields config={config} name={selectedSeries.name} color={selectedSeries.color} onChange={updateSeries}/>}{isScatterChart(config.kind) && config.kind !== 'connected-scatter' && <MarkerSettings alwaysVisible showSize={config.kind !== 'bubble'} value={{ markerBorderWidth: config.scatterBorderWidth ?? 1, fillOpacity: config.scatterOpacity ?? .78, ...config.seriesStyles[selectedSeries.name], ...(config.scatterHollow && !config.seriesStyles[selectedSeries.name]?.markerFill ? { markerFill: 'transparent' } : {}) }} lineColor={config.seriesStyles[selectedSeries.name]?.color ?? selectedSeries.color} defaultSize={config.scatterPointSize ?? 10} onChange={updateSeries}/>}<StyleTransferActions canPaste={copiedStyle?.kind === "series"} onCopy={copySeriesStyle} onPaste={pasteSeriesStyle}/><button className="reset-element" onClick={() => { setConfig((current) => { const seriesStyles = { ...current.seriesStyles }; delete seriesStyles[selectedSeries.name]; return { ...current, seriesStyles } }); setSelectedSeries(null) }}>Вернуть настройки палитры</button></div></section>}
          {!chartSelectionActive && chartSeries.length > 1 && <details className="settings-group series-settings" open><summary>Ряды данных</summary><div><p className="series-order-hint">Перетаскивайте ряды или используйте стрелки, чтобы изменить порядок.</p><SeriesOrderList series={chartSeries.map((series, index) => ({ name: series.name, color: 'color' in series && typeof series.color === 'string' ? series.color : chartModule?.getSeriesColor(config, series.name, index) ?? config.color }))} selected={selectedSeries?.name} onSelect={(series) => { setSelectedSeries(series); setSelectedElement(null); setSelectedAnnotation(null) }} onMove={moveSeries}/></div></details>}
          </>}
          {settingsCategory === 'annotations' && chartPlugin.settings.sections.includes('annotations') && <AnnotationSettings resolvedDecorations={decorationLayouts} pointLabels={isMapChart(config.kind) || config.kind === 'sankey' || isCompositionChart(config.kind) || config.kind === 'treemap' || config.kind === 'heatmap' ? [] : valueLabels} pickingAnchor={pickingDecorationAnchor} onPickAnchor={(kind) => { setPickingDecorationEndpoint(kind === 'text' ? 'start' : 'end'); setPickingDecorationAnchor((current) => current === kind ? null : kind) }} onConnectText={connectAnnotation} canvasWidth={annotationCanvasWidth} canvasHeight={annotationCanvasHeight} config={config} selectedAnnotation={selectedAnnotation} selectedDecoration={selectedDecoration} tool={annotationTool} onTool={(tool) => { clearCanvasSelection(); setAnnotationTool(tool) }} onPlace={placeAnnotation} onSelect={chooseAnnotation} onChange={setConfig}/>}
          {!chartSelectionActive && settingsCategory === 'chart' && isBarChart(config.kind) && !isLollipopChart(config.kind) && <BarAppearanceSettings config={config} onChange={setConfig}/>}
          {!chartSelectionActive && settingsCategory === 'chart' && config.kind !== 'stream-graph' && isLineLikeChart(config.kind) && <LineAppearanceSettings config={config} names={chartSeries.map((series) => series.name)} onChange={setConfig}/>}
          {!chartSelectionActive && settingsCategory === 'chart' && chartPlugin.settings.features.scatterLayout && <ScatterSettings config={config} columns={table.columns} numericColumns={numericColumns} table={table} onChange={setConfig}/>}
          {!chartSelectionActive && settingsCategory === 'chart' && config.kind === 'bubble' && <BubbleSizeLegendSettings config={config} onChange={setConfig}/>}
          {!chartSelectionActive && settingsCategory === 'chart' && (isMapChart(config.kind) || isNativeBarKind(config.kind)) && <ColorEncodingSettings table={table} config={config} onChange={setConfig}/>}
          {!chartSelectionActive && settingsCategory === 'chart' && isMapChart(config.kind) && <MapSettings config={config} onChange={setConfig}/>}
          {!chartSelectionActive && settingsCategory === 'chart' && config.kind === 'heatmap' && <HeatmapSettings config={config} onChange={setConfig}/>}
          {!chartSelectionActive && settingsCategory === 'chart' && config.kind === 'waffle' && <WaffleSettings config={config} valueLabels={valueLabels} onChange={setConfig}/>}
          {!chartSelectionActive && settingsCategory === 'chart' && (config.kind === 'pie' || config.kind === 'donut') && <PieSettings config={config} onChange={setConfig}/>}
          {!chartSelectionActive && settingsCategory === 'chart' && config.kind === 'sankey' && <SankeySettings config={config} onChange={setConfig}/>}
          {!chartSelectionActive && settingsCategory === 'chart' && config.kind === 'treemap' && <TreemapSettings config={config} onChange={setConfig}/>}
          {!chartSelectionActive && settingsCategory === 'chart' && chartPlugin.settings.features.distributionLayout && <DistributionSettings config={config} table={table} onChange={setConfig}/>}
          {!chartSelectionActive && settingsCategory === 'chart' && isLollipopChart(config.kind) && <LollipopSettings config={config} seriesNames={chartSeries.map((series) => series.name)} xKind={types[config.xField] === 'date' ? 'date' : types[config.xField] === 'number' ? 'number' : 'other'} onChange={setConfig}/>}
          {!chartSelectionActive && settingsCategory === 'chart' && chartPlugin.settings.features.lineVariant && <LineVariantSettings config={config} numericColumns={numericColumns} table={table} onChange={setConfig}/>}
          {!chartSelectionActive && <ChartSettingsPanel columns={table.columns} directLabelControlsRef={setDirectLabelControlsHost} isPanel={Boolean(activePanel)} category={settingsCategory} config={config} plugin={chartPlugin} seriesColors={Object.fromEntries(chartSeries.map((series, index) => [series.name, 'color' in series && typeof series.color === 'string' ? series.color : chartModule?.getSeriesColor(config, series.name, index) ?? config.color]))} seriesNames={config.kind === 'sankey' ? valueLabels.filter((item) => item.key.startsWith('sankey-node:')).map((item) => item.seriesName) : chartSeries.map((series) => series.name)} valueLabels={valueLabels} xKind={types[config.xField] === 'date' ? 'date' : types[config.xField] === 'number' ? 'number' : 'other'} frequency={table.timeProfiles?.[config.xField]?.frequency} onChange={setConfig}/>}
        </section></SettingsCategoryTabs>}</aside>}
      </main>}
    </div>
  )
}

export default App
