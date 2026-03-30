/**
 * snapToGrid.ts - 智能吸附模块
 *
 * 提供画布上的智能吸附功能，包括：
 * - 元件引脚自动对齐到网格
 * - 连线端点自动吸附到最近引脚
 * - 拖拽时预览连线路径
 * - 辅助线（guide lines）计算
 *
 * @module snapToGrid
 * @author chip-sim
 */

import type { Point, CircuitComponent, WirePoint, WireRouting } from '../types/circuit';
import { getAllPortPositions } from '../lib/circuit/circuit-utils';
import { calculateWirePoints } from '../lib/circuit/wire-routing';

// ==================== 类型定义 ====================

/**
 * 吸附目标信息
 * 描述一个吸附候选点的完整信息
 */
export interface SnapTarget {
  /** 吸附类型 */
  type: 'grid' | 'port' | 'center';
  /** 吸附到的坐标 */
  position: Point;
  /** 如果吸附到端口，包含端口信息 */
  portInfo?: {
    componentId: string;
    portId: string;
    /** 端口绝对坐标 */
    absolutePosition: Point;
  };
  /** 吸附距离（像素） */
  distance: number;
  /** 吸附强度（0-1，距离越近越强） */
  strength: number;
}

/**
 * 预览连线信息
 * 用于拖拽时显示的连线预览
 */
export interface WirePreviewInfo {
  /** 起点 */
  from: Point;
  /** 终点（吸附后的位置） */
  to: Point;
  /** 连线路径点 */
  points: WirePoint[];
  /** 是否已吸附到端口 */
  snappedToPort: boolean;
  /** 吸附目标（如果有） */
  snapTarget: SnapTarget | null;
}

/**
 * 辅助线信息
 * 用于拖拽时显示对齐辅助线
 */
export interface GuideLine {
  /** 辅助线类型 */
  type: 'horizontal' | 'vertical';
  /** 辅助线坐标（horizontal: y 值，vertical: x 值） */
  position: number;
  /** 辅助线范围起点 */
  start: number;
  /** 辅助线范围终点 */
  end: number;
  /** 关联的元件 ID */
  relatedComponentId: string;
}

/**
 * 吸附配置
 */
export interface SnapConfig {
  /** 网格大小 */
  gridSize: number;
  /** 端口吸附半径（像素） */
  portSnapRadius: number;
  /** 网格吸附半径（像素） */
  gridSnapRadius: number;
  /** 是否启用端口吸附 */
  enablePortSnap: boolean;
  /** 是否启用网格吸附 */
  enableGridSnap: boolean;
  /** 是否启用辅助线 */
  enableGuides: boolean;
  /** 辅助线检测容差 */
  guideTolerance: number;
}

/** 默认吸附配置 */
export const DEFAULT_SNAP_CONFIG: SnapConfig = {
  gridSize: 20,
  portSnapRadius: 20,
  gridSnapRadius: 10,
  enablePortSnap: true,
  enableGridSnap: true,
  enableGuides: true,
  guideTolerance: 5,
};

// ==================== 网格吸附 ====================

/**
 * 将坐标吸附到最近的网格点
 *
 * @param x - 原始 X 坐标
 * @param y - 原始 Y 坐标
 * @param gridSize - 网格大小（像素）
 * @returns 吸附后的坐标
 *
 * @example
 * ```ts
 * const snapped = snapToGridPoint(123, 456, 20);
 * // => { x: 120, y: 460 }
 * ```
 */
export function snapToGridPoint(x: number, y: number, gridSize: number): Point {
  return {
    x: Math.round(x / gridSize) * gridSize,
    y: Math.round(y / gridSize) * gridSize,
  };
}

/**
 * 计算坐标到最近网格点的距离
 *
 * @param x - X 坐标
 * @param y - Y 坐标
 * @param gridSize - 网格大小
 * @returns 到最近网格点的距离
 */
export function distanceToNearestGrid(x: number, y: number, gridSize: number): number {
  const snapped = snapToGridPoint(x, y, gridSize);
  return Math.hypot(x - snapped.x, y - snapped.y);
}

