import type { DataTable } from '../core/types'

interface Props { fileName: string; sheets: Array<{ name: string; table: DataTable }>; source?: string; onSelect(table: DataTable): void; onClose(): void }

export function ExcelSheetDialog({ fileName, sheets, source = 'Книга Excel', onSelect, onClose }: Props) {
  return <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="date-dialog sheet-dialog" role="dialog" aria-modal="true">
    <header><div><span className="eyebrow">{source}</span><h2>Выберите лист</h2><p>{fileName} · найдено листов: {sheets.length}</p></div><button onClick={onClose}>×</button></header>
    <div className="dialog-body sheet-list">{sheets.map(({ name, table }, index) => <button key={`${name}-${index}`} disabled={!table.columns.length || !table.rows.length} onClick={() => onSelect(table)}><span>▦</span><div><strong>{name}</strong><small>{table.rows.length.toLocaleString('ru-RU')} строк · {table.columns.length} столбцов</small></div><b>{table.rows.length ? 'Открыть →' : 'Пустой лист'}</b></button>)}</div>
    <footer><button className="button" onClick={onClose}>Отмена</button></footer>
  </section></div>
}
