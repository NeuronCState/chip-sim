/**
 * 操作日志系统
 * 记录编译触发、仿真启停、文件保存、元件增删等关键操作
 * 内存环形缓冲 200 条 + IndexedDB 持久化
 * 参考规划: JJC-20260328-007 §四.2
 */

/** 操作类型 */
export type ActivityType =
  | 'compile_start'
  | 'compile_success'
  | 'compile_error'
  | 'sim_start'
  | 'sim_stop'
  | 'sim_progress'
  | 'sim_error'
  | 'file_save'
  | 'file_load'
  | 'component_add'
  | 'component_delete'
  | 'wire_add'
  | 'wire_delete'
  | 'undo'
  | 'redo'
  | 'project_open'
  | 'project_create'
  | 'error_report';

/** 操作日志条目 */
export interface ActivityEntry {
  id: string;
  timestamp: number;
  type: ActivityType;
  label: string;        // 用户可读的描述
  detail?: string;      // 技术详情
  metadata?: Record<string, unknown>;
}

let entryCounter = 0;
const MAX_ENTRIES = 200;

// ── 内存环形缓冲 ──

let _entries: ActivityEntry[] = [];
const _listeners = new Set<(entry: ActivityEntry) => void>();

/** 添加日志条目 */
export function addActivity(
  type: ActivityType,
  label: string,
  detail?: string,
  metadata?: Record<string, unknown>,
): ActivityEntry {
  const entry: ActivityEntry = {
    id: `act-${Date.now()}-${++entryCounter}`,
    timestamp: Date.now(),
    type,
    label,
    detail,
    metadata,
  };
  _entries = [entry, ..._entries].slice(0, MAX_ENTRIES);
  _listeners.forEach((fn) => fn(entry));
  // 异步持久化
  persistToIndexedDB(entry).catch(() => {});
  return entry;
}

/** 获取全部日志 */
export function getActivityLog(): ActivityEntry[] {
  return [..._entries];
}

/** 按类型筛选 */
export function filterActivity(type: ActivityType): ActivityEntry[] {
  return _entries.filter((e) => e.type === type);
}

/** 搜索日志 */
export function searchActivity(query: string): ActivityEntry[] {
  const q = query.toLowerCase();
  return _entries.filter(
    (e) => e.label.toLowerCase().includes(q) || e.detail?.toLowerCase().includes(q),
  );
}

/** 导出为 JSON */
export function exportActivityLog(): string {
  return JSON.stringify(_entries, null, 2);
}

/** 清空日志 */
export function clearActivityLog(): void {
  _entries = [];
}

/** 订阅新日志 */
export function subscribeActivity(listener: (entry: ActivityEntry) => void): () => void {
  _listeners.add(listener);
  return () => { _listeners.delete(listener); };
}

// ── IndexedDB 持久化 ──

const DB_NAME = 'chip-sim-activity';
const STORE_NAME = 'entries';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function persistToIndexedDB(entry: ActivityEntry): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(entry);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // IndexedDB 不可用时静默失败
  }
}

/** 从 IndexedDB 恢复日志 */
export async function loadActivityFromDB(): Promise<ActivityEntry[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    const result = await new Promise<ActivityEntry[]>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    // 按时间倒序，取最近 MAX_ENTRIES 条
    _entries = result.sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_ENTRIES);
    return _entries;
  } catch {
    return [];
  }
}
