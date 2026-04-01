/**
 * WebGLCanvas 辅助模块
 * 从 WebGLCanvas.tsx 提取：类型、常量、工具函数、电路模板
 */

import type { CSSProperties } from 'react';
import type { SelectedElement } from '../canvas/interaction';
import { DEFAULT_SIM_STATE, type ComponentSimState } from '../core/simulation';

// ==================== 类型 ====================

export interface Pin {
  id: string;
  name: string;
  side: 'left' | 'right';
  index: number;
  x: number; y: number;
  connected: boolean;
  /** 引脚电平状态 */
  level: 'high' | 'low' | 'floating';
}

export interface CanvasComponent {
  id: string; type: string; name: string;
  x: number; y: number; w: number; h: number;
  rotation: number; selected: boolean;
  pins: { id: string; name: string; offsetX: number; offsetY: number; connected: boolean; level: 'high' | 'low' | 'floating' }[];
  /** 仿真状态 */
  simState: ComponentSimState;
}

export interface Wire {
  id: string;
  from: { componentId: string; pinId: string };
  to: { componentId: string; pinId: string };
  selected: boolean;
  /** 线上电流（正值=正方向） */
  current: number;
}

export interface ViewTransform { scale: number; ox: number; oy: number; }

export interface Props {
  chipFamily: string;
  chipModel: string;
  onSelect: (el: SelectedElement | null) => void;
  /** 加载电路模板的回调，传入 templateId 触发加载 */
  loadTemplateId?: string | null;
}

// ==================== 常量 ====================

export const GRID = 20;
export const CHIP_PINS_COUNT: Record<string, number> = { C51: 40, STM32: 48, ESP32: 38 };

/** 默认仿真状态 — 使用引擎导出的常量 */
export const DEFAULT_SIM_STATE_: ComponentSimState = DEFAULT_SIM_STATE;

// ==================== 元件模板 ====================

/** 为未知元件类型生成默认引脚 */
export function getDefaultPins(type: string): { id: string; name: string; ox: number; oy: number }[] {
  const twoPinTypes = ['zener', 'voltage_ref', 'ptc', 'ntc', 'thermistor', 'ldr', 'photodiode', 'piezo', 'buzzer', 'battery', 'ldo'];
  const twoPinLRTypes = ['inductor', 'ferrite', 'resistor'];
  if (twoPinLRTypes.some(t => type.includes(t))) {
    return [
      { id: 'a', name: 'A', ox: -30, oy: 0 },
      { id: 'b', name: 'B', ox: 30, oy: 0 },
    ];
  }
  if (twoPinTypes.some(t => type.includes(t))) {
    return [
      { id: 'a', name: 'A', ox: -10, oy: 18 },
      { id: 'b', name: 'B', ox: 10, oy: 18 },
    ];
  }
  const threePinTypes = ['bjt', 'mosfet', 'jfet', 'igbt', 'darlington', 'regulator', '7805', '7812'];
  if (threePinTypes.some(t => type.includes(t))) {
    return [
      { id: '1', name: '1', ox: -28, oy: -12 },
      { id: '2', name: '2', ox: 0, oy: 24 },
      { id: '3', name: '3', ox: 28, oy: -12 },
    ];
  }
  const fourPinTypes = ['optocoupler', 'bridge', 'h-bridge', 'comparator', 'opamp', 'op_amp'];
  if (fourPinTypes.some(t => type.includes(t))) {
    return [
      { id: '1', name: '1', ox: -28, oy: -12 },
      { id: '2', name: '2', ox: -28, oy: 12 },
      { id: '3', name: '3', ox: 28, oy: -12 },
      { id: '4', name: '4', ox: 28, oy: 12 },
    ];
  }
  return [
    { id: '1', name: '1', ox: -28, oy: -18 },
    { id: '2', name: '2', ox: -28, oy: -6 },
    { id: '3', name: '3', ox: -28, oy: 6 },
    { id: '4', name: '4', ox: -28, oy: 18 },
    { id: '5', name: '5', ox: 28, oy: 18 },
    { id: '6', name: '6', ox: 28, oy: 6 },
    { id: '7', name: '7', ox: 28, oy: -6 },
    { id: '8', name: '8', ox: 28, oy: -18 },
  ];
}

