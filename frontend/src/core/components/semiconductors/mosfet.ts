/**
 * MOSFET 晶体管模型（NMOS / PMOS）
 *
 * 基于 Shichman-Hodges 模型
 * 支持截止区、线性区（三极管区）、饱和区
 */

import type { ComponentPort } from '../../../types/circuit';

// ==================== 类型定义 ====================

/** MOSFET 参数 */
export interface MOSFETParams {
  /** 沟道极性 */
  polarity: 'nmos' | 'pmos';
  /** 阈值电压 Vth (V) */
  thresholdVoltage: number;
  /** 跨导参数 Kp = μ × Cox (A/V²) */
  transconductanceParam: number;
  /** W/L 沟道宽长比 */
  widthToLength: number;
  /** 沟道长度调制参数 λ (1/V) */
  channelLengthModulation: number;
  /** 体效应参数 γ (V^0.5) */
  bodyEffectCoeff: number;
  /** 表面电势 φf (V) */
  surfacePotential: number;
  /** 栅源电容 Cgs (F) */
  gateSourceCap: number;
  /** 栅漏电容 Cgd (F) */
  gateDrainCap: number;
  /** 体二极管正向压降 (V) */
  bodyDiodeVoltage: number;
  /** 导通电阻 (Ω) @ Vgs = Vgs(max) */
  onResistance: number;
  /** 最大漏极电流 (A) */
  maxDrainCurrent: number;
  /** 最大 Vds (V) */
  maxVds: number;
  /** 最大 Vgs (V) */
  maxVgs: number;
}

// ==================== 默认参数 ====================

/** 常见 MOSFET 型号参数 */
export const MOSFET_MODELS: Record<string, MOSFETParams> = {
  /** 2N7000 小信号 N-MOSFET */
  '2N7000': {
    polarity: 'nmos',
    thresholdVoltage: 2.1,
    transconductanceParam: 0.054,
    widthToLength: 100,
    channelLengthModulation: 0.02,
    bodyEffectCoeff: 0.45,
    surfacePotential: 0.65,
    gateSourceCap: 20e-12,
    gateDrainCap: 4e-12,
    bodyDiodeVoltage: 0.7,
    onResistance: 5,
    maxDrainCurrent: 0.2,
    maxVds: 60,
    maxVgs: 20,
  },
  /** IRF540N 功率 N-MOSFET */
  'IRF540N': {
    polarity: 'nmos',
    thresholdVoltage: 3.0,
    transconductanceParam: 0.18,
    widthToLength: 500,
    channelLengthModulation: 0.01,
    bodyEffectCoeff: 0.5,
    surfacePotential: 0.6,
    gateSourceCap: 1400e-12,
    gateDrainCap: 400e-12,
    bodyDiodeVoltage: 0.7,
    onResistance: 0.044,
    maxDrainCurrent: 33,
    maxVds: 100,
    maxVgs: 20,
  },
  /** BS170 小信号 N-MOSFET */
  'BS170': {
    polarity: 'nmos',
    thresholdVoltage: 2.0,
    transconductanceParam: 0.038,
    widthToLength: 80,
    channelLengthModulation: 0.02,
    bodyEffectCoeff: 0.4,
    surfacePotential: 0.6,
    gateSourceCap: 15e-12,
    gateDrainCap: 3e-12,
    bodyDiodeVoltage: 0.7,
    onResistance: 5.0,
    maxDrainCurrent: 0.5,
    maxVds: 60,
    maxVgs: 20,
  },
  /** IRF9540 P-MOSFET */
  'IRF9540': {
    polarity: 'pmos',
    thresholdVoltage: -3.0,
    transconductanceParam: 0.12,
    widthToLength: 400,
    channelLengthModulation: 0.01,
    bodyEffectCoeff: 0.5,
    surfacePotential: 0.6,
    gateSourceCap: 1200e-12,
    gateDrainCap: 350e-12,
    bodyDiodeVoltage: 0.7,
    onResistance: 0.117,
    maxDrainCurrent: -23,
    maxVds: -100,
    maxVgs: -20,
  },
};

