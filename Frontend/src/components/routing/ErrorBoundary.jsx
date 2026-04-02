import React from 'react'
import { AlertTriangle } from 'lucide-react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    console.error('Error Boundary caught error:', error)
    console.error('Error Info:', errorInfo)

    this.setState((prevState) => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }))

    // Optional: Send to error logging service
    // reportErrorToLoggingService(error, errorInfo)
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, errorCount } = this.state

      return (
        <div className="grid min-h-screen place-items-center bg-bg-surface p-4">
          <Card className="w-full max-w-md space-y-4" padding="comfortable">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle size={20} />
              <h1 className="text-lg font-semibold">Something went wrong</h1>
            </div>

            <div className="rounded-default bg-red-50 p-3">
              <p className="text-xs font-mono text-red-800">{error?.message || 'Unknown error'}</p>
              {process.env.NODE_ENV === 'development' && errorInfo && (
                <details className="mt-2 cursor-pointer">
                  <summary className="text-xs font-semibold text-red-700">Details</summary>
                  <pre className="mt-2 overflow-auto rounded bg-white p-2 text-xs text-red-800">
                    {errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>

            <p className="text-sm text-text-secondary">
              {errorCount > 2
                ? 'Multiple errors detected. Try refreshing the page.'
                : 'An unexpect error occurred. Try refreshing the page or come back later.'}
            </p>

            <div className="flex gap-2">
              <Button onClick={this.handleReset} className="flex-1">
                Try again
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  window.location.href = '/'
                }}
                className="flex-1"
              >
                Go home
              </Button>
            </div>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