export const COMPONENT_TEMPLATES: Record<string, { w: number; h: number; pins: { id: string; name: string; ox: number; oy: number }[] }> = {
  led:      { w: 32, h: 24, pins: [{ id: 'anode', name: '+', ox: -10, oy: 18 }, { id: 'cathode', name: '-', ox: 10, oy: 18 }] },
  diode:    { w: 32, h: 24, pins: [{ id: 'anode', name: 'A', ox: -10, oy: 18 }, { id: 'cathode', name: 'K', ox: 10, oy: 18 }] },
  button:   { w: 32, h: 24, pins: [{ id: 'a', name: 'A', ox: -10, oy: 18 }, { id: 'b', name: 'B', ox: 10, oy: 18 }] },
  switch:   { w: 32, h: 24, pins: [{ id: 'a', name: 'A', ox: -10, oy: 18 }, { id: 'b', name: 'B', ox: 10, oy: 18 }] },
  resistor: { w: 60, h: 16, pins: [{ id: 'a', name: 'A', ox: -30, oy: 0 }, { id: 'b', name: 'B', ox: 30, oy: 0 }] },
  capacitor:{ w: 40, h: 16, pins: [{ id: 'a', name: 'A', ox: -28, oy: 0 }, { id: 'b', name: 'B', ox: 28, oy: 0 }] },
  buzzer_active:   { w: 32, h: 24, pins: [{ id: 'positive', name: '+', ox: -10, oy: 18 }, { id: 'negative', name: '-', ox: 10, oy: 18 }] },
  buzzer_passive:  { w: 32, h: 24, pins: [{ id: 'positive', name: '+', ox: -10, oy: 18 }, { id: 'negative', name: '-', ox: 10, oy: 18 }] },
  crystal:  { w: 40, h: 20, pins: [{ id: 'a', name: '1', ox: -30, oy: 0 }, { id: 'b', name: '2', ox: 30, oy: 0 }] },
  inductor: { w: 50, h: 16, pins: [{ id: 'a', name: 'A', ox: -30, oy: 0 }, { id: 'b', name: 'B', ox: 30, oy: 0 }] },
  ferrite_bead: { w: 40, h: 16, pins: [{ id: 'a', name: 'A', ox: -30, oy: 0 }, { id: 'b', name: 'B', ox: 30, oy: 0 }] },
  sensor:   { w: 36, h: 36, pins: [{ id: 'vcc', name: 'VCC', ox: 0, oy: -24 }, { id: 'gnd', name: 'GND', ox: 0, oy: 24 }, { id: 'data', name: 'DATA', ox: 24, oy: 0 }] },
  display:  { w: 48, h: 32, pins: [{ id: 'vcc', name: 'VCC', ox: -30, oy: -10 }, { id: 'gnd', name: 'GND', ox: -30, oy: 10 }, { id: 'sda', name: 'SDA', ox: 30, oy: -10 }, { id: 'scl', name: 'SCL', ox: 30, oy: 10 }] },
  lcd_display:     { w: 56, h: 32, pins: [{ id: 'vcc', name: 'VCC', ox: -34, oy: -10 }, { id: 'gnd', name: 'GND', ox: -34, oy: 10 }, { id: 'sda', name: 'SDA', ox: 34, oy: -10 }, { id: 'scl', name: 'SCL', ox: 34, oy: 10 }] },
  oled_display:    { w: 192, h: 128, pins: [{ id: 'vcc', name: 'VCC', ox: -100, oy: -40 }, { id: 'gnd', name: 'GND', ox: -100, oy: 40 }, { id: 'sda', name: 'SDA', ox: 100, oy: -40 }, { id: 'scl', name: 'SCL', ox: 100, oy: 40 }] },
  motor:    { w: 36, h: 36, pins: [{ id: 'positive', name: '+', ox: 0, oy: -24 }, { id: 'negative', name: '-', ox: 0, oy: 24 }] },
  dc_motor: { w: 36, h: 36, pins: [{ id: 'positive', name: '+', ox: 0, oy: -24 }, { id: 'negative', name: '-', ox: 0, oy: 24 }] },
  stepper_motor:   { w: 40, h: 40, pins: [{ id: 'a1', name: 'A1', ox: -28, oy: -12 }, { id: 'a2', name: 'A2', ox: -28, oy: 12 }, { id: 'b1', name: 'B1', ox: 28, oy: -12 }, { id: 'b2', name: 'B2', ox: 28, oy: 12 }] },
  servo_motor:     { w: 36, h: 36, pins: [{ id: 'signal', name: 'SIG', ox: 0, oy: -24 }, { id: 'vcc', name: 'VCC', ox: -24, oy: 0 }, { id: 'gnd', name: 'GND', ox: 24, oy: 0 }] },
  relay:    { w: 36, h: 36, pins: [{ id: 'coil_a', name: 'COIL+', ox: -24, oy: -10 }, { id: 'coil_b', name: 'COIL-', ox: -24, oy: 10 }, { id: 'no', name: 'NO', ox: 24, oy: -10 }, { id: 'com', name: 'COM', ox: 24, oy: 10 }] },
  ir_receiver:     { w: 32, h: 32, pins: [{ id: 'vcc', name: 'VCC', ox: 0, oy: -20 }, { id: 'gnd', name: 'GND', ox: 0, oy: 20 }, { id: 'out', name: 'OUT', ox: 20, oy: 0 }] },
  potentiometer:   { w: 40, h: 24, pins: [{ id: 'a', name: 'A', ox: -28, oy: 0 }, { id: 'wiper', name: 'W', ox: 0, oy: -20 }, { id: 'b', name: 'B', ox: 28, oy: 0 }] },
  ground:  { w: 24, h: 20, pins: [{ id: 'gnd', name: 'GND', ox: 0, oy: -14 }] },
  battery: { w: 36, h: 24, pins: [{ id: 'vcc', name: 'VCC', ox: 0, oy: -22 }, { id: 'gnd', name: 'GND', ox: 0, oy: 22 }] },
  power:    { w: 32, h: 32, pins: [{ id: 'positive', name: '+', ox: 0, oy: -20 }, { id: 'negative', name: '-', ox: 0, oy: 20 }] },
  pin_header:      { w: 20, h: 20, pins: [{ id: 'pin', name: 'PIN', ox: 0, oy: 0 }] },
  ntc_thermistor:  { w: 40, h: 28, pins: [{ id: 'vcc', name: 'VCC', ox: 0, oy: -20 }, { id: 'gnd', name: 'GND', ox: 0, oy: 20 }, { id: 'data', name: 'DATA', ox: 24, oy: 0 }] },
  ptc_thermistor:  { w: 40, h: 28, pins: [{ id: 'vcc', name: 'VCC', ox: 0, oy: -20 }, { id: 'gnd', name: 'GND', ox: 0, oy: 20 }, { id: 'data', name: 'DATA', ox: 24, oy: 0 }] },
  ds18b20:         { w: 36, h: 28, pins: [{ id: 'vcc', name: 'VCC', ox: 0, oy: -20 }, { id: 'gnd', name: 'GND', ox: 0, oy: 20 }, { id: 'data', name: 'DATA', ox: 24, oy: 0 }] },
  ldr:             { w: 40, h: 24, pins: [{ id: 'a', name: 'A', ox: -24, oy: 0 }, { id: 'b', name: 'B', ox: 24, oy: 0 }] },
  photodiode:      { w: 32, h: 24, pins: [{ id: 'anode', name: 'A', ox: -10, oy: 18 }, { id: 'cathode', name: 'K', ox: 10, oy: 18 }] },
  piezo_sensor:    { w: 32, h: 24, pins: [{ id: 'positive', name: '+', ox: -10, oy: 18 }, { id: 'negative', name: '-', ox: 10, oy: 18 }] },
  accelerometer:   { w: 36, h: 28, pins: [{ id: 'vcc', name: 'VCC', ox: 0, oy: -20 }, { id: 'gnd', name: 'GND', ox: 0, oy: 20 }, { id: 'sda', name: 'SDA', ox: 24, oy: -8 }, { id: 'scl', name: 'SCL', ox: 24, oy: 8 }] },
  gyroscope:       { w: 36, h: 28, pins: [{ id: 'vcc', name: 'VCC', ox: 0, oy: -20 }, { id: 'gnd', name: 'GND', ox: 0, oy: 20 }, { id: 'sda', name: 'SDA', ox: 24, oy: -8 }, { id: 'scl', name: 'SCL', ox: 24, oy: 8 }] },
  bluetooth_module: { w: 36, h: 28, pins: [{ id: 'vcc', name: 'VCC', ox: 0, oy: -20 }, { id: 'gnd', name: 'GND', ox: 0, oy: 20 }, { id: 'txd', name: 'TXD', ox: -24, oy: -8 }, { id: 'rxd', name: 'RXD', ox: -24, oy: 8 }] },
  wifi_module:     { w: 36, h: 28, pins: [{ id: 'vcc', name: 'VCC', ox: 0, oy: -20 }, { id: 'gnd', name: 'GND', ox: 0, oy: 20 }, { id: 'txd', name: 'TXD', ox: -24, oy: -8 }, { id: 'rxd', name: 'RXD', ox: -24, oy: 8 }] },
  can_transceiver: { w: 36, h: 28, pins: [{ id: 'vcc', name: 'VCC', ox: 0, oy: -20 }, { id: 'gnd', name: 'GND', ox: 0, oy: 20 }, { id: 'txd', name: 'TXD', ox: -24, oy: 0 }, { id: 'rxd', name: 'RXD', ox: 24, oy: 0 }] },
  rs485_transceiver: { w: 36, h: 28, pins: [{ id: 'vcc', name: 'VCC', ox: 0, oy: -20 }, { id: 'gnd', name: 'GND', ox: 0, oy: 20 }, { id: 'ro', name: 'RO', ox: -24, oy: -8 }, { id: 'di', name: 'DI', ox: -24, oy: 8 }] },
  usb_serial:      { w: 36, h: 28, pins: [{ id: 'vcc', name: 'VCC', ox: 0, oy: -20 }, { id: 'gnd', name: 'GND', ox: 0, oy: 20 }, { id: 'txd', name: 'TXD', ox: -24, oy: 0 }, { id: 'rxd', name: 'RXD', ox: 24, oy: 0 }] },
  seven_segment:   { w: 32, h: 40, pins: [{ id: 'vcc', name: 'VCC', ox: 0, oy: -26 }, { id: 'gnd', name: 'GND', ox: 0, oy: 26 }, { id: 'data', name: 'DATA', ox: 24, oy: 0 }] },
  led_indicator:   { w: 32, h: 24, pins: [{ id: 'anode', name: '+', ox: -10, oy: 18 }, { id: 'cathode', name: '-', ox: 10, oy: 18 }] },
  ldo:             { w: 36, h: 28, pins: [{ id: 'vin', name: 'VIN', ox: -24, oy: 0 }, { id: 'vout', name: 'VOUT', ox: 24, oy: 0 }, { id: 'gnd', name: 'GND', ox: 0, oy: 20 }] },
  buck_converter:  { w: 40, h: 32, pins: [{ id: 'vin', name: 'VIN', ox: -24, oy: 0 }, { id: 'vout', name: 'VOUT', ox: 24, oy: 0 }, { id: 'gnd', name: 'GND', ox: 0, oy: 22 }] },
  boost_converter: { w: 40, h: 32, pins: [{ id: 'vin', name: 'VIN', ox: -24, oy: 0 }, { id: 'vout', name: 'VOUT', ox: 24, oy: 0 }, { id: 'gnd', name: 'GND', ox: 0, oy: 22 }] },
  timer_555:       { w: 40, h: 44, pins: [{ id: 'gnd', name: 'GND', ox: -24, oy: 14 }, { id: 'trig', name: 'TRG', ox: -24, oy: 5 }, { id: 'out', name: 'OUT', ox: 24, oy: -14 }, { id: 'reset', name: 'RST', ox: -24, oy: -5 }, { id: 'ctrl', name: 'CTL', ox: -24, oy: -14 }, { id: 'thr', name: 'THR', ox: 24, oy: 5 }, { id: 'dis', name: 'DIS', ox: 24, oy: 14 }, { id: 'vcc', name: 'VCC', ox: 0, oy: -28 }] },
  voltage_regulator_7805: { w: 36, h: 28, pins: [{ id: 'vin', name: 'IN', ox: -24, oy: 0 }, { id: 'vout', name: 'OUT', ox: 24, oy: 0 }, { id: 'gnd', name: 'GND', ox: 0, oy: 20 }] },
  voltage_regulator_7812: { w: 36, h: 28, pins: [{ id: 'vin', name: 'IN', ox: -24, oy: 0 }, { id: 'vout', name: 'OUT', ox: 24, oy: 0 }, { id: 'gnd', name: 'GND', ox: 0, oy: 20 }] },
  eeprom_i2c:      { w: 36, h: 28, pins: [{ id: 'vcc', name: 'VCC', ox: 0, oy: -20 }, { id: 'gnd', name: 'GND', ox: 0, oy: 20 }, { id: 'sda', name: 'SDA', ox: 24, oy: -8 }, { id: 'scl', name: 'SCL', ox: 24, oy: 8 }] },
  eeprom_spi:      { w: 36, h: 32, pins: [{ id: 'vcc', name: 'VCC', ox: 0, oy: -22 }, { id: 'gnd', name: 'GND', ox: 0, oy: 22 }, { id: 'miso', name: 'MISO', ox: -24, oy: -8 }, { id: 'mosi', name: 'MOSI', ox: -24, oy: 8 }, { id: 'sck', name: 'SCK', ox: 24, oy: -8 }, { id: 'cs', name: 'CS', ox: 24, oy: 8 }] },
  aht20:           { w: 40, h: 28, pins: [{ id: 'vcc', name: 'VCC', ox: 0, oy: -20 }, { id: 'gnd', name: 'GND', ox: 0, oy: 20 }, { id: 'sda', name: 'SDA', ox: 24, oy: -8 }, { id: 'scl', name: 'SCL', ox: 24, oy: 8 }] },
  dht20:           { w: 40, h: 28, pins: [{ id: 'vcc', name: 'VCC', ox: 0, oy: -20 }, { id: 'gnd', name: 'GND', ox: 0, oy: 20 }, { id: 'sda', name: 'SDA', ox: 24, oy: -8 }, { id: 'scl', name: 'SCL', ox: 24, oy: 8 }] },
  dupont_wire:     { w: 20, h: 20, pins: [{ id: 'a', name: 'A', ox: -14, oy: 0 }, { id: 'b', name: 'B', ox: 14, oy: 0 }] },
};