// ==================== 引脚吸附 ====================

/**
 * 查找最近的元件引脚
 *
 * 在所有元件的端口中找到距离给定坐标最近的端口。
 *
 * @param x - 目标 X 坐标
 * @param y - 目标 Y 坐标
 * @param components - 元件列表
 * @param maxRadius - 最大吸附半径（像素）
 * @param excludeComponentIds - 排除的元件 ID 集合
 * @returns 最近的吸附目标，如果没有找到返回 null
 *
 * @example
 * ```ts
 * const target = findNearestPortSnap(150, 200, components, 20);
 * if (target) {
 *   console.log(`吸附到 ${target.portInfo?.componentId} 的端口`);
 * }
 * ```
 */
export function findNearestPortSnap(
  x: number,
  y: number,
  components: CircuitComponent[],
  maxRadius: number = 20,
  excludeComponentIds: Set<string> = new Set()
): SnapTarget | null {
  let best: SnapTarget | null = null;
  let bestDist = maxRadius;

  for (const comp of components) {
    if (excludeComponentIds.has(comp.id)) continue;

    const portPositions = getAllPortPositions(comp);
    for (const { portId, position } of portPositions) {
      const dist = Math.hypot(x - position.x, y - position.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = {
          type: 'port',
          position: { x: position.x, y: position.y },
          portInfo: {
            componentId: comp.id,
            portId,
            absolutePosition: position,
          },
          distance: dist,
          strength: 1 - dist / maxRadius,
        };
      }
    }
  }

  return best;
}

// ==================== 综合吸附 ====================

/**
 * 智能吸附：综合端口吸附和网格吸附
 *
 * 优先吸附到最近的端口；如果没有合适的端口吸附点，
 * 则吸附到最近的网格点。
 *
 * @param x - 鼠标 X 坐标
 * @param y - 鼠标 Y 坐标
 * @param components - 元件列表
 * @param config - 吸附配置
 * @param excludeComponentIds - 排除的元件 ID
 * @returns 最佳吸附目标
 *
 * @example
 * ```ts
 * const target = smartSnap(mouseX, mouseY, components, {
 *   gridSize: 20,
 *   portSnapRadius: 20,
 * });
 * ```
 */
export function smartSnap(
  x: number,
  y: number,
  components: CircuitComponent[],
  config: Partial<SnapConfig> = {},
  excludeComponentIds: Set<string> = new Set()
): SnapTarget {
  const finalConfig = { ...DEFAULT_SNAP_CONFIG, ...config };

  // 优先尝试端口吸附
  if (finalConfig.enablePortSnap) {
    const portTarget = findNearestPortSnap(
      x, y, components, finalConfig.portSnapRadius, excludeComponentIds
    );
    if (portTarget) {
      return portTarget;
    }
  }

  // 回退到网格吸附
  const gridPos = snapToGridPoint(x, y, finalConfig.gridSize);
  const gridDist = Math.hypot(x - gridPos.x, y - gridPos.y);

  if (finalConfig.enableGridSnap && gridDist < finalConfig.gridSnapRadius) {
    return {
      type: 'grid',
      position: gridPos,
      distance: gridDist,
      strength: 1 - gridDist / finalConfig.gridSnapRadius,
    };
  }

  // 都不满足，返回原始坐标
  return {
    type: 'grid',
    position: { x, y },
    distance: 0,
    strength: 0,
  };
}

// ==================== 预览连线 ====================

/**
 * 生成拖拽时的预览连线
 *
 * 从起始端口到当前鼠标位置（自动吸附后），生成连线路径点。
 *
 * @param fromPosition - 起始端口绝对坐标
 * @param mouseX - 鼠标当前 X 坐标
 * @param mouseY - 鼠标当前 Y 坐标
 * @param components - 元件列表（用于吸附检测）
 * @param routing - 连线路径模式
 * @param config - 吸附配置
 * @param excludeComponentIds - 排除的元件 ID
 * @returns 预览连线信息
 *
 * @example
 * ```ts
 * const preview = generateWirePreview(
 *   { x: 100, y: 200 },
 *   mouseX, mouseY,
 *   components,
 *   'orthogonal'
 * );
 * // 渲染 preview.points
 * ```
 */
