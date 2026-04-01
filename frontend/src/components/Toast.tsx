/**
 * Toast 通知组件
 * 支持 success / error / warning / info 四种类型
 * 自动消失 + 手动关闭 + 多条堆叠
 */

import { useToastStore, type ToastItem } from '../stores/ui-store';
import './Toast.css';

/** 单条通知 */
function ToastCard({ toast }: { toast: ToastItem }) {
  const removeToast = useToastStore((s) => s.removeToast);

  const iconMap = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };

  return (
    <div
      className={`toast-card toast-${toast.type}`}
      role="alert"
      onClick={() => removeToast(toast.id)}
    >
      <span className="toast-icon">{iconMap[toast.type]}</span>
      <span className="toast-message">{toast.message}</span>
      <button
        className="toast-close"
        onClick={(e) => {
          e.stopPropagation();
          removeToast(toast.id);
        }}
        aria-label="关闭"
      >
        ×
      </button>
    </div>
  );
}

/** Toast 容器 — 在 App 根节点渲染 */
export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </div>
  );
}
