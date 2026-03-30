/**
 * 移位寄存器模型
 *
 * 74HC595 8位串行输入/并行输出移位寄存器
 * 包含时序分析、级联配置、输出驱动能力计算等功能
 */

import type { ComponentPort } from '../../../types/circuit';

// ==================== 类型定义 ====================

/** 移位寄存器参数 */
export interface ShiftRegisterParams {
  /** 位宽 (bits) */
  bitWidth: number;
  /** 最大时钟频率 (MHz) */
  maxClockFreq: number;
  /** 传播延迟 (ns) */
  propagationDelay: number;
  /** 建立时间 (ns) */
  setupTime: number;
  /** 保持时间 (ns) */
  holdTime: number;
  /** 输出驱动能力 - 高电平 (mA) */
  outputDriveHigh: number;
  /** 输出驱动能力 - 低电平 (mA) */
  outputDriveLow: number;
  /** 工作电压范围 */
  supplyRange: { min: number; max: number; typical: number };
  /** 静态电流 (μA) */
  quiescentCurrent: number;
  /** 输出使能延迟 (ns) */
  outputEnableDelay: number;
  /** 锁存时钟脉冲宽度 (ns) */
  latchPulseWidth: number;
  /** 移位寄存器清零脉冲宽度 (ns) */
  clearPulseWidth: number;
  /** 是否支持输出三态 */
  hasTristate: boolean;
  /** 是否支持级联 */
  cascadable: boolean;
  /** 型号名称 */
  modelName: string;
}

/** 74HC595 引脚定义 */
export interface ShiftRegisterPins {
  /** 串行数据输入 */
  dataIn: number;
  /** 移位寄存器时钟 */
  shiftClock: number;
  /** 存储寄存器锁存时钟 */
  latchClock: number;
  /** 输出使能（低有效） */
  outputEnable: number;
  /** 移位寄存器清零（低有效） */
  clear: number;
  /** 串行输出（级联用） */
  cascadeOut: number;
}

/** 移位寄存器状态 */
export interface ShiftRegisterState {
  /** 移位寄存器内容（二进制数组） */
  shiftRegister: number[];
  /** 存储寄存器内容（二进制数组，即输出状态） */
  storageRegister: number[];
  /** 串行输出值 */
  serialOut: number;
}

/** 级联配置参数 */
export interface CascadeConfig {
  /** 级联级数 */
  numberOfStages: number;
  /** 总位数 */
  totalBits: number;
  /** 最大时钟频率（级联后会降低） (MHz) */
  maxCascadeClockFreq: number;
  /** 总传播延迟 (ns) */
  totalPropagationDelay: number;
}

// ==================== 默认参数 ====================

/** 常见移位寄存器型号参数 */
export const SHIFT_REGISTER_MODELS: Record<string, ShiftRegisterParams> = {
  /** 74HC595 - 经典 8 位移位寄存器 */
  '74HC595': {
    bitWidth: 8,
    maxClockFreq: 25,
    propagationDelay: 22,
    setupTime: 16,
    holdTime: 5,
    outputDriveHigh: 6,
    outputDriveLow: 6,
    supplyRange: { min: 2.0, max: 6.0, typical: 5.0 },
    quiescentCurrent: 80,
    outputEnableDelay: 150,
    latchPulseWidth: 16,
    clearPulseWidth: 16,
    hasTristate: true,
    cascadable: true,
    modelName: '74HC595',
  },
  /** 74HC594 - 带清零功能的 8 位移位寄存器 */
  '74HC594': {
    bitWidth: 8,
    maxClockFreq: 25,
    propagationDelay: 22,
    setupTime: 16,
    holdTime: 5,
    outputDriveHigh: 6,
    outputDriveLow: 6,
    supplyRange: { min: 2.0, max: 6.0, typical: 5.0 },
    quiescentCurrent: 80,
    outputEnableDelay: 150,
    latchPulseWidth: 16,
    clearPulseWidth: 16,
    hasTristate: false,
    cascadable: true,
    modelName: '74HC594',
  },
  /** TPIC6B595 - 高电压大电流移位寄存器 */
  TPIC6B595: {
    bitWidth: 8,
    maxClockFreq: 10,
    propagationDelay: 100,
    setupTime: 50,
    holdTime: 0,
    outputDriveHigh: 0,
    outputDriveLow: 150, // 灌电流 150mA
    supplyRange: { min: 4.5, max: 5.5, typical: 5.0 },
    quiescentCurrent: 5000,
    outputEnableDelay: 200,
    latchPulseWidth: 50,
    clearPulseWidth: 50,
    hasTristate: true,
    cascadable: true,
    modelName: 'TPIC6B595',
  },
  /** 74AHC595 - 高速版本 */
  '74AHC595': {
    bitWidth: 8,
    maxClockFreq: 100,
    propagationDelay: 5,
    setupTime: 3,
    holdTime: 1.5,
    outputDriveHigh: 8,
    outputDriveLow: 8,
    supplyRange: { min: 2.0, max: 5.5, typical: 3.3 },
    quiescentCurrent: 40,
    outputEnableDelay: 60,
    latchPulseWidth: 5,
    clearPulseWidth: 5,
    hasTristate: true,
    cascadable: true,
    modelName: '74AHC595',
  },
};

