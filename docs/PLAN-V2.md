# MCU仿真平台全面重做 · 实施规划 V2.1

> 任务ID: JJC-20260329-MCU
> 起草: 中书省 | 日期: 2026-03-29
> 修订: V2.1 (门下省有条件准奏修正)
> 项目路径: `/Users/zhangxuanning/.openclaw/workspace-taizi/chip-sim/`

---

## 一、现状分析

### 1.1 已完成（可复用）

| 模块 | 状态 | 关键文件 |
|------|------|----------|
| **后端仿真引擎** | ✅ 完整 | `backend/internal/engine/*` — MNA/DC/AC/瞬态/GPIO/ADC/DAC/Timer/Interrupt |
| **协议仿真** | ✅ 完整 | `backend/internal/engine/protocols/*` — SPI/I2C/UART/CAN |
| **WebGL渲染器** | ✅ 完整 | `frontend/src/lib/rendering/webgl-renderer.ts` + shaders |
| **Canvas 2D渲染器** | ✅ 完整 | `frontend/src/lib/rendering/canvas-renderer.ts` — **保留为降级方案** |
| **动画引擎** | ✅ 完整 | `frontend/src/core/AnimationEngine.ts` — spring/tween/pulse/flow |
| **主题系统** | ✅ 完整 | `frontend/src/core/ThemeSystem.ts` — 40+ token, 暗/亮主题 |
| **电路状态管理** | ✅ 完整 | `frontend/src/stores/circuit-store.ts` — 1800+行, 完整CRUD/undo/redo/项目管理 |
| **元件库(类型)** | ✅ 70+种 | `frontend/src/core/components/*` + `component-loader.ts` |
| **连线系统** | ✅ 完整 | `wire-routing.ts` + `SmartRouter.ts` + `WireBeautifier.ts` |
| **验证/DRC** | ✅ 完整 | `CircuitDRC.ts` + `DiagnosticEngine.ts` + `circuit-validation.ts` |
| **项目管理** | ✅ 完整 | `ProjectManager.ts` + `StorageManager.ts` — 多工程/模板/版本 |
| **UI组件库** | ✅ 基础 | `frontend/src/ui/*` — Button/Panel/Input/Dropdown/Tabs/Segmented/Modal/Toast |
| **MCU仿真前端** | ✅ 基础 | `frontend/src/core/mcu/*` — Clock/Interrupt/Timer/MCUSimulator |
| **芯片JSON** | ⚠️ 7个 | `frontend/public/chips/` — C51(2)+STM32(3)+ESP32(2) |
| **模板电路** | ⚠️ 17个 | `frontend/src/templates/*.json` |
| **代码示例** | ⚠️ 10个 | `frontend/src/mcu/examples.ts` |
| **测试** | ✅ 17个 | `frontend/src/__tests__/*` |

### 1.2 缺失项（按MEMORY.md需求）

| 缺失项 | 现状 | 目标 |
|--------|------|------|
| 芯片型号 | 7个(3系列) | **30+个(9系列)** |
| 元件图标 | emoji文字 | **SVG图标, 200+种** |
| 模板电路 | 17个 | **50+个** |
| 布局 | Tab切换MCU/电路 | **一体化: 左(元件+引脚)+中(画布+浮出属性)+右(IDE)+底(串口/波形)** |
| 连线交互 | 已有正交走线 | **点击引脚/○按钮开始, 拖入自动吸附** |
| 错误检测 | DRC基础 | **未接引脚标红, 电源缺失芯片红框** |
| 可视化 | 基础渲染 | **LED亮度PWM, 电流动画, 引脚电平颜色, 串口逐字弹出, 实时波形** |
| 库函数 | 无 | **HAL/Arduino/51速查, 搜索插入代码** |
| 代码编辑器 | 基础 | **Monaco集成+文件管理** |
| 串口监视器 | 基础 | **逐字弹出动画** |

---

## 二、文件变更清单

### 2.1 新建文件

