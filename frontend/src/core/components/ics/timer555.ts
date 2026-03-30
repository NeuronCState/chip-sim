/**
 * 555 定时器模型
 *
 * 经典的 555 定时器 IC 行为仿真
 * 支持 Astable（多谐振荡器）和 Monostable（单稳态）两种工作模式
 * 包含频率计算、占空比计算、时序分析等功能
 */

import type { ComponentPort } from '../../../types/circuit';

// ==================== 类型定义 ====================

/** 555 定时器工作模式 */
export type Timer555Mode = 'astable' | 'monostable';

/** 555 定时器参数 */
export interface Timer555Params {
  /** 工作模式 */
  mode: Timer555Mode;
  /** 电源电压 (V) */
  supplyVoltage: number;
  /** R1 阻值 (Ω)，Astable 模式下连接 VCC 和 DIS 的电阻 */
  r1: number;
  /** R2 阻值 (Ω)，Astable 模式下连接 DIS 和 TRIG/THR 的电阻 */
  r2: number;
  /** 定时电容 (F) */
  capacitance: number;
  /** 控制电压引脚外接电容 (F)，默认 10nF */
  controlVoltageCap: number;
  /** 输出驱动能力 (mA) */
  outputDrive: number;
  /** 传播延迟 (μs) */
  propagationDelay: number;
  /** 最高工作频率 (Hz) */
  maxFrequency: number;
  /** 静态电流 (mA) */
  quiescentCurrent: number;
  /** 型号名称 */
  modelName: string;
}

/** 555 定时器 Astable 模式计算结果 */
export interface AstableResult {
  /** 输出频率 (Hz) */
  frequency: number;
  /** 输出周期 (s) */
  period: number;
  /** 高电平时间 (s) */
  highTime: number;
  /** 低电平时间 (s) */
  lowTime: number;
  /** 占空比 (0-1) */
  dutyCycle: number;
  /** 控制电压 (V)，通常为 VCC 的 2/3 */
  controlVoltage: number;
}

/** 555 定时器 Monostable 模式计算结果 */
export interface MonostableResult {
  /** 脉冲宽度 (s) */
  pulseWidth: number;
  /** 控制电压 (V) */
  controlVoltage: number;
}

// ==================== 默认参数 ====================

/** 常见 555 定时器型号参数 */
export const TIMER555_MODELS: Record<string, Timer555Params> = {
  /** NE555 经典双极型 555 定时器 */
  NE555: {
    mode: 'astable',
    supplyVoltage: 5,
    r1: 10000,
    r2: 10000,
    capacitance: 100e-9,
    controlVoltageCap: 10e-9,
    outputDrive: 200,
    propagationDelay: 0.3,
    maxFrequency: 500000,
    quiescentCurrent: 10,
    modelName: 'NE555',
  },
  /** TLC555 CMOS 型 555 定时器，低功耗 */
  TLC555: {
    mode: 'astable',
    supplyVoltage: 5,
    r1: 10000,
    r2: 10000,
    capacitance: 100e-9,
    controlVoltageCap: 10e-9,
    outputDrive: 100,
    propagationDelay: 0.2,
    maxFrequency: 2000000,
    quiescentCurrent: 0.17,
    modelName: 'TLC555',
  },
  /** LMC555 CMOS 型 555 定时器，超低功耗 */
  LMC555: {
    mode: 'astable',
    supplyVoltage: 5,
    r1: 10000,
    r2: 10000,
    capacitance: 100e-9,
    controlVoltageCap: 10e-9,
    outputDrive: 100,
    propagationDelay: 0.095,
    maxFrequency: 3000000,
    quiescentCurrent: 0.1,
    modelName: 'LMC555',
  },
};

/** 默认 555 定时器参数（NE555） */
export const DEFAULT_TIMER555_PARAMS: Timer555Params = TIMER555_MODELS['NE555'];

// ==================== 555 定时器计算函数 ====================

/**
 * Astable 模式频率计算
 *
 * f = 1.44 / ((R1 + 2 × R2) × C)
 *
 * @param r1 R1 阻值 (Ω)
 * @param r2 R2 阻值 (Ω)
 * @param c 电容值 (F)
 * @returns 输出频率 (Hz)
 */
export function astableFrequency(r1: number, r2: number, c: number): number {
  if (r1 <= 0 || r2 <= 0 || c <= 0) return 0;
  return 1.44 / ((r1 + 2 * r2) * c);
}

