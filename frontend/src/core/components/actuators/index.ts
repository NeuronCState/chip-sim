/**
 * 执行器元件定义
 *
 * 蜂鸣器（有源/无源）、继电器、步进电机、LCD显示屏
 */

// ==================== 类型定义 ====================

/** 有源蜂鸣器参数 */
export interface BuzzerActiveParams {
  /** 额定电压 (V) */
  ratedVoltage: number;
  /** 工作电压范围 */
  voltageRange: { min: number; max: number };
  /** 频率 (Hz) */
  frequency: number;
  /** 声压级 (dB) @ 10cm */
  soundPressure: number;
  /** 工作电流 (mA) */
  current: number;
  /** 内部驱动电路 */
  hasDriver: boolean;
}

/** 无源蜂鸣器参数 */
export interface BuzzerPassiveParams {
  /** 额定电压 (V) */
  ratedVoltage: number;
  /** 谐振频率 (Hz) */
  resonantFreq: number;
  /** 频率范围 (Hz) */
  freqRange: { min: number; max: number };
  /** 声压级 (dB) @ 10cm */
  soundPressure: number;
  /** 工作电流 (mA) */
  current: number;
  /** 谐振阻抗 (Ω) */
  impedance: number;
}

/** 继电器参数 */
export interface RelayParams {
  /** 线圈电压 (V) */
  coilVoltage: number;
  /** 线圈电阻 (Ω) */
  coilResistance: number;
  /** 触点类型 */
  contactType: 'SPST' | 'SPDT' | 'DPDT';
  /** 触点最大电压 (V) */
  maxSwitchingVoltage: number;
  /** 触点最大电流 (A) */
  maxSwitchingCurrent: number;
  /** 吸合时间 (ms) */
  operateTime: number;
  /** 释放时间 (ms) */
  releaseTime: number;
  /** 触点电阻 (mΩ) */
  contactResistance: number;
  /** 电气寿命 (次) */
  electricalLife: number;
  /** 机械寿命 (次) */
  mechanicalLife: number;
}

/** 步进电机参数 */
export interface StepperMotorParams {
  /** 步进角 (°) */
  stepAngle: number;
  /** 相数 */
  phases: number;
  /** 额定电压 (V) */
  ratedVoltage: number;
  /** 额定电流 (A/相) */
  ratedCurrent: number;
  /** 相电阻 (Ω) */
  phaseResistance: number;
  /** 相电感 (mH) */
  phaseInductance: number;
  /** 保持力矩 (N·cm) */
  holdingTorque: number;
  /** 转动惯量 (g·cm²) */
  rotorInertia: number;
  /** 电机类型 */
  type: 'bipolar' | 'unipolar';
}

/** LCD 显示屏参数 */
export interface LCDDisplayParams {
  /** 列数 */
  columns: number;
  /** 行数 */
  rows: number;
  /** 接口类型 */
  interface: 'parallel_4bit' | 'parallel_8bit' | 'i2c' | 'spi';
  /** 背光类型 */
  backlight: 'LED' | 'EL' | 'none';
  /** 背光电流 (mA) */
  backlightCurrent: number;
  /** 工作电压 (V) */
  vdd: number;
  /** 控制器型号 */
  controller: string;
  /** 字符集 */
  charset: string;
}

// ==================== 默认参数 ====================

/** 常见蜂鸣器型号 */
export const BUZZER_ACTIVE_MODELS = {
  PS1240P02BT: {
    ratedVoltage: 5,
    voltageRange: { min: 3, max: 7 },
    frequency: 2700,
    soundPressure: 85,
    current: 30,
    hasDriver: true,
  },
  TMB12A05: {
    ratedVoltage: 5,
    voltageRange: { min: 4, max: 8 },
    frequency: 2400,
    soundPressure: 85,
    current: 30,
    hasDriver: true,
  },
} as const;

