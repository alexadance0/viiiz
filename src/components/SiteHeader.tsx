import { Link, NavLink } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { BrandLogo } from './BrandLogo'

export function Logo() {
  return <Link className="site-logo" to="/" aria-label="виииз — главная"><BrandLogo decorative/></Link>
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <Logo />
      <nav aria-label="Основная навигация">
        <NavLink className="gallery-nav-link" to="/gallery">Галерея</NavLink>
        <NavLink className="blog-nav-link" to="/blog">Блог</NavLink>
      </nav>
      <NavLink className="site-button small header-support" to="/support" aria-label="Поддержать проект">
        <Heart size={17} fill="currentColor" aria-hidden="true"/>
        <SupportLabel className="support-label-full" text="Поддержать проект"/>
        <SupportLabel className="support-label-short" text="Поддержать"/>
      </NavLink>
    </header>
  )
}

function SupportLabel({ className, text }: { className: string; text: string }) {
  return <span className={className} aria-hidden="true">{[...text].map((letter, index) => (
    <span className="support-letter" style={{ animationDelay: `${index * 20}ms` }} key={index}>{letter === ' ' ? '\u00a0' : letter}</span>
  ))}</span>
}
