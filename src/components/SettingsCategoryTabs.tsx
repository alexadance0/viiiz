import { Tabs } from '@heroui/react'
import { Axis3D, ChartNoAxesColumnIncreasing, Frame, Search, Shapes, Type, X } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

export type SettingsCategory = 'chart' | 'axes' | 'text' | 'canvas' | 'annotations'

interface Props {
  value: SettingsCategory
  chartLabel: string
  showAxes: boolean
  children: ReactNode
  onChange(value: SettingsCategory): void
}

export function SettingsCategoryTabs({ value, chartLabel, showAxes, children, onChange }: Props) {
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<number | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const items = [
    { id: 'chart', label: chartLabel, icon: ChartNoAxesColumnIncreasing, accent: '#1677a6' },
    ...(showAxes ? [{ id: 'axes', label: 'Оси и шкалы', icon: Axis3D, accent: '#4568e1' }] : []),
    { id: 'text', label: 'Текст', icon: Type, accent: '#e033ab' },
    { id: 'canvas', label: 'Холст', icon: Frame, accent: '#bd4b12' },
    { id: 'annotations', label: 'Аннотации и акценты', icon: Shapes, accent: '#36a476' },
  ] as const
  const active = items.find((item) => item.id === value) ?? items[0]
  const style = { '--settings-category-accent': active.accent } as CSSProperties
  const normalizedQuery = query.trim().toLocaleLowerCase('ru-RU')

  useLayoutEffect(() => {
    const groups = [...(contentRef.current?.querySelectorAll<HTMLElement>(':scope > .visual-settings > .settings-group, :scope > .visual-settings > .element-editor, :scope > .visual-settings > .annotation-settings') ?? [])]
    let visible = 0
    groups.forEach((group) => {
      const found = !normalizedQuery || group.textContent?.toLocaleLowerCase('ru-RU').includes(normalizedQuery) === true
      group.hidden = !found
      if (found) visible += 1
    })
    setMatches(normalizedQuery ? visible : null)
    return () => { groups.forEach((group) => { group.hidden = false }) }
  }, [children, normalizedQuery])

  return <section className="settings-category-shell" style={style}>
    <h3 className="settings-category-title" aria-live="polite">{active.label}</h3>
    <Tabs className="settings-tabs settings-category-tabs" selectedKey={active.id} onSelectionChange={(key) => { setQuery(''); onChange(String(key) as SettingsCategory) }}>
      <Tabs.ListContainer><Tabs.List aria-label="Категории настроек">{items.map(({ id, label, icon: Icon }) => <Tabs.Tab id={id} key={id}><Tabs.Indicator/><Icon aria-hidden="true"/><span className="sr-only">{label}</span></Tabs.Tab>)}</Tabs.List></Tabs.ListContainer>
      {items.map((item) => <Tabs.Panel id={item.id} key={item.id}>{item.id === active.id ? <><div className="settings-search"><Search aria-hidden="true" size={16}/><input type="search" value={query} aria-label="Поиск по настройкам" placeholder="Найти настройку" onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setQuery('') }}/>{query && <button type="button" aria-label="Очистить поиск" onClick={() => setQuery('')}><X size={15}/></button>}</div><div className="settings-search-content" ref={contentRef}>{children}</div>{matches === 0 && <p className="settings-search-empty" role="status">В этой категории ничего не найдено</p>}</> : null}</Tabs.Panel>)}
    </Tabs>
  </section>
}
