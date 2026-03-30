// Package engine MCU 时钟系统
// 管理系统时钟频率、机器周期、指令周期
package engine

import (
	"fmt"
	"math"
)

// ==================== 时钟源类型 ====================

// ClockSource 时钟源类型
type ClockSource string

const (
	ClockSourceInternal ClockSource = "internal" // 内部 RC 振荡器
	ClockSourceExternal ClockSource = "external" // 外部晶体
	ClockSourcePLL      ClockSource = "pll"      // PLL 倍频
)

// ==================== MCU 时钟预设 ====================

// MCUClockPreset MCU 时钟架构预设
type MCUClockPreset struct {
	Name                   string    // 预设名称
	InternalOscFreq        float64   // 内部振荡器频率 (Hz)
	MaxExternalFreq        float64   // 最大外部时钟频率 (Hz)
	PLLMultiplierRange     [2]int    // PLL 倍频范围
	ClocksPerInstruction   int       // 每指令时钟周期数
	SupportedPrescalers    []int     // 支持的预分频比
}

// Preset8051 经典 8051 时钟预设
var Preset8051 = MCUClockPreset{
	Name:                 "8051",
	InternalOscFreq:      12_000_000,
	MaxExternalFreq:      24_000_000,
	PLLMultiplierRange:   [2]int{1, 1},
	ClocksPerInstruction: 12,
	SupportedPrescalers:  []int{1},
}

// PresetATmega AVR ATmega 时钟预设
var PresetATmega = MCUClockPreset{
	Name:                 "ATmega",
	InternalOscFreq:      8_000_000,
	MaxExternalFreq:      20_000_000,
	PLLMultiplierRange:   [2]int{1, 4},
	ClocksPerInstruction: 1,
	SupportedPrescalers:  []int{1, 8, 64, 256, 1024},
}

// PresetSTM32 STM32 ARM Cortex-M 时钟预设
var PresetSTM32 = MCUClockPreset{
	Name:                 "STM32",
	InternalOscFreq:      16_000_000,
	MaxExternalFreq:      72_000_000,
	PLLMultiplierRange:   [2]int{2, 16},
	ClocksPerInstruction: 1,
	SupportedPrescalers:  []int{1, 2, 4, 8, 16, 64, 128, 256, 512},
}

// ==================== 时钟系统配置 ====================

// ClockSystemConfig 时钟系统配置
type ClockSystemConfig struct {
	Source            ClockSource     `json:"source"`
	Frequency         float64         `json:"frequency"`         // 系统时钟频率 (Hz)
	PLLMultiplier     int             `json:"pllMultiplier"`     // PLL 倍频因子
	ExternalFrequency float64         `json:"externalFrequency"` // 外部时钟频率
	Preset            MCUClockPreset  `json:"-"`
	SimTimeStep       float64         `json:"simTimeStep"`       // 仿真时间步长 (秒)
}

// DefaultClockConfig 创建默认时钟配置
func DefaultClockConfig(preset *MCUClockPreset) ClockSystemConfig {
	if preset == nil {
		preset = &Preset8051
	}
	return ClockSystemConfig{
		Source:            ClockSourceInternal,
		Frequency:         preset.InternalOscFreq,
		PLLMultiplier:     1,
		ExternalFrequency: 0,
		Preset:            *preset,
		SimTimeStep:       1.0 / preset.InternalOscFreq,
	}
}

// ==================== 时钟系统 ====================

// ClockSystem 仿真时钟核心
type ClockSystem struct {
	config              ClockSystemConfig
	SimTime             float64 // 当前仿真时间 (秒)
	TickCount           int64   // 时钟周期计数
	MachineCycleCount   int64   // 机器周期计数
	InstructionCount    int64   // 指令计数
	Running             bool
}

// NewClockSystem 创建时钟系统
func NewClockSystem(config ClockSystemConfig) *ClockSystem {
	return &ClockSystem{
		config: config,
	}
}

// Frequency 获取当前系统频率
func (c *ClockSystem) Frequency() float64 {
	switch c.config.Source {
	case ClockSourceInternal:
		return c.config.Frequency
	case ClockSourceExternal:
		if c.config.ExternalFrequency > 0 {
			return c.config.ExternalFrequency
		}
		return c.config.Frequency
	case ClockSourcePLL:
		return c.config.Frequency * float64(c.config.PLLMultiplier)
	}
	return c.config.Frequency
}

// ClockPeriod 获取时钟周期 (秒)
func (c *ClockSystem) ClockPeriod() float64 {
	return 1.0 / c.Frequency()
}

// MachineCyclePeriod 获取机器周期 (秒)
func (c *ClockSystem) MachineCyclePeriod() float64 {
	return c.ClockPeriod() * float64(c.config.Preset.ClocksPerInstruction)
}

// SetFrequency 设置系统时钟频率
func (c *ClockSystem) SetFrequency(freq float64) error {
	if freq < 1 || freq > 100_000_000 {
		return fmt.Errorf("频率超出范围 1Hz~100MHz: %f", freq)
	}
	c.config.Frequency = freq
	c.config.SimTimeStep = 1.0 / freq
	return nil
}

// AdvanceTicks 推进指定数量的时钟周期
func (c *ClockSystem) AdvanceTicks(ticks int) float64 {
	cpi := c.config.Preset.ClocksPerInstruction
	for i := 0; i < ticks; i++ {
		c.TickCount++
		c.SimTime += c.ClockPeriod()
		if int(c.TickCount)%cpi == 0 {
			c.MachineCycleCount++
			c.InstructionCount++
		}
	}
	return c.SimTime
}

// AdvanceTime 推进指定仿真时间
func (c *ClockSystem) AdvanceTime(seconds float64) int {
	ticks := int(math.Floor(seconds / c.ClockPeriod()))
	c.AdvanceTicks(ticks)
	return ticks
}

// GetDividedFrequency 获取分频后的频率
func (c *ClockSystem) GetDividedFrequency(prescaler int) float64 {
	return c.Frequency() / float64(prescaler)
}

// CalculateTimerReload 计算定时器初值
func (c *ClockSystem) CalculateTimerReload(targetSeconds float64, prescaler int, bitWidth int) int {
	divFreq := c.GetDividedFrequency(prescaler)
	ticksNeeded := int(math.Round(targetSeconds * divFreq))
	maxCount := (1 << bitWidth) - 1
	return maxCount - (ticksNeeded % (maxCount + 1))
}

// Reset 重置时钟
func (c *ClockSystem) Reset() {
	c.SimTime = 0
	c.TickCount = 0
	c.MachineCycleCount = 0
	c.InstructionCount = 0
	c.Running = false
}

// LoadPreset 加载 MCU 预设
func (c *ClockSystem) LoadPreset(preset MCUClockPreset) {
	c.config.Preset = preset
	c.config.Frequency = preset.InternalOscFreq
	c.config.SimTimeStep = 1.0 / preset.InternalOscFreq
}
