/**
 * 测量引擎
 * 提供探针测量计算：Vpp, RMS, 频率, 相位差等
 */

import type {
  SimulationDataPoint,
  SimulationChannel,
  ProbeMeasurement,
  PhaseMeasurement,
  ProbeType,
} from '../../types/circuit';
import { PROBE_COLORS } from '../../types/circuit';

/** 从数据点序列计算测量值 */
export function computeProbeMeasurement(
  probeId: string,
  probeType: ProbeType,
  nodeId: string,
  name: string,
  data: SimulationDataPoint[],
  unit: string
): ProbeMeasurement | null {
  if (data.length === 0) return null;

  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let sumSq = 0;

  for (const pt of data) {
    if (pt.y < min) min = pt.y;
    if (pt.y > max) max = pt.y;
    sum += pt.y;
    sumSq += pt.y * pt.y;
  }

  const count = data.length;
  const mean = sum / count;
  const peakToPeak = max - min;
  const rms = Math.sqrt(sumSq / count);
  const currentValue = data[data.length - 1].y;

  // 频率检测（过零检测法）
  const frequency = detectFrequency(data);

  return {
    probeId,
    probeType,
    nodeId,
    name,
    color: PROBE_COLORS[probeType],
    currentValue,
    peakToPeak,
    rms,
    min,
    max,
    mean,
    frequency,
    unit,
    data: [...data],
  };
}

/** 过零检测估算频率 */
export function detectFrequency(data: SimulationDataPoint[]): number | null {
  if (data.length < 3) return null;

  const crossings: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1];
    const curr = data[i];
    // 正向过零
    if (prev.y <= 0 && curr.y > 0) {
      const t = -prev.y / (curr.y - prev.y);
      const zeroX = prev.x + t * (curr.x - prev.x);
      crossings.push(zeroX);
    }
  }

  if (crossings.length < 2) return null;

  let totalPeriod = 0;
  for (let i = 1; i < crossings.length; i++) {
    totalPeriod += crossings[i] - crossings[i - 1];
  }
  const avgPeriod = totalPeriod / (crossings.length - 1);
  if (avgPeriod <= 0) return null;
  return 1 / avgPeriod;
}

/** 计算两个探针之间的相位差 */
export function computePhaseDifference(
  dataA: SimulationDataPoint[],
  dataB: SimulationDataPoint[]
): PhaseMeasurement | null {
  if (dataA.length < 3 || dataB.length < 3) return null;

  // 找到两个通道的过零点
  const crossingsA: number[] = [];
  const crossingsB: number[] = [];

  for (let i = 1; i < dataA.length; i++) {
    if (dataA[i - 1].y <= 0 && dataA[i].y > 0) {
      const t = -dataA[i - 1].y / (dataA[i].y - dataA[i - 1].y);
      crossingsA.push(dataA[i - 1].x + t * (dataA[i].x - dataA[i - 1].x));
    }
  }

  for (let i = 1; i < dataB.length; i++) {
    if (dataB[i - 1].y <= 0 && dataB[i].y > 0) {
      const t = -dataB[i - 1].y / (dataB[i].y - dataB[i - 1].y);
      crossingsB.push(dataB[i - 1].x + t * (dataB[i].x - dataB[i - 1].x));
    }
  }

  if (crossingsA.length < 2 || crossingsB.length < 2) return null;

  // 用第一个过零点对齐
  const tA = crossingsA[0];
  const tB = crossingsB[0];
  const timeDelta = tB - tA;

  // 计算通道A的周期
  let periodA = 0;
  for (let i = 1; i < crossingsA.length; i++) {
    periodA += crossingsA[i] - crossingsA[i - 1];
  }
  periodA /= (crossingsA.length - 1);

  if (periodA <= 0) return null;

  // 相位差 = (时间差 / 周期) * 360°
  const phaseDeg = ((timeDelta / periodA) * 360) % 360;

  return {
    probeAId: '',
    probeBId: '',
    phaseDeg,
    timeDelta,
  };
}

/** 从仿真结果通道中提取探针数据 */
export function extractProbeChannelData(
  channel: SimulationChannel,
  _probeType: ProbeType
): SimulationDataPoint[] {
  return channel.data;
}

/** 生成测量报告文本 */
export function generateMeasurementReport(
  measurements: ProbeMeasurement[],
  phaseMeasurements: PhaseMeasurement[]
): string {
  const lines: string[] = [];
  lines.push('=== 测量报告 ===');
  lines.push(`生成时间: ${new Date().toLocaleString()}`);
  lines.push('');

  lines.push('--- 探针测量 ---');
  lines.push(
    '探针名称\t类型\t最小值\t最大值\t峰峰值\tRMS\t平均值\t频率\t单位'
  );
  for (const m of measurements) {
    lines.push(
      [
        m.name,
        m.probeType,
        m.min.toExponential(4),
        m.max.toExponential(4),
        m.peakToPeak.toExponential(4),
        m.rms.toExponential(4),
        m.mean.toExponential(4),
        m.frequency !== null ? m.frequency.toFixed(2) + ' Hz' : '—',
        m.unit,
      ].join('\t')
    );
  }

  if (phaseMeasurements.length > 0) {
    lines.push('');
    lines.push('--- 相位差测量 ---');
    lines.push('探针A\t探针B\t相位差(°)\t时间差(s)');
    for (const pm of phaseMeasurements) {
      lines.push(
        [pm.probeAId, pm.probeBId, pm.phaseDeg.toFixed(2), pm.timeDelta.toExponential(4)].join(
          '\t'
        )
      );
    }
  }

  return lines.join('\n');
}

/** 导出探针数据为 CSV */
export function exportProbeDataCSV(measurements: ProbeMeasurement[]): string {
  if (measurements.length === 0) return '';

  // 收集所有时间点
  const timeSet = new Set<number>();
  for (const m of measurements) {
    for (const pt of m.data) {
      timeSet.add(pt.x);
    }
  }
  const times = Array.from(timeSet).sort((a, b) => a - b);

  // 为每个探针建立 time -> value 映射
  const probeMaps = measurements.map((m) => {
    const map = new Map<number, number>();
    for (const pt of m.data) {
      map.set(pt.x, pt.y);
    }
    return map;
  });

  // 构建 CSV
  const header = ['Time (s)', ...measurements.map((m) => `${m.name} (${m.unit})`)].join(',');
  const rows = times.map((t) => {
    const cols = probeMaps.map((map) => {
      const v = map.get(t);
      return v !== undefined ? v.toString() : '';
    });
    return [t.toString(), ...cols].join(',');
  });

  return header + '\n' + rows.join('\n');
}

/** 导出完整测量报告为 CSV */
export function exportMeasurementReportCSV(
  measurements: ProbeMeasurement[],
  phaseMeasurements: PhaseMeasurement[]
): string {
  const lines: string[] = [];

  lines.push('Probe Measurements');
  lines.push('Name,Type,Min,Max,PeakToPeak,RMS,Mean,Frequency,Unit');
  for (const m of measurements) {
    lines.push(
      [
        m.name,
        m.probeType,
        m.min,
        m.max,
        m.peakToPeak,
        m.rms,
        m.mean,
        m.frequency ?? '',
        m.unit,
      ].join(',')
    );
  }

  if (phaseMeasurements.length > 0) {
    lines.push('');
    lines.push('Phase Measurements');
    lines.push('ProbeA,ProbeB,PhaseDeg,TimeDelta');
    for (const pm of phaseMeasurements) {
      lines.push([pm.probeAId, pm.probeBId, pm.phaseDeg, pm.timeDelta].join(','));
    }
  }

  return lines.join('\n');
}
