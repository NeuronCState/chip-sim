/**
 * 被动元件库（Passive Components）
 *
 * 电阻（Resistor）、电容（Capacitor）、电感（Inductor）
 * 包含类型定义、常见型号、行为模型和计算工具函数
 */

// ==================== 电阻 ====================

/** 电阻参数 */
export interface ResistorParams {
  /** 阻值 (Ω) */
  resistance: number;
  /** 公差 (%) */
  tolerance: number;
  /** 额定功率 (W) */
  powerRating: number;
  /** 温度系数 (ppm/°C) */
  tempCoeff: number;
  /** 封装类型 */
  package: '0201' | '0402' | '0603' | '0805' | '1206' | '1210' | '2512' | 'axial';
  /** 最大工作电压 (V) */
  maxVoltage: number;
}

/** E24 标准阻值系列 */
export const E24_VALUES = [
  1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0,
  3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1,
] as const;

/** E96 标准阻值系列（前24个常用值） */
export const E96_VALUES = [
  1.00, 1.02, 1.05, 1.07, 1.10, 1.13, 1.15, 1.18,
  1.21, 1.24, 1.27, 1.30, 1.33, 1.37, 1.40, 1.43,
  1.47, 1.50, 1.54, 1.58, 1.62, 1.65, 1.69, 1.74,
] as const;

/** 常见贴片电阻型号 */
export const RESISTOR_MODELS = {
  '0603_1K': {
    resistance: 1000,
    tolerance: 1,
    powerRating: 0.1,
    tempCoeff: 100,
    package: '0603' as const,
    maxVoltage: 75,
  },
  '0805_10K': {
    resistance: 10000,
    tolerance: 5,
    powerRating: 0.125,
    tempCoeff: 200,
    package: '0805' as const,
    maxVoltage: 150,
  },
  '1206_100': {
    resistance: 100,
    tolerance: 1,
    powerRating: 0.25,
    tempCoeff: 100,
    package: '1206' as const,
    maxVoltage: 200,
  },
  '1206_4K7': {
    resistance: 4700,
    tolerance: 5,
    tempCoeff: 200,
    powerRating: 0.25,
    package: '1206' as const,
    maxVoltage: 200,
  },
} as const;

/**
 * 电阻串联总阻值
 *
 * R_total = R1 + R2 + ... + Rn
 *
 * @param resistors 各电阻值数组 (Ω)
 * @returns 总阻值 (Ω)
 */
export function resistorSeries(resistors: number[]): number {
  return resistors.reduce((sum, r) => sum + r, 0);
}

/**
 * 电阻并联总阻值
 *
 * 1/R_total = 1/R1 + 1/R2 + ... + 1/Rn
 *
 * @param resistors 各电阻值数组 (Ω)
 * @returns 总阻值 (Ω)
 */
export function resistorParallel(resistors: number[]): number {
  if (resistors.length === 0) return 0;
  const reciprocalSum = resistors.reduce((sum, r) => sum + 1 / r, 0);
  return 1 / reciprocalSum;
}

/**
 * 欧姆定律：由电压和电阻计算电流
 *
 * I = V / R
 *
 * @param voltage 电压 (V)
 * @param resistance 阻值 (Ω)
 * @returns 电流 (A)
 */
export function ohmsLawCurrent(voltage: number, resistance: number): number {
  if (resistance <= 0) return 0;
  return voltage / resistance;
}

/**
 * 欧姆定律：由电流和电阻计算电压
 *
 * V = I × R
 *
 * @param current 电流 (A)
 * @param resistance 阻值 (Ω)
 * @returns 电压 (V)
 */
export function ohmsLawVoltage(current: number, resistance: number): number {
  return current * resistance;
}

/**
 * 电阻功率计算
 *
 * P = V × I = I² × R = V² / R
 *
 * @param voltage 电压 (V)
 * @param current 电流 (A)
 * @returns 功率 (W)
 */
export function resistorPower(voltage: number, current: number): number {
  return Math.abs(voltage * current);
}

/**
 * 电阻是否超过额定功率
 *
 * @param voltage 实际电压 (V)
 * @param params 电阻参数
 * @returns 是否过载
 */
export function resistorOverloaded(voltage: number, params: ResistorParams): boolean {
  const p = (voltage * voltage) / params.resistance;
  return p > params.powerRating;
}

