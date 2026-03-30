# ChipSim · MCU 仿真平台

> 桌面端嵌入式芯片在线仿真平台 — 电路设计、代码编辑、编译、仿真一体化

[![Build ChipSim](https://github.com/NeuronCState/chip-sim/actions/workflows/build.yml/badge.svg)](https://github.com/NeuronCState/chip-sim/actions/workflows/build.yml)
[![Latest Release](https://img.shields.io/github/v/release/NeuronCState/chip-sim?color=green&label=Latest%20Release)](https://github.com/NeuronCState/chip-sim/releases/latest)
[![License](https://img.shields.io/badge/License-Proprietary-blue)](#)

📥 **下载安装包：** [macOS (ARM)](https://github.com/NeuronCState/chip-sim/releases/latest/download/ChipSim_0.1.1_aarch64.dmg) · [macOS (Intel)](https://github.com/NeuronCState/chip-sim/releases/latest/download/ChipSim_0.1.1_x64.dmg) · [Windows](https://github.com/NeuronCState/chip-sim/releases/latest/download/ChipSim_0.1.1_x64-setup.exe) · [Linux (deb)](https://github.com/NeuronCState/chip-sim/releases/latest/download/ChipSim_0.1.1_amd64.deb) · [Linux (AppImage)](https://github.com/NeuronCState/chip-sim/releases/latest/download/ChipSim_0.1.1_amd64.AppImage)

## 功能

- **电路画布** — WebGL 渲染，200+ 元件库，正交/45°/直线连线，拖拽布局
- **代码编辑器** — Monaco Editor，C 语法高亮，各芯片系列示例代码
- **在线编译** — 调用本地编译器（SDCC/ARM-GCC），点击运行即编译
- **MCU 仿真** — 支持 C51/STM32/ESP32/Arduino 等 30+ 芯片型号
- **串口监视器** — 实时串口输出
- **波形示波器** — 实时信号波形显示
- **元件属性面板** — 点击元件查看参数、引脚连接、仿真状态
- **新手引导** — 分步引导 + 电路搭建向导 + 帮助系统
- **SPICE 网表** — 导入/导出标准 SPICE 网表，兼容其他 EDA 工具
- **多语言** — 中英文国际化

## 芯片支持

| 系列 | 型号 | 编译器 |
|------|------|--------|
| C51 | STC89C52, STC12C5A, STC15W, AT89S52, AT89C51 | SDCC |
| STM32 | F103, F407, F411, F429, H743, G431, L476, WL55 | arm-none-eabi-gcc |
| ESP32 | ESP32, S2, S3, C3, C6, ESP8266 | xtensa-gcc |
| Arduino | Uno, Mega, Nano, Leonardo, Due | avr-gcc |
| 其他 | AVR, PIC, MSP430, NXP, RISC-V | 各自工具链 |

## 项目结构

```
chip-sim/
├── frontend/                  # React + TypeScript + Vite 前端
│   ├── src/
│   │   ├── canvas/            # WebGL 电路画布
│   │   ├── components/        # 通用组件（Tutorial/Wizard/HelpPanel...）
│   │   ├── core/              # 仿真引擎、组件行为、存储
│   │   ├── features/          # 编辑器、仿真控制、波形
│   │   ├── lib/               # 编译器 API
│   │   ├── mcu/               # MCU 仿真（时钟/中断/定时器）
│   │   ├── pages/             # McuSimulator 仿真页面
│   │   ├── panels/            # 代码编辑器、串口监视器
│   │   ├── stores/            # Zustand 状态管理
│   │   └── templates/         # 87 个预置电路模板
│   └── src-tauri/             # Tauri 桌面应用（Rust 后端）
│       └── src/
│           ├── lib.rs         # 入口
│           └── compiler.rs    # 编译器调用（SDCC/ARM-GCC/AVR-GCC）
├── backend/                   # Go 后端（电路仿真引擎）
│   ├── cmd/server/            # 服务入口
│   ├── internal/
│   │   ├── engine/            # MNA 仿真引擎
│   │   ├── handler/           # WebSocket + REST API
│   │   └── spice/             # SPICE 网表解析/导出
│   └── pkg/types/
├── .github/workflows/
│   ├── build.yml              # Tauri 多平台构建（macOS/Windows/Linux）
│   └── ci.yml                 # 前端构建 + 后端测试
└── README.md
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
npm install
npm run tauri:dev    # 启动 Tauri 开发模式
```

### 构建桌面安装包

```bash
npm run tauri:build  # 输出: src-tauri/target/release/bundle/
```

### 后端服务

```bash
cd backend
make run             # WebSocket: ws://localhost:8080/ws
```

## 编译器安装

| 编译器 | 安装命令 | 用途 |
|--------|---------|------|
| SDCC | `brew install sdcc` | C51 系列 |
| ARM GCC | `brew install arm-none-eabi-gcc` | STM32 系列 |
| AVR GCC | `brew install avr-gcc` | Arduino |

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + Vite |
| 代码编辑 | Monaco Editor |
| 渲染 | WebGL (WebGLCanvas) |
| 状态管理 | Zustand |
| 桌面框架 | Tauri 2 (Rust) |
| 后端 | Go + gorilla/websocket |
| 仿真引擎 | 自研 MNA 求解器 |
| CI/CD | GitHub Actions（4 平台自动构建） |

## 📥 安装包下载

前往 [GitHub Releases](https://github.com/NeuronCState/chip-sim/releases/latest) 下载最新版本：

| 平台 | 下载 |
|------|------|
| macOS (Apple Silicon) | [ChipSim_0.1.1_aarch64.dmg](https://github.com/NeuronCState/chip-sim/releases/latest/download/ChipSim_0.1.1_aarch64.dmg) |
| macOS (Intel) | [ChipSim_0.1.1_x64.dmg](https://github.com/NeuronCState/chip-sim/releases/latest/download/ChipSim_0.1.1_x64.dmg) |
| Windows x64 | [ChipSim_0.1.1_x64-setup.exe](https://github.com/NeuronCState/chip-sim/releases/latest/download/ChipSim_0.1.1_x64-setup.exe) \| [.msi](https://github.com/NeuronCState/chip-sim/releases/latest/download/ChipSim_0.1.1_x64_en-US.msi) |
| Linux x64 | [.deb](https://github.com/NeuronCState/chip-sim/releases/latest/download/ChipSim_0.1.1_amd64.deb) \| [.AppImage](https://github.com/NeuronCState/chip-sim/releases/latest/download/ChipSim_0.1.1_amd64.AppImage) \| [.rpm](https://github.com/NeuronCState/chip-sim/releases/latest/download/ChipSim-0.1.1-1.x86_64.rpm) |

## License

Proprietary
