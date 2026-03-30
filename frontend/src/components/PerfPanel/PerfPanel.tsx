import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PerformanceMonitor } from '../../core/PerformanceMonitor';
import type { PerfMetrics } from '../../core/PerformanceMonitor';
import './PerfPanel.css';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PerfPanelProps {
  visible: boolean;
  componentCount: number;
  nodeCount: number;
  wireCount: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PerfPanel: React.FC<PerfPanelProps> = ({
  visible,
  componentCount,
  nodeCount,
  wireCount,
}) => {
  const [metrics, setMetrics] = useState<PerfMetrics | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const monitorRef = useRef<PerformanceMonitor | null>(null);

  // 初始化 PerformanceMonitor（单例）
  if (!monitorRef.current) {
    monitorRef.current = new PerformanceMonitor({ historySize: 120, sampleInterval: 500 });
  }

  // ── 订阅性能数据 ──
  useEffect(() => {
    const monitor = monitorRef.current;
    if (!monitor) return;

    const unsub = monitor.subscribe((m: PerfMetrics) => {
      setMetrics(m);
    });

    return () => { unsub(); };
  }, []);

  // ── 更新电路统计 ──
  useEffect(() => {
    const monitor = monitorRef.current;
    if (!monitor) return;
    monitor.updateCircuitStats(componentCount, nodeCount, wireCount);
  }, [componentCount, nodeCount, wireCount]);

  // ── 拖拽逻辑 ──
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: position.x,
      startPosY: position.y,
    };
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPosition({
        x: dragRef.current.startPosX + dx,
        y: dragRef.current.startPosY + dy,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // ── FPS 颜色 ──
  const getFpsColor = (fps: number): string => {
    if (fps > 50) return 'var(--perf-green)';
    if (fps >= 30) return 'var(--perf-yellow)';
    return 'var(--perf-red)';
  };

  // ── 格式化内存 ──
  const formatMemory = (mb: number): string => {
    if (mb === 0) return 'N/A';
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb.toFixed(1)} MB`;
  };

  if (!visible) return null;

  const currentFps = metrics?.fps ?? 0;
  const fpsColor = getFpsColor(currentFps);

  // ── 最小化模式 ──
  if (collapsed) {
    return (
      <div
        ref={panelRef}
        className="perf-panel perf-panel--minimized"
        style={{
          right: 16 + position.x,
          top: 16 + position.y,
          '--perf-current-color': fpsColor,
        } as React.CSSProperties}
        onClick={() => setCollapsed(false)}
        title="点击展开性能面板"
      >
        <span className="perf-panel__fps-mini" style={{ color: fpsColor }}>
          {currentFps}
        </span>
        <span className="perf-panel__fps-label">FPS</span>
      </div>
    );
  }

  // ── 完整面板 ──
  return (
    <div
      ref={panelRef}
      className={`perf-panel ${isDragging ? 'perf-panel--dragging' : ''}`}
      style={{
        right: 16 + position.x,
        top: 16 + position.y,
        '--perf-current-color': fpsColor,
      } as React.CSSProperties}
    >
      {/* 拖拽标题栏 */}
      <div className="perf-panel__header" onMouseDown={handleMouseDown}>
        <span className="perf-panel__title">⚡ 性能监控</span>
        <button
          className="perf-panel__collapse-btn"
          onClick={(e) => { e.stopPropagation(); setCollapsed(true); }}
          title="最小化"
        >
          ─
        </button>
      </div>

      <div className="perf-panel__body">
        {/* FPS 区域 */}
        <div className="perf-panel__section">
          <div className="perf-panel__section-title">FPS</div>
          <div className="perf-panel__grid">
            <div className="perf-panel__metric">
              <span className="perf-panel__metric-label">当前</span>
              <span className="perf-panel__metric-value" style={{ color: fpsColor }}>
                {metrics?.fps ?? '--'}
              </span>
            </div>
            <div className="perf-panel__metric">
              <span className="perf-panel__metric-label">平均</span>
              <span className="perf-panel__metric-value">
                {metrics?.avgFps ?? '--'}
              </span>
            </div>
            <div className="perf-panel__metric">
              <span className="perf-panel__metric-label">最低</span>
              <span className="perf-panel__metric-value">
                {metrics?.minFps ?? '--'}
              </span>
            </div>
          </div>
        </div>

        {/* 渲染时间 */}
        <div className="perf-panel__section">
          <div className="perf-panel__section-title">渲染时间</div>
          <div className="perf-panel__grid">
            <div className="perf-panel__metric">
              <span className="perf-panel__metric-label">当前</span>
              <span className="perf-panel__metric-value">
                {metrics?.renderTime != null ? `${metrics.renderTime.toFixed(1)} ms` : '--'}
              </span>
            </div>
            <div className="perf-panel__metric">
              <span className="perf-panel__metric-label">平均</span>
              <span className="perf-panel__metric-value">
                {metrics?.avgRenderTime != null ? `${metrics.avgRenderTime.toFixed(1)} ms` : '--'}
              </span>
            </div>
          </div>
        </div>

        {/* 内存 */}
        <div className="perf-panel__section">
          <div className="perf-panel__section-title">内存</div>
          <div className="perf-panel__grid">
            <div className="perf-panel__metric">
              <span className="perf-panel__metric-label">已用</span>
              <span className="perf-panel__metric-value">
                {formatMemory(metrics?.usedJSHeapSize ?? 0)}
              </span>
            </div>
            <div className="perf-panel__metric">
              <span className="perf-panel__metric-label">总计</span>
              <span className="perf-panel__metric-value">
                {formatMemory(metrics?.totalJSHeapSize ?? 0)}
              </span>
            </div>
          </div>
        </div>

        {/* 电路复杂度 */}
        <div className="perf-panel__section">
          <div className="perf-panel__section-title">电路复杂度</div>
          <div className="perf-panel__grid perf-panel__grid--3col">
            <div className="perf-panel__metric">
              <span className="perf-panel__metric-label">元件</span>
              <span className="perf-panel__metric-value">{componentCount}</span>
            </div>
            <div className="perf-panel__metric">
              <span className="perf-panel__metric-label">节点</span>
              <span className="perf-panel__metric-value">{nodeCount}</span>
            </div>
            <div className="perf-panel__metric">
              <span className="perf-panel__metric-label">连线</span>
              <span className="perf-panel__metric-value">{wireCount}</span>
            </div>
          </div>
        </div>

        {/* 仿真统计 */}
        <div className="perf-panel__section">
          <div className="perf-panel__section-title">仿真统计</div>
          <div className="perf-panel__grid perf-panel__grid--3col">
            <div className="perf-panel__metric">
              <span className="perf-panel__metric-label">步耗时</span>
              <span className="perf-panel__metric-value">
                {metrics?.simStepTime != null ? `${metrics.simStepTime.toFixed(1)} ms` : '--'}
              </span>
            </div>
            <div className="perf-panel__metric">
              <span className="perf-panel__metric-label">总耗时</span>
              <span className="perf-panel__metric-value">
                {metrics?.simTotalTime != null ? `${metrics.simTotalTime.toFixed(0)} ms` : '--'}
              </span>
            </div>
            <div className="perf-panel__metric">
              <span className="perf-panel__metric-label">步数</span>
              <span className="perf-panel__metric-value">
                {metrics?.simSteps ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerfPanel;
