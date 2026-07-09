import { normalizeImportedTable } from './normalization'
import type { DataTable } from './types'

export function normalizeInWorker(
  table: DataTable,
  locale: string,
  onProgress: (progress: number) => void,
  signal?: AbortSignal,
): Promise<DataTable> {
  if (signal?.aborted) return Promise.reject(new DOMException('Обработка отменена', 'AbortError'))
  if (typeof Worker === 'undefined') {
    return Promise.resolve(normalizeImportedTable(table, locale, (completed, total) => onProgress(Math.round(completed / Math.max(total, 1) * 100))))
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/normalization.worker.ts', import.meta.url), { type: 'module' })
    let settled = false
    const finish = (action: () => void) => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', abort)
      worker.terminate()
      action()
    }
    const abort = () => finish(() => reject(new DOMException('Обработка отменена', 'AbortError')))
    signal?.addEventListener('abort', abort, { once: true })
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') onProgress(data.progress)
      if (data.type === 'complete') finish(() => resolve(data.table))
      if (data.type === 'error') finish(() => reject(new Error(data.message)))
    }
    worker.onerror = (event) => finish(() => reject(new Error(event.message)))
    worker.postMessage({ table, locale })
  })
}
