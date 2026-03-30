# Chip-Sim 视觉效果设计文档

> 版本: 1.0 | 更新: 2026-03-28 | 作者: 工部

## 概述

本文档描述 chip-sim 前端的视觉效果增强体系，涵盖动画系统、仿真数据可视化、元件视觉升级和主题系统四大模块。

## 架构总览

```
src/
├── core/
│   ├── AnimationEngine.ts     # 动画引擎（Spring + Tween + 脉冲 + 流动）
│   ├── ThemeSystem.ts         # 主题系统（色彩 Token + CSS 变量 + 平滑切换）
│   └── index.ts               # 统一导出
├── lib/rendering/
│   ├── webgl-renderer.ts      # WebGL 主渲染器（已集成 VFX）
│   ├── VisualEffectsEngine.ts # 视觉效果引擎（光晕/流动/脉冲 WebGL 层）
│   ├── visual-shaders.ts      # 视觉效果着色器
│   ├── shaders.ts             # 基础着色器（网格/填充/虚线）
│   ├── canvas-renderer.ts     # Canvas 2D 备用渲染器
│   └── webgl-utils.ts         # WebGL 工具函数
├── components/
│   ├── CircuitCanvas.tsx       # 电路画布
│   ├── CircuitCanvas.css       # 画布样式 + 视觉效果 CSS 动画
│   └── HeatmapOverlay/
│       ├── HeatmapOverlay.tsx  # 热力图叠加层组件
│       └── HeatmapOverlay.css  # 热力图样式
└── App.css                     # 全局主题 + 动画关键帧
```

---

## 1. 交互动画系统 (`AnimationEngine.ts`)

### 1.1 架构

基于 `requestAnimationFrame` 的 60fps 动画循环，支持以下动画类型：

| 类型 | 说明 | 用途 |
|------|------|------|
| `tween` | 补间动画 | 淡入淡出、位置过渡 |
| `spring` | Spring 物理弹性 | 元件拖入、弹性回弹 |
| `pulse` | 正弦脉冲 | 仿真信号、呼吸光效 |
| `flow` | 线性循环 | 连线电流流动 |

### 1.2 Spring 物理模型

```
F = -kx - cv    (k=刚度, c=阻尼, v=速度)
a = F / m       (m=质量)
```

参数默认值:
- `stiffness: 170` — 弹性刚度
- `damping: 26` — 阻尼系数
- `mass: 1` — 质量
- `precision: 0.001` — 停止阈值

### 1.3 预定义缓动函数

| 函数 | 曲线 | 适用场景 |
|------|------|----------|
| `easeOutCubic` | 快→慢 | 通用出场 |
| `easeInCubic` | 慢→快 | 删除淡出 |
| `easeOutElastic` | 弹性过冲 | 元件拖入 |
| `easeOutBounce` | 弹跳 | 强调入场 |
| `easeInOutQuad` | 缓入缓出 | 脉冲信号 |

### 1.4 CSS 关键帧动画

| 动画名 | 效果 | 触发 |
|--------|------|------|
| `springDrop` | 弹性缩放入场 | 元件拖入画布 |
| `fadeOutDelete` | 缩小淡出 | 元件删除 |
| `glowPulse` | 光晕呼吸 | 选中元件 |
| `wireFlow` | 虚线流动 | 连线流动效果 |
| `signalPulse` | 信号脉冲 | 仿真运行 |
| `pinGlow` | 引脚发光 | 端口悬停 |
| `ledOn` | LED 闪烁 | 数字元件输出 |

### 1.5 全局开关

```typescript
import { animationEngine } from './core/AnimationEngine';

// 禁用所有动画（低性能设备）
animationEngine.enabled = false;

// 查看当前活跃动画数
console.log(animationEngine.activeCount);
```

---

## 2. 仿真数据可视化

### 2.1 热力图叠加层 (`HeatmapOverlay.tsx`)

在电路画布上叠加半透明 Canvas 层，实时渲染仿真结果：

#### 电压可视化
- **颜色映射**: 蓝(0V) → 青 → 黄 → 红(最高V)
- **节点热力圆**: 从节点位置向外辐射渐变
- **数值标签**: 浮动在节点上方，带半透明背景气泡

#### 电流可视化
- **连线亮度**: 电流越大 → 连线越亮越粗
- **流动粒子**: 沿连线方向移动的发光粒子，方向 = 电流方向
- **颜色区分**: 正向电流 = 绿色，反向 = 红色

#### 配置项

```typescript
interface HeatmapConfig {
  visible: boolean;               // 显示/隐藏
  voltageRange: { min, max };     // 电压色阶范围
  maxCurrent: number;             // 电流归一化基准
  labelMode: 'voltage' | 'current' | 'both' | 'none';
  overlayOpacity: number;         // 叠加透明度 (0-1)
  flowAnimation: boolean;         // 流动粒子动画
}
```

### 2.2 颜色映射函数

```typescript
// 电压 → 颜色
voltageToColor(voltage: number, min: number, max: number): string

// 电流 → 连线亮度 (0.3-1.0)
currentToBrightness(current: number, maxCurrent: number): number
```

### 2.3 颜色图例

`HeatmapLegend` 组件提供可浮动在画布右下角的颜色图例条。

---

## 3. 元件视觉升级

### 3.1 渐变和阴影

- 元件符号在 WebGL 中使用多层叠加实现伪渐变效果
- 选中态使用虚线高亮框 + 光晕叠加
- 悬停态使用 CSS `componentHover` 弹性动画

### 3.2 引脚发光连接点

- 默认引脚为半透明圆点 (`portColor`)
- 悬停时变大 + 外圈光环 (`portSnapColor` + `pinGlow` 动画)
- 仿真运行时端口随信号脉冲闪烁

