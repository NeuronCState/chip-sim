/**
 * 中断控制器模型
 * 支持中断源定义、优先级、嵌套中断、中断向量表
 * 模拟 IE/IP 寄存器模型，中断标志位自动置位/清除
 */

import type { ClockSystem } from './ClockSystem';

// ==================== 中断源定义 ====================

/** 中断源类型 */
export const InterruptSourceType = {
  ExternalINT0: 'ext_int0',       // 外部中断 0 (8051: P3.2)
  ExternalINT1: 'ext_int1',       // 外部中断 1 (8051: P3.3)
  Timer0Overflow: 'tmr0_ovf',     // 定时器 0 溢出
  Timer1Overflow: 'tmr1_ovf',     // 定时器 1 溢出
  Timer2Overflow: 'tmr2_ovf',     // 定时器 2 溢出
  Timer0Compare: 'tmr0_cmp',      // 定时器 0 比较匹配
  Timer1Compare: 'tmr1_cmp',      // 定时器 1 比较匹配
  UARTReceive: 'uart_rx',         // UART 接收完成
  UARTTransmit: 'uart_tx',        // UART 发送完成
  SPIComplete: 'spi_done',        // SPI 传输完成
  I2CComplete: 'i2c_done',        // I2C 传输完成
  ADCComplete: 'adc_done',        // ADC 转换完成
  ExternalINT2: 'ext_int2',       // 外部中断 2 (STM32)
  ExternalINT3: 'ext_int3',       // 外部中断 3
  PWMCycleComplete: 'pwm_cycle',  // PWM 周期完成
  WatchdogTimeout: 'wdt_timeout', // 看门狗超时
  SoftwareInterrupt: 'swi',       // 软件中断
} as const;
export type InterruptSourceType = (typeof InterruptSourceType)[keyof typeof InterruptSourceType];

/** 中断触发边沿 */
export const InterruptEdge = {
  LowLevel: 'low_level',
  HighLevel: 'high_level',
  Rising: 'rising',
  Falling: 'falling',
  Both: 'both',
} as const;
export type InterruptEdge = (typeof InterruptEdge)[keyof typeof InterruptEdge];

// ==================== 中断源配置 ====================

/** 单个中断源的配置 */
export interface InterruptSourceConfig {
  /** 中断源 ID */
  id: InterruptSourceType;
  /** 中断源名称 */
  name: string;
  /** 中断向量地址 */
  vectorAddress: number;
  /** 默认优先级 (0 = 最高) */
  defaultPriority: number;
  /** 支持的触发边沿 */
  supportedEdges: InterruptEdge[];
  /** 默认触发边沿 */
  defaultEdge: InterruptEdge;
  /** 是否可被全局禁止 */
  canBeMasked: boolean;
  /** 中断响应延迟 (时钟周期数) */
  latencyCycles: number;
}

// ==================== 中断向量表 ====================

/** 中断向量表条目 */
export interface InterruptVectorEntry {
  /** 中断源 ID */
  sourceId: InterruptSourceType;
  /** 向量地址 */
  address: number;
  /** 服务程序入口（由固件设定） */
  handlerAddress: number;
  /** 中断名称 */
  name: string;
}

// ==================== 中断优先级 ====================

/** 中断优先级（支持嵌套） */
export interface InterruptPriority {
  /** 中断源 ID */
  sourceId: InterruptSourceType;
  /** 优先级数值 (越小越高) */
  level: number;
  /** 是否可被同级或更高优先级中断嵌套 */
  allowNesting: boolean;
}

// ==================== 中断状态 ====================

/** 单个中断源的运行时状态 */
export interface InterruptSourceState {
  /** 中断源 ID */
  sourceId: InterruptSourceType;
  /** 中断使能标志 (IE 寄存器对应位) */
  enabled: boolean;
  /** 中断挂起标志 (硬件自动置位) */
  pending: boolean;
  /** 中断正在服务中 */
  inService: boolean;
  /** 当前触发边沿 */
  edge: InterruptEdge;
  /** 当前优先级 */
  priority: number;
  /** 上一次输入电平（用于边沿检测） */
  prevLevel: boolean;
  /** 标志位是否需要软件清除 */
  flagNeedsClear: boolean;
}