/**
 * 温度对阻值的影响
 *
 * R(T) = R_ref × [1 + α × (T - T_ref)]
 *
 * @param resistance 标称阻值 (Ω)
 * @param temperature 当前温度 (°C)
 * @param referenceTemp 参考温度 (°C), 默认 25°C
 * @param tempCoeff 温度系数 (ppm/°C)
 * @returns 实际阻值 (Ω)
 */
export function resistorTempDrift(
  resistance: number,
  temperature: number,
  referenceTemp: number = 25,
  tempCoeff: number = 100
): number {
  const alpha = tempCoeff / 1e6;
  return resistance * (1 + alpha * (temperature - referenceTemp));
}

// ==================== 电容 ====================

/** 电容介质类型 */
export type DielectricType = 'C0G' | 'X7R' | 'X5R' | 'Y5V' | 'electrolytic' | 'tantalum' | 'film';

/** 电容参数 */
export interface CapacitorParams {
  /** 容值 (F) */
  capacitance: number;
  /** 额定电压 (V) */
  ratedVoltage: number;
  /** 等效串联电阻 ESR (Ω) */
  esr: number;
  /** 等效串联电感 ESL (H) */
  esl: number;
  /** 公差 (%) */
  tolerance: number;
  /** 介质类型 */
  dielectric: DielectricType;
  /** 温度系数 (ppm/°C) */
  tempCoeff: number;
  /** 最高工作温度 (°C) */
  maxTemp: number;
  /** 漏电流系数 */
  leakageFactor: number;
}

/** 常见电容型号 */
export const CAPACITOR_MODELS = {
  /** 100nF 陶瓷电容 MLCC 0805 */
  MLCC_100nF_0805: {
    capacitance: 100e-9,
    ratedVoltage: 50,
    esr: 0.01,
    esl: 0.5e-9,
    tolerance: 10,
    dielectric: 'X7R' as const,
    tempCoeff: 15,
    maxTemp: 125,
    leakageFactor: 0.01,
  },
  /** 10μF 陶瓷电容 MLCC 1206 */
  MLCC_10uF_1206: {
    capacitance: 10e-6,
    ratedVoltage: 25,
    esr: 0.005,
    esl: 1e-9,
    tolerance: 20,
    dielectric: 'X5R' as const,
    tempCoeff: 15,
    maxTemp: 85,
    leakageFactor: 0.01,
  },
  /** 100μF 电解电容 */
  Electrolytic_100uF: {
    capacitance: 100e-6,
    ratedVoltage: 25,
    esr: 0.3,
    esl: 5e-9,
    tolerance: 20,
    dielectric: 'electrolytic' as const,
    tempCoeff: 100,
    maxTemp: 105,
    leakageFactor: 0.03,
  },
  /** 1000μF 电解电容 */
  Electrolytic_1000uF: {
    capacitance: 1000e-6,
    ratedVoltage: 16,
    esr: 0.05,
    esl: 10e-9,
    tolerance: 20,
    dielectric: 'electrolytic' as const,
    tempCoeff: 100,
    maxTemp: 105,
    leakageFactor: 0.04,
  },
  /** 22pF C0G 高频电容 */
  C0G_22pF: {
    capacitance: 22e-12,
    ratedVoltage: 50,
    esr: 0.05,
    esl: 0.3e-9,
    tolerance: 5,
    dielectric: 'C0G' as const,
    tempCoeff: 0,
    maxTemp: 125,
    leakageFactor: 0.001,
  },
  /** 100nF 薄膜电容 */
  Film_100nF: {
    capacitance: 100e-9,
    ratedVoltage: 63,
    esr: 0.01,
    esl: 2e-9,
    tolerance: 5,
    dielectric: 'film' as const,
    tempCoeff: 50,
    maxTemp: 105,
    leakageFactor: 0.005,
  },
} as const;

/**
 * 电容串联总容值
 *
 * 1/C_total = 1/C1 + 1/C2 + ... + 1/Cn
 *
 * @param caps 各电容值数组 (F)
 * @returns 总容值 (F)
 */
export function capacitorSeries(caps: number[]): number {
  if (caps.length === 0) return 0;
  const reciprocalSum = caps.reduce((sum, c) => sum + 1 / c, 0);
  return 1 / reciprocalSum;
}

/**
 * 电容并联总容值
 *
 * C_total = C1 + C2 + ... + Cn
 *
 * @param caps 各电容值数组 (F)
 * @returns 总容值 (F)
 */
