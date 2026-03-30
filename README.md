# Chip Sim · 嵌入式芯片仿真 Web 平台

> 在线电路设计、仿真与波形分析平台

## 项目结构

```
chip-sim/
├── frontend/          # React + TypeScript + Vite 前端
│   ├── src/
│   │   ├── components/      # 通用组件
│   │   ├── features/        # 业务功能模块
│   │   │   ├── editor/      # 电路编辑器
│   │   │   ├── simulator/   # 仿真控制
│   │   │   └── waveform/    # 波形显示
│   │   ├── lib/             # 核心库
│   │   │   ├── circuit/     # 电路模型
│   │   │   ├── simulation/  # 仿真客户端
│   │   │   └── rendering/   # Canvas 渲染
│   │   ├── hooks/           # React Hooks
│   │   ├── stores/          # Zustand 状态管理
│   │   ├── templates/       # 电路模板数据（13个预置模板）
│   │   ├── types/           # TypeScript 类型
│   │   └── utils/           # 工具函数
│   └── package.json
├── backend/           # Go 后端服务
│   ├── cmd/server/          # 服务入口
│   ├── internal/
│   │   ├── engine/          # 仿真引擎
│   │   ├── handler/         # 业务处理器
│   │   │   ├── simulation.go    # 仿真 WebSocket 处理
│   │   │   ├── simulation_api.go # 仿真 REST API
│   │   │   └── examples.go      # 示例电路库 API
│   │   └── ws/              # WebSocket 处理
│   ├── pkg/types/           # 类型定义
│   ├── go.mod
│   └── Makefile
└── .github/workflows/ # CI/CD 配置
```

## 快速开始

### 前端

```bash
cd frontend
npm install
npm run dev
```

### 后端

```bash
cd backend
make run
```

### WebSocket 端点

- WebSocket: `ws://localhost:8080/ws`
- Health: `http://localhost:8080/health`
- API Info: `http://localhost:8080/api/info`

### REST API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/simulation/ac-sweep` | POST | AC 频率扫描分析 |
| `/api/simulation/transient` | POST | 瞬态分析 |
| `/api/examples` | GET | 示例电路列表（支持 `?category=basic` 过滤） |
| `/api/examples/categories` | GET | 电路分类列表 |
| `/api/examples/{id}` | GET | 单个示例电路详情 |

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript + Vite |
| 状态管理 | Zustand |
| 渲染 | Canvas 2D（Phase 1）→ WebGL（Phase 2） |
| 后端 | Go + gorilla/websocket |
| 仿真引擎 | 自研 MNA 求解器 |
| CI/CD | GitHub Actions |

## 新手引导系统

ChipSim 内置完整的新手引导和电路搭建向导系统，大幅降低学习门槛。

### 功能模块

#### 1. 交互式新手引导 (Welcome Tour)
- 首次打开编辑器自动启动分步引导
- 高亮提示关键 UI 元素（元件面板、画布、属性面板、仿真按钮）
- 支持键盘导航（← → Esc）和鼠标点击
- 可随时跳过、可从帮助菜单重放
- 进度条可视化当前进度

#### 2. 电路搭建向导 (Circuit Wizard)
- "快速创建"按钮打开模板选择对话框
- 按类别浏览模板：基础电路、传感器应用、逻辑电路、电源电路
- 每个模板包含预置元件 + 连线 + 说明
- 双击或点击"加载模板"一键加载到画布
- 支持空白电路创建

#### 3. 内嵌帮助系统 (Help Panel)
- 右侧面板包含"属性"和"帮助"两个 Tab
- 选中元件时自动显示元件详细文档
- 包含：元件描述、典型用法、接线提示、常见错误警示
- 电路检查面板显示验证结果和修复建议
- 可一键重放新手引导

