/**
 * 施密特触发器（Schmitt Trigger）元件模型
 *
 * 带迟滞的数字信号整形器
 * 常见型号：74HC14（六反相器）、SN74LVC1G17（单路同相）
 */

import type { ComponentPort } from '../../../types/circuit';

// ==================== 类型定义 ====================

/** 施密特触发器参数 */
export interface SchmittTriggerParams {
  /** 正向阈值电压 V_T+ (V) */
  positiveThreshold: number;
  /** 负向阈值电压 V_T- (V) */
  negativeThreshold: number;
  /** 迟滞电压 ΔVt = V_T+ - V_T- (V) */
  hysteresisVoltage: number;
  /** 输出低电平 (V) */
  vOL: number;
  /** 输出高电平 (V) */
  vOH: number;
  /** 传播延迟 (ns) */
  propagationDelay: number;
  /** 电源电压 (V) */
  supplyVoltage: number;
  /** 静态电流 (μA) */
  quiescentCurrent: number;
  /** 输出类型 */
  inverting: boolean;
  /** 型号名称 */
  modelName: string;
}

// ==================== 默认参数 ====================

/** 常见施密特触发器型号参数 */
export const SCHMITT_TRIGGER_MODELS: Record<string, SchmittTriggerParams> = {
  /** 74HC14 六反相施密特触发器 @ VCC=5V */
  '74HC14': {
    positiveThreshold: 2.7,
    negativeThreshold: 1.6,
    hysteresisVoltage: 1.1,
    vOL: 0.1,
    vOH: 4.9,
    propagationDelay: 18,
    supplyVoltage: 5,
    quiescentCurrent: 4,
    inverting: true,
    modelName: '74HC14',
  },
  /** 74HC14 @ VCC=3.3V */
  '74HC14_3V3': {
    positiveThreshold: 1.9,
    negativeThreshold: 0.9,
    hysteresisVoltage: 1.0,
    vOL: 0.1,
    vOH: 3.2,
    propagationDelay: 22,
    supplyVoltage: 3.3,
    quiescentCurrent: 4,
    inverting: true,
    modelName: '74HC14',
  },
  /** SN74LVC1G17 单路同相施密特触发器 */
  'SN74LVC1G17': {
    positiveThreshold: 1.7,
    negativeThreshold: 0.6,
    hysteresisVoltage: 1.1,
    vOL: 0.1,
    vOH: 3.2,
    propagationDelay: 3.7,
    supplyVoltage: 3.3,
    quiescentCurrent: 1,
    inverting: false,
    modelName: 'SN74LVC1G17',
  },
  /** CD40106B CMOS 六反相施密特触发器 */
  'CD40106B': {
    positiveThreshold: 3.6,
    negativeThreshold: 2.4,
    hysteresisVoltage: 1.2,
    vOL: 0.05,
    vOH: 4.95,
    propagationDelay: 120,
    supplyVoltage: 5,
    quiescentCurrent: 0.01,
    inverting: true,
    modelName: 'CD40106B',
  },
  /** TL331 内置施密特的比较器 @ VCC=5V */
  'TL331': {
    positiveThreshold: 2.6,
    negativeThreshold: 2.1,
    hysteresisVoltage: 0.5,
    vOL: 0.2,
    vOH: 3.5,
    propagationDelay: 1300,
    supplyVoltage: 5,
    quiescentCurrent: 400,
    inverting: false,
    modelName: 'TL331',
  },
};

/** 默认施密特触发器参数 */
export const DEFAULT_SCHMITT_PARAMS: SchmittTriggerParams = SCHMITT_TRIGGER_MODELS['74HC14'];

// ==================== 施密特触发器行为模型 ====================

/**
 * 施密特触发器输出计算
 *
 * 正向触发：Vout = Voh（当 Vin > Vt+）
 * 负向触发：Vout = Vol（当 Vin < Vt-）
 * 迟滞区间内保持前一状态
 *
 * @param vIn 输入电压 (V)
 * @param prevState 上一输出状态 (true=高, false=低)
 * @param params 施密特触发器参数
 * @returns 输出状态 (true=高, false=低)
 */
export function schmittTriggerOutput(
  vIn: number,
  prevState: boolean,
  params: SchmittTriggerParams = DEFAULT_SCHMITT_PARAMS
): boolean {
  if (prevState) {
    // 当前输出高电平：负向切换
    return vIn >= params.negativeThreshold;
  } else {
    // 当前输出低电平：正向切换
    return vIn >= params.positiveThreshold;
  }
}

/**
 * 施密特触发器输出电压值
 *
 * @param vIn 输入电压 (V)
 * @param prevState 上一输出状态 (true=高, false=低)
 * @param params 施密特触发器参数
 * @returns 输出电压 (V)
 */
export function schmittTriggerOutputVoltage(
  vIn: number,
  prevState: boolean,
  params: SchmittTriggerParams = DEFAULT_SCHMITT_PARAMS
): number {
  const state = schmittTriggerOutput(vIn, prevState, params);
  if (params.inverting) {
    return state ? params.vOL : params.vOH;
  }
  return state ? params.vOH : params.vOL;
}

/**
 * 计算需要的正反馈电阻值以达到目标迟滞电压
 *
 * R1/R2 = Vhyst / Voh（简化模型）
 *
 * @param targetHysteresis 目标迟滞电压 (V)
 * @param vOH 输出高电平 (V)
 * @param r2 下拉电阻 (Ω)
 * @returns 上拉电阻 R1 (Ω)
 */
export function schmittFeedbackResistor(
  targetHysteresis: number,
  vOH: number = 4.9,
  r2: number = 10000
): number {
  if (vOH <= 0) return Infinity;
  return r2 * targetHysteresis / vOH;
}

/**
 * 施密特触发器信号整形
 * 将带噪声的输入信号转为干净的数字信号
 *
 * @param inputSignal 输入信号数组 [{x, y}]
 * @param params 施密特触发器参数
 * @returns 整形后的信号数组 [{x, y}]
 */
export function schmittTriggerSignalShaping(
  inputSignal: { x: number; y: number }[],
  params: SchmittTriggerParams = DEFAULT_SCHMITT_PARAMS
): { x: number; y: number }[] {
  const output: { x: number; y: number }[] = [];
  let prevState = false;

  for (const point of inputSignal) {
    prevState = schmittTriggerOutput(point.y, prevState, params);
    const vOut = params.inverting
      ? (prevState ? params.vOL : params.vOH)
      : (prevState ? params.vOH : params.vOL);
    output.push({ x: point.x, y: vOut });
  }
  return output;
}

// ==================== 端口定义 ====================

/** 施密特触发器端口：输入(IN)、输出(OUT)、VCC、GND */
export const SCHMITT_TRIGGER_PORTS: ComponentPort[] = [
  { id: 'input', offset: { x: -30, y: 0 } },
  { id: 'output', offset: { x: 30, y: 0 } },
  { id: 'vcc', offset: { x: 0, y: -30 } },
  { id: 'gnd', offset: { x: 0, y: 30 } },
];
