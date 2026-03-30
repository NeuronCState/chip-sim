/**
 * 全局 Toast 通知 Store
 * 使用 Zustand 管理通知状态
 */

import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration: number; // ms, 0 = manual dismiss only
}

interface ToastStore {
  toasts: ToastItem[];
  addToast: (type: ToastType, message: string, duration?: number) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

let toastCounter = 0;

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  addToast: (type, message, duration = 4000) => {
    const id = `toast-${++toastCounter}-${Date.now()}`;
    const toast: ToastItem = { id, type, message, duration };

    set((s) => ({ toasts: [...s.toasts, toast] }));

    // 自动消失
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

  clearAll: () => set({ toasts: [] }),
}));

/** 便捷方法 */
export const toast = {
  success: (msg: string, dur?: number) => useToastStore.getState().addToast('success', msg, dur),
  error: (msg: string, dur?: number) => useToastStore.getState().addToast('error', msg, dur ?? 5000),
  warning: (msg: string, dur?: number) => useToastStore.getState().addToast('warning', msg, dur),
  info: (msg: string, dur?: number) => useToastStore.getState().addToast('info', msg, dur),
};
