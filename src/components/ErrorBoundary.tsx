'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[40vh] flex items-center justify-center p-8">
          <div className="text-center space-y-4 max-w-md">
            <AlertTriangle size={48} className="mx-auto text-amber-400" />
            <h2 className="text-lg font-bold text-white">
              {this.props.fallbackMessage || 'Algo deu errado'}
            </h2>
            <p className="text-sm text-gray-400">
              Ocorreu um erro inesperado. Tente recarregar a página.
            </p>
            {this.state.error && (
              <details className="text-left text-xs text-gray-600 bg-white/5 rounded-lg p-3">
                <summary className="cursor-pointer text-gray-500">Detalhes do erro</summary>
                <pre className="mt-2 whitespace-pre-wrap break-words">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div className="flex justify-center gap-3">
              <button
                onClick={this.handleRetry}
                className="cyber-btn-primary flex items-center gap-2 px-4 py-2 text-sm"
              >
                <RefreshCw size={14} /> Tentar novamente
              </button>
              <button
                onClick={() => window.location.reload()}
                className="cyber-btn-secondary flex items-center gap-2 px-4 py-2 text-sm"
              >
                Recarregar página
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
