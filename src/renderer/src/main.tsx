import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './assets/global.css'

async function bootstrap(): Promise<void> {
  // Fetch API port from main process before rendering
  if (window.api?.getApiPort) {
    try {
      const port = await window.api.getApiPort()
      ;(window as Window & { __apiPort?: number }).__apiPort = port
    } catch {
      // Fall through to default port
    }
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

bootstrap()
