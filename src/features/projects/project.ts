import { z } from 'zod'
import type { ChartConfig, ColumnType, DataTable } from '../../core/types'
import { createDefaultChartConfig } from '../../entities/chart/model/defaultChartConfig'
import type { EditorStep } from '../editor/ui/EditorStepper'

export const MAX_PROJECT_BYTES = 64_000_000
export interface EditorProject {
  format: 'viiiz-project'
  version: 1
  updatedAt: string
  table: DataTable
  types: Record<string, ColumnType>
  config: ChartConfig
  step: EditorStep
  multiplesMode: boolean
}

const text = z.string().max(1_000_000)
const number = z.number().finite()
const strings = z.array(text).max(10000)
const point = z.object({ x: number, y: number })
const record = <T extends z.ZodType>(value: T) => z.record(z.string(), value)
const dataValue = z.union([text, number, z.boolean(), z.date(), z.null()])
const dataRows = z.array(record(dataValue)).max(1_000_000)
const tableSchema = z.object({
  name: z.string().min(1).max(1000), columns: strings.min(1), rows: dataRows.min(1),
  textColumns: strings.optional(), importWarnings: strings.optional(), rawRows: dataRows.optional(),
  normalizations: record(z.object({ kind: z.enum(['number', 'date', 'boolean', 'missing']), format: text, confidence: number, converted: number, ambiguous: number })).optional(),
  observationFlags: record(record(strings)).optional(),
  timeProfiles: record(z.object({ frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'semiannual', 'annual', 'irregular']), label: text, confidence: number, source: z.enum(['notation', 'intervals']) })).optional(),
  dateRules: record(z.object({ format: text, twoDigitYearPivot: number, invalid: z.enum(['keep', 'null']) })).optional(),
  imputedCells: record(record(z.object({ method: z.enum(['linear', 'forward', 'seasonal', 'empty']), generatedPeriod: z.boolean() }))).optional(),
}).refine((table) => new Set(table.columns).size === table.columns.length, 'Повторяющиеся столбцы')

// Defaults validate existing settings while allowing newer optional settings to round-trip.
function settingsSchema(value: unknown): z.ZodType {
  if (typeof value === 'string') return text
  if (typeof value === 'number') return number
  if (typeof value === 'boolean') return z.boolean()
  if (value === null) return z.union([number, text, z.null()])
  if (Array.isArray(value)) return z.array(value.length ? settingsSchema(value[0]) : z.unknown()).max(10000)
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
    return entries.length ? z.looseObject(Object.fromEntries(entries.map(([key, child]) => [key, settingsSchema(child)]))) : record(z.unknown())
  }
  return z.unknown()
}
const defaults = createDefaultChartConfig()
const defaultSettings = Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, settingsSchema(value).optional()]))
const styleSchema = z.looseObject({
  color: text.optional(), fillOpacity: number.min(0).max(1).optional(),
  lineWidth: number.min(0).optional(), borderWidth: number.min(0).optional(),
  valueText: settingsSchema(defaults.valueText).optional(),
})
const annotationSchema = z.looseObject({
  id: text, x: number, y: number, width: number.min(0), height: number.min(0).optional(),
  fontFamily: text, fontSize: number.positive(), backgroundColor: text, borderColor: text,
  textAlign: z.enum(['left', 'center', 'right']),
  fragments: z.array(z.looseObject({ id: text, text, color: text, bold: z.boolean(), italic: z.boolean() })).max(10000),
  html: text.optional(),
})
const anchorSchema = z.looseObject({ annotationId: text.optional(), elementKey: text.optional(), position: point.optional(), side: z.enum(['auto', 'left', 'right', 'top', 'bottom']).optional() })
const decorationSchema = z.looseObject({
  id: text, type: z.enum(['area', 'line', 'horizontal-line', 'vertical-line', 'arrow', 'curved-line']),
  x: number, y: number, width: number, height: number, color: text, opacity: number.min(0).max(1), lineWidth: number.min(0),
  lineType: z.enum(['solid', 'dashed', 'dotted']), startAnchor: anchorSchema.optional(), endAnchor: anchorSchema.optional(),
  controlPoints: z.object({ first: point, second: point }).optional(),
})
const kinds = ['bar', 'stacked-bar', 'normalized-stacked-bar', 'waterfall', 'horizontal-bar', 'butterfly', 'horizontal-stacked-bar', 'horizontal-normalized-stacked-bar', 'lollipop', 'horizontal-lollipop', 'dumbbell', 'dot-plot', 'arrow-plot', 'bump', 'line', 'spline', 'step-line', 'indexed-line', 'seasonal-line', 'slope', 'range-line', 'step-range-line', 'confidence-line', 'map-russia', 'map-usa', 'map-europe', 'map-world', 'tilemap-russia', 'tilemap-usa', 'tilemap-europe', 'tilemap-world', 'moving-average-line', 'moving-average-scatter', 'heatmap', 'treemap', 'sankey', 'pie', 'donut', 'waffle', 'marimekko', 'area', 'stacked-area', 'normalized-stacked-area', 'stream-graph', 'scatter', 'bubble', 'connected-scatter', 'boxplot', 'violinplot', 'raincloud', 'histogram', 'kde-plot', 'ridgeline', 'beeswarm', 'strip-plot', 'jitter-plot', 'counts-plot', 'barcode-plot'] as const
const configSchema: z.ZodType = z.lazy(() => z.looseObject({
  ...defaultSettings, kind: z.enum(kinds), xField: text, yField: text, yFields: strings, seriesField: text,
  xAxisLabelRotate: z.union([z.literal('auto'), number]).optional(),
  canvasWidth: number.positive().max(10000).optional(), canvasHeight: number.positive().max(10000).optional(),
  palette: strings.min(1).optional(), elementStyles: record(styleSchema), seriesStyles: record(styleSchema),
  annotations: z.array(annotationSchema).max(10000), decorations: z.array(decorationSchema).max(10000).optional(),
  customFonts: z.array(z.object({ name: text, dataUrl: z.string().max(12_000_000).regex(/^data:(font\/|application\/)[\w.+-]+;base64,[A-Za-z0-9+/=]+$/), fileName: text.optional(), weight: number.optional(), style: z.enum(['normal', 'italic']).optional() })).max(20).optional(),
  directLabelPositions: record(point).optional(), treemapLeafOrder: record(strings).optional(),
  intervalGroups: z.array(z.object({ main: text, lower: text, upper: text, showBounds: z.boolean().optional() })).max(1000).optional(),
  legendItemOverrides: record(z.object({ label: text.optional(), visible: z.boolean().optional() })).optional(),
  categoryLabelOverrides: z.object({ x: record(text).optional(), y: record(text).optional() }).optional(),
  colorEncoding: z.object({ mode: z.enum(['single', 'categories', 'bins']), field: text.optional(), categories: z.array(z.object({ value: text, label: text.optional(), color: text })).optional(), thresholds: z.array(number).optional(), binColors: strings.optional(), binLabels: strings.optional(), missingColor: text.optional(), missingLabel: text.optional(), missingPattern: z.enum(['none', 'diagonal']).optional() }).optional(),
  multiples: z.looseObject({ columns: number.int().min(1).max(16), rows: number.int().min(1).max(16), gap: number.min(0), panels: z.array(z.object({ id: text, config: configSchema }).nullable()).max(256), sharedValueScale: z.boolean().optional(), sharedXScale: z.boolean().optional(), sharedCategoryLabels: z.boolean().optional(), equalCategorySpacing: z.boolean().optional() }).optional(),
}))
const projectSchema = z.object({
  format: z.literal('viiiz-project'), version: z.literal(1), updatedAt: z.string().datetime(),
  table: tableSchema, types: record(z.enum(['text', 'number', 'date', 'boolean'])), config: configSchema,
  step: z.enum(['source', 'data', 'chart', 'design']), multiplesMode: z.boolean(),
}).refine((project) => project.table.columns.every((column) => Object.hasOwn(project.types, column)), 'Не заданы типы столбцов')
  .refine((project) => !project.multiplesMode || Boolean((project.config as ChartConfig).multiples), 'Нет композиции')