export function capacitorParallel(caps: number[]): number {
  return caps.reduce((sum, c) => sum + c, 0);
}

/**
 * 电容容抗（阻抗的虚部）
 *
 * Xc = 1 / (2π × f × C)
 *
 * @param frequency 频率 (Hz)
 * @param capacitance 容值 (F)
 * @returns 容抗 (Ω)
 */
export function capacitiveReactance(frequency: number, capacitance: number): number {
  if (frequency <= 0 || capacitance <= 0) return Infinity;
  return 1 / (2 * Math.PI * frequency * capacitance);
}

/**
 * RC 时间常数
 *
 * τ = R × C
 *
 * @param resistance 阻值 (Ω)
 * @param capacitance 容值 (F)
 * @returns 时间常数 (s)
 */
export function rcTimeConstant(resistance: number, capacitance: number): number {
  return resistance * capacitance;
}

/**
 * RC 充电曲线
 *
 * V(t) = V_final × (1 - e^(-t/τ))
 *
 * @param time 时间 (s)
 * @param vFinal 最终电压 (V)
 * @param tau 时间常数 τ = RC (s)
 * @returns 电容两端电压 (V)
 */
export function capacitorChargeVoltage(time: number, vFinal: number, tau: number): number {
  if (tau <= 0) return vFinal;
  return vFinal * (1 - Math.exp(-time / tau));
}

/**
 * RC 放电曲线
 *
 * V(t) = V_initial × e^(-t/τ)
 *
 * @param time 时间 (s)
 * @param vInitial 初始电压 (V)
 * @param tau 时间常数 τ = RC (s)
 * @returns 电容两端电压 (V)
 */
export function capacitorDischargeVoltage(time: number, vInitial: number, tau: number): number {
  if (tau <= 0) return 0;
  return vInitial * Math.exp(-time / tau);
}

/**
 * 电容储能
 *
 * E = ½ × C × V²
 *
 * @param capacitance 容值 (F)
 * @param voltage 电压 (V)
 * @returns 储能 (J)
 */
export function capacitorEnergy(capacitance: number, voltage: number): number {
  return 0.5 * capacitance * voltage * voltage;
}

/**
 * 电容纹波电流能力（简化估算）
 *
 * I_ripple = V_ripple / ESR
 *
 * @param rippleVoltage 纹波电压 (V)
 * @param esr 等效串联电阻 (Ω)
 * @returns 纹波电流 (A)
 */
export function capacitorRippleCurrent(rippleVoltage: number, esr: number): number {
  if (esr <= 0) return 0;
  return rippleVoltage / esr;
}

/**
 * 电容阻抗（含 ESR 和 ESL 的完整模型）
 *
 * |Z| = √(ESR² + (Xl - Xc)²)
 * Xl = 2πf × ESL
 * Xc = 1 / (2πf × C)
 *
 * @param frequency 频率 (Hz)
 * @param params 电容参数
 * @returns 阻抗幅值 (Ω)
 */
export function capacitorImpedance(frequency: number, params: CapacitorParams): number {
  const xl = 2 * Math.PI * frequency * params.esl;
  const xc = 1 / (2 * Math.PI * frequency * params.capacitance);
  return Math.sqrt(params.esr * params.esr + (xl - xc) * (xl - xc));
}

/**
 * 电容自谐振频率
 *
 * f_res = 1 / (2π × √(ESL × C))
 *
 * @param params 电容参数
 * @returns 自谐振频率 (Hz)
 */
export function capacitorSelfResonantFreq(params: CapacitorParams): number {
  return 1 / (2 * Math.PI * Math.sqrt(params.esl * params.capacitance));
}

// ==================== 电感 ====================

/** 电感参数 */
export interface InductorParams {
  /** 电感量 (H) */
  inductance: number;
  /** 直流电阻 DCR (Ω) */
  dcr: number;
  /** 品质因数 Q @ 1MHz */
  qFactor: number;
  /** 自谐振频率 SRF (Hz) */
  srf: number;
  /** 额定电流 (A) */
  ratedCurrent: number;
  /** 饱和电流 (A) */
  satCurrent: number;
  /** 封装类型 */
  package: '0402' | '0603' | '0805' | '1206' | 'shielded' | 'toroidal' | 'axial';
  /** 磁芯类型 */
  core: 'ferrite' | 'iron' | 'air' | 'powdered_iron';
}

