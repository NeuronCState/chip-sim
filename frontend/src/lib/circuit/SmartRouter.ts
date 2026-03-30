/**
 * 智能连线路径规划模块
 * 基于 A* 算法的曼哈顿路径规划，支持障碍物避让
 */

import type { Point, WirePoint, CircuitComponent } from '../../types/circuit';
import { getPortAbsolutePosition } from './circuit-utils';

// ==================== 类型定义 ====================

/** 网格障碍物 */
export interface GridObstacle {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** 障碍物所属元件 ID（用于调试） */
  componentId?: string;
}

/** A* 节点 */
interface AStarNode {
  x: number;
  y: number;
  g: number; // 起点到当前节点的实际代价
  h: number; // 启发式估计到终点的代价
  f: number; // g + h
  parent: AStarNode | null;
}

/** 路径规划配置 */
export interface RoutingConfig {
  /** 网格步长（像素） */
  gridSize: number;
  /** 最大搜索节点数（防止无限搜索） */
  maxIterations: number;
  /** 元件避让边距（像素） */
  obstaclePadding: number;
  /** 搜索边界扩展（像素） */
  searchMargin: number;
  /** 拐点惩罚系数（越高越倾向直线） */
  bendCost: number;
  /** 是否允许对角线（45度斜线） */
  allowDiagonal: boolean;
  /** 路径模式：'manhattan' | 'diagonal45' */
  routingMode?: 'manhattan' | 'diagonal45';
}

/** 默认路径规划配置 */
export const DEFAULT_ROUTING_CONFIG: RoutingConfig = {
  gridSize: 10,
  maxIterations: 50000,
  obstaclePadding: 15,
  searchMargin: 80,
  bendCost: 2,
  allowDiagonal: false,
};

// ==================== 核心工具函数 ====================

/** 将坐标量化到网格 */
function snapToGridCoord(val: number, gridSize: number): number {
  return Math.round(val / gridSize) * gridSize;
}

/** 生成网格节点的哈希键 */
function nodeKey(x: number, y: number): string {
  return `${x},${y}`;
}

/** 计算曼哈顿距离（启发函数） */
function manhattanDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** 判断线段是否穿越障碍物 */
function segmentCrossesObstacle(
  x1: number, y1: number,
  x2: number, y2: number,
  obstacles: GridObstacle[]
): boolean {
  for (const obs of obstacles) {
    // 使用线段与矩形的相交检测
    if (segmentIntersectsRect(x1, y1, x2, y2, obs)) {
      return true;
    }
  }
  return false;
}

/** 线段与矩形相交检测 */
function segmentIntersectsRect(
  x1: number, y1: number,
  x2: number, y2: number,
  rect: GridObstacle
): boolean {
  // 如果线段完全在矩形外，不相交
  const segMinX = Math.min(x1, x2);
  const segMaxX = Math.max(x1, x2);
  const segMinY = Math.min(y1, y2);
  const segMaxY = Math.max(y1, y2);

  // 快速 AABB 排除
  if (segMaxX < rect.minX || segMinX > rect.maxX || segMaxY < rect.minY || segMinY > rect.maxY) {
    return false;
  }

  // 水平线段：检查 y 在矩形范围内且 x 区间重叠
  if (y1 === y2) {
    return y1 > rect.minY && y1 < rect.maxY && segMaxX > rect.minX && segMinX < rect.maxX;
  }

  // 垂直线段：检查 x 在矩形范围内且 y 区间重叠
  if (x1 === x2) {
    return x1 > rect.minX && x1 < rect.maxX && segMaxY > rect.minY && segMinY < rect.maxY;
  }

  // 非轴对齐线段（理论上曼哈顿路径不会出现，但作为安全措施）
  return true;
}

// ==================== 障碍物提取 ====================

/**
 * 从元件列表提取障碍物区域
 * @param components 元件列表
 * @param excludeIds 排除的元件 ID（连线的起止元件不需要避让）
 * @param padding 额外边距
 */
