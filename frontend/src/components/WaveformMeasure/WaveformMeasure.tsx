/**
 * 波形测量工具组件
 * - 双游标（cursor）：两条可拖动竖线，显示时间/值差值
 * - 频率/周期自动计算（过零检测）
 * - 峰峰值测量
 */

import { useState, useCallback, useMemo } from 'react';
import type { SimulationChannel } from '../../types/circuit';
import './WaveformMeasure.css';

/** 游标位置（数据坐标） */
export interface CursorPositions {
  a: number | null;
  b: number | null;
}

/** 通道测量统计 */
export interface ChannelMeasurement {
  name: string;
  color: string;
  /** 当前值（游标处） */
  cursorAValue: number | null;
  cursorBValue: number | null;
  /** 差值 */
  deltaValue: number | null;
  /** 全局统计 */
  min: number;
  max: number;
  mean: number;
  /** 峰峰值 */
  peakToPeak: number;
  /** 频率 (Hz) */
  frequency: number | null;
  /** 周期 (s) */
  period: number | null;
}

/** 组件属性 */
export interface WaveformMeasureProps {
  channels: SimulationChannel[];
  /** 游标位置回调 */
  onCursorsChange?: (cursors: CursorPositions) => void;
  /** 外部传入的游标位置（受控模式） */
  cursors?: CursorPositions;
  /** 分析类型 */
  analysisType: string;
  /** 坐标映射函数：数据X → 屏幕像素X */
  dataXToScreen?: (dataX: number) => number;
  /** 坐标映射函数：屏幕像素X → 数据X */
  screenXToData?: (screenX: number) => number;
  /** 绘图区域信息 */
  plotBounds?: { left: number; top: number; width: number; height: number };
}

/** 格式化工程数值 */
function fmtVal(val: number | null): string {
  if (val === null) return '—';
  const abs = Math.abs(val);
  if (abs === 0) return '0';
  if (abs >= 1e6) return (val / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return (val / 1e3).toFixed(2) + 'k';
  if (abs >= 1) return val.toFixed(3);
  if (abs >= 1e-3) return (val * 1e3).toFixed(2) + 'm';
  if (abs >= 1e-6) return (val * 1e6).toFixed(2) + 'μ';
  if (abs >= 1e-9) return (val * 1e9).toFixed(2) + 'n';
  return val.toExponential(1);
}

/**
 * 通过过零检测计算频率
 */
function computeFrequency(data: { x: number; y: number }[]): number | null {
  if (data.length < 3) return null;

  const crossings: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1];
    const curr = data[i];
    if (prev.y <= 0 && curr.y > 0) {
      const t = -prev.y / (curr.y - prev.y);
      crossings.push(prev.x + t * (curr.x - prev.x));
    }
  }

  if (crossings.length < 2) return null;

  let totalPeriod = 0;
  for (let i = 1; i < crossings.length; i++) {
    totalPeriod += crossings[i] - crossings[i - 1];
  }
  const avgPeriod = totalPeriod / (crossings.length - 1);
  return avgPeriod > 0 ? 1 / avgPeriod : null;
}

/**
 * 二分查找最近的数据点值
 */
function interpolateValue(data: { x: number; y: number }[], targetX: number): number | null {
  if (data.length === 0) return null;

  let lo = 0, hi = data.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (data[mid].x < targetX) lo = mid + 1;
    else hi = mid;
  }

  // 线性插值
  if (lo === 0) return data[0].y;
  const p1 = data[lo - 1];
  const p2 = data[lo];
  if (!p1 || !p2) return data[lo]?.y ?? null;

  const t = (targetX - p1.x) / (p2.x - p1.x);
  return p1.y + t * (p2.y - p1.y);
}

/** 默认游标颜色 */
const CURSOR_A_COLOR = '#ff6b6b';
const CURSOR_B_COLOR = '#6bff6b';

