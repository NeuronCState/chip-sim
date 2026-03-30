/**
 * 布局状态持久化工具
 * 按 chipFamily:chipModel 存取 localStorage
 */

import type { LayoutState } from '../types/layout';
import { DEFAULT_LAYOUT } from '../types/layout';

const STORAGE_PREFIX = 'chip-sim:layout:';

/**
 * 生成 localStorage key
 */
function storageKey(chipFamily: string, chipModel: string): string {
  return `${STORAGE_PREFIX}${chipFamily}:${chipModel}`;
}

/**
 * 加载布局状态
 * @returns LayoutState 或 null（无存储时）
 */
export function loadLayout(chipFamily: string, chipModel: string): LayoutState | null {
  try {
    const raw = localStorage.getItem(storageKey(chipFamily, chipModel));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // 简单校验：确保是对象且含关键字段
    if (typeof parsed !== 'object' || parsed === null) return null;
    return { ...DEFAULT_LAYOUT, ...parsed } as LayoutState;
  } catch {
    return null;
  }
}

/**
 * 保存布局状态
 */
export function saveLayout(chipFamily: string, chipModel: string, state: LayoutState): void {
  try {
    localStorage.setItem(storageKey(chipFamily, chipModel), JSON.stringify(state));
  } catch {
    // localStorage 满了，静默忽略
  }
}

/**
 * 获取默认布局（无存储时使用）
 */
export function getOrDefaultLayout(chipFamily: string, chipModel: string): LayoutState {
  return loadLayout(chipFamily, chipModel) ?? { ...DEFAULT_LAYOUT };
}
