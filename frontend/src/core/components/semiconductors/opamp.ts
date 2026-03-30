/**
 * 运算放大器（Op-Amp）模型
 *
 * 宏模型级别的运放行为仿真
 * 包含有限增益、频率响应、摆率限制、输入/输出阻抗
 */

import type { ComponentPort } from '../../../types/circuit';

// ==================== 类型定义 ====================

/** 运算放大器参数 */
export interface OpAmpParams {
  /** 开环直流增益 (V/V)，典型 1e5 ~ 1e6 */
  openLoopGain: number;
  /** 增益带宽积 GBW (Hz) */
  gainBandwidthProduct: number;
  /** 主极点频率 (Hz) */
  dominantPoleFreq: number;
  /** 单位增益带宽 (Hz) */
  unityGainBandwidth: number;
  /** 摆率 (V/μs) */
  slewRate: number;
  /** 输入电阻 (Ω) */
  inputResistance: number;
  /** 输出电阻 (Ω) */
  outputResistance: number;
  /** 输入失调电压 (V) */
  inputOffsetVoltage: number;
  /** 输入偏置电流 (A) */
  inputBiasCurrent: number;
  /** 输入失调电流 (A) */
  inputOffsetCurrent: number;
  /** 共模抑制比 CMRR (dB) */
  cmrr: number;
  /** 电源抑制比 PSRR (dB) */
  psrr: number;
  /** 输出电压摆幅 (V)，相对于电源轨 */
  outputSwing: { min: number; max: number };
  /** 电源电压 (V) */
  supplyVoltage: { positive: number; negative: number };
  /** 静态功耗 (mW) */
  quiescentPower: number;
  /** 输入共模电压范围 (V) */
  inputCommonModeRange: { min: number; max: number };
  /** 等效输入噪声电压密度 (nV/√Hz) */
  noiseVoltageDensity: number;
  /** 型号名称 */
  modelName: string;
}

// ==================== 默认参数 ====================

/** 常见运放型号参数 */
export const OPAMP_MODELS: Record<string, OpAmpParams> = {
  /** μA741 经典通用运放 */
  '741': {
    openLoopGain: 200000,
    gainBandwidthProduct: 1.5e6,
    dominantPoleFreq: 7.5,
    unityGainBandwidth: 1.5e6,
    slewRate: 0.5,
    inputResistance: 2e6,
    outputResistance: 75,
    inputOffsetVoltage: 1e-3,
    inputBiasCurrent: 80e-9,
    inputOffsetCurrent: 20e-9,
    cmrr: 90,
    psrr: 96,
    outputSwing: { min: -13, max: 13 },
    supplyVoltage: { positive: 15, negative: -15 },
    quiescentPower: 50,
    inputCommonModeRange: { min: -12, max: 13 },
    noiseVoltageDensity: 23,
    modelName: '741',
  },
  /** TL072 低噪声 JFET 输入运放 */
  'TL072': {
    openLoopGain: 200000,
    gainBandwidthProduct: 3e6,
    dominantPoleFreq: 15,
    unityGainBandwidth: 3e6,
    slewRate: 13,
    inputResistance: 1e12,
    outputResistance: 60,
    inputOffsetVoltage: 3e-3,
    inputBiasCurrent: 65e-12,
    inputOffsetCurrent: 5e-12,
    cmrr: 86,
    psrr: 86,
    outputSwing: { min: -13.5, max: 13.5 },
    supplyVoltage: { positive: 15, negative: -15 },
    quiescentPower: 24,
    inputCommonModeRange: { min: -11, max: 15 },
    noiseVoltageDensity: 18,
    modelName: 'TL072',
  },
  /** LM358 通用双运放 */
  'LM358': {
    openLoopGain: 100000,
    gainBandwidthProduct: 1e6,
    dominantPoleFreq: 10,
    unityGainBandwidth: 1e6,
    slewRate: 0.3,
    inputResistance: 1e9,
    outputResistance: 75,
    inputOffsetVoltage: 2e-3,
    inputBiasCurrent: 45e-9,
    inputOffsetCurrent: 5e-9,
    cmrr: 80,
    psrr: 80,
    outputSwing: { min: 0, max: 13.5 },
    supplyVoltage: { positive: 15, negative: 0 },
    quiescentPower: 10,
    inputCommonModeRange: { min: 0, max: 13.5 },
    noiseVoltageDensity: 40,
    modelName: 'LM358',
  },
  /** OPA2134 高性能音频运放 */
  'OPA2134': {
    openLoopGain: 500000,
    gainBandwidthProduct: 8e6,
    dominantPoleFreq: 16,
    unityGainBandwidth: 8e6,
    slewRate: 20,
    inputResistance: 1e13,
    outputResistance: 50,
    inputOffsetVoltage: 0.5e-3,
    inputBiasCurrent: 2e-12,
    inputOffsetCurrent: 0.5e-12,
    cmrr: 100,
    psrr: 100,
    outputSwing: { min: -13.5, max: 13.5 },
    supplyVoltage: { positive: 15, negative: -15 },
    quiescentPower: 36,
    inputCommonModeRange: { min: -12, max: 15 },
    noiseVoltageDensity: 8,
    modelName: 'OPA2134',
  },
};