export const BUZZER_PASSIVE_MODELS = {
  CMI_1203: {
    ratedVoltage: 5,
    resonantFreq: 2048,
    freqRange: { min: 500, max: 4000 },
    soundPressure: 80,
    current: 20,
    impedance: 16,
  },
  PKM13EPYH4002: {
    ratedVoltage: 3,
    resonantFreq: 4000,
    freqRange: { min: 3000, max: 5000 },
    soundPressure: 85,
    current: 15,
    impedance: 100,
  },
} as const;

/** 继电器型号 */
export const RELAY_MODELS = {
  SRD_05VDC: {
    coilVoltage: 5,
    coilResistance: 70,
    contactType: 'SPDT' as const,
    maxSwitchingVoltage: 250,
    maxSwitchingCurrent: 10,
    operateTime: 10,
    releaseTime: 5,
    contactResistance: 100,
    electricalLife: 100000,
    mechanicalLife: 10000000,
  },
  SRD_12VDC: {
    coilVoltage: 12,
    coilResistance: 360,
    contactType: 'SPDT' as const,
    maxSwitchingVoltage: 250,
    maxSwitchingCurrent: 10,
    operateTime: 10,
    releaseTime: 5,
    contactResistance: 100,
    electricalLife: 100000,
    mechanicalLife: 10000000,
  },
  HFD4_5V: {
    coilVoltage: 5,
    coilResistance: 178,
    contactType: 'DPDT' as const,
    maxSwitchingVoltage: 125,
    maxSwitchingCurrent: 2,
    operateTime: 3,
    releaseTime: 3,
    contactResistance: 100,
    electricalLife: 100000,
    mechanicalLife: 10000000,
  },
} as const;

/** 步进电机型号 */
export const STEPPER_MODELS = {
  '28BYJ48': {
    stepAngle: 5.625,  // 实际步进角 5.625°/64
    phases: 4,
    ratedVoltage: 5,
    ratedCurrent: 0.16,
    phaseResistance: 50,
    phaseInductance: 30,
    holdingTorque: 0.3,
    rotorInertia: 2.5,
    type: 'unipolar' as const,
  },
  NEMA17: {
    stepAngle: 1.8,
    phases: 2,
    ratedVoltage: 12,
    ratedCurrent: 1.7,
    phaseResistance: 1.5,
    phaseInductance: 2.8,
    holdingTorque: 40,
    rotorInertia: 54,
    type: 'bipolar' as const,
  },
} as const;

/** LCD 型号 */
export const LCD_MODELS = {
  '1602_I2C': {
    columns: 16,
    rows: 2,
    interface: 'i2c' as const,
    backlight: 'LED' as const,
    backlightCurrent: 20,
    vdd: 5,
    controller: 'HD44780',
    charset: 'A02',
  },
  '2004_I2C': {
    columns: 20,
    rows: 4,
    interface: 'i2c' as const,
    backlight: 'LED' as const,
    backlightCurrent: 40,
    vdd: 5,
    controller: 'HD44780',
    charset: 'A02',
  },
} as const;

// ==================== 蜂鸣器模型 ====================

/**
 * 有源蜂鸣器：给定电压即响
 * @returns 是否发声
 */
export function buzzerActiveDrive(voltage: number, params: BuzzerActiveParams): boolean {
  return voltage >= params.voltageRange.min && voltage <= params.voltageRange.max;
}

/**
 * 无源蜂鸣器：需要 PWM 驱动
 * @param frequency 驱动频率 (Hz)
 * @param dutyCycle 占空比 (0-1)
 * @returns 相对音量 (0-1)
 */
