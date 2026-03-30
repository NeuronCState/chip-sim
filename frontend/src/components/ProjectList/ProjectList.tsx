/**
 * ProjectList - 项目列表页面
 * 支持最近项目、全部项目、新建、导入、搜索、标签、星标
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { projectManager } from '../../core/ProjectManager';
import type { ProjectIndexEntry } from '../../core/StorageManager';
import { loadFromLocalStorage, saveToLocalStorage } from '../../lib/circuit/serialization';
import { getAllTemplates, type ProjectTemplate } from '../../core/ProjectTemplates';
import './ProjectList.css';

const PROJECT_DATA_PREFIX = 'chip-sim-project-';

// ==================== 本地元数据辅助 ====================

interface ProjectLocalMeta {
  tags: string[];
  starred: boolean;
  description: string;
}

function getProjectLocalMeta(projectId: string): ProjectLocalMeta {
  const data = loadFromLocalStorage(`${PROJECT_DATA_PREFIX}${projectId}`);
  return {
    tags: data?.metadata?.tags ?? [],
    starred: data?.metadata?.starred ?? false,
    description: data?.metadata?.description ?? '',
  };
}

function setProjectStarred(projectId: string, starred: boolean): void {
  const data = loadFromLocalStorage(`${PROJECT_DATA_PREFIX}${projectId}`) || {};
  if (!data.metadata) data.metadata = { tags: [], description: '' };
  data.metadata.starred = starred;
  saveToLocalStorage(`${PROJECT_DATA_PREFIX}${projectId}`, data);
}

function setProjectTag(projectId: string, tag: string, add: boolean): void {
  const data = loadFromLocalStorage(`${PROJECT_DATA_PREFIX}${projectId}`) || {};
  if (!data.metadata) data.metadata = { tags: [], description: '' };
  if (!data.metadata.tags) data.metadata.tags = [];
  if (add && !data.metadata.tags.includes(tag)) {
    data.metadata.tags.push(tag);
  } else if (!add) {
    data.metadata.tags = data.metadata.tags.filter((t: string) => t !== tag);
  }
  saveToLocalStorage(`${PROJECT_DATA_PREFIX}${projectId}`, data);
}

function collectAllTags(projects: ProjectIndexEntry[]): string[] {
  const tagSet = new Set<string>();
  for (const p of projects) {
    const meta = getProjectLocalMeta(p.id);
    meta.tags.forEach((t) => tagSet.add(t));
  }
  return Array.from(tagSet).sort();
}

interface ProjectListProps {
  isOpen: boolean;
  onClose: () => void;
  /** 打开项目后的回调 */
  onProjectOpened?: (id: string) => void;
}

type TabView = 'recent' | 'all';