| 文件 | 说明 |
|------|------|
| **芯片数据 (public/chips/)** | |
| `public/chips/c51/stc12c5a60s2.json` | STC12C5A 系列 |
| `public/chips/c51/stc15w4k32s4.json` | STC15W 系列 |
| `public/chips/c51/at89c51.json` | AT89C51 |
| `public/chips/stm32/stm32f407vgt6.json` | STM32F407 |
| `public/chips/stm32/stm32f411ceu6.json` | STM32F411 |
| `public/chips/stm32/stm32f429iit6.json` | STM32F429 |
| `public/chips/stm32/stm32h743vit6.json` | STM32H743 |
| `public/chips/stm32/stm32g431cbt6.json` | STM32G431 |
| `public/chips/stm32/stm32l476rgt6.json` | STM32L476 |
| `public/chips/stm32/stm32wl55jci6.json` | STM32WL55 |
| `public/chips/esp32/esp32-s2.json` | ESP32-S2 |
| `public/chips/esp32/esp32-c3.json` | ESP32-C3 |
| `public/chips/esp32/esp32-c6.json` | ESP32-C6 |
| `public/chips/esp32/esp8266.json` | ESP8266 |
| `public/chips/arduino/uno.json` | Arduino Uno |
| `public/chips/arduino/mega.json` | Arduino Mega |
| `public/chips/arduino/nano.json` | Arduino Nano |
| `public/chips/arduino/leonardo.json` | Arduino Leonardo |
| `public/chips/arduino/due.json` | Arduino Due |
| `public/chips/avr/atmega2560.json` | ATmega2560 |
| `public/chips/avr/attiny85.json` | ATtiny85 |
| `public/chips/pic/pic16f877a.json` | PIC16F877A |
| `public/chips/pic/pic18f4550.json` | PIC18F4550 |
| `public/chips/pic/pic32mx.json` | PIC32MX |
| `public/chips/msp430/g2553.json` | MSP430G2553 |
| `public/chips/msp430/f5529.json` | MSP430F5529 |
| `public/chips/nxp/lpc1768.json` | LPC1768 |
| `public/chips/nxp/imxrt1062.json` | i.MX RT1062 |
| `public/chips/riscv/ch32v.json` | CH32V |
| `public/chips/riscv/gd32vf103.json` | GD32VF103 |
| `public/chips/riscv/bl602.json` | BL602 |
| **SVG图标** | |
| `public/icons/components/*.svg` | 200+元件SVG图标 (按类别分子目录) |
| **库函数数据** | |
| `public/libraries/hal-stm32.json` | STM32 HAL库函数速查 |
| `public/libraries/arduino-api.json` | Arduino API速查 |
| `public/libraries/51-registers.json` | 51寄存器速查 |
| **模板电路** | |
| `src/templates/stm32-*.json` | STM32系列模板 (扩展10+个) |
| `src/templates/esp32-*.json` | ESP32系列模板 (扩展5+个) |
| `src/templates/c51-*.json` | C51系列模板 (扩展5+个) |
| `src/templates/classic-*.json` | 经典项目模板 (扩展10+个) |
| **MCU前端模块** | |
| `src/mcu/library-browser.ts` | 库函数搜索/浏览引擎 |
| `src/mcu/file-manager.ts` | 代码文件管理器 |
| `src/mcu/pin-mapper.ts` | 引脚复用映射和冲突检测 |
| **面板组件** | |
| `src/panels/LibraryPanel.tsx` | 库函数面板 (搜索/插入) |
| `src/panels/FileExplorer.tsx` | 文件管理面板 |
| `src/panels/PinStatusPanel.tsx` | 引脚实时状态面板 |
| **画布渲染** | |
| `src/canvas/ChipRenderer.ts` | 芯片引脚图WebGL渲染器 |
| `src/canvas/ComponentSVGIcons.ts` | 元件SVG图标WebGL纹理加载 |
| `src/canvas/WireCurrentEffect.ts` | 连线电流动画渲染 |

### 2.2 修改文件

