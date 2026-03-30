// Package engine 提供芯片仿真引擎核心组件。
// 本文件实现 DAC（数模转换器）仿真模型。
//
// DAC 将离散数字码值转换为连续模拟电压信号。
// 支持可配置分辨率（8/10/12/16位）、参考电压和建立时间。
package engine

import (
	"math"

	"chip-sim/pkg/types"
)

// ==================== DAC 配置 ====================

// DACConfig 定义 DAC 的硬件参数配置。
//
// 字段说明：
//   - Resolution: 转换位数，支持 8、10、12、16 位
//   - VRefHigh: 正参考电压（满量程电压），单位 V
//   - VRefLow: 负参考电压（零点电压），单位 V
//   - SettlingTime: 建立时间，输出达到终值 0.1% 以内所需时间，单位 s
//   - INL: 积分非线性误差，单位 LSB（默认 0 表示理想 DAC）
//   - DNL: 微分非线性误差，单位 LSB（默认 0 表示理想 DAC）
type DACConfig struct {
	Resolution   int     // 位数: 8, 10, 12, 16
	VRefHigh     float64 // 正参考电压 (V), 默认 3.3
	VRefLow      float64 // 负参考电压 (V), 默认 0
	SettlingTime float64 // 建立时间 (s), 默认 1e-6 (1μs)
	INL          float64 // 积分非线性 (LSB), 0 = 理想
	DNL          float64 // 微分非线性 (LSB), 0 = 理想
}

// DefaultDACConfig 返回默认 DAC 配置（12 位，3.3V 参考，1μs 建立时间）。
func DefaultDACConfig() DACConfig {
	return DACConfig{
		Resolution:   12,
		VRefHigh:     3.3,
		VRefLow:      0,
		SettlingTime: 1e-6, // 1 μs
		INL:          0,
		DNL:          0,
	}
}

// DACConfigFromComponent 从 Component 结构体提取 DAC 配置参数。
// 支持从 Params map 中读取 resolution、vRefHigh、vref、vRefLow、
// settlingTime、inl、dnl 等参数。
func DACConfigFromComponent(comp types.Component) DACConfig {
	cfg := DefaultDACConfig()

	if comp.Value.Value > 0 {
		cfg.VRefHigh = comp.Value.Value
	}

	if comp.Params != nil {
		if res, ok := comp.Params["resolution"].(float64); ok && res > 0 {
			cfg.Resolution = int(res)
		}
		if vref, ok := comp.Params["vRefHigh"].(float64); ok && vref > 0 {
			cfg.VRefHigh = vref
		}
		if vref, ok := comp.Params["vref"].(float64); ok && vref > 0 {
			cfg.VRefHigh = vref
		}
		if vrl, ok := comp.Params["vRefLow"].(float64); ok {
			cfg.VRefLow = vrl
		}
		if st, ok := comp.Params["settlingTime"].(float64); ok && st > 0 {
			cfg.SettlingTime = st
		}
		if inl, ok := comp.Params["inl"].(float64); ok {
			cfg.INL = inl
		}
		if dnl, ok := comp.Params["dnl"].(float64); ok {
			cfg.DNL = dnl
		}
	}

	switch cfg.Resolution {
	case 8, 10, 12, 16:
		// 有效
	default:
		cfg.Resolution = 12
	}

	return cfg
}

// ==================== DAC 核心算法 ====================

// DACConvert 将数字码值转换为模拟输出电压。
//
// 转换公式：
//
//	Vout = Vref- + (digital_input / (2^resolution - 1)) × (Vref+ - Vref-)
//
// 数字输入超出 [0, 2^resolution-1] 范围时被钳制。
func DACConvert(digitalValue int, cfg DACConfig) float64 {
	maxCode := (1 << cfg.Resolution) - 1
	if maxCode == 0 {
		return cfg.VRefLow
	}

	// 钳位数字输入
	clamped := digitalValue
	if clamped < 0 {
		clamped = 0
	}
	if clamped > maxCode {
		clamped = maxCode
	}

	vRange := cfg.VRefHigh - cfg.VRefLow
	return float64(clamped)/float64(maxCode)*vRange + cfg.VRefLow
}

// DACConvertWithSettling 考虑建立时间的 DAC 转换。
// 当目标电压发生变化时，输出按指数衰减逼近目标值。
// dt 为距离上次转换的时间间隔（秒）。
//
// 一阶 RC 建立模型：
//
//	Vout(t) = Vtarget + (Vprev - Vtarget) × exp(-dt / τ)
//
// 其中 τ = SettlingTime / 3（时间常数，使 3τ 时达到终值的 95%）。
func DACConvertWithSettling(digitalValue int, cfg DACConfig, prevVoltage float64, dt float64) float64 {
	targetVoltage := DACConvert(digitalValue, cfg)

	// 如果建立时间为 0 或 dt 很大（已充分建立），直接返回目标值
	if cfg.SettlingTime <= 0 || dt >= 5*cfg.SettlingTime {
		return targetVoltage
	}

	// 一阶指数建立：τ = SettlingTime / 3
	tau := cfg.SettlingTime / 3.0
	if tau <= 0 {
		return targetVoltage
	}

	alpha := math.Exp(-dt / tau)
	return targetVoltage + (prevVoltage-targetVoltage)*alpha
}