export function WaveformMeasure({
  channels,
  onCursorsChange,
  cursors: externalCursors,
  analysisType,
}: WaveformMeasureProps) {
  const [internalCursors, setInternalCursors] = useState<CursorPositions>({ a: null, b: null });
  const cursors = externalCursors ?? internalCursors;
  const setCursors = externalCursors
    ? (updater: (prev: CursorPositions) => CursorPositions) => {
        const next = updater(cursors);
        onCursorsChange?.(next);
      }
    : (updater: (prev: CursorPositions) => CursorPositions) => {
        setInternalCursors(prev => {
          const next = updater(prev);
          onCursorsChange?.(next);
          return next;
        });
      };

  // 切换游标
  const toggleCursor = useCallback((cursor: 'a' | 'b') => {
    setCursors(prev => {
      if (prev[cursor] !== null) {
        return { ...prev, [cursor]: null };
      }
      // 设置到视口中点
      return prev;
    });
  }, [setCursors]);

  // 清除所有游标
  const clearCursors = useCallback(() => {
    setCursors(() => ({ a: null, b: null }));
  }, [setCursors]);

  // 计算每个通道的测量值
  const measurements: ChannelMeasurement[] = useMemo(() => {
    const visibleChannels = channels.filter(ch => ch.visible);
    return visibleChannels.map(ch => {
      const data = ch.data;
      let min = Infinity, max = -Infinity, sum = 0;
      for (const pt of data) {
        if (pt.y < min) min = pt.y;
        if (pt.y > max) max = pt.y;
        sum += pt.y;
      }
      const mean = data.length > 0 ? sum / data.length : 0;
      const peakToPeak = isFinite(max) && isFinite(min) ? max - min : 0;

      // 游标值
      const cursorAValue = cursors.a !== null ? interpolateValue(data, cursors.a) : null;
      const cursorBValue = cursors.b !== null ? interpolateValue(data, cursors.b) : null;
      const deltaValue =
        cursorAValue !== null && cursorBValue !== null
          ? cursorBValue - cursorAValue
          : null;

      // 频率计算
      const frequency = analysisType?.toUpperCase() === 'TRANSIENT' ? computeFrequency(data) : null;
      const period = frequency !== null && frequency > 0 ? 1 / frequency : null;

      return {
        name: ch.name,
        color: ch.color,
        cursorAValue,
        cursorBValue,
        deltaValue,
        min: isFinite(min) ? min : 0,
        max: isFinite(max) ? max : 0,
        mean,
        peakToPeak,
        frequency,
        period,
      };
    });
  }, [channels, cursors, analysisType]);

  // 双游标差值
  const deltaInfo = useMemo(() => {
    if (cursors.a === null || cursors.b === null) return null;
    return {
      deltaX: Math.abs(cursors.b - cursors.a),
      measurements: measurements.map(m => ({
        name: m.name,
        color: m.color,
        delta: m.deltaValue,
      })),
    };
  }, [cursors, measurements]);

  return (
    <div className="waveform-measure">
      {/* 游标控制工具栏 */}
      <div className="measure-toolbar">
        <span className="measure-title">📐 测量工具</span>
        <button
          className={`measure-btn ${cursors.a !== null ? 'measure-btn-active' : ''}`}
          onClick={() => toggleCursor('a')}
          title="游标 A"
        >
          <span className="cursor-dot" style={{ backgroundColor: CURSOR_A_COLOR }} />
          游标A
        </button>
        <button
          className={`measure-btn ${cursors.b !== null ? 'measure-btn-active' : ''}`}
          onClick={() => toggleCursor('b')}
          title="游标 B"
        >
          <span className="cursor-dot" style={{ backgroundColor: CURSOR_B_COLOR }} />
          游标B
        </button>
        {(cursors.a !== null || cursors.b !== null) && (
          <button className="measure-btn" onClick={clearCursors} title="清除游标">
            ✕ 清除
          </button>
        )}
      </div>

      {/* 游标读数 */}
      {cursors.a !== null && (
        <div className="cursor-readout">
          <span className="cursor-label" style={{ color: CURSOR_A_COLOR }}>游标A</span>
          <span className="cursor-x-value">X = {fmtVal(cursors.a)}</span>
          {measurements.map(m => (
            <span key={m.name} className="cursor-channel-value">
              <span className="channel-dot" style={{ backgroundColor: m.color }} />
              {m.name}: {fmtVal(m.cursorAValue)}
            </span>
          ))}
        </div>
      )}

      {cursors.b !== null && (
        <div className="cursor-readout">
          <span className="cursor-label" style={{ color: CURSOR_B_COLOR }}>游标B</span>
          <span className="cursor-x-value">X = {fmtVal(cursors.b)}</span>
          {measurements.map(m => (
            <span key={m.name} className="cursor-channel-value">
              <span className="channel-dot" style={{ backgroundColor: m.color }} />
              {m.name}: {fmtVal(m.cursorBValue)}
            </span>
          ))}
        </div>
      )}

      {/* Δ 差值显示 */}
      {deltaInfo && (
        <div className="delta-readout">
          <div className="delta-header">Δ 游标差值</div>
          <div className="delta-row">
            <span>ΔX = {fmtVal(deltaInfo.deltaX)}</span>
            {analysisType?.toUpperCase() === 'TRANSIENT' && deltaInfo.deltaX > 0 && (
              <span className="delta-freq">
                ΔX 频率 ≈ {fmtVal(1 / deltaInfo.deltaX)}Hz
              </span>
            )}
          </div>
          {deltaInfo.measurements.map(dm => (
            <div key={dm.name} className="delta-row">
              <span className="channel-dot" style={{ backgroundColor: dm.color }} />
              <span>{dm.name}: ΔY = {fmtVal(dm.delta)}</span>
            </div>
          ))}
        </div>
      )}

      {/* 通道统计表 */}
      {measurements.length > 0 && (
        <div className="measure-stats">
          <div className="stats-title">📈 通道统计</div>
          <div className="stats-table">
            <div className="stats-header">
              <span>通道</span>
              <span>Min</span>
              <span>Max</span>
              <span>Mean</span>
              <span>Vpp</span>
              <span>频率</span>
              <span>周期</span>
            </div>
            {measurements.map(m => (
              <div key={m.name} className="stats-row">
                <span className="stats-channel">
                  <span className="channel-dot" style={{ backgroundColor: m.color }} />
                  {m.name}
                </span>
                <span>{fmtVal(m.min)}</span>
                <span>{fmtVal(m.max)}</span>
                <span>{fmtVal(m.mean)}</span>
                <span>{fmtVal(m.peakToPeak)}</span>
                <span>{m.frequency !== null ? fmtVal(m.frequency) + 'Hz' : '—'}</span>
                <span>{m.period !== null ? fmtVal(m.period) + 's' : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