/**
 * Astable 模式周期
 *
 * T = 0.693 × (R1 + 2 × R2) × C
 *
 * @param r1 R1 阻值 (Ω)
 * @param r2 R2 阻值 (Ω)
 * @param c 电容值 (F)
 * @returns 周期 (s)
 */
export function astablePeriod(r1: number, r2: number, c: number): number {
  if (r1 <= 0 || r2 <= 0 || c <= 0) return Infinity;
  return 0.693 * (r1 + 2 * r2) * c;
}

/**
 * Astable 模式高电平时间
 *
 * t_high = 0.693 × (R1 + R2) × C
 *
 * @param r1 R1 阻值 (Ω)
 * @param r2 R2 阻值 (Ω)
 * @param c 电容值 (F)
 * @returns 高电平时间 (s)
 */
export function astableHighTime(r1: number, r2: number, c: number): number {
  if (r1 <= 0 || r2 <= 0 || c <= 0) return 0;
  return 0.693 * (r1 + r2) * c;
}

/**
 * Astable 模式低电平时间
 *
 * t_low = 0.693 × R2 × C
 *
 * @param r2 R2 阻值 (Ω)
 * @param c 电容值 (F)
 * @returns 低电平时间 (s)
 */
export function astableLowTime(r2: number, c: number): number {
  if (r2 <= 0 || c <= 0) return 0;
  return 0.693 * r2 * c;
}

/**
 * Astable 模式占空比
 *
 * D = (R1 + R2) / (R1 + 2 × R2)
 *
 * 注意：Astable 模式下占空比始终大于 50%
 * 如需小于 50% 的占空比，需在 R2 两端并联二极管
 *
 * @param r1 R1 阻值 (Ω)
 * @param r2 R2 阻值 (Ω)
 * @returns 占空比 (0-1)
 */
export function astableDutyCycle(r1: number, r2: number): number {
  if (r1 <= 0 || r2 <= 0) return 0;
  return (r1 + r2) / (r1 + 2 * r2);
}

/**
 * Astable 模式完整计算
 *
 * @param r1 R1 阻值 (Ω)
 * @param r2 R2 阻值 (Ω)
 * @param c 电容值 (F)
 * @param supplyVoltage 电源电压 (V)
 * @returns AstableResult
 */
export function astableCalculate(
  r1: number,
  r2: number,
  c: number,
  supplyVoltage: number = 5
): AstableResult {
  const highTime = astableHighTime(r1, r2, c);
  const lowTime = astableLowTime(r2, c);
  const period = highTime + lowTime;
  const frequency = period > 0 ? 1 / period : 0;
  const dutyCycle = period > 0 ? highTime / period : 0;

  return {
    frequency: Math.round(frequency * 100) / 100,
    period,
    highTime,
    lowTime,
    dutyCycle: Math.round(dutyCycle * 10000) / 10000,
    controlVoltage: supplyVoltage * 2 / 3,
  };
}

/**
 * Monostable 模式脉冲宽度
 *
 * t_w = 1.1 × R × C
 *
 * @param r 定时电阻 (Ω)
 * @param c 定时电容 (F)
 * @returns 脉冲宽度 (s)
 */
export function monostablePulseWidth(r: number, c: number): number {
  if (r <= 0 || c <= 0) return 0;
  return 1.1 * r * c;
}

/**
 * Monostable 模式完整计算
 *
 * @param r 定时电阻 (Ω)
 * @param c 定时电容 (F)
 * @param supplyVoltage 电源电压 (V)
 * @returns MonostableResult
 */
export function monostableCalculate(
  r: number,
  c: number,
  supplyVoltage: number = 5
): MonostableResult {
  return {
    pulseWidth: monostablePulseWidth(r, c),
    controlVoltage: supplyVoltage * 2 / 3,
  };
}

/**
 * 根据目标频率反推 Astable 模式的 R 和 C 值
 *
 * 给定目标频率和 R2/R1 比值，计算推荐的 R1、R2、C 组合
 *
 * @param targetFrequency 目标频率 (Hz)
 * @param r2r1Ratio R2/R1 比值，默认为 1
 * @param preferredC 优选电容值 (F)，为 0 时自动选择
 * @returns { r1, r2, c, actualFrequency }
 */
