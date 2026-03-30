/**
 * 懒加载元件库
 * 按需加载元件定义，减少初始包体积
 */

import type { ComponentType } from '../types/circuit';
import { getBehaviorModel, type BehaviorModel } from './behavior-models';

// ==================== 元件定义 ====================

/** 元件库条目 */
export interface ComponentDef {
  type: ComponentType;
  name: string;
  category: string;
  description: string;
  defaultValue: number;
  defaultUnit: string;
  icon: string;
  /** 行为模型（如果该元件类型有对应模型） */
  behaviorModel?: BehaviorModel;
}

/** 元件分类 */
export type ComponentCategory =
  | 'passive'
  | 'source'
  | 'semiconductor'
  | 'logic'
  | 'protocol'
  | 'mcu'
  | 'sensor_temperature'
  | 'sensor_light'
  | 'sensor_motion'
  | 'power_management'
  | 'communication'
  | 'actuator'
  | 'measurement';

// ==================== 元件元数据（轻量级） ====================

/** 元件元数据 - 用于初始列表显示，不包含完整定义 */
export interface ComponentMeta {
  type: string;
  name: string;
  category: ComponentCategory;
  icon: string;
}

/** 所有元件的元数据列表（轻量级，可立即加载） */
const COMPONENT_METAS: ComponentMeta[] = [
  // 无源元件
  { type: 'resistor', name: '电阻', category: 'passive', icon: '⚡' },
  { type: 'capacitor', name: '电容', category: 'passive', icon: '⊥' },
  { type: 'inductor', name: '电感', category: 'passive', icon: '〰' },
  // 电源
  { type: 'dc_source', name: '直流电源', category: 'source', icon: '⊕' },
  { type: 'ac_source', name: '交流电源', category: 'source', icon: '∿' },
  { type: 'voltage_source', name: '电压源', category: 'source', icon: 'V' },
  { type: 'current_source', name: '电流源', category: 'source', icon: 'I' },
  { type: 'ground', name: '接地', category: 'source', icon: '⏚' },
  // 半导体
  { type: 'diode', name: '二极管', category: 'semiconductor', icon: '▷|' },
  { type: 'bjt_npn', name: 'NPN 三极管', category: 'semiconductor', icon: 'Q' },
  { type: 'bjt_pnp', name: 'PNP 三极管', category: 'semiconductor', icon: 'Q' },
  { type: 'mosfet_nmos', name: 'NMOS', category: 'semiconductor', icon: 'M' },
  { type: 'mosfet_pmos', name: 'PMOS', category: 'semiconductor', icon: 'M' },
  { type: 'op_amp', name: '运放', category: 'semiconductor', icon: '△' },
  { type: 'jfet_n', name: 'N-JFET', category: 'semiconductor', icon: 'J' },
  { type: 'jfet_p', name: 'P-JFET', category: 'semiconductor', icon: 'J' },
  { type: 'igbt', name: 'IGBT', category: 'semiconductor', icon: 'I' },
  { type: 'darlington_npn', name: '达林顿NPN', category: 'semiconductor', icon: 'Q' },
  { type: 'darlington_pnp', name: '达林顿PNP', category: 'semiconductor', icon: 'Q' },
  { type: 'timer_555', name: 'NE555 定时器', category: 'semiconductor', icon: '⏱' },
  { type: 'optocoupler', name: '光耦隔离器', category: 'semiconductor', icon: '💡' },
  // === 新增常用元件 ===
  { type: 'led', name: 'LED发光二极管', category: 'semiconductor', icon: '💡' },
  { type: 'zener_diode', name: '齐纳二极管', category: 'semiconductor', icon: '⚡' },
  { type: 'crystal', name: '晶振', category: 'semiconductor', icon: '⏱' },
  { type: 'eeprom_i2c', name: 'EEPROM I2C', category: 'communication', icon: '💾' },
  { type: 'comparator', name: '比较器', category: 'semiconductor', icon: '⊿' },
  { type: 'schmitt_trigger', name: '施密特触发器', category: 'semiconductor', icon: '⊤' },
  { type: 'seven_segment', name: '七段数码管', category: 'actuator', icon: '🔢' },
  { type: 'servo_motor', name: '舵机', category: 'actuator', icon: '⚙' },
  { type: 'dc_motor', name: '直流电机', category: 'actuator', icon: '⚙' },
  { type: 'ptc_thermistor', name: 'PTC热敏电阻', category: 'sensor_temperature', icon: '🌡' },
  { type: 'voltage_ref', name: '电压基准', category: 'power_management', icon: 'V' },
  { type: 'ferrite_bead', name: '磁珠', category: 'passive', icon: '🧲' },
  // 逻辑门
  { type: 'logic_and', name: 'AND', category: 'logic', icon: '&' },
  { type: 'logic_or', name: 'OR', category: 'logic', icon: '≥1' },
  { type: 'logic_not', name: 'NOT', category: 'logic', icon: '1' },
  { type: 'logic_nand', name: 'NAND', category: 'logic', icon: '⊼' },
  { type: 'logic_nor', name: 'NOR', category: 'logic', icon: '⊽' },
  { type: 'logic_xor', name: 'XOR', category: 'logic', icon: '⊕' },
  // 通信协议
  { type: 'spi_master', name: 'SPI 主机', category: 'protocol', icon: 'S' },
  { type: 'spi_slave', name: 'SPI 从机', category: 'protocol', icon: 'S' },
  { type: 'i2c_master', name: 'I2C 主机', category: 'protocol', icon: 'I' },
  { type: 'i2c_slave', name: 'I2C 从机', category: 'protocol', icon: 'I' },
  { type: 'uart_tx', name: 'UART TX', category: 'protocol', icon: 'T' },
  { type: 'uart_rx', name: 'UART RX', category: 'protocol', icon: 'R' },
  // MCU
  { type: 'mcu', name: 'MCU', category: 'mcu', icon: '▣' },
  // ADC/DAC
  { type: 'adc', name: 'ADC', category: 'mcu', icon: 'A/D' },
  { type: 'dac', name: 'DAC', category: 'mcu', icon: 'D/A' },
  // === 温度传感器 ===
  { type: 'ntc_thermistor', name: 'NTC热敏电阻', category: 'sensor_temperature', icon: '🌡' },
  { type: 'thermocouple', name: '热电偶', category: 'sensor_temperature', icon: '🔥' },
  { type: 'ds18b20', name: 'DS18B20', category: 'sensor_temperature', icon: '🌡' },
  // === 光传感器 ===
  { type: 'ldr', name: '光敏电阻', category: 'sensor_light', icon: '☀' },
  { type: 'photodiode', name: '光电二极管', category: 'sensor_light', icon: '💡' },
  { type: 'phototransistor', name: '光电晶体管', category: 'sensor_light', icon: '🔦' },
  // === 压力/加速度传感器 ===
  { type: 'piezo_sensor', name: '压电传感器', category: 'sensor_motion', icon: '⚡' },
  { type: 'accelerometer', name: '加速度计', category: 'sensor_motion', icon: '📡' },
  { type: 'gyroscope', name: '陀螺仪', category: 'sensor_motion', icon: '🔄' },
  // === 电源管理IC ===
  { type: 'ldo', name: 'LDO稳压器', category: 'power_management', icon: 'V' },
  { type: 'buck_converter', name: 'DC-DC降压', category: 'power_management', icon: '⚡' },
  { type: 'boost_converter', name: 'DC-DC升压', category: 'power_management', icon: '⬆' },
  { type: 'battery', name: '电池', category: 'power_management', icon: '🔋' },
  { type: 'power_supervisor', name: '电源监控', category: 'power_management', icon: '👁' },
  { type: 'voltage_regulator_7805', name: '7805 稳压器', category: 'power_management', icon: 'V' },
  { type: 'voltage_regulator_7812', name: '7812 稳压器', category: 'power_management', icon: 'V' },
  // === 通信模块 ===
  { type: 'bluetooth_module', name: '蓝牙模块', category: 'communication', icon: '📶' },
  { type: 'wifi_module', name: 'WiFi模块', category: 'communication', icon: '📡' },
  { type: 'can_transceiver', name: 'CAN收发器', category: 'communication', icon: '🔌' },
  { type: 'rs485_transceiver', name: 'RS-485收发器', category: 'communication', icon: '🔌' },
  // === 其他常用元件 ===
  { type: 'buzzer_active', name: '有源蜂鸣器', category: 'actuator', icon: '🔊' },
  { type: 'buzzer_passive', name: '无源蜂鸣器', category: 'actuator', icon: '🔔' },
  { type: 'relay', name: '继电器', category: 'actuator', icon: '🔀' },
  { type: 'stepper_motor', name: '步进电机', category: 'actuator', icon: '⚙' },
  { type: 'lcd_display', name: 'LCD显示屏', category: 'actuator', icon: '🖥' },
  // === 测量探针 ===
  { type: 'voltage_probe', name: '电压探针', category: 'measurement', icon: 'V̂' },
  { type: 'current_probe', name: '电流探针', category: 'measurement', icon: 'Î' },
  { type: 'power_probe', name: '功率探针', category: 'measurement', icon: 'P̂' },
];