// ==================== MCU 电路模板 ====================

interface TemplateComponent {
  type: string;
  name: string;
  offsetX: number;
  offsetY: number;
}

interface TemplateWire {
  from: { comp: string; pin: string };
  to: { comp: string; pin: string };
}

export interface CircuitTemplate {
  id: string;
  name: string;
  components: TemplateComponent[];
  wires: TemplateWire[];
}

export const CIRCUIT_TEMPLATES: CircuitTemplate[] = [
  {
    id: 'full-dev-board',
    name: '完整开发板',
    components: [
      { type: 'battery', name: '3.3V', offsetX: -380, offsetY: -180 },
      { type: 'ldo', name: 'AP2112K', offsetX: -380, offsetY: -100 },
      { type: 'capacitor', name: 'C1', offsetX: -310, offsetY: -100 },
      { type: 'capacitor', name: 'C2', offsetX: -310, offsetY: -40 },
      { type: 'capacitor', name: 'C3', offsetX: -310, offsetY: 20 },
      { type: 'capacitor', name: 'C4', offsetX: -310, offsetY: 80 },
      { type: 'capacitor', name: 'C5', offsetX: -310, offsetY: 140 },
      { type: 'sensor', name: 'TCRT5000', offsetX: -380, offsetY: 200 },
      { type: 'ntc_thermistor', name: 'NTC', offsetX: -380, offsetY: 280 },
      { type: 'resistor', name: 'R6', offsetX: -310, offsetY: 280 },
      { type: 'potentiometer', name: '电位器', offsetX: -380, offsetY: 360 },
      { type: 'dc_motor', name: 'DRV8833', offsetX: -100, offsetY: 340 },
      { type: 'servo_motor', name: '舵机', offsetX: 0, offsetY: 340 },
      { type: 'buzzer_passive', name: '蜂鸣器', offsetX: -100, offsetY: 260 },
      { type: 'relay', name: '继电器', offsetX: 0, offsetY: 260 },
      { type: 'button', name: 'KEY1', offsetX: 130, offsetY: 260 },
      { type: 'resistor', name: 'R11', offsetX: 200, offsetY: 260 },
      { type: 'button', name: 'KEY2', offsetX: 130, offsetY: 340 },
      { type: 'switch', name: '编码器', offsetX: 200, offsetY: 340 },
      { type: 'bluetooth_module', name: '蓝牙', offsetX: 320, offsetY: -180 },
      { type: 'usb_serial', name: 'CH343P', offsetX: 320, offsetY: -100 },
      { type: 'pin_header', name: 'USB-C', offsetX: 320, offsetY: -20 },
      { type: 'oled_display', name: 'OLED', offsetX: 320, offsetY: 60 },
      { type: 'led', name: 'RGB', offsetX: 320, offsetY: 160 },
      { type: 'resistor', name: 'R22', offsetX: 390, offsetY: 140 },
      { type: 'resistor', name: 'R23', offsetX: 390, offsetY: 160 },
      { type: 'resistor', name: 'R24', offsetX: 390, offsetY: 180 },
      { type: 'led', name: 'WS1', offsetX: 130, offsetY: 160 },
      { type: 'led', name: 'WS2', offsetX: 180, offsetY: 160 },
      { type: 'led', name: 'WS3', offsetX: 230, offsetY: 160 },
      { type: 'crystal', name: '8MHz', offsetX: -220, offsetY: 0 },
      { type: 'capacitor', name: 'C6', offsetX: -220, offsetY: 50 },
      { type: 'capacitor', name: 'C7', offsetX: -220, offsetY: -50 },
      { type: 'aht20', name: 'DHT20', offsetX: 320, offsetY: 260 },
    ],
    wires: [
      { from: { comp: '3.3V', pin: 'vcc' }, to: { comp: 'AP2112K', pin: 'vin' } },
      { from: { comp: '3.3V', pin: 'gnd' }, to: { comp: '__chip__', pin: 'VSS' } },
      { from: { comp: 'AP2112K', pin: 'vout' }, to: { comp: '__chip__', pin: 'VDD' } },
      { from: { comp: 'AP2112K', pin: 'gnd' }, to: { comp: '__chip__', pin: 'VSS' } },
      { from: { comp: '__chip__', pin: 'VDD' }, to: { comp: 'C1', pin: 'a' } },
      { from: { comp: 'C1', pin: 'b' }, to: { comp: '__chip__', pin: 'VSS' } },
      { from: { comp: '__chip__', pin: 'VDD' }, to: { comp: 'C2', pin: 'a' } },
      { from: { comp: 'C2', pin: 'b' }, to: { comp: '__chip__', pin: 'VSS' } },
      { from: { comp: '__chip__', pin: 'VDD' }, to: { comp: 'C3', pin: 'a' } },
      { from: { comp: 'C3', pin: 'b' }, to: { comp: '__chip__', pin: 'VSS' } },
      { from: { comp: '__chip__', pin: 'VDD' }, to: { comp: 'C4', pin: 'a' } },
      { from: { comp: 'C4', pin: 'b' }, to: { comp: '__chip__', pin: 'VSS' } },
      { from: { comp: '__chip__', pin: 'VDD' }, to: { comp: 'C5', pin: 'a' } },
      { from: { comp: 'C5', pin: 'b' }, to: { comp: '__chip__', pin: 'VSS' } },
      { from: { comp: '__chip__', pin: 'PB14' }, to: { comp: 'TCRT5000', pin: 'data' } },
      { from: { comp: 'TCRT5000', pin: 'vcc' }, to: { comp: '__chip__', pin: 'VDD' } },
      { from: { comp: 'TCRT5000', pin: 'gnd' }, to: { comp: '__chip__', pin: 'VSS' } },
      { from: { comp: '__chip__', pin: 'PA4' }, to: { comp: 'NTC', pin: 'data' } },
      { from: { comp: '__chip__', pin: 'VDD' }, to: { comp: 'R6', pin: 'a' } },
      { from: { comp: 'R6', pin: 'b' }, to: { comp: 'NTC', pin: 'vcc' } },
      { from: { comp: 'NTC', pin: 'gnd' }, to: { comp: '__chip__', pin: 'VSS' } },
      { from: { comp: '电位器', pin: 'a' }, to: { comp: '__chip__', pin: 'VDD' } },
      { from: { comp: '电位器', pin: 'b' }, to: { comp: '__chip__', pin: 'VSS' } },
      { from: { comp: '电位器', pin: 'wiper' }, to: { comp: '__chip__', pin: 'PA5' } },
      { from: { comp: '__chip__', pin: 'PA0' }, to: { comp: 'DRV8833', pin: 'positive' } },
      { from: { comp: '__chip__', pin: 'PA1' }, to: { comp: 'DRV8833', pin: 'negative' } },
      { from: { comp: '__chip__', pin: 'PB8' }, to: { comp: '舵机', pin: 'signal' } },
      { from: { comp: '舵机', pin: 'vcc' }, to: { comp: '__chip__', pin: 'VDD' } },
      { from: { comp: '舵机', pin: 'gnd' }, to: { comp: '__chip__', pin: 'VSS' } },
      { from: { comp: '__chip__', pin: 'PB9' }, to: { comp: '蜂鸣器', pin: 'positive' } },
      { from: { comp: '蜂鸣器', pin: 'negative' }, to: { comp: '__chip__', pin: 'VSS' } },
      { from: { comp: '__chip__', pin: 'PB5' }, to: { comp: '继电器', pin: 'coil_a' } },
      { from: { comp: '继电器', pin: 'coil_b' }, to: { comp: '__chip__', pin: 'VSS' } },
      { from: { comp: '__chip__', pin: 'PB12' }, to: { comp: 'KEY1', pin: 'a' } },
      { from: { comp: 'KEY1', pin: 'b' }, to: { comp: '__chip__', pin: 'VSS' } },
      { from: { comp: '__chip__', pin: 'VDD' }, to: { comp: 'R11', pin: 'a' } },
      { from: { comp: 'R11', pin: 'b' }, to: { comp: '__chip__', pin: 'PB12' } },
      { from: { comp: '__chip__', pin: 'PB13' }, to: { comp: 'KEY2', pin: 'a' } },
      { from: { comp: 'KEY2', pin: 'b' }, to: { comp: '__chip__', pin: 'VSS' } },
      { from: { comp: '__chip__', pin: 'PA8' }, to: { comp: '编码器', pin: 'a' } },
      { from: { comp: '__chip__', pin: 'PB15' }, to: { comp: '编码器', pin: 'b' } },
      { from: { comp: '__chip__', pin: 'PB10' }, to: { comp: '蓝牙', pin: 'rxd' } },
      { from: { comp: '蓝牙', pin: 'txd' }, to: { comp: '__chip__', pin: 'PB11' } },
      { from: { comp: '蓝牙', pin: 'vcc' }, to: { comp: '__chip__', pin: 'VDD' } },
      { from: { comp: '蓝牙', pin: 'gnd' }, to: { comp: '__chip__', pin: 'VSS' } },
      { from: { comp: '__chip__', pin: 'PA2' }, to: { comp: 'CH343P', pin: 'rxd' } },
      { from: { comp: '__chip__', pin: 'PA3' }, to: { comp: 'CH343P', pin: 'txd' } },
      { from: { comp: '__chip__', pin: 'PB6' }, to: { comp: 'OLED', pin: 'scl' } },
      { from: { comp: '__chip__', pin: 'PB7' }, to: { comp: 'OLED', pin: 'sda' } },
      { from: { comp: 'OLED', pin: 'vcc' }, to: { comp: '__chip__', pin: 'VDD' } },
      { from: { comp: 'OLED', pin: 'gnd' }, to: { comp: '__chip__', pin: 'VSS' } },
      { from: { comp: '__chip__', pin: 'PA6' }, to: { comp: 'R22', pin: 'a' } },
      { from: { comp: 'R22', pin: 'b' }, to: { comp: 'RGB', pin: 'anode' } },
      { from: { comp: '__chip__', pin: 'PA7' }, to: { comp: 'R23', pin: 'a' } },
      { from: { comp: 'R23', pin: 'b' }, to: { comp: 'RGB', pin: 'anode' } },
      { from: { comp: '__chip__', pin: 'PB0' }, to: { comp: 'R24', pin: 'a' } },
      { from: { comp: 'R24', pin: 'b' }, to: { comp: 'RGB', pin: 'anode' } },
      { from: { comp: 'RGB', pin: 'cathode' }, to: { comp: '__chip__', pin: 'VSS' } },
      { from: { comp: '__chip__', pin: 'PB4' }, to: { comp: 'WS1', pin: 'anode' } },
      { from: { comp: 'WS1', pin: 'cathode' }, to: { comp: 'WS2', pin: 'anode' } },
      { from: { comp: 'WS2', pin: 'cathode' }, to: { comp: 'WS3', pin: 'anode' } },
      { from: { comp: 'WS3', pin: 'cathode' }, to: { comp: '__chip__', pin: 'VSS' } },
      { from: { comp: '__chip__', pin: 'PD0' }, to: { comp: '8MHz', pin: 'a' } },
      { from: { comp: '8MHz', pin: 'b' }, to: { comp: '__chip__', pin: 'PD1' } },
      { from: { comp: '8MHz', pin: 'a' }, to: { comp: 'C6', pin: 'a' } },
      { from: { comp: 'C6', pin: 'b' }, to: { comp: '__chip__', pin: 'VSS' } },
      { from: { comp: '8MHz', pin: 'b' }, to: { comp: 'C7', pin: 'a' } },
      { from: { comp: 'C7', pin: 'b' }, to: { comp: '__chip__', pin: 'VSS' } },
      { from: { comp: '__chip__', pin: 'PB6' }, to: { comp: 'DHT20', pin: 'scl' } },
      { from: { comp: '__chip__', pin: 'PB7' }, to: { comp: 'DHT20', pin: 'sda' } },
      { from: { comp: 'DHT20', pin: 'vcc' }, to: { comp: '__chip__', pin: 'VDD' } },
      { from: { comp: 'DHT20', pin: 'gnd' }, to: { comp: '__chip__', pin: 'VSS' } },
    ],
  },
  {
    id: 'blink-led',
    name: 'LED闪烁',
    components: [
      { type: 'resistor', name: 'R1', offsetX: 100, offsetY: -30 },
      { type: 'led', name: 'LED1', offsetX: 160, offsetY: -30 },
      { type: 'ground', name: 'GND', offsetX: 160, offsetY: 40 },
    ],
    wires: [
      { from: { comp: '__chip__', pin: 'gpio' }, to: { comp: 'R1', pin: 'a' } },
      { from: { comp: 'R1', pin: 'b' }, to: { comp: 'LED1', pin: 'anode' } },
      { from: { comp: 'LED1', pin: 'cathode' }, to: { comp: 'GND', pin: 'gnd' } },
    ],
  },
  {
    id: 'key-led',
    name: '按键控制LED',
    components: [
      { type: 'resistor', name: 'R1', offsetX: 100, offsetY: -40 },
      { type: 'led', name: 'LED1', offsetX: 160, offsetY: -40 },
      { type: 'ground', name: 'GND1', offsetX: 220, offsetY: -40 },
      { type: 'resistor', name: 'R2', offsetX: 100, offsetY: 30 },
      { type: 'button', name: 'KEY1', offsetX: 160, offsetY: 30 },
      { type: 'ground', name: 'GND2', offsetX: 220, offsetY: 30 },
    ],
    wires: [
      { from: { comp: '__chip__', pin: 'gpio1' }, to: { comp: 'R1', pin: 'a' } },
      { from: { comp: 'R1', pin: 'b' }, to: { comp: 'LED1', pin: 'anode' } },
      { from: { comp: 'LED1', pin: 'cathode' }, to: { comp: 'GND1', pin: 'gnd' } },
      { from: { comp: '__chip__', pin: 'VDD' }, to: { comp: 'R2', pin: 'a' } },
      { from: { comp: 'R2', pin: 'b' }, to: { comp: '__chip__', pin: 'gpio2' } },
      { from: { comp: '__chip__', pin: 'gpio2' }, to: { comp: 'KEY1', pin: 'a' } },
      { from: { comp: 'KEY1', pin: 'b' }, to: { comp: 'GND2', pin: 'gnd' } },
    ],
  },
  {
    id: 'uart-comm',
    name: '串口通信',
    components: [
      { type: 'pin_header', name: 'CH343P', offsetX: 160, offsetY: -20 },
      { type: 'ground', name: 'GND', offsetX: 160, offsetY: 60 },
    ],
    wires: [
      { from: { comp: '__chip__', pin: 'tx' }, to: { comp: 'CH343P', pin: 'pin' } },
      { from: { comp: 'CH343P', pin: 'pin' }, to: { comp: '__chip__', pin: 'rx' } },
      { from: { comp: '__chip__', pin: 'VDD' }, to: { comp: 'CH343P', pin: 'pin' } },
      { from: { comp: 'CH343P', pin: 'pin' }, to: { comp: 'GND', pin: 'gnd' } },
    ],
  },
  {
    id: 'oled-display',
    name: 'OLED显示',
    components: [
      { type: 'oled_display', name: 'OLED1', offsetX: 140, offsetY: 0 },
      { type: 'resistor', name: 'R_SCL', offsetX: 80, offsetY: -60 },
      { type: 'resistor', name: 'R_SDA', offsetX: 80, offsetY: 60 },
      { type: 'ground', name: 'GND', offsetX: 240, offsetY: 60 },
    ],
    wires: [
      { from: { comp: '__chip__', pin: 'gpio' }, to: { comp: 'R_SCL', pin: 'a' } },
      { from: { comp: 'R_SCL', pin: 'b' }, to: { comp: 'OLED1', pin: 'scl' } },
      { from: { comp: '__chip__', pin: 'gpio2' }, to: { comp: 'R_SDA', pin: 'a' } },
      { from: { comp: 'R_SDA', pin: 'b' }, to: { comp: 'OLED1', pin: 'sda' } },
      { from: { comp: 'OLED1', pin: 'vcc' }, to: { comp: '__chip__', pin: 'VDD' } },
      { from: { comp: 'OLED1', pin: 'gnd' }, to: { comp: 'GND', pin: 'gnd' } },
    ],
  },
  {
    id: 'motor-drive',
    name: '电机驱动',
    components: [
      { type: 'dc_motor', name: 'M1', offsetX: 200, offsetY: -40 },
      { type: 'relay', name: 'RL1', offsetX: 130, offsetY: 0 },
      { type: 'diode', name: 'D1', offsetX: 60, offsetY: 20 },
      { type: 'resistor', name: 'R1', offsetX: 60, offsetY: -40 },
      { type: 'ground', name: 'GND', offsetX: 200, offsetY: 60 },
    ],
    wires: [
      { from: { comp: '__chip__', pin: 'gpio' }, to: { comp: 'R1', pin: 'a' } },
      { from: { comp: 'R1', pin: 'b' }, to: { comp: 'RL1', pin: 'coil_a' } },
      { from: { comp: 'RL1', pin: 'coil_b' }, to: { comp: 'GND', pin: 'gnd' } },
      { from: { comp: 'RL1', pin: 'coil_a' }, to: { comp: 'D1', pin: 'cathode' } },
      { from: { comp: 'D1', pin: 'anode' }, to: { comp: 'RL1', pin: 'coil_b' } },
      { from: { comp: '__chip__', pin: 'VDD' }, to: { comp: 'RL1', pin: 'com' } },
      { from: { comp: 'RL1', pin: 'no' }, to: { comp: 'M1', pin: 'positive' } },
      { from: { comp: 'M1', pin: 'negative' }, to: { comp: 'GND', pin: 'gnd' } },
    ],
  },
];