export function ProjectList({ isOpen, onClose, onProjectOpened }: ProjectListProps) {
  const [projects, setProjects] = useState<ProjectIndexEntry[]>([]);
  const [view, setView] = useState<TabView>('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [storageUsage, setStorageUsage] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [warnings, setWarnings] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [addingTagFor, setAddingTagFor] = useState<string | null>(null);
  const [, forceUpdate] = useState(0);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('blank');
  const [templateProjectName, setTemplateProjectName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载项目列表
  const loadProjects = useCallback(async () => {
    const list = projectManager.getProjects();
    setProjects(list);
    setAllTags(collectAllTags(list));

    // 异步获取存储空间
    try {
      const usage = await projectManager.getStorageInfo();
      setStorageUsage(usage.usedDisplay);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadProjects();
      setSelectedIds(new Set());
      setWarnings([]);
    }
  }, [isOpen, loadProjects]);

  useEffect(() => {
    if (showNewDialog && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showNewDialog]);

  // 创建新项目
  const handleCreate = async () => {
    if (!newProjectName.trim()) return;
    await projectManager.createProject({
      name: newProjectName.trim(),
      description: newProjectDesc.trim(),
    });
    const project = projectManager.getProjects()[0];
    if (project) {
      await projectManager.openProject(project.id);
      onProjectOpened?.(project.id);
    }
    setNewProjectName('');
    setNewProjectDesc('');
    setShowNewDialog(false);
    loadProjects();
    onClose();
  };

  // 从模板创建
  const handleOpenTemplateDialog = () => {
    setTemplates(getAllTemplates());
    setSelectedTemplateId('blank');
    setTemplateProjectName('');
    setShowTemplateDialog(true);
  };

  const handleCreateFromTemplate = async () => {
    if (!templateProjectName.trim()) return;
    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) return;

    await projectManager.createProject({
      name: templateProjectName.trim(),
      description: template.description,
      fromData: {
        components: template.data.components,
        nodes: template.data.nodes,
        wires: template.data.wires,
      },
    });
    const project = projectManager.getProjects()[0];
    if (project) {
      await projectManager.openProject(project.id);
      onProjectOpened?.(project.id);
    }
    setShowTemplateDialog(false);
    loadProjects();
    onClose();
  };

  // 打开项目
  const handleOpen = async (id: string) => {
    await projectManager.openProject(id);
    onProjectOpened?.(id);
    onClose();
  };

  // 删除项目
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定删除此项目？此操作不可撤销。')) return;
    await projectManager.deleteProject(id);
    loadProjects();
  };

  // 开始重命名
  const handleStartRename = (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditingName(currentName);
  };

  // 完成重命名
  const handleRename = async () => {
    if (editingId && editingName.trim()) {
      await projectManager.renameProject(editingId, editingName.trim());
      loadProjects();
    }
    setEditingId(null);
    setEditingName('');
  };

  // 导入项目
  const handleImport = async (file: File) => {
    try {
      const result = await projectManager.importProjectFromFile(file);
      if (result.warnings.length > 0) {
        setWarnings(result.warnings);
      }
      loadProjects();
      alert(`成功导入 ${result.count} 个项目`);
    } catch {
      alert('导入失败，请检查文件格式');
    }
  };

  // 拖拽导入（支持多文件）
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.name.endsWith('.chipsim') || f.name.endsWith('.json')
    );
    if (files.length === 0) return;
    const importAll = async () => {
      let total = 0;
      const allWarnings: string[] = [];
      for (const file of files) {
        try {
          const result = await projectManager.importProjectFromFile(file);
          total += result.count;
          allWarnings.push(...result.warnings);
        } catch {
          // 跳过格式错误的文件
        }
      }
      if (allWarnings.length > 0) setWarnings(allWarnings);
      loadProjects();
      if (total > 0) alert(`成功导入 ${total} 个项目`);
    };
    importAll();
  };

  // 切换单个项目选中
  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectedIds.size === displayProjects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayProjects.map((p) => p.id)));
    }
  };

  // 导出选中项目
  const handleExportSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await projectManager.exportSelectedProjects(ids);
    setSelectedIds(new Set());
  };

  // 过滤和排序（支持搜索、标签、星标）
  const filteredProjects = projects.filter((p) => {
    // 文本搜索
    const q = searchQuery.toLowerCase();
    if (q && !p.name.toLowerCase().includes(q) && !p.description?.toLowerCase().includes(q)) {
      return false;
    }
    // 标签筛选
    if (selectedTags.length > 0) {
      const meta = getProjectLocalMeta(p.id);
      if (!selectedTags.some((t) => meta.tags.includes(t))) return false;
    }
    // 星标筛选
    if (showStarredOnly) {
      const meta = getProjectLocalMeta(p.id);
      if (!meta.starred) return false;
    }
    return true;
  });

  const recentProjects = filteredProjects.slice(0, 8);
  const displayProjects = view === 'recent' ? recentProjects : filteredProjects;

  // 格式化时间
  const formatDate = (dateStr: string) => {
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
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  if (!isOpen) return null;

  return (
    <div className="pl-overlay" onClick={onClose}>
      <div
        className={`pl-panel ${dragOver ? 'pl-drag-over' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {/* 标题栏 */}
        <div className="pl-header">
          <h3 className="pl-title">📁 项目管理</h3>
          <div className="pl-header-right">
            {storageUsage && <span className="pl-storage">💾 {storageUsage}</span>}
            <button className="pl-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* 操作栏 */}
        <div className="pl-toolbar">
          <div className="pl-tabs">
            <button
              className={`pl-tab ${view === 'recent' ? 'pl-tab-active' : ''}`}
              onClick={() => setView('recent')}
            >
              🕐 最近项目
            </button>
            <button
              className={`pl-tab ${view === 'all' ? 'pl-tab-active' : ''}`}
              onClick={() => setView('all')}
            >
              📋 全部项目 ({projects.length})
            </button>
          </div>
          <div className="pl-actions">
            {displayProjects.length > 0 && (
              <button
                className={`pl-btn pl-btn-sm ${selectedIds.size === displayProjects.length && displayProjects.length > 0 ? 'pl-btn-active' : ''}`}
                onClick={handleSelectAll}
                title={selectedIds.size === displayProjects.length ? '取消全选' : '全选'}
              >
                {selectedIds.size === displayProjects.length && displayProjects.length > 0 ? '☑️' : '☐'} 全选
              </button>
            )}
            {selectedIds.size > 0 && (
              <button className="pl-btn pl-btn-sm pl-btn-primary" onClick={handleExportSelected}>
                📦 导出选中 ({selectedIds.size})
              </button>
            )}
            <input
              type="text"
              className="pl-search"
              placeholder="搜索项目..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
              className={`pl-btn pl-btn-sm ${showStarredOnly ? 'pl-btn-active' : ''}`}
              onClick={() => setShowStarredOnly(!showStarredOnly)}
              title={showStarredOnly ? '显示全部' : '仅显示星标'}
            >
              {showStarredOnly ? '⭐' : '☆'}
            </button>
            {allTags.length > 0 && (
              <select
                className="pl-tag-filter"
                value={selectedTags[0] || ''}
                onChange={(e) => {
                  const tag = e.target.value;
                  setSelectedTags(tag ? [tag] : []);
                }}
              >
                <option value="">所有标签</option>
                {allTags.map((tag) => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            )}
            <button className="pl-btn pl-btn-primary" onClick={() => setShowNewDialog(true)}>
              ➕ 新建
            </button>
            <button className="pl-btn" onClick={handleOpenTemplateDialog}>
              📋 从模板
            </button>
            <button className="pl-btn" onClick={() => fileInputRef.current?.click()}>
              📥 导入
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".chipsim,.json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImport(file);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        {/* 警告提示 */}
        {warnings.length > 0 && (
          <div className="pl-warnings">
            <div className="pl-warnings-header">
              <span>⚠️ 导入警告</span>
              <button className="pl-close" onClick={() => setWarnings([])}>✕</button>
            </div>
            <ul className="pl-warnings-list">
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}

        {/* 新建对话框 */}
        {showNewDialog && (
          <div className="pl-new-dialog">
            <div className="pl-new-field">
              <label>项目名称</label>
              <input
                ref={inputRef}
                type="text"
                className="pl-input"
                placeholder="我的电路项目"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') { setShowNewDialog(false); setNewProjectName(''); }
                }}
              />
            </div>
            <div className="pl-new-field">
              <label>描述（可选）</label>
              <textarea
                className="pl-textarea"
                placeholder="项目描述..."
                value={newProjectDesc}
                onChange={(e) => setNewProjectDesc(e.target.value)}
                rows={2}
              />
            </div>
            <div className="pl-new-actions">
              <button className="pl-btn" onClick={() => { setShowNewDialog(false); setNewProjectName(''); setNewProjectDesc(''); }}>取消</button>
              <button className="pl-btn pl-btn-primary" onClick={handleCreate} disabled={!newProjectName.trim()}>创建</button>
            </div>
          </div>
        )}

        {/* 模板选择对话框 */}
        {showTemplateDialog && (
          <div className="pl-new-dialog">
            <div className="pl-new-field">
              <label>选择模板</label>
              <div className="pl-template-grid">
                {templates.map(t => (
                  <div
                    key={t.id}
                    className={`pl-template-card ${selectedTemplateId === t.id ? 'pl-template-card-active' : ''}`}
                    onClick={() => setSelectedTemplateId(t.id)}
                  >
                    <span className="pl-template-icon">{t.icon}</span>
                    <span className="pl-template-name">{t.name}</span>
                    <span className="pl-template-desc">{t.description}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="pl-new-field">
              <label>项目名称</label>
              <input
                type="text"
                className="pl-input"
                placeholder="我的电路项目"
                value={templateProjectName}
                onChange={(e) => setTemplateProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFromTemplate();
                  if (e.key === 'Escape') setShowTemplateDialog(false);
                }}
                autoFocus
              />
            </div>
            <div className="pl-new-actions">
              <button className="pl-btn" onClick={() => setShowTemplateDialog(false)}>取消</button>
              <button className="pl-btn pl-btn-primary" onClick={handleCreateFromTemplate} disabled={!templateProjectName.trim()}>创建</button>
            </div>
          </div>
        )}

        {/* 项目列表 */}
        <div className="pl-list">
          {displayProjects.length === 0 ? (
            <div className="pl-empty">
              {searchQuery ? (
                <p>🔍 没有匹配的项目</p>
              ) : (
                <>
                  <p>📭 暂无项目</p>
                  <p className="pl-empty-hint">点击"新建"创建第一个项目，或拖拽 .chipsim 文件到此处导入</p>
                </>
              )}
            </div>
          ) : (
            displayProjects.map((project) => (
              <div
                key={project.id}
                className={`pl-item ${selectedIds.has(project.id) ? 'pl-item-selected' : ''}`}
                onClick={() => handleOpen(project.id)}
              >
                <div
                  className="pl-item-checkbox"
                  onClick={(e) => handleToggleSelect(project.id, e)}
                  title={selectedIds.has(project.id) ? '取消选中' : '选中'}
                >
                  {selectedIds.has(project.id) ? '☑️' : '☐'}
                </div>
                <div className="pl-item-icon">📄</div>
                <div className="pl-item-content">
                  {editingId === project.id ? (
                    <div className="pl-item-rename">
                      <input
                        type="text"
                        className="pl-input pl-input-sm"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename();
                          if (e.key === 'Escape') { setEditingId(null); setEditingName(''); }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <>
                      <div className="pl-item-name">
                        {project.name}
                      </div>
                      {project.description && (
                        <div className="pl-item-desc">{project.description}</div>
                      )}
                      <div className="pl-item-meta">
                        <span>📦 {project.componentCount} 元件</span>
                        <span>🔗 {project.wireCount} 连线</span>
                        <span>🕐 {formatDate(project.updatedAt)}</span>
                      </div>
                      {(() => {
                        const meta = getProjectLocalMeta(project.id);
                        return meta.tags.length > 0 ? (
                          <div className="pl-item-tags">
                            {meta.tags.map((tag) => (
                              <span key={tag} className="pl-tag-chip">
                                {tag}
                                <button
                                  className="pl-tag-remove"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setProjectTag(project.id, tag, false);
                                    setAllTags(collectAllTags(projects));
                                    forceUpdate((k) => k + 1);
                                  }}
                                >×</button>
                              </span>
                            ))}
                          </div>
                        ) : null;
                      })()}
                    </>
                  )}
                </div>
                <div className="pl-item-actions">
                  {(() => {
                    const meta = getProjectLocalMeta(project.id);
                    return (
                      <button
                        className="pl-icon-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setProjectStarred(project.id, !meta.starred);
                          forceUpdate((k) => k + 1);
                        }}
                        title={meta.starred ? '取消星标' : '添加星标'}
                      >
                        {meta.starred ? '⭐' : '☆'}
                      </button>
                    );
                  })()}
                  <button
                    className="pl-icon-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      // 复制项目
                      const duplicateProject = async () => {
                        const srcProject = await projectManager.openProject(project.id);
                        if (!srcProject) return;
                        await projectManager.createProject({
                          name: `${project.name} (副本)`,
                          description: project.description,
                          fromData: {
                            components: srcProject.components,
                            nodes: srcProject.nodes,
                            wires: srcProject.wires,
                          },
                        });
                        loadProjects();
                      };
                      duplicateProject();
                    }}
                    title="复制项目"
                  >
                    📋
                  </button>
                  <button
                    className="pl-icon-btn"
                    onClick={(e) => handleStartRename(project.id, project.name, e)}
                    title="重命名"
                  >
                    ✏️
                  </button>
                  <button
                    className="pl-icon-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAddingTagFor(addingTagFor === project.id ? null : project.id);
                    }}
                    title="添加标签"
                  >
                    🏷️
                  </button>
                  <button
                    className="pl-icon-btn pl-icon-btn-danger"
                    onClick={(e) => handleDelete(project.id, e)}
                    title="删除"
                  >
                    🗑️
                  </button>
                </div>
                {/* 标签输入内联 */}
                {addingTagFor === project.id && (
                  <div className="pl-tag-input-inline" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      className="pl-input pl-input-xs"
                      placeholder="输入标签名称..."
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newTagInput.trim()) {
                          setProjectTag(project.id, newTagInput.trim(), true);
                          setAllTags(collectAllTags(projects));
                          setNewTagInput('');
                          setAddingTagFor(null);
                          forceUpdate((k) => k + 1);
                        }
                        if (e.key === 'Escape') {
                          setNewTagInput('');
                          setAddingTagFor(null);
                        }
                      }}
                      autoFocus
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* 拖拽提示 */}
        {dragOver && (
          <div className="pl-drop-zone">
            <span>📥 释放文件以导入项目</span>
          </div>
        )}

        {/* 底部 */}
        <div className="pl-footer">
          <span>共 {projects.length} 个项目</span>
          <button className="pl-btn pl-btn-sm" onClick={() => projectManager.exportAllProjects()}>
            📦 导出全部
          </button>
        </div>
      </div>
    </div>
  );
}
