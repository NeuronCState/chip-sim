/**
 * 电路画布组件
 * 基于 Canvas 2D/WebGL 渲染电路拓扑，支持缩放、平移、元件选择和拖拽
 */

import { useRef, useEffect } from 'react';
import { useCanvas } from '../hooks/useCanvas';
import { ToolMode } from '../types/circuit';
import { useCircuitStore } from '../stores/circuit-store';
import './CircuitCanvas.css';

export function CircuitCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    handleDragOver,
    handleDrop,
  } = useCanvas(canvasRef);

  const { toolMode, setToolMode, viewTransform, setViewTransform, selectComponent, rendererMode, setRendererMode } =
    useCircuitStore();

  // 监听来自诊断面板的定位事件
  useEffect(() => {
    const handleLocate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.componentId) {
        selectComponent(detail.componentId);
        // 居中显示目标元件
        const { position } = detail;
        if (position && canvasRef.current) {
          const canvas = canvasRef.current;
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          setViewTransform({
            scale: 1.5,
            offsetX: centerX - position.x * 1.5,
            offsetY: centerY - position.y * 1.5,
          });
        }
      }
    };
    window.addEventListener('locate-component', handleLocate);
    return () => window.removeEventListener('locate-component', handleLocate);
  }, [selectComponent, setViewTransform]);

  /** 重置视图 */
  const resetView = () => {
    setViewTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  };

  /** 根据工具模式确定光标 */
  const getCursor = (): string => {
    if (toolMode === ToolMode.Pan) return 'grab';
    if (toolMode === ToolMode.DrawWire) return 'crosshair';
    if (toolMode === ToolMode.Delete) return 'not-allowed';
    if (toolMode === ToolMode.BoxSelect) return 'crosshair';
    return 'default';
  };

  return (
    <div className="circuit-canvas-container">
      {/* 画布内工具栏 */}
      <div className="canvas-toolbar">
        <button
          className={toolMode === ToolMode.Select ? 'active' : ''}
          onClick={() => setToolMode(ToolMode.Select)}
          title="选择 (V)"
        >
          🖱️ 选择
        </button>
        <button
          className={toolMode === ToolMode.Pan ? 'active' : ''}
          onClick={() => setToolMode(ToolMode.Pan)}
          title="平移 (H)"
        >
          ✋ 平移
        </button>
        <button
          className={toolMode === ToolMode.DrawWire ? 'active' : ''}
          onClick={() => setToolMode(ToolMode.DrawWire)}
          title="连线 (W)"
        >
          🔗 连线
        </button>
        <button
          className={toolMode === ToolMode.Delete ? 'active' : ''}
          onClick={() => setToolMode(ToolMode.Delete)}
          title="删除 (Del/点击)"
        >
          🗑️ 删除
        </button>
        <span className="toolbar-separator" />
        <button onClick={resetView} title="重置视图">
          🔄 重置
        </button>
        <span className="toolbar-separator" />
        <button
          className={rendererMode === 'webgl' ? 'active' : ''}
          onClick={() => setRendererMode(rendererMode === 'webgl' ? 'canvas2d' : 'webgl')}
          title="切换渲染器"
        >
          {rendererMode === 'webgl' ? '⚡ WebGL' : '🎨 Canvas2D'}
        </button>
        <span className="toolbar-info">
          缩放: {(viewTransform.scale * 100).toFixed(0)}%
        </span>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="circuit-canvas"
        style={{ cursor: getCursor() }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
