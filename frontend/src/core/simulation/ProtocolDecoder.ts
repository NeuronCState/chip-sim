/**
 * ProtocolDecoder — 协议解码器
 *
 * 解析 GPIO/UART/I2C/SPI 信号，生成人类可读的命令描述
 */

// ==================== 协议类型 ====================

/** 支持的协议类型 */
export type ProtocolType = 'gpio' | 'uart' | 'i2c' | 'spi';

/** GPIO 解码结果 */
export interface GPIODecodeResult {
  type: 'gpio';
  pinName: string;
  fromState: string;
  toState: string;
  duration?: number; // 持续时间 (ms)
  description: string;
}

/** UART 解码结果 */
export interface UARTDecodeResult {
  type: 'uart';
  pinName: string;
  direction: 'tx' | 'rx';
  bytes: number[];
  asciiText: string;
  isValidAscii: boolean;
  description: string;
}

/** I2C 解码结果 */
export interface I2CDecodeResult {
  type: 'i2c';
  startCondition: boolean;
  stopCondition: boolean;
  address: number | null;
  readWrite: 'read' | 'write' | null;
  ack: boolean | null;
  data: number[];
  description: string;
}

/** SPI 解码结果 */
export interface SPIDecodeResult {
  type: 'spi';
  mosiData: number[];
  misoData: number[];
  clockEdges: number;
  description: string;
}

/** 通用解码结果 */
export type DecodeResult = GPIODecodeResult | UARTDecodeResult | I2CDecodeResult | SPIDecodeResult;

// ==================== GPIO 解码器 ====================

/**
 * 解码 GPIO 信号变化
 *
 * @param pinName 引脚名称（如 PA5）
 * @param fromState 前一个状态（high/low/floating）
 * @param toState 新状态
 * @param duration 持续时间 (ms)，可选
 * @returns 解码结果
 */
export function decodeGPIO(
  pinName: string,
  fromState: string,
  toState: string,
  duration?: number,
): GPIODecodeResult {
  let description = `${pinName}: ${fromState.toUpperCase()} -> ${toState.toUpperCase()}`;

  if (duration !== undefined) {
    description += ` (${formatDuration(duration)})`;
  }

  // 检测边沿类型
  if (fromState === 'low' && toState === 'high') {
    description = `${pinName}: 上升沿`;
    if (duration !== undefined) {
      description += ` (${formatDuration(duration)})`;
    }
  } else if (fromState === 'high' && toState === 'low') {
    description = `${pinName}: 下降沿`;
    if (duration !== undefined) {
      description += ` (${formatDuration(duration)})`;
    }
  }

  return {
    type: 'gpio',
    pinName,
    fromState,
    toState,
    duration,
    description,
  };
}

// ==================== UART 解码器 ====================

/**
 * 解码 UART 字节流
 *
 * @param bytes 接收到的字节数组
 * @param pinName 引脚名称
 * @param direction 传输方向
 * @returns 解码结果
 */
export function decodeUART(
  bytes: number[],
  pinName: string = 'UART',
  direction: 'tx' | 'rx' = 'tx',
): UARTDecodeResult {
  // 尝试转换为 ASCII
  const asciiChars: string[] = [];
  let isValidAscii = true;

  for (const byte of bytes) {
    if (byte >= 32 && byte <= 126) {
      // 可打印 ASCII 字符
      asciiChars.push(String.fromCharCode(byte));
    } else if (byte === 10 || byte === 13) {
      // 换行符
      asciiChars.push(byte === 10 ? '\\n' : '\\r');
    } else if (byte === 9) {
      // Tab
      asciiChars.push('\\t');
    } else if (byte === 0) {
      asciiChars.push('\\0');
    } else {
      // 非 ASCII 字符
      asciiChars.push(`0x${byte.toString(16).padStart(2, '0').toUpperCase()}`);
      isValidAscii = false;
    }
  }

  const asciiText = asciiChars.join('');
  const directionLabel = direction === 'tx' ? '发送' : '接收';
  const byteHex = bytes.map(b => `0x${b.toString(16).padStart(2, '0').toUpperCase()}`).join(' ');

  let description: string;
  if (isValidAscii && bytes.length > 0) {
    // 尝试找出连续的文本
    const textBytes = bytes.filter(b => b >= 32 && b <= 126);
    if (textBytes.length >= 3) {
      const text = String.fromCharCode(...textBytes);
      description = `${directionLabel}: "${text}"`;
    } else {
      description = `${directionLabel}: ${byteHex}`;
    }
  } else {
    description = `${directionLabel}: ${byteHex}`;
  }

  return {
    type: 'uart',
    pinName,
    direction,
    bytes,
    asciiText,
    isValidAscii,
    description,
  };
}

