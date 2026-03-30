/**
 * 扩展振荡器元件定义
 *
 * 陶瓷谐振器、RC振荡器、硅振荡器、TCXO、VCXO
 */

// ==================== 陶瓷谐振器 ====================

export interface CeramicResonatorParams {
  frequency: number;
  loadCapacitance: number;
  frequencyTolerance: number;
  freqStability: number;
  builtInCaps: boolean;
  equivalentESR: number;
}

export const CERAMIC_RESONATOR_MODELS: Record<string, CeramicResonatorParams> = {
  'CSTCR_8M00': { frequency: 8000000, loadCapacitance: 15, frequencyTolerance: 0.5, freqStability: 0.3, builtInCaps: true, equivalentESR: 50 },
  'CSTCR_12M00': { frequency: 12000000, loadCapacitance: 15, frequencyTolerance: 0.5, freqStability: 0.3, builtInCaps: true, equivalentESR: 40 },
  'CSTCR_16M00': { frequency: 16000000, loadCapacitance: 15, frequencyTolerance: 0.5, freqStability: 0.3, builtInCaps: true, equivalentESR: 30 },
  'CSTCR_20M00': { frequency: 20000000, loadCapacitance: 15, frequencyTolerance: 0.5, freqStability: 0.3, builtInCaps: true, equivalentESR: 25 },
  'ZTT_4M00': { frequency: 4000000, loadCapacitance: 30, frequencyTolerance: 0.5, freqStability: 0.3, builtInCaps: false, equivalentESR: 60 },
  'ZTT_8M00': { frequency: 8000000, loadCapacitance: 30, frequencyTolerance: 0.5, freqStability: 0.3, builtInCaps: false, equivalentESR: 40 },
};

export const DEFAULT_CERAMIC_RESONATOR = CERAMIC_RESONATOR_MODELS['CSTCR_8M00'];

/** 陶瓷谐振器启动时间 (比晶振快) */
export function ceramicResonatorStartupTime(params: CeramicResonatorParams = DEFAULT_CERAMIC_RESONATOR): number {
  return 0.5 + params.frequency / 1e6 * 0.01; // ms
}

// ==================== 硅振荡器 ====================

export interface SiliconOscillatorParams {
  frequency: number;
  frequencyTolerance: number;
  tempStability: number;
  supplyVoltage: { min: number; max: number; typical: number };
  currentDraw: number;
  outputType: 'CMOS' | 'LVCMOS' | 'LVDS';
  jitter: number;
  startupTime: number;
  spreadSpectrum: boolean;
}

export const SILICON_OSC_MODELS: Record<string, SiliconOscillatorParams> = {
  'LTC6900_1M': { frequency: 1000000, frequencyTolerance: 0.5, tempStability: 0.1, supplyVoltage: { min: 2.7, max: 5.5, typical: 3.3 }, currentDraw: 0.5, outputType: 'CMOS', jitter: 30, startupTime: 0.1, spreadSpectrum: false },
  'LTC6900_10M': { frequency: 10000000, frequencyTolerance: 0.5, tempStability: 0.1, supplyVoltage: { min: 2.7, max: 5.5, typical: 3.3 }, currentDraw: 0.5, outputType: 'CMOS', jitter: 30, startupTime: 0.1, spreadSpectrum: false },
  'Si501_25M': { frequency: 25000000, frequencyTolerance: 0.1, tempStability: 0.02, supplyVoltage: { min: 1.8, max: 3.6, typical: 3.3 }, currentDraw: 4, outputType: 'LVCMOS', jitter: 10, startupTime: 0.01, spreadSpectrum: false },
  'Si5351_14M': { frequency: 14000000, frequencyTolerance: 0.01, tempStability: 0.005, supplyVoltage: { min: 2.5, max: 3.6, typical: 3.3 }, currentDraw: 30, outputType: 'LVCMOS', jitter: 5, startupTime: 0.5, spreadSpectrum: false },
  'MAX7375_8M': { frequency: 8000000, frequencyTolerance: 0.2, tempStability: 0.05, supplyVoltage: { min: 2.7, max: 5.5, typical: 3.3 }, currentDraw: 1.5, outputType: 'CMOS', jitter: 20, startupTime: 0.05, spreadSpectrum: true },
};

// ==================== TCXO (温补晶振) ====================

export interface TCXOParams {
  frequency: number;
  frequencyTolerance: number;
  tempStability: number;
  supplyVoltage: number;
  currentDraw: number;
  outputType: 'clipped_sine' | 'CMOS' | 'LVCMOS';
  phaseNoise: number;
  agingRate: number;
}

export const TCXO_MODELS: Record<string, TCXOParams> = {
  'TCXO_10M': { frequency: 10000000, frequencyTolerance: 0.5, tempStability: 1.0, supplyVoltage: 3.3, currentDraw: 2, outputType: 'clipped_sine', phaseNoise: -140, agingRate: 1 },
  'TCXO_26M': { frequency: 26000000, frequencyTolerance: 0.5, tempStability: 0.5, supplyVoltage: 3.3, currentDraw: 2, outputType: 'clipped_sine', phaseNoise: -135, agingRate: 1 },
  'TCXO_32M': { frequency: 32000000, frequencyTolerance: 0.5, tempStability: 0.5, supplyVoltage: 3.3, currentDraw: 3, outputType: 'CMOS', phaseNoise: -130, agingRate: 2 },
  'TCXO_40M': { frequency: 40000000, frequencyTolerance: 0.5, tempStability: 0.28, supplyVoltage: 3.3, currentDraw: 3, outputType: 'CMOS', phaseNoise: -128, agingRate: 1 },
};

// ==================== VCXO (压控晶振) ====================

export interface VCXOParams {
  frequency: number;
  pullRange: number;
  controlVoltage: { min: number; max: number };
  supplyVoltage: number;
  currentDraw: number;
  tempStability: number;
  modulationBandwidth: number;
}

export const VCXO_MODELS: Record<string, VCXOParams> = {
  'VCXO_12M': { frequency: 12000000, pullRange: 100, controlVoltage: { min: 0.3, max: 3.0 }, supplyVoltage: 3.3, currentDraw: 10, tempStability: 50, modulationBandwidth: 10000 },
  'VCXO_25M': { frequency: 25000000, pullRange: 50, controlVoltage: { min: 0.3, max: 3.0 }, supplyVoltage: 3.3, currentDraw: 12, tempStability: 30, modulationBandwidth: 12000 },
  'VCXO_48M': { frequency: 48000000, pullRange: 30, controlVoltage: { min: 0.5, max: 2.5 }, supplyVoltage: 3.3, currentDraw: 15, tempStability: 20, modulationBandwidth: 15000 },
};

/** 晶振频率拉偏 (VCXO) */
export function vcxoFrequency(controlVoltage: number, params: VCXOParams): number {
  const range = params.controlVoltage.max - params.controlVoltage.min;
  const center = params.controlVoltage.min + range / 2;
  const ratio = (controlVoltage - center) / (range / 2);
  return params.frequency * (1 + ratio * params.pullRange / 1e6);
}
