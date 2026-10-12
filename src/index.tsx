import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { AppProvider } from './context/AppContext'
import { PermissionProvider } from './context/PermissionContext'
import { ErrorBoundary } from './components/ErrorBoundary'

const container = document.getElementById('root')
if (!container) {
  throw new Error('无法找到根元素')
}

createRoot(container).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppProvider>
        <PermissionProvider>
          <App />
        </PermissionProvider>
      </AppProvider>
    </ErrorBoundary>
  </React.StrictMode>
)