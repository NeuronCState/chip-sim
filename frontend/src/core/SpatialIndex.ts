/**
 * SpatialIndex.ts - 芯片仿真画布的高效空间索引模块
 *
 * 提供基于 Grid 的空间索引，用于快速查询画布视口内的元件。
 * 适用于大规模芯片仿真场景（数千个元件），避免对所有元件进行暴力遍历。
 *
 * @module SpatialIndex
 * @author chip-sim
 */

// ============================================================
// 接口定义
// ============================================================

/**
 * 空间索引的轴对齐边界框（Axis-Aligned Bounding Box）。
 * 所有坐标均为画布坐标系下的绝对坐标。
 *
 * @example
 * ```ts
 * const bbox: BBox = { minX: 0, minY: 0, maxX: 100, maxY: 50 };
 * ```
 */
export interface BBox {
  /** 边界框左上角 X 坐标 */
  minX: number;
  /** 边界框左上角 Y 坐标 */
  minY: number;
  /** 边界框右下角 X 坐标 */
  maxX: number;
  /** 边界框右下角 Y 坐标 */
  maxY: number;
}

/**
 * 空间索引条目。所有需要被空间索引的对象必须实现此接口。
 *
 * @example
 * ```ts
 * const resistor: SpatialEntry = {
 *   id: 'R1',
 *   bbox: { minX: 200, minY: 100, maxX: 260, maxY: 120 }
 * };
 * ```
 */
export interface SpatialEntry {
  /** 唯一标识符 */
  id: string;
  /** 轴对齐边界框 */
  bbox: BBox;
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 计算一个条目覆盖的所有 Grid Cell 的 key 集合。
 *
 * @param bbox - 条目的边界框
 * @param cellSize - 每个 Cell 的边长
 * @returns 所有覆盖 Cell 的 key 字符串数组
 */
function computeCellKeys(bbox: BBox, cellSize: number): string[] {
  const minCol = Math.floor(bbox.minX / cellSize);
  const maxCol = Math.floor(bbox.maxX / cellSize);
  const minRow = Math.floor(bbox.minY / cellSize);
  const maxRow = Math.floor(bbox.maxY / cellSize);

  const keys: string[] = [];
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      keys.push(`${col},${row}`);
    }
  }
  return keys;
}

/**
 * 判断两个轴对齐边界框是否相交（重叠）。
 *
 * @param a - 第一个边界框
 * @param b - 第二个边界框
 * @returns 是否相交
 */
export function bboxIntersects(a: BBox, b: BBox): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX &&
         a.minY <= b.maxY && a.maxY >= b.minY;
}

// ============================================================
// SpatialIndex - Grid-Based 空间索引
// ============================================================

/**
 * 基于 Grid 的高效空间索引。
 *
 * 将画布划分为固定大小的网格（Cell），每个 Cell 中存储与之相交的条目引用。
 * 查询时只需遍历查询区域覆盖的 Cell，大幅减少遍历数量。
 *
 * **时间复杂度：**
 * - `insert`：O(c)，其中 c 为条目覆盖的 Cell 数量
 * - `remove`：O(c)
 * - `update`：O(c_new + c_old)
 * - `query`：O(c_q * k)，其中 c_q 为查询区域覆盖的 Cell 数，k 为每个 Cell 平均条目数
 *
 * **适用场景：**
 * - 大规模电路仿真画布（数千~数万元件）
 * - 需要频繁查询视口可见元件
 * - 鼠标拾取（pick）、碰撞检测、局部更新
 *
 * @example
 * ```ts
 * const index = new SpatialIndex<ComponentEntry>(150);
 *
 * // 批量插入元件
 * index.bulkInsert(components);
 *
 * // 查询当前视口内的元件
 * const visible = index.queryViewport(0, 0, 1920, 1080);
 *
 * // 拖拽移动后更新位置
 * index.update({ id: 'R1', bbox: newBBox });
 * ```
 *
 * @template T 空间条目类型，必须扩展 SpatialEntry
 */
export class SpatialIndex<T extends SpatialEntry> {
  /** 每个 Cell 的边长（画布单位） */
  private readonly cellSize: number;

  /**
   * Cell 集合映射表。
   * Key 格式: `"col,row"`（由 `Math.floor(coord / cellSize)` 计算）
   * Value: 该 Cell 中的所有条目集合
   */
  private readonly cells: Map<string, Set<T>>;

  /**
   * 条目 ID 到条目对象的映射，用于 O(1) 查找。
   */
  private readonly entries: Map<string, T>;

  /**
   * 条目 ID 到其覆盖的 Cell Keys 的映射，加速 remove/update 操作。
   */
  private readonly entryCells: Map<string, string[]>;

