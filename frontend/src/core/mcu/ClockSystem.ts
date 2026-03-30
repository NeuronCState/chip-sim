/**
 * 仿真时钟系统
 * 管理系统时钟频率、机器周期、指令周期
 * 支持时钟分频/倍频，仿真时间步进与实际时间映射
 */

// ==================== 时钟配置 ====================

/** 时钟源类型 */
export const ClockSource = {
  Internal: 'internal',   // 内部 RC 振荡器
  External: 'external',   // 外部晶体/陶瓷谐振器
  PLL: 'pll',            // PLL 倍频输出
} as const;
export type ClockSource = (typeof ClockSource)[keyof typeof ClockSource];

/** MCU 时钟架构预设 */
export interface MCUClockPreset {
  name: string;
  description: string;
  /** 内部振荡器频率 (Hz) */
  internalOscFreq: number;
  /** 最大外部时钟频率 (Hz) */
  maxExternalFreq: number;
  /** PLL 倍频范围 */
  pllMultiplierRange: [number, number];
  /** 默认指令周期 = 多少个时钟周期 */
  clocksPerInstruction: number;
  /** 支持的预分频比 */
  supportedPrescalers: number[];
}

/** 经典 8051 时钟预设 */
export const PRESET_8051: MCUClockPreset = {
  name: '8051',
  description: '经典 8051 系列（12 时钟/指令）',
  internalOscFreq: 12_000_000,
  maxExternalFreq: 24_000_000,
  pllMultiplierRange: [1, 1],
  clocksPerInstruction: 12,
  supportedPrescalers: [1],
};

/** AVR (ATmega) 时钟预设 */
export const PRESET_AVR: MCUClockPreset = {
  name: 'ATmega',
  description: 'AVR ATmega 系列（1 时钟/指令）',
  internalOscFreq: 8_000_000,
  maxExternalFreq: 20_000_000,
  pllMultiplierRange: [1, 4],
  clocksPerInstruction: 1,
  supportedPrescalers: [1, 8, 64, 256, 1024],
};

/** STM32 ARM Cortex-M 时钟预设 */
export const PRESET_STM32: MCUClockPreset = {
  name: 'STM32',
  description: 'STM32 ARM Cortex-M 系列（1 时钟/指令）',
  internalOscFreq: 16_000_000,
  maxExternalFreq: 72_000_000,
  pllMultiplierRange: [2, 16],
  clocksPerInstruction: 1,
  supportedPrescalers: [1, 2, 4, 8, 16, 64, 128, 256, 512],
};

/** 所有预设 */
export const MCU_CLOCK_PRESETS: Record<string, MCUClockPreset> = {
  '8051': PRESET_8051,
  'atmega': PRESET_AVR,
  'stm32': PRESET_STM32,
};

// ==================== 时钟系统 ====================

/** 时钟系统事件回调 */
export interface ClockSystemEvents {
  onClockTick?: (tickNumber: number, simTime: number) => void;
  onMachineCycle?: (cycleNumber: number, simTime: number) => void;
  onInstructionCycle?: (instrNumber: number, simTime: number) => void;
  onFrequencyChange?: (oldFreq: number, newFreq: number) => void;
}

/** 时钟系统配置 */
export interface ClockSystemConfig {
  /** 时钟源 */
  source: ClockSource;
  /** 系统时钟频率 (Hz) */
  frequency: number;
  /** PLL 倍频因子 (仅 PLL 模式) */
  pllMultiplier: number;
  /** 外部时钟频率 (Hz) */
  externalFrequency: number;
  /** MCU 预设 */
  preset: MCUClockPreset;
  /** 仿真时间步长 (秒) — 决定精度 */
  simTimeStep: number;
}

/** 默认时钟配置 */
export function defaultClockConfig(preset: MCUClockPreset = PRESET_8051): ClockSystemConfig {
  return {
    source: ClockSource.Internal,
    frequency: preset.internalOscFreq,
    pllMultiplier: 1,
    externalFrequency: 0,
    preset,
    simTimeStep: 1 / preset.internalOscFreq, // 一个时钟周期
  };
}

