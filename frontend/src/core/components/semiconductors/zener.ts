/**
 * 齐纳二极管（Zener Diode）元件模型
 *
 * 利用反向击穿特性实现稳压功能
 * 常见型号：3.3V, 5.1V, 12V 等
 */

import type { ComponentPort } from '../../../types/circuit';

// ==================== 类型定义 ====================

/** 齐纳二极管参数 */
export interface ZenerDiodeParams {
  /** 齐纳电压 (V) @ Izt */
  zenerVoltage: number;
  /** 测试电流 Izt (mA) */
  testCurrent: number;
  /** 动态阻抗 Zz (Ω) @ Izt */
  dynamicImpedance: number;
  /** 最大功耗 (mW) */
  maxPower: number;
  /** 反向漏电流 (μA) @ Vr */
  reverseLeakage: number;
  /** 反向测试电压 Vr (V) */
  reverseTestVoltage: number;
  /** 正向压降 (V) @ If */
  forwardVoltage: number;
  /** 温度系数 (mV/°C) */
  tempCoeff: number;
  /** 最大齐纳电流 (mA) */
  maxZenerCurrent: number;
}

// ==================== 默认参数 ====================

/** 常见齐纳二极管型号参数表 */
export const ZENER_MODELS: Record<string, ZenerDiodeParams> = {
  /** 3.3V 齐纳 */
  'BZX55C3V3': {
    zenerVoltage: 3.3,
    testCurrent: 5,
    dynamicImpedance: 28,
    maxPower: 500,
    reverseLeakage: 5,
    reverseTestVoltage: 1,
    forwardVoltage: 0.9,
    tempCoeff: -1.5,
    maxZenerCurrent: 115,
  },
  /** 5.1V 齐纳 */
  'BZX55C5V1': {
    zenerVoltage: 5.1,
    testCurrent: 5,
    dynamicImpedance: 17,
    maxPower: 500,
    reverseLeakage: 1,
    reverseTestVoltage: 2,
    forwardVoltage: 0.9,
    tempCoeff: 1.0,
    maxZenerCurrent: 80,
  },
  /** 12V 齐纳 */
  'BZX55C12': {
    zenerVoltage: 12,
    testCurrent: 5,
    dynamicImpedance: 12,
    maxPower: 500,
    reverseLeakage: 0.1,
    reverseTestVoltage: 9.1,
    forwardVoltage: 0.9,
    tempCoeff: 6.0,
    maxZenerCurrent: 33,
  },
  /** 5.6V 齐纳 */
  '1N4734': {
    zenerVoltage: 5.6,
    testCurrent: 45,
    dynamicImpedance: 4,
    maxPower: 1000,
    reverseLeakage: 10,
    reverseTestVoltage: 2,
    forwardVoltage: 1.2,
    tempCoeff: 2.0,
    maxZenerCurrent: 162,
  },
  /** 3.3V 低噪声齐纳 */
  'LM385BZ-3.3': {
    zenerVoltage: 3.3,
    testCurrent: 0.1,
    dynamicImpedance: 0.6,
    maxPower: 500,
    reverseLeakage: 0.01,
    reverseTestVoltage: 1,
    forwardVoltage: 0.7,
    tempCoeff: 20,
    maxZenerCurrent: 30,
  },
};

/** 默认齐纳参数 */
export const DEFAULT_ZENER_PARAMS: ZenerDiodeParams = ZENER_MODELS['BZX55C5V1'];

// ==================== 齐纳行为模型 ====================

/**
 * 齐纳二极管 I-V 特性
 *
 * 正向偏置：I ≈ Is × (exp(V/Vt) - 1)（同普通二极管）
 * 反向击穿区：Vz = Vz0 + Iz × Zz
 *
 * @param voltage 二极管两端电压 (V)
 * @param params 齐纳参数
 * @returns 电流 (mA)
 */
export function zenerCurrent(
  voltage: number,
  params: ZenerDiodeParams = DEFAULT_ZENER_PARAMS
): number {
  // 正向偏置
  if (voltage >= 0) {
    if (voltage > params.forwardVoltage) {
      return (voltage - params.forwardVoltage) * 100; // 简化模型
    }
    return 0;
  }
  // 反向偏置
  const vAbs = Math.abs(voltage);
  // 未击穿
  if (vAbs < params.zenerVoltage) {
    return -params.reverseLeakage / 1000; // μA → mA
  }
  // 击穿区：电流随电压增大
  const excessV = vAbs - params.zenerVoltage;
  const iz = (excessV / params.dynamicImpedance) * 1000 + params.testCurrent;
  return -Math.min(iz, params.maxZenerCurrent);
}

/**
 * 齐纳稳压输出计算
 *
 * Vout = Vz0 + Iz × Zz
 *
 * @param inputVoltage 输入电压 (V)
 * @param loadResistance 负载电阻 (Ω)
 * @param params 齐纳参数
 * @returns 输出电压 (V)
 */
export function zenerRegulatedVoltage(
  inputVoltage: number,
  loadResistance: number,
  params: ZenerDiodeParams = DEFAULT_ZENER_PARAMS
): number {
  // 求解：Vout = Vz + (Vin - Vout) / (R + Zz) × Zz
  // 简化：如果 Vin > Vz，输出接近 Vz
  if (inputVoltage <= params.zenerVoltage) {
    return inputVoltage;
  }
  const totalR = loadResistance + params.dynamicImpedance;
  const iz = (inputVoltage - params.zenerVoltage) / totalR * 1000; // mA
  if (iz < params.reverseLeakage / 1000) {
    return inputVoltage;
  }
  return params.zenerVoltage + Math.min(iz, params.maxZenerCurrent) * params.dynamicImpedance / 1000;
}

/**
 * 齐纳限流电阻计算
 *
 * R = (Vin - Vz) / Iz
 *
 * @param inputVoltage 输入电压 (V)
 * @param zenerVoltage 齐纳电压 (V)
 * @param zenerCurrent 期望齐纳电流 (mA)
 * @returns 限流电阻 (Ω)
 */
export function zenerSeriesResistor(
  inputVoltage: number,
  zenerVoltage: number,
  zenerCurrent: number = 10
): number {
  const I = zenerCurrent / 1000; // mA → A
  if (I <= 0) return Infinity;
  return Math.max(0, (inputVoltage - zenerVoltage) / I);
}

/**
 * 齐纳功耗
 *
 * P = Vz × Iz
 *
 * @param zenerCurrent 齐纳电流 (mA)
 * @param params 齐纳参数
 * @returns 功耗 (mW)
 */
export function zenerPowerDissipation(
  zenerCurrent: number,
  params: ZenerDiodeParams = DEFAULT_ZENER_PARAMS
): number {
  return params.zenerVoltage * Math.abs(zenerCurrent);
}

/**
 * 检查齐纳是否过载
 *
 * @param zenerCurrent 齐纳电流 (mA)
 * @param params 齐纳参数
 * @returns 是否过载
 */
export function zenerOverloaded(
  zenerCurrent: number,
  params: ZenerDiodeParams = DEFAULT_ZENER_PARAMS
): boolean {
  const power = zenerPowerDissipation(zenerCurrent, params);
  return power > params.maxPower;
}

// ==================== 端口定义 ====================

/** 齐纳二极管端口：阳极(A)、阴极(K) */
export const ZENER_PORTS: ComponentPort[] = [
  { id: 'anode', offset: { x: -30, y: 0 } },
  { id: 'cathode', offset: { x: 30, y: 0 } },
];
