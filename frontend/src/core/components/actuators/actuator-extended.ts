/**
 * 扩展执行器元件定义
 *
 * 电磁阀、加热器、螺线管、振动马达、风扇、舵机扩展型号
 */

// ==================== 电磁阀 ====================

export interface SolenoidValveParams {
  coilVoltage: number;
  coilResistance: number;
  ratedCurrent: number;
  responseTime: number;
  maxPressure: number;
  portSize: string;
  valveType: 'normally_closed' | 'normally_open';
  medium: 'air' | 'water' | 'oil';
}

export const SOLENOID_VALVE_MODELS: Record<string, SolenoidValveParams> = {
  'SV_5V_NC': { coilVoltage: 5, coilResistance: 20, ratedCurrent: 250, responseTime: 20, maxPressure: 0.8, portSize: '1/8"', valveType: 'normally_closed', medium: 'air' },
  'SV_12V_NC': { coilVoltage: 12, coilResistance: 48, ratedCurrent: 250, responseTime: 20, maxPressure: 1.0, portSize: '1/4"', valveType: 'normally_closed', medium: 'air' },
  'SV_24V_NC': { coilVoltage: 24, coilResistance: 120, ratedCurrent: 200, responseTime: 30, maxPressure: 1.5, portSize: '1/4"', valveType: 'normally_closed', medium: 'water' },
  'SV_12V_NO': { coilVoltage: 12, coilResistance: 48, ratedCurrent: 250, responseTime: 20, maxPressure: 0.6, portSize: '1/8"', valveType: 'normally_open', medium: 'air' },
};

export function solenoidValvePower(voltage: number, params: SolenoidValveParams = SOLENOID_VALVE_MODELS['SV_12V_NC']): number {
  return voltage * voltage / params.coilResistance;
}

// ==================== 加热器 ====================

export interface HeaterParams {
  ratedVoltage: number;
  ratedPower: number;
  resistance: number;
  maxTemp: number;
  heatingElement: 'nichrome' | 'ceramic' | 'PTC' | 'carbon_fiber' | 'infrared';
  responseTime: number;
}

export const HEATER_MODELS: Record<string, HeaterParams> = {
  'NICHROME_12V_5W': { ratedVoltage: 12, ratedPower: 5, resistance: 28.8, maxTemp: 400, heatingElement: 'nichrome', responseTime: 30 },
  'NICHROME_12V_20W': { ratedVoltage: 12, ratedPower: 20, resistance: 7.2, maxTemp: 600, heatingElement: 'nichrome', responseTime: 15 },
  'NICHROME_24V_50W': { ratedVoltage: 24, ratedPower: 50, resistance: 11.52, maxTemp: 800, heatingElement: 'nichrome', responseTime: 10 },
  'CERAMIC_5V_2W': { ratedVoltage: 5, ratedPower: 2, resistance: 12.5, maxTemp: 200, heatingElement: 'ceramic', responseTime: 60 },
  'PTC_12V_10W': { ratedVoltage: 12, ratedPower: 10, resistance: 14.4, maxTemp: 150, heatingElement: 'PTC', responseTime: 45 },
  'IR_24V_100W': { ratedVoltage: 24, ratedPower: 100, resistance: 5.76, maxTemp: 900, heatingElement: 'infrared', responseTime: 5 },
};

export function heaterCurrent(voltage: number, params: HeaterParams): number {
  return voltage / params.resistance * 1000;
}
export function heaterPower(voltage: number, params: HeaterParams): number {
  return voltage * voltage / params.resistance;
}

// ==================== 螺线管 ====================

export interface SolenoidParams {
  coilVoltage: number;
  coilResistance: number;
  stroke: number;
  force: number;
  dutyCycle: number;
  responseTime: number;
}

export const SOLENOID_MODELS: Record<string, SolenoidParams> = {
  'SOL_5V_4mm': { coilVoltage: 5, coilResistance: 10, stroke: 4, force: 0.5, dutyCycle: 25, responseTime: 20 },
  'SOL_12V_10mm': { coilVoltage: 12, coilResistance: 30, stroke: 10, force: 2.0, dutyCycle: 25, responseTime: 30 },
  'SOL_24V_20mm': { coilVoltage: 24, coilResistance: 100, stroke: 20, force: 8.0, dutyCycle: 100, responseTime: 50 },
  'SOL_12V_LATCH': { coilVoltage: 12, coilResistance: 24, stroke: 5, force: 1.5, dutyCycle: 10, responseTime: 15 },
};

// ==================== 振动马达 ====================

