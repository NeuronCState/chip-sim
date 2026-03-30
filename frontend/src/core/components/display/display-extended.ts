/**
 * LED 显示元件定义
 *
 * 各色LED、RGB LED、LED阵列、OLED显示屏、蜂鸣器
 */

// ==================== 各色 LED ====================

export interface LEDParams {
  color: string;
  forwardVoltage: number;
  maxCurrent: number;
  typicalCurrent: number;
  wavelength: number;
  brightness: number;
  viewingAngle: number;
  package: '3mm' | '5mm' | '0805' | '0603' | '1206';
}

export const LED_MODELS: Record<string, LEDParams> = {
  'LED_RED_5MM': { color: 'red', forwardVoltage: 2.0, maxCurrent: 20, typicalCurrent: 10, wavelength: 625, brightness: 200, viewingAngle: 30, package: '5mm' },
  'LED_GREEN_5MM': { color: 'green', forwardVoltage: 2.2, maxCurrent: 20, typicalCurrent: 10, wavelength: 565, brightness: 300, viewingAngle: 30, package: '5mm' },
  'LED_BLUE_5MM': { color: 'blue', forwardVoltage: 3.2, maxCurrent: 20, typicalCurrent: 10, wavelength: 470, brightness: 500, viewingAngle: 30, package: '5mm' },
  'LED_WHITE_5MM': { color: 'white', forwardVoltage: 3.2, maxCurrent: 20, typicalCurrent: 10, wavelength: 0, brightness: 800, viewingAngle: 30, package: '5mm' },
  'LED_YELLOW_5MM': { color: 'yellow', forwardVoltage: 2.1, maxCurrent: 20, typicalCurrent: 10, wavelength: 590, brightness: 200, viewingAngle: 30, package: '5mm' },
  'LED_RED_3MM': { color: 'red', forwardVoltage: 2.0, maxCurrent: 20, typicalCurrent: 10, wavelength: 625, brightness: 100, viewingAngle: 40, package: '3mm' },
  'LED_RED_0805': { color: 'red', forwardVoltage: 1.8, maxCurrent: 20, typicalCurrent: 5, wavelength: 630, brightness: 80, viewingAngle: 120, package: '0805' },
  'LED_GREEN_0805': { color: 'green', forwardVoltage: 2.1, maxCurrent: 20, typicalCurrent: 5, wavelength: 570, brightness: 120, viewingAngle: 120, package: '0805' },
  'LED_BLUE_0603': { color: 'blue', forwardVoltage: 2.9, maxCurrent: 5, typicalCurrent: 2, wavelength: 465, brightness: 50, viewingAngle: 130, package: '0603' },
  'LED_IR_5MM': { color: 'infrared', forwardVoltage: 1.2, maxCurrent: 50, typicalCurrent: 20, wavelength: 940, brightness: 0, viewingAngle: 30, package: '5mm' },
};

/** LED 限流电阻计算 */
export function ledResistor(vcc: number, led: LEDParams): number {
  return (vcc - led.forwardVoltage) / (led.typicalCurrent / 1000);
}

/** LED 功耗 */
export function ledPower(led: LEDParams): number {
  return led.forwardVoltage * led.typicalCurrent / 1000;
}

// ==================== RGB LED ====================

export interface RGBLEDParams {
  redForwardVoltage: number;
  greenForwardVoltage: number;
  blueForwardVoltage: number;
  maxCurrentPerChannel: number;
  commonAnode: boolean;
}

export const RGB_LED_MODELS: Record<string, RGBLEDParams> = {
  'RGB_5MM_CA': { redForwardVoltage: 2.0, greenForwardVoltage: 3.0, blueForwardVoltage: 3.0, maxCurrentPerChannel: 20, commonAnode: true },
  'RGB_5MM_CC': { redForwardVoltage: 2.0, greenForwardVoltage: 3.0, blueForwardVoltage: 3.0, maxCurrentPerChannel: 20, commonAnode: false },
  'RGB_5050_CA': { redForwardVoltage: 2.0, greenForwardVoltage: 3.0, blueForwardVoltage: 3.0, maxCurrentPerChannel: 20, commonAnode: true },
  'WS2812B': { redForwardVoltage: 2.0, greenForwardVoltage: 3.0, blueForwardVoltage: 3.0, maxCurrentPerChannel: 20, commonAnode: false },
};

/** RGB LED 各通道限流电阻 */
export function rgbLedResistors(vcc: number, params: RGBLEDParams): { r: number; g: number; b: number } {
  return {
    r: (vcc - params.redForwardVoltage) / 0.01,
    g: (vcc - params.greenForwardVoltage) / 0.01,
    b: (vcc - params.blueForwardVoltage) / 0.01,
  };
}

// ==================== OLED 显示屏 ====================

export interface OLEDDisplayParams {
  width: number;
  height: number;
  interface: 'i2c' | 'spi';
  controller: string;
  vdd: number;
  currentDraw: number;
  contrast: number;
}

