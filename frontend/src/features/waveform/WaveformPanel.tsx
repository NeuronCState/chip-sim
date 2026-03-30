/**
 * 波形显示面板
 * Canvas 2D 渲染器：多通道波形、缩放、平移、游标、自动适配
 * Phase 2: CSV/JSON 导出、双游标、测量面板
 */

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useCircuitStore } from '../../stores/circuit-store';
import type { SimulationChannel } from '../../types/circuit';
import {
  computeChannelStats,
  exportToCSV,
  exportToJSON,
  downloadFile,
  formatTimestamp,
  type ChannelStats,
} from './waveform-utils';
import './WaveformPanel.css';

// ==================== 常量 ====================

const PADDING = { top: 30, right: 20, bottom: 40, left: 60 };
const GRID_COLOR = '#2a2a4a';
const AXIS_COLOR = '#555';
const LABEL_COLOR = '#999';
const BG_COLOR = '#16162a';
const CURSOR_A_COLOR = '#ff6b6b';
const CURSOR_B_COLOR = '#6bff6b';
const TICK_FONT = '11px -apple-system, BlinkMacSystemFont, sans-serif';

// ==================== 辅助函数 ====================

/** 格式化数值为工程标记 */
function formatValue(val: number): string {
  const abs = Math.abs(val);
  if (abs === 0) return '0';
  if (abs >= 1e6) return (val / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return (val / 1e3).toFixed(1) + 'k';
  if (abs >= 1) return val.toFixed(2);
  if (abs >= 1e-3) return (val * 1e3).toFixed(2) + 'm';
  if (abs >= 1e-6) return (val * 1e6).toFixed(2) + 'μ';
  if (abs >= 1e-9) return (val * 1e9).toFixed(2) + 'n';
  return val.toExponential(1);
}

/** 计算 nice tick values */
function computeTicks(min: number, max: number, count: number): number[] {
  if (max <= min) return [min];
  const range = max - min;
  const rough = range / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const residual = rough / mag;
  let step: number;
  if (residual <= 1.5) step = mag;
  else if (residual <= 3) step = 2 * mag;
  else if (residual <= 7) step = 5 * mag;
  else step = 10 * mag;

  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.01; v += step) {
    ticks.push(parseFloat(v.toPrecision(12)));
  }
  return ticks;
}

// ==================== 绘制函数 ====================

interface Viewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** 是否使用对数 X 轴（AC Bode 图） */
function isLogXAxis(analysisType: string): boolean {
  return analysisType?.toUpperCase() === 'AC';
}

interface CursorPair {
  a: number | null;
  b: number | null;
}

/** 将数据 X 值映射到屏幕像素 X（支持线性和对数轴） */
function dataXToScreen(
  dataX: number,
  viewport: Viewport,
  plotLeft: number,
  plotWidth: number,
  logX: boolean
): number {
  if (logX) {
    const logMin = Math.log10(Math.max(viewport.xMin, 1e-30));
    const logMax = Math.log10(Math.max(viewport.xMax, 1e-30));
    const logVal = Math.log10(Math.max(dataX, 1e-30));
    return plotLeft + ((logVal - logMin) / (logMax - logMin)) * plotWidth;
  }
  return plotLeft + ((dataX - viewport.xMin) / (viewport.xMax - viewport.xMin)) * plotWidth;
}

