/**
 * 网络管理面板组件
 * 显示所有网络列表、搜索、定位、未连接引脚检查
 */

import { useState, useMemo, useCallback } from 'react';
import { useCircuitStore } from '../../stores/circuit-store';
import type { CircuitComponent, Wire, Point } from '../../types/circuit';
import { getPortAbsolutePosition } from '../../lib/circuit/circuit-utils';
import type { NetInfo } from '../../lib/circuit/NetManager';
import { NetManager, NetLabelType } from '../../lib/circuit/NetManager';
import './NetworkPanel.css';

// 全局 NetManager 实例
const netManager = new NetManager();

/** 未连接引脚信息 */
interface UnconnectedPin {
  componentId: string;
  componentName: string;
  componentType: string;
  portId: string;
  position: Point;
}

/**
 * 检查元件的所有引脚是否已连接
 */
function findUnconnectedPins(
  components: CircuitComponent[],
  wires: Wire[]
): UnconnectedPin[] {
  const connectedPorts = new Set<string>();

  for (const wire of wires) {
    connectedPorts.add(wire.fromPortId);
    connectedPorts.add(wire.toPortId);
  }

  const unconnected: UnconnectedPin[] = [];

  for (const comp of components) {
    for (const port of comp.ports) {
      if (!connectedPorts.has(port.id)) {
        const pos = getPortAbsolutePosition(comp, port.id);
        if (pos) {
          unconnected.push({
            componentId: comp.id,
            componentName: comp.name,
            componentType: comp.type,
            portId: port.id,
            position: pos,
          });
        }
      }
    }
  }

  return unconnected;
}

