// Package engine 提供芯片仿真引擎核心组件。
// 本文件实现 ADC（模数转换器）仿真模型。
//
// ADC 将连续模拟电压信号转换为离散数字码值。
// 支持可配置分辨率（8/10/12/16位）、参考电压、采样率和多通道输入。
package engine

import (
	"math"

	"chip-sim/pkg/types"
)

// ==================== ADC 配置 ====================

// ADCConfig 定义 ADC 的硬件参数配置。
//
// 字段说明：
//   - Resolution: 转换位数，支持 8、10、12、16 位
//   - VRefHigh: 正参考电压（满量程电压），单位 V
//   - VRefLow: 负参考电压（零点电压），单位 V
//   - SampleRateHz: 采样频率，单位 Hz
//   - InputChannels: 模拟输入通道数量（支持多路复用）
//   - INL: 积分非线性误差，单位 LSB（默认 0 表示理想 ADC）
//   - DNL: 微分非线性误差，单位 LSB（默认 0 表示理想 ADC）
type ADCConfig struct {
	Resolution    int     // 位数: 8, 10, 12, 16
	VRefHigh      float64 // 正参考电压 (V), 默认 3.3
	VRefLow       float64 // 负参考电压 (V), 默认 0
	SampleRateHz  float64 // 采样率 (Hz), 默认 100000
	InputChannels int     // 输入通道数, 默认 1
	INL           float64 // 积分非线性 (LSB), 0 = 理想
	DNL           float64 // 微分非线性 (LSB), 0 = 理想
}

// DefaultADCConfig 返回默认 ADC 配置（12 位，3.3V 参考，100kHz 采样）。
func DefaultADCConfig() ADCConfig {
	return ADCConfig{
		Resolution:    12,
		VRefHigh:      3.3,
		VRefLow:       0,
		SampleRateHz:  100000,
		InputChannels: 1,
		INL:           0,
		DNL:           0,
	}
}

// ADCConfigFromComponent 从 Component 结构体提取 ADC 配置参数。
// 支持从 Params map 中读取 resolution、vRefHigh、vref、vRefLow、
// sampleRate、sampleRateHz、inl、dnl 等参数。
func ADCConfigFromComponent(comp types.Component) ADCConfig {
	cfg := DefaultADCConfig()

	// 从 Value 字段读取参考电压
	if comp.Value.Value > 0 {
		cfg.VRefHigh = comp.Value.Value
	}

	// 从 Params 读取额外参数
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
		if sr, ok := comp.Params["sampleRate"].(float64); ok && sr > 0 {
			cfg.SampleRateHz = sr
		}
		if sr, ok := comp.Params["sampleRateHz"].(float64); ok && sr > 0 {
			cfg.SampleRateHz = sr
		}
		if inl, ok := comp.Params["inl"].(float64); ok {
			cfg.INL = inl
		}
		if dnl, ok := comp.Params["dnl"].(float64); ok {
			cfg.DNL = dnl
		}
		if ch, ok := comp.Params["inputChannels"].(float64); ok && ch > 0 {
			cfg.InputChannels = int(ch)
		}
	}

	// 验证分辨率
	switch cfg.Resolution {
	case 8, 10, 12, 16:
		// 有效
	default:
		cfg.Resolution = 12 // 默认回退到 12 位
	}

	return cfg
}

// ==================== ADC 核心算法 ====================

// ADCQuantize 将模拟输入电压量化为数字码值。
//
// 转换公式：
//
//	digital_value = round((Vin - Vref-) / (Vref+ - Vref-) × (2^resolution - 1))
//
// 钳位规则：超出 [VRefLow, VRefHigh] 范围的输入被钳制在边界值。
// 返回量化后的数字值和量化误差（输入电压与重构电压之差）。
func ADCQuantize(voltage float64, cfg ADCConfig) (digitalValue int, quantError float64) {
	maxCode := (1 << cfg.Resolution) - 1 // 2^N - 1
	vRange := cfg.VRefHigh - cfg.VRefLow

	// 钳位：将输入限制在参考电压范围内
	clamped := voltage
	if clamped < cfg.VRefLow {
		clamped = cfg.VRefLow
	}
	if clamped > cfg.VRefHigh {
		clamped = cfg.VRefHigh
	}

	// 量化: digital = round((V - VRefLow) / VRange * (2^N - 1))
	if vRange == 0 {
		return 0, 0
	}
	normalized := (clamped - cfg.VRefLow) / vRange
	digitalValue = int(math.Round(normalized * float64(maxCode)))

	// 应用 INL 误差（积分非线性）
	if cfg.INL != 0 {
		inlOffset := int(math.Round(cfg.INL))
		digitalValue += inlOffset
		// 再次钳位
		if digitalValue < 0 {
			digitalValue = 0
		}
		if digitalValue > maxCode {
			digitalValue = maxCode
		}
	}

	// 计算量化误差: V_input - V_reconstructed
	vReconstructed := float64(digitalValue)/float64(maxCode)*vRange + cfg.VRefLow
	quantError = voltage - vReconstructed

	return digitalValue, quantError
}

// ADCOutputVoltage 将 ADC 数字码值还原为模拟等效电压。
// 用于波形显示和量化误差可视化。
func ADCOutputVoltage(digitalValue int, cfg ADCConfig) float64 {
	maxCode := (1 << cfg.Resolution) - 1
	if maxCode == 0 {
		return 0
	}
	vRange := cfg.VRefHigh - cfg.VRefLow
	return float64(digitalValue)/float64(maxCode)*vRange + cfg.VRefLow
}

