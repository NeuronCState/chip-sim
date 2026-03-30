/**
 * 晶体振荡器（Crystal Oscillator）元件模型
 *
 * MCU 时钟源，常见频率：8MHz、16MHz、11.0592MHz、32.768kHz
 * 包含 Pierce 振荡电路等效模型
 */

import type { ComponentPort } from '../../../types/circuit';

// ==================== 类型定义 ====================

/** 晶振参数 */
export interface CrystalParams {
  /** 标称频率 (Hz) */
  frequency: number;
  /** 负载电容 (pF) */
  loadCapacitance: number;
  /** 等效串联电阻 ESR (Ω) */
  esr: number;
  /** 等效串联电感 (H) */
  motionalInductance: number;
  /** 等效串联电容 (fF) */
  motionalCapacitance: number;
  /** 并联电容 C0 (pF) */
  parallelCapacitance: number;
  /** 频率公差 (ppm) */
  frequencyTolerance: number;
  /** 温度稳定性 (ppm) @ -20~70°C */
  tempStability: number;
  /** 驱动功率 (μW) */
  driveLevel: number;
  /** 老化率 (ppm/年) */
  agingRate: number;
  /** Q 值 */
  qualityFactor: number;
}

// ==================== 默认参数 ====================

/** 常见晶振型号参数 */
export const CRYSTAL_MODELS: Record<string, CrystalParams> = {
  /** 16MHz 晶振（Arduino/STM32 常用） */
  '16MHz': {
    frequency: 16000000,
    loadCapacitance: 20,
    esr: 30,
    motionalInductance: 0.01,
    motionalCapacitance: 10e-15,
    parallelCapacitance: 5e-12,
    frequencyTolerance: 20,
    tempStability: 30,
    driveLevel: 100,
    agingRate: 3,
    qualityFactor: 50000,
  },
  /** 8MHz 晶振（常用通用频率） */
  '8MHz': {
    frequency: 8000000,
    loadCapacitance: 20,
    esr: 40,
    motionalInductance: 0.02,
    motionalCapacitance: 20e-15,
    parallelCapacitance: 5e-12,
    frequencyTolerance: 20,
    tempStability: 30,
    driveLevel: 100,
    agingRate: 3,
    qualityFactor: 40000,
  },
  /** 11.0592MHz 晶振（UART 精确波特率） */
  '11.0592MHz': {
    frequency: 11059200,
    loadCapacitance: 20,
    esr: 35,
    motionalInductance: 0.015,
    motionalCapacitance: 14e-15,
    parallelCapacitance: 5e-12,
    frequencyTolerance: 20,
    tempStability: 30,
    driveLevel: 100,
    agingRate: 3,
    qualityFactor: 45000,
  },
  /** 32.768kHz 晶振（RTC 实时时钟） */
  '32.768kHz': {
    frequency: 32768,
    loadCapacitance: 12.5,
    esr: 35000,
    motionalInductance: 8800,
    motionalCapacitance: 2.7e-15,
    parallelCapacitance: 1.2e-12,
    frequencyTolerance: 20,
    tempStability: 5,
    driveLevel: 1,
    agingRate: 3,
    qualityFactor: 50000,
  },
  /** 12MHz 晶振（USB 全速时钟） */
  '12MHz': {
    frequency: 12000000,
    loadCapacitance: 18,
    esr: 35,
    motionalInductance: 0.013,
    motionalCapacitance: 13e-15,
    parallelCapacitance: 5e-12,
    frequencyTolerance: 10,
    tempStability: 20,
    driveLevel: 100,
    agingRate: 2,
    qualityFactor: 45000,
  },
  /** 25MHz 晶振（以太网 PHY 常用） */
  '25MHz': {
    frequency: 25000000,
    loadCapacitance: 18,
    esr: 25,
    motionalInductance: 0.006,
    motionalCapacitance: 6e-15,
    parallelCapacitance: 4e-12,
    frequencyTolerance: 10,
    tempStability: 20,
    driveLevel: 100,
    agingRate: 2,
    qualityFactor: 40000,
  },
  /** 26MHz 晶振（WiFi/BLE 常用） */
  '26MHz': {
    frequency: 26000000,
    loadCapacitance: 10,
    esr: 30,
    motionalInductance: 0.005,
    motionalCapacitance: 7e-15,
    parallelCapacitance: 3e-12,
    frequencyTolerance: 10,
    tempStability: 10,
    driveLevel: 200,
    agingRate: 1,
    qualityFactor: 50000,
  },
};

