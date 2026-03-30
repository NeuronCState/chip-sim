/**
 * PTC 热敏电阻（正温度系数热敏电阻）元件模型
 *
 * 电阻随温度升高而增大，常用于过流保护、温度传感
 * 常见型号：PTC 100, PTC 1000（用于工业测温）
 */

import type { ComponentPort } from '../../../types/circuit';

// ==================== 类型定义 ====================

/** PTC 热敏电阻参数 */
export interface PTCThermistorParams {
  /** 标称电阻值 (Ω) @ 25°C */
  nominalResistance: number;
  /** 标称温度 (°C) */
  nominalTemp: number;
  /** 工作温度下限 (°C) */
  tempMin: number;
  /** 工作温度上限 (°C) */
  tempMax: number;
  /** B 值 (K)，线性近似斜率 */
  bValue: number;
  /** 温度系数 (ppm/°C) */
  tempCoeff: number;
  /** 最大功率 (mW) */
  maxPower: number;
  /** 最大电压 (V) */
  maxVoltage: number;
  /** 热时间常数 (s) */
  thermalTimeConstant: number;
  /** 精度 (%) */
  tolerance: number;
}

// ==================== 默认参数 ====================

/** 常见 PTC 热敏电阻型号参数 */
export const PTC_THERMISTOR_MODELS: Record<string, PTCThermistorParams> = {
  /** PTC 100Ω 工业测温 */
  'PTC100': {
    nominalResistance: 100,
    nominalTemp: 25,
    tempMin: -50,
    tempMax: 300,
    bValue: 3000,
    tempCoeff: 3850,
    maxPower: 200,
    maxVoltage: 30,
    thermalTimeConstant: 10,
    tolerance: 0.1,
  },
  /** PTC 1000Ω 工业测温（高阻值，抗干扰） */
  'PTC1000': {
    nominalResistance: 1000,
    nominalTemp: 25,
    tempMin: -50,
    tempMax: 300,
    bValue: 3000,
    tempCoeff: 3850,
    maxPower: 200,
    maxVoltage: 30,
    thermalTimeConstant: 10,
    tolerance: 0.1,
  },
  /** PTC 热敏电阻 10kΩ（NTC 型号但正温度系数材料） */
  'PTC10K': {
    nominalResistance: 10000,
    nominalTemp: 25,
    tempMin: -40,
    tempMax: 125,
    bValue: 4500,
    tempCoeff: 5000,
    maxPower: 100,
    maxVoltage: 30,
    thermalTimeConstant: 15,
    tolerance: 1,
  },
  /** PTC 启动器（压缩机启动用） */
  'PTC_STARTER': {
    nominalResistance: 22,
    nominalTemp: 25,
    tempMin: -20,
    tempMax: 120,
    bValue: 4200,
    tempCoeff: 8000,
    maxPower: 500,
    maxVoltage: 350,
    thermalTimeConstant: 1,
    tolerance: 20,
  },
  /** PTC 保护元件 KTY81-210 */
  'KTY81_210': {
    nominalResistance: 2000,
    nominalTemp: 25,
    tempMin: -55,
    tempMax: 150,
    bValue: 5200,
    tempCoeff: 7800,
    maxPower: 100,
    maxVoltage: 10,
    thermalTimeConstant: 12,
    tolerance: 1,
  },
};

/** 默认 PTC 热敏电阻参数 */
export const DEFAULT_PTC_PARAMS: PTCThermistorParams = PTC_THERMISTOR_MODELS['PTC1000'];

// ==================== PTC 热敏电阻行为模型 ====================

/**
 * PTC 热敏电阻：温度 → 电阻值
 *
 * 线性模型：R(T) = R0 × (1 + α × (T - T0))
 *
 * @param tempC 温度 (°C)
 * @param params PTC 参数
 * @returns 电阻值 (Ω)
 */
export function ptcResistance(tempC: number, params: PTCThermistorParams = DEFAULT_PTC_PARAMS): number {
  // 线性 PTC 模型（适用于工业测温型 PTC）
  if (params.bValue > 0) {
    // PTC：温度升高电阻增大
    const alpha = params.tempCoeff / 1e6;
    return params.nominalResistance * (1 + alpha * (tempC - params.nominalTemp));
  }
  return params.nominalResistance;
}

/**
 * PTC 热敏电阻：电阻值 → 温度（逆向）
 *
 * @param resistance 电阻值 (Ω)
 * @param params PTC 参数
 * @returns 温度 (°C)
 */
export function ptcResistanceToTemp(resistance: number, params: PTCThermistorParams = DEFAULT_PTC_PARAMS): number {
  const alpha = params.tempCoeff / 1e6;
  return params.nominalTemp + (resistance / params.nominalResistance - 1) / alpha;
}

/**
 * PTC 温度系数（dR/dT）
 *
 * @param params PTC 参数
 * @returns 温度系数 (Ω/°C)
 */
export function ptcTempCoefficient(params: PTCThermistorParams = DEFAULT_PTC_PARAMS): number {
  return params.nominalResistance * params.tempCoeff / 1e6;
}

/**
 * PTC 过流保护：自恢复保险丝模型
 *
 * PTC 元件在电流过大时发热，电阻急剧增大，限制电流
 *
 * @param current 工作电流 (mA)
 * @param params PTC 参数
 * @returns { tripped: boolean, resistance: number }
 */
export function ptcOvercurrentProtection(
  current: number,
  params: PTCThermistorParams = DEFAULT_PTC_PARAMS
): { tripped: boolean; resistance: number } {
  const i = current / 1000; // mA → A
  if (i * i * params.nominalResistance > params.maxPower / 1000) {
    // 触发保护，电阻急剧增大 10-100 倍
    return { tripped: true, resistance: params.nominalResistance * 50 };
  }
  return { tripped: false, resistance: params.nominalResistance };
}

/**
 * 生成 PTC 温度-电阻特性曲线
 *
 * @param tempMin 最低温度 (°C)
 * @param tempMax 最高温度 (°C)
 * @param points 采样点数
 * @param params PTC 参数
 * @returns {temp: number, resistance: number}[]
 */
export function generatePTCCurve(
  tempMin: number = -40,
  tempMax: number = 125,
  points: number = 50,
  params: PTCThermistorParams = DEFAULT_PTC_PARAMS
): { temp: number; resistance: number }[] {
  const data: { temp: number; resistance: number }[] = [];
  const step = (tempMax - tempMin) / (points - 1);
  for (let i = 0; i < points; i++) {
    const temp = tempMin + i * step;
    const resistance = ptcResistance(temp, params);
    data.push({ temp: Math.round(temp * 10) / 10, resistance: Math.round(resistance * 100) / 100 });
  }
  return data;
}

// ==================== 端口定义 ====================

/** PTC 热敏电阻端口：两端对称 */
export const PTC_THERMISTOR_PORTS: ComponentPort[] = [
  { id: 'terminal_1', offset: { x: -30, y: 0 } },
  { id: 'terminal_2', offset: { x: 30, y: 0 } },
];
