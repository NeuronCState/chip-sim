/**
 * wireCrossing.ts - 连线交叉处理模块
 *
 * 提供连线交叉检测与处理功能，包括：
 * - 连线交叉点检测
 * - 跳线标记（半圆弧）生成
 * - 总线简化（多条并行线合并为总线表示）
 *
 * @module wireCrossing
 * @author chip-sim
 */

import type { Point, Wire, WirePoint } from '../types/circuit';

// ==================== 类型定义 ====================

/**
 * 交叉点信息
 * 描述两条连线段的交叉位置
 */
export interface CrossingPoint {
  /** 交叉坐标 */
  position: Point;
  /** 第一条连线 ID */
  wireId1: string;
  /** 第二条连线 ID */
  wireId2: string;
  /** 交叉点在 wire1 中的线段索引 */
  segmentIndex1: number;
  /** 交叉点在 wire2 中的线段索引 */
  segmentIndex2: number;
}

/**
 * 跳线标记（半圆弧）
 * 用于视觉上区分"连接"和"交叉但不连接"的连线
 */
export interface JumperArc {
  /** 弧线中心 */
  center: Point;
  /** 半径 */
  radius: number;
  /** 起始角度（弧度） */
  startAngle: number;
  /** 结束角度（弧度） */
  endAngle: number;
  /** 弧线上的路径点（用于 SVG path 或 Canvas 绘制） */
  pathPoints: Point[];
  /** 需要"跳过"的连线 ID（上方的线） */
  overWireId: string;
  /** 被跨越的连线 ID（下方的线） */
  underWireId: string;
}

/**
 * 并行线组
 * 一组在空间上近似平行的连线
 */
export interface ParallelGroup {
  /** 组内连线 ID */
  wireIds: string[];
  /** 组的起始位置（平均） */
  fromPosition: Point;
  /** 组的终点位置（平均） */
  toPosition: Point;
  /** 平均间距 */
  averageSpacing: number;
  /** 方向：'horizontal' | 'vertical' */
  direction: 'horizontal' | 'vertical';
}

/**
 * 总线表示
 * 将多条并行线简化为一条总线
 */
export interface BusRepresentation {
  /** 总线的连线 ID */
  id: string;
  /** 总线路径点 */
  points: WirePoint[];
  /** 包含的原始连线 ID */
  originalWireIds: string[];
  /** 总线宽度（信号数量） */
  width: number;
  /** 标签文本 */
  label: string;
}

/**
 * 交叉检测配置
 */
export interface CrossingConfig {
  /** 交叉检测容差（像素） */
  tolerance: number;
  /** 跳线弧半径 */
  jumperRadius: number;
  /** 并行检测容差（像素） */
  parallelTolerance: number;
  /** 最小并行距离 */
  minParallelDistance: number;
  /** 最小并行线数（才能组成总线） */
  minParallelCount: number;
}

/** 默认交叉检测配置 */
export const DEFAULT_CROSSING_CONFIG: CrossingConfig = {
  tolerance: 2,
  jumperRadius: 6,
  parallelTolerance: 15,
  minParallelDistance: 10,
  minParallelCount: 3,
};

// ==================== 交叉检测 ====================

/**
 * 检测水平线段与垂直线段的交叉点
 *
 * @param hFrom - 水平线段起点
 * @param hTo - 水平线段终点
 * @param vFrom - 垂直线段起点
 * @param vTo - 垂直线段终点
 * @param tolerance - 容差
 * @returns 交叉点坐标，如果不交叉返回 null
 */
function segmentCrossingHV(
  hFrom: Point, hTo: Point,
  vFrom: Point, vTo: Point,
  tolerance: number
): Point | null {
  const hMinX = Math.min(hFrom.x, hTo.x);
  const hMaxX = Math.max(hFrom.x, hTo.x);
  const hY = hFrom.y;

  const vMinY = Math.min(vFrom.y, vTo.y);
  const vMaxY = Math.max(vFrom.y, vTo.y);
  const vX = vFrom.x;

  // 检查交叉条件
  if (vX >= hMinX - tolerance && vX <= hMaxX + tolerance &&
      hY >= vMinY - tolerance && hY <= vMaxY + tolerance) {
    return { x: vX, y: hY };
  }

  return null;
}

/**
 * 判断线段是否近似水平
 *
 * @param from - 起点
 * @param to - 终点
 * @param tolerance - 容差
 * @returns 是否水平
 */
