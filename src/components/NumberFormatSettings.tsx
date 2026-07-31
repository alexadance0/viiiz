import { Tabs } from '@heroui/react'
import type { ChartConfig } from '../core/types'
import { formatChartNumber, formatXAxisNumber, formatYAxisNumber } from '../core/numberFormat'
import { NumberInput } from './NumberInput'
import { SettingsCheckbox } from './SettingsCheckbox'

const AffixFields = ({ prefix, suffix, onChange }: { prefix: string; suffix: string; onChange(values: { prefix?: string; suffix?: string }): void }) =>
  <div className="fred-grid number-affix-fields">
    <label>Префикс<input className="text-input" maxLength={40} value={prefix} placeholder="₽" onChange={(event) => onChange({ prefix: event.target.value })}/></label>
    <label>Суффикс<input className="text-input" maxLength={40} value={suffix} placeholder=" тыс." onChange={(event) => onChange({ suffix: event.target.value })}/></label>
  </div>

const AffixScopeSelect = ({ value, onChange }: { value: NonNullable<ChartConfig['yAxisAffixScope']>; onChange(value: NonNullable<ChartConfig['yAxisAffixScope']>): void }) =>
  <label className="number-affix-scope">Где показывать<select value={value} onChange={(event) => onChange(event.target.value as NonNullable<ChartConfig['yAxisAffixScope']>)}><option value="all">На всех делениях</option><option value="first">Только на первом</option><option value="last">Только на последнем</option><option value="edges">На первом и последнем</option></select></label>

