import { Component, type ErrorInfo, type ReactNode } from 'react';
import ErrorState from './ErrorState';

interface GlobalErrorBoundaryProps {
  children: ReactNode;
}

interface GlobalErrorBoundaryState {
  error: Error | null;
}

export default class GlobalErrorBoundary extends Component<
  GlobalErrorBoundaryProps,
  GlobalErrorBoundaryState
> {
  state: GlobalErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): GlobalErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught React error', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <main className="min-h-screen bg-zinc-950 px-4 py-8">
          <div className="mx-auto max-w-lg">
            <ErrorState
              error="The app hit an unexpected problem. Reloading usually clears this kind of temporary state."
              onRetry={this.handleReload}
              title="PantrySync needs a reload"
            />
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
