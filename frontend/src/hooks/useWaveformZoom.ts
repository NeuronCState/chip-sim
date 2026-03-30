/**
 * 波形缩放和平移 Hook
 * - 鼠标滚轮缩放时间轴（X轴）和电压轴（Y轴）
 * - 拖拽平移波形
 * - 双击重置视图
 * - 缩放时自动调整网格密度
 */

import { useRef, useCallback, useEffect, useState } from 'react';

/** 视口范围 */
export interface Viewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** 缩放平移配置 */
export interface WaveformZoomConfig {
  /** 最小缩放比例（0~1） */
  minZoom: number;
  /** 最大缩放比例 */
  maxZoom: number;
  /** 缩放因子（每次滚轮步进） */
  zoomStep: number;
  /** 是否启用对数X轴 */
  logXAxis: boolean;
}

/** 缩放平移状态 */
export interface WaveformZoomState {
  viewport: Viewport;
  /** 自动计算的网格密度 */
  gridDensity: { xCount: number; yCount: number };
}

const DEFAULT_CONFIG: WaveformZoomConfig = {
  minZoom: 0.001,
  maxZoom: 10000,
  zoomStep: 0.12,
  logXAxis: false,
};

/** 根据视口范围计算合适的网格密度 */
function computeGridDensity(
  _viewport: Viewport,
  plotWidth: number,
  plotHeight: number
): { xCount: number; yCount: number } {
  // 目标：每条网格线间距 ~80px
  const targetXPixels = 80;
  const targetYPixels = 60;

  const xCount = Math.max(2, Math.min(20, Math.floor(plotWidth / targetXPixels)));
  const yCount = Math.max(2, Math.min(15, Math.floor(plotHeight / targetYPixels)));

  return { xCount, yCount };
}

/**
 * 波形缩放平移 Hook
 * @param canvasRef Canvas 元素引用
 * @param initialViewport 初始视口范围
 * @param padding 画布内边距 {top, right, bottom, left}
 * @param config 配置
 */
export function useWaveformZoom(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  initialViewport: Viewport,
  padding: { top: number; right: number; bottom: number; left: number },
  config: Partial<WaveformZoomConfig> = {}
) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const [viewport, setViewport] = useState<Viewport>(initialViewport);
  const [gridDensity, setGridDensity] = useState({ xCount: 8, yCount: 6 });

  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, vp: viewport });

  // 同步视口初始值
  useEffect(() => {
    setViewport(initialViewport);
  }, [initialViewport.xMin, initialViewport.xMax, initialViewport.yMin, initialViewport.yMax]); // eslint-disable-line react-hooks/exhaustive-deps

  // 计算绘图区域尺寸
  const getPlotDimensions = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return { width: 800, height: 300 };
    return {
      width: canvas.width / (window.devicePixelRatio || 1) - padding.left - padding.right,
      height: canvas.height / (window.devicePixelRatio || 1) - padding.top - padding.bottom,
    };
  }, [canvasRef, padding]);

  // 缩放时更新网格密度
  useEffect(() => {
    const { width, height } = getPlotDimensions();
    setGridDensity(computeGridDensity(viewport, width, height));
  }, [viewport, getPlotDimensions]);

  /** 滚轮缩放 */
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const plotLeft = padding.left;
      const plotTop = padding.top;
      const { width: plotWidth, height: plotHeight } = getPlotDimensions();

      if (mx < plotLeft || mx > plotLeft + plotWidth || my < plotTop || my > plotTop + plotHeight) return;

      // 缩放因子
      const zoomFactor = e.deltaY < 0 ? 1 - cfg.zoomStep : 1 + cfg.zoomStep;

      // 鼠标所在的数据坐标
      const dataX = viewport.xMin + ((mx - plotLeft) / plotWidth) * (viewport.xMax - viewport.xMin);
      const dataY = viewport.yMax - ((my - plotTop) / plotHeight) * (viewport.yMax - viewport.yMin);

      // 如果只按住 Shift，只缩放 X 轴
      // 如果只按住 Ctrl，只缩放 Y 轴
      // 否则同时缩放
      const shiftOnly = e.shiftKey && !e.ctrlKey;
      const ctrlOnly = e.ctrlKey && !e.shiftKey;

      let newXMin = viewport.xMin, newXMax = viewport.xMax;
      let newYMin = viewport.yMin, newYMax = viewport.yMax;

      if (!ctrlOnly) {
        newXMin = dataX - (dataX - viewport.xMin) * zoomFactor;
        newXMax = dataX + (viewport.xMax - dataX) * zoomFactor;
      }
      if (!shiftOnly) {
        newYMin = dataY - (dataY - viewport.yMin) * zoomFactor;
        newYMax = dataY + (viewport.yMax - dataY) * zoomFactor;
      }

      setViewport({ xMin: newXMin, xMax: newXMax, yMin: newYMin, yMax: newYMax });
    },
    [canvasRef, padding, getPlotDimensions, viewport, cfg.zoomStep]
  );

  /** 鼠标按下 → 开始平移 */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY, vp: { ...viewport } };
    },
    [viewport]
  );

  /** 鼠标移动 → 平移 */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning.current) return;
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      const { width: plotWidth, height: plotHeight } = getPlotDimensions();
      const vp = panStart.current.vp;
      const xRange = vp.xMax - vp.xMin;
      const yRange = vp.yMax - vp.yMin;

      setViewport({
        xMin: vp.xMin - (dx / plotWidth) * xRange,
        xMax: vp.xMax - (dx / plotWidth) * xRange,
        yMin: vp.yMin + (dy / plotHeight) * yRange,
        yMax: vp.yMax + (dy / plotHeight) * yRange,
      });
    },
    [getPlotDimensions]
  );

  /** 鼠标释放 → 结束平移 */
  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  /** 鼠标离开 → 结束平移 */
  const handleMouseLeave = useCallback(() => {
    isPanning.current = false;
  }, []);

  /** 双击重置视图 */
  const handleDoubleClick = useCallback(() => {
    setViewport({ ...initialViewport });
  }, [initialViewport]);

  /** 重置视图到指定范围 */
  const resetViewport = useCallback((vp: Viewport) => {
    setViewport(vp);
  }, []);

  /** 仅缩放X轴（时间轴）到指定范围 */
  const zoomXRange = useCallback((xMin: number, xMax: number) => {
    setViewport(prev => ({ ...prev, xMin, xMax }));
  }, []);

  /** 仅缩放Y轴到指定范围 */
  const zoomYRange = useCallback((yMin: number, yMax: number) => {
    setViewport(prev => ({ ...prev, yMin, yMax }));
  }, []);

  /** 是否正在平移 */
  const panning = isPanning.current;

  return {
    viewport,
    setViewport: resetViewport,
    gridDensity,
    panning,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleDoubleClick,
    zoomXRange,
    zoomYRange,
    resetViewport,
  };
}