/** 默认运放参数（741） */
export const DEFAULT_OPAMP_PARAMS: OpAmpParams = OPAMP_MODELS['741'];

// ==================== 运放行为模型 ====================

/**
 * 运算放大器输出电压计算
 *
 * 基本模型：Vo = Aol × (V+ - V-) + Vos
 * 带输出摆幅限制和摆率限制
 *
 * @param vPlus 同相输入端电压 (V)
 * @param vMinus 反相输入端电压 (V)
 * @param params 运放参数
 * @returns 输出电压 (V)
 */
export function opampOutputVoltage(
  vPlus: number,
  vMinus: number,
  params: OpAmpParams = DEFAULT_OPAMP_PARAMS
): number {
  // 输入差分电压
  const vDiff = vPlus - vMinus;
  // 开环增益 × 差分电压 + 失调电压
  let vOut = params.openLoopGain * vDiff + params.inputOffsetVoltage;
  // 输出摆幅限制
  vOut = Math.max(params.outputSwing.min, Math.min(params.outputSwing.max, vOut));
  return vOut;
}

/**
 * 考虑频率响应的增益
 *
 * 单极点模型：A(f) = Aol / (1 + j × f / fp)
 * 幅度：|A(f)| = Aol / √(1 + (f/fp)²)
 *
 * @param frequency 信号频率 (Hz)
 * @param params 运放参数
 * @returns 增益幅度 (V/V)
 */
export function opampGainAtFrequency(
  frequency: number,
  params: OpAmpParams = DEFAULT_OPAMP_PARAMS
): number {
  const ratio = frequency / params.dominantPoleFreq;
  return params.openLoopGain / Math.sqrt(1 + ratio * ratio);
}

/**
 * 考虑频率响应的增益（dB）
 *
 * @param frequency 信号频率 (Hz)
 * @param params 运放参数
 * @returns 增益 (dB)
 */
export function opampGainDB(
  frequency: number,
  params: OpAmpParams = DEFAULT_OPAMP_PARAMS
): number {
  const gain = opampGainAtFrequency(frequency, params);
  return 20 * Math.log10(Math.max(gain, 1e-6));
}

/**
 * 相移
 *
 * φ(f) = -arctan(f / fp)
 *
 * @param frequency 信号频率 (Hz)
 * @param params 运放参数
 * @returns 相移 (度)
 */
export function opampPhaseShift(
  frequency: number,
  params: OpAmpParams = DEFAULT_OPAMP_PARAMS
): number {
  return -Math.atan2(frequency, params.dominantPoleFreq) * (180 / Math.PI);
}

/**
 * 摆率限制检查
 *
 * 当输出变化率 dv/dt 超过摆率时，输出被限制
 *
 * dV/dt ≤ SR (V/μs)
 *
 * @param desiredOutput 期望输出电压 (V)
 * @param previousOutput 上一时刻输出电压 (V)
 * @param timeStep 时间步长 (s)
 * @param params 运放参数
 * @returns 实际输出电压 (V)
 */
export function opampSlewRateLimit(
  desiredOutput: number,
  previousOutput: number,
  timeStep: number,
  params: OpAmpParams = DEFAULT_OPAMP_PARAMS
): number {
  const sr = params.slewRate * 1e6; // V/μs → V/s
  const maxChange = sr * timeStep;
  const change = desiredOutput - previousOutput;

  if (Math.abs(change) > maxChange) {
    return previousOutput + Math.sign(change) * maxChange;
  }
  return desiredOutput;
}

/**
 * 闭环增益（同相放大器）
 *
 * G = 1 + Rf / Rg
 *
 * @param feedbackResistor 反馈电阻 Rf (Ω)
 * @param gainResistor 增益电阻 Rg (Ω)
 * @returns 闭环增益 (V/V)
 */
export function nonInvertingGain(feedbackResistor: number, gainResistor: number): number {
  if (gainResistor <= 0) return 1;
  return 1 + feedbackResistor / gainResistor;
}

