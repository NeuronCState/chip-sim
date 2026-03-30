/**
 * LED（发光二极管）元件模型
 *
 * 正向压降典型值 1.8V~3.2V（取决于颜色）
 * 正向电流驱动亮度，带限流电阻计算
 */

import type { ComponentPort } from '../../../types/circuit';

// ==================== 类型定义 ====================

/** LED 颜色类型 */
export type LEDColor = 'red' | 'green' | 'blue' | 'yellow' | 'white' | 'orange' | 'uv' | 'ir';

/** LED 参数 */
export interface LEDParams {
  /** LED 颜色 */
  color: LEDColor;
  /** 正向压降 (V) */
  forwardVoltage: number;
  /** 最大正向电流 (mA) */
  maxForwardCurrent: number;
  /** 典型工作电流 (mA) */
  typicalCurrent: number;
  /** 最大反向电压 (V) */
  maxReverseVoltage: number;
  /** 峰值波长 (nm) */
  peakWavelength: number;
  /** 光通量 (mcd) @ 典型电流 */
  luminousIntensity: number;
  /** 响应时间 (ns) */
  responseTime: number;
  /** 视角 (°) */
  viewingAngle: number;
}

// ==================== 默认参数 ====================

/** 常见 LED 型号参数表 */
export const LED_MODELS: Record<string, LEDParams> = {
  /** 红色 LED */
  LED_RED: {
    color: 'red',
    forwardVoltage: 1.8,
    maxForwardCurrent: 20,
    typicalCurrent: 10,
    maxReverseVoltage: 5,
    peakWavelength: 625,
    luminousIntensity: 20,
    responseTime: 100,
    viewingAngle: 30,
  },
  /** 绿色 LED */
  LED_GREEN: {
    color: 'green',
    forwardVoltage: 2.1,
    maxForwardCurrent: 20,
    typicalCurrent: 10,
    maxReverseVoltage: 5,
    peakWavelength: 525,
    luminousIntensity: 30,
    responseTime: 100,
    viewingAngle: 30,
  },
  /** 蓝色 LED */
  LED_BLUE: {
    color: 'blue',
    forwardVoltage: 3.2,
    maxForwardCurrent: 20,
    typicalCurrent: 10,
    maxReverseVoltage: 5,
    peakWavelength: 470,
    luminousIntensity: 80,
    responseTime: 100,
    viewingAngle: 30,
  },
  /** 黄色 LED */
  LED_YELLOW: {
    color: 'yellow',
    forwardVoltage: 2.0,
    maxForwardCurrent: 20,
    typicalCurrent: 10,
    maxReverseVoltage: 5,
    peakWavelength: 590,
    luminousIntensity: 25,
    responseTime: 100,
    viewingAngle: 30,
  },
  /** 白色 LED */
  LED_WHITE: {
    color: 'white',
    forwardVoltage: 3.0,
    maxForwardCurrent: 20,
    typicalCurrent: 10,
    maxReverseVoltage: 5,
    peakWavelength: 550,
    luminousIntensity: 100,
    responseTime: 100,
    viewingAngle: 120,
  },
};

/** 默认 LED 参数（红色） */
export const DEFAULT_LED_PARAMS: LEDParams = LED_MODELS.LED_RED;

// ==================== LED 行为模型 ====================

/**
 * LED 正向电流计算
 *
 * 简化线性模型：I = (V_supply - V_f) / R_limit
 *
 * @param supplyVoltage 电源电压 (V)
 * @param currentLimitingResistor 限流电阻 (Ω)
 * @param params LED 参数
 * @returns 正向电流 (mA)
 */
export function ledForwardCurrent(
  supplyVoltage: number,
  currentLimitingResistor: number,
  params: LEDParams = DEFAULT_LED_PARAMS
): number {
  if (currentLimitingResistor <= 0) return params.maxForwardCurrent;
  const I = (supplyVoltage - params.forwardVoltage) / currentLimitingResistor * 1000;
  return Math.max(0, Math.min(I, params.maxForwardCurrent));
}

/**
 * LED 亮度模型（正比于正向电流）
 *
 * @param forwardCurrent 正向电流 (mA)
 * @param params LED 参数
 * @returns 相对亮度 (0-1)
 */
export function ledBrightness(
  forwardCurrent: number,
  params: LEDParams = DEFAULT_LED_PARAMS
): number {
  if (forwardCurrent <= 0) return 0;
  return Math.min(forwardCurrent / params.typicalCurrent, 1.0);
}

/**
 * LED 限流电阻计算
 *
 * R = (Vcc - Vf) / If
 *
 * @param supplyVoltage 电源电压 (V)
 * @param desiredCurrent 期望正向电流 (mA)
 * @param params LED 参数
 * @returns 限流电阻值 (Ω)
 */
export function ledCurrentLimitingResistor(
  supplyVoltage: number,
  desiredCurrent: number = 10,
  params: LEDParams = DEFAULT_LED_PARAMS
): number {
  const I = desiredCurrent / 1000; // mA → A
  if (I <= 0) return Infinity;
  return Math.max(0, (supplyVoltage - params.forwardVoltage) / I);
}

/**
 * LED 功耗计算
 *
 * P = Vf × If
 *
 * @param forwardCurrent 正向电流 (mA)
 * @param params LED 参数
 * @returns 功耗 (mW)
 */
export function ledPowerDissipation(
  forwardCurrent: number,
  params: LEDParams = DEFAULT_LED_PARAMS
): number {
  return params.forwardVoltage * forwardCurrent;
}

/**
 * LED 寿命估算（基于结温）
 *
 * 简化模型：L70 = L70_ref × 2^((Tj_ref - Tj) / 10)
 *
 * @param junctionTemp 结温 (°C)
 * @param referenceTemp 参考结温 (°C), 默认 85°C
 * @param referenceLife 参考寿命 (h), 默认 50000h
 * @returns 估算寿命 (h)
 */
export function ledLifetime(
  junctionTemp: number,
  referenceTemp: number = 85,
  referenceLife: number = 50000
): number {
  const deltaT = referenceTemp - junctionTemp;
  return referenceLife * Math.pow(2, deltaT / 10);
}

// ==================== 端口定义 ====================

/** LED 端口布局：阳极(A)、阴极(K) */
export const LED_PORTS: ComponentPort[] = [
  { id: 'anode', offset: { x: -30, y: 0 } },
  { id: 'cathode', offset: { x: 30, y: 0 } },
];
