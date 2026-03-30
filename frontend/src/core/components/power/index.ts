/**
 * 电源管理元件定义
 *
 * LDO 稳压器、DC-DC 降压/升压变换器、电池模型、电源监控IC
 * 线性稳压器（LM7805, LM7833, LM317）
 */

// 线性稳压器（三端固定稳压器 + 可调稳压器）
export * from './regulators';

// ==================== 类型定义 ====================

/** LDO 稳压器参数 */
export interface LDOParams {
  /** 输出电压 (V) */
  outputVoltage: number;
  /** 输入电压范围 */
  inputRange: { min: number; max: number };
  /** 压差 (mV) @ 额定电流 */
  dropoutVoltage: number;
  /** 最大输出电流 (mA) */
  maxCurrent: number;
  /** 静态电流 (μA) */
  quiescentCurrent: number;
  /** 线性调整率 (%/V) */
  lineRegulation: number;
  /** 负载调整率 (%/A) */
  loadRegulation: number;
  /** PSRR @ 1kHz (dB) */
  psrr: number;
  /** 输出噪声 (μVrms) */
  outputNoise: number;
}

/** DC-DC 变换器通用参数 */
export interface DCDCParams {
  /** 输入电压范围 */
  inputRange: { min: number; max: number };
  /** 输出电压 (V) */
  outputVoltage: number;
  /** 开关频率 (kHz) */
  switchingFreq: number;
  /** 最大输出电流 (mA) */
  maxCurrent: number;
  /** 效率 (%) */
  efficiency: number;
  /** 输出纹波 (mVpp) */
  outputRipple: number;
  /** 电感值 (μH) */
  inductance: number;
  /** 输出电容 (μF) */
  outputCapacitance: number;
}

/** 电池参数 */
export interface BatteryParams {
  /** 标称电压 (V) */
  nominalVoltage: number;
  /** 满电电压 (V) */
  fullVoltage: number;
  /** 截止电压 (V) */
  cutoffVoltage: number;
  /** 容量 (mAh) */
  capacity: number;
  /** 内阻 (mΩ) */
  internalResistance: number;
  /** 自放电率 (%/月) */
  selfDischargeRate: number;
  /** 充电截止电流 (%C) */
  chargeTerminationCurrent: number;
  /** 最大充电电流 (mA) */
  maxChargeCurrent: number;
  /** 电池类型 */
  chemistry: 'Li-Ion' | 'LiPo' | 'NiMH' | 'Lead-Acid' | 'Alkaline';
}

/** 电源监控 IC 参数 */
export interface PowerSupervisorParams {
  /** 复位阈值电压 (V) */
  resetThreshold: number;
  /** 复位超时 (ms) */
  resetTimeout: number;
  /** 欠压检测 */
  hasUVLO: boolean;
  /** 欠压阈值 (V) */
  uvloThreshold: number;
  /** 看门狗超时 (ms) */
  watchdogTimeout: number;
  /** 手动复位输入 */
  hasManualReset: boolean;
}

// ==================== 常见型号参数 ====================

/** LDO 型号参数 */
export const LDO_MODELS = {
  '7805': {
    outputVoltage: 5.0,
    inputRange: { min: 7, max: 25 },
    dropoutVoltage: 2000,
    maxCurrent: 1000,
    quiescentCurrent: 5000,
    lineRegulation: 0.05,
    loadRegulation: 0.3,
    psrr: 60,
    outputNoise: 40,
  },
  AMS1117_33: {
    outputVoltage: 3.3,
    inputRange: { min: 4.3, max: 15 },
    dropoutVoltage: 1300,
    maxCurrent: 1000,
    quiescentCurrent: 5000,
    lineRegulation: 0.04,
    loadRegulation: 0.2,
    psrr: 72,
    outputNoise: 30,
  },
  AMS1117_50: {
    outputVoltage: 5.0,
    inputRange: { min: 6.5, max: 15 },
    dropoutVoltage: 1300,
    maxCurrent: 1000,
    quiescentCurrent: 5000,
    lineRegulation: 0.04,
    loadRegulation: 0.2,
    psrr: 72,
    outputNoise: 30,
  },
  TLV1117_33: {
    outputVoltage: 3.3,
    inputRange: { min: 4.3, max: 15 },
    dropoutVoltage: 1200,
    maxCurrent: 800,
    quiescentCurrent: 1000,
    lineRegulation: 0.03,
    loadRegulation: 0.15,
    psrr: 75,
    outputNoise: 25,
  },
} as const;