export function astableDesign(
  targetFrequency: number,
  r2r1Ratio: number = 1,
  preferredC: number = 0
): { r1: number; r2: number; c: number; actualFrequency: number } {
  if (targetFrequency <= 0) {
    return { r1: 0, r2: 0, c: 0, actualFrequency: 0 };
  }

  let c: number;
  if (preferredC > 0) {
    c = preferredC;
  } else {
    // 自动选择合适的电容值（优先选择常见值）
    const commonCaps = [100e-12, 220e-12, 470e-12, 1e-9, 2.2e-9, 4.7e-9, 10e-9, 22e-9, 47e-9, 100e-9, 220e-9, 470e-9, 1e-6, 2.2e-6, 4.7e-6, 10e-6];
    // f = 1.44 / ((R1 + 2*R2) * C)
    // R1 + 2*R2 = 1.44 / (f * C)
    // 我们希望 R_total 在 1K ~ 1M 之间
    c = commonCaps.find(cap => {
      const rTotal = 1.44 / (targetFrequency * cap);
      return rTotal >= 1000 && rTotal <= 1e6;
    }) ?? 100e-9;
  }

  // R1 + 2*R2 = 1.44 / (f * C)
  // R2 = r2r1Ratio * R1
  // R1 + 2 * r2r1Ratio * R1 = 1.44 / (f * C)
  // R1 * (1 + 2 * r2r1Ratio) = 1.44 / (f * C)
  const r1 = 1.44 / (targetFrequency * c * (1 + 2 * r2r1Ratio));
  const r2 = r2r1Ratio * r1;

  // 取标准电阻值（向上取到 E12 系列）
  const e12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
  function nearestE12(val: number): number {
    const decade = Math.pow(10, Math.floor(Math.log10(val)));
    const mantissa = val / decade;
    const nearest = e12.reduce((prev, curr) =>
      Math.abs(curr - mantissa) < Math.abs(prev - mantissa) ? curr : prev
    );
    return nearest * decade;
  }

  const r1Std = nearestE12(r1);
  const r2Std = nearestE12(r2);
  const actualFrequency = astableFrequency(r1Std, r2Std, c);

  return {
    r1: r1Std,
    r2: r2Std,
    c,
    actualFrequency: Math.round(actualFrequency * 100) / 100,
  };
}

/**
 * 检查 555 定时器参数是否在有效范围内
 *
 * @param params 555 定时器参数
 * @returns { valid: boolean, warnings: string[] }
 */