export function generateWirePreview(
  fromPosition: Point,
  mouseX: number,
  mouseY: number,
  components: CircuitComponent[],
  routing: WireRouting = 'orthogonal',
  config: Partial<SnapConfig> = {},
  excludeComponentIds: Set<string> = new Set()
): WirePreviewInfo {
  const snapTarget = smartSnap(mouseX, mouseY, components, config, excludeComponentIds);
  const to = snapTarget.position;

  // 计算连线路径
  const points = calculateWirePoints(fromPosition, to, routing);

  return {
    from: fromPosition,
    to,
    points,
    snappedToPort: snapTarget.type === 'port',
    snapTarget: snapTarget.strength > 0 ? snapTarget : null,
  };
}

// ==================== 辅助线 ====================

/**
 * 计算拖拽时的辅助对齐线
 *
 * 当拖拽元件时，检测当前元件与其他元件在水平或垂直方向上的对齐关系，
 * 返回需要显示的辅助线列表。
 *
 * @param draggingComponent - 正在拖拽的元件
 * @param allComponents - 所有元件列表
 * @param config - 吸附配置
 * @returns 辅助线数组
 *
 * @example
 * ```ts
 * const guides = calculateGuideLines(draggingComp, allComponents);
 * // 渲染 guides 作为浅色辅助线
 * ```
 */
