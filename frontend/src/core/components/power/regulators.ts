/**
 * 线性稳压器模型
 *
 * 三端固定稳压器（LM78xx 系列）和可调稳压器（LM317）
 * 包含输出电压计算、效率分析、热关断保护等功能
 */

import type { ComponentPort } from '../../../types/circuit';

// ==================== 类型定义 ====================

/** 稳压器类型 */
export type RegulatorType = 'fixed' | 'adjustable';

/** 线性稳压器参数 */
export interface LinearRegulatorParams {
  /** 稳压器类型 */
  type: RegulatorType;
  /** 标称输出电压 (V)，可调型为内部基准电压 */
  outputVoltage: number;
  /** 输入电压范围 */
  inputRange: { min: number; max: number };
  /** 压差电压 (V) @ 额定电流 */
  dropoutVoltage: number;
  /** 最大输出电流 (A) */
  maxOutputCurrent: number;
  /** 静态电流 (mA) */
  quiescentCurrent: number;
  /** 线性调整率 (%/V) */
  lineRegulation: number;
  /** 负载调整率 (%/A) */
  loadRegulation: number;
  /** 纹波抑制比 PSRR @ 120Hz (dB) */
  rippleRejection: number;
  /** 输出噪声电压 (μVrms) */
  outputNoise: number;
  /** 热关断温度 (°C) */
  thermalShutdownTemp: number;
  /** 热阻 (°C/W)，结到环境 */
  thermalResistance: number;
  /** 最大功耗 (W)，带散热器 */
  maxPowerDissipation: number;
  /** 输出电容要求 (μF) */
  minOutputCapacitance: number;
  /** 型号名称 */
  modelName: string;
}

/** 稳压器工作状态 */
export interface RegulatorStatus {
  /** 输出电压是否正常 */
  outputOk: boolean;
  /** 实际输出电压 (V) */
  actualOutput: number;
  /** 输入是否在范围内 */
  inputOk: boolean;
  /** 是否触发热关断 */
  thermalShutdown: boolean;
  /** 结温估算 (°C) */
  junctionTemp: number;
  /** 功耗 (W) */
  powerDissipation: number;
  /** 效率 (%) */
  efficiency: number;
}

// ==================== 默认参数 ====================

/** 常见线性稳压器型号参数 */
export const LINEAR_REGULATOR_MODELS: Record<string, LinearRegulatorParams> = {
  /** LM7805 - 5V 固定输出三端稳压器 */
  LM7805: {
    type: 'fixed',
    outputVoltage: 5.0,
    inputRange: { min: 7.0, max: 35.0 },
    dropoutVoltage: 2.0,
    maxOutputCurrent: 1.5,
    quiescentCurrent: 8,
    lineRegulation: 0.05,
    loadRegulation: 0.3,
    rippleRejection: 62,
    outputNoise: 40,
    thermalShutdownTemp: 150,
    thermalResistance: 50, // TO-220 无散热器
    maxPowerDissipation: 15, // 带散热器
    minOutputCapacitance: 0.33,
    modelName: 'LM7805',
  },
  /** LM7812 - 12V 固定输出三端稳压器 */
  LM7812: {
    type: 'fixed',
    outputVoltage: 12.0,
    inputRange: { min: 14.5, max: 35.0 },
    dropoutVoltage: 2.0,
    maxOutputCurrent: 1.5,
    quiescentCurrent: 8,
    lineRegulation: 0.05,
    loadRegulation: 0.3,
    rippleRejection: 60,
    outputNoise: 40,
    thermalShutdownTemp: 150,
    thermalResistance: 50,
    maxPowerDissipation: 15,
    minOutputCapacitance: 0.33,
    modelName: 'LM7812',
  },
  /** LM7833 - 3.3V 固定输出三端稳压器 */
  LM7833: {
    type: 'fixed',
    outputVoltage: 3.3,
    inputRange: { min: 5.5, max: 24.0 },
    dropoutVoltage: 2.0,
    maxOutputCurrent: 1.0,
    quiescentCurrent: 8,
    lineRegulation: 0.05,
    loadRegulation: 0.3,
    rippleRejection: 62,
    outputNoise: 40,
    thermalShutdownTemp: 150,
    thermalResistance: 50,
    maxPowerDissipation: 15,
    minOutputCapacitance: 0.33,
    modelName: 'LM7833',
  },
  /** LM317 - 可调输出三端稳压器 */
  LM317: {
    type: 'adjustable',
    outputVoltage: 1.25, // 内部基准电压
    inputRange: { min: 4.25, max: 40.0 },
    dropoutVoltage: 2.0,
    maxOutputCurrent: 1.5,
    quiescentCurrent: 5,
    lineRegulation: 0.01,
    loadRegulation: 0.1,
    rippleRejection: 65,
    outputNoise: 30,
    thermalShutdownTemp: 150,
    thermalResistance: 50,
    maxPowerDissipation: 20,
    minOutputCapacitance: 1.0,
    modelName: 'LM317',
  },
};