/** 常见电感型号 */
export const INDUCTOR_MODELS = {
  /** 10μH 贴片功率电感 1210 */
  SMD_10uH: {
    inductance: 10e-6,
    dcr: 0.15,
    qFactor: 20,
    srf: 50e6,
    ratedCurrent: 1.5,
    satCurrent: 2.0,
    package: '1206' as const,
    core: 'ferrite' as const,
  },
  /** 100μH 贴片功率电感 */
  SMD_100uH: {
    inductance: 100e-6,
    dcr: 0.5,
    qFactor: 15,
    srf: 10e6,
    ratedCurrent: 0.8,
    satCurrent: 1.2,
    package: 'shielded' as const,
    core: 'ferrite' as const,
  },
  /** 1μH 贴片电感 0603 */
  SMD_1uH_0603: {
    inductance: 1e-6,
    dcr: 0.05,
    qFactor: 30,
    srf: 200e6,
    ratedCurrent: 3.0,
    satCurrent: 4.0,
    package: '0603' as const,
    core: 'ferrite' as const,
  },
  /** 1mH 色环电感 */
  Axial_1mH: {
    inductance: 1e-3,
    dcr: 5,
    qFactor: 40,
    srf: 2e6,
    ratedCurrent: 0.1,
    satCurrent: 0.15,
    package: 'axial' as const,
    core: 'iron' as const,
  },
  /** 47μH 环形电感 */
  Toroidal_47uH: {
    inductance: 47e-6,
    dcr: 0.08,
    qFactor: 50,
    srf: 30e6,
    ratedCurrent: 5.0,
    satCurrent: 6.5,
    package: 'toroidal' as const,
    core: 'powdered_iron' as const,
  },
} as const;

/**
 * 电感串联总电感量
 *
 * L_total = L1 + L2 + ... + Ln（无互感时）
 *
 * @param inductors 各电感量数组 (H)
 * @returns 总电感量 (H)
 */
export function inductorSeries(inductors: number[]): number {
  return inductors.reduce((sum, l) => sum + l, 0);
}

/**
 * 电感并联总电感量
 *
 * 1/L_total = 1/L1 + 1/L2 + ... + 1/Ln（无互感时）
 *
 * @param inductors 各电感量数组 (H)
 * @returns 总电感量 (H)
 */
export function inductorParallel(inductors: number[]): number {
  if (inductors.length === 0) return 0;
  const reciprocalSum = inductors.reduce((sum, l) => sum + 1 / l, 0);
  return 1 / reciprocalSum;
}

/**
 * 电感感抗
 *
 * Xl = 2π × f × L
 *
 * @param frequency 频率 (Hz)
 * @param inductance 电感量 (H)
 * @returns 感抗 (Ω)
 */
export function inductiveReactance(frequency: number, inductance: number): number {
  return 2 * Math.PI * frequency * inductance;
}

/**
 * LR 时间常数
 *
 * τ = L / R
 *
 * @param inductance 电感量 (H)
 * @param resistance 阻值 (Ω)
 * @returns 时间常数 (s)
 */
export function lrTimeConstant(inductance: number, resistance: number): number {
  if (resistance <= 0) return Infinity;
  return inductance / resistance;
}

/**
 * 电感储能
 *
 * E = ½ × L × I²
 *
 * @param inductance 电感量 (H)
 * @param current 电流 (A)
 * @returns 储能 (J)
 */
export function inductorEnergy(inductance: number, current: number): number {
  return 0.5 * inductance * current * current;
}

/**
 * 电感阻抗（含 DCR 的完整模型）
 *
 * |Z| = √(DCR² + Xl²)
 * Xl = 2πfL
 *
 * @param frequency 频率 (Hz)
 * @param params 电感参数
 * @returns 阻抗幅值 (Ω)
 */
export function inductorImpedance(frequency: number, params: InductorParams): number {
  const xl = 2 * Math.PI * frequency * params.inductance;
  return Math.sqrt(params.dcr * params.dcr + xl * xl);
}

/**
 * 电感品质因数
 *
 * Q = Xl / DCR = 2πfL / R
 *
 * @param frequency 频率 (Hz)
 * @param params 电感参数
 * @returns 品质因数
 */
export function inductorQualityFactor(frequency: number, params: InductorParams): number {
  if (params.dcr <= 0) return Infinity;
  const xl = 2 * Math.PI * frequency * params.inductance;
  return xl / params.dcr;
}