// ==================== 工具函数 ====================

/** 元件类型 → 中文名称前缀 */
export function getComponentName(type: string): string {
  const map: Record<string, string> = {
    resistor: 'R', capacitor: 'C', inductor: 'L', crystal: 'Y',
    led: 'LED', diode: 'D', zener_diode: 'ZD',
    bjt_npn: 'Q', bjt_pnp: 'Q', mosfet_nmos: 'M', mosfet_pmos: 'M',
    op_amp: 'U', optocoupler: 'U',
    button: 'K', switch: 'SW', potentiometer: 'RV',
    buzzer_active: 'BZ', buzzer_passive: 'BZ', buzzer: 'BZ',
    relay: 'RL', dc_motor: 'M', stepper_motor: 'M', servo_motor: 'M',
    sensor: 'S', ntc_thermistor: 'NTC', ptc_thermistor: 'PTC',
    ds18b20: 'U', ldr: 'R', accelerometer: 'U', gyroscope: 'U',
    display: 'DISP', lcd_display: 'LCD', oled_display: 'OLED', seven_segment: 'SEG',
    bluetooth_module: 'BT', wifi_module: 'WiFi', can_transceiver: 'CAN', rs485_transceiver: 'RS485',
    uart_tx: 'TX', uart_rx: 'RX', spi_master: 'SPI', spi_slave: 'SPI',
    i2c_master: 'I2C', i2c_slave: 'I2C',
    battery: 'BAT', ldo: 'U', buck_converter: 'U', boost_converter: 'U',
    timer_555: 'U', voltage_regulator_7805: 'U', voltage_regulator_7812: 'U',
    eeprom_i2c: 'U', eeprom_spi: 'U', ferrite_bead: 'FB',
    ground: 'GND', pin_header: 'J', ntc_thermistor: 'NTC', ptc_thermistor: 'PTC',
    ds18b20: 'U', ldr: 'R', photodiode: 'D', piezo_sensor: 'PZ',
    bluetooth_module: 'BT', wifi_module: 'WIF', can_transceiver: 'CAN', rs485_transceiver: 'RS4',
    usb_serial: 'USB', ldo: 'U', buck_converter: 'DC', boost_converter: 'DC',
    aht20: 'U', dht20: 'U', accelerometer: 'ACC', gyroscope: 'GYR',
    seven_segment: 'SEG', led_indicator: 'LED', dupont_wire: 'W',
  };
  return map[type] || type.slice(0, 3).toUpperCase();
}

