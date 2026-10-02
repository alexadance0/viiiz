import { ChartPreview, galleryPreviews } from '../components/ChartGallerySection'
import { SiteHeader } from '../components/SiteHeader'
import '../site.css'

export function GalleryPage() {
  return (
    <div className="gallery-page">
      <SiteHeader />
      <main className="gallery-main">
        <header className="gallery-heading">
          <h1>Галерея</h1>
          <p>Примеры графиков для сравнений, динамики, распределений и других историй в данных.</p>
        </header>
        <section className="gallery-grid" aria-label="Примеры работ">
          {galleryPreviews.map((preview) => <ChartPreview {...preview} key={preview.image}/>) }
        </section>
      </main>
    </div>
  )
}
