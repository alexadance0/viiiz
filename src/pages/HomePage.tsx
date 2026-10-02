import { useState } from 'react'
import { HeroDemo } from '../components/HeroDemo'
import { ChartGallerySection } from '../components/ChartGallerySection'
import { HomeIntro } from '../components/HomeIntro'
import { ProcessSection } from '../components/ProcessSection'
import { SiteHeader } from '../components/SiteHeader'
import { SiteFooter } from '../components/SiteFooter'
import '../site.css'

export function HomePage() {
  const [showIntro, setShowIntro] = useState(true)
  return (
    <div className="marketing-page" id="top" aria-busy={showIntro}>
      {showIntro && <HomeIntro onComplete={() => setShowIntro(false)}/>}
      <SiteHeader />
      <main>
        <HeroDemo />
        <ProcessSection />

        <ChartGallerySection />

      </main>
      <SiteFooter />
    </div>
  )
}