export function pinLevelColor(level: 'high' | 'low' | 'floating'): string {
  switch (level) {
    case 'high': return '#2ecc71';
    case 'low': return '#6a8a9a';
    case 'floating': return '#f1c40f';
  }
}

/** 计算引脚世界坐标（考虑旋转） */
export function pinWorld(comp: { x: number; y: number; rotation: number }, pin: { offsetX: number; offsetY: number }) {
  const rad = (comp.rotation || 0) * Math.PI / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  return {
    x: comp.x + pin.offsetX * cos - pin.offsetY * sin,
    y: comp.y + pin.offsetX * sin + pin.offsetY * cos,
  };
}

/** 根据引脚偏移量推断引脚所在侧 */
export function getPinSide(pin: { offsetX: number; offsetY: number }): 'left' | 'right' | 'top' | 'bottom' {
  const { offsetX: ox, offsetY: oy } = pin;
  if (Math.abs(ox) >= Math.abs(oy)) {
    return ox <= 0 ? 'left' : 'right';
  }
  return oy <= 0 ? 'top' : 'bottom';
}

/** 线段与旋转矩形碰撞检测 */
export function lineHitsRect(x1: number, y1: number, x2: number, y2: number,
  rx: number, ry: number, rw: number, rh: number, rotation: number = 0): boolean {
  if (!rotation || rotation % 360 === 0) {
    const l = rx - rw / 2, r = rx + rw / 2;
    const t = ry - rh / 2, b = ry + rh / 2;
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    if (maxX < l || minX > r || maxY < t || minY > b) return false;
    if (x1 === x2) return minX <= r && maxX >= l;
    if (y1 === y2) return minY <= b && maxY >= t;
    return false;
  }
  const rad = -rotation * Math.PI / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const lx1 = (x1 - rx) * cos - (y1 - ry) * sin;
  const ly1 = (x1 - rx) * sin + (y1 - ry) * cos;
  const lx2 = (x2 - rx) * cos - (y2 - ry) * sin;
  const ly2 = (x2 - rx) * sin + (y2 - ry) * cos;
  const l = -rw / 2, r = rw / 2, t = -rh / 2, b = rh / 2;
  const minX = Math.min(lx1, lx2), maxX = Math.max(lx1, lx2);
  const minY = Math.min(ly1, ly2), maxY = Math.max(ly1, ly2);
  if (maxX < l || minX > r || maxY < t || minY > b) return false;
  if (lx1 === lx2) return minX <= r && maxX >= l;
  if (ly1 === ly2) return minY <= b && maxY >= t;
  return false;
}