| 文件 | 改动说明 |
|------|----------|
| **布局重做** | |
| `src/App.tsx` | 删除Tab切换, 改为一体化布局 |
| `src/pages/McuSimulator.tsx` | 重写: 去掉Tab, 直接渲染左中右底四区域 |
| `src/features/editor/EditorPage.tsx` | 删除或合并到McuSimulator |
| `src/App.css` | 重写: 四区域grid布局+分隔线拖拽 |
| **画布** | |
| `src/canvas/WebGLCanvas.tsx` | 集成ChipRenderer, 支持芯片引脚图渲染 |
| `src/canvas/interaction.ts` | 增加: 点击引脚○按钮开始连线, 拖入自动吸附 |
| **芯片系统** | |
| `src/components/ChipSelector.tsx` | 扩展: 9系列30+型号选择, 搜索过滤 |
| `src/mcu/chip-loader.ts` | 扩展: 动态加载所有系列JSON |
| **MCU仿真** | |
| `src/core/mcu/MCUSimulator.ts` | 扩展: 支持全部9系列MCU预设 |
| **代码编辑器** | |
| `src/panels/CodeEditor.tsx` | 集成Monaco编辑器+多文件管理+库函数搜索 |
| **串口监视器** | |
| `src/panels/SerialMonitor.tsx` | 增加逐字弹出动画效果 |
| **波形面板** | |
| `src/panels/WaveformPanel.tsx` | 实时波形示波器效果, 默认收起 |
| **元件库面板** | |
| `src/features/editor/ComponentLibrary.tsx` | SVG图标+搜索+按功能分类 |
| **电路store** | |
| `src/stores/circuit-store.ts` | 增加: 当前芯片型号状态, 引脚列表, 库函数状态 |
| **后端** | |
| `backend/internal/engine/mcu_sim.go` | 扩展MCU预设配置 |
| `backend/pkg/types/component.go` | 扩展MCU组件类型 |
| **Canvas 2D降级** | |
| `src/lib/rendering/canvas-renderer.ts` | 保留不动, 作为WebGL不支持时的降级方案 |

### 2.3 删除文件

| 文件 | 原因 |
|------|------|
| `src/components/CircuitCanvas.tsx` | 旧画布组件, 被WebGLCanvas替代 |
| `src/components/CircuitCanvas.css` | 对应样式 |
| `src/pages/CircuitEditor.tsx` | 旧电路编辑页, 合并到一体化布局 |

> ⚠️ `canvas-renderer.ts` 不删除! 保留为Canvas 2D降级方案, 仅在WebGL不支持时启用。

---

## 三、分阶段实施

### Phase 1: 芯片数据扩展 + 布局重做

**目标:** 30+芯片JSON就位, 新四区域布局可用

**具体任务:**
1. **芯片JSON扩展 (25个新文件)**
   - 参照现有 `stm32f103c8t6.json` 格式
   - 每个JSON包含: series, name, package, flash, ram, clock, pinCount, pins[], peripherals[]
   - 按系列批量创建, 每个引脚包含 id/port/bit/functions
   - 复用 `chip-loader.ts` 的加载逻辑, 无需改动

2. **布局重做**
   - `App.tsx`: 去掉Tab切换, 渲染 `<McuSimulator />` 一体化布局
   - `McuSimulator.tsx`: 重写为四区域grid
     - 左栏: 上半=元件库(搜索+分类), 下半=当前芯片引脚列表
     - 中栏: 画布 + 浮出属性面板(点击元件弹出, 点空白收起)
     - 右栏: 代码编辑器+文件管理(可收起)
     - 底栏: 串口/波形(可收起)
   - 三处分隔线可拖拽调整大小
   - `App.css`: CSS Grid布局 + 分隔线样式

3. **ChipSelector扩展**
   - 9大系列: 51/STM32/ESP/Arduino/AVR/PIC/MSP430/NXP/RISC-V
   - 两级选择: 系列下拉 → 型号下拉
   - 搜索过滤

**验收标准:**
- 打开页面看到四区域布局, 分隔线可拖拽
- 芯片选择器显示9系列, 选择后左下角引脚列表更新
- 引脚列表带搜索, 切换芯片时跟着变

**预估:** 3轮 (约40个文件变更, 芯片数据+布局是基础, 不宜赶工)

> 📦 模板增量: 本阶段同步创建首批C51/STM32经典电路模板各3个, 共6个

---

### Phase 2: 连线交互 + 错误检测 + 可视化 (核心体验优先)

> ⚠️ 门下省意见: 核心体验优先于SVG图标, 连线交互先做

**目标:** 连线体验提升, 错误检测完善, 核心可视化效果到位

**具体任务:**
1. **连线交互升级**
   - 引脚旁增加○按钮: 点击开始连线 (修改 `WebGLCanvas.tsx`)
   - 拖入元件自动吸附: 新增 `autoSnapToNearestPin()` 函数
     - 检测拖入元件的所有端口, 找最近的芯片引脚
     - 自动创建连线 + 移动元件到合适位置
   - 正交走线已实现, 保持

