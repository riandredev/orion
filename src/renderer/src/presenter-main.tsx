import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PresenterViewApp } from './components/PresenterViewApp'
import './styles/adwaita.css'
import './styles/presentation.css'
import './styles/presenter-window.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PresenterViewApp />
  </StrictMode>
)