/** 默认 NMOS 参数 */
export const DEFAULT_NMOS_PARAMS: MOSFETParams = MOSFET_MODELS['IRF540N'];

/** 默认 PMOS 参数 */
export const DEFAULT_PMOS_PARAMS: MOSFETParams = MOSFET_MODELS['IRF9540'];

// ==================== 工作区判断 ====================

/** MOSFET 工作区域 */
export type MOSFETRegion = 'cutoff' | 'linear' | 'saturation';

/**
 * 判断 MOSFET 工作区域
 *
 * - 截止区：|Vgs| < |Vth|，沟道未形成
 * - 线性区（三极管区）：|Vgs| > |Vth| 且 |Vds| < |Vgs - Vth|
 * - 饱和区：|Vgs| > |Vth| 且 |Vds| ≥ |Vgs - Vth|
 *
 * @param Vgs 栅源电压 (V)
 * @param Vds 漏源电压 (V)
 * @param params MOSFET 参数
 * @returns 工作区域
 */
export function mosfetOperatingRegion(Vgs: number, Vds: number, params: MOSFETParams = DEFAULT_NMOS_PARAMS): MOSFETRegion {
  const sign = params.polarity === 'nmos' ? 1 : -1;
  const vgs = Vgs * sign;
  const vds = Vds * sign;
  const vth = params.thresholdVoltage * sign;

  if (vgs < vth) return 'cutoff';
  const vov = vgs - vth; // 过驱动电压
  if (vds < vov) return 'linear';
  return 'saturation';
}

// ==================== Shichman-Hodges 模型 ====================

/**
 * MOSFET 漏极电流计算
 *
 * 截止区：Id = 0
 * 线性区：Id = Kp × (W/L) × [(Vgs - Vth)×Vds - Vds²/2] × (1 + λ×Vds)
 * 饱和区：Id = (Kp/2) × (W/L) × (Vgs - Vth)² × (1 + λ×Vds)
 *
 * @param Vgs 栅源电压 (V)
 * @param Vds 漏源电压 (V)
 * @param params MOSFET 参数
 * @returns 漏极电流 (A)，NMOS 为正、PMOS 为负
 */
export function mosfetDrainCurrent(Vgs: number, Vds: number, params: MOSFETParams = DEFAULT_NMOS_PARAMS): number {
  const sign = params.polarity === 'nmos' ? 1 : -1;
  const vgs = Vgs * sign;
  const vds = Vds * sign;
  const vth = params.thresholdVoltage * sign;
  const { transconductanceParam: Kp, widthToLength: WL, channelLengthModulation: λ } = params;

  // 截止区
  if (vgs < vth) return 0;

  const vov = vgs - vth; // 过驱动电压

  let Id: number;
  if (vds < vov) {
    // 线性区（三极管区）
    Id = Kp * WL * (vov * vds - vds * vds / 2) * (1 + λ * vds);
  } else {
    // 饱和区
    Id = (Kp / 2) * WL * vov * vov * (1 + λ * vds);
  }

  return Math.max(0, Id) * sign;
}

/**
 * 跨导 gm = dId/dVgs
 *
 * 饱和区：gm = Kp × (W/L) × (Vgs - Vth) × (1 + λ×Vds)
 * 线性区：gm = Kp × (W/L) × Vds × (1 + λ×Vds)
 *
 * @param Vgs 栅源电压 (V)
 * @param Vds 漏源电压 (V)
 * @param params MOSFET 参数
 * @returns 跨导 gm (S)
 */
export function mosfetTransconductance(Vgs: number, Vds: number, params: MOSFETParams = DEFAULT_NMOS_PARAMS): number {
  const sign = params.polarity === 'nmos' ? 1 : -1;
  const vgs = Vgs * sign;
  const vds = Vds * sign;
  const vth = params.thresholdVoltage * sign;
  const { transconductanceParam: Kp, widthToLength: WL, channelLengthModulation: λ } = params;

  if (vgs < vth) return 0;

  const vov = vgs - vth;
  if (vds < vov) {
    return Kp * WL * vds * (1 + λ * vds);
  }
  return Kp * WL * vov * (1 + λ * vds);
}

