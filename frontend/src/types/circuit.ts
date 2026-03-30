/**
 * 电路模型核心类型定义
 * 覆盖电路仿真平台的所有基础实体：节点、元件、连线、端口
 */

// ==================== 基础枚举（const object 模式） ====================

/** 元件类型枚举 */
export const ComponentType = {
  Resistor: 'resistor',
  Capacitor: 'capacitor',
  Inductor: 'inductor',
  DCSource: 'dc_source',
  ACSource: 'ac_source',
  Ground: 'ground',
  VoltageSource: 'voltage_source',
  CurrentSource: 'current_source',
  Diode: 'diode',
  BJTNPN: 'bjt_npn',
  BJTPNP: 'bjt_pnp',
  MOSFET_NMOS: 'mosfet_nmos',
  MOSFET_PMOS: 'mosfet_pmos',
  OpAmp: 'op_amp',
  LogicAND: 'logic_and',
  LogicOR: 'logic_or',
  LogicNOT: 'logic_not',
  LogicNAND: 'logic_nand',
  LogicNOR: 'logic_nor',
  LogicXOR: 'logic_xor',
  // === 数字通信协议元件 ===
  SPIMaster: 'spi_master',
  SPISlave: 'spi_slave',
  I2CMaster: 'i2c_master',
  I2CSlave: 'i2c_slave',
  UARTTX: 'uart_tx',
  UARTRX: 'uart_rx',
  MCU: 'mcu',
  ADC: 'adc',
  DAC: 'dac',
  // === 温度传感器 ===
  NTCThermistor: 'ntc_thermistor',
  Thermocouple: 'thermocouple',
  DS18B20: 'ds18b20',
  // === 光传感器 ===
  LDR: 'ldr',
  Photodiode: 'photodiode',
  Phototransistor: 'phototransistor',
  // === 压力/加速度传感器 ===
  PiezoSensor: 'piezo_sensor',
  Accelerometer: 'accelerometer',
  Gyroscope: 'gyroscope',
  // === 电源管理IC ===
  LDO: 'ldo',
  BuckConverter: 'buck_converter',
  BoostConverter: 'boost_converter',
  Battery: 'battery',
  PowerSupervisor: 'power_supervisor',
  // === 通信模块 ===
  BluetoothModule: 'bluetooth_module',
  WiFiModule: 'wifi_module',
  CANTransceiver: 'can_transceiver',
  RS485Transceiver: 'rs485_transceiver',
  // === 其他常用元件 ===
  BuzzerActive: 'buzzer_active',
  BuzzerPassive: 'buzzer_passive',
  Relay: 'relay',
  StepperMotor: 'stepper_motor',
  LCDDisplay: 'lcd_display',
  // === 测量探针 ===
  VoltageProbe: 'voltage_probe',
  CurrentProbe: 'current_probe',
  PowerProbe: 'power_probe',
  // === 高级半导体器件 ===
  JFET_N: 'jfet_n',
  JFET_P: 'jfet_p',
  IGBT: 'igbt',
  DarlingtonNPN: 'darlington_npn',
  DarlingtonPNP: 'darlington_pnp',
  // === 经典 IC 元件 ===
  Timer555: 'timer_555',
  VoltageRegulator7805: 'voltage_regulator_7805',
  VoltageRegulator7812: 'voltage_regulator_7812',
  Optocoupler: 'optocoupler',
  // === 新增常用元件 ===
  LED: 'led',
  ZenerDiode: 'zener_diode',
  Crystal: 'crystal',
  EEPROM_I2C: 'eeprom_i2c',
  Comparator: 'comparator',
  SchmittTrigger: 'schmitt_trigger',
  SevenSegment: 'seven_segment',
  ServoMotor: 'servo_motor',
  DCMotor: 'dc_motor',
  PTCThermistor: 'ptc_thermistor',
  VoltageRef: 'voltage_ref',
  FerriteBead: 'ferrite_bead',
} as const;
export type ComponentType = (typeof ComponentType)[keyof typeof ComponentType];

