/**
 * VersionManager - 电路版本管理核心
 * 管理版本快照的创建、存储、比较和回滚
 * 使用独立的 IndexedDB object store 存储版本数据
 */

import type { CircuitComponent, CircuitNode, Wire, SimulationConfig } from '../types/circuit';
import type {
  VersionSnapshot,
  VersionManagerConfig,
  VersionManagerEvents,
  ChangeSummary,
  DiffResult,
} from '../types/version';
import { VersionTrigger } from '../types/version';
import { computeDiff, describeChangeSummary } from './CircuitDiff';

// ==================== 常量 ====================

const DB_NAME = 'chip-sim-db';
const DB_VERSION = 2; // 升级版本号以添加 versions store
const STORE_VERSIONS = 'versions';

const DEFAULT_CONFIG: VersionManagerConfig = {
  maxVersions: 50,
  autoSnapshotBeforeSim: true,
  autoSnapshotBeforeClose: true,
  thumbnailSize: { width: 160, height: 120 },
};

// ==================== 工具函数 ====================

/** 生成唯一版本 ID */
function generateVersionId(): string {
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** 深拷贝电路数据 */
function cloneCircuitData(data: {
  components: CircuitComponent[];
  nodes: CircuitNode[];
  wires: Wire[];
  simulationConfig?: SimulationConfig;
}): {
  components: CircuitComponent[];
  nodes: CircuitNode[];
  wires: Wire[];
  simulationConfig?: SimulationConfig;
} {
  return JSON.parse(JSON.stringify(data));
}

// ==================== VersionManager 类 ====================

class VersionManager {
  private config: VersionManagerConfig;
  private events: VersionManagerEvents;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private versionCounter = 0;

  constructor(config: Partial<VersionManagerConfig> = {}, events: VersionManagerEvents = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.events = events;
  }

  // ==================== 初始化 ====================

  /** 初始化 IndexedDB */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 保留已有的 object stores
        // 创建版本存储
        if (!db.objectStoreNames.contains(STORE_VERSIONS)) {
          const versionStore = db.createObjectStore(STORE_VERSIONS, { keyPath: 'id' });
          versionStore.createIndex('projectId', 'projectId', { unique: false });
          versionStore.createIndex('createdAt', 'createdAt', { unique: false });
          versionStore.createIndex('sequenceNumber', 'sequenceNumber', { unique: false });
        }
      };

      request.onsuccess = async () => {
        this.db = request.result;
        // 读取最大序号
        await this.loadMaxSequence();
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`IndexedDB 打开失败: ${request.error?.message}`));
      };
    });

    return this.initPromise;
  }

  /** 加载最大版本序号 */
  private async loadMaxSequence(): Promise<void> {
    const versions = await this.listAllVersions();
    if (versions.length > 0) {
      this.versionCounter = Math.max(...versions.map(v => v.sequenceNumber));
    }
  }

  /** 获取数据库连接 */
  private async getDB(): Promise<IDBDatabase> {
    await this.init();
    if (!this.db) throw new Error('IndexedDB 未初始化');
    return this.db;
  }

  // ==================== 版本 CRUD ====================

  /**
   * 创建版本快照
   * @param projectId 项目 ID
   * @param circuitData 电路数据
   * @param options 快照选项
   */
  async createSnapshot(
    projectId: string,
    circuitData: {
      components: CircuitComponent[];
      nodes: CircuitNode[];
      wires: Wire[];
      simulationConfig?: SimulationConfig;
    },
    options: {
      label?: string;
      description?: string;
      trigger?: typeof VersionTrigger[keyof typeof VersionTrigger];
      thumbnail?: string;
    } = {}
  ): Promise<VersionSnapshot> {
    const db = await this.getDB();
    this.versionCounter++;

    // 获取该项目的上一个版本用于计算 diff
    const prevVersions = await this.listVersions(projectId);
    const prevVersion = prevVersions.length > 0 ? prevVersions[0] : null;

    // 计算变更摘要
    let changeSummary: ChangeSummary | undefined;
    if (prevVersion) {
      const diff = computeDiff(prevVersion.circuitData, circuitData);
      changeSummary = diff.summary;
    }

    const now = new Date().toISOString();
    const version: VersionSnapshot = {
      id: generateVersionId(),
      projectId,
      label: options.label ?? `v${this.versionCounter}`,
      description: options.description ?? (changeSummary ? describeChangeSummary(changeSummary) : '初始版本'),
      createdAt: now,
      trigger: options.trigger ?? VersionTrigger.Manual,
      circuitData: cloneCircuitData(circuitData),
      thumbnail: options.thumbnail,
      changeSummary,
      sequenceNumber: this.versionCounter,
    };

    return new Promise<VersionSnapshot>((resolve, reject) => {
      const tx = db.transaction(STORE_VERSIONS, 'readwrite');
      const store = tx.objectStore(STORE_VERSIONS);
      store.put(version);

      tx.oncomplete = () => {
        this.events.onVersionCreated?.(version);
        this.events.onVersionsChanged?.([]);
        resolve(version);
      };
      tx.onerror = () => reject(tx.error);
    }).then(async (version) => {
      // 超出最大版本数时清理旧版本
      await this.pruneOldVersions(projectId);
      return version;
    });
  }

  /**
   * 获取项目的版本列表（按时间倒序）
   */
  async listVersions(projectId: string): Promise<VersionSnapshot[]> {
    const db = await this.getDB();
    return new Promise<VersionSnapshot[]>((resolve, reject) => {
      const tx = db.transaction(STORE_VERSIONS, 'readonly');
      const store = tx.objectStore(STORE_VERSIONS);
      const index = store.index('projectId');
      const request = index.getAll(projectId);

      request.onsuccess = () => {
        const versions = request.result as VersionSnapshot[];
        // 按序号倒序排列（最新的在前）
        versions.sort((a, b) => b.sequenceNumber - a.sequenceNumber);
        resolve(versions);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 获取所有版本
   */
  async listAllVersions(): Promise<VersionSnapshot[]> {
    const db = await this.getDB();
    return new Promise<VersionSnapshot[]>((resolve, reject) => {
      const tx = db.transaction(STORE_VERSIONS, 'readonly');
      const store = tx.objectStore(STORE_VERSIONS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result as VersionSnapshot[]);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 获取单个版本
   */
  async getVersion(versionId: string): Promise<VersionSnapshot | null> {
    const db = await this.getDB();
    return new Promise<VersionSnapshot | null>((resolve, reject) => {
      const tx = db.transaction(STORE_VERSIONS, 'readonly');
      const store = tx.objectStore(STORE_VERSIONS);
      const request = store.get(versionId);

      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 更新版本元数据（标签、描述）
   */
  async updateVersionMeta(
    versionId: string,
    meta: { label?: string; description?: string }
  ): Promise<void> {
    const db = await this.getDB();
    const version = await this.getVersion(versionId);
    if (!version) throw new Error(`版本 ${versionId} 不存在`);

    if (meta.label !== undefined) version.label = meta.label;
    if (meta.description !== undefined) version.description = meta.description;

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_VERSIONS, 'readwrite');
      const store = tx.objectStore(STORE_VERSIONS);
      store.put(version);
      tx.oncomplete = () => {
        this.events.onVersionsChanged?.([]);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * 删除版本
   */
  async deleteVersion(versionId: string): Promise<void> {
    const db = await this.getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_VERSIONS, 'readwrite');
      const store = tx.objectStore(STORE_VERSIONS);
      store.delete(versionId);
      tx.oncomplete = () => {
        this.events.onVersionDeleted?.(versionId);
        this.events.onVersionsChanged?.([]);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * 清理旧版本（保留最近 N 个）
   */
  async pruneOldVersions(projectId: string): Promise<number> {
    const versions = await this.listVersions(projectId);
    if (versions.length <= this.config.maxVersions) return 0;

    const toDelete = versions.slice(this.config.maxVersions);
    const db = await this.getDB();

    return new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE_VERSIONS, 'readwrite');
      const store = tx.objectStore(STORE_VERSIONS);

      for (const version of toDelete) {
        store.delete(version.id);
      }

      tx.oncomplete = () => resolve(toDelete.length);
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * 清除项目的所有版本
   */
  async clearProjectVersions(projectId: string): Promise<void> {
    const versions = await this.listVersions(projectId);
    const db = await this.getDB();

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_VERSIONS, 'readwrite');
      const store = tx.objectStore(STORE_VERSIONS);

      for (const version of versions) {
        store.delete(version.id);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ==================== 版本操作 ====================

  /**
   * 恢复到指定版本
   * 返回该版本的电路数据
   */
  async restoreVersion(versionId: string): Promise<{
    components: CircuitComponent[];
    nodes: CircuitNode[];
    wires: Wire[];
    simulationConfig?: SimulationConfig;
  }> {
    const version = await this.getVersion(versionId);
    if (!version) throw new Error(`版本 ${versionId} 不存在`);

    this.events.onVersionRestored?.(version);
    return cloneCircuitData(version.circuitData);
  }

  /**
   * 比较两个版本
   */
  async compareVersions(fromVersionId: string, toVersionId: string): Promise<DiffResult> {
    const [fromVersion, toVersion] = await Promise.all([
      this.getVersion(fromVersionId),
      this.getVersion(toVersionId),
    ]);

    if (!fromVersion) throw new Error(`版本 ${fromVersionId} 不存在`);
    if (!toVersion) throw new Error(`版本 ${toVersionId} 不存在`);

    const diff = computeDiff(fromVersion.circuitData, toVersion.circuitData);
    diff.fromVersionId = fromVersionId;
    diff.toVersionId = toVersionId;

    return diff;
  }

  /**
   * 导出单个版本的电路数据为 JSON
   */
  async exportVersion(versionId: string): Promise<void> {
    const version = await this.getVersion(versionId);
    if (!version) throw new Error(`版本 ${versionId} 不存在`);

    const exportData = {
      format: 'chip-sim-version',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      versionLabel: version.label,
      versionDescription: version.description,
      createdAt: version.createdAt,
      project: {
        id: version.projectId,
        name: version.label,
        createdAt: version.createdAt,
        updatedAt: version.createdAt,
        components: version.circuitData.components,
        nodes: version.circuitData.nodes,
        wires: version.circuitData.wires,
        simulationConfig: version.circuitData.simulationConfig,
        version: '1.0.0',
      },
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `version-${version.label || version.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ==================== 配置 ====================

  /** 更新配置 */
  setConfig(config: Partial<VersionManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** 获取当前配置 */
  getConfig(): VersionManagerConfig {
    return { ...this.config };
  }

  /** 设置事件回调 */
  setEvents(events: VersionManagerEvents): void {
    this.events = events;
  }

  // ==================== 存储统计 ====================

  /** 获取版本存储使用情况 */
  async getStorageStats(projectId: string): Promise<{
    versionCount: number;
    totalSizeEstimate: number;
  }> {
    const versions = await this.listVersions(projectId);
    let totalSizeEstimate = 0;

    for (const v of versions) {
      totalSizeEstimate += JSON.stringify(v).length;
    }

    return {
      versionCount: versions.length,
      totalSizeEstimate,
    };
  }
}

// 单例导出
export const versionManager = new VersionManager();
export default versionManager;