// ==================== 中断事件 ====================

/** 中断事件类型 */
export const InterruptEventType = {
  FlagSet: 'flag_set',             // 中断标志置位
  InterruptPending: 'pending',     // 中断挂起
  InterruptAcknowledged: 'ack',    // 中断响应 (CPU 开始处理)
  InterruptServicing: 'servicing', // 正在执行 ISR
  InterruptCompleted: 'completed', // ISR 执行完毕 (RETI)
  InterruptNested: 'nested',       // 发生中断嵌套
  InterruptMasked: 'masked',       // 中断被屏蔽
  FlagCleared: 'flag_cleared',     // 中断标志清除
} as const;
export type InterruptEventType = (typeof InterruptEventType)[keyof typeof InterruptEventType];

/** 中断事件记录 */
export interface InterruptEvent {
  type: InterruptEventType;
  sourceId: InterruptSourceType;
  timestamp: number;        // 仿真时间
  tickNumber: number;       // 时钟周期号
  detail?: string;
}

// ==================== 中断控制器 ====================

/** 中断控制器事件回调 */
export interface InterruptControllerEvents {
  onInterruptRequest?: (sourceId: InterruptSourceType) => void;
  onInterruptAcknowledge?: (sourceId: InterruptSourceType, vectorAddress: number) => void;
  onInterruptReturn?: (sourceId: InterruptSourceType) => void;
  onInterruptNested?: (higherId: InterruptSourceType, lowerId: InterruptSourceType) => void;
  onInterruptEvent?: (event: InterruptEvent) => void;
}

/** 全局中断使能状态 */
export interface GlobalInterruptState {
  /** 全局中断使能 (IE.7 / __enable_irq) */
  globalEnable: boolean;
  /** 当前正在服务的中断 (null = 无) */
  activeInterrupt: InterruptSourceType | null;
  /** 中断嵌套深度 */
  nestingDepth: number;
  /** 最大允许嵌套深度 */
  maxNestingDepth: number;
}

/**
 * InterruptController — 中断控制器核心
 *
 * 功能：
 * - 管理多个中断源（外部中断、定时器溢出、串口等）
 * - 中断优先级仲裁与嵌套支持
 * - IE/IP 寄存器模型
 * - 中断标志位自动置位/清除
 * - 中断响应延迟建模
 * - 中断事件历史记录
 */
export class InterruptController {
  private sources: Map<InterruptSourceType, InterruptSourceState>;
  private configs: Map<InterruptSourceType, InterruptSourceConfig>;
  private vectorTable: Map<InterruptSourceType, InterruptVectorEntry>;
  private globalState: GlobalInterruptState;
  private events: InterruptControllerEvents;

  // 中断请求队列（按优先级排序）
  private pendingQueue: InterruptSourceType[] = [];

  // 中断事件历史
  private eventHistory: InterruptEvent[] = [];
  private maxHistorySize: number = 1000;

  // 延迟计数器
  private latencyCounters: Map<InterruptSourceType, number> = new Map();

  constructor(events?: InterruptControllerEvents) {
    this.events = events ?? {};
    this.sources = new Map();
    this.configs = new Map();
    this.vectorTable = new Map();
    this.globalState = {
      globalEnable: false,
      activeInterrupt: null,
      nestingDepth: 0,
      maxNestingDepth: 2,
    };
  }

  // ==================== 初始化 ====================