2. **错误检测增强**
   - 未接引脚标红: `DiagnosticEngine` 增加 `floatingPin` 检测
     - 渲染时: 未连接的引脚显示红色圆点
   - 电源缺失芯片红框: `CircuitDRC` 增加 `missingPower` 检测
     - 芯片元件如果没有连接VDD/VSS, 显示红色边框警告
   - 错误面板集成到左栏底部

3. **核心可视化效果**
   - LED亮度随PWM: `VisualEffectsEngine` 增加LED发光效果
     - 读取连接LED的引脚PWM占空比 → 控制发光强度
   - 引脚电平颜色: 芯片引脚图中
     - 高电平=绿色, 低电平=灰色, 悬空=黄色, PWM=闪烁
   - 电流动画: `WireCurrentEffect.ts`
     - 沿连线方向的流动粒子, 速度∝电流大小
   - 滚轮灵敏度降低: `interaction.ts` 修改缩放系数

4. **Canvas 2D降级方案**
   - 保留 `canvas-renderer.ts` 作为WebGL不支持时的降级方案
   - `WebGLCanvas.tsx`: 启动时检测WebGL支持, 自动切换
   - 默认使用WebGL渲染, Canvas 2D仅作fallback

**验收标准:**
- 点击引脚旁○按钮开始连线, 正交走线
- 拖入LED到芯片附近, 自动吸附引脚并连线
- 未接引脚显示红色, 缺电源芯片显示红色边框
- LED亮度随PWM占空比变化
- 滚轮缩放比之前平缓

**预估:** 2轮 (约15个文件变更)

> 📦 模板增量: 本阶段同步创建STM32外设模板5个(ADC/PWM/SPI/I2C/UART)

---

### Phase 3: SVG图标体系 + 元件库升级 (可与Phase 2并行)

**目标:** 200+元件SVG图标, 按功能分类搜索 (不阻塞核心体验)

**具体任务:**
1. **SVG图标创建**
   - 按类别分子目录: `public/icons/components/{passive,display,input,actuator,sensor,communication,power,ic-digital,ic-analog,storage,connector,mcu-board}/`
   - 每个元件一个SVG文件, 尺寸统一 48x48
   - 风格: 简洁线条, 单色(当前主题色), 符合电子工程惯例
   - 优先级: 先做常用的50种, 再补齐到200+

2. **ComponentLibrary面板升级**
   - 从emoji切换到SVG图标 (`<img src={iconUrl}>`)
   - 按MEMORY.md的13大类分组: 无源/显示/输入/执行/传感器/通信/电源/驱动IC/逻辑IC/模拟IC/存储/接插件/MCU开发板
   - 搜索框: 按名称/类型模糊搜索
   - 拖拽到画布: 保留现有drag行为

3. **component-loader.ts扩展**
   - `COMPONENT_METAS` 从70+扩展到200+
   - 每个meta增加 `iconUrl` 字段
   - 按新分类体系组织

**验收标准:**
- 元件库面板显示SVG图标, 非emoji
- 13个分类tab可切换
- 搜索框输入"电阻"能找到所有电阻类元件
- 拖拽元件到画布正常工作

**预估:** 2轮 (图标创建可与Phase 2并行, 约30个文件变更)

> 📦 模板增量: 本阶段同步创建ESP32模板3个 + 经典项目模板3个

---

### Phase 4: 代码编辑器 + 文件管理 + 库函数

**目标:** 右栏IDE体验, 库函数搜索插入

**具体任务:**
1. **Monaco编辑器集成**
   - `CodeEditor.tsx`: 集成 `@monaco-editor/react`
   - 语法高亮: C/C++/Arduino
   - 自动补全: 基础关键字
   - 多文件tab管理

2. **FileExplorer面板**
   - `FileExplorer.tsx`: 虚拟文件系统 (localStorage)
   - 文件树: 新建/删除/重命名
   - 点击文件在CodeEditor中打开

3. **LibraryPanel (库函数速查)**
   - `LibraryPanel.tsx`: 搜索框 + 分类列表
   - `library-browser.ts`: 加载 `public/libraries/*.json`
   - STM32 HAL: `HAL_GPIO_WritePin()`, `HAL_UART_Transmit()` 等常用函数
   - Arduino: `digitalWrite()`, `Serial.begin()` 等
   - 51寄存器: `TMOD`, `SCON`, `TH0/TL0` 等
   - 点击函数 → 插入到代码编辑器当前光标位置

4. **pin-mapper.ts**
   - 引脚复用冲突检测
   - 选了一个功能, 冲突的自动禁用/标灰
   - 在引脚列表中显示当前配置的功能

