/**
 * 连线美化模块
 * 提供连线自动整理、对齐、消除交叉等功能
 */

import type {
  CircuitComponent,
  Wire,
  Point,
} from '../../types/circuit';
import { getPortAbsolutePosition } from './circuit-utils';
import { extractObstacles, findManhattanPath, DEFAULT_ROUTING_CONFIG, type GridObstacle } from './SmartRouter';

// ==================== 类型定义 ====================

/** 连线美化配置 */
export interface BeautifyConfig {
  /** 是否消除交叉 */
  eliminateCrossings: boolean;
  /** 是否对齐拐点 */
  alignBends: boolean;
  /** 是否调整等长 */
  equalizeLength: boolean;
  /** 对齐容差（像素） */
  alignTolerance: number;
  /** 等长目标长度（像素，0 = 自动） */
  targetLength: number;
}

/** 默认美化配置 */
export const DEFAULT_BEAUTIFY_CONFIG: BeautifyConfig = {
  eliminateCrossings: true,
  alignBends: true,
  equalizeLength: false,
  alignTolerance: 10,
  targetLength: 0,
};

/** 美化结果 */
export interface BeautifyResult {
  /** 更新后的连线 */
  wires: Wire[];
  /** 修改的连线数量 */
  changedCount: number;
  /** 消除的交叉数 */
  crossingsEliminated: number;
}

// ==================== 核心函数 ====================

/**
 * 计算连线的总长度
 */
export function calculateWireLength(wire: Wire): number {
  let length = 0;
  for (let i = 0; i < wire.points.length - 1; i++) {
    const dx = wire.points[i + 1].x - wire.points[i].x;
    const dy = wire.points[i + 1].y - wire.points[i].y;
    length += Math.abs(dx) + Math.abs(dy); // 曼哈顿距离
  }
  return length;
}

/**
 * 计算一组连线的总长度
 */
export function calculateTotalWireLength(wires: Wire[]): number {
  return wires.reduce((sum, w) => sum + calculateWireLength(w), 0);
}

/**
 * 检测两条连线段是否相交
 */
function segmentsIntersect(
  p1: Point, p2: Point,
  p3: Point, p4: Point
): boolean {
  // 对于曼哈顿路径，简化为水平/垂直线段相交检测
  const h1 = p1.y === p2.y;
  const h2 = p3.y === p4.y;

  // 两条水平线或两条垂直线不会相交（我们只关心交叉）
  if (h1 === h2) return false;

  let hSeg: [Point, Point];
  let vSeg: [Point, Point];

  if (h1) {
    hSeg = [p1, p2];
    vSeg = [p3, p4];
  } else {
    hSeg = [p3, p4];
    vSeg = [p1, p2];
  }

  const hMinX = Math.min(hSeg[0].x, hSeg[1].x);
  const hMaxX = Math.max(hSeg[0].x, hSeg[1].x);
  const hY = hSeg[0].y;

  const vMinY = Math.min(vSeg[0].y, vSeg[1].y);
  const vMaxY = Math.max(vSeg[0].y, vSeg[1].y);
  const vX = vSeg[0].x;

  return vX > hMinX && vX < hMaxX && hY > vMinY && hY < vMaxY;
}

/**
 * 检测两条连线是否交叉
 */
export function wiresIntersect(wire1: Wire, wire2: Wire): number {
  let crossings = 0;

  for (let i = 0; i < wire1.points.length - 1; i++) {
    for (let j = 0; j < wire2.points.length - 1; j++) {
      if (segmentsIntersect(
        wire1.points[i], wire1.points[i + 1],
        wire2.points[j], wire2.points[j + 1]
      )) {
        crossings++;
      }
    }
  }

  return crossings;
}

/**
 * 统计所有连线之间的交叉总数
 */
export function countAllCrossings(wires: Wire[]): number {
  let total = 0;
  for (let i = 0; i < wires.length; i++) {
    for (let j = i + 1; j < wires.length; j++) {
      total += wiresIntersect(wires[i], wires[j]);
    }
  }
  return total;
}

