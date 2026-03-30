# 错误处理与加载状态架构文档

> Chip-Sim Phase 2 · 前端错误处理和用户反馈系统

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                      ErrorBoundary (根级)                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                     App 组件树                         │  │
│  │                                                       │  │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────────────┐   │  │
│  │  │ Skeleton  │  │ ProgressBar│  │ ConfirmDialog     │   │  │
│  │  │ (加载态)  │  │ (进度指示) │  │ (危险操作确认)     │   │  │
│  │  └──────────┘  └──────────┘  └───────────────────┘   │  │
│  │                                                       │  │
│  │  ┌──────────────────┐  ┌──────────────────────────┐  │  │
│  │  │ ToastContainer    │  │ NotificationCenter       │  │  │
│  │  │ (即时通知)        │  │ (错误日志面板)            │  │  │
│  │  └──────────────────┘  └──────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   基础设施层                           │  │
│  │                                                       │  │
│  │  errorLogger  ←── apiFetch  ←── createApiClient       │  │
│  │  (错误收集)      (重试/超时)    (预配置客户端)          │  │
│  │                                                       │  │
│  │  useToast()    useErrorHandler()                      │  │
│  │  (通知 Hook)    (错误处理 + loading 包装)              │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 目录结构

```
frontend/src/
├── components/
│   ├── ErrorBoundary.tsx          # 全局错误边界（增强版）
│   ├── Toast.tsx + Toast.css      # Toast 通知组件（已有）
│   ├── Skeleton/                  # 骨架屏组件
│   │   ├── index.ts
│   │   ├── Skeleton.tsx           # 基础骨架 + 预设组合
│   │   └── Skeleton.css
│   ├── ConfirmDialog/             # 确认对话框
│   │   ├── index.ts
│   │   ├── ConfirmDialog.tsx      # 声明式 + 命令式 API
│   │   └── ConfirmDialog.css
│   ├── ProgressBar/               # 进度条
│   │   ├── index.ts
│   │   ├── ProgressBar.tsx        # 确定/不确定进度
│   │   └── ProgressBar.css
│   └── NotificationCenter/        # 通知中心
│       ├── index.ts
│       ├── NotificationCenter.tsx
│       └── NotificationCenter.css
├── hooks/
│   ├── index.ts                   # 统一导出
│   ├── useToast.ts                # Toast Hook
│   └── useErrorHandler.ts         # 错误处理 Hook
├── lib/
│   └── errors/
│       ├── error-logger.ts        # 全局错误日志收集器
│       └── api-client.ts          # API 请求封装 + 重试机制
└── stores/
    └── toast-store.ts             # Toast Zustand Store（已有）
```

## 组件说明

### 1. ErrorBoundary（错误边界）

- **作用**: 捕获 React 组件渲染异常，防止白屏
- **位置**: `src/components/ErrorBoundary.tsx`
- **集成**: 自动记录到 `errorLogger`，展示错误 ID 便于排查
- **使用**: 在 `App.tsx` 中包裹整个应用树；可在子组件中嵌套使用 `name` 属性标记来源

```tsx
<ErrorBoundary name="EditorPage" onError={(err) => reportToServer(err)}>
  <EditorPage />
</ErrorBoundary>
```

### 2. Toast 通知系统

- **Store**: `src/stores/toast-store.ts` (Zustand)
- **Hook**: `src/hooks/useToast.ts`
- **组件**: `src/components/Toast.tsx`
- **类型**: `success` / `error` / `warning` / `info`
- **特性**: 自动消失、手动关闭、多条堆叠、暗/亮主题

```tsx
// React 组件中
const toast = useToast();
toast.success('保存成功');
toast.error('操作失败', 5000);

// 非 React 上下文中
import { toast } from '@/stores/toast-store';
toast.warning('网络不稳定');
```

### 3. API 错误处理（api-client）

- **位置**: `src/lib/errors/api-client.ts`
- **特性**:
  - 超时控制（默认 30s）
  - 自动重试（指数退避）
  - 错误分类：`network` / `timeout` / `auth` / `client` / `server`
  - 可重试判断（网络错误和 5xx 可重试，4xx 不重试）
  - 用户友好的错误消息

```tsx
import { apiFetch, ApiError, getErrorMessage } from '@/lib/errors/api-client';

try {
  const { data } = await apiFetch<Result>('/api/simulate', {
    method: 'POST',
    body: JSON.stringify(circuit),
    timeout: 60000,
    maxRetries: 2,
    retryDelay: 1000,
  });
} catch (error) {
  if (error instanceof ApiError) {
    console.log(error.kind);        // 'timeout' | 'server' | ...
    console.log(error.retryable);   // 是否可重试
  }
  toast.error(getErrorMessage(error));
}
```

