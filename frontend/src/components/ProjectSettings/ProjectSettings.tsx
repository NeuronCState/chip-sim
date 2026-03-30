/**
 * ProjectSettings - 项目设置面板
 * 重命名、描述编辑、导出、删除、存储信息
 */

import { useState, useEffect } from 'react';
import { projectManager } from '../../core/ProjectManager';
import type { StorageUsage } from '../../core/StorageManager';
import './ProjectSettings.css';

interface ProjectSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

export function ProjectSettings({ isOpen, onClose, projectId }: ProjectSettingsProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [storageInfo, setStorageInfo] = useState<StorageUsage | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && projectId) {
      loadProjectInfo();
      loadStorageInfo();
    }
  }, [isOpen, projectId]);

  const loadProjectInfo = async () => {
    const { storageManager: sm } = await import('../../core/StorageManager');
    const project = await sm.getProject(projectId);
    if (project) {
      setName(project.name);
      setDescription((project as unknown as Record<string, unknown>)['description'] as string || '');
    }
  };

  const loadStorageInfo = async () => {
    try {
      const info = await projectManager.getStorageInfo();
      setStorageInfo(info);
    } catch {
      // ignore
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (name.trim()) {
        await projectManager.renameProject(projectId, name.trim());
      }
      await projectManager.updateProjectDescription(projectId, description);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    projectManager.exportProjectAsJson(projectId);
  };

  const handleExportImage = () => {
    const canvas = document.querySelector('.circuit-canvas') as HTMLCanvasElement;
    if (canvas) {
      projectManager.exportAsImage(canvas, 'png');
    } else {
      alert('未找到画布元素');
    }
  };

  const handleDelete = async () => {
    if (!confirm(`确定删除项目"${name}"？此操作不可撤销。`)) return;
    await projectManager.deleteProject(projectId);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="ps-overlay" onClick={onClose}>
      <div className="ps-panel" onClick={(e) => e.stopPropagation()}>
        <div className="ps-header">
          <h3 className="ps-title">⚙️ 项目设置</h3>
          <button className="ps-close" onClick={onClose}>✕</button>
        </div>

        <div className="ps-body">
          {/* 基本信息 */}
          <div className="ps-section">
            <h4 className="ps-section-title">基本信息</h4>
            <div className="ps-field">
              <label>项目名称</label>
              <input
                type="text"
                className="ps-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="ps-field">
              <label>项目描述</label>
              <textarea
                className="ps-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="添加项目描述..."
              />
            </div>
            <button className="ps-btn ps-btn-primary" onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? '保存中...' : '💾 保存'}
            </button>
          </div>

          {/* 导出 */}
          <div className="ps-section">
            <h4 className="ps-section-title">导出</h4>
            <div className="ps-export-actions">
              <button className="ps-btn" onClick={handleExport}>
                📦 导出为 .chipsim
              </button>
              <button className="ps-btn" onClick={handleExportImage}>
                🖼️ 导出为图片
              </button>
            </div>
          </div>

          {/* 存储信息 */}
          {storageInfo && (
            <div className="ps-section">
              <h4 className="ps-section-title">存储信息</h4>
              <div className="ps-info-grid">
                <div className="ps-info-item">
                  <span className="ps-info-label">已用空间</span>
                  <span className="ps-info-value">{storageInfo.usedDisplay}</span>
                </div>
                <div className="ps-info-item">
                  <span className="ps-info-label">项目数量</span>
                  <span className="ps-info-value">{storageInfo.projectCount}</span>
                </div>
              </div>
            </div>
          )}

          {/* 危险操作 */}
          <div className="ps-section ps-section-danger">
            <h4 className="ps-section-title">危险操作</h4>
            <button className="ps-btn ps-btn-danger" onClick={handleDelete}>
              🗑️ 删除项目
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