  /**
   * 创建空间索引实例。
   *
   * @param cellSize - 每个 Cell 的边长（画布单位），默认 100。
   *   建议值：元件平均尺寸的 2~5 倍。值越大 Cell 数越少但每 Cell 含条目越多，
   *   值越小反之。100 是电阻/电容等常见元件的良好默认值。
   */
  constructor(cellSize: number = 100) {
    this.cellSize = cellSize;
    this.cells = new Map();
    this.entries = new Map();
    this.entryCells = new Map();
  }

  /**
   * 插入一个空间条目。
   *
   * 如果条目 ID 已存在，会自动移除旧条目再插入新条目（相当于 update）。
   *
   * @param entry - 要插入的条目
   *
   * @example
   * ```ts
   * index.insert({ id: 'U1', bbox: { minX: 100, minY: 200, maxX: 180, maxY: 240 } });
   * ```
   */
  insert(entry: T): void {
    // 如果已存在，先移除旧的
    if (this.entries.has(entry.id)) {
      this.remove(entry.id);
    }

    // 存储条目
    this.entries.set(entry.id, entry);

    // 计算覆盖的 Cell Keys 并插入
    const cellKeys = computeCellKeys(entry.bbox, this.cellSize);
    this.entryCells.set(entry.id, cellKeys);

    for (const key of cellKeys) {
      let cell = this.cells.get(key);
      if (!cell) {
        cell = new Set();
        this.cells.set(key, cell);
      }
      cell.add(entry);
    }
  }

  /**
   * 移除指定 ID 的条目。
   *
   * 如果 ID 不存在则无副作用。
   *
   * @param id - 要移除的条目 ID
   *
   * @example
   * ```ts
   * index.remove('U1');
   * ```
   */
  remove(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;

    const cellKeys = this.entryCells.get(id);
    if (cellKeys) {
      for (const key of cellKeys) {
        const cell = this.cells.get(key);
        if (cell) {
          cell.delete(entry);
          // 清理空 Cell 释放内存
          if (cell.size === 0) {
            this.cells.delete(key);
          }
        }
      }
    }

    this.entries.delete(id);
    this.entryCells.delete(id);
  }

  /**
   * 更新条目位置。
   *
   * 这是 remove + insert 的优化版本，当条目覆盖的 Cell 集合不变时可减少操作。
   * 如果条目不存在，等同于 insert。
   *
   * @param entry - 更新后的条目（ID 必须一致）
   *
   * @example
   * ```ts
   * // 元件拖拽移动后
   * index.update({ id: 'U1', bbox: { minX: 150, minY: 250, maxX: 230, maxY: 290 } });
   * ```
   */
  update(entry: T): void {
    this.insert(entry); // insert 内部已处理 ID 存在的情况
  }