### 4. useErrorHandler Hook

- **位置**: `src/hooks/useErrorHandler.ts`
- **作用**: 统一错误处理 + loading 状态管理
- **特性**: `wrapAsync` 自动包装异步操作，处理 loading / success / error

```tsx
const { handleError, wrapAsync, isLoading } = useErrorHandler();

// 包装异步操作
const handleSave = wrapAsync(
  () => api.post('/save', data),
  '保存项目',
  { successMessage: '保存成功！' }
);

// 直接处理错误
try {
  await riskyOperation();
} catch (err) {
  handleError(err, '执行操作');
}
```

### 5. Skeleton（骨架屏）

- **位置**: `src/components/Skeleton/`
- **变体**: `text` / `rect` / `circle` / `button`
- **动画**: `shimmer`（光泽扫过）/ `pulse`（脉冲）/ `none`
- **预设**: `ComponentLibrarySkeleton` / `PropertyPanelSkeleton` / `WaveformPanelSkeleton` / `ValidationPanelSkeleton`

```tsx
import { Skeleton, ComponentLibrarySkeleton } from '@/components/Skeleton';

// 基础用法
<Skeleton variant="text" width="60%" />
<Skeleton variant="circle" width={32} height={32} />

// 预设组合
{isLoading ? <ComponentLibrarySkeleton /> : <ComponentLibrary />}
```

### 6. ConfirmDialog（确认对话框）

- **位置**: `src/components/ConfirmDialog/`
- **模式**: 声明式（React 组件）+ 命令式（`showConfirm` 函数）
- **特性**: `danger` 模式（红色按钮）、ESC 关闭、焦点管理

```tsx
import { ConfirmDialog, showConfirm } from '@/components/ConfirmDialog';

// 声明式
<ConfirmDialog
  open={showDeleteConfirm}
  title="删除项目"
  message="确定要删除此项目吗？此操作不可撤销。"
  danger
  onConfirm={handleDelete}
  onCancel={() => setShowDeleteConfirm(false)}
/>

// 命令式（替代 window.confirm）
const confirmed = await showConfirm({
  title: '删除项目',
  message: '确定删除？',
  danger: true,
});
if (confirmed) deleteProject();
```

### 7. ProgressBar（进度条）

- **位置**: `src/components/ProgressBar/`
- **模式**: 确定进度（0-100%）/ 不确定进度（`progress={null}`）
- **主题**: `primary` / `success` / `warning` / `danger`
- **特性**: 条纹动画、标签/百分比显示

```tsx
import { ProgressBar } from '@/components/ProgressBar';

// 确定进度
<ProgressBar progress={65} label="仿真进度" variant="primary" />

// 不确定进度（loading）
<ProgressBar progress={null} label="正在处理..." showPercent={false} />
```

### 8. NotificationCenter（通知中心）

- **位置**: `src/components/NotificationCenter/`
- **功能**: 展示 errorLogger 收集的所有错误，按类型分类显示
- **集成**: 自动订阅 `errorLogger`，实时更新

## 错误日志系统

`errorLogger` 是全局单例，自动收集：

| 类型 | 来源 | 触发时机 |
|------|------|----------|
| `render` | ErrorBoundary | React 组件渲染异常 |
| `api` | api-client | HTTP 请求失败 |
| `websocket` | ws-client | WebSocket 连接/消息错误 |
| `unhandled` | window.onerror | 未捕获的 JS 错误 |
| `unhandled` | unhandledrejection | 未处理的 Promise 拒绝 |

可配置上报 URL:
```ts
import { errorLogger } from '@/lib/errors/error-logger';
errorLogger.setReportUrl('/api/error-report');
```

## 与现有代码的集成

### EditorPage 集成点

1. **加载覆盖层**: 现有的 `simLoading` spinner 可替换为 `ProgressBar`
2. **项目管理**: `deleteProject` 中的 `confirm()` 可替换为 `showConfirm`
3. **组件库**: 可使用 `ComponentLibrarySkeleton` 作为懒加载占位
4. **WebSocket 错误**: `SimulationBridge` 的 `setWsError` 可额外记录到 `errorLogger`

### 需要手动集成的地方

以下集成需要开发者根据具体场景手动完成：

1. 在 `EditorPage.tsx` 中将 `window.confirm()` 替换为 `showConfirm()`
2. 在 `circuit-store.ts` 中将 `confirm()` 替换为 `ConfirmDialog`
3. 在 `SimulationBridge.tsx` 中将 WS 错误记录到 `errorLogger`
4. 根据后端进度上报接口，在仿真控制中使用 `ProgressBar`
5. 在 `App.tsx` 中添加 `NotificationCenter` 的触发按钮
