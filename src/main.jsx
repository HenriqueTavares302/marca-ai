import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { limparDadosDeExemplo } from './data/supabase/meusCodigos.js'
import { fonteDeDados } from './lib/fonte.js'

if (fonteDeDados() === 'supabase') limparDadosDeExemplo()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