/** 智能正交走线：避开元件body，返回路径点数组 */
export function calculateWirePath(
  pinA: { x: number; y: number },
  dirA: 'left' | 'right' | 'top' | 'bottom',
  srcA: { x: number; y: number; w: number; h: number } | null,
  pinB: { x: number; y: number },
  dirB: 'left' | 'right' | 'top' | 'bottom',
  srcB: { x: number; y: number; w: number; h: number } | null,
  allComps: { x: number; y: number; w: number; h: number; id: string; rotation?: number }[],
  excludeAId: string | null,
  excludeBId: string | null,
): { x: number; y: number }[] {
  const M = 20;

  function segCollides(x1: number, y1: number, x2: number, y2: number): boolean {
    for (const c of allComps) {
      if (c.id === excludeAId || c.id === excludeBId) continue;
      if (lineHitsRect(x1, y1, x2, y2, c.x, c.y, c.w, c.h, c.rotation || 0)) return true;
    }
    return false;
  }

  function pathCollides(path: { x: number; y: number }[]): boolean {
    for (let i = 0; i < path.length - 1; i++) {
      if (segCollides(path[i].x, path[i].y, path[i+1].x, path[i+1].y)) return true;
    }
    return false;
  }

  function extend(pin: {x:number;y:number}, dir: string, d: number) {
    if (dir === 'left') return {x: pin.x - d, y: pin.y};
    if (dir === 'right') return {x: pin.x + d, y: pin.y};
    if (dir === 'top') return {x: pin.x, y: pin.y - d};
    return {x: pin.x, y: pin.y + d};
  }

  const eA = extend(pinA, dirA, M);
  const eB = extend(pinB, dirB, M);
  const hA = dirA === 'left' || dirA === 'right';
  const hB = dirB === 'left' || dirB === 'right';

  const cands: {x:number;y:number}[][] = [];

  if (hA && !hB) {
    cands.push([pinA, eA, {x: eA.x, y: eB.y}, eB, pinB]);
    cands.push([pinA, eA, {x: eA.x, y: eB.y + (dirB==='top'?-M*2:M*2)}, {x: eB.x, y: eB.y + (dirB==='top'?-M*2:M*2)}, eB, pinB]);
  } else if (!hA && hB) {
    cands.push([pinA, eA, {x: eB.x, y: eA.y}, eB, pinB]);
    cands.push([pinA, eA, {x: eB.x + (dirB==='left'?-M*2:M*2), y: eA.y}, {x: eB.x + (dirB==='left'?-M*2:M*2), y: eB.y}, eB, pinB]);
  } else if (hA && hB) {
    const midY = (pinA.y + pinB.y) / 2;
    cands.push([pinA, eA, {x: eA.x, y: midY}, {x: eB.x, y: midY}, eB, pinB]);
    cands.push([pinA, eA, {x: eA.x, y: Math.min(eA.y, eB.y) - 30}, {x: eB.x, y: Math.min(eA.y, eB.y) - 30}, eB, pinB]);
    cands.push([pinA, eA, {x: eA.x, y: Math.max(eA.y, eB.y) + 30}, {x: eB.x, y: Math.max(eA.y, eB.y) + 30}, eB, pinB]);
  } else {
    const midX = (pinA.x + pinB.x) / 2;
    cands.push([pinA, eA, {x: midX, y: eA.y}, {x: midX, y: eB.y}, eB, pinB]);
    cands.push([pinA, eA, {x: Math.min(eA.x, eB.x) - 30, y: eA.y}, {x: Math.min(eA.x, eB.x) - 30, y: eB.y}, eB, pinB]);
    cands.push([pinA, eA, {x: Math.max(eA.x, eB.x) + 30, y: eA.y}, {x: Math.max(eA.x, eB.x) + 30, y: eB.y}, eB, pinB]);
  }

  cands.push([pinA, eA, {x: eA.x + 80, y: eA.y}, {x: eA.x + 80, y: eB.y}, eB, pinB]);
  cands.push([pinA, eA, {x: eA.x - 80, y: eA.y}, {x: eA.x - 80, y: eB.y}, eB, pinB]);
  cands.push([pinA, eA, {x: eA.x, y: eA.y + 80}, {x: eB.x, y: eA.y + 80}, eB, pinB]);
  cands.push([pinA, eA, {x: eA.x, y: eA.y - 80}, {x: eB.x, y: eA.y - 80}, eB, pinB]);

  for (const p of cands) {
    if (!pathCollides(p)) return p;
  }
  return cands[0] || [pinA, pinB];
}

