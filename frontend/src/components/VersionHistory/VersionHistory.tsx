/**
 * 版本历史面板 - 时间线形式展示所有版本
 * 支持预览、恢复、标签编辑、删除和 Diff 比较模式
 */

import { useState, useEffect, useCallback } from 'react';
import { useVersionStore } from '../../stores/version-store';
import { useCircuitStore } from '../../stores/circuit-store';
import type { VersionSnapshot } from '../../types/version';
import { toast } from '../../stores/ui-store';
import './VersionHistory.css';

interface VersionHistoryProps {
  onClose?: () => void;
}

/** 格式化时间 */
function formatTime(isoString: string): string {
  const d = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHr < 24) return `${diffHr} 小时前`;
  if (diffDay < 7) return `${diffDay} 天前`;

  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 触发方式图标 */
function triggerIcon(trigger: string): string {
  switch (trigger) {
    case 'manual': return '💾';
    case 'pre_simulation': return '⚙️';
    case 'pre_close': return '🔒';
    case 'auto': return '🤖';
    default: return '📌';
  }
}

/** 触发方式标签 */
function triggerLabel(trigger: string): string {
  switch (trigger) {
    case 'manual': return '手动保存';
    case 'pre_simulation': return '仿真前';
    case 'pre_close': return '关闭前';
    case 'auto': return '自动';
    default: return '未知';
  }
}

