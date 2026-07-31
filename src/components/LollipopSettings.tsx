import type { ChartConfig } from '../core/types'
import { NumberInput } from './NumberInput'

interface Props {
  config: ChartConfig
  seriesNames: string[]
  xKind: 'date' | 'number' | 'other'
  onChange(config: ChartConfig): void
}

export function LollipopSettings({ config, seriesNames, xKind, onChange }: Props) {
  const patch = (values: Partial<ChartConfig>) => onChange({ ...config, ...values })
  const patchAll = (values: ChartConfig['seriesStyles'][string]) => onChange({ ...config, seriesStyles: { ...config.seriesStyles, ...Object.fromEntries(seriesNames.map((name) => [name, { ...config.seriesStyles[name], ...values }])) } })
  const styles = seriesNames.map((name) => config.seriesStyles[name])
  return <details className="settings-group lollipop-settings" open>
    <summary>Леденцы</summary>
    <div>
      {xKind === 'other' && <><label>Сортировка категорий<select value={config.barCategorySort ?? 'none'} onChange={(event) => patch({ barCategorySort: event.target.value as NonNullable<ChartConfig['barCategorySort']> })}><option value="none">Как в данных</option><option value="value-desc">По значению: от большего</option><option value="value-asc">По значению: от меньшего</option><option value="name-asc">По названию: А → Я</option><option value="name-desc">По названию: Я → А</option></select></label>{seriesNames.length > 1 && (config.barCategorySort === 'value-asc' || config.barCategorySort === 'value-desc') && <label>Основа сортировки<select value={config.barCategorySortSeries ?? ''} onChange={(event) => patch({ barCategorySortSeries: event.target.value })}><option value="">Сумма всех рядов</option>{seriesNames.map((name) => <option value={name} key={name}>{name}</option>)}</select></label>}</>}
      <label>Размер точек, px<NumberInput min="4" max="40" value={styles[0]?.markerSize ?? 12} onValueChange={(markerSize) => patchAll({ markerSize })}/></label>
      <label>Толщина стебля, px<NumberInput min="1" max="12" step="0.5" value={styles[0]?.lineWidth ?? 2} onValueChange={(lineWidth) => patchAll({ lineWidth })}/></label>
      <small className="settings-note">Подписи значений располагаются у конечной точки каждого леденца.</small>
    </div>
  </details>
}
