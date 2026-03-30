/**
 * 全局错误日志收集器
 * 收集前端渲染错误、API 错误、WebSocket 错误等
 * 支持上报到后端（可配置）
 */

export interface ErrorLogEntry {
  id: string;
  timestamp: number;
  type: 'render' | 'api' | 'websocket' | 'unhandled' | 'resource' | 'unknown';
  message: string;
  stack?: string;
  componentStack?: string;
  url?: string;
  statusCode?: number;
  metadata?: Record<string, unknown>;
}

type ErrorListener = (entry: ErrorLogEntry) => void;

class ErrorLogger {
  private logs: ErrorLogEntry[] = [];
  private listeners: ErrorListener[] = [];
  private maxLogs = 200;
  private reportUrl: string | null = null;

  /** 设置错误上报 URL */
  setReportUrl(url: string) {
    this.reportUrl = url;
  }

  /** 记录错误 */
  log(entry: Omit<ErrorLogEntry, 'id' | 'timestamp'>) {
    const full: ErrorLogEntry = {
      ...entry,
      id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };

    this.logs.unshift(full);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // 通知监听器
    this.listeners.forEach((fn) => fn(full));

    // 控制台输出
    console.error(`[ErrorLogger][${full.type}]`, full.message, full.stack || '');

    // 异步上报
    this.report(full);

    return full.id;
  }

  /** 获取所有日志 */
  getLogs(): ErrorLogEntry[] {
    return [...this.logs];
  }

  /** 按类型过滤 */
  getLogsByType(type: ErrorLogEntry['type']): ErrorLogEntry[] {
    return this.logs.filter((l) => l.type === type);
  }

  /** 清空日志 */
  clear() {
    this.logs = [];
  }

  /** 订阅新错误 */
  subscribe(listener: ErrorListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /** 上报到后端 */
  private async report(entry: ErrorLogEntry) {
    if (!this.reportUrl) return;
    try {
      await fetch(this.reportUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch {
      // 上报失败不影响用户体验
    }
  }
}

/** 全局单例 */
export const errorLogger = new ErrorLogger();

/** 全局未捕获错误监听 */
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    errorLogger.log({
      type: 'unhandled',
      message: event.message || '未捕获错误',
      stack: event.error?.stack,
      url: event.filename,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    errorLogger.log({
      type: 'unhandled',
      message: `未处理的 Promise 拒绝: ${event.reason?.message || event.reason}`,
      stack: event.reason?.stack,
    });
  });
}