/** 为对数轴生成十年刻度 */
function computeLogDecadeTicks(min: number, max: number): number[] {
  const logMin = Math.ceil(Math.log10(Math.max(min, 1e-30)));
  const logMax = Math.floor(Math.log10(Math.max(max, 1e-30)));
  const ticks: number[] = [];
  for (let exp = logMin; exp <= logMax; exp++) {
    ticks.push(Math.pow(10, exp));
  }
  return ticks;
}

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  channels: SimulationChannel[],
  viewport: Viewport,
  cursors: CursorPair,
  analysisType: string
) {
  const plotLeft = PADDING.left;
  const plotTop = PADDING.top;
  const plotWidth = width - PADDING.left - PADDING.right;
  const plotHeight = height - PADDING.top - PADDING.bottom;
  const logX = isLogXAxis(analysisType);

  // 1. Clear
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, width, height);

  if (plotWidth <= 0 || plotHeight <= 0) return;

  // 2. Plot area background
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(plotLeft, plotTop, plotWidth, plotHeight);

  // 3. Grid & Axes
  const yTicks = computeTicks(viewport.yMin, viewport.yMax, 6);
  let xTicks: number[];
  let xTickLabel: (v: number) => string;

  if (logX) {
    xTicks = computeLogDecadeTicks(viewport.xMin, viewport.xMax);
    xTickLabel = (v) => formatValue(v);
  } else {
    xTicks = computeTicks(viewport.xMin, viewport.xMax, 8);
    xTickLabel = (v) => formatValue(v);
  }

  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 0.5;
  ctx.setLineDash([2, 3]);

  for (const tick of xTicks) {
    const sx = dataXToScreen(tick, viewport, plotLeft, plotWidth, logX);
    if (sx >= plotLeft && sx <= plotLeft + plotWidth) {
      ctx.beginPath();
      ctx.moveTo(sx, plotTop);
      ctx.lineTo(sx, plotTop + plotHeight);
      ctx.stroke();
    }
  }

  for (const tick of yTicks) {
    const sy = plotTop + plotHeight - ((tick - viewport.yMin) / (viewport.yMax - viewport.yMin)) * plotHeight;
    if (sy >= plotTop && sy <= plotTop + plotHeight) {
      ctx.beginPath();
      ctx.moveTo(plotLeft, sy);
      ctx.lineTo(plotLeft + plotWidth, sy);
      ctx.stroke();
    }
  }

  ctx.setLineDash([]);

  // 4. Axes
  ctx.strokeStyle = AXIS_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plotLeft, plotTop);
  ctx.lineTo(plotLeft, plotTop + plotHeight);
  ctx.lineTo(plotLeft + plotWidth, plotTop + plotHeight);
  ctx.stroke();

  // 5. Tick labels
  ctx.fillStyle = LABEL_COLOR;
  ctx.font = TICK_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  for (const tick of xTicks) {
    const sx = dataXToScreen(tick, viewport, plotLeft, plotWidth, logX);
    if (sx >= plotLeft && sx <= plotLeft + plotWidth) {
      ctx.fillText(xTickLabel(tick), sx, plotTop + plotHeight + 6);
    }
  }

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const tick of yTicks) {
    const sy = plotTop + plotHeight - ((tick - viewport.yMin) / (viewport.yMax - viewport.yMin)) * plotHeight;
    if (sy >= plotTop && sy <= plotTop + plotHeight) {
      ctx.fillText(formatValue(tick), plotLeft - 6, sy);
    }
  }

  // Axis labels for Bode plot
  if (logX) {
    ctx.fillStyle = '#777';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Frequency (Hz)', plotLeft + plotWidth / 2, plotTop + plotHeight + 24);
  }

  // 6. Draw waveforms
  ctx.save();
  ctx.beginPath();
  ctx.rect(plotLeft, plotTop, plotWidth, plotHeight);
  ctx.clip();

  const visibleChannels = channels.filter(ch => ch.visible);

  for (const channel of visibleChannels) {
    if (channel.data.length === 0) continue;

    ctx.strokeStyle = channel.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    let started = false;
    for (const pt of channel.data) {
      const sx = dataXToScreen(pt.x, viewport, plotLeft, plotWidth, logX);
      const sy = plotTop + plotHeight - ((pt.y - viewport.yMin) / (viewport.yMax - viewport.yMin)) * plotHeight;

      if (!started) {
        ctx.moveTo(sx, sy);
        started = true;
      } else {
        ctx.lineTo(sx, sy);
      }
    }
    ctx.stroke();
  }

  ctx.restore();

  // 7. Cursor lines
  const drawCursorLine = (dataX: number, color: string) => {
    const sx = dataXToScreen(dataX, viewport, plotLeft, plotWidth, logX);
    if (sx >= plotLeft && sx <= plotLeft + plotWidth) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(sx, plotTop);
      ctx.lineTo(sx, plotTop + plotHeight);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      ctx.fillStyle = color;
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(color === CURSOR_A_COLOR ? 'A' : 'B', sx, plotTop - 4);
    }
  };

  if (cursors.a !== null) drawCursorLine(cursors.a, CURSOR_A_COLOR);
  if (cursors.b !== null) drawCursorLine(cursors.b, CURSOR_B_COLOR);

  // 8. Border around plot
  ctx.strokeStyle = '#3a3a5a';
  ctx.lineWidth = 1;
  ctx.strokeRect(plotLeft, plotTop, plotWidth, plotHeight);
}

