/**
 * useLoadingState Hook
 * 统一的加载状态管理，支持进度百分比和错误关联
 * 参考规划: JJC-20260328-007 §三、§七.1
 */

import { useCallback, useSyncExternalStore } from 'react';
import type { ErrorReport } from '../lib/errors/error-report';

// ── 全局 Loading Store ──

interface LoadingEntry {
  key: string;
  isLoading: boolean;
  progress: number | null; // null = 无进度信息（spinner 模式）
  error: ErrorReport | null;
  startedAt: number | null;
}

type LoadingMap = Map<string, LoadingEntry>;

let _loadingMap: LoadingMap = new Map();
const _listeners = new Set<() => void>();

function _emit() {
  _listeners.forEach((fn) => fn());
}

function _subscribe(listener: () => void) {
  _listeners.add(listener);
  return () => { _listeners.delete(listener); };
}

function _getSnapshot() {
  return _loadingMap;
}

function _ensure(key: string): LoadingEntry {
  let entry = _loadingMap.get(key);
  if (!entry) {
    entry = { key, isLoading: false, progress: null, error: null, startedAt: null };
    _loadingMap = new Map(_loadingMap);
    _loadingMap.set(key, entry);
  }
  return entry;
}

function _update(key: string, updater: (entry: LoadingEntry) => LoadingEntry) {
  const entry = _ensure(key);
  _loadingMap = new Map(_loadingMap);
  _loadingMap.set(key, updater(entry));
  _emit();
}

// ── Hook ──

export function useLoadingState(key: string) {
  const map = useSyncExternalStore(_subscribe, _getSnapshot);
  const entry = map.get(key) ?? { key, isLoading: false, progress: null, error: null, startedAt: null };

  const start = useCallback(() => {
    _update(key, (e) => ({ ...e, isLoading: true, progress: null, error: null, startedAt: Date.now() }));
  }, [key]);

  const setProgress = useCallback((pct: number) => {
    _update(key, (e) => ({ ...e, isLoading: true, progress: Math.min(100, Math.max(0, pct)) }));
  }, [key]);

  const finish = useCallback(() => {
    _update(key, (e) => ({ ...e, isLoading: false, progress: 100, error: null, startedAt: null }));
  }, [key]);

  const fail = useCallback((err: ErrorReport) => {
    _update(key, (e) => ({ ...e, isLoading: false, error: err, startedAt: null }));
  }, [key]);

  const reset = useCallback(() => {
    _loadingMap = new Map(_loadingMap);
    _loadingMap.delete(key);
    _emit();
  }, [key]);

  return {
    isLoading: entry.isLoading,
    progress: entry.progress,
    error: entry.error,
    startedAt: entry.startedAt,
    start,
    setProgress,
    finish,
    fail,
    reset,
  };
}

/** 获取所有加载状态（调试用） */
export function getAllLoadingStates(): LoadingMap {
  return _loadingMap;
}

// ── 超时降级工具 ──

/**
 * 带超时的 Promise 包装
 * @param fn 异步操作
 * @param timeoutMs 超时毫秒数
 * @param retries 重试次数
 * @param retryDelays 每次重试的延迟 [1000, 3000]
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number = 10000,
  retries: number = 0,
  retryDelays: number[] = [1000, 3000],
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const delay = retryDelays[attempt - 1] ?? 3000;
      await new Promise((r) => setTimeout(r, delay));
    }
    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs),
        ),
      ]);
      return result;
    } catch (err) {
      lastError = err;
      if ((err as Error).message !== 'TIMEOUT') throw err;
    }
  }
  throw lastError;
}
