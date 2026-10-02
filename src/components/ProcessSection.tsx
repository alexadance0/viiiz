import { ProcessStream } from './ProcessStream'
import './ProcessSection.css'

const stages = [
  {
    number: '1',
    title: 'Загрузите данные',
    description: 'Добавьте CSV, XLSX, Parquet или публичную Google-таблицу. Файл обрабатывается прямо в браузере.',
    kind: 'upload',
    color: '#18aeda',
  },
  {
    number: '2',
    title: 'Проверьте и подготовьте данные',
    description: 'Просмотрите таблицу, переименуйте столбцы, исправьте типы данных и уберите строки, которые не нужны в графике.',
    kind: 'table',
    color: '#e033ab',
  },
  {
    number: '3',
    title: 'Выберите подходящий график',
    description: 'Сравните варианты и выберите форму, которая точнее всего раскрывает структуру ваших данных.',
    kind: 'charts',
    color: '#e4a52c',
  },
  {
    number: '4',
    title: 'Настройте визуализацию',
    description: 'Уточните оси, подписи, цвета и легенду. Результат сразу виден на холсте и готов к экспорту.',
    kind: 'settings',
    color: '#4568e1',
  },
] as const

export function ProcessSection() {
  return (
    <section className="process-section" id="features" aria-labelledby="process-title">
      <ProcessStream />
      <header className="process-intro">
        <h2 id="process-title">От файла до готового графика</h2>
      </header>
      <div className="process-stages">
        {stages.map((stage, index) => (
          <article
            className={`process-stage ${index % 2 ? 'is-reversed' : ''}`}
            data-process-stage
            key={stage.number}
            style={{ '--stage-color': stage.color } as React.CSSProperties}
          >
            <div className="process-copy">
              <div className="process-stage-heading">
                <span className="process-number" aria-label={`Этап ${stage.number}`}>{stage.number}</span>
                <h3>{stage.title}</h3>
              </div>
              <p>{stage.description}</p>
            </div>
            <StagePreview kind={stage.kind} />
          </article>
        ))}
      </div>
    </section>
  )
}

function StagePreview({ kind }: { kind: typeof stages[number]['kind'] }) {
  const descriptions = {
    upload: 'Редактор: загрузка файла и подключение Google Sheets',
    table: 'Редактор: таблица выручки по месяцам и проверка столбцов',
    charts: 'Редактор: выбор типа диаграммы с предпросмотром на холсте',
    settings: 'Редактор: график выручки и панель настройки оформления',
  }

  return (
    <div className={`process-preview preview-${kind}`}>
      <img
        src={`/images/process/${kind}.png`}
        alt={descriptions[kind]}
        width={2000}
        height={1520}
        loading="lazy"
        decoding="async"
      />
    </div>
  )
}