**验收标准:**
- 右栏显示Monaco编辑器, C语法高亮
- 文件管理面板可新建/切换文件
- 库函数面板搜索"GPIO"能找到相关函数
- 点击函数自动插入代码
- 引脚选择UART TX后, 冲突的GPIO功能标灰

**预估:** 2轮 (约10个文件变更)

> 📦 模板增量: 本阶段同步创建传感器接口模板5个

---

### Phase 5: 串口/波形增强 + 代码示例扩展

**目标:** 底栏体验提升, 30+代码示例

**具体任务:**
1. **串口监视器增强**
   - `SerialMonitor.tsx`: 逐字弹出动画效果
     - 每个字符从上方弹入, 带打字机效果
   - 波特率显示, 时间戳
   - 清空/暂停/导出功能

2. **波形面板增强**
   - `WaveformPanel.tsx`: 实时示波器效果
     - 扫描线从左到右移动
     - 多通道叠加显示 (类似真实示波器)
   - 默认收起, 点击展开
   - 测量工具: 频率/幅值/占空比

3. **代码示例扩展 (30+)**
   - `examples.ts`: 从10个扩展到30+
   - 每个示例: 源代码 + 预解析操作序列 + 描述
   - 覆盖: 51(10个)/STM32(12个)/ESP32(10个)

**验收标准:**
- 串口监视器显示逐字打字机效果
- 波形面板扫描线移动效果
- 代码示例列表30+个, 按芯片系列分组

**预估:** 1轮 (约20个文件变更)

> 📦 模板增量: 补齐剩余模板至50+

---

### Phase 6: 打磨 + 性能 + 导出

**目标:** 整体体验优化, 桌面导出

**具体任务:**
1. **UI打磨**
   - 动画过渡: 面板展开/收起的平滑动画
   - 响应式: 小屏幕下自动折叠侧边栏
   - 错误提示: 友好的toast提示
   - Loading状态: 仿真运行时的进度指示

2. **性能优化**
   - 元件库虚拟滚动 (200+元件列表)
   - WebGL渲染优化: 大电路批量draw call
   - 仿真数据流式传输 (WebSocket)

3. **桌面导出**
   - `start.command` 脚本: 端口 8005(frontend)/8006(backend)
   - 一键启动前后端

4. **文档更新**
   - README.md 更新
   - 用户使用手册

**验收标准:**
- 200+元件列表滚动流畅
- 50+元件电路渲染60fps
- `./start.command` 一键启动
- UI整体风格统一(Silicone Float UI)

**预估:** 1轮 (约10个文件变更)

---

## 四、时间预估

| 阶段 | 内容 | 预估轮数 | 预估天数 |
|------|------|---------|---------|
| Phase 1 | 芯片数据+布局 | 3轮 | 4-5天 |
| Phase 2 | 连线+检测+可视化 | 2轮 | 3-4天 |
| Phase 3 | SVG图标+元件库 (可与P2并行) | 2轮 | 3-4天 |
| Phase 4 | 代码编辑器+库函数 | 2轮 | 2-3天 |
| Phase 5 | 串口波形+代码示例 | 1轮 | 1-2天 |
| Phase 6 | 打磨+导出 | 1轮 | 1-2天 |
| **合计** | | **11轮** | **14-20天** |

> 注: 轮数基于三省六部协作, 每轮含工部执行+礼部测试。
> Phase 2 和 Phase 3 可并行执行, 实际天数可缩短。
> 模板创建增量贯穿各Phase, 非集中在最后一轮。

---

## 五、风险点与应对

### 5.1 SVG图标工作量大 (高风险)
- **风险:** 200+ SVG图标创建耗时, 且需统一风格
- **应对:**
  - 分批创建, Phase 3 先做50个核心图标
  - 后续增量补齐, 不阻塞核心体验
  - 考虑使用开源图标库(如 Lucide)改造, 减少手工绘制

### 5.2 芯片数据准确性 (中风险)
- **风险:** 30+芯片的引脚/外设数据可能有错误
- **应对:**
  - 优先参考芯片Datasheet和官方文档
  - 每个芯片JSON提交后由礼部验证
  - 允许社区修正(开源后)

### 5.3 布局重做兼容性 (中风险)
- **风险:** 现有EditorPage有大量功能, 重做可能丢失
- **应对:**
  - 不删除EditorPage, 先在McuSimulator中重写
  - 逐步迁移功能, 确保每个功能点都有测试
  - 保留电路编辑模式的入口(作为高级模式)

