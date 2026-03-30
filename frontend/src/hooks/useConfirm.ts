/**
 * useConfirm Hook
 * 为危险操作（批量删除等）提供确认对话框
 * 支持 Promise 风格调用
 */

import { useState, useCallback, useRef } from 'react';
import type { ConfirmVariant } from '../components/ConfirmDialog';

interface ConfirmOptions {
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  details?: string;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  resolve: ((value: boolean) => void) | null;
}

/**
 * @example
 * ```tsx
 * const { confirm, ConfirmDialogElement } = useConfirm();
 *
 * const handleDelete = async () => {
 *   const ok = await confirm({
 *     title: '确认删除',
 *     message: `将删除 ${selectedCount} 个元件及其连线，此操作可通过撤销恢复。`,
 *     variant: 'danger',
 *     confirmText: '删除',
 *   });
 *   if (ok) {
 *     deleteSelected();
 *   }
 * };
 *
 * // 在 JSX 中渲染确认对话框
 * return <>{ConfirmDialogElement}</>;
 * ```
 */
export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    title: '',
    message: '',
    variant: 'default',
    resolve: null,
  });

  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({
        open: true,
        title: options.title,
        message: options.message,
        confirmText: options.confirmText,
        cancelText: options.cancelText,
        variant: options.variant || 'default',
        details: options.details,
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    resolveRef.current?.(true);
    resolveRef.current = null;
    setState((s) => ({ ...s, open: false }));
  }, []);

  const handleCancel = useCallback(() => {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setState((s) => ({ ...s, open: false }));
  }, []);

  return {
    confirm,
    dialogProps: {
      open: state.open,
      title: state.title,
      message: state.message,
      confirmText: state.confirmText,
      cancelText: state.cancelText,
      variant: state.variant,
      details: state.details,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    },
  };
}
