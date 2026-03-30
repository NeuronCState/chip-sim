/**
 * ComponentBehaviors — 元件行为模型
 *
 * 每种元件类型有一个行为函数，输入是引脚信号，输出是状态变化。
 * 元件类型通过 componentId.type 匹配（与 WebGLCanvas 中的 type 一致）
 */

import type {
  ComponentBehaviorFn,
  BehaviorInput,
  BehaviorOutput,
  ComponentSimState,
  PinLevel,
} from './types';
import { DEFAULT_SIM_STATE } from './types';

// ==================== LED 行为 ====================

/**
 * LED: 接收 PWM 信号 → 亮度随占空比变化
 * 引脚: anode (+), cathode (-)
 * simState.pwmDuty = 亮度值 0-1
 */
export const ledBehavior: ComponentBehaviorFn = (input: BehaviorInput): BehaviorOutput => {
  const anodeLevel = input.pinLevels.get('anode') ?? 'floating';
  const cathodeLevel = input.pinLevels.get('cathode') ?? 'floating';
  const anodeValue = input.pinValues.get('anode') ?? 0;
  const anodeMode = input.pinModes.get('anode') ?? 'input';

  let brightness = 0;

  // PWM 模式：引脚值 0-1 作为占空比，直接映射到亮度
  if (anodeMode === 'pwm') {
    brightness = Math.max(0, Math.min(1, anodeValue));
  } else if (anodeLevel === 'high' && cathodeLevel === 'low') {
    // 数字高电平：完全亮
    brightness = 1.0;
  } else if (anodeLevel === 'high' && cathodeLevel === 'floating') {
    // 高阻态：微亮
    brightness = 0.3;
  } else if (anodeLevel === 'high') {
    brightness = 0.8;
  }

  return {
    simState: { pwmDuty: brightness },
  };
};

// ==================== Button 行为 ====================

/**
 * Button: 点击切换 → 输出 0/1
 * 引脚: a, b
 * 需要外部调用 toggle() 来切换状态
 */
const buttonStates = new Map<string, boolean>(); // componentId → pressed

export function toggleButton(componentId: string): void {
  const current = buttonStates.get(componentId) ?? false;
  buttonStates.set(componentId, !current);
}

export function setButtonState(componentId: string, pressed: boolean): void {
  buttonStates.set(componentId, pressed);
}

export function getButtonStates(): Map<string, boolean> {
  return new Map(buttonStates);
}

export const buttonBehavior: ComponentBehaviorFn = (input: BehaviorInput): BehaviorOutput => {
  // 从 input 的 componentId 获取按钮状态（通过 pinValues 传入）
  const pressed = (input.pinValues.get('__pressed') ?? 0) > 0;

  const outputLevels = new Map<string, PinLevel>();
  const outputValues = new Map<string, number>();

  if (pressed) {
    outputLevels.set('a', 'high');
    outputLevels.set('b', 'low');
    outputValues.set('a', 1);
    outputValues.set('b', 0);
  } else {
    outputLevels.set('a', 'floating');
    outputLevels.set('b', 'floating');
    outputValues.set('a', 0);
    outputValues.set('b', 0);
  }

  return {
    simState: { buttonPressed: pressed },
    outputLevels,
    outputValues,
  };
};

// ==================== Buzzer 行为 ====================

/**
 * Buzzer (有源): 输入HIGH → 震动
 * 引脚: positive (+), negative (-)
 */
export const buzzerBehavior: ComponentBehaviorFn = (input: BehaviorInput): BehaviorOutput => {
  const posLevel = input.pinLevels.get('positive') ?? 'floating';
  const negLevel = input.pinLevels.get('negative') ?? 'floating';

  const active = posLevel === 'high' && negLevel === 'low';

  return {
    simState: {
      buzzerActive: active,
      buzzerFreq: 2000,
    },
  };
};

/**
 * Buzzer (无源): 输入PWM → 频率可调的震动
 */
export const buzzerPassiveBehavior: ComponentBehaviorFn = (input: BehaviorInput): BehaviorOutput => {
  const posValue = input.pinValues.get('positive') ?? 0;
  const active = posValue > 0;

  return {
    simState: {
      buzzerActive: active,
      buzzerFreq: 1000, // 默认频率
    },
  };
};

// ==================== Relay 行为 ====================

/**
 * Relay: 输入HIGH → 吸合
 * 引脚: coil_a (COIL+), coil_b (COIL-), no (常开), com (公共端)
 */