  /**
   * 注册中断源
   */
  registerSource(config: InterruptSourceConfig): void {
    this.configs.set(config.id, config);
    this.sources.set(config.id, {
      sourceId: config.id,
      enabled: false,
      pending: false,
      inService: false,
      edge: config.defaultEdge,
      priority: config.defaultPriority,
      prevLevel: false,
      flagNeedsClear: true,
    });

    // 注册向量表条目
    this.vectorTable.set(config.id, {
      sourceId: config.id,
      address: config.vectorAddress,
      handlerAddress: config.vectorAddress, // 默认指向向量地址
      name: config.name,
    });
  }

  /**
   * 批量注册中断源
   */
  registerSources(configs: InterruptSourceConfig[]): void {
    for (const cfg of configs) {
      this.registerSource(cfg);
    }
  }

  /** 获取所有已注册的中断源 */
  getSourceIds(): InterruptSourceType[] {
    return Array.from(this.sources.keys());
  }

  // ==================== 中断使能控制 ====================

  /** 设置全局中断使能 */
  setGlobalEnable(enabled: boolean): void {
    this.globalState.globalEnable = enabled;
  }

  /** 获取全局中断使能状态 */
  isGlobalEnabled(): boolean {
    return this.globalState.globalEnable;
  }

  /** 设置单个中断源使能 */
  setSourceEnable(sourceId: InterruptSourceType, enabled: boolean): void {
    const state = this.sources.get(sourceId);
    if (!state) throw new Error(`未知中断源: ${sourceId}`);
    const config = this.configs.get(sourceId)!;
    if (enabled && !config.canBeMasked) {
      // 某些中断不能被禁止（如 NMI）
      return;
    }
    state.enabled = enabled;
  }

  /** 获取中断源使能状态 */
  isSourceEnabled(sourceId: InterruptSourceType): boolean {
    return this.sources.get(sourceId)?.enabled ?? false;
  }

  /**
   * 设置中断使能寄存器 (模拟 IE 寄存器)
   * @param value 8位寄存器值
   */
  setInterruptEnableRegister(value: number): void {
    // 典型 8051 IE 寄存器:
    // Bit 7: EA (全局使能)
    // Bit 4: ES (串口中断)
    // Bit 3: ET1 (定时器1)
    // Bit 2: EX1 (外部中断1)
    // Bit 1: ET0 (定时器0)
    // Bit 0: EX0 (外部中断0)
    this.globalState.globalEnable = !!(value & 0x80);

    const mapping: [InterruptSourceType, number][] = [
      [InterruptSourceType.ExternalINT0, 0x01],
      [InterruptSourceType.Timer0Overflow, 0x02],
      [InterruptSourceType.ExternalINT1, 0x04],
      [InterruptSourceType.Timer1Overflow, 0x08],
      [InterruptSourceType.UARTReceive, 0x10],
      [InterruptSourceType.UARTTransmit, 0x10], // 共用 ES
    ];

    for (const [src, bit] of mapping) {
      const state = this.sources.get(src);
      if (state) {
        state.enabled = !!(value & bit);
      }
    }
  }

  /**
   * 读取中断使能寄存器值
   */
  getInterruptEnableRegister(): number {
    let value = 0;
    if (this.globalState.globalEnable) value |= 0x80;

    const state0 = this.sources.get(InterruptSourceType.ExternalINT0);
    if (state0?.enabled) value |= 0x01;
    const state1 = this.sources.get(InterruptSourceType.Timer0Overflow);
    if (state1?.enabled) value |= 0x02;
    const state2 = this.sources.get(InterruptSourceType.ExternalINT1);
    if (state2?.enabled) value |= 0x04;
    const state3 = this.sources.get(InterruptSourceType.Timer1Overflow);
    if (state3?.enabled) value |= 0x08;
    const state4 = this.sources.get(InterruptSourceType.UARTReceive);
    if (state4?.enabled) value |= 0x10;

    return value;
  }