/** 默认稳压器参数（LM7805） */
export const DEFAULT_LINEAR_REGULATOR_PARAMS: LinearRegulatorParams = LINEAR_REGULATOR_MODELS['LM7805'];

// ==================== 线性稳压器计算函数 ====================

/**
 * 固定稳压器输出电压计算
 *
 * 考虑输入电压不足、线性调整和负载调整的情况
 *
 * @param inputVoltage 输入电压 (V)
 * @param loadCurrent 负载电流 (A)
 * @param params 稳压器参数
 * @returns 实际输出电压 (V)
 */
export function regulatorOutputVoltage(
  inputVoltage: number,
  loadCurrent: number,
  params: LinearRegulatorParams = DEFAULT_LINEAR_REGULATOR_PARAMS
): number {
  const requiredInput = params.outputVoltage + params.dropoutVoltage;

  // 输入电压不足
  if (inputVoltage < requiredInput) {
    return Math.max(0, inputVoltage - params.dropoutVoltage * (loadCurrent / params.maxOutputCurrent));
  }

  // 输入超过最大范围
  if (inputVoltage > params.inputRange.max) {
    return 0; // 过压保护，可能已损坏
  }

  // 正常工作：标称输出 - 负载调整 + 线性调整
  const lineAdj = params.lineRegulation / 100 * (inputVoltage - requiredInput);
  const loadAdj = params.loadRegulation / 100 * loadCurrent;

  return params.outputVoltage + lineAdj - loadAdj;
}

/**
 * LM317 可调稳压器输出电压
 *
 * Vout = Vref × (1 + R2/R1) + Iadj × R2
 * 简化公式：Vout ≈ 1.25 × (1 + R2/R1)
 *
 * @param r1 调整电阻 R1 (Ω)，建议 240Ω
 * @param r2 调整电阻 R2 (Ω)
 * @param params 稳压器参数
 * @returns 输出电压 (V)
 */
export function lm317OutputVoltage(
  r1: number,
  r2: number,
  params: LinearRegulatorParams = LINEAR_REGULATOR_MODELS['LM317']
): number {
  if (r1 <= 0) return params.outputVoltage;
  return params.outputVoltage * (1 + r2 / r1);
}

/**
 * LM317 反推 R2 值
 *
 * R2 = R1 × (Vout/Vref - 1)
 *
 * @param targetOutput 目标输出电压 (V)
 * @param r1 R1 阻值 (Ω)，默认 240Ω
 * @param params 稳压器参数
 * @returns R2 阻值 (Ω)
 */
export function lm317CalculateR2(
  targetOutput: number,
  r1: number = 240,
  params: LinearRegulatorParams = LINEAR_REGULATOR_MODELS['LM317']
): number {
  if (params.outputVoltage <= 0) return 0;
  return r1 * (targetOutput / params.outputVoltage - 1);
}

/**
 * 稳压器功耗
 *
 * P = (Vin - Vout) × Iout + Vin × Iq
 *
 * @param inputVoltage 输入电压 (V)
 * @param loadCurrent 负载电流 (A)
 * @param params 稳压器参数
 * @returns 功耗 (W)
 */
export function regulatorPowerDissipation(
  inputVoltage: number,
  loadCurrent: number,
  params: LinearRegulatorParams = DEFAULT_LINEAR_REGULATOR_PARAMS
): number {
  const vDrop = inputVoltage - params.outputVoltage;
  const pLoad = Math.max(0, vDrop) * loadCurrent;
  const pQuiescent = inputVoltage * (params.quiescentCurrent / 1000);
  return pLoad + pQuiescent;
}

