/**
 * 扩展传感器元件定义
 *
 * 温湿度传感器、超声波、气压、霍尔、电流传感器、气体传感器
 */

// ==================== 温湿度传感器 ====================

export interface TempHumiditySensorParams {
  tempRange: { min: number; max: number };
  humidityRange: { min: number; max: number };
  tempAccuracy: number;
  humidityAccuracy: number;
  interface: 'analog' | 'i2c' | 'spi' | '1wire';
  responseTime: number;
  vdd: number;
  sleepCurrent: number;
  model: string;
}

export const TEMP_HUMIDITY_MODELS: Record<string, TempHumiditySensorParams> = {
  'DHT11': { tempRange: { min: 0, max: 50 }, humidityRange: { min: 20, max: 90 }, tempAccuracy: 2, humidityAccuracy: 5, interface: '1wire', responseTime: 1000, vdd: 5, sleepCurrent: 100, model: 'DHT11' },
  'DHT22': { tempRange: { min: -40, max: 80 }, humidityRange: { min: 0, max: 100 }, tempAccuracy: 0.5, humidityAccuracy: 2, interface: '1wire', responseTime: 500, vdd: 5, sleepCurrent: 50, model: 'DHT22/AM2302' },
  'SHT30': { tempRange: { min: -40, max: 125 }, humidityRange: { min: 0, max: 100 }, tempAccuracy: 0.3, humidityAccuracy: 2, interface: 'i2c', responseTime: 15, vdd: 3.3, sleepCurrent: 0.2, model: 'SHT30' },
  'SHT31': { tempRange: { min: -40, max: 125 }, humidityRange: { min: 0, max: 100 }, tempAccuracy: 0.2, humidityAccuracy: 2, interface: 'i2c', responseTime: 15, vdd: 3.3, sleepCurrent: 0.2, model: 'SHT31' },
  'SHT40': { tempRange: { min: -40, max: 125 }, humidityRange: { min: 0, max: 100 }, tempAccuracy: 0.2, humidityAccuracy: 1.8, interface: 'i2c', responseTime: 8, vdd: 3.3, sleepCurrent: 0.15, model: 'SHT40' },
  'BME280': { tempRange: { min: -40, max: 85 }, humidityRange: { min: 0, max: 100 }, tempAccuracy: 0.5, humidityAccuracy: 3, interface: 'i2c', responseTime: 50, vdd: 3.3, sleepCurrent: 0.1, model: 'BME280' },
  'AM2301': { tempRange: { min: -40, max: 80 }, humidityRange: { min: 0, max: 99.9 }, tempAccuracy: 0.5, humidityAccuracy: 3, interface: '1wire', responseTime: 500, vdd: 5, sleepCurrent: 50, model: 'AM2301' },
};

/** 露点温度计算 */
export function dewPoint(tempC: number, humidity: number): number {
  const a = 17.27;
  const b = 237.7;
  const alpha = (a * tempC) / (b + tempC) + Math.log(humidity / 100);
  return (b * alpha) / (a - alpha);
}

/** 绝对湿度 (g/m³) */
export function absoluteHumidity(tempC: number, humidity: number): number {
  const satPressure = 6.112 * Math.exp((17.67 * tempC) / (tempC + 243.5));
  const vaporPressure = satPressure * humidity / 100;
  return (216.7 * vaporPressure) / (273.15 + tempC);
}

// ==================== 超声波传感器 ====================

export interface UltrasonicParams {
  minRange: number;
  maxRange: number;
  beamAngle: number;
  frequency: number;
  resolution: number;
  vdd: number;
  triggerPulse: number;
  model: string;
}

export const ULTRASONIC_MODELS: Record<string, UltrasonicParams> = {
  'HC_SR04': { minRange: 2, maxRange: 400, beamAngle: 15, frequency: 40000, resolution: 3, vdd: 5, triggerPulse: 10, model: 'HC-SR04' },
  'US_015': { minRange: 2, maxRange: 450, beamAngle: 15, frequency: 40000, resolution: 1, vdd: 5, triggerPulse: 10, model: 'US-015' },
  'US_100': { minRange: 2, maxRange: 450, beamAngle: 15, frequency: 40000, resolution: 0.3, vdd: 5, triggerPulse: 10, model: 'US-100' },
  'HY_SRF05': { minRange: 2, maxRange: 450, beamAngle: 15, frequency: 40000, resolution: 3, vdd: 5, triggerPulse: 10, model: 'HY-SRF05' },
};

/** 超声波距离计算 (cm) */
export function ultrasonicDistance(echoTimeUs: number): number {
  return echoTimeUs * 0.0343 / 2; // 声速 343m/s
}

