/**
 * 确认对话框组件
 * 用于批量删除等危险操作的二次确认
 * 支持不同危险级别和自定义内容
 */

import { useCallback } from 'react';
import './ConfirmDialog.css';

export type ConfirmVariant = 'default' | 'danger' | 'warning';

interface ConfirmDialogProps {
  /** 是否显示 */
  open: boolean;
  /** 标题 */
  title: string;
  /** 描述内容 */
  message: string | React.ReactNode;
  /** 确认按钮文字 */
  confirmText?: string;
  /** 取消按钮文字 */
  cancelText?: string;
  /** 危险级别 */
  variant?: ConfirmVariant;
  /** 确认回调 */
  onConfirm: () => void;
  /** 取消回调 */
  onCancel: () => void;
  /** 是否显示详细信息（可展开） */
  details?: string;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'default',
  onConfirm,
  onCancel,
  details,
}: ConfirmDialogProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    },
    [onCancel, onConfirm]
  );

  if (!open) return null;

  const variantIcon = {
    default: '❓',
    warning: '⚠️',
    danger: '🚨',
  }[variant];

  return (
    <div
      className="confirm-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className={`confirm-dialog confirm-${variant}`}>
        <div className="confirm-header">
          <span className="confirm-icon">{variantIcon}</span>
          <h3 id="confirm-title" className="confirm-title">{title}</h3>
        </div>

        <div className="confirm-body">
          {typeof message === 'string' ? (
            <p className="confirm-message">{message}</p>
          ) : (
            message
          )}

          {details && (
            <details className="confirm-details">
              <summary>查看详情</summary>
              <pre className="confirm-details-content">{details}</pre>
            </details>
          )}
        </div>

        <div className="confirm-actions">
          <button
            className="confirm-btn confirm-btn-cancel"
            onClick={onCancel}
            autoFocus
          >
            {cancelText}
          </button>
          <button
            className={`confirm-btn confirm-btn-ok confirm-btn-${variant}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
