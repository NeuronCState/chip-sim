/**
 * 温度传感器元件定义
 *
 * NTC热敏电阻、热电偶、DS18B20 数字温度传感器
 * 包含 Steinhart-Hart 方程和温度-电阻特性曲线数据
 */

// ==================== 类型定义 ====================

/** 温度传感器参数 */
export interface TemperatureSensorParams {
  /** 工作温度范围下限 (°C) */
  tempMin: number;
  /** 工作温度范围上限 (°C) */
  tempMax: number;
  /** 当前环境温度 (°C) */
  ambientTemp: number;
  /** 精度 (°C) */
  accuracy: number;
}

/** NTC 热敏电阻参数 */
export interface NTCParams extends TemperatureSensorParams {
  /** 标称电阻值 (Ω) @ 25°C */
  nominalResistance: number;
  /** 标称温度 (°C) */
  nominalTemp: number;
  /** Steinhart-Hart 系数 A */
  coeffA: number;
  /** Steinhart-Hart 系数 B */
  coeffB: number;
  /** Steinhart-Hart 系数 C */
  coeffC: number;
  /** B 值 (K) */
  betaValue: number;
}

/** 热电偶参数 */
export interface ThermocoupleParams extends TemperatureSensorParams {
  /** 热电偶类型 */
  tcType: 'K' | 'J' | 'T' | 'E' | 'S' | 'N';
  /** Seebeck 系数 (μV/°C) */
  seebeckCoeff: number;
  /** 冷端温度 (°C) */
  coldJunctionTemp: number;
}

/** DS18B20 参数 */
export interface DS18B20Params extends TemperatureSensorParams {
  /** 分辨率位数 (9-12) */
  resolution: number;
  /** 转换时间 (ms) */
  conversionTime: number;
  /** ROM 地址 (64-bit) */
  romAddress: string;
  /** 寄生供电模式 */
  parasitePower: boolean;
}

// ==================== 默认参数 ====================

/** 默认 NTC 热敏电阻参数 */
export const DEFAULT_NTC_PARAMS: NTCParams = {
  tempMin: -40,
  tempMax: 125,
  ambientTemp: 25,
  accuracy: 0.5,
  nominalResistance: 10000, // 10kΩ
  nominalTemp: 25,
  coeffA: 1.009249522e-3,
  coeffB: 2.378405444e-4,
  coeffC: 2.019202697e-7,
  betaValue: 3950,
};

/** 热电偶 Seebeck 系数表 (μV/°C) */
export const THERMOCOUPLE_SEEBECK: Record<string, number> = {
  K: 41.0,   // 镍铬-镍硅
  J: 52.0,   // 铁-铜镍
  T: 43.0,   // 铜-铜镍
  E: 68.0,   // 镍铬-铜镍
  S: 6.0,    // 铂铑10-铂
  N: 27.0,   // 镍铬硅-镍硅
};

/** 默认热电偶参数 */
export const DEFAULT_THERMOCOUPLE_PARAMS: ThermocoupleParams = {
  tempMin: -200,
  tempMax: 1350,
  ambientTemp: 25,
  accuracy: 1.5,
  tcType: 'K',
  seebeckCoeff: THERMOCOUPLE_SEEBECK['K'],
  coldJunctionTemp: 25,
};

/** 默认 DS18B20 参数 */
export const DEFAULT_DS18B20_PARAMS: DS18B20Params = {
  tempMin: -55,
  tempMax: 125,
  ambientTemp: 25,
  accuracy: 0.5,
  resolution: 12,
  conversionTime: 750,
  romAddress: '28FF123456780ABC',
  parasitePower: false,
};

// ==================== Steinhart-Hart 方程 ====================

/**
 * Steinhart-Hart 方程：温度 ↔ 电阻 转换
 *
 * 1/T = A + B·ln(R) + C·(ln(R))³
 *
 * 其中 T 为开尔文温度，R 为电阻值
 */

