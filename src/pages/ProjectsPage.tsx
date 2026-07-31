import { Link } from 'react-router-dom'
import { Logo } from '../components/SiteHeader'
import '../site.css'

const projects = [
  { title: 'Выручка по месяцам', meta: 'Столбчатая диаграмма · 6 строк', type: 'bars', date: 'Сегодня, 14:32' },
  { title: 'Динамика заказов', meta: 'Линейный график · 6 строк', type: 'curve', date: 'Сегодня, 13:18' },
  { title: 'Новый проект', meta: 'Демо-данные · 6 строк', type: 'dots', date: 'Вчера, 19:04' },
]

export function ProjectsPage() {
  return (
    <div className="dashboard-page">
      <header className="dashboard-header"><Logo/><nav><Link to="/">Главная</Link><b>Мои проекты</b></nav><div className="avatar">АН</div></header>
      <main className="dashboard-main">
        <div className="dashboard-title"><div><p className="kicker">Рабочее пространство</p><h1>Мои проекты</h1><p>Все ваши визуализации хранятся локально в этом браузере.</p></div><Link className="site-button purple" to="/editor">+ Новый проект</Link></div>
        <div className="projects-toolbar"><div className="search-box">⌕ <input placeholder="Найти проект" /></div><span>{projects.length} проекта</span><button>Сначала новые ▾</button></div>
        <section className="project-grid">
          <Link className="new-project-card" to="/editor"><span>+</span><strong>Создать визуализацию</strong><small>Начните с файла или демо-данных</small></Link>
          {projects.map((project) => <Link className="project-card" to="/editor" key={project.title}><div className={`project-preview ${project.type}`}><i/><i/><i/><i/><i/></div><div className="project-info"><div><strong>{project.title}</strong><p>{project.meta}</p></div><span className="project-menu-mark" aria-hidden="true">•••</span></div><time>{project.date}</time></Link>)}
        </section>
      </main>
    </div>
  )
}
