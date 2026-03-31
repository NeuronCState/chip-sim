/**
 * SimulationEngine — 仿真引擎主循环
 *
 * 整合 MCUSim、ComponentBehaviors、SignalBus
 * 提供 start/stop/pause/step 控制接口
 *
 * 每个 tick：
 * 1. 更新MCU内部状态（GPIO输出、定时器等）
 * 2. 通过连线传播信号
 * 3. 更新每个元件的行为
 * 4. 更新可视化状态（simState）
 */

import { MCUSim, type PinBehaviorConfig } from './MCUSim';
import { SignalBus, type SimWire, type SignalSource, type PinSignal } from './SignalBus';
import {
  create8051Simulator,
  createATmegaSimulator,
  createSTM32Simulator,
} from '../mcu/MCUSimulator';
import type { MCUSimulator as MCUSimulatorType } from '../mcu/MCUSimulator';
import {
  getComponentBehavior,
  toggleButton,
  setButtonState,
  getButtonStates,
} from './ComponentBehaviors';
import type {
  MCUPinState,
  ComponentSimState,
  PinLevel,
  PinMode,
  SimEngineConfig,
  UARTOutput,
  TimerConfig,
} from './types';
import { DEFAULT_SIM_STATE } from './types';

// ==================== 画布接口 ====================

/** 画布元件（与 WebGLCanvas 的 CanvasComponent 对应） */
export interface SimComponent {
  id: string;
  type: string;
  name: string;
  pins: { id: string; name: string; offsetX: number; offsetY: number; connected: boolean; level: 'high' | 'low' | 'floating' }[];
  simState: ComponentSimState;
}

/** 画布连线（与 WebGLCanvas 的 Wire 对应） */
export interface SimCanvasWire {
  id: string;
  from: { componentId: string; pinId: string };
  to: { componentId: string; pinId: string };
  current: number;
}

/** 芯片引脚 */
export interface SimChipPin {
  id: string;
  name: string;
  connected: boolean;
  level: 'high' | 'low' | 'floating';
}

// ==================== 引脚信号适配器 ====================

/**
 * 实现 SignalSource 接口，桥接 MCUSim 和元件引脚
 */
class PinSignalAdapter implements SignalSource {
  private mcu: MCUSim;
  private components: Map<string, SimComponent> = new Map();
  private chipPins: Map<string, SimChipPin> = new Map();

  constructor(mcu: MCUSim) {
    this.mcu = mcu;
  }

  setComponents(components: SimComponent[]): void {
    this.components.clear();
    for (const c of components) {
      this.components.set(c.id, c);
    }
  }

  setChipPins(pins: SimChipPin[]): void {
    this.chipPins.clear();
    for (const p of pins) {
      this.chipPins.set(p.id, p);
    }
  }

  getPinSignal(componentId: string, pinId: string): PinSignal | null {
    if (componentId === '__chip__') {
      // MCU 引脚
      const mcuPin = this.mcu.pins.get(pinId);
      if (!mcuPin) return null;
      return {
        level: this.mcu.getPinLevel(pinId),
        value: mcuPin.value,
        mode: mcuPin.mode,
      };
    } else {
      // 元件引脚
      const comp = this.components.get(componentId);
      if (!comp) return null;
      const pin = comp.pins.find(p => p.id === pinId);
      if (!pin) return null;
      return {
        level: pin.level,
        value: pin.level === 'high' ? 1 : pin.level === 'low' ? 0 : 0,
        mode: 'input' as PinMode, // 元件引脚默认输入
      };
    }
  }

  setPinSignal(componentId: string, pinId: string, signal: PinSignal): void {
    if (componentId === '__chip__') {
      // 更新 MCU 引脚（输入引脚接收外部信号）
      const mcuPin = this.mcu.pins.get(pinId);
      if (mcuPin && (mcuPin.mode === 'input' || mcuPin.mode === 'analog' || mcuPin.mode === 'uart_rx')) {
        mcuPin.value = signal.value;
      }
    } else {
      // 更新元件引脚电平
      const comp = this.components.get(componentId);
      if (!comp) return;
      comp.pins = comp.pins.map(p =>
        p.id === pinId ? { ...p, level: signal.level } : p
      );
    }
  }
}

// ==================== 仿真引擎 ====================

/**
 * SimulationEngine — 仿真引擎主类
 *
 * 管理仿真生命周期和每帧更新
 */
