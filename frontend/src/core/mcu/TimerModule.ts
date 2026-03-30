/**
 * 定时器/计数器模块
 * 支持 8 位/16 位定时器，普通/CTC/PWM/输入捕获模式
 * 预分频器配置，溢出中断触发，PWM 波形输出
 */

import type { ClockSystem } from './ClockSystem';
import type { InterruptController, InterruptSourceType } from './InterruptController';

// ==================== 定时器模式 ====================

/** 定时器工作模式 */
export const TimerMode = {
  Normal: 'normal',           // 普通模式：自由运行计数
  CTC: 'ctc',                // CTC 模式：比较匹配清零
  FastPWM: 'fast_pwm',       // 快速 PWM
  PhaseCorrectPWM: 'phase_correct_pwm', // 相位校正 PWM
  InputCapture: 'input_capture', // 输入捕获模式
  OneShot: 'one_shot',       // 单次触发模式
} as const;
export type TimerMode = (typeof TimerMode)[keyof typeof TimerMode];

/** 定时器位宽 */
export type TimerBitWidth = 8 | 16;

/** 定时器计数方向 */
export const TimerDirection = {
  Up: 'up',
  Down: 'down',
  UpDown: 'up_down', // 相位校正 PWM
} as const;
export type TimerDirection = (typeof TimerDirection)[keyof typeof TimerDirection];

/** 定时器时钟源 */
export const TimerClockSource = {
  SystemClock: 'system',    // 系统时钟 (经过预分频)
  ExternalPin: 'external',  // 外部引脚计数
  ExternalRising: 'ext_rise',  // 外部引脚上升沿
  ExternalFalling: 'ext_fall', // 外部引脚下降沿
} as const;
export type TimerClockSource = (typeof TimerClockSource)[keyof typeof TimerClockSource];

// ==================== 定时器配置 ====================

/** PWM 配置 */
export interface PWMConfig {
  /** PWM 频率 (Hz) — 自动从定时器参数计算或手动指定 */
  frequency: number;
  /** 占空比 (0.0 ~ 1.0) */
  dutyCycle: number;
  /** PWM 输出引脚 */
  outputPin: string;
  /** 比较输出模式 */
  outputMode: 'non_inverting' | 'inverting' | 'toggle';
  /** 是否启用死区时间 */
  deadTimeEnabled: boolean;
  /** 死区时间 (时钟周期数) */
  deadTimeCycles: number;
}

/** 输入捕获配置 */
export interface InputCaptureConfig {
  /** 捕获引脚 */
  capturePin: string;
  /** 捕获边沿 */
  captureEdge: 'rising' | 'falling' | 'both';
  /** 噪声取消器 */
  noiseCanceler: boolean;
  /** 是否使用捕获中断 */
  useInterrupt: boolean;
}

/** 定时器配置 */
export interface TimerConfig {
  /** 定时器 ID */
  id: string;
  /** 定时器名称 */
  name: string;
  /** 位宽 */
  bitWidth: TimerBitWidth;
  /** 工作模式 */
  mode: TimerMode;
  /** 时钟源 */
  clockSource: TimerClockSource;
  /** 预分频比 (1, 8, 64, 256, 1024) */
  prescaler: number;
  /** 计数方向 */
  direction: TimerDirection;
  /** 初始计数值 */
  initialValue: number;
  /** 比较匹配值 (CTC/PWM 模式) */
  compareValue: number;
  /** 溢出时关联的中断源 */
  overflowInterruptSource?: InterruptSourceType;
  /** 比较匹配中断源 */
  compareInterruptSource?: InterruptSourceType;
  /** 输入捕获中断源 */
  captureInterruptSource?: InterruptSourceType;
  /** PWM 配置 (PWM 模式时使用) */
  pwmConfig?: Partial<PWMConfig>;
  /** 输入捕获配置 */
  captureConfig?: Partial<InputCaptureConfig>;
}

// ==================== 定时器运行时状态 ====================

