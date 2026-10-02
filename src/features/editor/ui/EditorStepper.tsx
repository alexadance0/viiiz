import type { CSSProperties } from 'react'

export type EditorStep = 'source' | 'data' | 'chart' | 'design'

const steps: { id: EditorStep; number: string; label: string; accent: string }[] = [
  { id: 'source', number: '01', label: 'Загрузка', accent: '#36a476' },
  { id: 'data', number: '02', label: 'Проверка данных', accent: '#e033ab' },
  { id: 'chart', number: '03', label: 'Тип графика', accent: '#bd4b12' },
  { id: 'design', number: '04', label: 'Настройка', accent: '#4568e1' },
]

interface Props {
  step: EditorStep
  canVisit(step: EditorStep): boolean
  onChange(step: EditorStep): void
}

export function EditorStepper({ step, canVisit, onChange }: Props) {
  const currentIndex = steps.findIndex((item) => item.id === step)
  return <nav className="stepper" aria-label="Этапы создания графика">{steps.map((item, index) => <button key={item.id} disabled={!canVisit(item.id)} aria-current={step === item.id ? 'step' : undefined} style={{ '--step-accent': item.accent } as CSSProperties} className={`${step === item.id ? 'active' : ''} ${index < currentIndex ? 'done' : ''}`} onClick={() => canVisit(item.id) && onChange(item.id)}><span>{index < currentIndex ? '✓' : item.number}</span><b>{item.label}</b></button>)}</nav>
}
