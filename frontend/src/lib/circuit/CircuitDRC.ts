/**
 * 电路设计规则检查（DRC）引擎
 * 
 * 以可扩展的规则引擎方式实现，每条规则独立定义：
 * - id: 规则唯一标识
 * - name: 规则名称
 * - description: 规则说明
 * - severity: 严重级别
 * - check: 检查函数，返回诊断结果
 * 
 * 新增规则只需向 drcRules 数组添加条目即可。
 */

import type {
  CircuitComponent,
  CircuitNode,
  Wire,
  ValidationMessage,
} from '../../types/circuit';
import { ComponentType, ValidationSeverity } from '../../types/circuit';

// ==================== 类型定义 ====================

/** DRC 规则严重级别 */
export type DRCSeverity = 'error' | 'warning' | 'suggestion';

/** DRC 诊断结果 */
export interface DRCDiagnostic {
  /** 规则 ID */
  ruleId: string;
  /** 严重级别 */
  severity: DRCSeverity;
  /** 诊断消息 */
  message: string;
  /** 修复建议 */
  suggestion: string;
  /** 关联的元件 ID */
  targetId?: string;
  /** 关联的目标类型 */
  targetType?: 'component' | 'wire' | 'node' | 'circuit';
}

/** DRC 规则定义 */
export interface DRCRule {
  /** 规则唯一 ID */
  id: string;
  /** 规则名称 */
  name: string;
  /** 规则描述 */
  description: string;
  /** 默认严重级别 */
  severity: DRCSeverity;
  /** 启用状态 */
  enabled: boolean;
  /** 检查函数 */
  check: (
    components: CircuitComponent[],
    nodes: CircuitNode[],
    wires: Wire[]
  ) => DRCDiagnostic[];
}

/** DRC 上下文（提供给规则使用的辅助信息） */
export interface DRCContext {
  components: CircuitComponent[];
  nodes: CircuitNode[];
  wires: Wire[];
  /** 端口连接状态 Map: portId → 是否已连接 */
  portConnectionMap: Map<string, boolean>;
  /** 元件连线状态 Map: componentId → 是否有任何连线 */
  componentHasWire: Map<string, boolean>;
  /** 获取端口的绝对位置 */
  getPortPos: (comp: CircuitComponent, portId: string) => { x: number; y: number } | null;
}

// ==================== 工具函数 ====================

function rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function getPortAbsolutePosition(
  component: CircuitComponent,
  portId: string
): { x: number; y: number } | null {
  const port = component.ports.find((p) => p.id === portId);
  if (!port) return null;
  const r = rad(component.rotation);
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return {
    x: component.position.x + port.offset.x * cos - port.offset.y * sin,
    y: component.position.y + port.offset.x * sin + port.offset.y * cos,
  };
}

/** 构建 DRC 上下文 */
export function buildDRCContext(
  components: CircuitComponent[],
  nodes: CircuitNode[],
  wires: Wire[]
): DRCContext {
  const portConnectionMap = new Map<string, boolean>();
  const componentHasWire = new Map<string, boolean>();

  for (const comp of components) {
    componentHasWire.set(comp.id, false);
    for (const port of comp.ports) {
      portConnectionMap.set(port.id, false);
    }
  }

  for (const wire of wires) {
    portConnectionMap.set(wire.fromPortId, true);
    portConnectionMap.set(wire.toPortId, true);
    componentHasWire.set(wire.fromComponentId, true);
    componentHasWire.set(wire.toComponentId, true);
  }

  return {
    components,
    nodes,
    wires,
    portConnectionMap,
    componentHasWire,
    getPortPos: (comp, portId) => getPortAbsolutePosition(comp, portId),
  };
}

// ==================== 规则集合 ====================

/** 全局规则注册表 */
const drcRules: DRCRule[] = [];

/** 注册规则 */
export function registerRule(rule: DRCRule): void {
  // 避免重复注册
  const idx = drcRules.findIndex((r) => r.id === rule.id);
  if (idx >= 0) {
    drcRules[idx] = rule;
  } else {
    drcRules.push(rule);
  }
}

/** 批量注册规则 */
export function registerRules(rules: DRCRule[]): void {
  for (const rule of rules) {
    registerRule(rule);
  }
}