/** 定时器运行时状态 */
export interface TimerState {
  /** 定时器 ID */
  id: string;
  /** 当前计数值 */
  counter: number;
  /** 溢出标志 */
  overflowFlag: boolean;
  /** 比较匹配标志 */
  compareMatchFlag: boolean;
  /** 输入捕获值 */
  captureValue: number;
  /** 捕获标志 */
  captureFlag: boolean;
  /** 是否正在运行 */
  running: boolean;
  /** 总计数次数 */
  totalTicks: number;
  /** 溢出次数 */
  overflowCount: number;
  /** PWM 输出当前值 (0 或 1) */
  pwmOutput: boolean;
  /** PWM 占空比计算值 */
  pwmDutyValue: number;
  /** 上升沿计数 (输入捕获) */
  captureRiseCount: number;
  /** 下降沿计数 (输入捕获) */
  captureFallCount: number;
}

/** PWM 波形数据点 */
export interface PWMWaveformPoint {
  time: number;
  value: 0 | 1;
  /** 该状态的持续时间 */
  duration: number;
}

/** 定时器事件 */
export interface TimerEvent {
  type: 'overflow' | 'compare_match' | 'capture' | 'start' | 'stop' | 'reset';
  timerId: string;
  timestamp: number;
  tickNumber: number;
  value?: number;
  detail?: string;
}

// ==================== 定时器模块 ====================

/** 定时器模块事件回调 */
export interface TimerModuleEvents {
  onOverflow?: (timerId: string) => void;
  onCompareMatch?: (timerId: string, value: number) => void;
  onCapture?: (timerId: string, capturedValue: number) => void;
  onPWMOutput?: (timerId: string, pin: string, level: boolean) => void;
  onTimerEvent?: (event: TimerEvent) => void;
}

/**
 * Timer — 单个定时器实例
 */
class Timer {
  readonly config: TimerConfig;
  private state: TimerState;
  private events: TimerModuleEvents;
  private externalPinLevel: boolean = false;
  private prevExternalPinLevel: boolean = false;

  // PWM 波形记录
  private pwmWaveform: PWMWaveformPoint[] = [];
  private maxWaveformPoints: number = 500;

  constructor(config: TimerConfig, events: TimerModuleEvents) {
    this.config = config;
    this.events = events;
    this.state = {
      id: config.id,
      counter: config.initialValue,
      overflowFlag: false,
      compareMatchFlag: false,
      captureValue: 0,
      captureFlag: false,
      running: false,
      totalTicks: 0,
      overflowCount: 0,
      pwmOutput: false,
      pwmDutyValue: 0,
      captureRiseCount: 0,
      captureFallCount: 0,
    };
  }

  /** 获取当前状态 */
  getState(): Readonly<TimerState> {
    return { ...this.state };
  }

  /** 获取 PWM 波形数据 */
  getPWMWaveform(): PWMWaveformPoint[] {
    return [...this.pwmWaveform];
  }

  /** 启动定时器 */
  start(): void {
    this.state.running = true;
    this.recordEvent('start', this.state.counter);
  }

  /** 停止定时器 */
  stop(): void {
    this.state.running = false;
    this.recordEvent('stop', this.state.counter);
  }

  /** 重置定时器 */
  reset(): void {
    this.state.counter = this.config.initialValue;
    this.state.overflowFlag = false;
    this.state.compareMatchFlag = false;
    this.state.captureFlag = false;
    this.state.totalTicks = 0;
    this.state.overflowCount = 0;
    this.state.pwmOutput = false;
    this.pwmWaveform = [];
    this.recordEvent('reset', this.state.counter);
  }

  /** 写入计数值 */
  setCounter(value: number): void {
    this.state.counter = value & this.maxCount;
  }

  /** 读取计数值 */
  getCounter(): number {
    return this.state.counter;
  }

  /** 写入比较值 */
  setCompareValue(value: number): void {
    this.config.compareValue = value & this.maxCount;
  }

  /** 设置外部引脚电平（用于外部计数和输入捕获） */
  setExternalPin(level: boolean): void {
    this.prevExternalPinLevel = this.externalPinLevel;
    this.externalPinLevel = level;
  }

  /** 设置 PWM 占空比 */
  setPWMDutyCycle(duty: number): void {
    const clamped = Math.max(0, Math.min(1, duty));
    if (this.config.pwmConfig) {
      this.config.pwmConfig.dutyCycle = clamped;
    }
  }

  /** 最大计数值 */
  private get maxCount(): number {
    return (1 << this.config.bitWidth) - 1;
  }

  /** 溢出值 */
  private get overflowAt(): number {
    return this.maxCount;
  }

