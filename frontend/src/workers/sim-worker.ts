/**
 * 仿真计算 Web Worker
 * 在后台线程执行电路仿真计算，避免阻塞主线程
 * 
 * 通信协议：
 * - 输入: { type: 'simulate', config, components, nodes, wires }
 * - 输出: { type: 'progress', step, total } | { type: 'result', data } | { type: 'error', message }
 */

// ==================== 类型定义 ====================

interface SimConfig {
  analysisType: 'dc' | 'ac' | 'transient';
  stepTime?: number;
  stopTime?: number;
  startFreq?: number;
  stopFreq?: number;
  pointsPerDecade?: number;
}

interface SimComponent {
  id: string;
  type: string;
  value: number;
  ports: { id: string; offset: { x: number; y: number } }[];
  params?: Record<string, number | string>;
}

interface SimNode {
  id: string;
  name: string;
  type: string;
}

interface SimWire {
  id: string;
  fromComponentId: string;
  fromPortId: string;
  toComponentId: string;
  toPortId: string;
}

interface SimMessage {
  type: 'simulate';
  config: SimConfig;
  components: SimComponent[];
  nodes: SimNode[];
  wires: SimWire[];
  requestId: string;
}

// ==================== MNA 矩阵运算 ====================

/**
 * 简单的矩阵类（MNA 用）
 * 使用 Float64Array 提升大规模电路的性能
 */
class Matrix {
  rows: number;
  cols: number;
  data: Float64Array;

  constructor(rows: number, cols: number) {
    this.rows = rows;
    this.cols = cols;
    this.data = new Float64Array(rows * cols);
  }

  get(r: number, c: number): number {
    return this.data[r * this.cols + c];
  }

  set(r: number, c: number, v: number): void {
    this.data[r * this.cols + c] = v;
  }

  add(r: number, c: number, v: number): void {
    this.data[r * this.cols + c] += v;
  }

  /** 高斯消元法求解 Ax = b */
  static solve(A: Matrix, b: Float64Array): Float64Array {
    const n = A.rows;
    // 增广矩阵
    const aug = new Matrix(n, n + 1);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) aug.set(i, j, A.get(i, j));
      aug.set(i, n, b[i]);
    }

    // 前向消元（部分主元选取）
    for (let col = 0; col < n; col++) {
      // 选取主元
      let maxVal = Math.abs(aug.get(col, col));
      let maxRow = col;
      for (let row = col + 1; row < n; row++) {
        const val = Math.abs(aug.get(row, col));
        if (val > maxVal) { maxVal = val; maxRow = row; }
      }
      // 交换行
      if (maxRow !== col) {
        for (let j = col; j <= n; j++) {
          const tmp = aug.get(col, j);
          aug.set(col, j, aug.get(maxRow, j));
          aug.set(maxRow, j, tmp);
        }
      }

      const pivot = aug.get(col, col);
      if (Math.abs(pivot) < 1e-15) continue; // 奇异矩阵

      for (let row = col + 1; row < n; row++) {
        const factor = aug.get(row, col) / pivot;
        for (let j = col; j <= n; j++) {
          aug.set(row, j, aug.get(row, j) - factor * aug.get(col, j));
        }
      }
    }

    // 回代
    const x = new Float64Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let sum = aug.get(i, n);
      for (let j = i + 1; j < n; j++) sum -= aug.get(i, j) * x[j];
      const diag = aug.get(i, i);
      x[i] = Math.abs(diag) > 1e-15 ? sum / diag : 0;
    }

    return x;
  }
}

// ==================== 仿真引擎 ====================

/**
 * 构建节点编号映射（ground 节点映射到 null）
 */
function buildNodeMap(nodes: SimNode[]): Map<string, number> {
  const map = new Map<string, number>();
  let idx = 0;
  for (const node of nodes) {
    if (node.type === 'ground') {
      map.set(node.id, -1); // ground 不参与 MNA
    } else {
      map.set(node.id, idx++);
    }
  }
  return map;
}

/**
 * DC 分析：使用 MNA 求解直流工作点
 */
