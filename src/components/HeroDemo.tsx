import { Link } from 'react-router-dom'
import { APP_NAME } from '../shared/config/app'
import { HeroSymbolTrail } from './HeroSymbolTrail'

export function HeroDemo() {
  return (
    <section className="hero-section" aria-labelledby="hero-title">
      <HeroSymbolTrail />
      <div className="hero-copy">
        <h1 id="hero-title">{APP_NAME}</h1>
        <p className="hero-statement">Из таблицы — <mark>в ясный график.</mark></p>
        <p className="hero-lead">Загружайте данные, настраивайте каждую деталь и экспортируйте готовую визуализацию прямо в браузере.</p>
        <div className="hero-actions">
          <Link className="site-button dark" to="/editor">Создать график <span>↗</span></Link>
        </div>
      </div>
    </section>
  )
}
