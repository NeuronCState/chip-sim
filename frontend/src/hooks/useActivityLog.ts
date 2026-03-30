/**
 * useActivityLog Hook
 * React 接口层，订阅操作日志变化
 * 参考规划: JJC-20260328-007 §七.1
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  addActivity,
  getActivityLog,
  searchActivity,
  exportActivityLog,
  clearActivityLog,
  subscribeActivity,
  loadActivityFromDB,
  type ActivityType,
  type ActivityEntry,
} from '../lib/activity/activity-log';

let _entries: ActivityEntry[] = [];
const _listeners = new Set<() => void>();

// 初始同步
_entries = getActivityLog();

// 订阅底层变化
subscribeActivity(() => {
  _entries = getActivityLog();
  _listeners.forEach((fn) => fn());
});

function _subscribe(listener: () => void) {
  _listeners.add(listener);
  return () => { _listeners.delete(listener); };
}

function _getSnapshot() {
  return _entries;
}

export function useActivityLog() {
  const logs = useSyncExternalStore(_subscribe, _getSnapshot);

  // 初始化时从 IndexedDB 加载
  useEffect(() => {
    loadActivityFromDB();
  }, []);

  const addLog = useCallback(
    (type: ActivityType, label: string, detail?: string, metadata?: Record<string, unknown>) => {
      return addActivity(type, label, detail, metadata);
    },
    [],
  );

  const search = useCallback((query: string) => {
    return searchActivity(query);
  }, []);

  const exportLog = useCallback(() => {
    return exportActivityLog();
  }, []);

  const clear = useCallback(() => {
    clearActivityLog();
  }, []);

  return { logs, addLog, search, exportLog, clear };
}
