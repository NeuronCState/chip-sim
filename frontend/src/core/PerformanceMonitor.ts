/**
 * PerformanceMonitor.ts
 * 
 * 性能监控工具类，跟踪 FPS、内存、渲染时间、仿真耗时等指标。
 * 适用于芯片仿真前端的性能分析和调优。
 * 
 * @module core/PerformanceMonitor
 */

// ─── Interfaces ───────────────────────────────────────────────────────────────

/**
 * 性能指标快照。
 *
 * 包含帧率、渲染耗时、内存占用、电路复杂度及仿真统计等信息。
 */
export interface PerfMetrics {
  // ── FPS ──
  /** 当前实时帧率 */
  fps: number;
  /** 历史平均帧率 */
  avgFps: number;
  /** 历史最低帧率 */
  minFps: number;
  /** 历史最高帧率 */
  maxFps: number;

  // ── 渲染时间 (ms) ──
  /** 上一帧渲染耗时 */
  renderTime: number;
  /** 历史平均渲染耗时 */
  avgRenderTime: number;

  // ── 内存 (MB, 仅 Chrome 支持) ──
  /** 当前已使用的 JS 堆大小 (MB) */
  usedJSHeapSize: number;
  /** JS 堆总大小 (MB) */
  totalJSHeapSize: number;

  // ── 电路复杂度 ──
  /** 元件数量 */
  componentCount: number;
  /** 节点数量 */
  nodeCount: number;
  /** 连线数量 */
  wireCount: number;

  // ── 仿真统计 ──
  /** 上一步仿真耗时 (ms) */
  simStepTime: number;
  /** 仿真累计耗时 (ms) */
  simTotalTime: number;
  /** 已执行仿真步数 */
  simSteps: number;

  // ── 历史记录 ──
  /** FPS 历史（环形缓冲区快照） */
  fpsHistory: number[];
  /** 渲染时间历史（环形缓冲区快照） */
  renderTimeHistory: number[];
}

/** PerformanceMonitor 构造选项 */
export interface PerfMonitorOptions {
  /** 环形缓冲区容量，默认 120 */
  historySize?: number;
  /** FPS 采样间隔 (ms)，默认 1000 */
  sampleInterval?: number;
}

// ─── Ring Buffer ──────────────────────────────────────────────────────────────

/**
 * 固定容量的环形缓冲区。
 *
 * 写满后自动覆盖最旧的数据，始终 O(1) 插入。
 */
class RingBuffer {
  private readonly buffer: Float64Array;
  private head = 0;
  private count = 0;
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = Math.max(1, capacity);
    this.buffer = new Float64Array(this.capacity);
  }

  /** 追加一个值 */
  push(value: number): void {
    this.buffer[this.head] = value;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  /** 返回当前有效元素数量 */
  size(): number {
    return this.count;
  }

  /** 返回所有有效元素的快照数组（按插入顺序） */
  toArray(): number[] {
    const result: number[] = new Array(this.count);
    const start = this.count < this.capacity
      ? 0
      : this.head;
    for (let i = 0; i < this.count; i++) {
      result[i] = this.buffer[(start + i) % this.capacity];
    }
    return result;
  }

  /** 计算平均值 */
  average(): number {
    if (this.count === 0) return 0;
    let sum = 0;
    for (let i = 0; i < this.count; i++) {
      sum += this.buffer[i];
    }
    return sum / this.count;
  }

  /** 计算最小值 */
  min(): number {
    if (this.count === 0) return 0;
    let m = Infinity;
    for (let i = 0; i < this.count; i++) {
      if (this.buffer[i] < m) m = this.buffer[i];
    }
    return m;
  }

  /** 计算最大值 */
  max(): number {
    if (this.count === 0) return 0;
    let m = -Infinity;
    for (let i = 0; i < this.count; i++) {
      if (this.buffer[i] > m) m = this.buffer[i];
    }
    return m;
  }

  /** 清空缓冲区 */
  clear(): void {
    this.head = 0;
    this.count = 0;
  }
}

// ─── Performance Monitor ──────────────────────────────────────────────────────

