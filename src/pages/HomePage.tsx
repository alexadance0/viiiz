import { Link } from 'react-router-dom'
import { HeroDemo } from '../components/HeroDemo'
import { ChartGallerySection } from '../components/ChartGallerySection'
import { ProcessSection } from '../components/ProcessSection'
import { SiteHeader } from '../components/SiteHeader'
import { APP_NAME } from '../shared/config/app'
import '../site.css'

export function HomePage() {
  return (
    <div className="marketing-page">
      <SiteHeader />
      <main>
        <HeroDemo />

        <WorkflowTransition />

        <ProcessSection />

        <ChartGallerySection />

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

function LogoFooter() { return <Link className="site-logo" to="/"><span>В</span>{APP_NAME}</Link> }

function WorkflowTransition() {
  const columns = 32
  const rows = 10
  const rowOpacity = [0, 0.24, 0.55, 0.85, 1, 1, 0.85, 0.55, 0.24, 0]
  return (
    <div className="workflow-transition" aria-hidden="true">
      <svg viewBox={`0 0 ${columns} ${rows}`} preserveAspectRatio="none" shapeRendering="crispEdges">
        {Array.from({ length: columns * rows }, (_, index) => {
          const x = index % columns
          const y = Math.floor(index / columns)
          const mix = x / (columns - 1)
          const noise = ((x * 17 + y * 29) % 7 - 3) * 0.012
          const strength = Math.max(0, 0.22 - Math.abs(y - 4) * 0.035 + noise)
          const red = Math.round(255 + (24 + (224 - 24) * mix - 255) * strength)
          const green = Math.round(255 + (174 + (51 - 174) * mix - 255) * strength)
          const blue = Math.round(255 + (218 + (171 - 218) * mix - 255) * strength)
          const dither = ((x * 11 + y * 7) % 13) / 12
          const edge = Math.min(y, rows - 1 - y)
          const opacity = edge === 0
            ? (dither > 0.82 ? 0.14 : 0)
            : edge === 1
              ? (dither > 0.38 ? 0.28 + dither * 0.22 : 0)
              : edge === 2
                ? (dither > 0.12 ? 0.5 + dither * 0.2 : 0.16)
                : rowOpacity[y]
          return <rect key={index} x={x} y={y} width="1.02" height="1.02" fill={`rgb(${red} ${green} ${blue})`} opacity={opacity}/>
        })}
      </svg>
    </div>
  )
}
