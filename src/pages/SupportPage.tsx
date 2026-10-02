import { ArrowUpRight, RussianRuble, MessagesSquare } from 'lucide-react'
import { useEffect } from 'react'
import { SiteHeader } from '../components/SiteHeader'
import { SiteFooter } from '../components/SiteFooter'
import { supportLinks } from '../shared/config/support'
import '../site.css'
import './SupportPage.css'

export function SupportPage() {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  return (
    <div className="support-page" id="top">
      <SiteHeader />
      <main className="support-main">
        <header className="support-heading">
          <h1>Хорошие графики.<br/><span>С вашей поддержкой.</span></h1>
          <p>Если Виииз помогает вам рассказывать истории через данные, помогите проекту развиваться.</p>
        </header>
        <div className="support-options">
          <section className="support-option support-donate" aria-labelledby="donate-title">
            <svg className="support-option-icon support-ruble-coin" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <RussianRuble x={6} y={5} width={12} height={14} strokeWidth={3}/>
            </svg>
            <h2 id="donate-title">Поддержать донатом</h2>
            <p>Добровольный донат на Boosty — вклад в развитие редактора и новые возможности. Сумму выбираете вы.</p>
            {supportLinks.boosty
              ? <a className="support-action" href={supportLinks.boosty} target="_blank" rel="noopener noreferrer">Поддержать на Boosty <ArrowUpRight size={20} aria-hidden="true"/></a>
              : <span className="support-coming">Boosty · скоро</span>}
          </section>
          <section className="support-option support-social" aria-labelledby="social-title">
            <MessagesSquare className="support-option-icon" size={36} strokeWidth={1.5} aria-hidden="true"/>
            <h2 id="social-title">Подписаться на соцсети</h2>
            <p>Подпишитесь на соцсети проекта. Следите за обновлениями, делитесь графиками и рассказывайте о Виииз другим.</p>
            <div className="support-social-links">
              {supportLinks.social.length
                ? supportLinks.social.map(({ label, url }) => <a className="support-action" href={url} target="_blank" rel="noopener noreferrer" key={url}>{label} <ArrowUpRight size={20} aria-hidden="true"/></a>)
                : <span className="support-coming">Соцсети проекта · скоро</span>}
            </div>
          </section>
        </div>
        <p className="support-thanks">Спасибо, что помогаете Виииз расти.</p>
      </main>
      <SiteFooter />
    </div>
  )
}
