/**
 * 示例电路库
 * 展示8个预置示例电路，支持搜索、分类浏览，附带说明和学习要点
 */

import { useState, useMemo } from 'react';
import { useCircuitStore } from '../../stores/circuit-store';
import { TEMPLATES, TEMPLATE_CATEGORIES, searchTemplates } from '../../templates/template-data';
import type { CircuitTemplate } from '../../templates/template-data';
import { t } from '../../i18n';
import { resetComponentCounters } from '../../features/editor/ComponentLibrary';
import './ExampleLibrary.css';

interface ExampleInfo {
  templateId: string;
  /** 学习要点（中文） */
  learningPointsZh: string[];
  /** 学习要点（英文） */
  learningPointsEn: string[];
  /** 仿真说明（中文） */
  simNoteZh: string;
  /** 仿真说明（英文） */
  simNoteEn: string;
}

const EXAMPLES: ExampleInfo[] = [
  {
    templateId: 'led-circuit',
    learningPointsZh: [
      '理解 LED 正向导通特性',
      '学习限流电阻的计算方法：R = (V - Vf) / I',
      '掌握基本串联回路的搭建',
    ],
    learningPointsEn: [
      'Understand LED forward conduction',
      'Learn current-limiting resistor calculation: R = (V - Vf) / I',
      'Master basic series circuit building',
    ],
    simNoteZh: '运行直流分析，观察 LED 两端电压和回路电流。',
    simNoteEn: 'Run DC analysis to observe LED voltage and circuit current.',
  },
  {
    templateId: 'voltage-divider',
    learningPointsZh: [
      '理解欧姆定律在实际电路中的应用',
      '掌握分压公式：Vout = Vin × R2/(R1+R2)',
      '了解负载效应对分压的影响',
    ],
    learningPointsEn: [
      'Understand Ohm\'s Law in practical circuits',
      'Master voltage divider formula: Vout = Vin × R2/(R1+R2)',
      'Learn about loading effects on voltage division',
    ],
    simNoteZh: '运行直流分析，测量 R1、R2 连接点的电压。',
    simNoteEn: 'Run DC analysis, measure voltage at R1-R2 junction.',
  },
  {
    templateId: 'rc-filter',
    learningPointsZh: [
      '理解 RC 时间常数 τ = R×C',
      '学习低通滤波器的截止频率 fc = 1/(2πRC)',
      '观察不同频率信号的衰减情况',
    ],
    learningPointsEn: [
      'Understand RC time constant τ = R×C',
      'Learn low-pass filter cutoff frequency fc = 1/(2πRC)',
      'Observe signal attenuation at different frequencies',
    ],
    simNoteZh: '运行 AC 扫描分析（1Hz ~ 1MHz），观察幅频特性曲线。',
    simNoteEn: 'Run AC sweep (1Hz ~ 1MHz), observe magnitude-frequency response.',
  },
  {
    templateId: 'opamp-inverting',
    learningPointsZh: [
      '理解运放的"虚短虚断"概念',
      '掌握反相放大器增益公式：Av = -R2/R1',
      '学习负反馈稳定放大倍数的原理',
    ],
    learningPointsEn: [
      'Understand op-amp "virtual short/open" concept',
      'Master inverting amplifier gain formula: Av = -R2/R1',
      'Learn negative feedback for stable amplification',
    ],
    simNoteZh: '运行直流分析。输入1V时输出约-10V（受供电轨限制）。',
    simNoteEn: 'Run DC analysis. Output ≈ -10V for 1V input (limited by supply rails).',
  },
  {
    templateId: 'bjt-switch',
    learningPointsZh: [
      '理解 NPN 三极管的三种工作状态（截止/放大/饱和）',
      '学习基极电阻的计算方法',
      '掌握三极管作为电子开关的用法',
    ],
    learningPointsEn: [
      'Understand NPN BJT three operating regions (cutoff/active/saturation)',
      'Learn base resistor calculation method',
      'Master BJT as electronic switch',
    ],
    simNoteZh: '修改 GPIO 电压（0V/3.3V）观察开关状态切换。',
    simNoteEn: 'Toggle GPIO voltage (0V/3.3V) to observe switch state change.',
  },
  {
    templateId: 'nand-sr-latch',
    learningPointsZh: [
      '理解 SR 锁存器的基本工作原理',
      '掌握交叉反馈在时序逻辑中的作用',
      '学习置位(S)、复位(R)、保持三种状态',
    ],
    learningPointsEn: [
      'Understand basic SR latch operation principle',
      'Master cross-feedback in sequential logic',
      'Learn SET, RESET, and HOLD states',
    ],
    simNoteZh: '修改 S̄/R̄ 电压（低电平有效）验证锁存功能。',
    simNoteEn: 'Toggle S̄/R̄ voltages (active low) to verify latch function.',
  },
  {
    templateId: 'mcu-gpio-led',
    learningPointsZh: [
      '理解 GPIO 输出模式的驱动能力',
      '学习嵌入式系统中 LED 驱动的典型电路',
      '掌握 MCU 与外部电路的接口设计',
    ],
    learningPointsEn: [
      'Understand GPIO output mode drive capability',
      'Learn typical LED driver circuit in embedded systems',
      'Master MCU to external circuit interface design',
    ],
    simNoteZh: '设置 GPIO 为输出高电平，观察 LED 导通电流。',
    simNoteEn: 'Set GPIO output HIGH, observe LED conduction current.',
  },
  {
    templateId: 'i2c-sensor',
    learningPointsZh: [
      '理解 I2C 总线的开漏输出和上拉电阻原理',
      '学习 SCL/SDA 信号线的时序关系',
      '掌握 I2C 从设备地址寻址方式',
    ],
    learningPointsEn: [
      'Understand I2C open-drain output and pull-up resistor principle',
      'Learn SCL/SDA signal timing relationship',
      'Master I2C slave device addressing',
    ],
    simNoteZh: '运行协议仿真，观察 SCL 时钟和 SDA 数据的 I2C 波形。',
    simNoteEn: 'Run protocol simulation to observe I2C SCL/SDA waveforms.',
  },
  {
    templateId: 'uart-comm',
    learningPointsZh: [
      '理解 UART 异步通信的帧格式',
      '学习波特率、起始位、停止位的含义',
      '掌握 TX/RX 交叉连接的接线方法',
    ],
    learningPointsEn: [
      'Understand UART asynchronous frame format',
      'Learn baud rate, start bit, stop bit meanings',
      'Master TX/RX cross-connection wiring',
    ],
    simNoteZh: '运行协议仿真，设置波特率 115200，观察 UART 波形。',
    simNoteEn: 'Run protocol simulation at 115200 baud, observe UART waveforms.',
  },
  {
    templateId: 'and-gate',
    learningPointsZh: [
      '理解 AND 门的布尔运算：有0出0，全1出1',
      '学习真值表的构建和验证方法',
      '了解 TTL/CMOS 逻辑电平的定义',
    ],
    learningPointsEn: [
      'Understand AND gate Boolean operation: output 0 if any input 0',
      'Learn truth table construction and verification',
      'Understand TTL/CMOS logic level definitions',
    ],
    simNoteZh: '修改 VA/VB 电压（0V 或 5V），验证四种输入组合的输出。',
    simNoteEn: 'Toggle VA/VB (0V or 5V), verify output for all four input combinations.',
  },
  {
    templateId: 'timer555',
    learningPointsZh: [
      '理解 555 定时器内部结构：比较器、RS触发器、放电管',
      '学习非稳态振荡频率公式：f = 1.44 / ((R1+2R2)×C)',
      '掌握占空比调节原理：D = (R1+R2)/(R1+2R2)',
    ],
    learningPointsEn: [
      'Understand 555 timer internal structure: comparators, SR flip-flop, discharge transistor',
      'Learn astable oscillator frequency formula: f = 1.44 / ((R1+2R2)×C)',
      'Master duty cycle adjustment: D = (R1+R2)/(R1+2R2)',
    ],
    simNoteZh: '运行瞬态分析（10ms），观察电容充放电波形和方波输出。修改 R2 值可改变频率。',
    simNoteEn: 'Run transient analysis (10ms), observe capacitor charge/discharge and square wave output.',
  },
  {
    templateId: 'h-bridge',
    learningPointsZh: [
      '理解 H 桥电路的四种工作模式（正转/反转/刹车/滑行）',
      '学习 MOSFET 半桥驱动的死区时间概念',
      '掌握 PWM 调速的基本原理和占空比计算',
    ],
    learningPointsEn: [
      'Understand H-bridge four operating modes (forward/reverse/brake/coast)',
      'Learn MOSFET half-bridge dead-time concept',
      'Master PWM speed regulation and duty cycle calculation',
    ],
    simNoteZh: '分别导通 Q1+Q4（正转）和 Q2+Q3（反转），观察电机电流方向。',
    simNoteEn: 'Turn on Q1+Q4 (forward) and Q2+Q3 (reverse) separately, observe motor current direction.',
  },
  {
    templateId: 'diff-amp',
    learningPointsZh: [
      '理解差分放大器的共模抑制比（CMRR）概念',
      '掌握差模增益公式：Ad = R2/R1（当 R1=R3, R2=R4）',
      '学习仪表放大器前端的典型电路拓扑',
    ],
    learningPointsEn: [
      'Understand differential amplifier CMRR concept',
      'Master differential gain formula: Ad = R2/R1 (when R1=R3, R2=R4)',
      'Learn typical instrumentation amplifier front-end topology',
    ],
    simNoteZh: '运行直流分析。V1=2V, V2=1V 时输出约 10V（差模增益 10x）。',
    simNoteEn: 'Run DC analysis. Output ≈ 10V for V1=2V, V2=1V (differential gain 10x).',
  },
  {
    templateId: 'sensor-ntc-temp',
    learningPointsZh: [
      '理解 NTC 热敏电阻的负温度系数特性',
      '学习分压式温度采集电路的设计方法',
      '掌握 ADC 模拟量采集与温度换算的关系',
    ],
    learningPointsEn: [
      'Understand NTC thermistor negative temperature coefficient',
      'Learn voltage divider temperature sensing circuit design',
      'Master ADC analog acquisition and temperature conversion',
    ],
    simNoteZh: '修改 NTC 阻值（模拟温度变化），观察分压点电压和 ADC 读数变化。',
    simNoteEn: 'Change NTC resistance (simulating temperature), observe divider voltage and ADC reading.',
  },
  {
    templateId: 'buzzer-melody',
    learningPointsZh: [
      '理解 NPN 三极管驱动感性负载的原理',
      '学习续流二极管保护三极管免受反向电动势',
      '掌握 GPIO 控制蜂鸣器的开关时序',
    ],
    learningPointsEn: [
      'Understand NPN transistor driving inductive loads',
      'Learn flyback diode protection against back-EMF',
      'Master GPIO control timing for buzzer on/off',
    ],
    simNoteZh: '设置 GPIO 高电平使 Q1 导通，蜂鸣器通电发声。观察续流二极管的保护作用。',
    simNoteEn: 'Set GPIO HIGH to turn on Q1, buzzer sounds. Observe flyback diode protection.',
  },
  {
    templateId: 'relay-control',
    learningPointsZh: [
      '理解继电器电磁线圈的工作原理',
      '学习三极管驱动继电器线圈的电路设计',
      '掌握续流二极管在感性负载保护中的重要性',
    ],
    learningPointsEn: [
      'Understand relay electromagnetic coil operation',
      'Learn transistor driver circuit for relay coil',
      'Master flyback diode importance in inductive load protection',
    ],
    simNoteZh: 'GPIO 高电平时 Q1 导通，继电器吸合，负载回路接通。观察触点状态切换。',
    simNoteEn: 'When GPIO HIGH, Q1 conducts, relay pulls in, load circuit activates. Observe contact switching.',
  },
  {
    templateId: 'battery-power',
    learningPointsZh: [
      '理解锂电池放电特性和标称电压',
      '学习 LDO 线性稳压器的工作原理',
      '掌握电源去耦电容的作用和选型',
    ],
    learningPointsEn: [
      'Understand Li-ion battery discharge characteristics',
      'Learn LDO linear regulator operation principle',
      'Master power decoupling capacitor function and selection',
    ],
    simNoteZh: '运行直流分析。BAT=3.7V 经 LDO 稳压输出 3.3V，LED 电流约 26mA。',
    simNoteEn: 'Run DC analysis. BAT=3.7V regulated to 3.3V by LDO, LED current ~26mA.',
  },
];