export function extractObstacles(
  components: CircuitComponent[],
  excludeIds: Set<string> = new Set(),
  padding: number = 15
): GridObstacle[] {
  const obstacles: GridObstacle[] = [];

  for (const comp of components) {
    if (excludeIds.has(comp.id)) continue;

    // 元件的包围盒（考虑旋转）
    const hw = 30 + padding; // 半宽
    const hh = 20 + padding; // 半高

    const rad = (comp.rotation * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));

    // 旋转后的 AABB
    const aabbW = hw * cos + hh * sin;
    const aabbH = hw * sin + hh * cos;

    obstacles.push({
      minX: comp.position.x - aabbW,
      minY: comp.position.y - aabbH,
      maxX: comp.position.x + aabbW,
      maxY: comp.position.y + aabbH,
      componentId: comp.id,
    });
  }

  return obstacles;
}

// ==================== A* 路径规划 ====================

/**
 * A* 曼哈顿路径规划
 * 从起点到终点，找到不穿越障碍物的最短曼哈顿路径
 *
 * @param from 起点
 * @param to 终点
 * @param obstacles 障物列表
 * @param config 路径规划配置
 * @returns 路径点数组（WirePoint 格式），如果找不到路径返回空数组
 */
export function findManhattanPath(
  from: Point,
  to: Point,
  obstacles: GridObstacle[],
  config: RoutingConfig = DEFAULT_ROUTING_CONFIG
): WirePoint[] {
  const { gridSize, maxIterations, searchMargin, bendCost } = config;

  // 量化起点和终点到网格
  const startX = snapToGridCoord(from.x, gridSize);
  const startY = snapToGridCoord(from.y, gridSize);
  const endX = snapToGridCoord(to.x, gridSize);
  const endY = snapToGridCoord(to.y, gridSize);

  // 快速路径：如果起点和终点很近，且没有障碍物，直接直线
  const directDist = manhattanDistance({ x: startX, y: startY }, { x: endX, y: endY });
  if (directDist < gridSize * 3) {
    if (!segmentCrossesObstacle(startX, startY, endX, endY, obstacles)) {
      // 检查是直线还是 L 形
      if (startX === endX || startY === endY) {
        return [
          { x: from.x, y: from.y },
          { x: to.x, y: to.y },
        ];
      }
      // L 形路径
      const midX = snapToGridCoord((from.x + to.x) / 2, gridSize);
      return [
        { x: from.x, y: from.y },
        { x: midX, y: from.y, isBend: true },
        { x: midX, y: to.y, isBend: true },
        { x: to.x, y: to.y },
      ];
    }
  }

  // 搜索边界
  const allX = [startX, endX, ...obstacles.map(o => o.minX), ...obstacles.map(o => o.maxX)];
  const allY = [startY, endY, ...obstacles.map(o => o.minY), ...obstacles.map(o => o.maxY)];
  const boundMinX = Math.min(...allX) - searchMargin;
  const boundMaxX = Math.max(...allX) + searchMargin;
  const boundMinY = Math.min(...allY) - searchMargin;
  const boundMaxY = Math.max(...allY) + searchMargin;

  // A* 初始化
  const openList: AStarNode[] = [];
  const closedSet = new Set<string>();
  const gScores = new Map<string, number>();

  const startNode: AStarNode = {
    x: startX,
    y: startY,
    g: 0,
    h: manhattanDistance({ x: startX, y: startY }, { x: endX, y: endY }),
    f: 0,
    parent: null,
  };
  startNode.f = startNode.g + startNode.h;

  openList.push(startNode);
  gScores.set(nodeKey(startX, startY), 0);

  // 曼哈顿方向：上、下、左、右
  const directions = [
    { dx: 0, dy: -gridSize },
    { dx: 0, dy: gridSize },
    { dx: -gridSize, dy: 0 },
    { dx: gridSize, dy: 0 },
  ];

  let iterations = 0;

  while (openList.length > 0 && iterations < maxIterations) {
    iterations++;

    // 找到 f 值最小的节点（简单实现，可用优先队列优化）
    let bestIdx = 0;
    for (let i = 1; i < openList.length; i++) {
      if (openList[i].f < openList[bestIdx].f) {
        bestIdx = i;
      }
    }

    const current = openList[bestIdx];
    openList.splice(bestIdx, 1);

    const key = nodeKey(current.x, current.y);

    // 到达终点
    if (current.x === endX && current.y === endY) {
      return reconstructPath(current, from, to);
    }

    closedSet.add(key);

    // 探索邻居
    for (const dir of directions) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      const nkey = nodeKey(nx, ny);

      // 边界检查
      if (nx < boundMinX || nx > boundMaxX || ny < boundMinY || ny > boundMaxY) {
        continue;
      }

      // 已关闭
      if (closedSet.has(nkey)) {
        continue;
      }

      // 障碍物检查：检查从 current 到 neighbor 的线段是否穿越障碍
      if (segmentCrossesObstacle(current.x, current.y, nx, ny, obstacles)) {
        continue;
      }

      // 计算代价
      const moveCost = gridSize;
      // 拐点惩罚：如果方向改变，增加代价
      const isBending = current.parent !== null &&
        ((dir.dx !== 0 && current.x - current.parent.x === 0) ||
         (dir.dy !== 0 && current.y - current.parent.y === 0));
      const totalCost = current.g + moveCost + (isBending ? bendCost : 0);

      const existingG = gScores.get(nkey);
      if (existingG !== undefined && existingG <= totalCost) {
        continue;
      }

      gScores.set(nkey, totalCost);

      const h = manhattanDistance({ x: nx, y: ny }, { x: endX, y: endY });
      const neighbor: AStarNode = {
        x: nx,
        y: ny,
        g: totalCost,
        h,
        f: totalCost + h,
        parent: current,
      };

      openList.push(neighbor);
    }
  }

  // 找不到路径，返回简单的 Z 形路径（fallback）
  return generateFallbackPath(from, to, obstacles, gridSize);
}

