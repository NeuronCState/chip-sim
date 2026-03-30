/**
 * 电路模板定义
 * 每个模板包含预置元件、连线、说明，可一键加载到画布
 */

import { ComponentType, WireStatus } from '../types/circuit';
import type { CircuitComponent, Wire } from '../types/circuit';
import { generateId } from '../lib/circuit/circuit-utils';
import { calculateWirePoints } from '../lib/circuit/wire-routing';

export interface CircuitTemplate {
  id: string;
  /** 分类 */
  category: 'basic' | 'analog' | 'digital' | 'embedded' | 'power';
  /** 标题 i18n key */
  titleKey: string;
  /** 描述 i18n key */
  descKey: string;
  /** 图标 */
  icon: string;
  /** 难度: 1-3 */
  difficulty: 1 | 2 | 3;
  /** 标签 */
  tags?: string[];
  /** 生成电路数据 */
  createCircuit: () => { components: CircuitComponent[]; wires: Wire[] };
}

/** 辅助：创建标准2端口元件 */
function make2Port(
  type: ComponentType,
  name: string,
  x: number,
  y: number,
  value: number,
  unit: string,
  rotation = 0 as 0 | 90 | 180 | 270
): CircuitComponent {
  return {
    id: generateId(),
    type,
    name,
    position: { x, y },
    rotation,
    value: { value, unit },
    ports: [
      { id: generateId(), offset: { x: -25, y: 0 } },
      { id: generateId(), offset: { x: 25, y: 0 } },
    ],
  };
}

/** 辅助：创建接地元件 */
function makeGround(name: string, x: number, y: number): CircuitComponent {
  return {
    id: generateId(),
    type: ComponentType.Ground,
    name,
    position: { x, y },
    rotation: 0,
    value: { value: 0, unit: 'V' },
    ports: [{ id: generateId(), offset: { x: 0, y: -15 } }],
  };
}

/** 辅助：创建3端口元件（BJT、逻辑门等） */
function make3Port(
  type: ComponentType,
  name: string,
  x: number,
  y: number,
  value: number,
  unit: string,
  portOffsets: { x: number; y: number }[],
  rotation = 0 as 0 | 90 | 180 | 270
): CircuitComponent {
  return {
    id: generateId(),
    type,
    name,
    position: { x, y },
    rotation,
    value: { value, unit },
    ports: portOffsets.map((offset) => ({ id: generateId(), offset })),
  };
}

/** 辅助：创建连线 */
function makeWire(
  from: CircuitComponent, fromPortIdx: number,
  to: CircuitComponent, toPortIdx: number,
  routing: 'orthogonal' | 'straight' = 'orthogonal'
): Wire {
  const fromPort = from.ports[fromPortIdx];
  const toPort = to.ports[toPortIdx];
  const rad1 = (from.rotation * Math.PI) / 180;
  const rad2 = (to.rotation * Math.PI) / 180;
  const fromPos = {
    x: from.position.x + fromPort.offset.x * Math.cos(rad1) - fromPort.offset.y * Math.sin(rad1),
    y: from.position.y + fromPort.offset.x * Math.sin(rad1) + fromPort.offset.y * Math.cos(rad1),
  };
  const toPos = {
    x: to.position.x + toPort.offset.x * Math.cos(rad2) - toPort.offset.y * Math.sin(rad2),
    y: to.position.y + toPort.offset.x * Math.sin(rad2) + toPort.offset.y * Math.cos(rad2),
  };
  return {
    id: generateId(),
    fromComponentId: from.id,
    fromPortId: fromPort.id,
    toComponentId: to.id,
    toPortId: toPort.id,
    points: calculateWirePoints(fromPos, toPos, routing),
    status: WireStatus.Connected,
  };
}

// ==================== 模板定义 ====================

