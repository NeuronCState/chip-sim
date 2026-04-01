# ChipSim · MCU 仿真平台

> 桌面端嵌入式芯片在线仿真平台 — 电路设计、代码编辑、编译、仿真一体化
注意！当前版本有无法正常使用的问题，正在积极修复，建议不要尝试下载使用
[![Build ChipSim](https://github.com/NeuronCState/chip-sim/actions/workflows/build.yml/badge.svg)](https://github.com/NeuronCState/chip-sim/actions/workflows/build.yml)
[![Latest Release](https://img.shields.io/github/v/release/NeuronCState/chip-sim?color=green&label=Latest%20Release)](https://github.com/NeuronCState/chip-sim/releases/latest)
[![License](https://img.shields.io/badge/License-Proprietary-blue)](#)

## 下载

| 平台 | 下载 |
|------|------|
| macOS (Apple Silicon) | [ChipSim_0.2.0_aarch64.dmg](https://github.com/NeuronCState/chip-sim/releases/latest/download/ChipSim_0.2.0_aarch64.dmg) |
| macOS (Intel) | [ChipSim_0.2.0_x64.dmg](https://github.com/NeuronCState/chip-sim/releases/latest/download/ChipSim_0.2.0_x64.dmg) |
| Windows x64 | [ChipSim_0.2.0_x64-setup.exe](https://github.com/NeuronCState/chip-sim/releases/latest/download/ChipSim_0.2.0_x64-setup.exe) |
| Linux x64 | [.deb](https://github.com/NeuronCState/chip-sim/releases/latest/download/ChipSim_0.2.0_amd64.deb) \| [.AppImage](https://github.com/NeuronCState/chip-sim/releases/latest/download/ChipSim_0.2.0_amd64.AppImage) |

安装后即可使用，无需额外安装编译器或 QEMU。

## 功能

- **多阶段项目向导** — 选择芯片系列/型号/输入工程名，一键创建项目
- **电路画布** — Canvas 2D 渲染，元件库，正交连线，拖拽布局，自动吸附
- **代码编辑器** — Monaco Editor，C 语法高亮，各芯片系列示例代码，Ctrl+S 本地保存
- **在线编译** — 调用本地编译器（SDCC/ARM-GCC/AVR-GCC）
- **QEMU 指令级仿真** — 真实二进制执行，GPIO/UART 实时监控，事件驱动画布动画
- **MCU 行为仿真** — LED 亮度/闪烁、电机旋转、蜂鸣器震动、电流动画
- **串口监视器** — 实时 UART 输出，逐字动画
- **元件属性面板** — 点击元件查看参数、引脚连接、实时仿真状态
- **电路模板** — 预设电路一键加载（LED闪烁/按键控制/串口通信/OLED/电机驱动等）
- **项目持久化** — 自动保存电路结构
- **打开已有工程** — 支持导入本地文件夹中的代码文件

## 芯片支持

| 系列 | 型号 | 编译器 | QEMU 仿真 |
|------|------|--------|-----------|
| STM32 | F103, F407, F411, F429, H743, G431, L476, WL55 | arm-none-eabi-gcc | stm32vldiscovery / netduinoplus2 |
| ESP32 | ESP32, S2, S3, C3, C6, ESP8266 | xtensa-gcc | qemu-system-xtensa |
| C51 | STC89C52, STC12C5A, STC15W, AT89S52, AT89C51 | SDCC | s51 模拟器 |
| Arduino | Uno, Mega, Nano, Leonardo, Due | avr-gcc | simavr |

QEMU 二进制已内嵌安装包，用户无需额外安装。

## 项目结构

```
chip-sim/
├── frontend/                  # React + TypeScript + Vite + Tauri
│   ├── src/
│   │   ├── canvas/            # Canvas 2D 电路画布 + 元件渲染
│   │   ├── components/        # SetupWizard / PinList / HelpPanel
│   │   ├── core/simulation/   # MCUSim / SimulationEngine / SignalBus
│   │   ├── lib/qemu/          # QEMU WebSocket 客户端 + 事件适配器
│   │   ├── mcu/               # 时钟/中断/定时器/代码解析
│   │   ├── pages/             # McuSimulator 仿真页面
│   │   └── panels/            # CodeEditor / SerialMonitor
│   └── src-tauri/
│       ├── resources/qemu/    # 内嵌 QEMU 二进制
│       └── src/compiler.rs    # 编译器调用
├── backend/                   # Go 后端
│   ├── internal/
│   │   ├── engine/            # 电路仿真引擎
│   │   ├── qemu/              # QEMU 进程管理 + GDB/UART + 多芯片支持
│   │   ├── handler/           # REST API
│   │   ├── ws/                # WebSocket（仿真 + QEMU）
│   │   └── spice/             # SPICE 网表
│   └── cmd/server/
├── scripts/download-qemu.sh   # QEMU 下载脚本
└── .github/workflows/
    ├── build.yml              # Tauri 多平台构建（含 QEMU 打包）
    └── ci.yml                 # 前端测试 + 后端测试
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
npm run tauri:dev
```

### 构建桌面安装包

```bash
cd frontend
./scripts/download-qemu.sh   # 下载 QEMU 二进制
npm run tauri:build           # 输出: src-tauri/target/release/bundle/
```

### 后端服务

```bash
cd backend
go run ./cmd/server    # WebSocket: ws://localhost:8080/ws
```

## 编译器安装

安装包内已包含 QEMU，编译器需要用户自行安装：

| 编译器 | 安装命令 | 用途 |
|--------|---------|------|
| SDCC | `brew install sdcc` | C51 系列 |
| ARM GCC | `brew install arm-none-eabi-gcc` | STM32 系列 |
| AVR GCC | `brew install avr-gcc` | Arduino |
| simavr | `brew install simavr` | AVR 仿真（可选） |

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + Vite |
| 代码编辑 | Monaco Editor |
| 渲染 | Canvas 2D |
| 状态管理 | Zustand + useRef |
| 桌面框架 | Tauri 2 (Rust) |
| 后端 | Go + gorilla/websocket |
| 仿真 | 行为仿真 + QEMU 指令级仿真 + SDCC/simavr |
| CI/CD | GitHub Actions（4 平台自动构建） |

## License

Proprietary