  /**
   * 设置中断优先级寄存器 (模拟 IP 寄存器)
   * @param value 8位寄存器值
   */
  setInterruptPriorityRegister(value: number): void {
    const mapping: [InterruptSourceType, number][] = [
      [InterruptSourceType.ExternalINT0, 0x01],
      [InterruptSourceType.Timer0Overflow, 0x02],
      [InterruptSourceType.ExternalINT1, 0x04],
      [InterruptSourceType.Timer1Overflow, 0x08],
      [InterruptSourceType.UARTReceive, 0x10],
    ];

    for (const [src, bit] of mapping) {
      const state = this.sources.get(src);
      if (state) {
        state.priority = (value & bit) ? 0 : 1; // 0=高优先级, 1=低优先级
      }
    }
  }

  // ==================== 中断触发 ====================

  /**
   * 设置中断触发边沿
   */
  setInterruptEdge(sourceId: InterruptSourceType, edge: InterruptEdge): void {
    const state = this.sources.get(sourceId);
    if (!state) throw new Error(`未知中断源: ${sourceId}`);
    state.edge = edge;
  }

  /**
   * 请求中断（硬件中断源调用此方法）
   * 自动处理标志位置位和中断排队
   */
  requestInterrupt(sourceId: InterruptSourceType, clock: ClockSystem): void {
    const state = this.sources.get(sourceId);
    const config = this.configs.get(sourceId);
    if (!state || !config) return;

    // 置位中断标志
    if (!state.pending) {
      state.pending = true;
      this.recordEvent({
        type: InterruptEventType.FlagSet,
        sourceId,
        timestamp: clock.simTime,
        tickNumber: clock.tickCount,
      });
    }

    // 检查是否可以立即响应
    this.evaluateInterruptRequest(sourceId, clock);
  }

  /**
   * 触发外部中断（边沿/电平检测）
   * @param sourceId 中断源
   * @param level 当前引脚电平
   * @param clock 时钟系统
   */
  triggerExternalInterrupt(
    sourceId: InterruptSourceType,
    level: boolean,
    clock: ClockSystem
  ): void {
    const state = this.sources.get(sourceId);
    if (!state) return;

    const prevLevel = state.prevLevel;
    state.prevLevel = level;

    let shouldTrigger = false;
    switch (state.edge) {
      case InterruptEdge.Rising:
        shouldTrigger = !prevLevel && level;
        break;
      case InterruptEdge.Falling:
        shouldTrigger = prevLevel && !level;
        break;
      case InterruptEdge.Both:
        shouldTrigger = prevLevel !== level;
        break;
      case InterruptEdge.HighLevel:
        shouldTrigger = level;
        break;
      case InterruptEdge.LowLevel:
        shouldTrigger = !level;
        break;
    }

    if (shouldTrigger) {
      this.requestInterrupt(sourceId, clock);
    }
  }

  // ==================== 中断评估与响应 ====================

  /**
   * 评估中断请求是否可以被响应
   */
  private evaluateInterruptRequest(sourceId: InterruptSourceType, clock: ClockSystem): void {
    const state = this.sources.get(sourceId);
    const config = this.configs.get(sourceId);
    if (!state || !config) return;

    // 检查全局使能
    if (!this.globalState.globalEnable) {
      this.recordEvent({
        type: InterruptEventType.InterruptMasked,
        sourceId,
        timestamp: clock.simTime,
        tickNumber: clock.tickCount,
        detail: '全局中断禁止',
      });
      return;
    }

    // 检查源使能
    if (!state.enabled) {
      this.recordEvent({
        type: InterruptEventType.InterruptMasked,
        sourceId,
        timestamp: clock.simTime,
        tickNumber: clock.tickCount,
        detail: '中断源未使能',
      });
      return;
    }

    // 检查中断是否已经在服务
    if (state.inService) {
      return; // 同一中断不能重入
    }

    // 检查嵌套条件
    const activeId = this.globalState.activeInterrupt;
    if (activeId !== null) {
      const activeState = this.sources.get(activeId);
      if (!activeState) return;

      // 请求的优先级必须高于当前服务的中断
      if (state.priority >= activeState.priority && !state.priority) {
        // 同级或更低优先级，加入队列等待
        this.enqueuePending(sourceId);
        return;
      }

      // 检查嵌套深度
      if (this.globalState.nestingDepth >= this.globalState.maxNestingDepth) {
        this.enqueuePending(sourceId);
        return;
      }

      // 允许嵌套 — 发生中断嵌套
      this.recordEvent({
        type: InterruptEventType.InterruptNested,
        sourceId,
        timestamp: clock.simTime,
        tickNumber: clock.tickCount,
        detail: `嵌套: ${sourceId} 打断 ${activeId}`,
      });
      this.events.onInterruptNested?.(sourceId, activeId);
    }

    // 开始中断响应
    this.acknowledgeInterrupt(sourceId, clock);
  }