export const OLED_MODELS: Record<string, OLEDDisplayParams> = {
  'SSD1306_128x64_I2C': { width: 128, height: 64, interface: 'i2c', controller: 'SSD1306', vdd: 3.3, currentDraw: 20, contrast: 128 },
  'SSD1306_128x32_I2C': { width: 128, height: 32, interface: 'i2c', controller: 'SSD1306', vdd: 3.3, currentDraw: 10, contrast: 128 },
  'SSD1306_128x64_SPI': { width: 128, height: 64, interface: 'spi', controller: 'SSD1306', vdd: 3.3, currentDraw: 20, contrast: 128 },
  'SH1106_128x64_I2C': { width: 128, height: 64, interface: 'i2c', controller: 'SH1106', vdd: 3.3, currentDraw: 18, contrast: 128 },
  'SSD1309_128x64_SPI': { width: 128, height: 64, interface: 'spi', controller: 'SSD1309', vdd: 3.3, currentDraw: 25, contrast: 150 },
};

/** OLED 像素数 */
export function oledPixelCount(params: OLEDDisplayParams): number {
  return params.width * params.height;
}

/** OLED 每像素功耗估算 */
export function oledPowerPerPixel(params: OLEDDisplayParams): number {
  return params.vdd * (params.currentDraw / 1000) / (params.width * params.height) * 1e6;
}

// ==================== 蜂鸣器扩展 ====================

export interface PiezoBuzzerParams {
  ratedVoltage: number;
  resonantFreq: number;
  soundPressure: number;
  capacitance: number;
  maxVoltage: number;
}

export const PIEZO_BUZZER_MODELS: Record<string, PiezoBuzzerParams> = {
  'PKM17EPPH4001': { ratedVoltage: 3, resonantFreq: 4000, soundPressure: 85, capacitance: 14000e-12, maxVoltage: 20 },
  'PKLCS1212E4001': { ratedVoltage: 3, resonantFreq: 4000, soundPressure: 80, capacitance: 11000e-12, maxVoltage: 15 },
  'CUI_CPT_9019S': { ratedVoltage: 5, resonantFreq: 2700, soundPressure: 90, capacitance: 20000e-12, maxVoltage: 25 },
  'SF_CM18': { ratedVoltage: 5, resonantFreq: 2400, soundPressure: 78, capacitance: 8000e-12, maxVoltage: 12 },
};

// ==================== LED 矩阵 ====================

export interface LEDMatrixParams {
  rows: number;
  cols: number;
  forwardVoltage: number;
  maxCurrent: number;
  color: string;
  commonType: 'anode' | 'cathode';
}

export const LED_MATRIX_MODELS: Record<string, LEDMatrixParams> = {
  'MATRIX_8x8_RED': { rows: 8, cols: 8, forwardVoltage: 2.0, maxCurrent: 20, color: 'red', commonType: 'cathode' },
  'MATRIX_8x8_GREEN': { rows: 8, cols: 8, forwardVoltage: 2.2, maxCurrent: 20, color: 'green', commonType: 'cathode' },
  'MATRIX_8x8_RGB': { rows: 8, cols: 8, forwardVoltage: 3.0, maxCurrent: 20, color: 'RGB', commonType: 'cathode' },
  'MATRIX_5x7_RED': { rows: 7, cols: 5, forwardVoltage: 2.0, maxCurrent: 15, color: 'red', commonType: 'cathode' },
};

/** LED 矩阵限流电阻 */
export function ledMatrixResistor(vcc: number, params: LEDMatrixParams): number {
  return (vcc - params.forwardVoltage) / (params.maxCurrent / 1000);
}

// ==================== 多位数码管 ====================

export interface MultiDigitSevenSegParams {
  digits: number;
  commonType: 'cathode' | 'anode';
  color: string;
  forwardVoltage: number;
  segmentCurrent: number;
}

export const MULTI_DIGIT_SEVEN_SEG_MODELS: Record<string, MultiDigitSevenSegParams> = {
  'TWO_DIG_RED_CC': { digits: 2, commonType: 'cathode', color: 'red', forwardVoltage: 2.0, segmentCurrent: 10 },
  'FOUR_DIG_RED_CC': { digits: 4, commonType: 'cathode', color: 'red', forwardVoltage: 2.0, segmentCurrent: 10 },
  'FOUR_DIG_GREEN_CA': { digits: 4, commonType: 'anode', color: 'green', forwardVoltage: 2.2, segmentCurrent: 10 },
  'SIX_DIG_BLUE_CC': { digits: 6, commonType: 'cathode', color: 'blue', forwardVoltage: 3.2, segmentCurrent: 5 },
  'FOUR_DIG_YELLOW_CC': { digits: 4, commonType: 'cathode', color: 'yellow', forwardVoltage: 2.0, segmentCurrent: 10 },
};

/** 多位数码管扫描频率建议 */
export function multiDigitScanFrequency(digits: number): number {
  return 1000 / (digits * 2); // 每位 2ms，无闪烁
}
