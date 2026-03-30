/**
 * ProjectManager - 项目管理核心
 * 管理多项目生命周期、自动保存、导入导出
 */

import type { CircuitProject, CircuitComponent, CircuitNode, Wire } from '../types/circuit';
import { storageManager, type ProjectIndexEntry } from './StorageManager';
import { serializeProject } from '../lib/circuit/serialization';

// ==================== 类型定义 ====================

/** 打开的标签页信息 */
export interface TabInfo {
  id: string;
  name: string;
  hasUnsavedChanges: boolean;
  /** 最后焦点时间（用于排序） */
  lastFocused: number;
}

/** 项目创建选项 */
export interface CreateProjectOptions {
  name: string;
  description?: string;
  /** 从现有数据创建 */
  fromData?: {
    components: CircuitComponent[];
    nodes: CircuitNode[];
    wires: Wire[];
  };
}

/** ProjectManager 配置 */
export interface ProjectManagerConfig {
  /** 自动保存间隔（毫秒），默认 30000 */
  autoSaveInterval: number;
  /** 是否启用自动保存 */
  autoSaveEnabled: boolean;
}

/** ProjectManager 事件回调 */
export interface ProjectManagerEvents {
  onProjectsChanged?: (projects: ProjectIndexEntry[]) => void;
  onTabChanged?: (tabs: TabInfo[], activeTabId: string | null) => void;
  onProjectLoaded?: (project: CircuitProject) => void;
  onAutoSaved?: () => void;
  onError?: (error: string) => void;
}

// ==================== 常量 ====================

const DEFAULT_CONFIG: ProjectManagerConfig = {
  autoSaveInterval: 30000,
  autoSaveEnabled: true,
};

const CURRENT_PROJECT_ID_KEY = 'current-project-id';
const OPEN_TABS_KEY = 'open-tabs';

// ==================== ProjectManager 类 ====================

export class ProjectManager {
  private config: ProjectManagerConfig;
  private events: ProjectManagerEvents;
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  private projects: ProjectIndexEntry[] = [];
  private tabs: TabInfo[] = [];
  private activeTabId: string | null = null;
  /** 获取当前电路数据的回调 */
  private getCircuitData: (() => { components: CircuitComponent[]; nodes: CircuitNode[]; wires: Wire[] }) | null = null;
  /** 设置电路数据到 store 的回调 */
  private setCircuitData: ((data: { components: CircuitComponent[]; nodes: CircuitNode[]; wires: Wire[] }) => void) | null = null;
  private initialized = false;

  constructor(config: Partial<ProjectManagerConfig> = {}, events: ProjectManagerEvents = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.events = events;
  }

  // ==================== 初始化 ====================

  /** 初始化（必须在使用前调用） */
  async init(
    getCircuitData: () => { components: CircuitComponent[]; nodes: CircuitNode[]; wires: Wire[] },
    setCircuitData: (data: { components: CircuitComponent[]; nodes: CircuitNode[]; wires: Wire[] }) => void
  ): Promise<void> {
    if (this.initialized) return;

    this.getCircuitData = getCircuitData;
    this.setCircuitData = setCircuitData;

    // 初始化 IndexedDB
    await storageManager.init();

    // 尝试从 localStorage 迁移
    const migrated = await storageManager.migrateFromLocalStorage();
    if (migrated > 0) {
      console.log(`已从 localStorage 迁移 ${migrated} 个项目到 IndexedDB`);
    }

    // 加载项目列表
    this.projects = await storageManager.listProjects();
    this.events.onProjectsChanged?.(this.projects);

    // 恢复标签页
    await this.restoreTabs();

    // 恢复上次打开的项目
    const lastProjectId = await storageManager.getMeta<string>(CURRENT_PROJECT_ID_KEY);
    if (lastProjectId) {
      const project = await storageManager.getProject(lastProjectId);
      if (project) {
        this.setCircuitData({
          components: project.components,
          nodes: project.nodes,
          wires: project.wires,
        });
        this.activeTabId = lastProjectId;
        this.events.onProjectLoaded?.(project);
        this.events.onTabChanged?.(this.tabs, this.activeTabId);
      }
    }

    // 启动自动保存
    if (this.config.autoSaveEnabled) {
      this.startAutoSave();
    }

    this.initialized = true;
  }

