/**
 * SignalEventRecorder — 信号事件录制引擎
 *
 * 在仿真运行时自动录制所有信号变化事件
 * 支持环形缓冲区、时间轴回溯、事件查询
 */

// ==================== 事件类型定义 ====================

/** 连线类型 */
export type WireType = 'gpio' | 'uart' | 'i2c' | 'spi';

/** 信号事件 */
export interface SignalEvent {
  /** 仿真时间戳 (ms) */
  timestamp: number;
  /** 连线类型 */
  wireType: WireType;
  /** 引脚名称 */
  pinName: string;
  /** 前一个状态 */
  prevState: string;
  /** 下一个状态 */
  nextState: string;
  /** 解码后的命令描述 */
  decodedCommand: string;
  /** 关联的连线 ID */
  wireId?: string;
  /** 关联的源元件 ID */
  sourceComponentId?: string;
  /** 关联的目标元件 ID */
  targetComponentId?: string;
}

/** 连线状态快照（用于回溯恢复） */
export interface WireStateSnapshot {
  wireId: string;
  level: string;
  current: number;
  wireType: WireType;
}

/** 芯片引脚快照 */
export interface PinStateSnapshot {
  pinId: string;
  level: string;
  value: number;
  mode: string;
}

/** 完整仿真状态快照 */
export interface SimulationStateSnapshot {
  timestamp: number;
  wires: WireStateSnapshot[];
  pins: PinStateSnapshot[];
}

// ==================== 环形缓冲区 ====================

/**
 * 固定大小的环形缓冲区
 * 当达到最大容量时，覆盖最旧的事件
 */
class RingBuffer<T> {
  private buffer: (T | undefined)[];
  private head: number = 0;
  private tail: number = 0;
  private count: number = 0;
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  /** 添加事件 */
  push(item: T): void {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;

    if (this.count < this.capacity) {
      this.count++;
    } else {
      // 缓冲区已满，头指针前进
      this.head = (this.head + 1) % this.capacity;
    }
  }

  /** 获取所有事件（按时间顺序） */
  getAll(): T[] {
    if (this.count === 0) return [];

    const result: T[] = [];
    let idx = this.head;
    for (let i = 0; i < this.count; i++) {
      const item = this.buffer[idx];
      if (item !== undefined) {
        result.push(item);
      }
      idx = (idx + 1) % this.capacity;
    }
    return result;
  }

  /** 获取指定范围内的事件 */
  getInRange(startTime: number, endTime: number, accessor: (item: T) => number): T[] {
    return this.getAll().filter(item => {
      const ts = accessor(item);
      return ts >= startTime && ts <= endTime;
    });
  }

  /** 获取事件数量 */
  size(): number {
    return this.count;
  }

  /** 清空缓冲区 */
  clear(): void {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }

  /** 获取第一个事件的时间戳 */
  firstTimestamp(accessor: (item: T) => number): number | null {
    if (this.count === 0) return null;
    const first = this.buffer[this.head];
    return first !== undefined ? accessor(first) : null;
  }

  /** 获取最后一个事件的时间戳 */
  lastTimestamp(accessor: (item: T) => number): number | null {
    if (this.count === 0) return null;
    const lastIdx = (this.tail - 1 + this.capacity) % this.capacity;
    const last = this.buffer[lastIdx];
    return last !== undefined ? accessor(last) : null;
  }
}

// ==================== 事件录制引擎 ====================

/** 事件录制器配置 */
export interface RecorderConfig {
  /** 最大事件数量，默认 10000 */
  maxEvents?: number;
  /** 是否启用自动录制 */
  autoRecord?: boolean;
  /** 快照间隔 (ms)，默认 1000ms */
  snapshotInterval?: number;
}

/**
 * SignalEventRecorder — 信号事件录制引擎
 *
 * 功能：
 * - 自动录制信号变化事件
 * - 环形缓冲区存储
 * - 时间轴回溯：seekTo(timestamp)
 * - 事件查询：getEventsInRange(start, end)
 * - 状态快照：定期保存完整仿真状态
 */