/**
 * 输出电阻 ro = 1 / (λ × Id)
 *
 * @param Id 漏极电流 (A)
 * @param params MOSFET 参数
 * @returns 输出电阻 (Ω)
 */
export function mosfetOutputResistance(Id: number, params: MOSFETParams = DEFAULT_NMOS_PARAMS): number {
  if (Math.abs(Id) < 1e-12) return Infinity;
  return 1 / (params.channelLengthModulation * Math.abs(Id));
}

/**
 * 导通电阻 Rds(on)
 *
 * Rds(on) ≈ 1 / [Kp × (W/L) × (Vgs - Vth)]
 *
 * @param Vgs 栅源电压 (V)
 * @param params MOSFET 参数
 * @returns 导通电阻 (Ω)
 */
export function mosfetOnResistance(Vgs: number, params: MOSFETParams = DEFAULT_NMOS_PARAMS): number {
  const sign = params.polarity === 'nmos' ? 1 : -1;
  const vgs = Vgs * sign;
  const vth = params.thresholdVoltage * sign;

  if (vgs <= vth) return Infinity;
  const { transconductanceParam: Kp, widthToLength: WL } = params;
  return 1 / (Kp * WL * (vgs - vth));
}

/**
 * 生成 MOSFET 输出特性曲线（Id vs Vds for different Vgs）
 *
 * @param VdsMax 最大 Vds (V)
 * @param gateVoltages 栅极电压数组 (V)
 * @param points 采样点数
 * @param params MOSFET 参数
 * @returns 曲线数据
 */
export function generateMOSFETOutputCurves(
  VdsMax: number = 10,
  gateVoltages: number[] = [3, 4, 5, 6, 8, 10],
  points: number = 50,
  params: MOSFETParams = DEFAULT_NMOS_PARAMS
): { Vgs: number; data: { Vds: number; Id: number }[] }[] {
  const sign = params.polarity === 'nmos' ? 1 : -1;
  return gateVoltages.map(Vgs => {
    const data: { Vds: number; Id: number }[] = [];
    for (let i = 0; i < points; i++) {
      const Vds = sign * (i / (points - 1)) * VdsMax;
      const Id = mosfetDrainCurrent(Vgs, Vds, params);
      data.push({ Vds: Math.round(Vds * 1000) / 1000, Id: Math.round(Math.abs(Id) * 1000) / 1000 });
    }
    return { Vgs, data };
  });
}

/**
 * 生成 MOSFET 转移特性曲线（Id vs Vgs）
 *
 * @param VgsMax 最大 Vgs (V)
 * @param Vds 固定 Vds (V)
 * @param points 采样点数
 * @param params MOSFET 参数
 * @returns { Vgs: number, Id: number }[]
 */
export function generateMOSFETTransferCurve(
  VgsMax: number = 10,
  Vds: number = 10,
  points: number = 50,
  params: MOSFETParams = DEFAULT_NMOS_PARAMS
): { Vgs: number; Id: number }[] {
  const data: { Vgs: number; Id: number }[] = [];
  const vth = Math.abs(params.thresholdVoltage);
  const step = (VgsMax - vth + 0.5) / (points - 1);
  for (let i = 0; i < points; i++) {
    const vg = vth - 0.5 + i * step;
    const Id = mosfetDrainCurrent(vg, Vds, params);
    data.push({ Vgs: Math.round(vg * 100) / 100, Id: Math.round(Math.abs(Id) * 1000) / 1000 });
  }
  return data;
}

// ==================== 端口定义 ====================

/** NMOS 端口布局：栅极(G)、漏极(D)、源极(S)、体(B) */
export const NMOS_PORTS: ComponentPort[] = [
  { id: 'gate', offset: { x: -30, y: 0 } },
  { id: 'drain', offset: { x: 0, y: -30 } },
  { id: 'source', offset: { x: 0, y: 30 } },
  { id: 'body', offset: { x: 15, y: 30 } },
];

/** PMOS 端口布局 */
export const PMOS_PORTS: ComponentPort[] = NMOS_PORTS;
