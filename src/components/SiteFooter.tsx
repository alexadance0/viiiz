import { Link } from 'react-router-dom'
import { BrandLogo } from './BrandLogo'
import { APP_NAME } from '../shared/config/app'
import './SiteFooter.css'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-content">
        <div className="footer-about">
          <p className="footer-title">Данные становятся историей.</p>
          <p>{APP_NAME} — редактор графиков в браузере.<br/>От вашей таблицы до готовой визуализации.</p>
        </div>
        <nav className="footer-nav" aria-label="Навигация в подвале">
          <Link to="/gallery">Галерея</Link>
          <Link to="/blog">Блог</Link>
        </nav>
        <a className="footer-top" href="#top" aria-label="Наверх">Наверх ↑</a>
      </div>
      <div className="footer-colophon">
        <span>Сделано для хороших данных</span>
        <span>© 2026 {APP_NAME}</span>
      </div>
      <div className="footer-pattern" aria-hidden="true">
        <BrandLogo variant="mark" decorative/>
        <BrandLogo variant="mark" decorative/>
      </div>
    </footer>
  )
}