export class SignalEventRecorder {
  /** 事件环形缓冲区 */
  private events: RingBuffer<SignalEvent>;
  /** 状态快照（用于快速回溯） */
  private snapshots: Map<number, SimulationStateSnapshot> = new Map();
  /** 快照间隔 */
  private snapshotInterval: number;
  /** 上次快照时间 */
  private lastSnapshotTime: number = 0;
  /** 是否正在录制 */
  private recording: boolean = false;
  /** 上一次引脚状态缓存（用于检测变化） */
  private lastPinStates: Map<string, string> = new Map();
  /** 上一次连线状态缓存 */
  private lastWireStates: Map<string, string> = new Map();
  /** 事件监听器 */
  private eventListeners: ((event: SignalEvent) => void)[] = [];
  /** 回溯监听器 */
  private seekListeners: ((timestamp: number) => void)[] = [];

  constructor(config?: RecorderConfig) {
    const maxEvents = config?.maxEvents ?? 10000;
    this.snapshotInterval = config?.snapshotInterval ?? 1000;
    this.events = new RingBuffer<SignalEvent>(maxEvents);
    this.recording = config?.autoRecord ?? true;
  }

  // ==================== 录制控制 ====================

  /** 开始录制 */
  start(): void {
    this.recording = true;
  }

  /** 停止录制 */
  stop(): void {
    this.recording = false;
  }

  /** 是否正在录制 */
  isRecording(): boolean {
    return this.recording;
  }

  /** 暂停录制（不清空缓冲区） */
  pause(): void {
    this.recording = false;
  }

  /** 恢复录制 */
  resume(): void {
    this.recording = true;
  }

  // ==================== 事件记录 ====================

  /**
   * 记录引脚状态变化事件
   *
   * @param timestamp 仿真时间戳 (ms)
   * @param wireType 连线类型
   * @param pinName 引脚名称
   * @param prevState 前一个状态
   * @param nextState 新状态
   * @param decodedCommand 解码后的命令描述
   * @param wireId 关联的连线 ID
   */
  recordPinEvent(
    timestamp: number,
    wireType: WireType,
    pinName: string,
    prevState: string,
    nextState: string,
    decodedCommand: string,
    wireId?: string,
    sourceComponentId?: string,
    targetComponentId?: string,
  ): void {
    if (!this.recording) return;

    const event: SignalEvent = {
      timestamp,
      wireType,
      pinName,
      prevState,
      nextState,
      decodedCommand,
      wireId,
      sourceComponentId,
      targetComponentId,
    };

    this.events.push(event);

    // 通知监听器
    for (const listener of this.eventListeners) {
      listener(event);
    }

    // 检查是否需要保存快照
    if (timestamp - this.lastSnapshotTime >= this.snapshotInterval) {
      this.saveSnapshot(timestamp);
      this.lastSnapshotTime = timestamp;
    }
  }

  /**
   * 检查并记录引脚变化（自动检测状态变化）
   *
   * @param timestamp 仿真时间戳
   * @param pinId 引脚 ID
   * @param currentState 当前状态
   * @param wireType 连线类型
   * @param decodedCommand 解码后的命令
   */
  checkAndRecordPinChange(
    timestamp: number,
    pinId: string,
    currentState: string,
    wireType: WireType = 'gpio',
    decodedCommand?: string,
    wireId?: string,
  ): void {
    if (!this.recording) return;

    const lastState = this.lastPinStates.get(pinId);

    if (lastState !== undefined && lastState !== currentState) {
      // 检测到状态变化
      const command = decodedCommand ?? this.autoDecode(wireType, pinId, lastState, currentState);
      this.recordPinEvent(timestamp, wireType, pinId, lastState, currentState, command, wireId);
    }

    this.lastPinStates.set(pinId, currentState);
  }

