import type { ChartConfig } from '../core/types'
import { SettingsCheckbox } from './SettingsCheckbox'

interface Props {
  config: ChartConfig
  onChange(config: ChartConfig): void
}

export function BubbleSizeLegendSettings({ config, onChange }: Props) {
  const patch = (values: Partial<ChartConfig>) => onChange({ ...config, ...values })
  return <details className="settings-group bubble-size-legend-settings" open>
    <summary>Легенда размеров</summary>
    <div>
      <SettingsCheckbox isSelected={config.scatterSizeLegend !== false} onChange={(scatterSizeLegend) => patch({ scatterSizeLegend })}>Показывать легенду</SettingsCheckbox>
      {config.scatterSizeLegend !== false && <>
        <label>Заголовок<input value={config.scatterSizeLegendTitle ?? ''} placeholder={config.scatterSizeField || 'Размер'} onChange={(event) => patch({ scatterSizeLegendTitle: event.target.value })}/></label>
        <label>Положение<select value={config.scatterSizeLegendPosition ?? 'top-left'} onChange={(event) => patch({ scatterSizeLegendPosition: event.target.value as ChartConfig['scatterSizeLegendPosition'] })}><option value="top-left">Сверху слева</option><option value="top-right">Сверху справа</option><option value="bottom-left">Снизу слева</option><option value="bottom-right">Снизу справа</option></select></label>
      </>}
    </div>
  </details>
}
