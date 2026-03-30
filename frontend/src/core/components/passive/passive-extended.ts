/**
 * 扩展被动元件定义
 *
 * 变压器、保险丝、热敏电阻(NTC/PTC扩展)、可变电阻、色环电阻
 */

// ==================== 变压器 ====================

/** 变压器参数 */
export interface TransformerParams {
  /** 初级电压 (V) */
  primaryVoltage: number;
  /** 次级电压 (V) */
  secondaryVoltage: number;
  /** 匝数比 */
  turnsRatio: number;
  /** 额定功率 (VA) */
  ratedPower: number;
  /** 效率 (%) */
  efficiency: number;
  /** 初级电阻 (Ω) */
  primaryResistance: number;
  /** 次级电阻 (Ω) */
  secondaryResistance: number;
  /** 初级电感 (H) */
  primaryInductance: number;
  /** 漏感 (H) */
  leakageInductance: number;
  /** 工作频率 (Hz) */
  operatingFreq: number;
  /** 类型 */
  type: 'step_down' | 'step_up' | 'isolation' | 'pulse';
}

export const TRANSFORMER_MODELS: Record<string, TransformerParams> = {
  'EI_220_12': {
    primaryVoltage: 220, secondaryVoltage: 12, turnsRatio: 18.33,
    ratedPower: 10, efficiency: 90, primaryResistance: 50, secondaryResistance: 0.5,
    primaryInductance: 2, leakageInductance: 0.01, operatingFreq: 50, type: 'step_down',
  },
  'EI_220_5': {
    primaryVoltage: 220, secondaryVoltage: 5, turnsRatio: 44,
    ratedPower: 5, efficiency: 88, primaryResistance: 80, secondaryResistance: 0.2,
    primaryInductance: 3, leakageInductance: 0.015, operatingFreq: 50, type: 'step_down',
  },
  'EE_12_5': {
    primaryVoltage: 12, secondaryVoltage: 5, turnsRatio: 2.4,
    ratedPower: 3, efficiency: 92, primaryResistance: 2, secondaryResistance: 0.3,
    primaryInductance: 0.5, leakageInductance: 0.005, operatingFreq: 100000, type: 'step_down',
  },
  'PULSE_1_1': {
    primaryVoltage: 5, secondaryVoltage: 5, turnsRatio: 1,
    ratedPower: 1, efficiency: 95, primaryResistance: 0.5, secondaryResistance: 0.5,
    primaryInductance: 0.001, leakageInductance: 0.0001, operatingFreq: 1000000, type: 'isolation',
  },
  'BOOST_3V3_12': {
    primaryVoltage: 3.3, secondaryVoltage: 12, turnsRatio: 0.275,
    ratedPower: 2, efficiency: 85, primaryResistance: 0.1, secondaryResistance: 5,
    primaryInductance: 0.0001, leakageInductance: 0.00001, operatingFreq: 200000, type: 'step_up',
  },
};

export const DEFAULT_TRANSFORMER_PARAMS = TRANSFORMER_MODELS['EI_220_12'];

/** 变压器次级电压计算 */
export function transformerSecondaryVoltage(
  primaryVoltage: number, params: TransformerParams = DEFAULT_TRANSFORMER_PARAMS
): number {
  return primaryVoltage / params.turnsRatio * (params.efficiency / 100);
}

/** 变压器阻抗变换 */
export function transformerImpedanceTransform(
  impedance: number, params: TransformerParams = DEFAULT_TRANSFORMER_PARAMS
): number {
  return impedance * params.turnsRatio * params.turnsRatio;
}

// ==================== 保险丝 ====================

/** 保险丝参数 */
export interface FuseParams {
  /** 额定电流 (A) */
  ratedCurrent: number;
  /** 额定电压 (V) */
  ratedVoltage: number;
  /** 熔断特性 */
  blowCharacteristic: 'fast' | 'slow' | 'time_delay';
  /** I²t 值 (A²s) */
  i2t: number;
  /** 分断能力 (A) */
  breakingCapacity: number;
  /** 内阻 (mΩ) */
  resistance: number;
  /** 封装 */
  package: 'glass_5x20' | 'glass_6x30' | 'ceramic' | 'SMD_0805' | 'SMD_1206' | 'blade_auto' | 'PTC_resettable';
}