  /**
   * 检查并记录连线变化
   */
  checkAndRecordWireChange(
    timestamp: number,
    wireId: string,
    currentState: string,
    wireType: WireType = 'gpio',
    decodedCommand?: string,
  ): void {
    if (!this.recording) return;

    const lastState = this.lastWireStates.get(wireId);

    if (lastState !== undefined && lastState !== currentState) {
      const command = decodedCommand ?? this.autoDecode(wireType, wireId, lastState, currentState);
      this.recordPinEvent(timestamp, wireType, wireId, lastState, currentState, command, wireId);
    }

    this.lastWireStates.set(wireId, currentState);
  }

  /**
   * 自动解码信号变化
   */
  private autoDecode(wireType: WireType, pinName: string, prevState: string, nextState: string): string {
    switch (wireType) {
      case 'gpio':
        return `${pinName}: ${prevState} -> ${nextState}`;
      case 'uart':
        return `UART ${pinName}: ${prevState} -> ${nextState}`;
      case 'i2c':
        return `I2C ${pinName}: ${prevState} -> ${nextState}`;
      case 'spi':
        return `SPI ${pinName}: ${prevState} -> ${nextState}`;
      default:
        return `${pinName}: ${prevState} -> ${nextState}`;
    }
  }

  // ==================== 快照管理 ====================

  /**
   * 保存状态快照
   */
  saveSnapshot(timestamp: number, wires?: WireStateSnapshot[], pins?: PinStateSnapshot[]): void {
    const snapshot: SimulationStateSnapshot = {
      timestamp,
      wires: wires ?? [],
      pins: pins ?? [],
    };
    this.snapshots.set(timestamp, snapshot);

    // 清理过旧的快照（保留最近 100 个）
    const timestamps = Array.from(this.snapshots.keys()).sort((a, b) => a - b);
    while (timestamps.length > 100) {
      const oldest = timestamps.shift();
      if (oldest !== undefined) {
        this.snapshots.delete(oldest);
      }
    }
  }

  /**
   * 获取最接近目标时间的快照
   */
  private getClosestSnapshot(targetTimestamp: number): SimulationStateSnapshot | null {
    if (this.snapshots.size === 0) return null;

    let closest: SimulationStateSnapshot | null = null;
    let minDiff = Infinity;

    for (const snapshot of this.snapshots.values()) {
      const diff = Math.abs(snapshot.timestamp - targetTimestamp);
      if (diff < minDiff && snapshot.timestamp <= targetTimestamp) {
        minDiff = diff;
        closest = snapshot;
      }
    }

    return closest;
  }

  // ==================== 事件查询 ====================

  /**
   * 获取指定时间范围内的事件
   *
   * @param startTime 开始时间 (ms)
   * @param endTime 结束时间 (ms)
   * @returns 事件数组（按时间排序）
   */
  getEventsInRange(startTime: number, endTime: number): SignalEvent[] {
    return this.events.getInRange(startTime, endTime, e => e.timestamp);
  }

  /**
   * 获取指定连线的事件
   */
  getEventsForWire(wireId: string): SignalEvent[] {
    return this.events.getAll().filter(e => e.wireId === wireId);
  }

  /**
   * 获取指定连线在时间范围内的事件
   */
  getEventsForWireInRange(wireId: string, startTime: number, endTime: number): SignalEvent[] {
    return this.events.getAll().filter(e =>
      e.wireId === wireId && e.timestamp >= startTime && e.timestamp <= endTime
    );
  }

  /**
   * 获取所有事件
   */
  getAllEvents(): SignalEvent[] {
    return this.events.getAll();
  }

  /**
   * 获取事件总数
   */
  getEventCount(): number {
    return this.events.size();
  }

  /**
   * 获取录制的时间范围
   */
  getTimeRange(): { start: number; end: number } | null {
    const first = this.events.firstTimestamp(e => e.timestamp);
    const last = this.events.lastTimestamp(e => e.timestamp);
    if (first === null || last === null) return null;
    return { start: first, end: last };
  }

  /**
   * 获取第一个事件的时间戳
   */
  getFirstEventTime(): number | null {
    return this.events.firstTimestamp(e => e.timestamp);
  }

  /**
   * 获取最后一个事件的时间戳
   */
  getLastEventTime(): number | null {
    return this.events.lastTimestamp(e => e.timestamp);
  }

