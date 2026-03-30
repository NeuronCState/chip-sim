/**
 * 网络标签（Net Label）系统
 * 支持同名网络自动连接、电源/地全局连接、总线管理
 */

import type {
  CircuitComponent,
  Wire,
  Point,
} from '../../types/circuit';
import { WireStatus } from '../../types/circuit';
import { generateId, getPortAbsolutePosition } from './circuit-utils';
import { routeWireByPorts } from './SmartRouter';

// ==================== 类型定义 ====================

/** 网络标签 */
export interface NetLabel {
  /** 唯一 ID */
  id: string;
  /** 网络名称（如 VCC, GND, CLK, DATA[0:7]） */
  name: string;
  /** 标签在画布上的位置 */
  position: Point;
  /** 连接的元件端口 { componentId, portId } */
  connectedPort?: {
    componentId: string;
    portId: string;
  };
  /** 标签类型 */
  type: NetLabelType;
  /** 是否为全局网络 */
  isGlobal: boolean;
  /** 总线宽度（仅 Bus 类型） */
  busWidth?: number;
}

/** 网络标签类型 */
export const NetLabelType = {
  Signal: 'signal',
  Power: 'power',
  Ground: 'ground',
  Bus: 'bus',
} as const;
export type NetLabelType = (typeof NetLabelType)[keyof typeof NetLabelType];

/** 网络信息 */
export interface NetInfo {
  /** 网络名称 */
  name: string;
  /** 网络类型 */
  type: NetLabelType;
  /** 连接的端口列表 */
  connectedPorts: Array<{
    componentId: string;
    portId: string;
    componentName: string;
    position: Point;
  }>;
  /** 关联的连线 ID */
  wireIds: string[];
  /** 关联的标签 ID */
  labelIds: string[];
  /** 是否为全局网络 */
  isGlobal: boolean;
}

/** 自动布线结果 */
export interface AutoRouteResult {
  /** 成功创建的连线 */
  wires: Wire[];
  /** 创建的标签 */
  labels: NetLabel[];
  /** 无法布线的连接（需要手动处理） */
  failed: Array<{ from: string; to: string; reason: string }>;
}

// ==================== 常量 ====================

/** 预定义的全局电源网络 */
export const GLOBAL_POWER_NETS = new Set([
  'VCC', 'VDD', 'VSS', 'VEE', 'VPP',
  'AVCC', 'AVDD', 'DVCC', 'DVDD',
]);

/** 预定义的全局地网络 */
export const GLOBAL_GROUND_NETS = new Set([
  'GND', 'AGND', 'DGND', 'PGND', 'GNDA', 'GNDD',
]);

/** 电源网络颜色 */
export const POWER_NET_COLORS: Record<string, string> = {
  VCC: '#ff4444',
  VDD: '#ff4444',
  VSS: '#4444ff',
  VEE: '#ff8800',
  GND: '#44ff44',
  AGND: '#44cc44',
  DGND: '#22aa22',
};

// ==================== 网络管理器 ====================

/**
 * 网络管理器
 * 管理网络标签、同名网络连接、全局网络
 */
export class NetManager {
  private labels: Map<string, NetLabel> = new Map();
  private netCache: Map<string, NetInfo> | null = null;

  /** 添加网络标签 */
  addLabel(label: NetLabel): void {
    this.labels.set(label.id, label);
    this.invalidateCache();
  }

  /** 移除网络标签 */
  removeLabel(id: string): void {
    this.labels.delete(id);
    this.invalidateCache();
  }

  /** 更新网络标签位置 */
  updateLabelPosition(id: string, position: Point): void {
    const label = this.labels.get(id);
    if (label) {
      label.position = position;
      this.invalidateCache();
    }
  }

  /** 重命名网络 */
  renameLabel(id: string, name: string): void {
    const label = this.labels.get(id);
    if (label) {
      label.name = name;
      // 根据名称自动判断类型
      if (GLOBAL_POWER_NETS.has(name.toUpperCase())) {
        label.type = NetLabelType.Power;
        label.isGlobal = true;
      } else if (GLOBAL_GROUND_NETS.has(name.toUpperCase())) {
        label.type = NetLabelType.Ground;
        label.isGlobal = true;
      }
      this.invalidateCache();
    }
  }

  /** 获取所有标签 */
  getAllLabels(): NetLabel[] {
    return Array.from(this.labels.values());
  }

  /** 获取标签 */
  getLabel(id: string): NetLabel | undefined {
    return this.labels.get(id);
  }

