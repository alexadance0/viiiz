import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

const EditorApp = lazy(() => import('./App'))
const HomePage = lazy(() => import('./pages/HomePage').then(({ HomePage }) => ({ default: HomePage })))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage').then(({ ProjectsPage }) => ({ default: ProjectsPage })))

export default function Site() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Suspense fallback={<div className="editor-loading">Загрузка…</div>}><HomePage /></Suspense>} />
        <Route path="/projects" element={<Suspense fallback={<div className="editor-loading">Загрузка…</div>}><ProjectsPage /></Suspense>} />
        <Route path="/editor" element={<Suspense fallback={<div className="editor-loading">Загрузка редактора…</div>}><EditorApp /></Suspense>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
