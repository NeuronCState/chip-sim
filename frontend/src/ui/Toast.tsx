import { useState, useEffect, useCallback } from 'react';
import styles from './Toast.module.css';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

export interface ToastProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

const icons: Record<ToastType, string> = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '❌',
};

function SingleToast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 200);
  }, [onDismiss, toast.id]);

  useEffect(() => {
    const timer = setTimeout(dismiss, toast.duration ?? 3000);
    return () => clearTimeout(timer);
  }, [dismiss, toast.duration]);

  return (
    <div className={`${styles.toast} ${styles[toast.type]} ${exiting ? styles.toastExit : ''}`}>
      <span className={styles.icon}>{icons[toast.type]}</span>
      <span>{toast.message}</span>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  return (
    <div className={styles.container}>
      {toasts.map(t => (
        <SingleToast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