/** 默认移位寄存器参数（74HC595） */
export const DEFAULT_SHIFT_REGISTER_PARAMS: ShiftRegisterParams = SHIFT_REGISTER_MODELS['74HC595'];

// ==================== 移位寄存器计算函数 ====================

/**
 * 数据移入操作
 *
 * 在移位时钟上升沿将串行数据移入寄存器最低位，
 * 原有数据依次向高位移动，最高位从串行输出移出
 *
 * @param currentState 当前状态
 * @param dataIn 串行输入值 (0 或 1)
 * @returns 更新后的状态
 */
export function shiftRegisterShift(
  currentState: ShiftRegisterState,
  dataIn: number
): ShiftRegisterState {
  const newShift = [...currentState.shiftRegister];
  // 最高位移出
  const serialOut = newShift[newShift.length - 1];
  // 数据右移（从低到高）
  for (let i = newShift.length - 1; i > 0; i--) {
    newShift[i] = newShift[i - 1];
  }
  newShift[0] = dataIn & 1;

  return {
    shiftRegister: newShift,
    storageRegister: [...currentState.storageRegister],
    serialOut,
  };
}

/**
 * 锁存操作
 *
 * 在锁存时钟上升沿将移位寄存器内容复制到存储寄存器，
 * 存储寄存器的值直接驱动输出引脚
 *
 * @param currentState 当前状态
 * @returns 更新后的状态
 */
export function shiftRegisterLatch(
  currentState: ShiftRegisterState
): ShiftRegisterState {
  return {
    shiftRegister: [...currentState.shiftRegister],
    storageRegister: [...currentState.shiftRegister],
    serialOut: currentState.serialOut,
  };
}

/**
 * 清零操作
 *
 * 将移位寄存器所有位清零（不影响存储寄存器和输出）
 *
 * @param currentState 当前状态
 * @returns 更新后的状态
 */
export function shiftRegisterClear(
  currentState: ShiftRegisterState
): ShiftRegisterState {
  const bitWidth = currentState.shiftRegister.length;
  return {
    shiftRegister: new Array(bitWidth).fill(0),
    storageRegister: [...currentState.storageRegister],
    serialOut: 0,
  };
}

/**
 * 创建初始状态
 *
 * @param bitWidth 位宽
 * @returns 初始状态
 */
export function createShiftRegisterState(bitWidth: number = 8): ShiftRegisterState {
  return {
    shiftRegister: new Array(bitWidth).fill(0),
    storageRegister: new Array(bitWidth).fill(0),
    serialOut: 0,
  };
}

/**
 * 并行数据加载到移位寄存器
 *
 * 将 8 位数据串行移入（MSB 先行或 LSB 先行）
 *
 * @param data 要加载的数据 (0-255)
 * @param msbFirst 是否 MSB 先行，默认 true
 * @param currentState 当前状态
 * @returns 完成加载后的状态
 */