export class SimulationEngine {
  private running: boolean = false;
  private paused: boolean = false;
  private tickRate: number;
  private time: number = 0;
  private tickCount: number = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  /** MCU 仿真模型 */
  readonly mcu: MCUSim;
  /** MCU 高级仿真器（时钟/中断/定时器模块） */
  private mcuSimulator: MCUSimulatorType | null = null;
  /** MCU 仿真器芯片族 */
  private mcuSimFamily: string = '';
  /** 信号总线 */
  private signalBus: SignalBus;
  /** 引脚信号适配器 */
  private adapter: PinSignalAdapter;

  /** UART 输出监听器 */
  private uartListeners: ((output: UARTOutput) => void)[] = [];
  /** 状态变更监听器 */
  private stateListeners: (() => void)[] = [];

  /** 当前元件列表（引用，直接修改 simState） */
  private componentsRef: SimComponent[] = [];
  /** 当前连线列表 */
  private wiresRef: SimCanvasWire[] = [];
  /** 当前芯片引脚列表 */
  private chipPinsRef: SimChipPin[] = [];

  constructor(config?: SimEngineConfig) {
    this.tickRate = config?.tickRate ?? 60;
    this.mcu = new MCUSim();
    this.signalBus = new SignalBus();
    this.adapter = new PinSignalAdapter(this.mcu);
  }

  // ==================== 数据绑定 ====================

  /**
   * 绑定画布数据（引用方式，引擎直接修改 simState）
   */
  bindData(
    components: SimComponent[],
    wires: SimCanvasWire[],
    chipPins: SimChipPin[],
  ): void {
    this.componentsRef = components;
    this.wiresRef = wires;
    this.chipPinsRef = chipPins;
  }

  /**
   * 设置芯片族，创建对应的 MCU 高级仿真器
   */
  setChipFamily(family: string, model?: string): void {
    if (family === this.mcuSimFamily && this.mcuSimulator) return;
    this.mcuSimFamily = family;
    const f = family.toLowerCase();
    if (f === 'c51' || f === '8051') {
      this.mcuSimulator = create8051Simulator();
    } else if (f === 'stm32' || f === 'arm') {
      this.mcuSimulator = createSTM32Simulator();
    } else if (f === 'esp32') {
      // ESP32 仿真未实现，使用 STM32 仿真器作为更准确的占位（ARM 架构，GPIO 行为更接近 STM32）
      console.warn('ESP32 simulation using STM32 fallback model');
      this.mcuSimulator = createSTM32Simulator();
    } else {
      // 默认 8051
      this.mcuSimulator = create8051Simulator();
    }
    if (this.running) {
      this.mcuSimulator.start();
    }
  }

  // ==================== 控制接口 ====================

  /** 开始仿真 */
  start(): void {
    if (this.running && !this.paused) return;

    if (this.paused) {
      this.paused = false;
      this.scheduleNextTick();
      return;
    }

    this.running = true;
    this.paused = false;
    if (this.mcuSimulator) {
      this.mcuSimulator.start();
    }
    this.scheduleNextTick();
  }

