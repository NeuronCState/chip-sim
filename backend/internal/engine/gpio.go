// Package engine GPIO 引脚仿真引擎
// 模拟微控制器 GPIO 的完整行为：输入/输出/ADC/PWM/中断
package engine

import (
	"math"

	"chip-sim/pkg/types"
)

// GPIOEngine GPIO 仿真引擎
type GPIOEngine struct {
	config    types.MCUConfig
	pinStates []types.GPIOPinState
	prevLevels []types.GPIOLevel // 上一步电平，用于沿检测
}

// NewGPIOEngine 创建 GPIO 引擎
func NewGPIOEngine(config types.MCUConfig) *GPIOEngine {
	states := make([]types.GPIOPinState, len(config.Pins))
	prevLevels := make([]types.GPIOLevel, len(config.Pins))
	for i, pin := range config.Pins {
		states[i] = types.GPIOPinState{
			PinNumber: pin.PinNumber,
			Level:     types.GPIOLevelFloating,
			Voltage:   0,
			Current:   0,
		}
		prevLevels[i] = types.GPIOLevelFloating
	}
	return &GPIOEngine{
		config:     config,
		pinStates:  states,
		prevLevels: prevLevels,
	}
}

// Step 执行一个仿真时间步
func (e *GPIOEngine) Step(input types.GPIOSimulationStep) types.GPIOSimulationResult {
	// 构建外部信号映射
	externalMap := make(map[int]float64)
	for _, sig := range input.ExternalSignals {
		externalMap[sig.PinNumber] = sig.Voltage
	}

	for i, pin := range e.config.Pins {
		extVoltage, hasExternal := externalMap[pin.PinNumber]
		prevLevel := e.pinStates[i].Level

		switch pin.Mode {
		case types.GPIOModeInput:
			e.simulateInput(i, pin, extVoltage, hasExternal)
		case types.GPIOModeOutput:
			e.simulateOutput(i, pin, extVoltage, hasExternal)
		case types.GPIOModeAnalog:
			e.simulateAnalog(i, pin, extVoltage, hasExternal)
		case types.GPIOModePWM:
			e.simulatePWM(i, pin, input.Time)
		}

		// 检测中断
		e.checkInterrupt(i, pin, prevLevel)
	}

	return types.GPIOSimulationResult{
		PinStates: copyPinStates(e.pinStates),
		Time:      input.Time,
	}
}

// simulateInput 模拟输入模式引脚行为
func (e *GPIOEngine) simulateInput(idx int, pin types.GPIOPinConfig, extVoltage float64, hasExternal bool) {
	state := &e.pinStates[idx]

	if hasExternal {
		// 外部有信号：读取电平
		state.Voltage = extVoltage
		state.Level = voltageToLevel(extVoltage, e.config.VDD)
		state.Current = 0 // 输入模式下电流极小（高阻）
	} else {
		// 无外部信号：看上下拉
		switch pin.Pull {
		case types.GPIOPullUp:
			state.Voltage = e.config.VDD
			state.Level = types.GPIOLevelHigh
			state.Current = e.config.VDD / pin.PullResistance * 1000 // mA
		case types.GPIOPullDown:
			state.Voltage = 0
			state.Level = types.GPIOLevelLow
			state.Current = 0
		default:
			state.Voltage = 0
			state.Level = types.GPIOLevelFloating
			state.Current = 0
		}
	}
}

// simulateOutput 模拟输出模式引脚行为
func (e *GPIOEngine) simulateOutput(idx int, pin types.GPIOPinConfig, extVoltage float64, hasExternal bool) {
	state := &e.pinStates[idx]

	// 输出模式：引脚驱动外部，但也可能被外部信号影响
	if pin.OutputType == types.GPIOOutputOpenDrain {
		// 开漏输出：只能拉低，不能主动拉高
		if state.Level == types.GPIOLevelLow {
			state.Voltage = 0
			state.Level = types.GPIOLevelLow
			// 灌电流 = VDD / R_load
			if hasExternal && extVoltage > 0 {
				state.Current = extVoltage / 1000 * 1000 // 简化为 1kΩ 负载
			}
		} else {
			// 高阻态，看上下拉
			switch pin.Pull {
			case types.GPIOPullUp:
				state.Voltage = e.config.VDD
				state.Level = types.GPIOLevelHigh
			case types.GPIOPullDown:
				state.Voltage = 0
				state.Level = types.GPIOLevelLow
			default:
				state.Voltage = 0
				state.Level = types.GPIOLevelFloating
			}
			state.Current = 0
		}
	} else {
		// 推挽输出：主动驱动高/低
		if state.Level == types.GPIOLevelHigh {
			state.Voltage = e.config.VDD
			// 限制源电流
			if hasExternal {
				loadCurrent := (e.config.VDD - extVoltage) / 1000 * 1000 // mA
				state.Current = math.Min(loadCurrent, pin.SourceCurrent)
				// 如果负载电流超过驱动能力，电压下降
				if loadCurrent > pin.SourceCurrent {
					state.Voltage = extVoltage + pin.SourceCurrent*1000/1000
				}
			}
		} else {
			state.Voltage = 0
			state.Level = types.GPIOLevelLow
			if hasExternal {
				state.Current = math.Min(extVoltage/1000*1000, pin.SinkCurrent)
			}
		}
	}
}

