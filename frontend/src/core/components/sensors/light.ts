/**
 * 光传感器元件定义
 *
 * 光敏电阻(LDR)、光电二极管、光电晶体管
 * 包含照度-响应特性曲线
 */

// ==================== 类型定义 ====================

/** 光传感器通用参数 */
export interface LightSensorParams {
  /** 工作温度范围 (°C) */
  tempRange: { min: number; max: number };
  /** 光谱响应范围 (nm) */
  spectralRange: { min: number; max: number };
  /** 响应时间 (ms) */
  responseTime: number;
}

/** 光敏电阻 (LDR) 参数 */
export interface LDRParams extends LightSensorParams {
  /** 暗电阻 (Ω) - 完全黑暗时 */
  darkResistance: number;
  /** 亮电阻 (Ω) - @ 10 Lux */
  lightResistance: number;
  /** γ 值 - 光照特性指数 */
  gamma: number;
  /** 参考照度 (Lux) */
  referenceLux: number;
}

/** 光电二极管参数 */
export interface PhotodiodeParams extends LightSensorParams {
  /** 暗电流 (nA) */
  darkCurrent: number;
  /** 响应度 (A/W) @ 峰值波长 */
  responsivity: number;
  /** 峰值响应波长 (nm) */
  peakWavelength: number;
  /** 结电容 (pF) */
  junctionCap: number;
  /** 分流电阻 (MΩ) */
  shuntResistance: number;
}

/** 光电晶体管参数 */
export interface PhototransistorParams extends LightSensorParams {
  /** 暗电流 (nA) */
  darkCurrent: number;
  /** 光电流增益 */
  gain: number;
  /** 集电极-发射极饱和电压 (V) */
  vceSat: number;
  /** 响应度 (nA/Lux) */
  luxResponsivity: number;
}

// ==================== 默认参数 ====================

/** 常见 LDR 型号参数 */
export const LDR_MODELS = {
  GL5528: {
    darkResistance: 1000000,  // 1MΩ
    lightResistance: 10000,   // 10kΩ @ 10 Lux
    gamma: 0.6,
    referenceLux: 10,
    tempRange: { min: -30, max: 70 },
    spectralRange: { min: 400, max: 800 },
    responseTime: 30,
  },
  GL5537: {
    darkResistance: 500000,   // 500kΩ
    lightResistance: 5000,    // 5kΩ @ 10 Lux
    gamma: 0.7,
    referenceLux: 10,
    tempRange: { min: -30, max: 70 },
    spectralRange: { min: 400, max: 800 },
    responseTime: 25,
  },
  GL5539: {
    darkResistance: 200000,   // 200kΩ
    lightResistance: 2000,    // 2kΩ @ 10 Lux
    gamma: 0.7,
    referenceLux: 10,
    tempRange: { min: -30, max: 70 },
    spectralRange: { min: 400, max: 800 },
    responseTime: 20,
  },
} as const;

/** 默认 LDR 参数 (GL5528) */
export const DEFAULT_LDR_PARAMS: LDRParams = LDR_MODELS.GL5528;

/** 默认光电二极管参数 */
export const DEFAULT_PHOTODIODE_PARAMS: PhotodiodeParams = {
  darkCurrent: 0.5,
  responsivity: 0.55,
  peakWavelength: 940,
  junctionCap: 20,
  shuntResistance: 100,
  tempRange: { min: -40, max: 85 },
  spectralRange: { min: 400, max: 1100 },
  responseTime: 5,
};

/** 默认光电晶体管参数 */
export const DEFAULT_PHOTOTRANSISTOR_PARAMS: PhototransistorParams = {
  darkCurrent: 10,
  gain: 100,
  vceSat: 0.4,
  luxResponsivity: 50,
  tempRange: { min: -40, max: 85 },
  spectralRange: { min: 400, max: 1100 },
  responseTime: 15,
};

// ==================== LDR 计算模型 ====================

/**
 * LDR 照度-电阻关系
 *
 * R = R_light × (Lux / Lux_ref)^(-γ)
 * 即：R ∝ Lux^(-γ)
 *
 * @param lux 照度 (Lux)
 * @param params LDR 参数
 * @returns 电阻值 (Ω)
 */
export function ldrLuxToResistance(lux: number, params: LDRParams = DEFAULT_LDR_PARAMS): number {
  if (lux <= 0) return params.darkResistance;
  const ratio = lux / params.referenceLux;
  return params.lightResistance * Math.pow(ratio, -params.gamma);
}

/**
 * LDR 电阻-照度反算
 * @param resistance 电阻值 (Ω)
 * @param params LDR 参数
 * @returns 照度 (Lux)
 */
export function ldrResistanceToLux(resistance: number, params: LDRParams = DEFAULT_LDR_PARAMS): number {
  if (resistance >= params.darkResistance) return 0;
  const ratio = resistance / params.lightResistance;
  return params.referenceLux * Math.pow(ratio, -1 / params.gamma);
}

/**
 * 生成 LDR 照度-电阻特性曲线
 */
