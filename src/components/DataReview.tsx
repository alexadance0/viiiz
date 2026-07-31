import { useEffect, useMemo, useState } from 'react'
import { Pagination } from '@heroui/react'
import { ArrowRightLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import type { ColumnType, DataIssue, DataTable } from '../core/types'
import { findDuplicateRowIndices } from '../core/dataQuality'
import { SettingsCheckbox } from './SettingsCheckbox'

const typeLabels: Record<ColumnType, string> = { text: 'Текст', number: 'Число', date: 'Дата', boolean: 'Логический' }
const typeIcons: Record<ColumnType, string> = { text: 'Aa', number: '#', date: '◷', boolean: '◐' }

interface Props {
  table: DataTable
  types: Record<string, ColumnType>
  issues: DataIssue[]
  onRename(oldName: string, newName: string): void
  onType(column: string, type: ColumnType): void
  onConfigureDate(column: string): void
  onEditCell(rowIndex: number, column: string, value: string): void
  onRemoveDuplicates(): void
  onDeleteRows(indices: number[]): void
  onDeleteColumns(columns: string[]): void
  onTranspose(): void
}

export function DataReview({ table, types, issues, onRename, onType, onConfigureDate, onEditCell, onRemoveDuplicates, onDeleteRows, onDeleteColumns, onTranspose }: Props) {
  const [selectedColumn, setSelectedColumn] = useState(table.columns[0])
  const [editing, setEditing] = useState<{ row: number; column: string; value: string } | null>(null)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(100)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set())
  const activeColumn = table.columns.includes(selectedColumn) ? selectedColumn : table.columns[0]
  const datasetIssues = issues.filter((issue) => !issue.column)
  const duplicateRows = useMemo(() => new Set(findDuplicateRowIndices(table)), [table])
  const columnIssues = issues.filter((issue) => issue.column === activeColumn)
  const normalization = table.normalizations?.[activeColumn]
  const timeProfile = table.timeProfiles?.[activeColumn]
  const values = useMemo(() => table.rows.map((row) => row[activeColumn]), [activeColumn, table.rows])
  const missingCount = useMemo(() => values.filter((value) => value == null || value === '').length, [values])
  const uniqueCount = useMemo(() => new Set(values.filter((value) => value != null).map(String)).size, [values])
  const totalPages = Math.max(1, Math.ceil(table.rows.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const pageStart = safePage * pageSize
  const pageIndices = Array.from({ length: Math.min(pageSize, table.rows.length - pageStart) }, (_, index) => pageStart + index)
  const allPageSelected = pageIndices.length > 0 && pageIndices.every((index) => selectedRows.has(index))
  const criticalIssues = issues.filter((issue) => issue.severity === 'critical').length
  useEffect(() => { setPage((current) => Math.min(current, totalPages - 1)); setSelectedRows(new Set()) }, [table.rows, totalPages])
  useEffect(() => { setSelectedColumns((current) => new Set([...current].filter((column) => table.columns.includes(column)))) }, [table.columns])
  const toggleRow = (index: number) => setSelectedRows((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next })
  const togglePage = () => setSelectedRows((current) => { const next = new Set(current); pageIndices.forEach((index) => allPageSelected ? next.delete(index) : next.add(index)); return next })
  const toggleColumn = (column: string) => setSelectedColumns((current) => { const next = new Set(current); if (next.has(column)) next.delete(column); else next.add(column); return next })

  const severityFor = (column: string) => {
    const found = issues.filter((issue) => issue.column === column)
    return found.some((issue) => issue.severity === 'critical') ? 'critical' : found.some((issue) => issue.severity === 'warning') ? 'warning' : 'clean'
  }
  const rename = (newName: string) => {
    const clean = newName.trim()
    if (clean && clean !== activeColumn && !table.columns.includes(clean)) {
      onRename(activeColumn, clean); setSelectedColumn(clean)
    }
  }

  return (
    <div className="review-card">
      <div className="review-summary">
        <div><strong>{table.rows.length.toLocaleString('ru-RU')}</strong><span>строк</span></div>
        <div><strong>{table.columns.length}</strong><span>столбцов</span></div>
        <div className={`review-status ${criticalIssues ? 'critical' : issues.length ? 'warning' : 'clean'}`}><i/>{criticalIssues ? `${criticalIssues} критич.` : issues.length ? `${issues.length} требуют проверки` : 'Проблем нет'}</div>
      </div>
      {datasetIssues.length > 0 && <div className="dataset-warnings">{datasetIssues.map((issue, index) => <div className={`file-warning ${issue.kind ?? ''}`} key={index}><strong>⚠ {issue.kind === 'duplicate' ? 'Найдены дубликаты' : 'Набор требует внимания'}</strong><span>{issue.message}{issue.examples?.length ? ` · ${issue.examples.join(', ')}` : ''}</span>{issue.kind === 'duplicate' && <button onClick={onRemoveDuplicates}>Удалить дубликаты</button>}</div>)}</div>}

      <div className="review-layout">
        <div className="review-table-wrap">
          <div className="table-toolbar"><div><button className="transpose-table" disabled={table.columns.length < 2 || !table.rows.length} onClick={onTranspose} title="Первая колонка станет заголовками новых столбцов"><ArrowRightLeft size={14}/>Транспонировать</button>{selectedRows.size > 0 && <button className="delete-rows" onClick={() => { onDeleteRows([...selectedRows]); setSelectedRows(new Set()) }}>Удалить строки ({selectedRows.size})</button>}{selectedColumns.size > 0 && <button className="delete-columns" disabled={selectedColumns.size === table.columns.length} title={selectedColumns.size === table.columns.length ? 'Нельзя удалить все столбцы' : 'Удалить отмеченные столбцы'} onClick={() => { const removed = [...selectedColumns]; const nextActive = table.columns.find((column) => !selectedColumns.has(column)); onDeleteColumns(removed); setSelectedColumns(new Set()); if (selectedColumns.has(activeColumn) && nextActive) setSelectedColumn(nextActive) }}>Удалить столбцы ({selectedColumns.size})</button>}</div><label><span className="sr-only">Строк на странице</span><select aria-label="Строк на странице" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0) }}><option>50</option><option>100</option><option>250</option></select></label></div>
          <table className="review-table">
            <thead><tr><th className="row-number"><SettingsCheckbox className="table-select-checkbox" ariaLabel="Выбрать текущую страницу" isSelected={allPageSelected} onChange={togglePage}><span className="sr-only">Выбрать страницу</span></SettingsCheckbox></th>{table.columns.map((column) => {
              const severity = severityFor(column)
              return <th key={column} className={`column-head ${severity} ${activeColumn === column ? 'selected' : ''} ${selectedColumns.has(column) ? 'selected-for-delete' : ''}`} onClick={() => setSelectedColumn(column)}>
                <div className="column-title"><span onClick={(event) => event.stopPropagation()}><SettingsCheckbox className="table-select-checkbox" ariaLabel={`Выбрать столбец ${column}`} isSelected={selectedColumns.has(column)} onChange={() => toggleColumn(column)}><span className="sr-only">Выбрать столбец</span></SettingsCheckbox></span><span className="quality-dot"/><strong>{column}</strong></div>
                <div className="column-meta"><span className="type-pill"><b>{typeIcons[types[column]]}</b>{typeLabels[types[column]]}</span>{table.timeProfiles?.[column] && types[column] === 'date' && <span>{table.timeProfiles[column].label}</span>}</div>
              </th>
            })}</tr></thead>
            <tbody>{pageIndices.map((rowIndex) => { const row = table.rows[rowIndex]; return <tr className={`${duplicateRows.has(rowIndex) ? 'duplicate-row' : ''} ${selectedRows.has(rowIndex) ? 'selected-row' : ''}`} key={rowIndex}><td className="row-number"><SettingsCheckbox className="table-select-checkbox" ariaLabel={`Выбрать строку ${rowIndex + 1}`} isSelected={selectedRows.has(rowIndex)} onChange={() => toggleRow(rowIndex)}><span className="sr-only">Выбрать строку</span></SettingsCheckbox><b>{rowIndex + 1}</b>{duplicateRows.has(rowIndex) && <span title="Дубликат">D</span>}</td>{table.columns.map((column) => {
              const empty = row[column] == null || row[column] === ''
              const isEditing = editing?.row === rowIndex && editing.column === column
              const imputed = table.imputedCells?.[column]?.[rowIndex]
              const source = table.rawRows?.[rowIndex]?.[column] ?? row[column]
              return <td title={imputed ? `Восстановлено методом: ${imputed.method}` : undefined} className={`${empty ? 'missing-cell' : ''} ${activeColumn === column ? 'selected-cell' : ''} ${isEditing ? 'editing-cell' : ''} ${imputed ? 'imputed-cell' : ''}`} onClick={() => setSelectedColumn(column)} onDoubleClick={() => setEditing({ row: rowIndex, column, value: String(source ?? '') })} key={column}>{isEditing ? <input autoFocus value={editing.value} onChange={(event) => setEditing({ ...editing, value: event.target.value })} onBlur={(event) => { if (event.currentTarget.dataset.cancelled !== 'true') onEditCell(rowIndex, column, editing.value); setEditing(null) }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { event.currentTarget.dataset.cancelled = 'true'; event.currentTarget.blur() } }}/> : <>{imputed && <i className="imputed-mark">∿</i>}{empty ? <span>пропуск</span> : row[column] instanceof Date ? row[column].toLocaleDateString('ru-RU') : String(row[column])}</>}</td>
            })}</tr>})}</tbody>
          </table>
          <Pagination className="table-pagination" size="sm">
            <Pagination.Summary>{pageStart + 1}–{Math.min(pageStart + pageSize, table.rows.length)} из {table.rows.length.toLocaleString('ru-RU')}</Pagination.Summary>
            <Pagination.Content>
              <Pagination.Item><Pagination.Previous aria-label="Предыдущая страница" isDisabled={safePage === 0} onPress={() => setPage(safePage - 1)}><Pagination.PreviousIcon><ChevronLeft size={15}/></Pagination.PreviousIcon></Pagination.Previous></Pagination.Item>
              {safePage > 0 && <Pagination.Item><Pagination.Link onPress={() => setPage(0)}>1</Pagination.Link></Pagination.Item>}
              {safePage > 1 && <Pagination.Item><Pagination.Ellipsis /></Pagination.Item>}
              <Pagination.Item><Pagination.Link isActive>{safePage + 1}</Pagination.Link></Pagination.Item>
              {safePage < totalPages - 2 && <Pagination.Item><Pagination.Ellipsis /></Pagination.Item>}
              {safePage < totalPages - 1 && <Pagination.Item><Pagination.Link onPress={() => setPage(totalPages - 1)}>{totalPages}</Pagination.Link></Pagination.Item>}
              <Pagination.Item><Pagination.Next aria-label="Следующая страница" isDisabled={safePage >= totalPages - 1} onPress={() => setPage(safePage + 1)}><Pagination.NextIcon><ChevronRight size={15}/></Pagination.NextIcon></Pagination.Next></Pagination.Item>
            </Pagination.Content>
          </Pagination>
        </div>

        <aside className="column-inspector">
          <div className="inspector-heading"><div><h3>{activeColumn}</h3><span>{typeLabels[types[activeColumn]]}</span></div><span className={`inspector-status ${severityFor(activeColumn)}`}>{severityFor(activeColumn) === 'clean' ? '✓' : '!'}</span></div>
          <div className="inspector-section"><label>Название<input defaultValue={activeColumn} key={activeColumn} onBlur={(event) => rename(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}/></label><label>Тип данных<select value={types[activeColumn]} onChange={(event) => onType(activeColumn, event.target.value as ColumnType)}>{Object.entries(typeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>

          {types[activeColumn] === 'date' && <div className="inspector-section date-settings"><div className="inspector-section-title"><span>Временные данные</span>{timeProfile && <b>{timeProfile.confidence}%</b>}</div>{timeProfile && <div className="frequency-card"><span>◷</span><div><strong>{timeProfile.label}</strong><small>Периодичность ряда</small></div></div>}<button className="date-format-button" onClick={() => onConfigureDate(activeColumn)}><span>⌘</span><div><strong>Формат даты</strong><small>{table.dateRules?.[activeColumn]?.format ?? normalization?.format ?? 'Определён автоматически'}</small></div><b>Настроить →</b></button></div>}

          <div className="inspector-section"><div className="inspector-section-title"><span>Качество данных</span></div><div className="column-stats"><div><strong>{table.rows.length - missingCount}</strong><small>заполнено</small></div><div className={missingCount ? 'has-missing' : ''}><strong>{missingCount}</strong><small>пропусков</small></div><div><strong>{uniqueCount}</strong><small>уникальных</small></div></div>{columnIssues.length ? <div className="inspector-issues">{columnIssues.map((issue, index) => <div className={issue.severity} key={index}><span>!</span><p>{issue.message}{issue.examples?.length ? <small>{issue.examples.join(' · ')}</small> : null}</p></div>)}</div> : <div className="all-good">✓ Проблем не обнаружено</div>}</div>

          {normalization && <div className="inspector-section auto-rule"><div className="inspector-section-title"><span>Обработка</span></div><p>Формат <b>{normalization.format}</b></p><div><span>Преобразовано</span><b>{normalization.converted}</b></div><div><span>Уверенность</span><b>{normalization.confidence}%</b></div></div>}
        </aside>
      </div>
    </div>
  )
}
