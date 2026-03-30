/**
 * 通信模块元件定义
 *
 * 蓝牙模块、WiFi模块、CAN收发器、RS-485收发器、移位寄存器
 * 包含行为模型和接口定义
 */

// 移位寄存器（74HC595 等）
export * from './shift-register';

// ==================== 类型定义 ====================

/** 蓝牙模块参数 */
export interface BluetoothModuleParams {
  /** 蓝牙版本 */
  version: '2.0' | '4.0' | '4.2' | '5.0' | '5.2';
  /** 支持协议 */
  protocols: ('BLE' | 'Classic')[];
  /** 工作电压 (V) */
  vdd: number;
  /** 发射功率 (dBm) */
  txPower: number;
  /** 接收灵敏度 (dBm) */
  rssi: number;
  /** 最大传输速率 (kbps) */
  maxDataRate: number;
  /** 工作距离 (m) */
  range: number;
  /** UART 波特率 (bps) */
  uartBaudRate: number;
  /** 工作电流 - 发射 (mA) */
  txCurrent: number;
  /** 工作电流 - 接收 (mA) */
  rxCurrent: number;
  /** 休眠电流 (μA) */
  sleepCurrent: number;
  /** 模块型号 */
  model: string;
}

/** WiFi 模块参数 */
export interface WiFiModuleParams {
  /** WiFi 标准 */
  standard: '802.11b' | '802.11g' | '802.11n' | '802.11ac' | '802.11ax';
  /** 工作频段 */
  bands: readonly ('2.4GHz' | '5GHz')[];
  /** 工作电压 (V) */
  vdd: number;
  /** 最大传输速率 (Mbps) */
  maxDataRate: number;
  /** 发射功率 (dBm) */
  txPower: number;
  /** 接收灵敏度 (dBm) */
  rssi: number;
  /** 工作距离 (m) */
  range: number;
  /** UART 接口 */
  hasUART: boolean;
  /** SPI 接口 */
  hasSPI: boolean;
  /** 工作电流 (mA) */
  activeCurrent: number;
  /** 休眠电流 (μA) */
  sleepCurrent: number;
  /** 模块型号 */
  model: string;
}

/** CAN 收发器参数 */
export interface CANTransceiverParams {
  /** 工作电压 (V) */
  vdd: number;
  /** CAN 数据速率 (kbps) */
  dataRate: number;
  /** 最大总线长度 (m) @ 最高速率 */
  maxBusLength: number;
  /** 总线节点数 */
  maxNodes: number;
  /** 差分输出电压 (V) */
  vDiff: number;
  /** 共模电压范围 (V) */
  vCMRange: { min: number; max: number };
  /** ESD 保护 (kV) */
  esdProtection: number;
  /** 型号 */
  model: string;
}

/** RS-485 收发器参数 */
export interface RS485TransceiverParams {
  /** 工作电压 (V) */
  vdd: number;
  /** 最大传输速率 (Mbps) */
  maxDataRate: number;
  /** 最大总线长度 (m) */
  maxBusLength: number;
  /** 最大节点数 */
  maxNodes: number;
  /** 差分输出电压 (V) */
  vDiff: number;
  /** 接收器灵敏度 (mV) */
  receiverSensitivity: number;
  /** 半双工/全双工 */
  duplex: 'half' | 'full';
  /** 摆率限制 */
  slewRateLimited: boolean;
  /** 型号 */
  model: string;
}

// ==================== 默认参数 ====================