/** Buck 变换器参数 */
export const BUCK_MODELS = {
  LM2596: {
    inputRange: { min: 4.5, max: 40 },
    outputVoltage: 3.3,
    switchingFreq: 150,
    maxCurrent: 3000,
    efficiency: 85,
    outputRipple: 30,
    inductance: 33,
    outputCapacitance: 220,
  },
  MP1584: {
    inputRange: { min: 4.5, max: 28 },
    outputVoltage: 3.3,
    switchingFreq: 1200,
    maxCurrent: 3000,
    efficiency: 90,
    outputRipple: 15,
    inductance: 4.7,
    outputCapacitance: 47,
  },
  TPS5430: {
    inputRange: { min: 5.5, max: 36 },
    outputVoltage: 3.3,
    switchingFreq: 500,
    maxCurrent: 3000,
    efficiency: 92,
    outputRipple: 10,
    inductance: 10,
    outputCapacitance: 100,
  },
} as const;

/** Boost 变换器参数 */
export const BOOST_MODELS = {
  MT3608: {
    inputRange: { min: 2, max: 24 },
    outputVoltage: 12,
    switchingFreq: 1200,
    maxCurrent: 2000,
    efficiency: 88,
    outputRipple: 20,
    inductance: 4.7,
    outputCapacitance: 22,
  },
  XL6009: {
    inputRange: { min: 5, max: 32 },
    outputVoltage: 12,
    switchingFreq: 400,
    maxCurrent: 4000,
    efficiency: 85,
    outputRipple: 30,
    inductance: 22,
    outputCapacitance: 100,
  },
} as const;

/** 电池型号参数 */
export const BATTERY_MODELS = {
  '18650': {
    nominalVoltage: 3.7,
    fullVoltage: 4.2,
    cutoffVoltage: 2.5,
    capacity: 2600,
    internalResistance: 50,
    selfDischargeRate: 3,
    chargeTerminationCurrent: 5,
    maxChargeCurrent: 1300,
    chemistry: 'Li-Ion' as const,
  },
  LiPo_37V: {
    nominalVoltage: 3.7,
    fullVoltage: 4.2,
    cutoffVoltage: 3.0,
    capacity: 1000,
    internalResistance: 30,
    selfDischargeRate: 5,
    chargeTerminationCurrent: 5,
    maxChargeCurrent: 500,
    chemistry: 'LiPo' as const,
  },
  '9V_Alkaline': {
    nominalVoltage: 9,
    fullVoltage: 9.5,
    cutoffVoltage: 6.0,
    capacity: 550,
    internalResistance: 1500,
    selfDischargeRate: 2,
    chargeTerminationCurrent: 0,
    maxChargeCurrent: 0,
    chemistry: 'Alkaline' as const,
  },
  AA_NiMH: {
    nominalVoltage: 1.2,
    fullVoltage: 1.4,
    cutoffVoltage: 1.0,
    capacity: 2500,
    internalResistance: 20,
    selfDischargeRate: 15,
    chargeTerminationCurrent: 3,
    maxChargeCurrent: 1250,
    chemistry: 'NiMH' as const,
  },
} as const;

// ==================== LDO 模型 ====================

/**
 * LDO 输出电压计算
 *
 * V_out = V_out_nom + (V_in - V_drop_min) × line_reg × (I_out / I_max) × load_reg
 * 实际上，只要 V_in > V_out + V_dropout，V_out 基本恒定
 *
 * @param inputVoltage 输入电压 (V)
 * @param loadCurrent 负载电流 (mA)
 * @param params LDO 参数
 * @returns 输出电压 (V)
 */
