import { Link, NavLink } from 'react-router-dom'
import { APP_NAME } from '../shared/config/app'

export function Logo() {
  return <Link className="site-logo" to="/"><span>В</span>{APP_NAME}</Link>
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <Logo />
      <nav>
        <a href="#features">Возможности</a>
        <a href="#formats">Форматы</a>
        <NavLink to="/projects">Мои проекты</NavLink>
      </nav>
      <Link className="site-button dark small" to="/editor">Создать график <span>↗</span></Link>
    </header>
  )
}
