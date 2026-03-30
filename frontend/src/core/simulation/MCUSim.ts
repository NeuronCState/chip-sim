/**
 * MCUSim — 简化MCU模型
 *
 * 管理GPIO引脚状态和用户可配置的行为（代替真实C代码）
 * 支持：PWM输出、UART发送、定时器中断、ADC读取
 * 提供每tick更新逻辑，驱动引脚输出
 */

import type { MCUPinState, PinMode, PinLevel, TimerConfig, UARTConfig } from './types';

// ==================== 预设行为类型 ====================

/** 用户可配置的引脚行为 */
export type PinBehavior =
  | 'blink'          // 输出：LED闪烁（通过定时器实现）
  | 'button_read'    // 输入：读取按钮
  | 'uart_send'      // UART TX：发送数据
  | 'adc_read'       // 模拟：读取ADC值
  | 'pwm_output'     // PWM：输出PWM
  | 'custom'         // 自定义：由外部设置
  | 'none';          // 无行为

/** 引脚行为配置 */
export interface PinBehaviorConfig {
  behavior: PinBehavior;
  /** blink 周期 (ms) */
  blinkPeriod?: number;
  /** blink 占空比 0-1 */
  blinkDuty?: number;
  /** PWM 频率 (Hz)，默认 1000 */
  pwmFreq?: number;
  /** PWM 占空比 0-1，默认 0.5 */
  pwmDuty?: number;
  /** ADC 输入的模拟值 (0-4095) */
  adcValue?: number;
  /** UART 发送的字符串 */
  uartData?: string;
  /** UART 波特率 */
  uartBaudRate?: number;
  /** UART 发送间隔 (ms)，默认 1000 */
  uartTxInterval?: number;
  /** 定时器周期 (ms)，用于 blink 等 */
  timerPeriod?: number;
}

// ==================== MCU引脚状态 ====================

/** 创建默认引脚状态 */
export function createDefaultPinState(mode: PinMode = 'input'): MCUPinState {
  return {
    mode,
    value: mode === 'output' || mode === 'pwm' ? 0 : 0,
    pullUp: false,
  };
}

// ==================== MCUSim 类 ====================

/**
 * 简化MCU仿真模型
 *
 * 每个 tick 更新引脚状态，支持用户预配置的行为模式。
 * 支持：PWM周期性占空比输出、UART定时发送、定时器中断、ADC模拟读取
 */
export class MCUSim {
  /** pinId → 引脚状态 */
  pins: Map<string, MCUPinState> = new Map();
  /** pinId → 行为配置 */
  private behaviors: Map<string, PinBehaviorConfig> = new Map();
  /** 仿真时间 (ms) */
  private time: number = 0;
  /** UART 输出缓冲 */
  private uartBuffer: Array<{ data: string; baudRate: number }> = [];

  // === 定时器系统 ===
  /** 活跃定时器列表 */
  private timers: Map<string, TimerConfig> = new Map();
  /** pinId → blink 定时器计数追踪 */
  private blinkTimers: Map<string, { elapsed: number; isHigh: boolean }> = new Map();

  // === UART 发送追踪 ===
  /** pinId → UART 发送状态 */
  private uartState: Map<string, { elapsed: number; charIndex: number; bitTimer: number }> = new Map();

  constructor(pinIds?: string[]) {
    if (pinIds) {
      for (const id of pinIds) {
        this.pins.set(id, createDefaultPinState('input'));
      }
    }
  }

  // ==================== 引脚管理 ====================

  /**
   * 设置引脚模式
   */
  setPinMode(pinId: string, mode: PinMode): void {
    const pin = this.pins.get(pinId);
    if (pin) {
      pin.mode = mode;
      if (mode === 'output' || mode === 'pwm') {
        pin.value = 0;
      }
    } else {
      this.pins.set(pinId, createDefaultPinState(mode));
    }
  }