/**
 * 稳压器效率
 *
 * η = Pout / Pin × 100%
 *
 * @param inputVoltage 输入电压 (V)
 * @param loadCurrent 负载电流 (A)
 * @param params 稳压器参数
 * @returns 效率 (%)
 */
export function regulatorEfficiency(
  inputVoltage: number,
  loadCurrent: number,
  params: LinearRegulatorParams = DEFAULT_LINEAR_REGULATOR_PARAMS
): number {
  if (inputVoltage <= 0 || loadCurrent <= 0) return 0;
  const pOut = params.outputVoltage * loadCurrent;
  const pIn = inputVoltage * (loadCurrent + params.quiescentCurrent / 1000);
  return (pOut / pIn) * 100;
}

/**
 * 结温估算
 *
 * Tj = Ta + P × θja
 *
 * @param ambientTemp 环境温度 (°C)
 * @param inputVoltage 输入电压 (V)
 * @param loadCurrent 负载电流 (A)
 * @param params 稳压器参数
 * @returns 结温 (°C)
 */
export function regulatorJunctionTemperature(
  ambientTemp: number,
  inputVoltage: number,
  loadCurrent: number,
  params: LinearRegulatorParams = DEFAULT_LINEAR_REGULATOR_PARAMS
): number {
  const power = regulatorPowerDissipation(inputVoltage, loadCurrent, params);
  return ambientTemp + power * params.thermalResistance;
}

/**
 * 热关断保护检测
 *
 * @param ambientTemp 环境温度 (°C)
 * @param inputVoltage 输入电压 (V)
 * @param loadCurrent 负载电流 (A)
 * @param params 稳压器参数
 * @returns 是否触发热关断
 */
export function regulatorThermalShutdown(
  ambientTemp: number,
  inputVoltage: number,
  loadCurrent: number,
  params: LinearRegulatorParams = DEFAULT_LINEAR_REGULATOR_PARAMS
): boolean {
  const tj = regulatorJunctionTemperature(ambientTemp, inputVoltage, loadCurrent, params);
  return tj >= params.thermalShutdownTemp;
}

/**
 * 稳压器完整状态评估
 *
 * @param inputVoltage 输入电压 (V)
 * @param loadCurrent 负载电流 (A)
 * @param ambientTemp 环境温度 (°C)，默认 25°C
 * @param params 稳压器参数
 * @returns RegulatorStatus
 */
export function regulatorStatus(
  inputVoltage: number,
  loadCurrent: number,
  ambientTemp: number = 25,
  params: LinearRegulatorParams = DEFAULT_LINEAR_REGULATOR_PARAMS
): RegulatorStatus {
  const actualOutput = regulatorOutputVoltage(inputVoltage, loadCurrent, params);
  const inputOk = inputVoltage >= params.inputRange.min && inputVoltage <= params.inputRange.max;
  const power = regulatorPowerDissipation(inputVoltage, loadCurrent, params);
  const junctionTemp = ambientTemp + power * params.thermalResistance;
  const thermalShutdown = junctionTemp >= params.thermalShutdownTemp;
  const efficiency = regulatorEfficiency(inputVoltage, loadCurrent, params);
  const outputOk = inputOk && !thermalShutdown && Math.abs(actualOutput - params.outputVoltage) < params.outputVoltage * 0.05;

  return {
    outputOk,
    actualOutput: Math.round(actualOutput * 1000) / 1000,
    inputOk,
    thermalShutdown,
    junctionTemp: Math.round(junctionTemp * 10) / 10,
    powerDissipation: Math.round(power * 1000) / 1000,
    efficiency: Math.round(efficiency * 10) / 10,
  };
}

/**
 * 纹波抑制计算
 *
 * 输出纹波 = 输入纹波 / 10^(PSRR/20)
 *
 * @param inputRipple 输入纹波电压 (mV)
 * @param frequency 纹波频率 (Hz)
 * @param params 稳压器参数
 * @returns 输出纹波 (mV)
 */
