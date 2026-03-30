/**
 * 逻辑门前端交互模型
 *
 * 基本逻辑门（AND/OR/NOT/NAND/NOR/XOR）的前端仿真模型
 * 与后端 74 系列 IC 定义保持一致（logic74.go）
 * 支持四值逻辑：0(低电平)、1(高电平)、X(未知)、Z(高阻)
 */

import type { ComponentPort } from '../../../types/circuit';

// ==================== 类型定义 ====================

/** 四值逻辑 */
export type LogicValue = 0 | 1 | 'X' | 'Z';

/** 逻辑门类型 */
export type LogicGateType = 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR';

/** 逻辑门参数 */
export interface LogicGateParams {
  /** 门类型 */
  gateType: LogicGateType;
  /** 输入端口数量（NOT 固定为 1） */
  inputCount: number;
  /** 传播延迟 (ns) */
  propagationDelay: number;
  /** 扇出能力 */
  fanOut: number;
  /** 输出高电平 (V) */
  outputHighVoltage: number;
  /** 输出低电平 (V) */
  outputLowVoltage: number;
  /** 输入高电平阈值 (V) */
  inputHighThreshold: number;
  /** 输入低电平阈值 (V) */
  inputLowThreshold: number;
  /** 电源电压 (V) */
  supplyVoltage: number;
  /** 静态功耗 (mW) */
  staticPower: number;
  /** 最大翻转频率 (MHz) */
  maxToggleFreq: number;
}

// ==================== 默认参数 ====================

/** 74 系列 TTL 默认参数 */
const TTL_DEFAULTS = {
  propagationDelay: 10,
  fanOut: 10,
  outputHighVoltage: 3.4,
  outputLowVoltage: 0.2,
  inputHighThreshold: 2.0,
  inputLowThreshold: 0.8,
  supplyVoltage: 5.0,
  staticPower: 10,
  maxToggleFreq: 25,
};

/** 逻辑门默认参数 */
export const LOGIC_GATE_MODELS: Record<LogicGateType, LogicGateParams> = {
  AND: { gateType: 'AND', inputCount: 2, ...TTL_DEFAULTS },
  OR: { gateType: 'OR', inputCount: 2, ...TTL_DEFAULTS },
  NOT: { gateType: 'NOT', inputCount: 1, ...TTL_DEFAULTS },
  NAND: { gateType: 'NAND', inputCount: 2, ...TTL_DEFAULTS },
  NOR: { gateType: 'NOR', inputCount: 2, ...TTL_DEFAULTS },
  XOR: { gateType: 'XOR', inputCount: 2, ...TTL_DEFAULTS, propagationDelay: 15 },
};

/** 74 系列 IC 到逻辑门类型的映射 */
export const IC_TO_GATE_TYPE: Record<string, LogicGateType> = {
  '7400': 'NAND',
  '7402': 'NOR',
  '7404': 'NOT',
  '7408': 'AND',
  '7432': 'OR',
  '7486': 'XOR',
};

// ==================== 逻辑运算 ====================

/**
 * AND 逻辑运算
 * 支持四值逻辑
 */
export function logicAnd(inputs: LogicValue[]): LogicValue {
  if (inputs.includes('Z')) return 'X';
  if (inputs.includes('X')) return 'X';
  return inputs.every(v => v === 1) ? 1 : 0;
}

/**
 * OR 逻辑运算
 */
export function logicOr(inputs: LogicValue[]): LogicValue {
  if (inputs.includes('Z')) return 'X';
  if (inputs.includes('X')) return 'X';
  return inputs.some(v => v === 1) ? 1 : 0;
}

/**
 * NOT 逻辑运算
 */
export function logicNot(input: LogicValue): LogicValue {
  if (input === 'X' || input === 'Z') return 'X';
  return input === 1 ? 0 : 1;
}

/**
 * NAND 逻辑运算
 */
export function logicNand(inputs: LogicValue[]): LogicValue {
  return logicNot(logicAnd(inputs));
}

/**
 * NOR 逻辑运算
 */
export function logicNor(inputs: LogicValue[]): LogicValue {
  return logicNot(logicOr(inputs));
}

/**
 * XOR 逻辑运算
 */
export function logicXor(inputs: LogicValue[]): LogicValue {
  if (inputs.includes('Z')) return 'X';
  if (inputs.includes('X')) return 'X';
  let count = 0;
  for (const v of inputs) {
    if (v === 1) count++;
  }
  return count % 2 === 1 ? 1 : 0;
}

/**
 * 根据门类型计算输出
 *
 * @param gateType 逻辑门类型
 * @param inputs 输入值数组
 * @returns 输出值
 */