/**
 * ClockSystem — 仿真时钟核心
 *
 * 职责：
 * - 管理系统时钟频率
 * - 计算机器周期和指令周期
 * - 维护仿真时间
 * - 提供定时器所需的分频时钟
 */
export class ClockSystem {
  private config: ClockSystemConfig;
  private events: ClockSystemEvents;

  // 仿真状态
  private _simTime: number = 0;            // 当前仿真时间 (秒)
  private _tickCount: number = 0;          // 时钟周期计数
  private _machineCycleCount: number = 0;  // 机器周期计数
  private _instructionCount: number = 0;   // 指令计数
  private _running: boolean = false;

  constructor(config?: ClockSystemConfig, events?: ClockSystemEvents) {
    this.config = config ?? defaultClockConfig();
    this.events = events ?? {};
  }

  // ==================== 访问器 ====================

  /** 当前系统时钟频率 (Hz) */
  get frequency(): number {
    switch (this.config.source) {
      case ClockSource.Internal:
        return this.config.frequency;
      case ClockSource.External:
        return this.config.externalFrequency || this.config.frequency;
      case ClockSource.PLL:
        return this.config.frequency * this.config.pllMultiplier;
    }
  }

  /** 时钟周期 (秒) */
  get clockPeriod(): number {
    return 1 / this.frequency;
  }

  /** 机器周期 (秒) = 时钟周期 × 每指令时钟数 */
  get machineCyclePeriod(): number {
    return this.clockPeriod * this.config.preset.clocksPerInstruction;
  }

  /** 每指令的时钟周期数 */
  get clocksPerInstruction(): number {
    return this.config.preset.clocksPerInstruction;
  }

  /** 当前仿真时间 (秒) */
  get simTime(): number {
    return this._simTime;
  }

  /** 时钟周期计数 */
  get tickCount(): number {
    return this._tickCount;
  }

  /** 机器周期计数 */
  get machineCycleCount(): number {
    return this._machineCycleCount;
  }

  /** 指令计数 */
  get instructionCount(): number {
    return this._instructionCount;
  }

  /** 是否正在运行 */
  get running(): boolean {
    return this._running;
  }

  /** 仿真时间步长 */
  get simTimeStep(): number {
    return this.config.simTimeStep;
  }

  /** MCU 预设 */
  get preset(): MCUClockPreset {
    return this.config.preset;
  }

  /** 完整配置（只读副本） */
  get clockConfig(): Readonly<ClockSystemConfig> {
    return { ...this.config };
  }

  // ==================== 配置 ====================

  /** 设置系统时钟频率 */
  setFrequency(freq: number): void {
    const oldFreq = this.frequency;
    if (freq < 1 || freq > 100_000_000) {
      throw new Error(`频率超出范围 1Hz~100MHz: ${freq}`);
    }
    this.config.frequency = freq;
    this.config.simTimeStep = 1 / this.frequency;
    this.events.onFrequencyChange?.(oldFreq, this.frequency);
  }

  /** 设置时钟源 */
  setClockSource(source: ClockSource): void {
    this.config.source = source;
  }

  /** 设置 PLL 倍频因子 */
  setPLLMultiplier(mult: number): void {
    const [min, max] = this.config.preset.pllMultiplierRange;
    if (mult < min || mult > max) {
      throw new Error(`PLL 倍频因子超出范围 [${min}, ${max}]: ${mult}`);
    }
    this.config.pllMultiplier = mult;
    this.config.simTimeStep = 1 / this.frequency;
  }

  /** 加载 MCU 预设 */
  loadPreset(preset: MCUClockPreset): void {
    this.config.preset = preset;
    this.config.frequency = preset.internalOscFreq;
    this.config.simTimeStep = 1 / this.frequency;
    this.events.onFrequencyChange?.(0, this.frequency);
  }

  // ==================== 仿真步进 ====================

  /** 启动时钟 */
  start(): void {
    this._running = true;
  }

  /** 停止时钟 */
  stop(): void {
    this._running = false;
  }

