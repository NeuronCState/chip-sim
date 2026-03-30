/**
 * 连线路径计算
 * 支持直线、正交（直角折线）和 45 度斜线三种路径模式
 * 增强：支持智能曼哈顿路径规划（A* 避障）
 */

import type { Point, WirePoint, WireRouting } from '../../types/circuit';

// 重新导出智能路由模块的类型和函数
export {
  findManhattanPath,
  findDiagonal45Path,
  findPath,
  routeSmartWire,
  routeWireByPorts,
  extractObstacles,
  DEFAULT_ROUTING_CONFIG,
  type GridObstacle,
  type RoutingConfig,
} from './SmartRouter';

/**
 * 计算连线路径点
 * @param from 起点
 * @param to 终点
 * @param routing 路径模式
 */
export function calculateWirePoints(
  from: Point,
  to: Point,
  routing: WireRouting
): WirePoint[] {
  if (routing === 'straight') {
    return [
      { x: from.x, y: from.y },
      { x: to.x, y: to.y },
    ];
  }

  if (routing === 'diagonal45') {
    return calculateDiagonal45Points(from, to);
  }

  // 正交折线：L 形或 Z 形
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  // 如果两点几乎在同一水平或垂直线上，用直线
  if (Math.abs(dy) < 5) {
    return [
      { x: from.x, y: from.y },
      { x: to.x, y: to.y },
    ];
  }
  if (Math.abs(dx) < 5) {
    return [
      { x: from.x, y: from.y },
      { x: to.x, y: to.y },
    ];
  }

  // 中间拐点：水平走一半再垂直走
  const midX = from.x + dx / 2;
  return [
    { x: from.x, y: from.y },
    { x: midX, y: from.y, isBend: true },
    { x: midX, y: to.y, isBend: true },
    { x: to.x, y: to.y },
  ];
}

/**
 * 计算 45 度对角线路径点
 * 路径：水平 → 45度斜线 → 垂直，或直接斜线
 */
function calculateDiagonal45Points(from: Point, to: Point): WirePoint[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // 同一直线
  if (absDx < 5 || absDy < 5) {
    return [
      { x: from.x, y: from.y },
      { x: to.x, y: to.y },
    ];
  }

  // 45 度斜线可以直接到达
  if (Math.abs(absDx - absDy) < 5) {
    return [
      { x: from.x, y: from.y },
      { x: to.x, y: to.y },
    ];
  }

  // 计算 45 度段的长度
  const diagLen = Math.min(absDx, absDy);
  const signX = dx > 0 ? 1 : -1;
  const signY = dy > 0 ? 1 : -1;

  // 方案选择：水平 + 45度 + 垂直
  if (absDx >= absDy) {
    // 更宽：水平段 → 45度 → 可能的水平段
    const hLen = absDx - diagLen;
    const mid1X = from.x + signX * hLen;
    const mid2X = to.x;

    return [
      { x: from.x, y: from.y },
      { x: mid1X, y: from.y, isBend: true },
      { x: mid2X, y: to.y, isBend: true },
      { x: to.x, y: to.y },
    ];
  } else {
    // 更高：垂直段 → 45度 → 可能的垂直段
    const vLen = absDy - diagLen;
    const mid1Y = from.y + signY * vLen;

    return [
      { x: from.x, y: from.y },
      { x: from.x, y: mid1Y, isBend: true },
      { x: to.x, y: to.y, isBend: true },
      { x: to.x, y: to.y },
    ];
  }
}

/**
 * 计算点到线段的最短距离
 */
export function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return Math.hypot(px - x1, py - y1);
  }

  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const projX = x1 + t * dx;
  const projY = y1 + t * dy;

  return Math.hypot(px - projX, py - projY);
}

/**
 * 计算鼠标位置到连线的最短距离
 */
export function distanceToWire(
  mouseX: number,
  mouseY: number,
  points: WirePoint[]
): number {
  if (points.length < 2) return Infinity;

  let minDist = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const dist = distanceToSegment(
      mouseX,
      mouseY,
      points[i].x,
      points[i].y,
      points[i + 1].x,
      points[i + 1].y
    );
    minDist = Math.min(minDist, dist);
  }
  return minDist;
}

/**
 * 根据旋转角度变换端口偏移量
 */
export function rotateOffset(offset: Point, rotation: number): Point {
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: offset.x * cos - offset.y * sin,
    y: offset.x * sin + offset.y * cos,
  };
}