  /**
   * 时钟步进 — 每个系统时钟周期调用
   * 返回 true 表示发生溢出或比较匹配
   */
  step(systemClock: ClockSystem, intController: InterruptController): boolean {
    if (!this.state.running) return false;

    let clockTick = false;

    // 确定时钟源
    switch (this.config.clockSource) {
      case TimerClockSource.SystemClock: {
        // 预分频
        this.state.totalTicks++;
        if (this.state.totalTicks % this.config.prescaler === 0) {
          clockTick = true;
        }
        break;
      }
      case TimerClockSource.ExternalRising: {
        // 外部上升沿计数
        if (!this.prevExternalPinLevel && this.externalPinLevel) {
          clockTick = true;
        }
        break;
      }
      case TimerClockSource.ExternalFalling: {
        // 外部下降沿计数
        if (this.prevExternalPinLevel && !this.externalPinLevel) {
          clockTick = true;
        }
        break;
      }
      case TimerClockSource.ExternalPin: {
        // 外部引脚电平计数
        if (this.externalPinLevel) {
          clockTick = true;
        }
        break;
      }
    }

    if (!clockTick) return false;

    // 根据模式更新计数器
    const clock = systemClock;
    let eventHappened = false;

    switch (this.config.mode) {
      case TimerMode.Normal:
        eventHappened = this.stepNormal(intController, clock);
        break;
      case TimerMode.CTC:
        eventHappened = this.stepCTC(intController, clock);
        break;
      case TimerMode.FastPWM:
        eventHappened = this.stepFastPWM(intController, clock);
        break;
      case TimerMode.PhaseCorrectPWM:
        eventHappened = this.stepPhaseCorrectPWM(intController, clock);
        break;
      case TimerMode.InputCapture:
        eventHappened = this.stepInputCapture(intController, clock);
        break;
      case TimerMode.OneShot:
        eventHappened = this.stepOneShot(intController, clock);
        break;
    }

    return eventHappened;
  }

  // ==================== 普通模式 ====================

  private stepNormal(ic: InterruptController, clock: ClockSystem): boolean {
    if (this.config.direction === TimerDirection.Up) {
      this.state.counter++;
      if (this.state.counter > this.overflowAt) {
        this.state.counter = 0;
        this.state.overflowFlag = true;
        this.state.overflowCount++;
        this.triggerOverflowInterrupt(ic, clock);
        this.recordEvent('overflow', this.overflowAt, clock);
        return true;
      }
    } else {
      // 向下计数
      if (this.state.counter === 0) {
        this.state.counter = this.overflowAt;
        this.state.overflowFlag = true;
        this.state.overflowCount++;
        this.triggerOverflowInterrupt(ic, clock);
        this.recordEvent('overflow', 0, clock);
        return true;
      }
      this.state.counter--;
    }
    return false;
  }

  // ==================== CTC 模式 ====================

  private stepCTC(ic: InterruptController, clock: ClockSystem): boolean {
    this.state.counter++;
    let event = false;

    if (this.state.counter >= this.config.compareValue) {
      this.state.counter = 0;
      this.state.compareMatchFlag = true;
      this.triggerCompareInterrupt(ic, clock);
      this.recordEvent('compare_match', this.config.compareValue, clock);
      event = true;
    }

    // CTC 模式下也可能溢出（如果 compare < maxCount）
    if (this.state.counter > this.overflowAt) {
      this.state.counter = 0;
      this.state.overflowFlag = true;
      this.state.overflowCount++;
      this.triggerOverflowInterrupt(ic, clock);
      event = true;
    }

    return event;
  }

  // ==================== 快速 PWM 模式 ====================

  private stepFastPWM(ic: InterruptController, clock: ClockSystem): boolean {
    this.state.counter++;
    let event = false;

    // 比较匹配
    if (this.state.counter === this.config.compareValue) {
      this.state.compareMatchFlag = true;
      this.triggerCompareInterrupt(ic, clock);

      // PWM 输出切换
      const newOutput = !this.state.pwmOutput;
      this.state.pwmOutput = newOutput;
      this.recordPWMWaveform(clock.simTime, newOutput);
      this.events.onPWMOutput?.(this.config.id, this.config.pwmConfig?.outputPin ?? '', newOutput);
      event = true;
    }

    // 溢出
    if (this.state.counter > this.overflowAt) {
      this.state.counter = 0;
      this.state.overflowFlag = true;
      this.state.overflowCount++;
      this.triggerOverflowInterrupt(ic, clock);

      // PWM 周期结束，重新输出高电平
      this.state.pwmOutput = true;
      this.recordPWMWaveform(clock.simTime, true);
      this.events.onPWMOutput?.(this.config.id, this.config.pwmConfig?.outputPin ?? '', true);
      event = true;
    }

    // 计算占空比
    const duty = this.config.pwmConfig?.dutyCycle ?? 0.5;
    this.state.pwmDutyValue = Math.round(duty * this.maxCount);

    return event;
  }