/** 节点类型 */
export const NodeType = {
  Normal: 'normal',
  Ground: 'ground',
  Input: 'input',
  Output: 'output',
} as const;
export type NodeType = (typeof NodeType)[keyof typeof NodeType];

/** 仿真分析类型 */
export const AnalysisType = {
  DC: 'dc',
  AC: 'ac',
  Transient: 'transient',
} as const;
export type AnalysisType = (typeof AnalysisType)[keyof typeof AnalysisType];

/** 连线状态 */
export const WireStatus = {
  Connected: 'connected',
  Disconnected: 'disconnected',
  Invalid: 'invalid',
} as const;
export type WireStatus = (typeof WireStatus)[keyof typeof WireStatus];

/** 连线路径模式 */
export const WireRouting = {
  Straight: 'straight',
  Orthogonal: 'orthogonal',
  Diagonal45: 'diagonal45',
} as const;
export type WireRouting = (typeof WireRouting)[keyof typeof WireRouting];

// ==================== 位置与几何 ====================

/** 2D 坐标点 */
export interface Point {
  x: number;
  y: number;
}

/** 矩形边界框 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 元件旋转角度（0, 90, 180, 270） */
export type Rotation = 0 | 90 | 180 | 270;

// ==================== 元件定义 ====================

/** 元件参数值（带单位） */
export interface ComponentValue {
  /** 数值 */
  value: number;
  /** 单位字符串，如 'Ω', 'F', 'H', 'V', 'A' */
  unit: string;
  /** 前缀如 'k', 'm', 'μ', 'n', 'p' */
  prefix?: string;
}

/** 元件端口（连接点） */
export interface ComponentPort {
  /** 端口唯一 ID */
  id: string;
  /** 相对于元件中心的偏移 */
  offset: Point;
  /** 连接到的节点 ID */
  nodeId?: string;
}

/** 元件仿真可视化状态（用于动画渲染） */
export interface ComponentSimulationState {
  /** LED/PWM 占空比 0-1 */
  pwmDuty?: number;
  /** 继电器是否通电 */
  relayEnergized?: boolean;
  /** 电机转速 0-1 */
  motorSpeed?: number;
  /** 蜂鸣器是否发声 */
  buzzerActive?: boolean;
  /** 蜂鸣器频率 */
  buzzerFreq?: number;
}

/** 元件端口仿真状态 */
export interface PortSimulationState {
  /** 引脚电平 */
  level?: GPIOLevel;
}

/** 电路元件 */
export interface CircuitComponent {
  /** 元件唯一 ID */
  id: string;
  /** 元件类型 */
  type: ComponentType;
  /** 显示名称，如 R1, C2 */
  name: string;
  /** 元件位置（画布坐标） */
  position: Point;
  /** 旋转角度 */
  rotation: Rotation;
  /** 元件参数值 */
  value: ComponentValue;
  /** 元件端口列表 */
  ports: ComponentPort[];
  /** 额外参数（如交流源的频率、相位等） */
  params?: Record<string, number | string>;
  /** 选中状态 */
  selected?: boolean;
  /** 仿真可视化状态 */
  simState?: ComponentSimulationState;
  /** 端口仿真状态（key=portId） */
  portStates?: Record<string, PortSimulationState>;
}

// ==================== 节点定义 ====================

/** 电路节点 */
export interface CircuitNode {
  /** 节点唯一 ID */
  id: string;
  /** 节点名称，如 N1, GND */
  name: string;
  /** 节点类型 */
  type: NodeType;
  /** 节点在画布上的位置 */
  position: Point;
  /** 连接到此节点的元件端口 ID 列表 */
  connectedPorts: string[];
  /** 仿真计算的电压值（仿真结果填充） */
  voltage?: number;
}

// ==================== 连线定义 ====================

/** 连线路径点 */
export interface WirePoint {
  x: number;
  y: number;
  /** 是否为拐点 */
  isBend?: boolean;
}