#### 4. 示例电路库 (Example Library)
- LED 闪烁电路 — 学习限流电阻计算
- 分压器 — 理解欧姆定律和分压公式
- RC 滤波器 — 观察频率响应
- 与门逻辑 — 理解布尔运算
- 555 定时器 — 学习 RC 充放电和方波生成
- 运放反相放大器 — 掌握负反馈放大原理
- 三极管开关 — 理解 BJT 开关工作模式
- NAND SR 锁存器 — 学习交叉反馈时序逻辑
- MCU GPIO 驱动 LED — 嵌入式接口设计
- I2C 传感器接口 — 通信协议与上拉电阻
- UART 串口通信 — 异步通信帧格式
- H 桥电机驱动 — MOSFET 功率驱动与 PWM 调速
- 差分放大器 — 共模抑制与仪表前端
- 每个示例包含电路图 + 仿真说明 + 学习要点 + 关键参数
- 按类别浏览：基础电路、模拟电路、数字电路、嵌入式电路、电源电路
- 支持搜索和一键加载到画布

#### 5. 多语言支持
- 完整的中英文国际化支持
- 所有引导文本、帮助文档、模板说明均可切换语言

### 目录结构

```
frontend/src/
├── components/
│   ├── Tutorial/          # 新手引导组件
│   │   ├── WelcomeTour.tsx    # 分步引导 UI
│   │   ├── tour-steps.ts      # 引导步骤定义
│   │   └── useTour.ts         # 引导状态 Hook
│   ├── Wizard/            # 电路搭建向导
│   │   └── CircuitWizard.tsx  # 模板选择对话框
│   └── HelpPanel/         # 帮助系统
│       ├── HelpPanel.tsx      # 帮助面板主组件
│       ├── ComponentHelp.tsx  # 元件详细帮助
│       ├── ErrorHints.tsx     # 错误提示+修复建议
│       └── ExampleLibrary.tsx # 示例电路库
├── templates/
│   ├── template-data.ts       # 模板数据（TypeScript）— 13个预置电路
│   ├── led-circuit.json       # LED 电路模板
│   ├── voltage-divider.json   # 分压器模板
│   ├── rc-filter.json         # RC 滤波器模板
│   ├── and-gate.json          # 与门逻辑模板
│   ├── timer555.json          # 555 定时器模板
│   ├── opamp-inverting.json   # 运放反相放大器
│   ├── bjt-switch.json        # 三极管开关
│   ├── nand-sr-latch.json     # NAND SR 锁存器
│   ├── mcu-gpio-led.json      # MCU GPIO LED
│   ├── i2c-sensor.json        # I2C 传感器接口
│   └── uart-comm.json         # UART 串口通信
└── i18n/
    └── translations.ts        # 中英文翻译
```

## SPICE 网表支持

ChipSim 支持标准 SPICE 网表格式的导入和导出，实现与其他 EDA 工具的电路数据互通。

### 支持的 SPICE 元件

| SPICE 前缀 | 元件类型 | chip-sim 类型 | 示例 |
|-------------|---------|---------------|------|
| R | 电阻 | resistor | `R1 1 0 10k` |
| C | 电容 | capacitor | `C1 1 0 1u` |
| L | 电感 | inductor | `L1 1 0 1m` |
| D | 二极管 | diode | `D1 1 0 D1N4148` |
| V | 电压源 | voltage_source | `V1 1 0 DC 5` |
| I | 电流源 | current_source | `I1 1 0 DC 1m` |
| Q | 三极管 (BJT) | bjt_npn/bjt_pnp | `Q1 out in 0 NPN` |
| MOSFET | 场效应管 | mosfet_nmos/mosfet_pmos | `M1 out in 0 0 NMOS` |

### 支持的分析命令

| SPICE 命令 | 分析类型 | 说明 |
|------------|---------|------|
| `.OP` | 直流工作点 | 无参数直流分析 |
| `.DC` | 直流扫描 | `.DC V1 0 10 0.1` |
| `.AC` | 交流分析 | `.AC DEC 10 1 1MEG` |
| `.TRAN` | 瞬态分析 | `.TRAN 1u 1m` |

### API 端点

#### 导入 SPICE 网表
```
POST /api/spice/import
Content-Type: text/plain (或 multipart/form-data)

# 请求体为 SPICE 网表文本
```

**响应：**
```json
{
  "success": true,
  "circuit": {
    "id": "spice-import-...",
    "name": "Circuit Title",
    "components": [...],
    "nodes": [...]
  },
  "warnings": []
}
```

#### 导出为 SPICE 网表
```
POST /api/spice/export
Content-Type: application/json

{
  "name": "My Circuit",
  "components": [...],
  "nodes": [...]
}
```

