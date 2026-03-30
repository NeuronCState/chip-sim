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
  },
  {
    id: 'components',
    target: '.component-library',
    titleKey: 'tour.components.title',
    descKey: 'tour.components.desc',
    position: 'right',
  },
  {
    id: 'canvas',
    target: '.editor-canvas-area',
    titleKey: 'tour.canvas.title',
    descKey: 'tour.canvas.desc',
    position: 'left',
  },
  {
    id: 'properties',
    target: '.editor-right, .property-panel',
    titleKey: 'tour.properties.title',
    descKey: 'tour.properties.desc',
    position: 'left',
  },
  {
    id: 'simulate',
    target: '.simulator-control, .tb-btn-test',
    titleKey: 'tour.simulate.title',
    descKey: 'tour.simulate.desc',
    position: 'bottom',
  },
  {
    id: 'examples',
    target: '.help-tab:last-child',
    titleKey: 'tour.examples.title',
    descKey: 'tour.examples.desc',
    position: 'left',
  },
  {
    id: 'complete',
    target: 'body',
    titleKey: 'tour.complete.title',
    descKey: 'tour.complete.desc',
    position: 'bottom',
  },
];
