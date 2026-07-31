import { layoutText, plainTextDocument } from '../features/chart-layout/textLayout'

const style = (size: number, fontFamily: string, weight: number) => ({ fontFamily, size, weight, italic: false, lineHeight: 100, align: 'left' as const, color: '#000000' })

export function measureTextWidth(value: string, size: number, fontFamily: string, weight = 400) {
  if (typeof document === 'undefined') return value.length * size * .58
  const context = document.createElement('canvas').getContext('2d')
  if (!context) return value.length * size * .58
  context.font = `${weight} ${size}px ${fontFamily}`
  return context.measureText(value).width
}

export function wrapMeasuredText(value: string, size: number, width: number, fontFamily: string, weight = 400) {
  if (!value) return { text: '', lines: 0 }
  const result = layoutText({ document: plainTextDocument(value, style(size, fontFamily, weight)), maxWidth: width })
  return { text: result.lines.join('\n'), lines: result.lines.length }
}

export function measuredTextHeight(value: string, size: number, lineHeightPercent: number, width: number, fontFamily = 'Arial, sans-serif', weight = 400) {
  if (!value) return 0
  return wrapMeasuredText(value, size, width, fontFamily, weight).lines * Math.round(size * lineHeightPercent / 100)
}
