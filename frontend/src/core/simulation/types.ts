/**
 * 仿真引擎核心类型定义
 */

// ==================== 引脚与信号 ====================

/** 引脚工作模式 */
export type PinMode = 'input' | 'output' | 'analog' | 'uart_tx' | 'uart_rx' | 'spi' | 'i2c' | 'pwm';

/** 引脚电平 */
export type PinLevel = 'high' | 'low' | 'floating';

/** MCU 引脚状态 */
export interface MCUPinState {
  mode: PinMode;
  value: number;       // 数字: 0/1, 模拟: 0-4095, PWM: 0-100
  pullUp: boolean;
}

// ==================== 元件仿真状态 ====================

/** 元件仿真可视化状态 */
export interface ComponentSimState {
  /** LED/PWM 占空比 0-1 */
  pwmDuty: number;
  /** 继电器是否通电 */
  relayEnergized: boolean;
  /** 电机转速 0-1 */
  motorSpeed: number;
  /** 蜂鸣器是否发声 */
  buzzerActive: boolean;
  /** 蜂鸣器频率 */
  buzzerFreq: number;
  /** ADC 模拟值 0-4095 (12位) */
  adcValue: number;
  /** 传感器温度值 (°C) */
  temperature: number;
  /** 按钮/开关是否按下 */
  buttonPressed: boolean;
}

/** 默认仿真状态 */
export const DEFAULT_SIM_STATE: ComponentSimState = {
  pwmDuty: 0,
  relayEnergized: false,
  motorSpeed: 0,
  buzzerActive: false,
  buzzerFreq: 2000,
  adcValue: 0,
  temperature: 0,
  buttonPressed: false,
};

// ==================== 元件行为接口 ====================

/** 元件行为函数的输入 */
export interface BehaviorInput {
  /** 引脚ID → 引脚电平 */
  pinLevels: Map<string, PinLevel>;
  /** 引脚ID → 引脚值（数字 0/1 或模拟值） */
  pinValues: Map<string, number>;
  /** 引脚ID → 引脚模式 */
  pinModes: Map<string, PinMode>;
  /** 仿真时间步长 (ms) */
  dt: number;
  /** 总仿真时间 (ms) */
  time: number;
}

/** 元件行为函数的输出 */
export interface BehaviorOutput {
  /** 更新后的仿真状态 */
  simState: Partial<ComponentSimState>;
  /** 元件输出引脚的值 (pinId → value) */
  outputValues?: Map<string, number>;
  /** 元件输出引脚的电平 (pinId → level) */
  outputLevels?: Map<string, PinLevel>;
}

/** 元件行为函数类型 */
export type ComponentBehaviorFn = (input: BehaviorInput) => BehaviorOutput;

// ==================== 仿真引擎配置 ====================

/** 仿真引擎配置 */
export interface SimEngineConfig {
  /** 每秒 tick 数，默认 60 */
  tickRate?: number;
}

// ==================== UART ====================

/** UART 输出数据 */
export interface UARTOutput {
  data: string;
  timestamp: number;
  /** 波特率 */
  baudRate?: number;
}

/** 定时器配置 */
export interface TimerConfig {
  /** 定时器ID */
  id: string;
  /** 周期 (ms) */
  period: number;
  /** 是否单次触发 */
  oneShot: boolean;
  /** 回调函数 */
  callback: () => void;
  /** 是否启用 */
  enabled: boolean;
}

/** UART 配置 */
export interface UARTConfig {
  /** 波特率 */
  baudRate: number;
  /** 发送的数据 */
  txData: string;
  /** 发送间隔 (ms) */
  txInterval: number;
}