/** 获取所有已注册规则 */
export function getAllRules(): DRCRule[] {
  return [...drcRules];
}

// ================================================================
// 规则 1: 悬空引脚检测
// ================================================================
registerRule({
  id: 'floating-pin',
  name: '悬空引脚检测',
  description: '检测未连接的输入引脚，可能导致仿真不准确',
  severity: 'warning',
  enabled: true,
  check: (components, _nodes, wires) => {
    const diagnostics: DRCDiagnostic[] = [];
    const connectedPorts = new Set<string>();
    for (const w of wires) {
      connectedPorts.add(w.fromPortId);
      connectedPorts.add(w.toPortId);
    }

    // 输入型元件的关键引脚（第1个端口通常是输入）
    const inputTypes = new Set([
      ComponentType.LogicNOT,
      ComponentType.LogicAND,
      ComponentType.LogicOR,
      ComponentType.LogicNAND,
      ComponentType.LogicNOR,
      ComponentType.LogicXOR,
      ComponentType.OpAmp,
      ComponentType.BJTNPN,
      ComponentType.BJTPNP,
      ComponentType.MOSFET_NMOS,
      ComponentType.MOSFET_PMOS,
      ComponentType.Diode,
    ]);

    for (const comp of components) {
      if (comp.type === ComponentType.Ground) continue;
      
      // 对于逻辑门和运放，检查输入端口
      if (inputTypes.has(comp.type as "diode" | "bjt_npn" | "bjt_pnp" | "mosfet_nmos" | "mosfet_pmos" | "op_amp" | "logic_and" | "logic_or" | "logic_not" | "logic_nand" | "logic_nor" | "logic_xor")) {
        // 确定哪些端口是输入
        let inputPorts: typeof comp.ports = [];
        
        if (comp.type === ComponentType.LogicNOT) {
          // NOT门：第1个端口是输入
          inputPorts = comp.ports.slice(0, 1);
        } else if (comp.type === ComponentType.OpAmp) {
          // 运放：前2个端口是输入
          inputPorts = comp.ports.slice(0, 2);
        } else if (comp.type === ComponentType.BJTNPN || comp.type === ComponentType.BJTPNP) {
          // BJT：第1个端口是基极
          inputPorts = comp.ports.slice(0, 1);
        } else if (comp.type === ComponentType.MOSFET_NMOS || comp.type === ComponentType.MOSFET_PMOS) {
          // MOSFET：第1个端口是栅极
          inputPorts = comp.ports.slice(0, 1);
        } else if (comp.type === ComponentType.Diode) {
          // 二极管：第1个端口是阳极
          inputPorts = comp.ports.slice(0, 1);
        } else {
          // AND/OR/NAND/NOR/XOR：前2个端口是输入
          inputPorts = comp.ports.slice(0, 2);
        }

        for (const port of inputPorts) {
          if (!connectedPorts.has(port.id)) {
            diagnostics.push({
              ruleId: 'floating-pin',
              severity: 'warning',
              message: `${comp.name} 的输入引脚未连接`,
              suggestion: getSuggestionForFloatingPin(comp.type),
              targetId: comp.id,
              targetType: 'component',
            });
          }
        }
      } else {
        // 通用悬空引脚检测（非地、非电源元件）
        const floatingPorts = comp.ports.filter(p => !connectedPorts.has(p.id));
        if (floatingPorts.length > 0 && floatingPorts.length === comp.ports.length) {
          // 所有端口都悬空
          diagnostics.push({
            ruleId: 'floating-pin',
            severity: 'warning',
            message: `${comp.name} 的所有引脚均未连接`,
            suggestion: `请将 ${comp.name} 连接到电路中`,
            targetId: comp.id,
            targetType: 'component',
          });
        } else if (floatingPorts.length > 0 && comp.type !== ComponentType.DCSource && comp.type !== ComponentType.ACSource && comp.type !== ComponentType.VoltageSource && comp.type !== ComponentType.CurrentSource) {
          // 部分端口悬空（电源除外，电源的输出端口可以只连一个）
          // 对于电阻、电容等无源元件，所有端口都应该连接
          const passiveTypes = new Set([
            ComponentType.Resistor, ComponentType.Capacitor, ComponentType.Inductor
          ]);
          if (passiveTypes.has(comp.type as "resistor" | "capacitor" | "inductor")) {
            for (const _port of floatingPorts) {
              diagnostics.push({
                ruleId: 'floating-pin',
                severity: 'warning',
                message: `${comp.name} 有悬空引脚`,
                suggestion: `请将 ${comp.name} 的所有引脚连接到电路中`,
                targetId: comp.id,
                targetType: 'component',
              });
            }
          }
        }
      }
    }

    return diagnostics;
  },
});

