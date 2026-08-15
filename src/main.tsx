import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Site from './Site.tsx'
import { loadCriticalFonts } from './core/textFonts'

void loadCriticalFonts()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Site />
  </StrictMode>,
)
