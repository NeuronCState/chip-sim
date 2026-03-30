/**
 * 扩展通信模块元件定义
 *
 * UART模块、SPI器件、I2C器件、CAN模块、LoRa、NRF24、ZigBee
 */

// ==================== UART 转接板 ====================

export interface UARTModuleParams {
  chip: string;
  vdd: number;
  maxBaudRate: number;
  interface: 'USB' | 'TTL' | 'RS232';
  hasDTR: boolean;
  hasRTS: boolean;
  levelShifter: boolean;
}

export const UART_MODULE_MODELS: Record<string, UARTModuleParams> = {
  'CH340G': { chip: 'CH340G', vdd: 5, maxBaudRate: 2000000, interface: 'USB', hasDTR: true, hasRTS: true, levelShifter: true },
  'CP2102': { chip: 'CP2102', vdd: 3.3, maxBaudRate: 921600, interface: 'USB', hasDTR: true, hasRTS: true, levelShifter: true },
  'FT232RL': { chip: 'FT232RL', vdd: 3.3, maxBaudRate: 3000000, interface: 'USB', hasDTR: true, hasRTS: true, levelShifter: true },
  'PL2303': { chip: 'PL2303', vdd: 3.3, maxBaudRate: 1228800, interface: 'USB', hasDTR: true, hasRTS: false, levelShifter: true },
  'MAX232': { chip: 'MAX232', vdd: 5, maxBaudRate: 120000, interface: 'RS232', hasDTR: false, hasRTS: false, levelShifter: false },
};

// ==================== SPI 器件 ====================

export interface SPIDeviceParams {
  deviceType: string;
  maxClockFreq: number;
  vdd: { min: number; max: number; typical: number };
  cpol: number;
  cpha: number;
  csActiveLow: boolean;
}

export const SPI_DEVICE_MODELS: Record<string, SPIDeviceParams> = {
  'SPI_FLASH_W25Q16': { deviceType: 'flash', maxClockFreq: 80, vdd: { min: 2.7, max: 3.6, typical: 3.3 }, cpol: 0, cpha: 0, csActiveLow: true },
  'SPI_FLASH_W25Q64': { deviceType: 'flash', maxClockFreq: 80, vdd: { min: 2.7, max: 3.6, typical: 3.3 }, cpol: 0, cpha: 0, csActiveLow: true },
  'SPI_DAC_MCP4921': { deviceType: 'dac', maxClockFreq: 20, vdd: { min: 2.7, max: 5.5, typical: 3.3 }, cpol: 0, cpha: 0, csActiveLow: true },
  'SPI_ADC_MCP3208': { deviceType: 'adc', maxClockFreq: 1.35, vdd: { min: 2.7, max: 5.5, typical: 3.3 }, cpol: 0, cpha: 0, csActiveLow: true },
  'SPI_ADC_ADS1256': { deviceType: 'adc', maxClockFreq: 7.68, vdd: { min: 2.7, max: 5.25, typical: 3.3 }, cpol: 1, cpha: 1, csActiveLow: true },
};

// ==================== I2C 器件 ====================

export interface I2CDeviceParams {
  deviceType: string;
  address: number;
  maxClockFreq: number;
  vdd: { min: number; max: number; typical: number };
}

export const I2C_DEVICE_MODELS: Record<string, I2CDeviceParams> = {
  'I2C_OLED_SSD1306': { deviceType: 'display', address: 0x3C, maxClockFreq: 400, vdd: { min: 1.65, max: 3.6, typical: 3.3 } },
  'I2C_RTC_DS3231': { deviceType: 'rtc', address: 0x68, maxClockFreq: 400, vdd: { min: 2.3, max: 5.5, typical: 3.3 } },
  'I2C_RTC_DS1307': { deviceType: 'rtc', address: 0x68, maxClockFreq: 100, vdd: { min: 4.5, max: 5.5, typical: 5.0 } },
  'I2C_GPIO_PCF8574': { deviceType: 'gpio_expander', address: 0x20, maxClockFreq: 400, vdd: { min: 2.5, max: 6.0, typical: 3.3 } },
  'I2C_GPIO_MCP23017': { deviceType: 'gpio_expander', address: 0x20, maxClockFreq: 1700, vdd: { min: 1.8, max: 5.5, typical: 3.3 } },
  'I2C_ADC_ADS1115': { deviceType: 'adc', address: 0x48, maxClockFreq: 400, vdd: { min: 2.0, max: 5.5, typical: 3.3 } },
  'I2C_DAC_MCP4725': { deviceType: 'dac', address: 0x60, maxClockFreq: 400, vdd: { min: 2.7, max: 5.5, typical: 3.3 } },
  'I2C_TEMP_TMP36': { deviceType: 'temperature', address: 0x48, maxClockFreq: 400, vdd: { min: 2.7, max: 5.5, typical: 3.3 } },
};