/**
 * 从 A* 终端节点回溯路径
 */
function reconstructPath(
  endNode: AStarNode,
  originalFrom: Point,
  originalTo: Point
): WirePoint[] {
  const path: AStarNode[] = [];
  let current: AStarNode | null = endNode;

  while (current !== null) {
    path.unshift(current);
    current = current.parent;
  }

  if (path.length === 0) return [];

  // 将网格节点转换为 WirePoint，并标记拐点
  const wirePoints: WirePoint[] = [];

  // 第一个点用原始坐标（非量化）
  wirePoints.push({ x: originalFrom.x, y: originalFrom.y });

  // 简化路径：去除共线点
  const simplified = simplifyPath(path);

  for (let i = 1; i < simplified.length - 1; i++) {
    const prev = simplified[i - 1];
    const curr = simplified[i];
    const next = simplified[i + 1];

    const isBend = (prev.x === curr.x && curr.y === next.y) ||
                   (prev.y === curr.y && curr.x === next.x);

    wirePoints.push({ x: curr.x, y: curr.y, isBend });
  }

  // 最后一个点用原始坐标
  wirePoints.push({ x: originalTo.x, y: originalTo.y });

  return wirePoints;
}

/**
 * 简化路径：去除共线的中间点
 */
function simplifyPath(path: AStarNode[]): AStarNode[] {
  if (path.length <= 2) return path;

  const simplified: AStarNode[] = [path[0]];

  for (let i = 1; i < path.length - 1; i++) {
    const prev = simplified[simplified.length - 1];
    const curr = path[i];
    const next = path[i + 1];

    // 检查是否共线
    const horizontalBefore = prev.y === curr.y;
    const horizontalAfter = curr.y === next.y;
    const verticalBefore = prev.x === curr.x;
    const verticalAfter = curr.x === next.x;

    // 如果在同一方向上，跳过这个点
    if ((horizontalBefore && horizontalAfter) || (verticalBefore && verticalAfter)) {
      continue;
    }

    simplified.push(curr);
  }

  simplified.push(path[path.length - 1]);
  return simplified;
}

