/**
 * 离线模式提示横幅
 * 网络断开时显示在页面顶部
 */

import './OfflineBanner.css';

interface OfflineBannerProps {
  /** 是否离线 */
  isOffline: boolean;
  /** WS 重连中 */
  isReconnecting?: boolean;
}

export function OfflineBanner({ isOffline, isReconnecting = false }: OfflineBannerProps) {
  if (!isOffline && !isReconnecting) return null;

  return (
    <div className={`offline-banner ${isReconnecting ? 'offline-reconnecting' : ''}`}>
      <span className="offline-icon">
        {isReconnecting ? '🔄' : '📴'}
      </span>
      <span className="offline-text">
        {isReconnecting
          ? '网络已恢复，正在重新连接服务器...'
          : '网络连接已断开，部分功能暂不可用。您的工作已自动保存到本地。'
        }
      </span>
      {isReconnecting && <span className="offline-spinner" />}
    </div>
  );
}