export function NetworkPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNets, setExpandedNets] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'nets' | 'unconnected' | 'labels'>('nets');
  const [highlightedNet, setHighlightedNet] = useState<string | null>(null);

  const components = useCircuitStore(s => s.components);
  const wires = useCircuitStore(s => s.wires);
  const selectWire = useCircuitStore(s => s.selectWire);
  const selectComponent = useCircuitStore(s => s.selectComponent);
  const setViewTransform = useCircuitStore(s => s.setViewTransform);

  // 构建网络列表
  const netList = useMemo(() => {
    return netManager.getNetList(components, wires);
  }, [components, wires]);

  // 搜索结果
  const filteredNets = useMemo(() => {
    if (!searchQuery.trim()) return netList;
    return netManager.searchNets(searchQuery, components, wires);
  }, [searchQuery, netList, components, wires]);

  // 未连接引脚
  const unconnectedPins = useMemo(() => {
    return findUnconnectedPins(components, wires);
  }, [components, wires]);

  // 切换网络展开
  const toggleExpand = useCallback((netName: string) => {
    setExpandedNets(prev => {
      const next = new Set(prev);
      if (next.has(netName)) {
        next.delete(netName);
      } else {
        next.add(netName);
      }
      return next;
    });
  }, []);

  // 高亮网络连线
  const handleHighlightNet = useCallback((netName: string) => {
    setHighlightedNet(prev => prev === netName ? null : netName);

    // 获取该网络的所有连线并选中第一条
    const wireIds = netManager.getNetWireIds(netName, wires);
    if (wireIds.length > 0) {
      selectWire(wireIds[0]);
    }
  }, [wires, selectWire]);

  // 定位到网络的第一个端口
  const handleLocateNet = useCallback((net: NetInfo) => {
    if (net.connectedPorts.length === 0) return;

    const port = net.connectedPorts[0];
    selectComponent(port.componentId);
    setViewTransform({
      scale: 1.5,
      offsetX: 400 - port.position.x * 1.5,
      offsetY: 300 - port.position.y * 1.5,
    });
  }, [selectComponent, setViewTransform]);

  // 定位到未连接引脚
  const handleLocatePin = useCallback((pin: UnconnectedPin) => {
    selectComponent(pin.componentId);
    setViewTransform({
      scale: 1.5,
      offsetX: 400 - pin.position.x * 1.5,
      offsetY: 300 - pin.position.y * 1.5,
    });
  }, [selectComponent, setViewTransform]);

  // 获取网络类型图标
  const getNetIcon = (type: NetLabelType): string => {
    switch (type) {
      case NetLabelType.Power: return '⚡';
      case NetLabelType.Ground: return '⏚';
      case NetLabelType.Bus: return '🚌';
      default: return '🔗';
    }
  };

  // 获取网络类型颜色
  const getNetColor = (net: NetInfo): string => {
    if (net.type === NetLabelType.Power) return '#ff4444';
    if (net.type === NetLabelType.Ground) return '#44ff44';
    if (net.type === NetLabelType.Bus) return '#ffaa00';
    return '#4ecdc4';
  };

  return (
    <div className="network-panel">
      <div className="network-panel-header">
        <h3>🌐 网络管理</h3>
      </div>

      {/* 标签页 */}
      <div className="network-tabs">
        <button
          className={activeTab === 'nets' ? 'active' : ''}
          onClick={() => setActiveTab('nets')}
        >
          网络列表 ({netList.length})
        </button>
        <button
          className={activeTab === 'unconnected' ? 'active' : ''}
          onClick={() => setActiveTab('unconnected')}
        >
          未连接 ({unconnectedPins.length})
        </button>
        <button
          className={activeTab === 'labels' ? 'active' : ''}
          onClick={() => setActiveTab('labels')}
        >
          标签
        </button>
      </div>

      {/* 搜索框 */}
      <div className="network-search">
        <input
          type="text"
          placeholder="搜索网络..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {/* 网络列表 */}
      {activeTab === 'nets' && (
        <div className="network-list">
          {filteredNets.length === 0 ? (
            <div className="empty-state">
              <p>暂无网络</p>
              <p className="hint">放置元件并连线后，网络将自动出现在这里</p>
            </div>
          ) : (
            filteredNets.map(net => (
              <div
                key={net.name}
                className={`network-item ${highlightedNet === net.name ? 'highlighted' : ''}`}
              >
                <div
                  className="network-item-header"
                  onClick={() => toggleExpand(net.name)}
                >
                  <span className="net-icon">{getNetIcon(net.type)}</span>
                  <span className="net-name" style={{ color: getNetColor(net) }}>
                    {net.name}
                  </span>
                  {net.isGlobal && <span className="net-badge global">全局</span>}
                  <span className="net-stats">
                    {net.connectedPorts.length} 端口 · {net.wireIds.length} 连线
                  </span>
                  <span className="expand-icon">
                    {expandedNets.has(net.name) ? '▼' : '▶'}
                  </span>
                </div>

                {expandedNets.has(net.name) && (
                  <div className="network-details">
                    <div className="network-actions">
                      <button
                        className="btn-sm"
                        onClick={() => handleHighlightNet(net.name)}
                        title="高亮此网络的所有连线"
                      >
                        {highlightedNet === net.name ? '取消高亮' : '🔍 高亮'}
                      </button>
                      <button
                        className="btn-sm"
                        onClick={() => handleLocateNet(net)}
                        title="定位到此网络"
                      >
                        📍 定位
                      </button>
                    </div>

                    {net.connectedPorts.length > 0 && (
                      <div className="port-list">
                        <div className="port-list-title">连接的端口：</div>
                        {net.connectedPorts.map((port, i) => (
                          <div key={i} className="port-item">
                            <span className="port-comp">{port.componentName}</span>
                            <span className="port-id">({port.portId.slice(0, 8)}...)</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* 未连接引脚 */}
      {activeTab === 'unconnected' && (
        <div className="unconnected-list">
          {unconnectedPins.length === 0 ? (
            <div className="empty-state">
              <p>✅ 所有引脚已连接</p>
            </div>
          ) : (
            <>
              <div className="warning-banner">
                ⚠️ 发现 {unconnectedPins.length} 个未连接引脚
              </div>
              {unconnectedPins.map((pin, i) => (
                <div key={i} className="unconnected-item">
                  <div className="pin-info">
                    <span className="pin-comp">{pin.componentName}</span>
                    <span className="pin-type">({pin.componentType})</span>
                    <span className="pin-port">引脚 {pin.portId.slice(0, 6)}</span>
                  </div>
                  <button
                    className="btn-sm"
                    onClick={() => handleLocatePin(pin)}
                  >
                    📍
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* 标签管理 */}
      {activeTab === 'labels' && (
        <div className="labels-list">
          <div className="empty-state">
            <p>网络标签管理</p>
            <p className="hint">
              使用画布工具栏中的「标签」工具添加网络标签。<br />
              同名标签将自动连接对应网络。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
