/**
 * autoRoute.ts - 智能自动布线模块
 *
 * 提供高级连线路径规划功能，包括：
 * - 曼哈顿路径（直角连线）算法
 * - 避免穿过元件的路径计算
 * - 最短路径模式（minimize wire length）
 * - 最少弯折模式（minimize bends）
 *
 * 本模块建立在 lib/circuit/SmartRouter 的 A* 引擎之上，
 * 对外暴露更简洁的策略接口和批量布线能力。
 *
 * @module autoRoute
 * @author chip-sim
 */

import type { Point, WirePoint, CircuitComponent, Wire } from '../types/circuit';
import {
  findManhattanPath,
  extractObstacles,
  type GridObstacle,
  type RoutingConfig,
} from '../lib/circuit/SmartRouter';
import { getPortAbsolutePosition } from '../lib/circuit/circuit-utils';

// ==================== 路由策略枚举 ====================

/**
 * 布线策略
 * - `shortest`：最短路径，优先减少连线总长度
 * - `fewestBends`：最少弯折，优先减少拐点数量
 */
export type RouteStrategy = 'shortest' | 'fewestBends';

/**
 * 布线方向偏好
 * - `auto`：自动选择
 * - `horizontalFirst`：水平优先（先水平走再垂直）
 * - `verticalFirst`：垂直优先（先垂直走再水平）
 */
export type RoutePreference = 'auto' | 'horizontalFirst' | 'verticalFirst';

// ==================== 配置 ====================

/**
 * 智能布线配置
 */
export interface AutoRouteConfig {
  /** 布线策略 */
  strategy: RouteStrategy;
  /** 方向偏好 */
  preference: RoutePreference;
  /** 网格步长 */
  gridSize: number;
  /** 元件避让边距 */
  obstaclePadding: number;
  /** 搜索边界扩展 */
  searchMargin: number;
  /** 最大搜索节点数 */
  maxIterations: number;
  /** 拐点惩罚系数 */
  bendCost: number;
}

/** 默认布线配置 */
export const DEFAULT_AUTO_ROUTE_CONFIG: AutoRouteConfig = {
  strategy: 'shortest',
  preference: 'auto',
  gridSize: 10,
  obstaclePadding: 15,
  searchMargin: 80,
  maxIterations: 50000,
  bendCost: 2,
};

// ==================== 核心布线函数 ====================

/**
 * 将 AutoRouteConfig 转换为底层 RoutingConfig
 *
 * @param config - 智能布线配置
 * @returns 底层路由引擎配置
 */
function toRoutingConfig(config: AutoRouteConfig): RoutingConfig {
  return {
    gridSize: config.gridSize,
    maxIterations: config.maxIterations,
    obstaclePadding: config.obstaclePadding,
    searchMargin: config.searchMargin,
    bendCost: config.strategy === 'fewestBends' ? 0 : config.bendCost * 5,
    allowDiagonal: false,
  };
}

/**
 * 计算路径中的弯折数量
 *
 * @param points - 路径点数组
 * @returns 弯折数量
 */
export function countBends(points: WirePoint[]): number {
  let count = 0;
  for (const p of points) {
    if (p.isBend) count++;
  }
  return count;
}

/**
 * 计算曼哈顿路径总长度
 *
 * @param points - 路径点数组
 * @returns 曼哈顿总长度（像素）
 */
export function calculateManhattanLength(points: WirePoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.abs(points[i].x - points[i - 1].x) + Math.abs(points[i].y - points[i - 1].y);
  }
  return total;
}

/**
 * 生成水平优先路径（Z 形）
 *
 * @param from - 起点
 * @param to - 终点
 * @param obstacles - 障碍物列表
 * @param gridSize - 网格步长
 * @returns 路径点数组，如果穿越障碍物则返回 null
 */
function horizontalFirstPath(
  from: Point,
  to: Point,
  obstacles: GridObstacle[],
  gridSize: number
): WirePoint[] | null {
  const midX = Math.round((from.x + to.x) / 2 / gridSize) * gridSize;
  const path: WirePoint[] = [
    { x: from.x, y: from.y },
    { x: midX, y: from.y, isBend: true },
    { x: midX, y: to.y, isBend: true },
    { x: to.x, y: to.y },
  ];

  if (hasObstacleCrossing(path, obstacles)) return null;
  return path;
}

/**
 * 生成垂直优先路径
 *
 * @param from - 起点
 * @param to - 终点
 * @param obstacles - 障碍物列表
 * @param gridSize - 网格步长
 * @returns 路径点数组，如果穿越障碍物则返回 null
 */