  // ==================== 相位校正 PWM 模式 ====================

  private stepPhaseCorrectPWM(ic: InterruptController, clock: ClockSystem): boolean {
    let event = false;

    if (this.config.direction === TimerDirection.UpDown) {
      // 上下计数
      if ((this.state as any)._phaseUp === undefined) (this.state as any)._phaseUp = true;

      if ((this.state as any)._phaseUp) {
        this.state.counter++;
        if (this.state.counter >= this.maxCount) {
          (this.state as any)._phaseUp = false;
        }
      } else {
        this.state.counter--;
        if (this.state.counter === 0) {
          (this.state as any)._phaseUp = true;
        }
      }

      // 比较匹配
      if (this.state.counter === this.config.compareValue) {
        this.state.compareMatchFlag = true;
        this.state.pwmOutput = !this.state.pwmOutput;
        this.triggerCompareInterrupt(ic, clock);
        this.events.onPWMOutput?.(this.config.id, this.config.pwmConfig?.outputPin ?? '', this.state.pwmOutput);
        this.recordPWMWaveform(clock.simTime, this.state.pwmOutput);
        event = true;
      }

      // TOP 值到达（用作溢出）
      if (this.state.counter === 0 || this.state.counter === this.maxCount) {
        this.state.overflowFlag = true;
        this.state.overflowCount++;
        this.triggerOverflowInterrupt(ic, clock);
        event = true;
      }
    } else {
      // 兼容普通 PWM 如果方向不是上下
      return this.stepFastPWM(ic, clock);
    }

    return event;
  }

  // ==================== 输入捕获模式 ====================

  private stepInputCapture(ic: InterruptController, clock: ClockSystem): boolean {
    // 先正常计数
    this.stepNormal(ic, clock);

    // 检测捕获边沿
    const config = this.config.captureConfig;
    if (!config) return false;

    let captureTriggered = false;
    switch (config.captureEdge) {
      case 'rising':
        captureTriggered = !this.prevExternalPinLevel && this.externalPinLevel;
        break;
      case 'falling':
        captureTriggered = this.prevExternalPinLevel && !this.externalPinLevel;
        break;
      case 'both':
        captureTriggered = this.prevExternalPinLevel !== this.externalPinLevel;
        break;
    }

    if (captureTriggered) {
      this.state.captureValue = this.state.counter;
      this.state.captureFlag = true;

      if (this.externalPinLevel) {
        this.state.captureRiseCount++;
      } else {
        this.state.captureFallCount++;
      }

      this.triggerCaptureInterrupt(ic, clock);
      this.recordEvent('capture', this.state.captureValue, clock);
      return true;
    }

    return false;
  }

  // ==================== 单次触发模式 ====================

  private stepOneShot(ic: InterruptController, clock: ClockSystem): boolean {
    if (!this.state.running) return false;

    if (this.config.direction === TimerDirection.Up) {
      this.state.counter++;
      if (this.state.counter >= this.config.compareValue) {
        this.state.counter = this.config.compareValue;
        this.state.running = false; // 停止
        this.state.compareMatchFlag = true;
        this.triggerCompareInterrupt(ic, clock);
        this.recordEvent('compare_match', this.config.compareValue, clock);
        return true;
      }
    } else {
      if (this.state.counter === 0) {
        this.state.running = false;
        this.state.overflowFlag = true;
        this.triggerOverflowInterrupt(ic, clock);
        this.recordEvent('overflow', 0, clock);
        return true;
      }
      this.state.counter--;
    }

    return false;
  }

  // ==================== 中断触发 ====================

  private triggerOverflowInterrupt(ic: InterruptController, clock: ClockSystem): void {
    if (this.config.overflowInterruptSource) {
      ic.requestInterrupt(this.config.overflowInterruptSource, clock);
    }
    this.events.onOverflow?.(this.config.id);
  }