/**
 * Fallback 路径：当 A* 找不到路径时的备用方案
 * 尝试几种简单的 Z 形路径，选择不穿越障碍物的
 */
function generateFallbackPath(
  from: Point,
  to: Point,
  obstacles: GridObstacle[],
  gridSize: number
): WirePoint[] {
  // 尝试水平优先
  const midX1 = snapToGridCoord((from.x + to.x) / 2, gridSize);
  const path1 = [
    { x: from.x, y: from.y },
    { x: midX1, y: from.y, isBend: true },
    { x: midX1, y: to.y, isBend: true },
    { x: to.x, y: to.y },
  ];

  // 检查水平优先路径
  const crosses1 = path1.some((p, i) => {
    if (i === 0) return false;
    return segmentCrossesObstacle(path1[i - 1].x, path1[i - 1].y, p.x, p.y, obstacles);
  });

  if (!crosses1) return path1;

  // 尝试垂直优先
  const midY1 = snapToGridCoord((from.y + to.y) / 2, gridSize);
  const path2 = [
    { x: from.x, y: from.y },
    { x: from.x, y: midY1, isBend: true },
    { x: to.x, y: midY1, isBend: true },
    { x: to.x, y: to.y },
  ];

  const crosses2 = path2.some((p, i) => {
    if (i === 0) return false;
    return segmentCrossesObstacle(path2[i - 1].x, path2[i - 1].y, p.x, p.y, obstacles);
  });

  if (!crosses2) return path2;

  // 最后手段：绕远路
  const offset = 60;
  const path3 = [
    { x: from.x, y: from.y },
    { x: from.x + offset, y: from.y, isBend: true },
    { x: from.x + offset, y: to.y + offset, isBend: true },
    { x: to.x + offset, y: to.y + offset, isBend: true },
    { x: to.x + offset, y: to.y, isBend: true },
    { x: to.x, y: to.y },
  ];

  return path3;
}

// ==================== 45 度对角线路径规划 ====================

/**
 * 生成 45 度对角线路径
 * 支持水平、垂直和 45 度斜线组合，不穿越障碍物
 */
