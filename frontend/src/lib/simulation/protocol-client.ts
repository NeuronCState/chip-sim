/**
 * 协议仿真 API 客户端
 * 调用后端 /api/simulation/protocol 端点
 */

import type { ProtocolSimRequest, ProtocolSimResult } from '../../types/circuit';

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * 运行协议仿真
 * POST /api/simulation/protocol
 */
export async function runProtocolSimulation(
  request: ProtocolSimRequest
): Promise<ProtocolSimResult> {
  const response = await fetch(`${API_BASE}/api/simulation/protocol`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(
      errBody.error || `Protocol simulation failed: ${response.status}`
    );
  }

  return response.json();
}

/**
 * 将信号跳变列表转换为连续的仿真数据点（用于波形面板显示）
 * 每个跳变之间保持水平线，用密集采样实现方波效果
 */
export function transitionsToDataPoints(
  transitions: { timeNs: number; value: number }[],
  totalNs: number,
  maxPoints: number = 2000
): { x: number; y: number }[] {
  if (transitions.length === 0) return [];

  const points: { x: number; y: number }[] = [];
  const step = Math.max(totalNs / maxPoints, 1);

  let ti = 0;
  for (let t = 0; t <= totalNs; t += step) {
    // 找到当前时间点适用的跳变值
    while (ti < transitions.length - 1 && transitions[ti + 1].timeNs <= t) {
      ti++;
    }
    points.push({ x: t, y: transitions[ti].value });
  }

  return points;
}

/**
 * 获取协议信号的显示颜色
 */
export function getProtocolSignalColor(name: string): string {
  const colors: Record<string, string> = {
    SCLK: '#ff6b6b',
    SCL: '#ff6b6b',
    MOSI: '#4ecdc4',
    MISO: '#ffd93d',
    CS: '#ff9f43',
    SDA: '#4ecdc4',
    TX: '#4ecdc4',
    RX: '#ffd93d',
  };
  return colors[name] || '#8888ff';
}