/** 常见蓝牙模块 */
export const BLUETOOTH_MODELS: Record<string, BluetoothModuleParams> = {
  HC05: {
    version: '2.0' as const,
    protocols: ['Classic'] as ("BLE" | "Classic")[],
    vdd: 3.3,
    txPower: 4,
    rssi: -80,
    maxDataRate: 2100,
    range: 10,
    uartBaudRate: 9600,
    txCurrent: 40,
    rxCurrent: 20,
    sleepCurrent: 1000,
    model: 'HC-05',
  },
  HM10: {
    version: '4.0' as const,
    protocols: ['BLE'] as ("BLE" | "Classic")[],
    vdd: 3.3,
    txPower: 0,
    rssi: -90,
    maxDataRate: 100,
    range: 30,
    uartBaudRate: 9600,
    txCurrent: 8,
    rxCurrent: 6,
    sleepCurrent: 400,
    model: 'HM-10',
  },
  ESP32_BT: {
    version: '5.0',
    protocols: ['BLE', 'Classic'],
    vdd: 3.3,
    txPower: 9,
    rssi: -95,
    maxDataRate: 2000,
    range: 50,
    uartBaudRate: 115200,
    txCurrent: 130,
    rxCurrent: 95,
    sleepCurrent: 5,
    model: 'ESP32-BT',
  },
} as const;

/** 常见 WiFi 模块 */
export const WIFI_MODELS = {
  ESP8266: {
    standard: '802.11n',
    bands: ['2.4GHz'],
    vdd: 3.3,
    maxDataRate: 72,
    txPower: 20,
    rssi: -90,
    range: 50,
    hasUART: true,
    hasSPI: false,
    activeCurrent: 80,
    sleepCurrent: 20,
    model: 'ESP-01',
  },
  ESP32: {
    standard: '802.11n',
    bands: ['2.4GHz'],
    vdd: 3.3,
    maxDataRate: 150,
    txPower: 20,
    rssi: -97,
    range: 100,
    hasUART: true,
    hasSPI: true,
    activeCurrent: 160,
    sleepCurrent: 10,
    model: 'ESP32-WROOM',
  },
} as const;

/** CAN 收发器型号 */
export const CAN_MODELS = {
  MCP2551: {
    vdd: 5,
    dataRate: 1000,
    maxBusLength: 40,
    maxNodes: 110,
    vDiff: 2.0,
    vCMRange: { min: -2, max: 7 },
    esdProtection: 4,
    model: 'MCP2551',
  },
  SN65HVD230: {
    vdd: 3.3,
    dataRate: 1000,
    maxBusLength: 40,
    maxNodes: 120,
    vDiff: 1.5,
    vCMRange: { min: -2, max: 7 },
    esdProtection: 8,
    model: 'SN65HVD230',
  },
  TJA1050: {
    vdd: 5,
    dataRate: 1000,
    maxBusLength: 40,
    maxNodes: 110,
    vDiff: 2.0,
    vCMRange: { min: -2, max: 7 },
    esdProtection: 4,
    model: 'TJA1050',
  },
} as const;

/** RS-485 收发器型号 */
export const RS485_MODELS = {
  MAX485: {
    vdd: 5,
    maxDataRate: 2.5,
    maxBusLength: 1200,
    maxNodes: 32,
    vDiff: 1.5,
    receiverSensitivity: 200,
    duplex: 'half' as const,
    slewRateLimited: false,
    model: 'MAX485',
  },
  MAX3485: {
    vdd: 3.3,
    maxDataRate: 10,
    maxBusLength: 1200,
    maxNodes: 32,
    vDiff: 1.5,
    receiverSensitivity: 200,
    duplex: 'half' as const,
    slewRateLimited: false,
    model: 'MAX3485',
  },
  SP3485: {
    vdd: 3.3,
    maxDataRate: 10,
    maxBusLength: 1200,
    maxNodes: 32,
    vDiff: 1.5,
    receiverSensitivity: 200,
    duplex: 'half' as const,
    slewRateLimited: true,
    model: 'SP3485',
  },
} as const;

// ==================== 蓝牙模块行为模型 ====================

/** 蓝牙连接状态 */
export type BTConnectionState = 'idle' | 'advertising' | 'connected' | 'sleep';

/**
 * 蓝牙模块状态机
 */
export class BluetoothModuleModel {
  private params: BluetoothModuleParams;
  private state: BTConnectionState = 'idle';

