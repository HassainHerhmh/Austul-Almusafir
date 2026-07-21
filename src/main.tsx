import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initTheme } from './components/TopHeader'
import { initNativeShell } from './native/capacitorBootstrap'
import './index.css'

initTheme()
void initNativeShell()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