export function simBtnStyle(disabled: boolean): CSSProperties {
  return {
    width: 32, height: 32, borderRadius: 6, border: '1px solid rgba(88,206,190,0.4)',
    background: disabled ? 'rgba(42,74,90,0.3)' : 'rgba(42,74,90,0.8)',
    color: disabled ? 'rgba(138,176,196,0.3)' : '#58cebe',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s',
  };
}

// ==================== 持久化 ====================

export function debounce<F extends (...args: any[]) => void>(fn: F, ms: number) {
  let t: ReturnType<typeof setTimeout>;
  return (...args: Parameters<F>) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

const STORAGE_PREFIX = 'chip-sim-state-';

export function saveState(model: string, comps: CanvasComponent[], wires: Wire[], pins: Pin[]) {
  try {
    const data = {
      components: comps.map(c => ({ id: c.id, type: c.type, name: c.name, x: c.x, y: c.y, w: c.w, h: c.h, rotation: c.rotation, pins: c.pins })),
      wires: wires.map(w => ({ id: w.id, from: w.from, to: w.to })),
      chipPins: pins.map(p => ({ id: p.id, connected: p.connected })),
    };
    localStorage.setItem(STORAGE_PREFIX + model, JSON.stringify(data));
  } catch { /* quota exceeded */ }
}

export function loadState(model: string): { components: CanvasComponent[]; wires: Wire[] } | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + model);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d.components || !d.wires) return null;
    const comps: CanvasComponent[] = d.components.map((c: any) => ({
      ...c, selected: false, simState: { ...DEFAULT_SIM_STATE_ },
      pins: c.pins.map((p: any) => ({ ...p, level: 'floating' as const })),
    }));
    const wires: Wire[] = d.wires.map((w: any) => ({ ...w, selected: false, current: 0 }));
    return { components: comps, wires };
  } catch { return null; }
}