export function buzzerPassiveDrive(
  frequency: number,
  dutyCycle: number = 0.5,
  params: BuzzerPassiveParams = BUZZER_PASSIVE_MODELS.CMI_1203
): number {
  if (frequency < params.freqRange.min || frequency > params.freqRange.max) return 0;
  // 谐振频率处音量最大
  const dist = Math.abs(frequency - params.resonantFreq);
  const qFactor = 5; // 品质因数
  const bandwidth = params.resonantFreq / qFactor;
  const volume = Math.exp(-(dist * dist) / (2 * bandwidth * bandwidth)) * dutyCycle;
  return Math.min(volume, 1);
}

// ==================== 继电器模型 ====================

/**
 * 继电器线圈电流
 *
 * I = V_coil / R_coil
 *
 * @param coilVoltage 线圈电压 (V)
 * @param params 继电器参数
 * @returns 线圈电流 (mA)
 */
export function relayCoilCurrent(coilVoltage: number, params: RelayParams = RELAY_MODELS.SRD_05VDC): number {
  return (coilVoltage / params.coilResistance) * 1000;
}

/**
 * 继电器线圈功耗
 *
 * P = V² / R
 */
export function relayPower(coilVoltage: number, params: RelayParams = RELAY_MODELS.SRD_05VDC): number {
  return (coilVoltage * coilVoltage) / params.coilResistance;
}

// ==================== 步进电机模型 ====================

/** 步进模式 */
export type StepMode = 'full' | 'half' | 'microstep_8' | 'microstep_16';

/**
 * 步进电机实际步距角
 *
 * @param mode 步进模式
 * @param params 电机参数
 * @returns 实际步距角 (°)
 */
export function stepperStepAngle(mode: StepMode = 'full', params: StepperMotorParams = STEPPER_MODELS.NEMA17): number {
  const divisors: Record<StepMode, number> = {
    full: 1,
    half: 2,
    microstep_8: 8,
    microstep_16: 16,
  };
  return params.stepAngle / divisors[mode];
}

/**
 * 步进电机转速
 *
 * RPM = (step_frequency × step_angle) / (360 / 60)
 *
 * @param stepFrequency 步进脉冲频率 (Hz)
 * @param mode 步进模式
 * @param params 电机参数
 * @returns 转速 (RPM)
 */
export function stepperRPM(
  stepFrequency: number,
  mode: StepMode = 'full',
  params: StepperMotorParams = STEPPER_MODELS.NEMA17
): number {
  const angle = stepperStepAngle(mode, params);
  return (stepFrequency * angle * 60) / 360;
}

/**
 * 步进电机每相电流（简化恒流驱动）
 */
export function stepperPhaseCurrent(_stepMode: StepMode, params: StepperMotorParams): number {
  return params.ratedCurrent;
}

// ==================== LCD 显示屏模型 ====================

/**
 * HD44780 LCD 控制器初始化序列
 */
export function lcdInitSequence(interfaceType: LCDDisplayParams['interface']): string[] {
  const cmds: string[] = [];
  if (interfaceType === 'parallel_4bit') {
    cmds.push(
      '0x33', // 初始化
      '0x32', // 设置4位模式
      '0x28', // 4位模式，2行，5x8字体
      '0x0C', // 显示开，光标关
      '0x06', // 光标右移
      '0x01', // 清屏
    );
  } else {
    cmds.push(
      '0x38', // 8位模式，2行，5x8字体
      '0x0C', // 显示开，光标关
      '0x06', // 光标右移
      '0x01', // 清屏
    );
  }
  return cmds;
}

/**
 * LCD DDRAM 地址计算
 *
 * 1602: Line1: 0x00-0x0F, Line2: 0x40-0x4F
 * 2004: Line1: 0x00-0x13, Line2: 0x40-0x53, Line3: 0x14-0x27, Line4: 0x54-0x67
 *
 * @param row 行号 (0-based)
 * @param col 列号 (0-based)
 * @param params LCD 参数
 * @returns DDRAM 地址
 */
export function lcdDDRAMAddress(row: number, col: number, _params: LCDDisplayParams): number {
  const offsets: Record<number, number> = {
    0: 0x00,
    1: 0x40,
    2: 0x14,
    3: 0x54,
  };
  return (offsets[row] || 0) + col;
}

