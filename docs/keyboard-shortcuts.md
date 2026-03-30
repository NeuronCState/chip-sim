# 快捷键配置文档

## 概述

chip-sim 采用集中式快捷键管理系统，通过 `KeybindingManager` 统一管理所有键盘快捷键。

## 架构

```
src/core/KeybindingManager.ts  ← 快捷键定义 + 管理器类
src/hooks/useKeybindings.ts    ← React Hook，连接管理器与 Store
src/components/KeyboardTooltip.tsx ← 悬浮操作提示
src/features/editor/ShortcutsHelp.tsx ← 快捷键帮助面板 (?/F1)
```

### 数据流

```
键盘事件 → useKeybindings hook → KeybindingManager.resolve()
                                    ↓
                              上下文检查 (canvas/input/global)
                                    ↓
                              权限检查 (requiresSelection 等)
                                    ↓
                              executeAction() → circuit-store action
```

## 快捷键列表

### 📄 文件

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| `Ctrl+S` | 保存/导出项目 | 导出当前电路为 JSON 文件 |
| `Ctrl+N` | 新建电路 | 清空画布（有确认提示） |

### ✏️ 编辑

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| `Ctrl+Z` | 撤销 | 最多 50 步 |
| `Ctrl+Y` / `Ctrl+Shift+Z` | 重做 | |
| `Ctrl+C` | 复制 | 需选中元件 |
| `Ctrl+X` | 剪切 | 需选中元件 |
| `Ctrl+V` | 粘贴 | 偏移 (20,20) 粘贴 |
| `Ctrl+D` | 克隆 | 复制 + 偏移 (40,40) |
| `Ctrl+A` | 全选 | 选中所有元件 |
| `Ctrl+G` | 组合/取消组合 | （开发中） |
| `Delete` / `Backspace` | 删除选中 | 支持多选批量删除 |
| `Escape` | 取消操作 | 取消连线、清除选择、回到选择工具 |

### 👁️ 视图

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| `F` | 适配屏幕 | 自动缩放居中显示所有元件 |
| `Ctrl++` / `Ctrl+=` | 放大 | 以画布中心缩放 |
| `Ctrl+-` | 缩小 | |
| `Space+拖拽` | 平移画布 | 按住空格拖动鼠标 |
| `滚轮` | 缩放画布 | 以鼠标位置为中心 |
| `G` | 切换网格显示 | |
| `S` | 切换吸附 | 开/关网格吸附 |
| `L` | 切换连线模式 | 直角 ↔ 直线 |
| `T` | 切换主题 | 深色 ↔ 浅色 |

### 🔧 工具

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| `V` | 选择工具 | 默认模式 |
| `W` | 连线工具 | 点击端口开始/结束连线 |
| `H` | 平移工具 | |
| `E` | 删除工具 | 点击元件/连线删除 |

### 📦 元件操作

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| `R` | 旋转选中元件 90° | 支持多选 |

### ⚡ 快速放置 (1-9)

| 按键 | 元件 | 默认值 |
|------|------|--------|
| `1` | 电阻 (R) | 1kΩ |
| `2` | 电容 (C) | 1μF |
| `3` | 电感 (L) | 1mH |
| `4` | 直流源 (V) | 5V |
| `5` | 交流源 (AC) | 5V |
| `6` | 接地 (GND) | 0V |
| `7` | 二极管 (D) | 0.7V |
| `8` | NPN晶体管 (Q) | β=100 |
| `9` | 运放 (U) | 100k A/V |

### ▶️ 仿真

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| `F5` | 运行仿真 | |

### ❓ 帮助

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| `?` | 快捷键速查表 | 画布获得焦点时 |
| `F1` | 快捷键速查表 | 全局可用 |

## 上下文感知

快捷键根据当前焦点状态有不同的行为：

| 上下文 | 触发条件 | 示例 |
|--------|----------|------|
| `global` | 始终生效 | Ctrl+S, Ctrl+Z, F1 |
| `canvas` | 画布获得焦点 | R(旋转), 1-9(快速放置), V(选择工具) |
| `input` | 输入框获得焦点 | 仅 global 快捷键生效 |

### 判断逻辑

```
当前焦点在 <input>/<textarea>/<select>/contentEditable → context = 'input'
其他情况 → context = 'canvas'
```

当 context = 'input' 时，只有标注为 `global` 的快捷键生效，
避免用户在输入元件名称/参数时触发画布操作。

## 自定义快捷键

### 方法 1：通过 API

```typescript
import { getKeybindingManager } from '../hooks/useKeybindings';

const manager = getKeybindingManager();

// 修改单个快捷键
manager.applyConfig({
  'edit.undo': { key: 'z', modifiers: { ctrl: true, shift: true } },
});

// 保存到 localStorage
manager.saveToStorage();
```

### 方法 2：直接修改 localStorage

```javascript
// localStorage key: 'chip-sim-keybindings'
// 值为 JSON，格式：
{
  "edit.undo": { "key": "z", "modifiers": { "ctrl": true } },
  "component.rotate": { "key": "r" }
}
```

### 配置项说明

每个配置项的 key 为快捷键 ID（见 `DEFAULT_KEYBINDINGS` 中的 `id` 字段），
值为可覆盖的字段：

```typescript
{
  key?: string;          // 按键，如 'z', 'F1', '/'
  modifiers?: {
    ctrl?: boolean;      // Ctrl (Windows/Linux) / Cmd (macOS)
    shift?: boolean;
    alt?: boolean;
  };
}
```

### 冲突检测

```typescript
import { KeybindingManager } from '../core/KeybindingManager';

const manager = new KeybindingManager();
const conflicts = manager.detectConflicts();
// 返回冲突列表：[{ a: KeyBinding, b: KeyBinding, composite: string }]
```

## 选中状态依赖

部分快捷键需要元件被选中才生效：

| 快捷键 | 要求 |
|--------|------|
| `R` (旋转) | 至少一个元件被选中 |
| `Delete` | 元件或连线被选中 |
| `Ctrl+C` | 元件被选中 |
| `Ctrl+X` | 元件被选中 |
| `Ctrl+D` | 元件被选中 |
| `Ctrl+G` | 元件被选中 |

## 悬浮操作提示

当元件被选中且鼠标在画布上移动时，
会在鼠标旁显示当前可用的键盘操作提示。

该功能由 `KeyboardTooltip` 组件实现，
通过监听鼠标移动事件和 Store 中的选中状态来控制显示。

## 扩展指南

### 添加新快捷键

1. 在 `KeybindingManager.ts` 的 `DEFAULT_KEYBINDINGS` 数组中添加条目
2. 在 `useKeybindings.ts` 的 `executeAction` 函数的 switch 中添加处理逻辑
3. 如果需要在 Store 中添加新 action，在 `circuit-store.ts` 中实现
4. 更新本文档

### 添加新分类

1. 在 `ShortcutCategory` 类型中添加新分类
2. 在 `CATEGORY_LABELS` 和 `CATEGORY_ORDER` 中添加对应条目