export const FUSE_MODELS: Record<string, FuseParams> = {
  'G5x20_1A': { ratedCurrent: 1, ratedVoltage: 250, blowCharacteristic: 'fast', i2t: 0.01, breakingCapacity: 1500, resistance: 150, package: 'glass_5x20' },
  'G5x20_2A': { ratedCurrent: 2, ratedVoltage: 250, blowCharacteristic: 'fast', i2t: 0.08, breakingCapacity: 1500, resistance: 60, package: 'glass_5x20' },
  'G5x20_5A': { ratedCurrent: 5, ratedVoltage: 250, blowCharacteristic: 'slow', i2t: 2.5, breakingCapacity: 1500, resistance: 15, package: 'glass_5x20' },
  'SMD_0805_1A': { ratedCurrent: 1, ratedVoltage: 32, blowCharacteristic: 'fast', i2t: 0.005, breakingCapacity: 50, resistance: 200, package: 'SMD_0805' },
  'SMD_1206_2A': { ratedCurrent: 2, ratedVoltage: 32, blowCharacteristic: 'fast', i2t: 0.04, breakingCapacity: 50, resistance: 50, package: 'SMD_1206' },
  'PTC_0805_050': { ratedCurrent: 0.5, ratedVoltage: 30, blowCharacteristic: 'time_delay', i2t: 0, breakingCapacity: 40, resistance: 500, package: 'PTC_resettable' },
  'PTC_1206_100': { ratedCurrent: 1.0, ratedVoltage: 30, blowCharacteristic: 'time_delay', i2t: 0, breakingCapacity: 40, resistance: 200, package: 'PTC_resettable' },
  'AUTO_ATC_10A': { ratedCurrent: 10, ratedVoltage: 32, blowCharacteristic: 'fast', i2t: 20, breakingCapacity: 1000, resistance: 5, package: 'blade_auto' },
  'AUTO_ATC_15A': { ratedCurrent: 15, ratedVoltage: 32, blowCharacteristic: 'fast', i2t: 45, breakingCapacity: 1000, resistance: 3, package: 'blade_auto' },
  'AUTO_ATC_20A': { ratedCurrent: 20, ratedVoltage: 32, blowCharacteristic: 'slow', i2t: 80, breakingCapacity: 1000, resistance: 2, package: 'blade_auto' },
};

export const DEFAULT_FUSE_PARAMS = FUSE_MODELS['G5x20_1A'];

/** 保险丝熔断时间估算 (ms) */
export function fuseBlowTime(current: number, params: FuseParams = DEFAULT_FUSE_PARAMS): number {
  if (current <= params.ratedCurrent) return Infinity;
  const ratio = current / params.ratedCurrent;
  if (params.blowCharacteristic === 'fast') return Math.max(0.1, 100 / (ratio * ratio));
  return Math.max(10, 10000 / (ratio * ratio));
}

// ==================== 色环电阻 ====================

export type ResistorBandColor = 'black' | 'brown' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'violet' | 'grey' | 'white' | 'gold' | 'silver';

export const COLOR_BAND_VALUES: Record<ResistorBandColor, number> = {
  black: 0, brown: 1, red: 2, orange: 3, yellow: 4,
  green: 5, blue: 6, violet: 7, grey: 8, white: 9, gold: -1, silver: -2,
};

export const COLOR_BAND_MULTIPLIER: Record<ResistorBandColor, number> = {
  black: 1, brown: 10, red: 100, orange: 1e3, yellow: 1e4,
  green: 1e5, blue: 1e6, violet: 1e7, grey: 1e8, white: 1e9, gold: 0.1, silver: 0.01,
};

export const COLOR_BAND_TOLERANCE: Record<ResistorBandColor, number> = {
  brown: 1, red: 2, green: 0.5, blue: 0.25, violet: 0.1, grey: 0.05, gold: 5, silver: 10,
  black: 0, orange: 0, yellow: 0, white: 0,
};

/** 4色环电阻解码 */
export function decode4BandResistor(bands: ResistorBandColor[]): { resistance: number; tolerance: number } | null {
  if (bands.length < 4) return null;
  const d1 = COLOR_BAND_VALUES[bands[0]];
  const d2 = COLOR_BAND_VALUES[bands[1]];
  const mult = COLOR_BAND_MULTIPLIER[bands[2]];
  const tol = COLOR_BAND_TOLERANCE[bands[3]];
  if (d1 === undefined || d2 === undefined || mult === undefined) return null;
  return { resistance: (d1 * 10 + d2) * mult, tolerance: tol };
}

/** 5色环电阻解码 */
export function decode5BandResistor(bands: ResistorBandColor[]): { resistance: number; tolerance: number } | null {
  if (bands.length < 5) return null;
  const d1 = COLOR_BAND_VALUES[bands[0]];
  const d2 = COLOR_BAND_VALUES[bands[1]];
  const d3 = COLOR_BAND_VALUES[bands[2]];
  const mult = COLOR_BAND_MULTIPLIER[bands[3]];
  const tol = COLOR_BAND_TOLERANCE[bands[4]];
  if (d1 === undefined || d2 === undefined || d3 === undefined || mult === undefined) return null;
  return { resistance: (d1 * 100 + d2 * 10 + d3) * mult, tolerance: tol };
}