  constructor(params: Partial<BluetoothModuleParams> = {}) {
    this.params = { ...BLUETOOTH_MODELS.HC05, ...params };
  }

  /** 获取当前状态 */
  getState(): BTConnectionState {
    return this.state;
  }

  /** 发送 AT 命令 */
  sendATCommand(command: string): string {
    if (command.startsWith('AT+')) {
      const cmd = command.slice(3);
      if (cmd === 'VERSION') return this.params.version;
      if (cmd === 'BAUD') return String(this.params.uartBaudRate);
      if (cmd === 'ROLE=0') return 'OK';
      if (cmd === 'ROLE=1') return 'OK';
      return 'OK';
    }
    return 'ERROR';
  }

  /** 获取当前功耗 (mW) */
  getPowerConsumption(): number {
    switch (this.state) {
      case 'idle': return this.params.vdd * this.params.sleepCurrent / 1000;
      case 'advertising': return this.params.vdd * this.params.txCurrent * 0.3;
      case 'connected': return this.params.vdd * this.params.rxCurrent;
      case 'sleep': return this.params.vdd * this.params.sleepCurrent / 1000;
    }
  }

  /** 连接 */
  connect(): void {
    this.state = 'connected';
  }

  /** 断开 */
  disconnect(): void {
    this.state = 'idle';
  }

  /** 进入休眠 */
  sleep(): void {
    this.state = 'sleep';
  }

  /** 唤醒 */
  wakeUp(): void {
    this.state = 'idle';
  }
}

// ==================== WiFi 模块行为模型 ====================

/** WiFi 连接状态 */
export type WiFiConnectionState = 'off' | 'idle' | 'connecting' | 'connected' | 'sleep';

/**
 * WiFi 模块状态机
 */
export class WiFiModuleModel {
  private params: WiFiModuleParams;
  private state: WiFiConnectionState = 'off';

  constructor(params: Partial<WiFiModuleParams> = {}) {
    this.params = { ...WIFI_MODELS.ESP8266, ...params };
  }

  getState(): WiFiConnectionState {
    return this.state;
  }

  /** 扫描网络 */
  scan(): string[] {
    // 模拟返回附近 AP 列表
    return ['HomeWiFi', 'Office_5G', 'IoT_Network'];
  }

  /** 连接 AP */
  connect(_ssid: string, _password: string): boolean {
    this.state = 'connecting';
    // 模拟连接成功
    setTimeout(() => { this.state = 'connected'; }, 100);
    return true;
  }

  /** 断开连接 */
  disconnect(): void {
    this.state = 'idle';
  }

  /** 获取功耗 (mW) */
  getPowerConsumption(): number {
    switch (this.state) {
      case 'off': return 0;
      case 'idle': return this.params.vdd * this.params.activeCurrent * 0.3;
      case 'connecting': return this.params.vdd * this.params.activeCurrent;
      case 'connected': return this.params.vdd * this.params.activeCurrent * 0.5;
      case 'sleep': return this.params.vdd * this.params.sleepCurrent / 1000;
    }
  }

  /** 获取信号强度 */
  getRSSI(): number {
    return -50 + Math.random() * 30; // -50 ~ -20 dBm
  }
}

// ==================== CAN 收发器模型 ====================

/**
 * CAN 总线差分电压计算
 *
 * 显性 (Dominant): CANH=3.5V, CANL=1.5V, Vdiff=2.0V
 * 隐性 (Recessive): CANH=2.5V, CANL=2.5V, Vdiff=0V
 *
 * @param dominant 是否为显性位
 * @param params CAN 参数
 * @returns { canH: number, canL: number, vDiff: number }
 */
export function canBusVoltage(
  dominant: boolean,
  params: CANTransceiverParams = CAN_MODELS.MCP2551
): { canH: number; canL: number; vDiff: number } {
  if (dominant) {
    return { canH: 3.5, canL: 1.5, vDiff: params.vDiff };
  }
  return { canH: 2.5, canL: 2.5, vDiff: 0 };
}