/**
 * 性能监控器。
 *
 * 通过 `beginFrame()` / `endFrame()` 测量渲染耗时并自动计算 FPS；
 * 通过 `beginSimStep()` / `endSimStep()` 测量仿真步耗时；
 * 通过 `subscribe()` 接收周期性指标更新。
 *
 * @example
 * ```ts
 * const monitor = new PerformanceMonitor({ historySize: 60 });
 * const unsub = monitor.subscribe(m => console.log(m.fps));
 *
 * function loop() {
 *   monitor.beginFrame();
 *   // ... render ...
 *   const elapsed = monitor.endFrame();
 *   requestAnimationFrame(loop);
 * }
 * requestAnimationFrame(loop);
 * ```
 */
export class PerformanceMonitor {
  // ── 配置 ──
  private readonly historySize: number;
  private readonly sampleInterval: number;

  // ── 环形缓冲区 ──
  private readonly fpsBuffer: RingBuffer;
  private readonly renderTimeBuffer: RingBuffer;

  // ── 帧计时 ──
  private frameStart = 0;
  private frameTimestamps: number[] = [];
  private currentFps = 0;

  // ── 仿真计时 ──
  private simStepStart = 0;
  private simTotalTime = 0;
  private simSteps = 0;
  private lastSimStepTime = 0;

  // ── 电路复杂度 ──
  private componentCount = 0;
  private nodeCount = 0;
  private wireCount = 0;

  // ── 内存快照 ──
  private usedJSHeap = 0;
  private totalJSHeap = 0;

  // ── 订阅 ──
  private subscribers: Array<(metrics: PerfMetrics) => void> = [];
  private rafId = 0;
  private lastSampleTime = 0;

  // ── 火焰图追踪 ──
  private flameChartEntries: Array<{
    name: string;
    startTime: number;
    duration: number;
  }> = [];

  /**
   * 创建性能监控器实例。
   *
   * @param options - 可选配置
   * @param options.historySize - 环形缓冲区容量（默认 120）
   * @param options.sampleInterval - FPS 采样更新间隔 ms（默认 1000）
   */
  constructor(options?: PerfMonitorOptions) {
    this.historySize = options?.historySize ?? 120;
    this.sampleInterval = options?.sampleInterval ?? 1000;

    this.fpsBuffer = new RingBuffer(this.historySize);
    this.renderTimeBuffer = new RingBuffer(this.historySize);

    this.lastSampleTime = performance.now();
  }

  // ── Frame Timing ────────────────────────────────────────────────────────

  /**
   * 标记一帧开始。应在渲染循环开头调用。
   */
  beginFrame(): void {
    this.frameStart = performance.now();
  }

  /**
   * 标记一帧结束。自动更新 FPS 计数和渲染时间缓冲区。
   *
   * @returns 本帧渲染耗时 (ms)
   */
  endFrame(): number {
    const now = performance.now();
    const renderTime = now - this.frameStart;

    // 记录渲染时间
    this.renderTimeBuffer.push(renderTime);

    // 记录帧时间戳用于 FPS 计算
    this.frameTimestamps.push(now);

    // 清理 1 秒前的时间戳
    const oneSecAgo = now - 1000;
    while (this.frameTimestamps.length > 0 && this.frameTimestamps[0] < oneSecAgo) {
      this.frameTimestamps.shift();
    }

    // 每隔 sampleInterval 更新 FPS 快照
    if (now - this.lastSampleTime >= this.sampleInterval) {
      this.currentFps = this.frameTimestamps.length;
      this.fpsBuffer.push(this.currentFps);
      this.lastSampleTime = now;

      // 更新内存快照
      this.updateMemorySnapshot();

      // 通知订阅者
      this.notifySubscribers();
    }

    return renderTime;
  }

  // ── Simulation Timing ───────────────────────────────────────────────────

  /**
   * 标记一个仿真步开始。
   */
  beginSimStep(): void {
    this.simStepStart = performance.now();
  }

  /**
   * 标记一个仿真步结束。
   *
   * @returns 本步耗时 (ms)
   */
  endSimStep(): number {
    const elapsed = performance.now() - this.simStepStart;
    this.lastSimStepTime = elapsed;
    this.simTotalTime += elapsed;
    this.simSteps++;
    return elapsed;
  }

  // ── Circuit Stats ───────────────────────────────────────────────────────

  /**
   * 更新电路复杂度统计。
   *
   * @param components - 元件数量
   * @param nodes - 节点数量
   * @param wires - 连线数量
   */
  updateCircuitStats(components: number, nodes: number, wires: number): void {
    this.componentCount = components;
    this.nodeCount = nodes;
    this.wireCount = wires;
  }

