/**
 * 波形分析工具函数
 */

import type { SimulationChannel } from '../../types/circuit';

/** 单通道统计信息 */
export interface ChannelStats {
  name: string;
  color: string;
  min: number;
  max: number;
  mean: number;
  peakToPeak: number;
  /** AC 分析特有 */
  magnitudeDb?: number;
  phaseDeg?: number;
  /** Transient 特有：过零检测估算频率 */
  frequencyHz?: number;
}

/** 计算通道的统计信息 */
export function computeChannelStats(
  channel: SimulationChannel,
  analysisType?: string
): ChannelStats | null {
  if (channel.data.length === 0) return null;

  let min = Infinity;
  let max = -Infinity;
  let sum = 0;

  for (const pt of channel.data) {
    if (pt.y < min) min = pt.y;
    if (pt.y > max) max = pt.y;
    sum += pt.y;
  }

  const mean = sum / channel.data.length;
  const peakToPeak = max - min;

  const stats: ChannelStats = {
    name: channel.name,
    color: channel.color,
    min,
    max,
    mean,
    peakToPeak,
  };

  // AC 分析：计算幅值和相位
  if (analysisType?.toUpperCase() === 'AC') {
    // 对于 AC，data 的 x 通常是频率，y 是复数形式的幅值
    // 取峰值作为幅值，用 dB 表示
    const maxAbs = Math.max(Math.abs(min), Math.abs(max));
    if (maxAbs > 0) {
      stats.magnitudeDb = 20 * Math.log10(maxAbs);
    } else {
      stats.magnitudeDb = -Infinity;
    }

    // 简单相位估计：利用首尾数据点
    if (channel.data.length >= 2) {
      const first = channel.data[0];
      const last = channel.data[channel.data.length - 1];
      // 估算相位角
      const dY = last.y - first.y;
      const dX = last.x - first.x;
      if (dX !== 0) {
        stats.phaseDeg = (Math.atan2(dY, dX) * 180) / Math.PI;
      }
    }
  }

  // Transient 分析：过零检测估算频率
  if (analysisType?.toUpperCase() === 'TRANSIENT' && channel.data.length >= 3) {
    const crossings: number[] = [];
    for (let i = 1; i < channel.data.length; i++) {
      const prev = channel.data[i - 1];
      const curr = channel.data[i];
      // 检测正向过零（y 从负变正）
      if (prev.y <= 0 && curr.y > 0) {
        // 线性插值找到精确过零点
        const t = -prev.y / (curr.y - prev.y);
        const zeroX = prev.x + t * (curr.x - prev.x);
        crossings.push(zeroX);
      }
    }
    // 如果有至少 2 个过零点，计算平均周期
    if (crossings.length >= 2) {
      let totalPeriod = 0;
      for (let i = 1; i < crossings.length; i++) {
        totalPeriod += crossings[i] - crossings[i - 1];
      }
      const avgPeriod = totalPeriod / (crossings.length - 1);
      if (avgPeriod > 0) {
        stats.frequencyHz = 1 / avgPeriod;
      }
    }
  }

  return stats;
}

/** 将仿真结果导出为 CSV 字符串 */
export function exportToCSV(
  channels: SimulationChannel[],
  analysisType: string
): string {
  const visibleChannels = channels.filter(ch => ch.visible);
  if (visibleChannels.length === 0) return '';

  // 收集所有 X 值（合并排序）
  const xSet = new Set<number>();
  for (const ch of visibleChannels) {
    for (const pt of ch.data) {
      xSet.add(pt.x);
    }
  }
  const xValues = Array.from(xSet).sort((a, b) => a - b);

  // 为每个通道建立 x->y 映射
  const channelMaps = visibleChannels.map(ch => {
    const map = new Map<number, number>();
    for (const pt of ch.data) {
      map.set(pt.x, pt.y);
    }
    return map;
  });

  // 构建 CSV
  const header = [getAxisLabel(analysisType), ...visibleChannels.map(ch => ch.name)].join(',');
  const rows = xValues.map(x => {
    const yCols = channelMaps.map(map => {
      const y = map.get(x);
      return y !== undefined ? y.toString() : '';
    });
    return [x.toString(), ...yCols].join(',');
  });

  return header + '\n' + rows.join('\n');
}

/** 将仿真结果导出为 JSON 字符串 */
export function exportToJSON(
  channels: SimulationChannel[],
  analysisType: string,
  timestamp: number
): string {
  const visibleChannels = channels.filter(ch => ch.visible);
  const exportData = {
    analysisType,
    timestamp,
    exportTime: new Date().toISOString(),
    channels: visibleChannels.map(ch => ({
      name: ch.name,
      nodeId: ch.nodeId,
      color: ch.color,
      data: ch.data,
    })),
  };
  return JSON.stringify(exportData, null, 2);
}

/** 触发浏览器下载 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 根据分析类型获取 X 轴标签 */
function getAxisLabel(analysisType: string): string {
  switch (analysisType?.toUpperCase()) {
    case 'AC': return 'Frequency (Hz)';
    case 'DC': return 'Sweep Variable';
    case 'TRANSIENT': return 'Time (s)';
    default: return 'X';
  }
}

/** 格式化文件名时间戳 */
export function formatTimestamp(ts: number): string {
  return new Date(ts).toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
