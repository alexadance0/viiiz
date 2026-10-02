import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

const EditorApp = lazy(() => import('./App'))
const HomePage = lazy(() => import('./pages/HomePage').then(({ HomePage }) => ({ default: HomePage })))
const GalleryPage = lazy(() => import('./pages/GalleryPage').then(({ GalleryPage }) => ({ default: GalleryPage })))
const SupportPage = lazy(() => import('./pages/SupportPage').then(({ SupportPage }) => ({ default: SupportPage })))
const BlogPage = lazy(() => import('./pages/BlogPage').then(({ BlogPage }) => ({ default: BlogPage })))
const BlogArticlePage = lazy(() => import('./pages/BlogArticlePage').then(({ BlogArticlePage }) => ({ default: BlogArticlePage })))

const RouteFallback = () => <div className="route-skeleton" aria-busy="true" aria-label="Загрузка страницы"><header><i/><span/><span/></header><main><b/><small/><section><i/><i/><i/></section></main></div>

export default function Site() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Suspense fallback={<RouteFallback/>}><HomePage /></Suspense>} />
        <Route path="/gallery" element={<Suspense fallback={<RouteFallback/>}><GalleryPage /></Suspense>} />
        <Route path="/support" element={<Suspense fallback={<RouteFallback/>}><SupportPage /></Suspense>} />
        <Route path="/blog" element={<Suspense fallback={<RouteFallback/>}><BlogPage /></Suspense>} />
        <Route path="/blog/kak-vybrat-grafik" element={<Suspense fallback={<RouteFallback/>}><BlogArticlePage /></Suspense>} />
        <Route path="/editor" element={<Suspense fallback={<RouteFallback/>}><EditorApp /></Suspense>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
