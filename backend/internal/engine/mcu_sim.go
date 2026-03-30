// Package engine MCU 仿真引擎
// 整合时钟、中断、定时器模块，作为仿真步进的协调者
package engine

import (
	"context"
	"fmt"
	"time"

	"chip-sim/pkg/types"
)

// ==================== MCU 型号 ====================

// MCUModel MCU 型号类型
type MCUModel string

const (
	MCUModelGeneric8051 MCUModel = "8051"
	MCUModelATmega328P  MCUModel = "atmega328p"
	MCUModelSTM32F103   MCUModel = "stm32f103"
	MCUModelCustom      MCUModel = "custom"
)

// MCUModelConfig MCU 型号配置
type MCUModelConfig struct {
	Model         MCUModel      `json:"model"`
	Name          string        `json:"name"`
	Description   string        `json:"description"`
	ClockPreset   MCUClockPreset `json:"-"`
	MaxTimers     int           `json:"maxTimers"`
	MaxInterrupts int           `json:"maxInterrupts"`
	TimerConfigs  []TimerConfig `json:"timerConfigs"`
}

// ==================== MCU 运行状态 ====================

// MCUState MCU 完整运行状态
type MCUState struct {
	Model                  MCUModel              `json:"model"`
	SimTime                float64               `json:"simTime"`
	TickCount              int64                 `json:"tickCount"`
	MachineCycleCount      int64                 `json:"machineCycleCount"`
	GlobalInterruptEnable  bool                  `json:"globalInterruptEnable"`
	ActiveInterrupt        *InterruptSourceType  `json:"activeInterrupt"`
	Timers                 []TimerState          `json:"timers"`
	Running                bool                  `json:"running"`
}

// ==================== MCU 仿真引擎 ====================

// MCUEngine MCU 仿真引擎
// 整合 ClockSystem + InterruptController + TimerModule
type MCUEngine struct {
	clock         *ClockSystem
	intCtrl       *InterruptController
	timerModule   *TimerModule
	gpioEngine    *GPIOEngine
	model         MCUModel
	running       bool
}

// NewMCUEngine 创建 MCU 仿真引擎
func NewMCUEngine(config MCUModelConfig) *MCUEngine {
	// 初始化时钟
	clockConfig := DefaultClockConfig(&config.ClockPreset)
	clock := NewClockSystem(clockConfig)

	// 初始化中断控制器
	intCtrl := NewInterruptController()

	// 根据型号注册中断源
	switch config.Model {
	case MCUModelGeneric8051:
		intCtrl.RegisterSources(InterruptSources8051)
	default:
		intCtrl.RegisterSources(InterruptSources8051)
	}

	// 初始化定时器模块
	timerModule := NewTimerModule()
	for _, tc := range config.TimerConfigs {
		timerModule.CreateTimer(tc)
	}

	return &MCUEngine{
		clock:       clock,
		intCtrl:     intCtrl,
		timerModule: timerModule,
		model:       config.Model,
	}
}

// SetGPIOEngine 绑定 GPIO 引擎
func (e *MCUEngine) SetGPIOEngine(gpio *GPIOEngine) {
	e.gpioEngine = gpio
}

// ==================== 控制 ====================

// Start 启动仿真
func (e *MCUEngine) Start() {
	e.running = true
	e.clock.Running = true
	e.intCtrl.SetGlobalEnable(true)
	e.timerModule.StartAll()
}

// Stop 停止仿真
func (e *MCUEngine) Stop() {
	e.running = false
	e.clock.Running = false
	e.timerModule.StopAll()
}

// Reset 重置仿真
func (e *MCUEngine) Reset() {
	e.running = false
	e.clock.Reset()
	e.intCtrl.Reset()
	e.timerModule.Reset()
}

// ==================== 仿真步进 ====================

// AdvanceTicks 推进指定数量的时钟周期
// 这是 MCU 仿真引擎的核心步进函数
func (e *MCUEngine) AdvanceTicks(ticks int) MCUState {
	for i := 0; i < ticks; i++ {
		e.clock.AdvanceTicks(1)

		// 每个时钟周期：中断控制器步进 + 定时器步进
		e.intCtrl.Step()
		e.timerModule.Step(e.intCtrl, e.clock.SimTime)
	}
	return e.GetState()
}

