/**
 * SPICE 网表导出模块
 * 将电路设计转换为标准 SPICE 网表格式
 */

import type {
  CircuitComponent,
  CircuitNode,
  Wire,
  CircuitProject,
} from '../../types/circuit';
import { ComponentType } from '../../types/circuit';

// ==================== 值格式化 ====================

/**
 * 将科学计数法数值转换为 SPICE 工程格式
 * 例: 0.001 -> 1m, 1000 -> 1k, 1e-6 -> 1u
 */
function formatSpiceValue(value: number): string {
  if (value === 0) return '0';

  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  // SPICE 单位前缀映射
  const prefixes: [number, string][] = [
    [1e12, 'T'],
    [1e9, 'G'],
    [1e6, 'MEG'],
    [1e3, 'k'],
    [1, ''],
    [1e-3, 'm'],
    [1e-6, 'u'],
    [1e-9, 'n'],
    [1e-12, 'p'],
    [1e-15, 'f'],
  ];

  for (const [threshold, prefix] of prefixes) {
    if (abs >= threshold) {
      const scaled = abs / threshold;
      // 避免浮点精度问题：如果是整数就直接输出
      if (Number.isInteger(scaled)) {
        return `${sign}${scaled}${prefix}`;
      }
      // 最多保留 4 位有效数字
      const formatted = parseFloat(scaled.toPrecision(4));
      return `${sign}${formatted}${prefix}`;
    }
  }

  // 极小值
  return `${sign}${value}`;
}

// ==================== 节点映射 ====================

/**
 * 从连线构建端口连通性，为每个连通组分配节点名
 * 返回 portId -> nodeName 的映射
 */
function buildNodeMap(
  components: CircuitComponent[],
  wires: Wire[]
): Map<string, string> {
  const portToNode = new Map<string, string>();

  // 收集所有端口
  const allPorts: string[] = [];
  for (const comp of components) {
    for (const port of comp.ports) {
      allPorts.push(port.id);
    }
  }

  // Union-Find 结构
  const parent = new Map<string, string>();
  for (const pid of allPorts) {
    parent.set(pid, pid);
  }

  function find(x: string): string {
    let p = parent.get(x)!;
    while (p !== parent.get(p)!) {
      parent.set(p, parent.get(parent.get(p)!)!);
      p = parent.get(p)!;
    }
    return p;
  }

  function union(a: string, b: string) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  // 通过连线合并端口
  for (const wire of wires) {
    union(wire.fromPortId, wire.toPortId);
  }

  // 检查 Ground 元件 — 其端口连通组映射到节点 "0"
  let groundRoot: string | null = null;
  for (const comp of components) {
    if (comp.type === ComponentType.Ground) {
      for (const port of comp.ports) {
        const root = find(port.id);
        groundRoot = root;
        break;
      }
      break;
    }
  }

  // 分配节点名
  let nodeIndex = 1;
  const rootToName = new Map<string, string>();

  // 先处理 ground
  if (groundRoot) {
    rootToName.set(groundRoot, '0');
  }

  for (const pid of allPorts) {
    const root = find(pid);
    if (!rootToName.has(root)) {
      rootToName.set(root, `N${nodeIndex++}`);
    }
    portToNode.set(pid, rootToName.get(root)!);
  }

  // 孤立端口也分配独立节点
  for (const pid of allPorts) {
    if (!portToNode.has(pid)) {
      portToNode.set(pid, `N${nodeIndex++}`);
    }
  }

  return portToNode;
}

// ==================== 元件 SPICE 行 ====================

/**
 * 将单个元件转换为 SPICE 网表行
 */
