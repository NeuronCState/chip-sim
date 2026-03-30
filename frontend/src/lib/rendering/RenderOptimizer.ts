/**
 * 渲染优化器
 * 集成空间索引、视口裁剪、连线缓存等功能
 * 作为 store 和 renderer 之间的优化层
 */

import type {
  CircuitComponent,
  Wire,
  ViewTransform,
} from '../../types/circuit';
import { SpatialIndex, WireIndex, type BBox, type SpatialEntry } from '../../core/SpatialIndex';

/** 元件的空间索引条目 */
interface ComponentSpatialEntry extends SpatialEntry {
  component: CircuitComponent;
}

/** 渲染优化统计 */
export interface RenderOptStats {
  totalComponents: number;
  visibleComponents: number;
  totalWires: number;
  visibleWires: number;
  cullingRatio: number;
  indexBuildTime: number;
  queryTime: number;
}

/**
 * 渲染优化器
 * 使用空间索引进行视口裁剪，只渲染可见元素
 */
export class RenderOptimizer {
  private componentIndex: SpatialIndex<ComponentSpatialEntry>;
  private wireIndex: WireIndex;
  private needsRebuild: boolean = true;
  private lastComponentCount: number = 0;

  // 缓存
  private cachedVisibleComponents: CircuitComponent[] | null = null;
  private cachedVisibleWires: Wire[] | null = null;
  private cachedViewportKey: string = '';

  // 统计
  private stats: RenderOptStats = {
    totalComponents: 0,
    visibleComponents: 0,
    totalWires: 0,
    visibleWires: 0,
    cullingRatio: 0,
    indexBuildTime: 0,
    queryTime: 0,
  };

  constructor(cellSize: number = 100) {
    this.componentIndex = new SpatialIndex<ComponentSpatialEntry>(cellSize);
    this.wireIndex = new WireIndex();
  }

  /**
   * 标记需要重建索引（当电路数据变化时调用）
   */
  markDirty(): void {
    this.needsRebuild = true;
    this.cachedVisibleComponents = null;
    this.cachedVisibleWires = null;
  }

  /**
   * 重建空间索引
   */
  rebuildIndex(components: CircuitComponent[], wires: Wire[]): void {
    const startTime = performance.now();

    // 只有元件数量变化时才需要重建组件索引
    if (components.length !== this.lastComponentCount || this.needsRebuild) {
      this.componentIndex.clear();
      this.wireIndex.clear();

      // 构建元件空间索引
      const entries: ComponentSpatialEntry[] = components.map(comp => ({
        id: comp.id,
        bbox: this.getComponentBBox(comp),
        component: comp,
      }));
      this.componentIndex.bulkInsert(entries);

      // 构建连线索引
      for (const wire of wires) {
        this.wireIndex.addWire(
          wire.id,
          wire.fromPortId,
          wire.toPortId,
          wire.fromComponentId,
          wire.toComponentId
        );
      }

      this.lastComponentCount = components.length;
      this.needsRebuild = false;
    }

    this.stats.indexBuildTime = performance.now() - startTime;
    this.stats.totalComponents = components.length;
    this.stats.totalWires = wires.length;
  }