// AdvanceTime 推进指定仿真时间
func (e *MCUEngine) AdvanceTime(seconds float64) MCUState {
	ticks := e.clock.AdvanceTime(seconds)
	for i := 0; i < ticks; i++ {
		e.intCtrl.Step()
		e.timerModule.Step(e.intCtrl, e.clock.SimTime)
	}
	return e.GetState()
}

// ==================== 外部交互 ====================

// TriggerExternalInterrupt 触发外部中断
func (e *MCUEngine) TriggerExternalInterrupt(sourceID InterruptSourceType, level bool) {
	e.intCtrl.TriggerExternalInterrupt(sourceID, level)
}

// SetTimerExternalPin 设置定时器外部引脚
func (e *MCUEngine) SetTimerExternalPin(timerID string, level bool) {
	e.timerModule.SetExternalPin(timerID, level)
}

// SetPWMDutyCycle 设置 PWM 占空比
func (e *MCUEngine) SetPWMDutyCycle(timerID string, duty float64) {
	e.timerModule.SetPWMDutyCycle(timerID, duty)
}

// ==================== 中断控制 ====================

// SetGlobalInterruptEnable 设置全局中断使能
func (e *MCUEngine) SetGlobalInterruptEnable(enabled bool) {
	e.intCtrl.SetGlobalEnable(enabled)
}

// SetInterruptEnable 设置中断使能寄存器
func (e *MCUEngine) SetInterruptEnable(value uint8) {
	e.intCtrl.SetInterruptEnableRegister(value)
}

// SetInterruptPriority 设置中断优先级寄存器
func (e *MCUEngine) SetInterruptPriority(value uint8) {
	e.intCtrl.SetInterruptPriorityRegister(value)
}

// ReturnFromInterrupt 中断返回 (RETI)
func (e *MCUEngine) ReturnFromInterrupt(sourceID InterruptSourceType) {
	e.intCtrl.ReturnFromInterrupt(sourceID)
}

// ==================== 定时器控制 ====================

// SetTimerCounter 写入定时器值
func (e *MCUEngine) SetTimerCounter(id string, value int) {
	e.timerModule.SetCounter(id, value)
}

// GetTimerCounter 读取定时器值
func (e *MCUEngine) GetTimerCounter(id string) int {
	return e.timerModule.GetCounter(id)
}

// GetPWMWaveform 获取 PWM 波形
func (e *MCUEngine) GetPWMWaveform(timerID string) []PWMWaveformPoint {
	return e.timerModule.GetPWMWaveform(timerID)
}

// ==================== 频率控制 ====================

// SetSystemClockFrequency 改变系统时钟频率
func (e *MCUEngine) SetSystemClockFrequency(freq float64) error {
	return e.clock.SetFrequency(freq)
}

// LoadPreset 加载 MCU 预设
func (e *MCUEngine) LoadPreset(config MCUModelConfig) {
	e.clock.LoadPreset(config.ClockPreset)
	e.model = config.Model
	e.timerModule = NewTimerModule()
	for _, tc := range config.TimerConfigs {
		e.timerModule.CreateTimer(tc)
	}
}

// ==================== 状态获取 ====================

// GetState 获取完整 MCU 状态
func (e *MCUEngine) GetState() MCUState {
	globalState := e.intCtrl.GetGlobalState()
	return MCUState{
		Model:                 e.model,
		SimTime:               e.clock.SimTime,
		TickCount:             e.clock.TickCount,
		MachineCycleCount:     e.clock.MachineCycleCount,
		GlobalInterruptEnable: globalState.GlobalEnable,
		ActiveInterrupt:       globalState.ActiveInterrupt,
		Timers:                e.timerModule.GetAllStates(),
		Running:               e.running,
	}
}

// ==================== SimulationEngine 接口实现 ====================

// Type 返回分析类型
func (e *MCUEngine) Type() types.AnalysisType {
	return types.AnalysisDigital
}

// Validate 验证电路
func (e *MCUEngine) Validate(project *types.CircuitProject) error {
	if project == nil {
		return ErrInvalidCircuit
	}

	hasMCU := false
	for _, comp := range project.Components {
		if comp.Type == types.ComponentMCU {
			hasMCU = true
			break
		}
	}
	if !hasMCU {
		return fmt.Errorf("%w: no MCU component found", ErrInvalidCircuit)
	}

	return nil
}

