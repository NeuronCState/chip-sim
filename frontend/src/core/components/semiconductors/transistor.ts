/**
 * BJT 晶体管模型（NPN / PNP）
 *
 * 基于 Ebers-Moll 大信号模型
 * 支持正向放大区、饱和区、截止区、反向有源区
 */

import type { ComponentPort } from '../../../types/circuit';

// ==================== 类型定义 ====================

/** BJT 晶体管参数 */
export interface BJTParams {
  /** BJT 极性 */
  polarity: 'npn' | 'pnp';
  /** 正向电流增益 β (hFE) */
  forwardBeta: number;
  /** 反向电流增益（反向有源区） */
  reverseBeta: number;
  /** 饱和电流 Is (A)，典型 1e-16 ~ 1e-14 */
  saturationCurrent: number;
  /** 正向 Early 电压 (V)，描述厄尔利效应 */
  forwardEarlyVoltage: number;
  /** 反向 Early 电压 (V) */
  reverseEarlyVoltage: number;
  /** 热电压 Vt (V)，室温约 26mV */
  thermalVoltage: number;
  /** 正向渡越时间 τF (s) */
  forwardTransitTime: number;
  /** 反向渡越时间 τR (s) */
  reverseTransitTime: number;
  /** B-E 结电容 (F) @ 0V */
  baseEmitterCap: number;
  /** B-C 结电容 (F) @ 0V */
  baseCollectorCap: number;
  /** 基极串联电阻 (Ω) */
  baseResistance: number;
  /** 发射极串联电阻 (Ω) */
  emitterResistance: number;
  /** 集电极串联电阻 (Ω) */
  collectorResistance: number;
  /** 最大集电极电流 (A) */
  maxCollectorCurrent: number;
  /** 最大集电极-发射极电压 (V) */
  maxVceo: number;
}

// ==================== 默认参数 ====================

/** 常见 BJT 型号参数 */
export const BJT_MODELS: Record<string, BJTParams> = {
  /** 2N2222 经典 NPN 小信号管 */
  '2N2222': {
    polarity: 'npn',
    forwardBeta: 200,
    reverseBeta: 3,
    saturationCurrent: 1.03e-14,
    forwardEarlyVoltage: 74.03,
    reverseEarlyVoltage: 30,
    thermalVoltage: 0.02585,
    forwardTransitTime: 20e-9,
    reverseTransitTime: 30e-9,
    baseEmitterCap: 2.2e-11,
    baseCollectorCap: 7.3e-12,
    baseResistance: 10,
    emitterResistance: 0.5,
    collectorResistance: 2,
    maxCollectorCurrent: 0.8,
    maxVceo: 40,
  },
  /** 2N3904 常用 NPN */
  '2N3904': {
    polarity: 'npn',
    forwardBeta: 300,
    reverseBeta: 4,
    saturationCurrent: 6.734e-15,
    forwardEarlyVoltage: 74.03,
    reverseEarlyVoltage: 30,
    thermalVoltage: 0.02585,
    forwardTransitTime: 240e-9,
    reverseTransitTime: 80e-9,
    baseEmitterCap: 3.6e-12,
    baseCollectorCap: 3.6e-12,
    baseResistance: 5,
    emitterResistance: 1,
    collectorResistance: 2,
    maxCollectorCurrent: 0.2,
    maxVceo: 40,
  },
  /** BC547 低噪声 NPN */
  'BC547': {
    polarity: 'npn',
    forwardBeta: 290,
    reverseBeta: 5,
    saturationCurrent: 1.5e-14,
    forwardEarlyVoltage: 80,
    reverseEarlyVoltage: 30,
    thermalVoltage: 0.02585,
    forwardTransitTime: 500e-9,
    reverseTransitTime: 50e-9,
    baseEmitterCap: 4e-12,
    baseCollectorCap: 3e-12,
    baseResistance: 15,
    emitterResistance: 1,
    collectorResistance: 3,
    maxCollectorCurrent: 0.1,
    maxVceo: 45,
  },
  /** 2N2907 PNP 互补管 */
  '2N2907': {
    polarity: 'pnp',
    forwardBeta: 200,
    reverseBeta: 3,
    saturationCurrent: 1.03e-14,
    forwardEarlyVoltage: 74.03,
    reverseEarlyVoltage: 30,
    thermalVoltage: 0.02585,
    forwardTransitTime: 20e-9,
    reverseTransitTime: 30e-9,
    baseEmitterCap: 2.2e-11,
    baseCollectorCap: 7.3e-12,
    baseResistance: 10,
    emitterResistance: 0.5,
    collectorResistance: 2,
    maxCollectorCurrent: 0.6,
    maxVceo: -40,
  },
};

