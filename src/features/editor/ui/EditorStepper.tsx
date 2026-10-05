import type { CSSProperties } from 'react'

export type EditorStep = 'source' | 'data' | 'chart' | 'design'

const steps: { id: EditorStep; number: string; label: string; accent: string }[] = [
  { id: 'source', number: '1', label: 'Загрузка', accent: '#36a476' },
  { id: 'data', number: '2', label: 'Проверка данных', accent: '#e033ab' },
  { id: 'chart', number: '3', label: 'Тип графика', accent: '#bd4b12' },
  { id: 'design', number: '4', label: 'Настройка', accent: '#4568e1' },
]

interface Props {
  step: EditorStep
  canVisit(step: EditorStep): boolean
  onChange(step: EditorStep): void
}

export function EditorStepper({ step, canVisit, onChange }: Props) {
  const currentIndex = steps.findIndex((item) => item.id === step)
  return <nav className="stepper" aria-label="Этапы создания графика">{steps.map((item, index) => <button key={item.id} disabled={!canVisit(item.id)} aria-current={step === item.id ? 'step' : undefined} style={{ '--step-accent': item.accent } as CSSProperties} className={`${step === item.id ? 'active' : ''} ${index < currentIndex ? 'done' : ''}`} onClick={() => canVisit(item.id) && onChange(item.id)}><span aria-hidden="true">{index < currentIndex ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="m4 12 5 5L20 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="butt" strokeLinejoin="miter"/></svg> : item.number}</span><b>{item.label}</b></button>)}</nav>
}