function componentToSpice(
  comp: CircuitComponent,
  portToNode: Map<string, string>
): string {
  const name = comp.name;
  // 端口顺序：端口 0 = N+, 端口 1 = N-（对于 2 端口元件）
  const pNode = comp.ports[0] ? portToNode.get(comp.ports[0].id) ?? '0' : '0';
  const nNode = comp.ports[1] ? portToNode.get(comp.ports[1].id) ?? '0' : '0';

  switch (comp.type) {
    case ComponentType.Resistor:
      return `${name} ${pNode} ${nNode} ${formatSpiceValue(comp.value.value)}`;

    case ComponentType.Capacitor:
      return `${name} ${pNode} ${nNode} ${formatSpiceValue(comp.value.value)}`;

    case ComponentType.Inductor:
      return `${name} ${pNode} ${nNode} ${formatSpiceValue(comp.value.value)}`;

    case ComponentType.DCSource:
    case ComponentType.VoltageSource: {
      const val = formatSpiceValue(comp.value.value);
      return `${name} ${pNode} ${nNode} DC ${val}`;
    }

    case ComponentType.ACSource: {
      const mag = formatSpiceValue(comp.value.value);
      const freq = comp.params?.['frequency'] as number | undefined;
      if (freq) {
        const freqStr = formatSpiceValue(freq);
        return `${name} ${pNode} ${nNode} AC ${mag} SIN(0 ${mag} ${freqStr})`;
      }
      return `${name} ${pNode} ${nNode} AC ${mag}`;
    }

    case ComponentType.CurrentSource: {
      const val = formatSpiceValue(comp.value.value);
      return `I${name.slice(1)} ${pNode} ${nNode} DC ${val}`;
    }

    case ComponentType.Ground:
      // Ground 不直接输出，它通过节点映射影响其他元件的节点号
      return '';

    case ComponentType.MOSFET_NMOS:
    case ComponentType.MOSFET_PMOS: {
      // M<name> <drain> <gate> <source> <bulk> <model> [params]
      // Port 0 = Gate, Port 1 = Drain, Port 2 = Source
      const gate = comp.ports[0] ? portToNode.get(comp.ports[0].id) ?? '0' : '0';
      const drain = comp.ports[1] ? portToNode.get(comp.ports[1].id) ?? '0' : '0';
      const source = comp.ports[2] ? portToNode.get(comp.ports[2].id) ?? '0' : '0';
      const model = comp.type === ComponentType.MOSFET_NMOS ? 'NMOS' : 'PMOS';
      const kp = formatSpiceValue(comp.value.value * 1e-3); // mA/V² → A/V²
      return `M${name.slice(1)} ${drain} ${gate} ${source} ${source} ${model} KP=${kp} VTO=1`;
    }

    case ComponentType.JFET_N:
    case ComponentType.JFET_P: {
      // J<name> <drain> <gate> <source> <model> [params]
      // Port 0 = Gate, Port 1 = Drain, Port 2 = Source
      const gate = comp.ports[0] ? portToNode.get(comp.ports[0].id) ?? '0' : '0';
      const drain = comp.ports[1] ? portToNode.get(comp.ports[1].id) ?? '0' : '0';
      const source = comp.ports[2] ? portToNode.get(comp.ports[2].id) ?? '0' : '0';
      const model = comp.type === ComponentType.JFET_N ? 'NJF' : 'PJF';
      const idss = formatSpiceValue(comp.value.value * 1e-3);
      return `J${name.slice(1)} ${drain} ${gate} ${source} ${model} IDSS=${idss}`;
    }

    case ComponentType.BJTNPN:
    case ComponentType.BJTPNP: {
      // Q<name> <collector> <base> <emitter> <model>
      // Port 0 = Base, Port 1 = Collector, Port 2 = Emitter
      const base = comp.ports[0] ? portToNode.get(comp.ports[0].id) ?? '0' : '0';
      const collector = comp.ports[1] ? portToNode.get(comp.ports[1].id) ?? '0' : '0';
      const emitter = comp.ports[2] ? portToNode.get(comp.ports[2].id) ?? '0' : '0';
      const model = comp.type === ComponentType.BJTNPN ? 'NPN' : 'PNP';
      const bf = comp.value.value || 100;
      return `Q${name.slice(1)} ${collector} ${base} ${emitter} ${model} BF=${bf}`;
    }

    case ComponentType.LDO: {
      // LDO is modeled as a subcircuit in SPICE
      // Port 0 = Vin, Port 1 = Vout, Port 2 = GND
      const vin = comp.ports[0] ? portToNode.get(comp.ports[0].id) ?? '0' : '0';
      const vout = comp.ports[1] ? portToNode.get(comp.ports[1].id) ?? '0' : '0';
      const gnd = comp.ports[2] ? portToNode.get(comp.ports[2].id) ?? '0' : '0';
      // Simplified: model as voltage source from Vout to GND
      return `* LDO ${name}: Vin=${vin} Vout=${vout} GND=${gnd}\nE${name.slice(1)} ${vout} ${gnd} ${vin} ${gnd} 1`;
    }

    default:
      // 其他类型（二极管、BJT、MOSFET、逻辑门等）暂不支持导出
      return `* UNSUPPORTED: ${name} (${comp.type})`;
  }
}

