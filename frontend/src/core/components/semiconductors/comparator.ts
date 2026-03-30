/**
 * 模拟比较器（Comparator）元件模型
 *
 * 常见型号：LM393、LM339
 * 用于嵌入式系统中的模拟信号比较，输出数字高低电平
 */

import type { ComponentPort } from '../../../types/circuit';

// ==================== 类型定义 ====================

/** 比较器输出类型 */
export type ComparatorOutputType = 'open_collector' | 'push_pull' | 'open_drain';

/** 比较器参数 */
export interface ComparatorParams {
  /** 开环增益 (V/V) */
  openLoopGain: number;
  /** 输入失调电压 (mV) */
  inputOffsetVoltage: number;
  /** 输入偏置电流 (nA) */
  inputBiasCurrent: number;
  /** 传播延迟 (ns) */
  propagationDelay: number;
  /** 输出类型 */
  outputType: ComparatorOutputType;
  /** 输出低电平 (V) */
  vOL: number;
  /** 输出高电平 (V) — push-pull 型有效 */
  vOH: number;
  /** 电源电压 (V) */
  supplyVoltage: number;
  /** 正电源电流 (mA) */
  supplyCurrent: number;
  /** 输入共模范围 */
  inputCommonModeRange: { min: number; max: number };
  /** 响应时间 (ns) */
  responseTime: number;
  /** 型号名称 */
  modelName: string;
}

// ==================== 默认参数 ====================

/** 常见比较器型号参数 */
export const COMPARATOR_MODELS: Record<string, ComparatorParams> = {
  /** LM393 低功耗双比较器 */
  'LM393': {
    openLoopGain: 200000,
    inputOffsetVoltage: 2,
    inputBiasCurrent: 25,
    propagationDelay: 1300,
    outputType: 'open_collector',
    vOL: 0.4,
    vOH: 5,
    supplyVoltage: 5,
    supplyCurrent: 0.4,
    inputCommonModeRange: { min: 0, max: 3.5 },
    responseTime: 1300,
    modelName: 'LM393',
  },
  /** LM339 四路比较器 */
  'LM339': {
    openLoopGain: 200000,
    inputOffsetVoltage: 2,
    inputBiasCurrent: 25,
    propagationDelay: 1300,
    outputType: 'open_collector',
    vOL: 0.4,
    vOH: 5,
    supplyVoltage: 5,
    supplyCurrent: 0.8,
    inputCommonModeRange: { min: 0, max: 3.5 },
    responseTime: 1300,
    modelName: 'LM339',
  },
  /** LM311 高速比较器 */
  'LM311': {
    openLoopGain: 200000,
    inputOffsetVoltage: 2,
    inputBiasCurrent: 100,
    propagationDelay: 200,
    outputType: 'open_collector',
    vOL: 0.4,
    vOH: 5,
    supplyVoltage: 5,
    supplyCurrent: 5.1,
    inputCommonModeRange: { min: -14.5, max: 13.5 },
    responseTime: 200,
    modelName: 'LM311',
  },
  /** TLV3501 超高速比较器 */
  'TLV3501': {
    openLoopGain: 100000,
    inputOffsetVoltage: 1,
    inputBiasCurrent: 0.5,
    propagationDelay: 4.5,
    outputType: 'push_pull',
    vOL: 0.1,
    vOH: 4.9,
    supplyVoltage: 5,
    supplyCurrent: 2.5,
    inputCommonModeRange: { min: -0.1, max: 5.1 },
    responseTime: 4.5,
    modelName: 'TLV3501',
  },
};

/** 默认比较器参数（LM393） */
export const DEFAULT_COMPARATOR_PARAMS: ComparatorParams = COMPARATOR_MODELS['LM393'];

// ==================== 比较器行为模型 ====================

/**
 * 比较器输出计算
 *
 * 当 V+ > V- 时输出高电平
 * 当 V+ < V- 时输出低电平
 *
 * @param vPlus 同相输入电压 (V)
 * @param vMinus 反相输入电压 (V)
 * @param params 比较器参数
 * @returns 输出电压 (V)
 */
export function comparatorOutput(
  vPlus: number,
  vMinus: number,
  params: ComparatorParams = DEFAULT_COMPARATOR_PARAMS
): number {
  const vDiff = vPlus - vMinus - params.inputOffsetVoltage / 1000;
  if (vDiff > 0) {
    return params.outputType === 'open_collector' ? NaN : params.vOH;
  }
  return params.vOL;
}

/**
 * 比较器带迟滞的输出（施密特模式）
 *
 * Vth+ = Vref × (1 + R1/R2)
 * Vth- = Vref × (1 - R1/R2)
 *
 * @param vIn 输入电压 (V)
 * @param vRef 参考电压 (V)
 * @param hysteresis 迟滞电压 (V)
 * @param prevState 上一状态 (true=高, false=低)
 * @returns 输出状态
 */
export function comparatorWithHysteresis(
  vIn: number,
  vRef: number,
  hysteresis: number,
  prevState: boolean
): boolean {
  if (prevState) {
    // 当前为高电平，切换到低电平需要 V- 下降到 Vref - hyst/2
    return vIn > (vRef - hysteresis / 2);
  } else {
    // 当前为低电平，切换到高电平需要 V+ 上升到 Vref + hyst/2
    return vIn > (vRef + hysteresis / 2);
  }
}

/**
 * 迟滞电压计算（正反馈网络）
 *
 * Vhyst = Voh × R2 / (R1 + R2)
 *
 * @param feedbackResistor R1 (Ω)
 * @param inputResistor R2 (Ω)
 * @param vOH 输出高电平 (V)
 * @returns 迟滞电压 (V)
 */
export function hysteresisVoltage(
  feedbackResistor: number,
  inputResistor: number,
  vOH: number = 5
): number {
  if (feedbackResistor + inputResistor <= 0) return 0;
  return vOH * inputResistor / (feedbackResistor + inputResistor);
}

/**
 * 窗口比较器（双比较器）
 *
 * 判断输入是否在 [Vlow, Vhigh] 范围内
 *
 * @param vIn 输入电压 (V)
 * @param vLow 下限阈值 (V)
 * @param vHigh 上限阈值 (V)
 * @returns { aboveLow: boolean, belowHigh: boolean, inWindow: boolean }
 */
export function windowComparator(
  vIn: number,
  vLow: number,
  vHigh: number
): { aboveLow: boolean; belowHigh: boolean; inWindow: boolean } {
  const aboveLow = vIn >= vLow;
  const belowHigh = vIn <= vHigh;
  return {
    aboveLow,
    belowHigh,
    inWindow: aboveLow && belowHigh,
  };
}

// ==================== 端口定义 ====================

/** 比较器端口：同相输入(+)、反相输入(-)、输出(OUT)、VCC、GND */
export const COMPARATOR_PORTS: ComponentPort[] = [
  { id: 'non_inverting', offset: { x: -30, y: -15 } },
  { id: 'inverting', offset: { x: -30, y: 15 } },
  { id: 'output', offset: { x: 30, y: 0 } },
  { id: 'vcc', offset: { x: 0, y: -30 } },
  { id: 'gnd', offset: { x: 0, y: 30 } },
];
