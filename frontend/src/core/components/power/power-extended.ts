/**
 * 扩展电源管理元件定义
 *
 * 充电IC、电压基准扩展、电压监控器、AC-DC模块、电荷泵
 */

// ==================== 充电IC ====================

export interface ChargerICParams {
  inputVoltage: { min: number; max: number };
  chargeVoltage: number;
  chargeCurrent: number;
  terminationCurrent: number;
  batteryType: string;
  chargeProfile: 'CC_CV' | 'linear';
  thermalRegulation: boolean;
  solarMPPT: boolean;
  model: string;
}

export const CHARGER_IC_MODELS: Record<string, ChargerICParams> = {
  'TP4056': { inputVoltage: { min: 4.5, max: 6 }, chargeVoltage: 4.2, chargeCurrent: 1000, terminationCurrent: 100, batteryType: 'Li-Ion/LiPo', chargeProfile: 'CC_CV', thermalRegulation: true, solarMPPT: false, model: 'TP4056' },
  'BQ24075': { inputVoltage: { min: 3.75, max: 6.5 }, chargeVoltage: 4.2, chargeCurrent: 500, terminationCurrent: 50, batteryType: 'Li-Ion/LiPo', chargeProfile: 'CC_CV', thermalRegulation: true, solarMPPT: false, model: 'BQ24075' },
  'CN3791': { inputVoltage: { min: 4.5, max: 28 }, chargeVoltage: 4.2, chargeCurrent: 4000, terminationCurrent: 100, batteryType: 'Li-Ion/LiPo', chargeProfile: 'CC_CV', thermalRegulation: true, solarMPPT: true, model: 'CN3791' },
  'MCP73831': { inputVoltage: { min: 3.75, max: 6 }, chargeVoltage: 4.2, chargeCurrent: 500, terminationCurrent: 50, batteryType: 'Li-Ion/LiPo', chargeProfile: 'linear', thermalRegulation: true, solarMPPT: false, model: 'MCP73831' },
  'BQ25895': { inputVoltage: { min: 3.9, max: 14 }, chargeVoltage: 4.2, chargeCurrent: 3000, terminationCurrent: 128, batteryType: 'Li-Ion/LiPo', chargeProfile: 'CC_CV', thermalRegulation: true, solarMPPT: false, model: 'BQ25895' },
};

/** 充电时间估算 (小时) */
export function chargeTimeHours(capacityMAh: number, chargeCurrentMA: number): number {
  return capacityMAh / chargeCurrentMA * 1.2; // 加 20% 损耗
}

// ==================== 电压监控器 ====================

export interface VoltageSupervisorParams {
  threshold: number;
  hysteresis: number;
  timeout: number;
  hasManualReset: boolean;
  hasWatchdog: boolean;
  watchdogTimeout: number;
  outputType: 'push_pull' | 'open_drain';
  activeLow: boolean;
  model: string;
}

export const VOLTAGE_SUPERVISOR_MODELS: Record<string, VoltageSupervisorParams> = {
  'MAX809T': { threshold: 3.08, hysteresis: 0.02, timeout: 140, hasManualReset: false, hasWatchdog: false, watchdogTimeout: 0, outputType: 'push_pull', activeLow: true, model: 'MAX809T' },
  'MAX809S': { threshold: 2.93, hysteresis: 0.02, timeout: 140, hasManualReset: false, hasWatchdog: false, watchdogTimeout: 0, outputType: 'push_pull', activeLow: true, model: 'MAX809S' },
  'MAX809R': { threshold: 2.63, hysteresis: 0.02, timeout: 140, hasManualReset: false, hasWatchdog: false, watchdogTimeout: 0, outputType: 'push_pull', activeLow: true, model: 'MAX809R' },
  'MAX811': { threshold: 2.93, hysteresis: 0.02, timeout: 140, hasManualReset: true, hasWatchdog: false, watchdogTimeout: 0, outputType: 'push_pull', activeLow: true, model: 'MAX811' },
  'STM812': { threshold: 2.93, hysteresis: 0.05, timeout: 160, hasManualReset: true, hasWatchdog: false, watchdogTimeout: 0, outputType: 'push_pull', activeLow: true, model: 'STM812' },
  'BD52xx': { threshold: 3.0, hysteresis: 0.05, timeout: 100, hasManualReset: false, hasWatchdog: false, watchdogTimeout: 0, outputType: 'open_drain', activeLow: true, model: 'BD5230' },
};

