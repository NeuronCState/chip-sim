/**
 * 电路版本管理类型定义
 * 支持版本快照、变更历史、Diff 比较
 */

import type { CircuitComponent, CircuitNode, Wire, SimulationConfig } from './circuit';

// ==================== 版本快照 ====================

/** 版本变更类型 */
export const ChangeType = {
  Added: 'added',
  Removed: 'removed',
  Modified: 'modified',
  Moved: 'moved',
} as const;
export type ChangeType = (typeof ChangeType)[keyof typeof ChangeType];

/** 元件变更记录 */
export interface ComponentChange {
  type: ChangeType;
  componentId: string;
  /** 变更前的数据（删除/修改/移动时） */
  before?: CircuitComponent;
  /** 变更后的数据（新增/修改/移动时） */
  after?: CircuitComponent;
  /** 参数变化摘要 */
  paramChanges?: ParamChange[];
}

/** 参数变化 */
export interface ParamChange {
  field: string;
  label: string;
  oldValue: string | number;
  newValue: string | number;
}

/** 连线变更记录 */
export interface WireChange {
  type: ChangeType;
  wireId: string;
  before?: Wire;
  after?: Wire;
}

/** 版本变更摘要 */
export interface ChangeSummary {
  componentsAdded: number;
  componentsRemoved: number;
  componentsModified: number;
  componentsMoved: number;
  wiresAdded: number;
  wiresRemoved: number;
  wiresModified: number;
  /** 详细变更列表 */
  componentChanges: ComponentChange[];
  wireChanges: WireChange[];
}

/** 版本快照数据 */
export interface VersionSnapshot {
  /** 版本唯一 ID */
  id: string;
  /** 关联的项目 ID */
  projectId: string;
  /** 版本标签（如 v1.0, "测试通过版"） */
  label: string;
  /** 版本描述 */
  description: string;
  /** 创建时间 */
  createdAt: string;
  /** 创建触发方式 */
  trigger: VersionTrigger;
  /** 电路完整数据 */
  circuitData: {
    components: CircuitComponent[];
    nodes: CircuitNode[];
    wires: Wire[];
    simulationConfig?: SimulationConfig;
  };
  /** 缩略图（base64 data URL） */
  thumbnail?: string;
  /** 相对上一个版本的变更摘要 */
  changeSummary?: ChangeSummary;
  /** 版本序号 */
  sequenceNumber: number;
}

/** 版本创建触发方式 */
export const VersionTrigger = {
  Manual: 'manual',
  PreSimulation: 'pre_simulation',
  PreClose: 'pre_close',
  Auto: 'auto',
} as const;
export type VersionTrigger = (typeof VersionTrigger)[keyof typeof VersionTrigger];

// ==================== Diff 结果 ====================

/** Diff 比较结果 */
export interface DiffResult {
  /** 被比较的两个版本 ID */
  fromVersionId: string;
  toVersionId: string;
  /** 元件变更 */
  componentChanges: ComponentChange[];
  /** 连线变更 */
  wireChanges: WireChange[];
  /** 汇总 */
  summary: ChangeSummary;
}

// ==================== 版本管理配置 ====================

/** 版本管理器配置 */
export interface VersionManagerConfig {
  /** 最大保留版本数，默认 50 */
  maxVersions: number;
  /** 是否启用仿真前自动快照 */
  autoSnapshotBeforeSim: boolean;
  /** 是否启用关闭前自动快照 */
  autoSnapshotBeforeClose: boolean;
  /** 缩略图尺寸 */
  thumbnailSize: { width: number; height: number };
}

/** 版本管理器事件 */
export interface VersionManagerEvents {
  onVersionCreated?: (version: VersionSnapshot) => void;
  onVersionRestored?: (version: VersionSnapshot) => void;
  onVersionDeleted?: (versionId: string) => void;
  onVersionsChanged?: (versions: VersionSnapshot[]) => void;
  onError?: (error: string) => void;
}

// ==================== 存储 ====================

/** IndexedDB 版本存储对象 */
export interface StoredVersion extends VersionSnapshot {
  /** 索引字段 */
  _projectIndex?: string;
}