// ==================== 组件 ====================

export function WaveformPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 300 });

  const simulationResult = useCircuitStore(s => s.simulationResult);
  const isSimulating = useCircuitStore(s => s.isSimulating);
  const simLoading = useCircuitStore(s => s.simLoading);
  const wsError = useCircuitStore(s => s.wsError);

  // Viewport state
  const [viewport, setViewport] = useState<Viewport>({ xMin: 0, xMax: 1, yMin: -1, yMax: 1 });

  // Cursor state: dual cursor support
  const [dualCursorMode, setDualCursorMode] = useState(false);
  const [cursors, setCursors] = useState<CursorPair>({ a: null, b: null });
  const [cursorInfo, setCursorInfo] = useState<{
    x: number;
    values: { name: string; color: string; y: number }[];
    label: 'A' | 'B';
  } | null>(null);

  // Pan state
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, vp: viewport });

  // Channel visibility
  const [hiddenChannels, setHiddenChannels] = useState<Set<string>>(new Set());

  const channels = simulationResult?.channels ?? [];
  const analysisType = simulationResult?.analysisType ?? 'UNKNOWN';

  // ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setCanvasSize({ width: Math.floor(width), height: Math.floor(height) });
        }
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Auto-fit viewport when new data arrives
  useEffect(() => {
    if (!simulationResult || channels.length === 0) return;

    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    for (const ch of channels) {
      for (const pt of ch.data) {
        if (pt.x < xMin) xMin = pt.x;
        if (pt.x > xMax) xMax = pt.x;
        if (pt.y < yMin) yMin = pt.y;
        if (pt.y > yMax) yMax = pt.y;
      }
    }

    if (!isFinite(xMin)) return;

    const logX = isLogXAxis(analysisType);
    let finalXMin: number, finalXMax: number;

    if (logX) {
      // For log axis: pad by a factor (e.g., 0.1 decade on each side)
      finalXMin = Math.max(xMin * 0.1, 1e-10);
      finalXMax = xMax * 10;
    } else {
      const xPad = (xMax - xMin) * 0.05 || 0.1;
      finalXMin = xMin - xPad;
      finalXMax = xMax + xPad;
    }

    const yPad = (yMax - yMin) * 0.1 || 0.1;
    setViewport({ xMin: finalXMin, xMax: finalXMax, yMin: yMin - yPad, yMax: yMax + yPad });
    setCursors({ a: null, b: null });
    setCursorInfo(null);
  }, [simulationResult, analysisType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Visible channels (accounting for hidden toggle)
  const visibleChannels = useMemo(
    () => channels.map(ch => ({ ...ch, visible: ch.visible && !hiddenChannels.has(ch.name) })),
    [channels, hiddenChannels]
  );

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    ctx.scale(dpr, dpr);

    drawWaveform(ctx, canvasSize.width, canvasSize.height, visibleChannels, viewport, cursors, analysisType);
  }, [canvasSize, viewport, cursors, visibleChannels, analysisType]);

  // Compute cursor values
  const computeCursorValues = useCallback((dataX: number) => {
    const values: { name: string; color: string; y: number }[] = [];
    for (const ch of channels) {
      if (!ch.visible || hiddenChannels.has(ch.name)) continue;
      if (ch.data.length === 0) continue;

      let lo = 0, hi = ch.data.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (ch.data[mid].x < dataX) lo = mid + 1;
        else hi = mid;
      }
      const pt = ch.data[lo];
      if (pt) {
        values.push({ name: ch.name, color: ch.color, y: pt.y });
      }
    }
    return values;
  }, [channels, hiddenChannels]);

  // Dual cursor delta info
  const deltaInfo = useMemo(() => {
    if (!dualCursorMode || cursors.a === null || cursors.b === null) return null;
    const deltaX = Math.abs(cursors.b - cursors.a);
    const valuesA = computeCursorValues(cursors.a);
    const valuesB = computeCursorValues(cursors.b);
    const deltas: { name: string; color: string; deltaY: number }[] = [];
    for (const va of valuesA) {
      const vb = valuesB.find(v => v.name === va.name);
      if (vb) {
        deltas.push({ name: va.name, color: va.color, deltaY: vb.y - va.y });
      }
    }
    return { deltaX, deltas };
  }, [dualCursorMode, cursors.a, cursors.b, computeCursorValues]);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const plotLeft = PADDING.left;
    const plotTop = PADDING.top;
    const plotWidth = canvasSize.width - PADDING.left - PADDING.right;
    const plotHeight = canvasSize.height - PADDING.top - PADDING.bottom;

    if (mx < plotLeft || mx > plotLeft + plotWidth || my < plotTop || my > plotTop + plotHeight) return;

    const zoomFactor = e.deltaY < 0 ? 0.9 : 1.1;

    const dataX = viewport.xMin + ((mx - plotLeft) / plotWidth) * (viewport.xMax - viewport.xMin);
    const dataY = viewport.yMax - ((my - plotTop) / plotHeight) * (viewport.yMax - viewport.yMin);

    const newXMin = dataX - (dataX - viewport.xMin) * zoomFactor;
    const newXMax = dataX + (viewport.xMax - dataX) * zoomFactor;
    const newYMin = dataY - (dataY - viewport.yMin) * zoomFactor;
    const newYMax = dataY + (viewport.yMax - dataY) * zoomFactor;

    setViewport({ xMin: newXMin, xMax: newXMax, yMin: newYMin, yMax: newYMax });
  }, [canvasSize, viewport]);

  // Mouse down - start pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY, vp: { ...viewport } };
    e.currentTarget.classList.add('grabbing');
  }, [viewport]);

  // Mouse move - pan
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      const plotWidth = canvasSize.width - PADDING.left - PADDING.right;
      const plotHeight = canvasSize.height - PADDING.top - PADDING.bottom;
      const vp = panStart.current.vp;
      const xRange = vp.xMax - vp.xMin;
      const yRange = vp.yMax - vp.yMin;

      setViewport({
        xMin: vp.xMin - (dx / plotWidth) * xRange,
        xMax: vp.xMax - (dx / plotWidth) * xRange,
        yMin: vp.yMin + (dy / plotHeight) * yRange,
        yMax: vp.yMax + (dy / plotHeight) * yRange,
      });
    }
  }, [canvasSize]);

  // Mouse up - end pan or set cursor
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const wasPanning = isPanning.current;
    isPanning.current = false;
    (e.currentTarget as HTMLElement).classList.remove('grabbing');

    const dx = Math.abs(e.clientX - panStart.current.x);
    const dy = Math.abs(e.clientY - panStart.current.y);
    if (wasPanning && dx < 3 && dy < 3) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const plotLeft = PADDING.left;
      const plotWidth = canvasSize.width - PADDING.left - PADDING.right;

      if (mx >= plotLeft && mx <= plotLeft + plotWidth) {
        const dataX = viewport.xMin + ((mx - plotLeft) / plotWidth) * (viewport.xMax - viewport.xMin);

        if (dualCursorMode) {
          // In dual mode, alternate between setting A and B
          setCursors(prev => {
            if (prev.a === null) {
              return { ...prev, a: dataX };
            } else if (prev.b === null) {
              return { ...prev, b: dataX };
            } else {
              // Both set: replace A
              return { a: dataX, b: null };
            }
          });
          setCursorInfo({ x: dataX, values: computeCursorValues(dataX), label: 'A' });
        } else {
          setCursors({ a: dataX, b: null });
          setCursorInfo({ x: dataX, values: computeCursorValues(dataX), label: 'A' });
        }
      }
    }
  }, [canvasSize, viewport, dualCursorMode, computeCursorValues]);

  // Mouse leave - cancel pan
  const handleMouseLeave = useCallback(() => {
    isPanning.current = false;
  }, []);

  // Auto-fit Y
  const handleAutoFit = useCallback(() => {
    if (!simulationResult) return;
    let yMin = Infinity, yMax = -Infinity;
    for (const ch of channels) {
      if (!ch.visible || hiddenChannels.has(ch.name)) continue;
      for (const pt of ch.data) {
        if (pt.x >= viewport.xMin && pt.x <= viewport.xMax) {
          if (pt.y < yMin) yMin = pt.y;
          if (pt.y > yMax) yMax = pt.y;
        }
      }
    }
    if (!isFinite(yMin)) return;
    const pad = (yMax - yMin) * 0.1 || 0.1;
    setViewport(v => ({ ...v, yMin: yMin - pad, yMax: yMax + pad }));
  }, [simulationResult, channels, hiddenChannels, viewport.xMin, viewport.xMax]);

  // Auto-fit X (full reset)
  const handleAutoFitAll = useCallback(() => {
    if (!simulationResult) return;
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    for (const ch of channels) {
      for (const pt of ch.data) {
        if (pt.x < xMin) xMin = pt.x;
        if (pt.x > xMax) xMax = pt.x;
        if (pt.y < yMin) yMin = pt.y;
        if (pt.y > yMax) yMax = pt.y;
      }
    }
    if (!isFinite(xMin)) return;

    const logX = isLogXAxis(analysisType);
    let finalXMin: number, finalXMax: number;
    if (logX) {
      finalXMin = Math.max(xMin * 0.1, 1e-10);
      finalXMax = xMax * 10;
    } else {
      const xPad = (xMax - xMin) * 0.05 || 0.1;
      finalXMin = xMin - xPad;
      finalXMax = xMax + xPad;
    }

    const yPad = (yMax - yMin) * 0.1 || 0.1;
    setViewport({ xMin: finalXMin, xMax: finalXMax, yMin: yMin - yPad, yMax: yMax + yPad });
    setCursors({ a: null, b: null });
    setCursorInfo(null);
  }, [simulationResult, channels, analysisType]);

  // Toggle channel
  const toggleChannel = useCallback((name: string) => {
    setHiddenChannels(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  // Export handlers
  const handleExportCSV = useCallback(() => {
    const csv = exportToCSV(channels, analysisType);
    if (!csv) return;
    const filename = `waveform-${analysisType}-${formatTimestamp(Date.now())}.csv`;
    downloadFile(csv, filename, 'text/csv;charset=utf-8;');
  }, [channels, analysisType]);

  const handleExportJSON = useCallback(() => {
    const timestamp = simulationResult?.timestamp ?? Date.now();
    const json = exportToJSON(channels, analysisType, timestamp);
    if (!json) return;
    const filename = `waveform-${analysisType}-${formatTimestamp(Date.now())}.json`;
    downloadFile(json, filename, 'application/json;charset=utf-8;');
  }, [channels, analysisType, simulationResult?.timestamp]);

  // Toggle dual cursor mode
  const toggleDualCursor = useCallback(() => {
    setDualCursorMode(prev => {
      const next = !prev;
      if (!next) {
        // Switching to single: keep only cursor A
        setCursors(c => ({ a: c.a, b: null }));
      }
      return next;
    });
  }, []);

  // Clear cursors
  const clearCursors = useCallback(() => {
    setCursors({ a: null, b: null });
    setCursorInfo(null);
  }, []);

  // Compute measurement stats for each visible channel
  const channelStats: ChannelStats[] = useMemo(() => {
    const stats: ChannelStats[] = [];
    for (const ch of channels) {
      if (!ch.visible || hiddenChannels.has(ch.name)) continue;
      const s = computeChannelStats(ch, analysisType);
      if (s) stats.push(s);
    }
    return stats;
  }, [channels, hiddenChannels, analysisType]);

  const hasData = channels.length > 0;
  const showMeasurement = hasData && channelStats.length > 0;

  return (
    <div className="waveform-panel">
      {/* Toolbar */}
      <div className="waveform-toolbar">
        <span className="waveform-title">波形显示</span>
        {hasData && (
          <>
            <button className="wf-btn" onClick={handleAutoFitAll} title="自动适配全部">⊞ 适配</button>
            <button className="wf-btn" onClick={handleAutoFit} title="自动适配 Y 轴">↕ 适配Y</button>
            <button
              className={`wf-btn ${dualCursorMode ? 'wf-btn-active' : ''}`}
              onClick={toggleDualCursor}
              title={dualCursorMode ? '切换到单游标' : '切换到双游标'}
            >
              {dualCursorMode ? '⟷ 双游标' : '⟺ 单游标'}
            </button>
            {(cursors.a !== null || cursors.b !== null) && (
              <button className="wf-btn" onClick={clearCursors} title="清除游标">✕ 游标</button>
            )}
            <span className="wf-toolbar-sep" />
            <button className="wf-btn" onClick={handleExportCSV} title="导出 CSV 数据">CSV</button>
            <button className="wf-btn" onClick={handleExportJSON} title="导出 JSON 数据">JSON</button>
          </>
        )}
      </div>

      {/* Canvas area */}
      <div className="waveform-canvas-container" ref={containerRef}>
        {wsError ? (
          <div className="waveform-error">
            <span>仿真连接错误</span>
            <span className="waveform-error-detail">{wsError}</span>
          </div>
        ) : isSimulating || simLoading ? (
          <div className="waveform-loading">
            <div className="spinner-lg" />
            <span className="waveform-loading-text">
              {simLoading ? '正在连接仿真服务...' : '仿真计算中，请稍候...'}
            </span>
          </div>
        ) : hasData ? (
          <canvas
            ref={canvasRef}
            style={{ width: canvasSize.width, height: canvasSize.height, cursor: isPanning.current ? 'grabbing' : 'grab' }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          />
        ) : (
          <div className="waveform-placeholder">
            <p>仿真完成后波形将在此显示</p>
            <p className="hint">支持：电压/电流波形、游标测量、缩放平移</p>
          </div>
        )}

        {/* Cursor tooltip */}
        {cursorInfo && (
          <div className="cursor-tooltip" style={{ left: dataXToScreen(cursorInfo.x, viewport, PADDING.left, canvasSize.width - PADDING.left - PADDING.right, isLogXAxis(analysisType)) + 10 }}>
            <div className="cursor-tooltip-header" style={{ color: cursorInfo.label === 'A' ? CURSOR_A_COLOR : CURSOR_B_COLOR }}>
              游标 {cursorInfo.label}：X = {formatValue(cursorInfo.x)}
            </div>
            {cursorInfo.values.map(v => (
              <div key={v.name} className="cursor-tooltip-row">
                <span className="cursor-tooltip-swatch" style={{ backgroundColor: v.color }} />
                <span>{v.name}: {formatValue(v.y)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Delta display for dual cursor */}
        {dualCursorMode && deltaInfo && (
          <div className="delta-tooltip">
            <div className="delta-header">Δ 游标差值</div>
            <div className="delta-row">ΔX = {formatValue(deltaInfo.deltaX)}</div>
            {deltaInfo.deltas.map(d => (
              <div key={d.name} className="delta-row">
                <span className="cursor-tooltip-swatch" style={{ backgroundColor: d.color }} />
                {d.name} ΔY = {formatValue(d.deltaY)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Channel legend */}
      {hasData && (
        <div className="channel-legend">
          {channels.map(ch => (
            <button
              key={ch.name}
              className={`channel-tag ${hiddenChannels.has(ch.name) ? 'hidden-channel' : ''}`}
              onClick={() => toggleChannel(ch.name)}
              title={`${ch.name} (${hiddenChannels.has(ch.name) ? '已隐藏' : '显示中'})`}
            >
              <span className="channel-swatch" style={{ backgroundColor: ch.color }} />
              <span className="channel-name">{ch.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Measurement panel */}
      {showMeasurement && (
        <div className="measurement-panel">
          <div className="measurement-title">测量数据</div>
          <div className="measurement-grid">
            <div className="measurement-header">
              <span>通道</span>
              <span>Min</span>
              <span>Max</span>
              <span>Mean</span>
              <span>Vpp</span>
              {analysisType.toUpperCase() === 'AC' && (
                <>
                  <span>幅值(dB)</span>
                  <span>相位(°)</span>
                </>
              )}
              {analysisType.toUpperCase() === 'TRANSIENT' && <span>频率</span>}
            </div>
            {channelStats.map(st => (
              <div key={st.name} className="measurement-row">
                <span className="measurement-channel">
                  <span className="channel-swatch" style={{ backgroundColor: st.color }} />
                  {st.name}
                </span>
                <span>{formatValue(st.min)}</span>
                <span>{formatValue(st.max)}</span>
                <span>{formatValue(st.mean)}</span>
                <span>{formatValue(st.peakToPeak)}</span>
                {analysisType.toUpperCase() === 'AC' && (
                  <>
                    <span>{st.magnitudeDb !== undefined ? st.magnitudeDb.toFixed(2) : '—'}</span>
                    <span>{st.phaseDeg !== undefined ? st.phaseDeg.toFixed(2) : '—'}</span>
                  </>
                )}
                {analysisType.toUpperCase() === 'TRANSIENT' && (
                  <span>{st.frequencyHz !== undefined ? formatValue(st.frequencyHz) + 'Hz' : '—'}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
