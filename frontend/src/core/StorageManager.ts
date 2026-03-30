/**
 * StorageManager - IndexedDB 存储层
 * 封装所有项目数据的持久化操作，支持自动保存和存储空间管理
 */

import type { CircuitProject } from '../types/circuit';

const DB_NAME = 'chip-sim-db';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_META = 'meta';

// ==================== 类型定义 ====================

/** 项目索引条目 */
export interface ProjectIndexEntry {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  componentCount: number;
  wireCount: number;
  version: string;
}

/** 存储元信息 */
export interface StorageMeta {
  key: string;
  value: unknown;
}

/** 存储空间信息 */
export interface StorageUsage {
  /** 估算使用字节数 */
  usedBytes: number;
  /** 项目数量 */
  projectCount: number;
  /** 格式化显示 */
  usedDisplay: string;
}

// ==================== IndexedDB 封装 ====================

export class StorageManager {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /** 格式化字节显示 */
  static formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /** 初始化数据库 */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 项目存储
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          const projectStore = db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
          projectStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          projectStore.createIndex('name', 'name', { unique: false });
        }

        // 元信息存储
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
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

  /** 通用事务封装 */
  private async transaction<T>(
    storeName: string,
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    const db = await this.getDB();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = operation(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== 项目 CRUD ====================

  /** 保存项目（完整数据） */
  async saveProject(project: CircuitProject): Promise<void> {
    const db = await this.getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      const store = tx.objectStore(STORE_PROJECTS);
      store.put(project);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** 获取项目（完整数据） */
  async getProject(id: string): Promise<CircuitProject | null> {
    return this.transaction(STORE_PROJECTS, 'readonly', (store) => store.get(id));
  }

  /** 删除项目 */
  async deleteProject(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      const store = tx.objectStore(STORE_PROJECTS);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** 获取所有项目索引（不含完整数据，只含元信息） */
  async listProjects(): Promise<ProjectIndexEntry[]> {
    const db = await this.getDB();
    return new Promise<ProjectIndexEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const store = tx.objectStore(STORE_PROJECTS);
      const request = store.getAll();
      request.onsuccess = () => {
        const projects = (request.result as CircuitProject[]).map((p) => ({
          id: p.id,
          name: p.name,
          description: (p as unknown as Record<string, unknown>)['description'] as string || '',
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          componentCount: p.components?.length ?? 0,
          wireCount: p.wires?.length ?? 0,
          version: p.version,
        }));
        // 按更新时间倒序
        projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        resolve(projects);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /** 批量保存项目 */
  async saveProjects(projects: CircuitProject[]): Promise<void> {
    const db = await this.getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      const store = tx.objectStore(STORE_PROJECTS);
      for (const project of projects) {
        store.put(project);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** 清空所有项目 */
  async clearAllProjects(): Promise<void> {
    const db = await this.getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      const store = tx.objectStore(STORE_PROJECTS);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ==================== 元信息 ====================

  /** 保存元信息 */
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

  /** 读取元信息 */
  async getMeta<T = unknown>(key: string): Promise<T | null> {
    const result = await this.transaction<StorageMeta | undefined>(
      STORE_META,
      'readonly',
      (store) => store.get(key)
    );
    return (result?.value as T) ?? null;
  }

  /** 删除元信息 */
  async deleteMeta(key: string): Promise<void> {
    const db = await this.getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readwrite');
      const store = tx.objectStore(STORE_META);
      store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ==================== 存储空间管理 ====================

  /** 获取存储空间使用情况 */
  async getStorageUsage(): Promise<StorageUsage> {
    let usedBytes = 0;
    let projectCount = 0;

    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      usedBytes = estimate.usage ?? 0;
    }

    const projects = await this.listProjects();
    projectCount = projects.length;

    return {
      usedBytes,
      projectCount,
      usedDisplay: StorageManager.formatBytes(usedBytes),
    };
  }

  // ==================== 数据迁移 ====================

  /** 从 localStorage 迁移到 IndexedDB */
  async migrateFromLocalStorage(): Promise<number> {
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
          const project = JSON.parse(data) as CircuitProject;
          // 确保有版本号
          if (!project.version) {
            project.version = '1.0.0';
          }
          await this.saveProject(project);
          migrated++;
          // 迁移成功后删除 localStorage 数据
          localStorage.removeItem(key);
        } catch {
          console.warn(`迁移项目 ${meta.id} 失败`);
        }
      }

      // 删除旧索引
      localStorage.removeItem(indexKey);
    } catch {
      console.warn('localStorage 迁移失败');
    }

    return migrated;
  }

  /** 导出所有项目为 JSON */
  async exportAllProjects(): Promise<string> {
    const db = await this.getDB();
    return new Promise<string>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const store = tx.objectStore(STORE_PROJECTS);
      const request = store.getAll();
      request.onsuccess = () => {
        const projects = request.result as CircuitProject[];
        const exportData = {
          format: 'chip-sim-bundle',
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          projectCount: projects.length,
          projects,
        };
        resolve(JSON.stringify(exportData, null, 2));
      };
      request.onerror = () => reject(request.error);
    });
  }

  /** 导出选中项目为 Bundle JSON */
  async exportSelectedProjects(ids: string[]): Promise<string> {
    const db = await this.getDB();
    return new Promise<string>((resolve) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const store = tx.objectStore(STORE_PROJECTS);
      const projects: CircuitProject[] = [];
      let remaining = ids.length;

      if (remaining === 0) {
        resolve(JSON.stringify({
          header: {
            format: 'chip-sim-bundle',
            version: '2.0.0',
            exportedAt: new Date().toISOString(),
            projectCount: 0,
          },
          projects: [],
        }, null, 2));
        return;
      }

      for (const id of ids) {
        const req = store.get(id);
        req.onsuccess = () => {
          if (req.result) projects.push(req.result);
          remaining--;
          if (remaining === 0) {
            const bundle = {
              header: {
                format: 'chip-sim-bundle',
                version: '2.0.0',
                exportedAt: new Date().toISOString(),
                projectCount: projects.length,
              },
              projects,
            };
            resolve(JSON.stringify(bundle, null, 2));
          }
        };
        req.onerror = () => {
          remaining--;
          if (remaining === 0) resolve('[]');
        };
      }
    });
  }

  /** 从 JSON 导入项目（增强版，支持 ID 冲突处理） */
  async importProjectsFromJson(json: string): Promise<{ count: number; warnings: string[] }> {
    const warnings: string[] = [];
    let imported = 0;
    try {
      const data = JSON.parse(json);

      const importProject = async (project: CircuitProject) => {
        // 检查 ID 冲突
        const existing = await this.getProject(project.id);
        if (existing) {
          project.id = `proj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
          project.name = `${project.name} (导入)`;
          warnings.push(`项目 "${existing.name}" ID 冲突，已重命名为 "${project.name}"`);
        }
        if (!project.version) project.version = '1.0.0';
        project.updatedAt = new Date().toISOString();
        await this.saveProject(project);
        imported++;
      };

      // 支持批量导入格式
      if (data.format === 'chip-sim-bundle' && Array.isArray(data.projects)) {
        for (const project of data.projects) {
          if (project.components && project.wires) {
            await importProject(project);
          }
        }
      }
      // 支持单项目导入
      else if (data.components && data.wires) {
        await importProject(data as CircuitProject);
      }
    } catch {
      throw new Error('导入数据格式无效');
    }

    return { count: imported, warnings };
  }
}

// 单例导出
export const storageManager = new StorageManager();
export default storageManager;