/**
 * 对齐连线拐点
 * 将相近的拐点对齐到同一水平/垂直线上，使连线更整齐
 */
export function alignWireBends(
  wires: Wire[],
  tolerance: number = 10
): Wire[] {
  if (wires.length === 0) return wires;

  // 收集所有拐点
  const bendXs: number[] = [];
  const bendYs: number[] = [];

  for (const wire of wires) {
    for (const point of wire.points) {
      if (point.isBend) {
        bendXs.push(point.x);
        bendYs.push(point.y);
      }
    }
  }

  // 聚类相近的坐标值
  const clusterValues = (values: number[], tol: number): Map<number, number> => {
    const sorted = [...values].sort((a, b) => a - b);
    const clusters = new Map<number, number>(); // 原始值 -> 对齐值

    let clusterStart = 0;
    while (clusterStart < sorted.length) {
      let clusterEnd = clusterStart;
      while (clusterEnd + 1 < sorted.length &&
             sorted[clusterEnd + 1] - sorted[clusterEnd] <= tol) {
        clusterEnd++;
      }

      // 计算聚类中心（取整到网格）
      const cluster = sorted.slice(clusterStart, clusterEnd + 1);
      const avg = Math.round(cluster.reduce((a, b) => a + b, 0) / cluster.length / 10) * 10;

      for (const val of cluster) {
        clusters.set(val, avg);
      }

      clusterStart = clusterEnd + 1;
    }

    return clusters;
  };

  const xClusters = clusterValues(bendXs, tolerance);
  const yClusters = clusterValues(bendYs, tolerance);

  // 应用对齐
  return wires.map(wire => {
    let changed = false;
    const newPoints = wire.points.map(point => {
      if (!point.isBend) return point;

      const alignedX = xClusters.get(point.x) ?? point.x;
      const alignedY = yClusters.get(point.y) ?? point.y;

      if (alignedX !== point.x || alignedY !== point.y) {
        changed = true;
        return { ...point, x: alignedX, y: alignedY };
      }
      return point;
    });

    return changed ? { ...wire, points: newPoints } : wire;
  });
}

/**
 * 重新路由单条连线以消除交叉
 * 使用路径规划算法找到不与其他连线交叉的路径
 */
function rerouteWireToAvoidCrossings(
  wire: Wire,
  allWires: Wire[],
  components: CircuitComponent[],
  obstacles: GridObstacle[]
): Wire {
  const fromComp = components.find(c => c.id === wire.fromComponentId);
  const toComp = components.find(c => c.id === wire.toComponentId);
  if (!fromComp || !toComp) return wire;

  const fromPos = getPortAbsolutePosition(fromComp, wire.fromPortId);
  const toPos = getPortAbsolutePosition(toComp, wire.toPortId);
  if (!fromPos || !toPos) return wire;

  // 将其他连线的路径段也作为障碍物
  const wireObstacles: GridObstacle[] = [...obstacles];
  for (const otherWire of allWires) {
    if (otherWire.id === wire.id) continue;
    for (let i = 0; i < otherWire.points.length - 1; i++) {
      const p1 = otherWire.points[i];
      const p2 = otherWire.points[i + 1];
      // 将线段扩展为矩形障碍物
      const pad = 5;
      wireObstacles.push({
        minX: Math.min(p1.x, p2.x) - pad,
        minY: Math.min(p1.y, p2.y) - pad,
        maxX: Math.max(p1.x, p2.x) + pad,
        maxY: Math.max(p1.y, p2.y) + pad,
      });
    }
  }

  const newPoints = findManhattanPath(fromPos, toPos, wireObstacles, {
    ...DEFAULT_ROUTING_CONFIG,
    maxIterations: 30000,
  });

  if (newPoints.length >= 2) {
    return { ...wire, points: newPoints };
  }

  return wire;
}

/**
 * 一键整理连线布局
 * 重新路由所有连线，消除交叉，对齐拐点
 */
