/**
 * 连接状态栏组件
 * 显示 WebSocket 连接状态、重连进度和离线模式提示
 * 在断连时提供明显的视觉反馈
 */

import { useMemo } from 'react';
import { WSState } from '../../lib/simulation/ws-client';
import './ConnectionStatus.css';

interface ConnectionStatusProps {
  /** WebSocket 连接状态 */
  wsState: WSState;
  /** 是否有仿真在运行 */
  isSimulating?: boolean;
  /** 重连尝试次数 */
  reconnectAttempt?: number;
  /** 最大重连次数 */
  maxReconnectAttempts?: number;
  /** 手动重连回调 */
  onReconnect?: () => void;
  /** 网络是否离线 */
  isOffline?: boolean;
}

export function ConnectionStatus({
  wsState,
  isSimulating = false,
  reconnectAttempt = 0,
  maxReconnectAttempts = 5,
  onReconnect,
  isOffline = false,
}: ConnectionStatusProps) {
  const statusInfo = useMemo(() => {
    if (isOffline) {
      return {
        icon: '📴',
        text: '网络已断开',
        detail: '请检查网络连接',
        className: 'cs-offline',
        showReconnect: false,
      };
    }

    switch (wsState) {
      case WSState.Connected:
        return {
          icon: '🟢',
          text: '已连接',
          detail: isSimulating ? '仿真运行中' : '与服务器通信正常',
          className: 'cs-connected',
          showReconnect: false,
        };
      case WSState.Connecting:
        return {
          icon: '🟡',
          text: '连接中...',
          detail: '正在建立与服务器的连接',
          className: 'cs-connecting',
          showReconnect: false,
        };
      case WSState.Reconnecting:
        return {
          icon: '🔄',
          text: `重连中 (${reconnectAttempt}/${maxReconnectAttempts})`,
          detail: '连接断开，正在尝试自动重连',
          className: 'cs-reconnecting',
          showReconnect: false,
        };
      case WSState.Disconnected:
      default:
        return {
          icon: '🔴',
          text: '未连接',
          detail: '与仿真服务器的连接已断开',
          className: 'cs-disconnected',
          showReconnect: true,
        };
    }
  }, [wsState, isSimulating, reconnectAttempt, maxReconnectAttempts, isOffline]);

  // 已连接状态简化显示
  if (wsState === WSState.Connected && !isOffline) {
    return (
      <div className="cs-bar cs-connected cs-minimal" title={statusInfo.detail}>
        <span className="cs-dot cs-dot-connected" />
        <span className="cs-text-mini">已连接</span>
        {isSimulating && <span className="cs-sim-indicator">⚡ 运行中</span>}
      </div>
    );
  }

  return (
    <div className={`cs-bar ${statusInfo.className}`}>
      <span className="cs-icon">{statusInfo.icon}</span>
      <div className="cs-info">
        <span className="cs-text">{statusInfo.text}</span>
        <span className="cs-detail">{statusInfo.detail}</span>
      </div>
      {statusInfo.showReconnect && onReconnect && (
        <button className="cs-reconnect-btn" onClick={onReconnect}>
          🔄 重新连接
        </button>
      )}
      {wsState === WSState.Reconnecting && (
        <div className="cs-progress">
          <div
            className="cs-progress-fill"
            style={{ width: `${(reconnectAttempt / maxReconnectAttempts) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