export function timer555Validate(params: Timer555Params): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (params.mode === 'astable') {
    // Astable 模式检查
    if (params.r1 < 1000) {
      warnings.push('Astable 模式下 R1 不应小于 1kΩ，否则可能损坏内部放电管');
    }
    const freq = astableFrequency(params.r1, params.r2, params.capacitance);
    if (freq > params.maxFrequency) {
      warnings.push(`计算频率 ${Math.round(freq)} Hz 超过型号最大工作频率 ${params.maxFrequency} Hz`);
    }
    if (freq < 0.1) {
      warnings.push('计算频率过低（<0.1Hz），建议增大电容值或减小电阻值');
    }
    const duty = astableDutyCycle(params.r1, params.r2);
    if (duty <= 0.5) {
      warnings.push('标准 Astable 电路占空比不能低于 50%，如需更低占空比请在 R2 两端并联二极管');
    }
  } else {
    // Monostable 模式检查
    if (params.r1 < 1000) {
      warnings.push('Monostable 模式下定时电阻不应小于 1kΩ');
    }
    const pw = monostablePulseWidth(params.r1, params.capacitance);
    if (pw > 100) {
      warnings.push(`脉冲宽度 ${pw.toFixed(2)}s 过长，建议增大电阻或减小电容`);
    }
  }

  if (params.supplyVoltage < 4.5 || params.supplyVoltage > 16) {
    warnings.push('电源电压应在 4.5V ~ 16V 之间');
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * 555 定时器引脚电压状态（Astable 模式）
 *
 * 在一个完整周期内各引脚的电压变化
 *
 * @param time 当前时间 (s)
 * @param params 555 定时器参数
 * @returns 各引脚电压状态
 */
export function timer555PinStates(
  time: number,
  params: Timer555Params = DEFAULT_TIMER555_PARAMS
): {
  out: boolean;
  discharge: boolean;
  trigger: number;
  threshold: number;
  controlVoltage: number;
} {
  if (params.mode === 'astable') {
    const result = astableCalculate(params.r1, params.r2, params.capacitance, params.supplyVoltage);
    const t = time % result.period;
    const vth = result.controlVoltage; // 2/3 VCC

    if (t < result.highTime) {
      // 高电平阶段：电容充电
      const tau = (params.r1 + params.r2) * params.capacitance;
      const vc = params.supplyVoltage * (1 - Math.exp(-t / tau));
      return {
        out: true,
        discharge: true,
        trigger: Math.min(vc, params.supplyVoltage),
        threshold: Math.min(vc, params.supplyVoltage),
        controlVoltage: vth,
      };
    } else {
      // 低电平阶段：电容放电
      const tau = params.r2 * params.capacitance;
      const tDischarge = t - result.highTime;
      const vcStart = vth;
      const vc = vcStart * Math.exp(-tDischarge / tau);
      return {
        out: false,
        discharge: false,
        trigger: Math.max(0, vc),
        threshold: Math.max(0, vc),
        controlVoltage: vth,
      };
    }
  }

  // Monostable 模式
  const pw = monostablePulseWidth(params.r1, params.capacitance);
  const vth = params.supplyVoltage * 2 / 3;

  if (time >= 0 && time < pw) {
    const tau = params.r1 * params.capacitance;
    const vc = params.supplyVoltage * (1 - Math.exp(-time / tau));
    return {
      out: true,
      discharge: true,
      trigger: vc,
      threshold: vc,
      controlVoltage: vth,
    };
  }

  return {
    out: false,
    discharge: false,
    trigger: 0,
    threshold: 0,
    controlVoltage: vth,
  };
}

/**
 * 生成 Astable 模式波形数据
 *
 * @param params 555 定时器参数
 * @param cycles 输出周期数
 * @param pointsPerCycle 每周期采样点数
 * @returns { time: number, out: number, capacitor: number }[]
 */
export function generateAstableWaveform(
  params: Timer555Params = DEFAULT_TIMER555_PARAMS,
  cycles: number = 3,
  pointsPerCycle: number = 100
): { time: number; out: number; capacitor: number }[] {
  const result = astableCalculate(params.r1, params.r2, params.capacitance, params.supplyVoltage);
  const totalTime = result.period * cycles;
  const totalPoints = cycles * pointsPerCycle;
  const dt = totalTime / totalPoints;
  const data: { time: number; out: number; capacitor: number }[] = [];

  for (let i = 0; i < totalPoints; i++) {
    const t = i * dt;
    const states = timer555PinStates(t, params);
    data.push({
      time: Math.round(t * 1e6) / 1e6,
      out: states.out ? params.supplyVoltage : 0,
      capacitor: Math.round(states.threshold * 100) / 100,
    });
  }

  return data;
}

// ==================== 端口定义 ====================

/** 555 定时器 8 引脚布局 */
export const TIMER555_PORTS: ComponentPort[] = [
  { id: 'gnd', offset: { x: -20, y: 30 } },
  { id: 'trig', offset: { x: -10, y: 30 } },
  { id: 'out', offset: { x: 10, y: 30 } },
  { id: 'reset', offset: { x: 20, y: 30 } },
  { id: 'ctrl', offset: { x: 20, y: -30 } },
  { id: 'thr', offset: { x: 10, y: -30 } },
  { id: 'dis', offset: { x: -10, y: -30 } },
  { id: 'vcc', offset: { x: -20, y: -30 } },
];

/**
 * 测试用例描述：
 *
 * 测试 1: astableFrequency(10000, 10000, 100e-9) 应返回约 480.77 Hz
 *   公式验证：1.44 / ((10000 + 2*10000) * 100e-9) = 1.44 / (30000 * 100e-9) = 1.44 / 0.003 = 480
 *
 * 测试 2: astableDutyCycle(10000, 10000) 应返回 0.6667
 *   公式验证：(10000 + 10000) / (10000 + 20000) = 20000/30000 = 0.6667
 *
 * 测试 3: monostablePulseWidth(10000, 100e-9) 应返回 1.1e-3 (1.1ms)
 *   公式验证：1.1 * 10000 * 100e-9 = 1.1e-3
 *
 * 测试 4: astableCalculate(4700, 4700, 10e-9) 频率应约为 48kHz
 *
 * 测试 5: timer555Validate 对低占空比应给出警告
 *
 * 测试 6: astableDesign(1000) 应返回合理的 R1, R2, C 组合
 *
 * 测试 7: generateAstableWaveform 应返回 3 个完整周期的波形数据
 */
