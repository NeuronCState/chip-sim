/**
 * 项目本地存储服务
 * 基于 IndexedDB 实现项目的 CRUD、自动保存、列表查询等功能
 */

import type {
  Project,
  ProjectSummary,
  ProjectQuery,
  SortField,
  SortOrder,
  AutoSaveConfig,
  StorageEvent,
} from '../types/project';
import { toSummary, DEFAULT_AUTOSAVE, CURRENT_PROJECT_VERSION, upgradeFromLegacy, checkVersionCompat } from '../types/project';

// ==================== IndexedDB 常量 ====================

const DB_NAME = 'chip-sim-projects';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_META = 'meta';

// ==================== 辅助类型 ====================

interface DBMetaRecord {
  key: string;
  value: unknown;
}

type StorageListener = (event: StorageEvent) => void;

// ==================== ProjectStorage 类 ====================

export class ProjectStorage {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private autoSaveConfig: AutoSaveConfig = { ...DEFAULT_AUTOSAVE };
  private pendingProjectId: string | null = null;
  private listeners: StorageListener[] = [];

  // ==================== 初始化 ====================

  /** 初始化 IndexedDB */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          const store = db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;

        // 监听数据库意外关闭
        this.db.onclose = () => {
          this.db = null;
          this.initPromise = null;
        };