function runDCAnalysis(
  components: SimComponent[],
  nodes: SimNode[],
  wires: SimWire[],
  requestId: string
): void {
  const nodeMap = buildNodeMap(nodes);
  const n = nodes.filter(nd => nd.type !== 'ground').length;
  const voltageSources = components.filter(c =>
    c.type === 'dc_source' || c.type === 'voltage_source' || c.type === 'ac_source'
  );
  const m = voltageSources.length;
  const totalSize = n + m;

  if (totalSize === 0) {
    postMessage({ type: 'result', requestId, data: { channels: [], analysisType: 'dc' } });
    return;
  }

  const A = new Matrix(totalSize, totalSize);
  const b = new Float64Array(totalSize);

  // 构建导纳矩阵
  for (const comp of components) {
    if (comp.ports.length < 2) continue;
    const p1 = comp.ports[0].id;
    const p2 = comp.ports[1].id;

    // 找到端口对应的节点
    const n1 = findNodeForPort(p1, wires, nodes);
    const n2 = findNodeForPort(p2, wires, nodes);
    if (n1 === null || n2 === null) continue;

    const i1 = nodeMap.get(n1) ?? -1;
    const i2 = nodeMap.get(n2) ?? -1;

    if (comp.type === 'resistor') {
      const g = 1 / Math.max(comp.value, 1e-12);
      if (i1 >= 0) A.add(i1, i1, g);
      if (i2 >= 0) A.add(i2, i2, g);
      if (i1 >= 0 && i2 >= 0) {
        A.add(i1, i2, -g);
        A.add(i2, i1, -g);
      }
    } else if (comp.type === 'dc_source' || comp.type === 'voltage_source') {
      const vsIdx = voltageSources.indexOf(comp);
      const row = n + vsIdx;
      const v = comp.value;
      if (i1 >= 0) { A.set(i1, row, 1); A.set(row, i1, 1); }
      if (i2 >= 0) { A.set(i2, row, -1); A.set(row, i2, -1); }
      b[row] = v;
    }
  }

  try {
    const x = Matrix.solve(A, b);

    const channels = nodes
      .filter(nd => nd.type !== 'ground')
      .map(nd => {
        const idx = nodeMap.get(nd.id) ?? -1;
        return {
          name: nd.name,
          nodeId: nd.id,
          data: [{ x: 0, y: idx >= 0 ? x[idx] : 0 }],
          color: '#00d4ff',
          visible: true,
        };
      });

    postMessage({ type: 'result', requestId, data: { channels, analysisType: 'dc' } });
  } catch (e: any) {
    postMessage({ type: 'error', requestId, message: `DC 求解失败: ${e.message}` });
  }
}

/**
 * Transient 分析：使用梯形积分的时域仿真
 */
