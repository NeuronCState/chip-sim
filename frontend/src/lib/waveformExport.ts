/**
 * 波形数据导出工具
 * - 导出为 CSV 格式
 * - 导出为 PNG 图片（从 Canvas 截取）
 * - 支持选中时间范围导出
 */

import type { SimulationChannel } from '../types/circuit';

/** 导出选项 */
export interface ExportOptions {
  /** 时间范围（X 轴起止），为空则导出全部 */
  timeRange?: { start: number; end: number };
  /** 是否仅导出可见通道 */
  visibleOnly: boolean;
  /** 分析类型 */
  analysisType: string;
}

// ==================== CSV 导出 ====================

/**
 * 将仿真数据导出为 CSV 字符串
 * @param channels 通道列表
 * @param options 导出选项
 * @returns CSV 字符串
 */
export function exportToCSV(
  channels: SimulationChannel[],
  options: ExportOptions
): string {
  const { timeRange, visibleOnly, analysisType } = options;
  const filteredChannels = visibleOnly ? channels.filter(ch => ch.visible) : channels;
  if (filteredChannels.length === 0) return '';

  // 收集所有 X 值（合并排序），可选地过滤时间范围
  const xSet = new Set<number>();
  for (const ch of filteredChannels) {
    for (const pt of ch.data) {
      if (timeRange) {
        if (pt.x >= timeRange.start && pt.x <= timeRange.end) {
          xSet.add(pt.x);
        }
      } else {
        xSet.add(pt.x);
      }
    }
  }
  const xValues = Array.from(xSet).sort((a, b) => a - b);

  // 为每个通道建立 x->y 映射
  const channelMaps = filteredChannels.map(ch => {
    const map = new Map<number, number>();
    for (const pt of ch.data) {
      if (timeRange) {
        if (pt.x >= timeRange.start && pt.x <= timeRange.end) {
          map.set(pt.x, pt.y);
        }
      } else {
        map.set(pt.x, pt.y);
      }
    }
    return map;
  });

  // 构建 CSV 头
  const xAxisLabel = getXAxisLabel(analysisType);
  const header = [xAxisLabel, ...filteredChannels.map(ch => ch.name)].join(',');

  // 构建 CSV 行
  const rows = xValues.map(x => {
    const yCols = channelMaps.map(map => {
      const y = map.get(x);
      return y !== undefined ? formatNumber(y) : '';
    });
    return [formatNumber(x), ...yCols].join(',');
  });

  return header + '\n' + rows.join('\n');
}

// ==================== PNG 导出 ====================

/**
 * 将 Canvas 内容导出为 PNG Blob
 * @param canvas Canvas 元素
 * @param options 可选裁剪范围
 * @returns PNG Blob
 */
export function exportToPNG(
  canvas: HTMLCanvasElement,
  options?: {
    /** 裁剪区域（像素坐标） */
    crop?: { x: number; y: number; width: number; height: number };
    /** 背景色（默认透明） */
    backgroundColor?: string;
  }
): Blob | null {
  const { crop, backgroundColor } = options || {};

  // 创建目标 canvas 来处理裁剪和背景
  const targetCanvas = document.createElement('canvas');
  const ctx = targetCanvas.getContext('2d');
  if (!ctx) return null;

  if (crop) {
    targetCanvas.width = crop.width;
    targetCanvas.height = crop.height;

    // 绘制背景色
    if (backgroundColor) {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, crop.width, crop.height);
    }

    // 从原 canvas 裁剪绘制
    ctx.drawImage(
      canvas,
      crop.x * (window.devicePixelRatio || 1),
      crop.y * (window.devicePixelRatio || 1),
      crop.width * (window.devicePixelRatio || 1),
      crop.height * (window.devicePixelRatio || 1),
      0,
      0,
      crop.width,
      crop.height
    );
  } else {
    targetCanvas.width = canvas.width;
    targetCanvas.height = canvas.height;

    if (backgroundColor) {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(canvas, 0, 0);
  }

  // 转换为 Blob
  return new Promise<Blob | null>((resolve) => {
    targetCanvas.toBlob((blob) => resolve(blob), 'image/png');
  }) as any;
}

/**
 * 触发 PNG 下载
 * @param canvas Canvas 元素
 * @param filename 文件名
 * @param options 导出选项
 */
export function downloadPNG(
  canvas: HTMLCanvasElement,
  filename: string,
  _options?: {
    crop?: { x: number; y: number; width: number; height: number };
    backgroundColor?: string;
  }
): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 'image/png');
}

// ==================== 辅助函数 ====================

/** 根据分析类型获取 X 轴标签 */
function getXAxisLabel(analysisType: string): string {
  switch (analysisType?.toUpperCase()) {
    case 'AC':
      return 'Frequency (Hz)';
    case 'DC':
      return 'Sweep Variable';
    case 'TRANSIENT':
      return 'Time (s)';
    default:
      return 'X';
  }
}

/** 格式化数字（避免科学计数法过长） */
function formatNumber(val: number): string {
  if (Number.isInteger(val)) return val.toString();
  // 保留最多 12 位有效数字
  return parseFloat(val.toPrecision(12)).toString();
}

/** 格式化文件名时间戳 */
export function formatFileTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/**
 * 触发浏览器文件下载（通用）
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
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