function getSuggestionForFloatingPin(type: ComponentType): string {
  switch (type) {
    case ComponentType.LogicNOT:
    case ComponentType.LogicAND:
    case ComponentType.LogicOR:
    case ComponentType.LogicNAND:
    case ComponentType.LogicNOR:
    case ComponentType.LogicXOR:
      return '逻辑门输入悬空可能导致不确定状态，建议连接上拉电阻或驱动信号';
    case ComponentType.OpAmp:
      return '运放输入引脚未连接，请连接信号源或偏置电路';
    case ComponentType.BJTNPN:
    case ComponentType.BJTPNP:
      return 'BJT 基极未连接，请连接驱动信号';
    case ComponentType.MOSFET_NMOS:
    case ComponentType.MOSFET_PMOS:
      return 'MOSFET 栅极未连接，请连接驱动信号';
    case ComponentType.Diode:
      return '二极管阳极未连接，请连接信号源';
    default:
      return '请将引脚连接到电路中';
  }
}

// ================================================================
// 规则 2: 电源/地缺失检测
// ================================================================
registerRule({
  id: 'missing-power-ground',
  name: '电源/地缺失检测',
  description: '检查电路是否缺少电源或接地连接',
  severity: 'error',
  enabled: true,
  check: (components, _nodes, wires) => {
    const diagnostics: DRCDiagnostic[] = [];

    const hasGround = components.some((c) => c.type === ComponentType.Ground);
    const hasSource = components.some(
      (c) =>
        c.type === ComponentType.DCSource ||
        c.type === ComponentType.ACSource ||
        c.type === ComponentType.VoltageSource ||
        c.type === ComponentType.CurrentSource
    );

    if (components.length > 0 && !hasGround) {
      diagnostics.push({
        ruleId: 'missing-power-ground',
        severity: 'error',
        message: '电路缺少接地（GND）元件',
        suggestion: '请添加 GND 元件并连接到电路参考点',
        targetType: 'circuit',
      });
    }

    if (components.length > 0 && !hasSource) {
      diagnostics.push({
        ruleId: 'missing-power-ground',
        severity: 'error',
        message: '电路中没有电源元件',
        suggestion: '请添加直流或交流电源为电路供电',
        targetType: 'circuit',
      });
    }

    // 检查运放电源引脚（通过检查运放是否在有电源的电路中）
    const opAmps = components.filter((c) => c.type === ComponentType.OpAmp);
    for (const opAmp of opAmps) {
      const connectedPorts = new Set<string>();
      for (const w of wires) {
        connectedPorts.add(w.fromPortId);
        connectedPorts.add(w.toPortId);
      }
      // 运放通常需要额外的电源引脚（V+、V-），当前模型只有3个端口
      // 如果电路没有电源，运放无法工作
      if (!hasSource) {
        diagnostics.push({
          ruleId: 'missing-power-ground',
          severity: 'error',
          message: `${opAmp.name} 缺少电源供电`,
          suggestion: '运放需要 V+ 和 V- 电源供电才能正常工作，请添加电源元件',
          targetId: opAmp.id,
          targetType: 'component',
        });
      }
    }

    return diagnostics;
  },
});