export function regulatorOutputRipple(
  inputRipple: number,
  frequency: number = 120,
  params: LinearRegulatorParams = DEFAULT_LINEAR_REGULATOR_PARAMS
): number {
  // PSRR 随频率变化，120Hz 为参考值，频率越高 PSRR 越低
  let psrr = params.rippleRejection;
  if (frequency > 120) {
    // 简化模型：每 10 倍频程 PSRR 下降约 20dB
    const decades = Math.log10(frequency / 120);
    psrr = Math.max(20, psrr - decades * 20);
  }
  return inputRipple / Math.pow(10, psrr / 20);
}

/**
 * 推荐输入电容选择
 *
 * @param inputVoltage 输入电压 (V)
 * @param loadCurrent 负载电流 (A)
 * @param params 稳压器参数
 * @returns 推荐输入电容值 (μF)
 */
export function regulatorRecommendedInputCap(
  _inputVoltage: number,
  loadCurrent: number,
  _params: LinearRegulatorParams = DEFAULT_LINEAR_REGULATOR_PARAMS
): number {
  // 经验法则：输入电容 = 0.33μF + 负载电流相关
  // 当输入距离稳压器较远时需要更大的电容
  return 0.33 + loadCurrent * 100; // 简化估算
}

/**
 * 散热器热阻需求计算
 *
 * θha = (Tj_max - Ta) / P - θjc
 *
 * @param ambientTemp 环境温度 (°C)
 * @param inputVoltage 输入电压 (V)
 * @param loadCurrent 负载电流 (A)
 * @param params 稳压器参数
 * @returns 需要的散热器热阻 (°C/W)，0 表示不需要散热器
 */
export function regulatorHeatsinkRequirement(
  ambientTemp: number,
  inputVoltage: number,
  loadCurrent: number,
  params: LinearRegulatorParams = DEFAULT_LINEAR_REGULATOR_PARAMS
): number {
  const power = regulatorPowerDissipation(inputVoltage, loadCurrent, params);
  const deltaT = params.thermalShutdownTemp - 10 - ambientTemp; // 留 10°C 余量
  const requiredTheta = deltaT / power;
  // 典型 TO-220 结到壳热阻约 3°C/W
  const thetaJC = 3;
  const thetaHA = requiredTheta - thetaJC;
  return Math.max(0, thetaHA);
}

// ==================== 端口定义 ====================

/** 三端稳压器引脚布局（TO-220 封装） */
export const LINEAR_REGULATOR_PORTS: ComponentPort[] = [
  { id: 'input', offset: { x: -30, y: 0 } },
  { id: 'ground', offset: { x: 0, y: 30 } },
  { id: 'output', offset: { x: 30, y: 0 } },
];

/**
 * 测试用例描述：
 *
 * 测试 1: regulatorOutputVoltage(12, 0.5, LINEAR_REGULATOR_MODELS['LM7805']) 应返回约 5V
 *   输入 12V 足够，负载 500mA 在范围内
 *
 * 测试 2: regulatorOutputVoltage(5, 0.5, LINEAR_REGULATOR_MODELS['LM7805']) 应返回约 3V
 *   输入 5V 低于最低输入 7V，稳压器不能正常工作
 *
 * 测试 3: lm317OutputVoltage(240, 2400) 应返回约 13.75V
 *   1.25 × (1 + 2400/240) = 1.25 × 11 = 13.75
 *
 * 测试 4: lm317CalculateR2(5.0, 240) 应返回 720Ω
 *   R2 = 240 × (5.0/1.25 - 1) = 240 × 3 = 720
 *
 * 测试 5: regulatorPowerDissipation(12, 1.0) 应返回约 7.008W
 *   (12-5)×1.0 + 12×0.008 = 7 + 0.096 = 7.096W
 *
 * 测试 6: regulatorEfficiency(12, 1.0) 应返回约 41.4%
 *   Pout=5W, Pin=12.096W, η=5/12.096=41.34%
 *
 * 测试 7: regulatorThermalShutdown(25, 12, 1.0) 应返回 true
 *   结温 = 25 + 7.096×50 = 379.8°C > 150°C
 *
 * 测试 8: regulatorStatus(9, 0.3) 应返回 outputOk=true, 正常工作
 *
 * 测试 9: regulatorOutputRipple(100, 120) 应返回约 0.063mV
 *   100 / 10^(62/20) = 100 / 1258.9 ≈ 0.079mV
 */