  private triggerCompareInterrupt(ic: InterruptController, clock: ClockSystem): void {
    if (this.config.compareInterruptSource) {
      ic.requestInterrupt(this.config.compareInterruptSource, clock);
    }
    this.events.onCompareMatch?.(this.config.id, this.config.compareValue);
  }

  private triggerCaptureInterrupt(ic: InterruptController, clock: ClockSystem): void {
    if (this.config.captureInterruptSource) {
      ic.requestInterrupt(this.config.captureInterruptSource, clock);
    }
    this.events.onCapture?.(this.config.id, this.state.captureValue);
  }

  // ==================== PWM 波形记录 ====================

  private recordPWMWaveform(time: number, value: boolean): void {
    this.pwmWaveform.push({
      time,
      value: value ? 1 : 0,
      duration: 0, // 将在下一个点到达时更新
    });

    // 更新上一个点的持续时间
    if (this.pwmWaveform.length >= 2) {
      const prev = this.pwmWaveform[this.pwmWaveform.length - 2];
      const curr = this.pwmWaveform[this.pwmWaveform.length - 1];
      prev.duration = curr.time - prev.time;
    }

    // 限制波形记录长度
    if (this.pwmWaveform.length > this.maxWaveformPoints) {
      this.pwmWaveform = this.pwmWaveform.slice(-this.maxWaveformPoints);
    }
  }

  private recordEvent(type: TimerEvent['type'], value: number, clock?: ClockSystem): void {
    this.events.onTimerEvent?.({
      type,
      timerId: this.config.id,
      timestamp: clock?.simTime ?? 0,
      tickNumber: clock?.tickCount ?? 0,
      value,
    });
  }

  // ==================== 快照 ====================

  getSnapshot(): TimerSnapshot {
    return {
      state: { ...this.state },
      pwmWaveform: [...this.pwmWaveform],
    };
  }

  restoreSnapshot(snapshot: TimerSnapshot): void {
    this.state = { ...snapshot.state };
    this.pwmWaveform = [...snapshot.pwmWaveform];
  }
}

/** 定时器快照 */
export interface TimerSnapshot {
  state: TimerState;
  pwmWaveform: PWMWaveformPoint[];
}

// ==================== 定时器模块 ====================

/**
 * TimerModule — 定时器/计数器模块管理器
 *
 * 管理多个定时器实例，提供统一的配置和控制接口
 */
export class TimerModule {
  private timers: Map<string, Timer> = new Map();
  private events: TimerModuleEvents;

  constructor(events?: TimerModuleEvents) {
    this.events = events ?? {};
  }

  /**
   * 创建并注册定时器
   */
  createTimer(config: TimerConfig): void {
    if (this.timers.has(config.id)) {
      throw new Error(`定时器已存在: ${config.id}`);
    }
    this.timers.set(config.id, new Timer(config, this.events));
  }

  /** 获取定时器 */
  getTimer(id: string): Timer | undefined {
    return this.timers.get(id);
  }

  /** 获取所有定时器 ID */
  getTimerIds(): string[] {
    return Array.from(this.timers.keys());
  }

  /** 获取所有定时器状态 */
  getAllStates(): TimerState[] {
    return Array.from(this.timers.values()).map(t => t.getState());
  }

  /** 启动指定定时器 */
  startTimer(id: string): void {
    this.timers.get(id)?.start();
  }

  /** 停止指定定时器 */
  stopTimer(id: string): void {
    this.timers.get(id)?.stop();
  }

  /** 重置指定定时器 */
  resetTimer(id: string): void {
    this.timers.get(id)?.reset();
  }

  /** 启动所有定时器 */
  startAll(): void {
    for (const timer of this.timers.values()) {
      timer.start();
    }
  }

  /** 停止所有定时器 */
  stopAll(): void {
    for (const timer of this.timers.values()) {
      timer.stop();
    }
  }

  /**
   * 时钟步进 — 每个系统时钟周期调用
   * 返回是否有任何定时器发生事件
   */
  step(systemClock: ClockSystem, intController: InterruptController): boolean {
    let anyEvent = false;
    for (const timer of this.timers.values()) {
      if (timer.step(systemClock, intController)) {
        anyEvent = true;
      }
    }
    return anyEvent;
  }

  /** 设置外部引脚电平（外部计数/输入捕获使用） */
  setExternalPin(timerId: string, level: boolean): void {
    this.timers.get(timerId)?.setExternalPin(level);
  }