/** 超声波回波时间 (us) */
export function ultrasonicEchoTime(distanceCm: number): number {
  return distanceCm * 2 / 0.0343;
}

// ==================== 气压传感器 ====================

export interface PressureSensorParams {
  pressureRange: { min: number; max: number };
  accuracy: number;
  resolution: number;
  interface: 'i2c' | 'spi' | 'analog';
  responseTime: number;
  vdd: number;
  model: string;
}

export const PRESSURE_SENSOR_MODELS: Record<string, PressureSensorParams> = {
  'BMP280': { pressureRange: { min: 300, max: 1100 }, accuracy: 1, resolution: 0.16, interface: 'i2c', responseTime: 50, vdd: 3.3, model: 'BMP280' },
  'BME280_P': { pressureRange: { min: 300, max: 1100 }, accuracy: 1, resolution: 0.16, interface: 'i2c', responseTime: 50, vdd: 3.3, model: 'BME280' },
  'BMP180': { pressureRange: { min: 300, max: 1100 }, accuracy: 1.5, resolution: 0.01, interface: 'i2c', responseTime: 25, vdd: 3.3, model: 'BMP180' },
  'MS5611': { pressureRange: { min: 10, max: 1200 }, accuracy: 0.12, resolution: 0.012, interface: 'spi', responseTime: 10, vdd: 3.3, model: 'MS5611' },
  'DPS310': { pressureRange: { min: 300, max: 1200 }, accuracy: 0.06, resolution: 0.002, interface: 'i2c', responseTime: 50, vdd: 3.3, model: 'DPS310' },
};

/** 气压转海拔 (m) */
export function pressureToAltitude(pressureHPa: number, seaLevelHPa: number = 1013.25): number {
  return 44330 * (1 - Math.pow(pressureHPa / seaLevelHPa, 0.1903));
}

/** 海拔转气压 */
export function altitudeToPressure(altitudeM: number, seaLevelHPa: number = 1013.25): number {
  return seaLevelHPa * Math.pow(1 - altitudeM / 44330, 5.255);
}

// ==================== 霍尔传感器 ====================

export interface HallSensorParams {
  sensitivity: number;
  outputType: 'analog' | 'digital_latch' | 'digital_switch';
  operatingPoint: number;
  releasePoint: number;
  vdd: { min: number; max: number };
  bandwidth: number;
  model: string;
}

export const HALL_SENSOR_MODELS: Record<string, HallSensorParams> = {
  'A3144': { sensitivity: 5, outputType: 'digital_switch', operatingPoint: 280, releasePoint: 180, vdd: { min: 3.5, max: 24 }, bandwidth: 30000, model: 'A3144' },
  'SS49E': { sensitivity: 1.4, outputType: 'analog', operatingPoint: 0, releasePoint: 0, vdd: { min: 2.7, max: 6.5 }, bandwidth: 50000, model: 'SS49E' },
  'ACS712_05A': { sensitivity: 185, outputType: 'analog', operatingPoint: 0, releasePoint: 0, vdd: { min: 4.5, max: 5.5 }, bandwidth: 80000, model: 'ACS712-05A' },
  'ACS712_20A': { sensitivity: 100, outputType: 'analog', operatingPoint: 0, releasePoint: 0, vdd: { min: 4.5, max: 5.5 }, bandwidth: 80000, model: 'ACS712-20A' },
  'ACS712_30A': { sensitivity: 66, outputType: 'analog', operatingPoint: 0, releasePoint: 0, vdd: { min: 4.5, max: 5.5 }, bandwidth: 80000, model: 'ACS712-30A' },
  'MLX90393': { sensitivity: 0.3, outputType: 'analog', operatingPoint: 0, releasePoint: 0, vdd: { min: 2.2, max: 3.6 }, bandwidth: 800, model: 'MLX90393' },
};

/** 霍尔传感器模拟输出 (线性) */
export function hallAnalogOutput(gauss: number, vdd: number, sensitivity: number): number {
  return vdd / 2 + sensitivity * gauss / 1000;
}

/** ACS712 电流计算 */
export function acs712Current(outputVoltage: number, vdd: number, sensitivityMV_A: number): number {
  return (outputVoltage - vdd / 2) / (sensitivityMV_A / 1000);
}

// ==================== 电流传感器 ====================

export interface CurrentSensorParams {
  maxCurrent: number;
  sensitivity: number;
  offsetVoltage: number;
  vdd: number;
  bandwidth: number;
  model: string;
}