export function calculateGuideLines(
  draggingComponent: CircuitComponent,
  allComponents: CircuitComponent[],
  config: Partial<SnapConfig> = {}
): GuideLine[] {
  const finalConfig = { ...DEFAULT_SNAP_CONFIG, ...config };
  if (!finalConfig.enableGuides) return [];

  const guides: GuideLine[] = [];
  const dragX = draggingComponent.position.x;
  const dragY = draggingComponent.position.y;

  for (const comp of allComponents) {
    if (comp.id === draggingComponent.id) continue;

    const compX = comp.position.x;
    const compY = comp.position.y;

    // 水平对齐（y 坐标接近）
    if (Math.abs(dragY - compY) < finalConfig.guideTolerance) {
      guides.push({
        type: 'horizontal',
        position: compY,
        start: Math.min(dragX, compX) - 50,
        end: Math.max(dragX, compX) + 50,
        relatedComponentId: comp.id,
      });
    }

    // 垂直对齐（x 坐标接近）
    if (Math.abs(dragX - compX) < finalConfig.guideTolerance) {
      guides.push({
        type: 'vertical',
        position: compX,
        start: Math.min(dragY, compY) - 50,
        end: Math.max(dragY, compY) + 50,
        relatedComponentId: comp.id,
      });
    }

    // 水平居中对齐
    if (Math.abs(dragY - compY) < finalConfig.guideTolerance * 3) {
      guides.push({
        type: 'horizontal',
        position: compY,
        start: Math.min(dragX, compX) - 30,
        end: Math.max(dragX, compX) + 30,
        relatedComponentId: comp.id,
      });
    }

    // 垂直居中对齐
    if (Math.abs(dragX - compX) < finalConfig.guideTolerance * 3) {
      guides.push({
        type: 'vertical',
        position: compX,
        start: Math.min(dragY, compY) - 30,
        end: Math.max(dragY, compY) + 30,
        relatedComponentId: comp.id,
      });
    }
  }

  // 去重
  const seen = new Set<string>();
  return guides.filter((g) => {
    const key = `${g.type}:${g.position}:${g.relatedComponentId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * 对元件位置应用吸附并返回吸附后的坐标
 *
 * @param x - 目标 X 坐标
 * @param y - 目标 Y 坐标
 * @param components - 元件列表
 * @param config - 吸附配置
 * @param excludeId - 排除的元件 ID（通常是正在拖拽的元件）
 * @returns 吸附后的坐标
 *
 * @example
 * ```ts
 * const snapped = applyComponentSnap(123, 456, components, { gridSize: 20 }, 'comp1');
 * moveComponent('comp1', snapped.x, snapped.y);
 * ```
 */
export function applyComponentSnap(
  x: number,
  y: number,
  components: CircuitComponent[],
  config: Partial<SnapConfig> = {},
  excludeId?: string
): Point {
  const finalConfig = { ...DEFAULT_SNAP_CONFIG, ...config };
  const excludeIds = excludeId ? new Set([excludeId]) : new Set<string>();

  // 优先尝试吸附到其他元件的端口
  if (finalConfig.enablePortSnap) {
    const portTarget = findNearestPortSnap(
      x, y, components, finalConfig.portSnapRadius, excludeIds
    );
    if (portTarget && portTarget.portInfo) {
      // 元件中心对齐到端口位置（偏移量保持元件不跳变）
      return portTarget.position;
    }
  }

  // 回退到网格吸附
  if (finalConfig.enableGridSnap) {
    return snapToGridPoint(x, y, finalConfig.gridSize);
  }

  return { x, y };
}

// ==================== 连线端点吸附 ====================

/**
 * 在连线绘制过程中，找到最近的吸附目标端口
 *
 * 专门用于 wire drawing 模式：当用户点击画布时，
 * 找到最近的可连接端口，决定连线终点。
 *
 * @param mouseX - 鼠标 X 坐标
 * @param mouseY - 鼠标 Y 坐标
 * @param fromComponentId - 起始元件 ID（排除自己）
 * @param fromPortId - 起始端口 ID
 * @param components - 元件列表
 * @param maxRadius - 最大吸附半径
 * @returns 吸附目标端口信息，未找到返回 null
 *
 * @example
 * ```ts
 * const target = findWireEndpoint(mouseX, mouseY, 'R1', 'pin1', components);
 * if (target) {
 *   endWire(target.componentId, target.portId);
 * }
 * ```
 */
export function findWireEndpoint(
  mouseX: number,
  mouseY: number,
  fromComponentId: string,
  fromPortId: string,
  components: CircuitComponent[],
  maxRadius: number = 20
): { componentId: string; portId: string; position: Point } | null {
  let best: { componentId: string; portId: string; position: Point } | null = null;
  let bestDist = maxRadius;

  for (const comp of components) {
    if (comp.id === fromComponentId) continue;

    const portPositions = getAllPortPositions(comp);
    for (const { portId, position } of portPositions) {
      // 跳过同一端口
      if (comp.id === fromComponentId && portId === fromPortId) continue;

      const dist = Math.hypot(mouseX - position.x, mouseY - position.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = {
          componentId: comp.id,
          portId,
          position,
        };
      }
    }
  }

  return best;
}

// ==================== 元件引脚网格对齐 ====================

/**
 * 将元件的所有引脚对齐到网格
 *
 * 计算元件中心位置的网格对齐偏移量，
 * 使所有引脚尽可能对齐到网格点。
 *
 * @param component - 元件
 * @param gridSize - 网格大小
 * @returns 对齐后的元件中心坐标
 *
 * @example
 * ```ts
 * const newPos = alignComponentPortsToGrid(component, 20);
 * moveComponent(component.id, newPos.x, newPos.y);
 * ```
 */
export function alignComponentPortsToGrid(
  component: CircuitComponent,
  gridSize: number
): Point {
  // 获取所有端口的绝对位置
  const portPositions = getAllPortPositions(component);

  if (portPositions.length === 0) {
    return snapToGridPoint(component.position.x, component.position.y, gridSize);
  }

  // 计算所有端口到最近网格点的总偏移
  let totalOffsetX = 0;
  let totalOffsetY = 0;

  for (const { position } of portPositions) {
    const snapped = snapToGridPoint(position.x, position.y, gridSize);
    totalOffsetX += snapped.x - position.x;
    totalOffsetY += snapped.y - position.y;
  }

  // 使用平均偏移调整元件位置
  const avgOffsetX = totalOffsetX / portPositions.length;
  const avgOffsetY = totalOffsetY / portPositions.length;

  return {
    x: Math.round((component.position.x + avgOffsetX) / gridSize) * gridSize,
    y: Math.round((component.position.y + avgOffsetY) / gridSize) * gridSize,
  };
}