  // ==================== 时间轴回溯 ====================

  /**
   * 回溯到指定时间点
   *
   * 算法：
   * 1. 找到目标时间之前最近的快照
   * 2. 从快照开始，重放到目标时间
   * 3. 通知监听器进行状态恢复
   *
   * @param timestamp 目标时间戳 (ms)
   * @returns 该时间点之前的所有事件
   */
  seekTo(timestamp: number): SimulationStateSnapshot | null {
    // 找到最近的快照
    const snapshot = this.getClosestSnapshot(timestamp);

    // 获取从快照到目标时间之间的所有事件
    const eventsFromSnapshot = snapshot
      ? this.getEventsInRange(snapshot.timestamp, timestamp)
      : this.getEventsInRange(0, timestamp);

    // 通知回溯监听器
    for (const listener of this.seekListeners) {
      listener(timestamp);
    }

    return snapshot;
  }

  /**
   * 获取指定时间点的连线状态
   * 通过重放事件计算
   */
  getWireStateAtTime(wireId: string, timestamp: number): string | null {
    const events = this.getEventsForWireInRange(0, timestamp);
    if (events.length === 0) return null;

    // 按时间排序，取最后一个事件的状态
    const sorted = events.sort((a, b) => a.timestamp - b.timestamp);
    return sorted[sorted.length - 1].nextState;
  }

  // ==================== 事件监听 ====================

  /** 注册事件监听器 */
  onEvent(listener: (event: SignalEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      this.eventListeners = this.eventListeners.filter(l => l !== listener);
    };
  }

  /** 注册回溯监听器 */
  onSeek(listener: (timestamp: number) => void): () => void {
    this.seekListeners.push(listener);
    return () => {
      this.seekListeners = this.seekListeners.filter(l => l !== listener);
    };
  }

  // ==================== 数据导出 ====================

  /**
   * 导出为 CSV 格式
   */
  exportCSV(): string {
    const events = this.events.getAll();
    if (events.length === 0) return '';

    const headers = ['timestamp', 'wireType', 'pinName', 'prevState', 'nextState', 'decodedCommand', 'wireId'];
    const rows = events.map(e => [
      e.timestamp.toString(),
      e.wireType,
      e.pinName,
      e.prevState,
      e.nextState,
      `"${e.decodedCommand.replace(/"/g, '""')}"`,
      e.wireId ?? '',
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * 导出为 JSON 格式
   */
  exportJSON(): string {
    const events = this.events.getAll();
    return JSON.stringify(events, null, 2);
  }

  /**
   * 导出为 Blob（用于下载）
   */
  exportBlob(format: 'csv' | 'json'): Blob {
    const content = format === 'csv' ? this.exportCSV() : this.exportJSON();
    const mimeType = format === 'csv' ? 'text/csv' : 'application/json';
    return new Blob([content], { type: mimeType });
  }

  // ==================== 清理 ====================

  /**
   * 清空所有事件和快照
   */
  clear(): void {
    this.events.clear();
    this.snapshots.clear();
    this.lastPinStates.clear();
    this.lastWireStates.clear();
    this.lastSnapshotTime = 0;
  }

  /**
   * 重置状态缓存（不清空事件）
   */
  resetStateCache(): void {
    this.lastPinStates.clear();
    this.lastWireStates.clear();
  }
}

// ==================== 全局实例 ====================

let _globalRecorder: SignalEventRecorder | null = null;

/**
 * 获取全局事件录制器实例
 */
export function getGlobalRecorder(): SignalEventRecorder {
  if (!_globalRecorder) {
    _globalRecorder = new SignalEventRecorder({
      maxEvents: 10000,
      autoRecord: true,
      snapshotInterval: 1000,
    });
  }
  return _globalRecorder;
}

/**
 * 重置全局录制器（用于测试）
 */
export function resetGlobalRecorder(): void {
  if (_globalRecorder) {
    _globalRecorder.clear();
  }
  _globalRecorder = null;
}
