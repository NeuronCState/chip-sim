/**
 * 布局状态类型定义
 * 用于 McuSimulator 面板布局持久化
 */

/** 引脚类型分类 */
export type PinTypeCategory = 'gpio' | 'power' | 'control' | 'analog' | 'communication' | 'other';

/** 面板筛选器状态 */
export interface PinFilter {
  /** 搜索关键词 */
  query: string;
  /** 引脚类型筛选（多选） */
  types: PinTypeCategory[];
  /** 端口筛选（多选） */
  ports: string[];
}

/** McuSimulator 布局状态 */
export interface LayoutState {
  /** 左栏宽度 (px) */
  leftWidth: number;
  /** 右栏宽度 (px) */
  rightWidth: number;
  /** 底栏高度 (px) */
  bottomHeight: number;
  /** 左栏内元件库高度 (px)，PinListPanel 为 flex:1 自动填充 */
  componentLibHeight: number;
  /** 面板开合状态 */
  panels: {
    left: boolean;
    right: boolean;
    bottom: boolean;
  };
  /** 端口分组折叠状态 (port → collapsed) */
  collapsedPorts: Record<string, boolean>;
  /** 引脚筛选器状态 */
  pinFilter: PinFilter;
}

/** 默认布局状态 */
export const DEFAULT_LAYOUT: LayoutState = {
  leftWidth: 200,
  rightWidth: 320,
  bottomHeight: 200,
  componentLibHeight: 180,
  panels: {
    left: true,
    right: true,
    bottom: false,
  },
  collapsedPorts: {},
  pinFilter: {
    query: '',
    types: [],
    ports: [],
  },
};