export function NumberFormatSettings({ config, onChange }: { config: ChartConfig; onChange(config: ChartConfig): void }) {
  const patch = (values: Partial<ChartConfig>) => onChange({ ...config, ...values })
  const operation = config.numberOperation ?? 'none'
  const linked = config.valueLabelAffixesLinked ?? true
  const sample = 1234.5
  const previewPositions = ['first', 'middle', 'last'] as const

  return <details className="settings-group number-format-settings">
    <summary>Формат чисел</summary>
    <div>
      <section className="number-format-card">
        <header><b>Запись числа</b><small>Разделители, округление и вид нуля</small></header>
        <div className="fred-grid">
          <label>Разделители<select value={config.numberLocale ?? 'ru-RU'} onChange={(event) => patch({ numberLocale: event.target.value as ChartConfig['numberLocale'] })}><option value="ru-RU">1 234,5</option><option value="en-US">1,234.5</option></select></label>
          <label>Знаков после запятой<select value={config.numberDecimals == null ? 'auto' : String(config.numberDecimals)} onChange={(event) => patch({ numberDecimals: event.target.value === 'auto' ? null : Number(event.target.value) })}><option value="auto">Автоматически</option>{[0, 1, 2, 3, 4].map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
        </div>
        <SettingsCheckbox isSelected={config.numberGrouping ?? true} onChange={(numberGrouping) => patch({ numberGrouping })}>Разделять группы разрядов</SettingsCheckbox>
        <label>Подпись для нуля<input className="text-input" maxLength={40} value={config.numberZeroLabel ?? ''} placeholder="0" onChange={(event) => patch({ numberZeroLabel: event.target.value || undefined })}/></label>
      </section>

      <section className="number-format-card">
        <header><b>Преобразование значений</b><small>Меняет отображение Y и значений, но не исходные данные и ось X</small></header>
        <Tabs className="settings-tabs number-operation" selectedKey={operation} onSelectionChange={(key) => patch({ numberOperation: String(key) as ChartConfig['numberOperation'] })}>
          <Tabs.ListContainer><Tabs.List aria-label="Преобразование чисел">{([['none', 'Без изменений'], ['divide', 'Делить'], ['multiply', 'Умножать']] as const).map(([value, label]) => <Tabs.Tab id={value} key={value}><Tabs.Indicator/>{label}</Tabs.Tab>)}</Tabs.List></Tabs.ListContainer>
          <Tabs.Panel id="none">{null}</Tabs.Panel>
          <Tabs.Panel id="divide"><label>Делить на<NumberInput min="0.0000001" step="any" value={config.numberFactor ?? 1} onValueChange={(numberFactor) => patch({ numberFactor: Math.abs(numberFactor) })}/><small>Например, деление на 1 000 покажет 1 500 как 1,5.</small></label></Tabs.Panel>
          <Tabs.Panel id="multiply"><label>Умножать на<NumberInput min="0.0000001" step="any" value={config.numberFactor ?? 1} onValueChange={(numberFactor) => patch({ numberFactor: Math.abs(numberFactor) })}/></label></Tabs.Panel>
        </Tabs>
      </section>

      <section className="number-format-card number-affix-card">
        <header><b>Аффиксы</b><small>Префикс ставится перед числом, суффикс — после него</small></header>
        <div className="number-affix-group">
          <div className="number-affix-heading"><b>Ось Y</b><small>Числовые деления оси</small></div>
          <AffixFields prefix={config.numberPrefix ?? ''} suffix={config.numberSuffix ?? ''} onChange={({ prefix, suffix }) => patch({ ...(prefix != null ? { numberPrefix: prefix } : {}), ...(suffix != null ? { numberSuffix: suffix } : {}) })}/>
          <AffixScopeSelect value={config.yAxisAffixScope ?? 'all'} onChange={(yAxisAffixScope) => patch({ yAxisAffixScope })}/>
        </div>
        <div className="number-affix-group">
          <div className="number-affix-heading"><b>Ось X</b><small>Только для числовой оси; даты и категории не меняются</small></div>
          <AffixFields prefix={config.xAxisNumberPrefix ?? ''} suffix={config.xAxisNumberSuffix ?? ''} onChange={({ prefix, suffix }) => patch({ ...(prefix != null ? { xAxisNumberPrefix: prefix } : {}), ...(suffix != null ? { xAxisNumberSuffix: suffix } : {}) })}/>
          <AffixScopeSelect value={config.xAxisAffixScope ?? 'all'} onChange={(xAxisAffixScope) => patch({ xAxisAffixScope })}/>
        </div>
        <div className="number-affix-group">
          <div className="number-affix-heading"><b>Подписи значений</b><small>Числа рядом со столбцами, точками и линиями</small></div>
          <SettingsCheckbox isSelected={linked} onChange={(isLinked) => patch(isLinked ? { valueLabelAffixesLinked: true } : { valueLabelAffixesLinked: false, valueLabelPrefix: config.valueLabelPrefix ?? config.numberPrefix ?? '', valueLabelSuffix: config.valueLabelSuffix ?? config.numberSuffix ?? '' })}>Как на оси Y</SettingsCheckbox>
          {!linked && <AffixFields prefix={config.valueLabelPrefix ?? ''} suffix={config.valueLabelSuffix ?? ''} onChange={({ prefix, suffix }) => patch({ ...(prefix != null ? { valueLabelPrefix: prefix } : {}), ...(suffix != null ? { valueLabelSuffix: suffix } : {}) })}/>}
        </div>
        <div className="number-format-preview" aria-label="Предпросмотр аффиксов">
          <div><span>Ось Y</span><b>{previewPositions.map((position, index) => formatYAxisNumber(index * sample, config, position)).join(' · ')}</b></div>
          <div><span>Ось X</span><b>{previewPositions.map((position, index) => formatXAxisNumber((index + 1) * 6, config, position)).join(' · ')}</b></div>
          <div><span>На графике</span><b>{formatChartNumber(sample, config)}</b></div>
        </div>
      </section>

      <button type="button" className="reset-element" onClick={() => patch({ numberLocale: 'ru-RU', numberDecimals: null, numberOperation: 'none', numberFactor: 1, numberPrefix: '', numberSuffix: '', yAxisAffixScope: 'all', xAxisNumberPrefix: '', xAxisNumberSuffix: '', xAxisAffixScope: 'all', valueLabelAffixesLinked: true, valueLabelPrefix: undefined, valueLabelSuffix: undefined, numberGrouping: true, numberZeroLabel: undefined, xAxisStartLabel: undefined, xAxisEndLabel: undefined })}>Вернуть стандартный формат</button>
    </div>
  </details>
}
