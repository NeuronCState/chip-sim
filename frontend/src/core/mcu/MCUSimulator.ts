/**
 * MCU 仿真引擎 — 整合时钟、中断、定时器
 * 作为仿真步进的协调者，集成到现有电路仿真流程
 */

import { ClockSystem, type ClockSnapshot, MCU_CLOCK_PRESETS } from './ClockSystem';
import {
  InterruptController,
  type InterruptControllerSnapshot,
  type InterruptControllerEvents,
  type InterruptSourceType,
  INTERRUPT_SOURCES_8051,
  INTERRUPT_SOURCES_STM32_EXTI,
} from './InterruptController';
import {
  TimerModule,
  type TimerConfig,
  type TimerModuleEvents,
  type TimerState,
  createTimer0_8051,
  createTimer1_8051,
  createTimer0_ATmega,
  createTimer1_ATmega,
} from './TimerModule';

// ==================== MCU 型号定义 ====================

/** MCU 型号类型 */
export const MCUModel = {
  Generic8051: '8051',
  ATmega328P: 'atmega328p',
  STM32F103: 'stm32f103',
  Custom: 'custom',
} as const;
export type MCUModel = (typeof MCUModel)[keyof typeof MCUModel];

/** MCU 型号配置 */
export interface MCUModelConfig {
  model: MCUModel;
  name: string;
  description: string;
  clockPreset: string;   // 对应 MCU_CLOCK_PRESETS 的 key
  maxTimers: number;
  maxInterrupts: number;
  timerConfigs: TimerConfig[];
}

/** 预设 MCU 型号配置 */
export const MCU_PRESETS: Record<string, MCUModelConfig> = {
  '8051': {
    model: MCUModel.Generic8051,
    name: '8051 系列',
    description: '经典 8051 微控制器，12 时钟/指令',
    clockPreset: '8051',
    maxTimers: 2,
    maxInterrupts: 6,
    timerConfigs: [createTimer0_8051(), createTimer1_8051()],
  },
  'atmega328p': {
    model: MCUModel.ATmega328P,
    name: 'ATmega328P',
    description: 'AVR 8 位微控制器 (Arduino Uno)',
    clockPreset: 'atmega',
    maxTimers: 3,
    maxInterrupts: 26,
    timerConfigs: [createTimer0_ATmega(), createTimer1_ATmega()],
  },
  'stm32f103': {
    model: MCUModel.STM32F103,
    name: 'STM32F103C8',
    description: 'ARM Cortex-M3 72MHz (Blue Pill)',
    clockPreset: 'stm32',
    maxTimers: 4,
    maxInterrupts: 60,
    timerConfigs: [createTimer0_ATmega(), createTimer1_ATmega()], // 可以进一步自定义
  },
};

// ==================== MCU 仿真事件 ====================

/** MCU 仿真事件回调 */
export interface MCUSimEvents {
  onClockTick?: (tick: number, time: number) => void;
  onInterruptEvent?: InterruptControllerEvents['onInterruptEvent'];
  onTimerEvent?: TimerModuleEvents['onTimerEvent'];
  onPWMOutput?: TimerModuleEvents['onPWMOutput'];
  onStateChange?: (state: MCUState) => void;
}

// ==================== MCU 运行状态 ====================

/** MCU 完整运行状态 */
export interface MCUState {
  /** MCU 型号 */
  model: MCUModel;
  /** 仿真时间 (秒) */
  simTime: number;
  /** 时钟状态 */
  clock: ClockSnapshot;
  /** 定时器状态列表 */
  timers: TimerState[];
  /** 全局中断使能 */
  globalInterruptEnable: boolean;
  /** 当前服务的中断 */
  activeInterrupt: InterruptSourceType | null;
  /** 仿真是否运行中 */
  running: boolean;
}

/**
 * MCUSimulator — MCU 仿真主引擎
 *
 * 整合：
 * - ClockSystem (时钟)
 * - InterruptController (中断)
 * - TimerModule (定时器)
 *
 * 提供统一的仿真步进接口
 */
export class MCUSimulator {
  private clock: ClockSystem;
  private intController: InterruptController;
  private timerModule: TimerModule;
  private events: MCUSimEvents;
  private _running: boolean = false;
  private _model: MCUModel;

