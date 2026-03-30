/** 库函数速查 — 类型定义 */

/** 代码平台 */
export type LibPlatform = 'stm32hal' | 'arduino' | 'mcs51';

/** 单条 API/函数/寄存器 */
export interface LibEntry {
  /** 唯一 ID */
  id: string;
  /** 显示名称 */
  name: string;
  /** 分类标签（如 GPIO, UART, Timer 等） */
  category: string;
  /** 所属平台 */
  platform: LibPlatform;
  /** 简要说明 */
  description: string;
  /** 函数签名或寄存器地址 */
  signature: string;
  /** 插入编辑器的代码片段 */
  snippet: string;
  /** 搜索关键词（额外可搜索词） */
  keywords?: string[];
}

/** 分类定义 */
export interface LibCategory {
  id: string;
  label: string;
  icon: string;
  platform: LibPlatform;
}