  /** 重置时钟 */
  reset(): void {
    this._simTime = 0;
    this._tickCount = 0;
    this._machineCycleCount = 0;
    this._instructionCount = 0;
  }

  /**
   * 推进指定数量的时钟周期
   * @param ticks 要推进的时钟周期数
   * @returns 实际推进后的仿真时间
   */
  advanceTicks(ticks: number): number {
    for (let i = 0; i < ticks; i++) {
      this._tickCount++;
      this._simTime += this.clockPeriod;
      this.events.onClockTick?.(this._tickCount, this._simTime);

      // 每 clocksPerInstruction 个时钟周期 = 1 个机器/指令周期
      if (this._tickCount % this.config.preset.clocksPerInstruction === 0) {
        this._machineCycleCount++;
        this._instructionCount++;
        this.events.onMachineCycle?.(this._machineCycleCount, this._simTime);
        this.events.onInstructionCycle?.(this._instructionCount, this._simTime);
      }
    }
    return this._simTime;
  }

  /**
   * 推进指定仿真时间
   * @param seconds 推进的时间 (秒)
   * @returns 推进的时钟周期数
   */
  advanceTime(seconds: number): number {
    const ticks = Math.floor(seconds / this.clockPeriod);
    return this.advanceTicks(ticks);
  }

  /**
   * 推进到指定仿真时间
   * @param targetTime 目标仿真时间 (秒)
   * @returns 实际推进的时钟周期数
   */
  advanceToTime(targetTime: number): number {
    if (targetTime <= this._simTime) return 0;
    return this.advanceTime(targetTime - this._simTime);
  }

  // ==================== 分频时钟 ====================

  /**
   * 获取分频后的频率
   * 用于定时器预分频器
   */
  getDividedFrequency(prescaler: number): number {
    return this.frequency / prescaler;
  }

  /**
   * 计算指定分频下达到目标时间需要的计数值
   * @param targetSeconds 目标时间 (秒)
   * @param prescaler 预分频比
   * @param bitWidth 定时器位宽 (8 或 16)
   * @returns 定时器初值 (装载值)
   */
  calculateTimerReload(targetSeconds: number, prescaler: number, bitWidth: 8 | 16): number {
    const dividedFreq = this.getDividedFrequency(prescaler);
    const ticksNeeded = Math.round(targetSeconds * dividedFreq);
    const maxCount = (1 << bitWidth) - 1;
    const reload = maxCount - (ticksNeeded % (maxCount + 1));
    return reload;
  }

  /**
   * 从定时器初值计算实际定时时间
   * @param reloadValue 装载值
   * @param prescaler 预分频比
   * @param bitWidth 定时器位宽
   * @returns 实际定时时间 (秒)
   */
  calculateTimerDuration(reloadValue: number, prescaler: number, bitWidth: 8 | 16): number {
    const dividedFreq = this.getDividedFrequency(prescaler);
    const maxCount = (1 << bitWidth) - 1;
    const tickCount = maxCount - reloadValue;
    return tickCount / dividedFreq;
  }

  // ==================== 导出/快照 ====================

  /** 获取当前时钟状态快照 */
  getSnapshot(): ClockSnapshot {
    return {
      simTime: this._simTime,
      tickCount: this._tickCount,
      machineCycleCount: this._machineCycleCount,
      instructionCount: this._instructionCount,
      frequency: this.frequency,
      clockPeriod: this.clockPeriod,
      machineCyclePeriod: this.machineCyclePeriod,
      running: this._running,
    };
  }

  /** 从快照恢复 */
  restoreSnapshot(snapshot: ClockSnapshot): void {
    this._simTime = snapshot.simTime;
    this._tickCount = snapshot.tickCount;
    this._machineCycleCount = snapshot.machineCycleCount;
    this._instructionCount = snapshot.instructionCount;
  }
}

/** 时钟状态快照 */
export interface ClockSnapshot {
  simTime: number;
  tickCount: number;
  machineCycleCount: number;
  instructionCount: number;
  frequency: number;
  clockPeriod: number;
  machineCyclePeriod: number;
  running: boolean;
}
