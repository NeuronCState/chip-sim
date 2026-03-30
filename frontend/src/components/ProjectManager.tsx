/**
 * 项目管理面板组件
 * 项目列表卡片视图、新建/重命名/删除、搜索筛选、缩略图预览
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ProjectSummary, ProjectQuery, SortField, SortOrder } from '../types/project';
import { projectStorage } from '../lib/projectStorage';
import { exportProject, importProjectPicker } from '../lib/projectIO';
import './ProjectManager.css';

// ==================== Props ====================

interface ProjectManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenProject: (projectId: string) => void;
  onCreateProject: (name: string, description?: string) => void;
  onDeleteProject: (projectId: string) => void;
  currentProjectId: string | null;
}

// ==================== 组件 ====================

export function ProjectManager({
  isOpen,
  onClose,
  onOpenProject,
  onCreateProject,
  onDeleteProject,
  currentProjectId,
}: ProjectManagerProps) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showStarred, setShowStarred] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [loading, setLoading] = useState(false);
  const [storageInfo, setStorageInfo] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // ==================== 数据加载 ====================

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const query: ProjectQuery = {
        search: search || undefined,
        sortBy,
        sortOrder,
        starred: showStarred || undefined,
      };
      const list = await projectStorage.listProjects(query);
      setProjects(list);

      const usage = await projectStorage.getStorageUsage();
      setStorageInfo(`${usage.projectCount} 个项目 · ${usage.display}`);
    } catch (err) {
      console.error('加载项目列表失败:', err);
    } finally {
      setLoading(false);
    }
  }, [search, sortBy, sortOrder, showStarred]);

  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen, loadProjects]);

  // 自动聚焦
  useEffect(() => {
    if (showNewDialog && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showNewDialog]);

  // ==================== 操作 ====================

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreateProject(newName.trim(), newDesc.trim() || undefined);
    setNewName('');
    setNewDesc('');
    setShowNewDialog(false);
    // 延迟刷新列表
    setTimeout(loadProjects, 200);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定删除项目"${name}"？此操作不可撤销。`)) return;
    onDeleteProject(id);
    setTimeout(loadProjects, 200);
  };

  const handleRename = async (id: string) => {
    if (!editingName.trim()) return;
    try {
      await projectStorage.renameProject(id, editingName.trim());
      setEditingId(null);
      setEditingName('');
      loadProjects();
    } catch (err) {
      console.error('重命名失败:', err);
    }
  };

  const handleExport = (project: ProjectSummary) => {
    projectStorage.getProject(project.id).then(full => {
      if (full) exportProject(full);
    });
  };

  const handleImport = async () => {
    const result = await importProjectPicker();
    if (result.success) {
      loadProjects();
    } else {
      alert(`导入失败: ${result.error}`);
    }
  };

  const handleToggleStar = async (id: string, currentStarred: boolean) => {
    try {
      await projectStorage.updateMetadata(id, { starred: !currentStarred });
      loadProjects();
    } catch (err) {
      console.error('收藏操作失败:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreate();
    else if (e.key === 'Escape') {
      setShowNewDialog(false);
      setNewName('');
      setNewDesc('');
    }
  };

  // ==================== 工具函数 ====================

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

  const getThumbnailStyle = (project: ProjectSummary): React.CSSProperties => {
    if (project.metadata.thumbnail) {
      return { backgroundImage: `url(${project.metadata.thumbnail})` };
    }
    return {};
  };

  const getAccentColor = (project: ProjectSummary): string => {
    if (project.metadata.color) return project.metadata.color;
    // 根据元件数量生成柔和颜色
    const hue = (project.componentCount * 37) % 360;
    return `hsl(${hue}, 45%, 50%)`;
  };

  if (!isOpen) return null;

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm-container" onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <div className="pm-header">
          <h2 className="pm-title">📁 项目管理</h2>
          <div className="pm-header-actions">
            <button className="pm-btn pm-btn-ghost" onClick={handleImport} title="导入项目">
              📥 导入
            </button>
            <button className="pm-btn pm-btn-primary" onClick={() => setShowNewDialog(true)}>
              ➕ 新建项目
            </button>
            <button className="pm-close-btn" onClick={onClose} title="关闭">✕</button>
          </div>
        </div>

        {/* 搜索和筛选栏 */}
        <div className="pm-toolbar">
          <div className="pm-search-box">
            <span className="pm-search-icon">🔍</span>
            <input
              type="text"
              className="pm-search-input"
              placeholder="搜索项目名称、描述、标签..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="pm-search-clear" onClick={() => setSearch('')}>✕</button>
            )}
          </div>

          <div className="pm-filters">
            <button
              className={`pm-filter-btn ${showStarred ? 'active' : ''}`}
              onClick={() => setShowStarred(!showStarred)}
              title="仅显示收藏"
            >
              {showStarred ? '⭐' : '☆'} 收藏
            </button>

            <select
              className="pm-sort-select"
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field as SortField);
                setSortOrder(order as SortOrder);
              }}
            >
              <option value="updatedAt-desc">最近修改</option>
              <option value="updatedAt-asc">最早修改</option>
              <option value="createdAt-desc">最近创建</option>
              <option value="createdAt-asc">最早创建</option>
              <option value="name-asc">名称 A-Z</option>
              <option value="name-desc">名称 Z-A</option>
              <option value="componentCount-desc">元件最多</option>
              <option value="componentCount-asc">元件最少</option>
            </select>
          </div>
        </div>

        {/* 新建对话框 */}
        {showNewDialog && (
          <div className="pm-new-dialog">
            <div className="pm-new-form">
              <input
                ref={inputRef}
                type="text"
                className="pm-input"
                placeholder="项目名称"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <input
                type="text"
                className="pm-input pm-input-desc"
                placeholder="项目描述（可选）"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <div className="pm-new-actions">
                <button className="pm-btn" onClick={() => { setShowNewDialog(false); setNewName(''); setNewDesc(''); }}>
                  取消
                </button>
                <button
                  className="pm-btn pm-btn-primary"
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                >
                  创建
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 项目卡片列表 */}
        <div className="pm-grid">
          {loading ? (
            <div className="pm-loading">加载中...</div>
          ) : projects.length === 0 ? (
            <div className="pm-empty">
              <div className="pm-empty-icon">📭</div>
              <p className="pm-empty-text">
                {search ? '没有匹配的项目' : '还没有项目'}
              </p>
              {!search && (
                <button className="pm-btn pm-btn-primary" onClick={() => setShowNewDialog(true)}>
                  创建第一个项目
                </button>
              )}
            </div>
          ) : (
            projects.map((project) => (
              <div
                key={project.id}
                className={`pm-card ${project.id === currentProjectId ? 'pm-card-active' : ''}`}
                style={{ borderLeftColor: getAccentColor(project) }}
              >
                {/* 缩略图区域 */}
                <div
                  className="pm-card-thumb"
                  style={getThumbnailStyle(project)}
                >
                  {!project.metadata.thumbnail && (
                    <div className="pm-card-thumb-placeholder">
                      <span className="pm-card-component-icon">⚡</span>
                      <span className="pm-card-component-count">
                        {project.componentCount}
                      </span>
                    </div>
                  )}
                  {project.id === currentProjectId && (
                    <span className="pm-card-badge">当前</span>
                  )}
                  <button
                    className="pm-card-star"
                    onClick={(e) => { e.stopPropagation(); handleToggleStar(project.id, !!project.metadata.starred); }}
                    title={project.metadata.starred ? '取消收藏' : '收藏'}
                  >
                    {project.metadata.starred ? '⭐' : '☆'}
                  </button>
                </div>

                {/* 信息区域 */}
                <div className="pm-card-body" onClick={() => onOpenProject(project.id)}>
                  {editingId === project.id ? (
                    <div className="pm-card-rename" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        className="pm-input pm-input-small"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(project.id);
                          if (e.key === 'Escape') { setEditingId(null); setEditingName(''); }
                        }}
                        autoFocus
                      />
                      <div className="pm-rename-btns">
                        <button className="pm-btn pm-btn-tiny" onClick={() => { setEditingId(null); setEditingName(''); }}>✕</button>
                        <button className="pm-btn pm-btn-tiny pm-btn-primary" onClick={() => handleRename(project.id)}>✓</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="pm-card-name">{project.name}</div>
                      {project.description && (
                        <div className="pm-card-desc">{project.description}</div>
                      )}
                      <div className="pm-card-meta">
                        <span>📦 {project.componentCount} 元件</span>
                        <span>🔗 {project.wireCount} 连线</span>
                        <span>🕐 {formatDate(project.updatedAt)}</span>
                      </div>
                      {project.metadata.tags.length > 0 && (
                        <div className="pm-card-tags">
                          {project.metadata.tags.map((tag) => (
                            <span key={tag} className="pm-tag">{tag}</span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* 操作按钮 */}
                {editingId !== project.id && (
                  <div className="pm-card-actions">
                    <button
                      className="pm-action-btn"
                      onClick={(e) => { e.stopPropagation(); setEditingId(project.id); setEditingName(project.name); }}
                      title="重命名"
                    >✏️</button>
                    <button
                      className="pm-action-btn"
                      onClick={(e) => { e.stopPropagation(); handleExport(project); }}
                      title="导出"
                    >📤</button>
                    <button
                      className="pm-action-btn pm-action-danger"
                      onClick={(e) => { e.stopPropagation(); handleDelete(project.id, project.name); }}
                      title="删除"
                    >🗑️</button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* 底部状态栏 */}
        <div className="pm-footer">
          <span className="pm-storage-info">{storageInfo}</span>
        </div>
      </div>
    </div>
  );
}

export default ProjectManager;
