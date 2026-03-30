/**
 * 项目管理类型定义
 * 扩展 CircuitProject，增加元数据、版本管理、导入导出等类型
 */

import type {
  CircuitComponent,
  CircuitNode,
  Wire,
  SimulationConfig,
} from './circuit';

// ==================== 项目版本 ====================

/** 当前项目格式版本 */
export const CURRENT_PROJECT_VERSION = '2.0.0';

/** 版本兼容性级别 */
export const VersionCompat = {
  Compatible: 'compatible',
  Upgradeable: 'upgradeable',
  Incompatible: 'incompatible',
} as const;
export type VersionCompat = (typeof VersionCompat)[keyof typeof VersionCompat];

// ==================== 项目元数据 ====================

/** 项目元数据 */
export interface ProjectMetadata {
  /** 作者 */
  author?: string;
  /** 标签列表 */
  tags: string[];
  /** 缩略图（base64 data URL） */
  thumbnail?: string;
  /** 项目描述 */
  description: string;
  /** 自定义颜色（用于卡片标识） */
  color?: string;
  /** 是否收藏 */
  starred?: boolean;
}

// ==================== 电路数据 ====================

/** 电路数据快照 */
export interface CircuitData {
  components: CircuitComponent[];
  nodes: CircuitNode[];
  wires: Wire[];
  simulationConfig: SimulationConfig;
}

// ==================== 项目接口 ====================

/** 完整项目接口 */
export interface Project {
  /** 项目唯一 ID */
  id: string;
  /** 项目名称 */
  name: string;
  /** 项目描述 */
  description: string;
  /** 创建时间 ISO 8601 */
  createdAt: string;
  /** 最后更新时间 ISO 8601 */
  updatedAt: string;
  /** 数据格式版本 */
  version: string;
  /** 电路数据 */
  circuit: CircuitData;
  /** 项目元数据 */
  metadata: ProjectMetadata;
}

// ==================== 项目列表项 ====================

/** 项目摘要信息（列表展示用，不含完整电路数据） */
export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  version: string;
  componentCount: number;
  wireCount: number;
  metadata: ProjectMetadata;
}

// ==================== 排序和筛选 ====================

/** 排序字段 */
export const SortField = {
  Name: 'name',
  CreatedAt: 'createdAt',
  UpdatedAt: 'updatedAt',
  ComponentCount: 'componentCount',
} as const;
export type SortField = (typeof SortField)[keyof typeof SortField];

/** 排序方向 */
export const SortOrder = {
  Asc: 'asc',
  Desc: 'desc',
} as const;
export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];

/** 项目查询条件 */
export interface ProjectQuery {
  /** 搜索关键词（匹配名称和描述） */
  search?: string;
  /** 标签筛选 */
  tags?: string[];
  /** 是否仅收藏 */
  starred?: boolean;
  /** 排序字段 */
  sortBy?: SortField;
  /** 排序方向 */
  sortOrder?: SortOrder;
}

// ==================== 导入导出 ====================

/** 导出文件头 */
export interface ExportFileHeader {
  format: 'chip-sim-project';
  version: string;
  exportedAt: string;
}

/** 导出文件结构 */
export interface ExportFile {
  header: ExportFileHeader;
  project: Project;
}

/** 批量导出文件结构 */
export interface BundleExportFile {
  header: {
    format: 'chip-sim-bundle';
    version: string;
    exportedAt: string;
    projectCount: number;
  };
  projects: Project[];
}

/** 导入结果 */
export interface ImportResult {
  success: boolean;
  projectId?: string;
  projectName?: string;
  error?: string;
  warnings?: string[];
}

// ==================== 版本管理 ====================

/** 项目版本快照 */
export interface ProjectVersion {
  /** 版本序号（从 1 开始） */
  versionNumber: number;
  /** 创建时间 */
  createdAt: string;
  /** 项目数据（完整快照） */
  data: Project;
  /** 变更说明 */
  changeNote?: string;
}

// ==================== 自动保存 ====================

/** 自动保存配置 */
export interface AutoSaveConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 间隔毫秒数 */
  intervalMs: number;
  /** debounce 延迟毫秒数 */
  debounceMs: number;
}

/** 默认自动保存配置 */
export const DEFAULT_AUTOSAVE: AutoSaveConfig = {
  enabled: true,
  intervalMs: 30000,
  debounceMs: 3000,
};

// ==================== 存储事件 ====================

/** 存储事件类型 */
export const StorageEventType = {
  Saved: 'saved',
  Deleted: 'deleted',
  Error: 'error',
  AutoSaved: 'autoSaved',
} as const;
export type StorageEventType = (typeof StorageEventType)[keyof typeof StorageEventType];

/** 存储事件 */
export interface StorageEvent {
  type: StorageEventType;
  projectId?: string;
  error?: string;
  timestamp: number;
}

// ==================== 工厂函数 ====================

/** 创建空项目 */
export function createEmptyProject(name: string, description?: string): Project {
  const now = new Date().toISOString();
  return {
    id: `proj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    description: description ?? '',
    createdAt: now,
    updatedAt: now,
    version: CURRENT_PROJECT_VERSION,
    circuit: {
      components: [],
      nodes: [],
      wires: [],
      simulationConfig: { analysis: { type: 'dc' }, enabled: false },
    },
    metadata: {
      tags: [],
      description: description ?? '',
    },
  };
}

/** 从旧版 CircuitProject 升级 */
export function upgradeFromLegacy(legacy: Record<string, unknown>): Project {
  const now = new Date().toISOString();
  return {
    id: (legacy['id'] as string) ?? `proj-${Date.now().toString(36)}`,
    name: (legacy['name'] as string) ?? '未命名项目',
    description: (legacy['description'] as string) ?? '',
    createdAt: (legacy['createdAt'] as string) ?? now,
    updatedAt: (legacy['updatedAt'] as string) ?? now,
    version: CURRENT_PROJECT_VERSION,
    circuit: {
      components: (legacy['components'] as CircuitComponent[]) ?? [],
      nodes: (legacy['nodes'] as CircuitNode[]) ?? [],
      wires: (legacy['wires'] as Wire[]) ?? [],
      simulationConfig: (legacy['simulationConfig'] as SimulationConfig) ?? {
        analysis: { type: 'dc' },
        enabled: false,
      },
    },
    metadata: {
      tags: [],
      description: (legacy['description'] as string) ?? '',
    },
  };
}

/** 检查版本兼容性 */
export function checkVersionCompat(version: string): VersionCompat {
  if (!version) return 'upgradeable';
  const parts = version.split('.').map(Number);
  const currentParts = CURRENT_PROJECT_VERSION.split('.').map(Number);

  // 主版本不同则不兼容
  if (parts[0] !== currentParts[0]) return 'incompatible';
  // 次版本更高则需要升级
  if (parts[1] > currentParts[1]) return 'incompatible';
  if (parts[1] < currentParts[1]) return 'upgradeable';
  return 'compatible';
}

/** 从 Project 提取摘要 */
export function toSummary(project: Project): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    version: project.version,
    componentCount: project.circuit.components.length,
    wireCount: project.circuit.wires.length,
    metadata: project.metadata,
  };
}
