import type { ChartConfig, ChartTextStyle } from '../../../core/types'
import type { AxisSpec } from '../../chart-layout/axisLayout'
import type { Rect } from '../../chart-layout/geometry'
import { horizontalCategoryLabelPlacement, reservedAxisLabelGap, verticalAxisLabelPlacement } from '../../chart-layout/axisLabelPlacement'

const textStyle = (style: ChartTextStyle) => ({ color: style.color, fontFamily: style.fontFamily, fontSize: style.size, fontWeight: style.weight, fontStyle: style.italic ? 'italic' : 'normal', lineHeight: Math.round(style.size * style.lineHeight / 100) })

export function renderTimeAxis(axis: AxisSpec, config: ChartConfig, plot: Rect, rail?: Rect) {
  const { min, max, ticks } = axis.timeScale!
  const side = axis.placement.kind === 'side' ? axis.placement.side : axis.orientation === 'horizontal' ? config.xAxisPosition : config.yAxisPosition
  const values = ticks.map((tick) => tick.value), labels = new Map(ticks.map((tick) => [tick.value, tick.label]))
  const lineStyle = { color: config.axisLineColor, width: config.axisLineWidth, type: config.axisLineType }
  const rotation = axis.labels.rotation ?? (typeof config.xAxisLabelRotate === 'number' ? config.xAxisLabelRotate : 0)
  const nameGap = (axis.ticks.visible ? axis.ticks.length : 0) + (axis.labels.visible ? axis.labels.gap + axis.labels.size : 0) + (axis.title?.gap ?? 0)
  return {
    type: 'time', min, max: min === max ? max + 86400000 : max, boundaryGap: false, position: side, triggerEvent: true,
    inverse: axis.orientation === 'vertical' ? config.categoryAxisInverse ?? true : false,
    name: axis.orientation === 'vertical' ? '' : axis.title?.visible ? axis.title.text : '', nameLocation: 'middle', nameGap, nameTextStyle: axis.title ? textStyle(axis.title.style) : undefined,
    axisLine: { show: axis.line.visible, onZero: false, lineStyle },
    axisTick: { show: axis.ticks.visible, customValues: values, length: axis.ticks.length, lineStyle },
    axisLabel: { show: axis.labels.visible, customValues: values, formatter: (value: number) => labels.get(value) ?? '', hideOverlap: true, margin: axis.labels.gap, rotate: rotation, ...textStyle(axis.labels.style), ...(axis.orientation === 'horizontal' ? horizontalCategoryLabelPlacement(side as 'top' | 'bottom', rotation) : verticalAxisLabelPlacement(side as 'left' | 'right', axis.labels.size, reservedAxisLabelGap(axis, plot, rail), axis.ticks.visible ? axis.ticks.length : 0, config.categoryAxisLabelAlignment)) },
    splitLine: { show: axis.orientation === 'horizontal' ? config.showVerticalGrid : config.showHorizontalGrid, lineStyle: { color: config.gridColor, width: config.gridWidth, type: config.gridType } },
  }
}