  /**
   * 响应中断
   * 模拟 CPU 的中断响应过程：压栈、跳转到向量地址
   */
  private acknowledgeInterrupt(sourceId: InterruptSourceType, clock: ClockSystem): void {
    const state = this.sources.get(sourceId);
    const config = this.configs.get(sourceId);
    if (!state || !config) return;

    // 进入延迟阶段
    this.latencyCounters.set(sourceId, config.latencyCycles);

    this.recordEvent({
      type: InterruptEventType.InterruptAcknowledged,
      sourceId,
      timestamp: clock.simTime,
      tickNumber: clock.tickCount,
      detail: `响应延迟: ${config.latencyCycles} 周期`,
    });

    this.events.onInterruptRequest?.(sourceId);
  }

  /**
   * 时钟步进 — 处理中断延迟和服务状态
   * 每个时钟周期调用一次
   */
  step(clock: ClockSystem): void {
    // 处理延迟计数器
    for (const [sourceId, remaining] of this.latencyCounters) {
      if (remaining <= 1) {
        // 延迟结束，正式进入 ISR
        this.enterISR(sourceId, clock);
        this.latencyCounters.delete(sourceId);
      } else {
        this.latencyCounters.set(sourceId, remaining - 1);
      }
    }
  }

  /**
   * 进入中断服务程序
   */
  private enterISR(sourceId: InterruptSourceType, clock: ClockSystem): void {
    const state = this.sources.get(sourceId);
    const vector = this.vectorTable.get(sourceId);
    if (!state || !vector) return;

    // 如果有正在服务的低优先级中断，需要嵌套
    const activeId = this.globalState.activeInterrupt;
    if (activeId !== null) {
      this.globalState.nestingDepth++;
    }

    state.inService = state.pending;
    state.pending = false; // 清除挂起标志
    this.globalState.activeInterrupt = sourceId;

    this.recordEvent({
      type: InterruptEventType.InterruptServicing,
      sourceId,
      timestamp: clock.simTime,
      tickNumber: clock.tickCount,
      detail: `跳转到向量地址 0x${vector.address.toString(16).toUpperCase()}`,
    });

    this.events.onInterruptAcknowledge?.(sourceId, vector.address);
  }

  /**
   * 中断返回 (RETI 指令调用)
   * 恢复中断上下文，处理嵌套返回
   */
  returnFromInterrupt(sourceId: InterruptSourceType, clock: ClockSystem): void {
    const state = this.sources.get(sourceId);
    if (!state) return;

    state.inService = false;

    this.recordEvent({
      type: InterruptEventType.InterruptCompleted,
      sourceId,
      timestamp: clock.simTime,
      tickNumber: clock.tickCount,
    });

    // 处理嵌套返回
    if (this.globalState.nestingDepth > 0) {
      this.globalState.nestingDepth--;
    }

    if (this.globalState.nestingDepth === 0) {
      this.globalState.activeInterrupt = null;
    }

    this.events.onInterruptReturn?.(sourceId);

    // 检查是否有等待中的中断
    this.processNextPending(clock);
  }