// ==================== 分类名称映射 ====================

const CATEGORY_NAMES: Record<ComponentCategory, string> = {
  passive: '无源元件',
  source: '电源',
  semiconductor: '半导体',
  logic: '逻辑门',
  protocol: '通信协议',
  mcu: '微控制器',
  sensor_temperature: '温度传感器',
  sensor_light: '光传感器',
  sensor_motion: '运动传感器',
  power_management: '电源管理',
  communication: '通信模块',
  actuator: '执行器',
  measurement: '测量探针',
};

// ==================== 元件定义缓存 ====================

/** 完整元件定义的懒加载缓存 */
const componentDefCache = new Map<string, ComponentDef>();

/**
 * 按需加载元件完整定义
 * 首次调用时构建定义，后续从缓存读取
 */
export function loadComponentDef(type: string): ComponentDef | null {
  // 检查缓存
  if (componentDefCache.has(type)) {
    return componentDefCache.get(type)!;
  }

  // 查找元数据
  const meta = COMPONENT_METAS.find(m => m.type === type);
  if (!meta) return null;

  // 构建完整定义（延迟计算）
  const def = buildComponentDef(meta);
  componentDefCache.set(type, def);
  return def;
}

/**
 * 获取元件元数据列表（轻量级，即时加载）
 */