export const relayBehavior: ComponentBehaviorFn = (input: BehaviorInput): BehaviorOutput => {
  const coilA = input.pinLevels.get('coil_a') ?? 'floating';
  const coilB = input.pinLevels.get('coil_b') ?? 'floating';

  const energized = coilA === 'high' && coilB === 'low';

  // 继电器吸合时，NO 和 COM 导通
  const outputLevels = new Map<string, PinLevel>();
  const outputValues = new Map<string, number>();

  if (energized) {
    // NO = COM (导通)
    const comLevel = input.pinLevels.get('com') ?? 'floating';
    outputLevels.set('no', comLevel);
    outputValues.set('no', input.pinValues.get('com') ?? 0);
  } else {
    // NO 断开
    outputLevels.set('no', 'floating');
    outputValues.set('no', 0);
  }

  return {
    simState: { relayEnergized: energized },
    outputLevels,
    outputValues,
  };
};

// ==================== Motor 行为 ====================

/**
 * Motor: 接收 PWM 信号 → 转速随占空比变化
 * 引脚: positive (+), negative (-)
 * simState.motorSpeed = 转速 0-1
 */
export const motorBehavior: ComponentBehaviorFn = (input: BehaviorInput): BehaviorOutput => {
  const posValue = input.pinValues.get('positive') ?? 0;
  const posLevel = input.pinLevels.get('positive') ?? 'floating';
  const posMode = input.pinModes.get('positive') ?? 'input';

  let speed = 0;

  // PWM 模式：占空比直接映射转速
  if (posMode === 'pwm') {
    speed = Math.max(0, Math.min(1, posValue));
  } else if (posLevel === 'high') {
    // 数字信号：全速
    speed = 1.0;
  } else if (posValue > 0 && posValue <= 1) {
    // 值信号：按值映射
    speed = posValue;
  }

  return {
    simState: { motorSpeed: speed },
  };
};

// ==================== Sensor 行为 ====================

/**
 * Sensor: 模拟温度值 → ADC输出（12位 0-4095）
 * 引脚: vcc, gnd, data
 * 当 VCC 高电平时，输出模拟值（如 NTC 温度值）
 * simState.adcValue = 0-4095
 * simState.temperature = 温度值 (°C)
 */
export const sensorBehavior: ComponentBehaviorFn = (input: BehaviorInput): BehaviorOutput => {
  const vccLevel = input.pinLevels.get('vcc') ?? 'floating';

  const outputValues = new Map<string, number>();
  const outputLevels = new Map<string, PinLevel>();

  if (vccLevel === 'high') {
    // 供电时输出模拟值（模拟温度 25°C → ADC ~2048）
    // NTC 热敏电阻模拟：25°C 约 2048，温度越高 ADC 值越低
    const adcValue = 2048;
    outputValues.set('data', adcValue);
    outputLevels.set('data', 'floating'); // 模拟信号

    return {
      simState: { adcValue, temperature: 25.0 },
      outputValues,
      outputLevels,
    };
  } else {
    outputValues.set('data', 0);
    outputLevels.set('data', 'low');

    return {
      simState: { adcValue: 0, temperature: 0 },
      outputValues,
      outputLevels,
    };
  }
};

// ==================== Resistor 行为（被动，无变化） ====================

export const resistorBehavior: ComponentBehaviorFn = (_input: BehaviorInput): BehaviorOutput => {
  return { simState: {} };
};

// ==================== 行为注册表 ====================

/** 元件类型 → 行为函数映射 */
const BEHAVIOR_REGISTRY: Record<string, ComponentBehaviorFn> = {
  led: ledBehavior,
  button: buttonBehavior,
  switch: buttonBehavior, // 开关行为与按钮类似
  buzzer_active: buzzerBehavior,
  buzzer_passive: buzzerPassiveBehavior,
  buzzer: buzzerBehavior,
  relay: relayBehavior,
  motor: motorBehavior,
  dc_motor: motorBehavior,
  sensor: sensorBehavior,
  resistor: resistorBehavior,
  capacitor: resistorBehavior, // 被动元件无特殊行为
};

/**
 * 获取元件的行为函数
 */
export function getComponentBehavior(type: string): ComponentBehaviorFn | null {
  return BEHAVIOR_REGISTRY[type] ?? null;
}

/**
 * 检查元件类型是否有行为模型
 */
export function hasComponentBehavior(type: string): boolean {
  return type in BEHAVIOR_REGISTRY;
}

/**
 * 获取所有有行为模型的元件类型
 */
export function getBehaviorTypes(): string[] {
  return Object.keys(BEHAVIOR_REGISTRY);
}