function isHorizontal(from: Point, to: Point, tolerance: number): boolean {
  return Math.abs(from.y - to.y) <= tolerance;
}

/**
 * 判断线段是否近似垂直
 *
 * @param from - 起点
 * @param to - 终点
 * @param tolerance - 容差
 * @returns 是否垂直
 */
function isVertical(from: Point, to: Point, tolerance: number): boolean {
  return Math.abs(from.x - to.x) <= tolerance;
}

/**
 * 检测两条连线的所有交叉点
 *
 * 对两条连线的每一段进行水平/垂直交叉检测。
 *
 * @param wire1 - 第一条连线
 * @param wire2 - 第二条连线
 * @param config - 配置
 * @returns 交叉点数组
 *
 * @example
 * ```ts
 * const crossings = detectWireCrossings(wire1, wire2);
 * console.log(`发现 ${crossings.length} 个交叉点`);
 * ```
 */
export function detectWireCrossings(
  wire1: Wire,
  wire2: Wire,
  config: Partial<CrossingConfig> = {}
): CrossingPoint[] {
  const finalConfig = { ...DEFAULT_CROSSING_CONFIG, ...config };
  const crossings: CrossingPoint[] = [];

  for (let i = 0; i < wire1.points.length - 1; i++) {
    const p1a = wire1.points[i];
    const p1b = wire1.points[i + 1];

    const h1 = isHorizontal(p1a, p1b, finalConfig.tolerance);
    const v1 = isVertical(p1a, p1b, finalConfig.tolerance);

    // 跳过非水平/垂直线段
    if (!h1 && !v1) continue;

    for (let j = 0; j < wire2.points.length - 1; j++) {
      const p2a = wire2.points[j];
      const p2b = wire2.points[j + 1];

      const h2 = isHorizontal(p2a, p2b, finalConfig.tolerance);
      const v2 = isVertical(p2a, p2b, finalConfig.tolerance);

      if (!h2 && !v2) continue;

      // 只检测水平-垂直交叉
      let crossPoint: Point | null = null;

      if (h1 && v2) {
        crossPoint = segmentCrossingHV(p1a, p1b, p2a, p2b, finalConfig.tolerance);
      } else if (v1 && h2) {
        crossPoint = segmentCrossingHV(p2a, p2b, p1a, p1b, finalConfig.tolerance);
      }

      if (crossPoint) {
        crossings.push({
          position: crossPoint,
          wireId1: wire1.id,
          wireId2: wire2.id,
          segmentIndex1: i,
          segmentIndex2: j,
        });
      }
    }
  }

  return crossings;
}

/**
 * 检测所有连线的交叉点
 *
 * @param wires - 连线列表
 * @param config - 配置
 * @returns 所有交叉点数组
 *
 * @example
 * ```ts
 * const allCrossings = detectAllCrossings(wires);
 * console.log(`电路中共有 ${allCrossings.length} 个交叉点`);
 * ```
 */
export function detectAllCrossings(
  wires: Wire[],
  config: Partial<CrossingConfig> = {}
): CrossingPoint[] {
  const allCrossings: CrossingPoint[] = [];

  for (let i = 0; i < wires.length; i++) {
    for (let j = i + 1; j < wires.length; j++) {
      const crossings = detectWireCrossings(wires[i], wires[j], config);
      allCrossings.push(...crossings);
    }
  }

  return allCrossings;
}

// ==================== 跳线标记 ====================

/**
 * 为交叉点生成跳线弧（半圆弧）
 *
 * 跳线弧用于视觉上表示"一条线跨越另一条线但不连接"。
 * 弧线在交叉点处将上方的线"抬高"，形成半圆跳过下方的线。
 *
 * @param crossing - 交叉点信息
 * @param config - 配置
 * @returns 跳线弧信息
 *
 * @example
 * ```ts
 * const arc = generateJumperArc(crossing);
 * // 用 arc.pathPoints 绘制 SVG path
 * ```
 */
