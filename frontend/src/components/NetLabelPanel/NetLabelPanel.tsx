/**
 * 网络标签面板
 * 管理画布上的网络标签：添加、编辑、删除、自动连接
 */

import { useState, useCallback } from 'react';
import { useCircuitStore } from '../../stores/circuit-store';
import { NetLabelKind } from '../../types/circuit';
import { toast } from '../../stores/ui-store';

/** 网络标签预设 */
const PRESET_NETS = [
  { name: 'VCC', icon: '🔴', type: NetLabelKind.Power },
  { name: 'VDD', icon: '🔴', type: NetLabelKind.Power },
  { name: 'GND', icon: '🟢', type: NetLabelKind.Ground },
  { name: 'AGND', icon: '🟢', type: NetLabelKind.Ground },
];

export function NetLabelPanel() {
  const netLabels = useCircuitStore((s) => s.netLabels);
  const selectedNetLabelId = useCircuitStore((s) => s.selectedNetLabelId);
  const addNetLabel = useCircuitStore((s) => s.addNetLabel);
  const removeNetLabel = useCircuitStore((s) => s.removeNetLabel);
  const renameNetLabel = useCircuitStore((s) => s.renameNetLabel);
  const selectNetLabel = useCircuitStore((s) => s.selectNetLabel);
  const autoConnectNetLabels = useCircuitStore((s) => s.autoConnectNetLabels);
  const highlightNet = useCircuitStore((s) => s.highlightNet);
  const mouseCanvasPos = useCircuitStore((s) => s.mouseCanvasPos);

  const [newLabelName, setNewLabelName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleAddLabel = useCallback(() => {
    const name = newLabelName.trim() || 'NET';
    addNetLabel(name, mouseCanvasPos.x, mouseCanvasPos.y);
    setNewLabelName('');
    toast.success(`已添加网络标签: ${name}`);
  }, [newLabelName, mouseCanvasPos, addNetLabel]);

  const handleAddPreset = useCallback((name: string) => {
    addNetLabel(name, mouseCanvasPos.x, mouseCanvasPos.y);
    toast.success(`已添加网络标签: ${name}`);
  }, [mouseCanvasPos, addNetLabel]);

  const handleStartEdit = useCallback((id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  }, []);

  const handleConfirmEdit = useCallback(() => {
    if (editingId && editName.trim()) {
      renameNetLabel(editingId, editName.trim());
      toast.success('标签已重命名');
    }
    setEditingId(null);
    setEditName('');
  }, [editingId, editName, renameNetLabel]);

  const handleDelete = useCallback((id: string) => {
    removeNetLabel(id);
    toast.info('已删除网络标签');
  }, [removeNetLabel]);

  const handleAutoConnect = useCallback(() => {
    autoConnectNetLabels();
  }, [autoConnectNetLabels]);

  const getTypeColor = (type: NetLabelKind): string => {
    switch (type) {
      case NetLabelKind.Power: return '#ff4444';
      case NetLabelKind.Ground: return '#44ff44';
      case NetLabelKind.Bus: return '#ffaa44';
      default: return '#00d4ff';
    }
  };

  const getTypeIcon = (type: NetLabelKind): string => {
    switch (type) {
      case NetLabelKind.Power: return '🔴';
      case NetLabelKind.Ground: return '🟢';
      case NetLabelKind.Bus: return '🔶';
      default: return '🔵';
    }
  };

  return (
    <div className="net-label-panel" style={{
      padding: '8px',
      fontSize: '12px',
      color: '#e0e0e0',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px',
      }}>
        <span style={{ fontWeight: 'bold', fontSize: '13px' }}>🏷️ 网络标签</span>
        <span style={{ color: '#888', fontSize: '11px' }}>
          {netLabels.length} 个
        </span>
      </div>

      {/* 快速添加预设 */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>快速添加：</div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {PRESET_NETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => handleAddPreset(preset.name)}
              style={{
                padding: '2px 8px',
                fontSize: '11px',
                background: '#2a2a4a',
                border: `1px solid ${getTypeColor(preset.type)}`,
                borderRadius: '4px',
                color: getTypeColor(preset.type),
                cursor: 'pointer',
              }}
              title={`添加 ${preset.name} 标签`}
            >
              {preset.icon} {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* 自定义添加 */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        <input
          type="text"
          value={newLabelName}
          onChange={(e) => setNewLabelName(e.target.value)}
          placeholder="输入网络名称..."
          onKeyDown={(e) => e.key === 'Enter' && handleAddLabel()}
          style={{
            flex: 1,
            padding: '4px 8px',
            fontSize: '12px',
            background: '#1a1a2e',
            border: '1px solid #444',
            borderRadius: '4px',
            color: '#e0e0e0',
          }}
        />
        <button
          onClick={handleAddLabel}
          style={{
            padding: '4px 12px',
            fontSize: '11px',
            background: '#4ecdc4',
            border: 'none',
            borderRadius: '4px',
            color: '#000',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          + 添加
        </button>
      </div>

      {/* 自动连接按钮 */}
      {netLabels.length >= 2 && (
        <button
          onClick={handleAutoConnect}
          style={{
            width: '100%',
            padding: '6px',
            marginBottom: '8px',
            fontSize: '12px',
            background: '#4488ff',
            border: 'none',
            borderRadius: '4px',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
          title="自动连接所有同名网络标签"
        >
          ⚡ 自动连接同名标签
        </button>
      )}

      {/* 标签列表 */}
      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
        {netLabels.length === 0 ? (
          <div style={{ color: '#666', textAlign: 'center', padding: '12px' }}>
            暂无网络标签
            <br />
            <span style={{ fontSize: '11px' }}>添加标签后可自动连接同名网络</span>
          </div>
        ) : (
          netLabels.map((label) => (
            <div
              key={label.id}
              onClick={() => {
                selectNetLabel(label.id);
                highlightNet(label.name);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 6px',
                marginBottom: '2px',
                background: selectedNetLabelId === label.id ? '#333366' : 'transparent',
                borderRadius: '4px',
                cursor: 'pointer',
                borderLeft: `3px solid ${getTypeColor(label.labelType)}`,
              }}
            >
              <span>{getTypeIcon(label.labelType)}</span>

              {editingId === label.id ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmEdit();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onBlur={handleConfirmEdit}
                  autoFocus
                  style={{
                    flex: 1,
                    padding: '1px 4px',
                    fontSize: '11px',
                    background: '#1a1a2e',
                    border: '1px solid #4ecdc4',
                    borderRadius: '2px',
                    color: '#e0e0e0',
                  }}
                />
              ) : (
                <span
                  style={{
                    flex: 1,
                    fontWeight: label.isGlobal ? 'bold' : 'normal',
                    color: getTypeColor(label.labelType),
                  }}
                  onDoubleClick={() => handleStartEdit(label.id, label.name)}
                >
                  {label.name}
                  {label.isGlobal && ' (全局)'}
                  {label.labelType === NetLabelKind.Bus && label.busWidth
                    ? ` [${label.busWidth}]`
                    : ''}
                </span>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartEdit(label.id, label.name);
                }}
                title="重命名"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '10px',
                  padding: '2px',
                  color: '#888',
                }}
              >
                ✏️
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(label.id);
                }}
                title="删除"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '10px',
                  padding: '2px',
                  color: '#ff6b6b',
                }}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
