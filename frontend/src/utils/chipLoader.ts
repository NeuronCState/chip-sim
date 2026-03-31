/**
 * 芯片 JSON 加载工具
 * 从 /chips/{family}/ 加载芯片定义
 */

import type { ChipDefinition } from '../types/chip';

/** 家族名 → 目录映射 */
const FAMILY_DIR: Record<string, string> = {
  C51: 'c51',
  STM32: 'stm32',
  ESP32: 'esp32',
  Arduino: 'arduino',
};

/** 已知的 model → filename 映射 (避免目录扫描) */
const MODEL_FILE_MAP: Record<string, Record<string, string>> = {
  C51: {
    AT89C51: 'at89c51.json',
    AT89S52: 'at89s52.json',
    STC89C52: 'stc89c52rc.json',
    STC89C52RC: 'stc89c52rc.json',
    STC12C5A60S2: 'stc12c5a60s2.json',
    STC15W4K32S4: 'stc15w4k32s4.json',
  },
  STM32: {
    STM32F103C8: 'stm32f103c8t6.json',
    STM32F103RB: 'stm32f103rct6.json',
    STM32F103RCT6: 'stm32f103rct6.json',
    STM32F407VG: 'stm32f407vgt6.json',
    STM32F407VGT6: 'stm32f407vgt6.json',
    STM32F411CE: 'stm32f411ceu6.json',
    STM32F411CEU6: 'stm32f411ceu6.json',
    STM32F429II: 'stm32f429iit6.json',
    STM32F429IIT6: 'stm32f429iit6.json',
    STM32G431CB: 'stm32g431cbt6.json',
    STM32G431CBT6: 'stm32g431cbt6.json',
    STM32H743VI: 'stm32h743vit6.json',
    STM32H743VIT6: 'stm32h743vit6.json',
    STM32L476RG: 'stm32l476rgt6.json',
    STM32L476RGT6: 'stm32l476rgt6.json',
    STM32WL55JC: 'stm32wl55jci6.json',
    STM32WL55JCI6: 'stm32wl55jci6.json',
  },
  ESP32: {
    'ESP32-WROOM-32': 'esp32-wroom-32.json',
    'ESP32-S3': 'esp32-s3.json',
    'ESP32-S2': 'esp32-s2.json',
    'ESP32-C3': 'esp32-c3.json',
    'ESP32-C6': 'esp32-c6.json',
    ESP8266: 'esp8266.json',
  },
  Arduino: {
    'Arduino-Uno': 'uno.json',
    'Arduino-Mega': 'mega.json',
    'Arduino-Mega 2560': 'mega.json',
    'Arduino-Nano': 'nano.json',
    'Arduino-Leonardo': 'leonardo.json',
    'Arduino-Due': 'due.json',
  },
};

/** 缓存已加载的芯片定义 */
const chipCache = new Map<string, ChipDefinition>();

/**
 * 加载芯片定义
 * @param family 芯片系列 (C51, STM32, ESP32, ...)
 * @param model  芯片型号 (AT89C51, STM32F103C8, ...)
 */
export async function loadChipDefinition(
  family: string,
  model: string,
): Promise<ChipDefinition | null> {
  const cacheKey = `${family}/${model}`;
  if (chipCache.has(cacheKey)) return chipCache.get(cacheKey)!;

  const dir = FAMILY_DIR[family];
  if (!dir) return null;

  // 1. 查精确映射表
  const familyMap = MODEL_FILE_MAP[family];
  const filename = familyMap?.[model];

  if (filename) {
    try {
      const res = await fetch(`/chips/${dir}/${filename}`);
      if (res.ok) {
        const chip: ChipDefinition = await res.json();
        chipCache.set(cacheKey, chip);
        return chip;
      }
    } catch {
      /* fall through */
    }
  }

  // 2. 尝试直接用 model 名做文件名
  const tryNames = [
    `${model.toLowerCase()}.json`,
    `${model.toLowerCase().replace(/-/g, '-')}.json`,
  ];
  for (const name of tryNames) {
    try {
      const res = await fetch(`/chips/${dir}/${name}`);
      if (res.ok) {
        const chip: ChipDefinition = await res.json();
        chipCache.set(cacheKey, chip);
        return chip;
      }
    } catch {
      /* continue */
    }
  }

  // 3. 兜底：扫描目录下所有 JSON，按 name 字段匹配
  const allFilenames = Object.values(MODEL_FILE_MAP[family] ?? {});
  const seen = new Set<string>();
  for (const fname of allFilenames) {
    if (seen.has(fname)) continue;
    seen.add(fname);
    try {
      const res = await fetch(`/chips/${dir}/${fname}`);
      if (res.ok) {
        const chip: ChipDefinition = await res.json();
        // 缓存所有扫描到的芯片
        const key = `${family}/${chip.name}`;
        if (!chipCache.has(key)) chipCache.set(key, chip);
        if (chip.name.toUpperCase() === model.toUpperCase()) {
          chipCache.set(cacheKey, chip);
          return chip;
        }
      }
    } catch {
      /* skip */
    }
  }

  return null;
}

/**
 * 获取引脚类型分类（用于状态/颜色标识）
 */
export function classifyPin(functions: string[]): {
  type: 'gpio' | 'power' | 'control' | 'analog' | 'communication' | 'other';
  label: string;
} {
  const f = functions.map(fn => fn.toUpperCase());

  if (f.some(fn => fn.startsWith('POWER') || fn === 'GROUND' || fn === 'GND' || fn === 'VCC' || fn === 'VDD' || fn === 'VSS')) {
    return { type: 'power', label: '电源' };
  }
  if (f.some(fn => fn === 'RESET' || fn === 'RST' || fn === 'NRST')) {
    return { type: 'control', label: '控制' };
  }
  if (f.some(fn => fn.startsWith('ADC') || fn.startsWith('DAC') || fn === 'AREF')) {
    return { type: 'analog', label: '模拟' };
  }
  if (f.some(fn =>
    fn.startsWith('UART') || fn.startsWith('USART') || fn === 'RXD' || fn === 'TXD' ||
    fn.startsWith('SPI') || fn === 'MOSI' || fn === 'MISO' || fn === 'SCK' || fn === 'SS' ||
    fn.startsWith('I2C') || fn === 'SDA' || fn === 'SCL' ||
    fn.startsWith('CAN')
  )) {
    return { type: 'communication', label: '通信' };
  }
  if (f.some(fn => fn === 'GPIO' || fn === 'DIGITAL' || fn.startsWith('P') || fn.startsWith('IO'))) {
    return { type: 'gpio', label: 'GPIO' };
  }
  return { type: 'other', label: '其他' };
}