### 3.3 仿真状态视觉指示

| 元件 | 视觉指示 |
|------|----------|
| LED | 亮度/颜色随引脚电平变化 |
| 继电器 | 吸合/释放状态动画 |
| MCU | 引脚状态灯 (红=低, 绿=高, 灰=悬空) |
| 运算放大器 | 输出端颜色随电压变化 |
| 逻辑门 | 输出端发光指示高低电平 |

### 3.4 WebGL 视觉效果层 (`VisualEffectsEngine`)

独立的渲染通道，叠加在主渲染器之上：

| 效果 | Shader | 说明 |
|------|--------|------|
| 选中光晕 | `GLOW_VERT/FRAG` | 高斯衰减的径向光晕 |
| 流动粒子 | `FLOW_PARTICLE_VERT/FRAG` | gl_PointSize 圆形粒子 |
| 仿真脉冲 | `GLOW` (复用) | 沿连线移动的高亮点 |
| 端口发光 | `PORT_GLOW_VERT/FRAG` | 脉冲发光的连接点 |

混合模式: 加法混合 (`GL_ONE`) 用于光效叠加。

---

## 4. 主题系统 (`ThemeSystem.ts`)

### 4.1 色彩 Token 体系

每个主题定义 **40+ 个 Token**，分为 7 大类：

| 分类 | Token 数 | 示例 |
|------|---------|------|
| 背景 | 6 | `bgApp`, `bgPanel`, `bgCanvas` |
| 边框 | 3 | `border`, `borderLight`, `borderAccent` |
| 文本 | 4 | `text`, `textDim`, `textMuted`, `textInverse` |
| 强调色 | 3 | `accent`, `accentHover`, `accentSubtle` |
| 状态色 | 8 | `success`, `danger`, `warning`, `info` + subtle |
| 画布 | 12 | `wireColor`, `componentColor`, `portColor`... |
| 效果 | 8 | `glowColor`, `flowColor`, `heatmapLow/High`... |

### 4.2 暗色主题 (默认)

```
背景: #0d0d1a (深邃太空蓝)
主色: #00d4ff (电光青)
选中: #4488ff (明亮蓝)
连线: #00d4ff (青色流光)
端口: #4ecdc4 (薄荷绿)
热力图: #1a3a6e → #ccaa00 → #ff2222
```

### 4.3 亮色主题

```
背景: #f0f2f5 (淡灰白)
主色: #1677ff (Ant Design 蓝)
选中: #1677ff
连线: #1677ff
端口: #13c2c2 (青色)
热力图: #4488ff → #ffaa00 → #ff2222
```

### 4.4 平滑切换

- 使用 CSS `transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1)`
- 通过 CSS 变量 `--vis-*` 统一管理
- 自动检测系统 `prefers-color-scheme`
- 持久化到 `localStorage`

### 4.5 使用方式

```typescript
import { themeManager } from './core/ThemeSystem';

// 切换主题（带动画）
await themeManager.toggle();

// 获取当前 Token
const tokens = themeManager.tokens;
console.log(tokens.wireColor); // '#00d4ff'

// 监听变更
themeManager.onChange((name) => {
  console.log('Theme changed to:', name);
});
```

---

## 5. 性能与可配置性

### 5.1 动画开关

所有动画可通过以下方式禁用：

```typescript
// 全局禁用
animationEngine.enabled = false;

// VFX 局部禁用
renderer.setVFXConfig({
  enabled: false,        // 全部禁用
  selectionGlow: false,  // 仅禁用光晕
  wireFlow: false,       // 仅禁用流动
});
```

### 5.2 性能建议

| 设备类型 | 推荐配置 |
|----------|----------|
| 高端桌面 | 全部启用 |
| 笔记本 | 启用 VFX, 禁用热力图流动粒子 |
| 平板/低端 | 禁用 VFX, 仅保留 CSS 动画 |
| 极低性能 | 禁用所有动画 (`animationEngine.enabled = false`) |

### 5.3 渲染性能

- WebGL 批量渲染: 单次 draw call 最大化
- 流动粒子使用 `gl.POINTS`, GPU 端生成大小
- Spring 动画使用固定步长, 最大帧时间 50ms 截断
- 2D Canvas overlay 仅用于文字, 不影响 WebGL 性能

---

## 6. 扩展点

### 6.1 添加新动画类型

在 `AnimationEngine.ts` 中扩展 `AnimationType`, 添加对应的 tick 方法。

### 6.2 添加新着色器

在 `visual-shaders.ts` 中添加 GLSL 代码, 在 `VisualEffectsEngine` 中注册新的渲染通道。

### 6.3 添加新主题

在 `ThemeSystem.ts` 中定义新的 `ThemeTokens` 对象, 注册到 `THEME_MAP`。

### 6.4 自定义热力图颜色

修改 `ThemeTokens` 中的 `heatmapLow/Mid/High` 值, 或在 `HeatmapOverlay` 中传入自定义颜色映射函数。

---

## 附录: 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/core/AnimationEngine.ts` | 新建 | 动画引擎 |
| `src/core/ThemeSystem.ts` | 新建 | 主题系统 |
| `src/core/index.ts` | 新建 | 统一导出 |
| `src/lib/rendering/VisualEffectsEngine.ts` | 新建 | VFX 渲染引擎 |
| `src/lib/rendering/visual-shaders.ts` | 新建 | 视觉着色器 |
| `src/components/HeatmapOverlay/HeatmapOverlay.tsx` | 新建 | 热力图组件 |
| `src/components/HeatmapOverlay/HeatmapOverlay.css` | 新建 | 热力图样式 |
| `src/lib/rendering/webgl-renderer.ts` | 修改 | 集成 VFX |
| `src/App.css` | 修改 | 主题过渡 + CSS 动画关键帧 |