export function generateJumperArc(
  crossing: CrossingPoint,
  config: Partial<CrossingConfig> = {}
): JumperArc {
  const finalConfig = { ...DEFAULT_CROSSING_CONFIG, ...config };
  const { position } = crossing;
  const radius = finalConfig.jumperRadius;

  // 确定弧线方向：基于 wire1 的走向
  // 如果 wire1 的该段是水平的，弧线向上跳（在水平线上方画弧）
  // 如果 wire1 的该段是垂直的，弧线向右跳

  // 默认向上跳（半圆弧在上方）
  const startAngle = Math.PI; // 180度
  const endAngle = 0; // 0度

  // 生成弧线上的路径点（用于 Canvas 绘制）
  const pathPoints: Point[] = [];
  const steps = 12; // 弧线精度

  for (let k = 0; k <= steps; k++) {
    const angle = startAngle + (endAngle - startAngle) * (k / steps);
    pathPoints.push({
      x: position.x + radius * Math.cos(angle),
      y: position.y + radius * Math.sin(angle),
    });
  }

  return {
    center: position,
    radius,
    startAngle,
    endAngle,
    pathPoints,
    overWireId: crossing.wireId1,
    underWireId: crossing.wireId2,
  };
}

/**
 * 为所有交叉点生成跳线弧
 *
 * @param crossings - 交叉点数组
 * @param config - 配置
 * @returns 跳线弧数组
 */
export function generateAllJumperArcs(
  crossings: CrossingPoint[],
  config: Partial<CrossingConfig> = {}
): JumperArc[] {
  return crossings.map((c) => generateJumperArc(c, config));
}

/**
 * 生成跳线弧的 SVG path 字符串
 *
 * @param arc - 跳线弧
 * @returns SVG path 字符串
 *
 * @example
 * ```ts
 * const arc = generateJumperArc(crossing);
 * const pathD = jumperArcToSVG(arc);
 * // => "M 100 200 A 6 6 0 0 1 106 200"
 * ```
 */
export function jumperArcToSVG(arc: JumperArc): string {
  const { center, radius } = arc;
  // SVG arc: 从左侧到右侧的半圆弧
  const startX = center.x - radius;
  const endX = center.x + radius;
  const y = center.y;

  return `M ${startX} ${y} A ${radius} ${radius} 0 0 1 ${endX} ${y}`;
}

// ==================== 并行线检测 ====================

/**
 * 判断两条线段是否近似平行且共线
 *
 * @param seg1a - 线段1起点
 * @param seg1b - 线段1终点
 * @param seg2a - 线段2起点
 * @param seg2b - 线段2终点
 * @param tolerance - 容差
 * @returns 是否平行
 */
function segmentsAreParallel(
  seg1a: Point, seg1b: Point,
  seg2a: Point, seg2b: Point,
  tolerance: number
): { parallel: boolean; direction: 'horizontal' | 'vertical'; spacing: number } | null {
  const h1 = isHorizontal(seg1a, seg1b, tolerance);
  const v1 = isVertical(seg1a, seg1b, tolerance);
  const h2 = isHorizontal(seg2a, seg2b, tolerance);
  const v2 = isVertical(seg2a, seg2b, tolerance);

  if (h1 && h2) {
    const spacing = Math.abs(seg1a.y - seg2a.y);
    return { parallel: true, direction: 'horizontal', spacing };
  }

  if (v1 && v2) {
    const spacing = Math.abs(seg1a.x - seg2a.x);
    return { parallel: true, direction: 'vertical', spacing };
  }

  return null;
}

/**
 * 检测并行连线组
 *
 * 找出空间上近似平行的连线组，可用于总线简化。
 * 判断标准：两条连线至少有一段平行且间距在容差范围内。
 *
 * @param wires - 连线列表
 * @param config - 配置
 * @returns 并行线组数组
 *
 * @example
 * ```ts
 * const groups = detectParallelGroups(wires);
 * for (const group of groups) {
 *   console.log(`发现 ${group.wireIds.length} 条并行线`);
 * }
 * ```
 */
