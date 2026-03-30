# Chip-Sim 元件库目录

> 工部 · 元件库文档 · 更新于 2026-03-28

## 📁 目录结构

```
frontend/src/core/components/
├── index.ts                  # 统一导出
├── sensors/
│   ├── temperature.ts        # 温度传感器
│   ├── light.ts              # 光传感器
│   └── motion.ts             # 运动传感器（压电/加速度/陀螺仪）
├── power/
│   └── index.ts              # 电源管理IC
├── communication/
│   └── index.ts              # 通信模块
└── actuators/
    └── index.ts              # 执行器
```

## 🌡 温度传感器

| 元件 | 类型ID | 默认值 | 说明 |
|------|--------|--------|------|
| NTC热敏电阻 | `ntc_thermistor` | 10kΩ | Steinhart-Hart方程，支持B值估算 |
| 热电偶 | `thermocouple` | 0mV | K/J/T/E/S/N型，Seebeck效应模型 |
| DS18B20 | `ds18b20` | 25°C | 1-Wire数字温度传感器行为模型 |

### NTC 特性
- **Steinhart-Hart 方程**: `1/T = A + B·ln(R) + C·(ln(R))³`
- **B值快速估算**: `R(T) = R₀·exp(B·(1/T - 1/T₀))`
- 支持温度→电阻 / 电阻→温度双向计算
- 特性曲线可视化数据生成

### 热电偶特性
- 支持 K/J/T/E/S/N 六种热电偶类型
- Seebeck 系数表内建
- 温度→电压转换：`V = Seebeck_coeff × (T_hot - T_cold)`

### DS18B20 行为模型
- 完整 9 字节 Scratchpad 模拟
- CRC-8 校验
- 9-12位分辨率配置
- 转换时间模拟

---

## ☀ 光传感器

| 元件 | 类型ID | 默认值 | 说明 |
|------|--------|--------|------|
| 光敏电阻(LDR) | `ldr` | 10kΩ | GL5528/5537/5539 型号参数 |
| 光电二极管 | `photodiode` | 0.5μA | 光电流/光电导模式 |
| 光电晶体管 | `phototransistor` | 1mA | 共发射极配置 |

### LDR 特性
- **照度-电阻公式**: `R = R_light × (Lux/Lux_ref)^(-γ)`
- 内建 GL5528/GL5537/GL5539 参数
- 对数坐标特性曲线数据生成
- 典型场景照度参考值

### 光电二极管特性
- 光电流计算: `I_ph = Responsivity × P_optical`
- 负载电阻输出电压: `V_out = I_ph × R_load`
- 照度→电流曲线生成

### 光电晶体管特性
- 集电极电流: `I_c = gain × I_ph_base`
- 共发射极输出电压（含饱和限制）

---

## 📡 运动传感器

| 元件 | 类型ID | 默认值 | 说明 |
|------|--------|--------|------|
| 压电传感器 | `piezo_sensor` | 0V | PZT陶瓷，力→电压 |
| 加速度计 | `accelerometer` | 0g | ADXL345/MMA8452Q/MPU6050 |
| 陀螺仪 | `gyroscope` | 0°/s | L3G4200D/MPU6050陀螺仪 |

### 压电传感器
- **输出电压**: `V = (d33 × F) / C`
- **频率响应**: 谐振频率处增益最大
- 力→电压特性曲线

### 加速度计
- 模拟输出: `V = V_zeroG + sensitivity × accel`
- 数字输出: ADC 编码值
- 3轴数据处理
- ADXL345/MMA8452Q/MPU6050 参数预设

### 陀螺仪
- 模拟输出: `V = Vdd/2 + sensitivity × rate`
- 数字输出: 中量程偏置
- 3轴数据处理
- L3G4200D/MPU6050 参数预设

---

## ⚡ 电源管理

| 元件 | 类型ID | 默认值 | 说明 |
|------|--------|--------|------|
| LDO稳压器 | `ldo` | 3.3V | 7805/AMS1117/TLV1117 |
| DC-DC降压 | `buck_converter` | 3.3V | LM2596/MP1584/TPS5430 |
| DC-DC升压 | `boost_converter` | 12V | MT3608/XL6009 |
| 电池 | `battery` | 3.7V | 18650/LiPo/9V/AA NiMH |
| 电源监控 | `power_supervisor` | 3.0V | 复位/欠压检测/看门狗 |

