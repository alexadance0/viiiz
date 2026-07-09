import { describe, expect, it } from 'vitest'
import { wrapMeasuredText } from './textMetrics'

describe('measured text wrapping', () => {
  it('moves whole words to a new line when they fit individually', () => {
    const wrapped = wrapMeasuredText('Подробное примечание к ряду', 10, 90, 'Arial')
    expect(wrapped.lines).toBeGreaterThan(1)
    expect(wrapped.text.replaceAll('\n', ' ')).toBe('Подробное примечание к ряду')
    expect(wrapped.text.split('\n')).not.toContain('Подробно')
  })

  it('splits only a token that cannot fit on an empty line', () => {
    const wrapped = wrapMeasuredText('обычное сверхдлинноесловобезпробелов', 10, 70, 'Arial')
    expect(wrapped.text.split('\n')[0]).toBe('обычное')
    expect(wrapped.lines).toBeGreaterThan(2)
  })
})
