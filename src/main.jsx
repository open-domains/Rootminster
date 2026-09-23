import React from 'react'
import { initializeAppearance } from '@/lib/theme'
import { ThemeProvider } from '@/lib/ThemeContext'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@tabler/core/dist/css/tabler.min.css'
import '@/index.css'
import '@/themes/tabler.css'
import '@/i18n'
import { initializeClientGlitchTip } from '@/lib/glitchtip'

initializeAppearance()
initializeClientGlitchTip()

ReactDOM.createRoot(document.getElementById('root')).render(
  <ThemeProvider><App /></ThemeProvider>
)