/**
 * CAN 最大传输距离与数据速率关系
 *
 * @param dataRate 数据速率 (kbps)
 * @param params CAN 参数
 * @returns 最大总线长度 (m)
 */
export function canMaxBusLength(
  dataRate: number,
  params: CANTransceiverParams = CAN_MODELS.MCP2551
): number {
  // 简化模型：距离与速率成反比
  const ratio = params.dataRate / dataRate;
  return Math.min(params.maxBusLength * Math.sqrt(ratio), 1000);
}

// ==================== RS-485 收发器模型 ====================

/**
 * RS-485 差分电压
 *
 * 逻辑 1 (Mark): A-B < -200mV
 * 逻辑 0 (Space): A-B > +200mV
 *
 * @param bitValue 逻辑值
 * @param params RS-485 参数
 * @returns { a: number, b: number, vDiff: number }
 */
export function rs485BusVoltage(
  bitValue: boolean,
  params: RS485TransceiverParams = RS485_MODELS.MAX485
): { a: number; b: number; vDiff: number } {
  if (bitValue) {
    return { a: 0, b: params.vDiff, vDiff: -params.vDiff };
  }
  return { a: params.vDiff, b: 0, vDiff: params.vDiff };
}

/**
 * RS-485 最大传输距离
 *
 * @param dataRate 数据速率 (kbps)
 * @param params RS-485 参数
 * @returns 最大总线长度 (m)
 */
export function rs485MaxBusLength(
  dataRate: number,
  params: RS485TransceiverParams = RS485_MODELS.MAX485
): number {
  // 100kbps 以下可达 1200m
  if (dataRate <= 100) return params.maxBusLength;
  const ratio = params.maxDataRate * 1000 / dataRate;
  return Math.min(params.maxBusLength * Math.sqrt(ratio), params.maxBusLength);
}

// ==================== EEPROM I2C 存储器 ====================

/** EEPROM I2C 参数 */
export interface EEPROMI2CParams {
  /** 存储容量 (字节) */
  capacity: number;
  /** I2C 从机地址 */
  i2cAddress: number;
  /** 页大小 (字节) */
  pageSize: number;
  /** 写入时间 (ms) */
  writeTime: number;
  /** 读取时间 (μs) */
  readTime: number;
  /** 最大擦写次数 */
  maxWriteCycles: number;
  /** 数据保持时间 (年) */
  dataRetention: number;
  /** 工作电压 (V) */
  vdd: { min: number; max: number; typical: number };
  /** 工作电流 - 读取 (mA) */
  readCurrent: number;
  /** 工作电流 - 写入 (mA) */
  writeCurrent: number;
  /** 待机电流 (μA) */
  standbyCurrent: number;
  /** I2C 最大时钟频率 (kHz) */
  maxClockFreq: number;
  /** 型号名称 */
  modelName: string;
}

/** 常见 EEPROM I2C 型号 */
export const EEPROM_I2C_MODELS: Record<string, EEPROMI2CParams> = {
  /** AT24C02 - 256 字节 */
  'AT24C02': {
    capacity: 256,
    i2cAddress: 0x50,
    pageSize: 8,
    writeTime: 5,
    readTime: 1,
    maxWriteCycles: 1000000,
    dataRetention: 100,
    vdd: { min: 1.8, max: 5.5, typical: 3.3 },
    readCurrent: 1,
    writeCurrent: 3,
    standbyCurrent: 6,
    maxClockFreq: 400,
    modelName: 'AT24C02',
  },
  /** AT24C32 - 4KB */
  'AT24C32': {
    capacity: 4096,
    i2cAddress: 0x50,
    pageSize: 32,
    writeTime: 10,
    readTime: 1,
    maxWriteCycles: 1000000,
    dataRetention: 100,
    vdd: { min: 1.8, max: 5.5, typical: 3.3 },
    readCurrent: 1,
    writeCurrent: 3,
    standbyCurrent: 6,
    maxClockFreq: 400,
    modelName: 'AT24C32',
  },
  /** AT24C256 - 32KB */
  'AT24C256': {
    capacity: 32768,
    i2cAddress: 0x50,
    pageSize: 64,
    writeTime: 10,
    readTime: 1,
    maxWriteCycles: 1000000,
    dataRetention: 100,
    vdd: { min: 1.8, max: 5.5, typical: 3.3 },
    readCurrent: 1,
    writeCurrent: 3,
    standbyCurrent: 6,
    maxClockFreq: 400,
    modelName: 'AT24C256',
  },
};

