import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import '@/i18n'
import { initializeClientGlitchTip } from '@/lib/glitchtip'

initializeClientGlitchTip()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