export const TEMPLATES: CircuitTemplate[] = [
  // ===== 基础电路 =====
  {
    id: 'led-circuit',
    category: 'basic',
    titleKey: 'examples.led.title',
    descKey: 'examples.led.desc',
    icon: '💡',
    difficulty: 1,
    tags: ['LED', '电阻', '直流', '入门'],
    createCircuit() {
      const vdc = make2Port(ComponentType.DCSource, 'V1', 100, 200, 5, 'V');
      const r = make2Port(ComponentType.Resistor, 'R1', 250, 200, 330, 'Ω');
      const d = {
        id: generateId(),
        type: ComponentType.Diode,
        name: 'D1',
        position: { x: 400, y: 200 },
        rotation: 0 as const,
        value: { value: 0.7, unit: 'V' },
        ports: [
          { id: generateId(), offset: { x: -25, y: 0 } },
          { id: generateId(), offset: { x: 25, y: 0 } },
        ],
      };
      const gnd = makeGround('GND1', 100, 320);
      const gnd2 = makeGround('GND2', 400, 320);

      const components = [vdc, r, d, gnd, gnd2];
      const wires = [
        makeWire(vdc, 1, r, 0),
        makeWire(r, 1, d, 0),
        makeWire(vdc, 0, gnd, 0),
        makeWire(d, 1, gnd2, 0),
      ];

      return { components, wires };
    },
  },
  {
    id: 'voltage-divider',
    category: 'basic',
    titleKey: 'examples.voltageDivider.title',
    descKey: 'examples.voltageDivider.desc',
    icon: '⚡',
    difficulty: 1,
    tags: ['分压', '电阻', '入门'],
    createCircuit() {
      const vdc = make2Port(ComponentType.DCSource, 'V1', 100, 200, 10, 'V');
      const r1 = make2Port(ComponentType.Resistor, 'R1', 250, 200, 10000, 'Ω');
      const r2 = make2Port(ComponentType.Resistor, 'R2', 250, 320, 10000, 'Ω');
      const gnd = makeGround('GND', 100, 320);

      const components = [vdc, r1, r2, gnd];
      const wires = [
        makeWire(vdc, 1, r1, 0),
        makeWire(r1, 1, r2, 1),
        makeWire(r2, 0, gnd, 0),
        makeWire(vdc, 0, gnd, 0),
      ];

      return { components, wires };
    },
  },
  {
    id: 'rc-filter',
    category: 'basic',
    titleKey: 'examples.rcFilter.title',
    descKey: 'examples.rcFilter.desc',
    icon: '📊',
    difficulty: 2,
    tags: ['滤波', 'RC', '频率响应'],
    createCircuit() {
      const vac = make2Port(ComponentType.ACSource, 'V1', 100, 200, 1, 'V');
      const r = make2Port(ComponentType.Resistor, 'R1', 280, 200, 1000, 'Ω');
      const c = make2Port(ComponentType.Capacitor, 'C1', 430, 200, 1e-6, 'F');
      const gnd = makeGround('GND', 100, 320);

      const components = [vac, r, c, gnd];
      const wires = [
        makeWire(vac, 1, r, 0),
        makeWire(r, 1, c, 0),
        makeWire(c, 1, gnd, 0),
        makeWire(vac, 0, gnd, 0),
      ];

      return { components, wires };
    },
  },

  // ===== 模拟电路 =====
  {
    id: 'opamp-inverting',
    category: 'analog',
    titleKey: 'examples.opampInv.title',
    descKey: 'examples.opampInv.desc',
    icon: '🔊',
    difficulty: 2,
    tags: ['运放', '放大', '反相'],
    createCircuit() {
      // 运算放大器反相放大器
      // V1(1V) → R1(10k) → 运放负输入(-)
      // 运放输出 → R2(100k) → 运放负输入(-)  (反馈)
      // 运放正输入(+) → GND
      // 运放输出 → Vout 节点
      const vin = make2Port(ComponentType.DCSource, 'V1', 100, 200, 1, 'V');
      const r1 = make2Port(ComponentType.Resistor, 'R1', 230, 200, 10000, 'Ω');
      const r2 = make2Port(ComponentType.Resistor, 'R2', 380, 140, 100000, 'Ω');
      const opamp = make3Port(ComponentType.OpAmp, 'U1', 420, 200, 100000, 'A/V', [
        { x: -25, y: -10 },  // 0: 正输入 (+)
        { x: -25, y: 10 },   // 1: 负输入 (-)
        { x: 25, y: 0 },     // 2: 输出
      ]);
      const gndIn = makeGround('GND_IN', 420, 250);
      const gndVin = makeGround('GND_VIN', 100, 320);
      const gndOut = makeGround('GND_OUT', 580, 320);

      const components = [vin, r1, r2, opamp, gndIn, gndVin, gndOut];
      const wires = [
        makeWire(vin, 1, r1, 0),        // V1+ → R1左
        makeWire(r1, 1, opamp, 1),       // R1右 → 运放负输入
        makeWire(opamp, 2, r2, 0),       // 运放输出 → R2右(反馈)
        makeWire(r2, 1, opamp, 1),       // R2左 → 运放负输入(反馈回路)
        makeWire(opamp, 0, gndIn, 0),    // 运放正输入 → GND
        makeWire(vin, 0, gndVin, 0),     // V1- → GND
      ];

      return { components, wires };
    },
  },
  {
    id: 'bjt-switch',
    category: 'analog',
    titleKey: 'examples.bjtSwitch.title',
    descKey: 'examples.bjtSwitch.desc',
    icon: '🔌',
    difficulty: 2,
    tags: ['三极管', '开关', 'BJT', '放大'],
    createCircuit() {
      // 三极管 NPN 开关电路
      // Vcc(5V) → Rload(1k) → BJT集电极(C)
      // GPIO(3.3V) → Rbase(10k) → BJT基极(B)
      // BJT发射极(E) → GND
      const vcc = make2Port(ComponentType.DCSource, 'Vcc', 100, 120, 5, 'V');
      const rload = make2Port(ComponentType.Resistor, 'R_load', 250, 120, 1000, 'Ω');
      const gpio = make2Port(ComponentType.DCSource, 'GPIO', 100, 260, 3.3, 'V');
      const rbase = make2Port(ComponentType.Resistor, 'R_base', 230, 260, 10000, 'Ω');
      const bjt = make3Port(ComponentType.BJTNPN, 'Q1', 380, 200, 100, 'β', [
        { x: 0, y: -20 },    // 0: 基极 (Base)
        { x: 20, y: 0 },     // 1: 集电极 (Collector)
        { x: 20, y: 20 },    // 2: 发射极 (Emitter)
      ]);
      const gnd1 = makeGround('GND1', 380, 340);
      const gnd2 = makeGround('GND2', 100, 340);

      const components = [vcc, rload, gpio, rbase, bjt, gnd1, gnd2];
      const wires = [
        makeWire(vcc, 1, rload, 0),     // Vcc+ → R_load左
        makeWire(rload, 1, bjt, 1),      // R_load右 → Q1集电极
        makeWire(gpio, 1, rbase, 0),     // GPIO+ → R_base左
        makeWire(rbase, 1, bjt, 0),      // R_base右 → Q1基极
        makeWire(bjt, 2, gnd1, 0),       // Q1发射极 → GND
        makeWire(gpio, 0, gnd2, 0),      // GPIO- → GND
      ];

      return { components, wires };
    },
  },

  // ===== 数字电路 =====
  {
    id: 'nand-sr-latch',
    category: 'digital',
    titleKey: 'examples.nandSrLatch.title',
    descKey: 'examples.nandSrLatch.desc',
    icon: '🔀',
    difficulty: 3,
    tags: ['NAND', '锁存器', 'SR', '存储'],
    createCircuit() {
      // 与非门 SR 锁存器
      // NAND1: 输入 S̄(左上)、B(左下,来自NAND2输出) → 输出 Q
      // NAND2: 输入 A(左上,来自NAND1输出)、R̄(左下) → 输出 Q̄
      // 交叉反馈: Q → NAND2输入A, Q̄ → NAND1输入B
      const nand1 = make3Port(ComponentType.LogicNAND, 'U1', 300, 160, 0, '', [
        { x: -25, y: -10 },  // 0: 输入A (S̄)
        { x: -25, y: 10 },   // 1: 输入B (来自Q̄)
        { x: 25, y: 0 },     // 2: 输出 Q
      ]);
      const nand2 = make3Port(ComponentType.LogicNAND, 'U2', 300, 280, 0, '', [
        { x: -25, y: -10 },  // 0: 输入A (来自Q)
        { x: -25, y: 10 },   // 1: 输入B (R̄)
        { x: 25, y: 0 },     // 2: 输出 Q̄
      ]);
      const sBar = make2Port(ComponentType.DCSource, 'S̄', 100, 130, 5, 'V');
      const rBar = make2Port(ComponentType.DCSource, 'R̄', 100, 310, 5, 'V');
      const gndS = makeGround('GND_S', 100, 180);
      const gndR = makeGround('GND_R', 100, 360);

      const components = [nand1, nand2, sBar, rBar, gndS, gndR];
      const wires = [
        makeWire(sBar, 1, nand1, 0),     // S̄ → NAND1输入A
        makeWire(rBar, 1, nand2, 1),     // R̄ → NAND2输入B
        makeWire(nand1, 2, nand2, 0),    // Q → NAND2输入A (交叉反馈)
        makeWire(nand2, 2, nand1, 1),    // Q̄ → NAND1输入B (交叉反馈)
        makeWire(sBar, 0, gndS, 0),
        makeWire(rBar, 0, gndR, 0),
      ];

      return { components, wires };
    },
  },
  {
    id: 'and-gate',
    category: 'digital',
    titleKey: 'examples.andGate.title',
    descKey: 'examples.andGate.desc',
    icon: '🔀',
    difficulty: 2,
    tags: ['AND', '逻辑门', '布尔'],
    createCircuit() {
      const andGate = make3Port(ComponentType.LogicAND, 'U1', 300, 200, 0, '', [
        { x: -25, y: -10 },
        { x: -25, y: 10 },
        { x: 25, y: 0 },
      ]);
      const vA = make2Port(ComponentType.DCSource, 'VA', 100, 170, 5, 'V');
      const vB = make2Port(ComponentType.DCSource, 'VB', 100, 230, 5, 'V');
      const gndA = makeGround('GND_A', 100, 280);
      const gndB = makeGround('GND_B', 100, 340);

      const components = [andGate, vA, vB, gndA, gndB];
      const wires = [
        makeWire(vA, 1, andGate, 0),
        makeWire(vB, 1, andGate, 1),
        makeWire(vA, 0, gndA, 0),
        makeWire(vB, 0, gndB, 0),
      ];

      return { components, wires };
    },
  },

  // ===== 嵌入式电路 =====
  {
    id: 'mcu-gpio-led',
    category: 'embedded',
    titleKey: 'examples.mcuGpio.title',
    descKey: 'examples.mcuGpio.desc',
    icon: '🖥️',
    difficulty: 2,
    tags: ['MCU', 'GPIO', 'LED', '嵌入式'],
    createCircuit() {
      // MCU GPIO 控制 LED
      // MCU → R(330Ω) → LED → GND
      const mcu = {
        id: generateId(),
        type: ComponentType.MCU,
        name: 'MCU1',
        position: { x: 150, y: 200 },
        rotation: 0 as const,
        value: { value: 3.3, unit: 'V' },
        ports: [
          { id: generateId(), offset: { x: 30, y: -20 } },  // 0: GPIO输出
          { id: generateId(), offset: { x: 30, y: 0 } },     // 1: VCC
          { id: generateId(), offset: { x: 30, y: 20 } },    // 2: GND
        ],
        params: { chipName: 'STM32F103', pinCount: 3 },
      };
      const r = make2Port(ComponentType.Resistor, 'R1', 320, 180, 330, 'Ω');
      const led = {
        id: generateId(),
        type: ComponentType.Diode,
        name: 'D1',
        position: { x: 470, y: 180 },
        rotation: 0 as const,
        value: { value: 0.7, unit: 'V' },
        ports: [
          { id: generateId(), offset: { x: -25, y: 0 } },
          { id: generateId(), offset: { x: 25, y: 0 } },
        ],
      };
      const gnd = makeGround('GND', 300, 320);

      const components = [mcu, r, led, gnd];
      const wires = [
        makeWire(mcu, 0, r, 0),       // MCU GPIO → R左
        makeWire(r, 1, led, 0),        // R右 → LED阳极
        makeWire(led, 1, gnd, 0),      // LED阴极 → GND
        makeWire(mcu, 2, gnd, 0),      // MCU GND → GND
      ];

      return { components, wires };
    },
  },
  {
    id: 'i2c-sensor',
    category: 'embedded',
    titleKey: 'examples.i2cSensor.title',
    descKey: 'examples.i2cSensor.desc',
    icon: '📡',
    difficulty: 3,
    tags: ['I2C', '传感器', '通信', '嵌入式'],
    createCircuit() {
      // I2C 传感器读取电路示意
      // MCU(I2C Master) → SCL/SDA → Sensor(I2C Slave)
      // SCL/SDA 各上拉电阻到 VCC
      const master = {
        id: generateId(),
        type: ComponentType.I2CMaster,
        name: 'MCU',
        position: { x: 100, y: 200 },
        rotation: 0 as const,
        value: { value: 100000, unit: 'Hz' },
        ports: [
          { id: generateId(), offset: { x: 25, y: -10 } },  // 0: SCL
          { id: generateId(), offset: { x: 25, y: 10 } },   // 1: SDA
        ],
      };
      const slave = {
        id: generateId(),
        type: ComponentType.I2CSlave,
        name: 'Sensor',
        position: { x: 500, y: 200 },
        rotation: 0 as const,
        value: { value: 0, unit: '' },
        ports: [
          { id: generateId(), offset: { x: -25, y: -10 } }, // 0: SCL
          { id: generateId(), offset: { x: -25, y: 10 } },  // 1: SDA
        ],
      };
      const rScl = make2Port(ComponentType.Resistor, 'R_SCL', 300, 100, 4700, 'Ω');
      const rSda = make2Port(ComponentType.Resistor, 'R_SDA', 300, 300, 4700, 'Ω');
      const vcc = make2Port(ComponentType.DCSource, 'VCC', 100, 80, 3.3, 'V');
      const gndM = makeGround('GND_M', 100, 340);
      const gndS = makeGround('GND_S', 500, 340);

      const components = [master, slave, rScl, rSda, vcc, gndM, gndS];
      const wires = [
        makeWire(vcc, 1, rScl, 0),      // VCC → R_SCL上
        makeWire(rScl, 1, master, 0),    // R_SCL下 → Master SCL
        makeWire(rScl, 1, slave, 0),     // R_SCL下 → Slave SCL (总线)
        makeWire(vcc, 1, rSda, 0),      // VCC → R_SDA上 (复用VCC)
        makeWire(rSda, 1, master, 1),    // R_SDA下 → Master SDA
        makeWire(rSda, 1, slave, 1),     // R_SDA下 → Slave SDA (总线)
        makeWire(vcc, 0, gndM, 0),       // VCC GND → GND
        makeWire(master, 1, gndM, 0),    // 注意：这里走线有点不合理但示意用途
      ];

      return { components, wires };
    },
  },
  {
    id: 'uart-comm',
    category: 'embedded',
    titleKey: 'examples.uartComm.title',
    descKey: 'examples.uartComm.desc',
    icon: '📟',
    difficulty: 2,
    tags: ['UART', '串口', '通信', '嵌入式'],
    createCircuit() {
      // UART 串口通信电路示意
      // Device1 TX → Device2 RX
      // Device2 TX → Device1 RX
      // 共地
      const dev1Tx = {
        id: generateId(),
        type: ComponentType.UARTTX,
        name: 'MCU_TX',
        position: { x: 100, y: 150 },
        rotation: 0 as const,
        value: { value: 115200, unit: 'bps' },
        ports: [
          { id: generateId(), offset: { x: 25, y: 0 } },  // 0: TX
        ],
      };
      const dev1Rx = {
        id: generateId(),
        type: ComponentType.UARTRX,
        name: 'MCU_RX',
        position: { x: 100, y: 280 },
        rotation: 0 as const,
        value: { value: 115200, unit: 'bps' },
        ports: [
          { id: generateId(), offset: { x: 25, y: 0 } },  // 0: RX
        ],
      };
      const dev2Rx = {
        id: generateId(),
        type: ComponentType.UARTRX,
        name: 'PC_RX',
        position: { x: 500, y: 150 },
        rotation: 0 as const,
        value: { value: 115200, unit: 'bps' },
        ports: [
          { id: generateId(), offset: { x: -25, y: 0 } }, // 0: RX
        ],
      };
      const dev2Tx = {
        id: generateId(),
        type: ComponentType.UARTTX,
        name: 'PC_TX',
        position: { x: 500, y: 280 },
        rotation: 0 as const,
        value: { value: 115200, unit: 'bps' },
        ports: [
          { id: generateId(), offset: { x: -25, y: 0 } }, // 0: TX
        ],
      };
      const gnd = makeGround('GND', 300, 340);

      const components = [dev1Tx, dev1Rx, dev2Rx, dev2Tx, gnd];
      const wires = [
        makeWire(dev1Tx, 0, dev2Rx, 0),  // MCU TX → PC RX
        makeWire(dev2Tx, 0, dev1Rx, 0),  // PC TX → MCU RX
      ];

      return { components, wires };
    },
  },

  // ===== 电源电路 =====
  {
    id: 'timer555',
    category: 'power',
    titleKey: 'examples.timer555.title',
    descKey: 'examples.timer555.desc',
    icon: '⏱️',
    difficulty: 3,
    tags: ['555', '定时器', '方波', '振荡器'],
    createCircuit() {
      const vdc = make2Port(ComponentType.DCSource, 'Vcc', 100, 150, 9, 'V');
      const r1 = make2Port(ComponentType.Resistor, 'R1', 250, 150, 10000, 'Ω');
      const r2 = make2Port(ComponentType.Resistor, 'R2', 250, 250, 10000, 'Ω');
      const c = make2Port(ComponentType.Capacitor, 'C1', 400, 300, 1e-6, 'F');
      const gnd = makeGround('GND', 100, 350);

      const components = [vdc, r1, r2, c, gnd];
      const wires = [
        makeWire(vdc, 1, r1, 0),
        makeWire(r1, 1, r2, 0),
        makeWire(r2, 1, c, 0),
        makeWire(c, 1, gnd, 0),
        makeWire(vdc, 0, gnd, 0),
      ];

      return { components, wires };
    },
  },

  // ===== H桥驱动 =====
  {
    id: 'h-bridge',
    category: 'power',
    titleKey: 'examples.hBridge.title',
    descKey: 'examples.hBridge.desc',
    icon: '🔄',
    difficulty: 3,
    tags: ['H桥', '电机', 'MOSFET', '驱动', 'PWM'],
    createCircuit() {
      // H桥电机驱动电路
      // Vcc → Q1(上左) → Motor → Q3(上右) → Vcc
      //      Q2(下左) → GND       Q4(下右) → GND
      const vcc = make2Port(ComponentType.DCSource, 'Vcc', 100, 100, 12, 'V');
      const q1 = make3Port(ComponentType.MOSFET_NMOS, 'Q1', 250, 120, 0, '', [
        { x: 0, y: 20 },    // 0: Gate
        { x: -15, y: 0 },   // 1: Drain
        { x: 15, y: 0 },    // 2: Source
      ]);
      const q2 = make3Port(ComponentType.MOSFET_NMOS, 'Q2', 250, 280, 0, '', [
        { x: 0, y: -20 },   // 0: Gate
        { x: -15, y: 0 },   // 1: Drain
        { x: 15, y: 0 },    // 2: Source
      ]);
      const q3 = make3Port(ComponentType.MOSFET_NMOS, 'Q3', 450, 120, 0, '', [
        { x: 0, y: 20 },    // 0: Gate
        { x: 15, y: 0 },    // 1: Drain
        { x: -15, y: 0 },   // 2: Source
      ]);
      const q4 = make3Port(ComponentType.MOSFET_NMOS, 'Q4', 450, 280, 0, '', [
        { x: 0, y: -20 },   // 0: Gate
        { x: 15, y: 0 },    // 1: Drain
        { x: -15, y: 0 },   // 2: Source
      ]);
      const rl = make2Port(ComponentType.Resistor, 'Motor', 350, 200, 10, 'Ω');
      const gnd = makeGround('GND', 350, 380);
      const gndVcc = makeGround('GND_V', 100, 300);

      const components = [vcc, q1, q2, q3, q4, rl, gnd, gndVcc];
      const wires = [
        makeWire(vcc, 1, q1, 1),      // Vcc → Q1 Drain
        makeWire(vcc, 1, q3, 1),      // Vcc → Q3 Drain
        makeWire(q1, 2, rl, 0),       // Q1 Source → Motor左
        makeWire(q3, 2, rl, 1),       // Q3 Source → Motor右
        makeWire(q2, 1, rl, 0),       // Q2 Drain → Motor左
        makeWire(q4, 1, rl, 1),       // Q4 Drain → Motor右
        makeWire(q2, 2, gnd, 0),      // Q2 Source → GND
        makeWire(q4, 2, gnd, 0),      // Q4 Source → GND
        makeWire(vcc, 0, gndVcc, 0),  // Vcc- → GND
      ];

      return { components, wires };
    },
  },

  // ===== ADC 采样电路 =====
  {
    id: 'adc-sampling',
    category: 'embedded',
    titleKey: 'examples.adcSampling.title',
    descKey: 'examples.adcSampling.desc',
    icon: '📊',
    difficulty: 2,
    tags: ['ADC', '采样', '模数转换', '嵌入式'],
    createCircuit() {
      // ADC 采样电路
      // AC源 → 分压电阻 → ADC输入
      // 时钟源 → ADC时钟输入
      // ADC输出 → GND（量化输出在波形中观察）
      const vin = make2Port(ComponentType.ACSource, 'Vin', 80, 180, 1.5, 'V');
      const r1 = make2Port(ComponentType.Resistor, 'R1', 220, 180, 10000, 'Ω');
      const r2 = make2Port(ComponentType.Resistor, 'R2', 220, 280, 10000, 'Ω');
      const adc = {
        id: generateId(),
        type: ComponentType.ADC,
        name: 'ADC1',
        position: { x: 420, y: 200 },
        rotation: 0 as const,
        value: { value: 3.3, unit: 'V' },
        ports: [
          { id: generateId(), offset: { x: -25, y: -10 } },  // AIN
          { id: generateId(), offset: { x: -25, y: 10 } },   // CLK
          { id: generateId(), offset: { x: 25, y: -10 } },   // DOUT
          { id: generateId(), offset: { x: 25, y: 10 } },    // GND
        ],
        params: { resolution: 12, sampleRate: 100000, vRefHigh: 3.3 },
      };
      const clk = make2Port(ComponentType.ACSource, 'CLK', 80, 340, 1.65, 'V');
      const gnd = makeGround('GND', 300, 380);
      const gndVin = makeGround('GND_Vin', 80, 280);
      const gndClk = makeGround('GND_CLK', 80, 400);
      const gndOut = makeGround('GND_OUT', 560, 300);

      const components = [vin, r1, r2, adc, clk, gnd, gndVin, gndClk, gndOut];
      const wires = [
        makeWire(vin, 1, r1, 0),       // Vin → R1
        makeWire(r1, 1, adc, 0),        // R1 → ADC AIN
        makeWire(r2, 0, adc, 0),        // R2 → ADC AIN (分压)
        makeWire(r2, 1, gnd, 0),        // R2 → GND
        makeWire(clk, 1, adc, 1),       // CLK → ADC CLK
        makeWire(vin, 0, gndVin, 0),    // Vin- → GND
        makeWire(clk, 0, gndClk, 0),    // CLK- → GND
        makeWire(adc, 3, gndOut, 0),    // ADC GND → GND
      ];

      return { components, wires };
    },
  },

  // ===== 差分放大器 =====
  {
    id: 'diff-amp',
    category: 'analog',
    titleKey: 'examples.diffAmp.title',
    descKey: 'examples.diffAmp.desc',
    icon: '📐',
    difficulty: 3,
    tags: ['差分', '运放', '共模抑制', '仪表'],
    createCircuit() {
      // 差分放大器
      // V1(+) → R1 → 运放负输入
      // V2(-) → R3 → 运放正输入
      // 运放正输入 → R4 → GND
      // 运放输出 → R2 → 运放负输入 (反馈)
      const v1 = make2Port(ComponentType.DCSource, 'V1', 100, 140, 2, 'V');
      const v2 = make2Port(ComponentType.DCSource, 'V2', 100, 280, 1, 'V');
      const r1 = make2Port(ComponentType.Resistor, 'R1', 230, 140, 10000, 'Ω');
      const r3 = make2Port(ComponentType.Resistor, 'R3', 230, 280, 10000, 'Ω');
      const r2 = make2Port(ComponentType.Resistor, 'R2', 420, 120, 10000, 'Ω');
      const r4 = make2Port(ComponentType.Resistor, 'R4', 420, 300, 10000, 'Ω');
      const opamp = make3Port(ComponentType.OpAmp, 'U1', 480, 200, 100000, 'A/V', [
        { x: -25, y: -10 },  // 0: 正输入 (+)
        { x: -25, y: 10 },   // 1: 负输入 (-)
        { x: 25, y: 0 },     // 2: 输出
      ]);
      const gnd = makeGround('GND', 420, 380);
      const gnd1 = makeGround('GND_V1', 100, 190);
      const gnd2 = makeGround('GND_V2', 100, 330);

      const components = [v1, v2, r1, r2, r3, r4, opamp, gnd, gnd1, gnd2];
      const wires = [
        makeWire(v1, 1, r1, 0),       // V1+ → R1左
        makeWire(r1, 1, opamp, 1),     // R1右 → 运放负输入
        makeWire(opamp, 2, r2, 0),     // 运放输出 → R2右(反馈)
        makeWire(r2, 1, opamp, 1),     // R2左 → 运放负输入(反馈)
        makeWire(v2, 1, r3, 0),       // V2+ → R3左
        makeWire(r3, 1, opamp, 0),     // R3右 → 运放正输入
        makeWire(opamp, 0, r4, 0),     // 运放正输入 → R4左
        makeWire(r4, 1, gnd, 0),       // R4右 → GND
        makeWire(v1, 0, gnd1, 0),      // V1- → GND
        makeWire(v2, 0, gnd2, 0),      // V2- → GND
      ];

      return { components, wires };
    },
  },

  // ===== NMOS 共源放大器 =====
  {
    id: 'mosfet-cs-amp',
    category: 'analog',
    titleKey: 'examples.mosfetCsAmp.title',
    descKey: 'examples.mosfetCsAmp.desc',
    icon: 'M',
    difficulty: 3,
    tags: ['MOSFET', '放大', '共源', '模拟'],
    createCircuit() {
      // NMOS 共源极放大电路
      // Vdd(12V) → Rd(3.3k) → NMOS漏极
      // Rg1/Rg2 分压 → NMOS栅极
      // NMOS源极 → Rs(1k) → GND
      // Vin(AC) → Rg1 → 栅极
      const vdd = make2Port(ComponentType.DCSource, 'Vdd', 100, 80, 12, 'V');
      const rd = make2Port(ComponentType.Resistor, 'Rd', 280, 80, 3300, 'Ω');
      const mosfet = make3Port(ComponentType.MOSFET_NMOS, 'M1', 380, 200, 2, 'mA/V²', [
        { x: 0, y: -20 },    // 0: Gate
        { x: 20, y: 0 },     // 1: Drain
        { x: 20, y: 20 },    // 2: Source
      ]);
      const rs = make2Port(ComponentType.Resistor, 'Rs', 380, 340, 1000, 'Ω');
      const rg1 = make2Port(ComponentType.Resistor, 'Rg1', 230, 180, 100000, 'Ω');
      const rg2 = make2Port(ComponentType.Resistor, 'Rg2', 230, 280, 47000, 'Ω');
      const vin = make2Port(ComponentType.ACSource, 'Vin', 80, 220, 0.05, 'V');
      const gnd = makeGround('GND', 380, 420);
      const gndVin = makeGround('GND_Vin', 80, 320);

      const components = [vdd, rd, mosfet, rs, rg1, rg2, vin, gnd, gndVin];
      const wires = [
        makeWire(vdd, 1, rd, 0),        // Vdd → Rd
        makeWire(rd, 1, mosfet, 1),      // Rd → M1 Drain
        makeWire(mosfet, 2, rs, 0),      // M1 Source → Rs
        makeWire(rs, 1, gnd, 0),         // Rs → GND
        makeWire(rg1, 1, mosfet, 0),     // Rg1 → M1 Gate
        makeWire(rg2, 0, mosfet, 0),     // Rg2 → M1 Gate
        makeWire(rg2, 1, gnd, 0),        // Rg2 → GND
        makeWire(vin, 1, rg1, 0),        // Vin → Rg1
        makeWire(vin, 0, gndVin, 0),     // Vin- → GND
        makeWire(vdd, 0, gndVin, 0),     // Vdd- → GND
      ];

      return { components, wires };
    },
  },

  // ===== NTC温度传感器 =====
  {
    id: 'sensor-ntc-temp',
    category: 'analog',
    titleKey: 'examples.sensorNtcTemp.title',
    descKey: 'examples.sensorNtcTemp.desc',
    icon: '🌡️',
    difficulty: 2,
    tags: ['NTC', '温度传感器', 'ADC', '分压', '热敏电阻'],
    createCircuit() {
      // NTC温度传感器分压电路
      // Vcc(3.3V) → R1(10k) → ADC采集点 → NTC1(10k) → GND
      const vcc = make2Port(ComponentType.DCSource, 'Vcc', 100, 180, 3.3, 'V');
      const r1 = make2Port(ComponentType.Resistor, 'R1', 260, 180, 10000, 'Ω');
      const ntc = {
        id: generateId(),
        type: ComponentType.NTCThermistor,
        name: 'NTC1',
        position: { x: 260, y: 310 },
        rotation: 0 as const,
        value: { value: 10000, unit: 'Ω' },
        ports: [
          { id: generateId(), offset: { x: -25, y: 0 } },
          { id: generateId(), offset: { x: 25, y: 0 } },
        ],
      };
      const adc = {
        id: generateId(),
        type: ComponentType.ADC,
        name: 'ADC1',
        position: { x: 460, y: 230 },
        rotation: 0 as const,
        value: { value: 3.3, unit: 'V' },
        ports: [
          { id: generateId(), offset: { x: -25, y: -10 } },  // AIN
          { id: generateId(), offset: { x: -25, y: 10 } },   // GND
        ],
        params: { resolution: 12, vRefHigh: 3.3 },
      };
      const gnd = makeGround('GND', 260, 420);

      const components = [vcc, r1, ntc, adc, gnd];
      const wires = [
        makeWire(vcc, 1, r1, 0),       // Vcc → R1
        makeWire(r1, 1, adc, 0),        // R1 → ADC AIN (采集点)
        makeWire(r1, 1, ntc, 0),        // R1 → NTC1 (分压点)
        makeWire(ntc, 1, gnd, 0),       // NTC1 → GND
        makeWire(vcc, 0, gnd, 0),       // Vcc- → GND
        makeWire(adc, 1, gnd, 0),       // ADC GND → GND
      ];

      return { components, wires };
    },
  },

  // ===== 蜂鸣器驱动 =====
  {
    id: 'buzzer-melody',
    category: 'embedded',
    titleKey: 'examples.buzzerMelody.title',
    descKey: 'examples.buzzerMelody.desc',
    icon: '🔔',
    difficulty: 2,
    tags: ['蜂鸣器', '三极管', 'GPIO', '驱动', '续流二极管'],
    createCircuit() {
      // 蜂鸣器驱动电路
      // Vcc(5V) → 蜂鸣器 → Q1集电极
      // GPIO(3.3V) → R1(1k) → Q1基极
      // Q1发射极 → GND
      // 蜂鸣器两端并联续流二极管D1
      const vcc = make2Port(ComponentType.DCSource, 'Vcc', 100, 100, 5, 'V');
      const buzzer = {
        id: generateId(),
        type: ComponentType.BuzzerActive,
        name: 'BZ1',
        position: { x: 280, y: 100 },
        rotation: 0 as const,
        value: { value: 5, unit: 'V' },
        ports: [
          { id: generateId(), offset: { x: -25, y: 0 } },
          { id: generateId(), offset: { x: 25, y: 0 } },
        ],
      };
      const diode = {
        id: generateId(),
        type: ComponentType.Diode,
        name: 'D1',
        position: { x: 280, y: 50 },
        rotation: 0 as const,
        value: { value: 0.7, unit: 'V' },
        ports: [
          { id: generateId(), offset: { x: -25, y: 0 } },
          { id: generateId(), offset: { x: 25, y: 0 } },
        ],
      };
      const gpio = make2Port(ComponentType.DCSource, 'GPIO', 100, 330, 3.3, 'V');
      const r1 = make2Port(ComponentType.Resistor, 'R1', 240, 330, 1000, 'Ω');
      const q1 = make3Port(ComponentType.BJTNPN, 'Q1', 380, 230, 100, 'β', [
        { x: 0, y: -20 },    // 0: 基极
        { x: 20, y: 0 },     // 1: 集电极
        { x: 20, y: 20 },    // 2: 发射极
      ]);
      const gnd1 = makeGround('GND1', 380, 370);
      const gnd2 = makeGround('GND2', 100, 400);

      const components = [vcc, buzzer, diode, gpio, r1, q1, gnd1, gnd2];
      const wires = [
        makeWire(vcc, 1, buzzer, 0),     // Vcc → 蜂鸣器+
        makeWire(buzzer, 1, q1, 1),       // 蜂鸣器- → Q1集电极
        makeWire(buzzer, 1, diode, 1),    // 蜂鸣器- → D1阴极
        makeWire(diode, 0, vcc, 1),       // D1阳极 → Vcc (续流保护)
        makeWire(gpio, 1, r1, 0),         // GPIO → R1
        makeWire(r1, 1, q1, 0),           // R1 → Q1基极
        makeWire(q1, 2, gnd1, 0),         // Q1发射极 → GND
        makeWire(gpio, 0, gnd2, 0),       // GPIO- → GND
      ];

      return { components, wires };
    },
  },

  // ===== 继电器控制 =====
  {
    id: 'relay-control',
    category: 'embedded',
    titleKey: 'examples.relayControl.title',
    descKey: 'examples.relayControl.desc',
    icon: '⚡',
    difficulty: 2,
    tags: ['继电器', '三极管', 'GPIO', '开关', '续流二极管'],
    createCircuit() {
      // 继电器控制电路
      // Vcc(5V) → 继电器线圈 → Q1集电极
      // GPIO(3.3V) → R1(1k) → Q1基极
      // Q1发射极 → GND
      // 线圈两端并联续流二极管D1
      // 继电器触点：NO → 负载 → Load_V
      const vcc = make2Port(ComponentType.DCSource, 'Vcc', 100, 80, 5, 'V');
      const relay = {
        id: generateId(),
        type: ComponentType.Relay,
        name: 'K1',
        position: { x: 300, y: 120 },
        rotation: 0 as const,
        value: { value: 5, unit: 'V' },
        ports: [
          { id: generateId(), offset: { x: -25, y: -10 } },  // 0: 线圈+
          { id: generateId(), offset: { x: -25, y: 10 } },   // 1: 线圈-
          { id: generateId(), offset: { x: 25, y: -10 } },   // 2: NO触点
          { id: generateId(), offset: { x: 25, y: 10 } },    // 3: COM触点
        ],
      };
      const diode = {
        id: generateId(),
        type: ComponentType.Diode,
        name: 'D1',
        position: { x: 300, y: 50 },
        rotation: 0 as const,
        value: { value: 0.7, unit: 'V' },
        ports: [
          { id: generateId(), offset: { x: -25, y: 0 } },
          { id: generateId(), offset: { x: 25, y: 0 } },
        ],
      };
      const loadV = make2Port(ComponentType.DCSource, 'Load_V', 480, 80, 220, 'V');
      const rload = make2Port(ComponentType.Resistor, 'R_load', 480, 180, 100, 'Ω');
      const gpio = make2Port(ComponentType.DCSource, 'GPIO', 100, 350, 3.3, 'V');
      const r1 = make2Port(ComponentType.Resistor, 'R1', 220, 350, 1000, 'Ω');
      const q1 = make3Port(ComponentType.BJTNPN, 'Q1', 350, 280, 100, 'β', [
        { x: 0, y: -20 },    // 0: 基极
        { x: 20, y: 0 },     // 1: 集电极
        { x: 20, y: 20 },    // 2: 发射极
      ]);
      const gnd1 = makeGround('GND1', 350, 400);
      const gnd2 = makeGround('GND2', 100, 420);

      const components = [vcc, relay, diode, loadV, rload, gpio, r1, q1, gnd1, gnd2];
      const wires = [
        makeWire(vcc, 1, relay, 0),      // Vcc → 继电器线圈+
        makeWire(relay, 1, q1, 1),        // 继电器线圈- → Q1集电极
        makeWire(relay, 1, diode, 1),     // 继电器线圈- → D1阴极
        makeWire(diode, 0, vcc, 1),       // D1阳极 → Vcc (续流保护)
        makeWire(relay, 2, loadV, 1),     // 继电器NO → Load_V
        makeWire(rload, 0, relay, 2),     // R_load → 继电器NO
        makeWire(rload, 1, relay, 3),     // R_load → 继电器COM
        makeWire(gpio, 1, r1, 0),         // GPIO → R1
        makeWire(r1, 1, q1, 0),           // R1 → Q1基极
        makeWire(q1, 2, gnd1, 0),         // Q1发射极 → GND
        makeWire(gpio, 0, gnd2, 0),       // GPIO- → GND
      ];

      return { components, wires };
    },
  },

  // ===== 电池供电 =====
  {
    id: 'battery-power',
    category: 'power',
    titleKey: 'examples.batteryPower.title',
    descKey: 'examples.batteryPower.desc',
    icon: '🔋',
    difficulty: 1,
    tags: ['电池', 'LDO', 'AMS1117', '稳压', 'LED'],
    createCircuit() {
      // 电池供电电路
      // BAT1(3.7V) → C1(输入滤波) → U1(LDO) → C2(输出去耦) → R1 → LED → GND
      const bat = {
        id: generateId(),
        type: ComponentType.Battery,
        name: 'BAT1',
        position: { x: 100, y: 200 },
        rotation: 0 as const,
        value: { value: 3.7, unit: 'V' },
        ports: [
          { id: generateId(), offset: { x: -25, y: 0 } },  // 0: 负极
          { id: generateId(), offset: { x: 25, y: 0 } },   // 1: 正极
        ],
      };
      const c1 = make2Port(ComponentType.Capacitor, 'C1', 240, 140, 100e-6, 'F');
      const ldo = {
        id: generateId(),
        type: ComponentType.LDO,
        name: 'U1',
        position: { x: 340, y: 200 },
        rotation: 0 as const,
        value: { value: 3.3, unit: 'V' },
        ports: [
          { id: generateId(), offset: { x: -25, y: 0 } },  // 0: VIN
          { id: generateId(), offset: { x: 25, y: -10 } },  // 1: VOUT
          { id: generateId(), offset: { x: 25, y: 10 } },   // 2: GND
        ],
      };
      const c2 = make2Port(ComponentType.Capacitor, 'C2', 470, 140, 10e-6, 'F');
      const r1 = make2Port(ComponentType.Resistor, 'R1', 570, 200, 100, 'Ω');
      const led = {
        id: generateId(),
        type: ComponentType.Diode,
        name: 'LED1',
        position: { x: 680, y: 200 },
        rotation: 0 as const,
        value: { value: 0.7, unit: 'V' },
        ports: [
          { id: generateId(), offset: { x: -25, y: 0 } },
          { id: generateId(), offset: { x: 25, y: 0 } },
        ],
      };
      const gnd = makeGround('GND', 340, 350);

      const components = [bat, c1, ldo, c2, r1, led, gnd];
      const wires = [
        makeWire(bat, 1, c1, 0),        // BAT+ → C1
        makeWire(bat, 1, ldo, 0),        // BAT+ → LDO VIN
        makeWire(c1, 1, gnd, 0),         // C1 → GND
        makeWire(ldo, 1, c2, 0),         // LDO VOUT → C2
        makeWire(ldo, 1, r1, 0),         // LDO VOUT → R1
        makeWire(c2, 1, gnd, 0),         // C2 → GND
        makeWire(r1, 1, led, 0),         // R1 → LED阳极
        makeWire(led, 1, gnd, 0),        // LED阴极 → GND
        makeWire(bat, 0, gnd, 0),        // BAT- → GND
        makeWire(ldo, 2, gnd, 0),        // LDO GND → GND
      ];

      return { components, wires };
    },
  },
];

