import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/cantarell/400.css'
import '@fontsource/cantarell/700.css'
import App from './App'
import './styles/adwaita.css'
import './styles/app.css'
import './styles/bible.css'
import './styles/dictionary.css'
import './styles/hymns.css'
import './styles/media.css'
import './styles/presentation.css'
import './styles/web.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
