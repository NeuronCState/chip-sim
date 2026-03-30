/**
 * useOffline Hook
 * 检测网络离线状态，提供离线/在线事件通知
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * @example
 * ```tsx
 * const { isOffline, wasOffline } = useOffline();
 *
 * if (isOffline) {
 *   return <OfflineBanner />;
 * }
 * ```
 */
export function useOffline() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  const handleOffline = useCallback(() => {
    setIsOffline(true);
    setWasOffline(true);
  }, []);

  const handleOnline = useCallback(() => {
    setIsOffline(false);
  }, []);

  useEffect(() => {
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [handleOffline, handleOnline]);

  return { isOffline, wasOffline };
}
