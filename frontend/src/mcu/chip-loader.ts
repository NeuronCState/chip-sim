/**
 * Chip Configuration Loader
 * Loads chip JSON configs from /chips/{family}/{model}.json
 */

export interface PinConfig {
  id: string;
  port: string;
  bit: number;
  functions: string[];
}

export interface ChipConfig {
  series: string;
  name: string;
  package: string;
  flash: number;
  ram: number;
  clock: number;
  pinCount: number;
  pins: PinConfig[];
  peripherals: string[];
}

export type ChipFamily = 'c51' | 'stm32' | 'esp32' | 'arduino' | 'avr' | 'pic' | 'msp430' | 'nxp' | 'riscv';

/**
 * Load chip configuration from JSON file
 * @param family - Chip family: 'c51', 'stm32', 'esp32', 'arduino', 'avr', 'pic', 'msp430', 'nxp', 'riscv'
 * @param model - Chip model filename (without .json), e.g. 'stm32f103c8t6'
 * @returns Parsed ChipConfig
 */
export async function loadChipConfig(
  family: ChipFamily | string,
  model: string
): Promise<ChipConfig> {
  const url = `/chips/${family}/${model}.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to load chip config: ${response.status} ${response.statusText} (${url})`
    );
  }
  const config: ChipConfig = await response.json();
  return config;
}

/**
 * List all known chip models for a given family
 * (static registry; extend as new chips are added)
 */
export function getAvailableChips(): Record<string, string[]> {
  return {
    c51: ['stc89c52rc', 'at89s52', 'at89c51', 'stc12c5a60s2', 'stc15w4k32s4'],
    stm32: ['stm32f103c8t6', 'stm32f103rct6', 'stm32f407vgt6', 'stm32f411ceu6', 'stm32f429iit6', 'stm32h743vit6', 'stm32g431cbt6', 'stm32l476rgt6', 'stm32wl55jci6'],
    esp32: ['esp32-wroom-32', 'esp32-s2', 'esp32-s3', 'esp32-c3', 'esp32-c6', 'esp8266'],
    arduino: ['uno', 'mega', 'nano', 'leonardo', 'due'],
    avr: ['atmega328p', 'atmega2560', 'attiny85'],
    pic: ['pic16f877a', 'pic18f4550', 'pic32mx'],
    msp430: ['g2553', 'f5529'],
    nxp: ['lpc1768', 'imxrt1062'],
    riscv: ['ch32v', 'gd32vf103', 'bl602'],
  };
}
