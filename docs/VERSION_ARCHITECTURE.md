# 电路版本管理架构文档

## 概述

chip-sim 版本管理系统提供电路修改历史的完整追踪能力，包括版本快照、变更比较（Diff）和版本回滚功能。

## 架构图

```
┌─────────────────────────────────────────────────────────┐
│                      UI 层                               │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │  VersionHistory   │  │   VersionDiff    │             │
│  │  (版本历史面板)    │  │  (差异比较面板)   │             │
│  └────────┬─────────┘  └────────┬─────────┘             │
│           │                     │                        │
│  ┌────────▼─────────────────────▼─────────┐             │
│  │           version-store (Zustand)       │             │
│  │   状态管理: 版本列表、Diff 结果、UI 状态  │             │
│  └────────┬──────────────────────┬─────────┘             │
│           │                      │                       │
├───────────┼──────────────────────┼───────────────────────┤
│           │     Core 层          │                       │
│  ┌────────▼─────────┐  ┌────────▼─────────┐            │
│  │  VersionManager   │  │   CircuitDiff    │            │
│  │  (版本管理核心)    │  │  (变更计算引擎)   │            │
│  └────────┬─────────┘  └──────────────────┘            │
│           │                                             │
│  ┌────────▼─────────────────────────────┐              │
│  │       IndexedDB (chip-sim-db)         │              │
│  │  ┌──────────┐  ┌──────────────────┐  │              │
│  │  │ projects │  │    versions      │  │              │
│  │  │ (已有)   │  │ (版本快照存储)    │  │              │
│  │  └──────────┘  └──────────────────┘  │              │
│  └──────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────┘
```

## 核心模块

### 1. 类型定义 (`src/types/version.ts`)

| 类型 | 说明 |
|------|------|
| `VersionSnapshot` | 版本快照数据结构，包含完整电路数据、时间戳、标签、缩略图 |
| `ChangeSummary` | 变更摘要，统计各类变更的数量 |
| `ComponentChange` | 单个元件的变更记录（增/删/改/移） |
| `WireChange` | 单条连线的变更记录 |
| `ParamChange` | 参数级变化记录（字段、旧值、新值） |
| `DiffResult` | 两个版本之间的完整差异结果 |
| `VersionTrigger` | 版本创建触发方式（手动/仿真前/关闭前/自动） |

### 2. 变更计算引擎 (`src/core/CircuitDiff.ts`)

Diff 算法的核心逻辑：

```
输入: 电路A (before) + 电路B (after)
输出: DiffResult (变更列表 + 汇总)

算法:
1. 元件比较 (diffComponents):
   - 构建 ID → Component 的 Map
   - 遍历 A 中的元件:
     - B 中不存在 → 标记为 Removed
     - B 中存在但位置不同 → 标记为 Moved
     - B 中存在但参数不同 → 标记为 Modified (附带 paramChanges)
   - 遍历 B 中的元件:
     - A 中不存在 → 标记为 Added

2. 连线比较 (diffWires):
   - 按 ID 匹配
   - 有 ID 但对方无 → Removed/Added

3. 汇总构建 (buildSummary):
   - 统计各类变更数量
```

**特性:**
- 位置变化与参数变化分离（Moved vs Modified）
- 参数变化精确到字段级（名称、值、旋转、额外参数）
- 支持描述文本生成（中文）

### 3. 版本管理核心 (`src/core/VersionManager.ts`)

| 方法 | 说明 |
|------|------|
| `createSnapshot()` | 创建版本快照，自动计算相对上一版本的 Diff |
| `listVersions(projectId)` | 获取项目版本列表（按序号倒序） |
| `getVersion(id)` | 获取单个版本详情 |
| `updateVersionMeta()` | 更新版本标签和描述 |
| `deleteVersion()` | 删除指定版本 |
| `restoreVersion(id)` | 恢复到指定版本（返回电路数据） |
| `compareVersions(from, to)` | 比较两个版本的差异 |
| `exportVersion(id)` | 导出单个版本的电路为 JSON 文件 |
| `pruneOldVersions()` | 清理超出最大保留数的旧版本 |

