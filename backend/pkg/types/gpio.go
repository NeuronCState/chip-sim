// Package types GPIO 引脚行为建模类型定义
package types

// ==================== GPIO 引脚模式 ====================

// GPIOMode GPIO 引脚工作模式
type GPIOMode string

const (
	GPIOModeInput   GPIOMode = "input"   // 输入模式
	GPIOModeOutput  GPIOMode = "output"  // 输出模式
	GPIOModeAnalog  GPIOMode = "analog"  // 模拟输入（ADC）
	GPIOModePWM     GPIOMode = "pwm"     // PWM 输出
)

// ==================== 上拉/下拉配置 ====================

// GPIOPull GPIO 上拉/下拉配置
type GPIOPull string

const (
	GPIOPullNone GPIOPull = "none" // 无上下拉
	GPIOPullUp   GPIOPull = "up"   // 上拉
	GPIOPullDown GPIOPull = "down" // 下拉
)

// ==================== 输出驱动类型 ====================

// GPIOOutputType GPIO 输出驱动类型
type GPIOOutputType string

const (
	GPIOOutputPushPull  GPIOOutputType = "push_pull"  // 推挽输出
	GPIOOutputOpenDrain GPIOOutputType = "open_drain" // 开漏输出
)

// ==================== 引脚电平 ====================

// GPIOLevel GPIO 电平状态
type GPIOLevel string

const (
	GPIOLevelLow      GPIOLevel = "low"       // 低电平
	GPIOLevelHigh     GPIOLevel = "high"      // 高电平
	GPIOLevelFloating GPIOLevel = "floating"  // 浮空/高阻态
)

// ==================== 中断触发模式 ====================

// GPIOInterruptTrigger 中断触发方式
type GPIOInterruptTrigger string

const (
	GPIOInterruptNone    GPIOInterruptTrigger = "none"     // 无中断
	GPIOInterruptRising  GPIOInterruptTrigger = "rising"   // 上升沿触发
	GPIOInterruptFalling GPIOInterruptTrigger = "falling"  // 下降沿触发
	GPIOInterruptBoth    GPIOInterruptTrigger = "both"     // 双边沿触发
	GPIOInterruptLevel   GPIOInterruptTrigger = "level"    // 电平触发
)

// ==================== GPIO 引脚配置 ====================

// GPIOPinConfig 单个 GPIO 引脚的完整配置
type GPIOPinConfig struct {
	PinNumber     int                  `json:"pinNumber"`     // 引脚编号（如 PA0=0）
	Name          string               `json:"name"`          // 引脚名称（如 "PA0"）
	Mode          GPIOMode             `json:"mode"`          // 工作模式
	Pull          GPIOPull             `json:"pull"`          // 上拉/下拉
	OutputType    GPIOOutputType       `json:"outputType"`    // 输出驱动类型
	PullResistance float64             `json:"pullResistance"` // 上拉/下拉电阻值（Ω）
	SourceCurrent  float64             `json:"sourceCurrent"`  // 最大源电流（mA）
	SinkCurrent   float64             `json:"sinkCurrent"`    // 最大灌电流（mA）
	InterruptMode GPIOInterruptTrigger `json:"interruptMode"` // 中断触发模式
	// ADC 参数
	ADCRefVoltage float64 `json:"adcRefVoltage"` // ADC 参考电压（V）
	ADCResolution int     `json:"adcResolution"` // ADC 分辨率位数（如 10, 12）
	// PWM 参数
	PWMFrequency float64 `json:"pwmFrequency"` // PWM 频率（Hz）
	PWMDutyCycle float64 `json:"pwmDutyCycle"` // PWM 占空比（0.0 ~ 1.0）
}

// ==================== GPIO 引脚实时状态 ====================

// GPIOPinState GPIO 引脚运行时仿真状态
type GPIOPinState struct {
	PinNumber    int       `json:"pinNumber"`
	Level        GPIOLevel `json:"level"`        // 当前电平
	Voltage      float64   `json:"voltage"`      // 当前电压（V）
	Current      float64   `json:"current"`      // 当前电流（mA）
	ADCValue     int       `json:"adcValue"`     // ADC 转换结果
	PWMOutput    float64   `json:"pwmOutput"`    // PWM 当前输出电压
	InterruptPending bool  `json:"interruptPending"` // 是否有待处理中断
}

// ==================== MCU 元件配置 ====================

// MCUConfig 虚拟 MCU 元件的完整配置
type MCUConfig struct {
	ChipName     string           `json:"chipName"`     // 芯片名称（如 "STM32F103"）
	VDD          float64          `json:"vdd"`          // 供电电压（V）
	GroundRef    float64          `json:"groundRef"`    // 接地参考电压
	Pins         []GPIOPinConfig  `json:"pins"`         // 引脚配置列表
}

// DefaultMCUConfig 创建默认的 MCU 配置
func DefaultMCUConfig() MCUConfig {
	pins := make([]GPIOPinConfig, 16)
	for i := 0; i < 16; i++ {
		pins[i] = GPIOPinConfig{
			PinNumber:      i,
			Name:           pinNameFromIndex(i),
			Mode:           GPIOModeInput,
			Pull:           GPIOPullNone,
			OutputType:     GPIOOutputPushPull,
			PullResistance: 40000, // 40kΩ 典型值
			SourceCurrent:  20,    // 20mA
			SinkCurrent:    20,
			InterruptMode:  GPIOInterruptNone,
			ADCRefVoltage:  3.3,
			ADCResolution:  12,
			PWMFrequency:   1000,
			PWMDutyCycle:   0.5,
		}
	}
	return MCUConfig{
		ChipName:  "VirtualMCU",
		VDD:       3.3,
		GroundRef: 0.0,
		Pins:      pins,
	}
}

// pinNameFromIndex 根据索引生成引脚名称 PA0~PA7, PB0~PB7
func pinNameFromIndex(i int) string {
	port := byte('A') + byte(i/8)
	num := i % 8
	return "P" + string(rune(port)) + itoa(num)
}

func itoa(n int) string {
	if n < 0 || n > 9 {
		return "?"
	}
	return string(rune('0' + n))
}

// ==================== 仿真输入输出 ====================

// GPIOExternalSignal 外部输入到引脚的信号
type GPIOExternalSignal struct {
	PinNumber int     `json:"pinNumber"`
	Voltage   float64 `json:"voltage"` // 外部施加的电压
}

// GPIOSimulationStep GPIO 仿真单步输入
type GPIOSimulationStep struct {
	ExternalSignals []GPIOExternalSignal `json:"externalSignals"` // 外部信号
	Time            float64             `json:"time"`            // 当前仿真时间（s）
}

// GPIOSimulationResult GPIO 仿真单步输出
type GPIOSimulationResult struct {
	PinStates []GPIOPinState `json:"pinStates"` // 所有引脚状态
	Time      float64       `json:"time"`      // 仿真时间
}