  constructor(modelConfig?: MCUModelConfig, events?: MCUSimEvents) {
    this.events = events ?? {};

    const preset = modelConfig ?? MCU_PRESETS['8051'];
    this._model = preset.model;

    // 初始化时钟
    const clockPreset = MCU_CLOCK_PRESETS[preset.clockPreset];
    this.clock = new ClockSystem(
      {
        source: 'internal' as const,
        frequency: clockPreset.internalOscFreq,
        pllMultiplier: 1,
        externalFrequency: 0,
        preset: clockPreset,
        simTimeStep: 1 / clockPreset.internalOscFreq,
      },
      {
        onClockTick: (tick, time) => {
          // 每个时钟周期驱动中断控制器和定时器
          this.intController.step(this.clock);
          this.timerModule.step(this.clock, this.intController);
          this.events.onClockTick?.(tick, time);
        },
      }
    );

    // 初始化中断控制器
    this.intController = new InterruptController({
      onInterruptEvent: (event) => this.events.onInterruptEvent?.(event),
    });

    // 根据型号注册中断源
    if (preset.model === MCUModel.Generic8051) {
      this.intController.registerSources(INTERRUPT_SOURCES_8051);
    } else if (preset.model === MCUModel.STM32F103) {
      this.intController.registerSources(INTERRUPT_SOURCES_STM32_EXTI);
    } else {
      // ATmega 等使用 8051 风格的简化中断
      this.intController.registerSources(INTERRUPT_SOURCES_8051);
    }

    // 初始化定时器模块
    this.timerModule = new TimerModule({
      onOverflow: (id) => this.events.onTimerEvent?.({
        type: 'overflow', timerId: id,
        timestamp: this.clock.simTime, tickNumber: this.clock.tickCount,
      }),
      onCompareMatch: (id, value) => this.events.onTimerEvent?.({
        type: 'compare_match', timerId: id, value,
        timestamp: this.clock.simTime, tickNumber: this.clock.tickCount,
      }),
      onCapture: (id, value) => this.events.onTimerEvent?.({
        type: 'capture', timerId: id, value,
        timestamp: this.clock.simTime, tickNumber: this.clock.tickCount,
      }),
      onPWMOutput: (id, pin, level) => this.events.onPWMOutput?.(id, pin, level),
    });

    // 创建预设定时器
    for (const timerConfig of preset.timerConfigs) {
      this.timerModule.createTimer(timerConfig);
    }
  }

  // ==================== 访问器 ====================

  /** 当前 MCU 型号 */
  get model(): MCUModel {
    return this._model;
  }

  /** 时钟系统 */
  get clockSystem(): ClockSystem {
    return this.clock;
  }

  /** 中断控制器 */
  get interruptController(): InterruptController {
    return this.intController;
  }

  /** 定时器模块 */
  get timerModuleRef(): TimerModule {
    return this.timerModule;
  }

  /** 是否正在运行 */
  get running(): boolean {
    return this._running;
  }

  /** 仿真时间 */
  get simTime(): number {
    return this.clock.simTime;
  }

  // ==================== 控制 ====================

  /** 启动仿真 */
  start(): void {
    this._running = true;
    this.clock.start();
    this.intController.setGlobalEnable(true);
    this.timerModule.startAll();
  }

  /** 停止仿真 */
  stop(): void {
    this._running = false;
    this.clock.stop();
    this.timerModule.stopAll();
  }

  /** 重置仿真 */
  reset(): void {
    this._running = false;
    this.clock.reset();
    this.intController.reset();
    this.timerModule.reset();
  }

  // ==================== 仿真步进 ====================

  /**
   * 推进指定数量的时钟周期
   * 这是仿真引擎的核心步进函数
   */
  advanceTicks(ticks: number): MCUState {
    this.clock.advanceTicks(ticks);
    this.events.onStateChange?.(this.getState());
    return this.getState();
  }

  /**
   * 推进指定仿真时间
   */
  advanceTime(seconds: number): MCUState {
    this.clock.advanceTime(seconds);
    this.events.onStateChange?.(this.getState());
    return this.getState();
  }

  // ==================== 外部交互 ====================

  /**
   * 触发外部中断
   */
  triggerExternalInterrupt(sourceId: InterruptSourceType, level: boolean): void {
    this.intController.triggerExternalInterrupt(sourceId, level, this.clock);
  }

