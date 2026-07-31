import { ProcessStream } from './ProcessStream'
import './ProcessSection.css'

const stages = [
  {
    number: '01',
    title: 'Загрузите данные',
    description: 'Добавьте CSV, XLSX, Parquet или публичную Google-таблицу. Файл обрабатывается прямо в браузере.',
    kind: 'upload',
    color: '#18aeda',
  },
  {
    number: '02',
    title: 'Проверьте и подготовьте данные',
    description: 'Просмотрите таблицу, переименуйте столбцы, исправьте типы данных и уберите строки, которые не нужны в графике.',
    kind: 'table',
    color: '#e033ab',
  },
  {
    number: '03',
    title: 'Выберите подходящий график',
    description: 'Сравните варианты и выберите форму, которая точнее всего раскрывает структуру ваших данных.',
    kind: 'charts',
    color: '#845be8',
  },
  {
    number: '04',
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
        <span>Весь путь — в одном редакторе, без кода и переключения между инструментами.</span>
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
              <span className="process-number">{stage.number}</span>
              <h3>{stage.title}</h3>
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
  return (
    <div className={`process-preview preview-${kind}`} aria-hidden="true">
      <div className="preview-topbar"><i/><i/><i/><span>{kind === 'upload' ? 'Новый проект' : kind === 'table' ? 'Проверка данных' : kind === 'charts' ? 'Тип графика' : 'Оформление'}</span></div>
      {kind === 'upload' && <UploadPreview />}
      {kind === 'table' && <TablePreview />}
      {kind === 'charts' && <ChartsPreview />}
      {kind === 'settings' && <SettingsPreview />}
    </div>
  )
}

function UploadPreview() {
  return <div className="upload-preview"><div className="drop-area"><b>↑</b><strong>Перетащите файл сюда</strong><span>CSV, XLSX или Parquet</span></div><div className="file-row"><i>CSV</i><div><strong>sales_2026.csv</strong><span>248 КБ · 1 420 строк</span></div><b>100%</b></div><div className="file-progress"><i/></div><div className="column-list"><span>Дата</span><span>Регион</span><span>Выручка</span><span>Категория</span></div></div>
}

function TablePreview() {
  const rows = [['01.01.26', 'Север', '128 400'], ['01.02.26', 'Центр', '156 800'], ['01.03.26', 'Юг', '142 100'], ['01.04.26', 'Восток', '173 900']]
  return <div className="table-preview"><div className="table-toolbar"><span>1 420 строк</span><button>Исправить значения</button></div><div className="mini-table"><div className="table-head"><b>Дата</b><b>Регион</b><b>Выручка</b></div>{rows.map((row, index) => <div className="table-row" key={row[0]}>{row.map((cell, cellIndex) => <span className={index === 1 && cellIndex === 1 ? 'selected-cell' : ''} key={cell}>{cell}</span>)}</div>)}</div><div className="edit-popover"><small>Тип данных</small><strong>Текстовый</strong><span>Готово ✓</span></div></div>
}

function ChartsPreview() {
  return <div className="charts-preview"><p>Как показать данные?</p><div className="chart-choice-list"><div className="mini-chart selected"><BarIcon/><span>Столбцы</span></div><div className="mini-chart"><LineIcon/><span>Линия</span></div><div className="mini-chart"><DonutIcon/><span>Кольцевая</span></div><div className="mini-chart"><ScatterIcon/><span>Точечная</span></div></div><div className="chart-hint"><i/>Подходит для сравнения категорий</div></div>
}

function SettingsPreview() {
  return <div className="settings-preview"><div className="result-chart"><div><small>Выручка по регионам</small><strong>₽ 6,8 млн</strong></div><div className="result-bars"><i/><i/><i/><i/><i/></div><div className="result-axis"><span>Север</span><span>Центр</span><span>Юг</span><span>Восток</span><span>Запад</span></div></div><aside><b>Настройки</b><label>Ось X <span>Регион⌄</span></label><label>Значение <span>Выручка⌄</span></label><label>Цвет <i className="color-dot"/></label><label className="toggle-row">Подписи <i className="toggle on"/></label><label className="toggle-row">Легенда <i className="toggle"/></label></aside></div>
}

function BarIcon() { return <div className="bar-icon"><i/><i/><i/><i/></div> }
function LineIcon() { return <svg viewBox="0 0 80 45"><path d="M4 36 22 27 39 31 57 13 76 7"/></svg> }
function DonutIcon() { return <div className="donut-icon"/> }
function ScatterIcon() { return <div className="scatter-icon"><i/><i/><i/><i/><i/></div> }