/** 连线（连接两个节点或元件端口） */
export interface Wire {
  /** 连线唯一 ID */
  id: string;
  /** 起始元件 ID */
  fromComponentId: string;
  /** 起始端口 ID */
  fromPortId: string;
  /** 目标元件 ID */
  toComponentId: string;
  /** 目标端口 ID */
  toPortId: string;
  /** 连线路径点 */
  points: WirePoint[];
  /** 连线状态 */
  status: WireStatus;
  /** 电流值（仿真结果填充） */
  current?: number;
}

// ==================== 连线预览 ====================

/** 正在绘制中的连线预览 */
export interface WirePreview {
  /** 起始元件 ID */
  fromComponentId: string;
  /** 起始端口 ID */
  fromPortId: string;
  /** 起始端口绝对位置 */
  fromPosition: Point;
  /** 鼠标当前位置 */
  mousePosition: Point;
  /** 路径模式 */
  routing: WireRouting;
  /** 预吸附的目标信息 */
  snapTarget?: {
    componentId: string;
    portId: string;
    position: Point;
  };
}

// ==================== 电路工程 ====================

/** 电路工程文件 */
export interface CircuitProject {
  /** 工程唯一 ID */
  id: string;
  /** 工程名称 */
  name: string;
  /** 创建时间 */
  createdAt: string;
  /** 最后修改时间 */
  updatedAt: string;
  /** 元件列表 */
  components: CircuitComponent[];
  /** 节点列表 */
  nodes: CircuitNode[];
  /** 连线列表 */
  wires: Wire[];
  /** 仿真配置 */
  simulationConfig: SimulationConfig;
  /** 版本号（用于兼容性迁移） */
  version: string;
}

// ==================== 仿真配置 ====================

/** 直流分析配置 */
export interface DCAnalysisConfig {
  type: typeof AnalysisType.DC;
  /** 扫描参数（可选） */
  sweepSource?: string;
  sweepStart?: number;
  sweepStop?: number;
  sweepStep?: number;
}

/** AC 扫描模式 */
export const ACSweepMode = {
  Log: 'log',
  Linear: 'linear',
} as const;
export type ACSweepMode = (typeof ACSweepMode)[keyof typeof ACSweepMode];

/** 交流分析配置 */
export interface ACAnalysisConfig {
  type: typeof AnalysisType.AC;
  /** 扫描模式：log（对数，默认）或 linear（线性） */
  sweepMode?: ACSweepMode;
  /** 起始频率 (Hz) */
  startFreq: number;
  /** 终止频率 (Hz) */
  stopFreq: number;
  /** 每十倍频采样点数（对数模式） */
  pointsPerDecade?: number;
  /** 总采样点数（线性模式） */
  numPoints?: number;
  /** 输入信号源 ID（传递函数计算） */
  inputSource?: string;
  /** 输出节点名称（传递函数计算） */
  outputNode?: string;
}

/** 瞬态分析配置 */
export interface TransientAnalysisConfig {
  type: typeof AnalysisType.Transient;
  /** 时间步长 (s) */
  stepTime: number;
  /** 总仿真时间 (s) */
  stopTime: number;
  /** 最大步长 (s, 可选) */
  maxStep?: number;
  /** 最小步长 (s, 可选) */
  minStep?: number;
  /** 是否启用自适应步长 */
  adaptiveStep?: boolean;
  /** 初始节点电压 {nodeId: voltage} */
  initialVoltages?: Record<string, number>;
  /** 截断误差容限 */
  truncErrorTol?: number;
}

/** 仿真分析配置联合类型 */
export type AnalysisConfig =
  | DCAnalysisConfig
  | ACAnalysisConfig
  | TransientAnalysisConfig;

/** 仿真配置 */
export interface SimulationConfig {
  /** 分析类型配置 */
  analysis: AnalysisConfig;
  /** 是否启用 */
  enabled: boolean;
}

// ==================== 仿真结果 ====================

/** 仿真数据点 */
export interface SimulationDataPoint {
  /** 时间或频率 */
  x: number;
  /** 电压或电流值 */
  y: number;
}