/** 默认 NPN 参数 */
export const DEFAULT_NPN_PARAMS: BJTParams = BJT_MODELS['2N3904'];

/** 默认 PNP 参数 */
export const DEFAULT_PNP_PARAMS: BJTParams = BJT_MODELS['2N2907'];

// ==================== 工作区判断 ====================

/** BJT 工作区域 */
export type BJTRegion = 'cutoff' | 'forward_active' | 'saturation' | 'reverse_active';

/**
 * 判断 BJT 工作区域
 *
 * - 截止区：Vbe < 0.5V（基极电流不足以导通）
 * - 正向放大区：Vbe ≥ 0.5V 且 Vce ≥ Vbe（集电结反偏）
 * - 饱和区：Vbe ≥ 0.5V 且 Vce < Vbe（集电结正偏）
 * - 反向有源区：极少使用，Vce < 0
 *
 * @param Vbe 基极-发射极电压 (V)
 * @param Vce 集电极-发射极电压 (V)
 * @param params BJT 参数
 * @returns 工作区域
 */
export function bjtOperatingRegion(Vbe: number, Vce: number, params: BJTParams = DEFAULT_NPN_PARAMS): BJTRegion {
  const sign = params.polarity === 'npn' ? 1 : -1;
  const vbe = Vbe * sign;
  const vce = Vce * sign;

  if (vbe < 0.4) return 'cutoff';
  if (vce < 0) return 'reverse_active';
  if (vce < vbe - 0.3) return 'saturation';
  return 'forward_active';
}

// ==================== Ebers-Moll 模型 ====================

/**
 * Ebers-Moll 大信号模型：正向有源区集电极电流
 *
 * Ic = Is × (exp(Vbe / (n × Vt)) - 1) × (1 + Vce / Va)
 *
 * 其中 Va 为 Early 电压，描述基极宽度调制效应
 *
 * @param Vbe 基极-发射极电压 (V)
 * @param Vce 集电极-发射极电压 (V)
 * @param params BJT 参数
 * @returns 集电极电流 Ic (A)
 */
export function bjtCollectorCurrent(Vbe: number, Vce: number, params: BJTParams = DEFAULT_NPN_PARAMS): number {
  const { saturationCurrent: Is, forwardBeta: _β, forwardEarlyVoltage: Va, thermalVoltage: Vt } = params;
  const sign = params.polarity === 'npn' ? 1 : -1;
  const vbe = Vbe * sign;

  if (vbe < 0) return 0;

  const expVbe = Math.exp(Math.min(vbe / Vt, 40));
  // 考虑厄尔利效应
  const Ic = Is * (expVbe - 1) * (1 + sign * Vce / Va);
  return Math.max(0, Ic) * sign;
}

/**
 * 基极电流
 *
 * Ib = Ic / β
 *
 * @param Ic 集电极电流 (A)
 * @param params BJT 参数
 * @returns 基极电流 (A)
 */
export function bjtBaseCurrent(Ic: number, params: BJTParams = DEFAULT_NPN_PARAMS): number {
  return Math.abs(Ic) / params.forwardBeta * Math.sign(Ic);
}

/**
 * 发射极电流
 *
 * Ie = Ic + Ib = Ic × (1 + 1/β)
 *
 * @param Ic 集电极电流 (A)
 * @param params BJT 参数
 * @returns 发射极电流 (A)
 */
export function bjtEmitterCurrent(Ic: number, params: BJTParams = DEFAULT_NPN_PARAMS): number {
  const sign = Math.sign(Ic);
  return Math.abs(Ic) * (1 + 1 / params.forwardBeta) * sign;
}