// ================================================================
// 规则 3: 短路检测
// ================================================================
registerRule({
  id: 'short-circuit',
  name: '短路检测',
  description: '检测电源直接接地或输出端互连等短路情况',
  severity: 'error',
  enabled: true,
  check: (components, _nodes, wires) => {
    const diagnostics: DRCDiagnostic[] = [];

    // 检测电源直接接地：如果一个电源的所有端口都直接连到 Ground
    const sources = components.filter(
      (c) =>
        c.type === ComponentType.DCSource ||
        c.type === ComponentType.ACSource ||
        c.type === ComponentType.VoltageSource
    );

    const grounds = components.filter((c) => c.type === ComponentType.Ground);

    for (const source of sources) {
      for (const ground of grounds) {
        const directConnections = wires.filter(
          (w) =>
            (w.fromComponentId === source.id && w.toComponentId === ground.id) ||
            (w.fromComponentId === ground.id && w.toComponentId === source.id)
        );
        if (directConnections.length >= 2) {
          diagnostics.push({
            ruleId: 'short-circuit',
            severity: 'error',
            message: `${source.name} 可能被短路（电源两端直接接地）`,
            suggestion: `请在 ${source.name} 和 GND 之间添加负载元件（如电阻）`,
            targetId: source.id,
            targetType: 'component',
          });
        }
      }
    }

    // 检测输出端互连：同类型输出端口相连
    const logicGates = components.filter((c) =>
      [
        ComponentType.LogicAND,
        ComponentType.LogicOR,
        ComponentType.LogicNOT,
        ComponentType.LogicNAND,
        ComponentType.LogicNOR,
        ComponentType.LogicXOR,
      ].includes(c.type as any)
    );

    for (const wire of wires) {
      const fromComp = components.find((c) => c.id === wire.fromComponentId);
      const toComp = components.find((c) => c.id === wire.toComponentId);
      if (!fromComp || !toComp) continue;

      // 检查是否两个逻辑门的输出端相连
      const isFromGate = logicGates.some((g) => g.id === fromComp.id);
      const isToGate = logicGates.some((g) => g.id === toComp.id);

      if (isFromGate && isToGate) {
        const fromIsOutput =
          fromComp.ports.length > 0 &&
          wire.fromPortId === fromComp.ports[fromComp.ports.length - 1].id;
        const toIsOutput =
          toComp.ports.length > 0 &&
          wire.toPortId === toComp.ports[toComp.ports.length - 1].id;

        if (fromIsOutput && toIsOutput) {
          diagnostics.push({
            ruleId: 'short-circuit',
            severity: 'error',
            message: `${fromComp.name} 和 ${toComp.name} 的输出端直接相连，可能导致短路`,
            suggestion: '逻辑门输出端不应直接互连，建议使用开路集电极输出或添加隔离元件',
            targetId: wire.id,
            targetType: 'wire',
          });
        }
      }
    }

    return diagnostics;
  },
});