  /** 销毁（清理定时器等） */
  destroy(): void {
    this.stopAutoSave();
    this.initialized = false;
  }

  // ==================== 自动保存 ====================

  /** 启动自动保存 */
  startAutoSave(interval?: number): void {
    this.stopAutoSave();
    const saveInterval = interval ?? this.config.autoSaveInterval;
    this.autoSaveTimer = setInterval(() => {
      this.autoSave().catch(console.error);
    }, saveInterval);
  }

  /** 停止自动保存 */
  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /** 设置自动保存间隔 */
  setAutoSaveInterval(interval: number): void {
    this.config.autoSaveInterval = interval;
    if (this.config.autoSaveEnabled) {
      this.startAutoSave(interval);
    }
  }

  /** 执行自动保存 */
  async autoSave(): Promise<void> {
    if (!this.activeTabId || !this.getCircuitData) return;

    const tab = this.tabs.find((t) => t.id === this.activeTabId);
    if (!tab) return;

    await this.saveCurrentProject();
    tab.hasUnsavedChanges = false;
    this.events.onAutoSaved?.();
    this.events.onTabChanged?.(this.tabs, this.activeTabId);
  }

  // ==================== 项目 CRUD ====================

  /** 创建新项目 */
  async createProject(options: CreateProjectOptions): Promise<CircuitProject> {
    const id = `proj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    const project: CircuitProject = {
      id,
      name: options.name,
      createdAt: now,
      updatedAt: now,
      components: options.fromData?.components ?? [],
      nodes: options.fromData?.nodes ?? [],
      wires: options.fromData?.wires ?? [],
      simulationConfig: { analysis: { type: 'dc' }, enabled: false },
      version: '1.0.0',
    };

    // 扩展字段
    (project as unknown as Record<string, unknown>)['description'] = options.description ?? '';
    (project as unknown as Record<string, unknown>)['metadata'] = {};

    await storageManager.saveProject(project);

    // 更新项目列表
    this.projects = await storageManager.listProjects();
    this.events.onProjectsChanged?.(this.projects);

    return project;
  }

  /** 打开项目 */
  async openProject(id: string): Promise<CircuitProject | null> {
    const project = await storageManager.getProject(id);
    if (!project) {
      this.events.onError?.(`项目 ${id} 不存在`);
      return null;
    }

    // 如果当前有活动标签，标记为无未保存更改
    if (this.activeTabId) {
      const currentTab = this.tabs.find((t) => t.id === this.activeTabId);
      if (currentTab) currentTab.hasUnsavedChanges = false;
    }

    // 添加标签页（如果不存在）
    if (!this.tabs.find((t) => t.id === id)) {
      this.tabs.push({
        id,
        name: project.name,
        hasUnsavedChanges: false,
        lastFocused: Date.now(),
      });
    }

    // 切换标签
    this.activeTabId = id;
    const tab = this.tabs.find((t) => t.id === id);
    if (tab) tab.lastFocused = Date.now();

    // 加载数据到 store
    this.setCircuitData?.({
      components: project.components,
      nodes: project.nodes,
      wires: project.wires,
    });

    // 记住当前项目
    await storageManager.setMeta(CURRENT_PROJECT_ID_KEY, id);
    await this.persistTabs();

    this.events.onProjectLoaded?.(project);
    this.events.onTabChanged?.(this.tabs, this.activeTabId);

    return project;
  }

  /** 保存当前项目 */
  async saveCurrentProject(): Promise<void> {
    if (!this.activeTabId || !this.getCircuitData) return;

    const data = this.getCircuitData();
    const existingProject = await storageManager.getProject(this.activeTabId);

    const project = serializeProject(
      existingProject?.name || '未命名',
      data.components,
      data.nodes,
      data.wires,
      existingProject?.simulationConfig
    );

    // 保留原 ID 和时间
    project.id = this.activeTabId;
    project.createdAt = existingProject?.createdAt || project.createdAt;

    // 保留扩展字段
    if (existingProject) {
      (project as unknown as Record<string, unknown>)['description'] = (existingProject as unknown as Record<string, unknown>)['description'];
      (project as unknown as Record<string, unknown>)['metadata'] = (existingProject as unknown as Record<string, unknown>)['metadata'];
    }

    await storageManager.saveProject(project);

    // 更新项目列表
    this.projects = await storageManager.listProjects();
    this.events.onProjectsChanged?.(this.projects);
  }

  /** 删除项目 */
  async deleteProject(id: string): Promise<void> {
    await storageManager.deleteProject(id);

    // 关闭对应的标签页
    this.tabs = this.tabs.filter((t) => t.id !== id);
    if (this.activeTabId === id) {
      this.activeTabId = this.tabs.length > 0 ? this.tabs[this.tabs.length - 1].id : null;
      if (this.activeTabId) {
        await this.openProject(this.activeTabId);
      } else {
        this.setCircuitData?.({ components: [], nodes: [], wires: [] });
      }
    }

    this.projects = await storageManager.listProjects();
    await this.persistTabs();

    this.events.onProjectsChanged?.(this.projects);
    this.events.onTabChanged?.(this.tabs, this.activeTabId);
  }

  /** 重命名项目 */
  async renameProject(id: string, name: string): Promise<void> {
    const project = await storageManager.getProject(id);
    if (!project) return;

    project.name = name;
    project.updatedAt = new Date().toISOString();
    await storageManager.saveProject(project);

    // 更新标签名
    const tab = this.tabs.find((t) => t.id === id);
    if (tab) tab.name = name;

    this.projects = await storageManager.listProjects();
    await this.persistTabs();

    this.events.onProjectsChanged?.(this.projects);
    this.events.onTabChanged?.(this.tabs, this.activeTabId);
  }

  /** 更新项目描述 */
  async updateProjectDescription(id: string, description: string): Promise<void> {
    const project = await storageManager.getProject(id);
    if (!project) return;

    (project as unknown as Record<string, unknown>)['description'] = description;
    project.updatedAt = new Date().toISOString();
    await storageManager.saveProject(project);

    this.projects = await storageManager.listProjects();
    this.events.onProjectsChanged?.(this.projects);
  }

  // ==================== 标签页管理 ====================

  /** 切换到指定标签页 */
  async switchTab(id: string): Promise<void> {
    // 保存当前项目
    if (this.activeTabId) {
      await this.saveCurrentProject();
      const currentTab = this.tabs.find((t) => t.id === this.activeTabId);
      if (currentTab) currentTab.hasUnsavedChanges = false;
    }

    // 打开目标项目
    await this.openProject(id);
  }

  /** 关闭标签页 */
  async closeTab(id: string): Promise<void> {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;

    // 如果有未保存更改，先保存
    if (tab.hasUnsavedChanges && this.activeTabId === id && this.getCircuitData) {
      await this.saveCurrentProject();
    }

    this.tabs = this.tabs.find(t => t.id === id)
      ? this.tabs.filter((t) => t.id !== id)
      : this.tabs;

    // 如果关闭的是当前标签，切换到其他标签
    if (this.activeTabId === id) {
      if (this.tabs.length > 0) {
        // 优先切换到最后聚焦的标签
        const sortedTabs = [...this.tabs].sort((a, b) => b.lastFocused - a.lastFocused);
        await this.openProject(sortedTabs[0].id);
      } else {
        this.activeTabId = null;
        this.setCircuitData?.({ components: [], nodes: [], wires: [] });
        await storageManager.setMeta(CURRENT_PROJECT_ID_KEY, null);
        this.events.onTabChanged?.(this.tabs, null);
      }
    }

    await this.persistTabs();
  }

  /** 重新排序标签页 */
  async reorderTabs(fromIndex: number, toIndex: number): Promise<void> {
    const tab = this.tabs.splice(fromIndex, 1)[0];
    this.tabs.splice(toIndex, 0, tab);
    await this.persistTabs();
    this.events.onTabChanged?.(this.tabs, this.activeTabId);
  }

  /** 标记当前项目为已修改 */
  markAsModified(): void {
    if (this.activeTabId) {
      const tab = this.tabs.find((t) => t.id === this.activeTabId);
      if (tab) {
        tab.hasUnsavedChanges = true;
        this.events.onTabChanged?.(this.tabs, this.activeTabId);
      }
    }
  }

  // ==================== 导入导出 ====================

  /** 导出当前项目为 JSON 文件 */
  async exportProjectAsJson(id?: string): Promise<void> {
    const projectId = id || this.activeTabId;
    if (!projectId) return;

    const project = await storageManager.getProject(projectId);
    if (!project) return;

    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name || 'project'}.chipsim`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /** 导出所有项目为打包文件 */
  async exportAllProjects(): Promise<void> {
    const json = await storageManager.exportAllProjects();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chip-sim-backup-${new Date().toISOString().slice(0, 10)}.chipsim`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /** 从文件导入项目（返回数量和冲突警告） */
  async importProjectFromFile(file: File): Promise<{ count: number; warnings: string[] }> {
    return new Promise<{ count: number; warnings: string[] }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const json = reader.result as string;
          const result = await storageManager.importProjectsFromJson(json);
          this.projects = await storageManager.listProjects();
          this.events.onProjectsChanged?.(this.projects);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });
  }

  /** 导出选中项目为 Bundle 文件 */
  async exportSelectedProjects(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const json = await storageManager.exportSelectedProjects(ids);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chip-sim-projects-${ids.length}-${new Date().toISOString().slice(0, 10)}.chipsim`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /** 导出画布为图片 */
  exportAsImage(canvas: HTMLCanvasElement, format: 'png' | 'svg' = 'png'): void {
    const mimeType = format === 'png' ? 'image/png' : 'image/svg+xml';
    const dataUrl = canvas.toDataURL(mimeType);
    const a = document.createElement('a');
    a.href = dataUrl;
    const projectName = this.activeTabId
      ? this.tabs.find((t) => t.id === this.activeTabId)?.name || 'circuit'
      : 'circuit';
    a.download = `${projectName}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ==================== 查询 ====================

  /** 获取所有项目列表 */
  getProjects(): ProjectIndexEntry[] {
    return this.projects;
  }

  /** 获取打开的标签页 */
  getTabs(): TabInfo[] {
    return this.tabs;
  }

  /** 获取当前活动标签 ID */
  getActiveTabId(): string | null {
    return this.activeTabId;
  }

  /** 获取当前项目名称 */
  getCurrentProjectName(): string | null {
    if (!this.activeTabId) return null;
    return this.tabs.find((t) => t.id === this.activeTabId)?.name ?? null;
  }

  /** 获取存储空间信息 */
  async getStorageInfo() {
    return storageManager.getStorageUsage();
  }

  // ==================== 内部方法 ====================

  /** 持久化标签页状态 */
  private async persistTabs(): Promise<void> {
    await storageManager.setMeta(OPEN_TABS_KEY, {
      tabs: this.tabs,
      activeTabId: this.activeTabId,
    });
  }

  /** 恢复标签页状态 */
  private async restoreTabs(): Promise<void> {
    const data = await storageManager.getMeta<{ tabs: TabInfo[]; activeTabId: string | null }>(OPEN_TABS_KEY);
    if (data) {
      this.tabs = data.tabs || [];
      this.activeTabId = data.activeTabId;
    }
  }
}

// 单例导出
export const projectManager = new ProjectManager();
export default projectManager;