/**
 * 饱和区 Vce(sat) 计算
 *
 * Vce(sat) ≈ Vt × ln((Ic/Is + 1) / (Ic/(β×Is) + 1))
 *
 * @param Ic 集电极电流 (A)
 * @param forcedBeta 强制 β（实际 Ic/Ib），通常取 10
 * @param params BJT 参数
 * @returns Vce(sat) (V)
 */
export function bjtSaturationVce(
  Ic: number,
  forcedBeta: number = 10,
  params: BJTParams = DEFAULT_NPN_PARAMS
): number {
  const { saturationCurrent: Is, thermalVoltage: Vt } = params;
  const absIc = Math.abs(Ic);
  const term1 = absIc / Is + 1;
  const term2 = absIc / (forcedBeta * Is) + 1;
  return Vt * Math.log(term1 / term2);
}

/**
 * 直流电流增益计算（考虑大电流下降）
 *
 * β_eff = β / (1 + Ic / Icr)
 *
 * @param Ic 集电极电流 (A)
 * @param params BJT 参数
 * @returns 有效电流增益
 */
export function bjtEffectiveBeta(Ic: number, params: BJTParams = DEFAULT_NPN_PARAMS): number {
  // 大电流时 β 下降的拐点电流
  const kneeCurrent = params.maxCollectorCurrent * 5;
  return params.forwardBeta / (1 + Math.abs(Ic) / kneeCurrent);
}

/**
 * 生成 BJT 输出特性曲线数据（Ic vs Vce for different Ib）
 *
 * @param VceMax 最大 Vce (V)
 * @param baseCurrents 基极电流数组 (A)
 * @param points 每条曲线的采样点数
 * @param params BJT 参数
 * @returns 每条曲线的数据
 */
export function generateBJTOutputCurves(
  VceMax: number = 10,
  baseCurrents: number[] = [10e-6, 20e-6, 40e-6, 60e-6, 80e-6, 100e-6],
  points: number = 50,
  params: BJTParams = DEFAULT_NPN_PARAMS
): { Ib: number; data: { Vce: number; Ic: number }[] }[] {
  const sign = params.polarity === 'npn' ? 1 : -1;
  return baseCurrents.map(Ib => {
    const data: { Vce: number; Ic: number }[] = [];
    for (let i = 0; i < points; i++) {
      const Vce = sign * (i / (points - 1)) * VceMax;
      // Vbe 从 Ib 反推
      const Vbe = sign * params.thermalVoltage * Math.log(Ib * params.forwardBeta / params.saturationCurrent + 1);
      const Ic = bjtCollectorCurrent(Vbe, Vce, params);
      data.push({ Vce: Math.round(Vce * 1000) / 1000, Ic: Math.round(Math.abs(Ic) * 1000) / 1000 });
    }
    return { Ib: Ib * 1e6, data }; // Ib 转换为 μA 用于显示
  });
}

/**
 * 生成 BJT 转移特性曲线（Ic vs Vbe）
 *
 * @param VbeMax 最大 Vbe (V)
 * @param points 采样点数
 * @param params BJT 参数
 * @returns { Vbe: number, Ic: number }[]
 */
export function generateBJTTransferCurve(
  VbeMax: number = 0.8,
  points: number = 50,
  params: BJTParams = DEFAULT_NPN_PARAMS
): { Vbe: number; Ic: number }[] {
  const data: { Vbe: number; Ic: number }[] = [];
  const VbeStart = 0.3;
  const step = (VbeMax - VbeStart) / (points - 1);
  for (let i = 0; i < points; i++) {
    const Vbe = VbeStart + i * step;
    const Ic = bjtCollectorCurrent(Vbe, 5, params); // Vce = 5V
    data.push({ Vbe: Math.round(Vbe * 1000) / 1000, Ic: Math.round(Math.abs(Ic) * 1000) / 1000 });
  }
  return data;
}

// ==================== 端口定义 ====================

/** NPN 晶体管端口布局：基极(B)、集电极(C)、发射极(E) */
export const NPN_PORTS: ComponentPort[] = [
  { id: 'base', offset: { x: -30, y: 0 } },
  { id: 'collector', offset: { x: 0, y: -30 } },
  { id: 'emitter', offset: { x: 0, y: 30 } },
];

/** PNP 晶体管端口布局 */
export const PNP_PORTS: ComponentPort[] = NPN_PORTS;