// ==================== 分析指令 ====================

function analysisToSpice(project: CircuitProject): string {
  const config = project.simulationConfig;
  if (!config?.analysis) return '.DC';

  const analysis = config.analysis;
  switch (analysis.type) {
    case 'dc': {
      if (analysis.sweepSource && analysis.sweepStart != null) {
        return `.DC ${analysis.sweepSource} ${formatSpiceValue(analysis.sweepStart)} ${formatSpiceValue(analysis.sweepStop ?? 0)} ${formatSpiceValue(analysis.sweepStep ?? 1)}`;
      }
      return '.DC';
    }
    case 'ac': {
      const ptd = analysis.pointsPerDecade ?? 10;
      const start = formatSpiceValue(analysis.startFreq ?? 1);
      const stop = formatSpiceValue(analysis.stopFreq ?? 1e6);
      return `.AC DEC ${ptd} ${start} ${stop}`;
    }
    case 'transient': {
      const step = formatSpiceValue(analysis.stepTime ?? 1e-6);
      const stop = formatSpiceValue(analysis.stopTime ?? 1e-3);
      return `.TRAN ${step} ${stop}`;
    }
    default:
      return '.DC';
  }
}

// ==================== 主导出函数 ====================

/**
 * 将 CircuitProject 生成为标准 SPICE 网表字符串
 */
export function generateSpiceNetlist(project: CircuitProject): string {
  const lines: string[] = [];
  const today = new Date().toISOString().split('T')[0];

  // 文件头
  lines.push(`* ChipSim 导出的电路网表`);
  lines.push(`* 日期：${today}`);
  lines.push('');
  lines.push(`.TITLE ${project.name || 'untitled'}`);
  lines.push('');

  // 构建节点映射
  const portToNode = buildNodeMap(project.components, project.wires);

  // 元件定义
  const activeComponents = project.components.filter(
    (c) => c.type !== ComponentType.Ground
  );

  if (activeComponents.length > 0) {
    lines.push('* 元件定义');
    for (const comp of activeComponents) {
      const spiceLine = componentToSpice(comp, portToNode);
      if (spiceLine) lines.push(spiceLine);
    }
    lines.push('');
  }

  // 分析指令
  lines.push('* 分析指令');
  lines.push(analysisToSpice(project));
  lines.push('');
  lines.push('.END');

  return lines.join('\n');
}

/**
 * 触发浏览器下载 SPICE 网表文件
 */
export function downloadSpiceNetlist(project: CircuitProject): void {
  const netlist = generateSpiceNetlist(project);
  const blob = new Blob([netlist], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name || 'circuit'}.cir`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 获取当前电路状态的 CircuitProject 对象（用于导出）
 */
export function buildProjectForExport(
  name: string,
  components: CircuitComponent[],
  nodes: CircuitNode[],
  wires: Wire[]
): CircuitProject {
  return {
    id: `spice-${Date.now().toString(36)}`,
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    components: JSON.parse(JSON.stringify(components)),
    nodes: JSON.parse(JSON.stringify(nodes)),
    wires: JSON.parse(JSON.stringify(wires)),
    simulationConfig: {
      analysis: { type: 'dc' },
      enabled: false,
    },
    version: '1.0.0',
  };
}