export function shiftRegisterLoadByte(
  data: number,
  msbFirst: boolean = true,
  currentState: ShiftRegisterState
): ShiftRegisterState {
  let state = { ...currentState };
  const bitWidth = state.shiftRegister.length;

  for (let i = 0; i < bitWidth; i++) {
    const bitIndex = msbFirst ? (bitWidth - 1 - i) : i;
    const bit = (data >> bitIndex) & 1;
    state = shiftRegisterShift(state, bit);
  }

  return state;
}

/**
 * 级联配置计算
 *
 * @param numberOfStages 级联级数
 * @param params 单级参数
 * @returns 级联配置
 */
export function cascadeConfiguration(
  numberOfStages: number,
  params: ShiftRegisterParams = DEFAULT_SHIFT_REGISTER_PARAMS
): CascadeConfig {
  return {
    numberOfStages,
    totalBits: numberOfStages * params.bitWidth,
    maxCascadeClockFreq: params.maxClockFreq,
    totalPropagationDelay: numberOfStages * params.propagationDelay,
  };
}

/**
 * 级联数据传输时间
 *
 * @param numberOfStages 级联级数
 * @param clockFreq 时钟频率 (MHz)
 * @param params 单级参数
 * @returns 数据传输总时间 (μs)
 */
export function cascadeTransferTime(
  numberOfStages: number,
  clockFreq: number,
  params: ShiftRegisterParams = DEFAULT_SHIFT_REGISTER_PARAMS
): number {
  const totalBits = numberOfStages * params.bitWidth;
  const clockPeriod = 1 / (clockFreq * 1e6); // 秒
  return totalBits * clockPeriod * 1e6; // 转换为 μs
}

/**
 * 输出电流计算
 *
 * @param outputIndex 输出引脚索引 (0-7)
 * @param currentOutputs 各输出状态 (0=低, 1=高)
 * @param loadResistance 各输出负载电阻 (Ω)
 * @param params 移位寄存器参数
 * @returns 各输出引脚电流 (mA)
 */
export function shiftRegisterOutputCurrent(
  outputIndex: number,
  currentOutputs: number[],
  loadResistance: number,
  params: ShiftRegisterParams = DEFAULT_SHIFT_REGISTER_PARAMS
): number {
  if (outputIndex < 0 || outputIndex >= currentOutputs.length) return 0;

  const vcc = params.supplyRange.typical;

  if (currentOutputs[outputIndex] === 1) {
    // 高电平输出：源电流
    const iLoad = (vcc - 0.1) / loadResistance * 1000; // mA
    return Math.min(iLoad, params.outputDriveHigh);
  } else {
    // 低电平输出：灌电流
    const iLoad = 0.1 / loadResistance * 1000; // mA（简化，实际 Vout_low 不为 0）
    return Math.min(iLoad, params.outputDriveLow);
  }
}

/**
 * 功耗计算
 *
 * @param clockFreq 时钟频率 (MHz)
 * @param numberOfOutputsHigh 高电平输出数
 * @param params 移位寄存器参数
 * @returns 功耗 (mW)
 */
export function shiftRegisterPower(
  clockFreq: number,
  numberOfOutputsHigh: number,
  params: ShiftRegisterParams = DEFAULT_SHIFT_REGISTER_PARAMS
): number {
  const vcc = params.supplyRange.typical;
  // 静态功耗
  const pStatic = vcc * params.quiescentCurrent / 1e3;
  // 动态功耗 ≈ Cpd × Vcc² × f（简化估算）
  const cpd = 20e-12; // 典型 20pF
  const pDynamic = cpd * vcc * vcc * clockFreq * 1e6 * 1e3;
  // 输出功耗（假设 50Ω 负载）
  const pOutput = numberOfOutputsHigh * vcc * vcc / 50 * 1e3;

  return pStatic + pDynamic + pOutput;
}

/**
 * 最大时钟频率验证
 *
 * @param clockFreq 时钟频率 (MHz)
 * @param params 移位寄存器参数
 * @returns { ok: boolean, warning: string }
 */