/** 默认 EEPROM I2C 参数 */
export const DEFAULT_EEPROM_I2C_PARAMS: EEPROMI2CParams = EEPROM_I2C_MODELS['AT24C02'];

/**
 * EEPROM I2C 读取地址计算
 *
 * 设备地址格式：[1010][A2][A1][A0][R/W]
 *
 * @param deviceAddress 设备地址 (0-7)
 * @param params EEPROM 参数
 * @returns 完整 I2C 地址
 */
export function eepromI2CReadAddress(
  deviceAddress: number,
  params: EEPROMI2CParams = DEFAULT_EEPROM_I2C_PARAMS
): number {
  return (params.i2cAddress & 0xF8) | (deviceAddress & 0x07);
}

/**
 * EEPROM I2C 写入地址计算
 *
 * @param deviceAddress 设备地址 (0-7)
 * @param params EEPROM 参数
 * @returns 完整 I2C 地址（写入模式）
 */
export function eepromI2CWriteAddress(
  deviceAddress: number,
  params: EEPROMI2CParams = DEFAULT_EEPROM_I2C_PARAMS
): number {
  return ((params.i2cAddress & 0xF8) | (deviceAddress & 0x07)) & 0xFE;
}

/**
 * EEPROM 页写入边界检查
 *
 * @param startAddr 起始地址
 * @param dataLength 数据长度
 * @param params EEPROM 参数
 * @returns 是否跨页
 */
export function eepromPageBoundaryCross(
  startAddr: number,
  dataLength: number,
  params: EEPROMI2CParams = DEFAULT_EEPROM_I2C_PARAMS
): boolean {
  const endPage = (startAddr + dataLength - 1) >> Math.log2(params.pageSize);
  const startPage = startAddr >> Math.log2(params.pageSize);
  return endPage !== startPage;
}

/**
 * EEPROM 写入总时间估算
 *
 * @param dataLength 数据长度 (字节)
 * @param params EEPROM 参数
 * @returns 写入总时间 (ms)
 */
export function eepromWriteTime(
  dataLength: number,
  params: EEPROMI2CParams = DEFAULT_EEPROM_I2C_PARAMS
): number {
  const pageCount = Math.ceil(dataLength / params.pageSize);
  return pageCount * params.writeTime;
}

/**
 * EEPROM 地址宽度（字节数）
 *
 * @param params EEPROM 参数
 * @returns 地址宽度 (字节)
 */
export function eepromAddressWidth(params: EEPROMI2CParams = DEFAULT_EEPROM_I2C_PARAMS): number {
  // 256 字节以下用 1 字节地址，否则用 2 字节
  return params.capacity <= 256 ? 1 : 2;
}

// ==================== GSM/GPRS 模块 ====================

