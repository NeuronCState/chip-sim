/** 画布交互类型定义 */

export interface SelectedElement {
  type: 'component' | 'wire' | 'pin' | 'chip';
  id: string;
  name?: string;
  properties?: Record<string, unknown>;
}

export interface CanvasState {
  offsetX: number;
  offsetY: number;
  scale: number;
  isDragging: boolean;
  isPanning: boolean;
}