  /** 停止仿真 */
  stop(): void {
    this.running = false;
    this.paused = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.mcuSimulator) {
      this.mcuSimulator.stop();
    }
  }

  /** 暂停仿真 */
  pause(): void {
    if (!this.running) return;
    this.paused = true;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /** 单步执行一个 tick */
  step(): void {
    this.tick();
  }

  /** 重置仿真 */
  reset(): void {
    this.stop();
    this.time = 0;
    this.tickCount = 0;
    this.mcu.reset();
    if (this.mcuSimulator) {
      this.mcuSimulator.reset();
    }
    this.signalBus.reset();

    // 重置所有元件的 simState
    for (const comp of this.componentsRef) {
      comp.simState = { ...DEFAULT_SIM_STATE };
      comp.pins = comp.pins.map(p => ({ ...p, level: 'floating' as const }));
    }
    // 重置芯片引脚
    for (const pin of this.chipPinsRef) {
      pin.level = 'floating';
    }
    // 重置连线电流
    for (const w of this.wiresRef) {
      w.current = 0;
    }

    this.notifyStateChanged();
  }

  // ==================== MCU 操作 ====================

  /**
   * 配置 MCU 引脚行为
   */
  setPinBehavior(pinId: string, config: PinBehaviorConfig): void {
    this.mcu.setBehavior(pinId, config);
  }

  /**
   * 设置 MCU 引脚模式
   */
  setMCUPinMode(pinId: string, mode: PinMode): void {
    this.mcu.setPinMode(pinId, mode);
  }

  /**
   * 设置 MCU 引脚值（custom 模式）
   */
  setMCUPinValue(pinId: string, value: number): void {
    this.mcu.setPinValue(pinId, value);
  }

  // ==================== 定时器操作 ====================

  /**
   * 创建定时器
   */
  createTimer(id: string, period: number, callback: () => void, oneShot: boolean = false): void {
    this.mcu.createTimer(id, period, callback, oneShot);
  }

  /**
   * 启动定时器
   */
  startTimer(id: string): void {
    this.mcu.startTimer(id);
  }

  /**
   * 停止定时器
   */
  stopTimer(id: string): void {
    this.mcu.stopTimer(id);
  }

  /**
   * 删除定时器
   */
  removeTimer(id: string): void {
    this.mcu.removeTimer(id);
  }

  /**
   * 设置定时器周期
   */
  setTimerPeriod(id: string, period: number): void {
    this.mcu.setTimerPeriod(id, period);
  }

  /**
   * 获取所有定时器
   */
  getTimers(): TimerConfig[] {
    return this.mcu.getTimers();
  }

  // ==================== 元件操作 ====================

  /**
   * 切换按钮状态
   */
  toggleButton(componentId: string): void {
    toggleButton(componentId);
  }

  /**
   * 设置按钮状态
   */
  setButtonState(componentId: string, pressed: boolean): void {
    setButtonState(componentId, pressed);
  }

  // ==================== 事件监听 ====================

  /** 注册 UART 输出监听 */
  onUARTOutput(listener: (output: UARTOutput) => void): () => void {
    this.uartListeners.push(listener);
    return () => {
      this.uartListeners = this.uartListeners.filter(l => l !== listener);
    };
  }

  /** 注册状态变更监听 */
  onStateChanged(listener: () => void): () => void {
    this.stateListeners.push(listener);
    return () => {
      this.stateListeners = this.stateListeners.filter(l => l !== listener);
    };
  }

  // ==================== 状态查询 ====================

  /** 是否正在运行 */
  isRunning(): boolean {
    return this.running && !this.paused;
  }

  /** 是否暂停 */
  isPaused(): boolean {
    return this.paused;
  }

  /** 仿真时间 (ms) */
  getTime(): number {
    return this.time;
  }

  /** tick 计数 */
  getTickCount(): number {
    return this.tickCount;
  }

  // ==================== MCU 引脚查询 ====================

  /**
   * 通过连线查找元件引脚对应的 MCU 引脚值
   * 如果元件引脚连接到 MCU 的 PWM/模拟引脚，返回 MCU 引脚的实际值
   */
  private getMCUPinValueForComponentPin(componentId: string, pinId: string): number | null {
    for (const wire of this.wiresRef) {
      let mcuPinId: string | null = null;

      if (wire.to.componentId === componentId && wire.to.pinId === pinId && wire.from.componentId === '__chip__') {
        mcuPinId = wire.from.pinId;
      } else if (wire.from.componentId === componentId && wire.from.pinId === pinId && wire.to.componentId === '__chip__') {
        mcuPinId = wire.to.pinId;
      }

      if (mcuPinId) {
        const mcuPin = this.mcu.pins.get(mcuPinId);
        if (mcuPin) return mcuPin.value;
      }
    }
    return null;
  }

  /**
   * 通过连线查找元件引脚对应的 MCU 引脚模式
   */
  private getMCUPinModeForComponentPin(componentId: string, pinId: string): PinMode | null {
    for (const wire of this.wiresRef) {
      let mcuPinId: string | null = null;

      if (wire.to.componentId === componentId && wire.to.pinId === pinId && wire.from.componentId === '__chip__') {
        mcuPinId = wire.from.pinId;
      } else if (wire.from.componentId === componentId && wire.from.pinId === pinId && wire.to.componentId === '__chip__') {
        mcuPinId = wire.to.pinId;
      }

      if (mcuPinId) {
        const mcuPin = this.mcu.pins.get(mcuPinId);
        if (mcuPin) return mcuPin.mode;
      }
    }
    return null;
  }

  // ==================== 内部方法 ====================

  private scheduleNextTick(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
    }
    const interval = Math.round(1000 / this.tickRate);
    this.intervalId = setInterval(() => {
      if (!this.paused) {
        this.tick();
      }
    }, interval);
  }

  /**
   * 执行一个时间步
   *
   * 每个 tick 的执行流程：
   * 1. 更新 MCU 内部状态
   * 2. 通过连线传播信号
   * 3. 更新每个元件的行为
   * 4. 更新可视化状态
   * 5. 同步芯片引脚电平
   */
  tick(): void {
    const dt = 1000 / this.tickRate; // ms
    this.time += dt;
    this.tickCount++;

    // Step 1: 更新 MCU 内部状态
    this.mcu.tick(dt);

    // Step 1b: MCU 高级仿真器步进（时钟/中断/定时器模块）
    if (this.mcuSimulator && this.mcuSimulator.running) {
      // 将 dt(ms) 转换为仿真步进：每 tick 推进 1 个时钟周期
      this.mcuSimulator.advanceTicks(1);
    }

    // Step 2: 检查 UART 输出
    const uartOutput = this.mcu.getUARTOutput();
    if (uartOutput.length > 0) {
      for (const entry of uartOutput) {
        this.notifyUARTOutput(entry.data, entry.baudRate);
      }
      this.mcu.clearUARTBuffer();
    }

    // Step 3: 准备信号适配器
    this.adapter.setComponents(this.componentsRef);
    this.adapter.setChipPins(this.chipPinsRef);

    // Step 4: 更新连线列表
    this.signalBus.setWires(this.wiresRef as SimWire[]);

    // Step 5: 信号传播
    this.signalBus.propagate(this.adapter);

    // Step 6: 更新元件行为
    for (const comp of this.componentsRef) {
      const behavior = getComponentBehavior(comp.type);
      if (!behavior) continue;

      // 构建行为输入
      const pinLevels = new Map<string, PinLevel>();
      const pinValues = new Map<string, number>();
      const pinModes = new Map<string, PinMode>();

      for (const pin of comp.pins) {
        pinLevels.set(pin.id, pin.level);
        // 从 MCU 引脚获取实际值（如果连线到 MCU）
        const mcuValue = this.getMCUPinValueForComponentPin(comp.id, pin.id);
        pinValues.set(pin.id, mcuValue !== null ? mcuValue : (pin.level === 'high' ? 1 : 0));
        // 获取实际引脚模式
        const mcuMode = this.getMCUPinModeForComponentPin(comp.id, pin.id);
        pinModes.set(pin.id, mcuMode ?? 'input');
      }

      // 对于 button 类型，注入按下状态
      if (comp.type === 'button' || comp.type === 'switch') {
        const pressed = getButtonStates().get(comp.id) ?? false;
        pinValues.set('__pressed', pressed ? 1 : 0);
      }

      const output = behavior({
        pinLevels,
        pinValues,
        pinModes,
        dt,
        time: this.time,
      });

      // 更新 simState
      if (output.simState) {
        comp.simState = { ...comp.simState, ...output.simState };
      }

      // 更新输出引脚
      if (output.outputLevels) {
        comp.pins = comp.pins.map(p => {
          const newLevel = output.outputLevels!.get(p.id);
          return newLevel !== undefined ? { ...p, level: newLevel } : p;
        });
      }
    }

    // Step 7: 同步芯片引脚电平（从 MCU 引脚状态到画布显示）
    for (const chipPin of this.chipPinsRef) {
      const mcuPin = this.mcu.pins.get(chipPin.id);
      if (mcuPin) {
        chipPin.level = this.mcu.getPinLevel(chipPin.id);
      }
    }

    // Step 8: 同步连线电流
    const wireCurrents = this.signalBus.getAllWireCurrents();
    for (const wire of this.wiresRef) {
      wire.current = wireCurrents.get(wire.id) ?? 0;
    }

    // 通知状态变更
    this.notifyStateChanged();
  }

  private notifyUARTOutput(data: string, baudRate?: number): void {
    const output: UARTOutput = { data, timestamp: this.time, baudRate };
    for (const listener of this.uartListeners) {
      listener(output);
    }
  }

  private notifyStateChanged(): void {
    for (const listener of this.stateListeners) {
      listener();
    }
  }
}

// ==================== 重新导出 ====================

// ==================== 全局引擎实例 ====================

/** 全局仿真引擎单例 — WebGLCanvas 和 SerialMonitor 共享 */
let _globalEngine: SimulationEngine | null = null;

/**
 * 获取全局仿真引擎实例
 * 确保 WebGLCanvas 和 SerialMonitor 使用同一个引擎
 */
export function getGlobalEngine(): SimulationEngine {
  if (!_globalEngine) {
    _globalEngine = new SimulationEngine({ tickRate: 60 });
  }
  return _globalEngine;
}

