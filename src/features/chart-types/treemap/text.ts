import { hyphenateSync as hyphenateRussian } from 'hyphen/ru'
import { measureTextWidth } from '../../../core/textMetrics'

export const hyphenateTreemapText = (value: string, hyphenChar = '\u00ad\ufeff') => hyphenateRussian(value, { hyphenChar, minWordLength: 6 })
export const treemapAdaptiveFontSize = (baseSize: number, share: number, minimum: number) => Math.max(minimum, Math.round(baseSize * Math.min(1.35, .55 + .8 * Math.sqrt(Math.min(1, share / .25)))))

export function wrapTreemapLabelText(value: string, width: number, size: number, fontFamily: string, weight: number) {
  const measure = (text: string) => measureTextWidth(text, size, fontFamily, weight)
  const lines: string[] = []
  const pushWord = (word: string) => {
    const syllables = hyphenateTreemapText(word, '\u0001').split('\u0001')
    let fragment = ''
    for (const syllable of syllables.length > 1 ? syllables : [...word]) {
      const candidate = `${fragment}${syllable}`
      if (fragment && measure(`${candidate}‐`) > width) { lines.push(`${fragment}‐`); fragment = syllable } else fragment = candidate
    }
    return fragment
  }
  value.split('\n').forEach((paragraph) => {
    let line = ''
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word
      if (measure(candidate) <= width) line = candidate
      else { if (line) lines.push(line); line = measure(word) <= width ? word : pushWord(word) }
    }
    if (line) lines.push(line)
  })
  return lines
}