/** 仿真通道（一条波形） */
export interface SimulationChannel {
  /** 通道名称 */
  name: string;
  /** 关联的节点 ID */
  nodeId: string;
  /** 数据点 */
  data: SimulationDataPoint[];
  /** 显示颜色 */
  color: string;
  /** 是否可见 */
  visible: boolean;
}

/** 仿真结果 */
export interface SimulationResult {
  /** 关联的工程 ID */
  projectId: string;
  /** 仿真时间戳 */
  timestamp: number;
  /** 分析类型 */
  analysisType: AnalysisType;
  /** 数据通道列表 */
  channels: SimulationChannel[];
  /** 仿真状态 */
  status: 'running' | 'completed' | 'error';
  /** 错误信息（如果有） */
  error?: string;
}

// ==================== 画布交互 ====================

/** 画布工具模式 */
export const ToolMode = {
  Select: 'select',
  PlaceComponent: 'place_component',
  DrawWire: 'draw_wire',
  Pan: 'pan',
  Delete: 'delete',
  BoxSelect: 'box_select',
} as const;
export type ToolMode = (typeof ToolMode)[keyof typeof ToolMode];

/** 框选矩形 */
export interface BoxSelectRect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

/** 画布视图变换 */
export interface ViewTransform {
  /** 缩放比例 */
  scale: number;
  /** 平移偏移 */
  offsetX: number;
  offsetY: number;
}

/** 鼠标事件信息 */
export interface CanvasMouseEvent {
  /** 画布坐标 */
  canvasPosition: Point;
  /** 屏幕坐标 */
  screenPosition: Point;
  /** 是否按住 Shift */
  shiftKey: boolean;
  /** 是否按住 Ctrl/Cmd */
  ctrlKey: boolean;
}

// ==================== 验证 ====================

/** 验证错误严重级别 */
export const ValidationSeverity = {
  Error: 'error',
  Warning: 'warning',
  Info: 'info',
} as const;
export type ValidationSeverity = (typeof ValidationSeverity)[keyof typeof ValidationSeverity];

/** 验证消息 */
export interface ValidationMessage {
  /** 严重级别 */
  severity: ValidationSeverity;
  /** 消息文本 */
  message: string;
  /** 关联的元件/连线 ID（可选） */
  targetId?: string;
  /** 目标类型 */
  targetType?: 'component' | 'wire' | 'node' | 'circuit';
}

// ==================== 测量探针类型 ====================

/** 探针类型枚举 */
export const ProbeType = {
  Voltage: 'voltage',
  Current: 'current',
  Power: 'power',
} as const;
export type ProbeType = (typeof ProbeType)[keyof typeof ProbeType];

/** 探针颜色方案 */
export const PROBE_COLORS: Record<ProbeType, string> = {
  voltage: '#ff6b6b',
  current: '#4ecdc4',
  power: '#ffd93d',
};

/** 单次测量结果 */
export interface ProbeMeasurement {
  /** 探针元件 ID */
  probeId: string;
  /** 探针类型 */
  probeType: ProbeType;
  /** 关联的节点 ID */
  nodeId: string;
  /** 探针名称 */
  name: string;
  /** 探针颜色 */
  color: string;
  /** 当前瞬时值 */
  currentValue: number;
  /** 峰峰值 (Vpp / Ipp / Ppp) */
  peakToPeak: number;
  /** 有效值 (RMS) */
  rms: number;
  /** 最小值 */
  min: number;
  /** 最大值 */
  max: number;
  /** 平均值 */
  mean: number;
  /** 频率 (Hz)，从过零检测获得 */
  frequency: number | null;
  /** 单位 */
  unit: string;
  /** 数据点序列（用于波形显示） */
  data: SimulationDataPoint[];
}

/** 双探针相位差测量 */
export interface PhaseMeasurement {
  /** 探针 A ID */
  probeAId: string;
  /** 探针 B ID */
  probeBId: string;
  /** 相位差 (度) */
  phaseDeg: number;
  /** 时间差 (秒) */
  timeDelta: number;
}

