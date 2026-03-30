# chip-sim MCU 仿真平台 · 实施规划

## 一、产品定位

嵌入式单片机在线仿真平台，支持 C51、STM32、ESP32 系列。
目标用户：学生/初学者、硬件工程师、嵌入式开发者。

## 二、芯片型号策略（数据驱动）

每个芯片型号一个 JSON 文件，位于 `chips/` 目录。

```
chips/
├── c51/
│   ├── stc89c52rc.json
│   └── stc12c5a60s2.json
├── stm32/
│   ├── stm32f103c8t6.json
│   ├── stm32f103rct6.json
│   └── stm32f103vet6.json
└── esp32/
    ├── esp32-wroom-32.json
    ├── esp32-s3.json
    └── esp32-c3.json
```

### JSON 结构示例（stm32f103c8t6.json）
```json
{
  "series": "STM32F103",
  "name": "STM32F103C8T6",
  "package": "LQFP48",
  "flash": 65536,
  "ram": 20480,
  "clock": 72000000,
  "pinCount": 48,
  "pins": [
    {"id": "PA0",  "port": "A", "bit": 0,  "adc": true, "tim": "TIM2_CH1"},
    {"id": "PA9",  "port": "A", "bit": 9,  "usart": "USART1_TX"},
    {"id": "PA10", "port": "A", "bit": 10, "usart": "USART1_RX"},
    {"id": "PB6",  "port": "B", "bit": 6,  "i2c": "I2C1_SCL"},
    {"id": "PB7",  "port": "B", "bit": 7,  "i2c": "I2C1_SDA"}
  ],
  "peripherals": {
    "GPIO":  {"ports": ["A","B","C"]},
    "USART": [{"name":"USART1"}, {"name":"USART2"}],
    "SPI":   [{"name":"SPI1"}],
    "I2C":   [{"name":"I2C1"}],
    "ADC":   {"channels": 10, "resolution": 12},
    "TIM":   [{"name":"TIM1","ch":4}, {"name":"TIM2","ch":4}]
  }
}
```

## 三、UI 设计体系

参考 Silicone Float UI（ciliconefloatui.netlify.app）的 CSS 变量体系，React 组件重写。
该网站提供完整的 CSS 变量（--sil-*）、阴影系统、配色方案（薄荷绿/海洋蓝/蜜桃橙）。
不使用 npm 包，而是提取其 CSS 变量到 variables.css 中，用 React 重新实现各组件。

## 四、重构策略（渐进式，非删除重写）

保留可复用的核心代码，在其上增量改造：

| 保留文件 | 改动 |
|----------|------|
| `circuit-store.ts`（1854行） | 保留核心逻辑，扩展 MCU 相关状态 |
| `webgl-renderer.ts`（827行） | 保留，增量改造支持芯片引脚图渲染 |
| `webgl-utils.ts` + `shaders.ts` | 保留 |
| `ws-client.ts` / `SimulationBridge.tsx` | 保留 |
| 全部后端 Go 代码 | 保留 |
| 全部测试文件 | 保留 |
| `behavior-models.ts` + 元件模型 | 保留 |

| 重写文件 | 说明 |
|----------|------|
| `EditorPage.tsx` | 页面布局用新 UI 组件重写 |
| `CircuitCanvas.tsx` | 改为 WebGL-only 画布 |
| `canvas-renderer.ts` | 删除（Canvas 2D 不再使用） |
| `WaveformPanel.tsx` | 用新 UI 组件重写，默认收起 |

| 新建目录 | 说明 |
|----------|------|
| `ui/` | Silicone Float UI React 组件 |
| `mcu/` | 芯片配置加载、外设模型、代码解析 |
| `canvas/` | WebGL 画布交互层 |
| `panels/` | 右侧面板组件 |
| `pages/` | 主页面布局 |
| `public/chips/` | 芯片 JSON 配置文件 |

## 五、代码解析（V1 限定）

V1 只支持**预设示例代码模板**，不支持用户自由编写 C 代码。
- 内置 10-15 个经典示例（LED流水灯、按键检测、串口通信、定时器中断等）
- 每个示例包含：源代码 + 外设操作序列（预解析好的）
- 用户选择示例后直接运行仿真
- 自定义代码解析放到 V2