/**
 * 电感是否饱和
 *
 * @param current 电流 (A)
 * @param params 电感参数
 * @returns 是否达到饱和
 */
export function inductorSaturated(current: number, params: InductorParams): boolean {
  return Math.abs(current) > params.satCurrent;
}

// ==================== 可变元件 ====================

/** 电位器参数 */
export interface PotentiometerParams {
  /** 总阻值 (Ω) */
  totalResistance: number;
  /** 公差 (%) */
  tolerance: number;
  /** 额定功率 (W) */
  powerRating: number;
  /** 行程圈数 */
  turns: number;
  /** 线性类型 */
  taper: 'linear' | 'logarithmic' | 'antilog';
  /** 分辨率 (Ω) */
  resolution: number;
}

/** 常见电位器型号 */
export const POTENTIOMETER_MODELS = {
  '10K_Linear': {
    totalResistance: 10000,
    tolerance: 20,
    powerRating: 0.05,
    turns: 1,
    taper: 'linear' as const,
    resolution: 100,
  },
  '100K_Log': {
    totalResistance: 100000,
    tolerance: 20,
    powerRating: 0.05,
    turns: 1,
    taper: 'logarithmic' as const,
    resolution: 1000,
  },
  '10K_10Turn': {
    totalResistance: 10000,
    tolerance: 5,
    powerRating: 0.5,
    turns: 10,
    taper: 'linear' as const,
    resolution: 10,
  },
} as const;

/**
 * 电位器分压计算
 *
 * V_out = V_in × (wiper_position / 1.0)
 *
 * @param vIn 输入电压 (V)
 * @param wiperPosition 旋钮位置 (0-1)
 * @param taper 线性类型
 * @returns 分压输出 (V)
 */
export function potentiometerVoltage(
  vIn: number,
  wiperPosition: number,
  taper: PotentiometerParams['taper'] = 'linear'
): number {
  const pos = Math.max(0, Math.min(1, wiperPosition));
  let ratio: number;
  switch (taper) {
    case 'logarithmic':
      ratio = Math.log10(1 + 9 * pos); // 0→0, 1→1, 中间对数
      break;
    case 'antilog':
      ratio = 1 - Math.log10(1 + 9 * (1 - pos));
      break;
    default:
      ratio = pos;
  }
  return vIn * ratio;
}

/**
 * 电位器各段阻值
 *
 * @param wiperPosition 旋钮位置 (0-1)
 * @param params 电位器参数
 * @returns { r1: 上段阻值, r2: 下段阻值 }
 */
export function potentiometerResistance(
  wiperPosition: number,
  params: PotentiometerParams = POTENTIOMETER_MODELS['10K_Linear']
): { r1: number; r2: number } {
  const pos = Math.max(0, Math.min(1, wiperPosition));
  return {
    r1: params.totalResistance * pos,
    r2: params.totalResistance * (1 - pos),
  };
}

/**
 * 可变电容容值计算
 *
 * C(θ) = C_min + (C_max - C_min) × (θ / θ_max)
 *
 * @param angle 旋钮角度
 * @param maxAngle 最大角度
 * @param cMin 最小容值 (F)
 * @param cMax 最大容值 (F)
 * @returns 当前容值 (F)
 */
export function variableCapacitance(
  angle: number,
  maxAngle: number = 180,
  cMin: number = 10e-12,
  cMax: number = 100e-12
): number {
  const ratio = Math.max(0, Math.min(1, angle / maxAngle));
  return cMin + (cMax - cMin) * ratio;
}

// ==================== 电压基准（Voltage Reference） ====================

/** 电压基准参数 */
export interface VoltageRefParams {
  /** 输出基准电压 (V) */
  outputVoltage: number;
  /** 初始精度 (%) */
  initialAccuracy: number;
  /** 温度系数 (ppm/°C) */
  tempCoeff: number;
  /** 工作电流范围 */
  currentRange: { min: number; max: number };
  /** 最小工作电压 (V) */
  minInputVoltage: number;
  /** 最大工作电压 (V) */
  maxInputVoltage: number;
  /** 输出噪声 (μVrms @ 10Hz~10kHz) */
  outputNoise: number;
  /** 长期稳定性 (ppm/1000h) */
  longTermStability: number;
  /** 负载调整率 (mV/mA) */
  loadRegulation: number;
  /** 线性调整率 (mV/V) */
  lineRegulation: number;
  /** 型号名称 */
  modelName: string;
}

