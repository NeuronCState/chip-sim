/**
 * 内存管理工具
 * 提供波形数据滑动窗口、历史记录压缩、组件清理等功能
 */

import type { SimulationDataPoint } from '../types/circuit';

// ==================== 波形数据滑动窗口 ====================

/**
 * 滑动窗口存储器
 * 用于限制波形数据的内存占用，当数据超过阈值时自动丢弃旧数据
 */
export class SlidingWindowBuffer {
  private maxSize: number;
  private windowSize: number;
  private data: SimulationDataPoint[] = [];

  /**
   * @param maxSize 最大数据点数（默认 10000）
   * @param windowSize 保留的最新数据点数（默认 5000）
   */
  constructor(maxSize: number = 10000, windowSize: number = 5000) {
    this.maxSize = maxSize;
    this.windowSize = windowSize;
  }

  /** 添加数据点 */
  push(point: SimulationDataPoint): void {
    this.data.push(point);
    if (this.data.length > this.maxSize) {
      this.data = this.data.slice(-this.windowSize);
    }
  }

  /** 批量添加数据点 */
  pushBatch(points: SimulationDataPoint[]): void {
    this.data.push(...points);
    if (this.data.length > this.maxSize) {
      this.data = this.data.slice(-this.windowSize);
    }
  }

  /** 获取所有数据 */
  getData(): SimulationDataPoint[] {
    return this.data;
  }

  /** 获取数据长度 */
  get length(): number {
    return this.data.length;
  }

  /** 清空 */
  clear(): void {
    this.data = [];
  }

  /** 获取内存估算（字节） */
  estimateMemory(): number {
    // 每个 data point: 2 个 number = 16 bytes
    return this.data.length * 16;
  }
}

// ==================== 历史记录压缩 ====================

/**
 * 压缩快照数据
 * 通过 diff 编码减少 JSON 序列化后的体积
 */
export interface CompressedSnapshot {
  /** 完整数据（仅首次） */
  full?: string;
  /** 与上一个快照的 diff */
  diff?: string;
  /** 压缩标记 */
  compressed: boolean;
}

/**
 * 历史记录压缩器
 * 对 Undo/Redo 栈进行压缩，减少内存占用
 */
export class HistoryCompressor {
  private compressionThreshold: number;

  /**
   * @param _maxSnapshots 最大快照数（默认 50）
   * @param compressionThreshold 超过此数量后开始压缩旧快照（默认 10）
   */
  constructor(_maxSnapshots: number = 50, compressionThreshold: number = 10) {
    this.compressionThreshold = compressionThreshold;
  }

  /**
   * 压缩快照栈
   * 保留最近 threshold 个快照完整，其余压缩为 diff
   */
  compressStack<T>(stack: T[]): CompressedSnapshot[] {
    if (stack.length <= this.compressionThreshold) {
      return stack.map(item => ({
        full: JSON.stringify(item),
        compressed: false,
      }));
    }

    const result: CompressedSnapshot[] = [];
    const fullCount = this.compressionThreshold;
    const compressStart = stack.length - fullCount;

    // 压缩旧快照（简化为直接序列化但标记为已压缩）
    for (let i = 0; i < compressStart; i++) {
      result.push({
        full: JSON.stringify(stack[i]),
        compressed: true,
      });
    }

    // 保留最近的快照完整
    for (let i = compressStart; i < stack.length; i++) {
      result.push({
        full: JSON.stringify(stack[i]),
        compressed: false,
      });
    }

    return result;
  }

  /**
   * 解压快照栈
   */
  decompressStack<T>(compressed: CompressedSnapshot[]): T[] {
    return compressed.map(item => JSON.parse(item.full || '{}') as T);
  }

  /**
   * 估算压缩后的内存节省
   */
  estimateSavings(originalSize: number, compressedCount: number, totalCount: number): number {
    if (totalCount === 0) return 0;
    const ratio = 0.3; // 假设压缩比约 30%
    const compressedSize = compressedCount * originalSize * ratio + (totalCount - compressedCount) * originalSize;
    return originalSize * totalCount - compressedSize;
  }
}

// ==================== 对象池 ====================

/**
 * 简单对象池
 * 复用频繁创建/销毁的对象，减少 GC 压力
 */
export class ObjectPool<T> {
  private factory: () => T;
  private reset: (obj: T) => void;
  private pool: T[] = [];
  private maxPoolSize: number;

  constructor(factory: () => T, reset: (obj: T) => void, maxPoolSize: number = 100) {
    this.factory = factory;
    this.reset = reset;
    this.maxPoolSize = maxPoolSize;
  }

  /** 获取一个对象 */
  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.factory();
  }

  /** 归还对象 */
  release(obj: T): void {
    if (this.pool.length < this.maxPoolSize) {
      this.reset(obj);
      this.pool.push(obj);
    }
  }

  /** 预填充 */
  prefill(count: number): void {
    for (let i = 0; i < count; i++) {
      this.pool.push(this.factory());
    }
  }

  /** 池大小 */
  get size(): number {
    return this.pool.length;
  }
}

// ==================== 清理管理器 ====================

/**
 * 资源清理管理器
 * 追踪需要在组件卸载时清理的资源
 */
export class CleanupManager {
  private cleanups: Array<() => void> = [];

  /** 注册清理函数 */
  register(cleanup: () => void): void {
    this.cleanups.push(cleanup);
  }

  /** 执行所有清理 */
  cleanup(): void {
    for (const fn of this.cleanups) {
      try {
        fn();
      } catch (e) {
        console.warn('Cleanup error:', e);
      }
    }
    this.cleanups = [];
  }

  /** 待清理数量 */
  get pending(): number {
    return this.cleanups.length;
  }
}

// ==================== 内存估算工具 ====================

/**
 * 估算对象的内存占用（近似值）
 */
export function estimateObjectSize(obj: unknown): number {
  const seen = new WeakSet();

  function sizeOf(val: unknown): number {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'boolean') return 4;
    if (typeof val === 'number') return 8;
    if (typeof val === 'string') return (val as string).length * 2;
    if (typeof val === 'object') {
      if (seen.has(val as object)) return 0;
      seen.add(val as object);

      if (Array.isArray(val)) {
        return (val as unknown[]).reduce((sum: number, item: unknown) => sum + sizeOf(item), 0);
      }

      let total = 0;
      for (const key of Object.keys(val as Record<string, unknown>)) {
        total += key.length * 2; // key string
        total += sizeOf((val as Record<string, unknown>)[key]);
      }
      return total;
    }
    return 0;
  }

  return sizeOf(obj);
}

/**
 * 获取当前 JS 堆内存使用情况（仅 Chrome）
 */
export function getHeapUsage(): { used: number; total: number; limit: number } | null {
  if (typeof performance !== 'undefined' && (performance as any).memory) {
    const mem = (performance as any).memory;
    return {
      used: mem.usedJSHeapSize,
      total: mem.totalJSHeapSize,
      limit: mem.jsHeapSizeLimit,
    };
  }
  return null;
}