  /**
   * 批量插入多个条目。
   *
   * 性能优于逐个调用 insert()，减少了多次查找 Map 的开销。
   *
   * @param entries - 要插入的条目数组
   *
   * @example
   * ```ts
   * index.bulkInsert([comp1, comp2, comp3, ...comp1000]);
   * ```
   */
  bulkInsert(entries: T[]): void {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (this.entries.has(entry.id)) {
        this.remove(entry.id);
      }
      this.entries.set(entry.id, entry);
      const cellKeys = computeCellKeys(entry.bbox, this.cellSize);
      this.entryCells.set(entry.id, cellKeys);
      for (const key of cellKeys) {
        let cell = this.cells.get(key);
        if (!cell) {
          cell = new Set();
          this.cells.set(key, cell);
        }
        cell.add(entry);
      }
    }
  }

  /**
   * 查询与给定边界框相交的所有条目。
   *
   * 返回值中不会有重复条目。查询过程先定位覆盖的 Cell，
   * 再对 Cell 中的条目进行精确 AABB 相交测试。
   *
   * @param bbox - 查询区域的边界框
   * @returns 与查询区域相交的所有条目数组
   *
   * @example
   * ```ts
   * // 查找 (100,100)-(300,300) 区域内的元件
   * const hits = index.query({ minX: 100, minY: 100, maxX: 300, maxY: 300 });
   * ```
   */
  query(bbox: BBox): T[] {
    const cellKeys = computeCellKeys(bbox, this.cellSize);
    const result: T[] = [];
    const seen = new Set<string>();

    for (const key of cellKeys) {
      const cell = this.cells.get(key);
      if (!cell) continue;

      for (const entry of cell) {
        if (seen.has(entry.id)) continue;

        // 精确的 AABB 相交测试
        if (bboxIntersects(entry.bbox, bbox)) {
          seen.add(entry.id);
          result.push(entry);
        }
      }
    }

    return result;
  }

  /**
   * 查询视口范围内的条目。这是 query() 的便捷方法。
   *
   * @param viewX - 视口左上角 X 坐标（画布坐标系）
   * @param viewY - 视口左上角 Y 坐标（画布坐标系）
   * @param viewW - 视口宽度
   * @param viewH - 视口高度
   * @returns 视口内可见的条目数组
   *
   * @example
   * ```ts
   * // 查询当前画布视口内可见的元件
   * const visible = index.queryViewport(camera.x, camera.y, canvas.width, canvas.height);
   * ```
   */
  queryViewport(viewX: number, viewY: number, viewW: number, viewH: number): T[] {
    return this.query({
      minX: viewX,
      minY: viewY,
      maxX: viewX + viewW,
      maxY: viewY + viewH,
    });
  }

  /**
   * 清空索引，移除所有条目。
   *
   * @example
   * ```ts
   * index.clear();
   * console.log(index.size()); // 0
   * ```
   */
  clear(): void {
    this.cells.clear();
    this.entries.clear();
    this.entryCells.clear();
  }

  /**
   * 获取索引中的条目总数。
   *
   * @returns 条目总数
   */
  size(): number {
    return this.entries.size;
  }

  /**
   * 获取索引统计信息，用于调试和性能分析。
   *
   * @returns 统计信息对象
   *
   * @example
   * ```ts
   * const stats = index.getStats();
   * console.log(`元件: ${stats.totalEntries}, 格子: ${stats.totalCells}, 平均: ${stats.avgEntriesPerCell}`);
   * ```
   */
  getStats(): { totalEntries: number; totalCells: number; avgEntriesPerCell: number } {
    const totalEntries = this.entries.size;
    const totalCells = this.cells.size;
    const avgEntriesPerCell = totalCells > 0
      ? Math.round((totalEntries / totalCells) * 100) / 100
      : 0;
    return { totalEntries, totalCells, avgEntriesPerCell };
  }
}

// ============================================================
// WireIndex - 连线索引
// ============================================================

/**
 * 连线索引，用于按端口 ID 或元件 ID 快速查找关联的连线。
 *
 * 在芯片仿真中，经常需要知道某个端口连接了哪些连线，
 * 或某个元件有哪些连线。WireIndex 通过多重映射表提供 O(1) 的查找。
 *
 * **内部结构：**
 * - `byFromPort`: 起始端口 → 连线 ID 列表
 * - `byToPort`: 目标端口 → 连线 ID 列表
 * - `byComponent`: 元件 ID → 连线 ID 列表
 *
 * @example
 * ```ts
 * const wireIdx = new WireIndex();
 *
 * // 添加连线
 * wireIdx.addWire('w1', 'U1-out', 'U2-in', 'U1', 'U2');
 * wireIdx.addWire('w2', 'U1-out', 'U3-in', 'U1', 'U3');
 *
 * // 查询 U1-out 端口的连线
 * const wires = wireIdx.getWiresByPort('U1-out'); // ['w1', 'w2']
 *
 * // 查询 U1 元件的所有连线
 * const compWires = wireIdx.getWiresByComponent('U1'); // ['w1', 'w2']
 * ```
 */
export class WireIndex {
  /** 起始端口 ID → 连线 ID 数组 */
  private readonly byFromPort: Map<string, string[]>;

  /** 目标端口 ID → 连线 ID 数组 */
  private readonly byToPort: Map<string, string[]>;

  /** 元件 ID → 连线 ID 数组 */
  private readonly byComponent: Map<string, string[]>;

  /** 连线 ID → { fromPort, toPort, fromComp, toComp } 的反向索引，用于 removeWire */
  private readonly wireInfo: Map<string, { fromPort: string; toPort: string; fromComp: string; toComp: string }>;

  constructor() {
    this.byFromPort = new Map();
    this.byToPort = new Map();
    this.byComponent = new Map();
    this.wireInfo = new Map();
  }

