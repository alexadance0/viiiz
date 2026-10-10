import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type RefCallback } from 'react'
import { CanvasTextOverlay, CanvasTextDisplay } from '../../../components/CanvasTextOverlay'
import { annotationTextHtml, sanitizeAnnotationHtml } from '../../../core/annotationHtml'
import { appendAnnotationText } from '../../chart-export/annotationSvg'
import { Plus } from 'lucide-react'
import type { ChartConfig, DataTable } from '../../../core/types'
import type { ChartCanvasHandle } from '../../../components/ChartCanvas'
import { invalidateTextLayoutCache, layoutText, plainTextDocument } from '../../chart-layout/textLayout'
import { collectFontFamilies, waitForChartFonts } from '../../../core/textFonts'
import { exportChartAsPng, exportChartAsSvg } from '../../chart-export/chartExport'
import { resolveMultiplesPanels, resolveMultiplesRowHeights, sharedCategoryRows } from '../model/multiples'
import { getChartPlugin } from '../../../core/chartRegistry'
import { resolveNativeScene } from '../../chart-renderer/echarts/renderScene'
import { measureTextWidth } from '../../../core/textMetrics'
import './Multiples.css'

interface Props {
  table: DataTable
  config: ChartConfig
  selected: number | null
  selectedText?: 'title' | 'subtitle' | 'note' | 'source' | null
  onTextSelect?(field: 'title' | 'subtitle' | 'note' | 'source'): void
  onTextChange?(config: Partial<ChartConfig>): void
  zoom: number
  onSelect(index: number): void
  onAdd(index: number): void
  onPanelSizeChange?(width: number, height: number): void
  renderPanel(config: ChartConfig, ref: RefCallback<ChartCanvasHandle>, active: boolean): ReactNode
}