  /**
   * 查询视口内可见的元件
   */
  getVisibleComponents(
    components: CircuitComponent[],
    wires: Wire[],
    viewTransform: ViewTransform,
    canvasWidth: number,
    canvasHeight: number
  ): CircuitComponent[] {
    // 如果元件数量少，不做裁剪
    if (components.length < 50) {
      this.stats.visibleComponents = components.length;
      this.stats.cullingRatio = 0;
      return components;
    }

    const queryStart = performance.now();
    const viewportKey = `${viewTransform.scale.toFixed(2)}_${viewTransform.offsetX.toFixed(0)}_${viewTransform.offsetY.toFixed(0)}_${canvasWidth}_${canvasHeight}`;

    // 检查缓存
    if (this.cachedVisibleComponents && viewportKey === this.cachedViewportKey) {
      this.stats.queryTime = performance.now() - queryStart;
      return this.cachedVisibleComponents;
    }

    // 确保索引是最新的
    this.rebuildIndex(components, wires);

    // 计算视口边界（画布坐标系）
    const viewportBBox: BBox = {
      minX: -viewTransform.offsetX / viewTransform.scale,
      minY: -viewTransform.offsetY / viewTransform.scale,
      maxX: (canvasWidth - viewTransform.offsetX) / viewTransform.scale,
      maxY: (canvasHeight - viewTransform.offsetY) / viewTransform.scale,
    };

    // 添加边距（避免边缘裁剪闪烁）
    const margin = 50;
    viewportBBox.minX -= margin;
    viewportBBox.minY -= margin;
    viewportBBox.maxX += margin;
    viewportBBox.maxY += margin;

    // 查询可见条目
    const visibleEntries = this.componentIndex.query(viewportBBox);
    const visibleComponents = visibleEntries.map((e: ComponentSpatialEntry) => e.component);

    // 缓存结果
    this.cachedVisibleComponents = visibleComponents;
    this.cachedViewportKey = viewportKey;

    // 更新统计
    this.stats.visibleComponents = visibleComponents.length;
    this.stats.cullingRatio = components.length > 0
      ? 1 - visibleComponents.length / components.length
      : 0;
    this.stats.queryTime = performance.now() - queryStart;

    return visibleComponents;
  }

  /**
   * 查询视口内可见的连线
   */
  getVisibleWires(
    wires: Wire[],
    _components: CircuitComponent[],
    viewTransform: ViewTransform,
    canvasWidth: number,
    canvasHeight: number
  ): Wire[] {
    if (wires.length < 50) {
      this.stats.visibleWires = wires.length;
      return wires;
    }

    if (this.cachedVisibleWires) {
      return this.cachedVisibleWires;
    }

    // 计算视口边界
    const viewportMinX = -viewTransform.offsetX / viewTransform.scale - 50;
    const viewportMinY = -viewTransform.offsetY / viewTransform.scale - 50;
    const viewportMaxX = (canvasWidth - viewTransform.offsetX) / viewTransform.scale + 50;
    const viewportMaxY = (canvasHeight - viewTransform.offsetY) / viewTransform.scale + 50;

    // 过滤：连线的任何一点在视口内即可见
    const visibleWires = wires.filter(wire => {
      if (wire.points.length === 0) return true;
      for (const pt of wire.points) {
        if (pt.x >= viewportMinX && pt.x <= viewportMaxX &&
            pt.y >= viewportMinY && pt.y <= viewportMaxY) {
          return true;
        }
      }
      return false;
    });

    this.cachedVisibleWires = visibleWires;
    this.stats.visibleWires = visibleWires.length;
    return visibleWires;
  }

  /**
   * 获取优化统计
   */
  getStats(): RenderOptStats {
    return { ...this.stats };
  }

  /**
   * 通过端口快速查找关联的连线
   */
  getWiresForPort(portId: string): string[] {
    return this.wireIndex.getWiresByPort(portId);
  }

  /**
   * 通过元件快速查找关联的连线
   */
  getWiresForComponent(componentId: string): string[] {
    return this.wireIndex.getWiresByComponent(componentId);
  }

  // ==================== 内部方法 ====================

  /**
   * 计算元件的边界框
   */
  private getComponentBBox(comp: CircuitComponent): BBox {
    const padding = 5;
    const halfW = 30 + padding;
    const halfH = 20 + padding;

    // 简化：不考虑旋转，使用保守估计
    return {
      minX: comp.position.x - halfW,
      minY: comp.position.y - halfH,
      maxX: comp.position.x + halfW,
      maxY: comp.position.y + halfH,
    };
  }
}

/**
 * 全局渲染优化器实例
 */
let globalOptimizer: RenderOptimizer | null = null;

export function getRenderOptimizer(): RenderOptimizer {
  if (!globalOptimizer) {
    globalOptimizer = new RenderOptimizer();
  }
  return globalOptimizer;
}