// ================================================================
// 规则 4: 元件参数合理性检查
// ================================================================
registerRule({
  id: 'parameter-range',
  name: '元件参数合理性检查',
  description: '检查元件参数值是否在合理范围内',
  severity: 'suggestion',
  enabled: true,
  check: (components, _nodes, _wires) => {
    const diagnostics: DRCDiagnostic[] = [];

    /** 将带前缀的值转换为基本单位的数值 */
    const toBaseValue = (value: number, prefix?: string): number => {
      const multipliers: Record<string, number> = {
        p: 1e-12, n: 1e-9, μ: 1e-6, u: 1e-6, m: 1e-3,
        '': 1, k: 1e3, M: 1e6, G: 1e9, T: 1e12,
      };
      return value * (multipliers[prefix ?? ''] ?? 1);
    };

    for (const comp of components) {
      const baseVal = toBaseValue(comp.value.value, comp.value.prefix);

      switch (comp.type) {
        case ComponentType.Resistor:
          if (baseVal < 0.1) {
            diagnostics.push({
              ruleId: 'parameter-range',
              severity: 'warning',
              message: `${comp.name} 电阻值过小（${formatValue(comp.value)}），可能导致极大电流`,
              suggestion: '建议电阻值在 1Ω ~ 10MΩ 范围内。过小的电阻在实际电路中会导致发热和大电流',
              targetId: comp.id,
              targetType: 'component',
            });
          } else if (baseVal > 100e6) {
            diagnostics.push({
              ruleId: 'parameter-range',
              severity: 'suggestion',
              message: `${comp.name} 电阻值过大（${formatValue(comp.value)}），接近开路`,
              suggestion: '超大电阻在实际电路中接近开路，信号几乎无法通过',
              targetId: comp.id,
              targetType: 'component',
            });
          }
          break;

        case ComponentType.Capacitor:
          if (baseVal < 1e-15) {
            diagnostics.push({
              ruleId: 'parameter-range',
              severity: 'warning',
              message: `${comp.name} 电容值过小（${formatValue(comp.value)}），几乎无效果`,
              suggestion: '建议电容值在 1pF ~ 1F 范围内',
              targetId: comp.id,
              targetType: 'component',
            });
          } else if (baseVal > 1) {
            diagnostics.push({
              ruleId: 'parameter-range',
              severity: 'suggestion',
              message: `${comp.name} 电容值过大（${formatValue(comp.value)}），实际中非常罕见`,
              suggestion: '超过 1F 的电容通常是超级电容，需要特殊的电路设计',
              targetId: comp.id,
              targetType: 'component',
            });
          }
          break;

        case ComponentType.Inductor:
          if (baseVal < 1e-12) {
            diagnostics.push({
              ruleId: 'parameter-range',
              severity: 'suggestion',
              message: `${comp.name} 电感值过小（${formatValue(comp.value)}），接近导线`,
              suggestion: '建议电感值在 1nH ~ 1H 范围内',
              targetId: comp.id,
              targetType: 'component',
            });
          } else if (baseVal > 10) {
            diagnostics.push({
              ruleId: 'parameter-range',
              severity: 'suggestion',
              message: `${comp.name} 电感值过大（${formatValue(comp.value)}），实际中非常罕见`,
              suggestion: '超过 10H 的电感体积巨大，通常需要特殊设计',
              targetId: comp.id,
              targetType: 'component',
            });
          }
          break;

        case ComponentType.DCSource:
        case ComponentType.VoltageSource:
          if (Math.abs(baseVal) > 1000) {
            diagnostics.push({
              ruleId: 'parameter-range',
              severity: 'warning',
              message: `${comp.name} 电压值过高（${formatValue(comp.value)}），请确认是否正确`,
              suggestion: '超过 1000V 的电压需要高压电路设计，请确认参数',
              targetId: comp.id,
              targetType: 'component',
            });
          }
          break;
      }
    }

    return diagnostics;
  },
});

function formatValue(v: { value: number; unit: string; prefix?: string }): string {
  return `${v.value}${v.prefix ?? ''}${v.unit}`;
}

// ================================================================
// 规则 5: 节点连接数检查
// ================================================================
registerRule({
  id: 'node-fanout',
  name: '节点连接数检查',
  description: '检测单个节点连接过多元件可能导致的驱动能力不足',
  severity: 'suggestion',
  enabled: true,
  check: (components, _nodes, wires) => {
    const diagnostics: DRCDiagnostic[] = [];

    // 统计每个端口连接的线数
    const portWireCount = new Map<string, number>();
    for (const w of wires) {
      portWireCount.set(w.fromPortId, (portWireCount.get(w.fromPortId) ?? 0) + 1);
      portWireCount.set(w.toPortId, (portWireCount.get(w.toPortId) ?? 0) + 1);
    }

    // 找出连接线数过多的端口
    for (const [portId, count] of portWireCount) {
      if (count > 3) {
        const comp = components.find((c) =>
          c.ports.some((p) => p.id === portId)
        );
        if (comp) {
          diagnostics.push({
            ruleId: 'node-fanout',
            severity: 'suggestion',
            message: `${comp.name} 的一个引脚连接了 ${count} 条线，扇出过大`,
            suggestion: `单个引脚驱动过多负载可能导致信号质量下降，建议使用缓冲器`,
            targetId: comp.id,
            targetType: 'component',
          });
        }
      }
    }

    return diagnostics;
  },
});

