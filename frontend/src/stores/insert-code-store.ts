/**
 * 代码插入 Store
 * LibraryReference → CodeEditor 的桥梁
 */
import { create } from 'zustand';

interface InsertCodeState {
  /** 待插入的代码片段（每次插入后自动清空） */
  pendingSnippet: string | null;
  /** 触发代码插入 */
  insertCode: (snippet: string) => void;
  /** 标记已消费 */
  consume: () => void;
}

export const useInsertCodeStore = create<InsertCodeState>((set) => ({
  pendingSnippet: null,
  insertCode: (snippet) => set({ pendingSnippet: snippet }),
  consume: () => set({ pendingSnippet: null }),
}));
