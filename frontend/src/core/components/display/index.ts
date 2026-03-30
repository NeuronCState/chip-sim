/**
 * 七段数码管（Seven Segment Display）元件模型
 *
 * 常见显示器件，用于显示数字 0-9 和部分字母
 * 共阴/共阳两种接法
 */

import type { ComponentPort } from '../../../types/circuit';

// ==================== 类型定义 ====================

/** 数码管共极类型 */
export type SevenSegCommonType = 'cathode' | 'anode';

/** 数码管段码类型 */
export type SegmentType = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'dp';

/** 数码管参数 */
export interface SevenSegmentParams {
  /** 共极类型 */
  commonType: SevenSegCommonType;
  /** 段正向压降 (V) */
  forwardVoltage: number;
  /** 段电流 (mA) */
  segmentCurrent: number;
  /** 亮度 (mcd) */
  brightness: number;
  /** 颜色 */
  color: 'red' | 'green' | 'blue' | 'yellow' | 'white';
  /** 数字位数 */
  digits: number;
  /** 带小数点 */
  hasDecimalPoint: boolean;
  /** 型号名称 */
  modelName: string;
}

// ==================== 默认参数 ====================

/** 常见七段数码管型号 */
export const SEVEN_SEGMENT_MODELS: Record<string, SevenSegmentParams> = {
  /** 共阴红色 1位 */
  'RED_CC_1DIG': {
    commonType: 'cathode',
    forwardVoltage: 2.0,
    segmentCurrent: 10,
    brightness: 20,
    color: 'red',
    digits: 1,
    hasDecimalPoint: true,
    modelName: '5161AS',
  },
  /** 共阳红色 1位 */
  'RED_CA_1DIG': {
    commonType: 'anode',
    forwardVoltage: 2.0,
    segmentCurrent: 10,
    brightness: 20,
    color: 'red',
    digits: 1,
    hasDecimalPoint: true,
    modelName: '5161BS',
  },
  /** 共阴绿色 1位 */
  'GREEN_CC_1DIG': {
    commonType: 'cathode',
    forwardVoltage: 2.2,
    segmentCurrent: 10,
    brightness: 30,
    color: 'green',
    digits: 1,
    hasDecimalPoint: true,
    modelName: '5161AG',
  },
  /** 共阴蓝色 1位 */
  'BLUE_CC_1DIG': {
    commonType: 'cathode',
    forwardVoltage: 3.2,
    segmentCurrent: 10,
    brightness: 50,
    color: 'blue',
    digits: 1,
    hasDecimalPoint: true,
    modelName: '5161AB',
  },
};

/** 默认七段数码管参数 */
export const DEFAULT_SEVEN_SEGMENT_PARAMS: SevenSegmentParams = SEVEN_SEGMENT_MODELS['RED_CC_1DIG'];

// ==================== 段码表 ====================

/** 数字 0-9 的段码（共阴：1=亮，共阳：0=亮） */
export const SEGMENT_CODE_TABLE: Record<number, SegmentType[]> = {
  0: ['a', 'b', 'c', 'd', 'e', 'f'],
  1: ['b', 'c'],
  2: ['a', 'b', 'd', 'e', 'g'],
  3: ['a', 'b', 'c', 'd', 'g'],
  4: ['b', 'c', 'f', 'g'],
  5: ['a', 'c', 'd', 'f', 'g'],
  6: ['a', 'c', 'd', 'e', 'f', 'g'],
  7: ['a', 'b', 'c'],
  8: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  9: ['a', 'b', 'c', 'd', 'f', 'g'],
};

/** 字母段码 */
export const LETTER_SEGMENT_CODE: Record<string, SegmentType[]> = {
  'A': ['a', 'b', 'c', 'e', 'f', 'g'],
  'b': ['c', 'd', 'e', 'f', 'g'],
  'C': ['a', 'd', 'e', 'f'],
  'd': ['b', 'c', 'd', 'e', 'g'],
  'E': ['a', 'd', 'e', 'f', 'g'],
  'F': ['a', 'e', 'f', 'g'],
  'H': ['b', 'c', 'e', 'f', 'g'],
  'L': ['d', 'e', 'f'],
  'P': ['a', 'b', 'e', 'f', 'g'],
  'U': ['b', 'c', 'd', 'e', 'f'],
};

