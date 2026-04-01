/**
 * 新手引导步骤定义
 * 每个步骤高亮一个UI元素并显示说明
 */

export interface TourStep {
  /** 步骤唯一 ID */
  id: string;
  /** 高亮目标的 CSS 选择器 */
  target: string;
  /** 标题 i18n key */
  titleKey: string;
  /** 描述 i18n key */
  descKey: string;
  /** 弹窗位置 */
  position: 'top' | 'bottom' | 'left' | 'right';
  /** 步骤图标 */
  icon: string;
  /** 偏移量 (px) */
  offset?: number;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    target: 'body',
    titleKey: 'tour.welcome.title',
    descKey: 'tour.welcome.desc',
    position: 'bottom',
    icon: '👋',
  },
  {
    id: 'chip-select',
    target: '.wizard-area, .mcu-simulator, body',
    titleKey: 'tour.chipSelect.title',
    descKey: 'tour.chipSelect.desc',
    position: 'bottom',
    icon: '🔧',
  },
  {
    id: 'template',
    target: '.mcu-btn-sm',
    titleKey: 'tour.template.title',
    descKey: 'tour.template.desc',
    position: 'bottom',
    icon: '📋',
  },
  {
    id: 'editor',
    target: '.ide-editor, .ide-monaco-container, .mcu-right',
    titleKey: 'tour.editor.title',
    descKey: 'tour.editor.desc',
    position: 'left',
    icon: '✏️',
  },
  {
    id: 'compile',
    target: '.mcu-btn-sm[style*="background: #2ecc71"], .mcu-section-header .mcu-btn-sm',
    titleKey: 'tour.compile.title',
    descKey: 'tour.compile.desc',
    position: 'bottom',
    icon: '▶️',
  },
  {
    id: 'canvas',
    target: '.mcu-canvas, .editor-canvas-area, #main-canvas',
    titleKey: 'tour.canvas.title',
    descKey: 'tour.canvas.desc',
    position: 'left',
    icon: '🖥️',
  },
  {
    id: 'properties',
    target: '.ide-editor, .editor-right, .property-panel',
    titleKey: 'tour.properties.title',
    descKey: 'tour.properties.desc',
    position: 'left',
    icon: '📊',
  },
  {
    id: 'reference',
    target: '.mcu-btn-sm',
    titleKey: 'tour.reference.title',
    descKey: 'tour.reference.desc',
    position: 'bottom',
    icon: '📖',
  },
  {
    id: 'complete',
    target: 'body',
    titleKey: 'tour.complete.title',
    descKey: 'tour.complete.desc',
    position: 'bottom',
    icon: '🎉',
  },
];