/** 默认晶振参数（16MHz） */
export const DEFAULT_CRYSTAL_PARAMS: CrystalParams = CRYSTAL_MODELS['16MHz'];

// ==================== 晶振行为模型 ====================

/**
 * 晶振串联谐振频率
 *
 * fs = 1 / (2π × √(Lm × Cm))
 *
 * @param params 晶振参数
 * @returns 串联谐振频率 (Hz)
 */
export function crystalSeriesResonantFreq(params: CrystalParams = DEFAULT_CRYSTAL_PARAMS): number {
  return 1 / (2 * Math.PI * Math.sqrt(params.motionalInductance * params.motionalCapacitance));
}

/**
 * 晶振并联谐振频率
 *
 * fp = fs × √(1 + Cm / C0)
 *
 * @param params 晶振参数
 * @returns 并联谐振频率 (Hz)
 */
export function crystalParallelResonantFreq(params: CrystalParams = DEFAULT_CRYSTAL_PARAMS): number {
  const fs = crystalSeriesResonantFreq(params);
  return fs * Math.sqrt(1 + params.motionalCapacitance / params.parallelCapacitance);
}

/**
 * 频率拉偏量（由于负载电容变化）
 *
 * Δf/f ≈ (Cm / 2) × (1/(C0 + CL) - 1/(C0 + CL_nom))
 *
 * @param actualLoadCap 实际负载电容 (pF)
 * @param params 晶振参数
 * @returns 频率偏差 (ppm)
 */
export function crystalFrequencyPull(
  actualLoadCap: number,
  params: CrystalParams = DEFAULT_CRYSTAL_PARAMS
): number {
  const CL = actualLoadCap * 1e-12;
  const CLnom = params.loadCapacitance * 1e-12;
  const C0 = params.parallelCapacitance;
  const Cm = params.motionalCapacitance;
  const pull = (Cm / 2) * (1 / (C0 + CL) - 1 / (C0 + CLnom));
  return pull * 1e6; // 转换为 ppm
}

/**
 * Pierce 振荡电路推荐匹配电容
 *
 * CL1 = CL2 = 2 × CL - Cstray
 *
 * @param loadCapacitance 负载电容 (pF)
 * @param strayCapacitance PCB 杂散电容 (pF), 典型 3~5pF
 * @returns 匹配电容值 (pF)
 */
export function crystalMatchingCapacitors(
  loadCapacitance: number = 20,
  strayCapacitance: number = 5
): number {
  return 2 * loadCapacitance - strayCapacitance;
}

/**
 * 晶振启动时间估算
 *
 * τ_start ≈ Q / (2π × fs × gm × R)
 *
 * @param transconductance 跨导 (mA/V)
 * @param feedbackResistor 反馈电阻 (Ω)
 * @param params 晶振参数
 * @returns 估算启动时间 (ms)
 */
export function crystalStartupTime(
  transconductance: number = 10,
  feedbackResistor: number = 1e6,
  params: CrystalParams = DEFAULT_CRYSTAL_PARAMS
): number {
  const gm = transconductance / 1000; // mA/V → A/V
  const fs = crystalSeriesResonantFreq(params);
  const tau = params.qualityFactor / (2 * Math.PI * fs * gm * feedbackResistor);
  return tau * 1000; // s → ms
}

// ==================== 端口定义 ====================

/** 晶振端口：两个引脚（XTAL1, XTAL2） */
export const CRYSTAL_PORTS: ComponentPort[] = [
  { id: 'xtal1', offset: { x: -30, y: 0 } },
  { id: 'xtal2', offset: { x: 30, y: 0 } },
];

// ==================== 扩展振荡器（陶瓷谐振器、硅振荡器、TCXO、VCXO） ====================

export type { CeramicResonatorParams, SiliconOscillatorParams, TCXOParams, VCXOParams } from './oscillator-extended';
export {
  CERAMIC_RESONATOR_MODELS,
  DEFAULT_CERAMIC_RESONATOR,
  ceramicResonatorStartupTime,
  SILICON_OSC_MODELS,
  TCXO_MODELS,
  VCXO_MODELS,
  vcxoFrequency,
} from './oscillator-extended';
