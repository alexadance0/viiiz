import { useEffect, useMemo, useState } from 'react'
import { Pagination } from '@heroui/react'
import type { ColumnType, DataIssue, DataTable } from '../core/types'
import { findDuplicateRowIndices } from '../core/dataQuality'

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
}

export function DataReview({ table, types, issues, onRename, onType, onConfigureDate, onEditCell, onRemoveDuplicates, onDeleteRows }: Props) {
  const [selectedColumn, setSelectedColumn] = useState(table.columns[0])
  const [editing, setEditing] = useState<{ row: number; column: string; value: string } | null>(null)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(100)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
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
  useEffect(() => { setPage((current) => Math.min(current, totalPages - 1)); setSelectedRows(new Set()) }, [table.rows, totalPages])
  const toggleRow = (index: number) => setSelectedRows((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next })
  const togglePage = () => setSelectedRows((current) => { const next = new Set(current); pageIndices.forEach((index) => allPageSelected ? next.delete(index) : next.add(index)); return next })

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
        <div><span className="summary-icon good">✓</span><strong>{table.rows.length.toLocaleString('ru-RU')}</strong><small>строк прочитано</small></div>
        <div><span className="summary-icon">▥</span><strong>{table.columns.length}</strong><small>столбцов</small></div>
        <div><span className={`summary-icon ${issues.some((item) => item.severity === 'critical') ? 'bad' : issues.length ? 'warn' : 'good'}`}>!</span><strong>{issues.length}</strong><small>проблем найдено</small></div>
        <div className="summary-tip"><span>Выберите столбец в таблице, чтобы изменить его параметры</span><b>→</b></div>
      </div>
      {datasetIssues.length > 0 && <div className="dataset-warnings">{datasetIssues.map((issue, index) => <div className={`file-warning ${issue.kind ?? ''}`} key={index}><strong>⚠ {issue.kind === 'duplicate' ? 'Найдены дубликаты' : 'Набор требует внимания'}</strong><span>{issue.message}{issue.examples?.length ? ` · ${issue.examples.join(', ')}` : ''}</span>{issue.kind === 'duplicate' && <button onClick={onRemoveDuplicates}>Удалить дубликаты</button>}</div>)}</div>}

      <div className="review-layout">
        <div className="review-table-wrap">
          <div className="table-toolbar"><div><button className="delete-rows" disabled={!selectedRows.size} onClick={() => { onDeleteRows([...selectedRows]); setSelectedRows(new Set()) }}>Удалить выбранные{selectedRows.size ? ` (${selectedRows.size})` : ''}</button><span>Выберите лишние строки флажками</span></div><label>Строк на странице<select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0) }}><option>50</option><option>100</option><option>250</option></select></label></div>
          <table className="review-table">
            <thead><tr><th className="row-number"><input type="checkbox" aria-label="Выбрать текущую страницу" checked={allPageSelected} onChange={togglePage}/></th>{table.columns.map((column) => {
              const severity = severityFor(column)
              const issue = issues.find((item) => item.column === column)
              return <th key={column} className={`column-head ${severity} ${activeColumn === column ? 'selected' : ''}`} onClick={() => setSelectedColumn(column)}>
                <div className="column-title"><span className="quality-dot"/><strong>{column}</strong><span className="column-chevron">›</span></div>
                <div className="column-meta"><span className="type-pill"><b>{typeIcons[types[column]]}</b>{typeLabels[types[column]]}</span>{table.timeProfiles?.[column] && types[column] === 'date' && <span>{table.timeProfiles[column].label}</span>}</div>
                <div className={`column-health ${issue ? severity : 'clean'}`}>{issue ? `⚠ ${issue.message}` : table.normalizations?.[column] ? `✦ ${table.normalizations[column].format}` : '✓ Без проблем'}</div>
              </th>
            })}</tr></thead>
            <tbody>{pageIndices.map((rowIndex) => { const row = table.rows[rowIndex]; return <tr className={`${duplicateRows.has(rowIndex) ? 'duplicate-row' : ''} ${selectedRows.has(rowIndex) ? 'selected-row' : ''}`} key={rowIndex}><td className="row-number"><input type="checkbox" aria-label={`Выбрать строку ${rowIndex + 1}`} checked={selectedRows.has(rowIndex)} onChange={() => toggleRow(rowIndex)}/><b>{rowIndex + 1}</b>{duplicateRows.has(rowIndex) && <span title="Дубликат">D</span>}</td>{table.columns.map((column) => {
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
              <Pagination.Item><Pagination.Previous isDisabled={safePage === 0} onPress={() => setPage(safePage - 1)}><Pagination.PreviousIcon />Назад</Pagination.Previous></Pagination.Item>
              {safePage > 0 && <Pagination.Item><Pagination.Link onPress={() => setPage(0)}>1</Pagination.Link></Pagination.Item>}
              {safePage > 1 && <Pagination.Item><Pagination.Ellipsis /></Pagination.Item>}
              <Pagination.Item><Pagination.Link isActive>{safePage + 1}</Pagination.Link></Pagination.Item>
              {safePage < totalPages - 2 && <Pagination.Item><Pagination.Ellipsis /></Pagination.Item>}
              {safePage < totalPages - 1 && <Pagination.Item><Pagination.Link onPress={() => setPage(totalPages - 1)}>{totalPages}</Pagination.Link></Pagination.Item>}
              <Pagination.Item><Pagination.Next isDisabled={safePage >= totalPages - 1} onPress={() => setPage(safePage + 1)}>Вперёд<Pagination.NextIcon /></Pagination.Next></Pagination.Item>
            </Pagination.Content>
          </Pagination>
        </div>

        <aside className="column-inspector">
          <div className="inspector-heading"><div><span>Настройки столбца</span><h3>{activeColumn}</h3></div><span className={`inspector-status ${severityFor(activeColumn)}`}>{severityFor(activeColumn) === 'clean' ? '✓' : '!'}</span></div>
          <div className="edit-hint">Дважды нажмите на ячейку, чтобы изменить значение</div>
          <div className="inspector-section"><label>Название<input defaultValue={activeColumn} key={activeColumn} onBlur={(event) => rename(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}/></label><label>Тип данных<select value={types[activeColumn]} onChange={(event) => onType(activeColumn, event.target.value as ColumnType)}>{Object.entries(typeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>

          {types[activeColumn] === 'date' && <div className="inspector-section date-settings"><div className="inspector-section-title"><span>Временные данные</span>{timeProfile && <b>{timeProfile.confidence}%</b>}</div>{timeProfile && <div className="frequency-card"><span>◷</span><div><strong>{timeProfile.label}</strong><small>Периодичность ряда</small></div></div>}<button className="date-format-button" onClick={() => onConfigureDate(activeColumn)}><span>⌘</span><div><strong>Формат даты</strong><small>{table.dateRules?.[activeColumn]?.format ?? normalization?.format ?? 'Определён автоматически'}</small></div><b>Настроить →</b></button></div>}

          <div className="inspector-section"><div className="inspector-section-title"><span>Качество данных</span></div><div className="column-stats"><div><strong>{table.rows.length - missingCount}</strong><small>заполнено</small></div><div className={missingCount ? 'has-missing' : ''}><strong>{missingCount}</strong><small>пропусков</small></div><div><strong>{uniqueCount}</strong><small>уникальных</small></div></div>{columnIssues.length ? <div className="inspector-issues">{columnIssues.map((issue, index) => <div className={issue.severity} key={index}><span>!</span><p>{issue.message}{issue.examples?.length ? <small>{issue.examples.join(' · ')}</small> : null}</p></div>)}</div> : <div className="all-good">✓ Проблем не обнаружено</div>}</div>

          {normalization && <div className="inspector-section auto-rule"><div className="inspector-section-title"><span>Обработка</span></div><p>Формат <b>{normalization.format}</b></p><div><span>Преобразовано</span><b>{normalization.converted}</b></div><div><span>Уверенность</span><b>{normalization.confidence}%</b></div></div>}
        </aside>
      </div>
    </div>
  )
}