/**
 * LCD 写入命令
 * @returns 命令字节
 */
export function lcdCommand(cmd: 'clear' | 'home' | 'display_on' | 'display_off' | 'cursor_on' | 'cursor_off'): number {
  const commands: Record<string, number> = {
    clear: 0x01,
    home: 0x02,
    display_on: 0x0C,
    display_off: 0x08,
    cursor_on: 0x0E,
    cursor_off: 0x0C,
  };
  return commands[cmd] || 0;
}

// ==================== 舵机（Servo Motor） ====================

/** 舵机参数 */
export interface ServoMotorParams {
  /** 工作电压 (V) */
  ratedVoltage: number;
  /** 堵转力矩 (kg·cm) */
  stallTorque: number;
  /** 工作角度范围 */
  angleRange: { min: number; max: number };
  /** 脉冲宽度范围 (μs) */
  pulseRange: { min: number; max: number };
  /** 信号周期 (ms)，标准 20ms */
  signalPeriod: number;
  /** 空载转速 (°/s) @ 60° */
  noLoadSpeed: number;
  /** 空载电流 (mA) */
  noLoadCurrent: number;
  /** 堵转电流 (mA) */
  stallCurrent: number;
  /** 齿轮比 */
  gearRatio: number;
  /** 重量 (g) */
  weight: number;
  /** 型号名称 */
  modelName: string;
}

/** 常见舵机型号 */
export const SERVO_MOTOR_MODELS: Record<string, ServoMotorParams> = {
  /** SG90 微型舵机（9g） */
  'SG90': {
    ratedVoltage: 5,
    stallTorque: 1.8,
    angleRange: { min: 0, max: 180 },
    pulseRange: { min: 500, max: 2500 },
    signalPeriod: 20,
    noLoadSpeed: 600,
    noLoadCurrent: 150,
    stallCurrent: 650,
    gearRatio: 1,
    weight: 9,
    modelName: 'SG90',
  },
  /** MG996R 大扭力舵机 */
  'MG996R': {
    ratedVoltage: 6,
    stallTorque: 11,
    angleRange: { min: 0, max: 180 },
    pulseRange: { min: 500, max: 2500 },
    signalPeriod: 20,
    noLoadSpeed: 400,
    noLoadCurrent: 500,
    stallCurrent: 2500,
    gearRatio: 1,
    weight: 55,
    modelName: 'MG996R',
  },
  /** MG90S 金属齿轮舵机 */
  'MG90S': {
    ratedVoltage: 5,
    stallTorque: 2.2,
    angleRange: { min: 0, max: 180 },
    pulseRange: { min: 500, max: 2500 },
    signalPeriod: 20,
    noLoadSpeed: 600,
    noLoadCurrent: 200,
    stallCurrent: 700,
    gearRatio: 1,
    weight: 13.4,
    modelName: 'MG90S',
  },
};

/** 默认舵机参数 */
export const DEFAULT_SERVO_PARAMS: ServoMotorParams = SERVO_MOTOR_MODELS['SG90'];

/**
 * PWM 脉冲宽度 → 舵机角度
 *
 * @param pulseWidth 脉冲宽度 (μs)
 * @param params 舵机参数
 * @returns 角度 (°)
 */
export function servoPulseToAngle(
  pulseWidth: number,
  params: ServoMotorParams = DEFAULT_SERVO_PARAMS
): number {
  const { min, max } = params.pulseRange;
  const ratio = Math.max(0, Math.min(1, (pulseWidth - min) / (max - min)));
  return params.angleRange.min + ratio * (params.angleRange.max - params.angleRange.min);
}

/**
 * 舵机角度 → PWM 脉冲宽度
 *
 * @param angle 目标角度 (°)
 * @param params 舵机参数
 * @returns 脉冲宽度 (μs)
 */