export const MultiplesCanvas = forwardRef<ChartCanvasHandle, Props>(function MultiplesCanvas({ table, config, selected, selectedText, onTextSelect, onTextChange, zoom, onSelect, onAdd, onPanelSizeChange, renderPanel }, ref) {
  const viewport = useRef<HTMLDivElement>(null)
  const textSvg = useRef<SVGSVGElement>(null)
  const handles = useRef(new Map<string, ChartCanvasHandle>())
  const [scale, setScale] = useState(1)
  const [fontRevision, setFontsReady] = useState(0)
  const grid = config.multiples!
  const width = config.canvasWidth ?? 1000, height = config.canvasHeight ?? 750
  const left = config.canvasMarginLeft ?? 40, right = config.canvasMarginRight ?? 40
  const top = config.canvasMarginTop ?? 40, bottom = config.canvasMarginBottom ?? 40
  const contentWidth = Math.max(1, width - left - right)
  const textLayouts = useMemo(() => Object.fromEntries((['title', 'subtitle', 'note', 'source'] as const).map((field) => {
    const style = config[`${field}Text`]
    const layout = layoutText({ document: plainTextDocument(config[field], style), maxWidth: contentWidth })
    // Measure rich HTML with the same browser layout used by the existing canvas
    // editor, including larger fragments and changes within a word.
    if (config[`${field}Html`] && config[field]) {
      const element = document.createElement('div')
      Object.assign(element.style, { position: 'fixed', left: '-20000px', visibility: 'hidden', width: `${contentWidth}px`, fontFamily: style.fontFamily, fontSize: `${style.size}px`, fontWeight: String(style.weight), fontStyle: style.italic ? 'italic' : 'normal', lineHeight: `${Math.round(style.size * style.lineHeight / 100)}px`, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' })
      element.innerHTML = sanitizeAnnotationHtml(config[`${field}Html`]!)
      document.body.append(element)
      const height = element.getBoundingClientRect().height
      element.remove()
      return [field, { ...layout, size: { ...layout.size, height } }]
    }
    return [field, layout]
  })) as Record<'title' | 'subtitle' | 'note' | 'source', ReturnType<typeof layoutText>>, [config, contentWidth, fontRevision])
  const textBlocks: Array<{ field: 'title' | 'subtitle' | 'note' | 'source'; y: number; layout: ReturnType<typeof layoutText> }> = []
  let headerEnd = top
  for (const field of ['title', 'subtitle'] as const) {
    if (!config[field] || (field === 'title' ? config.showTitle : config.showSubtitle) === false) continue
    const layout = textLayouts[field]
    if (textBlocks.length) headerEnd += config.titleSubtitleGap ?? 8
    textBlocks.push({ field, y: headerEnd, layout }); headerEnd += layout.size.height
  }
  if (textBlocks.length) headerEnd += config.headerPlotGap ?? 24
  let footerHeight = 0
  const footerBlocks = (['note', 'source'] as const).flatMap((field) => {
    if (!config[field] || (field === 'note' ? config.showNote : config.showSource) === false) return []
    const layout = textLayouts[field]
    const y = footerHeight
    footerHeight += layout.size.height + (config.noteSourceGap ?? 8)
    return [{ field, y, layout }]
  })
  if (footerBlocks.length) footerHeight -= config.noteSourceGap ?? 8
  textBlocks.push(...footerBlocks.map((block) => ({ ...block, y: height - bottom - footerHeight + block.y })))
  const plotHeight = Math.max(1, height - bottom - headerEnd - footerHeight - (footerHeight ? config.plotFooterGap ?? 24 : 0))
  const categoryRows = useMemo(() => sharedCategoryRows(table, grid), [table, grid])
  const categoryRailWidth = categoryRows.length ? Math.min(contentWidth * .28, Math.max(...categoryRows.flatMap(({ reference }) => {
    const scene = getChartPlugin(reference.kind).compile(table, reference)
    const style = reference.xAxisLabelText ?? reference.axisLabelText
    return 'categories' in scene.plot ? scene.plot.categories.flatMap(({ label }) => label.split('\n').map((line) => measureTextWidth(line, style.size, style.fontFamily, style.weight))) : [0]
  })) + 16) : 0
  const gridWidth = Math.max(1, contentWidth - categoryRailWidth)
  const gridLeft = left + categoryRailWidth
  const gap = Math.max(0, Math.min(grid.gap, (gridWidth - grid.columns) / Math.max(1, grid.columns - 1), (plotHeight - grid.rows) / Math.max(1, grid.rows - 1)))
  const panelWidth = Math.max(1, (gridWidth - gap * (grid.columns - 1)) / grid.columns)
  const rowHeights = useMemo(() => resolveMultiplesRowHeights(table, grid, panelWidth, Math.max(grid.rows, plotHeight - gap * (grid.rows - 1)), categoryRows), [table, grid, panelWidth, plotHeight, gap, categoryRows, fontRevision])
  const rowOffsets = rowHeights.map((_, row) => rowHeights.slice(0, row).reduce((sum, height) => sum + height + gap, 0))
  const activeWidth = Math.round(panelWidth), activeHeight = selected !== null ? Math.round(rowHeights[Math.floor(selected / grid.columns)] ?? 0) : 0
  useEffect(() => { if (activeHeight > 0) onPanelSizeChange?.(activeWidth, activeHeight) }, [activeWidth, activeHeight, onPanelSizeChange])

  const panelConfigs = useMemo(() => resolveMultiplesPanels(table, grid, panelWidth, rowHeights, categoryRows), [table, grid, panelWidth, rowHeights, categoryRows, fontRevision])
  const categoryLabels = categoryRows.flatMap(({ row, indices, reference }) => {
    const panelConfig = panelConfigs[indices[0]]!
    const scene = resolveNativeScene(getChartPlugin(panelConfig.kind).compile(table, panelConfig))
    if (!('categories' in scene.plot)) return []
    const plot = scene.geometry.plot, categories = scene.plot.categories
    const style = reference.xAxisLabelText ?? reference.axisLabelText
    return categories.map(({ label }, index) => {
      const layout = layoutText({ document: plainTextDocument(label, style), maxWidth: Math.max(1, categoryRailWidth - 16) })
      const position = (panelConfig.categoryAxisInverse ?? true) ? index : categories.length - 1 - index
      return { label, style, layout, y: headerEnd + rowOffsets[row] + plot.y + (position + .5) * plot.height / categories.length - layout.size.height / 2 }
    })
  })
  const { customFonts } = config
  const fontFamilies = JSON.stringify(collectFontFamilies(config))
  useEffect(() => {
    let active = true
    void waitForChartFonts(JSON.parse(fontFamilies), customFonts).then(() => { if (active) { invalidateTextLayoutCache(); setFontsReady((value) => value + 1) } })
    return () => { active = false }
  }, [fontFamilies, customFonts])

  useEffect(() => {
    if (!viewport.current) return
    const observer = new ResizeObserver(([entry]) => setScale(Math.min((entry.contentRect.width - 24) / width, (entry.contentRect.height - 24) / height, 1)))
    observer.observe(viewport.current)
    return () => observer.disconnect()
  }, [width, height])

  const getSvg = async () => {
    await waitForChartFonts(collectFontFamilies(config), config.customFonts)
    if (!textSvg.current) throw new Error('Композиция ещё не готова к экспорту')
    const svg = textSvg.current.cloneNode(true) as SVGSVGElement
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
    textBlocks.forEach(({ field, y }) => {
      const style = config[`${field}Text`]
      appendAnnotationText(svg, [{ id: `composition-${field}`, x: left, y, width: contentWidth, fontFamily: style.fontFamily, fontSize: style.size, backgroundColor: 'transparent', borderColor: 'transparent', textAlign: style.align, fragments: [{ id: field, text: config[field], color: style.color, bold: style.weight >= 600, italic: style.italic }], html: config[`${field}Html`] }], { padding: '0', minHeight: '0', borderWidth: 0, fontWeight: style.weight, fontStyle: style.italic ? 'italic' : 'normal', lineHeight: `${Math.round(style.size * style.lineHeight / 100)}px` })
    })
    const children = await Promise.all(grid.panels.map(async (panel, index) => {
      if (!panel) return null
      const handle = handles.current.get(panel.id)
      if (!handle) throw new Error(`График ${index + 1} ещё не готов к экспорту`)
      const child = await handle.getSvg()
      const row = Math.floor(index / grid.columns), panelHeight = rowHeights[row]
      child.setAttribute('x', String(gridLeft + (index % grid.columns) * (panelWidth + gap)))
      child.setAttribute('y', String(headerEnd + rowOffsets[row]))
      child.setAttribute('width', String(panelWidth)); child.setAttribute('height', String(panelHeight))
      child.setAttribute('viewBox', `0 0 ${Math.round(panelWidth)} ${Math.round(panelHeight)}`)
      return child
    }))
    children.forEach((child) => { if (child) svg.append(child) })
    return svg
  }
  useImperativeHandle(ref, () => ({
    getSvg,
    async exportSvg(options) { await exportChartAsSvg(await getSvg(), { ...config, customFonts: [...(config.customFonts ?? []), ...grid.panels.flatMap((panel) => panel?.config.customFonts ?? [])] }, options) },
    async exportPng(options) { await exportChartAsPng(await getSvg(), { ...config, customFonts: [...(config.customFonts ?? []), ...grid.panels.flatMap((panel) => panel?.config.customFonts ?? [])] }, options) },
  }))

  const previewScale = Math.max(.05, scale) * zoom
  return <div className="multiples-viewport" ref={viewport}>
    <div className="multiples-sized-paper" style={{ width: width * previewScale, height: height * previewScale }}><div className="multiples-paper" style={{ width, height, transform: `scale(${previewScale})`, background: config.canvasBackground ?? '#fff' }}>
      <svg className="multiples-text" ref={textSvg} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-label="Заголовок и источник композиции">
        <rect width={width} height={height} fill={config.canvasBackground ?? '#fff'}/>
        {categoryLabels.map(({ label, style, layout, y }, index) => <text className="multiples-category-label" key={`${index}-${label}`} fill={style.color} fontFamily={style.fontFamily} fontSize={style.size} fontWeight={style.weight} fontStyle={style.italic ? 'italic' : 'normal'} textAnchor="end">{layout.lines.map((line, lineIndex) => <tspan key={lineIndex} x={gridLeft - 16} y={y + style.size + lineIndex * layout.lineHeight}>{line}</tspan>)}</text>)}
      </svg>
      {textBlocks.map(({ field, y }) => <div key={field} data-composition-text={field}>
        {selectedText === field && onTextChange ? <CanvasTextOverlay id={`composition-${field}`} text={config[field]} html={config[`${field}Html`]} style={config[`${field}Text`]} left={left} top={y} width={contentWidth} customFonts={config.customFonts} canvasBackground={config.canvasBackground}
          onChange={(html, text) => onTextChange({ [field]: text, [`${field}Html`]: html })}
          onStyleChange={(style) => onTextChange({ [`${field}Text`]: { ...config[`${field}Text`], ...style } })}/>
          : <CanvasTextDisplay html={config[`${field}Html`] ?? annotationTextHtml(config[field])} style={config[`${field}Text`]} left={left} top={y} width={contentWidth} onSelect={() => onTextSelect?.(field)}/>}
      </div>)}
      <div className="multiples-grid" style={{ left: gridLeft, top: headerEnd, width: gridWidth, height: plotHeight, gap, gridTemplateColumns: `repeat(${grid.columns}, minmax(0, 1fr))`, gridTemplateRows: rowHeights.map((height) => `${height}px`).join(' ') }}>
        {grid.panels.map((panel, index) => <div className={`multiples-cell ${selected === index ? 'selected' : ''} ${panel ? 'filled' : 'empty'}`} key={panel?.id ?? `empty-${index}`} data-panel-index={index}>
          {panel ? <>
            <div className="multiples-chart" inert={selected !== index}>{renderPanel({ ...panelConfigs[index]!, customFonts: [...(config.customFonts ?? []), ...(panel.config.customFonts ?? [])] }, (handle) => { if (handle) handles.current.set(panel.id, handle); else handles.current.delete(panel.id) }, selected === index)}</div>
            <button className={`multiples-select ${selected === index ? 'is-selected' : ''}`} aria-label={`Выбрать график ${index + 1}: ${panel.config.title}`} onClick={() => onSelect(index)}><span>{String(index + 1).padStart(2, '0')}</span></button>
          </> : <button className="multiples-empty" onClick={() => onAdd(index)} aria-label={`Добавить график в ячейку ${index + 1}`}><Plus size={24}/><strong>Добавить график</strong><small>Ячейка {index + 1}</small></button>}
        </div>)}
      </div>
    </div></div>
    {panelWidth < 180 || rowHeights.some((height) => height < 150) ? <p className="multiples-size-hint" role="status">Панели тесные — увеличьте холст или уменьшите число колонок и рядов.</p> : null}
  </div>
})
