import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('React error boundary caught:', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-background p-8">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-semibold text-foreground">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <Button
              className="mt-6"
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.hash = '#/'
              }}
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
