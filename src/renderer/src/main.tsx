import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/oswald'
import '@fontsource-variable/manrope'
import './estilos.css'
import { App } from './App'
import { ProvedorEstado } from './lib/estado'

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <ProvedorEstado>
      <App />
    </ProvedorEstado>
  </StrictMode>
)