### LDO 特性
- 输出电压: 线性调整 + 负载调整
- 效率: `η = V_out / V_in × 100%`
- 功耗: `P = (V_in - V_out) × I_out + V_in × I_q`
- 内建 7805/AMS1117_33/AMS1117_50/TLV1117 参数

### Buck/Boost 变换器
- Buck: `V_out = D × V_in × η`
- Boost: `V_out = V_in / (1-D) × η`
- 纹波电压计算: `ΔV = I_out × (1-D) / (f_sw × C_out)`

### 电池模型
- 放电曲线: `V = V_full - (V_full - V_cutoff) × (1-SoC) - I×R_int`
- 充电曲线: CC/CV 两阶段模型
- 剩余时间估算
- 内建 18650/LiPo_3.7V/9V碱性/AA NiMH 参数

---

## 📶 通信模块

| 元件 | 类型ID | 默认值 | 说明 |
|------|--------|--------|------|
| 蓝牙模块 | `bluetooth_module` | 3.3V | HC-05/HM-10/ESP32-BT |
| WiFi模块 | `wifi_module` | 3.3V | ESP8266/ESP32 |
| CAN收发器 | `can_transceiver` | 5V | MCP2551/SN65HVD230/TJA1050 |
| RS-485收发器 | `rs485_transceiver` | 5V | MAX485/MAX3485/SP3485 |

### 蓝牙模块
- 状态机: idle → advertising → connected → sleep
- AT 命令交互
- 功耗计算

### WiFi 模块
- 状态机: off → idle → connecting → connected → sleep
- AP 扫描模拟
- 功耗计算

### CAN 收发器
- 差分电压: 显性(2.0V) / 隐性(0V)
- 总线长度与速率关系

### RS-485 收发器
- 差分电压: 逻辑1/0
- 总线长度与速率关系

---

## 🔊 执行器

| 元件 | 类型ID | 默认值 | 说明 |
|------|--------|--------|------|
| 有源蜂鸣器 | `buzzer_active` | 5V | 内置驱动电路 |
| 无源蜂鸣器 | `buzzer_passive` | 5V | 需PWM驱动 |
| 继电器 | `relay` | 5V | SPDT/DPDT |
| 步进电机 | `stepper_motor` | 12V | 28BYJ48/NEMA17 |
| LCD显示屏 | `lcd_display` | 3.3V | HD44780 1602/2004 |

### 蜂鸣器
- 有源: 电压驱动，即响
- 无源: 频率响应曲线，谐振频率处音量最大

### 继电器
- 线圈电流: `I = V/R`
- 功耗: `P = V²/R`
- 吸合/释放时间

### 步进电机
- 步距角: 全步/半步/微步
- 转速: `RPM = (f_step × angle × 60) / 360`
- 双极/单极驱动

### LCD 显示屏
- HD44780 初始化序列
- DDRAM 地址计算
- 4位/8位并行/I2C/SPI 接口

---

## 🔧 使用方式

```typescript
import {
  ntcResistanceToTemp,
  generateNTCCurve,
  ldrLuxToResistance,
  piezoOutputVoltage,
  ldoOutputVoltage,
  batteryVoltage,
  BluetoothModuleModel,
  DS18B20Model,
} from '../core/components';

// NTC 温度计算
const temp = ntcResistanceToTemp(10000, DEFAULT_NTC_PARAMS); // 25°C

// LDR 照度→电阻
const resistance = ldrLuxToResistance(100, DEFAULT_LDR_PARAMS);

// 电池放电
const voltage = batteryVoltage(0.5, 500); // 50% 电量, 500mA 放电

// 蓝牙模块
const bt = new BluetoothModuleModel();
bt.connect();
const power = bt.getPowerConsumption();
```

## 📊 元件分类映射

| 分类ID | 分类名 | 元件数 |
|--------|--------|--------|
| `sensor_temperature` | 温度传感器 | 3 |
| `sensor_light` | 光传感器 | 3 |
| `sensor_motion` | 运动传感器 | 3 |
| `power_management` | 电源管理 | 5 |
| `communication` | 通信模块 | 4 |
| `actuator` | 执行器 | 5 |
| **合计** | | **23** |
