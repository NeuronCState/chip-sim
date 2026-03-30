/**
 * 通知中心组件
 * 可关闭的通知面板，展示系统通知和错误日志
 * 从 errorLogger 获取错误记录，从 toast store 获取通知
 */

import { useState, useEffect, useCallback } from 'react';
import { errorLogger, type ErrorLogEntry } from '../../lib/errors/error-logger';
import './NotificationCenter.css';

interface NotificationCenterProps {
  /** 是否显示 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
}

type TabKey = 'errors' | 'toasts';

/** 格式化时间 */
function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** 错误类型图标 */
function getErrorIcon(type: ErrorLogEntry['type']): string {
  switch (type) {
    case 'render': return '💥';
    case 'api': return '🌐';
    case 'websocket': return '🔌';
    case 'unhandled': return '⚠️';
    case 'resource': return '📦';
    default: return '❓';
  }
}

export function NotificationCenter({ open, onClose }: NotificationCenterProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('errors');
  const [errors, setErrors] = useState<ErrorLogEntry[]>(errorLogger.getLogs());

  // 订阅新错误
  useEffect(() => {
    const unsub = errorLogger.subscribe(() => {
      setErrors(errorLogger.getLogs());
    });
    return unsub;
  }, []);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const handleClearErrors = useCallback(() => {
    errorLogger.clear();
    setErrors([]);
  }, []);

  if (!open) return null;

  return (
    <div className="nc-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="nc-panel">
        {/* 头部 */}
        <div className="nc-header">
          <h3 className="nc-title">🔔 通知中心</h3>
          <div className="nc-header-actions">
            <button className="nc-clear-btn" onClick={handleClearErrors} title="清空错误日志">
              🗑 清空
            </button>
            <button className="nc-close-btn" onClick={onClose} title="关闭">
              ✕
            </button>
          </div>
        </div>

        {/* Tab 切换 */}
        <div className="nc-tabs">
          <button
            className={`nc-tab ${activeTab === 'errors' ? 'nc-tab-active' : ''}`}
            onClick={() => setActiveTab('errors')}
          >
            错误日志 ({errors.length})
          </button>
          <button
            className={`nc-tab ${activeTab === 'toasts' ? 'nc-tab-active' : ''}`}
            onClick={() => setActiveTab('toasts')}
          >
            最近通知
          </button>
        </div>

        {/* 内容 */}
        <div className="nc-content">
          {activeTab === 'errors' && (
            errors.length === 0 ? (
              <div className="nc-empty">✅ 暂无错误记录</div>
            ) : (
              <div className="nc-error-list">
                {errors.map((err) => (
                  <div key={err.id} className={`nc-error-item nc-error-${err.type}`}>
                    <span className="nc-error-icon">{getErrorIcon(err.type)}</span>
                    <div className="nc-error-body">
                      <div className="nc-error-message">{err.message}</div>
                      <div className="nc-error-meta">
                        <span className="nc-error-type">{err.type}</span>
                        {err.statusCode && <span className="nc-error-status">HTTP {err.statusCode}</span>}
                        <span className="nc-error-time">{formatTime(err.timestamp)}</span>
                      </div>
                      {err.url && <div className="nc-error-url">{err.url}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'toasts' && (
            <div className="nc-empty">
              💡 Toast 通知为临时消息，此处仅展示系统错误日志
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
