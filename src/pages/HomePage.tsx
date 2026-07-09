import { Link } from 'react-router-dom'
import { SiteHeader } from '../components/SiteHeader'

const features = [
  ['01', 'Импорт без боли', 'Загружайте CSV, XLSX и Parquet или подключайте публичные Google Sheets.'],
  ['02', 'Настройка до детали', 'Выбирайте поля, цвета, подписи, сетки и формат представления данных.'],
  ['03', 'Экспорт без потерь', 'Скачивайте готовую визуализацию в PNG для публикаций или SVG для дальнейшей работы.'],
]

export function HomePage() {
  return (
    <div className="marketing-page">
      <SiteHeader />
      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <p className="kicker">Визуализация данных без кода</p>
            <h1>Данные становятся<br/><em>понятными.</em></h1>
            <p className="hero-lead">Создавайте аккуратные, убедительные графики из ваших данных — прямо в браузере и без сложных инструментов.</p>
            <div className="hero-actions">
              <Link className="site-button purple" to="/editor">Создать первый график <span>→</span></Link>
              <a className="text-link" href="#features">Посмотреть возможности ↓</a>
            </div>
            <div className="format-line"><span>Работает с</span><b>CSV</b><b>XLSX</b><b>PARQUET</b><b>GOOGLE SHEETS</b></div>
          </div>
          <div className="hero-visual" aria-label="Пример интерфейса редактора">
            <div className="visual-window">
              <div className="window-bar"><i/><i/><i/><span>Выручка по месяцам</span></div>
              <div className="window-body">
                <div className="fake-sidebar"><b>ДАННЫЕ</b><span/><span/><span/><b>НАСТРОЙКИ</b><span/><span/></div>
                <div className="fake-chart">
                  <div><small>Динамика продаж</small><strong>₽ 1,24 млн</strong></div>
                  <svg viewBox="0 0 520 240" role="img">
                    <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7562ea" stopOpacity=".28"/><stop offset="1" stopColor="#7562ea" stopOpacity="0"/></linearGradient></defs>
                    <path className="grid" d="M20 40H500M20 90H500M20 140H500M20 190H500"/>
                    <path className="area" d="M20 190 C75 170 92 182 135 137 S210 142 255 105 S325 118 365 70 S445 80 500 30 V220 H20Z"/>
                    <path className="line" d="M20 190 C75 170 92 182 135 137 S210 142 255 105 S325 118 365 70 S445 80 500 30"/>
                    <g className="dots"><circle cx="20" cy="190" r="5"/><circle cx="135" cy="137" r="5"/><circle cx="255" cy="105" r="5"/><circle cx="365" cy="70" r="5"/><circle cx="500" cy="30" r="5"/></g>
                  </svg>
                  <div className="months"><span>Янв</span><span>Фев</span><span>Мар</span><span>Апр</span><span>Май</span></div>
                </div>
              </div>
            </div>
            <div className="floating-note">+ 28,4% <span>за период</span></div>
          </div>
        </section>

        <section className="proof-strip"><span>ОТ ФАЙЛА ДО ГРАФИКА</span><strong>Три шага. Пара минут.</strong><div>01 Загрузите данные <i/> 02 Выберите график <i/> 03 Скачайте результат</div></section>

        <section className="features-section" id="features">
          <div className="section-heading"><p className="kicker">Создан для ясности</p><h2>Всё нужное.<br/>Ничего лишнего.</h2></div>
          <div className="feature-grid">{features.map(([number, title, text]) => <article key={number}><span>{number}</span><div className={`feature-icon icon-${number}`} /><h3>{title}</h3><p>{text}</p></article>)}</div>
        </section>

        <section className="formats-section" id="formats">
          <div><p className="kicker light">Ваши данные остаются вашими</p><h2>Локально.<br/><em>Быстро.</em> Безопасно.</h2></div>
          <p>Обработка происходит прямо в браузере. Для начала работы не нужна регистрация, а исходные файлы не отправляются на наш сервер.</p>
          <Link className="site-button light-button" to="/editor">Открыть редактор →</Link>
        </section>
      </main>
      <footer className="site-footer"><LogoFooter/><span>© 2026 · Сделано для хороших данных</span><Link to="/projects">Проекты</Link></footer>
    </div>
  )
}

function LogoFooter() { return <Link className="site-logo" to="/"><span>D</span>DataCanvas</Link> }