// ================================================================
// 规则 6: LED 限流电阻检测
// ================================================================
registerRule({
  id: 'led-no-resistor',
  name: 'LED 限流电阻检测',
  description: '检测 LED 是否串联了限流电阻',
  severity: 'warning',
  enabled: true,
  check: (components, _nodes, wires) => {
    const diagnostics: DRCDiagnostic[] = [];

    // 当前模型中没有专门的 LED 类型，使用二极管近似
    // 检查二极管是否与电阻串联
    const diodes = components.filter((c) => c.type === ComponentType.Diode);
    const resistors = components.filter((c) => c.type === ComponentType.Resistor);
    const sources = components.filter(
      (c) =>
        c.type === ComponentType.DCSource ||
        c.type === ComponentType.VoltageSource
    );

    for (const diode of diodes) {
      // 如果电路中有电源，检查二极管是否与电阻串联
      if (sources.length > 0) {
        // 查找与二极管通过线连接的元件
        const connectedCompIds = new Set<string>();
        for (const w of wires) {
          if (w.fromComponentId === diode.id) connectedCompIds.add(w.toComponentId);
          if (w.toComponentId === diode.id) connectedCompIds.add(w.fromComponentId);
        }

        const hasResistor = [...connectedCompIds].some((id) =>
          resistors.some((r) => r.id === id)
        );

        if (!hasResistor) {
          diagnostics.push({
            ruleId: 'led-no-resistor',
            severity: 'warning',
            message: `${diode.name} 未串联限流电阻，可能导致过流损坏`,
            suggestion: '建议在 LED/二极管电路中串联限流电阻（通常 100Ω ~ 1kΩ）',
            targetId: diode.id,
            targetType: 'component',
          });
        }
      }
    }

    return diagnostics;
  },
});

// ================================================================
// 规则 7: 逻辑门输入悬空智能提示
// ================================================================
registerRule({
  id: 'logic-floating-input',
  name: '逻辑门输入悬空提示',
  description: '逻辑门输入悬空时给出上拉/下拉建议',
  severity: 'warning',
  enabled: true,
  check: (components, _nodes, wires) => {
    const diagnostics: DRCDiagnostic[] = [];
    const connectedPorts = new Set<string>();
    for (const w of wires) {
      connectedPorts.add(w.fromPortId);
      connectedPorts.add(w.toPortId);
    }

    const logicGates = components.filter((c) =>
      [
        ComponentType.LogicAND,
        ComponentType.LogicOR,
        ComponentType.LogicNAND,
        ComponentType.LogicNOR,
        ComponentType.LogicXOR,
        ComponentType.LogicNOT,
      ].includes(c.type as any)
    );

    for (const gate of logicGates) {
      // 最后一个端口是输出，前面的都是输入
      const inputPorts = gate.ports.slice(0, -1);
      const floatingInputs = inputPorts.filter((p) => !connectedPorts.has(p.id));

      if (floatingInputs.length > 0) {
        const gateTypeName = getGateTypeName(gate.type);
        diagnostics.push({
          ruleId: 'logic-floating-input',
          severity: 'warning',
          message: `${gate.name}（${gateTypeName}）有 ${floatingInputs.length} 个输入悬空`,
          suggestion: 'TTL/CMOS 逻辑门输入悬空可能导致不确定状态，建议添加上拉电阻（4.7kΩ~10kΩ）或下拉电阻',
          targetId: gate.id,
          targetType: 'component',
        });
      }
    }

    return diagnostics;
  },
});

function getGateTypeName(type: ComponentType): string {
  const map: Record<string, string> = {
    [ComponentType.LogicAND]: '与门',
    [ComponentType.LogicOR]: '或门',
    [ComponentType.LogicNOT]: '非门',
    [ComponentType.LogicNAND]: '与非门',
    [ComponentType.LogicNOR]: '或非门',
    [ComponentType.LogicXOR]: '异或门',
  };
  return map[type] ?? '逻辑门';
}