  /** 设置 PWM 占空比 */
  setPWMDutyCycle(timerId: string, duty: number): void {
    this.timers.get(timerId)?.setPWMDutyCycle(duty);
  }

  /** 写入定时器计数值 */
  setCounter(id: string, value: number): void {
    this.timers.get(id)?.setCounter(value);
  }

  /** 读取定时器计数值 */
  getCounter(id: string): number | undefined {
    return this.timers.get(id)?.getCounter();
  }

  /** 获取 PWM 波形数据 */
  getPWMWaveform(id: string): PWMWaveformPoint[] {
    return this.timers.get(id)?.getPWMWaveform() ?? [];
  }

  /** 重置所有定时器 */
  reset(): void {
    for (const timer of this.timers.values()) {
      timer.reset();
    }
  }

  /** 获取快照 */
  getSnapshot(): Map<string, TimerSnapshot> {
    const snapshots = new Map<string, TimerSnapshot>();
    for (const [id, timer] of this.timers) {
      snapshots.set(id, timer.getSnapshot());
    }
    return snapshots;
  }

  /** 从快照恢复 */
  restoreSnapshot(snapshots: Map<string, TimerSnapshot>): void {
    for (const [id, snapshot] of snapshots) {
      this.timers.get(id)?.restoreSnapshot(snapshot);
    }
  }
}

// ==================== 预设定时器配置 ====================

/** 8051 定时器 0 配置 */
export function createTimer0_8051(): TimerConfig {
  return {
    id: 'timer0',
    name: '定时器 0 (T0)',
    bitWidth: 8,
    mode: TimerMode.Normal,
    clockSource: TimerClockSource.SystemClock,
    prescaler: 12, // 8051: 每 12 个时钟周期计一次
    direction: TimerDirection.Up,
    initialValue: 0,
    compareValue: 255,
    overflowInterruptSource: 'tmr0_ovf' as InterruptSourceType,
    compareInterruptSource: 'tmr0_cmp' as InterruptSourceType,
  };
}

/** 8051 定时器 1 配置 */
export function createTimer1_8051(): TimerConfig {
  return {
    id: 'timer1',
    name: '定时器 1 (T1)',
    bitWidth: 8,
    mode: TimerMode.Normal,
    clockSource: TimerClockSource.SystemClock,
    prescaler: 12,
    direction: TimerDirection.Up,
    initialValue: 0,
    compareValue: 255,
    overflowInterruptSource: 'tmr1_ovf' as InterruptSourceType,
  };
}

/** ATmega 定时器 0 配置 */
export function createTimer0_ATmega(): TimerConfig {
  return {
    id: 'timer0',
    name: 'Timer/Counter 0',
    bitWidth: 8,
    mode: TimerMode.Normal,
    clockSource: TimerClockSource.SystemClock,
    prescaler: 1,
    direction: TimerDirection.Up,
    initialValue: 0,
    compareValue: 255,
    overflowInterruptSource: 'tmr0_ovf' as InterruptSourceType,
    compareInterruptSource: 'tmr0_cmp' as InterruptSourceType,
    pwmConfig: {
      frequency: 1000,
      dutyCycle: 0.5,
      outputPin: 'OC0A',
      outputMode: 'non_inverting',
      deadTimeEnabled: false,
      deadTimeCycles: 0,
    },
  };
}

/** ATmega 16 位定时器 1 配置 */
export function createTimer1_ATmega(): TimerConfig {
  return {
    id: 'timer1',
    name: 'Timer/Counter 1',
    bitWidth: 16,
    mode: TimerMode.Normal,
    clockSource: TimerClockSource.SystemClock,
    prescaler: 1,
    direction: TimerDirection.Up,
    initialValue: 0,
    compareValue: 0xFFFF,
    overflowInterruptSource: 'tmr1_ovf' as InterruptSourceType,
    compareInterruptSource: 'tmr1_cmp' as InterruptSourceType,
    captureInterruptSource: 'tmr1_cmp' as InterruptSourceType,
    captureConfig: {
      capturePin: 'ICP1',
      captureEdge: 'rising',
      noiseCanceler: false,
      useInterrupt: true,
    },
    pwmConfig: {
      frequency: 1000,
      dutyCycle: 0.5,
      outputPin: 'OC1A',
      outputMode: 'non_inverting',
      deadTimeEnabled: false,
      deadTimeCycles: 0,
    },
  };
}