function validateTree(value: unknown, depth = 0): void {
  if (depth > 32) throw new Error('Слишком сложная структура проекта')
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Некорректное число в проекте')
  if (!value || typeof value !== 'object' || value instanceof Date) return
  for (const [key, child] of Object.entries(value)) {
    if (key === '__proto__' || (key === 'constructor' || key === 'prototype') && child && typeof child === 'object') throw new Error('Недопустимое поле проекта')
    validateTree(child, depth + 1)
  }
}
function withDefaults(config: ChartConfig): ChartConfig {
  return { ...createDefaultChartConfig(), ...config, ...(config.multiples ? { multiples: { ...config.multiples, panels: config.multiples.panels.map((panel) => panel ? { ...panel, config: withDefaults(panel.config) } : null) } } : {}) }
}
export function validateProject(value: unknown): EditorProject {
  validateTree(value)
  const result = projectSchema.safeParse(value)
  if (!result.success) throw new Error('Не удалось открыть проект: неверный формат или повреждённые данные')
  const project = result.data as EditorProject
  return { ...project, config: withDefaults(project.config) }
}
export function serializeProject(project: EditorProject): string {
  validateTree(project)
  const text = JSON.stringify(project, function (this: Record<string, unknown>, key, value) {
    const original = this[key]
    return original instanceof Date ? { $viiizDate: original.toISOString() } : value
  })
  if (new TextEncoder().encode(text).byteLength > MAX_PROJECT_BYTES) throw new Error('Проект больше 64 МБ. Уменьшите объём данных перед сохранением.')
  return text
}
export function parseProject(text: string): EditorProject {
  if (new TextEncoder().encode(text).byteLength > MAX_PROJECT_BYTES) throw new Error('Файл проекта больше 64 МБ')
  try {
    return validateProject(JSON.parse(text, (_key, value) => {
      if (value && typeof value === 'object' && Object.keys(value).length === 1 && typeof value.$viiizDate === 'string') {
        const date = new Date(value.$viiizDate)
        if (!Number.isFinite(date.getTime())) throw new Error('Некорректная дата')
        return date
      }
      return value
    }))
  } catch (cause) {
    if (cause instanceof SyntaxError) throw new Error('Не удалось прочитать файл проекта')
    throw cause
  }
}
