/**
 * MCU 芯片引脚定义类型
 * 用于 chip-sim 前端公共芯片数据 (public/chips/*.json)
 */

// ==================== 引脚功能枚举 ====================

/** 引脚功能类型 - 覆盖全部芯片族 */
export const PinFunction = {
  // GPIO
  GPIO: 'GPIO',
  DIGITAL: 'DIGITAL',

  // 电源
  POWER: 'POWER',
  POWER_5V: 'POWER_5V',
  POWER_3V3: 'POWER_3V3',
  POWER_IN: 'POWER_IN',
  GROUND: 'GROUND',

  // 复位 / 控制
  RESET: 'RESET',
  RST: 'RST',
  EA_VPP: 'EA_VPP',
  ALE_PROG: 'ALE_PROG',
  PSEN: 'PSEN',

  // 晶振
  CRYSTAL: 'CRYSTAL',

  // UART 串口
  UART_RX: 'UART_RX',
  UART_TX: 'UART_TX',
  UART0_RX: 'UART0_RX',
  UART0_TX: 'UART0_TX',
  UART3_RX: 'UART3_RX',
  UART3_TX: 'UART3_TX',
  RXD: 'RXD',
  TXD: 'TXD',
  RXD2: 'RXD2',
  TXD2: 'TXD2',
  RxD: 'RxD',
  TxD: 'TxD',
  RxD2: 'RxD2',
  TxD2: 'TxD2',
  RxD3: 'RxD3',
  TxD3: 'TxD3',
  RxD4: 'RxD4',
  TxD4: 'TxD4',

  // SPI
  SPI: 'SPI',
  SPI_MOSI: 'SPI_MOSI',
  SPI_MISO: 'SPI_MISO',
  SPI_SCK: 'SPI_SCK',
  MOSI: 'MOSI',
  MISO: 'MISO',
  SCK: 'SCK',
  SCLK: 'SCLK',
  SS: 'SS',

  // I2C
  I2C_SDA: 'I2C_SDA',
  I2C_SCL: 'I2C_SCL',

  // ADC
  ADC: 'ADC',
  ADC0: 'ADC0',
  ADC1: 'ADC1',
  ADC2: 'ADC2',
  ADC3: 'ADC3',
  ADC4: 'ADC4',
  ADC5: 'ADC5',
  ADC6: 'ADC6',
  ADC7: 'ADC7',
  ADC_CH0: 'ADC_CH0',
  ADC_CH1: 'ADC_CH1',
  ADC_CH2: 'ADC_CH2',
  ADC_CH3: 'ADC_CH3',
  ADC_CH4: 'ADC_CH4',
  ADC_CH5: 'ADC_CH5',
  ADC_CH6: 'ADC_CH6',
  ADC_CH7: 'ADC_CH7',
  ADC_CH8: 'ADC_CH8',
  ADC_CH9: 'ADC_CH9',
  ADC_CH10: 'ADC_CH10',
  ADC_CH11: 'ADC_CH11',
  ADC_CH12: 'ADC_CH12',
  ADC_CH13: 'ADC_CH13',
  ADC_CH14: 'ADC_CH14',
  ADC_CH15: 'ADC_CH15',
  ADC_REF: 'ADC_REF',

  // PWM
  PWM: 'PWM',

  // 定时器 / 计数器
  T0: 'T0',
  T1: 'T1',
  T2: 'T2',
  T2EX: 'T2EX',

  // 中断
  INT: 'INT',
  INT0: 'INT0',
  INT1: 'INT1',
  INT2: 'INT2',
  INT3: 'INT3',

  // PCA / CCP
  CCP0: 'CCP0',
  CCP1: 'CCP1',
  CEX0: 'CEX0',
  CEX1: 'CEX1',
  CEX2: 'CEX2',
  ECI: 'ECI',

  // 地址 / 数据总线 (51系列)
  A8: 'A8',
  A9: 'A9',
  A10: 'A10',
  A11: 'A11',
  A12: 'A12',
  A13: 'A13',
  A14: 'A14',
  A15: 'A15',
  AD0: 'AD0',
  AD1: 'AD1',
  AD2: 'AD2',
  AD3: 'AD3',
  AD4: 'AD4',
  AD5: 'AD5',
  AD6: 'AD6',
  AD7: 'AD7',
  RD: 'RD',
  WR: 'WR',
} as const;
export type PinFunction = typeof PinFunction[keyof typeof PinFunction];

/** 引脚端口分组 */
export const PinPort = {
  Port0: '0',
  Port1: '1',
  Port2: '2',
  Port3: '3',
  Port4: '4',
  Port5: '5',
  PortA: 'A',
  PortD: 'D',
  Analog: 'ANALOG',
  Control: 'CONTROL',
  Power: 'POWER',
  I2C: 'I2C',
} as const;
export type PinPort = typeof PinPort[keyof typeof PinPort];

// ==================== 核心数据结构 ====================

/** 单个引脚定义 */
export interface ChipPin {
  /** 引脚标识符（如 "P1.0", "D0", "VCC"） */
  id: string;
  /** 所属端口分组 */
  port: PinPort | string;
  /** 端口内位编号 */
  bit: number;
  /** 复用功能列表（第一项通常为主功能） */
  functions: string[];
}

/** 芯片完整定义 */
export interface ChipDefinition {
  /** 芯片系列（如 "C51-STC", "Arduino", "STM32"） */
  series: string;
  /** 芯片名称 */
  name: string;
  /** 封装类型（如 "DIP-40", "TQFP-144"） */
  package: string;
  /** Flash 容量（字节） */
  flash: number;
  /** RAM 容量（字节） */
  ram: number;
  /** 主时钟频率（Hz） */
  clock: number;
  /** 引脚总数（含电源/地） */
  pinCount: number;
  /** 引脚定义数组 */
  pins: ChipPin[];
  /** 支持的外设列表 */
  peripherals: string[];
}

// ==================== 工具函数 ====================

/** 按端口分组引脚 */
export function groupPinsByPort(chip: ChipDefinition): Record<string, ChipPin[]> {
  return chip.pins.reduce<Record<string, ChipPin[]>>((acc, pin) => {
    const key = pin.port;
    if (!acc[key]) acc[key] = [];
    acc[key].push(pin);
    return acc;
  }, {});
}

/** 获取指定功能的所有引脚 */
export function getPinsByFunction(chip: ChipDefinition, fn: string): ChipPin[] {
  return chip.pins.filter(pin => pin.functions.includes(fn));
}

/** 获取 GPIO 引脚列表 */
export function getGPIOPins(chip: ChipDefinition): ChipPin[] {
  return chip.pins.filter(pin => pin.functions.includes('GPIO'));
}

/** 获取电源引脚列表 */
export function getPowerPins(chip: ChipDefinition): ChipPin[] {
  return chip.pins.filter(pin =>
    pin.functions.some(f => f.startsWith('POWER') || f === 'GROUND')
  );
}

/** 获取复位引脚 */
export function getResetPin(chip: ChipDefinition): ChipPin | undefined {
  return chip.pins.find(pin =>
    pin.functions.includes('RESET') || pin.functions.includes('RST')
  );
}

/** 获取晶振引脚 */
export function getCrystalPins(chip: ChipDefinition): ChipPin[] {
  return chip.pins.filter(pin => pin.functions.includes('CRYSTAL'));
}
