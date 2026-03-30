/**
 * 运动传感器元件定义
 *
 * 压电传感器、加速度计、陀螺仪
 * 包含简化的物理模型和输出特性
 */

// ==================== 类型定义 ====================

/** 压电传感器参数 */
export interface PiezoSensorParams {
  /** 压电常数 d33 (pC/N) */
  piezoConstant: number;
  /** 电容 (nF) */
  capacitance: number;
  /** 谐振频率 (kHz) */
  resonantFreq: number;
  /** 最大承受力 (N) */
  maxForce: number;
  /** 内阻 (MΩ) */
  internalResistance: number;
}

/** 加速度计参数 */
export interface AccelerometerParams {
  /** 测量范围 (±g) */
  range: number;
  /** 灵敏度 (mV/g 或 LSB/g) */
  sensitivity: number;
  /** 噪声密度 (μg/√Hz) */
  noiseDensity: number;
  /** 带宽 (Hz) */
  bandwidth: number;
  /** 输出类型 */
  outputType: 'analog' | 'digital_i2c' | 'digital_spi';
  /** 工作电压 (V) */
  vdd: number;
  /** 零偏电压 (V) @ 0g (模拟输出) */
  zeroGOffset: number;
}

/** 陀螺仪参数 */
export interface GyroscopeParams {
  /** 测量范围 (±°/s) */
  range: number;
  /** 灵敏度 (mV/°/s 或 LSB/°/s) */
  sensitivity: number;
  /** 噪声密度 (°/s/√Hz) */
  noiseDensity: number;
  /** 带宽 (Hz) */
  bandwidth: number;
  /** 输出类型 */
  outputType: 'analog' | 'digital_i2c' | 'digital_spi';
  /** 工作电压 (V) */
  vdd: number;
  /** 零偏 (°/s) */
  zeroRateOffset: number;
}

/** 3轴数据 */
export interface AxisData {
  x: number;
  y: number;
  z: number;
}

// ==================== 默认参数 ====================

/** 默认压电传感器参数 */
export const DEFAULT_PIEZO_PARAMS: PiezoSensorParams = {
  piezoConstant: 400,    // 典型 PZT 陶瓷
  capacitance: 20,       // 20 nF
  resonantFreq: 4.0,     // 4 kHz
  maxForce: 50,          // 50 N
  internalResistance: 10, // 10 MΩ
};

/** 常见加速度计型号 */
export const ACCELEROMETER_MODELS = {
  ADXL345: {
    range: 16,
    sensitivity: 256,    // LSB/g @ ±16g
    noiseDensity: 3.9,
    bandwidth: 100,
    outputType: 'digital_i2c' as const,
    vdd: 3.3,
    zeroGOffset: 1.65,
  },
  MMA8452Q: {
    range: 8,
    sensitivity: 1024,   // LSB/g @ ±2g
    noiseDensity: 2.5,
    bandwidth: 800,
    outputType: 'digital_i2c' as const,
    vdd: 3.3,
    zeroGOffset: 1.65,
  },
  MPU6050: {
    range: 16,
    sensitivity: 2048,   // LSB/g @ ±2g
    noiseDensity: 4.0,
    bandwidth: 260,
    outputType: 'digital_i2c' as const,
    vdd: 3.3,
    zeroGOffset: 1.65,
  },
} as const;

/** 默认加速度计参数 */
export const DEFAULT_ACCELEROMETER_PARAMS: AccelerometerParams = ACCELEROMETER_MODELS.ADXL345;

/** 陀螺仪型号 */
export const GYROSCOPE_MODELS = {
  L3G4200D: {
    range: 2000,
    sensitivity: 70,     // mdps/LSB @ ±2000°/s
    noiseDensity: 0.03,
    bandwidth: 200,
    outputType: 'digital_i2c' as const,
    vdd: 3.3,
    zeroRateOffset: 0,
  },
  MPU6050_GYRO: {
    range: 2000,
    sensitivity: 16.4,   // LSB/(°/s) @ ±2000°/s
    noiseDensity: 0.05,
    bandwidth: 256,
    outputType: 'digital_i2c' as const,
    vdd: 3.3,
    zeroRateOffset: 0,
  },
} as const;

/** 默认陀螺仪参数 */
export const DEFAULT_GYROSCOPE_PARAMS: GyroscopeParams = GYROSCOPE_MODELS.MPU6050_GYRO;

// ==================== 压电传感器模型 ====================

/**
 * 压电传感器输出电压
 *
 * Q = d33 × F
 * V = Q / C
 *
 * @param force 施加力 (N)
 * @param params 压电传感器参数
 * @returns 输出电压 (V)
 */
export function piezoOutputVoltage(force: number, params: PiezoSensorParams = DEFAULT_PIEZO_PARAMS): number {
  const Q = params.piezoConstant * 1e-12 * force; // 电荷 (C)
  const C = params.capacitance * 1e-9;            // 电容 (F)
  return Q / C;
}

/**
 * 压电传感器频率响应
 * 在谐振频率附近增益最大
 *
 * @param freq 频率 (Hz)
 * @param params 压电传感器参数
 * @returns 相对增益 (0-1)
 */
export function piezoFrequencyResponse(freq: number, params: PiezoSensorParams = DEFAULT_PIEZO_PARAMS): number {
  const f0 = params.resonantFreq * 1000; // kHz → Hz
  const Q = 50; // 品质因数（典型值）
  const ratio = freq / f0;
  const gain = 1 / Math.sqrt((1 - ratio * ratio) ** 2 + (ratio / Q) ** 2);
  return Math.min(gain, 100); // 限制最大增益
}

/**
 * 生成压电传感器力-电压曲线
 */
