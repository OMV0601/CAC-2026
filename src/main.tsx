import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// our two fonts, stored with the app (no google fonts needed)
import '@fontsource-variable/inter'
import '@fontsource-variable/source-serif-4'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './lib/auth'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