export function validateClockFrequency(
  clockFreq: number,
  params: ShiftRegisterParams = DEFAULT_SHIFT_REGISTER_PARAMS
): { ok: boolean; warning: string } {
  if (clockFreq > params.maxClockFreq) {
    return {
      ok: false,
      warning: `时钟频率 ${clockFreq}MHz 超过最大值 ${params.maxClockFreq}MHz`,
    };
  }
  // 检查建立时间 + 保持时间是否满足
  const minClockPeriod = (params.setupTime + params.holdTime) * 1e-9; // ns → s
  const maxFreqFromTiming = 1 / minClockPeriod / 1e6; // MHz
  if (clockFreq > maxFreqFromTiming) {
    return {
      ok: false,
      warning: `时钟频率 ${clockFreq}MHz 超过时序要求的最大值 ${maxFreqFromTiming.toFixed(1)}MHz（建立时间+保持时间）`,
    };
  }
  return { ok: true, warning: '' };
}

/**
 * 生成串行数据时序序列
 *
 * @param data 要传输的数据
 * @param clockFreq 时钟频率 (MHz)
 * @param params 移位寄存器参数
 * @returns 时序数据
 */
export function generateShiftTiming(
  data: number,
  clockFreq: number = 1,
  params: ShiftRegisterParams = DEFAULT_SHIFT_REGISTER_PARAMS
): {
  bitIndex: number;
  bitValue: number;
  timeNs: number;
  shiftClock: number;
  dataIn: number;
}[] {
  const clockPeriodNs = 1000 / clockFreq; // MHz → ns
  const timing: {
    bitIndex: number;
    bitValue: number;
    timeNs: number;
    shiftClock: number;
    dataIn: number;
  }[] = [];

  for (let i = 0; i < params.bitWidth; i++) {
    const bitValue = (data >> (params.bitWidth - 1 - i)) & 1; // MSB first
    const t = i * clockPeriodNs;

    // 时钟低电平时设置数据
    timing.push({
      bitIndex: i,
      bitValue,
      timeNs: t,
      shiftClock: 0,
      dataIn: bitValue,
    });

    // 时钟上升沿
    timing.push({
      bitIndex: i,
      bitValue,
      timeNs: t + clockPeriodNs / 2,
      shiftClock: 1,
      dataIn: bitValue,
    });
  }

  return timing;
}

// ==================== 端口定义 ====================

/** 74HC595 引脚布局（16 引脚 DIP/SOIC 封装） */
export const SHIFT_REGISTER_PORTS: ComponentPort[] = [
  { id: 'q1', offset: { x: -40, y: 20 } },
  { id: 'q2', offset: { x: -40, y: 10 } },
  { id: 'q3', offset: { x: -40, y: 0 } },
  { id: 'q4', offset: { x: -40, y: -10 } },
  { id: 'q5', offset: { x: -40, y: -20 } },
  { id: 'q6', offset: { x: -40, y: -30 } },
  { id: 'q7', offset: { x: -40, y: -40 } },
  { id: 'gnd', offset: { x: -30, y: 50 } },
  { id: 'q7s', offset: { x: 30, y: -40 } },
  { id: 'mr', offset: { x: 30, y: -20 } },
  { id: 'sh_cp', offset: { x: 30, y: -10 } },
  { id: 'st_cp', offset: { x: 30, y: 0 } },
  { id: 'oe', offset: { x: 30, y: 10 } },
  { id: 'ds', offset: { x: 30, y: 20 } },
  { id: 'q0', offset: { x: 30, y: 30 } },
  { id: 'vcc', offset: { x: 30, y: 50 } },
];

/**
 * 测试用例描述：
 *
 * 测试 1: shiftRegisterShift + shiftRegisterLatch 完整流程
 *   初始状态全0 → 移入 0b10110001 → 锁存 → 存储寄存器应为 [1,0,0,0,1,1,0,1]
 *
 * 测试 2: shiftRegisterLoadByte(0xFF) 应使移位寄存器全为 1
 *
 * 测试 3: shiftRegisterClear 应清零移位寄存器但不影响存储寄存器
 *
 * 测试 4: cascadeConfiguration(4) 应返回 totalBits=32
 *
 * 测试 5: cascadeTransferTime(4, 1) 应返回 32μs (32 bits @ 1MHz)
 *
 * 测试 6: validateClockFrequency(30, '74HC595') 应返回 ok=false
 *
 * 测试 7: validateClockFrequency(20, '74HC595') 应返回 ok=true
 *
 * 测试 8: generateShiftTiming(0xAA, 1) 应返回 16 个时序事件
 */
