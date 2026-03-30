/**
 * 元件行为模型注册表
 *
 * 将各元件行为模型集中注册，供组件加载器和仿真引擎调用
 * 行为模型提供：参数计算、验证、波形生成、状态模拟等功能
 */

import {
  astableCalculate,
  monostableCalculate,
  timer555Validate,
  timer555PinStates,
  generateAstableWaveform,
  astableFrequency,
  astableDutyCycle,
  astableDesign,
  TIMER555_MODELS,
  DEFAULT_TIMER555_PARAMS,
  TIMER555_PORTS,
  type Timer555Params,
  type AstableResult,
  type MonostableResult,
} from './components/ics/timer555';

import {
  regulatorOutputVoltage,
  regulatorStatus,
  regulatorPowerDissipation,
  regulatorEfficiency,
  regulatorThermalShutdown,
  regulatorJunctionTemperature,
  regulatorOutputRipple,
  lm317OutputVoltage,
  lm317CalculateR2,
  regulatorHeatsinkRequirement,
  LINEAR_REGULATOR_MODELS,
  DEFAULT_LINEAR_REGULATOR_PARAMS,
  LINEAR_REGULATOR_PORTS,
  type LinearRegulatorParams,
  type RegulatorStatus,
} from './components/power/regulators';

import {
  shiftRegisterShift,
  shiftRegisterLatch,
  shiftRegisterClear,
  createShiftRegisterState,
  shiftRegisterLoadByte,
  cascadeConfiguration,
  cascadeTransferTime,
  validateClockFrequency,
  generateShiftTiming,
  shiftRegisterPower,
  SHIFT_REGISTER_MODELS,
  DEFAULT_SHIFT_REGISTER_PARAMS,
  SHIFT_REGISTER_PORTS,
} from './components/communication/shift-register';

import type { ComponentPort } from '../types/circuit';

// ==================== 行为模型接口 ====================

/** 行为模型验证结果 */
export interface BehaviorValidation {
  valid: boolean;
  warnings: string[];
}

/** 通用行为模型接口 */
export interface BehaviorModel {
  /** 模型名称 */
  name: string;
  /** 可用的型号/变体 */
  models: Record<string, unknown>;
  /** 默认参数 */
  defaultParams: unknown;
  /** 引脚/端口定义 */
  ports: ComponentPort[];
  /** 验证参数 */
  validate: (params: unknown) => BehaviorValidation;
}

// ==================== 555 定时器行为模型 ====================

export const timer555Behavior: BehaviorModel & {
  astableCalculate: typeof astableCalculate;
  monostableCalculate: typeof monostableCalculate;
  pinStates: typeof timer555PinStates;
  generateWaveform: typeof generateAstableWaveform;
  frequency: typeof astableFrequency;
  dutyCycle: typeof astableDutyCycle;
  design: typeof astableDesign;
} = {
  name: '555 Timer',
  models: TIMER555_MODELS,
  defaultParams: DEFAULT_TIMER555_PARAMS,
  ports: TIMER555_PORTS,
  validate: (params: unknown) => timer555Validate(params as Timer555Params),
  astableCalculate,
  monostableCalculate,
  pinStates: timer555PinStates,
  generateWaveform: generateAstableWaveform,
  frequency: astableFrequency,
  dutyCycle: astableDutyCycle,
  design: astableDesign,
};

// ==================== 线性稳压器行为模型 ====================

/** 创建线性稳压器行为模型（支持不同默认参数） */
function createRegulatorBehavior(defaultModel: string): BehaviorModel & {
  outputVoltage: typeof regulatorOutputVoltage;
  status: typeof regulatorStatus;
  powerDissipation: typeof regulatorPowerDissipation;
  efficiency: typeof regulatorEfficiency;
  thermalShutdown: typeof regulatorThermalShutdown;
  junctionTemperature: typeof regulatorJunctionTemperature;
  outputRipple: typeof regulatorOutputRipple;
  lm317Output: typeof lm317OutputVoltage;
  lm317R2: typeof lm317CalculateR2;
  heatsinkRequirement: typeof regulatorHeatsinkRequirement;
  getParamsForType: (type: '7805' | '7812' | 'LM317') => LinearRegulatorParams;
} {
  const defaultParams = LINEAR_REGULATOR_MODELS[defaultModel] ?? DEFAULT_LINEAR_REGULATOR_PARAMS;
  return {
    name: 'Linear Regulator',
    models: LINEAR_REGULATOR_MODELS,
    defaultParams,
    ports: LINEAR_REGULATOR_PORTS,
    validate: () => ({ valid: true, warnings: [] }),
    outputVoltage: regulatorOutputVoltage,
    status: regulatorStatus,
    powerDissipation: regulatorPowerDissipation,
    efficiency: regulatorEfficiency,
    thermalShutdown: regulatorThermalShutdown,
    junctionTemperature: regulatorJunctionTemperature,
    outputRipple: regulatorOutputRipple,
    lm317Output: lm317OutputVoltage,
    lm317R2: lm317CalculateR2,
    heatsinkRequirement: regulatorHeatsinkRequirement,
    getParamsForType: (type: '7805' | '7812' | 'LM317') => {
      switch (type) {
        case '7805': return LINEAR_REGULATOR_MODELS['LM7805'];
        case '7812': return LINEAR_REGULATOR_MODELS['LM7812'];
        case 'LM317': return LINEAR_REGULATOR_MODELS['LM317'];
        default: return defaultParams;
      }
    },
  };
}

