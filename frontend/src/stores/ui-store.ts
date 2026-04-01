/**
 * 统一 UI 状态 Store
 * 合并原 toast-store 和 loading-store
 */

import { create } from 'zustand';

// ==================== Toast ====================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration: number; // ms, 0 = manual dismiss only
}

interface LoadingEntry {
  isLoading: boolean;
  progress: number | null;
  error: string | null;
  startedAt: number | null;
}

interface UIState {
  // === Toast ===
  toasts: ToastItem[];
  addToast: (type: ToastType, message: string, duration?: number) => string;
  removeToast: (id: string) => void;
  clearAllToasts: () => void;

  // === Loading ===
  loadingEntries: Record<string, LoadingEntry>;
  startLoading: (key: string) => void;
  setProgress: (key: string, pct: number) => void;
  finishLoading: (key: string) => void;
  failLoading: (key: string, error: string) => void;
  resetLoading: (key: string) => void;
  isLoading: (key: string) => boolean;
}

let toastCounter = 0;

export const useUIStore = create<UIState>((set, get) => ({
  // === Toast ===
  toasts: [],

  addToast: (type, message, duration = 4000) => {
    const id = `toast-${++toastCounter}-${Date.now()}`;
    const toast: ToastItem = { id, type, message, duration };

    set((s) => ({ toasts: [...s.toasts, toast] }));

    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }

    return id;
  },

  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  clearAllToasts: () => set({ toasts: [] }),

  // === Loading ===
  loadingEntries: {},

  startLoading: (key) =>
    set((s) => ({
      loadingEntries: {
        ...s.loadingEntries,
        [key]: { isLoading: true, progress: null, error: null, startedAt: Date.now() },
      },
    })),

  setProgress: (key, pct) =>
    set((s) => {
      const entry = s.loadingEntries[key];
      if (!entry?.isLoading) return s;
      return {
        loadingEntries: {
          ...s.loadingEntries,
          [key]: { ...entry, progress: Math.min(100, Math.max(0, pct)) },
        },
      };
    }),

  finishLoading: (key) =>
    set((s) => ({
      loadingEntries: {
        ...s.loadingEntries,
        [key]: { isLoading: false, progress: 100, error: null, startedAt: null },
      },
    })),

  failLoading: (key, error) =>
    set((s) => ({
      loadingEntries: {
        ...s.loadingEntries,
        [key]: { ...s.loadingEntries[key], isLoading: false, error, startedAt: null },
      },
    })),

  resetLoading: (key) =>
    set((s) => {
      const { [key]: _, ...rest } = s.loadingEntries;
      return { loadingEntries: rest };
    }),

  isLoading: (key) => {
    const entry = get().loadingEntries[key];
    return entry?.isLoading ?? false;
  },
}));

// ==================== 便捷方法 (保持 API 兼容) ====================

/** toast 便捷 API，保持原有用法 */
export const toast = {
  success: (msg: string, dur?: number) => useUIStore.getState().addToast('success', msg, dur),
  error: (msg: string, dur?: number) => useUIStore.getState().addToast('error', msg, dur ?? 5000),
  warning: (msg: string, dur?: number) => useUIStore.getState().addToast('warning', msg, dur),
  info: (msg: string, dur?: number) => useUIStore.getState().addToast('info', msg, dur),
};

/** 向后兼容: 旧 useToastStore → useUIStore */
export const useToastStore = useUIStore;
/** 向后兼容: 旧 useLoadingStore → useUIStore */
export const useLoadingStore = useUIStore;