export function detectParallelGroups(
  wires: Wire[],
  config: Partial<CrossingConfig> = {}
): ParallelGroup[] {
  const finalConfig = { ...DEFAULT_CROSSING_CONFIG, ...config };

  // 构建连线之间的并行关系图
  const adjacency = new Map<string, Set<string>>();
  const pairInfo = new Map<string, { direction: 'horizontal' | 'vertical'; spacing: number }>();

  for (let i = 0; i < wires.length; i++) {
    for (let j = i + 1; j < wires.length; j++) {
      const w1 = wires[i];
      const w2 = wires[j];

      // 检查两线是否有并行段
      let foundParallel = false;
      let direction: 'horizontal' | 'vertical' = 'horizontal';
      let totalSpacing = 0;
      let count = 0;

      for (let a = 0; a < w1.points.length - 1; a++) {
        for (let b = 0; b < w2.points.length - 1; b++) {
          const result = segmentsAreParallel(
            w1.points[a], w1.points[a + 1],
            w2.points[b], w2.points[b + 1],
            finalConfig.parallelTolerance
          );

          if (result && result.spacing >= finalConfig.minParallelDistance) {
            foundParallel = true;
            direction = result.direction;
            totalSpacing += result.spacing;
            count++;
          }
        }
      }

      if (foundParallel && count > 0) {
        const pairKey = `${w1.id}-${w2.id}`;
        pairInfo.set(pairKey, { direction, spacing: totalSpacing / count });

        if (!adjacency.has(w1.id)) adjacency.set(w1.id, new Set());
        if (!adjacency.has(w2.id)) adjacency.set(w2.id, new Set());
        adjacency.get(w1.id)!.add(w2.id);
        adjacency.get(w2.id)!.add(w1.id);
      }
    }
  }

  // 使用 BFS 找到连通分量（即并行组）
  const visited = new Set<string>();
  const groups: ParallelGroup[] = [];

  for (const wire of wires) {
    if (visited.has(wire.id)) continue;
    if (!adjacency.has(wire.id)) continue;

    const group: string[] = [];
    const queue = [wire.id];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      group.push(current);

      const neighbors = adjacency.get(current);
      if (neighbors) {
        neighbors.forEach((neighbor) => {
          if (!visited.has(neighbor)) {
            queue.push(neighbor);
          }
        });
      }
    }

    if (group.length >= 2) {
      // 计算组的统计信息
      const groupWires = group.map((id) => wires.find((w) => w.id === id)!).filter(Boolean);

      // 计算平均起点和终点
      let avgFromX = 0, avgFromY = 0, avgToX = 0, avgToY = 0;
      let totalSpacing = 0;
      let spacingCount = 0;
      let dir: 'horizontal' | 'vertical' = 'horizontal';

      for (const w of groupWires) {
        if (w.points.length >= 2) {
          avgFromX += w.points[0].x;
          avgFromY += w.points[0].y;
          avgToX += w.points[w.points.length - 1].x;
          avgToY += w.points[w.points.length - 1].y;
        }
      }

      pairInfo.forEach((info, key) => {
        const [id1, id2] = key.split('-');
        if (group.includes(id1) && group.includes(id2)) {
          totalSpacing += info.spacing;
          spacingCount++;
          dir = info.direction;
        }
      });

      groups.push({
        wireIds: group,
        fromPosition: {
          x: avgFromX / groupWires.length,
          y: avgFromY / groupWires.length,
        },
        toPosition: {
          x: avgToX / groupWires.length,
          y: avgToY / groupWires.length,
        },
        averageSpacing: spacingCount > 0 ? totalSpacing / spacingCount : 0,
        direction: dir,
      });
    }
  }

  return groups;
}

// ==================== 总线简化 ====================

/**
 * 生成总线标签
 *
 * @param wireIds - 连线 ID 数组
 * @param wireNameMap - 连线 ID 到名称的映射
 * @returns 总线标签文本
 */
function generateBusLabel(
  wireIds: string[],
  wireNameMap: Map<string, string>
): string {
  const names = wireIds
    .map((id) => wireNameMap.get(id))
    .filter(Boolean) as string[];

  if (names.length === 0) {
    return `BUS[${wireIds.length}:0]`;
  }

  // 尝试找到命名模式（如 D0, D1, D2 -> D[2:0]）
  const pattern = /^([A-Za-z_]+)(\d+)$/;
  const matched: { prefix: string; num: number }[] = [];

  for (const name of names) {
    const m = name.match(pattern);
    if (m) {
      matched.push({ prefix: m[1], num: parseInt(m[2], 10) });
    }
  }

  if (matched.length === names.length) {
    const prefixes = new Set(matched.map((m) => m.prefix));
    if (prefixes.size === 1) {
      const prefix = Array.from(prefixes)[0];
      const nums = matched.map((m) => m.num).sort((a, b) => a - b);
      return `${prefix}[${nums[nums.length - 1]}:${nums[0]}]`;
    }
  }

  return `BUS[${wireIds.length}:0]`;
}

