/**
 * 扩展集成电路定义
 *
 * 74HC系列逻辑IC、运算放大器、比较器、模拟开关、多路复用器
 */

// ==================== 74HC 系列逻辑 IC ====================

export interface LogicICParams {
  function: string;
  inputCount: number;
  outputCount: number;
  propagationDelay: number;
  maxFreq: number;
  supplyRange: { min: number; max: number };
  quiescentCurrent: number;
  outputDrive: number;
  pins: number;
  model: string;
}

export const LOGIC_74HC_MODELS: Record<string, LogicICParams> = {
  '74HC00': { function: 'NAND', inputCount: 4, outputCount: 4, propagationDelay: 8, maxFreq: 25, supplyRange: { min: 2, max: 6 }, quiescentCurrent: 20, outputDrive: 6, pins: 14, model: '74HC00' },
  '74HC04': { function: 'NOT', inputCount: 6, outputCount: 6, propagationDelay: 8, maxFreq: 25, supplyRange: { min: 2, max: 6 }, quiescentCurrent: 20, outputDrive: 6, pins: 14, model: '74HC04' },
  '74HC08': { function: 'AND', inputCount: 4, outputCount: 4, propagationDelay: 8, maxFreq: 25, supplyRange: { min: 2, max: 6 }, quiescentCurrent: 20, outputDrive: 6, pins: 14, model: '74HC08' },
  '74HC32': { function: 'OR', inputCount: 4, outputCount: 4, propagationDelay: 8, maxFreq: 25, supplyRange: { min: 2, max: 6 }, quiescentCurrent: 20, outputDrive: 6, pins: 14, model: '74HC32' },
  '74HC86': { function: 'XOR', inputCount: 4, outputCount: 4, propagationDelay: 10, maxFreq: 25, supplyRange: { min: 2, max: 6 }, quiescentCurrent: 20, outputDrive: 6, pins: 14, model: '74HC86' },
  '74HC165': { function: 'PISO_SHIFT', inputCount: 8, outputCount: 2, propagationDelay: 16, maxFreq: 25, supplyRange: { min: 2, max: 6 }, quiescentCurrent: 80, outputDrive: 6, pins: 16, model: '74HC165' },
  '74HC595': { function: 'SIPO_SHIFT', inputCount: 3, outputCount: 8, propagationDelay: 22, maxFreq: 25, supplyRange: { min: 2, max: 6 }, quiescentCurrent: 80, outputDrive: 6, pins: 16, model: '74HC595' },
  '74HC138': { function: 'DECODER_3TO8', inputCount: 6, outputCount: 8, propagationDelay: 12, maxFreq: 25, supplyRange: { min: 2, max: 6 }, quiescentCurrent: 80, outputDrive: 6, pins: 16, model: '74HC138' },
  '74HC157': { function: 'MUX_2TO1', inputCount: 8, outputCount: 4, propagationDelay: 10, maxFreq: 25, supplyRange: { min: 2, max: 6 }, quiescentCurrent: 80, outputDrive: 6, pins: 16, model: '74HC157' },
  '74HC245': { function: 'OCTAL_BUS_TRANSCEIVER', inputCount: 8, outputCount: 8, propagationDelay: 8, maxFreq: 25, supplyRange: { min: 2, max: 6 }, quiescentCurrent: 80, outputDrive: 6, pins: 20, model: '74HC245' },
  '74HC373': { function: 'OCTAL_LATCH', inputCount: 8, outputCount: 8, propagationDelay: 14, maxFreq: 25, supplyRange: { min: 2, max: 6 }, quiescentCurrent: 80, outputDrive: 6, pins: 20, model: '74HC373' },
  '74HC573': { function: 'OCTAL_LATCH', inputCount: 8, outputCount: 8, propagationDelay: 14, maxFreq: 25, supplyRange: { min: 2, max: 6 }, quiescentCurrent: 80, outputDrive: 6, pins: 20, model: '74HC573' },
};

// ==================== 运算放大器扩展 ====================

export interface OpAmpParams {
  gainBandwidth: number;
  slewRate: number;
  inputOffsetVoltage: number;
  inputBiasCurrent: number;
  supplyRange: { min: number; max: number };
  quiescentCurrent: number;
  railToRail: boolean;
  channels: number;
  noise: number;
  model: string;
}

export const OPA_MODELS: Record<string, OpAmpParams> = {
  'LM358': { gainBandwidth: 1000000, slewRate: 0.3, inputOffsetVoltage: 5000, inputBiasCurrent: 45, supplyRange: { min: 3, max: 32 }, quiescentCurrent: 500, railToRail: false, channels: 2, noise: 40, model: 'LM358' },
  'LM324': { gainBandwidth: 1000000, slewRate: 0.3, inputOffsetVoltage: 5000, inputBiasCurrent: 45, supplyRange: { min: 3, max: 32 }, quiescentCurrent: 500, railToRail: false, channels: 4, noise: 40, model: 'LM324' },
  'TL072': { gainBandwidth: 3000000, slewRate: 13, inputOffsetVoltage: 3000, inputBiasCurrent: 0.065, supplyRange: { min: 7, max: 36 }, quiescentCurrent: 1400, railToRail: false, channels: 2, noise: 18, model: 'TL072' },
  'TL074': { gainBandwidth: 3000000, slewRate: 13, inputOffsetVoltage: 3000, inputBiasCurrent: 0.065, supplyRange: { min: 7, max: 36 }, quiescentCurrent: 1400, railToRail: false, channels: 4, noise: 18, model: 'TL074' },
  'NE5532': { gainBandwidth: 10000000, slewRate: 9, inputOffsetVoltage: 500, inputBiasCurrent: 200, supplyRange: { min: 5, max: 15 }, quiescentCurrent: 4000, railToRail: false, channels: 2, noise: 5, model: 'NE5532' },
  'OP07': { gainBandwidth: 600000, slewRate: 0.3, inputOffsetVoltage: 30, inputBiasCurrent: 1.8, supplyRange: { min: 6, max: 36 }, quiescentCurrent: 2500, railToRail: false, channels: 1, noise: 9.6, model: 'OP07' },
  'MCP6002': { gainBandwidth: 1000000, slewRate: 0.6, inputOffsetVoltage: 4500, inputBiasCurrent: 0.001, supplyRange: { min: 1.8, max: 6 }, quiescentCurrent: 100, railToRail: true, channels: 2, noise: 28, model: 'MCP6002' },
  'LMV358': { gainBandwidth: 1000000, slewRate: 0.3, inputOffsetVoltage: 4000, inputBiasCurrent: 10, supplyRange: { min: 2.7, max: 5.5 }, quiescentCurrent: 120, railToRail: true, channels: 2, noise: 39, model: 'LMV358' },
};