// ==================== 行为模型 ====================

/**
 * 获取给定数字/字符的段码
 *
 * @param char 要显示的字符（0-9 或字母）
 * @returns 激活的段列表
 */
export function sevenSegmentCode(char: string): SegmentType[] {
  const num = parseInt(char, 10);
  if (!isNaN(num) && num >= 0 && num <= 9) {
    return SEGMENT_CODE_TABLE[num];
  }
  return LETTER_SEGMENT_CODE[char.toUpperCase()] || [];
}

/**
 * 获取段的开关状态
 *
 * @param char 要显示的字符
 * @param params 数码管参数
 * @returns 各段的开关状态 { a: boolean, b: boolean, ... }
 */
export function sevenSegmentStates(
  char: string,
  params: SevenSegmentParams = DEFAULT_SEVEN_SEGMENT_PARAMS
): Record<SegmentType, boolean> {
  const activeSegments = new Set(sevenSegmentCode(char));
  const states: Record<string, boolean> = {};
  const allSegments: SegmentType[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'];

  for (const seg of allSegments) {
    const isActive = activeSegments.has(seg);
    // 共阴：高电平点亮；共阳：低电平点亮
    states[seg] = params.commonType === 'cathode' ? isActive : !isActive;
  }
  return states as Record<SegmentType, boolean>;
}

/**
 * 计算限流电阻
 *
 * R = (Vcc - Vf) / Iseg
 *
 * @param supplyVoltage 电源电压 (V)
 * @param params 数码管参数
 * @returns 每段限流电阻 (Ω)
 */
export function sevenSegmentResistor(
  supplyVoltage: number,
  params: SevenSegmentParams = DEFAULT_SEVEN_SEGMENT_PARAMS
): number {
  const I = params.segmentCurrent / 1000; // mA → A
  return Math.max(0, (supplyVoltage - params.forwardVoltage) / I);
}

/**
 * 功耗计算（所有段点亮时）
 *
 * @param params 数码管参数
 * @returns 功耗 (mW)
 */
export function sevenSegmentMaxPower(
  params: SevenSegmentParams = DEFAULT_SEVEN_SEGMENT_PARAMS
): number {
  const segmentCount = params.hasDecimalPoint ? 8 : 7;
  return segmentCount * params.forwardVoltage * params.segmentCurrent;
}

// ==================== 端口定义 ====================

/** 七段数码管端口：a~g + dp + COM */
export const SEVEN_SEGMENT_PORTS: ComponentPort[] = [
  { id: 'seg_a', offset: { x: -40, y: -25 } },
  { id: 'seg_b', offset: { x: -20, y: -25 } },
  { id: 'seg_c', offset: { x: 0, y: -25 } },
  { id: 'seg_d', offset: { x: 20, y: -25 } },
  { id: 'seg_e', offset: { x: 40, y: -25 } },
  { id: 'seg_f', offset: { x: -30, y: 25 } },
  { id: 'seg_g', offset: { x: -10, y: 25 } },
  { id: 'seg_dp', offset: { x: 10, y: 25 } },
  { id: 'com', offset: { x: 30, y: 25 } },
];

// ==================== 扩展显示元件（LED、RGB LED、OLED、蜂鸣器等） ====================

export type { LEDParams, RGBLEDParams, OLEDDisplayParams, PiezoBuzzerParams, LEDMatrixParams, MultiDigitSevenSegParams } from './display-extended';
export {
  LED_MODELS,
  ledResistor,
  ledPower,
  RGB_LED_MODELS,
  rgbLedResistors,
  OLED_MODELS,
  oledPixelCount,
  oledPowerPerPixel,
  PIEZO_BUZZER_MODELS,
  LED_MATRIX_MODELS,
  ledMatrixResistor,
  MULTI_DIGIT_SEVEN_SEG_MODELS,
  multiDigitScanFrequency,
} from './display-extended';
