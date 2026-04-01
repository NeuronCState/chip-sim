/**
 * 统一错误边界组件
 * 支持页面级、编辑器级、仿真器级、侧边栏级四种层级
 * 替代原 ErrorBoundaries.tsx + ErrorBoundaryLayers/
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { errorLogger } from '../lib/errors/error-logger';

// ==================== 类型定义 ====================

export type ErrorLevel = 'root' | 'editor' | 'simulator' | 'sidebar';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** 错误处理层级，决定 fallback 样式 */
  level?: ErrorLevel;
  /** 可选的自定义 fallback UI */
  fallback?: ReactNode;
  /** 错误发生时的回调 */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** 子组件名称（用于错误日志） */
  name?: string;
  /** 仿真器级：重启回调 */
  onRestart?: () => void;
  /** 侧边栏级：重试回调 */
  onRetryFetch?: () => void;
  /** 侧边栏级：面板名称 */
  panelName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

// ==================== 主组件 ====================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, errorId: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const name = this.props.name || this.props.level || 'root';
    const errorId = errorLogger.log({
      type: 'render',
      message: `[${name}] ${error.message}`,
      stack: error.stack,
      componentStack: errorInfo.componentStack ?? undefined,
      metadata: { boundaryName: name, level: this.props.level || 'root' },
    });
    this.setState({ errorInfo, errorId });
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null, errorId: null });
  };

  handleFullReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    const level = this.props.level || 'root';
    switch (level) {
      case 'root': return this.renderRootFallback();
      case 'editor': return this.renderEditorFallback();
      case 'simulator': return this.renderSimulatorFallback();
      case 'sidebar': return this.renderSidebarFallback();
      default: return this.renderRootFallback();
    }
  }

  // ==================== 页面级 fallback ====================
  private renderRootFallback(): ReactNode {
    return (
      <div style={styles.rootContainer}>
        <div style={styles.rootCard}>
          <div style={styles.rootIcon}>💥</div>
          <h2 style={styles.rootTitle}>应用遇到错误</h2>
          <p style={styles.rootMessage}>
            {this.state.error?.message || '发生了未预期的错误'}
          </p>
          {this.state.errorId && (
            <p style={styles.errorId}>错误 ID: {this.state.errorId}</p>
          )}
          <div style={styles.rootActions}>
            <button style={styles.btnPrimary} onClick={this.handleRetry}>
              🔄 重新加载组件
            </button>
            <button style={styles.btnSecondary} onClick={this.handleFullReload}>
              🔃 刷新页面
            </button>
          </div>
          {import.meta.env.DEV && this.state.error?.stack && (
            <details style={styles.details}>
              <summary style={styles.summary}>错误堆栈 (开发模式)</summary>
              <pre style={styles.stack}>{this.state.error.stack}</pre>
            </details>
          )}
        </div>
      </div>
    );
  }

  // ==================== 编辑器级 fallback ====================
  private renderEditorFallback(): ReactNode {
    return (
      <div style={styles.editorContainer}>
        <div style={styles.editorOverlay}>
          <div style={styles.editorIcon}>📝</div>
          <h3 style={styles.editorTitle}>编辑器加载失败</h3>
          <p style={styles.editorMessage}>
            {this.state.error?.message || '代码编辑器遇到了问题'}
          </p>
          <button style={styles.editorRetryBtn} onClick={this.handleRetry}>
            🔄 重试加载编辑器
          </button>
        </div>
        <div style={styles.editorSkeleton}>
          {Array.from({ length: 20 }, (_, i) => (
            <div key={i} style={{
              ...styles.skelLine,
              width: `${30 + Math.random() * 60}%`,
              opacity: 0.15,
            }} />
          ))}
        </div>
      </div>
    );
  }

  // ==================== 仿真器级 fallback ====================
  private renderSimulatorFallback(): ReactNode {
    return (
      <div style={styles.simContainer}>
        <div style={styles.simWavePlaceholder}>
          <svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="none">
            <path
              d="M0,100 Q50,80 100,100 T200,100 T300,100 T400,100"
              fill="none" stroke="#333" strokeWidth="1" strokeDasharray="4,4"
            />
          </svg>
        </div>
        <div style={styles.simOverlay}>
          <div style={styles.simIcon}>⚡</div>
          <h3 style={styles.simTitle}>仿真引擎异常</h3>
          <p style={styles.simMessage}>
            {this.state.error?.message || '仿真计算过程中发生了错误'}
          </p>
          <div style={styles.simActions}>
            <button style={styles.simRetryBtn} onClick={() => {
              this.handleRetry();
              this.props.onRestart?.();
            }}>
              🔄 重启仿真引擎
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== 侧边栏级 fallback ====================
  private renderSidebarFallback(): ReactNode {
    const panelName = this.props.panelName || '面板';
    return (
      <div style={styles.sidebarContainer}>
        <div style={styles.sidebarIcon}>📂</div>
        <p style={styles.sidebarTitle}>{panelName}加载失败</p>
        <p style={styles.sidebarMessage}>
          {this.state.error?.message || '无法加载数据'}
        </p>
        <button style={styles.sidebarRetryBtn} onClick={() => {
          this.handleRetry();
          this.props.onRetryFetch?.();
        }}>
          🔄 重试
        </button>
      </div>
    );
  }
}

// ==================== 便捷导出 ====================

/** 全局错误边界 (level='root' 的别名) */
export const RootErrorBoundary = ErrorBoundary;
/** 编辑器错误边界 */
export const EditorErrorBoundary = ErrorBoundary;
/** 仿真器错误边界 */
export const SimulatorErrorBoundary = ErrorBoundary;
/** 侧边栏错误边界 */
export const SidebarErrorBoundary = ErrorBoundary;

// ==================== 样式 ====================

const styles: Record<string, React.CSSProperties> = {
  // Root
  rootContainer: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: '100vh', background: '#0d0d1a', color: '#e0e0e0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '20px',
  },
  rootCard: {
    background: '#16162a', border: '1px solid #2a2a4a', borderRadius: '12px',
    padding: '32px', maxWidth: '480px', width: '100%', textAlign: 'center',
  },
  rootIcon: { fontSize: '48px', marginBottom: '16px' },
  rootTitle: { fontSize: '20px', fontWeight: 600, marginBottom: '12px', color: '#ff6b6b' },
  rootMessage: { fontSize: '14px', color: '#aaa', marginBottom: '12px', lineHeight: 1.5 },
  errorId: { fontSize: '11px', color: '#666', marginBottom: '20px', fontFamily: 'monospace' },
  rootActions: { display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' },
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
  // Editor
  editorContainer: {
    position: 'relative', height: '100%', minHeight: '300px',
    background: '#1e1e2e', borderRadius: '8px', overflow: 'hidden',
  },
  editorOverlay: {
    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', zIndex: 2,
    background: 'rgba(30, 30, 46, 0.95)',
  },
  editorIcon: { fontSize: '36px', marginBottom: '12px' },
  editorTitle: { fontSize: '16px', fontWeight: 600, color: '#f0a500', marginBottom: '8px' },
  editorMessage: { fontSize: '13px', color: '#aaa', marginBottom: '16px' },
  editorRetryBtn: {
    background: '#f0a500', color: '#1e1e2e', border: 'none', borderRadius: '6px',
    padding: '8px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },
  editorSkeleton: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' },
  skelLine: { height: '14px', background: '#333', borderRadius: '3px' },
  // Simulator
  simContainer: {
    position: 'relative', height: '100%', minHeight: '200px',
    background: '#0d0d1a', borderRadius: '8px', overflow: 'hidden',
  },
  simWavePlaceholder: { position: 'absolute', inset: 0, opacity: 0.3 },
  simOverlay: {
    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', zIndex: 2,
    background: 'rgba(13, 13, 26, 0.9)',
  },
  simIcon: { fontSize: '36px', marginBottom: '12px' },
  simTitle: { fontSize: '16px', fontWeight: 600, color: '#ff6b6b', marginBottom: '8px' },
  simMessage: { fontSize: '13px', color: '#aaa', marginBottom: '16px' },
  simActions: { display: 'flex', gap: '12px' },
  simRetryBtn: {
    background: '#cc3333', color: '#fff', border: 'none', borderRadius: '6px',
    padding: '8px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },
  // Sidebar
  sidebarContainer: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '24px 16px', textAlign: 'center',
    background: '#16162a', borderRadius: '8px', minHeight: '150px',
  },
  sidebarIcon: { fontSize: '28px', marginBottom: '8px' },
  sidebarTitle: { fontSize: '14px', fontWeight: 600, color: '#f0a500', marginBottom: '6px' },
  sidebarMessage: { fontSize: '12px', color: '#888', marginBottom: '12px' },
  sidebarRetryBtn: {
    background: '#2a2a4a', color: '#ccc', border: 'none', borderRadius: '6px',
    padding: '6px 16px', fontSize: '12px', cursor: 'pointer',
  },
};