export function ldoOutputVoltage(
  inputVoltage: number,
  loadCurrent: number,
  params: LDOParams = LDO_MODELS.AMS1117_33
): number {
  const dropout = params.dropoutVoltage / 1000; // mV → V
  // 输入不足时输出下降
  if (inputVoltage < params.outputVoltage + dropout) {
    return Math.max(0, inputVoltage - dropout);
  }
  // 线性调整
  const lineAdj = params.lineRegulation / 100 * (inputVoltage - params.outputVoltage - dropout);
  // 负载调整
  const loadAdj = params.loadRegulation / 100 * (loadCurrent / 1000);
  return params.outputVoltage + lineAdj - loadAdj;
}

/**
 * LDO 效率
 *
 * η = V_out / V_in × 100%
 *
 * @param inputVoltage 输入电压 (V)
 * @param params LDO 参数
 * @returns 效率 (%)
 */
export function ldoEfficiency(inputVoltage: number, params: LDOParams = LDO_MODELS.AMS1117_33): number {
  if (inputVoltage <= 0) return 0;
  return (params.outputVoltage / inputVoltage) * 100;
}

/**
 * LDO 功耗
 *
 * P_dissipated = (V_in - V_out) × I_out + V_in × I_q
 */
export function ldoPowerDissipation(
  inputVoltage: number,
  loadCurrent: number,
  params: LDOParams = LDO_MODELS.AMS1117_33
): number {
  const vDrop = inputVoltage - params.outputVoltage;
  const pLoad = vDrop * (loadCurrent / 1000);
  const pQuiescent = inputVoltage * (params.quiescentCurrent / 1e6);
  return pLoad + pQuiescent; // W
}

// ==================== DC-DC 变换器模型 ====================

/**
 * Buck 变换器输出电压
 *
 * V_out = D × V_in × efficiency
 * 其中 D 为占空比
 *
 * @param inputVoltage 输入电压 (V)
 * @param dutyCycle 占空比 (0-1)
 * @param params Buck 参数
 * @returns 输出电压 (V)
 */
export function buckOutputVoltage(
  inputVoltage: number,
  dutyCycle: number = 1,
  params: DCDCParams = BUCK_MODELS.LM2596
): number {
  if (dutyCycle === 1) {
    // 自动调节占空比
    dutyCycle = params.outputVoltage / inputVoltage / (params.efficiency / 100);
    dutyCycle = Math.min(Math.max(dutyCycle, 0), 1);
  }
  return inputVoltage * dutyCycle * (params.efficiency / 100);
}

/**
 * Boost 变换器输出电压
 *
 * V_out = V_in / (1 - D) × efficiency
 *
 * @param inputVoltage 输入电压 (V)
 * @param dutyCycle 占空比 (0-1)
 * @param params Boost 参数
 * @returns 输出电压 (V)
 */
export function boostOutputVoltage(
  inputVoltage: number,
  dutyCycle: number = 0.7,
  params: DCDCParams = BOOST_MODELS.MT3608
): number {
  if (dutyCycle >= 1) return inputVoltage * (params.efficiency / 100);
  return inputVoltage / (1 - dutyCycle) * (params.efficiency / 100);
}

/**
 * 计算输出纹波电压
 *
 * ΔV = I_out × (1 - D) / (f_sw × C_out)
 *
 * @param loadCurrent 负载电流 (mA)
 * @param dutyCycle 占空比
 * @param params 变换器参数
 * @returns 纹波电压 (mV)
 */
export function dcdcOutputRipple(
  loadCurrent: number,
  dutyCycle: number,
  params: DCDCParams
): number {
  const iOut = loadCurrent / 1000; // mA → A
  const cOut = params.outputCapacitance / 1e6; // μF → F
  const fSw = params.switchingFreq * 1000; // kHz → Hz
  return (iOut * (1 - dutyCycle) / (fSw * cOut)) * 1000; // V → mV
}

// ==================== 电池模型 ====================