// Run 执行 MCU 仿真
func (e *MCUEngine) Run(ctx context.Context, project *types.CircuitProject) (<-chan *types.SimulationResult, error) {
	if err := e.Validate(project); err != nil {
		return nil, err
	}

	cfg := project.SimulationConfig.Analysis
	stopTime := cfg.StopTime
	stepTime := cfg.StepTime
	if stepTime <= 0 {
		stepTime = e.clock.ClockPeriod()
	}
	if stopTime <= 0 {
		stopTime = 0.01 // 默认 10ms
	}

	resultCh := make(chan *types.SimulationResult, 1)

	go func() {
		defer close(resultCh)

		resultCh <- &types.SimulationResult{
			ProjectID:    project.ID,
			Timestamp:    time.Now(),
			AnalysisType: types.AnalysisDigital,
			Status:       types.StatusRunning,
		}

		// 启动仿真
		e.Start()
		defer e.Stop()

		// 数据通道
		timerChannels := make([][]types.SimulationDataPoint, len(e.timerModule.timers))
		timerNames := make([]string, 0, len(e.timerModule.timers))
		for _, t := range e.timerModule.timers {
			timerNames = append(timerNames, t.Config.Name)
		}

		// PWM 输出通道
		pwmChannels := make([][]types.SimulationDataPoint, 0)

		// 时间步进
		t := 0.0
		stepCount := 0
		maxSteps := int(stopTime/stepTime) + 1
		if maxSteps > 2000000 {
			maxSteps = 2000000
		}

		for t < stopTime && stepCount < maxSteps {
			select {
			case <-ctx.Done():
				sendError(resultCh, project, types.AnalysisDigital, "cancelled")
				return
			default:
			}

			// 推进一个时钟周期
			e.AdvanceTicks(1)

			// 记录定时器计数值
			idx := 0
			for _, timer := range e.timerModule.timers {
				timerChannels[idx] = append(timerChannels[idx], types.SimulationDataPoint{
					X: e.clock.SimTime,
					Y: float64(timer.State.Counter),
				})

				// 记录 PWM 输出
				if timer.Config.PWMConfig != nil && timer.State.Running {
					pwmVal := 0.0
					if timer.State.PWMOutput {
						pwmVal = 1.0
					}
					_ = pwmVal // 后续扩展为独立通道
				}
				idx++
			}

			t = e.clock.SimTime
			stepCount++
		}

		// 构建结果通道
		channels := make([]types.SimulationChannel, 0, len(timerChannels)+len(pwmChannels))
		for i, data := range timerChannels {
			if i < len(timerNames) && len(data) > 0 {
				channels = append(channels, types.SimulationChannel{
					Name:    timerNames[i],
					NodeID:  fmt.Sprintf("timer_%d", i),
					Color:   nodeColor(i),
					Visible: true,
					Data:    data,
				})
			}
		}

		resultCh <- &types.SimulationResult{
			ProjectID:    project.ID,
			Timestamp:    time.Now(),
			AnalysisType: types.AnalysisDigital,
			Channels:     channels,
			Status:       types.StatusCompleted,
		}
	}()

	return resultCh, nil
}

// ==================== MCU 预设 ====================

// MCUConfig8051 8051 预设配置
var MCUConfig8051 = MCUModelConfig{
	Model:         MCUModelGeneric8051,
	Name:          "8051 系列",
	Description:   "经典 8051 微控制器，12 时钟/指令",
	ClockPreset:   Preset8051,
	MaxTimers:     2,
	MaxInterrupts: 6,
	TimerConfigs:  []TimerConfig{Timer0Config8051(), Timer1Config8051()},
}

// MCUConfigATmega ATmega328P 预设配置
var MCUConfigATmega = MCUModelConfig{
	Model:         MCUModelATmega328P,
	Name:          "ATmega328P",
	Description:   "AVR 8 位微控制器 (Arduino Uno)",
	ClockPreset:   PresetATmega,
	MaxTimers:     3,
	MaxInterrupts: 26,
	TimerConfigs:  []TimerConfig{Timer0ConfigATmega(), Timer1ConfigATmega()},
}

// MCUConfigSTM32 STM32F103 预设配置
var MCUConfigSTM32 = MCUModelConfig{
	Model:         MCUModelSTM32F103,
	Name:          "STM32F103C8",
	Description:   "ARM Cortex-M3 72MHz (Blue Pill)",
	ClockPreset:   PresetSTM32,
	MaxTimers:     4,
	MaxInterrupts: 60,
	TimerConfigs:  []TimerConfig{Timer0ConfigATmega(), Timer1ConfigATmega()},
}