## 四、需要新建的文件

### 4.1 UI 基础层（Silicone Float UI React 版）

| 文件 | 说明 |
|------|------|
| `frontend/src/ui/variables.css` | CSS 变量体系（--sil-* 全部变量 + 暗色主题） |
| `frontend/src/ui/Button.tsx` | 按钮组件（primary/secondary/ghost/danger） |
| `frontend/src/ui/Card.tsx` | 卡片组件 |
| `frontend/src/ui/Panel.tsx` | 面板组件 |
| `frontend/src/ui/Input.tsx` | 输入框 |
| `frontend/src/ui/Dropdown.tsx` | 下拉选择 |
| `frontend/src/ui/Tabs.tsx` | 标签页 |
| `frontend/src/ui/Segmented.tsx` | 分段控制器 |
| `frontend/src/ui/Toggle.tsx` | 开关 |
| `frontend/src/ui/Modal.tsx` | 弹窗 |
| `frontend/src/ui/Toast.tsx` | 通知 |
| `frontend/src/ui/Table.tsx` | 表格 |
| `frontend/src/ui/Metric.tsx` | 指标卡片 |
| `frontend/src/ui/Badge.tsx` | 徽章 |
| `frontend/src/ui/Progress.tsx` | 进度条 |
| `frontend/src/ui/index.ts` | 统一导出 |

### 4.2 芯片和元件层

| 文件 | 说明 |
|------|------|
| `frontend/src/mcu/chip-loader.ts` | 加载芯片 JSON 配置 |
| `frontend/src/mcu/chip-renderer.ts` | WebGL 渲染芯片引脚图 |
| `frontend/src/mcu/peripheral-models.ts` | 外设行为模型（GPIO/UART/SPI/I2C/ADC/Timer） |
| `frontend/src/mcu/code-parser.ts` | C 代码解析器（识别外设操作） |
| `frontend/src/mcu/pin-mapper.ts` | 引脚复用映射和约束 |
| `frontend/src/components/ChipSelector.tsx` | 芯片选择器（系列→型号→封装） |
| `frontend/src/components/ComponentLibrary.tsx` | 元件库面板（按类别分组） |

### 4.3 页面和画布

| 文件 | 说明 |
|------|------|
| `frontend/src/pages/MainPage.tsx` | 主页面布局 |
| `frontend/src/canvas/WebGLCanvas.tsx` | WebGL 画布（唯一渲染层） |
| `frontend/src/canvas/interaction.ts` | 交互逻辑（平移/缩放/点击/拖拽/连线） |
| `frontend/src/canvas/grid-renderer.ts` | 网格渲染 |
| `frontend/src/canvas/component-renderer.ts` | 元件符号 WebGL 渲染 |
| `frontend/src/canvas/wire-renderer.ts` | 连线 WebGL 渲染 |
| `frontend/src/canvas/chip-renderer.ts` | 芯片封装 WebGL 渲染 |

### 4.4 面板

| 文件 | 说明 |
|------|------|
| `frontend/src/panels/PropertyPanel.tsx` | 右侧属性面板（点击元件显示参数） |
| `frontend/src/panels/CodeEditor.tsx` | 代码编辑器面板 |
| `frontend/src/panels/RegisterPanel.tsx` | 外设寄存器面板 |
| `frontend/src/panels/PinPanel.tsx` | 引脚状态面板 |
| `frontend/src/panels/WaveformPanel.tsx` | 波形面板（默认收起） |
| `frontend/src/panels/SerialMonitor.tsx` | 串口监视器 |

### 4.5 芯片配置文件

| 文件 | 说明 |
|------|------|
| `frontend/public/chips/c51/stc89c52rc.json` | STC89C52RC 配置 |
| `frontend/public/chips/stm32/stm32f103c8t6.json` | STM32F103C8T6 配置 |
| `frontend/public/chips/esp32/esp32-wroom-32.json` | ESP32-WROOM-32 配置 |

## 五、分阶段实施