/** 常见电压基准型号 */
export const VOLTAGE_REF_MODELS: Record<string, VoltageRefParams> = {
  /** TL431 可调精密基准 2.5V */
  'TL431_2V5': {
    outputVoltage: 2.5,
    initialAccuracy: 0.5,
    tempCoeff: 30,
    currentRange: { min: 1, max: 100 },
    minInputVoltage: 2.5,
    maxInputVoltage: 37,
    outputNoise: 150,
    longTermStability: 20,
    loadRegulation: 0.5,
    lineRegulation: 0.5,
    modelName: 'TL431',
  },
  /** REF3025 低功耗 2.5V 基准 */
  'REF3025': {
    outputVoltage: 2.5,
    initialAccuracy: 0.2,
    tempCoeff: 21,
    currentRange: { min: 0.005, max: 25 },
    minInputVoltage: 2.7,
    maxInputVoltage: 5.5,
    outputNoise: 28,
    longTermStability: 24,
    loadRegulation: 0.05,
    lineRegulation: 0.02,
    modelName: 'REF3025',
  },
  /** LM4040 2.5V 精密基准 */
  'LM4040_2V5': {
    outputVoltage: 2.5,
    initialAccuracy: 0.1,
    tempCoeff: 15,
    currentRange: { min: 0.06, max: 15 },
    minInputVoltage: 2.5,
    maxInputVoltage: 12,
    outputNoise: 35,
    longTermStability: 30,
    loadRegulation: 0.02,
    lineRegulation: 0.01,
    modelName: 'LM4040',
  },
  /** AD580 2.5V 带隙基准 */
  'AD580': {
    outputVoltage: 2.5,
    initialAccuracy: 0.1,
    tempCoeff: 10,
    currentRange: { min: 0.5, max: 10 },
    minInputVoltage: 4.5,
    maxInputVoltage: 30,
    outputNoise: 20,
    longTermStability: 25,
    loadRegulation: 0.01,
    lineRegulation: 0.005,
    modelName: 'AD580',
  },
};

/** 默认电压基准参数 */
export const DEFAULT_VOLTAGE_REF_PARAMS: VoltageRefParams = VOLTAGE_REF_MODELS['TL431_2V5'];

/**
 * 电压基准输出电压（考虑温度漂移）
 *
 * Vout = Vref × (1 + TCR × (T - 25) / 1e6)
 *
 * @param temperature 温度 (°C)
 * @param params 基准参数
 * @returns 实际输出电压 (V)
 */
export function voltageRefOutput(
  temperature: number = 25,
  params: VoltageRefParams = DEFAULT_VOLTAGE_REF_PARAMS
): number {
  const deltaT = temperature - 25;
  return params.outputVoltage * (1 + params.tempCoeff * deltaT / 1e6);
}

/**
 * 电压基准分压电阻计算（TL431 可调输出）
 *
 * Vout = Vref × (1 + R1/R2)
 *
 * @param targetOutput 目标输出电压 (V)
 * @param vRef 内部基准电压 (V)
 * @param r2 下臂电阻 (Ω)
 * @returns 上臂电阻 R1 (Ω)
 */
export function voltageRefDividerResistor(
  targetOutput: number,
  vRef: number = 2.5,
  r2: number = 10000
): number {
  if (vRef <= 0) return Infinity;
  return r2 * (targetOutput / vRef - 1);
}

// ==================== 磁珠（Ferrite Bead） ====================

/** 磁珠参数 */
export interface FerriteBeadParams {
  /** 阻抗 (Ω) @ 100MHz */
  impedance100MHz: number;
  /** 直流电阻 (mΩ) */
  dcr: number;
  /** 额定电流 (A) */
  ratedCurrent: number;
  /** 频率范围 */
  freqRange: { min: number; max: number };
  /** 自谐振频率 (MHz) */
  selfResonantFreq: number;
  /** 等效电路：R (Ω) */
  equivalentR: number;
  /** 等效电路：L (nH) */
  equivalentL: number;
  /** 等效电路：C (pF) */
  equivalentC: number;
  /** 封装 */
  package: '0402' | '0603' | '0805' | '1206' | 'axial';
  /** 型号名称 */
  modelName: string;
}