**存储方案:**
- 使用 IndexedDB 的 `versions` object store
- 索引: `projectId`, `createdAt`, `sequenceNumber`
- 最大保留版本数可配置（默认 50）

### 4. 状态管理 (`src/stores/version-store.ts`)

Zustand store，管理:
- `versions`: 当前项目的版本列表
- `showVersionPanel`: 版本面板开关
- `previewVersionId`: 只读预览的版本 ID
- `diffFromId` / `diffToId` / `diffResult`: Diff 比较状态
- 所有异步操作（创建、恢复、删除、比较）

## UI 组件

### VersionHistory (`src/components/VersionHistory/`)

**功能:**
- 时间线形式展示版本列表
- 每个版本显示: 时间、标签、触发方式图标、变更摘要标签
- 操作: 预览、恢复、编辑标签/描述、导出、删除
- Diff 比较模式: 选择两个版本进行比较
- 双击标签可编辑

**变更标签颜色:**
- 🟢 绿色: 新增元件/连线
- 🔴 红色: 删除元件/连线
- 🟡 黄色: 修改参数
- 🔵 蓝色: 移动位置

### VersionDiff (`src/components/VersionDiff/`)

**功能:**
- 展示两个版本的完整差异
- 分组显示: 新增、删除、修改、移动
- 参数变化精确显示: 旧值 → 新值
- 连线变化的可视化
- 无变更时显示确认信息

## 自动快照触发点

| 触发点 | Trigger 类型 | 配置项 |
|--------|-------------|--------|
| 手动点击"保存版本" | `manual` | — |
| 运行仿真前 | `pre_simulation` | `autoSnapshotBeforeSim` |
| 关闭项目前 | `pre_close` | `autoSnapshotBeforeClose` |

## 数据流

```
用户操作 → circuit-store (电路状态)
                ↓
        version-store.createSnapshot()
                ↓
        VersionManager.createSnapshot()
                ↓
        CircuitDiff.computeDiff()  ← 计算与上一版本的差异
                ↓
        IndexedDB versions store   ← 存储快照
                ↓
        version-store.versions     ← 更新 UI 列表
```

## 文件清单

```
frontend/src/
├── types/
│   └── version.ts              # 版本类型定义
├── core/
│   ├── VersionManager.ts       # 版本管理核心
│   ├── CircuitDiff.ts          # 变更计算引擎
│   └── index.ts                # (已更新导出)
├── stores/
│   └── version-store.ts        # 版本状态管理
├── components/
│   ├── VersionHistory/
│   │   ├── VersionHistory.tsx   # 版本历史面板
│   │   ├── VersionHistory.css   # 样式
│   │   └── index.ts            # 导出
│   └── VersionDiff/
│       ├── VersionDiff.tsx      # 差异比较面板
│       ├── VersionDiff.css      # 样式
│       └── index.ts            # 导出
└── types/
    └── index.ts                # (已更新导出)
```

## 与现有系统的集成

### StorageManager 协同
- VersionManager 使用独立的 `versions` object store
- 与 StorageManager 共享同一个 IndexedDB 数据库 (`chip-sim-db`)
- DB_VERSION 升级到 2 以支持版本存储

### CircuitStore 协同
- 版本恢复时通过 `useCircuitStore.setState()` 直接更新电路数据
- 自动快照在仿真前/关闭前由调用方触发

### ProjectManager 协同
- 版本按 `projectId` 关联到项目
- 删除项目时应同步调用 `versionManager.clearProjectVersions()`

## 配置项

```typescript
interface VersionManagerConfig {
  maxVersions: number;              // 最大保留版本数，默认 50
  autoSnapshotBeforeSim: boolean;   // 仿真前自动快照，默认 true
  autoSnapshotBeforeClose: boolean; // 关闭前自动快照，默认 true
  thumbnailSize: { width: 160, height: 120 }; // 缩略图尺寸
}
```