/** GSM/GPRS 模块参数 */
export interface GSMModuleParams {
  /** 支持频段 */
  bands: string[];
  /** 工作电压范围 */
  voltageRange: { min: number; max: number };
  /** GPRS 等级 */
  gprsClass: string;
  /** 数据速率 (kbps) 下行 */
  dataRateDownlink: number;
  /** 数据速率 (kbps) 上行 */
  dataRateUplink: number;
  /** UART 波特率范围 */
  baudRate: { min: number; max: number; default: number };
  /** 休眠电流 (mA) */
  sleepCurrent: number;
  /** 待机电流 (mA) */
  standbyCurrent: number;
  /** 通话电流 (mA) */
  talkCurrent: number;
  /** 发射峰值电流 (mA) */
  txPeakCurrent: number;
  /** 发射功率 (dBm) */
  txPower: number;
  /** 接收灵敏度 (dBm) */
  sensitivity: number;
  /** SIM 卡接口电压 */
  simVoltage: string;
  /** 内置 TCP/IP 协议栈 */
  hasTCPIP: boolean;
  /** 支持蓝牙 */
  hasBluetooth: boolean;
  /** 支持 FM 收音 */
  hasFM: boolean;
  /** 工作温度范围 */
  tempRange: { min: number; max: number };
  /** 模块型号 */
  model: string;
}

/** 常见 GSM/GPRS 模块型号 */
export const GSM_MODULE_MODELS: Record<string, GSMModuleParams> = {
  /** SIM800L - 超小体积四频 GSM/GPRS 模块
   *  基于 SIM800 datasheet (SIMCom)
   *  工作电压: 3.4V-4.4V (典型 4.0V)
   *  UART: 1200-115200bps, 默认 9600bps
   *  峰值电流 2A (TDMA 脉冲)
   */
  'SIM800L': {
    bands: ['850', '900', '1800', '1900'],
    voltageRange: { min: 3.4, max: 4.4 },
    gprsClass: '12',
    dataRateDownlink: 85.6,
    dataRateUplink: 85.6,
    baudRate: { min: 1200, max: 115200, default: 9600 },
    sleepCurrent: 0.7,
    standbyCurrent: 18,
    talkCurrent: 200,
    txPeakCurrent: 2000,
    txPower: 33, // GSM900: 2W (33dBm), DCS1800: 1W (30dBm)
    sensitivity: -107,
    simVoltage: '1.8V/3V',
    hasTCPIP: true,
    hasBluetooth: false,
    hasFM: false,
    tempRange: { min: -40, max: 85 },
    model: 'SIM800L',
  },
  /** SIM800C - 四频 GSM/GPRS 模块, 带蓝牙和 FM
   *  基于 SIM800C datasheet (SIMCom)
   *  工作电压: 3.4V-4.4V
   */
  'SIM800C': {
    bands: ['850', '900', '1800', '1900'],
    voltageRange: { min: 3.4, max: 4.4 },
    gprsClass: '12',
    dataRateDownlink: 85.6,
    dataRateUplink: 85.6,
    baudRate: { min: 1200, max: 115200, default: 9600 },
    sleepCurrent: 1.0,
    standbyCurrent: 18,
    talkCurrent: 200,
    txPeakCurrent: 2000,
    txPower: 33,
    sensitivity: -107,
    simVoltage: '1.8V/3V',
    hasTCPIP: true,
    hasBluetooth: true,
    hasFM: true,
    tempRange: { min: -40, max: 85 },
    model: 'SIM800C',
  },
  /** SIM800A - 双频 GSM/GPRS 模块 (900/1800MHz)
   *  基于 SIM800 datasheet
   */
  'SIM800A': {
    bands: ['900', '1800'],
    voltageRange: { min: 3.4, max: 4.4 },
    gprsClass: '10',
    dataRateDownlink: 85.6,
    dataRateUplink: 42.8,
    baudRate: { min: 1200, max: 115200, default: 9600 },
    sleepCurrent: 0.7,
    standbyCurrent: 18,
    talkCurrent: 200,
    txPeakCurrent: 2000,
    txPower: 33,
    sensitivity: -107,
    simVoltage: '1.8V/3V',
    hasTCPIP: true,
    hasBluetooth: false,
    hasFM: false,
    tempRange: { min: -20, max: 70 },
    model: 'SIM800A',
  },
  /** A6 - 低成本 GSM/GPRS 模块
   *  基于 Ai-Thinker A6 datasheet
   *  工作电压: 3.3V-4.2V
   */
  'A6_GSM': {
    bands: ['850', '900', '1800', '1900'],
    voltageRange: { min: 3.3, max: 4.2 },
    gprsClass: '12',
    dataRateDownlink: 85.6,
    dataRateUplink: 42.8,
    baudRate: { min: 1200, max: 115200, default: 115200 },
    sleepCurrent: 0.5,
    standbyCurrent: 15,
    talkCurrent: 180,
    txPeakCurrent: 1800,
    txPower: 33,
    sensitivity: -106,
    simVoltage: '1.8V/3V',
    hasTCPIP: true,
    hasBluetooth: false,
    hasFM: false,
    tempRange: { min: -20, max: 70 },
    model: 'A6',
  },
  /** A7 - GSM/GPRS + GPS 模块
   *  基于 Ai-Thinker A7 datasheet
   */
  'A7_GSM_GPS': {
    bands: ['850', '900', '1800', '1900'],
    voltageRange: { min: 3.3, max: 4.2 },
    gprsClass: '12',
    dataRateDownlink: 85.6,
    dataRateUplink: 42.8,
    baudRate: { min: 1200, max: 115200, default: 115200 },
    sleepCurrent: 1.0,
    standbyCurrent: 20,
    talkCurrent: 200,
    txPeakCurrent: 2000,
    txPower: 33,
    sensitivity: -106,
    simVoltage: '1.8V/3V',
    hasTCPIP: true,
    hasBluetooth: false,
    hasFM: false,
    tempRange: { min: -20, max: 70 },
    model: 'A7',
  },
  /** SIM900A - 经典双频 GSM 模块
   *  基于 SIM900 datasheet (SIMCom)
   *  900/1800MHz 双频
   */
  'SIM900A': {
    bands: ['900', '1800'],
    voltageRange: { min: 3.2, max: 4.8 },
    gprsClass: '10',
    dataRateDownlink: 85.6,
    dataRateUplink: 42.8,
    baudRate: { min: 1200, max: 115200, default: 9600 },
    sleepCurrent: 1.5,
    standbyCurrent: 25,
    talkCurrent: 250,
    txPeakCurrent: 2000,
    txPower: 33,
    sensitivity: -107,
    simVoltage: '1.8V/3V',
    hasTCPIP: true,
    hasBluetooth: false,
    hasFM: false,
    tempRange: { min: -20, max: 70 },
    model: 'SIM900A',
  },
};