export function findDiagonal45Path(
  from: Point,
  to: Point,
  obstacles: GridObstacle[],
  config: RoutingConfig = DEFAULT_ROUTING_CONFIG
): WirePoint[] {
  const { gridSize } = config;

  const sx = snapToGridCoord(from.x, gridSize);
  const sy = snapToGridCoord(from.y, gridSize);
  const ex = snapToGridCoord(to.x, gridSize);
  const ey = snapToGridCoord(to.y, gridSize);

  const dx = ex - sx;
  const dy = ey - sy;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // 快速路径：同一直线
  if (sx === ex || sy === ey) {
    if (!segmentCrossesObstacle(sx, sy, ex, ey, obstacles)) {
      return [
        { x: from.x, y: from.y },
        { x: to.x, y: to.y },
      ];
    }
  }

  // 尝试几种 45 度路径方案，选择不穿越障碍物的
  const candidates: WirePoint[][] = [];

  // 方案1：先斜线再水平/垂直
  if (absDx > 0 && absDy > 0) {
    const diagLen = Math.min(absDx, absDy);
    const signX = dx > 0 ? 1 : -1;
    const signY = dy > 0 ? 1 : -1;

    const midX1 = sx + signX * diagLen;
    const midY1 = sy + signY * diagLen;

    const path1: WirePoint[] = [
      { x: from.x, y: from.y },
      { x: midX1, y: sy, isBend: true },
      { x: midX1, y: midY1, isBend: true },
      { x: ex, y: midY1, isBend: true },
      { x: to.x, y: to.y },
    ];

    // 简化为最少拐点
    if (midX1 === ex && midY1 === ey) {
      // 直接斜线
      path1.splice(1, 3, { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, isBend: true });
    } else if (midX1 === ex) {
      // 斜线+垂直
      path1.splice(3, 1);
    } else if (midY1 === ey) {
      // 水平+斜线
      path1.splice(1, 1);
    }

    candidates.push(path1);

    // 方案2：先水平再斜线
    const path2: WirePoint[] = [
      { x: from.x, y: from.y },
      { x: ex, y: sy, isBend: true },
      { x: to.x, y: to.y },
    ];
    candidates.push(path2);

    // 方案3：先垂直再斜线
    const path3: WirePoint[] = [
      { x: from.x, y: from.y },
      { x: sx, y: ey, isBend: true },
      { x: to.x, y: to.y },
    ];
    candidates.push(path3);
  }

  // 添加标准 L/Z 形 fallback
  const midX = snapToGridCoord((from.x + to.x) / 2, gridSize);
  candidates.push([
    { x: from.x, y: from.y },
    { x: midX, y: from.y, isBend: true },
    { x: midX, y: to.y, isBend: true },
    { x: to.x, y: to.y },
  ]);

  // 选择第一个不穿越障碍物的路径
  for (const path of candidates) {
    const crosses = path.some((p, i) => {
      if (i === 0) return false;
      return segmentCrossesObstacle(path[i - 1].x, path[i - 1].y, p.x, p.y, obstacles);
    });
    if (!crosses) return path;
  }

  // 全部穿越障碍物，使用 A* 曼哈顿路径作为 fallback
  return findManhattanPath(from, to, obstacles, config);
}

/**
 * 智能路径规划（统一接口）
 * 根据 routingMode 选择曼哈顿或 45 度对角线路径
 */
export function findPath(
  from: Point,
  to: Point,
  obstacles: GridObstacle[],
  config: RoutingConfig = DEFAULT_ROUTING_CONFIG
): WirePoint[] {
  if (config.routingMode === 'diagonal45' || config.allowDiagonal) {
    return findDiagonal45Path(from, to, obstacles, config);
  }
  return findManhattanPath(from, to, obstacles, config);
}

// ==================== 高级路径规划 ====================

/**
 * 智能连线路径规划（带元件避让）
 * 这是对外的主要接口
 *
 * @param from 起始端口
 * @param to 目标端口
 * @param components 所有元件列表
 * @param fromCompId 起始元件 ID
 * @param toCompId 目标元件 ID
 * @param config 可选配置覆盖
 * @returns 路径点数组
 */
export function routeSmartWire(
  from: Point,
  to: Point,
  components: CircuitComponent[],
  fromCompId: string,
  toCompId: string,
  config: Partial<RoutingConfig> = {}
): WirePoint[] {
  const finalConfig = { ...DEFAULT_ROUTING_CONFIG, ...config };

  // 提取障碍物（排除起止元件）
  const excludeIds = new Set([fromCompId, toCompId]);
  const obstacles = extractObstacles(components, excludeIds, finalConfig.obstaclePadding);

  return findPath(from, to, obstacles, finalConfig);
}

/**
 * 从元件和端口 ID 路由连线
 * 更便捷的接口
 */
export function routeWireByPorts(
  fromCompId: string,
  fromPortId: string,
  toCompId: string,
  toPortId: string,
  components: CircuitComponent[],
  config: Partial<RoutingConfig> = {}
): WirePoint[] {
  const fromComp = components.find(c => c.id === fromCompId);
  const toComp = components.find(c => c.id === toCompId);

  if (!fromComp || !toComp) return [];

  const fromPos = getPortAbsolutePosition(fromComp, fromPortId);
  const toPos = getPortAbsolutePosition(toComp, toPortId);

  if (!fromPos || !toPos) return [];

  return routeSmartWire(fromPos, toPos, components, fromCompId, toCompId, config);
}