  /**
   * 设置引脚行为
   */
  setBehavior(pinId: string, config: PinBehaviorConfig): void {
    this.behaviors.set(pinId, config);
    const modeMap: Record<PinBehavior, PinMode> = {
      blink: 'output',
      button_read: 'input',
      uart_send: 'uart_tx',
      adc_read: 'analog',
      pwm_output: 'pwm',
      custom: 'output',
      none: 'input',
    };
    this.setPinMode(pinId, modeMap[config.behavior] ?? 'output');

    // 初始化 blink 定时器状态
    if (config.behavior === 'blink') {
      this.blinkTimers.set(pinId, { elapsed: 0, isHigh: false });
    }

    // 初始化 UART 发送状态
    if (config.behavior === 'uart_send') {
      this.uartState.set(pinId, { elapsed: 0, charIndex: 0, bitTimer: 0 });
    }
  }

  /**
   * 直接设置引脚值（custom 模式用）
   */
  setPinValue(pinId: string, value: number): void {
    const pin = this.pins.get(pinId);
    if (pin) {
      pin.value = value;
    }
  }

  /**
   * 获取引脚电平（方便转为 PinLevel）
   */
  getPinLevel(pinId: string): PinLevel {
    const pin = this.pins.get(pinId);
    if (!pin) return 'floating';
    if (pin.mode === 'input' || pin.mode === 'output') {
      return pin.value > 0 ? 'high' : 'low';
    }
    if (pin.mode === 'pwm') {
      return pin.value > 0 ? 'high' : 'low';
    }
    if (pin.mode === 'analog') {
      return pin.value > 2048 ? 'high' : pin.value > 0 ? 'floating' : 'low';
    }
    return 'floating';
  }

  // ==================== UART ====================

  /**
   * 获取 UART 输出缓冲
   */
  getUARTOutput(): Array<{ data: string; baudRate: number }> {
    return [...this.uartBuffer];
  }

  /**
   * 清除 UART 输出缓冲
   */
  clearUARTBuffer(): void {
    this.uartBuffer = [];
  }

  // ==================== 定时器系统 ====================

  /**
   * 创建定时器
   */
  createTimer(id: string, period: number, callback: () => void, oneShot: boolean = false): void {
    this.timers.set(id, {
      id,
      period,
      oneShot,
      callback,
      enabled: true,
    });
  }

  /**
   * 启动定时器
   */
  startTimer(id: string): void {
    const timer = this.timers.get(id);
    if (timer) timer.enabled = true;
  }

  /**
   * 停止定时器
   */
  stopTimer(id: string): void {
    const timer = this.timers.get(id);
    if (timer) timer.enabled = false;
  }

  /**
   * 删除定时器
   */
  removeTimer(id: string): void {
    this.timers.delete(id);
  }

  /**
   * 设置定时器周期
   */
  setTimerPeriod(id: string, period: number): void {
    const timer = this.timers.get(id);
    if (timer) timer.period = period;
  }

  /**
   * 获取所有定时器（只读）
   */
  getTimers(): TimerConfig[] {
    return Array.from(this.timers.values());
  }

  // ==================== Tick 更新 ====================

  /**
   * 每 tick 更新引脚状态
   * @param dt 时间步长 (ms)
   */
  tick(dt: number): void {
    this.time += dt;

    // Step 1: 更新定时器
    this.updateTimers(dt);

    // Step 2: 更新引脚行为
    for (const [pinId, config] of this.behaviors.entries()) {
      const pin = this.pins.get(pinId);
      if (!pin) continue;

      switch (config.behavior) {
        case 'blink': {
          // LED 闪烁：通过定时器逻辑实现周期性翻转 GPIO
          this.updateBlink(pinId, pin, config, dt);
          break;
        }

        case 'pwm_output': {
          // PWM 输出：周期性脉冲，支持频率和占空比配置
          this.updatePWM(pin, config);
          break;
        }

        case 'adc_read': {
          // ADC 模拟：返回设定的模拟值（12位 0-4095）
          const adcVal = config.adcValue ?? 2048;
          pin.value = Math.max(0, Math.min(4095, adcVal));
          break;
        }

        case 'uart_send': {
          // UART 发送：按比特率定时发送字符
          this.updateUART(pinId, pin, config, dt);
          break;
        }

        case 'button_read':
        case 'custom':
        case 'none':
        default:
          break;
      }
    }
  }

  // ==================== 内部：定时器更新 ====================

