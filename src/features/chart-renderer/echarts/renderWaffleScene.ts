import { waffleCellCoordinates, waffleLabelArea } from '../../chart-types/waffle/cells'
import { formatChartNumber } from '../../../core/numberFormat'
import type { NativeWaffleChartScene, ResolvedScene } from '../../../entities/chart/model/ChartScene'
import { pieFrameScene } from '../../chart-types/pie/layout'
import { resolveNativeCartesianScene } from '../../chart-types/bar/layout'
import { contrastText } from '../../../core/color'
import { measureTextWidth, wrapMeasuredText } from '../../../core/textMetrics'
import { nativeGraphicTextStyle, renderNativeBarScene } from './renderBarScene'

export function resolveNativeWaffleScene(scene: NativeWaffleChartScene): ResolvedScene & NativeWaffleChartScene {
  const frame = resolveNativeCartesianScene(pieFrameScene(scene))
  if (scene.compatibilityConfig.waffleShowUnitLegend) {
    const config = scene.compatibilityConfig, style = config.waffleUnitLegendText ?? config.legendText
    const plot = frame.geometry.plot, position = config.waffleUnitLegendPosition ?? 'top'
    const side = position === 'left' || position === 'right'
    const marker = Math.min(plot.width / (scene.plot.columns + (side ? 1 : 0)), plot.height / (scene.plot.rows + (side ? 0 : 1)))
    const text = waffleUnitCaption(scene)
    const width = Math.min(plot.width * (side ? .35 : 1), marker + 10 + measureTextWidth(text, style.size, style.fontFamily, style.weight))
    const textHeight = wrapMeasuredText(text, style.size, Math.max(1, width - marker - 10), style.fontFamily, style.weight).lines * Math.round(style.size * style.lineHeight / 100)
    const height = Math.max(marker, textHeight) + 12
    const reservation = side
      ? { ...plot, x: position === 'right' ? plot.x + plot.width - width : plot.x, width }
      : { ...plot, y: position === 'bottom' ? plot.y + plot.height - height : plot.y, height }
    const gridPlot = side
      ? { ...plot, x: plot.x + (position === 'left' ? width + 24 : 0), width: Math.max(1, plot.width - width - 24) }
      : { ...plot, y: plot.y + (position === 'top' ? height : 0), height: Math.max(1, plot.height - height) }
    frame.geometry = { ...frame.geometry, reservations: { ...frame.geometry.reservations, 'waffle-unit-legend': reservation }, plot: gridPlot }
  }
  return { ...scene, geometry: frame.geometry, resolvedReservations: frame.resolvedReservations }
}

function waffleUnitCaption(scene: NativeWaffleChartScene) {
  const config = scene.compatibilityConfig
  const value = config.waffleCellValue ?? scene.plot.total / (scene.plot.columns * scene.plot.rows)
  const formatted = formatChartNumber(value, { ...config, valueMode: 'absolute', numberOperation: 'none', numberFactor: 1, numberPrefix: '', numberSuffix: '', valueLabelAffixesLinked: true })
  return `= ${formatted}${config.waffleUnitLabel?.trim() ? ` ${config.waffleUnitLabel.trim()}` : ''}`
}

