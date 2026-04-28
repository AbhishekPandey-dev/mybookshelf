import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`ErrorBoundary caught error in [${this.props.name || 'Component'}]:`, error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-6 m-4 bg-destructive/5 border border-destructive/20 rounded-2xl flex flex-col items-center gap-2">
          <p className="text-sm font-bold text-destructive">Something went wrong in {this.props.name || 'this section'}.</p>
          <button 
            onClick={() => this.setState({ hasError: false })}
            className="text-xs bg-destructive text-destructive-foreground px-3 py-1 rounded-lg hover:opacity-90 transition-opacity"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