/**
 * 将并行线组简化为总线表示
 *
 * 将一组平行连线合并为一条总线路径，减少视觉复杂度。
 *
 * @param group - 并行线组
 * @param wires - 所有连线
 * @param wireNameMap - 连线名称映射
 * @returns 总线表示
 *
 * @example
 * ```ts
 * const groups = detectParallelGroups(wires);
 * for (const group of groups) {
 *   if (group.wireIds.length >= 4) {
 *     const bus = simplifyToBus(group, wires, nameMap);
 *     console.log(`总线 ${bus.label} 包含 ${bus.width} 条信号`);
 *   }
 * }
 * ```
 */
export function simplifyToBus(
  group: ParallelGroup,
  wires: Wire[],
  wireNameMap: Map<string, string> = new Map()
): BusRepresentation {
  // 收集组内所有连线的路径点
  const groupWires = group.wireIds
    .map((id) => wires.find((w) => w.id === id))
    .filter(Boolean) as Wire[];

  // 使用平均路径作为总线路径
  const maxLen = Math.max(...groupWires.map((w) => w.points.length));
  const busPoints: WirePoint[] = [];

  for (let i = 0; i < maxLen; i++) {
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    let hasBend = false;

    for (const w of groupWires) {
      if (i < w.points.length) {
        sumX += w.points[i].x;
        sumY += w.points[i].y;
        count++;
        if (w.points[i].isBend) hasBend = true;
      }
    }

    if (count > 0) {
      busPoints.push({
        x: Math.round(sumX / count),
        y: Math.round(sumY / count),
        isBend: hasBend,
      });
    }
  }

  return {
    id: `bus-${group.wireIds.join('-')}`,
    points: busPoints,
    originalWireIds: group.wireIds,
    width: group.wireIds.length,
    label: generateBusLabel(group.wireIds, wireNameMap),
  };
}

/**
 * 自动简化并行线为总线
 *
 * 检测所有满足条件的并行线组，并将它们转换为总线表示。
 *
 * @param wires - 连线列表
 * @param wireNameMap - 连线名称映射
 * @param config - 配置
 * @returns 总线表示数组
 *
 * @example
 * ```ts
 * const buses = autoSimplifyBuses(wires);
 * // 在画布上用粗线渲染 buses
 * ```
 */
export function autoSimplifyBuses(
  wires: Wire[],
  wireNameMap: Map<string, string> = new Map(),
  config: Partial<CrossingConfig> = {}
): BusRepresentation[] {
  const finalConfig = { ...DEFAULT_CROSSING_CONFIG, ...config };
  const groups = detectParallelGroups(wires, config);

  return groups
    .filter((g) => g.wireIds.length >= finalConfig.minParallelCount)
    .map((g) => simplifyToBus(g, wires, wireNameMap));
}

// ==================== 统计 ====================

/**
 * 交叉统计报告
 */
export interface CrossingReport {
  /** 总交叉数 */
  totalCrossings: number;
  /** 涉及交叉的连线数 */
  wiresWithCrossings: number;
  /** 交叉最多的连线 ID */
  mostCrossedWireId: string | null;
  /** 该连线的交叉数 */
  mostCrossedCount: number;
}

/**
 * 生成交叉统计报告
 *
 * @param wires - 连线列表
 * @param config - 配置
 * @returns 交叉统计报告
 */
export function getCrossingReport(
  wires: Wire[],
  config: Partial<CrossingConfig> = {}
): CrossingReport {
  const crossings = detectAllCrossings(wires, config);

  const wireCrossCount = new Map<string, number>();
  for (const c of crossings) {
    wireCrossCount.set(c.wireId1, (wireCrossCount.get(c.wireId1) ?? 0) + 1);
    wireCrossCount.set(c.wireId2, (wireCrossCount.get(c.wireId2) ?? 0) + 1);
  }

  let mostCrossedWireId: string | null = null;
  let mostCrossedCount = 0;
  wireCrossCount.forEach((count, id) => {
    if (count > mostCrossedCount) {
      mostCrossedCount = count;
      mostCrossedWireId = id;
    }
  });

  return {
    totalCrossings: crossings.length,
    wiresWithCrossings: wireCrossCount.size,
    mostCrossedWireId,
    mostCrossedCount,
  };
}