export function ExampleLibrary() {
  const reset = useCircuitStore((s) => s.reset);
  const fitToScreen = useCircuitStore((s) => s.fitToScreen);
  const templateLoaded = useCircuitStore((s) => s.templateLoaded);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 过滤示例
  const filteredExamples = useMemo(() => {
    let result = EXAMPLES;
    
    // 分类过滤
    if (activeCategory) {
      const templateIds = TEMPLATES
        .filter((t) => t.category === activeCategory)
        .map((t) => t.id);
      result = result.filter((e) => templateIds.includes(e.templateId));
    }
    
    // 搜索过滤
    if (searchQuery.trim()) {
      const matchedTemplates = searchTemplates(searchQuery);
      const matchedIds = new Set(matchedTemplates.map((t) => t.id));
      result = result.filter((e) => matchedIds.has(e.templateId));
    }
    
    return result;
  }, [searchQuery, activeCategory]);

  const handleLoadExample = (templateId: string) => {
    if (!templateLoaded) return; // 未加载模板时不允许加载示例
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    const { components, wires } = template.createCircuit();
    resetComponentCounters();
    reset();

    const store = useCircuitStore.getState();
    store.pushUndo();
    useCircuitStore.setState({
      components,
      wires,
      nodes: [],
      selectedComponentId: null,
      selectedWireId: null,
      selectedComponentIds: new Set(),
    });

    setTimeout(() => fitToScreen(), 50);
  };

  const getTemplate = (id: string): CircuitTemplate | undefined =>
    TEMPLATES.find((t) => t.id === id);

  return (
    <div className="example-library">
      <h4 className="example-title">📚 {t('examples.title')}</h4>

      {/* 未加载模板提示 */}
      {!templateLoaded && (
        <div className="example-template-hint">
          请先从顶部「电路模板」下拉菜单加载一个模板，再加载示例电路。
        </div>
      )}

      {/* 搜索框 */}
      <div className="example-search">
        <input
          type="text"
          className="example-search-input"
          placeholder={t('common.search')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            className="example-search-clear"
            onClick={() => setSearchQuery('')}
          >
            ✕
          </button>
        )}
      </div>

      {/* 分类标签 */}
      <div className="example-categories">
        <button
          className={`example-cat-btn ${activeCategory === null ? 'active' : ''}`}
          onClick={() => setActiveCategory(null)}
        >
          全部
        </button>
        {TEMPLATE_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            className={`example-cat-btn ${activeCategory === cat.key ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat.key)}
          >
            {cat.icon} {t(cat.titleKey)}
          </button>
        ))}
      </div>

      {/* 示例数量 */}
      <div className="example-count">
        {filteredExamples.length} 个示例
      </div>

      {/* 示例列表 */}
      <div className="example-list">
        {filteredExamples.map((example) => {
          const template = getTemplate(example.templateId);
          if (!template) return null;

          const isExpanded = expandedId === example.templateId;

          return (
            <div
              key={example.templateId}
              className={`example-card ${isExpanded ? 'example-card-expanded' : ''}`}
            >
              <div className="example-card-header">
                <span className="example-icon">{template.icon}</span>
                <div
                  className="example-card-info"
                  onClick={() => setExpandedId(isExpanded ? null : example.templateId)}
                >
                  <h5 className="example-name">{t(template.titleKey)}</h5>
                  <p className="example-desc">{t(template.descKey)}</p>
                </div>
                <div className="example-card-actions">
                  <span className={`example-difficulty diff-${template.difficulty}`}>
                    {'⭐'.repeat(template.difficulty)}
                  </span>
                  <button
                    className={`example-load-btn ${!templateLoaded ? 'example-load-btn-disabled' : ''}`}
                    onClick={() => handleLoadExample(example.templateId)}
                    disabled={!templateLoaded}
                    title={!templateLoaded ? '请先加载电路模板' : '加载此示例'}
                  >
                    加载
                  </button>
                </div>
              </div>

              {/* 展开详情 */}
              {isExpanded && (
                <div className="example-details">
                  {/* 学习要点 */}
                  <div className="example-points">
                    <div className="example-points-label">🎯 学习要点</div>
                    <ul className="example-points-list">
                      {example.learningPointsZh.map((point, i) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>

                  {/* 仿真说明 */}
                  <div className="example-sim-note">
                    <span className="example-sim-icon">🔬</span>
                    <span>{example.simNoteZh}</span>
                  </div>

                  {/* 标签 */}
                  {template.tags && template.tags.length > 0 && (
                    <div className="example-tags">
                      {template.tags.map((tag) => (
                        <span key={tag} className="example-tag">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredExamples.length === 0 && (
          <div className="example-empty">
            <span>🔍</span>
            <p>没有找到匹配的示例电路</p>
          </div>
        )}
      </div>
    </div>
  );
}