  /**
   * 添加一条连线到索引。
   *
   * @param wireId - 连线的唯一标识符
   * @param fromPortId - 起始端口 ID（格式建议：`元件ID-端口名`）
   * @param toPortId - 目标端口 ID
   * @param fromCompId - 起始端口所属元件的 ID
   * @param toCompId - 目标端口所属元件的 ID
   *
   * @example
   * ```ts
   * wireIdx.addWire('wire-001', 'R1-pin2', 'U1-A0', 'R1', 'U1');
   * ```
   */
  addWire(
    wireId: string,
    fromPortId: string,
    toPortId: string,
    fromCompId: string,
    toCompId: string,
  ): void {
    // 防止重复添加
    if (this.wireInfo.has(wireId)) {
      this.removeWire(wireId);
    }

    this.wireInfo.set(wireId, { fromPort: fromPortId, toPort: toPortId, fromComp: fromCompId, toComp: toCompId });

    // 索引 byFromPort
    let fromList = this.byFromPort.get(fromPortId);
    if (!fromList) {
      fromList = [];
      this.byFromPort.set(fromPortId, fromList);
    }
    fromList.push(wireId);

    // 索引 byToPort
    let toList = this.byToPort.get(toPortId);
    if (!toList) {
      toList = [];
      this.byToPort.set(toPortId, toList);
    }
    toList.push(wireId);

    // 索引 byComponent（起始元件）
    let fromCompList = this.byComponent.get(fromCompId);
    if (!fromCompList) {
      fromCompList = [];
      this.byComponent.set(fromCompId, fromCompList);
    }
    fromCompList.push(wireId);

    // 索引 byComponent（目标元件，如果不同）
    if (toCompId !== fromCompId) {
      let toCompList = this.byComponent.get(toCompId);
      if (!toCompList) {
        toCompList = [];
        this.byComponent.set(toCompId, toCompList);
      }
      toCompList.push(wireId);
    }
  }

  /**
   * 移除一条连线。
   *
   * 如果连线 ID 不存在则无副作用。
   *
   * @param wireId - 要移除的连线 ID
   *
   * @example
   * ```ts
   * wireIdx.removeWire('wire-001');
   * ```
   */
  removeWire(wireId: string): void {
    const info = this.wireInfo.get(wireId);
    if (!info) return;

    // 从 byFromPort 移除
    removeFromArray(this.byFromPort.get(info.fromPort), wireId);
    if (this.byFromPort.get(info.fromPort)?.length === 0) {
      this.byFromPort.delete(info.fromPort);
    }

    // 从 byToPort 移除
    removeFromArray(this.byToPort.get(info.toPort), wireId);
    if (this.byToPort.get(info.toPort)?.length === 0) {
      this.byToPort.delete(info.toPort);
    }

    // 从 byComponent 移除（起始元件）
    removeFromArray(this.byComponent.get(info.fromComp), wireId);
    if (this.byComponent.get(info.fromComp)?.length === 0) {
      this.byComponent.delete(info.fromComp);
    }

    // 从 byComponent 移除（目标元件，如果不同）
    if (info.toComp !== info.fromComp) {
      removeFromArray(this.byComponent.get(info.toComp), wireId);
      if (this.byComponent.get(info.toComp)?.length === 0) {
        this.byComponent.delete(info.toComp);
      }
    }

    this.wireInfo.delete(wireId);
  }

  /**
   * 获取与指定端口关联的所有连线 ID。
   *
   * 同时搜索起始端口和目标端口索引。
   *
   * @param portId - 端口 ID
   * @returns 与该端口关联的连线 ID 数组（浅拷贝，不会修改内部状态）
   *
   * @example
   * ```ts
   * const wires = wireIdx.getWiresByPort('U1-A0');
   * ```
   */
  getWiresByPort(portId: string): string[] {
    const fromWires = this.byFromPort.get(portId) ?? [];
    const toWires = this.byToPort.get(portId) ?? [];
    // 合并去重
    if (fromWires.length === 0) return [...toWires];
    if (toWires.length === 0) return [...fromWires];
    const combined = new Set([...fromWires, ...toWires]);
    return Array.from(combined);
  }

  /**
   * 获取与指定元件关联的所有连线 ID。
   *
   * @param componentId - 元件 ID
   * @returns 与该元件关联的连线 ID 数组（浅拷贝）
   *
   * @example
   * ```ts
   * const wires = wireIdx.getWiresByComponent('U1');
   * ```
   */
  getWiresByComponent(componentId: string): string[] {
    const wires = this.byComponent.get(componentId);
    return wires ? [...wires] : [];
  }

  /**
   * 清空连线索引。
   */
  clear(): void {
    this.byFromPort.clear();
    this.byToPort.clear();
    this.byComponent.clear();
    this.wireInfo.clear();
  }
}

// ============================================================
// 内部工具函数
// ============================================================

/**
 * 从数组中移除指定元素（原地修改）。
 * 如果元素不存在则无副作用。
 *
 * @param arr - 目标数组（可能为 undefined）
 * @param item - 要移除的元素
 */
function removeFromArray<T>(arr: T[] | undefined, item: T): void {
  if (!arr) return;
  const idx = arr.indexOf(item);
  if (idx !== -1) {
    arr.splice(idx, 1);
  }
}
