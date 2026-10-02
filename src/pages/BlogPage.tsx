import { useState, type CSSProperties, type ChangeEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { SiteHeader } from '../components/SiteHeader'
import '../site.css'

type VisualKind = 'wave' | 'rings' | 'blocks' | 'bars' | 'dots' | 'stacked' | 'line' | 'columns'
type BlogPost = { slug: string; category: string; date: string; dateTime: string; title: string; visual: VisualKind; accentColor: string; coverImage?: string; coverAlt?: string }

const coverStorageKey = 'viiiz-blog-covers'
const posts: BlogPost[] = [
  { slug: 'kak-vybrat-grafik', category: 'Разбор', date: '24 сен 2026', dateTime: '2026-09-24', title: 'Как выбрать график и не исказить данные', visual: 'wave', accentColor: '#db5a5a' },
  { slug: 'slozhnaya-diagramma', category: 'Практика', date: '18 сен 2026', dateTime: '2026-09-18', title: 'Пять способов сделать сложную диаграмму понятнее', visual: 'rings', accentColor: '#1677a6' },
  { slug: 'grafiki-v-otchetah', category: 'Цифра дня', date: '16 сен 2026', dateTime: '2026-09-16', title: 'Каждый третий отчёт читают только по графикам', visual: 'blocks', accentColor: '#36a476' },
  { slug: 'vliyanie-tsveta', category: 'Исследование', date: '15 сен 2026', dateTime: '2026-09-15', title: 'Почему цвет влияет на выводы сильнее, чем кажется', visual: 'bars', accentColor: '#1677a6' },
  { slug: 'srednee-znachenie', category: 'Разбор', date: '11 сен 2026', dateTime: '2026-09-11', title: 'Когда среднее значение ничего не объясняет', visual: 'dots', accentColor: '#1677a6' },
  { slug: 'visualnaya-ierarhiya', category: 'Цифра дня', date: '9 сен 2026', dateTime: '2026-09-09', title: 'Визуальная иерархия сокращает время чтения вдвое', visual: 'stacked', accentColor: '#e4a52c' },
  { slug: 'novye-teplovye-karty', category: 'Новости', date: '4 сен 2026', dateTime: '2026-09-04', title: 'В Виииз появились новые настройки тепловых карт', visual: 'line', accentColor: '#1677a6' },
  { slug: 'podgotovka-dannyh', category: 'Практика', date: '31 авг 2026', dateTime: '2026-08-31', title: 'Как подготовить данные перед построением графика', visual: 'columns', accentColor: '#db5a5a' },
]

const storedCovers = () => {
  try { return JSON.parse(localStorage.getItem(coverStorageKey) ?? '{}') as Record<string, string> }
  catch { return {} }
}

function BlogVisual({ kind }: { kind: VisualKind }) {
  if (kind === 'wave') return <svg viewBox="0 0 320 170" aria-hidden="true"><path className="blog-fill-a" d="M0 153C52 151 91 164 120 167C127 116 139 43 174 43C218 43 220 141 272 141C290 141 307 134 320 125V170H0Z"/><path className="blog-fill-b" d="M0 154C55 148 92 154 126 169C151 130 183 106 221 106C260 106 288 128 320 130V170H0Z"/></svg>
  if (kind === 'rings') return <svg viewBox="0 0 320 170" aria-hidden="true"><g className="blog-stroke" fill="none"><circle cx="160" cy="92" r="69"/><circle cx="160" cy="92" r="49"/><circle cx="160" cy="92" r="30"/><circle cx="160" cy="92" r="12"/></g></svg>
  if (kind === 'blocks') return <svg viewBox="0 0 320 170" aria-hidden="true"><path className="blog-fill-c" d="M0 68L68 18L139 54L115 118L190 170H0Z"/><path className="blog-fill-d" d="M45 93L111 53L234 102L198 170L92 130Z"/></svg>
  if (kind === 'bars') return <svg viewBox="0 0 320 170" aria-hidden="true"><path className="blog-fill-e" d="M0 15H231V41H0ZM0 55H278V81H0ZM0 95H126V121H0ZM0 135H302V161H0Z"/></svg>
  if (kind === 'dots') return <svg viewBox="0 0 320 170" aria-hidden="true"><g className="blog-fill-f"><circle cx="34" cy="125" r="10"/><circle cx="76" cy="105" r="15"/><circle cx="116" cy="119" r="8"/><circle cx="147" cy="71" r="12"/><circle cx="191" cy="82" r="18"/><circle cx="231" cy="44" r="9"/><circle cx="278" cy="30" r="14"/></g><path className="blog-stroke" d="M22 144L293 17"/></svg>
  if (kind === 'stacked') return <svg viewBox="0 0 320 170" aria-hidden="true"><path className="blog-fill-c" d="M0 91L67 35L132 67L109 119L180 170H0Z"/><path className="blog-fill-d" d="M43 112L104 68L230 117L201 170L96 145Z"/></svg>
  if (kind === 'line') return <svg viewBox="0 0 320 170" aria-hidden="true"><path className="blog-chart-grid" d="M0 34H320M0 68H320M0 102H320M0 136H320M64 0V170M128 0V170M192 0V170M256 0V170"/><path className="blog-line" fill="none" d="M0 137L48 116L91 124L139 72L182 87L229 38L271 59L320 17"/></svg>
  return <svg viewBox="0 0 320 170" aria-hidden="true"><path className="blog-fill-a" d="M24 121H61V170H24ZM82 81H119V170H82ZM140 102H177V170H140ZM198 42H235V170H198ZM256 66H293V170H256Z"/></svg>
}

export function BlogPage() {
  const [searchParams] = useSearchParams()
  const editing = searchParams.get('edit') === '1'
  const [covers, setCovers] = useState(storedCovers)
  const uploadCover = (slug: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file?.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') return
      setCovers((current) => {
        const next = { ...current, [slug]: reader.result as string }
        try { localStorage.setItem(coverStorageKey, JSON.stringify(next)) } catch { /* Preview still works if browser storage is full. */ }
        return next
      })
    }
    reader.readAsDataURL(file)
  }
  return (
    <div className="blog-page">
      <SiteHeader />
      <main className="blog-main">
        <header className="blog-heading"><h1>Блог</h1><p>О данных, графиках и ясной визуальной коммуникации.</p></header>
        <section className="blog-grid" aria-label="Публикации">
          {posts.map((post, index) => {
            const coverImage = covers[post.slug] ?? post.coverImage
            const style = { '--article-accent': post.accentColor } as CSSProperties
            const card = <article className="blog-card" style={style}>
            <div className="blog-card-meta"><span>{post.category}</span><time dateTime={post.dateTime}>{post.date}</time></div>
            <h2>{post.title}</h2>
            <div className="blog-card-visual">{coverImage ? <img src={coverImage} alt={post.coverAlt ?? ''}/> : <BlogVisual kind={post.visual}/>}</div>
            {editing && <label className="blog-cover-upload">Загрузить обложку<input type="file" accept="image/*" onChange={(event) => uploadCover(post.slug, event)}/></label>}
            </article>
            return index === 0 && !editing
              ? <Link className="blog-card-link" to="/blog/kak-vybrat-grafik" aria-label={`Читать: ${post.title}`} key={post.title}>{card}</Link>
              : <div className="blog-card-static" key={post.title}>{card}</div>
          })}
        </section>
      </main>
    </div>
  )
}