/** 电阻值转色环 */
export function resistorToColorBands(resistance: number, tolerance: number = 5): ResistorBandColor[] {
  const tolColor = (Object.entries(COLOR_BAND_TOLERANCE) as [ResistorBandColor, number][])
    .find(([, v]) => v === tolerance)?.[0] ?? 'gold';
  const str = String(Math.round(resistance));
  const digits = str.replace(/0+$/, '');
  const trailingZeros = str.length - digits.length;
  if (digits.length <= 2) {
    return [
      COLOR_BAND_VALUES[digits[0]] !== undefined ? Object.keys(COLOR_BAND_VALUES)[parseInt(digits[0])] as ResistorBandColor : 'black',
      COLOR_BAND_VALUES[digits[1]] !== undefined ? Object.keys(COLOR_BAND_VALUES)[parseInt(digits[1])] as ResistorBandColor : 'black',
      Object.keys(COLOR_BAND_VALUES)[trailingZeros] as ResistorBandColor || 'black',
      tolColor,
    ];
  }
  return [
    Object.keys(COLOR_BAND_VALUES)[parseInt(digits[0])] as ResistorBandColor,
    Object.keys(COLOR_BAND_VALUES)[parseInt(digits[1])] as ResistorBandColor,
    Object.keys(COLOR_BAND_VALUES)[trailingZeros] as ResistorBandColor,
    tolColor,
  ];
}

// ==================== NTC 扩展型号 ====================

export const NTC_EXTENDED_MODELS: Record<string, { resistance: number; beta: number; tolerance: number }> = {
  'NTC_100K_B3950': { resistance: 100000, beta: 3950, tolerance: 1 },
  'NTC_10K_B3435': { resistance: 10000, beta: 3435, tolerance: 1 },
  'NTC_4K7_B3380': { resistance: 4700, beta: 3380, tolerance: 2 },
  'NTC_100R_B3100': { resistance: 100, beta: 3100, tolerance: 5 },
  'NTC_50K_B4100': { resistance: 50000, beta: 4100, tolerance: 1 },
};

/** NTC 电阻到温度 (简化 B 值方程) */
export function ntcResistanceToTempSimplified(r: number, r0: number, beta: number, t0: number = 298.15): number {
  return 1 / (1 / t0 + Math.log(r / r0) / beta) - 273.15;
}

/** NTC 温度到电阻 (简化 B 值方程) */
export function ntcTempToResistanceSimplified(tempC: number, r0: number, beta: number, t0: number = 298.15): number {
  const t = tempC + 273.15;
  return r0 * Math.exp(beta * (1 / t - 1 / t0));
}

// ==================== 压敏电阻 (MOV) ====================

export interface MOVParams {
  ratedVoltage: number;
  clampingVoltage: number;
  maxEnergy: number;
  capacitance: number;
  responseTime: number;
}

export const MOV_MODELS: Record<string, MOVParams> = {
  'MOV_7V': { ratedVoltage: 7, clampingVoltage: 14, maxEnergy: 0.1, capacitance: 800e-12, responseTime: 25 },
  'MOV_14V': { ratedVoltage: 14, clampingVoltage: 28, maxEnergy: 0.4, capacitance: 500e-12, responseTime: 25 },
  'MOV_20V': { ratedVoltage: 20, clampingVoltage: 40, maxEnergy: 1.0, capacitance: 300e-12, responseTime: 25 },
  'MOV_130V': { ratedVoltage: 130, clampingVoltage: 260, maxEnergy: 40, capacitance: 100e-12, responseTime: 25 },
  'MOV_275V': { ratedVoltage: 275, clampingVoltage: 550, maxEnergy: 100, capacitance: 50e-12, responseTime: 25 },
};

// ==================== 热敏电阻分压器计算 ====================

/** NTC 分压器：电压转温度 */
export function ntcDividerVoltageToTemp(vOut: number, vcc: number, rSeries: number, r0: number, beta: number): number {
  if (vOut <= 0 || vOut >= vcc) return -273.15;
  const rNtc = rSeries * vOut / (vcc - vOut);
  return ntcResistanceToTempSimplified(rNtc, r0, beta);
}

/** NTC 分压器：温度转电压 */
export function ntcDividerTempToVoltage(tempC: number, vcc: number, rSeries: number, r0: number, beta: number): number {
  const rNtc = ntcTempToResistanceSimplified(tempC, r0, beta);
  return vcc * rNtc / (rSeries + rNtc);
}