export function renderWaffleScene(scene: ResolvedScene & NativeWaffleChartScene): Record<string, unknown> {
  const option = renderNativeBarScene({ ...pieFrameScene(scene), geometry: scene.geometry, resolvedReservations: scene.resolvedReservations })
  const config = scene.compatibilityConfig
  const placement = config.waffleLabelPosition ?? 'right'
  const { columns, rows, slices, counts } = scene.plot, plot = scene.geometry.plot
  const labels = placement === 'legend' ? [] : slices.filter((slice) => slice.label.visible && slice.label.text)
  const naturalLabelWidth = Math.max(0, ...labels.map((slice) => {
    const descriptionStyle = config.waffleDescriptionText ?? { ...slice.label.style, size: Math.max(6, Math.round(slice.label.style.size * .85)), weight: 400 }
    const width = (text: string, style: typeof slice.label.style) => Math.max(0, ...text.split('\n').map((line) => measureTextWidth(line, style.size, style.fontFamily, style.weight)))
    return Math.max(width(slice.label.text, slice.label.style), width(config.seriesStyles[slice.name]?.legendNote ?? '', descriptionStyle))
  }))
  const labelWidth = labels.length && placement === 'right' ? Math.min(plot.width * .35, naturalLabelWidth + 8) : 0
  const availableWidth = Math.max(1, plot.width - labelWidth - (labelWidth ? 24 : 0))
  const pitch = Math.max(.001, Math.min(availableWidth / columns, plot.height / rows))
  const gap = Math.min(scene.plot.gap, pitch * .6), size = pitch - gap
  const x = plot.x + (plot.width - pitch * columns - labelWidth - (labelWidth ? 24 : 0)) / 2
  const y = plot.y + (plot.height - pitch * rows) / 2
  const cells = slices.flatMap((slice, index) => Array.from({ length: counts[index] }, () => slice))
  const coordinates = waffleCellCoordinates(columns, rows, config.waffleFillDirection, config.waffleCorner, counts)
  const bounds = (index: number) => ({ x: x + coordinates[index][0] * pitch + gap / 2, y: y + coordinates[index][1] * pitch + gap / 2, width: size, height: size })
  const selection = (slice: typeof slices[number]) => ({ elementKey: slice.legacyKey, sourceSeriesName: slice.name, displayCategory: slice.name, displayValue: slice.displayValue, displayColor: slice.color })
  const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
  const labelGraphics: unknown[] = []
  const labelHits: Array<{ rect: { x: number; y: number; width: number; height: number }; info: ReturnType<typeof selection> & { selectionTarget: 'value-label' } }> = []
  const layouts = labels.map((slice) => {
    const index = slices.indexOf(slice), offset = counts.slice(0, index).reduce((sum, count) => sum + count, 0)
    const occupied = Array.from({ length: counts[index] }, (_, cell) => offset + cell)
    let area = { x: x + pitch * columns + 24, y: plot.y, width: labelWidth, height: plot.height }
    const categoryCells = occupied.map((cell) => coordinates[cell])
    let block = waffleLabelArea(columns, rows, categoryCells)
    if (placement === 'right' && config.waffleFillDirection === 'corner' && categoryCells.length) {
      const rightmost = Math.max(...categoryCells.map(([column]) => column))
      block = { ...waffleLabelArea(1, rows, categoryCells.filter(([column]) => column === rightmost).map(([, row]) => [0, row])), column: rightmost }
    }
    const blockRect = { x: x + block.column * pitch + gap / 2, y: y + block.row * pitch + gap / 2, width: Math.max(0, block.width * pitch - gap), height: Math.max(0, block.height * pitch - gap) }
    if (placement === 'inside') {
      area = blockRect
      area = { x: area.x + 6, y: area.y + 6, width: Math.max(0, area.width - 12), height: Math.max(0, area.height - 12) }
    }
    const override = config.elementStyles[slice.legacyKey]
    const color = override?.valueText?.color ?? (config.waffleLabelColor === 'category' ? slice.color : config.waffleLabelColor === 'auto' && placement === 'inside' ? contrastText(slice.color) : slice.label.color)
    const description = config.seriesStyles[slice.name]?.legendNote?.trim() ?? ''
    const bodyStyle = config.waffleDescriptionText ?? { ...slice.label.style, size: Math.max(6, Math.round(slice.label.style.size * .85)), weight: 400 }
    const width = Math.max(1, area.width)
    const title = wrapMeasuredText(slice.label.text, slice.label.style.size, width, slice.label.style.fontFamily, slice.label.style.weight)
    const body = wrapMeasuredText(description, bodyStyle.size, width, bodyStyle.fontFamily, bodyStyle.weight)
    const titleHeight = title.lines * Math.round(slice.label.style.size * slice.label.style.lineHeight / 100)
    const bodyHeight = body.lines * Math.round(bodyStyle.size * bodyStyle.lineHeight / 100)
    const height = titleHeight + (bodyHeight ? bodyHeight + 8 : 0)
    return { slice, area, blockRect, color, bodyStyle, title, body, titleHeight, bodyHeight, height, preferredTop: blockRect.y + blockRect.height / 2 - height / 2, offset }
  })
  if (placement === 'right') layouts.sort((a, b) => a.preferredTop - b.preferredTop)
  let sideY = y
  const sideTops = layouts.map((layout) => { const top = Math.max(sideY, layout.preferredTop); sideY = top + layout.height + 16; return top })
  if (placement === 'right') {
    let bottom = y + pitch * rows
    for (let index = layouts.length - 1; index >= 0; index--) { sideTops[index] = Math.max(y, Math.min(sideTops[index], bottom - layouts[index].height)); bottom = sideTops[index] - 16 }
  }
  let labelIndex = 0
  for (const layout of layouts) {
    const { slice, area, blockRect, color, bodyStyle, title, body, titleHeight, bodyHeight } = layout
    const top = placement === 'inside' ? area.y : sideTops[labelIndex++]
    const availableHeight = placement === 'inside' ? area.height : Math.max(0, plot.y + plot.height - top)
    if (availableHeight < slice.label.style.size || area.width < slice.label.style.size * 2) continue
    const clippedTitleHeight = Math.min(titleHeight, availableHeight)
    const shownBodyHeight = Math.max(0, Math.min(bodyHeight, availableHeight - clippedTitleHeight - 8))
    const height = clippedTitleHeight + (shownBodyHeight ? shownBodyHeight + 8 : 0)
    const children: unknown[] = []
    const silhouette = (size: number) => placement === 'inside' && config.waffleLabelBackground !== false ? { stroke: slice.color, lineWidth: Math.max(3, size * .35) } : {}
    if (placement === 'right' && config.waffleFillDirection === 'corner') children.push({ type: 'polyline', silent: true, shape: { points: [[blockRect.x + blockRect.width, blockRect.y + blockRect.height / 2], [x + pitch * columns + 12, blockRect.y + blockRect.height / 2], [area.x - 6, top + height / 2]] }, style: { stroke: slice.color, lineWidth: 1, fill: 'none' } })
    children.push({ type: 'text', z: 21, style: { ...nativeGraphicTextStyle(slice.label.style), ...silhouette(slice.label.style.size), x: area.x, y: top, text: title.text, fill: color, align: 'left', verticalAlign: 'top', width: area.width, height: clippedTitleHeight, overflow: 'truncate', lineOverflow: 'truncate', ellipsis: '…' } })
    if (shownBodyHeight) children.push({ type: 'text', z: 21, style: { ...nativeGraphicTextStyle(bodyStyle), ...silhouette(bodyStyle.size), x: area.x, y: top + clippedTitleHeight + 8, text: body.text, fill: config.waffleLabelColor === 'text' || !config.waffleLabelColor ? bodyStyle.color : color, align: 'left', verticalAlign: 'top', width: area.width, height: shownBodyHeight, overflow: 'truncate', lineOverflow: 'truncate', ellipsis: '…' } })
    labelGraphics.push({ id: `waffle-label:${slice.id}`, type: 'group', z: 20, children })
    labelHits.push({ rect: { x: area.x, y: top, width: area.width, height }, info: { ...selection(slice), selectionTarget: 'value-label' } })
  }
  const unitLegend = scene.geometry.reservations['waffle-unit-legend']
  if (unitLegend) {
    const style = config.waffleUnitLegendText ?? config.legendText, marker = size
    const position = config.waffleUnitLegendPosition ?? 'top', side = position === 'left' || position === 'right'
    const legendX = side ? unitLegend.x : x + gap / 2
    const caption = wrapMeasuredText(waffleUnitCaption(scene), style.size, Math.max(1, (side ? unitLegend.width : plot.x + plot.width - legendX) - marker - 10), style.fontFamily, style.weight)
    const textHeight = caption.lines * Math.round(style.size * style.lineHeight / 100)
    const legendTop = side ? y + gap / 2 : position === 'bottom' ? y + pitch * rows - gap / 2 + 12 : y + gap / 2 - Math.max(marker, textHeight) - 12
    const centerY = legendTop + Math.max(marker, textHeight) / 2
    labelGraphics.push({ id: 'waffle-unit-legend', type: 'group', silent: true, z: 20, children: [
      { type: 'rect', shape: { x: legendX, y: centerY - marker / 2, width: marker, height: marker, r: marker * scene.plot.radius }, style: { fill: slices[0]?.color ?? config.color } },
      { type: 'text', style: { ...nativeGraphicTextStyle(style), x: legendX + marker + 10, y: centerY, text: caption.text, align: 'left', verticalAlign: 'middle' } },
    ] })
  }
  const legend = option.legend as { data?: Array<{ name: string }> }
  return {
    ...option, animation: false, xAxis: undefined, yAxis: undefined,
    nativeSelectionHits: [...cells.map((slice, index) => ({ rect: bounds(index), info: selection(slice) })), ...labelHits],
    legend: { ...legend, selectedMode: false, data: legend.data?.map((item) => ({ ...item, textStyle: (config.legendLabelColorByCategory ?? config.waffleLabelColor === 'category') ? { color: slices.find((slice) => slice.name === item.name)?.color } : undefined })) },
    tooltip: { trigger: 'item', confine: true, formatter: (params: { seriesIndex: number }) => { const slice = slices[params.seriesIndex]; return slice ? `<b>${escape(slice.name)}</b><br/>${escape(slice.displayValue)}` : '' } },
    graphic: [...(option.graphic as unknown[] ?? []), ...labelGraphics],
    series: slices.map((slice, sliceIndex) => {
      const offset = counts.slice(0, sliceIndex).reduce((sum, count) => sum + count, 0)
      const categoryCells = cells.slice(offset, offset + counts[sliceIndex])
      return {
      id: `waffle:${slice.id}`, animation: false, name: slice.name, itemStyle: { color: slice.color }, type: 'custom', coordinateSystem: 'none', triggerEvent: true,
      data: categoryCells.map((slice, index) => ({ value: index, elementId: slice.id, datumId: slice.datumId, seriesId: slice.seriesId, elementKey: slice.legacyKey, sourceSeriesName: slice.name, displayCategory: slice.name, displayValue: slice.displayValue, displayColor: slice.color })),
      renderItem: (params: { dataIndex: number }) => {
        const index = offset + params.dataIndex
        return { type: 'rect', info: { elementId: slice.id, datumId: slice.datumId, seriesId: slice.seriesId, elementKey: slice.legacyKey, sourceSeriesName: slice.name, displayCategory: slice.name, displayValue: slice.displayValue, displayColor: slice.color }, shape: { ...bounds(index), r: size * scene.plot.radius }, style: { fill: slice.color }, emphasis: { style: { stroke: scene.compatibilityConfig.axisLineColor, lineWidth: 1 } } }
      },
    } }),
  }
}