export function generateLDRCurve(
  luxMin: number = 1,
  luxMax: number = 10000,
  points: number = 50,
  params: LDRParams = DEFAULT_LDR_PARAMS
): { lux: number; resistance: number; logLux: number; logR: number }[] {
  const data: { lux: number; resistance: number; logLux: number; logR: number }[] = [];
  const logMin = Math.log10(luxMin);
  const logMax = Math.log10(luxMax);
  const step = (logMax - logMin) / (points - 1);

  for (let i = 0; i < points; i++) {
    const logLux = logMin + i * step;
    const lux = Math.pow(10, logLux);
    const resistance = ldrLuxToResistance(lux, params);
    data.push({
      lux: Math.round(lux * 100) / 100,
      resistance: Math.round(resistance),
      logLux: Math.round(logLux * 100) / 100,
      logR: Math.round(Math.log10(resistance) * 100) / 100,
    });
  }
  return data;
}

// ==================== 光电二极管模型 ====================

/**
 * 光电二极管光电流计算
 *
 * I_ph = Responsivity × P_optical
 * I_total = I_ph + I_dark
 *
 * 光功率与照度近似关系：P ≈ k × Lux（简化模型）
 *
 * @param lux 照度 (Lux)
 * @param params 光电二极管参数
 * @returns 光电流 (μA)
 */
export function photodiodeCurrent(lux: number, params: PhotodiodeParams = DEFAULT_PHOTODIODE_PARAMS): number {
  // 简化模型：Lux → 光功率 (μW/cm²)
  const pOptical = lux * 0.0079; // 近似转换
  const photoCurrent = params.responsivity * pOptical; // A
  const totalCurrent = photoCurrent + params.darkCurrent * 1e-9; // A
  return totalCurrent * 1e6; // → μA
}

/**
 * 光电二极管在光电导模式下的输出电压
 * V_out = I_ph × R_load
 *
 * @param lux 照度 (Lux)
 * @param loadResistance 负载电阻 (Ω)
 * @param params 光电二极管参数
 * @returns 输出电压 (V)
 */
export function photodiodeOutputVoltage(
  lux: number,
  loadResistance: number = 10000,
  params: PhotodiodeParams = DEFAULT_PHOTODIODE_PARAMS
): number {
  const current = photodiodeCurrent(lux, params);
  return current * 1e-6 * loadResistance; // μA × Ω → V
}

/**
 * 生成光电二极管照度-响应曲线
 */
export function generatePhotodiodeCurve(
  luxMax: number = 10000,
  points: number = 50,
  params: PhotodiodeParams = DEFAULT_PHOTODIODE_PARAMS
): { lux: number; current: number }[] {
  const data: { lux: number; current: number }[] = [];
  const step = luxMax / (points - 1);
  for (let i = 0; i < points; i++) {
    const lux = i * step;
    const current = photodiodeCurrent(lux, params);
    data.push({ lux: Math.round(lux), current: Math.round(current * 1000) / 1000 });
  }
  return data;
}

// ==================== 光电晶体管模型 ====================

/**
 * 光电晶体管集电极电流
 *
 * I_c = gain × I_ph_base
 * I_ph_base ∝ Lux
 *
 * @param lux 照度 (Lux)
 * @param params 光电晶体管参数
 * @returns 集电极电流 (mA)
 */
export function phototransistorCurrent(
  lux: number,
  params: PhototransistorParams = DEFAULT_PHOTOTRANSISTOR_PARAMS
): number {
  const basePhotoCurrent = lux * params.luxResponsivity; // nA
  const collectorCurrent = params.gain * basePhotoCurrent; // nA
  return collectorCurrent / 1e6; // → mA
}

/**
 * 光电晶体管输出电压（共发射极配置）
 *
 * V_out = V_cc - I_c × R_c（当未饱和时）
 * V_out = V_ce_sat（饱和时）
 *
 * @param lux 照度 (Lux)
 * @param vcc 电源电压 (V)
 * @param collectorResistance 集电极电阻 (Ω)
 * @param params 光电晶体管参数
 * @returns 输出电压 (V)
 */
export function phototransistorOutputVoltage(
  lux: number,
  vcc: number = 5,
  collectorResistance: number = 10000,
  params: PhototransistorParams = DEFAULT_PHOTOTRANSISTOR_PARAMS
): number {
  const ic = phototransistorCurrent(lux, params);
  const vDrop = ic * 1e-3 * collectorResistance;
  const vOut = vcc - vDrop;
  return Math.max(vOut, params.vceSat);
}

/**
 * 生成光电晶体管照度-响应曲线
 */
export function generatePhototransistorCurve(
  luxMax: number = 5000,
  points: number = 50,
  params: PhototransistorParams = DEFAULT_PHOTOTRANSISTOR_PARAMS
): { lux: number; current: number; voltage: number }[] {
  const data: { lux: number; current: number; voltage: number }[] = [];
  const step = luxMax / (points - 1);
  for (let i = 0; i < points; i++) {
    const lux = i * step;
    const current = phototransistorCurrent(lux, params);
    const voltage = phototransistorOutputVoltage(lux, 5, 10000, params);
    data.push({
      lux: Math.round(lux),
      current: Math.round(current * 1000) / 1000,
      voltage: Math.round(voltage * 100) / 100,
    });
  }
  return data;
}

/**
 * 典型场景照度参考值
 */
export const TYPICAL_ILLUMINANCE = {
  星光: 0.001,
  满月: 0.1,
  黎明黄昏: 1,
  阴天室内: 10,
  阴天室外: 100,
  晴天室内: 200,
  晴天阴影: 1000,
  晴天室外: 10000,
  正午阳光: 100000,
} as const;