// ADCMaxCode 返回 ADC 的最大数字码值（2^resolution - 1）。
func ADCMaxCode(cfg ADCConfig) int {
	return (1 << cfg.Resolution) - 1
}

// ADCQuantizationStep 返回 ADC 的量化步长（1 LSB 对应的电压值）。
func ADCQuantizationStep(cfg ADCConfig) float64 {
	maxCode := (1 << cfg.Resolution) - 1
	if maxCode == 0 {
		return 0
	}
	return (cfg.VRefHigh - cfg.VRefLow) / float64(maxCode)
}

// ==================== ADC 内部状态 ====================

// ADCInternalState 保存 ADC 仿真运行时的内部状态。
// 每个 ADC 组件实例拥有独立的状态，用于跨时间步保持采样值。
type ADCInternalState struct {
	Config         ADCConfig // ADC 配置快照
	ActiveChannel  int       // 当前活跃的多路复用通道
	LastClockLevel bool      // 上一时钟电平（用于边沿检测）
	LastSampleTime float64   // 上次采样时刻 (s)
	DigitalValue   int       // 当前数字输出值
	QuantError     float64   // 当前量化误差
	OutputVoltage  float64   // 输出电压（量化后等效）
}

// ==================== MNA 矩阵 stamp ====================

// stampADCTransient 在暂态分析中为 ADC 组件添加 MNA 矩阵贡献。
//
// 端口映射：
//   - 端口 0: 模拟输入 (AIN)
//   - 端口 1: 采样时钟输入 (CLK)，可选
//   - 端口 2: 数字输出（以模拟等效电压表示）
//   - 端口 3: 接地参考 (GND)
//
// 行为逻辑：
//   - 有时钟端口：在时钟上升沿对模拟输入采样
//   - 无时钟端口：按配置的采样率连续采样
//   - 输出为量化后的等效电压，同时在 Params 中存储数字码值
func stampADCTransient(
	M [][]float64, b []float64,
	comp types.Component, indices []int,
	V []float64, t float64, dt float64,
	adcStates map[string]*ADCInternalState,
) {
	if len(indices) < 2 {
		return
	}

	cfg := ADCConfigFromComponent(comp)

	// 获取或初始化内部状态
	state, exists := adcStates[comp.ID]
	if !exists {
		state = &ADCInternalState{
			Config:         cfg,
			ActiveChannel:  0,
			LastClockLevel: false,
			LastSampleTime: -1,
			DigitalValue:   0,
			QuantError:     0,
			OutputVoltage:  cfg.VRefLow,
		}
		adcStates[comp.ID] = state
	}

	// 模拟输入节点
	nAin := indices[0]
	vAin := 0.0
	if nAin >= 0 && nAin < len(V) {
		vAin = V[nAin]
	}

	// 检测时钟信号（如果有时钟端口）
	clockRising := false
	if len(indices) >= 3 {
		nClk := indices[1]
		vClk := 0.0
		if nClk >= 0 && nClk < len(V) {
			vClk = V[nClk]
		}
		// 数字阈值: VRefHigh/2
		clkHigh := vClk > cfg.VRefHigh*0.5
		clockRising = clkHigh && !state.LastClockLevel
		state.LastClockLevel = clkHigh
	}

	// 判断是否需要采样
	shouldSample := false
	if len(indices) >= 3 {
		// 有时钟端口：在上升沿采样
		shouldSample = clockRising
	} else {
		// 无时钟端口：按采样率连续采样
		if state.LastSampleTime < 0 || t-state.LastSampleTime >= 1.0/cfg.SampleRateHz {
			shouldSample = true
		}
	}

	if shouldSample {
		dVal, qErr := ADCQuantize(vAin, cfg)
		state.DigitalValue = dVal
		state.QuantError = qErr
		state.OutputVoltage = ADCOutputVoltage(dVal, cfg)
		state.LastSampleTime = t
	}

	// 数字输出节点 — 以低阻抗电压源驱动
	if len(indices) >= 3 {
		nOut := indices[2]
		nGnd := -1
		if len(indices) >= 4 {
			nGnd = indices[3]
		}
		gOut := 1.0 // 1Ω 输出阻抗
		vOut := state.OutputVoltage

		if nOut >= 0 {
			M[nOut][nOut] += gOut
			b[nOut] += gOut * vOut
		}
		if nGnd >= 0 {
			M[nGnd][nGnd] += gOut
			b[nGnd] -= gOut * vOut
		}
	} else {
		// 仅有 2 端口：输出直接驱动
		nOut := indices[1]
		gOut := 1.0
		vOut := state.OutputVoltage

		if nOut >= 0 {
			M[nOut][nOut] += gOut
			b[nOut] += gOut * vOut
		}
	}
}

// stampADCDC 在直流分析中为 ADC 组件添加 MNA 矩阵贡献。
// DC 模式下，模拟输入呈高阻抗（微小漏电流），输出为 VRefLow。
func stampADCDC(M [][]float64, b []float64, comp types.Component, indices []int) {
	if len(indices) < 2 {
		return
	}
	// 模拟输入：高阻抗（小漏电导）
	nAin := indices[0]
	gLeak := 1e-9
	if nAin >= 0 {
		M[nAin][nAin] += gLeak
	}
	// 输出：驱动到 VRefLow
	if len(indices) >= 3 {
		nOut := indices[2]
		cfg := ADCConfigFromComponent(comp)
		if nOut >= 0 {
			gOut := 1.0
			M[nOut][nOut] += gOut
			b[nOut] += gOut * cfg.VRefLow
		}
	}
}