  // ── Metrics ─────────────────────────────────────────────────────────────

  /**
   * 获取当前性能指标快照。
   *
   * @returns 包含所有性能数据的 {@link PerfMetrics} 对象
   */
  getMetrics(): PerfMetrics {
    return {
      // FPS
      fps: this.currentFps,
      avgFps: Math.round(this.fpsBuffer.average() * 100) / 100,
      minFps: this.fpsBuffer.size() > 0 ? this.fpsBuffer.min() : 0,
      maxFps: this.fpsBuffer.size() > 0 ? this.fpsBuffer.max() : 0,

      // 渲染时间
      renderTime: this.renderTimeBuffer.size() > 0
        ? this.renderTimeBuffer.toArray().at(-1)!
        : 0,
      avgRenderTime: Math.round(this.renderTimeBuffer.average() * 100) / 100,

      // 内存
      usedJSHeapSize: Math.round(this.usedJSHeap / 1048576 * 100) / 100,
      totalJSHeapSize: Math.round(this.totalJSHeap / 1048576 * 100) / 100,

      // 电路复杂度
      componentCount: this.componentCount,
      nodeCount: this.nodeCount,
      wireCount: this.wireCount,

      // 仿真统计
      simStepTime: this.lastSimStepTime,
      simTotalTime: Math.round(this.simTotalTime * 100) / 100,
      simSteps: this.simSteps,

      // 历史记录
      fpsHistory: this.fpsBuffer.toArray(),
      renderTimeHistory: this.renderTimeBuffer.toArray(),
    };
  }

  // ── Flame Chart Export ──────────────────────────────────────────────────

  /**
   * 导出 Chrome DevTools Performance 面板兼容的火焰图追踪数据。
   *
   * @returns JSON 格式的追踪数据字符串
   */
  exportFlameChartData(): string {
    const traceEvents = this.flameChartEntries.map((entry, i) => ({
      name: entry.name,
      cat: 'performance',
      ph: 'X', // Complete event
      pid: 1,
      tid: 1,
      ts: Math.round(entry.startTime * 1000), // microseconds
      dur: Math.round(entry.duration * 1000),
      args: { index: i },
    }));

    const trace = {
      traceEvents,
      displayTimeUnit: 'ms',
      // 收尾元数据
      metadata: {
        'chrome-version': 'PerformanceMonitor/1.0',
        'sample-interval-ms': this.sampleInterval,
        'history-size': this.historySize,
      },
    };

    return JSON.stringify(trace, null, 2);
  }

  // ── Reset ───────────────────────────────────────────────────────────────

  /**
   * 重置所有性能数据和历史记录。
   */
  reset(): void {
    this.fpsBuffer.clear();
    this.renderTimeBuffer.clear();
    this.frameTimestamps = [];
    this.currentFps = 0;
    this.lastSampleTime = performance.now();

    this.simStepStart = 0;
    this.simTotalTime = 0;
    this.simSteps = 0;
    this.lastSimStepTime = 0;

    this.componentCount = 0;
    this.nodeCount = 0;
    this.wireCount = 0;

    this.usedJSHeap = 0;
    this.totalJSHeap = 0;

    this.flameChartEntries = [];
  }

  // ── Subscribe ───────────────────────────────────────────────────────────

  /**
   * 订阅性能指标更新。每次采样间隔到期后会调用回调。
   *
   * @param callback - 接收指标快照的回调函数
   * @returns 取消订阅函数
   */
  subscribe(callback: (metrics: PerfMetrics) => void): () => void {
    this.subscribers.push(callback);

    // 首次订阅时启动 rAF 循环
    if (this.subscribers.length === 1) {
      this.startRafLoop();
    }

    // 返回取消订阅函数
    return () => {
      const idx = this.subscribers.indexOf(callback);
      if (idx !== -1) {
        this.subscribers.splice(idx, 1);
      }
      // 没有订阅者时停止 rAF
      if (this.subscribers.length === 0) {
        this.stopRafLoop();
      }
    };
  }

  // ── Internal ────────────────────────────────────────────────────────────

