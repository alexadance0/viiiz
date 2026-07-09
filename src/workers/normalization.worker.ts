/// <reference lib="webworker" />
import { normalizeImportedTable } from '../core/normalization'
import type { DataTable } from '../core/types'

interface Request { table: DataTable; locale: string }

self.onmessage = ({ data }: MessageEvent<Request>) => {
  try {
    const table = normalizeImportedTable(data.table, data.locale, (completed, total) => {
      self.postMessage({ type: 'progress', progress: Math.round(completed / Math.max(total, 1) * 100) })
    })
    self.postMessage({ type: 'complete', table })
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Ошибка обработки данных' })
  }
}