/**
 * 从字节流中提取 UART 消息
 * 尝试识别完整的文本消息（以 \n 或 \r 结尾）
 */
export function extractUARTMessages(
  bytes: number[],
  pinName: string = 'UART',
  direction: 'tx' | 'rx' = 'tx',
): UARTDecodeResult[] {
  const messages: UARTDecodeResult[] = [];
  let currentMessage: number[] = [];

  for (const byte of bytes) {
    if (byte === 10 || byte === 13) {
      // 换行符，结束当前消息
      if (currentMessage.length > 0) {
        messages.push(decodeUART(currentMessage, pinName, direction));
        currentMessage = [];
      }
    } else {
      currentMessage.push(byte);
    }
  }

  // 处理末尾未完成的消息
  if (currentMessage.length > 0) {
    messages.push(decodeUART(currentMessage, pinName, direction));
  }

  return messages;
}

// ==================== I2C 解码器 ====================

/** I2C 信号状态 */
export interface I2CSignal {
  timestamp: number;
  sda: boolean; // SDA 线状态
  scl: boolean; // SCL 线状态
}

/**
 * 解码 I2C 信号序列
 *
 * @param signals 信号序列（SDA 和 SCL 状态）
 * @returns 解码结果
 */
export function decodeI2C(signals: I2CSignal[]): I2CDecodeResult {
  let startCondition = false;
  let stopCondition = false;
  let address: number | null = null;
  let readWrite: 'read' | 'write' | null = null;
  let ack: boolean | null = null;
  const data: number[] = [];

  // 简化的 I2C 解码：检测 START/STOP 条件
  for (let i = 1; i < signals.length; i++) {
    const prev = signals[i - 1];
    const curr = signals[i];

    // START 条件：SCL 为高时，SDA 从高到低
    if (prev.scl && prev.sda && curr.scl && !curr.sda) {
      startCondition = true;
    }

    // STOP 条件：SCL 为高时，SDA 从低到高
    if (prev.scl && !prev.sda && curr.scl && curr.sda) {
      stopCondition = true;
    }
  }

  // 构建描述
  const parts: string[] = [];

  if (startCondition) {
    parts.push('START');
  }

  if (address !== null) {
    const addrHex = `0x${address.toString(16).padStart(2, '0').toUpperCase()}`;
    const rw = readWrite === 'read' ? 'R' : 'W';
    parts.push(`${addrHex}(${rw})`);
  }

  if (ack !== null) {
    parts.push(ack ? 'ACK' : 'NAK');
  }

  if (data.length > 0) {
    const dataHex = data.map(d => `0x${d.toString(16).padStart(2, '0').toUpperCase()}`);
    parts.push(`DATA[${dataHex.join(', ')}]`);
  }

  if (stopCondition) {
    parts.push('STOP');
  }

  const description = parts.length > 0 ? parts.join(' -> ') : 'I2C: 空闲';

  return {
    type: 'i2c',
    startCondition,
    stopCondition,
    address,
    readWrite,
    ack,
    data,
    description,
  };
}

/**
 * 解析单个 I2C 字节
 *
 * @param bits 8 个位的状态
 * @returns 字节值
 */
export function parseI2CByte(bits: boolean[]): number {
  let value = 0;
  for (let i = 0; i < 8; i++) {
    if (bits[i]) {
      value |= (1 << (7 - i));
    }
  }
  return value;
}

// ==================== SPI 解码器 ====================

/** SPI 信号状态 */
export interface SPISignal {
  timestamp: number;
  mosi: boolean;
  miso: boolean;
  sck: boolean;
  cs: boolean;
}

/**
 * 解码 SPI 信号序列
 *
 * @param signals 信号序列
 * @param cpol 时钟极性（0 或 1）
 * @param cpha 时钟相位（0 或 1）
 * @returns 解码结果
 */
