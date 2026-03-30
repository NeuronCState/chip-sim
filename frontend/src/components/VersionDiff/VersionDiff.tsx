/**
 * 版本差异比较组件
 * 可视化展示两个版本之间的差异
 * 高亮新增（绿色）、删除（红色）、修改（黄色）的元件
 */

import { useMemo } from 'react';
import { useVersionStore } from '../../stores/version-store';
import { ChangeType } from '../../types/version';
import type { ComponentChange, WireChange } from '../../types/version';
import './VersionDiff.css';

interface VersionDiffProps {
  onClose?: () => void;
}

/** 格式化元件信息 */
function formatComponentInfo(change: ComponentChange): string {
  const comp = change.after || change.before;
  if (!comp) return '';
  return `${comp.name} (${comp.type})`;
}

/** 格式化连线信息 */
function formatWireInfo(change: WireChange): string {
  if (change.before) {
    return `${change.before.fromComponentId.slice(0, 6)}→${change.before.toComponentId.slice(0, 6)}`;
  }
  if (change.after) {
    return `${change.after.fromComponentId.slice(0, 6)}→${change.after.toComponentId.slice(0, 6)}`;
  }
  return change.wireId.slice(0, 8);
}

export function VersionDiff({ onClose }: VersionDiffProps) {
  const {
    diffResult,
    diffFromId,
    diffToId,
    versions,
    clearDiff,
  } = useVersionStore();

  // 获取版本信息
  const fromVersion = useMemo(
    () => versions.find(v => v.id === diffFromId),
    [versions, diffFromId]
  );
  const toVersion = useMemo(
    () => versions.find(v => v.id === diffToId),
    [versions, diffToId]
  );

  const handleClose = () => {
    clearDiff();
    onClose?.();
  };

  if (!diffResult) return null;

  const { summary, componentChanges, wireChanges } = diffResult;
  const hasChanges =
    summary.componentsAdded + summary.componentsRemoved +
    summary.componentsModified + summary.componentsMoved +
    summary.wiresAdded + summary.wiresRemoved > 0;

  // 按变更类型分组
  const addedComponents = componentChanges.filter(c => c.type === ChangeType.Added);
  const removedComponents = componentChanges.filter(c => c.type === ChangeType.Removed);
  const modifiedComponents = componentChanges.filter(c => c.type === ChangeType.Modified);
  const movedComponents = componentChanges.filter(c => c.type === ChangeType.Moved);
  const addedWires = wireChanges.filter(w => w.type === ChangeType.Added);
  const removedWires = wireChanges.filter(w => w.type === ChangeType.Removed);

  return (
    <div className="version-diff-panel">
      {/* 头部 */}
      <div className="vd-header">
        <h3 className="vd-title">🔍 版本比较</h3>
        <button className="vd-close-btn" onClick={handleClose}>✕</button>
      </div>

      {/* 版本信息 */}
      <div className="vd-version-info">
        <div className="vd-version-card vd-version-from">
          <span className="vd-version-badge vd-badge-from">旧版本</span>
          <span className="vd-version-label">{fromVersion?.label ?? diffFromId?.slice(0, 8)}</span>
          {fromVersion && (
            <span className="vd-version-time">
              {new Date(fromVersion.createdAt).toLocaleString('zh-CN')}
            </span>
          )}
        </div>
        <div className="vd-arrow">→</div>
        <div className="vd-version-card vd-version-to">
          <span className="vd-version-badge vd-badge-to">新版本</span>
          <span className="vd-version-label">{toVersion?.label ?? diffToId?.slice(0, 8)}</span>
          {toVersion && (
            <span className="vd-version-time">
              {new Date(toVersion.createdAt).toLocaleString('zh-CN')}
            </span>
          )}
        </div>
      </div>

      {/* 汇总 */}
      <div className="vd-summary">
        {!hasChanges && <span className="vd-no-changes">✓ 两个版本内容完全相同</span>}
        {hasChanges && (
          <>
            {summary.componentsAdded > 0 && (
              <span className="vd-stat vd-stat-added">
                +{summary.componentsAdded} 元件
              </span>
            )}
            {summary.componentsRemoved > 0 && (
              <span className="vd-stat vd-stat-removed">
                -{summary.componentsRemoved} 元件
              </span>
            )}
            {summary.componentsModified > 0 && (
              <span className="vd-stat vd-stat-modified">
                ~{summary.componentsModified} 修改
              </span>
            )}
            {summary.componentsMoved > 0 && (
              <span className="vd-stat vd-stat-moved">
                ↗{summary.componentsMoved} 移动
              </span>
            )}
            {summary.wiresAdded > 0 && (
              <span className="vd-stat vd-stat-added">
                +{summary.wiresAdded} 连线
              </span>
            )}
            {summary.wiresRemoved > 0 && (
              <span className="vd-stat vd-stat-removed">
                -{summary.wiresRemoved} 连线
              </span>
            )}
          </>
        )}
      </div>

      {/* 详细变更列表 */}
      <div className="vd-details">
        {/* 新增元件 */}
        {addedComponents.length > 0 && (
          <div className="vd-section vd-section-added">
            <h4 className="vd-section-title">🟢 新增元件</h4>
            {addedComponents.map(change => (
              <div key={change.componentId} className="vd-item vd-item-added">
                <span className="vd-item-icon">+</span>
                <div className="vd-item-info">
                  <span className="vd-item-name">{formatComponentInfo(change)}</span>
                  {change.after && (
                    <span className="vd-item-detail">
                      {change.after.value.prefix ?? ''}{change.after.value.value} {change.after.value.unit}
                      {' @ '}({change.after.position.x}, {change.after.position.y})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 删除元件 */}
        {removedComponents.length > 0 && (
          <div className="vd-section vd-section-removed">
            <h4 className="vd-section-title">🔴 删除元件</h4>
            {removedComponents.map(change => (
              <div key={change.componentId} className="vd-item vd-item-removed">
                <span className="vd-item-icon">−</span>
                <div className="vd-item-info">
                  <span className="vd-item-name">{formatComponentInfo(change)}</span>
                  {change.before && (
                    <span className="vd-item-detail">
                      {change.before.value.prefix ?? ''}{change.before.value.value} {change.before.value.unit}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 修改元件 */}
        {modifiedComponents.length > 0 && (
          <div className="vd-section vd-section-modified">
            <h4 className="vd-section-title">🟡 修改元件</h4>
            {modifiedComponents.map(change => (
              <div key={change.componentId} className="vd-item vd-item-modified">
                <span className="vd-item-icon">~</span>
                <div className="vd-item-info">
                  <span className="vd-item-name">{formatComponentInfo(change)}</span>
                  {change.paramChanges?.map((param, i) => (
                    <div key={i} className="vd-param-change">
                      <span className="vd-param-label">{param.label}:</span>
                      <span className="vd-param-old">{String(param.oldValue)}</span>
                      <span className="vd-param-arrow">→</span>
                      <span className="vd-param-new">{String(param.newValue)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 移动元件 */}
        {movedComponents.length > 0 && (
          <div className="vd-section vd-section-moved">
            <h4 className="vd-section-title">🔵 移动元件</h4>
            {movedComponents.map(change => (
              <div key={change.componentId} className="vd-item vd-item-moved">
                <span className="vd-item-icon">↗</span>
                <div className="vd-item-info">
                  <span className="vd-item-name">{formatComponentInfo(change)}</span>
                  {change.before && change.after && (
                    <span className="vd-item-detail">
                      ({change.before.position.x}, {change.before.position.y})
                      → ({change.after.position.x}, {change.after.position.y})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 新增连线 */}
        {addedWires.length > 0 && (
          <div className="vd-section vd-section-added">
            <h4 className="vd-section-title">🟢 新增连线</h4>
            {addedWires.map(change => (
              <div key={change.wireId} className="vd-item vd-item-added">
                <span className="vd-item-icon">+</span>
                <div className="vd-item-info">
                  <span className="vd-item-name">连线 {formatWireInfo(change)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 删除连线 */}
        {removedWires.length > 0 && (
          <div className="vd-section vd-section-removed">
            <h4 className="vd-section-title">🔴 删除连线</h4>
            {removedWires.map(change => (
              <div key={change.wireId} className="vd-item vd-item-removed">
                <span className="vd-item-icon">−</span>
                <div className="vd-item-info">
                  <span className="vd-item-name">连线 {formatWireInfo(change)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default VersionDiff;
