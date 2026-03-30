/**
 * React 错误边界组件
 * 捕获子组件渲染错误，显示友好提示而非白屏
 * 集成错误日志收集器，支持错误上报
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { errorLogger } from '../lib/errors/error-logger';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** 可选的自定义 fallback UI */
  fallback?: ReactNode;
  /** 错误发生时的回调 */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** 子组件名称（用于错误日志） */
  name?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, errorId: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 记录到全局错误日志
    const errorId = errorLogger.log({
      type: 'render',
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack ?? undefined,
      metadata: { boundaryName: this.props.name || 'root' },
    });

    this.setState({ errorInfo, errorId });

    // 调用自定义回调
    this.props.onError?.(error, errorInfo);
  }

  handleReload = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null, errorId: null });
  };

  handleFullReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.icon}>💥</div>
            <h2 style={styles.title}>页面出现错误</h2>
            <p style={styles.message}>
              {this.state.error?.message || '未知错误'}
            </p>
            {this.state.errorId && (
              <p style={styles.errorId}>错误 ID: {this.state.errorId}</p>
            )}
            <div style={styles.actions}>
              <button style={styles.button} onClick={this.handleReload}>
                🔄 重新加载组件
              </button>
              <button style={{ ...styles.button, ...styles.buttonSecondary }} onClick={this.handleFullReload}>
                🔃 刷新页面
              </button>
            </div>
            {import.meta.env.DEV && this.state.errorInfo && (
              <details style={styles.details}>
                <summary style={styles.summary}>错误详情 (开发模式)</summary>
                <pre style={styles.stack}>
                  {this.state.error?.stack}
                  {'\n\nComponent Stack:'}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/** 内联样式，不依赖外部 CSS */
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#0d0d1a',
    color: '#e0e0e0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '20px',
  },
  card: {
    background: '#16162a',
    border: '1px solid #2a2a4a',
    borderRadius: '12px',
    padding: '32px',
    maxWidth: '480px',
    width: '100%',
    textAlign: 'center' as const,
  },
  icon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    marginBottom: '12px',
    color: '#ff6b6b',
  },
  message: {
    fontSize: '14px',
    color: '#aaa',
    marginBottom: '12px',
    lineHeight: 1.5,
  },
  errorId: {
    fontSize: '11px',
    color: '#666',
    marginBottom: '20px',
    fontFamily: 'monospace',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    flexWrap: 'wrap' as const,
  },
  button: {
    background: '#0066cc',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '10px 20px',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  buttonSecondary: {
    background: '#2a2a4a',
    color: '#ccc',
  },
  details: {
    marginTop: '20px',
    textAlign: 'left' as const,
  },
  summary: {
    cursor: 'pointer',
    fontSize: '13px',
    color: '#888',
    marginBottom: '8px',
  },
  stack: {
    background: '#0d0d1a',
    border: '1px solid #2a2a4a',
    borderRadius: '6px',
    padding: '12px',
    fontSize: '11px',
    lineHeight: 1.5,
    overflow: 'auto',
    maxHeight: '200px',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
    color: '#ff6b6b',
  },
};
