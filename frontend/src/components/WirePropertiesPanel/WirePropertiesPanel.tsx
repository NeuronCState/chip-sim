/**
 * 连线属性面板组件
 * 修改线宽、颜色、样式（实线/虚线）
 */

import { useState, useCallback } from 'react';
import { useCircuitStore } from '../../stores/circuit-store';
import { calculateWireLength } from '../../lib/circuit/WireBeautifier';
import './WirePropertiesPanel.css';

/** 连线样式选项 */
interface WireStyle {
  width: number;
  color: string;
  dashPattern: number[];
}

/** 预设连线样式 */
const WIRE_PRESETS: Array<{ name: string; style: WireStyle }> = [
  { name: '默认', style: { width: 2, color: '#00d4ff', dashPattern: [] } },
  { name: '电源', style: { width: 3, color: '#ff4444', dashPattern: [] } },
  { name: '地线', style: { width: 3, color: '#44ff44', dashPattern: [] } },
  { name: '信号', style: { width: 1.5, color: '#4ecdc4', dashPattern: [] } },
  { name: '总线', style: { width: 4, color: '#ffaa00', dashPattern: [] } },
  { name: '虚线', style: { width: 2, color: '#8888ff', dashPattern: [5, 5] } },
  { name: '点划线', style: { width: 2, color: '#aaaaff', dashPattern: [10, 3, 2, 3] } },
];

export function WirePropertiesPanel() {
  const selectedWireId = useCircuitStore(s => s.selectedWireId);
  const wires = useCircuitStore(s => s.wires);

  const selectedWire = wires.find(w => w.id === selectedWireId);

  // 连线属性状态（实际应用中应存储在 wire 的 style 字段中）
  const [wireWidth, setWireWidth] = useState(2);
  const [wireColor, setWireColor] = useState('#00d4ff');
  const [dashPattern, setDashPattern] = useState<number[]>([]);

  // 应用预设样式
  const applyPreset = useCallback((preset: typeof WIRE_PRESETS[0]) => {
    setWireWidth(preset.style.width);
    setWireColor(preset.style.color);
    setDashPattern(preset.style.dashPattern);
  }, []);

  if (!selectedWire) {
    return (
      <div className="wire-props-panel">
        <div className="wire-props-header">
          <h3>🔗 连线属性</h3>
        </div>
        <div className="wire-props-empty">
          <p>选择一条连线以查看和编辑属性</p>
        </div>
      </div>
    );
  }

  const wireLength = calculateWireLength(selectedWire);
  const bendCount = selectedWire.points.filter(p => p.isBend).length;

  return (
    <div className="wire-props-panel">
      <div className="wire-props-header">
        <h3>🔗 连线属性</h3>
      </div>

      <div className="wire-props-content">
        {/* 基本信息 */}
        <div className="props-section">
          <div className="section-title">基本信息</div>
          <div className="prop-row">
            <span className="prop-label">ID</span>
            <span className="prop-value mono">{selectedWire.id.slice(0, 12)}...</span>
          </div>
          <div className="prop-row">
            <span className="prop-label">状态</span>
            <span className={`prop-value status-${selectedWire.status}`}>
              {selectedWire.status === 'connected' ? '✅ 已连接' : '❌ 断开'}
            </span>
          </div>
          <div className="prop-row">
            <span className="prop-label">总长度</span>
            <span className="prop-value">{wireLength.toFixed(0)} px</span>
          </div>
          <div className="prop-row">
            <span className="prop-label">拐点数</span>
            <span className="prop-value">{bendCount}</span>
          </div>
          <div className="prop-row">
            <span className="prop-label">路径点</span>
            <span className="prop-value">{selectedWire.points.length}</span>
          </div>
        </div>

        {/* 连接信息 */}
        <div className="props-section">
          <div className="section-title">连接信息</div>
          <div className="prop-row">
            <span className="prop-label">起始</span>
            <span className="prop-value mono">
              {selectedWire.fromComponentId.slice(0, 8)}:{selectedWire.fromPortId.slice(0, 6)}
            </span>
          </div>
          <div className="prop-row">
            <span className="prop-label">目标</span>
            <span className="prop-value mono">
              {selectedWire.toComponentId.slice(0, 8)}:{selectedWire.toPortId.slice(0, 6)}
            </span>
          </div>
        </div>

        {/* 样式设置 */}
        <div className="props-section">
          <div className="section-title">样式设置</div>

          {/* 预设 */}
          <div className="preset-row">
            {WIRE_PRESETS.map(preset => (
              <button
                key={preset.name}
                className="preset-btn"
                onClick={() => applyPreset(preset)}
                title={preset.name}
              >
                <span
                  className="preset-swatch"
                  style={{
                    backgroundColor: preset.style.color,
                    height: preset.style.width + 1,
                    borderTop: preset.style.dashPattern.length > 0
                      ? `${preset.style.width}px dashed ${preset.style.color}`
                      : undefined,
                  }}
                />
                <span className="preset-name">{preset.name}</span>
              </button>
            ))}
          </div>

          {/* 线宽 */}
          <div className="prop-row">
            <span className="prop-label">线宽</span>
            <input
              type="range"
              min="1"
              max="6"
              step="0.5"
              value={wireWidth}
              onChange={e => setWireWidth(Number(e.target.value))}
              className="prop-slider"
            />
            <span className="prop-value">{wireWidth}px</span>
          </div>

          {/* 颜色 */}
          <div className="prop-row">
            <span className="prop-label">颜色</span>
            <input
              type="color"
              value={wireColor}
              onChange={e => setWireColor(e.target.value)}
              className="prop-color"
            />
            <span className="prop-value mono">{wireColor}</span>
          </div>

          {/* 线型 */}
          <div className="prop-row">
            <span className="prop-label">线型</span>
            <select
              value={dashPattern.join(',')}
              onChange={e => {
                const val = e.target.value;
                setDashPattern(val ? val.split(',').map(Number) : []);
              }}
              className="prop-select"
            >
              <option value="">实线</option>
              <option value="5,5">虚线</option>
              <option value="10,3,2,3">点划线</option>
              <option value="2,2">点线</option>
              <option value="15,5,5,5">长划线</option>
            </select>
          </div>

          {/* 预览 */}
          <div className="wire-preview-row">
            <span className="prop-label">预览</span>
            <svg width="120" height="20" className="wire-preview-svg">
              <line
                x1="5"
                y1="10"
                x2="115"
                y2="10"
                stroke={wireColor}
                strokeWidth={wireWidth}
                strokeDasharray={dashPattern.length > 0 ? dashPattern.join(',') : undefined}
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