### 5.4 Monaco编辑器包体积 (低风险)
- **风险:** Monaco编辑器较大(~10MB), 影响加载速度
- **应对:**
  - 使用 `@monaco-editor/react` 的懒加载
  - 按需加载语言包
  - 考虑CodeMirror作为轻量备选

### 5.5 WebGL兼容性 (低风险)
- **风险:** 部分设备不支持WebGL
- **应对:**
  - 保留Canvas 2D作为降级方案 (`canvas-renderer.ts` 不删除)
  - 启动时检测WebGL支持, 自动切换

### 5.6 后端扩展芯片型号 (低风险)
- **风险:** 后端MCU引擎只支持3个预设
- **应对:**
  - 后端MCU引擎是通用架构, 新增预设只需添加配置
  - 不需要改动核心仿真逻辑

---

## 六、执行优先级

如果时间紧迫, 按以下优先级执行:

1. **P0 (必须):** Phase 1 (芯片数据+布局) — 这是所有后续工作的基础
2. **P1 (重要):** Phase 2 (连线+检测+可视化) — 核心体验差异化
3. **P2 (需要):** Phase 3 (SVG图标) — 可部分延后, 先用emoji过渡, 与P2并行
4. **P3 (需要):** Phase 4 (代码编辑器+库函数) — MCU平台关键能力
5. **P4 (锦上添花):** Phase 5 (串口波形+示例) — 可持续增量
6. **P5 (收尾):** Phase 6 (打磨+导出)

---

## 七、复用策略总结

| 现有代码 | 复用方式 |
|----------|----------|
| `circuit-store.ts` (1800行) | 保留核心, 增加芯片/引脚/库函数状态字段 |
| `webgl-renderer.ts` (800行) | 保留, 增加芯片引脚图渲染通道 |
| `canvas-renderer.ts` | **保留为Canvas 2D降级方案, 不删除** |
| `AnimationEngine.ts` | 保留, 增加LED发光/电流动画类型 |
| `ThemeSystem.ts` | 保留, 增加芯片引脚电平颜色token |
| 全部后端Go代码 | 保留, 仅扩展MCU预设配置 |
| `component-loader.ts` | 保留, 扩展meta到200+ |
| `wire-routing.ts` + `SmartRouter.ts` | 保留, 增加自动吸附逻辑 |
| `DiagnosticEngine.ts` | 保留, 增加floatingPin/missingPower检测 |
| `ProjectManager.ts` | 保留, 无改动 |
| 全部 `ui/*` 组件 | 保留, 无改动 |
| 全部测试文件 | 保留, 随功能扩展补充测试 |
| `MCUSimulator.ts` | 保留, 扩展预设到9系列 |
| `code-parser.ts` | 保留, 扩展更多外设操作识别 |

**删除:**
- `CircuitCanvas.tsx` — 旧画布组件, 被WebGLCanvas替代
- `CircuitCanvas.css` — 对应样式
- `EditorPage.tsx` — 旧布局, 合并到一体化

**不删除:**
- `canvas-renderer.ts` — 保留为Canvas 2D降级方案

---

## 八、模板增量策略

模板不再集中在最后一轮, 而是增量贯穿各Phase:

| Phase | 增加模板 | 累计 |
|-------|---------|------|
| Phase 1 | C51经典3个 + STM32经典3个 | 17+6 = 23 |
| Phase 2 | STM32外设5个(ADC/PWM/SPI/I2C/UART) | 23+5 = 28 |
| Phase 3 | ESP32 3个 + 经典项目3个 | 28+6 = 34 |
| Phase 4 | 传感器接口5个 | 34+5 = 39 |
| Phase 5 | 补齐至50+ | 39+11 = 50 |
| Phase 6 | 无新增 (打磨) | 50 |

---

## 九、三省六部协作流程

每个Phase按以下流程执行:

```
中书省(起草方案) → 门下省(审议) → 尚书省(派发)
  → 工部(编码实现) → 礼部(测试验证) → 中书省(验收回奏)
```

- Phase 2-3 可并行: 工部A做连线交互, 工部B做SVG图标
- 模板创建分散在各Phase中, 由各Phase的工部顺带完成
- Phase 4-5 可部分并行: 工部做Monaco集成, 同时另一工部做串口/波形
