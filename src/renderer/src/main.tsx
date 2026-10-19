import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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
