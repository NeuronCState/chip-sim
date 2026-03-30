/**
 * 波形渲染器 - 专业级仿真波形显示面板
 * - Canvas 2D 渲染（requestAnimationFrame 驱动）
 * - 多通道叠加显示（不同颜色）
 * - 网格背景（自适应密度）
 * - 时间轴（水平）、电压/电流轴（垂直）
 * - 集成缩放平移、导出、测量工具
 */

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import type { SimulationChannel } from '../../types/circuit';
import { useWaveformZoom, type Viewport } from '../../hooks/useWaveformZoom';
import { exportToCSV, downloadFile, downloadPNG, formatFileTimestamp } from '../../lib/waveformExport';
import { WaveformMeasure, type CursorPositions } from '../WaveformMeasure/WaveformMeasure';
import './WaveformViewer.css';

// ==================== 常量 ====================

const PADDING = { top: 30, right: 20, bottom: 45, left: 65 };

// 波形颜色主题（暗色）
const CHANNEL_COLORS = [
  '#4fc3f7', '#ff6b6b', '#81c784', '#ffd54f',
  '#ce93d8', '#ff8a65', '#4db6ac', '#f06292',
  '#aed581', '#7986cb', '#fff176', '#a1887f',
];

// ==================== 工具函数 ====================

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
  const rough = range / Math.max(count, 1);
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

// ==================== 核心渲染函数 ====================

interface RenderConfig {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  channels: SimulationChannel[];
  viewport: Viewport;
  cursors: CursorPositions;
  analysisType: string;
  gridDensity: { xCount: number; yCount: number };
  isDark: boolean;
}

/** 根据分析类型判断是否对数 X 轴 */
function isLogX(analysisType: string): boolean {
  return analysisType?.toUpperCase() === 'AC';
}

