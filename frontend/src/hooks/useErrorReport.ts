/**
 * useErrorReport Hook
 * 管理 ErrorReport 列表：添加、删除、复制、清空
 * 集成 errorLogger 和 Toast 通知
 */

import { useCallback, useRef, useSyncExternalStore } from 'react';
import { errorLogger } from '../lib/errors/error-logger';
import {
  createErrorReport,
  formatReportAsMarkdown,
  type ErrorReport,
  type ErrorSource,
  type ErrorSeverityLevel,
  type ErrorContext,
} from '../lib/errors/error-report';

// ── 外部 store（支持多个组件订阅同一份数据） ──

let _reports: ErrorReport[] = [];
const _listeners = new Set<() => void>();

function _emit() {
  _listeners.forEach((fn) => fn());
}

function _subscribe(listener: () => void) {
  _listeners.add(listener);
  return () => { _listeners.delete(listener); };
}

function _getSnapshot() {
  return _reports;
}

/** 最大保留条数 */
const MAX_REPORTS = 100;

/** 添加错误到全局列表 */
function addReport(report: ErrorReport) {
  _reports = [report, ..._reports].slice(0, MAX_REPORTS);
  _emit();
}

/** 同时写入 errorLogger */
function logToLogger(report: ErrorReport) {
  errorLogger.log({
    type: report.source === 'simulator' ? 'unknown' : report.source === 'compiler' ? 'unknown' : 'unknown',
    message: report.message,
    stack: report.stack,
    metadata: {
      errorReportId: report.id,
      source: report.source,
      severity: report.severity,
    },
  });
}

// ── Hook ──

export interface UseErrorReportOptions {
  /** 默认 context 覆盖 */
  defaultContext?: Partial<ErrorContext>;
}

export function useErrorReport(options: UseErrorReportOptions = {}) {
  const reports = useSyncExternalStore(_subscribe, _getSnapshot);
  const ctxRef = useRef(options.defaultContext);

  /** 添加错误 */
  const addError = useCallback(
    (
      source: ErrorSource,
      severity: ErrorSeverityLevel,
      message: string,
      detail?: string,
      extra?: { stack?: string; context?: Partial<ErrorContext> },
    ) => {
      const report = createErrorReport(source, severity, message, detail, {
        ...extra,
        context: { ...ctxRef.current, ...extra?.context },
      });
      addReport(report);
      logToLogger(report);
      return report;
    },
    [],
  );

  /** 从 Error 对象创建并添加 */
  const addFromError = useCallback(
    (
      error: unknown,
      source: ErrorSource,
      severity: ErrorSeverityLevel = 'warning',
      message?: string,
    ) => {
      const errMsg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      return addError(source, severity, message || errMsg, errMsg, { stack });
    },
    [addError],
  );

  /** 标记为已解决 */
  const dismissError = useCallback((id: string) => {
    _reports = _reports.map((r) => (r.id === id ? { ...r, resolved: true } : r));
    _emit();
  }, []);

  /** 删除 */
  const removeError = useCallback((id: string) => {
    _reports = _reports.filter((r) => r.id !== id);
    _emit();
  }, []);

  /** 复制错误详情到剪贴板 */
  const copyErrorDetail = useCallback(async (id: string) => {
    const report = _reports.find((r) => r.id === id);
    if (!report) return false;
    const md = formatReportAsMarkdown(report);
    try {
      await navigator.clipboard.writeText(md);
      return true;
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = md;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    }
  }, []);

  /** 清空全部 */
  const clearAll = useCallback(() => {
    _reports = [];
    _emit();
  }, []);

  /** 更新 context（如项目切换时） */
  const updateContext = useCallback((ctx: Partial<ErrorContext>) => {
    ctxRef.current = { ...ctxRef.current, ...ctx };
  }, []);

  return {
    reports,
    addError,
    addFromError,
    dismissError,
    removeError,
    copyErrorDetail,
    clearAll,
    updateContext,
  };
}

/** 非 React 环境直接访问 */
export function getErrorReports(): ErrorReport[] {
  return _reports;
}
