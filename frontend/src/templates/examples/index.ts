/**
 * 示例电路库
 * 预置的示例电路，可直接加载到画布
 * 每个示例包含电路数据和学习说明
 */

// ==================== 示例电路定义 ====================

export interface ExampleCircuit {
  id: string;
  /** 名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 图标 */
  icon: string;
  /** 分类 */
  category: 'basic' | 'analog' | 'digital' | 'embedded' | 'power';
  /** 难度 1-3 */
  difficulty: 1 | 2 | 3;
  /** 关联的模板 ID */
  templateId: string;
  /** 学习要点 */
  learningPoints: string[];
  /** 仿真说明 */
  simNote: string;
  /** 标签 */
  tags: string[];
}

export const EXAMPLE_CIRCUITS: ExampleCircuit[] = [
  // ===== 基础电路 =====
  {
    id: 'example-led',
    name: 'LED 闪烁电路',
    description: '学习 LED 正向特性和限流电阻计算',
    icon: '💡',
    category: 'basic',
    difficulty: 1,
    templateId: 'led-circuit',
    learningPoints: [
      '理解 LED 正向导通特性（Vf ≈ 0.7V）',
      '学习限流电阻的计算方法：R = (V - Vf) / I',
      '掌握基本串联回路的搭建',
    ],
    simNote: '运行直流分析，观察 LED 两端电压和回路电流。R1=330Ω 时电流约 13mA。',
    tags: ['LED', '电阻', '直流', '入门'],
  },
  {
    id: 'example-voltage-divider',
    name: '分压器电路',
    description: '经典的电阻分压电路，理解欧姆定律',
    icon: '⚡',
    category: 'basic',
    difficulty: 1,
    templateId: 'voltage-divider',
    learningPoints: [
      '理解欧姆定律在实际电路中的应用',
      '掌握分压公式：Vout = Vin × R2/(R1+R2)',
      '了解负载效应对分压的影响',
    ],
    simNote: '运行直流分析，测量 R1、R2 连接点的电压。',
    tags: ['分压', '电阻', '入门'],
  },
  {
    id: 'example-rc-filter',
    name: 'RC 低通滤波器',
    description: '一阶低通滤波电路，观察频率响应',
    icon: '📊',
    category: 'basic',
    difficulty: 2,
    templateId: 'rc-filter',
    learningPoints: [
      '理解 RC 时间常数 τ = R×C',
      '学习低通滤波器的截止频率 fc = 1/(2πRC)',
      '观察不同频率信号的衰减情况',
    ],
    simNote: '运行 AC 扫描分析（1Hz ~ 1MHz），观察幅频特性曲线。',
    tags: ['滤波', 'RC', '频率响应'],
  },

  // ===== 模拟电路 =====
  {
    id: 'example-opamp-inv',
    name: '运放反相放大器',
    description: '运算放大器反相放大电路，学习负反馈原理',
    icon: '🔊',
    category: 'analog',
    difficulty: 2,
    templateId: 'opamp-inverting',
    learningPoints: [
      '理解运放的"虚短虚断"概念',
      '掌握反相放大器增益公式：Av = -R2/R1',
      '学习负反馈稳定放大倍数的原理',
    ],
    simNote: '运行直流分析。输入1V时输出约-10V（受供电轨限制）。',
    tags: ['运放', '放大', '反相'],
  },
  {
    id: 'example-bjt-switch',
    name: '三极管开关电路',
    description: 'NPN 三极管作为电子开关，GPIO 控制负载',
    icon: '🔌',
    category: 'analog',
    difficulty: 2,
    templateId: 'bjt-switch',
    learningPoints: [
      '理解 NPN 三极管的三种工作状态',
      '学习基极电阻的计算方法',
      '掌握三极管作为电子开关的用法',
    ],
    simNote: '修改 GPIO 电压（0V/3.3V）观察开关状态切换。',
    tags: ['三极管', '开关', 'BJT'],
  },
  {
    id: 'example-diff-amp',
    name: '差分放大器',
    description: '运放差分放大电路，放大两信号之差',
    icon: '📐',
    category: 'analog',
    difficulty: 3,
    templateId: 'diff-amp',
    learningPoints: [
      '理解差分放大器的共模抑制比（CMRR）',
      '掌握差模增益公式：Ad = R2/R1',
      '学习仪表放大器前端的典型电路拓扑',
    ],
    simNote: '运行直流分析。V1=2V, V2=1V 时输出约 10V。',
    tags: ['差分', '运放', '共模抑制'],
  },

  // ===== 数字电路 =====
  {
    id: 'example-and-gate',
    name: '与门逻辑电路',
    description: '基本逻辑门电路，理解布尔运算',
    icon: '🔀',
    category: 'digital',
    difficulty: 2,
    templateId: 'and-gate',
    learningPoints: [
      '理解 AND 门的布尔运算：有0出0，全1出1',
      '学习真值表的构建和验证方法',
      '了解 TTL/CMOS 逻辑电平的定义',
    ],
    simNote: '修改 VA/VB 电压（0V 或 5V），验证四种输入组合的输出。',
    tags: ['AND', '逻辑门', '布尔'],
  },
  {
    id: 'example-nand-sr-latch',
    name: '与非门 SR 锁存器',
    description: '两个与非门交叉耦合构成基本 SR 锁存器',
    icon: '🔀',
    category: 'digital',
    difficulty: 3,
    templateId: 'nand-sr-latch',
    learningPoints: [
      '理解 SR 锁存器的基本工作原理',
      '掌握交叉反馈在时序逻辑中的作用',
      '学习置位(S)、复位(R)、保持三种状态',
    ],
    simNote: '修改 S̄/R̄ 电压（低电平有效）验证锁存功能。',
    tags: ['NAND', '锁存器', 'SR', '存储'],
  },

  // ===== 嵌入式电路 =====
  {
    id: 'example-mcu-gpio',
    name: 'MCU GPIO 控制 LED',
    description: '微控制器 GPIO 引脚通过限流电阻驱动 LED',
    icon: '🖥️',
    category: 'embedded',
    difficulty: 2,
    templateId: 'mcu-gpio-led',
    learningPoints: [
      '理解 GPIO 输出模式的驱动能力',
      '学习嵌入式系统中 LED 驱动的典型电路',
      '掌握 MCU 与外部电路的接口设计',
    ],
    simNote: '设置 GPIO 为输出高电平，观察 LED 导通电流。',
    tags: ['MCU', 'GPIO', 'LED', '嵌入式'],
  },
  {
    id: 'example-i2c-sensor',
    name: 'I2C 传感器读取',
    description: 'MCU 通过 I2C 总线读取传感器数据',
    icon: '📡',
    category: 'embedded',
    difficulty: 3,
    templateId: 'i2c-sensor',
    learningPoints: [
      '理解 I2C 总线的开漏输出和上拉电阻原理',
      '学习 SCL/SDA 信号线的时序关系',
      '掌握 I2C 从设备地址寻址方式',
    ],
    simNote: '运行协议仿真，观察 SCL 时钟和 SDA 数据的 I2C 波形。',
    tags: ['I2C', '传感器', '通信'],
  },

  // ===== 电源电路 =====
  {
    id: 'example-timer555',
    name: '555 定时器电路',
    description: '555 定时器非稳态模式，生成方波信号',
    icon: '⏱️',
    category: 'power',
    difficulty: 3,
    templateId: 'timer555',
    learningPoints: [
      '理解 555 定时器内部结构',
      '学习非稳态振荡频率公式：f = 1.44 / ((R1+2R2)×C)',
      '掌握占空比调节原理',
    ],
    simNote: '运行瞬态分析（10ms），观察电容充放电波形和方波输出。',
    tags: ['555', '定时器', '方波', '振荡器'],
  },
  {
    id: 'example-h-bridge',
    name: 'H 桥电机驱动',
    description: '四 MOSFET 构成的 H 桥电路，实现电机正反转',
    icon: '🔄',
    category: 'power',
    difficulty: 3,
    templateId: 'h-bridge',
    learningPoints: [
      '理解 H 桥电路的四种工作模式',
      '学习 MOSFET 半桥驱动的死区时间概念',
      '掌握 PWM 调速的基本原理',
    ],
    simNote: '分别导通 Q1+Q4（正转）和 Q2+Q3（反转），观察电机电流方向。',
    tags: ['H桥', '电机', 'MOSFET', 'PWM'],
  },
];

// ==================== 示例分类 ====================

export const EXAMPLE_CATEGORIES: {
  key: ExampleCircuit['category'];
  label: string;
  icon: string;
}[] = [
  { key: 'basic', label: '基础电路', icon: '⚡' },
  { key: 'analog', label: '模拟电路', icon: '🔊' },
  { key: 'digital', label: '数字电路', icon: '🔀' },
  { key: 'embedded', label: '嵌入式', icon: '🖥️' },
  { key: 'power', label: '电源电路', icon: '🔋' },
];

// ==================== 查询函数 ====================

/** 按分类获取示例 */
export function getExamplesByCategory(category: ExampleCircuit['category']): ExampleCircuit[] {
  return EXAMPLE_CIRCUITS.filter((e) => e.category === category);
}

/** 搜索示例 */
export function searchExamples(query: string): ExampleCircuit[] {
  const q = query.toLowerCase().trim();
  if (!q) return EXAMPLE_CIRCUITS;
  return EXAMPLE_CIRCUITS.filter(
    (e) =>
      e.name.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.tags.some((tag) => tag.toLowerCase().includes(q))
  );
}
