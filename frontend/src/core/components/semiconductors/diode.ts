/**
 * 二极管元件模型
 *
 * 包含肖特基二极管、齐纳二极管、LED 等常见型号
 * 基于 Shockley 方程的 I-V 特性曲线模型
 */

import type { ComponentPort } from '../../../types/circuit';

// ==================== 类型定义 ====================

/** 二极管参数 */
export interface DiodeParams {
  /** 正向压降 (V) @ 额定电流 */
  forwardVoltage: number;
  /** 反向饱和电流 (A)，典型值 1e-12 ~ 1e-6 */
  saturationCurrent: number;
  /** 发射系数 n（理想因子），典型 1.0 ~ 2.0 */
  emissionCoeff: number;
  /** 热电压 Vt = kT/q (V)，室温约 26mV */
  thermalVoltage: number;
  /** 最大正向电流 (A) */
  maxForwardCurrent: number;
  /** 反向击穿电压 (V)，齐纳二极管有效 */
  breakdownVoltage: number;
  /** 结电容 (F) @ 0V 偏置 */
  junctionCapacitance: number;
  /** 寄生串联电阻 (Ω) */
  seriesResistance: number;
  /** 二极管子类型 */
  diodeType: 'standard' | 'schottky' | 'zener' | 'led_red' | 'led_green' | 'led_blue' | 'led_white';
}

// ==================== 默认参数 ====================

/** 常见二极管型号参数表 */
export const DIODE_MODELS: Record<string, DiodeParams> = {
  /** 1N4148 通用小信号二极管 */
  '1N4148': {
    forwardVoltage: 0.72,
    saturationCurrent: 2.52e-9,
    emissionCoeff: 1.902,
    thermalVoltage: 0.02585,
    maxForwardCurrent: 0.3,
    breakdownVoltage: 100,
    junctionCapacitance: 4e-12,
    seriesResistance: 0.558,
    diodeType: 'standard',
  },
  /** 1N4007 整流二极管 */
  '1N4007': {
    forwardVoltage: 0.76,
    saturationCurrent: 7.03e-9,
    emissionCoeff: 1.836,
    thermalVoltage: 0.02585,
    maxForwardCurrent: 1.0,
    breakdownVoltage: 1000,
    junctionCapacitance: 18e-12,
    seriesResistance: 0.034,
    diodeType: 'standard',
  },
  /** 1N5819 肖特基二极管 */
  '1N5819': {
    forwardVoltage: 0.35,
    saturationCurrent: 6.0e-6,
    emissionCoeff: 1.1,
    thermalVoltage: 0.02585,
    maxForwardCurrent: 1.0,
    breakdownVoltage: 40,
    junctionCapacitance: 120e-12,
    seriesResistance: 0.2,
    diodeType: 'schottky',
  },
  /** 3.3V 齐纳二极管 */
  'BZX55C3V3': {
    forwardVoltage: 0.7,
    saturationCurrent: 1.0e-9,
    emissionCoeff: 1.5,
    thermalVoltage: 0.02585,
    maxForwardCurrent: 0.2,
    breakdownVoltage: 3.3,
    junctionCapacitance: 400e-12,
    seriesResistance: 20,
    diodeType: 'zener',
  },
  /** 红色 LED */
  'LED_RED': {
    forwardVoltage: 1.8,
    saturationCurrent: 1.0e-20,
    emissionCoeff: 2.0,
    thermalVoltage: 0.02585,
    maxForwardCurrent: 0.02,
    breakdownVoltage: 5,
    junctionCapacitance: 15e-12,
    seriesResistance: 5,
    diodeType: 'led_red',
  },
  /** 绿色 LED */
  'LED_GREEN': {
    forwardVoltage: 2.1,
    saturationCurrent: 1.0e-20,
    emissionCoeff: 2.0,
    thermalVoltage: 0.02585,
    maxForwardCurrent: 0.02,
    breakdownVoltage: 5,
    junctionCapacitance: 15e-12,
    seriesResistance: 5,
    diodeType: 'led_green',
  },
  /** 蓝色 LED */
  'LED_BLUE': {
    forwardVoltage: 3.2,
    saturationCurrent: 1.0e-20,
    emissionCoeff: 2.0,
    thermalVoltage: 0.02585,
    maxForwardCurrent: 0.02,
    breakdownVoltage: 5,
    junctionCapacitance: 15e-12,
    seriesResistance: 5,
    diodeType: 'led_blue',
  },
};

/** 默认二极管参数（1N4148） */
export const DEFAULT_DIODE_PARAMS: DiodeParams = DIODE_MODELS['1N4148'];

// ==================== Shockley 方程 ====================

/**
 * Shockley 二极管方程：正向偏置电流
 *
 * I = Is × (exp(Vd / (n × Vt)) - 1)
 *
 * 其中：
 * - Is：反向饱和电流 (A)
 * - Vd：二极管两端电压 (V)
 * - n：发射系数（理想因子）
 * - Vt：热电压 = kT/q ≈ 26mV @ 25°C
 *
 * @param voltage 二极管两端电压 (V)
 * @param params 二极管参数
 * @returns 正向电流 (A)
 */
