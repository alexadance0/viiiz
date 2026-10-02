import { Link } from 'react-router-dom'
import { APP_NAME } from '../shared/config/app'
import { BrandLogo } from './BrandLogo'
import { HeroSymbolTrail } from './HeroSymbolTrail'

export function HeroDemo() {
  return (
    <section className="hero-section" aria-labelledby="hero-title">
      <HeroSymbolTrail />
      <div className="hero-copy">
        <h1 id="hero-title" className="hero-wordmark" aria-label={APP_NAME.toLocaleLowerCase('ru-RU')}>
          <BrandLogo decorative variant="expanded"/>
          <span className="hero-wordmark-text">{APP_NAME.toLocaleLowerCase('ru-RU')}</span>
        </h1>
        <p className="hero-lead">Загружайте данные, настраивайте каждую деталь и экспортируйте готовую визуализацию прямо в браузере.</p>
        <div className="hero-actions">
          <Link className="site-button dark" to="/editor">Создать график</Link>
        </div>
      </div>
    </section>
  )
}