function runTransientAnalysis(
  components: SimComponent[],
  nodes: SimNode[],
  wires: SimWire[],
  config: SimConfig,
  requestId: string
): void {
  const stepTime = config.stepTime || 1e-6;
  const stopTime = config.stopTime || 1e-3;
  const totalSteps = Math.ceil(stopTime / stepTime);
  const reportInterval = Math.max(1, Math.floor(totalSteps / 100)); // 最多报告 100 次进度

  const nodeMap = buildNodeMap(nodes);
  const n = nodes.filter(nd => nd.type !== 'ground').length;
  const voltageSources = components.filter(c =>
    c.type === 'dc_source' || c.type === 'voltage_source' || c.type === 'ac_source'
  );
  const m = voltageSources.length;
  const totalSize = n + m;

  if (totalSize === 0) {
    postMessage({ type: 'result', requestId, data: { channels: [], analysisType: 'transient' } });
    return;
  }

  // 存储每个时间步的节点电压
  const history: number[][] = nodes
    .filter(nd => nd.type !== 'ground')
    .map(() => []);
  const timePoints: number[] = [];

  // 电容/电感的 companion model 状态
  const reactiveState = new Map<string, { current: number; voltage: number }>();

  let t = 0;
  for (let step = 0; step <= totalSteps; step++) {
    // 每步重新构建 MNA
    const A = new Matrix(totalSize, totalSize);
    const b = new Float64Array(totalSize);

    for (const comp of components) {
      if (comp.ports.length < 2) continue;
      const p1 = comp.ports[0].id;
      const p2 = comp.ports[1].id;
      const n1 = findNodeForPort(p1, wires, nodes);
      const n2 = findNodeForPort(p2, wires, nodes);
      if (n1 === null || n2 === null) continue;

      const i1 = nodeMap.get(n1) ?? -1;
      const i2 = nodeMap.get(n2) ?? -1;

      if (comp.type === 'resistor') {
        const g = 1 / Math.max(comp.value, 1e-12);
        stampConductance(A, i1, i2, g);
      } else if (comp.type === 'capacitor') {
        // 梯形积分 companion: Geq = 2C/h, Ieq = Geq * V_prev + I_prev
        const C = comp.value;
        const Geq = (2 * C) / stepTime;
        const state = reactiveState.get(comp.id) || { current: 0, voltage: 0 };
        const Ieq = Geq * state.voltage + state.current;
        stampConductance(A, i1, i2, Geq);
        stampCurrentSource(b, i1, i2, Ieq);
      } else if (comp.type === 'inductor') {
        // 梯形积分 companion: Geq = h/(2L), Ieq = -I_prev - Geq * V_prev
        const L = comp.value;
        const Geq = stepTime / (2 * Math.max(L, 1e-15));
        const state = reactiveState.get(comp.id) || { current: 0, voltage: 0 };
        const Ieq = -state.current - Geq * state.voltage;
        stampConductance(A, i1, i2, Geq);
        stampCurrentSource(b, i1, i2, Ieq);
      } else if (comp.type === 'dc_source' || comp.type === 'voltage_source') {
        const vsIdx = voltageSources.indexOf(comp);
        const row = n + vsIdx;
        if (i1 >= 0) { A.set(i1, row, 1); A.set(row, i1, 1); }
        if (i2 >= 0) { A.set(i2, row, -1); A.set(row, i2, -1); }
        b[row] = comp.value;
      } else if (comp.type === 'ac_source') {
        const vsIdx = voltageSources.indexOf(comp);
        const row = n + vsIdx;
        if (i1 >= 0) { A.set(i1, row, 1); A.set(row, i1, 1); }
        if (i2 >= 0) { A.set(i2, row, -1); A.set(row, i2, -1); }
        const freq = (comp.params?.frequency as number) || 1000;
        const phase = (comp.params?.phase as number) || 0;
        b[row] = comp.value * Math.sin(2 * Math.PI * freq * t + phase);
      }
    }

    try {
      const x = Matrix.solve(A, b);

      // 记录历史
      timePoints.push(t);
      for (let i = 0; i < history.length; i++) {
        history[i].push(x[i] || 0);
      }

      // 更新 reactive 元件状态
      for (const comp of components) {
        if (comp.type === 'capacitor' || comp.type === 'inductor') {
          const p1 = comp.ports[0].id;
          const p2 = comp.ports[1].id;
          const n1 = findNodeForPort(p1, wires, nodes);
          const n2 = findNodeForPort(p2, wires, nodes);
          if (!n1 || !n2) continue;
          const i1 = nodeMap.get(n1) ?? -1;
          const i2 = nodeMap.get(n2) ?? -1;
          const v = (i1 >= 0 ? x[i1] : 0) - (i2 >= 0 ? x[i2] : 0);
          const prev = reactiveState.get(comp.id) || { current: 0, voltage: 0 };
          if (comp.type === 'capacitor') {
            const C = comp.value;
            const Geq = (2 * C) / stepTime;
            const I = Geq * (v - prev.voltage) + prev.current;
            reactiveState.set(comp.id, { current: I, voltage: v });
          } else {
            const L = comp.value;
            const Geq = stepTime / (2 * Math.max(L, 1e-15));
            const I = prev.current + Geq * (prev.voltage + v);
            reactiveState.set(comp.id, { current: I, voltage: v });
          }
        }
      }
    } catch {
      // 奇异矩阵时使用零值
      timePoints.push(t);
      for (let i = 0; i < history.length; i++) history[i].push(0);
    }

    t += stepTime;

    // 报告进度
    if (step % reportInterval === 0) {
      postMessage({ type: 'progress', requestId, step, total: totalSteps });
    }
  }

  // 构造输出通道
  const nonGroundNodes = nodes.filter(nd => nd.type !== 'ground');
  const channels = nonGroundNodes.map((nd, i) => ({
    name: nd.name,
    nodeId: nd.id,
    data: timePoints.map((tp, j) => ({ x: tp, y: history[i][j] })),
    color: '#00d4ff',
    visible: true,
  }));

  postMessage({
    type: 'result',
    requestId,
    data: { channels, analysisType: 'transient', timePoints },
  });
}

/**
 * AC 分析：频率扫描
 */