/** 数据X → 屏幕像素X */
function dataXToScreenX(
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

/** 屏幕像素X → 数据X */
function screenXToDataX(
  screenX: number,
  viewport: Viewport,
  plotLeft: number,
  plotWidth: number,
  logX: boolean
): number {
  const frac = (screenX - plotLeft) / plotWidth;
  if (logX) {
    const logMin = Math.log10(Math.max(viewport.xMin, 1e-30));
    const logMax = Math.log10(Math.max(viewport.xMax, 1e-30));
    return Math.pow(10, logMin + frac * (logMax - logMin));
  }
  return viewport.xMin + frac * (viewport.xMax - viewport.xMin);
}

/** 数据Y → 屏幕像素Y */
function dataYToScreenY(
  dataY: number,
  viewport: Viewport,
  plotTop: number,
  plotHeight: number
): number {
  return plotTop + plotHeight - ((dataY - viewport.yMin) / (viewport.yMax - viewport.yMin)) * plotHeight;
}

/** 核心渲染逻辑 */
function renderWaveform(cfg: RenderConfig) {
  const { ctx, width, height, channels, viewport, cursors, analysisType, gridDensity, isDark } = cfg;
  const plotLeft = PADDING.left;
  const plotTop = PADDING.top;
  const plotWidth = width - PADDING.left - PADDING.right;
  const plotHeight = height - PADDING.top - PADDING.bottom;
  const logX = isLogX(analysisType);

  // 颜色
  const bgColor = isDark ? '#0d0d1a' : '#f8f9fa';
  const plotBg = isDark ? '#0a0a14' : '#ffffff';
  const gridColor = isDark ? 'rgba(42, 42, 74, 0.6)' : 'rgba(200, 200, 210, 0.8)';
  const axisColor = isDark ? '#555' : '#999';
  const labelColor = isDark ? '#999' : '#666';

  // 1. 清除画布
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  if (plotWidth <= 0 || plotHeight <= 0) return;

  // 2. 绘图区域背景
  ctx.fillStyle = plotBg;
  ctx.fillRect(plotLeft, plotTop, plotWidth, plotHeight);

  // 3. 零线（如果可见）
  if (viewport.yMin < 0 && viewport.yMax > 0) {
    const zeroY = dataYToScreenY(0, viewport, plotTop, plotHeight);
    ctx.strokeStyle = isDark ? 'rgba(100, 100, 150, 0.5)' : 'rgba(150, 150, 170, 0.7)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(plotLeft, zeroY);
    ctx.lineTo(plotLeft + plotWidth, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 4. 网格
  const yTicks = computeTicks(viewport.yMin, viewport.yMax, gridDensity.yCount);
  let xTicks: number[];

  if (logX) {
    const logMin = Math.ceil(Math.log10(Math.max(viewport.xMin, 1e-30)));
    const logMax = Math.floor(Math.log10(Math.max(viewport.xMax, 1e-30)));
    xTicks = [];
    for (let exp = logMin; exp <= logMax; exp++) {
      xTicks.push(Math.pow(10, exp));
    }
  } else {
    xTicks = computeTicks(viewport.xMin, viewport.xMax, gridDensity.xCount);
  }

  // 次网格
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  ctx.setLineDash([1, 3]);

  for (const tick of xTicks) {
    const sx = dataXToScreenX(tick, viewport, plotLeft, plotWidth, logX);
    if (sx > plotLeft && sx < plotLeft + plotWidth) {
      ctx.beginPath();
      ctx.moveTo(sx, plotTop);
      ctx.lineTo(sx, plotTop + plotHeight);
      ctx.stroke();
    }
  }

  for (const tick of yTicks) {
    const sy = dataYToScreenY(tick, viewport, plotTop, plotHeight);
    if (sy > plotTop && sy < plotTop + plotHeight) {
      ctx.beginPath();
      ctx.moveTo(plotLeft, sy);
      ctx.lineTo(plotLeft + plotWidth, sy);
      ctx.stroke();
    }
  }

  ctx.setLineDash([]);

  // 5. 坐标轴
  ctx.strokeStyle = axisColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plotLeft, plotTop);
  ctx.lineTo(plotLeft, plotTop + plotHeight);
  ctx.lineTo(plotLeft + plotWidth, plotTop + plotHeight);
  ctx.stroke();

  // 6. 刻度标签
  ctx.fillStyle = labelColor;
  ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';

  // X 轴标签
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const tick of xTicks) {
    const sx = dataXToScreenX(tick, viewport, plotLeft, plotWidth, logX);
    if (sx > plotLeft + 20 && sx < plotLeft + plotWidth - 20) {
      ctx.fillText(formatValue(tick), sx, plotTop + plotHeight + 6);
    }
  }

  // Y 轴标签
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const tick of yTicks) {
    const sy = dataYToScreenY(tick, viewport, plotTop, plotHeight);
    if (sy > plotTop + 8 && sy < plotTop + plotHeight - 8) {
      ctx.fillText(formatValue(tick), plotLeft - 6, sy);
    }
  }

  // X 轴标题
  ctx.fillStyle = isDark ? '#666' : '#888';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  const xLabel = analysisType?.toUpperCase() === 'AC' ? 'Frequency (Hz)'
    : analysisType?.toUpperCase() === 'TRANSIENT' ? 'Time (s)'
    : 'X';
  ctx.fillText(xLabel, plotLeft + plotWidth / 2, plotTop + plotHeight + 28);

  // 7. 波形绘制（裁剪到绘图区域）
  ctx.save();
  ctx.beginPath();
  ctx.rect(plotLeft, plotTop, plotWidth, plotHeight);
  ctx.clip();

  const visibleChannels = channels.filter(ch => ch.visible);
  for (const channel of visibleChannels) {
    if (channel.data.length === 0) continue;

    // 波形填充（半透明）
    ctx.fillStyle = channel.color + '15';
    ctx.strokeStyle = channel.color;
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';

    ctx.beginPath();
    let started = false;
    let prevSx = -Infinity;

    for (const pt of channel.data) {
      const sx = dataXToScreenX(pt.x, viewport, plotLeft, plotWidth, logX);
      const sy = dataYToScreenY(pt.y, viewport, plotTop, plotHeight);

      // 跳过太近的点（性能优化）
      if (Math.abs(sx - prevSx) < 1) continue;
      prevSx = sx;

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

  // 8. 游标线
  const drawCursorLine = (dataX: number, color: string, label: string) => {
    const sx = dataXToScreenX(dataX, viewport, plotLeft, plotWidth, logX);
    if (sx < plotLeft || sx > plotLeft + plotWidth) return;

    // 竖线
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(sx, plotTop);
    ctx.lineTo(sx, plotTop + plotHeight);
    ctx.stroke();
    ctx.setLineDash([]);

    // 顶部标签
    ctx.fillStyle = color;
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, sx, plotTop - 6);

    // 三角形指示器
    ctx.beginPath();
    ctx.moveTo(sx - 5, plotTop);
    ctx.lineTo(sx + 5, plotTop);
    ctx.lineTo(sx, plotTop + 6);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };

  if (cursors.a !== null) drawCursorLine(cursors.a, '#ff6b6b', 'A');
  if (cursors.b !== null) drawCursorLine(cursors.b, '#6bff6b', 'B');

  // 9. 边框
  ctx.strokeStyle = isDark ? '#3a3a5a' : '#ccc';
  ctx.lineWidth = 1;
  ctx.strokeRect(plotLeft, plotTop, plotWidth, plotHeight);
}

// ==================== 组件属性 ====================

export interface WaveformViewerProps {
  /** 仿真数据通道 */
  channels: SimulationChannel[];
  /** 分析类型 */
  analysisType: string;
  /** 是否正在仿真 */
  isSimulating?: boolean;
  /** 仿真加载状态 */
  simLoading?: boolean;
  /** WebSocket 错误 */
  wsError?: string | null;
  /** 暗色主题（默认 true） */
  darkTheme?: boolean;
}

// ==================== 组件 ====================

export function WaveformViewer({
  channels,
  analysisType,
  isSimulating = false,
  simLoading = false,
  wsError = null,
  darkTheme = true,
}: WaveformViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 300 });

  // 游标状态
  const [cursors, setCursors] = useState<CursorPositions>({ a: null, b: null });

  // 初始视口（自动适配数据范围）
  const initialViewport = useMemo<Viewport>(() => {
    if (channels.length === 0) return { xMin: 0, xMax: 1, yMin: -1, yMax: 1 };
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    for (const ch of channels) {
      for (const pt of ch.data) {
        if (pt.x < xMin) xMin = pt.x;
        if (pt.x > xMax) xMax = pt.x;
        if (pt.y < yMin) yMin = pt.y;
        if (pt.y > yMax) yMax = pt.y;
      }
    }
    if (!isFinite(xMin)) return { xMin: 0, xMax: 1, yMin: -1, yMax: 1 };

    const logX = isLogX(analysisType);
    let fXMin: number, fXMax: number;
    if (logX) {
      fXMin = Math.max(xMin * 0.1, 1e-10);
      fXMax = xMax * 10;
    } else {
      const xPad = (xMax - xMin) * 0.05 || 0.1;
      fXMin = xMin - xPad;
      fXMax = xMax + xPad;
    }
    const yPad = (yMax - yMin) * 0.1 || 0.1;
    return { xMin: fXMin, xMax: fXMax, yMin: yMin - yPad, yMax: yMax + yPad };
  }, [channels, analysisType]);

  // 缩放平移 Hook
  const {
    viewport,
    gridDensity,
    panning,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleDoubleClick,
    resetViewport,
  } = useWaveformZoom(canvasRef, initialViewport, PADDING, {
    logXAxis: isLogX(analysisType),
  });

  // 当新数据到达时重置视口
  useEffect(() => {
    resetViewport(initialViewport);
    setCursors({ a: null, b: null });
  }, [initialViewport.xMin, initialViewport.xMax, initialViewport.yMin, initialViewport.yMax]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // requestAnimationFrame 渲染循环
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    ctx.scale(dpr, dpr);

    const render = () => {
      renderWaveform({
        ctx,
        width: canvasSize.width,
        height: canvasSize.height,
        channels,
        viewport,
        cursors,
        analysisType,
        gridDensity,
        isDark: darkTheme,
      });
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [canvasSize, channels, viewport, cursors, analysisType, gridDensity, darkTheme]);

  // 屏幕X → 数据X 映射函数（给测量工具用）
  const screenXToData = useCallback(
    (screenX: number): number => {
      const canvas = canvasRef.current;
      if (!canvas) return 0;
      const rect = canvas.getBoundingClientRect();
      const px = screenX - rect.left;
      return screenXToDataX(px, viewport, PADDING.left, canvasSize.width - PADDING.left - PADDING.right, isLogX(analysisType));
    },
    [viewport, canvasSize, analysisType]
  );

  // 通道可见性控制
  const [hiddenChannels, setHiddenChannels] = useState<Set<string>>(new Set());
  const toggleChannel = useCallback((name: string) => {
    setHiddenChannels(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const visibleChannels = useMemo(
    () => channels.map(ch => ({ ...ch, visible: ch.visible && !hiddenChannels.has(ch.name) })),
    [channels, hiddenChannels]
  );

  // 自动适配全部
  const handleAutoFitAll = useCallback(() => {
    resetViewport(initialViewport);
    setCursors({ a: null, b: null });
  }, [initialViewport, resetViewport]);

  // 自动适配 Y
  const handleAutoFitY = useCallback(() => {
    let yMin = Infinity, yMax = -Infinity;
    for (const ch of visibleChannels) {
      if (!ch.visible) continue;
      for (const pt of ch.data) {
        if (pt.x >= viewport.xMin && pt.x <= viewport.xMax) {
          if (pt.y < yMin) yMin = pt.y;
          if (pt.y > yMax) yMax = pt.y;
        }
      }
    }
    if (!isFinite(yMin)) return;
    const pad = (yMax - yMin) * 0.1 || 0.1;
    resetViewport({ ...viewport, yMin: yMin - pad, yMax: yMax + pad });
  }, [visibleChannels, viewport, resetViewport]);

  // 导出 CSV
  const handleExportCSV = useCallback(() => {
    const csv = exportToCSV(channels, {
      visibleOnly: true,
      analysisType,
    });
    if (!csv) return;
    downloadFile(csv, `waveform-${analysisType}-${formatFileTimestamp()}.csv`, 'text/csv;charset=utf-8;');
  }, [channels, analysisType]);

  // 导出 PNG
  const handleExportPNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    downloadPNG(canvas, `waveform-${analysisType}-${formatFileTimestamp()}.png`);
  }, [analysisType]);

  // 导出选中时间范围 CSV
  const handleExportSelectedRange = useCallback(() => {
    if (cursors.a === null || cursors.b === null) {
      // 没有游标则导出当前视口
      const csv = exportToCSV(channels, {
        visibleOnly: true,
        analysisType,
        timeRange: { start: viewport.xMin, end: viewport.xMax },
      });
      if (!csv) return;
      downloadFile(csv, `waveform-range-${analysisType}-${formatFileTimestamp()}.csv`, 'text/csv;charset=utf-8;');
      return;
    }
    const start = Math.min(cursors.a, cursors.b);
    const end = Math.max(cursors.a, cursors.b);
    const csv = exportToCSV(channels, {
      visibleOnly: true,
      analysisType,
      timeRange: { start, end },
    });
    if (!csv) return;
    downloadFile(csv, `waveform-range-${formatValue(start)}-${formatValue(end)}-${formatFileTimestamp()}.csv`, 'text/csv;charset=utf-8;');
  }, [channels, analysisType, cursors, viewport]);

  const hasData = channels.length > 0;

  return (
    <div className="wf-viewer" data-theme={darkTheme ? 'dark' : 'light'}>
      {/* 工具栏 */}
      <div className="wf-viewer-toolbar">
        <span className="wf-viewer-title">📊 波形显示</span>
        {hasData && (
          <>
            <button className="wf-viewer-btn" onClick={handleAutoFitAll} title="自动适配全部">⊞ 适配</button>
            <button className="wf-viewer-btn" onClick={handleAutoFitY} title="自动适配 Y 轴">↕ 适配Y</button>
            <span className="wf-viewer-sep" />
            <button className="wf-viewer-btn" onClick={handleExportCSV} title="导出全部可见通道为 CSV">📥 CSV</button>
            <button className="wf-viewer-btn" onClick={handleExportPNG} title="导出波形图为 PNG">📷 PNG</button>
            <button
              className="wf-viewer-btn"
              onClick={handleExportSelectedRange}
              title={cursors.a !== null && cursors.b !== null ? '导出游标间数据' : '导出当前视口数据'}
            >
              ✂️ 范围导出
            </button>
          </>
        )}
      </div>

      {/* Canvas 区域 */}
      <div className="wf-viewer-canvas-container" ref={containerRef}>
        {wsError ? (
          <div className="wf-viewer-error">
            <span>❌ 仿真连接错误</span>
            <span className="wf-viewer-error-detail">{wsError}</span>
          </div>
        ) : isSimulating || simLoading ? (
          <div className="wf-viewer-loading">
            <div className="wf-viewer-spinner" />
            <span>{simLoading ? '正在连接仿真服务...' : '仿真计算中...'}</span>
          </div>
        ) : hasData ? (
          <canvas
            ref={canvasRef}
            className="wf-viewer-canvas"
            style={{
              width: canvasSize.width,
              height: canvasSize.height,
              cursor: panning ? 'grabbing' : 'grab',
            }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onDoubleClick={handleDoubleClick}
          />
        ) : (
          <div className="wf-viewer-placeholder">
            <p>仿真完成后波形将在此显示</p>
            <p className="hint">支持多通道叠加 · 缩放平移 · 游标测量 · 数据导出</p>
          </div>
        )}
      </div>

      {/* 通道图例 */}
      {hasData && (
        <div className="wf-viewer-legend">
          {channels.map((ch, i) => (
            <button
              key={ch.name}
              className={`wf-channel-tag ${hiddenChannels.has(ch.name) ? 'wf-channel-hidden' : ''}`}
              onClick={() => toggleChannel(ch.name)}
              style={{
                borderColor: hiddenChannels.has(ch.name) ? undefined : (ch.color || CHANNEL_COLORS[i % CHANNEL_COLORS.length]),
              }}
            >
              <span
                className="wf-channel-dot"
                style={{ backgroundColor: ch.color || CHANNEL_COLORS[i % CHANNEL_COLORS.length] }}
              />
              {ch.name}
            </button>
          ))}
        </div>
      )}

      {/* 测量工具 */}
      {hasData && (
        <WaveformMeasure
          channels={visibleChannels}
          cursors={cursors}
          onCursorsChange={setCursors}
          analysisType={analysisType}
          screenXToData={screenXToData}
          plotBounds={{
            left: PADDING.left,
            top: PADDING.top,
            width: canvasSize.width - PADDING.left - PADDING.right,
            height: canvasSize.height - PADDING.top - PADDING.bottom,
          }}
        />
      )}
    </div>
  );
}
