/**
 * 三层 React 错误边界架构
 * Root → Editor / Simulator / Sidebar
 * 参考规划: JJC-20260328-007 §五
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { errorLogger } from '../lib/errors/error-logger';

// ==================== 基础错误边界 ====================

interface BaseBoundaryProps {
  children: ReactNode;
  name: string;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface BaseBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

abstract class BaseErrorBoundary extends Component<BaseBoundaryProps, BaseBoundaryState> {
  constructor(props: BaseBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, errorId: null };
  }

  static getDerivedStateFromError(error: Error): Partial<BaseBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const errorId = errorLogger.log({
      type: 'render',
      message: `[${this.props.name}] ${error.message}`,
      stack: error.stack,
      componentStack: errorInfo.componentStack ?? undefined,
      metadata: { boundaryName: this.props.name },
    });
    this.setState({ errorInfo, errorId });
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null, errorId: null });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  abstract renderFallback(): ReactNode;

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return this.renderFallback();
    }
    return this.props.children;
  }
}

// ==================== ① RootErrorBoundary ====================
// 全局兜底，白屏恢复

export class RootErrorBoundary extends BaseErrorBoundary {
  renderFallback(): ReactNode {
    return (
      <div style={rootStyles.container}>
        <div style={rootStyles.card}>
          <div style={rootStyles.icon}>💥</div>
          <h2 style={rootStyles.title}>应用遇到错误</h2>
          <p style={rootStyles.message}>
            {this.state.error?.message || '发生了未预期的错误'}
          </p>
          {this.state.errorId && (
            <p style={rootStyles.errorId}>错误 ID: {this.state.errorId}</p>
          )}
          <div style={rootStyles.actions}>
            <button style={rootStyles.btnPrimary} onClick={this.handleRetry}>
              🔄 重新加载组件
            </button>
            <button style={rootStyles.btnSecondary} onClick={this.handleReload}>
              🔃 刷新页面
            </button>
          </div>
          {import.meta.env.DEV && this.state.error?.stack && (
            <details style={rootStyles.details}>
              <summary style={rootStyles.summary}>错误堆栈 (开发模式)</summary>
              <pre style={rootStyles.stack}>{this.state.error.stack}</pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}

const rootStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: '100vh', background: '#0d0d1a', color: '#e0e0e0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '20px',
  },
  card: {
    background: '#16162a', border: '1px solid #2a2a4a', borderRadius: '12px',
    padding: '32px', maxWidth: '480px', width: '100%', textAlign: 'center',
  },
  icon: { fontSize: '48px', marginBottom: '16px' },
  title: { fontSize: '20px', fontWeight: 600, marginBottom: '12px', color: '#ff6b6b' },
  message: { fontSize: '14px', color: '#aaa', marginBottom: '12px', lineHeight: 1.5 },
  errorId: { fontSize: '11px', color: '#666', marginBottom: '20px', fontFamily: 'monospace' },
  actions: { display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' },
  btnPrimary: {
    background: '#0066cc', color: '#fff', border: 'none', borderRadius: '6px',
    padding: '10px 20px', fontSize: '14px', cursor: 'pointer',
  },
  btnSecondary: {
    background: '#2a2a4a', color: '#ccc', border: 'none', borderRadius: '6px',
    padding: '10px 20px', fontSize: '14px', cursor: 'pointer',
  },
  details: { marginTop: '20px', textAlign: 'left' },
  summary: { cursor: 'pointer', fontSize: '13px', color: '#888', marginBottom: '8px' },
  stack: {
    background: '#0d0d1a', border: '1px solid #2a2a4a', borderRadius: '6px',
    padding: '12px', fontSize: '11px', lineHeight: 1.5, overflow: 'auto',
    maxHeight: '200px', whiteSpace: 'pre-wrap', color: '#ff6b6b',
  },
};

// ==================== ② EditorErrorBoundary ====================
// 编辑器区域隔离，Monaco 崩溃时显示代码骨架 + 重试

export class EditorErrorBoundary extends BaseErrorBoundary {
  renderFallback(): ReactNode {
    return (
      <div style={editorStyles.container}>
        <div style={editorStyles.overlay}>
          <div style={editorStyles.icon}>📝</div>
          <h3 style={editorStyles.title}>编辑器加载失败</h3>
          <p style={editorStyles.message}>
            {this.state.error?.message || '代码编辑器遇到了问题'}
          </p>
          <button style={editorStyles.retryBtn} onClick={this.handleRetry}>
            🔄 重试加载编辑器
          </button>
        </div>
        {/* 代码骨架背景 */}
        <div style={editorStyles.skeleton}>
          {Array.from({ length: 20 }, (_, i) => (
            <div key={i} style={{
              ...editorStyles.skelLine,
              width: `${30 + Math.random() * 60}%`,
              opacity: 0.15,
            }} />
          ))}
        </div>
      </div>
    );
  }
}