// ==================== LoRa 模块 ====================

export interface LoRaModuleParams {
  frequency: number;
  spreadingFactor: number;
  bandwidth: number;
  txPower: number;
  sensitivity: number;
  range: number;
  vdd: number;
  sleepCurrent: number;
  txCurrent: number;
  model: string;
}

export const LORA_MODULE_MODELS: Record<string, LoRaModuleParams> = {
  'SX1278_433': { frequency: 433000000, spreadingFactor: 12, bandwidth: 125000, txPower: 20, sensitivity: -148, range: 10000, vdd: 3.3, sleepCurrent: 0.2, txCurrent: 120, model: 'SX1278-433MHz' },
  'SX1276_868': { frequency: 868000000, spreadingFactor: 12, bandwidth: 125000, txPower: 20, sensitivity: -148, range: 10000, vdd: 3.3, sleepCurrent: 0.2, txCurrent: 120, model: 'SX1276-868MHz' },
  'SX1276_915': { frequency: 915000000, spreadingFactor: 12, bandwidth: 125000, txPower: 20, sensitivity: -148, range: 10000, vdd: 3.3, sleepCurrent: 0.2, txCurrent: 120, model: 'SX1276-915MHz' },
  'RA_02_433': { frequency: 433000000, spreadingFactor: 12, bandwidth: 500000, txPower: 18, sensitivity: -140, range: 8000, vdd: 3.3, sleepCurrent: 1, txCurrent: 100, model: 'RA-02' },
};

/** LoRa 传输速率计算 */
export function loraDataRate(spreadingFactor: number, bandwidth: number): number {
  return spreadingFactor * (bandwidth / Math.pow(2, spreadingFactor));
}

/** LoRa 链路预算 */
export function loraLinkBudget(txPower: number, sensitivity: number): number {
  return txPower - sensitivity;
}

// ==================== NRF24 模块 ====================

export interface NRF24Params {
  frequency: number;
  dataRate: number;
  txPower: number;
  sensitivity: number;
  channels: number;
  vdd: number;
  sleepCurrent: number;
  txCurrent: number;
  model: string;
}

export const NRF24_MODULE_MODELS: Record<string, NRF24Params> = {
  'NRF24L01': { frequency: 2400000000, dataRate: 2000, txPower: 0, sensitivity: -82, channels: 125, vdd: 3.3, sleepCurrent: 0.9, txCurrent: 11.3, model: 'NRF24L01' },
  'NRF24L01_PA': { frequency: 2400000000, dataRate: 2000, txPower: 20, sensitivity: -82, channels: 125, vdd: 3.3, sleepCurrent: 0.9, txCurrent: 115, model: 'NRF24L01+PA+LNA' },
  'NRF24L01_MINI': { frequency: 2400000000, dataRate: 2000, txPower: 0, sensitivity: -82, channels: 125, vdd: 3.3, sleepCurrent: 0.9, txCurrent: 11.3, model: 'NRF24L01-Mini' },
};

/** NRF24 传输时间 */
export function nrf24TransferTime(bytes: number, dataRateKbps: number): number {
  return (bytes * 8) / dataRateKbps; // ms
}

// ==================== ZigBee 模块 ====================

export interface ZigBeeParams {
  frequency: number;
  dataRate: number;
  txPower: number;
  sensitivity: number;
  range: number;
  vdd: number;
  sleepCurrent: number;
  meshNodes: number;
  model: string;
}

export const ZIGBEE_MODULE_MODELS: Record<string, ZigBeeParams> = {
  'XBEE_S2C': { frequency: 2400000000, dataRate: 250, txPower: 8, sensitivity: -100, range: 1200, vdd: 3.3, sleepCurrent: 10, meshNodes: 32, model: 'XBee S2C' },
  'CC2530': { frequency: 2400000000, dataRate: 250, txPower: 4.5, sensitivity: -97, range: 200, vdd: 3.3, sleepCurrent: 1, meshNodes: 64, model: 'CC2530' },
};

// ==================== NFC/RFID 模块 ====================

export interface NFCModuleParams {
  frequency: number;
  standard: string;
  readRange: number;
  vdd: number;
  currentDraw: number;
  antennaType: string;
  model: string;
}

export const NFC_MODULE_MODELS: Record<string, NFCModuleParams> = {
  'RC522_13M56': { frequency: 13560000, standard: 'ISO14443A', readRange: 5, vdd: 3.3, currentDraw: 26, antennaType: 'PCB', model: 'MFRC-522' },
  'PN532_13M56': { frequency: 13560000, standard: 'ISO14443A/B', readRange: 5, vdd: 3.3, currentDraw: 35, antennaType: 'PCB', model: 'PN532' },
  'EM4095_125K': { frequency: 125000, standard: 'EM4100', readRange: 10, vdd: 5, currentDraw: 15, antennaType: 'external_coil', model: 'EM4095' },
};
