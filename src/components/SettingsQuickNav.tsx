import type { ChartSettingsCapabilities } from '../core/types'

interface Props {
  features: ChartSettingsCapabilities['features']
  showSeries: boolean
}

export function SettingsQuickNav({ features, showSeries }: Props) {
  const items = [['Холст', 'Холст'], ['Отступы и расстояния', 'Отступы и расстояния'], ['Заголовок и подзаголовок', 'Заголовок и подзаголовок'], ['Общий стиль текста', 'Общий стиль текста'], ['Палитра', 'Палитра']]
  if (features.barLayout) items.push(['Компоновка столбцов', 'Компоновка столбцов'])
  if (features.areaLayout) items.push(['Заливка области', 'Заливка области'])
  if (features.scatterLayout) items.push(['Точки и зависимости', 'Точки и зависимости'])
  if (features.distributionLayout) items.push(['Форма распределения', 'Форма распределения'])
  if (features.lineVariant) items.push(['Параметры специальной линии', 'Специальная линия'])
  if (showSeries) items.push(['Ряды данных', 'Ряды данных'])
  items.push(['Оси, шкалы и подписи', 'Оси, шкалы и подписи'], ['Сетка', 'Сетка'], ['Формат чисел', 'Формат чисел'], ['Легенда', 'Легенда'], ['Подписи значений', 'Подписи значений'], ['Аннотации и акценты', '.annotation-add-wrap'], ['Комментарий и источник', 'Комментарий и источник'])
  const open = (summaryText: string) => {
    if (summaryText.startsWith('.')) { document.querySelector<HTMLElement>(`.settings-panel ${summaryText}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return }
    const details = [...document.querySelectorAll<HTMLDetailsElement>('.settings-panel .visual-settings > details')].find((item) => item.querySelector(':scope > summary')?.textContent?.trim().startsWith(summaryText))
    if (!details) return
    details.open = true
    details.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return <nav className="settings-quick-nav" aria-label="Разделы оформления"><label><span>Перейти к разделу</span><select defaultValue="" onChange={(event) => { if (event.target.value) open(event.target.value); event.target.value = '' }}><option value="" disabled>Выберите настройки…</option>{items.map(([label, target]) => <option value={target} key={target}>{label}</option>)}</select></label></nav>
}