export function servoAngleToPulse(
  angle: number,
  params: ServoMotorParams = DEFAULT_SERVO_PARAMS
): number {
  const { min: aMin, max: aMax } = params.angleRange;
  const ratio = Math.max(0, Math.min(1, (angle - aMin) / (aMax - aMin)));
  return params.pulseRange.min + ratio * (params.pulseRange.max - params.pulseRange.min);
}

/**
 * 舵机电流估算（线性插值）
 *
 * @param angle 目标角度 (°)
 * @param params 舵机参数
 * @returns 估算电流 (mA)
 */
export function servoCurrentEstimate(
  _angle: number,
  params: ServoMotorParams = DEFAULT_SERVO_PARAMS
): number {
  // 简化模型：空载电流 + 偏移量
  return params.noLoadCurrent;
}

/**
 * 舵机功耗
 *
 * @param params 舵机参数
 * @returns 功耗 (mW)
 */
export function servoPower(params: ServoMotorParams = DEFAULT_SERVO_PARAMS): number {
  return params.ratedVoltage * params.noLoadCurrent;
}

// ==================== 扩展执行器（电磁阀、加热器、螺线管等） ====================

export type { SolenoidValveParams, HeaterParams, SolenoidParams, VibrationMotorParams, FanParams } from './actuator-extended';
export {
  SOLENOID_VALVE_MODELS,
  solenoidValvePower,
  HEATER_MODELS,
  heaterCurrent,
  heaterPower,
  SOLENOID_MODELS,
  VIBRATION_MOTOR_MODELS,
  FAN_MODELS,
  SERVO_EXTENDED_MODELS,
  DC_MOTOR_EXTENDED_MODELS,
} from './actuator-extended';

// ==================== 直流电机（DC Motor） ====================

/** 直流电机参数 */
export interface DCMotorParams {
  /** 额定电压 (V) */
  ratedVoltage: number;
  /** 空载转速 (RPM) @ 额定电压 */
  noLoadSpeed: number;
  /** 空载电流 (mA) */
  noLoadCurrent: number;
  /** 堵转力矩 (mN·m) */
  stallTorque: number;
  /** 堵转电流 (mA) */
  stallCurrent: number;
  /** 电机常数 Kt = Ke (mV/RPM) */
  motorConstant: number;
  /** 绕组电阻 (Ω) */
  windingResistance: number;
  /** 绕组电感 (mH) */
  windingInductance: number;
  /** 转动惯量 (g·cm²) */
  rotorInertia: number;
  /** 摩擦力矩 (mN·m) */
  frictionTorque: number;
  /** 型号名称 */
  modelName: string;
}

/** 常见直流电机型号 */
export const DC_MOTOR_MODELS: Record<string, DCMotorParams> = {
  /** N20 微型减速电机 */
  'N20_3V': {
    ratedVoltage: 3,
    noLoadSpeed: 100,
    noLoadCurrent: 60,
    stallTorque: 0.4,
    stallCurrent: 400,
    motorConstant: 30,
    windingResistance: 7.5,
    windingInductance: 0.1,
    rotorInertia: 0.5,
    frictionTorque: 0.02,
    modelName: 'N20-3V',
  },
  /** N20 6V 减速电机 */
  'N20_6V': {
    ratedVoltage: 6,
    noLoadSpeed: 200,
    noLoadCurrent: 40,
    stallTorque: 0.8,
    stallCurrent: 300,
    motorConstant: 30,
    windingResistance: 20,
    windingInductance: 0.2,
    rotorInertia: 0.5,
    frictionTorque: 0.02,
    modelName: 'N20-6V',
  },
  /** GA12-N20 12V 减速电机 */
  'GA12_12V': {
    ratedVoltage: 12,
    noLoadSpeed: 300,
    noLoadCurrent: 30,
    stallTorque: 2.0,
    stallCurrent: 250,
    motorConstant: 48,
    windingResistance: 48,
    windingInductance: 0.5,
    rotorInertia: 0.8,
    frictionTorque: 0.05,
    modelName: 'GA12-N20',
  },
  /** TT 马达（小车常用） */
  'TT_MOTOR': {
    ratedVoltage: 6,
    noLoadSpeed: 180,
    noLoadCurrent: 80,
    stallTorque: 1.5,
    stallCurrent: 800,
    motorConstant: 33,
    windingResistance: 7.5,
    windingInductance: 0.3,
    rotorInertia: 2.0,
    frictionTorque: 0.08,
    modelName: 'TT-Motor',
  },
  /** 775 大功率电机 */
  '775_12V': {
    ratedVoltage: 12,
    noLoadSpeed: 6000,
    noLoadCurrent: 300,
    stallTorque: 200,
    stallCurrent: 25000,
    motorConstant: 2.0,
    windingResistance: 0.48,
    windingInductance: 0.01,
    rotorInertia: 15,
    frictionTorque: 2.0,
    modelName: '775-12V',
  },
};