// ================================================================
// 规则 8: 电阻分压合理性
// ================================================================
registerRule({
  id: 'resistor-divider',
  name: '电阻分压合理性检查',
  description: '检测分压电路中电阻比例是否合理',
  severity: 'suggestion',
  enabled: true,
  check: (components, _nodes, wires) => {
    const diagnostics: DRCDiagnostic[] = [];

    // 查找电阻分压模式：两个电阻串联在电源和地之间
    const resistors = components.filter((c) => c.type === ComponentType.Resistor);
    const sources = components.filter(
      (c) => c.type === ComponentType.DCSource || c.type === ComponentType.VoltageSource
    );
    const grounds = components.filter((c) => c.type === ComponentType.Ground);

    if (resistors.length >= 2 && sources.length > 0 && grounds.length > 0) {
      // 检查两个电阻是否串联
      for (let i = 0; i < resistors.length - 1; i++) {
        for (let j = i + 1; j < resistors.length; j++) {
          const r1 = resistors[i];
          const r2 = resistors[j];

          // 检查是否有线连接两个电阻
          const connected = wires.some(
            (w) =>
              (w.fromComponentId === r1.id && w.toComponentId === r2.id) ||
              (w.fromComponentId === r2.id && w.toComponentId === r1.id)
          );

          if (connected) {
            const ratio = r1.value.value / r2.value.value;
            if (ratio > 100 || ratio < 0.01) {
              diagnostics.push({
                ruleId: 'resistor-divider',
                severity: 'suggestion',
                message: `${r1.name} 与 ${r2.name} 的阻值比过大（${ratio.toFixed(1)}:1），分压可能不合理`,
                suggestion: '分压电阻建议阻值比在 1:100 以内，过大的比例可能导致分压点灵敏度过高',
                targetId: r1.id,
                targetType: 'component',
              });
            }
          }
        }
      }
    }

    return diagnostics;
  },
});

// ================================================================
// 规则 9: 孤立元件检测
// ================================================================
registerRule({
  id: 'isolated-component',
  name: '孤立元件检测',
  description: '检测没有任何连线的元件',
  severity: 'warning',
  enabled: true,
  check: (components, _nodes, wires) => {
    const diagnostics: DRCDiagnostic[] = [];
    const connectedIds = new Set<string>();
    for (const w of wires) {
      connectedIds.add(w.fromComponentId);
      connectedIds.add(w.toComponentId);
    }

    for (const comp of components) {
      if (!connectedIds.has(comp.id)) {
        diagnostics.push({
          ruleId: 'isolated-component',
          severity: 'warning',
          message: `${comp.name} 是孤立元件，未连接到任何其他元件`,
          suggestion: `请将 ${comp.name} 连接到电路中，或删除不需要的元件`,
          targetId: comp.id,
          targetType: 'component',
        });
      }
    }

    return diagnostics;
  },
});

// ================================================================
// 规则 10: 空电路检测
// ================================================================
registerRule({
  id: 'empty-circuit',
  name: '空电路检测',
  description: '电路为空时给出提示',
  severity: 'error',
  enabled: true,
  check: (components, _nodes, _wires) => {
    const diagnostics: DRCDiagnostic[] = [];
    if (components.length === 0) {
      diagnostics.push({
        ruleId: 'empty-circuit',
        severity: 'error',
        message: '电路为空，请添加元件',
        suggestion: '从左侧元件库中拖拽元件到画布上开始设计电路',
        targetType: 'circuit',
      });
    }
    return diagnostics;
  },
});

// ================================================================
// 规则 11: 无连线检测
// ================================================================
registerRule({
  id: 'no-wires',
  name: '无连线检测',
  description: '电路有元件但没有任何连线',
  severity: 'error',
  enabled: true,
  check: (components, _nodes, wires) => {
    const diagnostics: DRCDiagnostic[] = [];
    if (components.length > 0 && wires.length === 0) {
      diagnostics.push({
        ruleId: 'no-wires',
        severity: 'error',
        message: '电路中没有任何连线',
        suggestion: '从元件引脚拖拽以创建连线，连接各个元件构成完整电路',
        targetType: 'circuit',
      });
    }
    return diagnostics;
  },
});