/**
 * 根据 NTC 电阻值计算温度
 * @param resistance 电阻值 (Ω)
 * @param params NTC 参数
 * @returns 温度 (°C)
 */
export function ntcResistanceToTemp(resistance: number, params: NTCParams): number {
  const lnR = Math.log(resistance);
  const invT = params.coeffA + params.coeffB * lnR + params.coeffC * lnR * lnR * lnR;
  const tempK = 1 / invT;
  return tempK - 273.15;
}

/**
 * 根据温度计算 NTC 电阻值
 * @param tempC 温度 (°C)
 * @param params NTC 参数
 * @returns 电阻值 (Ω)
 */
export function ntcTempToResistance(tempC: number, params: NTCParams): number {
  const tempK = tempC + 273.15;
  // 迭代求解（简化版）
  let R = params.nominalResistance * Math.exp(
    params.betaValue * (1 / tempK - 1 / (params.nominalTemp + 273.15))
  );
  // Newton-Raphson 细化
  for (let i = 0; i < 5; i++) {
    const lnRi = Math.log(R);
    const f = params.coeffA + params.coeffB * lnRi + params.coeffC * lnRi * lnRi * lnRi - 1 / tempK;
    const df = params.coeffB / R + 3 * params.coeffC * lnRi * lnRi / R;
    R -= f / df;
  }
  return R;
}

/**
 * 使用 B 值方程快速估算 NTC 电阻
 * R(T) = R0 · exp(B · (1/T - 1/T0))
 */
export function ntcBetaEstimate(tempC: number, params: NTCParams): number {
  const T = tempC + 273.15;
  const T0 = params.nominalTemp + 273.15;
  return params.nominalResistance * Math.exp(params.betaValue * (1 / T - 1 / T0));
}

/**
 * 生成 NTC 温度-电阻特性曲线数据
 * @param tempMin 最低温度 (°C)
 * @param tempMax 最高温度 (°C)
 * @param points 采样点数
 * @param params NTC 参数
 * @returns {temp: number, resistance: number}[]
 */
export function generateNTCCurve(
  tempMin: number = -40,
  tempMax: number = 125,
  points: number = 50,
  params: NTCParams = DEFAULT_NTC_PARAMS
): { temp: number; resistance: number }[] {
  const data: { temp: number; resistance: number }[] = [];
  const step = (tempMax - tempMin) / (points - 1);
  for (let i = 0; i < points; i++) {
    const temp = tempMin + i * step;
    const resistance = ntcBetaEstimate(temp, params);
    data.push({ temp: Math.round(temp * 10) / 10, resistance: Math.round(resistance * 100) / 100 });
  }
  return data;
}

// ==================== 热电偶模型 ====================

/**
 * 热电偶：根据温度差产生电压
 * V = Seebeck_coeff × (T_hot - T_cold)
 *
 * @param hotTemp 热端温度 (°C)
 * @param params 热电偶参数
 * @returns 电压 (mV)
 */
export function thermocoupleVoltage(hotTemp: number, params: ThermocoupleParams): number {
  const deltaT = hotTemp - params.coldJunctionTemp;
  return params.seebeckCoeff * deltaT / 1000; // μV → mV
}

/**
 * 热电偶：根据电压反算温度
 * @param voltageMv 电压 (mV)
 * @param params 热电偶参数
 * @returns 热端温度 (°C)
 */
export function thermocoupleVoltageToTemp(voltageMv: number, params: ThermocoupleParams): number {
  const deltaT = voltageMv * 1000 / params.seebeckCoeff; // mV → μV
  return deltaT + params.coldJunctionTemp;
}

/**
 * 生成热电偶温度-电压特性曲线
 */
export function generateThermocoupleCurve(
  tempMin: number = 0,
  tempMax: number = 500,
  points: number = 50,
  params: ThermocoupleParams = DEFAULT_THERMOCOUPLE_PARAMS
): { temp: number; voltage: number }[] {
  const data: { temp: number; voltage: number }[] = [];
  const step = (tempMax - tempMin) / (points - 1);
  for (let i = 0; i < points; i++) {
    const temp = tempMin + i * step;
    const voltage = thermocoupleVoltage(temp, params);
    data.push({ temp: Math.round(temp * 10) / 10, voltage: Math.round(voltage * 1000) / 1000 });
  }
  return data;
}

