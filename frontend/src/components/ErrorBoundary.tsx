'use client';
import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            fontFamily: 'var(--ts-font-mono)',
            color: 'var(--ts-ink-3)',
          }}
        >
          <div style={{ fontSize: 13, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--ts-red)', marginBottom: 12 }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 11, marginBottom: 24 }}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            style={{
              padding: '8px 20px',
              border: '1px solid var(--ts-line-2)',
              background: 'transparent',
              color: 'var(--ts-ink-2)',
              fontFamily: 'var(--ts-font-mono)',
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
