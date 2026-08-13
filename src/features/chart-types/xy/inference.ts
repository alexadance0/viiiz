import type { DataTable } from '../../../core/types'

const numericFields = (table: DataTable) => table.columns.filter((field) => table.rows.some((row) => typeof row[field] === 'number' && Number.isFinite(row[field])))

export function inferBubbleSizeField(table: DataTable, xField: string, yFields: string[], preferred?: string) {
  const candidates = numericFields(table).filter((field) => field !== xField && !yFields.includes(field))
  return preferred && candidates.includes(preferred) ? preferred : candidates[0]
}

export function inferScatterLabelField(table: DataTable, xField: string, yFields: string[], sizeField?: string, colorField?: string) {
  return table.columns.find((field) => field !== xField && !yFields.includes(field) && field !== sizeField && field !== colorField
    && table.rows.some((row) => typeof row[field] === 'string' && String(row[field]).trim()))
}
