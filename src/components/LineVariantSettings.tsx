import type { ChartConfig } from '../core/types'
import { NumberInput } from './NumberInput'

interface Props { config: ChartConfig; numericColumns?: string[]; onChange(config: ChartConfig): void }

export function LineVariantSettings({ config, numericColumns = config.yFields, onChange }: Props) {
  const patch = (values: Partial<ChartConfig>) => onChange({ ...config, ...values })
  if (config.kind === 'step-line') return <details className="settings-group" open><summary>Специальная линия</summary><div><label>Переход между значениями<select value={config.stepPosition ?? 'end'} onChange={(event) => patch({ stepPosition: event.target.value as ChartConfig['stepPosition'] })}><option value="end">После значения</option><option value="start">До значения</option></select></label><small className="settings-note">Определяет, к какой точке относится горизонтальный участок ступени.</small></div></details>
  if (config.kind === 'range-line' || config.kind === 'step-range-line' || config.kind === 'confidence-line') {
    const confidence = config.kind === 'confidence-line'
    const stepped = config.kind === 'step-range-line'
    const autoGroups = config.yFields.slice(0, Math.floor(config.yFields.length / 3) * 3).reduce<NonNullable<ChartConfig['intervalGroups']>>((groups, field, index, fields) => {
      if (index % 3 === 0 && fields[index + 1] && fields[index + 2]) groups.push({ main: field, lower: fields[index + 1], upper: fields[index + 2] })
      return groups
    }, [])
    const groups = config.intervalGroups?.length ? config.intervalGroups : autoGroups
    const options = numericColumns.length ? numericColumns : config.yFields
    const setGroups = (intervalGroups: NonNullable<ChartConfig['intervalGroups']>) => patch({ intervalGroups, yFields: [...new Set(intervalGroups.flatMap((group) => [group.main, group.lower, group.upper]))], yField: intervalGroups[0]?.main ?? config.yField })
    const updateGroup = (index: number, values: Partial<NonNullable<ChartConfig['intervalGroups']>[number]>) => setGroups(groups.map((group, groupIndex) => groupIndex === index ? { ...group, ...values } : group))
    const addGroup = () => {
      const used = new Set(groups.flatMap((group) => [group.main, group.lower, group.upper]))
      const next = options.filter((column) => !used.has(column))
      setGroups([...groups, { main: next[0] ?? options[0] ?? config.yField, lower: next[1] ?? options[1] ?? config.yField, upper: next[2] ?? options[2] ?? config.yField }])
    }
    return <details className="settings-group line-variant-settings" open><summary>{confidence ? 'Линия с интервалом' : 'Диапазон между линиями'}</summary><div>
      {confidence && <div className="interval-group-list">{groups.map((group, index) => <div className="interval-group" key={index}>
        <div className="interval-group-title"><b>Группа {index + 1}</b>{groups.length > 1 && <button type="button" onClick={() => setGroups(groups.filter((_, groupIndex) => groupIndex !== index))}>Удалить</button>}</div>
        <label>Средняя линия<select value={group.main} onChange={(event) => updateGroup(index, { main: event.target.value })}>{options.map((column) => <option key={column}>{column}</option>)}</select></label>
        <label>Нижняя граница<select value={group.lower} onChange={(event) => updateGroup(index, { lower: event.target.value })}>{options.map((column) => <option key={column}>{column}</option>)}</select></label>
        <label>Верхняя граница<select value={group.upper} onChange={(event) => updateGroup(index, { upper: event.target.value })}>{options.map((column) => <option key={column}>{column}</option>)}</select></label>
        <label className="check"><input type="checkbox" checked={group.showBounds ?? false} onChange={(event) => updateGroup(index, { showBounds: event.target.checked })}/>Подписывать границы справа</label>
      </div>)}
      <button type="button" className="interval-add-group" onClick={addGroup}>Добавить группу</button></div>}
      {stepped && <label>Переход между значениями<select value={config.stepPosition ?? 'end'} onChange={(event) => patch({ stepPosition: event.target.value as ChartConfig['stepPosition'] })}><option value="end">После значения</option><option value="start">До значения</option></select></label>}
      <label>Прозрачность заливки, %<NumberInput min="0" max="80" value={Math.round((config.intervalFillOpacity ?? .18) * 100)} onValueChange={(value) => patch({ intervalFillOpacity: value / 100 })}/></label>
    </div></details>
  }
  return null
}