export function VersionHistory({ onClose }: VersionHistoryProps) {
  const {
    versions,
    isLoading,
    showVersionPanel,
    previewVersionId,
    diffFromId,
    diffToId,
    loadVersions,
    createSnapshot,
    restoreVersion,
    deleteVersion,
    updateVersionMeta,
    setPreviewVersion,
    setDiffVersions,
    compareVersions,
    exportVersion,
    toggleVersionPanel,
  } = useVersionStore();

  const {
    components,
    nodes,
    wires,
    currentProjectId,
  } = useCircuitStore();

  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [showDiffMode, setShowDiffMode] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // 加载版本列表
  useEffect(() => {
    if (currentProjectId && showVersionPanel) {
      loadVersions(currentProjectId);
    }
  }, [currentProjectId, showVersionPanel, loadVersions]);

  // 创建手动快照
  const handleCreateSnapshot = useCallback(async () => {
    if (!currentProjectId) {
      toast.error('请先打开或创建一个项目');
      return;
    }
    const label = prompt('版本标签（可选）:', `v${versions.length + 1}`);
    if (label === null) return; // 用户取消

    const description = prompt('版本描述（可选）:', '手动保存');
    if (description === null) return;

    const result = await createSnapshot(currentProjectId, {
      components,
      nodes,
      wires,
    }, {
      label: label || `v${versions.length + 1}`,
      description: description || '手动保存',
      trigger: 'manual' as any,
    });

    if (result) {
      toast.success(`版本 "${result.label}" 已创建`);
    }
  }, [currentProjectId, components, nodes, wires, versions.length, createSnapshot]);

  // 恢复版本
  const handleRestore = useCallback(async (versionId: string) => {
    const data = await restoreVersion(versionId);
    if (data) {
      // 更新电路 store
      useCircuitStore.setState({
        components: data.components,
        nodes: data.nodes,
        wires: data.wires,
        selectedComponentId: null,
        selectedWireId: null,
        selectedComponentIds: new Set(),
      });
      toast.success('已恢复到选中版本');
    }
  }, [restoreVersion]);

  // 编辑版本元数据
  const handleStartEdit = useCallback((version: VersionSnapshot) => {
    setEditingVersionId(version.id);
    setEditLabel(version.label);
    setEditDesc(version.description);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingVersionId) return;
    await updateVersionMeta(editingVersionId, {
      label: editLabel,
      description: editDesc,
    });
    setEditingVersionId(null);
    toast.success('版本信息已更新');
  }, [editingVersionId, editLabel, editDesc, updateVersionMeta]);

  // 删除版本
  const handleDelete = useCallback(async (versionId: string) => {
    await deleteVersion(versionId);
    setConfirmDelete(null);
    toast.success('版本已删除');
  }, [deleteVersion]);

  // Diff 比较
  const handleStartDiff = useCallback(() => {
    setShowDiffMode(true);
    setDiffVersions(null, null);
  }, [setDiffVersions]);

  const handleDiffSelect = useCallback(async (versionId: string) => {
    if (!diffFromId) {
      setDiffVersions(versionId, null);
    } else if (!diffToId && versionId !== diffFromId) {
      setDiffVersions(diffFromId, versionId);
      await compareVersions(diffFromId, versionId);
      setShowDiffMode(false);
    }
  }, [diffFromId, diffToId, setDiffVersions, compareVersions]);

  const handleCancelDiff = useCallback(() => {
    setShowDiffMode(false);
    setDiffVersions(null, null);
  }, [setDiffVersions]);

  // 渲染变更摘要
  const renderChangeBadge = (version: VersionSnapshot) => {
    if (!version.changeSummary) return null;
    const s = version.changeSummary;
    const hasChanges =
      s.componentsAdded + s.componentsRemoved + s.componentsModified +
      s.componentsMoved + s.wiresAdded + s.wiresRemoved > 0;
    if (!hasChanges) return <span className="vh-change-badge vh-no-change">无变更</span>;

    return (
      <div className="vh-change-badges">
        {s.componentsAdded > 0 && (
          <span className="vh-badge vh-badge-added">+{s.componentsAdded} 元件</span>
        )}
        {s.componentsRemoved > 0 && (
          <span className="vh-badge vh-badge-removed">-{s.componentsRemoved} 元件</span>
        )}
        {s.componentsModified > 0 && (
          <span className="vh-badge vh-badge-modified">~{s.componentsModified} 修改</span>
        )}
        {s.componentsMoved > 0 && (
          <span className="vh-badge vh-badge-moved">↗{s.componentsMoved} 移动</span>
        )}
        {s.wiresAdded > 0 && (
          <span className="vh-badge vh-badge-added">+{s.wiresAdded} 连线</span>
        )}
        {s.wiresRemoved > 0 && (
          <span className="vh-badge vh-badge-removed">-{s.wiresRemoved} 连线</span>
        )}
      </div>
    );
  };

  if (!showVersionPanel) return null;

  return (
    <div className="version-history-panel">
      {/* 头部 */}
      <div className="vh-header">
        <h3 className="vh-title">📜 版本历史</h3>
        <div className="vh-header-actions">
          {!showDiffMode && (
            <button
              className="vh-btn vh-btn-diff"
              onClick={handleStartDiff}
              disabled={versions.length < 2}
              title="比较两个版本的差异"
            >
              🔍 比较
            </button>
          )}
          {showDiffMode && (
            <button className="vh-btn vh-btn-cancel" onClick={handleCancelDiff}>
              ✕ 取消比较
            </button>
          )}
          <button className="vh-btn vh-btn-close" onClick={onClose ?? toggleVersionPanel}>
            ✕
          </button>
        </div>
      </div>

      {/* 比较模式提示 */}
      {showDiffMode && (
        <div className="vh-diff-hint">
          {!diffFromId && '👆 请选择第一个版本（旧版本）'}
          {diffFromId && !diffToId && '👆 请选择第二个版本（新版本）'}
        </div>
      )}

      {/* 创建快照按钮 */}
      <div className="vh-actions">
        <button
          className="vh-btn vh-btn-primary"
          onClick={handleCreateSnapshot}
          disabled={isLoading || !currentProjectId}
        >
          💾 保存版本
        </button>
        <button
          className="vh-btn vh-btn-refresh"
          onClick={() => currentProjectId && loadVersions(currentProjectId)}
          disabled={isLoading || !currentProjectId}
        >
          🔄 刷新
        </button>
      </div>

      {/* 版本列表 */}
      <div className="vh-timeline">
        {isLoading && (
          <div className="vh-loading">
            <div className="vh-spinner" />
            <span>加载中...</span>
          </div>
        )}

        {!isLoading && versions.length === 0 && (
          <div className="vh-empty">
            <span className="vh-empty-icon">📭</span>
            <p>暂无版本记录</p>
            <p className="vh-empty-hint">点击"保存版本"创建第一个快照</p>
          </div>
        )}

        {versions.map((version, index) => {
          const isPreview = previewVersionId === version.id;
          const isDiffFrom = diffFromId === version.id;
          const isDiffTo = diffToId === version.id;
          const isEditing = editingVersionId === version.id;
          const isFirst = index === 0;

          return (
            <div
              key={version.id}
              className={`vh-version-item ${isPreview ? 'vh-preview' : ''} ${isDiffFrom ? 'vh-diff-from' : ''} ${isDiffTo ? 'vh-diff-to' : ''} ${showDiffMode ? 'vh-diff-selectable' : ''}`}
              onClick={() => showDiffMode && handleDiffSelect(version.id)}
            >
              {/* 时间线连接线 */}
              <div className="vh-timeline-line">
                <div className={`vh-timeline-dot ${isFirst ? 'vh-dot-latest' : ''}`} />
                {index < versions.length - 1 && <div className="vh-timeline-connector" />}
              </div>

              {/* 版本内容 */}
              <div className="vh-version-content">
                {/* 标签行 */}
                <div className="vh-version-header">
                  {isEditing ? (
                    <input
                      className="vh-edit-input vh-edit-label"
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      onBlur={handleSaveEdit}
                      onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                      autoFocus
                      placeholder="版本标签"
                    />
                  ) : (
                    <span
                      className="vh-version-label"
                      onDoubleClick={() => handleStartEdit(version)}
                      title="双击编辑标签"
                    >
                      {version.label}
                    </span>
                  )}
                  <span className="vh-version-trigger" title={triggerLabel(version.trigger)}>
                    {triggerIcon(version.trigger)}
                  </span>
                  {isFirst && <span className="vh-badge vh-badge-latest">最新</span>}
                </div>

                {/* 时间 */}
                <div className="vh-version-time">
                  {formatTime(version.createdAt)}
                  <span className="vh-version-seq">#{version.sequenceNumber}</span>
                </div>

                {/* 描述 */}
                {isEditing ? (
                  <textarea
                    className="vh-edit-input vh-edit-desc"
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    placeholder="版本描述"
                    rows={2}
                  />
                ) : (
                  <div className="vh-version-desc" title={version.description}>
                    {version.description || '无描述'}
                  </div>
                )}

                {/* 变更摘要 */}
                {renderChangeBadge(version)}

                {/* 缩略图 */}
                {version.thumbnail && (
                  <img
                    className="vh-thumbnail"
                    src={version.thumbnail}
                    alt={`版本 ${version.label} 缩略图`}
                  />
                )}

                {/* 操作按钮 */}
                {!showDiffMode && !isEditing && (
                  <div className="vh-version-actions">
                    <button
                      className="vh-action-btn vh-action-preview"
                      onClick={() => setPreviewVersion(isPreview ? null : version.id)}
                      title={isPreview ? '退出预览' : '预览此版本'}
                    >
                      {isPreview ? '✕ 退出' : '👁 预览'}
                    </button>
                    <button
                      className="vh-action-btn vh-action-restore"
                      onClick={() => handleRestore(version.id)}
                      title="恢复到此版本"
                    >
                      ↩ 恢复
                    </button>
                    <button
                      className="vh-action-btn vh-action-edit"
                      onClick={() => handleStartEdit(version)}
                      title="编辑标签和描述"
                    >
                      ✏️
                    </button>
                    <button
                      className="vh-action-btn vh-action-export"
                      onClick={() => exportVersion(version.id)}
                      title="导出此版本的电路"
                    >
                      📤
                    </button>
                    {!isFirst && (
                      <button
                        className="vh-action-btn vh-action-delete"
                        onClick={() => setConfirmDelete(version.id)}
                        title="删除此版本"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                )}

                {/* 编辑模式保存/取消 */}
                {isEditing && (
                  <div className="vh-version-actions">
                    <button className="vh-action-btn vh-action-save" onClick={handleSaveEdit}>
                      ✅ 保存
                    </button>
                    <button className="vh-action-btn" onClick={() => setEditingVersionId(null)}>
                      ✕ 取消
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 删除确认对话框 */}
      {confirmDelete && (
        <div className="vh-confirm-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="vh-confirm-dialog" onClick={e => e.stopPropagation()}>
            <p>确定要删除此版本吗？</p>
            <p className="vh-confirm-hint">此操作不可撤销</p>
            <div className="vh-confirm-actions">
              <button className="vh-btn vh-btn-danger" onClick={() => handleDelete(confirmDelete)}>
                🗑️ 确认删除
              </button>
              <button className="vh-btn" onClick={() => setConfirmDelete(null)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VersionHistory;
