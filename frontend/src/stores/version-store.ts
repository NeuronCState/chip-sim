/**
 * 版本管理状态 Store
 * 使用 Zustand 管理版本历史的全局状态
 */

import { create } from 'zustand';
import type { VersionSnapshot, DiffResult } from '../types/version';
import type { CircuitComponent, CircuitNode, Wire, SimulationConfig } from '../types/circuit';
import { versionManager } from '../core/VersionManager';
import { VersionTrigger } from '../types/version';

interface VersionStore {
  // === 数据 ===
  versions: VersionSnapshot[];
  isLoading: boolean;
  error: string | null;

  // === UI 状态 ===
  /** 版本历史面板是否打开 */
  showVersionPanel: boolean;
  /** 当前预览的版本（只读模式） */
  previewVersionId: string | null;
  /** Diff 比较模式的选中版本 */
  diffFromId: string | null;
  diffToId: string | null;
  /** Diff 结果 */
  diffResult: DiffResult | null;

  // === 操作 ===
  /** 初始化版本管理器 */
  init: () => Promise<void>;
  /** 加载版本列表 */
  loadVersions: (projectId: string) => Promise<void>;
  /** 创建版本快照 */
  createSnapshot: (
    projectId: string,
    circuitData: {
      components: CircuitComponent[];
      nodes: CircuitNode[];
      wires: Wire[];
      simulationConfig?: SimulationConfig;
    },
    options?: {
      label?: string;
      description?: string;
      trigger?: typeof VersionTrigger[keyof typeof VersionTrigger];
      thumbnail?: string;
    }
  ) => Promise<VersionSnapshot | null>;
  /** 恢复到指定版本 */
  restoreVersion: (versionId: string) => Promise<{
    components: CircuitComponent[];
    nodes: CircuitNode[];
    wires: Wire[];
    simulationConfig?: SimulationConfig;
  } | null>;
  /** 删除版本 */
  deleteVersion: (versionId: string) => Promise<void>;
  /** 更新版本元数据 */
  updateVersionMeta: (
    versionId: string,
    meta: { label?: string; description?: string }
  ) => Promise<void>;
  /** 比较两个版本 */
  compareVersions: (fromId: string, toId: string) => Promise<void>;
  /** 导出版本 */
  exportVersion: (versionId: string) => Promise<void>;

  // === UI 操作 ===
  toggleVersionPanel: () => void;
  setPreviewVersion: (id: string | null) => void;
  setDiffVersions: (fromId: string | null, toId: string | null) => void;
  clearDiff: () => void;

  // === 重置 ===
  reset: () => void;
}

const initialState = {
  versions: [] as VersionSnapshot[],
  isLoading: false,
  error: null as string | null,
  showVersionPanel: false,
  previewVersionId: null as string | null,
  diffFromId: null as string | null,
  diffToId: null as string | null,
  diffResult: null as DiffResult | null,
};

export const useVersionStore = create<VersionStore>((set, get) => ({
  ...initialState,

  init: async () => {
    try {
      await versionManager.init();
    } catch (e) {
      set({ error: `版本管理器初始化失败: ${e}` });
    }
  },

  loadVersions: async (projectId: string) => {
    set({ isLoading: true, error: null });
    try {
      const versions = await versionManager.listVersions(projectId);
      set({ versions, isLoading: false });
    } catch (e) {
      set({ error: `加载版本失败: ${e}`, isLoading: false });
    }
  },

  createSnapshot: async (projectId, circuitData, options) => {
    set({ isLoading: true, error: null });
    try {
      const version = await versionManager.createSnapshot(projectId, circuitData, options);
      // 重新加载版本列表
      const versions = await versionManager.listVersions(projectId);
      set({ versions, isLoading: false });
      return version;
    } catch (e) {
      set({ error: `创建版本失败: ${e}`, isLoading: false });
      return null;
    }
  },

  restoreVersion: async (versionId) => {
    set({ isLoading: true, error: null });
    try {
      const data = await versionManager.restoreVersion(versionId);
      set({ isLoading: false, previewVersionId: null });
      return data;
    } catch (e) {
      set({ error: `恢复版本失败: ${e}`, isLoading: false });
      return null;
    }
  },

  deleteVersion: async (versionId) => {
    set({ isLoading: true, error: null });
    try {
      await versionManager.deleteVersion(versionId);
      const versions = get().versions.filter(v => v.id !== versionId);
      set({ versions, isLoading: false });
    } catch (e) {
      set({ error: `删除版本失败: ${e}`, isLoading: false });
    }
  },

  updateVersionMeta: async (versionId, meta) => {
    try {
      await versionManager.updateVersionMeta(versionId, meta);
      const versions = get().versions.map(v =>
        v.id === versionId
          ? { ...v, label: meta.label ?? v.label, description: meta.description ?? v.description }
          : v
      );
      set({ versions });
    } catch (e) {
      set({ error: `更新版本失败: ${e}` });
    }
  },

  compareVersions: async (fromId, toId) => {
    set({ isLoading: true, error: null });
    try {
      const diff = await versionManager.compareVersions(fromId, toId);
      set({ diffResult: diff, diffFromId: fromId, diffToId: toId, isLoading: false });
    } catch (e) {
      set({ error: `比较版本失败: ${e}`, isLoading: false });
    }
  },

  exportVersion: async (versionId) => {
    try {
      await versionManager.exportVersion(versionId);
    } catch (e) {
      set({ error: `导出版本失败: ${e}` });
    }
  },

  toggleVersionPanel: () => set(s => ({ showVersionPanel: !s.showVersionPanel })),

  setPreviewVersion: (id) => set({ previewVersionId: id }),

  setDiffVersions: (fromId, toId) => set({ diffFromId: fromId, diffToId: toId, diffResult: null }),

  clearDiff: () => set({ diffFromId: null, diffToId: null, diffResult: null }),

  reset: () => set({ ...initialState }),
}));
