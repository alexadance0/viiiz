import { useEffect, useState } from 'react'
import { HeroDemo } from '../components/HeroDemo'
import { ChartGallerySection } from '../components/ChartGallerySection'
import { HomeIntro } from '../components/HomeIntro'
import { ProcessSection } from '../components/ProcessSection'
import { SiteHeader } from '../components/SiteHeader'
import { SiteFooter } from '../components/SiteFooter'
import '../site.css'

const introSeenKey = 'viiiz:home-intro-seen'
let introSeen = false

export function HomePage() {
  const [showIntro, setShowIntro] = useState(() => {
    if (introSeen) return false
    try { return localStorage.getItem(introSeenKey) !== '1' } catch { return true }
  })
  useEffect(() => {
    introSeen = true
    try { localStorage.setItem(introSeenKey, '1') } catch { /* Keep the visit in memory when storage is unavailable. */ }
  }, [])
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
