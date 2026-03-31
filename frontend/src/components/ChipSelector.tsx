import { useState } from 'react';
import { Segmented } from '../ui/Segmented';
import { Dropdown } from '../ui/Dropdown';

// ─── 芯片系列 → 型号映射 ───
// value 必须与 public/chips/{family}/{model}.json 文件名一致（不含 .json）
const chipSeries = {
  C51: [
    { value: 'at89c51', label: 'AT89C51' },
    { value: 'at89s52', label: 'AT89S52' },
    { value: 'stc89c52rc', label: 'STC89C52' },
    { value: 'stc12c5a60s2', label: 'STC12C5A60S2' },
    { value: 'stc15w4k', label: 'STC15W4K' },
  ],
  STM32: [
    { value: 'stm32f103c8t6', label: 'STM32F103C8 (Blue Pill)' },
    { value: 'stm32f103rct6', label: 'STM32F103RB' },
    { value: 'stm32f407vgt6', label: 'STM32F407VG' },
    { value: 'stm32f411ceu6', label: 'STM32F411CE (Black Pill)' },
    { value: 'stm32f429iit6', label: 'STM32F429II' },
    { value: 'stm32h743vit6', label: 'STM32H743VI' },
    { value: 'stm32g431cbt6', label: 'STM32G431CB' },
    { value: 'stm32l476rgt6', label: 'STM32L476RG' },
    { value: 'stm32wl55jci6', label: 'STM32WL55JC' },
  ],
  ESP32: [
    { value: 'esp32-wroom-32', label: 'ESP32-WROOM-32' },
    { value: 'esp32-s3', label: 'ESP32-S3-WROOM-1' },
    { value: 'esp32-s2', label: 'ESP32-S2-Saola' },
    { value: 'esp32-c3', label: 'ESP32-C3' },
    { value: 'esp32-c6', label: 'ESP32-C6' },
    { value: 'esp8266', label: 'ESP8266' },
  ],
  Arduino: [
    { value: 'uno', label: 'Arduino Uno' },
    { value: 'mega', label: 'Arduino Mega 2560' },
    { value: 'nano', label: 'Arduino Nano' },
    { value: 'leonardo', label: 'Arduino Leonardo' },
    { value: 'due', label: 'Arduino Due' },
  ],
  AVR: [
    { value: 'atmega328p', label: 'ATmega328P' },
    { value: 'atmega2560', label: 'ATmega2560' },
    { value: 'attiny85', label: 'ATtiny85' },
  ],
  'RISC-V': [
    { value: 'ch32v', label: 'CH32V' },
    { value: 'gd32vf103', label: 'GD32VF103' },
    { value: 'bl602', label: 'BL602' },
  ],
};

type ChipFamily = keyof typeof chipSeries;

/**
 * 将 ChipSelector 系列名映射为 chip-loader 的 family 目录名
 * 例: 'RISCV' → 'riscv', 'MSP430' → 'msp430'
 */
export function familyToDir(family: string): string {
  const map: Record<string, string> = {
    C51: 'c51',
    STM32: 'stm32',
    ESP32: 'esp32',
    Arduino: 'arduino',
    AVR: 'avr',
    'RISC-V': 'riscv',
  };
  return map[family] ?? family.toLowerCase();
}

const seriesOptions = [
  { value: 'C51', label: 'C51' },
  { value: 'STM32', label: 'STM32' },
  { value: 'ESP32', label: 'ESP32' },
  { value: 'Arduino', label: 'Arduino' },
  { value: 'AVR', label: 'AVR' },
  { value: 'RISC-V', label: 'RISC-V' },
];

export interface ChipSelectorProps {
  onChipSelected?: (family: ChipFamily, model: string) => void;
  className?: string;
}

export function ChipSelector({ onChipSelected, className }: ChipSelectorProps) {
  const [family, setFamily] = useState<ChipFamily>('C51');
  const [model, setModel] = useState(chipSeries['C51'][0].value);

  const handleFamilyChange = (value: string) => {
    const f = value as ChipFamily;
    setFamily(f);
    const firstModel = chipSeries[f][0].value;
    setModel(firstModel);
    onChipSelected?.(f, firstModel);
  };

  const handleModelChange = (value: string) => {
    setModel(value);
    onChipSelected?.(family, value);
  };

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <Segmented
        options={seriesOptions}
        value={family}
        onChange={handleFamilyChange}
      />
      <Dropdown
        options={chipSeries[family]}
        value={model}
        onChange={handleModelChange}
      />
    </div>
  );
}
