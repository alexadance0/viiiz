export type EditorStep = 'source' | 'data' | 'chart' | 'design'

const steps: { id: EditorStep; number: string; label: string }[] = [
  { id: 'source', number: '01', label: 'Загрузка' },
  { id: 'data', number: '02', label: 'Проверка данных' },
  { id: 'chart', number: '03', label: 'Тип графика' },
  { id: 'design', number: '04', label: 'Настройка' },
]

interface Props {
  step: EditorStep
  canVisit(step: EditorStep): boolean
  onChange(step: EditorStep): void
}

export function EditorStepper({ step, canVisit, onChange }: Props) {
  const currentIndex = steps.findIndex((item) => item.id === step)
  return <nav className="stepper">{steps.map((item, index) => <button key={item.id} disabled={!canVisit(item.id)} className={`${step === item.id ? 'active' : ''} ${index < currentIndex ? 'done' : ''}`} onClick={() => canVisit(item.id) && onChange(item.id)}><span>{index < currentIndex ? '✓' : item.number}</span><b>{item.label}</b></button>)}</nav>
}
