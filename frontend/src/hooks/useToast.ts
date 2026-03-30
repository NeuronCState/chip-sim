/**
 * useToast Hook
 * 提供 React 组件中使用 Toast 的便捷方式
 * 封装 Zustand store，支持链式调用
 */

import { useToastStore, toast as toastApi, type ToastType } from '../stores/toast-store';

/**
 * @example
 * ```tsx
 * const { success, error, warning, info, clear } = useToast();
 * 
 * success('保存成功！');
 * error('操作失败，请重试', 5000);
 * ```
 */
export function useToast() {
  const addToast = useToastStore((s) => s.addToast);
  const clearAll = useToastStore((s) => s.clearAll);
  const toasts = useToastStore((s) => s.toasts);

  return {
    /** 成功提示（绿色） */
    success: (message: string, duration?: number) => addToast('success', message, duration),
    /** 错误提示（红色，默认 5s） */
    error: (message: string, duration?: number) => addToast('error', message, duration ?? 5000),
    /** 警告提示（黄色） */
    warning: (message: string, duration?: number) => addToast('warning', message, duration),
    /** 信息提示（蓝色） */
    info: (message: string, duration?: number) => addToast('info', message, duration),
    /** 自定义类型 */
    show: (type: ToastType, message: string, duration?: number) => addToast(type, message, duration),
    /** 清除所有通知 */
    clearAll,
    /** 当前通知列表 */
    toasts,
  };
}

/**
 * 非 React 上下文中也可以直接使用 toast 对象
 * （从 stores/toast-store 导出）
 */
export { toastApi as toast };