export function diodeForwardCurrent(voltage: number, params: DiodeParams = DEFAULT_DIODE_PARAMS): number {
  const { saturationCurrent: Is, emissionCoeff: n, thermalVoltage: Vt, seriesResistance: _Rs } = params;
  // 考虑串联电阻：Vd_actual = V - I×Rs，用迭代求解
  // 简化：直接用给定电压计算（忽略串联电阻的一阶效应）
  const exponent = voltage / (n * Vt);
  // 限制指数防止溢出
  const clampedExp = Math.min(exponent, 40);
  const Id = Is * (Math.exp(clampedExp) - 1);
  // 限制最大电流
  return Math.min(Id, params.maxForwardCurrent);
}

/**
 * 根据电流求二极管正向电压（逆向求解 Shockley 方程）
 *
 * V = n × Vt × ln(I/Is + 1) + I × Rs
 *
 * @param current 正向电流 (A)
 * @param params 二极管参数
 * @returns 二极管两端电压 (V)
 */
export function diodeVoltageFromCurrent(current: number, params: DiodeParams = DEFAULT_DIODE_PARAMS): number {
  const { saturationCurrent: Is, emissionCoeff: n, thermalVoltage: Vt, seriesResistance: Rs } = params;
  if (current <= 0) return 0;
  const Vd = n * Vt * Math.log(current / Is + 1) + current * Rs;
  return Vd;
}

/**
 * 反向偏置漏电流
 *
 * Ir ≈ -Is (忽略击穿前的反向电流近似为 -Is)
 *
 * @param reverseVoltage 反向电压 (V)，取绝对值
 * @param params 二极管参数
 * @returns 反向电流 (A)，为负值
 */
export function diodeReverseCurrent(reverseVoltage: number, params: DiodeParams = DEFAULT_DIODE_PARAMS): number {
  if (reverseVoltage <= 0) return 0;
  // 击穿区域
  if (reverseVoltage >= params.breakdownVoltage) {
    // 击穿后电流急剧增大
    const excessV = reverseVoltage - params.breakdownVoltage;
    return -params.saturationCurrent * (1 + 100 * excessV);
  }
  return -params.saturationCurrent;
}

/**
 * 生成二极管 I-V 特性曲线数据
 *
 * @param voltageMin 最低电压 (V)
 * @param voltageMax 最高电压 (V)
 * @param points 采样点数
 * @param params 二极管参数
 * @returns { voltage: number, current: number }[]
 */
export function generateDiodeIVCurve(
  voltageMin: number = -5,
  voltageMax: number = 1,
  points: number = 100,
  params: DiodeParams = DEFAULT_DIODE_PARAMS
): { voltage: number; current: number }[] {
  const data: { voltage: number; current: number }[] = [];
  const step = (voltageMax - voltageMin) / (points - 1);
  for (let i = 0; i < points; i++) {
    const V = voltageMin + i * step;
    let I: number;
    if (V >= 0) {
      I = diodeForwardCurrent(V, params);
    } else {
      I = diodeReverseCurrent(-V, params);
    }
    data.push({ voltage: Math.round(V * 1000) / 1000, current: Math.round(I * 1e6) / 1e6 });
  }
  return data;
}

/**
 * 结电容计算（用于瞬态分析）
 *
 * Cj = Cj0 / (1 - Vd/φ)^M    （Vd < 0 或 Vd < φ）
 *
 * @param voltage 二极管两端电压 (V)
 * @param params 二极管参数
 * @returns 结电容 (F)
 */
export function diodeJunctionCapacitance(voltage: number, params: DiodeParams = DEFAULT_DIODE_PARAMS): number {
  const phi = 0.7; // 内建电势 (V)
  const m = 0.5;   // 梯度系数
  if (voltage >= phi) {
    return params.junctionCapacitance * 10; // 正向偏置时电容增大
  }
  return params.junctionCapacitance / Math.pow(1 - voltage / phi, m);
}

// ==================== LED 模型 ====================

/**
 * LED 亮度模型（正比于正向电流）
 *
 * @param forwardCurrent 正向电流 (A)
 * @param maxCurrent 最大额定电流 (A)
 * @returns 相对亮度 (0-1)
 */
export function ledBrightness(forwardCurrent: number, maxCurrent: number = 0.02): number {
  if (forwardCurrent <= 0) return 0;
  return Math.min(forwardCurrent / maxCurrent, 1.0);
}

/**
 * LED 限流电阻计算
 *
 * R = (Vcc - Vf) / If
 *
 * @param supplyVoltage 电源电压 (V)
 * @param forwardCurrent 期望正向电流 (A)
 * @param params LED 参数
 * @returns 限流电阻值 (Ω)
 */
export function ledCurrentLimitingResistor(
  supplyVoltage: number,
  forwardCurrent: number = 0.01,
  params: DiodeParams = DIODE_MODELS['LED_RED']
): number {
  const Vf = params.forwardVoltage;
  return Math.max(0, (supplyVoltage - Vf) / forwardCurrent);
}

// ==================== 端口定义 ====================

/** 二极管端口布局：阳极(A)、阴极(K) */
export const DIODE_PORTS: ComponentPort[] = [
  { id: 'anode', offset: { x: -30, y: 0 } },
  { id: 'cathode', offset: { x: 30, y: 0 } },
];