/** 运放同相放大增益 */
export function opAmpNonInvertingGain(rf: number, rg: number): number {
  return 1 + rf / rg;
}

/** 运放反相放大增益 */
export function opAmpInvertingGain(rf: number, rin: number): number {
  return -rf / rin;
}

/** 运放带宽 (闭环) */
export function opAmpClosedLoopBandwidth(gbw: number, gain: number): number {
  return gbw / gain;
}

// ==================== 比较器扩展 ====================

export interface ComparatorParams {
  responseTime: number;
  inputOffsetVoltage: number;
  inputBiasCurrent: number;
  supplyRange: { min: number; max: number };
  quiescentCurrent: number;
  openCollector: boolean;
  channels: number;
  model: string;
}

export const COMPARATOR_MODELS: Record<string, ComparatorParams> = {
  'LM393': { responseTime: 1300, inputOffsetVoltage: 5000, inputBiasCurrent: 25, supplyRange: { min: 2, max: 36 }, quiescentCurrent: 400, openCollector: true, channels: 2, model: 'LM393' },
  'LM339': { responseTime: 1300, inputOffsetVoltage: 5000, inputBiasCurrent: 25, supplyRange: { min: 2, max: 36 }, quiescentCurrent: 800, openCollector: true, channels: 4, model: 'LM339' },
  'LM311': { responseTime: 200, inputOffsetVoltage: 3000, inputBiasCurrent: 100, supplyRange: { min: 3.5, max: 30 }, quiescentCurrent: 5100, openCollector: true, channels: 1, model: 'LM311' },
  'TLV3501': { responseTime: 4.5, inputOffsetVoltage: 1000, inputBiasCurrent: 0.002, supplyRange: { min: 2.7, max: 5.5 }, quiescentCurrent: 450, openCollector: false, channels: 1, model: 'TLV3501' },
  'MCP6541': { responseTime: 4000, inputOffsetVoltage: 3500, inputBiasCurrent: 0.001, supplyRange: { min: 1.8, max: 5.5 }, quiescentCurrent: 1, openCollector: true, channels: 1, model: 'MCP6541' },
};

// ==================== 模拟开关 ====================

export interface AnalogSwitchParams {
  channels: number;
  onResistance: number;
  supplyRange: { min: number; max: number };
  bandwidth: number;
  crosstalk: number;
  breakBeforeMake: boolean;
  model: string;
}

export const ANALOG_SWITCH_MODELS: Record<string, AnalogSwitchParams> = {
  'CD4066': { channels: 4, onResistance: 80, supplyRange: { min: 3, max: 18 }, bandwidth: 40000000, crosstalk: -50, breakBeforeMake: false, model: 'CD4066' },
  'CD4051': { channels: 8, onResistance: 125, supplyRange: { min: 3, max: 18 }, bandwidth: 20000000, crosstalk: -40, breakBeforeMake: true, model: 'CD4051' },
  'CD4052': { channels: 4, onResistance: 125, supplyRange: { min: 3, max: 18 }, bandwidth: 20000000, crosstalk: -40, breakBeforeMake: true, model: 'CD4052' },
  '74HC4051': { channels: 8, onResistance: 50, supplyRange: { min: 2, max: 6 }, bandwidth: 100000000, crosstalk: -50, breakBeforeMake: true, model: '74HC4051' },
  'ADG708': { channels: 8, onResistance: 4, supplyRange: { min: 2.7, max: 5.5 }, bandwidth: 100000000, crosstalk: -70, breakBeforeMake: true, model: 'ADG708' },
};

// ==================== 定时器/计数器 IC ====================

export const TIMER_IC_MODELS: Record<string, { function: string; maxCount: number; model: string }> = {
  'CD4017': { function: 'decade_counter', maxCount: 10, model: 'CD4017' },
  'CD4026': { function: 'decade_counter_7seg', maxCount: 10, model: 'CD4026' },
  'CD4040': { function: '12bit_binary_counter', maxCount: 4096, model: 'CD4040' },
  'CD4060': { function: '14bit_binary_counter_osc', maxCount: 16384, model: 'CD4060' },
  'CD4518': { function: 'dual_bcd_counter', maxCount: 10, model: 'CD4518' },
  '74HC192': { function: 'presettable_bcd_counter', maxCount: 10, model: '74HC192' },
  '74HC193': { function: 'presettable_binary_counter', maxCount: 16, model: '74HC193' },
  '74HC161': { function: '4bit_sync_binary_counter', maxCount: 16, model: '74HC161' },
};