// ==================== 网络标签类型 ====================

/** 网络标签类型 */
export const NetLabelKind = {
  Signal: 'signal',
  Power: 'power',
  Ground: 'ground',
  Bus: 'bus',
} as const;
export type NetLabelKind = (typeof NetLabelKind)[keyof typeof NetLabelKind];

/** 画布上的网络标签 */
export interface CanvasNetLabel {
  /** 唯一 ID */
  id: string;
  /** 网络名称（如 VCC, GND, CLK, DATA[0:7]） */
  name: string;
  /** 标签在画布上的位置 */
  position: Point;
  /** 连接的元件端口 */
  connectedPort?: {
    componentId: string;
    portId: string;
  };
  /** 标签类型 */
  labelType: NetLabelKind;
  /** 是否为全局网络 */
  isGlobal: boolean;
  /** 总线宽度（仅 Bus 类型） */
  busWidth?: number;
  /** 选中状态 */
  selected?: boolean;
}

// ==================== GPIO / MCU 类型 ====================

/** GPIO 引脚工作模式 */
export const GPIOMode = {
  Input: 'input',
  Output: 'output',
  Analog: 'analog',
  PWM: 'pwm',
} as const;
export type GPIOMode = (typeof GPIOMode)[keyof typeof GPIOMode];

/** 上拉/下拉配置 */
export const GPIOPull = {
  None: 'none',
  Up: 'up',
  Down: 'down',
} as const;
export type GPIOPull = (typeof GPIOPull)[keyof typeof GPIOPull];

/** 输出驱动类型 */
export const GPIOOutputType = {
  PushPull: 'push_pull',
  OpenDrain: 'open_drain',
} as const;
export type GPIOOutputType = (typeof GPIOOutputType)[keyof typeof GPIOOutputType];

/** GPIO 电平状态 */
export const GPIOLevel = {
  Low: 'low',
  High: 'high',
  Floating: 'floating',
} as const;
export type GPIOLevel = (typeof GPIOLevel)[keyof typeof GPIOLevel];

/** 中断触发模式 */
export const GPIOInterruptTrigger = {
  None: 'none',
  Rising: 'rising',
  Falling: 'falling',
  Both: 'both',
  Level: 'level',
} as const;
export type GPIOInterruptTrigger = (typeof GPIOInterruptTrigger)[keyof typeof GPIOInterruptTrigger];

/** 单个 GPIO 引脚配置 */
export interface GPIOPinConfig {
  pinNumber: number;
  name: string;
  mode: GPIOMode;
  pull: GPIOPull;
  outputType: GPIOOutputType;
  pullResistance: number;
  sourceCurrent: number;
  sinkCurrent: number;
  interruptMode: GPIOInterruptTrigger;
  adcRefVoltage: number;
  adcResolution: number;
  pwmFrequency: number;
  pwmDutyCycle: number;
}

/** GPIO 引脚运行时仿真状态 */
export interface GPIOPinState {
  pinNumber: number;
  level: GPIOLevel;
  voltage: number;
  current: number;
  adcValue: number;
  pwmOutput: number;
  interruptPending: boolean;
}

/** MCU 元件配置 */
export interface MCUConfig {
  chipName: string;
  vdd: number;
  groundRef: number;
  pins: GPIOPinConfig[];
}

/** 创建默认 GPIO 引脚配置 */
export function defaultPinConfig(pinNumber: number): GPIOPinConfig {
  const port = String.fromCharCode(65 + Math.floor(pinNumber / 8));
  const num = pinNumber % 8;
  return {
    pinNumber,
    name: `P${port}${num}`,
    mode: GPIOMode.Input,
    pull: GPIOPull.None,
    outputType: GPIOOutputType.PushPull,
    pullResistance: 40000,
    sourceCurrent: 20,
    sinkCurrent: 20,
    interruptMode: GPIOInterruptTrigger.None,
    adcRefVoltage: 3.3,
    adcResolution: 12,
    pwmFrequency: 1000,
    pwmDutyCycle: 0.5,
  };
}