/** 默认直流电机参数 */
export const DEFAULT_DC_MOTOR_PARAMS: DCMotorParams = DC_MOTOR_MODELS['TT_MOTOR'];

/**
 * 直流电机速度-电压关系
 *
 * RPM = (V - I × R) / Ke
 *
 * @param voltage 供电电压 (V)
 * @param loadTorque 负载力矩 (mN·m)
 * @param params 电机参数
 * @returns 转速 (RPM)
 */
export function dcMotorSpeed(
  voltage: number,
  _loadTorque: number = 0,
  params: DCMotorParams = DEFAULT_DC_MOTOR_PARAMS
): number {
  if (params.motorConstant <= 0) return 0;
  const Ke = params.motorConstant; // mV/RPM
  // 简化：不考虑负载直接计算
  const speed = voltage / (Ke / 1000); // V / (mV/RPM) → RPM
  return Math.max(0, Math.min(speed, params.noLoadSpeed * voltage / params.ratedVoltage));
}

/**
 * 直流电机转矩-电流关系
 *
 * T = Kt × I
 *
 * @param current 电流 (mA)
 * @param params 电机参数
 * @returns 转矩 (mN·m)
 */
export function dcMotorTorque(
  current: number,
  params: DCMotorParams = DEFAULT_DC_MOTOR_PARAMS
): number {
  return params.motorConstant * current / 1000; // Kt(mV/RPM) × I(mA) ≈ mN·m
}

/**
 * 直流电机电流估算
 *
 * I = (V - Ke × RPM) / R
 *
 * @param voltage 供电电压 (V)
 * @param rpm 当前转速 (RPM)
 * @param params 电机参数
 * @returns 电流 (mA)
 */
export function dcMotorCurrent(
  voltage: number,
  rpm: number,
  params: DCMotorParams = DEFAULT_DC_MOTOR_PARAMS
): number {
  const backEMF = params.motorConstant * rpm / 1000; // V
  const I = (voltage - backEMF) / params.windingResistance;
  return Math.max(params.noLoadCurrent, Math.min(I * 1000, params.stallCurrent));
}

/**
 * 直流电机反电动势
 *
 * V_backEMF = Ke × RPM
 *
 * @param rpm 转速 (RPM)
 * @param params 电机参数
 * @returns 反电动势 (V)
 */
export function dcMotorBackEMF(
  rpm: number,
  params: DCMotorParams = DEFAULT_DC_MOTOR_PARAMS
): number {
  return params.motorConstant * rpm / 1000; // mV/RPM × RPM / 1000 → V
}

/**
 * 直流电机功耗
 *
 * @param voltage 供电电压 (V)
 * @param current 电流 (mA)
 * @returns 功耗 (mW)
 */
export function dcMotorPower(voltage: number, current: number): number {
  return voltage * current;
}