  /**
   * 手动清除中断标志
   */
  clearInterruptFlag(sourceId: InterruptSourceType): void {
    const state = this.sources.get(sourceId);
    if (!state) return;
    state.pending = false;
  }

  /**
   * 检查并清除需要软件清除的标志位
   * 模拟 8051 风格：某些标志位需要在 ISR 中软件清零
   */
  autoClearFlag(sourceId: InterruptSourceType): boolean {
    const state = this.sources.get(sourceId);
    if (!state) return false;
    if (state.flagNeedsClear) {
      state.pending = false;
      return true;
    }
    return false;
  }

  // ==================== 中断队列管理 ====================

  /** 将中断源加入等待队列 */
  private enqueuePending(sourceId: InterruptSourceType): void {
    if (this.pendingQueue.includes(sourceId)) return;
    this.pendingQueue.push(sourceId);
    // 按优先级排序（数值小 = 优先级高 = 排前面）
    this.pendingQueue.sort((a, b) => {
      const pa = this.sources.get(a)?.priority ?? 99;
      const pb = this.sources.get(b)?.priority ?? 99;
      return pa - pb;
    });
  }

  /** 处理下一个等待中的中断 */
  private processNextPending(clock: ClockSystem): void {
    while (this.pendingQueue.length > 0) {
      const nextId = this.pendingQueue.shift()!;
      const state = this.sources.get(nextId);
      if (state && state.pending && state.enabled) {
        this.evaluateInterruptRequest(nextId, clock);
        break;
      }
    }
  }

  // ==================== 状态查询 ====================

  /** 获取全局中断状态 */
  getGlobalState(): Readonly<GlobalInterruptState> {
    return { ...this.globalState };
  }

  /** 获取指定中断源状态 */
  getSourceState(sourceId: InterruptSourceType): Readonly<InterruptSourceState> | undefined {
    const state = this.sources.get(sourceId);
    return state ? { ...state } : undefined;
  }

  /** 获取所有中断源状态 */
  getAllSourceStates(): InterruptSourceState[] {
    return Array.from(this.sources.values()).map(s => ({ ...s }));
  }

  /** 获取中断向量表 */
  getVectorTable(): InterruptVectorEntry[] {
    return Array.from(this.vectorTable.values());
  }

  /** 获取等待中的中断源 */
  getPendingInterrupts(): InterruptSourceType[] {
    return [...this.pendingQueue];
  }

  /** 获取中断事件历史 */
  getEventHistory(limit?: number): InterruptEvent[] {
    if (limit) {
      return this.eventHistory.slice(-limit);
    }
    return [...this.eventHistory];
  }

  /** 获取指定中断源的事件历史 */
  getSourceEventHistory(sourceId: InterruptSourceType, limit?: number): InterruptEvent[] {
    const filtered = this.eventHistory.filter(e => e.sourceId === sourceId);
    if (limit) {
      return filtered.slice(-limit);
    }
    return filtered;
  }

  // ==================== 辅助 ====================

  /** 记录中断事件 */
  private recordEvent(event: InterruptEvent): void {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
    this.events.onInterruptEvent?.(event);
  }

  /** 重置控制器 */
  reset(): void {
    for (const state of this.sources.values()) {
      state.enabled = false;
      state.pending = false;
      state.inService = false;
      state.prevLevel = false;
    }
    this.globalState.globalEnable = false;
    this.globalState.activeInterrupt = null;
    this.globalState.nestingDepth = 0;
    this.pendingQueue = [];
    this.latencyCounters.clear();
    this.eventHistory = [];
  }

  /** 获取快照 */
  getSnapshot(): InterruptControllerSnapshot {
    return {
      sources: Array.from(this.sources.entries()).map(([, s]) => ({ ...s })),
      globalState: { ...this.globalState },
      pendingQueue: [...this.pendingQueue],
      eventHistory: this.eventHistory.slice(-100),
    };
  }