export interface VibrationMotorParams {
  ratedVoltage: number;
  ratedCurrent: number;
  speed: number;
  vibrationForce: number;
  resistance: number;
  type: 'ERM' | 'LRA';
}

export const VIBRATION_MOTOR_MODELS: Record<string, VibrationMotorParams> = {
  'ERM_3V': { ratedVoltage: 3, ratedCurrent: 80, speed: 12000, vibrationForce: 0.8, resistance: 20, type: 'ERM' },
  'ERM_5V': { ratedVoltage: 5, ratedCurrent: 100, speed: 10000, vibrationForce: 1.2, resistance: 30, type: 'ERM' },
  'LRA_3V': { ratedVoltage: 3, ratedCurrent: 85, speed: 0, vibrationForce: 1.5, resistance: 18, type: 'LRA' },
  'ERM_COIN_3V': { ratedVoltage: 3, ratedCurrent: 60, speed: 9000, vibrationForce: 0.4, resistance: 35, type: 'ERM' },
};

// ==================== 风扇 ====================

export interface FanParams {
  ratedVoltage: number;
  ratedCurrent: number;
  airflow: number;
  speed: number;
  noise: number;
  pwmControlled: boolean;
  size: string;
}

export const FAN_MODELS: Record<string, FanParams> = {
  'FAN_4010_5V': { ratedVoltage: 5, ratedCurrent: 0.2, airflow: 3.5, speed: 5000, noise: 25, pwmControlled: false, size: '40x40x10mm' },
  'FAN_4010_12V': { ratedVoltage: 12, ratedCurrent: 0.12, airflow: 4.2, speed: 5500, noise: 28, pwmControlled: true, size: '40x40x10mm' },
  'FAN_5010_12V': { ratedVoltage: 12, ratedCurrent: 0.18, airflow: 8.5, speed: 4500, noise: 30, pwmControlled: true, size: '50x50x10mm' },
  'FAN_6025_12V': { ratedVoltage: 12, ratedCurrent: 0.25, airflow: 18, speed: 3500, noise: 32, pwmControlled: true, size: '60x60x25mm' },
  'FAN_8025_12V': { ratedVoltage: 12, ratedCurrent: 0.35, airflow: 35, speed: 2500, noise: 30, pwmControlled: true, size: '80x80x25mm' },
};

// ==================== 更多舵机型号 ====================

export const SERVO_EXTENDED_MODELS: Record<string, { ratedVoltage: number; stallTorque: number; angleRange: { min: number; max: number }; modelName: string }> = {
  'DS3218': { ratedVoltage: 7.4, stallTorque: 20, angleRange: { min: 0, max: 180 }, modelName: 'DS3218' },
  'MG995': { ratedVoltage: 6, stallTorque: 10, angleRange: { min: 0, max: 180 }, modelName: 'MG995' },
  'S3003': { ratedVoltage: 6, stallTorque: 4.1, angleRange: { min: 0, max: 180 }, modelName: 'S3003' },
  'HS311': { ratedVoltage: 6, stallTorque: 3.4, angleRange: { min: 0, max: 180 }, modelName: 'HS311' },
};

// ==================== 更多 DC 电机型号 ====================

export const DC_MOTOR_EXTENDED_MODELS: Record<string, { ratedVoltage: number; noLoadSpeed: number; noLoadCurrent: number; stallTorque: number; stallCurrent: number; windingResistance: number; modelName: string }> = {
  'RS360_6V': { ratedVoltage: 6, noLoadSpeed: 12000, noLoadCurrent: 70, stallTorque: 38, stallCurrent: 3000, windingResistance: 2, modelName: 'RS360-6V' },
  'RS540_12V': { ratedVoltage: 12, noLoadSpeed: 18000, noLoadCurrent: 200, stallTorque: 150, stallCurrent: 15000, windingResistance: 0.8, modelName: 'RS540-12V' },
  'JGB37_520_12V': { ratedVoltage: 12, noLoadSpeed: 30, noLoadCurrent: 50, stallTorque: 300, stallCurrent: 1200, windingResistance: 10, modelName: 'JGB37-520' },
  '130RA_3V': { ratedVoltage: 3, noLoadSpeed: 9000, noLoadCurrent: 100, stallTorque: 10, stallCurrent: 2000, windingResistance: 1.5, modelName: '130RA-3V' },
  '28GA_6V': { ratedVoltage: 6, noLoadSpeed: 180, noLoadCurrent: 40, stallTorque: 5, stallCurrent: 600, windingResistance: 10, modelName: '28GA-6V' },
};