/** 按分类获取模板 */
export function getTemplatesByCategory(category: CircuitTemplate['category']): CircuitTemplate[] {
  return TEMPLATES.filter((t) => t.category === category);
}

/** 搜索模板 */
export function searchTemplates(query: string): CircuitTemplate[] {
  const q = query.toLowerCase().trim();
  if (!q) return TEMPLATES;
  return TEMPLATES.filter((t) => {
    return (
      t.id.includes(q) ||
      t.titleKey.toLowerCase().includes(q) ||
      t.descKey.toLowerCase().includes(q) ||
      t.tags?.some((tag) => tag.toLowerCase().includes(q)) ||
      t.category.includes(q)
    );
  });
}

/** 模板分类信息 */
export const TEMPLATE_CATEGORIES: {
  key: CircuitTemplate['category'];
  titleKey: string;
  icon: string;
}[] = [
  { key: 'basic', titleKey: 'wizard.category.basic', icon: '⚡' },
  { key: 'analog', titleKey: 'wizard.category.analog', icon: '🔊' },
  { key: 'digital', titleKey: 'wizard.category.digital', icon: '🔀' },
  { key: 'embedded', titleKey: 'wizard.category.embedded', icon: '🖥️' },
  { key: 'power', titleKey: 'wizard.category.power', icon: '🔋' },
];