export function getComponentMetas(): ComponentMeta[] {
  return COMPONENT_METAS;
}

/**
 * 按分类获取元件元数据
 */
export function getMetasByCategory(category: ComponentCategory): ComponentMeta[] {
  return COMPONENT_METAS.filter(m => m.category === category);
}

/**
 * 获取所有分类
 */
export function getCategories(): { id: ComponentCategory; name: string; count: number }[] {
  const cats = new Map<ComponentCategory, number>();
  for (const meta of COMPONENT_METAS) {
    cats.set(meta.category, (cats.get(meta.category) || 0) + 1);
  }
  return Array.from(cats.entries()).map(([id, count]) => ({
    id,
    name: CATEGORY_NAMES[id],
    count,
  }));
}

/**
 * 搜索元件（按名称或类型）
 */
export function searchComponents(query: string): ComponentMeta[] {
  const q = query.toLowerCase();
  return COMPONENT_METAS.filter(
    m => m.name.toLowerCase().includes(q) || m.type.toLowerCase().includes(q)
  );
}

// ==================== 内部函数 ====================

function buildComponentDef(meta: ComponentMeta): ComponentDef {
  const defaults: Record<string, { value: number; unit: string }> = {
    resistor: { value: 1000, unit: 'Ω' },
    capacitor: { value: 1e-6, unit: 'F' },
    inductor: { value: 1e-3, unit: 'H' },
    dc_source: { value: 5, unit: 'V' },
    ac_source: { value: 1, unit: 'V' },
    voltage_source: { value: 5, unit: 'V' },
    current_source: { value: 0.01, unit: 'A' },
    ground: { value: 0, unit: 'V' },
    diode: { value: 0.7, unit: 'V' },
    bjt_npn: { value: 100, unit: 'β' },
    bjt_pnp: { value: 100, unit: 'β' },
    mosfet_nmos: { value: 1, unit: 'mA/V²' },
    mosfet_pmos: { value: 1, unit: 'mA/V²' },
    op_amp: { value: 100000, unit: 'A/V' },
    jfet_n: { value: 10, unit: 'mA' },
    jfet_p: { value: 10, unit: 'mA' },
    igbt: { value: 200, unit: 'β' },
    darlington_npn: { value: 1000, unit: 'β' },
    darlington_pnp: { value: 1000, unit: 'β' },
    timer_555: { value: 5, unit: 'V' },
    optocoupler: { value: 1.2, unit: 'V' },
    // === 新增常用元件 ===
    led: { value: 2.0, unit: 'V' },
    zener_diode: { value: 5.1, unit: 'V' },
    crystal: { value: 16, unit: 'MHz' },
    eeprom_i2c: { value: 256, unit: 'B' },
    comparator: { value: 0, unit: 'V' },
    schmitt_trigger: { value: 5, unit: 'V' },
    seven_segment: { value: 2, unit: 'V' },
    servo_motor: { value: 5, unit: 'V' },
    dc_motor: { value: 12, unit: 'V' },
    ptc_thermistor: { value: 1000, unit: 'Ω' },
    voltage_ref: { value: 2.5, unit: 'V' },
    ferrite_bead: { value: 0.5, unit: 'Ω' },
    logic_and: { value: 0, unit: '' },
    logic_or: { value: 0, unit: '' },
    logic_not: { value: 0, unit: '' },
    logic_nand: { value: 0, unit: '' },
    logic_nor: { value: 0, unit: '' },
    logic_xor: { value: 0, unit: '' },
    spi_master: { value: 1000000, unit: 'Hz' },
    spi_slave: { value: 0, unit: '' },
    i2c_master: { value: 100000, unit: 'Hz' },
    i2c_slave: { value: 0, unit: '' },
    uart_tx: { value: 115200, unit: 'bps' },
    uart_rx: { value: 115200, unit: 'bps' },
    mcu: { value: 3.3, unit: 'V' },
    adc: { value: 3.3, unit: 'V' },
    dac: { value: 3.3, unit: 'V' },
    // 温度传感器
    ntc_thermistor: { value: 10000, unit: 'Ω' },
    thermocouple: { value: 0, unit: 'mV' },
    ds18b20: { value: 25, unit: '°C' },
    // 光传感器
    ldr: { value: 10000, unit: 'Ω' },
    photodiode: { value: 0.5, unit: 'μA' },
    phototransistor: { value: 1, unit: 'mA' },
    // 运动传感器
    piezo_sensor: { value: 0, unit: 'V' },
    accelerometer: { value: 0, unit: 'g' },
    gyroscope: { value: 0, unit: '°/s' },
    // 电源管理
    ldo: { value: 3.3, unit: 'V' },
    buck_converter: { value: 3.3, unit: 'V' },
    boost_converter: { value: 12, unit: 'V' },
    battery: { value: 3.7, unit: 'V' },
    power_supervisor: { value: 3.0, unit: 'V' },
    voltage_regulator_7805: { value: 5, unit: 'V' },
    voltage_regulator_7812: { value: 12, unit: 'V' },
    // 通信模块
    bluetooth_module: { value: 3.3, unit: 'V' },
    wifi_module: { value: 3.3, unit: 'V' },
    can_transceiver: { value: 5, unit: 'V' },
    rs485_transceiver: { value: 5, unit: 'V' },
    // 执行器
    buzzer_active: { value: 5, unit: 'V' },
    buzzer_passive: { value: 5, unit: 'V' },
    relay: { value: 5, unit: 'V' },
    stepper_motor: { value: 12, unit: 'V' },
    lcd_display: { value: 3.3, unit: 'V' },
    // 测量探针
    voltage_probe: { value: 0, unit: 'V' },
    current_probe: { value: 0, unit: 'A' },
    power_probe: { value: 0, unit: 'W' },
  };

  const d = defaults[meta.type] || { value: 0, unit: '' };

  const def: ComponentDef = {
    type: meta.type as ComponentType,
    name: meta.name,
    category: meta.category,
    description: `${meta.name} (${meta.type})`,
    defaultValue: d.value,
    defaultUnit: d.unit,
    icon: meta.icon,
  };

  // 附加行为模型（如果存在）
  const behavior = getBehaviorModel(meta.type);
  if (behavior) {
    def.behaviorModel = behavior;
  }

  return def;
}

/**
 * 预加载常用元件（可在空闲时调用）
 */
export function preloadCommonComponents(): void {
  const common = ['resistor', 'capacitor', 'inductor', 'dc_source', 'ground', 'diode'];
  for (const type of common) {
    loadComponentDef(type);
  }
}

// 行为模型工具函数转发
export { getBehaviorModel, hasBehaviorModel, getBehaviorModelTypes } from './behavior-models';
export type { BehaviorModel } from './behavior-models';