  /** 启动 requestAnimationFrame 循环以保持采样 */
  private startRafLoop(): void {
    const loop = () => {
      if (this.subscribers.length === 0) return;
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  /** 停止 rAF 循环 */
  private stopRafLoop(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  /** 读取 Chrome 内存 API（其他浏览器跳过） */
  private updateMemorySnapshot(): void {
    const memory = (performance as unknown as { memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
    } }).memory;

    if (memory) {
      this.usedJSHeap = memory.usedJSHeapSize;
      this.totalJSHeap = memory.totalJSHeapSize;
    }
  }

  /** 通知所有订阅者 */
  private notifySubscribers(): void {
    if (this.subscribers.length === 0) return;
    const metrics = this.getMetrics();
    for (const cb of this.subscribers) {
      try {
        cb(metrics);
      } catch {
        // 订阅者异常不应中断监控
      }
    }
  }

  /**
   * 添加一个火焰图条目（供内部或外部工具调用）。
   *
   * @param name - 条目名称
   * @param startTime - 开始时间 (ms, performance.now)
   * @param duration - 持续时间 (ms)
   */
  addFlameChartEntry(name: string, startTime: number, duration: number): void {
    this.flameChartEntries.push({ name, startTime, duration });

    // 限制条目数量避免内存泄漏
    if (this.flameChartEntries.length > 10000) {
      this.flameChartEntries = this.flameChartEntries.slice(-5000);
    }
  }
}

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * 基于 `requestAnimationFrame` 的节流函数。
 *
 * 在同一帧内多次调用时，只会在下一帧执行一次。适合高频触发的
 * 渲染相关回调（如拖拽、滚动事件）。
 *
 * @typeParam T - 被节流函数的类型
 * @param fn - 需要节流的函数
 * @returns 与输入同类型的节流后函数
 *
 * @example
 * ```ts
 * const onScroll = rafThrottle(() => {
 *   canvas.render();
 * });
 * window.addEventListener('scroll', onScroll);
 * ```
 */
export function rafThrottle<T extends (...args: any[]) => void>(fn: T): T {
  let rafId = 0;
  let lastArgs: any[] | null = null;

  const throttled = function (this: unknown, ...args: any[]) {
    lastArgs = args;
    if (rafId) return;

    rafId = requestAnimationFrame(() => {
      rafId = 0;
      if (lastArgs) {
        fn.apply(this, lastArgs);
        lastArgs = null;
      }
    });
  };

  return throttled as unknown as T;
}

/**
 * 批量更新调度器。
 *
 * 将多个零散的更新操作合并到下一帧统一执行，减少不必要的重复渲染。
 * 同一个回调多次 `schedule` 只会执行一次（基于 Set 去重）。
 *
 * @example
 * ```ts
 * const scheduler = new BatchScheduler();
 *
 * // 多处代码分别调度
 * scheduler.schedule(() => updateWire(wireA));
 * scheduler.schedule(() => updateWire(wireB));
 * scheduler.schedule(() => updateWire(wireA)); // 重复，只执行一次
 *
 * // 在渲染循环中统一 flush
 * scheduler.flush(); // 执行 updateWire(wireA) 和 updateWire(wireB) 各一次
 * ```
 */
export class BatchScheduler {
  /** 待执行的回调集合（Set 自动去重） */
  private pending = new Set<() => void>();
  /** 是否已通过 rAF 调度了 flush */
  private scheduled = false;
  /** rAF 回调 ID */
  private rafId = 0;

  /**
   * 调度一个回调。同一回调引用重复调用会被去重。
   *
   * 如果尚未安排自动 flush，会自动在下一帧触发。
   *
   * @param fn - 待批量执行的回调函数
   */
  schedule(fn: () => void): void {
    this.pending.add(fn);

    if (!this.scheduled) {
      this.scheduled = true;
      this.rafId = requestAnimationFrame(() => {
        this.flush();
      });
    }
  }

  /**
   * 立即执行所有待处理的回调并清空队列。
   *
   * 也可在渲染循环中手动调用以精确控制执行时机。
   */
  flush(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    this.scheduled = false;

    const fns = this.pending;
    this.pending = new Set();

    for (const fn of fns) {
      try {
        fn();
      } catch {
        // 单个回调异常不应阻断其他回调
      }
    }
  }

  /**
   * 取消所有待执行的回调。
   */
  clear(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    this.scheduled = false;
    this.pending.clear();
  }

  /**
   * 当前待执行的回调数量。
   */
  get size(): number {
    return this.pending.size;
  }
}
