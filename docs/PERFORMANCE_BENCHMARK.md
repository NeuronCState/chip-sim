# Chip-Sim 性能优化基准测试报告

**生成日期**: 2026-03-28  
**版本**: Phase 3 - 大规模电路性能优化

---

## 📊 优化概览

本次优化针对大规模电路（500+元件）的渲染和仿真性能，实现了以下核心改进：

### 1. 渲染性能优化

| 优化项 | 技术方案 | 文件位置 |
|--------|----------|----------|
| **视口裁剪** | Grid-based SpatialIndex 只渲染视口内元件 | `src/core/SpatialIndex.ts`, `src/lib/rendering/RenderOptimizer.ts` |
| **连线路径缓存** | WireIndex 按端口/元件快速查找 | `src/core/SpatialIndex.ts` (WireIndex 类) |
| **WebGL 批量渲染** | 减少 draw call，使用共享 VBO | `src/lib/rendering/webgl-renderer.ts` |
| **Text Overlay 2D 层** | 文本独立渲染，避免 WebGL 文本开销 | `src/lib/rendering/webgl-renderer.ts` |
| **RAF 节流** | requestAnimationFrame 渲染循环 | `src/core/PerformanceMonitor.ts` (rafThrottle) |

### 2. 数据结构优化

| 优化项 | 技术方案 | 文件位置 |
|--------|----------|----------|
| **空间索引** | Grid-based SpatialIndex (cellSize=100) | `src/core/SpatialIndex.ts` |
| **连线索引** | 按 fromPort/toPort/component 三重映射 | `src/core/SpatialIndex.ts` (WireIndex) |
| **增量仿真** | Web Worker 后台 MNA 矩阵求解 | `src/workers/sim-worker.ts` |

### 3. 内存管理

| 优化项 | 技术方案 | 文件位置 |
|--------|----------|----------|
| **波形滑动窗口** | SlidingWindowBuffer 限制最大数据点 | `src/core/memory.ts` |
| **历史记录压缩** | HistoryCompressor 压缩旧快照 | `src/core/memory.ts` |
| **对象池** | ObjectPool 复用频繁创建的对象 | `src/core/memory.ts` |
| **资源清理** | CleanupManager 统一管理释放 | `src/core/memory.ts` |

### 4. 性能监控

| 优化项 | 技术方案 | 文件位置 |
|--------|----------|----------|
| **性能面板** | 实时 FPS/内存/渲染时间监控 | `src/components/PerfPanel/` |
| **PerformanceMonitor** | 帧计时、仿真计时、历史记录 | `src/core/PerformanceMonitor.ts` |
| **火焰图导出** | Chrome DevTools 格式导出 | `src/core/PerformanceMonitor.ts` |

### 5. 懒加载和分块

| 优化项 | 技术方案 | 文件位置 |
|--------|----------|----------|
| **元件库懒加载** | 轻量级元数据 + 按需加载完整定义 | `src/core/component-loader.ts` |
| **分类折叠展开** | 元件库按分类分组 | `src/features/editor/ComponentLibrary.tsx` |
| **搜索过滤** | 实时搜索元件 | `src/features/editor/ComponentLibrary.tsx` |

---

## 🔬 基准测试方法

### 测试环境
- **浏览器**: Chrome (支持 WebGL, performance.memory)
- **设备**: Mac mini (Apple Silicon)
- **测试电路规模**: 50, 100, 200, 500, 1000 元件

### 测试指标
1. **FPS**: 持续平移/缩放时的帧率
2. **渲染时间**: 单帧渲染耗时 (ms)
3. **索引构建时间**: SpatialIndex 重建耗时 (ms)
4. **视口查询时间**: 查询可见元件耗时 (ms)
5. **内存占用**: JS Heap 使用量 (MB)

---

## 📈 预期性能基线

### 渲染性能（视口裁剪优化后）

| 元件数量 | 未优化 FPS | 优化后 FPS | 提升比 | 裁剪率 |
|----------|-----------|-----------|--------|--------|
| 50 | ~60 | ~60 | 1.0x | 0% (不触发裁剪) |
| 100 | ~55 | ~60 | 1.1x | ~10% |
| 200 | ~40 | ~58 | 1.45x | ~30% |
| 500 | ~18 | ~55 | 3.1x | ~60% |
| 1000 | ~8 | ~50 | 6.3x | ~80% |

> **注意**: 以上为估算值。当元件数量 < 50 时，不启用视口裁剪（避免索引开销大于收益）。

### 空间索引性能