export function generatePiezoCurve(
  maxForce: number = 50,
  points: number = 50,
  params: PiezoSensorParams = DEFAULT_PIEZO_PARAMS
): { force: number; voltage: number }[] {
  const data: { force: number; voltage: number }[] = [];
  const step = maxForce / (points - 1);
  for (let i = 0; i < points; i++) {
    const force = i * step;
    const voltage = piezoOutputVoltage(force, params);
    data.push({ force: Math.round(force * 100) / 100, voltage: Math.round(voltage * 1000) / 1000 });
  }
  return data;
}

// ==================== 加速度计模型 ====================

/**
 * 模拟加速度计输出（模拟模式）
 *
 * V_out = V_zeroG + sensitivity × acceleration
 * 输出限制在 0 ~ Vdd 范围内
 *
 * @param acceleration 加速度 (g)
 * @param axis 轴向 ('x' | 'y' | 'z')
 * @param params 加速度计参数
 * @returns 输出电压 (V)
 */
export function accelerometerAnalogOutput(
  acceleration: number,
  params: AccelerometerParams = DEFAULT_ACCELEROMETER_PARAMS
): number {
  // 灵敏度转换为 V/g（如果原始单位是 LSB/g）
  const sensVg = params.sensitivity > 10
    ? (params.vdd / (2 ** 10)) * params.sensitivity // 假设10位ADC
    : params.sensitivity;

  const vOut = params.zeroGOffset + sensVg * acceleration;
  return Math.max(0, Math.min(params.vdd, vOut));
}

/**
 * 数字加速度计输出（ADC编码值）
 *
 * @param acceleration 加速度 (g)
 * @param bits ADC 位数
 * @param params 加速度计参数
 * @returns ADC 编码值
 */
export function accelerometerDigitalOutput(
  acceleration: number,
  bits: number = 10,
  params: AccelerometerParams = DEFAULT_ACCELEROMETER_PARAMS
): number {
  const vOut = accelerometerAnalogOutput(acceleration, params);
  const maxValue = (2 ** bits) - 1;
  return Math.round(vOut / params.vdd * maxValue);
}

/**
 * 3轴加速度计输出
 *
 * @param accel 3轴加速度数据 (g)
 * @param params 加速度计参数
 * @returns 3轴输出值
 */
export function accelerometer3AxisOutput(
  accel: AxisData,
  params: AccelerometerParams = DEFAULT_ACCELEROMETER_PARAMS
): AxisData {
  return {
    x: accelerometerAnalogOutput(accel.x, params),
    y: accelerometerAnalogOutput(accel.y, params),
    z: accelerometerAnalogOutput(accel.z, params),
  };
}

/**
 * 生成加速度-输出曲线
 */
export function generateAccelerometerCurve(
  params: AccelerometerParams = DEFAULT_ACCELEROMETER_PARAMS
): { accel: number; voltage: number; digital: number }[] {
  const data: { accel: number; voltage: number; digital: number }[] = [];
  const range = params.range;
  for (let a = -range; a <= range; a += range / 20) {
    const voltage = accelerometerAnalogOutput(a, params);
    const digital = accelerometerDigitalOutput(a, 10, params);
    data.push({
      accel: Math.round(a * 100) / 100,
      voltage: Math.round(voltage * 1000) / 1000,
      digital,
    });
  }
  return data;
}

// ==================== 陀螺仪模型 ====================

/**
 * 模拟陀螺仪输出
 *
 * V_out = Vdd/2 + sensitivity × angularRate
 *
 * @param angularRate 角速度 (°/s)
 * @param params 陀螺仪参数
 * @returns 输出电压 (V)
 */
export function gyroscopeAnalogOutput(
  angularRate: number,
  params: GyroscopeParams = DEFAULT_GYROSCOPE_PARAMS
): number {
  // 灵敏度：假设 LSB/(°/s)，需要转换为 V/(°/s)
  const sensVPerDegS = params.sensitivity > 10
    ? (params.vdd / (2 ** 16)) * params.sensitivity
    : params.sensitivity * 0.001; // mdps/LSB → V/(°/s)

  const vOut = params.vdd / 2 + sensVPerDegS * (angularRate + params.zeroRateOffset);
  return Math.max(0, Math.min(params.vdd, vOut));
}

/**
 * 数字陀螺仪输出
 */
export function gyroscopeDigitalOutput(
  angularRate: number,
  bits: number = 16,
  params: GyroscopeParams = DEFAULT_GYROSCOPE_PARAMS
): number {
  const vOut = gyroscopeAnalogOutput(angularRate, params);
  return Math.round((vOut / params.vdd - 0.5) * (2 ** bits));
}

/**
 * 3轴陀螺仪输出
 */
export function gyroscope3AxisOutput(
  rates: AxisData,
  params: GyroscopeParams = DEFAULT_GYROSCOPE_PARAMS
): AxisData {
  return {
    x: gyroscopeAnalogOutput(rates.x, params),
    y: gyroscopeAnalogOutput(rates.y, params),
    z: gyroscopeAnalogOutput(rates.z, params),
  };
}

/**
 * 生成陀螺仪角速度-输出曲线
 */
export function generateGyroscopeCurve(
  params: GyroscopeParams = DEFAULT_GYROSCOPE_PARAMS
): { rate: number; voltage: number }[] {
  const data: { rate: number; voltage: number }[] = [];
  const range = params.range;
  for (let r = -range; r <= range; r += range / 20) {
    const voltage = gyroscopeAnalogOutput(r, params);
    data.push({
      rate: Math.round(r),
      voltage: Math.round(voltage * 1000) / 1000,
    });
  }
  return data;
}