  /**
   * 设置定时器外部引脚
   */
  setTimerExternalPin(timerId: string, level: boolean): void {
    this.timerModule.setExternalPin(timerId, level);
  }

  /**
   * 设置 PWM 占空比
   */
  setPWMDutyCycle(timerId: string, duty: number): void {
    this.timerModule.setPWMDutyCycle(timerId, duty);
  }

  // ==================== 中断控制 ====================

  /** 设置全局中断使能 */
  setGlobalInterruptEnable(enabled: boolean): void {
    this.intController.setGlobalEnable(enabled);
  }

  /** 设置中断使能寄存器 */
  setInterruptEnable(value: number): void {
    this.intController.setInterruptEnableRegister(value);
  }

  /** 设置中断优先级寄存器 */
  setInterruptPriority(value: number): void {
    this.intController.setInterruptPriorityRegister(value);
  }

  /** 中断返回 (RETI) */
  returnFromInterrupt(sourceId: InterruptSourceType): void {
    this.intController.returnFromInterrupt(sourceId, this.clock);
  }

  // ==================== 定时器控制 ====================

  /** 写入定时器值 */
  setTimerCounter(id: string, value: number): void {
    this.timerModule.setCounter(id, value);
  }

  /** 读取定时器值 */
  getTimerCounter(id: string): number | undefined {
    return this.timerModule.getCounter(id);
  }

  /** 获取定时器状态 */
  getTimerState(id: string): TimerState | undefined {
    return this.timerModule.getTimer(id)?.getState();
  }

  /** 获取 PWM 波形 */
  getPWMWaveform(timerId: string) {
    return this.timerModule.getPWMWaveform(timerId);
  }

  // ==================== 频率控制 ====================

  /** 改变系统时钟频率 */
  setSystemClockFrequency(freq: number): void {
    this.clock.setFrequency(freq);
  }

  /** 加载 MCU 预设 */
  loadPreset(modelConfig: MCUModelConfig): void {
    const clockPreset = MCU_CLOCK_PRESETS[modelConfig.clockPreset];
    this.clock.loadPreset(clockPreset);
    this._model = modelConfig.model;

    // 重新初始化定时器
    this.timerModule.reset();
    for (const tc of modelConfig.timerConfigs) {
      this.timerModule.createTimer(tc);
    }
  }

  // ==================== 状态获取 ====================

  /** 获取完整 MCU 状态 */
  getState(): MCUState {
    return {
      model: this._model,
      simTime: this.clock.simTime,
      clock: this.clock.getSnapshot(),
      timers: this.timerModule.getAllStates(),
      globalInterruptEnable: this.intController.isGlobalEnabled(),
      activeInterrupt: this.intController.getGlobalState().activeInterrupt,
      running: this._running,
    };
  }

  /** 获取快照 */
  getSnapshot(): MCUSnapshot {
    return {
      clock: this.clock.getSnapshot(),
      interrupts: this.intController.getSnapshot(),
      timers: this.timerModule.getSnapshot(),
      running: this._running,
      model: this._model,
    };
  }

  /** 从快照恢复 */
  restoreSnapshot(snapshot: MCUSnapshot): void {
    this.clock.restoreSnapshot(snapshot.clock);
    this.intController.restoreSnapshot(snapshot.interrupts);
    // 定时器恢复需要重新创建 timer 实例
    this._running = snapshot.running;
    this._model = snapshot.model;
  }
}

/** MCU 快照 */
export interface MCUSnapshot {
  clock: ClockSnapshot;
  interrupts: InterruptControllerSnapshot;
  timers: Map<string, any>;
  running: boolean;
  model: MCUModel;
}

// ==================== 工厂函数 ====================

/** 创建 8051 仿真器 */
export function create8051Simulator(events?: MCUSimEvents): MCUSimulator {
  return new MCUSimulator(MCU_PRESETS['8051'], events);
}

/** 创建 ATmega328P 仿真器 */
export function createATmegaSimulator(events?: MCUSimEvents): MCUSimulator {
  return new MCUSimulator(MCU_PRESETS['atmega328p'], events);
}

/** 创建 STM32F103 仿真器 */
export function createSTM32Simulator(events?: MCUSimEvents): MCUSimulator {
  return new MCUSimulator(MCU_PRESETS['stm32f103'], events);
}