        resolve();
      };

      request.onerror = () => {
        reject(new Error(`IndexedDB 打开失败: ${request.error?.message}`));
      };
    });

    return this.initPromise;
  }

  /** 获取数据库连接 */
  private async getDB(): Promise<IDBDatabase> {
    await this.init();
    if (!this.db) throw new Error('IndexedDB 未初始化');
    return this.db;
  }

  // ==================== 事件系统 ====================

  /** 添加存储事件监听 */
  addListener(listener: StorageListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /** 触发存储事件 */
  private emit(event: StorageEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Storage event listener error:', err);
      }
    }
  }

  // ==================== 项目 CRUD ====================

  /** 保存项目 */
  async saveProject(project: Project): Promise<void> {
    const db = await this.getDB();
    project.updatedAt = new Date().toISOString();

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      const store = tx.objectStore(STORE_PROJECTS);
      store.put(project);
      tx.oncomplete = () => {
        this.emit({ type: 'saved', projectId: project.id, timestamp: Date.now() });
        resolve();
      };
      tx.onerror = () => {
        const err = tx.error;
        this.emit({ type: 'error', projectId: project.id, error: String(err), timestamp: Date.now() });
        reject(err);
      };
    });
  }

  /** 获取项目（完整数据） */
  async getProject(id: string): Promise<Project | null> {
    const db = await this.getDB();
    return new Promise<Project | null>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const store = tx.objectStore(STORE_PROJECTS);
      const request = store.get(id);
      request.onsuccess = () => {
        const result = request.result as Project | undefined;
        if (!result) {
          resolve(null);
          return;
        }
        // 版本升级
        if (result.version !== CURRENT_PROJECT_VERSION) {
          const compat = checkVersionCompat(result.version);
          if (compat === 'incompatible') {
            console.warn(`项目 ${id} 版本 ${result.version} 不兼容`);
          }
          // 尝试升级
          result.version = CURRENT_PROJECT_VERSION;
        }
        resolve(result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /** 删除项目 */
  async deleteProject(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      const store = tx.objectStore(STORE_PROJECTS);
      store.delete(id);
      tx.oncomplete = () => {
        this.emit({ type: 'deleted', projectId: id, timestamp: Date.now() });
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  /** 查询项目列表（支持排序和筛选） */
  async listProjects(query?: ProjectQuery): Promise<ProjectSummary[]> {
    const db = await this.getDB();

    const allProjects = await new Promise<Project[]>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const store = tx.objectStore(STORE_PROJECTS);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as Project[]);
      request.onerror = () => reject(request.error);
    });

    let summaries = allProjects.map(p => {
      // 兼容旧格式
      if (!p.circuit) {
        const upgraded = upgradeFromLegacy(p as unknown as Record<string, unknown>);
        return toSummary(upgraded);
      }
      return toSummary(p);
    });

    // 筛选
    if (query) {
      // 搜索关键词
      if (query.search) {
        const keyword = query.search.toLowerCase();
        summaries = summaries.filter(
          s => s.name.toLowerCase().includes(keyword) ||
               s.description.toLowerCase().includes(keyword) ||
               s.metadata.tags.some(t => t.toLowerCase().includes(keyword))
        );
      }

      // 标签筛选
      if (query.tags && query.tags.length > 0) {
        summaries = summaries.filter(s =>
          query.tags!.some(tag => s.metadata.tags.includes(tag))
        );
      }

      // 收藏筛选
      if (query.starred) {
        summaries = summaries.filter(s => s.metadata.starred);
      }
    }

    // 排序
    const sortBy: SortField = query?.sortBy ?? 'updatedAt';
    const sortOrder: SortOrder = query?.sortOrder ?? 'desc';

    summaries.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'createdAt':
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'updatedAt':
          cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case 'componentCount':
          cmp = a.componentCount - b.componentCount;
          break;
      }
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    return summaries;
  }

  /** 更新项目元数据（不影响电路数据） */
  async updateMetadata(id: string, metadata: Partial<Project['metadata']>): Promise<void> {
    const project = await this.getProject(id);
    if (!project) throw new Error(`项目 ${id} 不存在`);

    project.metadata = { ...project.metadata, ...metadata };
    project.updatedAt = new Date().toISOString();
    await this.saveProject(project);
  }

  /** 重命名项目 */
  async renameProject(id: string, name: string): Promise<void> {
    const project = await this.getProject(id);
    if (!project) throw new Error(`项目 ${id} 不存在`);

    project.name = name;
    project.updatedAt = new Date().toISOString();
    await this.saveProject(project);
  }

  /** 更新项目描述 */
  async updateDescription(id: string, description: string): Promise<void> {
    const project = await this.getProject(id);
    if (!project) throw new Error(`项目 ${id} 不存在`);

    project.description = description;
    project.metadata.description = description;
    project.updatedAt = new Date().toISOString();
    await this.saveProject(project);
  }

  // ==================== 自动保存 ====================

  /** 配置自动保存 */
  configureAutoSave(config: Partial<AutoSaveConfig>): void {
    this.autoSaveConfig = { ...this.autoSaveConfig, ...config };
    if (this.autoSaveConfig.enabled) {
      this.startAutoSave();
    } else {
      this.stopAutoSave();
    }
  }

  /** 启动自动保存定时器 */
  startAutoSave(): void {
    this.stopAutoSave();
    this.autoSaveTimer = setInterval(async () => {
      if (this.pendingProjectId) {
        await this.flushAutoSave();
      }
    }, this.autoSaveConfig.intervalMs);
  }

  /** 停止自动保存 */
  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /** 标记项目需要自动保存（debounce） */
  markDirty(projectId: string, getProjectData: () => Project): void {
    this.pendingProjectId = projectId;
    this._pendingGetData = getProjectData;

    // debounce
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.flushAutoSave();
    }, this.autoSaveConfig.debounceMs);
  }

  private _pendingGetData: (() => Project) | null = null;

  /** 立即执行自动保存 */
  async flushAutoSave(): Promise<void> {
    if (!this.pendingProjectId || !this._pendingGetData) return;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    try {
      const project = this._pendingGetData();
      await this.saveProject(project);
      this.emit({ type: 'autoSaved', projectId: project.id, timestamp: Date.now() });
    } catch (err) {
      this.emit({
        type: 'error',
        projectId: this.pendingProjectId,
        error: `自动保存失败: ${err}`,
        timestamp: Date.now(),
      });
    }

    this.pendingProjectId = null;
    this._pendingGetData = null;
  }

  // ==================== 元信息 ====================

  async setMeta(key: string, value: unknown): Promise<void> {
    const db = await this.getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readwrite');
      const store = tx.objectStore(STORE_META);
      store.put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getMeta<T = unknown>(key: string): Promise<T | null> {
    const db = await this.getDB();
    const result = await new Promise<DBMetaRecord | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const store = tx.objectStore(STORE_META);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result as DBMetaRecord | undefined);
      request.onerror = () => reject(request.error);
    });
    return (result?.value as T) ?? null;
  }

  // ==================== 存储空间 ====================

  /** 获取存储使用情况 */
  async getStorageUsage(): Promise<{ usedBytes: number; projectCount: number; display: string }> {
    let usedBytes = 0;
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      usedBytes = estimate.usage ?? 0;
    }

    const projects = await this.listProjects();
    return {
      usedBytes,
      projectCount: projects.length,
      display: ProjectStorage.formatBytes(usedBytes),
    };
  }

  static formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ==================== 数据迁移 ====================

  /** 从旧版 StorageManager 迁移 */
  async migrateFromLegacy(): Promise<number> {
    let migrated = 0;
    const prefix = 'chip-sim-project-';
    const indexKey = 'chip-sim-project-index';

    try {
      const indexJson = localStorage.getItem(indexKey);
      if (!indexJson) return 0;

      const index = JSON.parse(indexJson) as { projects: { id: string; name: string }[] };
      for (const meta of index.projects) {
        const key = `${prefix}${meta.id}`;
        const data = localStorage.getItem(key);
        if (!data) continue;

        try {
          const raw = JSON.parse(data) as Record<string, unknown>;
          const project = upgradeFromLegacy(raw);
          await this.saveProject(project);
          migrated++;
          localStorage.removeItem(key);
        } catch {
          console.warn(`迁移项目 ${meta.id} 失败`);
        }
      }

      localStorage.removeItem(indexKey);
    } catch {
      console.warn('迁移失败');
    }

    // 也迁移自动保存
    try {
      const autosave = localStorage.getItem('chip-sim-autosave');
      if (autosave) {
        const raw = JSON.parse(autosave) as Record<string, unknown>;
        const project = upgradeFromLegacy(raw);
        project.id = 'autosave-backup';
        project.name = '自动保存备份';
        await this.saveProject(project);
        localStorage.removeItem('chip-sim-autosave');
        migrated++;
      }
    } catch {
      // ignore
    }

    return migrated;
  }

  // ==================== 清理 ====================

  /** 清空所有项目 */
  async clearAll(): Promise<void> {
    const db = await this.getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_PROJECTS, STORE_META], 'readwrite');
      tx.objectStore(STORE_PROJECTS).clear();
      tx.objectStore(STORE_META).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** 销毁 */
  destroy(): void {
    this.stopAutoSave();
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
    this.listeners = [];
  }
}

// ==================== 单例 ====================

export const projectStorage = new ProjectStorage();
export default projectStorage;
