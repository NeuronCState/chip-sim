/**
 * 智能布线工具栏
 * 提供自动布线、连线美化、网络标签管理等高级连线功能的快捷入口
 */

import { useState, useCallback } from 'react';
import { useCircuitStore } from '../../stores/circuit-store';
import { WireRouting } from '../../types/circuit';
import { toast } from '../../stores/toast-store';
import { NetLabelPanel } from '../NetLabelPanel';
import './RoutingToolbar.css';

export function RoutingToolbar() {
  const wireRouting = useCircuitStore((s) => s.wireRouting);
  const setWireRouting = useCircuitStore((s) => s.setWireRouting);
  const autoRouteSelected = useCircuitStore((s) => s.autoRouteSelected);
  const autoRoutePowerNets = useCircuitStore((s) => s.autoRoutePowerNets);
  const beautifyAllWires = useCircuitStore((s) => s.beautifyAllWires);
  const selectedComponentIds = useCircuitStore((s) => s.selectedComponentIds);
  const wires = useCircuitStore((s) => s.wires);

  const [showNetLabels, setShowNetLabels] = useState(false);
  const [showRouteOptions, setShowRouteOptions] = useState(false);

  const handleAutoRouteSelected = useCallback(() => {
    if (selectedComponentIds.size < 2) {
      toast.warning('请先选中至少两个元件（Ctrl+点击 或 框选）');
      return;
    }
    autoRouteSelected();
  }, [selectedComponentIds, autoRouteSelected]);

  const handleBeautify = useCallback(() => {
    if (wires.length === 0) {
      toast.info('当前没有连线需要美化');
      return;
    }
    beautifyAllWires();
  }, [wires, beautifyAllWires]);

  return (
    <div className="routing-toolbar">
      <div className="routing-toolbar-section">
        <span className="routing-toolbar-label">🔌 布线模式</span>
        <div className="routing-mode-buttons">
          <button
            className={`routing-mode-btn ${wireRouting === WireRouting.Orthogonal ? 'active' : ''}`}
            onClick={() => setWireRouting(WireRouting.Orthogonal)}
            title="直角连线 (90°)"
          >
            ⌐ 直角
          </button>
          <button
            className={`routing-mode-btn ${wireRouting === WireRouting.Diagonal45 ? 'active' : ''}`}
            onClick={() => setWireRouting(WireRouting.Diagonal45)}
            title="45度斜线连线"
          >
            ╱ 45°
          </button>
          <button
            className={`routing-mode-btn ${wireRouting === WireRouting.Straight ? 'active' : ''}`}
            onClick={() => setWireRouting(WireRouting.Straight)}
            title="直线连线"
          >
            ─ 直线
          </button>
        </div>
      </div>

      <div className="routing-toolbar-divider" />

      <div className="routing-toolbar-section">
        <span className="routing-toolbar-label">⚡ 智能布线</span>
        <div className="routing-action-buttons">
          <button
            className="routing-action-btn auto-route"
            onClick={handleAutoRouteSelected}
            disabled={selectedComponentIds.size < 2}
            title="为选中元件自动连线（需选中2个以上元件）"
          >
            🎯 自动布线
          </button>
          <button
            className="routing-action-btn power-route"
            onClick={autoRoutePowerNets}
            title="自动连接 VCC/GND 电源网络"
          >
            🔋 电源连线
          </button>
          <button
            className="routing-action-btn beautify"
            onClick={handleBeautify}
            disabled={wires.length === 0}
            title="自动整理连线走向，消除交叉"
          >
            ✨ 美化连线
          </button>
        </div>
      </div>

      <div className="routing-toolbar-divider" />

      <div className="routing-toolbar-section">
        <button
          className={`routing-action-btn net-label ${showNetLabels ? 'active' : ''}`}
          onClick={() => setShowNetLabels(!showNetLabels)}
          title="网络标签管理"
        >
          🏷️ 网络标签
        </button>
      </div>

      {/* 网络标签面板（弹出式） */}
      {showNetLabels && (
        <div className="net-label-popup">
          <div className="net-label-popup-header">
            <span>🏷️ 网络标签管理</span>
            <button
              className="net-label-popup-close"
              onClick={() => setShowNetLabels(false)}
            >
              ✕
            </button>
          </div>
          <NetLabelPanel />
        </div>
      )}

      {/* 布线选项面板 */}
      {showRouteOptions && (
        <div className="route-options-popup">
          <div className="net-label-popup-header">
            <span>⚙️ 布线选项</span>
            <button
              className="net-label-popup-close"
              onClick={() => setShowRouteOptions(false)}
            >
              ✕
            </button>
          </div>
          <div style={{ padding: '8px', fontSize: '12px', color: '#e0e0e0' }}>
            <p>布线模式切换后，新连线将使用新模式。</p>
            <p>已有连线可通过"美化连线"功能重新布线。</p>
          </div>
        </div>
      )}
    </div>
  );
}