const editorStyles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative', height: '100%', minHeight: '300px',
    background: '#1e1e2e', borderRadius: '8px', overflow: 'hidden',
  },
  overlay: {
    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', zIndex: 2,
    background: 'rgba(30, 30, 46, 0.95)',
  },
  icon: { fontSize: '36px', marginBottom: '12px' },
  title: { fontSize: '16px', fontWeight: 600, color: '#f0a500', marginBottom: '8px' },
  message: { fontSize: '13px', color: '#aaa', marginBottom: '16px' },
  retryBtn: {
    background: '#f0a500', color: '#1e1e2e', border: 'none', borderRadius: '6px',
    padding: '8px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },
  skeleton: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' },
  skelLine: { height: '14px', background: '#333', borderRadius: '3px' },
};

// ==================== ③ SimulatorErrorBoundary ====================
// 仿真区域隔离，WASM 崩溃时显示波形占位 + 重启

interface SimulatorBoundaryProps extends BaseBoundaryProps {
  onRestart?: () => void;
}

export class SimulatorErrorBoundary extends BaseErrorBoundary {
  declare props: SimulatorBoundaryProps;

  renderFallback(): ReactNode {
    return (
      <div style={simStyles.container}>
        <div style={simStyles.wavePlaceholder}>
          {/* 波形占位线条 */}
          <svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="none">
            <path
              d="M0,100 Q50,80 100,100 T200,100 T300,100 T400,100"
              fill="none" stroke="#333" strokeWidth="1" strokeDasharray="4,4"
            />
          </svg>
        </div>
        <div style={simStyles.overlay}>
          <div style={simStyles.icon}>⚡</div>
          <h3 style={simStyles.title}>仿真引擎异常</h3>
          <p style={simStyles.message}>
            {this.state.error?.message || '仿真计算过程中发生了错误'}
          </p>
          <div style={simStyles.actions}>
            <button style={simStyles.btnPrimary} onClick={() => {
              this.handleRetry();
              (this.props as SimulatorBoundaryProps).onRestart?.();
            }}>
              🔄 重启仿真引擎
            </button>
          </div>
        </div>
      </div>
    );
  }
}

const simStyles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative', height: '100%', minHeight: '200px',
    background: '#0d0d1a', borderRadius: '8px', overflow: 'hidden',
  },
  wavePlaceholder: { position: 'absolute', inset: 0, opacity: 0.3 },
  overlay: {
    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', zIndex: 2,
    background: 'rgba(13, 13, 26, 0.9)',
  },
  icon: { fontSize: '36px', marginBottom: '12px' },
  title: { fontSize: '16px', fontWeight: 600, color: '#ff6b6b', marginBottom: '8px' },
  message: { fontSize: '13px', color: '#aaa', marginBottom: '16px' },
  actions: { display: 'flex', gap: '12px' },
  btnPrimary: {
    background: '#cc3333', color: '#fff', border: 'none', borderRadius: '6px',
    padding: '8px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },
};

// ==================== ④ SidebarErrorBoundary ====================
// 侧边栏隔离，数据加载失败时显示占位 + 重试

interface SidebarBoundaryProps extends BaseBoundaryProps {
  onRetryFetch?: () => void;
  panelName?: string;
}

export class SidebarErrorBoundary extends BaseErrorBoundary {
  declare props: SidebarBoundaryProps;

  renderFallback(): ReactNode {
    const panelName = (this.props as SidebarBoundaryProps).panelName || '面板';
    return (
      <div style={sidebarStyles.container}>
        <div style={sidebarStyles.icon}>📂</div>
        <p style={sidebarStyles.title}>{panelName}加载失败</p>
        <p style={sidebarStyles.message}>
          {this.state.error?.message || '无法加载数据'}
        </p>
        <button style={sidebarStyles.retryBtn} onClick={() => {
          this.handleRetry();
          (this.props as SidebarBoundaryProps).onRetryFetch?.();
        }}>
          🔄 重试
        </button>
      </div>
    );
  }
}

const sidebarStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '24px 16px', textAlign: 'center',
    background: '#16162a', borderRadius: '8px', minHeight: '150px',
  },
  icon: { fontSize: '28px', marginBottom: '8px' },
  title: { fontSize: '14px', fontWeight: 600, color: '#f0a500', marginBottom: '6px' },
  message: { fontSize: '12px', color: '#888', marginBottom: '12px' },
  retryBtn: {
    background: '#2a2a4a', color: '#ccc', border: 'none', borderRadius: '6px',
    padding: '6px 16px', fontSize: '12px', cursor: 'pointer',
  },
};
