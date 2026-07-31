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

function wrapParagraph(paragraph: string, width: number, style: ChartTextStyle, measure: Measure) {
  if (!paragraph) return ['']
  const words = paragraph.trim().split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (measure(candidate, style) <= width) { line = candidate; continue }
    if (line) { lines.push(line); line = '' }
    if (measure(word, style) <= width) { line = word; continue }
    let fragment = ''
    for (const character of word) {
      if (fragment && measure(fragment + character, style) > width) { lines.push(fragment); fragment = character }
      else fragment += character
    }
    line = fragment
  }
  if (line) lines.push(line)
  return lines
}

export function layoutText(input: TextLayoutInput, measure: Measure = canvasMeasure): TextLayoutResult {
  const style = input.document.baseStyle
  const sourceText = input.document.blocks.map((block) => block.runs.map((run) => run.text).join('')).join('\n')
  const maxWidth = Math.max(1, input.maxWidth)
  const key = measure === canvasMeasure ? JSON.stringify([sourceText, style, maxWidth, input.rotation ?? 0, input.wrap !== false]) : ''
  const cached = key && cache.get(key)
  if (cached) return cached
  const lines = sourceText.split('\n').flatMap((paragraph) => input.wrap === false ? [paragraph] : wrapParagraph(paragraph, maxWidth, style, measure))
  const lineHeight = Math.round(style.size * style.lineHeight / 100)
  const size = { width: Math.min(maxWidth, Math.max(0, ...lines.map((line) => measure(line, style)))), height: Math.max(1, lines.length) * lineHeight }
  const result = { lines, sourceText, size, rotatedSize: rotatedSize(size, input.rotation ?? 0), lineHeight }
  if (key) cache.set(key, result)
  return result
}

export const plainTextDocument = (text: string, baseStyle: ChartTextStyle): TextDocument => ({ blocks: [{ runs: [{ text }] }], baseStyle })

export function textLayoutRect(layout: TextLayoutResult, anchor: { x: number; y: number }, align: ChartTextStyle['align']): Rect {
  const width = layout.size.width
  return { x: align === 'center' ? anchor.x - width / 2 : align === 'right' ? anchor.x - width : anchor.x, y: anchor.y, width, height: layout.size.height }
}