// ==================== DS18B20 数字温度传感器 ====================

/**
 * DS18B20 行为模型
 * 模拟 1-Wire 协议的温度读取流程
 */
export class DS18B20Model {
  private params: DS18B20Params;
  private currentTemp: number;
  private isConverting: boolean = false;
  private conversionStart: number = 0;
  private scratchpad: Uint8Array;

  constructor(params: Partial<DS18B20Params> = {}) {
    this.params = { ...DEFAULT_DS18B20_PARAMS, ...params };
    this.currentTemp = this.params.ambientTemp;
    this.scratchpad = new Uint8Array(9);
    this.initScratchpad();
  }

  /** 初始化暂存器 */
  private initScratchpad(): void {
    // 温度寄存器 (bytes 0-1)
    this.updateTempRegister();
    // TH / TL (bytes 2-3) - 报警阈值
    this.scratchpad[2] = 0x4B; // TH = 75°C
    this.scratchpad[3] = 0x46; // TL = -10°C (sign bit)
    // 配置寄存器 (byte 4)
    const configBits = ((this.params.resolution - 9) << 5) | 0x1F;
    this.scratchpad[4] = configBits;
    // CRC (byte 8)
    this.scratchpad[8] = this.calculateCRC();
  }

  /** 更新温度寄存器 */
  private updateTempRegister(): void {
    // DS18B20 温度格式：12位分辨率，0.0625°C/LSB
    const tempRaw = Math.round(this.currentTemp * 16);
    this.scratchpad[0] = tempRaw & 0xFF;
    this.scratchpad[1] = (tempRaw >> 8) & 0xFF;
  }

  /** 计算 CRC-8 */
  private calculateCRC(): number {
    let crc = 0;
    for (let i = 0; i < 8; i++) {
      let byte = this.scratchpad[i];
      for (let j = 0; j < 8; j++) {
        const mix = (crc ^ byte) & 0x01;
        crc >>= 1;
        if (mix) crc ^= 0x8C;
        byte >>= 1;
      }
    }
    return crc;
  }

  /** 设置当前温度 */
  setTemperature(tempC: number): void {
    this.currentTemp = Math.max(this.params.tempMin, Math.min(this.params.tempMax, tempC));
    this.updateTempRegister();
    this.scratchpad[8] = this.calculateCRC();
  }

  /** 启动温度转换 */
  startConversion(): void {
    this.isConverting = true;
    this.conversionStart = Date.now();
  }

  /** 检查转换是否完成 */
  isConversionComplete(): boolean {
    if (!this.isConverting) return true;
    return Date.now() - this.conversionStart >= this.params.conversionTime;
  }

  /** 读取暂存器 */
  readScratchpad(): Uint8Array {
    return new Uint8Array(this.scratchpad);
  }

  /** 获取当前温度读数 */
  getTemperature(): number {
    return this.currentTemp;
  }

  /** 获取分辨率位数 */
  getResolution(): number {
    return this.params.resolution;
  }

  /** 获取转换时间 */
  getConversionTime(): number {
    return this.params.conversionTime;
  }
}

/**
 * 生成 DS18B20 温度读数数据
 */
export function generateDS18B20Readings(
  startTemp: number,
  endTemp: number,
  steps: number = 20
): { time: number; temp: number; raw: number }[] {
  const data: { time: number; temp: number; raw: number }[] = [];
  const sensor = new DS18B20Model({ ambientTemp: startTemp });
  for (let i = 0; i < steps; i++) {
    const t = startTemp + (endTemp - startTemp) * i / (steps - 1);
    sensor.setTemperature(t);
    const raw = Math.round(t * 16);
    data.push({ time: i, temp: Math.round(t * 100) / 100, raw });
  }
  return data;
}