**响应：**
```json
{
  "success": true,
  "netlist": "My Circuit\nR1 1 0 10k\n..."
}
```

#### 下载 .cir 文件
```
POST /api/spice/export-file
```
同 `/api/spice/export`，但直接返回 `.cir` 文件下载。

### 后端目录结构

```
backend/internal/spice/
├── mapping.go       # 元件映射表、节点映射、SPICE 前缀/单位映射
├── parser.go        # SPICE 网表解析器（支持续行、注释、子电路）
├── exporter.go      # SPICE 网表导出器
└── spice_test.go    # 单元测试（15 个测试用例）

backend/internal/handler/
├── spice.go         # SPICE 导入导出 HTTP 处理器
└── spice_convert.go # ParseResult ↔ 前端 JSON 格式转换
```

### 使用示例

**导入 SPICE 网表：**
```bash
curl -X POST http://localhost:8080/api/spice/import \
  -H "Content-Type: text/plain" \
  -d $'RC Filter\nR1 1 0 10k\nC1 1 0 1u\nV1 1 0 AC 1\n.AC DEC 10 1 1MEG\n.END'
```

**导出 SPICE 网表：**
```bash
curl -X POST http://localhost:8080/api/spice/export \
  -H "Content-Type: application/json" \
  -d '{"name":"My Circuit","components":[{"id":"comp_1","type":"resistor","name":"R1","value":{"value":10000,"prefix":"k"},"ports":[{"id":"p1","nodeId":"node_1"},{"id":"p2","nodeId":"node_gnd"}]}],"nodes":[{"id":"node_1","name":"1","type":"normal"},{"id":"node_gnd","name":"0","type":"ground"}]}'
```

### 注意事项

- SPICE 节点 `0` 和 `GND`/`gnd` 自动映射为地节点
- 子电路实例 (`X` 前缀) 解析时会记录警告但暂不展开
- `MEG` 后缀表示兆（10⁶），与其他 SPICE 仿真器兼容
- 导出时自动选择合适的 SI 前缀

## 半导体器件模型库

ChipSim 支持丰富的半导体器件模型，覆盖从基础二极管到高级功率器件。

### 支持的半导体器件

| 器件类型 | 端口 | 模型 | 说明 |
|---------|------|------|------|
| 二极管 (Diode) | A, K | 分段线性 | 正向压降 0.7V，可配置 |
| NPN/PNP 三极管 (BJT) | B, C, E | Ebers-Moll 简化模型 | β 可配置 |
| NMOS/PMOS | G, D, S | Shichman-Hodges 模型 | 支持 Kp、Vth、λ 参数 |
| N-JFET/P-JFET | G, D, S | Shockley 模型 | Idss、Vp 可配置 |
| IGBT | G, C, E | 混合 MOSFET+BJT | 高 β 增益模型 |
| 达林顿管 (Darlington) | B, C, E | 超级 β BJT | β 默认 1000 |
| LDO 稳压器 | Vin, Vout, GND | 三端稳压简化模型 | 支持压差、输出阻抗 |
| 运放 (Op-Amp) | +, -, Out | 理想运放 | 虚短约束 |
| DC-DC (Buck/Boost) | Vin, Vout, GND | 开关简化模型 | 效率、纹波参数 |

### MOSFET 模型参数

| 参数 | 含义 | 默认值 |
|------|------|--------|
| Kp (value) | 跨导参数 (mA/V²) | 1 |
| Vth | 阈值电压 (V) | 1.0 (NMOS) / -1.0 (PMOS) |
| λ | 沟道长度调制 (1/V) | 0.02 |

### 仿真支持

- **直流工作点分析**: 所有半导体器件支持 MNA 矩阵 stamp
- **Shichman-Hodges I-V 特性**: 截止区、线性区、饱和区建模
- **SPICE 网表导出**: MOSFET (M前缀)、JFET (J前缀)、BJT (Q前缀) 自动转换

### 示例电路

- **NMOS 共源放大器**: Vdd→Rd→M1漏极，Rg1/Rg2分压偏置，Rs源极退化
- **三极管开关电路**: GPIO→Rbase→Q1基极，Vcc→Rload→Q1集电极
- **运放反相放大器**: Vin→R1→运放(-)，运放输出→R2→运放(-) 反馈

## License

Proprietary