// simulateAnalog 模拟 ADC 输入模式
func (e *GPIOEngine) simulateAnalog(idx int, pin types.GPIOPinConfig, extVoltage float64, hasExternal bool) {
	state := &e.pinStates[idx]

	if hasExternal {
		// 钳位到参考电压范围
		v := extVoltage
		if v < 0 {
			v = 0
		}
		if v > pin.ADCRefVoltage {
			v = pin.ADCRefVoltage
		}
		state.Voltage = v
		state.Level = voltageToLevel(v, e.config.VDD)

		// ADC 转换
		maxADC := (1 << pin.ADCResolution) - 1
		state.ADCValue = int(math.Round(v / pin.ADCRefVoltage * float64(maxADC)))
		state.Current = 0
	} else {
		state.Voltage = 0
		state.ADCValue = 0
		state.Level = types.GPIOLevelFloating
		state.Current = 0
	}
}

// simulatePWM 模拟 PWM 输出模式
func (e *GPIOEngine) simulatePWM(idx int, pin types.GPIOPinConfig, t float64) {
	state := &e.pinStates[idx]

	period := 1.0 / pin.PWMFrequency
	phase := math.Mod(t, period) / period

	if phase < pin.PWMDutyCycle {
		state.PWMOutput = e.config.VDD
		state.Level = types.GPIOLevelHigh
	} else {
		state.PWMOutput = 0
		state.Level = types.GPIOLevelLow
	}
	state.Voltage = state.PWMOutput
}

// checkInterrupt 检测中断触发条件
func (e *GPIOEngine) checkInterrupt(idx int, pin types.GPIOPinConfig, prevLevel types.GPIOLevel) {
	state := &e.pinStates[idx]
	currLevel := state.Level

	switch pin.InterruptMode {
	case types.GPIOInterruptRising:
		state.InterruptPending = prevLevel == types.GPIOLevelLow && currLevel == types.GPIOLevelHigh
	case types.GPIOInterruptFalling:
		state.InterruptPending = prevLevel == types.GPIOLevelHigh && currLevel == types.GPIOLevelLow
	case types.GPIOInterruptBoth:
		rising := prevLevel == types.GPIOLevelLow && currLevel == types.GPIOLevelHigh
		falling := prevLevel == types.GPIOLevelHigh && currLevel == types.GPIOLevelLow
		state.InterruptPending = rising || falling
	case types.GPIOInterruptLevel:
		state.InterruptPending = currLevel == types.GPIOLevelHigh
	default:
		state.InterruptPending = false
	}
}

// GetConfig 获取当前 MCU 配置
func (e *GPIOEngine) GetConfig() types.MCUConfig {
	return e.config
}

// SetPinConfig 更新单个引脚配置
func (e *GPIOEngine) SetPinConfig(pin types.GPIOPinConfig) {
	for i, p := range e.config.Pins {
		if p.PinNumber == pin.PinNumber {
			e.config.Pins[i] = pin
			return
		}
	}
}

// SetPinLevel 设置输出模式引脚的电平（模拟固件写寄存器）
func (e *GPIOEngine) SetPinLevel(pinNumber int, level types.GPIOLevel) {
	for i, pin := range e.config.Pins {
		if pin.PinNumber == pinNumber {
			e.pinStates[i].Level = level
			return
		}
	}
}

// 辅助函数

func voltageToLevel(v, vdd float64) types.GPIOLevel {
	threshold := vdd / 2
	if v > threshold {
		return types.GPIOLevelHigh
	}
	if v < threshold*0.1 {
		return types.GPIOLevelLow
	}
	return types.GPIOLevelFloating
}

func copyPinStates(src []types.GPIOPinState) []types.GPIOPinState {
	dst := make([]types.GPIOPinState, len(src))
	copy(dst, src)
	return dst
}
