import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import '@/styles/globals.css'
import AppRouter from '@/router/AppRouter'
import ErrorBoundary from '@/components/routing/ErrorBoundary'
import { store } from '@/app/store'
import { ThemeProvider } from '@/hooks/useTheme.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <Provider store={store}>
        <ThemeProvider>
          <BrowserRouter>
            <AppRouter />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 3000,
                style: {
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  color: '#0f172a',
                },
              }}
            />
          </BrowserRouter>
        </ThemeProvider>
      </Provider>
    </ErrorBoundary>
  </StrictMode>,
)
