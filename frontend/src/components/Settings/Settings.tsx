/**
 * 设置弹窗
 * 画布设置、编辑器设置、仿真设置、数据管理
 */

import { useState, useEffect, useCallback } from 'react';
import './Settings.css';

// ==================== 设置数据类型 ====================

interface AppSettings {
  // 画布
  canvasBg: 'dark' | 'light' | 'blue';
  gridStyle: 'solid' | 'dashed' | 'dotted' | 'none';
  gridSize: number;
  // 编辑器
  editorFontSize: number;
  editorTheme: 'vs-dark' | 'vs-light';
  // 仿真
  simStepMs: number;
  simAutoStart: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  canvasBg: 'dark',
  gridStyle: 'solid',
  gridSize: 20,
  editorFontSize: 14,
  editorTheme: 'vs-dark',
  simStepMs: 10,
  simAutoStart: false,
};

const STORAGE_KEY = 'chip-sim-settings';

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(s: AppSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

// ==================== Props ====================

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

// ==================== 组件 ====================

export function Settings({ isOpen, onClose }: SettingsProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<'canvas' | 'editor' | 'sim' | 'data'>('canvas');

  useEffect(() => {
    if (isOpen) {
      setSettings(loadSettings());
    }
  }, [isOpen]);

  const update = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      saveSettings(next);
      // 派发自定义事件，通知其他组件设置已变更
      window.dispatchEvent(new CustomEvent('chip-sim:settings-changed', { detail: next }));
      return next;
    });
  }, []);

  // ---- 数据管理操作 ----

  const handleExportAllData = useCallback(() => {
    const allData: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        allData[key] = localStorage.getItem(key) ?? '';
      }
    }
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chip-sim-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImportAllData = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string) as Record<string, string>;
          for (const [key, value] of Object.entries(data)) {
            localStorage.setItem(key, value);
          }
          alert('数据导入成功，刷新页面后生效。');
        } catch {
          alert('导入失败：文件格式无效');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  const handleClearAllData = useCallback(() => {
    if (!confirm('确定要清除所有本地数据？此操作不可恢复！')) return;
    if (!confirm('再次确认：这将删除所有项目、设置和模板数据。')) return;
    localStorage.clear();
    alert('所有数据已清除，刷新页面后生效。');
  }, []);

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <div className="settings-header">
          <h2 className="settings-title">⚙️ 设置</h2>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-body">
          {/* 侧边标签 */}
          <nav className="settings-tabs">
            <button
              className={`settings-tab ${activeTab === 'canvas' ? 'active' : ''}`}
              onClick={() => setActiveTab('canvas')}
            >
              🎨 画布
            </button>
            <button
              className={`settings-tab ${activeTab === 'editor' ? 'active' : ''}`}
              onClick={() => setActiveTab('editor')}
            >
              ✏️ 编辑器
            </button>
            <button
              className={`settings-tab ${activeTab === 'sim' ? 'active' : ''}`}
              onClick={() => setActiveTab('sim')}
            >
              ⚡ 仿真
            </button>
            <button
              className={`settings-tab ${activeTab === 'data' ? 'active' : ''}`}
              onClick={() => setActiveTab('data')}
            >
              💾 数据
            </button>
          </nav>

          {/* 内容区 */}
          <div className="settings-content">
            {/* === 画布设置 === */}
            {activeTab === 'canvas' && (
              <div className="settings-section">
                <h3 className="settings-section-title">画布设置</h3>

                <div className="settings-row">
                  <label className="settings-label">背景色</label>
                  <div className="settings-options">
                    {(['dark', 'light', 'blue'] as const).map((v) => (
                      <button
                        key={v}
                        className={`settings-opt-btn ${settings.canvasBg === v ? 'active' : ''}`}
                        onClick={() => update('canvasBg', v)}
                      >
                        {v === 'dark' ? '深色' : v === 'light' ? '浅色' : '蓝色'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="settings-row">
                  <label className="settings-label">网格样式</label>
                  <div className="settings-options">
                    {([
                      { v: 'solid', label: '实线' },
                      { v: 'dashed', label: '虚线' },
                      { v: 'dotted', label: '点线' },
                      { v: 'none', label: '无' },
                    ] as const).map(({ v, label }) => (
                      <button
                        key={v}
                        className={`settings-opt-btn ${settings.gridStyle === v ? 'active' : ''}`}
                        onClick={() => update('gridStyle', v)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="settings-row">
                  <label className="settings-label">网格大小</label>
                  <div className="settings-options">
                    {[10, 20, 40].map((v) => (
                      <button
                        key={v}
                        className={`settings-opt-btn ${settings.gridSize === v ? 'active' : ''}`}
                        onClick={() => update('gridSize', v)}
                      >
                        {v} px
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* === 编辑器设置 === */}
            {activeTab === 'editor' && (
              <div className="settings-section">
                <h3 className="settings-section-title">编辑器设置</h3>

                <div className="settings-row">
                  <label className="settings-label">字体大小</label>
                  <div className="settings-options">
                    {[12, 13, 14, 16].map((v) => (
                      <button
                        key={v}
                        className={`settings-opt-btn ${settings.editorFontSize === v ? 'active' : ''}`}
                        onClick={() => update('editorFontSize', v)}
                      >
                        {v} px
                      </button>
                    ))}
                  </div>
                </div>

                <div className="settings-row">
                  <label className="settings-label">编辑器主题</label>
                  <div className="settings-options">
                    <button
                      className={`settings-opt-btn ${settings.editorTheme === 'vs-dark' ? 'active' : ''}`}
                      onClick={() => update('editorTheme', 'vs-dark')}
                    >
                      深色
                    </button>
                    <button
                      className={`settings-opt-btn ${settings.editorTheme === 'vs-light' ? 'active' : ''}`}
                      onClick={() => update('editorTheme', 'vs-light')}
                    >
                      浅色
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* === 仿真设置 === */}
            {activeTab === 'sim' && (
              <div className="settings-section">
                <h3 className="settings-section-title">仿真设置</h3>

                <div className="settings-row">
                  <label className="settings-label">默认仿真步长</label>
                  <div className="settings-options">
                    {[1, 10, 100].map((v) => (
                      <button
                        key={v}
                        className={`settings-opt-btn ${settings.simStepMs === v ? 'active' : ''}`}
                        onClick={() => update('simStepMs', v)}
                      >
                        {v} ms
                      </button>
                    ))}
                  </div>
                </div>

                <div className="settings-row">
                  <label className="settings-label">自动启动仿真</label>
                  <button
                    className={`settings-toggle ${settings.simAutoStart ? 'on' : ''}`}
                    onClick={() => update('simAutoStart', !settings.simAutoStart)}
                  >
                    <span className="settings-toggle-knob" />
                  </button>
                </div>
              </div>
            )}

            {/* === 数据管理 === */}
            {activeTab === 'data' && (
              <div className="settings-section">
                <h3 className="settings-section-title">数据管理</h3>

                <div className="settings-data-actions">
                  <button className="settings-data-btn" onClick={handleExportAllData}>
                    📤 导出所有数据
                  </button>
                  <p className="settings-data-desc">将所有 localStorage 数据导出为 JSON 备份文件</p>

                  <button className="settings-data-btn" onClick={handleImportAllData}>
                    📥 导入所有数据
                  </button>
                  <p className="settings-data-desc">从 JSON 备份文件恢复数据</p>

                  <div className="settings-divider" />

                  <button className="settings-data-btn settings-data-danger" onClick={handleClearAllData}>
                    🗑️ 清除所有数据
                  </button>
                  <p className="settings-data-desc">清除所有本地存储数据（不可恢复）</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
