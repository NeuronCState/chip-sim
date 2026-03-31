# ChipSim · MCU 仿真平台

> 桌面端嵌入式芯片在线仿真平台 — 电路设计、代码编辑、编译、仿真一体化

[![Build ChipSim](https://github.com/NeuronCState/chip-sim/actions/workflows/build.yml/badge.svg)](https://github.com/NeuronCState/chip-sim/actions/workflows/build.yml)
[![Latest Release](https://img.shields.io/github/v/release/NeuronCState/chip-sim?color=green&label=Latest%20Release)](https://github.com/NeuronCState/chip-sim/releases/latest)
[![License](https://img.shields.io/badge/License-Proprietary-blue)](#)

## 功能

- **多阶段项目向导** — 选择芯片系列/型号/输入工程名，一键创建项目
- **电路画布** — Canvas 2D 渲染，元件库，正交连线，拖拽布局，自动吸附
- **代码编辑器** — Monaco Editor，C 语法高亮，各芯片系列示例代码，Ctrl+S 本地保存
- **在线编译** — 调用本地编译器（SDCC/ARM-GCC），点击运行即编译
- **QEMU 指令级仿真** — STM32 真实二进制执行，GPIO/UART 实时监控
- **MCU 行为仿真** — LED 亮度/闪烁、电机旋转、蜂鸣器震动、电流动画
- **串口监视器** — 实时 UART 输出，逐字动画
- **元件属性面板** — 点击元件查看参数、引脚连接、实时仿真状态
- **电路模板** — 预设电路一键加载（LED闪烁/按键控制/串口通信/OLED/电机驱动等）
- **项目持久化** — 自动保存电路结构到 localStorage
- **打开已有工程** — 支持导入本地文件夹中的代码文件

## 芯片支持

| 系列 | 型号 | 编译器 | QEMU 仿真 |
|------|------|--------|-----------|
| STM32 | F103, F407, F411, F429, H743, G431, L476, WL55 | arm-none-eabi-gcc | 支持 |
| C51 | STC89C52, STC12C5A, STC15W, AT89S52, AT89C51 | SDCC | 行为仿真 |
| ESP32 | ESP32, S2, S3, C3, C6, ESP8266 | xtensa-gcc | 行为仿真 |
| Arduino | Uno, Mega, Nano, Leonardo, Due | avr-gcc | 行为仿真 |

## 项目结构

```
chip-sim/
├── frontend/                  # React + TypeScript + Vite 前端
│   ├── src/
│   │   ├── canvas/            # Canvas 2D 电路画布 + 元件渲染
│   │   ├── components/        # 通用组件（SetupWizard/PinList/HelpPanel）
│   │   ├── core/              # 仿真引擎、组件行为、信号总线
│   │   │   └── simulation/    # MCUSim / SimulationEngine / SignalBus
│   │   ├── features/          # 编辑器、仿真控制、波形
│   │   ├── lib/
│   │   │   ├── compiler-api.ts   # 编译器 IPC（Tauri）
│   │   │   └── qemu/             # QEMU WebSocket 客户端
│   │   │       ├── client.ts     # WebSocket 连接管理
│   │   │       ├── events.ts     # GPIO/UART/State 事件类型
│   │   │       └── adapter.ts    # 事件→画布状态适配器
│   │   ├── mcu/               # MCU 仿真模块（时钟/中断/定时器/代码解析）
│   │   ├── pages/             # McuSimulator 仿真页面
│   │   ├── panels/            # CodeEditor / SerialMonitor
│   │   └── utils/             # 芯片加载器、文件系统工具
│   └── src-tauri/             # Tauri 桌面应用（Rust）
│       └── src/
│           ├── lib.rs         # 入口
│           └── compiler.rs    # 编译器调用（SDCC/ARM-GCC/AVR-GCC）
├── backend/                   # Go 后端
│   ├── cmd/server/            # HTTP + WebSocket 服务入口
│   ├── internal/
│   │   ├── engine/            # 电路仿真引擎 + MCU 仿真
│   │   ├── handler/           # WebSocket + REST API 处理器
│   │   ├── qemu/              # QEMU 仿真管理
│   │   │   ├── manager.go     # QEMU 进程生命周期管理
│   │   │   ├── gdb.go         # GDB RSP 客户端（寄存器监控）
│   │   │   ├── uart.go        # UART TCP 捕获
│   │   │   ├── stm32.go       # STM32 寄存器地址映射
│   │   │   └── events.go      # 事件类型定义
│   │   ├── spice/             # SPICE 网表解析/导出
│   │   └── ws/                # WebSocket 连接管理
│   └── pkg/types/
└── .github/workflows/
    ├── build.yml              # Tauri 多平台构建（macOS/Windows/Linux）
    └── ci.yml                 # 前端测试 + 构建，后端测试 + 构建
```

## 快速开始

### 浏览器开发

```bash
cd frontend
npm install
npm run dev          # http://localhost:8005
```

### 桌面应用开发

```bash
cd frontend
npm run tauri:dev    # 启动 Tauri 开发模式
```

### 构建桌面安装包

```bash
cd frontend
npm run tauri:build  # 输出: src-tauri/target/release/bundle/
```

### 后端服务

```bash
cd backend
make run             # WebSocket: ws://localhost:8080/ws
```

### QEMU 仿真（STM32）

需要安装 QEMU：
```bash
brew install qemu    # macOS
```

后端启动后，前端通过 WebSocket 连接 `/ws/qemu`，发送 `start` 命令加载 ELF 固件即可开始 QEMU 指令级仿真。

## 编译器安装

| 编译器 | 安装命令 | 用途 |
|--------|---------|------|
| SDCC | `brew install sdcc` | C51 系列 |
| ARM GCC | `brew install arm-none-eabi-gcc` | STM32 系列 |
| AVR GCC | `brew install avr-gcc` | Arduino |
| QEMU | `brew install qemu` | STM32 指令级仿真 |

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + Vite |
| 代码编辑 | Monaco Editor |
| 渲染 | Canvas 2D |
| 状态管理 | Zustand + useRef |
| 桌面框架 | Tauri 2 (Rust) |
| 后端 | Go + gorilla/websocket |
| 仿真 | 自研行为仿真 + QEMU 指令级仿真 |
| CI/CD | GitHub Actions（4 平台自动构建） |

## License

Proprietary
