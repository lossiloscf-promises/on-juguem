import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'

// Avisa en cuanto haya una versión nueva desplegada (en vez de quedarse
// callado usando la vieja hasta que alguien refresque por su cuenta).
registerSW({
  onNeedRefresh() {
    if (window.confirm('Hay una versión nueva de On Juguem — ¿la cargamos ahora?')) {
      window.location.reload()
    }
  },
  immediate: true,
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