  /** 从快照恢复 */
  restoreSnapshot(snapshot: InterruptControllerSnapshot): void {
    for (const s of snapshot.sources) {
      this.sources.set(s.sourceId, { ...s });
    }
    this.globalState = { ...snapshot.globalState };
    this.pendingQueue = [...snapshot.pendingQueue];
    this.eventHistory = [...snapshot.eventHistory];
  }
}

/** 中断控制器快照 */
export interface InterruptControllerSnapshot {
  sources: InterruptSourceState[];
  globalState: GlobalInterruptState;
  pendingQueue: InterruptSourceType[];
  eventHistory: InterruptEvent[];
}

// ==================== 预设中断源定义 ====================

/** 8051 标准中断源配置 */
export const INTERRUPT_SOURCES_8051: InterruptSourceConfig[] = [
  {
    id: InterruptSourceType.ExternalINT0,
    name: '外部中断 0 (INT0)',
    vectorAddress: 0x0003,
    defaultPriority: 0,
    supportedEdges: [InterruptEdge.LowLevel, InterruptEdge.Falling],
    defaultEdge: InterruptEdge.Falling,
    canBeMasked: true,
    latencyCycles: 3,
  },
  {
    id: InterruptSourceType.Timer0Overflow,
    name: '定时器 0 溢出',
    vectorAddress: 0x000B,
    defaultPriority: 1,
    supportedEdges: [InterruptEdge.HighLevel],
    defaultEdge: InterruptEdge.HighLevel,
    canBeMasked: true,
    latencyCycles: 3,
  },
  {
    id: InterruptSourceType.ExternalINT1,
    name: '外部中断 1 (INT1)',
    vectorAddress: 0x0013,
    defaultPriority: 2,
    supportedEdges: [InterruptEdge.LowLevel, InterruptEdge.Falling],
    defaultEdge: InterruptEdge.Falling,
    canBeMasked: true,
    latencyCycles: 3,
  },
  {
    id: InterruptSourceType.Timer1Overflow,
    name: '定时器 1 溢出',
    vectorAddress: 0x001B,
    defaultPriority: 3,
    supportedEdges: [InterruptEdge.HighLevel],
    defaultEdge: InterruptEdge.HighLevel,
    canBeMasked: true,
    latencyCycles: 3,
  },
  {
    id: InterruptSourceType.UARTReceive,
    name: '串口接收 (RI)',
    vectorAddress: 0x0023,
    defaultPriority: 4,
    supportedEdges: [InterruptEdge.HighLevel],
    defaultEdge: InterruptEdge.HighLevel,
    canBeMasked: true,
    latencyCycles: 3,
  },
  {
    id: InterruptSourceType.UARTTransmit,
    name: '串口发送 (TI)',
    vectorAddress: 0x0023,
    defaultPriority: 4,
    supportedEdges: [InterruptEdge.HighLevel],
    defaultEdge: InterruptEdge.HighLevel,
    canBeMasked: true,
    latencyCycles: 3,
  },
];

/** STM32 外部中断源配置 */
export const INTERRUPT_SOURCES_STM32_EXTI: InterruptSourceConfig[] = [
  {
    id: InterruptSourceType.ExternalINT0,
    name: 'EXTI Line 0',
    vectorAddress: 0x0000_0058,
    defaultPriority: 0,
    supportedEdges: [InterruptEdge.Rising, InterruptEdge.Falling, InterruptEdge.Both],
    defaultEdge: InterruptEdge.Rising,
    canBeMasked: true,
    latencyCycles: 12, // ARM Cortex-M 中断延迟
  },
  {
    id: InterruptSourceType.ExternalINT1,
    name: 'EXTI Line 1',
    vectorAddress: 0x0000_005C,
    defaultPriority: 1,
    supportedEdges: [InterruptEdge.Rising, InterruptEdge.Falling, InterruptEdge.Both],
    defaultEdge: InterruptEdge.Rising,
    canBeMasked: true,
    latencyCycles: 12,
  },
];