  /** 按名称查找标签 */
  findLabelsByName(name: string): NetLabel[] {
    const lowerName = name.toLowerCase();
    return Array.from(this.labels.values()).filter(
      l => l.name.toLowerCase() === lowerName
    );
  }

  /** 清空所有标签 */
  clear(): void {
    this.labels.clear();
    this.invalidateCache();
  }

  /** 使缓存失效 */
  private invalidateCache(): void {
    this.netCache = null;
  }

  // ==================== 网络分析 ====================

  /**
   * 构建网络信息映射
   * 分析所有连线和标签，构建完整的网络拓扑
   */
  buildNetMap(
    components: CircuitComponent[],
    wires: Wire[]
  ): Map<string, NetInfo> {
    if (this.netCache) return this.netCache;

    const netMap = new Map<string, NetInfo>();

    // 1. 从标签创建网络
    for (const label of this.labels.values()) {
      let net = netMap.get(label.name.toLowerCase());
      if (!net) {
        net = {
          name: label.name,
          type: label.type,
          connectedPorts: [],
          wireIds: [],
          labelIds: [],
          isGlobal: label.isGlobal,
        };
        netMap.set(label.name.toLowerCase(), net);
      }
      net.labelIds.push(label.id);

      // 如果标签连接了端口
      if (label.connectedPort) {
        const comp = components.find(c => c.id === label.connectedPort!.componentId);
        if (comp) {
          const pos = getPortAbsolutePosition(comp, label.connectedPort.portId);
          net.connectedPorts.push({
            componentId: label.connectedPort.componentId,
            portId: label.connectedPort.portId,
            componentName: comp.name,
            position: pos || comp.position,
          });
        }
      }
    }

    // 2. 从连线推断网络（使用连通性分析）
    const portToNet = new Map<string, string>(); // portId -> netName
    const visited = new Set<string>();
    let netCounter = 0;

    // 构建端口邻接表
    const adjacency = new Map<string, Set<string>>();
    for (const wire of wires) {
      if (!adjacency.has(wire.fromPortId)) adjacency.set(wire.fromPortId, new Set());
      if (!adjacency.has(wire.toPortId)) adjacency.set(wire.toPortId, new Set());
      adjacency.get(wire.fromPortId)!.add(wire.toPortId);
      adjacency.get(wire.toPortId)!.add(wire.fromPortId);
    }

    // DFS 遍历连通分量
    const dfs = (portId: string, netName: string) => {
      if (visited.has(portId)) return;
      visited.add(portId);
      portToNet.set(portId, netName);

      const neighbors = adjacency.get(portId);
      if (neighbors) {
        for (const neighbor of neighbors) {
          dfs(neighbor, netName);
        }
      }
    };

    for (const wire of wires) {
      if (!visited.has(wire.fromPortId)) {
        // 检查是否已经有标签命名
        let netName: string | undefined;

        // 查找连接到该端口的标签
        for (const label of this.labels.values()) {
          if (label.connectedPort?.portId === wire.fromPortId ||
              label.connectedPort?.portId === wire.toPortId) {
            netName = label.name;
            break;
          }
        }

        if (!netName) {
          netName = `_NET_${netCounter++}`;
        }

        dfs(wire.fromPortId, netName);
      }
    }

    // 将连线归入对应网络
    for (const wire of wires) {
      const netName = portToNet.get(wire.fromPortId);
      if (netName) {
        const lowerName = netName.toLowerCase();
        let net = netMap.get(lowerName);
        if (!net) {
          const isGlobal = GLOBAL_POWER_NETS.has(netName.toUpperCase()) ||
                          GLOBAL_GROUND_NETS.has(netName.toUpperCase());
          net = {
            name: netName,
            type: isGlobal
              ? (GLOBAL_GROUND_NETS.has(netName.toUpperCase()) ? NetLabelType.Ground : NetLabelType.Power)
              : NetLabelType.Signal,
            connectedPorts: [],
            wireIds: [],
            labelIds: [],
            isGlobal,
          };
          netMap.set(lowerName, net);
        }
        if (!net.wireIds.includes(wire.id)) {
          net.wireIds.push(wire.id);
        }
      }
    }

    this.netCache = netMap;
    return netMap;
  }