// DACMaxCode 返回 DAC 的最大数字码值（2^resolution - 1）。
func DACMaxCode(cfg DACConfig) int {
	return (1 << cfg.Resolution) - 1
}

// DACQuantizationStep 返回 DAC 的量化步长（1 LSB 对应的电压值）。
func DACQuantizationStep(cfg DACConfig) float64 {
	maxCode := (1 << cfg.Resolution) - 1
	if maxCode == 0 {
		return 0
	}
	return (cfg.VRefHigh - cfg.VRefLow) / float64(maxCode)
}

// ==================== DAC 内部状态 ====================

// DACInternalState 保存 DAC 仿真运行时的内部状态。
type DACInternalState struct {
	Config         DACConfig // DAC 配置快照
	LastDigitalVal int       // 上一次的数字输入值
	LastOutputVolt float64   // 上一次的输出电压
	LastConvertTime float64  // 上一次转换时刻 (s)
}

// ==================== MNA 矩阵 stamp ====================

// stampDACTransient 在暂态分析中为 DAC 组件添加 MNA 矩阵贡献。
//
// 端口映射：
//   - 端口 0: 数字输入（以模拟电压表示数字值）
//   - 端口 1: 模拟输出 (AOUT)
//   - 端口 2: 接地参考 (GND)
//
// 行为：读取数字输入节点电压 → 映射到数字码值 → 输出精确的 DAC 重构电压。
// 如果配置了 SettlingTime > 0，则使用指数建立模型。
func stampDACTransient(
	M [][]float64, b []float64,
	comp types.Component, indices []int,
	V []float64, t float64, dt float64,
	dacStates map[string]*DACInternalState,
) {
	if len(indices) < 2 {
		return
	}

	cfg := DACConfigFromComponent(comp)

	// 获取或初始化内部状态
	state, exists := dacStates[comp.ID]
	if !exists {
		state = &DACInternalState{
			Config:          cfg,
			LastDigitalVal:  0,
			LastOutputVolt:  cfg.VRefLow,
			LastConvertTime: 0,
		}
		dacStates[comp.ID] = state
	}

	// 数字输入节点
	nDig := indices[0]
	vDig := 0.0
	if nDig >= 0 && nDig < len(V) {
		vDig = V[nDig]
	}

	// 将输入电压映射到数字码值
	maxCode := (1 << cfg.Resolution) - 1
	vRange := cfg.VRefHigh - cfg.VRefLow
	normalized := 0.0
	if vRange != 0 {
		normalized = (vDig - cfg.VRefLow) / vRange
	}
	digitalValue := int(math.Round(normalized * float64(maxCode)))
	if digitalValue < 0 {
		digitalValue = 0
	}
	if digitalValue > maxCode {
		digitalValue = maxCode
	}

	// 计算输出电压（考虑建立时间）
	elapsed := t - state.LastConvertTime
	vOut := DACConvertWithSettling(digitalValue, cfg, state.LastOutputVolt, elapsed)

	// 更新状态
	state.LastDigitalVal = digitalValue
	state.LastOutputVolt = vOut
	state.LastConvertTime = t

	// 模拟输出：使用低阻抗电压驱动
	if len(indices) >= 3 {
		nOut := indices[1]
		nGnd := indices[2]
		gOut := 1.0

		if nOut >= 0 {
			M[nOut][nOut] += gOut
			b[nOut] += gOut * vOut
		}
		if nGnd >= 0 {
			M[nGnd][nGnd] += gOut
			b[nGnd] -= gOut * vOut
		}
	} else {
		nOut := indices[1]
		gOut := 1.0

		if nOut >= 0 {
			M[nOut][nOut] += gOut
			b[nOut] += gOut * vOut
		}
	}
}

// stampDACDC 在直流分析中为 DAC 组件添加 MNA 矩阵贡献。
// DC 模式下，数字输入呈高阻抗，输出为 VRefLow。
func stampDACDC(M [][]float64, b []float64, comp types.Component, indices []int) {
	if len(indices) < 2 {
		return
	}
	// 数字输入：高阻抗
	nDig := indices[0]
	gLeak := 1e-9
	if nDig >= 0 {
		M[nDig][nDig] += gLeak
	}
	// 输出：驱动到 VRefLow
	if len(indices) >= 3 {
		nOut := indices[1]
		cfg := DACConfigFromComponent(comp)
		if nOut >= 0 {
			gOut := 1.0
			M[nOut][nOut] += gOut
			b[nOut] += gOut * cfg.VRefLow
		}
	}
}
