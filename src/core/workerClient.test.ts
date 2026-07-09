import { describe, expect, it } from 'vitest'
import { normalizeInWorker } from './workerClient'

describe('normalization worker client fallback', () => {
  it('normalizes data and reports progress outside a browser worker', async () => {
    const progress: number[] = []
    const table = await normalizeInWorker({
      name: 'data.csv', columns: ['date', 'value'], rows: [
        { date: '2024-Q1', value: '10,5' }, { date: '2024-Q2', value: '11,5' },
      ],
    }, 'ru-RU', (value) => progress.push(value))
    expect(table.rows[0].date).toBeInstanceOf(Date)
    expect(table.rows[0].value).toBe(10.5)
    expect(progress.at(-1)).toBe(100)
  })

  it('rejects an operation that was aborted before it started', async () => {
    const controller = new AbortController(); controller.abort()
    await expect(normalizeInWorker({ name: 'data', columns: ['value'], rows: [{ value: 1 }] }, 'ru-RU', () => undefined, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})
