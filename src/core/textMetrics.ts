export function measureTextWidth(value: string, size: number, fontFamily: string, weight = 400) {
  if (typeof document === 'undefined') return value.length * size * .58
  const context = document.createElement('canvas').getContext('2d')
  if (!context) return value.length * size * .58
  context.font = `${weight} ${size}px ${fontFamily}`
  return context.measureText(value).width
}

export function wrapMeasuredText(value: string, size: number, width: number, fontFamily: string, weight = 400) {
  if (!value) return { text: '', lines: 0 }
  const context = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  if (context) context.font = `${weight} ${size}px ${fontFamily}`
  const measure = (text: string) => context ? context.measureText(text).width : text.length * size * .58
  const availableWidth = Math.max(1, width)
  const lines: string[] = []
  value.split('\n').forEach((paragraph) => {
    if (!paragraph) { lines.push(''); return }
    const words = paragraph.trim().split(/\s+/)
    let line = ''
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word
      if (measure(candidate) <= availableWidth) { line = candidate; return }
      if (line) { lines.push(line); line = '' }
      if (measure(word) <= availableWidth) { line = word; return }
      let fragment = ''
      for (const character of word) {
        if (fragment && measure(fragment + character) > availableWidth) { lines.push(fragment); fragment = character }
        else fragment += character
      }
      line = fragment
    })
    if (line || !words.length) lines.push(line)
  })
  return { text: lines.join('\n'), lines: Math.max(1, lines.length) }
}

export function measuredTextHeight(value: string, size: number, lineHeightPercent: number, width: number, fontFamily = 'Arial, sans-serif', weight = 400) {
  if (!value) return 0
  return wrapMeasuredText(value, size, width, fontFamily, weight).lines * Math.round(size * lineHeightPercent / 100)
}