// ================================================================
// 规则 12: BJT/MOSFET 偏置检查
// ================================================================
registerRule({
  id: 'transistor-bias',
  name: '晶体管偏置检查',
  description: '检查 BJT/MOSFET 的偏置电路是否完整',
  severity: 'suggestion',
  enabled: true,
  check: (components, _nodes, wires) => {
    const diagnostics: DRCDiagnostic[] = [];
    const connectedPorts = new Set<string>();
    for (const w of wires) {
      connectedPorts.add(w.fromPortId);
      connectedPorts.add(w.toPortId);
    }

    const transistors = components.filter(
      (c) =>
        c.type === ComponentType.BJTNPN ||
        c.type === ComponentType.BJTPNP ||
        c.type === ComponentType.MOSFET_NMOS ||
        c.type === ComponentType.MOSFET_PMOS
    );

    for (const transistor of transistors) {
      const unconnectedPorts = transistor.ports.filter(
        (p) => !connectedPorts.has(p.id)
      );
      if (unconnectedPorts.length > 0) {
        const typeName =
          transistor.type === ComponentType.BJTNPN ? 'NPN' :
          transistor.type === ComponentType.BJTPNP ? 'PNP' :
          transistor.type === ComponentType.MOSFET_NMOS ? 'NMOS' : 'PMOS';
        diagnostics.push({
          ruleId: 'transistor-bias',
          severity: 'suggestion',
          message: `${transistor.name}（${typeName}）有 ${unconnectedPorts.length} 个引脚未连接`,
          suggestion: `${typeName} 晶体管需要完整的偏置电路才能正常工作`,
          targetId: transistor.id,
          targetType: 'component',
        });
      }
    }

    return diagnostics;
  },
});

// ================================================================
// 规则 13: 运放电源检查
// ================================================================
registerRule({
  id: 'opamp-power',
  name: '运放电源检查',
  description: '检查运放电路是否有电源供电',
  severity: 'warning',
  enabled: true,
  check: (components, _nodes, _wires) => {
    const diagnostics: DRCDiagnostic[] = [];

    const opAmps = components.filter((c) => c.type === ComponentType.OpAmp);
    const hasSource = components.some(
      (c) =>
        c.type === ComponentType.DCSource ||
        c.type === ComponentType.VoltageSource
    );

    for (const opAmp of opAmps) {
      if (!hasSource) {
        diagnostics.push({
          ruleId: 'opamp-power',
          severity: 'warning',
          message: `${opAmp.name} 所在电路缺少直流电源`,
          suggestion: '运放需要 V+ 和 V- 电源引脚供电才能正常工作，请添加电源元件',
          targetId: opAmp.id,
          targetType: 'component',
        });
      }
    }

    return diagnostics;
  },
});

// ================================================================
// 核心运行函数
// ================================================================

/**
 * 运行所有已启用的 DRC 规则，返回诊断结果列表
 */
export function runDRC(
  components: CircuitComponent[],
  nodes: CircuitNode[],
  wires: Wire[]
): DRCDiagnostic[] {
  const allDiagnostics: DRCDiagnostic[] = [];

  for (const rule of drcRules) {
    if (!rule.enabled) continue;
    try {
      const results = rule.check(components, nodes, wires);
      allDiagnostics.push(...results);
    } catch (err) {
      console.error(`DRC 规则 "${rule.id}" 执行出错:`, err);
    }
  }

  // 去重（相同 ruleId + targetId 的只保留第一个）
  const seen = new Set<string>();
  const unique: DRCDiagnostic[] = [];
  for (const d of allDiagnostics) {
    const key = `${d.ruleId}:${d.targetId ?? 'circuit'}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(d);
    }
  }

  return unique;
}

/**
 * 将 DRC 诊断结果转换为 ValidationMessage（兼容现有接口）
 */
export function toValidationMessages(diagnostics: DRCDiagnostic[]): ValidationMessage[] {
  const severityMap: Record<DRCSeverity, string> = {
    error: ValidationSeverity.Error,
    warning: ValidationSeverity.Warning,
    suggestion: ValidationSeverity.Info,
  };

  return diagnostics.map((d) => ({
    severity: severityMap[d.severity] as any,
    message: d.message,
    targetId: d.targetId,
    targetType: d.targetType,
  }));
}

/**
 * 检查是否可以运行仿真（有无 Error 级别问题）
 */
export function canSimulate(
  components: CircuitComponent[],
  nodes: CircuitNode[],
  wires: Wire[]
): { allowed: boolean; errors: DRCDiagnostic[]; warnings: DRCDiagnostic[] } {
  const diagnostics = runDRC(components, nodes, wires);
  const errors = diagnostics.filter((d) => d.severity === 'error');
  const warnings = diagnostics.filter((d) => d.severity === 'warning');

  return {
    allowed: errors.length === 0,
    errors,
    warnings,
  };
}