export const CURRENT_SENSOR_MODELS: Record<string, CurrentSensorParams> = {
  'ACS712_05': { maxCurrent: 5, sensitivity: 185, offsetVoltage: 2.5, vdd: 5, bandwidth: 80000, model: 'ACS712-05A' },
  'INA219': { maxCurrent: 3.2, sensitivity: 0.1, offsetVoltage: 0, vdd: 5, bandwidth: 0, model: 'INA219' },
  'INA226': { maxCurrent: 10, sensitivity: 0.0025, offsetVoltage: 0, vdd: 5, bandwidth: 0, model: 'INA226' },
};

// ==================== 气体传感器 ====================

export interface GasSensorParams {
  targetGas: string;
  detectionRange: { min: number; max: number };
  sensitivity: number;
  heatingResistance: number;
  heatingVoltage: number;
  vdd: number;
  warmupTime: number;
  model: string;
}

export const GAS_SENSOR_MODELS: Record<string, GasSensorParams> = {
  'MQ_2': { targetGas: 'LPG/烟雾', detectionRange: { min: 200, max: 10000 }, sensitivity: 0.3, heatingResistance: 31, heatingVoltage: 5, vdd: 5, warmupTime: 24, model: 'MQ-2' },
  'MQ_3': { targetGas: '酒精', detectionRange: { min: 25, max: 500 }, sensitivity: 0.3, heatingResistance: 31, heatingVoltage: 5, vdd: 5, warmupTime: 24, model: 'MQ-3' },
  'MQ_4': { targetGas: '甲烷/天然气', detectionRange: { min: 200, max: 10000 }, sensitivity: 0.3, heatingResistance: 31, heatingVoltage: 5, vdd: 5, warmupTime: 24, model: 'MQ-4' },
  'MQ_7': { targetGas: 'CO', detectionRange: { min: 10, max: 1000 }, sensitivity: 0.3, heatingResistance: 31, heatingVoltage: 5, vdd: 5, warmupTime: 48, model: 'MQ-7' },
  'MQ_135': { targetGas: 'NH3/CO2/苯', detectionRange: { min: 10, max: 300 }, sensitivity: 0.3, heatingResistance: 31, heatingVoltage: 5, vdd: 5, warmupTime: 48, model: 'MQ-135' },
  'SGP30': { targetGas: 'TVOC/eCO2', detectionRange: { min: 0, max: 60000 }, sensitivity: 1, heatingResistance: 0, heatingVoltage: 0, vdd: 1.8, warmupTime: 0.015, model: 'SGP30' },
};

// ==================== 土壤湿度传感器 ====================

export interface SoilMoistureParams {
  minOutput: number;
  maxOutput: number;
  vdd: number;
  analogOutput: boolean;
}

export const SOIL_MOISTURE_MODELS: Record<string, SoilMoistureParams> = {
  'CAPACITIVE_V1': { minOutput: 0, maxOutput: 3.3, vdd: 3.3, analogOutput: true },
  'RESISTIVE_V1': { minOutput: 0, maxOutput: 5, vdd: 5, analogOutput: true },
};

/** 土壤湿度百分比 */
export function soilMoisturePercent(voltage: number, params: SoilMoistureParams): number {
  const dry = params.maxOutput;
  const wet = params.minOutput;
  return Math.max(0, Math.min(100, (dry - voltage) / (dry - wet) * 100));
}

// ==================== 热电堆/红外温度传感器 ====================

export interface IRThermometerParams {
  tempRange: { min: number; max: number };
  accuracy: number;
  fov: number;
  interface: 'i2c' | 'analog';
  vdd: number;
  refreshRate: number;
  model: string;
}

export const IR_THERMOMETER_MODELS: Record<string, IRThermometerParams> = {
  'MLX90614': { tempRange: { min: -40, max: 125 }, accuracy: 0.5, fov: 90, interface: 'i2c', vdd: 3.3, refreshRate: 10, model: 'MLX90614' },
  'MLX90640': { tempRange: { min: -40, max: 300 }, accuracy: 1, fov: 110, interface: 'i2c', vdd: 3.3, refreshRate: 64, model: 'MLX90640' },
  'AMG8833': { tempRange: { min: -20, max: 100 }, accuracy: 2.5, fov: 60, interface: 'i2c', vdd: 3.3, refreshRate: 10, model: 'AMG8833' },
  'GY_906': { tempRange: { min: -40, max: 125 }, accuracy: 0.5, fov: 90, interface: 'i2c', vdd: 3.3, refreshRate: 10, model: 'GY-906 (MLX90614)' },
};