export const linearRegulatorBehavior = createRegulatorBehavior('LM7805');

// 7812 专用实例（默认参数为 LM7812）
export const linearRegulator7812Behavior = createRegulatorBehavior('LM7812');

// ==================== 移位寄存器行为模型 ====================

export const shiftRegisterBehavior: BehaviorModel & {
  shift: typeof shiftRegisterShift;
  latch: typeof shiftRegisterLatch;
  clear: typeof shiftRegisterClear;
  createState: typeof createShiftRegisterState;
  loadByte: typeof shiftRegisterLoadByte;
  cascadeConfig: typeof cascadeConfiguration;
  cascadeTime: typeof cascadeTransferTime;
  validateClock: typeof validateClockFrequency;
  generateTiming: typeof generateShiftTiming;
  power: typeof shiftRegisterPower;
} = {
  name: 'Shift Register',
  models: SHIFT_REGISTER_MODELS,
  defaultParams: DEFAULT_SHIFT_REGISTER_PARAMS,
  ports: SHIFT_REGISTER_PORTS,
  validate: () => ({ valid: true, warnings: [] }),
  shift: shiftRegisterShift,
  latch: shiftRegisterLatch,
  clear: shiftRegisterClear,
  createState: createShiftRegisterState,
  loadByte: shiftRegisterLoadByte,
  cascadeConfig: cascadeConfiguration,
  cascadeTime: cascadeTransferTime,
  validateClock: validateClockFrequency,
  generateTiming: generateShiftTiming,
  power: shiftRegisterPower,
};

// ==================== 注册表 ====================

/** 元件类型 → 行为模型映射 */
const BEHAVIOR_REGISTRY: Record<string, BehaviorModel> = {
  timer_555: timer555Behavior,
  voltage_regulator_7805: linearRegulatorBehavior,
  voltage_regulator_7812: linearRegulator7812Behavior,
};

/**
 * 获取元件的行为模型
 * @param type 元件类型（如 'timer_555'）
 * @returns 行为模型，未注册的类型返回 null
 */
export function getBehaviorModel(type: string): BehaviorModel | null {
  return BEHAVIOR_REGISTRY[type] ?? null;
}

/**
 * 检查元件类型是否有对应的行为模型
 */
export function hasBehaviorModel(type: string): boolean {
  return type in BEHAVIOR_REGISTRY;
}

/**
 * 获取所有已注册行为模型的元件类型
 */
export function getBehaviorModelTypes(): string[] {
  return Object.keys(BEHAVIOR_REGISTRY);
}

// ==================== 行为模型预计算 ====================

/**
 * 为 timer_555 元件预计算 Astable 结果
 */
export function precomputeTimer555(
  params: Partial<Timer555Params> = {}
): AstableResult | MonostableResult {
  const p = { ...DEFAULT_TIMER555_PARAMS, ...params };
  if (p.mode === 'astable') {
    return astableCalculate(p.r1, p.r2, p.capacitance, p.supplyVoltage);
  }
  return monostableCalculate(p.r1, p.capacitance, p.supplyVoltage);
}

/**
 * 为稳压器元件预计算状态
 */
export function precomputeRegulator(
  inputVoltage: number,
  loadCurrent: number,
  regulatorType: '7805' | '7812' | 'LM317' = '7805'
): RegulatorStatus {
  const params = linearRegulatorBehavior.getParamsForType(regulatorType);
  return regulatorStatus(inputVoltage, loadCurrent, 25, params);
}

/**
 * 为移位寄存器预计算级联配置
 */
export function precomputeShiftRegister(
  numberOfStages: number = 1,
  model: string = '74HC595'
) {
  const params = SHIFT_REGISTER_MODELS[model] ?? DEFAULT_SHIFT_REGISTER_PARAMS;
  return cascadeConfiguration(numberOfStages, params);
}

// Re-export types for external consumers
export type { Timer555Params, AstableResult, MonostableResult } from './components/ics/timer555';
export type { LinearRegulatorParams, RegulatorStatus } from './components/power/regulators';
export type { ShiftRegisterParams, ShiftRegisterState } from './components/communication/shift-register';
