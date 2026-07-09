import { Link, NavLink } from 'react-router-dom'

export function Logo() {
  return <Link className="site-logo" to="/"><span>D</span>DataCanvas</Link>
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