/** 创建默认 MCU 配置 */
export function defaultMCUConfig(pinCount: number = 16): MCUConfig {
  const pins: GPIOPinConfig[] = [];
  for (let i = 0; i < pinCount; i++) {
    pins.push(defaultPinConfig(i));
  }
  return {
    chipName: 'VirtualMCU',
    vdd: 3.3,
    groundRef: 0,
    pins,
  };
}

// ==================== 协议仿真类型 ====================

/** 协议类型 */
export const ProtocolType = {
  SPI: 'spi',
  I2C: 'i2c',
  UART: 'uart',
  CAN: 'can',
} as const;
export type ProtocolType = (typeof ProtocolType)[keyof typeof ProtocolType];

/** SPI 模式 */
export type SPIMode = 0 | 1 | 2 | 3;

/** SPI 配置 */
export interface SPIConfig {
  mode: SPIMode;
  clockFreqHz: number;
  dataBits: 8 | 16 | 32;
  mosiData: number[];
  misoData: number[];
  csPolActiveLow: boolean;
}

/** I2C 地址模式 */
export type I2CAddressMode = 7 | 10;

/** I2C 速度模式 */
export type I2CSpeedMode = 'standard' | 'fast' | 'fast_plus';

/** I2C 传输类型 */
export type I2CTransferType = 'write' | 'read';

/** I2C 配置 */
export interface I2CConfig {
  addressMode: I2CAddressMode;
  speedMode: I2CSpeedMode;
  slaveAddress: number;
  transferType: I2CTransferType;
  data: number[];
  hasACK: boolean;
}

/** UART 校验位 */
export type UARTParity = 'none' | 'even' | 'odd';

/** UART 配置 */
export interface UARTConfig {
  baudRate: number;
  dataBits: 5 | 6 | 7 | 8;
  stopBits: 1 | 1.5 | 2;
  parity: UARTParity;
  txData: number[];
  bitOrderLSB: boolean;
}

/** CAN 波特率 */
export type CANBaudRate = 125000 | 250000 | 500000 | 1000000;

/** CAN 帧类型 */
export type CANFrameType = 'data' | 'remote' | 'error' | 'overload';

/** CAN 帧格式 */
export type CANFrameFormat = 'standard' | 'extended';

/** CAN 错误类型 */
export type CANErrorType = 'crc' | 'form' | 'ack' | 'bit' | 'stuff';

/** CAN 配置 */
export interface CANConfig {
  baudRate: CANBaudRate;
  frameFormat: CANFrameFormat;
  frameType: CANFrameType;
  id: number;
  dlc: number;
  data: number[];
  samplePoint: number; // 0.0-1.0, 默认 0.875
  sjw: number;         // 同步跳转宽度 1-4
  nodeCount: number;   // 参与仲裁的节点数
  errorInject?: CANErrorType;
}

/** 协议仿真请求 */
export interface ProtocolSimRequest {
  protocol: ProtocolType;
  spi?: SPIConfig;
  i2c?: I2CConfig;
  uart?: UARTConfig;
  can?: CANConfig;
}

/** 信号跳变事件 */
export interface SignalTransition {
  timeNs: number;
  value: number;
  label?: string;
  phase?: string;
}

/** 信号通道 */
export interface SignalChannel {
  name: string;
  color: string;
  transitions: SignalTransition[];
  data?: SimulationDataPoint[]; // 可选：已转换的连续数据点
  visible?: boolean;
}

/** 总线状态事件 */
export interface BusEvent {
  timeNs: number;
  state: string;
  label?: string;
}

/** Bit 级标注 */
export interface BitAnnotation {
  signalName: string;
  startTimeNs: number;
  endTimeNs: number;
  value: string;
}

/** 协议仿真结果 */
export interface ProtocolSimResult {
  protocol: ProtocolType;
  signals: SignalChannel[];
  busEvents: BusEvent[];
  bitAnnotations: BitAnnotation[];
  totalTimeNs: number;
  error?: string;
}