/** 常见磁珠型号 */
export const FERRITE_BEAD_MODELS: Record<string, FerriteBeadParams> = {
  /** BLM18PG221SH1 0603 封装 @ 100MHz */
  'BLM18PG221': {
    impedance100MHz: 220,
    dcr: 150,
    ratedCurrent: 0.5,
    freqRange: { min: 1e6, max: 1e9 },
    selfResonantFreq: 200,
    equivalentR: 220,
    equivalentL: 500,
    equivalentC: 0.3,
    package: '0603',
    modelName: 'BLM18PG221',
  },
  /** BLM21PG601 0805 封装 */
  'BLM21PG601': {
    impedance100MHz: 600,
    dcr: 100,
    ratedCurrent: 1.5,
    freqRange: { min: 1e6, max: 1e9 },
    selfResonantFreq: 150,
    equivalentR: 600,
    equivalentL: 800,
    equivalentC: 0.5,
    package: '0805',
    modelName: 'BLM21PG601',
  },
  /** MPZ2012S221A 1206 封装大电流 */
  'MPZ2012S221': {
    impedance100MHz: 220,
    dcr: 40,
    ratedCurrent: 3.0,
    freqRange: { min: 1e6, max: 1e9 },
    selfResonantFreq: 250,
    equivalentR: 220,
    equivalentL: 300,
    equivalentC: 0.2,
    package: '1206',
    modelName: 'MPZ2012S221',
  },
  /** FB-30 信号线用轴向磁珠 */
  'FB_30': {
    impedance100MHz: 30,
    dcr: 10,
    ratedCurrent: 6.0,
    freqRange: { min: 1e6, max: 500e6 },
    selfResonantFreq: 500,
    equivalentR: 30,
    equivalentL: 100,
    equivalentC: 0.1,
    package: 'axial',
    modelName: 'FB-30',
  },
};

/** 默认磁珠参数 */
export const DEFAULT_FERRITE_BEAD_PARAMS: FerriteBeadParams = FERRITE_BEAD_MODELS['BLM18PG221'];

/**
 * 磁珠频率-阻抗特性
 *
 * 简化等效电路模型：Z(f) = R + jωL + 1/(jωC)
 *
 * @param frequency 频率 (Hz)
 * @param params 磁珠参数
 * @returns 阻抗幅值 (Ω)
 */
export function ferriteBeadImpedance(
  frequency: number,
  params: FerriteBeadParams = DEFAULT_FERRITE_BEAD_PARAMS
): number {
  const omega = 2 * Math.PI * frequency;
  const L = params.equivalentL * 1e-9; // nH → H
  const C = params.equivalentC * 1e-12; // pF → F
  const XL = omega * L;
  const XC = 1 / (omega * C);
  // 阻抗 = √(R² + (XL - XC)²)，但磁珠主要表现为 R
  return Math.sqrt(params.equivalentR * params.equivalentR + (XL - XC) * (XL - XC));
}

/**
 * 磁珠 EMI 滤波衰减估算
 *
 * 衰减量 (dB) ≈ 20 × log10((R_load + Z_bead) / R_load)
 *
 * @param frequency 频率 (Hz)
 * @param loadResistance 负载阻抗 (Ω)
 * @param params 磁珠参数
 * @returns 衰减量 (dB)
 */
export function ferriteBeadAttenuation(
  frequency: number,
  loadResistance: number,
  params: FerriteBeadParams = DEFAULT_FERRITE_BEAD_PARAMS
): number {
  const zBead = ferriteBeadImpedance(frequency, params);
  if (loadResistance <= 0) return 0;
  return 20 * Math.log10((loadResistance + zBead) / loadResistance);
}

// ==================== 扩展被动元件（变压器、保险丝、色环电阻、MOV等） ====================

export type { TransformerParams, FuseParams, MOVParams } from './passive-extended';
export {
  TRANSFORMER_MODELS,
  DEFAULT_TRANSFORMER_PARAMS,
  transformerSecondaryVoltage,
  transformerImpedanceTransform,
  FUSE_MODELS,
  DEFAULT_FUSE_PARAMS,
  fuseBlowTime,
  COLOR_BAND_VALUES,
  COLOR_BAND_MULTIPLIER,
  COLOR_BAND_TOLERANCE,
  decode4BandResistor,
  decode5BandResistor,
  resistorToColorBands,
  NTC_EXTENDED_MODELS,
  ntcResistanceToTempSimplified,
  ntcTempToResistanceSimplified,
  MOV_MODELS,
  ntcDividerVoltageToTemp,
  ntcDividerTempToVoltage,
} from './passive-extended';
