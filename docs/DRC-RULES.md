# Chip-Sim DRC 规则清单

## 概述

电路设计规则检查（DRC, Design Rule Check）系统在用户设计电路时实时检测错误并给出智能修复建议。所有规则以可扩展的规则引擎方式实现，支持启用/禁用单条规则。

## 规则清单

| # | 规则 ID | 名称 | 默认严重级别 | 说明 |
|---|---------|------|-------------|------|
| 1 | `empty-circuit` | 空电路检测 | ❌ Error | 电路为空时提示用户添加元件 |
| 2 | `no-wires` | 无连线检测 | ❌ Error | 电路有元件但没有任何连线 |
| 3 | `missing-power-ground` | 电源/地缺失检测 | ❌ Error | 电路缺少电源或接地连接 |
| 4 | `short-circuit` | 短路检测 | ❌ Error | 电源直接接地、逻辑门输出端互连 |
| 5 | `floating-pin` | 悬空引脚检测 | ⚠️ Warning | 未连接的输入引脚 |
| 6 | `isolated-component` | 孤立元件检测 | ⚠️ Warning | 没有任何连线的元件 |
| 7 | `led-no-resistor` | LED 限流电阻检测 | ⚠️ Warning | 二极管/LED 未串联限流电阻 |
| 8 | `logic-floating-input` | 逻辑门输入悬空提示 | ⚠️ Warning | 逻辑门输入悬空，建议上拉/下拉 |
| 9 | `opamp-power` | 运放电源检查 | ⚠️ Warning | 运放电路缺少直流电源 |
| 10 | `parameter-range` | 元件参数合理性检查 | 💡 Suggestion | 电阻/电容/电感值超出合理范围 |
| 11 | `node-fanout` | 节点连接数检查 | 💡 Suggestion | 单个引脚连接过多元件（扇出过大） |
| 12 | `resistor-divider` | 电阻分压合理性检查 | 💡 Suggestion | 分压电阻比例不合理 |
| 13 | `transistor-bias` | 晶体管偏置检查 | 💡 Suggestion | BJT/MOSFET 引脚未完整连接 |

## 详细说明

### ❌ Error 级规则（阻止仿真）

#### 1. `empty-circuit` — 空电路检测
- **触发条件**：电路中没有任何元件
- **修复建议**：从左侧元件库中拖拽元件到画布上

#### 2. `no-wires` — 无连线检测
- **触发条件**：有元件但没有连线
- **修复建议**：从元件引脚拖拽以创建连线

#### 3. `missing-power-ground` — 电源/地缺失检测
- **触发条件**：
  - 电路中没有 GND 元件
  - 电路中没有电源元件（DC/AC/电压源/电流源）
  - 运放所在电路缺少电源
- **修复建议**：添加 GND 和电源元件

#### 4. `short-circuit` — 短路检测
- **触发条件**：
  - 电源两端直接接地（无负载）
  - 两个逻辑门的输出端直接相连
- **修复建议**：在电源和地之间添加负载元件；使用开路集电极输出或隔离元件

### ⚠️ Warning 级规则（允许仿真但提示）

#### 5. `floating-pin` — 悬空引脚检测
- **触发条件**：
  - 逻辑门/运放/BJT/MOSFET/二极管的输入引脚未连接
  - 无源元件（电阻/电容/电感）的所有端口均未连接
- **智能提示**：
  - 逻辑门 → "建议连接上拉电阻或驱动信号"
  - 运放 → "请连接信号源或偏置电路"
  - BJT → "请连接驱动信号到基极"
  - MOSFET → "请连接驱动信号到栅极"

#### 6. `isolated-component` — 孤立元件检测
- **触发条件**：元件没有任何连线
- **修复建议**：连接到电路或删除

#### 7. `led-no-resistor` — LED 限流电阻检测
- **触发条件**：二极管与电源之间没有串联电阻
- **修复建议**："建议在 LED/二极管电路中串联限流电阻（通常 100Ω ~ 1kΩ）"

#### 8. `logic-floating-input` — 逻辑门输入悬空提示
- **触发条件**：逻辑门（AND/OR/NAND/NOR/XOR/NOT）的输入端口未连接
- **修复建议**："TTL/CMOS 逻辑门输入悬空可能导致不确定状态，建议添加上拉电阻（4.7kΩ~10kΩ）或下拉电阻"

#### 9. `opamp-power` — 运放电源检查
- **触发条件**：电路中有运放但缺少直流电源
- **修复建议**："运放需要 V+ 和 V- 电源引脚供电"

### 💡 Suggestion 级规则（优化建议）

#### 10. `parameter-range` — 元件参数合理性检查
- **检查范围**：
  - 电阻：< 0.1Ω 警告过小，> 100MΩ 提示接近开路
  - 电容：< 1fF 警告过小，> 1F 提示罕见
  - 电感：< 1pH 提示接近导线，> 10H 提示罕见
  - 电压源：> 1000V 警告高压

#### 11. `node-fanout` — 节点连接数检查
- **触发条件**：单个引脚连接超过 3 条线
- **修复建议**：使用缓冲器减少扇出

#### 12. `resistor-divider` — 电阻分压合理性检查
- **触发条件**：两个串联电阻的阻值比 > 100:1 或 < 1:100
- **修复建议**：分压电阻建议阻值比在 1:100 以内

#### 13. `transistor-bias` — 晶体管偏置检查
- **触发条件**：BJT/MOSFET 有引脚未连接
- **修复建议**：补充完整的偏置电路

## 架构说明

### 文件结构
```
frontend/src/
├── lib/circuit/
│   ├── CircuitDRC.ts          # DRC 规则引擎（规则定义 + 执行）
│   └── DiagnosticEngine.ts    # 诊断状态管理引擎
├── components/
│   └── DiagnosticsPanel/      # 智能诊断 UI 面板
│       ├── DiagnosticsPanel.tsx
│       ├── DiagnosticsPanel.css
│       └── index.ts
└── features/
    ├── editor/
    │   └── ValidationPanel.tsx  # 原有验证面板（兼容保留）
    └── simulator/
        └── SimulatorControl.tsx # 仿真前 DRC 检查集成
```

### 扩展新规则

在 `CircuitDRC.ts` 中调用 `registerRule()` 注册新规则：

```typescript
registerRule({
  id: 'my-new-rule',
  name: '我的新规则',
  description: '规则说明',
  severity: 'warning', // 'error' | 'warning' | 'suggestion'
  enabled: true,
  check: (components, nodes, wires) => {
    const diagnostics: DRCDiagnostic[] = [];
    // ... 检查逻辑
    return diagnostics;
  },
});
```

### 仿真前检查流程

1. 用户点击"启动仿真"
2. `SimulatorControl.handleStart()` 调用 `diagnosticEngine.checkSimulation()`
3. 如果有 Error 级诊断 → 阻止仿真，显示错误列表
4. 如果只有 Warning → 允许仿真，在控制台输出警告
5. 如果全部通过 → 正常启动仿真

## 更新日志

- **v1.0** (2026-03-28)：初始版本，实现 13 条 DRC 规则
