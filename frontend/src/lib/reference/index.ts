/** 库函数速查数据 — 汇总导出 */

export type { LibEntry } from './stm32-hal';
export { stm32HalFunctions } from './stm32-hal';
export { arduinoApiFunctions } from './arduino-api';
export { mcs51Registers } from './mcs51-registers';

import type { LibEntry } from './stm32-hal';
import { stm32HalFunctions } from './stm32-hal';
import { arduinoApiFunctions } from './arduino-api';
import { mcs51Registers } from './mcs51-registers';

/** 全部速查条目 */
export const allReferences: LibEntry[] = [
  ...stm32HalFunctions,
  ...arduinoApiFunctions,
  ...mcs51Registers,
];

/** 按平台筛选 */
export function getReferencesByPlatform(platform: LibEntry['platform']): LibEntry[] {
  return allReferences.filter(r => r.platform === platform);
}

/** 搜索函数（名称 + 描述 + 关键词） */
export function searchReferences(query: string, platform?: LibEntry['platform']): LibEntry[] {
  const q = query.toLowerCase().trim();
  if (!q) return platform ? getReferencesByPlatform(platform) : allReferences;

  const pool = platform ? getReferencesByPlatform(platform) : allReferences;
  return pool.filter(entry => {
    if (entry.name.toLowerCase().includes(q)) return true;
    if (entry.description.toLowerCase().includes(q)) return true;
    if (entry.category.toLowerCase().includes(q)) return true;
    if (entry.signature.toLowerCase().includes(q)) return true;
    return entry.keywords.some(kw => kw.toLowerCase().includes(q));
  });
}
