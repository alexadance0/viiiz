import type { NativeWaffleChartScene, ResolvedScene } from '../../../entities/chart/model/ChartScene'
import { pieFrameScene } from '../../chart-types/pie/layout'
import { resolveNativeCartesianScene } from '../../chart-types/bar/layout'
import { contrastText } from '../../../core/color'
import { measureTextWidth, wrapMeasuredText } from '../../../core/textMetrics'
import { nativeGraphicTextStyle, renderNativeBarScene } from './renderBarScene'

export function resolveNativeWaffleScene(scene: NativeWaffleChartScene): ResolvedScene & NativeWaffleChartScene {
  const frame = resolveNativeCartesianScene(pieFrameScene(scene))
  return { ...scene, geometry: frame.geometry, resolvedReservations: frame.resolvedReservations }
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
    return Math.max(width(slice.label.text, slice.label.style), width(config.seriesStyles[slice.name]?.legendNote ?? '', descriptionStyle)) + (config.waffleLabelColor === 'category' ? 0 : 20)
  }))
  const labelWidth = labels.length && placement === 'right' ? Math.min(plot.width * .35, naturalLabelWidth + 8) : 0
  const availableWidth = Math.max(1, plot.width - labelWidth - (labelWidth ? 24 : 0))
  const pitch = Math.max(1, Math.min(availableWidth / columns, plot.height / rows))
  const gap = Math.min(scene.plot.gap, pitch * .6), size = pitch - gap
  const x = plot.x + (plot.width - pitch * columns - labelWidth - (labelWidth ? 24 : 0)) / 2
  const y = plot.y + (plot.height - pitch * rows) / 2
  const cells = slices.flatMap((slice, index) => Array.from({ length: counts[index] }, () => slice))
  const bounds = (index: number) => ({ x: x + index % columns * pitch + gap / 2, y: y + (config.waffleFillDirection === 'top' ? Math.floor(index / columns) : rows - 1 - Math.floor(index / columns)) * pitch + gap / 2, width: size, height: size })
  const selection = (slice: typeof slices[number]) => ({ elementKey: slice.legacyKey, sourceSeriesName: slice.name, displayCategory: slice.name, displayValue: slice.displayValue, displayColor: slice.color })
  const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
  const labelGraphics: unknown[] = []
  const labelHits: Array<{ rect: { x: number; y: number; width: number; height: number }; info: ReturnType<typeof selection> & { selectionTarget: 'value-label' } }> = []
  const layouts = labels.map((slice) => {
    const index = slices.indexOf(slice), offset = counts.slice(0, index).reduce((sum, count) => sum + count, 0)
    const occupied = Array.from({ length: counts[index] }, (_, cell) => offset + cell)
    let area = { x: x + pitch * columns + 24, y: plot.y, width: labelWidth, height: plot.height }
    if (placement === 'inside') {
      // A label uses a rectangle occupied entirely by its category, never its overlapping bounding box.
      const rowSegments = Array.from({ length: rows }, (_, row) => {
        const indices = occupied.filter((cell) => Math.floor(cell / columns) === row)
        if (!indices.length) return null
        const first = bounds(indices[0]), last = bounds(indices.at(-1)!)
        return { x: first.x, y: first.y, width: last.x + last.width - first.x, height: size }
      }).filter((segment): segment is NonNullable<typeof segment> => Boolean(segment))
      const candidates = [...rowSegments]
      const fullRows = rowSegments.filter((segment) => Math.abs(segment.width - (columns * pitch - gap)) < .01)
      if (fullRows.length) candidates.push({ x: fullRows[0].x, y: Math.min(...fullRows.map((segment) => segment.y)), width: columns * pitch - gap, height: fullRows.length * pitch - gap })
      area = candidates.sort((a, b) => b.width * b.height - a.width * a.height)[0] ?? { x, y, width: 0, height: 0 }
      area = { x: area.x + 6, y: area.y + 6, width: Math.max(0, area.width - 12), height: Math.max(0, area.height - 12) }
    }
    const override = config.elementStyles[slice.legacyKey]
    const color = override?.valueText?.color ?? (config.waffleLabelColor === 'category' ? slice.color : config.waffleLabelColor === 'auto' && placement === 'inside' ? contrastText(slice.color) : slice.label.color)
    const description = config.seriesStyles[slice.name]?.legendNote?.trim() ?? ''
    const bodyStyle = config.waffleDescriptionText ?? { ...slice.label.style, size: Math.max(6, Math.round(slice.label.style.size * .85)), weight: 400 }
    const marker = placement === 'right' && config.waffleLabelColor !== 'category' ? 20 : 0
    const width = Math.max(1, area.width - marker)
    const title = wrapMeasuredText(slice.label.text, slice.label.style.size, width, slice.label.style.fontFamily, slice.label.style.weight)
    const body = wrapMeasuredText(description, bodyStyle.size, width, bodyStyle.fontFamily, bodyStyle.weight)
    const titleHeight = title.lines * Math.round(slice.label.style.size * slice.label.style.lineHeight / 100)
    const bodyHeight = body.lines * Math.round(bodyStyle.size * bodyStyle.lineHeight / 100)
    return { slice, area, color, bodyStyle, marker, title, body, titleHeight, bodyHeight, height: titleHeight + (bodyHeight ? bodyHeight + 8 : 0), preferredTop: occupied.length ? Math.min(...occupied.map((cell) => bounds(cell).y)) : plot.y, offset }
  })
  if (placement === 'right') layouts.sort((a, b) => a.preferredTop - b.preferredTop)
  let sideY = plot.y
  const sideTops = layouts.map((layout) => { const top = Math.max(sideY, layout.preferredTop); sideY = top + layout.height + 16; return top })
  if (placement === 'right') {
    let bottom = plot.y + plot.height
    for (let index = layouts.length - 1; index >= 0; index--) { sideTops[index] = Math.max(plot.y, Math.min(sideTops[index], bottom - layouts[index].height)); bottom = sideTops[index] - 16 }
  }
  let labelIndex = 0
  for (const layout of layouts) {
    const { slice, area, color, bodyStyle, marker, title, body, titleHeight, bodyHeight } = layout
    const top = placement === 'inside' ? area.y : sideTops[labelIndex++]
    const availableHeight = placement === 'inside' ? area.height : Math.max(0, plot.y + plot.height - top)
    if (availableHeight < slice.label.style.size || area.width < slice.label.style.size * 2) continue
    const clippedTitleHeight = Math.min(titleHeight, availableHeight)
    const shownBodyHeight = Math.max(0, Math.min(bodyHeight, availableHeight - clippedTitleHeight - 8))
    const height = clippedTitleHeight + (shownBodyHeight ? shownBodyHeight + 8 : 0)
    const children: unknown[] = []
    const silhouette = (size: number) => placement === 'inside' && config.waffleLabelBackground !== false ? { stroke: slice.color, lineWidth: Math.max(3, size * .35) } : {}
    if (marker) children.push({ type: 'rect', shape: { x: area.x, y: top + 4, width: 10, height: 10 }, style: { fill: slice.color } })
    children.push({ type: 'text', z: 21, style: { ...nativeGraphicTextStyle(slice.label.style), ...silhouette(slice.label.style.size), x: area.x + marker, y: top, text: title.text, fill: color, align: 'left', verticalAlign: 'top', width: area.width - marker, height: clippedTitleHeight, overflow: 'truncate', lineOverflow: 'truncate', ellipsis: '…' } })
    if (shownBodyHeight) children.push({ type: 'text', z: 21, style: { ...nativeGraphicTextStyle(bodyStyle), ...silhouette(bodyStyle.size), x: area.x + marker, y: top + clippedTitleHeight + 8, text: body.text, fill: config.waffleLabelColor === 'text' || !config.waffleLabelColor ? bodyStyle.color : color, align: 'left', verticalAlign: 'top', width: area.width - marker, height: shownBodyHeight, overflow: 'truncate', lineOverflow: 'truncate', ellipsis: '…' } })
    labelGraphics.push({ id: `waffle-label:${slice.id}`, type: 'group', z: 20, children })
    labelHits.push({ rect: { x: area.x, y: top, width: area.width, height }, info: { ...selection(slice), selectionTarget: 'value-label' } })
  }
  const legend = option.legend as { data?: Array<{ name: string }> }
  return {
    ...option, animation: false, xAxis: undefined, yAxis: undefined,
    nativeSelectionHits: [...cells.map((slice, index) => ({ rect: bounds(index), info: selection(slice) })), ...labelHits],
    legend: { ...legend, selectedMode: false, data: legend.data?.map((item) => ({ ...item, textStyle: config.waffleLabelColor === 'category' ? { color: slices.find((slice) => slice.name === item.name)?.color } : undefined })) },
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
