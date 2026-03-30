/**
 * Loading Store — 全局加载状态管理
 * 参考规划: JJC-20260328-007 §三.2
 */

import { create } from 'zustand';

interface LoadingEntry {
  isLoading: boolean;
  progress: number | null;
  error: string | null;
  startedAt: number | null;
}

interface LoadingState {
  entries: Record<string, LoadingEntry>;
  start: (key: string) => void;
  setProgress: (key: string, pct: number) => void;
  finish: (key: string) => void;
  fail: (key: string, error: string) => void;
  reset: (key: string) => void;
  isActive: (key: string) => boolean;
}

export const useLoadingStore = create<LoadingState>((set, get) => ({
  entries: {},

  start: (key) =>
    set((s) => ({
      entries: {
        ...s.entries,
        [key]: { isLoading: true, progress: null, error: null, startedAt: Date.now() },
      },
    })),

  setProgress: (key, pct) =>
    set((s) => {
      const entry = s.entries[key];
      if (!entry?.isLoading) return s;
      return {
        entries: {
          ...s.entries,
          [key]: { ...entry, progress: Math.min(100, Math.max(0, pct)) },
        },
      };
    }),

  finish: (key) =>
    set((s) => ({
      entries: {
        ...s.entries,
        [key]: { isLoading: false, progress: 100, error: null, startedAt: null },
      },
    })),

  fail: (key, error) =>
    set((s) => ({
      entries: {
        ...s.entries,
        [key]: { ...s.entries[key], isLoading: false, error, startedAt: null },
      },
    })),

  reset: (key) =>
    set((s) => {
      const { [key]: _, ...rest } = s.entries;
      return { entries: rest };
    }),

  isActive: (key) => {
    const entry = get().entries[key];
    return entry?.isLoading ?? false;
  },
}));