| 元件数量 | 索引构建 (ms) | 视口查询 (ms) | 查询条目数 (全屏) |
|----------|--------------|--------------|------------------|
| 100 | < 1 | < 0.1 | ~90 |
| 500 | < 3 | < 0.5 | ~200 |
| 1000 | < 5 | < 1 | ~200 |
| 5000 | < 20 | < 3 | ~200 |

### 内存管理效果

| 场景 | 未优化 (MB) | 优化后 (MB) | 节省 |
|------|-----------|-----------|------|
| 500 元件 + 1000 undo 步骤 | ~120 | ~45 | 62% |
| 波形数据 10万点 (无窗口) | ~80 | ~8 (滑动窗口) | 90% |
| 元件库完整加载 | ~2 | ~0.3 (懒加载) | 85% |

### Web Worker 仿真性能

| 分析类型 | 100 元件 | 500 元件 | 1000 元件 |
|----------|---------|---------|----------|
| DC 工作点 | < 10ms | < 50ms | < 200ms |
| Transient (1000步) | < 500ms | < 3s | < 15s |
| AC 扫描 (100点) | < 200ms | < 1s | < 5s |

> Web Worker 将仿真计算移至后台线程，主线程保持 60 FPS 响应。

---

## 🏗️ 架构变更

### 新增文件

```
src/core/
├── SpatialIndex.ts          # Grid 空间索引 + WireIndex
├── PerformanceMonitor.ts    # 性能监控工具类
├── memory.ts                # 内存管理工具
├── component-loader.ts      # 懒加载元件库
└── index.ts                 # 核心模块导出

src/workers/
└── sim-worker.ts            # 仿真 Web Worker

src/lib/rendering/
└── RenderOptimizer.ts       # 渲染优化器（集成 SpatialIndex）

src/components/PerfPanel/
├── PerfPanel.tsx            # 性能监控面板组件
├── PerfPanel.css            # 面板样式
└── index.ts                 # 导出
```

### 修改文件

```
src/hooks/useCanvas.ts               # 集成 RenderOptimizer 视口裁剪
src/lib/rendering/index.ts           # 新增导出
src/stores/circuit-store.ts          # 集成 HistoryCompressor + CleanupManager
src/features/editor/EditorPage.tsx   # 集成 PerfPanel
src/features/editor/ComponentLibrary.tsx  # 重构为懒加载+分类视图
src/features/editor/ComponentLibrary.css  # 新样式
```

---

## 🔍 使用方法

### 查看性能面板
点击底部状态栏的 **📊 性能** 按钮，或在代码中：
```tsx
<PerfPanel visible={true} componentCount={100} nodeCount={50} wireCount={80} />
```

### 使用 SpatialIndex
```typescript
import { SpatialIndex } from '../core/SpatialIndex';

const index = new SpatialIndex(100); // cellSize = 100
index.bulkInsert(entries);
const visible = index.query({ minX: 0, minY: 0, maxX: 800, maxY: 600 });
```

### 使用 Web Worker 仿真
```typescript
const worker = new Worker(new URL('../workers/sim-worker.ts', import.meta.url), { type: 'module' });
worker.postMessage({ type: 'simulate', config, components, nodes, wires, requestId });
worker.onmessage = (e) => { /* 处理结果 */ };
```

### 使用内存管理
```typescript
import { SlidingWindowBuffer, HistoryCompressor } from '../core/memory';

const buffer = new SlidingWindowBuffer(10000, 5000); // max 10k, keep 5k
buffer.push({ x: time, y: voltage });

const compressor = new HistoryCompressor(50, 10); // max 50, compress after 10
```

---

## ✅ 验收标准

- [x] TypeScript 编译无错误
- [x] 全部 70 个测试通过
- [x] SpatialIndex 实现完整（insert/remove/query/bulkInsert）
- [x] WireIndex 支持按端口和元件快速查找
- [x] PerformanceMonitor 支持 FPS/内存/渲染时间监控
- [x] PerfPanel 组件可折叠、可拖拽
- [x] 内存管理工具（滑动窗口、压缩器、对象池、清理管理器）实现完整
- [x] 元件库懒加载 + 分类视图 + 搜索功能
- [x] Web Worker 仿真（DC/AC/Transient）
- [x] RenderOptimizer 集成到 useCanvas
- [x] PerfPanel 集成到 EditorPage

---

## 📝 后续优化方向

1. **虚拟滚动**: 元件库列表超过 100 项时启用虚拟滚动
2. **OffscreenCanvas**: 将静态元件渲染为缓存图像
3. **SharedArrayBuffer**: 仿真数据多线程共享
4. **WebAssembly**: MNA 矩阵求解用 WASM 加速
5. **LOD 渲染**: 缩放级别低时简化元件绘制
