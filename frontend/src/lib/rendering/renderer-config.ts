/**
 * 渲染器共享配置
 * 从 canvas-renderer.ts 和 webgl-renderer.ts 提取
 */

/** 渲染器配置 */
export interface RendererConfig {
  /** 网格大小 */
  gridSize: number;
  /** 是否显示网格 */
  showGrid: boolean;
  /** 背景色 */
  backgroundColor: string;
  /** 网格颜色 */
  gridColor: string;
  /** 连线颜色 */
  wireColor: string;
  /** 元件颜色 */
  componentColor: string;
  /** 选中高亮色 */
  selectionColor: string;
  /** 连线选中色 */
  wireSelectionColor: string;
  /** 端口颜色 */
  portColor: string;
  /** 端口吸附高亮 */
  portSnapColor: string;
  /** 预览连线颜色 */
  wirePreviewColor: string;
}

export const DEFAULT_RENDERER_CONFIG: RendererConfig = {
  gridSize: 20,
  showGrid: true,
  backgroundColor: '#1a1a2e',
  gridColor: '#2a2a4a',
  wireColor: '#00d4ff',
  componentColor: '#e0e0e0',
  selectionColor: '#ff6b6b',
  wireSelectionColor: '#ff6b6b',
  portColor: '#4ecdc4',
  portSnapColor: '#ffd93d',
  wirePreviewColor: '#8888ff',
};