/** GSM 模块功耗估算 */
export function gsmModulePower(voltage: number, state: 'sleep' | 'standby' | 'talk' | 'tx_peak', params: GSMModuleParams = GSM_MODULE_MODELS['SIM800L']): number {
  const currents: Record<string, number> = {
    sleep: params.sleepCurrent,
    standby: params.standbyCurrent,
    talk: params.talkCurrent,
    tx_peak: params.txPeakCurrent,
  };
  return voltage * (currents[state] || params.standbyCurrent) / 1000; // W
}

/** GSM 模块是否在有效工作电压范围 */
export function gsmVoltageValid(voltage: number, params: GSMModuleParams = GSM_MODULE_MODELS['SIM800L']): boolean {
  return voltage >= params.voltageRange.min && voltage <= params.voltageRange.max;
}

// ==================== 扩展通信模块（UART、SPI、I2C、LoRa、NRF24、ZigBee、NFC） ====================

export type { UARTModuleParams, SPIDeviceParams, I2CDeviceParams, LoRaModuleParams, NRF24Params, ZigBeeParams, NFCModuleParams } from './comm-extended';
export {
  UART_MODULE_MODELS,
  SPI_DEVICE_MODELS,
  I2C_DEVICE_MODELS,
  LORA_MODULE_MODELS,
  loraDataRate,
  loraLinkBudget,
  NRF24_MODULE_MODELS,
  nrf24TransferTime,
  ZIGBEE_MODULE_MODELS,
  NFC_MODULE_MODELS,
} from './comm-extended';
