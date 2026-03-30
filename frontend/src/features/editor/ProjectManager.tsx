/**
 * 工程管理面板组件
 * 提供工程列表、新建、打开、删除、重命名功能
 */

import { useState, useEffect, useRef } from 'react';
import { useCircuitStore } from '../../stores/circuit-store';
import { loadFromLocalStorage } from '../../lib/circuit/serialization';
import './ProjectManager.css';

const PROJECT_DATA_PREFIX = 'chip-sim-project-';

interface ProjectManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProjectManager({ isOpen, onClose }: ProjectManagerProps) {
  const projects = useCircuitStore((s) => s.projects);
  const currentProjectId = useCircuitStore((s) => s.currentProjectId);
  const listProjects = useCircuitStore((s) => s.listProjects);
  const createProject = useCircuitStore((s) => s.createProject);
  const openProject = useCircuitStore((s) => s.openProject);
  const deleteProject = useCircuitStore((s) => s.deleteProject);
  const renameProject = useCircuitStore((s) => s.renameProject);
  const duplicateProject = useCircuitStore((s) => s.duplicateProject);
  const toggleStar = useCircuitStore((s) => s.toggleStar);

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 加载工程列表
  useEffect(() => {
    if (isOpen) {
      listProjects();
    }
  }, [isOpen, listProjects]);

  // 自动聚焦输入框
  useEffect(() => {
    if (showNewDialog && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showNewDialog]);

  const handleCreate = () => {
    if (newProjectName.trim()) {
      createProject(newProjectName.trim());
      setNewProjectName('');
      setShowNewDialog(false);
      listProjects(); // 刷新列表
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreate();
    } else if (e.key === 'Escape') {
      setShowNewDialog(false);
      setNewProjectName('');
    }
  };

  const handleStartRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
  };

  const handleRename = () => {
    if (editingId && editingName.trim()) {
      renameProject(editingId, editingName.trim());
      listProjects(); // 刷新列表
    }
    setEditingId(null);
    setEditingName('');
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditingName('');
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return '刚刚';
      if (diffMins < 60) return `${diffMins} 分钟前`;
      if (diffHours < 24) return `${diffHours} 小时前`;
      if (diffDays < 7) return `${diffDays} 天前`;
      
      return date.toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="project-manager-overlay" onClick={onClose}>
      <div className="project-manager-panel" onClick={(e) => e.stopPropagation()}>
        {/* 标题栏 */}
        <div className="pm-header">
          <h3 className="pm-title">📁 工程管理</h3>
          <button className="pm-close" onClick={onClose} title="关闭">
            ✕
          </button>
        </div>

        {/* 新建工程按钮 */}
        <div className="pm-actions">
          <button
            className="pm-btn pm-btn-primary"
            onClick={() => setShowNewDialog(true)}
          >
            ➕ 新建工程
          </button>
        </div>

        {/* 新建工程对话框 */}
        {showNewDialog && (
          <div className="pm-new-dialog">
            <input
              ref={inputRef}
              type="text"
              className="pm-input"
              placeholder="输入工程名称..."
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div className="pm-dialog-actions">
              <button
                className="pm-btn pm-btn-small"
                onClick={() => {
                  setShowNewDialog(false);
                  setNewProjectName('');
                }}
              >
                取消
              </button>
              <button
                className="pm-btn pm-btn-primary pm-btn-small"
                onClick={handleCreate}
                disabled={!newProjectName.trim()}
              >
                创建
              </button>
            </div>
          </div>
        )}

        {/* 工程列表 */}
        <div className="pm-list">
          {projects.length === 0 ? (
            <div className="pm-empty">
              <p>📭 暂无工程</p>
              <p className="pm-empty-hint">点击上方按钮创建第一个工程</p>
            </div>
          ) : (
            projects.map((project) => (
              <div
                key={project.id}
                className={`pm-item ${project.id === currentProjectId ? 'pm-item-active' : ''}`}
              >
                {editingId === project.id ? (
                  // 重命名模式
                  <div className="pm-item-rename">
                    <input
                      type="text"
                      className="pm-input pm-input-small"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={handleRenameKeyDown}
                      autoFocus
                    />
                    <div className="pm-rename-actions">
                      <button
                        className="pm-btn pm-btn-tiny"
                        onClick={() => {
                          setEditingId(null);
                          setEditingName('');
                        }}
                      >
                        ✕
                      </button>
                      <button
                        className="pm-btn pm-btn-tiny pm-btn-primary"
                        onClick={handleRename}
                        disabled={!editingName.trim()}
                      >
                        ✓
                      </button>
                    </div>
                  </div>
                ) : (
                  // 正常显示模式
                  <>
                    <div className="pm-item-info" onClick={() => openProject(project.id)}>
                      <div className="pm-item-name">
                        {project.id === currentProjectId && <span className="pm-current-badge">当前</span>}
                        {project.name}
                      </div>
                      <div className="pm-item-meta">
                        <span className="pm-item-count">{project.componentCount} 元件</span>
                        <span className="pm-item-time">🕐 {formatDate(project.updatedAt)}</span>
                      </div>
                    </div>
                    <div className="pm-item-actions">
                      <button
                        className="pm-btn pm-btn-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStar(project.id);
                          listProjects(); // 刷新列表
                        }}
                        title={(() => {
                          const data = loadFromLocalStorage(`${PROJECT_DATA_PREFIX}${project.id}`);
                          return data?.metadata?.starred ? '取消星标' : '添加星标';
                        })()}
                      >
                        {(() => {
                          const data = loadFromLocalStorage(`${PROJECT_DATA_PREFIX}${project.id}`);
                          return data?.metadata?.starred ? '⭐' : '☆';
                        })()}
                      </button>
                      <button
                        className="pm-btn pm-btn-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateProject(project.id);
                          listProjects(); // 刷新列表
                        }}
                        title="复制项目"
                      >
                        📋
                      </button>
                      <button
                        className="pm-btn pm-btn-icon"
                        onClick={() => handleStartRename(project.id, project.name)}
                        title="重命名"
                      >
                        ✏️
                      </button>
                      <button
                        className="pm-btn pm-btn-icon pm-btn-danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteProject(project.id);
                          listProjects(); // 刷新列表
                        }}
                        title="删除"
                      >
                        🗑️
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* 底部提示 */}
        <div className="pm-footer">
          <span className="pm-hint">共 {projects.length} 个工程</span>
        </div>
      </div>
    </div>
  );
}