export function decodeSPI(
  signals: SPISignal[],
  cpol: number = 0,
  cpha: number = 0,
): SPIDecodeResult {
  const mosiData: number[] = [];
  const misoData: number[] = [];
  let clockEdges = 0;

  let currentMosiByte = 0;
  let currentMisoByte = 0;
  let bitCount = 0;
  let lastClock = cpol === 1;

  for (const signal of signals) {
    // 检测时钟边沿
    const isRisingEdge = !lastClock && signal.sck;
    const isFallingEdge = lastClock && !signal.sck;

    const isSamplingEdge = (cpol === 0 && cpha === 0 && isRisingEdge) ||
                          (cpol === 0 && cpha === 1 && isFallingEdge) ||
                          (cpol === 1 && cpha === 0 && isFallingEdge) ||
                          (cpol === 1 && cpha === 1 && isRisingEdge);

    if (isSamplingEdge) {
      clockEdges++;

      // 采样数据线
      currentMosiByte = (currentMosiByte << 1) | (signal.mosi ? 1 : 0);
      currentMisoByte = (currentMisoByte << 1) | (signal.miso ? 1 : 0);
      bitCount++;

      // 每 8 位组成一个字节
      if (bitCount === 8) {
        mosiData.push(currentMosiByte);
        misoData.push(currentMisoByte);
        currentMosiByte = 0;
        currentMisoByte = 0;
        bitCount = 0;
      }
    }

    lastClock = signal.sck;
  }

  // 处理未完成的字节
  if (bitCount > 0) {
    mosiData.push(currentMosiByte);
    misoData.push(currentMisoByte);
  }

  // 构建描述
  const mosiHex = mosiData.map(b => `0x${b.toString(16).padStart(2, '0').toUpperCase()}`);
  const misoHex = misoData.map(b => `0x${b.toString(16).padStart(2, '0').toUpperCase()}`);

  let description: string;
  if (mosiData.length === 0) {
    description = 'SPI: 空闲';
  } else {
    description = `MOSI: ${mosiHex.join(' -> ')} | MISO: ${misoHex.join(' -> ')}`;
  }

  return {
    type: 'spi',
    mosiData,
    misoData,
    clockEdges,
    description,
  };
}

/**
 * 解析 SPI 事务（从 CS 低电平到高电平）
 *
 * @param signals 信号序列
 * @param cpol 时钟极性
 * @param cpha 时钟相位
 * @returns 解码结果
 */
export function decodeSPITransaction(
  signals: SPISignal[],
  cpol: number = 0,
  cpha: number = 0,
): SPIDecodeResult {
  // 过滤 CS 为低的信号
  const transactionSignals = signals.filter(s => !s.cs);

  if (transactionSignals.length === 0) {
    return {
      type: 'spi',
      mosiData: [],
      misoData: [],
      clockEdges: 0,
      description: 'SPI: 无事务',
    };
  }

  return decodeSPI(transactionSignals, cpol, cpha);
}

// ==================== 工具函数 ====================

/**
 * 格式化持续时间
 */
function formatDuration(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(1)}us`;
  } else if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  } else {
    return `${(ms / 1000).toFixed(2)}s`;
  }
}

/**
 * 检测信号协议类型
 * 基于引脚名称和模式推断协议
 *
 * @param pinName 引脚名称
 * @param mode 引脚模式
 * @returns 推断的协议类型
 */
export function detectProtocol(pinName: string, mode?: string): ProtocolType {
  const nameLower = pinName.toLowerCase();

  // UART
  if (nameLower.includes('tx') || nameLower.includes('rx') ||
      nameLower.includes('uart') || nameLower.includes('serial')) {
    return 'uart';
  }

  // I2C
  if (nameLower.includes('sda') || nameLower.includes('scl') ||
      nameLower.includes('i2c')) {
    return 'i2c';
  }

  // SPI
  if (nameLower.includes('mosi') || nameLower.includes('miso') ||
      nameLower.includes('sck') || nameLower.includes('spi')) {
    return 'spi';
  }

  // 检查模式
  if (mode) {
    const modeLower = mode.toLowerCase();
    if (modeLower.includes('uart')) return 'uart';
    if (modeLower.includes('i2c')) return 'i2c';
    if (modeLower.includes('spi')) return 'spi';
  }

  // 默认 GPIO
  return 'gpio';
}

/**
 * 十六进制字符串转字节数组
 */
export function hexToBytes(hex: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.substring(i, i + 2), 16);
    if (!isNaN(byte)) {
      bytes.push(byte);
    }
  }
  return bytes;
}

/**
 * 字节数组转十六进制字符串
 */
export function bytesToHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

/**
 * 字节数组转 ASCII 字符串
 */
export function bytesToAscii(bytes: number[]): string {
  return bytes
    .filter(b => b >= 32 && b <= 126)
    .map(b => String.fromCharCode(b))
    .join('');
}

/**
 * ASCII 字符串转字节数组
 */
export function asciiToBytes(text: string): number[] {
  return text.split('').map(c => c.charCodeAt(0));
}