### Phase 1：UI 基础搭建 + 主页面布局（约3轮）

**目标：** 用 Silicone Float UI 风格搭建主页面框架

**具体任务：**
1. 创建 `variables.css`，移植 Silicone Float UI 全部 CSS 变量
2. 实现 8 个核心 UI 组件：Button、Panel、Input、Dropdown、Tabs、Segmented、Modal、Toast
3. 实现 MainPage 布局（顶部导航 + 左侧面板 + 中间画布 + 右侧面板）
4. 实现 ChipSelector（芯片系列→型号选择下拉）
5. 暗色主题支持

**验收：** 页面打开能看到新 UI 风格的布局，芯片选择器可用

### Phase 2：WebGL 画布 + 交互（约3轮）

**目标：** 全新 WebGL 画布，实现指定交互

**具体任务：**
1. 删除 Canvas 2D 渲染器
2. 创建 WebGL 画布（基于现有 webgl-renderer.ts 改造）
3. 实现网格渲染
4. 实现交互逻辑：
   - 默认手型：拖拽=平移画布，滚轮=缩放
   - 点击元件 → 右侧面板显示参数
   - 拖拽元件 → 移动位置
   - 右键元件 → 弹出菜单
   - 点击引脚拖拽 → 画连线
   - 双击元件 → 编辑弹窗
5. 元件符号 WebGL 渲染（电阻/电容/LED/按键等）

**验收：** 能在画布上拖拽平移，放置元件，点击显示参数

### Phase 3：芯片系统 + 外设模型（约3轮）

**目标：** 加载芯片配置，实现外设行为仿真

**具体任务：**
1. 创建芯片 JSON 配置格式和首批配置文件
2. chip-loader 加载芯片配置
3. 芯片引脚图渲染（根据 pinCount 自动布局）
4. 外设行为模型：GPIO（高低电平）、UART（发送/接收）、Timer（计数/PWM）
5. 引脚复用约束（选了一个功能，冲突的自动禁用）

**验收：** 选择 STM32F103C8T6，看到 48 脚芯片图，GPIO/UART 可配置

### Phase 4：代码解析 + 仿真驱动（约2轮）

**目标：** 用户粘贴 C 代码，平台解析并驱动仿真

**具体任务：**
1. code-parser 识别常见外设操作：
   - C51: `P1 = 0xFF;`, `TMOD = 0x01;`, `SCON = 0x50;`
   - STM32: `HAL_GPIO_WritePin()`, `HAL_UART_Transmit()`, `HAL_TIM_PWM_Start()`
   - ESP32: `digitalWrite()`, `Serial.begin()`, `ledcWrite()`
2. 解析结果 → 外设操作序列 → 驱动行为模型
3. 代码编辑器面板（带语法高亮）
4. 寄存器面板实时显示外设状态

**验收：** 粘贴 LED 流水灯代码，画布上 LED 按代码逻辑闪烁

### Phase 5：右侧面板 + 波形 + 串口（约2轮）

**目标：** 完善右侧面板和辅助功能

**具体任务：**
1. PropertyPanel：点击元件显示名称/值/引脚/描述
2. PinPanel：显示每个引脚的当前状态（高/低/模拟值）
3. WaveformPanel：默认收起，展开后显示信号波形
4. SerialMonitor：显示 UART 输出
5. 元件库面板：按类别分组（输入/输出/传感器/通信/电源）

**验收：** 点击元件右侧面板显示信息，串口能看到 UART 输出

### Phase 6：桌面导出 + 打磨（约1轮）

**具体任务：**
1. 导出到桌面 start.command（端口 8005/8006）
2. 整体 UI 打磨（动画、过渡、响应式）
3. 错误处理和边界情况
4. README 更新

## 六、技术栈确认

| 层级 | 技术 |
|------|------|
| UI 框架 | React 18 + TypeScript |
| 构建 | Vite |
| UI 风格 | Silicone Float UI（CSS 变量 + React 组件重写） |
| 渲染 | WebGL（唯一） |
| 状态管理 | Zustand |
| 后端 | Go + gorilla/websocket |
| 芯片配置 | JSON 文件 |