export function beautifyWires(
  wires: Wire[],
  components: CircuitComponent[],
  config: BeautifyConfig = DEFAULT_BEAUTIFY_CONFIG
): BeautifyResult {
  let resultWires = [...wires];
  let crossingsEliminated = 0;
  let changedCount = 0;

  // 第一步：重新路由消除交叉
  if (config.eliminateCrossings) {
    const initialCrossings = countAllCrossings(resultWires);

    // 按连线长度排序，短的连线优先路由（减少对长连线的影响）
    const sortedIndices = resultWires
      .map((w, i) => ({ index: i, length: calculateWireLength(w) }))
      .sort((a, b) => a.length - b.length);

    const excludeIds = new Set<string>();
    for (const wire of resultWires) {
      excludeIds.add(wire.fromComponentId);
      excludeIds.add(wire.toComponentId);
    }
    const obstacles = extractObstacles(components, excludeIds);

    for (const { index } of sortedIndices) {
      const wire = resultWires[index];
      const newWire = rerouteWireToAvoidCrossings(wire, resultWires, components, obstacles);
      if (newWire !== wire) {
        resultWires[index] = newWire;
        changedCount++;
      }
    }

    const finalCrossings = countAllCrossings(resultWires);
    crossingsEliminated = Math.max(0, initialCrossings - finalCrossings);
  }

  // 第二步：对齐拐点
  if (config.alignBends) {
    resultWires = alignWireBends(resultWires, config.alignTolerance);
  }

  return {
    wires: resultWires,
    changedCount,
    crossingsEliminated,
  };
}

/**
 * 连线等长调整
 * 将指定连线调整为相同长度（适用于差分对等）
 */
export function equalizeWireLengths(
  wires: Wire[],
  targetLength?: number
): Wire[] {
  if (wires.length < 2) return wires;

  const lengths = wires.map(calculateWireLength);
  const maxLen = targetLength ?? Math.max(...lengths);

  return wires.map((wire, i) => {
    const currentLen = lengths[i];
    if (currentLen >= maxLen) return wire;

    const deficit = maxLen - currentLen;
    if (deficit < 5) return wire; // 差距太小不需要调整

    // 在最后一个拐点前添加额外的路径段
    const points = [...wire.points];
    if (points.length < 2) return wire;

    const last = points.length - 1;
    const secondLast = points.length - 2;
    const isHorizontal = points[last].y === points[secondLast].y;

    if (isHorizontal) {
      // 在倒数第二个点后添加一个蛇形弯
      const midY = points[secondLast].y;
      const midX = points[secondLast].x;
      const extraX = deficit / 2;

      points.splice(secondLast, 0,
        { x: midX, y: midY - 20, isBend: true },
        { x: midX + extraX, y: midY - 20, isBend: true },
        { x: midX + extraX, y: midY, isBend: true }
      );
    } else {
      const midX = points[secondLast].x;
      const midY = points[secondLast].y;
      const extraY = deficit / 2;

      points.splice(secondLast, 0,
        { x: midX - 20, y: midY, isBend: true },
        { x: midX - 20, y: midY + extraY, isBend: true },
        { x: midX, y: midY + extraY, isBend: true }
      );
    }

    return { ...wire, points };
  });
}

// ==================== 连线标签 ====================

/**
 * 为连线自动生成标签
 * 基于网络名称为连线添加标签
 */
export function generateWireLabels(
  wires: Wire[],
  _components: CircuitComponent[],
  netNames: Map<string, string> // portId -> netName
): Array<{ wireId: string; label: string; position: Point }> {
  const labels: Array<{ wireId: string; label: string; position: Point }> = [];

  for (const wire of wires) {
    // 从起始端口或目标端口获取网络名
    const netName = netNames.get(wire.fromPortId) ?? netNames.get(wire.toPortId);
    if (!netName || netName.startsWith('_NET_')) continue; // 跳过自动生成的网络名

    // 计算标签位置（连线中点）
    const midIdx = Math.floor(wire.points.length / 2);
    const midPoint = wire.points[midIdx];
    if (!midPoint) continue;

    labels.push({
      wireId: wire.id,
      label: netName,
      position: { x: midPoint.x, y: midPoint.y - 10 },
    });
  }

  return labels;
}