  /**
   * 获取所有网络列表（排序后）
   */
  getNetList(
    components: CircuitComponent[],
    wires: Wire[]
  ): NetInfo[] {
    const netMap = this.buildNetMap(components, wires);
    return Array.from(netMap.values()).sort((a, b) => {
      // 全局网络优先
      if (a.isGlobal && !b.isGlobal) return -1;
      if (!a.isGlobal && b.isGlobal) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * 搜索网络
   */
  searchNets(
    query: string,
    components: CircuitComponent[],
    wires: Wire[]
  ): NetInfo[] {
    const lowerQuery = query.toLowerCase();
    const netMap = this.buildNetMap(components, wires);
    return Array.from(netMap.values()).filter(
      n => n.name.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * 获取指定网络的高亮连线 ID
   */
  getNetWireIds(netName: string, wires: Wire[]): string[] {
    const netMap = this.buildNetMap(
      [], // 不需要元件信息就能从缓存获取
      wires
    );
    const net = netMap.get(netName.toLowerCase());
    return net?.wireIds ?? [];
  }
}

// ==================== 自动布线 ====================

/**
 * 自动连接同名网络标签
 * 找到所有同名标签，自动在它们之间创建连线
 */
export function autoConnectNetLabels(
  labels: NetLabel[],
  components: CircuitComponent[],
  existingWires: Wire[]
): AutoRouteResult {
  const result: AutoRouteResult = {
    wires: [],
    labels: [],
    failed: [],
  };

  // 按名称分组
  const groups = new Map<string, NetLabel[]>();
  for (const label of labels) {
    if (!label.connectedPort) continue;
    const key = label.name.toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(label);
  }

  // 对每组同名标签进行连接
  for (const [name, groupLabels] of groups) {
    if (groupLabels.length < 2) continue;

    // 连接所有同名标签（链式连接）
    for (let i = 0; i < groupLabels.length - 1; i++) {
      const from = groupLabels[i];
      const to = groupLabels[i + 1];

      if (!from.connectedPort || !to.connectedPort) continue;

      // 检查是否已存在连线
      const alreadyConnected = existingWires.some(w =>
        (w.fromPortId === from.connectedPort!.portId && w.toPortId === to.connectedPort!.portId) ||
        (w.fromPortId === to.connectedPort!.portId && w.toPortId === from.connectedPort!.portId)
      );

      if (alreadyConnected) continue;

      // 检查是否与新创建的连线重复
      const duplicateInNew = result.wires.some(w =>
        (w.fromPortId === from.connectedPort!.portId && w.toPortId === to.connectedPort!.portId) ||
        (w.fromPortId === to.connectedPort!.portId && w.toPortId === from.connectedPort!.portId)
      );

      if (duplicateInNew) continue;

      try {
        const points = routeWireByPorts(
          from.connectedPort.componentId,
          from.connectedPort.portId,
          to.connectedPort.componentId,
          to.connectedPort.portId,
          components
        );

        const wire: Wire = {
          id: generateId(),
          fromComponentId: from.connectedPort.componentId,
          fromPortId: from.connectedPort.portId,
          toComponentId: to.connectedPort.componentId,
          toPortId: to.connectedPort.portId,
          points,
          status: WireStatus.Connected,
        };

        result.wires.push(wire);
      } catch {
        result.failed.push({
          from: `${from.connectedPort.componentId}:${from.connectedPort.portId}`,
          to: `${to.connectedPort.componentId}:${to.connectedPort.portId}`,
          reason: `路径规划失败：网络 ${name}`,
        });
      }
    }
  }

  return result;
}

/**
 * 自动连接电源和地网络
 * 将所有同名电源/地引脚连接到全局网络
 */
export function autoConnectPowerNets(
  components: CircuitComponent[],
  existingWires: Wire[],
  _gridLabel?: { position: Point }
): AutoRouteResult {
  const result: AutoRouteResult = {
    wires: [],
    labels: [],
    failed: [],
  };

  // 查找所有电源和地引脚
  const powerPorts: Array<{ compId: string; portId: string; netName: string; position: Point }> = [];

  for (const comp of components) {
    const params = comp.params || {};
    // 通过元件参数判断电源/地引脚
    for (const port of comp.ports) {
      const pos = getPortAbsolutePosition(comp, port.id);
      if (!pos) continue;

      // 检查元件的 params 中是否有 pinType 标识
      const pinType = (params as Record<string, unknown>)[`pin_${port.id}_type`] as string | undefined;
      if (pinType === 'vcc' || pinType === 'power') {
        powerPorts.push({ compId: comp.id, portId: port.id, netName: 'VCC', position: pos });
      } else if (pinType === 'gnd' || pinType === 'ground') {
        powerPorts.push({ compId: comp.id, portId: port.id, netName: 'GND', position: pos });
      }
    }
  }

  // 按网络名分组并连接
  const groups = new Map<string, typeof powerPorts>();
  for (const pp of powerPorts) {
    if (!groups.has(pp.netName)) groups.set(pp.netName, []);
    groups.get(pp.netName)!.push(pp);
  }

  for (const [netName, ports] of groups) {
    if (ports.length < 2) continue;

    // 链式连接
    for (let i = 0; i < ports.length - 1; i++) {
      const from = ports[i];
      const to = ports[i + 1];

      const alreadyConnected = existingWires.some(w =>
        (w.fromPortId === from.portId && w.toPortId === to.portId) ||
        (w.fromPortId === to.portId && w.toPortId === from.portId)
      );

      if (alreadyConnected) continue;

      try {
        const points = routeWireByPorts(from.compId, from.portId, to.compId, to.portId, components);
        result.wires.push({
          id: generateId(),
          fromComponentId: from.compId,
          fromPortId: from.portId,
          toComponentId: to.compId,
          toPortId: to.portId,
          points,
          status: WireStatus.Connected,
        });
      } catch {
        result.failed.push({
          from: `${from.compId}:${from.portId}`,
          to: `${to.compId}:${to.portId}`,
          reason: `电源网络 ${netName} 自动布线失败`,
        });
      }
    }
  }

  return result;
}

/**
 * 一键自动连接两个选中的元件
 * 按照端口名称或类型匹配进行智能连接
 */
export function autoConnectComponents(
  comp1: CircuitComponent,
  comp2: CircuitComponent,
  components: CircuitComponent[],
  existingWires: Wire[]
): AutoRouteResult {
  const result: AutoRouteResult = {
    wires: [],
    labels: [],
    failed: [],
  };

  // 尝试按端口名称匹配
  const matchedPairs: Array<{
    port1: { id: string; position: Point };
    port2: { id: string; position: Point };
  }> = [];

  for (const p1 of comp1.ports) {
    const pos1 = getPortAbsolutePosition(comp1, p1.id);
    if (!pos1) continue;

    for (const p2 of comp2.ports) {
      const pos2 = getPortAbsolutePosition(comp2, p2.id);
      if (!pos2) continue;

      // 如果端口在同一水平线或垂直线上，可能是设计意图
      const dx = Math.abs(pos1.x - pos2.x);
      const dy = Math.abs(pos1.y - pos2.y);

      // 距离适中且方向对齐的端口优先匹配
      const dist = Math.hypot(dx, dy);
      if (dist > 30 && dist < 500 && (dx < 20 || dy < 20)) {
        matchedPairs.push({
          port1: { id: p1.id, position: pos1 },
          port2: { id: p2.id, position: pos2 },
        });
      }
    }
  }

  // 按距离排序，取最优匹配
  matchedPairs.sort((a, b) => {
    const distA = Math.hypot(
      a.port1.position.x - a.port2.position.x,
      a.port1.position.y - a.port2.position.y
    );
    const distB = Math.hypot(
      b.port1.position.x - b.port2.position.x,
      b.port1.position.y - b.port2.position.y
    );
    return distA - distB;
  });

  // 创建连线（避免重复使用端口）
  const usedPorts1 = new Set<string>();
  const usedPorts2 = new Set<string>();

  for (const pair of matchedPairs) {
    if (usedPorts1.has(pair.port1.id) || usedPorts2.has(pair.port2.id)) continue;

    // 检查是否已连接
    const alreadyConnected = existingWires.some(w =>
      (w.fromPortId === pair.port1.id && w.toPortId === pair.port2.id) ||
      (w.fromPortId === pair.port2.id && w.toPortId === pair.port1.id)
    );
    if (alreadyConnected) continue;

    try {
      const points = routeWireByPorts(
        comp1.id, pair.port1.id,
        comp2.id, pair.port2.id,
        components
      );

      result.wires.push({
        id: generateId(),
        fromComponentId: comp1.id,
        fromPortId: pair.port1.id,
        toComponentId: comp2.id,
        toPortId: pair.port2.id,
        points,
        status: WireStatus.Connected,
      });

      usedPorts1.add(pair.port1.id);
      usedPorts2.add(pair.port2.id);
    } catch {
      result.failed.push({
        from: `${comp1.id}:${pair.port1.id}`,
        to: `${comp2.id}:${pair.port2.id}`,
        reason: '路径规划失败',
      });
    }
  }

  return result;
}