function verticalFirstPath(
  from: Point,
  to: Point,
  obstacles: GridObstacle[],
  gridSize: number
): WirePoint[] | null {
  const midY = Math.round((from.y + to.y) / 2 / gridSize) * gridSize;
  const path: WirePoint[] = [
    { x: from.x, y: from.y },
    { x: from.x, y: midY, isBend: true },
    { x: to.x, y: midY, isBend: true },
    { x: to.x, y: to.y },
  ];

  if (hasObstacleCrossing(path, obstacles)) return null;
  return path;
}

/**
 * 检查路径是否穿越障碍物
 *
 * @param path - 路径点数组
 * @param obstacles - 障碍物列表
 * @returns 是否穿越障碍物
 */
function hasObstacleCrossing(path: WirePoint[], obstacles: GridObstacle[]): boolean {
  for (let i = 1; i < path.length; i++) {
    const p1 = path[i - 1];
    const p2 = path[i];
    for (const obs of obstacles) {
      if (segmentIntersectsRect(p1.x, p1.y, p2.x, p2.y, obs)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * 线段与矩形相交检测
 *
 * @param x1 - 线段起点 X
 * @param y1 - 线段起点 Y
 * @param x2 - 线段终点 X
 * @param y2 - 线段终点 Y
 * @param rect - 矩形障碍物
 * @returns 是否相交
 */
function segmentIntersectsRect(
  x1: number, y1: number,
  x2: number, y2: number,
  rect: GridObstacle
): boolean {
  const segMinX = Math.min(x1, x2);
  const segMaxX = Math.max(x1, x2);
  const segMinY = Math.min(y1, y2);
  const segMaxY = Math.max(y1, y2);

  if (segMaxX < rect.minX || segMinX > rect.maxX || segMaxY < rect.minY || segMinY > rect.maxY) {
    return false;
  }

  if (y1 === y2) {
    return y1 > rect.minY && y1 < rect.maxY && segMaxX > rect.minX && segMinX < rect.maxX;
  }
  if (x1 === x2) {
    return x1 > rect.minX && x1 < rect.maxX && segMaxY > rect.minY && segMinY < rect.maxY;
  }

  return true;
}

/**
 * 选择最优候选路径
 *
 * 从多个候选路径中根据策略选择最优的。
 *
 * @param candidates - 候选路径数组
 * @param strategy - 布线策略
 * @returns 最优路径，如果没有候选则返回空数组
 */
function selectBestCandidate(
  candidates: WirePoint[][],
  strategy: RouteStrategy
): WirePoint[] {
  if (candidates.length === 0) return [];

  if (strategy === 'fewestBends') {
    // 最少弯折：优先选择弯折最少的，其次选择最短的
    candidates.sort((a, b) => {
      const bendsA = countBends(a);
      const bendsB = countBends(b);
      if (bendsA !== bendsB) return bendsA - bendsB;
      return calculateManhattanLength(a) - calculateManhattanLength(b);
    });
  } else {
    // 最短路径：优先选择最短的，其次选择弯折最少的
    candidates.sort((a, b) => {
      const lenA = calculateManhattanLength(a);
      const lenB = calculateManhattanLength(b);
      if (Math.abs(lenA - lenB) > 5) return lenA - lenB;
      return countBends(a) - countBends(b);
    });
  }

  return candidates[0];
}

// ==================== 对外接口 ====================

/**
 * 智能布线：从起点到终点，使用指定策略计算最优路径
 *
 * 支持最短路径和最少弯折两种模式。自动避让元件障碍物。
 *
 * @param from - 起点坐标
 * @param to - 终点坐标
 * @param obstacles - 障碍物列表（元件包围盒）
 * @param config - 布线配置（可选，使用默认配置）
 * @returns 最优路径点数组
 *
 * @example
 * ```ts
 * const path = autoRoute(
 *   { x: 100, y: 200 },
 *   { x: 400, y: 200 },
 *   extractObstacles(components)
 * );
 * ```
 */
export function autoRoute(
  from: Point,
  to: Point,
  obstacles: GridObstacle[],
  config: Partial<AutoRouteConfig> = {}
): WirePoint[] {
  const finalConfig = { ...DEFAULT_AUTO_ROUTE_CONFIG, ...config };

  // 快速路径：同一直线且无障碍物
  const sameX = Math.abs(from.x - to.x) < 2;
  const sameY = Math.abs(from.y - to.y) < 2;
  if ((sameX || sameY) && !hasObstacleCrossing(
    [{ x: from.x, y: from.y }, { x: to.x, y: to.y }],
    obstacles
  )) {
    return [{ x: from.x, y: from.y }, { x: to.x, y: to.y }];
  }

  // 收集候选路径
  const candidates: WirePoint[][] = [];

  // 候选 1：按偏好生成简单路径
  if (finalConfig.preference === 'horizontalFirst' || finalConfig.preference === 'auto') {
    const hPath = horizontalFirstPath(from, to, obstacles, finalConfig.gridSize);
    if (hPath) candidates.push(hPath);
  }
  if (finalConfig.preference === 'verticalFirst' || finalConfig.preference === 'auto') {
    const vPath = verticalFirstPath(from, to, obstacles, finalConfig.gridSize);
    if (vPath) candidates.push(vPath);
  }

  // 候选 2：A* 搜索
  const routingConfig = toRoutingConfig(finalConfig);
  const astarPath = findManhattanPath(from, to, obstacles, routingConfig);
  if (astarPath.length >= 2) {
    candidates.push(astarPath);
  }

  return selectBestCandidate(candidates, finalConfig.strategy);
}

/**
 * 为两个元件之间的端口对进行智能布线
 *
 * 自动提取端口绝对坐标，提取障碍物（排除起止元件），然后调用 autoRoute。
 *
 * @param fromComp - 起始元件
 * @param fromPortId - 起始端口 ID
 * @param toComp - 目标元件
 * @param toPortId - 目标端口 ID
 * @param allComponents - 所有元件列表
 * @param config - 布线配置
 * @returns 路径点数组
 *
 * @example
 * ```ts
 * const path = routeBetweenPorts(compA, 'pin1', compB, 'pin2', components);
 * ```
 */
export function routeBetweenPorts(
  fromComp: CircuitComponent,
  fromPortId: string,
  toComp: CircuitComponent,
  toPortId: string,
  allComponents: CircuitComponent[],
  config: Partial<AutoRouteConfig> = {}
): WirePoint[] {
  const fromPos = getPortAbsolutePosition(fromComp, fromPortId);
  const toPos = getPortAbsolutePosition(toComp, toPortId);

  if (!fromPos || !toPos) return [];

  const finalConfig = { ...DEFAULT_AUTO_ROUTE_CONFIG, ...config };
  const excludeIds = new Set([fromComp.id, toComp.id]);
  const obstacles = extractObstacles(allComponents, excludeIds, finalConfig.obstaclePadding);

  return autoRoute(fromPos, toPos, obstacles, finalConfig);
}

/**
 * 批量重新布线：对所有连线按指定策略重新规划路径
 *
 * 按连线长度排序（短连线优先），逐步重新路由以减少相互影响。
 *
 * @param wires - 连线列表
 * @param components - 元件列表
 * @param config - 布线配置
 * @returns 更新后的连线数组
 *
 * @example
 * ```ts
 * const newWires = batchAutoRoute(wires, components, { strategy: 'fewestBends' });
 * ```
 */
export function batchAutoRoute(
  wires: Wire[],
  components: CircuitComponent[],
  config: Partial<AutoRouteConfig> = {}
): Wire[] {
  if (wires.length === 0) return wires;

  const finalConfig = { ...DEFAULT_AUTO_ROUTE_CONFIG, ...config };

  // 按长度排序，短连线优先路由
  const sorted = [...wires].sort((a, b) => {
    const lenA = calculateManhattanLength(a.points);
    const lenB = calculateManhattanLength(b.points);
    return lenA - lenB;
  });

  const excludeAllIds = new Set<string>();
  for (const wire of sorted) {
    excludeAllIds.add(wire.fromComponentId);
    excludeAllIds.add(wire.toComponentId);
  }
  const baseObstacles = extractObstacles(components, excludeAllIds, finalConfig.obstaclePadding);

  return sorted.map((wire) => {
    const fromComp = components.find((c) => c.id === wire.fromComponentId);
    const toComp = components.find((c) => c.id === wire.toComponentId);
    if (!fromComp || !toComp) return wire;

    const fromPos = getPortAbsolutePosition(fromComp, wire.fromPortId);
    const toPos = getPortAbsolutePosition(toComp, wire.toPortId);
    if (!fromPos || !toPos) return wire;

    const newPath = autoRoute(fromPos, toPos, baseObstacles, finalConfig);

    if (newPath.length >= 2) {
      return { ...wire, points: newPath };
    }
    return wire;
  });
}

/**
 * 为已有的连线统计布线质量报告
 *
 * @param wires - 连线列表
 * @returns 布线质量统计
 *
 * @example
 * ```ts
 * const report = getRoutingReport(wires);
 * console.log(`总长度: ${report.totalLength}, 总弯折: ${report.totalBends}`);
 * ```
 */
export function getRoutingReport(wires: Wire[]): {
  totalLength: number;
  totalBends: number;
  averageLength: number;
  averageBends: number;
  wireCount: number;
} {
  let totalLength = 0;
  let totalBends = 0;

  for (const wire of wires) {
    totalLength += calculateManhattanLength(wire.points);
    totalBends += countBends(wire.points);
  }

  return {
    totalLength,
    totalBends,
    averageLength: wires.length > 0 ? totalLength / wires.length : 0,
    averageBends: wires.length > 0 ? totalBends / wires.length : 0,
    wireCount: wires.length,
  };
}