  private updateTimers(dt: number): void {
    const toRemove: string[] = [];

    for (const [id, timer] of this.timers.entries()) {
      if (!timer.enabled) continue;

      // 正确的定时器周期计算：使用 tick 计数检测周期跨越
      const ticks = Math.floor(this.time / timer.period);
      const prevTicks = Math.floor((this.time - dt) / timer.period);

      if (ticks !== prevTicks) {
        try {
          timer.callback();
        } catch {
          // 静默处理回调错误
        }
        if (timer.oneShot) {
          toRemove.push(id);
        }
      }
    }

    for (const id of toRemove) {
      this.timers.delete(id);
    }
  }

  // ==================== 内部：Blink 行为（定时器驱动） ====================

  private updateBlink(pinId: string, pin: MCUPinState, config: PinBehaviorConfig, dt: number): void {
    const period = config.blinkPeriod ?? 1000;
    const duty = config.blinkDuty ?? 0.5;
    const blinkState = this.blinkTimers.get(pinId);

    if (!blinkState) {
      this.blinkTimers.set(pinId, { elapsed: 0, isHigh: false });
      pin.value = 0;
      return;
    }

    blinkState.elapsed += dt;

    // 周期性翻转
    const cyclePos = blinkState.elapsed % period;
    if (cyclePos < period * duty) {
      pin.value = 1;
      blinkState.isHigh = true;
    } else {
      pin.value = 0;
      blinkState.isHigh = false;
    }
  }

  // ==================== 内部：PWM 行为 ====================

  private updatePWM(pin: MCUPinState, config: PinBehaviorConfig): void {
    const freq = config.pwmFreq ?? 1000;       // 默认 1kHz
    const duty = config.pwmDuty ?? 0.5;         // 默认 50%
    const period = 1000 / freq;                  // ms
    const phase = (this.time % period) / period; // 0-1 归一化相位

    // 输出周期性占空比信号
    pin.value = phase < duty ? 1 : 0;
  }

  // ==================== 内部：UART 发送行为 ====================

  private updateUART(pinId: string, pin: MCUPinState, config: PinBehaviorConfig, dt: number): void {
    const data = config.uartData ?? 'Hello\n';
    const baudRate = config.uartBaudRate ?? 115200;
    const txInterval = config.uartTxInterval ?? 1000; // 默认每秒发送一次

    const uartSt = this.uartState.get(pinId);
    if (!uartSt) return;

    uartSt.elapsed += dt;

    // 按 txInterval 周期发送完整字符串
    if (uartSt.elapsed >= txInterval) {
      uartSt.elapsed -= txInterval;
      this.uartBuffer.push({ data, baudRate });

      // UART TX 引脚脉冲模拟（一个字符宽度的高电平）
      pin.value = 1;
      // bitTimer 用于在后续 tick 中拉低
      uartSt.bitTimer = (1000 / baudRate) * 10; // 约 10 bit 的时间
    }

    // UART TX 引脚脉冲衰减
    if (uartSt.bitTimer > 0) {
      uartSt.bitTimer -= dt;
      if (uartSt.bitTimer <= 0) {
        pin.value = 0; // 空闲时拉低（简化模型）
      }
    }
  }

  // ==================== 重置 ====================

  /**
   * 重置仿真状态
   */
  reset(): void {
    this.time = 0;
    this.uartBuffer = [];
    this.blinkTimers.clear();
    this.uartState.clear();

    // 重置定时器
    for (const timer of this.timers.values()) {
      timer.enabled = false;
    }

    for (const pin of this.pins.values()) {
      if (pin.mode === 'output' || pin.mode === 'pwm') {
        pin.value = 0;
      }
    }

    // 重新初始化 blink/uart 状态
    for (const [pinId, config] of this.behaviors.entries()) {
      if (config.behavior === 'blink') {
        this.blinkTimers.set(pinId, { elapsed: 0, isHigh: false });
      }
      if (config.behavior === 'uart_send') {
        this.uartState.set(pinId, { elapsed: 0, charIndex: 0, bitTimer: 0 });
      }
    }
  }

  /**
   * 获取所有引脚状态（只读快照）
   */
  getSnapshot(): Map<string, MCUPinState> {
    const snap = new Map<string, MCUPinState>();
    for (const [id, state] of this.pins) {
      snap.set(id, { ...state });
    }
    return snap;
  }
}