/** 电压监控检测 */
export function voltageMonitor(voltage: number, params: VoltageSupervisorParams): boolean {
  return voltage < params.threshold;
}

// ==================== AC-DC 电源模块 ====================

export interface ACDCModuleParams {
  inputVoltage: { min: number; max: number };
  outputVoltage: number;
  outputCurrent: number;
  efficiency: number;
  ripple: number;
  isolation: number;
  protection: string[];
  model: string;
}

export const ACDC_MODULE_MODELS: Record<string, ACDCModuleParams> = {
  'HLK_PM03_3V3': { inputVoltage: { min: 100, max: 240 }, outputVoltage: 3.3, outputCurrent: 600, efficiency: 78, ripple: 50, isolation: 3000, protection: ['OVP', 'OCP', 'SCP'], model: 'HLK-PM03' },
  'HLK_PM01_5V': { inputVoltage: { min: 100, max: 240 }, outputVoltage: 5, outputCurrent: 200, efficiency: 75, ripple: 50, isolation: 3000, protection: ['OVP', 'OCP'], model: 'HLK-PM01' },
  'HLK_5M05': { inputVoltage: { min: 100, max: 240 }, outputVoltage: 5, outputCurrent: 1000, efficiency: 80, ripple: 80, isolation: 3000, protection: ['OVP', 'OCP', 'SCP'], model: 'HLK-5M05' },
  'MeanWell_IRM_03_5': { inputVoltage: { min: 85, max: 264 }, outputVoltage: 5, outputCurrent: 600, efficiency: 79, ripple: 80, isolation: 4000, protection: ['OVP', 'OCP'], model: 'IRM-03-5' },
};

// ==================== 电荷泵 ====================

export interface ChargePumpParams {
  inputRange: { min: number; max: number };
  outputVoltage: string;
  maxOutputCurrent: number;
  efficiency: number;
  switchingFreq: number;
  externalCap: number;
  model: string;
}

export const CHARGE_PUMP_MODELS: Record<string, ChargePumpParams> = {
  'ICL7660': { inputRange: { min: 1.5, max: 10 }, outputVoltage: '-Vin', maxOutputCurrent: 45, efficiency: 95, switchingFreq: 10000, externalCap: 10, model: 'ICL7660' },
  'LTC1044': { inputRange: { min: 1.5, max: 9 }, outputVoltage: '-Vin/2x', maxOutputCurrent: 20, efficiency: 97, switchingFreq: 8000, externalCap: 10, model: 'LTC1044' },
  'MAX660': { inputRange: { min: 1.5, max: 5.5 }, outputVoltage: '-Vin', maxOutputCurrent: 100, efficiency: 90, switchingFreq: 10000, externalCap: 10, model: 'MAX660' },
  'TPS60400': { inputRange: { min: 1.8, max: 5.5 }, outputVoltage: '-Vin', maxOutputCurrent: 60, efficiency: 90, switchingFreq: 250000, externalCap: 1, model: 'TPS60400' },
};

// ==================== 电压基准扩展 ====================

export const VOLTAGE_REF_EXTENDED: Record<string, { outputVoltage: number; initialAccuracy: number; tempCoeff: number; model: string }> = {
  'REF5025': { outputVoltage: 2.5, initialAccuracy: 0.05, tempCoeff: 3, model: 'REF5025' },
  'REF5050': { outputVoltage: 5.0, initialAccuracy: 0.05, tempCoeff: 3, model: 'REF5050' },
  'LM4040_3V0': { outputVoltage: 3.0, initialAccuracy: 0.1, tempCoeff: 15, model: 'LM4040-3.0' },
  'LM4040_4V1': { outputVoltage: 4.096, initialAccuracy: 0.1, tempCoeff: 15, model: 'LM4040-4.1' },
  'ADR4550': { outputVoltage: 5.0, initialAccuracy: 0.02, tempCoeff: 2, model: 'ADR4550' },
  'MAX6126': { outputVoltage: 2.5, initialAccuracy: 0.02, tempCoeff: 3, model: 'MAX6126' },
};
