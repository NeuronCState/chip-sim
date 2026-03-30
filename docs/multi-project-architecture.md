# Chip-Sim 多工程管理架构文档

## 概述

Phase 2 为 chip-sim 添加了完整的多工程管理能力，包括 IndexedDB 持久化存储、项目生命周期管理、多标签页支持和导入导出功能。

## 架构总览

```
┌─────────────────────────────────────────────────────────┐
│                     UI 层 (React)                       │
│  ┌──────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │  TabBar   │ │  ProjectList │ │   ProjectSettings    │ │
│  │ (标签栏)  │ │ (项目列表)    │ │   (项目设置)         │ │
│  └──────────┘ └──────────────┘ └──────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│                   管理层 (Core)                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │              ProjectManager (单例)                  │ │
│  │  - 项目 CRUD、标签页管理、自动保存、导入导出        │ │
│  └────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│                   存储层 (Core)                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │             StorageManager (单例)                   │ │
│  │  - IndexedDB 封装、localStorage 迁移、空间管理     │ │
│  └────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│              Zustand Store (circuit-store)               │
│  - 电路数据状态管理 (components, nodes, wires)          │
│  - 画布交互 (选择、移动、连线、视图变换)               │
│  - Undo/Redo、主题、仿真状态                            │
└─────────────────────────────────────────────────────────┘
```

## 文件结构

```
frontend/src/
├── core/
│   ├── StorageManager.ts     # IndexedDB 存储层
│   ├── ProjectManager.ts     # 项目管理核心
│   └── index.ts              # 统一导出
├── components/
│   ├── ProjectList/
│   │   ├── ProjectList.tsx    # 项目列表对话框
│   │   ├── ProjectList.css
│   │   └── index.ts
│   ├── ProjectSettings/
│   │   ├── ProjectSettings.tsx # 项目设置面板
│   │   ├── ProjectSettings.css
│   │   └── index.ts
│   └── TabBar/
│       ├── TabBar.tsx         # 多标签页栏
│       ├── TabBar.css
│       └── index.ts
├── stores/
│   └── circuit-store.ts       # Zustand 电路状态（与 ProjectManager 集成）
├── features/editor/
│   └── EditorPage.tsx         # 主编辑器（集成 TabBar + 项目管理）
└── lib/circuit/
    └── serialization.ts       # 项目序列化/反序列化
```

## 核心模块

### StorageManager (`src/core/StorageManager.ts`)

基于 IndexedDB 的存储层，封装所有数据持久化操作。

**数据库结构：**
| Store | Key | 说明 |
|-------|-----|------|
| `projects` | `id` (项目ID) | 完整项目数据 |
| `meta` | `key` (字符串) | 应用元信息（当前项目ID、标签页状态等） |

**主要 API：**
```typescript
// 项目 CRUD
await storageManager.saveProject(project: CircuitProject)
await storageManager.getProject(id: string): Promise<CircuitProject | null>
await storageManager.deleteProject(id: string)
await storageManager.listProjects(): Promise<ProjectIndexEntry[]>

// 元信息
await storageManager.setMeta(key: string, value: unknown)
await storageManager.getMeta<T>(key: string): Promise<T | null>

// 存储空间
await storageManager.getStorageUsage(): Promise<StorageUsage>

// 数据迁移
await storageManager.migrateFromLocalStorage(): Promise<number>
await storageManager.importProjectsFromJson(json: string): Promise<number>
await storageManager.exportAllProjects(): Promise<string>
```

**索引：**
- `updatedAt`：用于按时间排序
- `name`：用于搜索

### ProjectManager (`src/core/ProjectManager.ts`)

项目管理核心，协调 StorageManager 与 Zustand Store。

**生命周期：**
1. `init()` → 初始化 StorageManager，迁移 localStorage，恢复标签页
2. `createProject()` → 创建新项目并持久化
3. `openProject()` → 加载项目数据到 Zustand Store
4. `autoSave()` → 定时保存（默认 30 秒）
5. `destroy()` → 清理定时器

**标签页管理：**
```typescript
interface TabInfo {
  id: string;           // 项目 ID
  name: string;         // 标签显示名称
  hasUnsavedChanges: boolean; // 未保存更改标记
  lastFocused: number;  // 最后聚焦时间戳
}
```

**事件回调：**
```typescript
interface ProjectManagerEvents {
  onProjectsChanged?: (projects: ProjectIndexEntry[]) => void;
  onTabChanged?: (tabs: TabInfo[], activeTabId: string | null) => void;
  onProjectLoaded?: (project: CircuitProject) => void;
  onAutoSaved?: () => void;
  onError?: (error: string) => void;
}
```

### 项目数据模型

```typescript
interface CircuitProject {
  id: string;
  name: string;
  createdAt: string;      // ISO 8601
  updatedAt: string;      // ISO 8601
  components: CircuitComponent[];
  nodes: CircuitNode[];
  wires: Wire[];
  simulationConfig: SimulationConfig;
  version: string;        // "1.0.0" - 用于数据迁移
  // 扩展字段
  description?: string;
  metadata?: Record<string, unknown>;
}
```

## UI 组件

### TabBar

多标签页栏，支持：
- 标签页切换（点击）
- 关闭标签（带未保存更改确认）
- 拖拽排序
- 横向滚动
- 新增按钮（打开项目列表）
- 未保存标记（● 圆点指示器）

### ProjectList

项目列表对话框，功能：
- **最近项目**视图（最近 8 个）
- **全部项目**视图
- 搜索过滤
- 新建项目（名称 + 描述）
- 导入 .chipsim 文件
- 拖拽文件导入
- 重命名 / 删除
- 导出全部项目
- 存储空间显示

### ProjectSettings

项目设置面板：
- 修改名称和描述
- 导出为 .chipsim 文件
- 导出为图片 (PNG)
- 查看存储信息
- 删除项目

## 导入导出格式

### .chipsim 单项目格式
标准 CircuitProject JSON：
```json
{
  "id": "proj-xxx",
  "name": "我的电路",
  "version": "1.0.0",
  "components": [...],
  "nodes": [...],
  "wires": [...]
}
```

### .chipsim 批量格式
```json
{
  "format": "chip-sim-bundle",
  "version": "1.0.0",
  "exportedAt": "2026-03-28T...",
  "projectCount": 3,
  "projects": [...]
}
```

## 数据迁移

从 Phase 1 (localStorage) 到 Phase 2 (IndexedDB) 的自动迁移：

1. `StorageManager.init()` 中调用 `migrateFromLocalStorage()`
2. 读取旧索引 (`chip-sim-project-index`)
3. 逐个项目迁移到 IndexedDB
4. 迁移成功后删除 localStorage 数据
5. 删除旧索引

## 与 Zustand Store 的集成

- ProjectManager 通过回调函数与 Zustand Store 双向通信
- `getCircuitData()` 读取当前电路状态
- `setCircuitData()` 将项目数据写入 Store
- `useCircuitStore.subscribe()` 监听变化触发 `markAsModified()`
- 自动保存定时器通过 `saveCurrentProject()` 将 Store 数据持久化

## 技术约束

- IndexedDB 操作全部使用 `async/await`
- 存储空间通过 `navigator.storage.estimate()` 获取
- 标签页状态持久化到 IndexedDB meta store
- 项目 ID 使用时间戳 + 随机字符串生成
- 版本字段 `version` 支持未来数据迁移
