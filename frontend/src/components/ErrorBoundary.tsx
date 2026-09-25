import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[TickeX ErrorBoundary] Caught unhandled render exception:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[70vh] flex items-center justify-center p-6 text-text-primary">
          <div className="surface-panel max-w-md w-full p-8 text-center shadow-2xl rounded-2xl border border-border-subtle">
            <div className="w-16 h-16 mx-auto rounded-full bg-danger/10 border border-danger/30 flex items-center justify-center text-danger mb-4">
              <AlertOctagon className="w-8 h-8" aria-hidden="true" />
            </div>
            <h2 className="text-2xl font-display font-bold text-white mb-2">
              {this.props.fallbackTitle || 'Đã có lỗi xảy ra'}
            </h2>
            <p className="text-sm text-text-secondary mb-6 leading-relaxed">
              {this.props.fallbackMessage || this.state.error?.message || 'Giao diện gặp sự cố ngoài dự kiến. Vui lòng tải lại trang hoặc quay lại trang chủ.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 text-sm font-bold text-white hover:bg-brand-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer transition-colors"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                Tải lại trang
              </button>
              <a
                href="/"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-surface-2 px-5 text-sm font-bold text-text-primary hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer transition-colors"
              >
                <Home className="w-4 h-4" aria-hidden="true" />
                Trang chủ
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