/**
 * 闭环增益（反相放大器）
 *
 * G = -Rf / Rin
 *
 * @param feedbackResistor 反馈电阻 Rf (Ω)
 * @param inputResistor 输入电阻 Rin (Ω)
 * @returns 闭环增益 (V/V)，为负值
 */
export function invertingGain(feedbackResistor: number, inputResistor: number): number {
  if (inputResistor <= 0) return 0;
  return -feedbackResistor / inputResistor;
}

/**
 * 带宽增益积约束
 *
 * 闭环后：BW = GBW / |Gain_cl|
 *
 * @param closedLoopGain 闭环增益 (V/V)
 * @param params 运放参数
 * @returns -3dB 带宽 (Hz)
 */
export function closedLoopBandwidth(
  closedLoopGain: number,
  params: OpAmpParams = DEFAULT_OPAMP_PARAMS
): number {
  return params.gainBandwidthProduct / Math.abs(closedLoopGain);
}

/**
 * 反馈稳定性分析：相位裕度
 *
 * 在增益为 0dB 的频率处，相位距离 -180° 的余量
 *
 * @param params 运放参数
 * @returns 相位裕度 (度)
 */
export function phaseMargin(_params: OpAmpParams = DEFAULT_OPAMP_PARAMS): number {
  // 单极点系统相位裕度 = 180° - 90° = 90°（理想情况）
  // 实际运放有更多极点，简化为单极点模型
  return 90;
}

/**
 * 生成开环频率响应曲线
 *
 * @param startFreq 起始频率 (Hz)
 * @param stopFreq 终止频率 (Hz)
 * @param points 采样点数
 * @param params 运放参数
 * @returns { freq: number, gainDB: number, phase: number }[]
 */
export function generateOpenLoopResponse(
  startFreq: number = 1,
  stopFreq: number = 10e6,
  points: number = 100,
  params: OpAmpParams = DEFAULT_OPAMP_PARAMS
): { freq: number; gainDB: number; phase: number }[] {
  const data: { freq: number; gainDB: number; phase: number }[] = [];
  const logStart = Math.log10(startFreq);
  const logStop = Math.log10(stopFreq);
  const step = (logStop - logStart) / (points - 1);

  for (let i = 0; i < points; i++) {
    const freq = Math.pow(10, logStart + i * step);
    const gainDB = opampGainDB(freq, params);
    const phase = opampPhaseShift(freq, params);
    data.push({
      freq: Math.round(freq),
      gainDB: Math.round(gainDB * 100) / 100,
      phase: Math.round(phase * 10) / 10,
    });
  }
  return data;
}

/**
 * 生成闭环瞬态响应（简化模型）
 *
 * @param inputSignal 输入信号函数
 * @param duration 仿真时长 (s)
 * @param timeStep 时间步长 (s)
 * @param closedLoopGain 闭环增益
 * @param params 运放参数
 * @returns { time: number, input: number, output: number }[]
 */
export function generateClosedLoopTransient(
  inputSignal: (t: number) => number,
  duration: number = 1e-3,
  timeStep: number = 1e-6,
  closedLoopGain: number = 1,
  params: OpAmpParams = DEFAULT_OPAMP_PARAMS
): { time: number; input: number; output: number }[] {
  const data: { time: number; input: number; output: number }[] = [];
  const steps = Math.floor(duration / timeStep);
  let prevOutput = 0;

  for (let i = 0; i < steps; i++) {
    const t = i * timeStep;
    const input = inputSignal(t);
    let output = closedLoopGain * input;
    // 摆率限制
    output = opampSlewRateLimit(output, prevOutput, timeStep, params);
    // 输出摆幅限制
    output = Math.max(params.outputSwing.min, Math.min(params.outputSwing.max, output));
    prevOutput = output;
    data.push({ time: t * 1e6, input: Math.round(input * 1000) / 1000, output: Math.round(output * 1000) / 1000 });
  }
  return data;
}

// ==================== 端口定义 ====================

/** 运放端口布局：同相输入(+)、反相输入(-)、输出(OUT)、正电源(V+)、负电源(V-) */
export const OPAMP_PORTS: ComponentPort[] = [
  { id: 'non_inverting', offset: { x: -30, y: -15 } },
  { id: 'inverting', offset: { x: -30, y: 15 } },
  { id: 'output', offset: { x: 30, y: 0 } },
  { id: 'vcc', offset: { x: 0, y: -30 } },
  { id: 'vee', offset: { x: 0, y: 30 } },
];