export function evaluateGate(gateType: LogicGateType, inputs: LogicValue[]): LogicValue {
  switch (gateType) {
    case 'AND': return logicAnd(inputs);
    case 'OR': return logicOr(inputs);
    case 'NOT': return logicNot(inputs[0]);
    case 'NAND': return logicNand(inputs);
    case 'NOR': return logicNor(inputs);
    case 'XOR': return logicXor(inputs);
    default: return 'X';
  }
}

// ==================== 真值表生成 ====================

/**
 * 生成逻辑门完整真值表
 *
 * @param gateType 逻辑门类型
 * @param inputCount 输入数量
 * @returns 真值表行 [{ inputs: LogicValue[], output: LogicValue }]
 */
export function generateTruthTable(
  gateType: LogicGateType,
  inputCount?: number
): { inputs: LogicValue[]; output: LogicValue }[] {
  const params = LOGIC_GATE_MODELS[gateType];
  const n = inputCount ?? params.inputCount;
  const rows: { inputs: LogicValue[]; output: LogicValue }[] = [];

  if (gateType === 'NOT') {
    rows.push({ inputs: [0], output: logicNot(0) });
    rows.push({ inputs: [1], output: logicNot(1) });
    return rows;
  }

  const totalRows = 1 << n; // 2^n
  for (let i = 0; i < totalRows; i++) {
    const inputs: LogicValue[] = [];
    for (let b = n - 1; b >= 0; b--) {
      inputs.push(((i >> b) & 1) as LogicValue);
    }
    const output = evaluateGate(gateType, inputs);
    rows.push({ inputs, output });
  }
  return rows;
}

// ==================== 时序分析 ====================

/**
 * 门电路传播延迟计算
 *
 * @param gateType 逻辑门类型
 * @param inputChange 输入变化时间 (ns)
 * @returns 输出变化时间 (ns)
 */
export function propagationDelay(gateType: LogicGateType, inputChange: number = 0): number {
  return inputChange + LOGIC_GATE_MODELS[gateType].propagationDelay;
}

/**
 * 建立时间检查（用于时序电路）
 *
 * @param inputStableTime 输入稳定时间 (ns)
 * @param clockEdge 时钟边沿时间 (ns)
 * @param setupTime 建立时间要求 (ns)
 * @returns 是否满足建立时间
 */
export function checkSetupTime(
  inputStableTime: number,
  clockEdge: number,
  setupTime: number = 5
): boolean {
  return clockEdge - inputStableTime >= setupTime;
}

/**
 * 保持时间检查
 *
 * @param clockEdgeTime 时钟边沿时间 (ns)
 * @param inputChangeTime 输入变化时间 (ns)
 * @param holdTime 保持时间要求 (ns)
 * @returns 是否满足保持时间
 */
export function checkHoldTime(
  clockEdgeTime: number,
  inputChangeTime: number,
  holdTime: number = 2
): boolean {
  return inputChangeTime - clockEdgeTime >= holdTime;
}

// ==================== 端口定义 ====================

/**
 * 生成逻辑门端口布局
 *
 * @param inputCount 输入数量
 * @param hasEnable 是否有使能端
 * @returns 端口数组
 */
export function createLogicGatePorts(inputCount: number, hasEnable: boolean = false): ComponentPort[] {
  const ports: ComponentPort[] = [];

  // 输入端口在左侧
  for (let i = 0; i < inputCount; i++) {
    const yOffset = (i - (inputCount - 1) / 2) * 20;
    ports.push({ id: `in${i}`, offset: { x: -30, y: yOffset } });
  }

  // 输出端口在右侧
  ports.push({ id: 'out', offset: { x: 30, y: 0 } });

  // 使能端口在下方
  if (hasEnable) {
    ports.push({ id: 'enable', offset: { x: 0, y: 25 } });
  }

  return ports;
}

/** AND 门端口（2输入） */
export const AND_PORTS: ComponentPort[] = createLogicGatePorts(2);

/** OR 门端口（2输入） */
export const OR_PORTS: ComponentPort[] = createLogicGatePorts(2);

/** NOT 门端口 */
export const NOT_PORTS: ComponentPort[] = createLogicGatePorts(1);

/** NAND 门端口（2输入） */
export const NAND_PORTS: ComponentPort[] = createLogicGatePorts(2);

/** NOR 门端口（2输入） */
export const NOR_PORTS: ComponentPort[] = createLogicGatePorts(2);

/** XOR 门端口（2输入） */
export const XOR_PORTS: ComponentPort[] = createLogicGatePorts(2);
