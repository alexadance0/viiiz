import type { ChartTextStyle } from '../../core/types'
import { rotatedSize, type Rect, type Size } from './geometry'

export interface TextRun { text: string; style?: Partial<ChartTextStyle> }
export interface TextBlock { runs: TextRun[] }
export interface TextDocument { blocks: TextBlock[]; baseStyle: ChartTextStyle }
export interface TextLayoutInput {
  document: TextDocument
  maxWidth: number
  rotation?: number
  wrap?: boolean
}
export interface TextLayoutResult {
  lines: string[]
  lineRuns: Array<Array<{ text: string; style: ChartTextStyle }>>
  sourceText: string
  size: Size
  rotatedSize: Size
  lineHeight: number
}

type Measure = (text: string, style: ChartTextStyle) => number
const fallbackMeasure: Measure = (text, style) => text.length * style.size * .58

function canvasMeasure(text: string, style: ChartTextStyle) {
  if (typeof document === 'undefined') return fallbackMeasure(text, style)
  const context = sharedContext ??= document.createElement('canvas').getContext('2d')
  if (!context) return fallbackMeasure(text, style)
  context.font = `${style.italic ? 'italic ' : ''}${style.weight} ${style.size}px ${style.fontFamily}`
  return context.measureText(text).width
}
let sharedContext: CanvasRenderingContext2D | null | undefined

const cache = new Map<string, TextLayoutResult>()
export const invalidateTextLayoutCache = () => cache.clear()
export const waitForFonts = async () => {
  if (typeof document !== 'undefined' && document.fonts) await document.fonts.ready
  invalidateTextLayoutCache()
}

type ResolvedRun = { text: string; style: ChartTextStyle }
const runWidth = (runs: ResolvedRun[], measure: Measure) => runs.reduce((sum, run) => sum + measure(run.text, run.style), 0)
const mergeRun = (runs: ResolvedRun[], run: ResolvedRun) => {
  const previous = runs.at(-1)
  if (previous && JSON.stringify(previous.style) === JSON.stringify(run.style)) previous.text += run.text
  else runs.push({ ...run })
}

function wrapRuns(runs: ResolvedRun[], width: number, measure: Measure, wrap: boolean) {
  if (!wrap) return [runs]
  const tokens = runs.flatMap((run) => run.text.split(/(\s+)/).filter(Boolean).map((text) => ({ text, style: run.style })))
  const lines: ResolvedRun[][] = []
  let line: ResolvedRun[] = []
  const flush = () => {
    while (line.length) {
      const last = line.at(-1)!
      last.text = last.text.trimEnd()
      if (last.text) break
      line.pop()
    }
    lines.push(line)
    line = []
  }
  for (const token of tokens) {
    if (!line.length && !token.text.trim()) continue
    const candidate = line.map((run) => ({ ...run })); mergeRun(candidate, token)
    if (runWidth(candidate, measure) <= width) { line = candidate; continue }
    if (line.length) flush()
    if (!token.text.trim()) continue
    if (measure(token.text, token.style) <= width) { line = [{ ...token }]; continue }
    let fragment = ''
    for (const character of token.text) {
      if (fragment && measure(fragment + character, token.style) > width) { lines.push([{ text: fragment, style: token.style }]); fragment = character }
      else fragment += character
    }
    line = fragment ? [{ text: fragment, style: token.style }] : []
  }
  if (line.length || !lines.length) flush()
  return lines
}

export function layoutText(input: TextLayoutInput, measure: Measure = canvasMeasure): TextLayoutResult {
  const style = input.document.baseStyle
  const sourceText = input.document.blocks.map((block) => block.runs.map((run) => run.text).join('')).join('\n')
  const maxWidth = Math.max(1, input.maxWidth)
  const key = measure === canvasMeasure ? JSON.stringify([input.document, maxWidth, input.rotation ?? 0, input.wrap !== false]) : ''
  const cached = key && cache.get(key)
  if (cached) return cached
  const paragraphs: ResolvedRun[][] = [[]]
  input.document.blocks.forEach((block, blockIndex) => {
    if (blockIndex) paragraphs.push([])
    block.runs.forEach((run) => run.text.split('\n').forEach((part, partIndex) => {
      if (partIndex) paragraphs.push([])
      if (part) mergeRun(paragraphs.at(-1)!, { text: part, style: { ...style, ...run.style } })
    }))
  })
  const lineRuns = paragraphs.flatMap((paragraph) => wrapRuns(paragraph, maxWidth, measure, input.wrap !== false))
  const lines = lineRuns.map((runs) => runs.map((run) => run.text).join(''))
  const lineHeights = lineRuns.map((runs) => Math.max(Math.round(style.size * style.lineHeight / 100), ...runs.map((run) => Math.round(run.style.size * run.style.lineHeight / 100))))
  const lineHeight = Math.max(...lineHeights)
  const size = { width: Math.min(maxWidth, Math.max(0, ...lineRuns.map((runs) => runWidth(runs, measure)))), height: lineHeights.reduce((sum, height) => sum + height, 0) }
  const result = { lines, lineRuns, sourceText, size, rotatedSize: rotatedSize(size, input.rotation ?? 0), lineHeight }
  if (key) cache.set(key, result)
  return result
}

export const plainTextDocument = (text: string, baseStyle: ChartTextStyle): TextDocument => ({ blocks: [{ runs: [{ text }] }], baseStyle })

export function textLayoutRect(layout: TextLayoutResult, anchor: { x: number; y: number }, align: ChartTextStyle['align']): Rect {
  const width = layout.size.width
  return { x: align === 'center' ? anchor.x - width / 2 : align === 'right' ? anchor.x - width : anchor.x, y: anchor.y, width, height: layout.size.height }
}