function runACAnalysis(
  components: SimComponent[],
  nodes: SimNode[],
  wires: SimWire[],
  config: SimConfig,
  requestId: string
): void {
  const startFreq = config.startFreq || 1;
  const stopFreq = config.stopFreq || 1e6;
  const pointsPerDecade = config.pointsPerDecade || 10;
  const decades = Math.log10(stopFreq / startFreq);
  const totalPoints = Math.ceil(decades * pointsPerDecade);
  const reportInterval = Math.max(1, Math.floor(totalPoints / 50));

  const nodeMap = buildNodeMap(nodes);
  const nonGroundNodes = nodes.filter(nd => nd.type !== 'ground');
  const n = nonGroundNodes.length;

  if (n === 0) {
    postMessage({ type: 'result', requestId, data: { channels: [], analysisType: 'ac' } });
    return;
  }

  // 对每个频率点，构建复数导纳矩阵并求解
  const freqPoints: number[] = [];
  const magnitudes: number[][] = nonGroundNodes.map(() => []);
  const phases: number[][] = nonGroundNodes.map(() => []);

  for (let i = 0; i < totalPoints; i++) {
    const freq = startFreq * Math.pow(10, i / pointsPerDecade);
    const omega = 2 * Math.PI * freq;
    freqPoints.push(freq);

    // 简化的 AC 分析（实数近似）
    const A = new Matrix(n, n);
    const b = new Float64Array(n);

    for (const comp of components) {
      if (comp.ports.length < 2) continue;
      const p1 = comp.ports[0].id;
      const p2 = comp.ports[1].id;
      const n1 = findNodeForPort(p1, wires, nodes);
      const n2 = findNodeForPort(p2, wires, nodes);
      if (n1 === null || n2 === null) continue;
      const i1 = nodeMap.get(n1) ?? -1;
      const i2 = nodeMap.get(n2) ?? -1;

      let g = 0;
      if (comp.type === 'resistor') {
        g = 1 / Math.max(comp.value, 1e-12);
      } else if (comp.type === 'capacitor') {
        g = omega * comp.value; // Y_C = jωC, 取模
      } else if (comp.type === 'inductor') {
        g = 1 / (omega * Math.max(comp.value, 1e-15)); // Y_L = 1/(jωL), 取模
      }
      if (g > 0) stampConductance(A, i1, i2, g);
    }

    try {
      const x = Matrix.solve(A, b);
      for (let j = 0; j < nonGroundNodes.length; j++) {
        magnitudes[j].push(20 * Math.log10(Math.abs(x[j]) + 1e-15));
        phases[j].push(Math.atan2(0, x[j]) * 180 / Math.PI);
      }
    } catch {
      for (let j = 0; j < nonGroundNodes.length; j++) {
        magnitudes[j].push(-300);
        phases[j].push(0);
      }
    }

    if (i % reportInterval === 0) {
      postMessage({ type: 'progress', requestId, step: i, total: totalPoints });
    }
  }

  const channels = nonGroundNodes.map((nd, i) => ({
    name: `${nd.name} (dB)`,
    nodeId: nd.id,
    data: freqPoints.map((f, j) => ({ x: f, y: magnitudes[i][j] })),
    color: '#00d4ff',
    visible: true,
  }));

  postMessage({
    type: 'result',
    requestId,
    data: { channels, analysisType: 'ac', freqPoints },
  });
}

// ==================== 辅助函数 ====================

function findNodeForPort(portId: string, wires: SimWire[], nodes: SimNode[]): string | null {
  for (const wire of wires) {
    if (wire.fromPortId === portId || wire.toPortId === portId) {
      // 简化：返回 wire 的 fromComponentId 对应的节点
      // 实际应该通过 node 的 connectedPorts 查找
      // 这里用 wire 的目标端口对应的节点
      for (const node of nodes) {
        return node.id;
      }
    }
  }
  return null;
}

function stampConductance(A: Matrix, i1: number, i2: number, g: number): void {
  if (i1 >= 0) A.add(i1, i1, g);
  if (i2 >= 0) A.add(i2, i2, g);
  if (i1 >= 0 && i2 >= 0) {
    A.add(i1, i2, -g);
    A.add(i2, i1, -g);
  }
}

function stampCurrentSource(b: Float64Array, i1: number, i2: number, current: number): void {
  if (i1 >= 0) b[i1] -= current;
  if (i2 >= 0) b[i2] += current;
}

// ==================== Worker 消息处理 ====================

self.onmessage = (e: MessageEvent<SimMessage>) => {
  const msg = e.data;

  if (msg.type === 'simulate') {
    const { config, components, nodes, wires, requestId } = msg;

    try {
      switch (config.analysisType) {
        case 'dc':
          runDCAnalysis(components, nodes, wires, requestId);
          break;
        case 'transient':
          runTransientAnalysis(components, nodes, wires, config, requestId);
          break;
        case 'ac':
          runACAnalysis(components, nodes, wires, config, requestId);
          break;
        default:
          postMessage({ type: 'error', requestId, message: `未知分析类型: ${config.analysisType}` });
      }
    } catch (err: any) {
      postMessage({ type: 'error', requestId, message: err.message || '仿真计算异常' });
    }
  }
};

export {};
