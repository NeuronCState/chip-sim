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

// ==================== Diode 行为 ====================

/**
 * Diode: 正向导通时传递信号，反向阻断
 * 引脚: anode (A), cathode (K)
 */
export const diodeBehavior: ComponentBehaviorFn = (input: BehaviorInput): BehaviorOutput => {
  const anodeLevel = input.pinLevels.get('anode') ?? 'floating';
  const cathodeLevel = input.pinLevels.get('cathode') ?? 'floating';
  const anodeValue = input.pinValues.get('anode') ?? 0;

  const outputLevels = new Map<string, PinLevel>();
  const outputValues = new Map<string, number>();

  // 正向导通：阳极高电平，阴极低电平
  if (anodeLevel === 'high' && cathodeLevel !== 'high') {
    outputLevels.set('cathode', 'high');
    outputValues.set('cathode', anodeValue > 0 ? anodeValue : 1);
  } else {
    // 反向阻断
    outputLevels.set('cathode', 'floating');
    outputValues.set('cathode', 0);
  }

  return { simState: {}, outputLevels, outputValues };
};

/**
 * Zener Diode: 正向导通 + 反向击穿稳压
 * 引脚: anode (A), cathode (K)
 */
export const zenerDiodeBehavior: ComponentBehaviorFn = (input: BehaviorInput): BehaviorOutput => {
  const anodeLevel = input.pinLevels.get('anode') ?? 'floating';
  const cathodeLevel = input.pinLevels.get('cathode') ?? 'floating';
  const anodeValue = input.pinValues.get('anode') ?? 0;

  const outputLevels = new Map<string, PinLevel>();
  const outputValues = new Map<string, number>();

  if (anodeLevel === 'high' && cathodeLevel !== 'high') {
    // 正向导通
    outputLevels.set('cathode', 'high');
    outputValues.set('cathode', anodeValue > 0 ? anodeValue : 1);
  } else if (cathodeLevel === 'high' && anodeLevel === 'low') {
    // 反向击穿（简化：超过阈值时输出稳压值）
    outputLevels.set('anode', 'high');
    outputValues.set('anode', 1); // 稳压后的电压
  } else {
    outputLevels.set('cathode', 'floating');
    outputValues.set('cathode', 0);
  }

  return { simState: {}, outputLevels, outputValues };
};

// ==================== BJT 行为 ====================

/**
 * BJT NPN: 基极高电平时集电极-发射极导通
 * 引脚: 1=基极(B), 2=发射极(E), 3=集电极(C)
 */
export const bjtNpnBehavior: ComponentBehaviorFn = (input: BehaviorInput): BehaviorOutput => {
  const base = input.pinLevels.get('1') ?? 'floating';
  const collector = input.pinLevels.get('3') ?? 'floating';
  const collectorValue = input.pinValues.get('3') ?? 0;

  const outputLevels = new Map<string, PinLevel>();
  const outputValues = new Map<string, number>();

  // 基极高电平 → 导通（集电极信号传递到发射极）
  if (base === 'high') {
    outputLevels.set('2', collector === 'high' ? 'high' : collector);
    outputValues.set('2', collectorValue > 0 ? collectorValue : 1);
  } else {
    outputLevels.set('2', 'floating');
    outputValues.set('2', 0);
  }

  return { simState: {}, outputLevels, outputValues };
};

/**
 * BJT PNP: 基极低电平时发射极-集电极导通
 * 引脚: 1=基极(B), 2=发射极(E), 3=集电极(C)
 */
export const bjtPnpBehavior: ComponentBehaviorFn = (input: BehaviorInput): BehaviorOutput => {
  const base = input.pinLevels.get('1') ?? 'floating';
  const emitter = input.pinLevels.get('2') ?? 'floating';
  const emitterValue = input.pinValues.get('2') ?? 0;

  const outputLevels = new Map<string, PinLevel>();
  const outputValues = new Map<string, number>();

  // 基极低电平 → 导通（发射极信号传递到集电极）
  if (base === 'low' || base === 'floating') {
    outputLevels.set('3', emitter);
    outputValues.set('3', emitterValue > 0 ? emitterValue : (emitter === 'high' ? 1 : 0));
  } else {
    outputLevels.set('3', 'floating');
    outputValues.set('3', 0);
  }

  return { simState: {}, outputLevels, outputValues };
};

// ==================== MOSFET 行为 ====================

/**
 * NMOS: 栅极高电平时漏极-源极导通
 * 引脚: 1=栅极(G), 2=源极(S), 3=漏极(D)
 */
export const mosfetNmosBehavior: ComponentBehaviorFn = (input: BehaviorInput): BehaviorOutput => {
  const gate = input.pinLevels.get('1') ?? 'floating';
  const drain = input.pinLevels.get('3') ?? 'floating';
  const drainValue = input.pinValues.get('3') ?? 0;

  const outputLevels = new Map<string, PinLevel>();
  const outputValues = new Map<string, number>();

  // 栅极高电平 → 导通（漏极信号传递到源极）
  if (gate === 'high') {
    outputLevels.set('2', drain);
    outputValues.set('2', drainValue > 0 ? drainValue : (drain === 'high' ? 1 : 0));
  } else {
    outputLevels.set('2', 'floating');
    outputValues.set('2', 0);
  }

  return { simState: {}, outputLevels, outputValues };
};

/**
 * PMOS: 栅极低电平时源极-漏极导通
 * 引脚: 1=栅极(G), 2=源极(S), 3=漏极(D)
 */
export const mosfetPmosBehavior: ComponentBehaviorFn = (input: BehaviorInput): BehaviorOutput => {
  const gate = input.pinLevels.get('1') ?? 'floating';
  const source = input.pinLevels.get('2') ?? 'floating';
  const sourceValue = input.pinValues.get('2') ?? 0;

  const outputLevels = new Map<string, PinLevel>();
  const outputValues = new Map<string, number>();

  // 栅极低电平 → 导通（源极信号传递到漏极）
  if (gate === 'low' || gate === 'floating') {
    outputLevels.set('3', source);
    outputValues.set('3', sourceValue > 0 ? sourceValue : (source === 'high' ? 1 : 0));
  } else {
    outputLevels.set('3', 'floating');
    outputValues.set('3', 0);
  }

  return { simState: {}, outputLevels, outputValues };
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
  diode: diodeBehavior,
  zener_diode: zenerDiodeBehavior,
  bjt_npn: bjtNpnBehavior,
  bjt_pnp: bjtPnpBehavior,
  mosfet_nmos: mosfetNmosBehavior,
  mosfet_pmos: mosfetPmosBehavior,
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