/**
 * 电池放电电压曲线
 * 简化模型：线性下降 + 内阻压降
 *
 * V_out = V_full - (V_full - V_cutoff) × (1 - SoC) - I × R_internal
 *
 * @param stateOfCharge 电量状态 (0-1)
 * @param dischargeCurrent 放电电流 (mA)
 * @param params 电池参数
 * @returns 输出电压 (V)
 */
export function batteryVoltage(
  stateOfCharge: number,
  dischargeCurrent: number = 100,
  params: BatteryParams = BATTERY_MODELS['18650']
): number {
  const soc = Math.max(0, Math.min(1, stateOfCharge));
  // 开路电压（简化线性模型）
  const ocv = params.cutoffVoltage + (params.fullVoltage - params.cutoffVoltage) * soc;
  // 内阻压降
  const irDrop = (dischargeCurrent / 1000) * (params.internalResistance / 1000);
  return Math.max(0, ocv - irDrop);
}

/**
 * 电池剩余运行时间估算
 *
 * t = C_remaining / I_discharge
 *
 * @param stateOfCharge 电量状态 (0-1)
 * @param dischargeCurrent 放电电流 (mA)
 * @param params 电池参数
 * @returns 剩余时间 (小时)
 */
export function batteryRemainingTime(
  stateOfCharge: number,
  dischargeCurrent: number,
  params: BatteryParams = BATTERY_MODELS['18650']
): number {
  if (dischargeCurrent <= 0) return Infinity;
  return (params.capacity * stateOfCharge) / dischargeCurrent;
}

/**
 * 充电电压曲线
 *
 * @param stateOfCharge 电量状态 (0-1)
 * @param chargeCurrent 充电电流 (mA)
 * @param params 电池参数
 * @returns 充电电压 (V)
 */
export function batteryChargeVoltage(
  stateOfCharge: number,
  chargeCurrent: number = 500,
  params: BatteryParams = BATTERY_MODELS['18650']
): number {
  const soc = Math.max(0, Math.min(1, stateOfCharge));
  // CC 阶段：电压从截止电压升到满电
  // CV 阶段：维持满电电压
  if (soc < 0.8) {
    // CC 阶段
    const vBase = params.cutoffVoltage + (params.fullVoltage - params.cutoffVoltage) * (soc / 0.8);
    const irBoost = (chargeCurrent / 1000) * (params.internalResistance / 1000);
    return vBase + irBoost;
  }
  // CV 阶段
  return params.fullVoltage;
}

/**
 * 生成电池放电曲线
 */
export function generateBatteryDischargeCurve(
  params: BatteryParams = BATTERY_MODELS['18650'],
  dischargeCurrent: number = 500,
  points: number = 100
): { soc: number; voltage: number; time: number }[] {
  const data: { soc: number; voltage: number; time: number }[] = [];
  const totalTime = params.capacity / dischargeCurrent; // hours
  for (let i = 0; i < points; i++) {
    const soc = 1 - i / (points - 1);
    const voltage = batteryVoltage(soc, dischargeCurrent, params);
    const time = totalTime * (1 - soc);
    data.push({
      soc: Math.round(soc * 100),
      voltage: Math.round(voltage * 100) / 100,
      time: Math.round(time * 10) / 10,
    });
  }
  return data;
}

// ==================== 电源监控 IC ====================

/**
 * 电源监控：检测电压是否低于阈值
 *
 * @param voltage 当前电压 (V)
 * @param params 监控参数
 * @returns { reset: boolean, uvlo: boolean }
 */
export function powerSupervisorCheck(
  voltage: number,
  params: PowerSupervisorParams = {
    resetThreshold: 3.0,
    resetTimeout: 200,
    hasUVLO: true,
    uvloThreshold: 2.7,
    watchdogTimeout: 1600,
    hasManualReset: true,
  }
): { reset: boolean; uvlo: boolean } {
  return {
    reset: voltage < params.resetThreshold,
    uvlo: params.hasUVLO && voltage < params.uvloThreshold,
  };
}
