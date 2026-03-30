// Package engine MCU 定时器/计数器模块
// 支持 8/16 位定时器，普通/CTC/PWM/输入捕获模式
package engine

import (
	"math"
)

// ==================== 定时器模式 ====================

// TimerMode 定时器工作模式
type TimerMode string

const (
	TimerModeNormal          TimerMode = "normal"           // 普通模式
	TimerModeCTC             TimerMode = "ctc"              // CTC 模式
	TimerModeFastPWM         TimerMode = "fast_pwm"         // 快速 PWM
	TimerModePhaseCorrectPWM TimerMode = "phase_correct_pwm" // 相位校正 PWM
	TimerModeInputCapture    TimerMode = "input_capture"    // 输入捕获
	TimerModeOneShot         TimerMode = "one_shot"         // 单次触发
)

// TimerDirection 定时器计数方向
type TimerDirection string

const (
	TimerDirUp     TimerDirection = "up"
	TimerDirDown   TimerDirection = "down"
	TimerDirUpDown TimerDirection = "up_down"
)

// TimerClockSource 定时器时钟源
type TimerClockSource string

const (
	TimerClockSystem       TimerClockSource = "system"     // 系统时钟
	TimerClockExternalPin  TimerClockSource = "external"   // 外部引脚
	TimerClockExtRising    TimerClockSource = "ext_rise"   // 外部上升沿
	TimerClockExtFalling   TimerClockSource = "ext_fall"   // 外部下降沿
)

// ==================== 定时器配置 ====================

// PWMConfig PWM 配置
type PWMConfig struct {
	Frequency       float64 `json:"frequency"`       // PWM 频率
	DutyCycle       float64 `json:"dutyCycle"`       // 占空比 (0.0 ~ 1.0)
	OutputPin       string  `json:"outputPin"`       // 输出引脚
	OutputMode      string  `json:"outputMode"`      // 输出模式
	DeadTimeEnabled bool    `json:"deadTimeEnabled"` // 死区时间使能
	DeadTimeCycles  int     `json:"deadTimeCycles"`  // 死区时间
}

// InputCaptureConfig 输入捕获配置
type InputCaptureConfig struct {
	CapturePin   string `json:"capturePin"`   // 捕获引脚
	CaptureEdge  string `json:"captureEdge"`  // 捕获边沿
	NoiseCancel  bool   `json:"noiseCancel"`  // 噪声取消器
	UseInterrupt bool   `json:"useInterrupt"` // 使用中断
}

// TimerConfig 定时器配置
type TimerConfig struct {
	ID                       string               `json:"id"`
	Name                     string               `json:"name"`
	BitWidth                 int                  `json:"bitWidth"`       // 8 或 16
	Mode                     TimerMode            `json:"mode"`
	ClockSource              TimerClockSource     `json:"clockSource"`
	Prescaler                int                  `json:"prescaler"`
	Direction                TimerDirection       `json:"direction"`
	InitialValue             int                  `json:"initialValue"`
	CompareValue             int                  `json:"compareValue"`
	OverflowInterruptSource  *InterruptSourceType `json:"overflowInterruptSource,omitempty"`
	CompareInterruptSource   *InterruptSourceType `json:"compareInterruptSource,omitempty"`
	CaptureInterruptSource   *InterruptSourceType `json:"captureInterruptSource,omitempty"`
	PWMConfig                *PWMConfig           `json:"pwmConfig,omitempty"`
	CaptureConfig            *InputCaptureConfig  `json:"captureConfig,omitempty"`
}

// ==================== 定时器运行时状态 ====================

// TimerState 定时器运行时状态
type TimerState struct {
	ID               string  `json:"id"`
	Counter          int     `json:"counter"`
	OverflowFlag     bool    `json:"overflowFlag"`
	CompareMatchFlag bool    `json:"compareMatchFlag"`
	CaptureValue     int     `json:"captureValue"`
	CaptureFlag      bool    `json:"captureFlag"`
	Running          bool    `json:"running"`
	TotalTicks       int64   `json:"totalTicks"`
	OverflowCount    int64   `json:"overflowCount"`
	PWMOutput        bool    `json:"pwmOutput"`
	PWMDutyValue     int     `json:"pwmDutyValue"`
	CaptureRiseCount int     `json:"captureRiseCount"`
	CaptureFallCount int     `json:"captureFallCount"`
}

// PWMWaveformPoint PWM 波形数据点
type PWMWaveformPoint struct {
	Time     float64 `json:"time"`
	Value    int     `json:"value"`    // 0 或 1
	Duration float64 `json:"duration"` // 该状态持续时间
}

// ==================== 定时器 ====================

// Timer 单个定时器实例
type Timer struct {
	Config              TimerConfig
	State               TimerState
	ExternalPinLevel    bool
	PrevExternalPinLevel bool
	phaseUp             bool // 相位校正 PWM 计数方向
	pwmWaveform         []PWMWaveformPoint
	maxWaveformPoints   int
}

// NewTimer 创建定时器
func NewTimer(config TimerConfig) *Timer {
	_ = (1 << config.BitWidth) - 1 // maxCount used for overflow detection in Step()
	return &Timer{
		Config: config,
		State: TimerState{
			ID:       config.ID,
			Counter:  config.InitialValue,
			Running:  false,
		},
		pwmWaveform:       make([]PWMWaveformPoint, 0),
		maxWaveformPoints: 500,
	}
}

// maxCount 获取最大计数值
func (t *Timer) maxCount() int {
	return (1 << t.Config.BitWidth) - 1
}

// Start 启动定时器
func (t *Timer) Start() {
	t.State.Running = true
}

// Stop 停止定时器
func (t *Timer) Stop() {
	t.State.Running = false
}

// Reset 重置定时器
func (t *Timer) Reset() {
	t.State.Counter = t.Config.InitialValue
	t.State.OverflowFlag = false
	t.State.CompareMatchFlag = false
	t.State.CaptureFlag = false
	t.State.TotalTicks = 0
	t.State.OverflowCount = 0
	t.State.PWMOutput = false
	t.pwmWaveform = make([]PWMWaveformPoint, 0)
	t.phaseUp = true
}

// SetCounter 写入计数值
func (t *Timer) SetCounter(value int) {
	t.State.Counter = value & t.maxCount()
}

// GetCounter 读取计数值
func (t *Timer) GetCounter() int {
	return t.State.Counter
}

// SetCompareValue 写入比较值
func (t *Timer) SetCompareValue(value int) {
	t.Config.CompareValue = value & t.maxCount()
}

// SetExternalPin 设置外部引脚电平
func (t *Timer) SetExternalPin(level bool) {
	t.PrevExternalPinLevel = t.ExternalPinLevel
	t.ExternalPinLevel = level
}

// SetPWMDutyCycle 设置 PWM 占空比
func (t *Timer) SetPWMDutyCycle(duty float64) {
	if t.Config.PWMConfig != nil {
		t.Config.PWMConfig.DutyCycle = math.Max(0, math.Min(1, duty))
	}
}

// GetPWMWaveform 获取 PWM 波形数据
func (t *Timer) GetPWMWaveform() []PWMWaveformPoint {
	result := make([]PWMWaveformPoint, len(t.pwmWaveform))
	copy(result, t.pwmWaveform)
	return result
}

// Step 时钟步进 — 每个系统时钟周期调用
// 返回 true 表示发生溢出或比较匹配
func (t *Timer) Step(ic *InterruptController, simTime float64) bool {
	if !t.State.Running {
		return false
	}

	clockTick := false

	// 确定时钟源
	switch t.Config.ClockSource {
	case TimerClockSystem:
		t.State.TotalTicks++
		if t.State.TotalTicks%int64(t.Config.Prescaler) == 0 {
			clockTick = true
		}
	case TimerClockExtRising:
		if !t.PrevExternalPinLevel && t.ExternalPinLevel {
			clockTick = true
		}
	case TimerClockExtFalling:
		if t.PrevExternalPinLevel && !t.ExternalPinLevel {
			clockTick = true
		}
	case TimerClockExternalPin:
		if t.ExternalPinLevel {
			clockTick = true
		}
	}

	if !clockTick {
		return false
	}

	// 根据模式更新计数器
	switch t.Config.Mode {
	case TimerModeNormal:
		return t.stepNormal(ic, simTime)
	case TimerModeCTC:
		return t.stepCTC(ic, simTime)
	case TimerModeFastPWM:
		return t.stepFastPWM(ic, simTime)
	case TimerModePhaseCorrectPWM:
		return t.stepPhaseCorrectPWM(ic, simTime)
	case TimerModeInputCapture:
		return t.stepInputCapture(ic, simTime)
	case TimerModeOneShot:
		return t.stepOneShot(ic, simTime)
	}
	return false
}

// stepNormal 普通模式
func (t *Timer) stepNormal(ic *InterruptController, simTime float64) bool {
	maxCount := t.maxCount()

	if t.Config.Direction == TimerDirUp {
		t.State.Counter++
		if t.State.Counter > maxCount {
			t.State.Counter = 0
			t.State.OverflowFlag = true
			t.State.OverflowCount++
			t.triggerOverflowInterrupt(ic)
			return true
		}
	} else {
		if t.State.Counter == 0 {
			t.State.Counter = maxCount
			t.State.OverflowFlag = true
			t.State.OverflowCount++
			t.triggerOverflowInterrupt(ic)
			return true
		}
		t.State.Counter--
	}
	return false
}

// stepCTC CTC 模式
func (t *Timer) stepCTC(ic *InterruptController, simTime float64) bool {
	t.State.Counter++
	maxCount := t.maxCount()
	event := false

	if t.State.Counter >= t.Config.CompareValue {
		t.State.Counter = 0
		t.State.CompareMatchFlag = true
		t.triggerCompareInterrupt(ic)
		event = true
	}

	if t.State.Counter > maxCount {
		t.State.Counter = 0
		t.State.OverflowFlag = true
		t.State.OverflowCount++
		t.triggerOverflowInterrupt(ic)
		event = true
	}
	return event
}

// stepFastPWM 快速 PWM 模式
func (t *Timer) stepFastPWM(ic *InterruptController, simTime float64) bool {
	t.State.Counter++
	maxCount := t.maxCount()
	event := false

	// 比较匹配
	if t.State.Counter == t.Config.CompareValue {
		t.State.CompareMatchFlag = true
		t.triggerCompareInterrupt(ic)
		t.State.PWMOutput = !t.State.PWMOutput
		t.recordPWMWaveform(simTime, t.State.PWMOutput)
		event = true
	}

	// 溢出
	if t.State.Counter > maxCount {
		t.State.Counter = 0
		t.State.OverflowFlag = true
		t.State.OverflowCount++
		t.triggerOverflowInterrupt(ic)
		t.State.PWMOutput = true
		t.recordPWMWaveform(simTime, true)
		event = true
	}

	if t.Config.PWMConfig != nil {
		t.State.PWMDutyValue = int(math.Round(t.Config.PWMConfig.DutyCycle * float64(maxCount)))
	}

	return event
}

// stepPhaseCorrectPWM 相位校正 PWM 模式
func (t *Timer) stepPhaseCorrectPWM(ic *InterruptController, simTime float64) bool {
	maxCount := t.maxCount()

	if t.Config.Direction == TimerDirUpDown {
		if t.phaseUp {
			t.State.Counter++
			if t.State.Counter >= maxCount {
				t.phaseUp = false
			}
		} else {
			t.State.Counter--
			if t.State.Counter == 0 {
				t.phaseUp = true
			}
		}

		event := false
		if t.State.Counter == t.Config.CompareValue {
			t.State.CompareMatchFlag = true
			t.State.PWMOutput = !t.State.PWMOutput
			t.triggerCompareInterrupt(ic)
			t.recordPWMWaveform(simTime, t.State.PWMOutput)
			event = true
		}

		if t.State.Counter == 0 || t.State.Counter == maxCount {
			t.State.OverflowFlag = true
			t.State.OverflowCount++
			t.triggerOverflowInterrupt(ic)
			event = true
		}
		return event
	}

	// 非上下计数则回退到快速 PWM
	return t.stepFastPWM(ic, simTime)
}

// stepInputCapture 输入捕获模式
func (t *Timer) stepInputCapture(ic *InterruptController, simTime float64) bool {
	t.stepNormal(ic, simTime)

	config := t.Config.CaptureConfig
	if config == nil {
		return false
	}

	captureTriggered := false
	switch config.CaptureEdge {
	case "rising":
		captureTriggered = !t.PrevExternalPinLevel && t.ExternalPinLevel
	case "falling":
		captureTriggered = t.PrevExternalPinLevel && !t.ExternalPinLevel
	case "both":
		captureTriggered = t.PrevExternalPinLevel != t.ExternalPinLevel
	}

	if captureTriggered {
		t.State.CaptureValue = t.State.Counter
		t.State.CaptureFlag = true
		if t.ExternalPinLevel {
			t.State.CaptureRiseCount++
		} else {
			t.State.CaptureFallCount++
		}
		t.triggerCaptureInterrupt(ic)
		return true
	}
	return false
}

// stepOneShot 单次触发模式
func (t *Timer) stepOneShot(ic *InterruptController, simTime float64) bool {
	if !t.State.Running {
		return false
	}

	if t.Config.Direction == TimerDirUp {
		t.State.Counter++
		if t.State.Counter >= t.Config.CompareValue {
			t.State.Counter = t.Config.CompareValue
			t.State.Running = false
			t.State.CompareMatchFlag = true
			t.triggerCompareInterrupt(ic)
			return true
		}
	} else {
		if t.State.Counter == 0 {
			t.State.Running = false
			t.State.OverflowFlag = true
			t.triggerOverflowInterrupt(ic)
			return true
		}
		t.State.Counter--
	}
	return false
}

// triggerOverflowInterrupt 触发溢出中断
func (t *Timer) triggerOverflowInterrupt(ic *InterruptController) {
	if t.Config.OverflowInterruptSource != nil {
		ic.RequestInterrupt(*t.Config.OverflowInterruptSource)
	}
}

// triggerCompareInterrupt 触发比较匹配中断
func (t *Timer) triggerCompareInterrupt(ic *InterruptController) {
	if t.Config.CompareInterruptSource != nil {
		ic.RequestInterrupt(*t.Config.CompareInterruptSource)
	}
}

// triggerCaptureInterrupt 触发捕获中断
func (t *Timer) triggerCaptureInterrupt(ic *InterruptController) {
	if t.Config.CaptureInterruptSource != nil {
		ic.RequestInterrupt(*t.Config.CaptureInterruptSource)
	}
}

// recordPWMWaveform 记录 PWM 波形数据
func (t *Timer) recordPWMWaveform(time float64, value bool) {
	v := 0
	if value {
		v = 1
	}

	t.pwmWaveform = append(t.pwmWaveform, PWMWaveformPoint{
		Time:     time,
		Value:    v,
		Duration: 0,
	})

	// 更新上一个点的持续时间
	if len(t.pwmWaveform) >= 2 {
		prev := &t.pwmWaveform[len(t.pwmWaveform)-2]
		curr := t.pwmWaveform[len(t.pwmWaveform)-1]
		prev.Duration = curr.Time - prev.Time
	}

	// 限制波形记录长度
	if len(t.pwmWaveform) > t.maxWaveformPoints {
		t.pwmWaveform = t.pwmWaveform[len(t.pwmWaveform)-t.maxWaveformPoints:]
	}
}

// ==================== 定时器模块 ====================

// TimerModule 定时器/计数器模块管理器
type TimerModule struct {
	timers map[string]*Timer
}

// NewTimerModule 创建定时器模块
func NewTimerModule() *TimerModule {
	return &TimerModule{
		timers: make(map[string]*Timer),
	}
}

// CreateTimer 创建并注册定时器
func (tm *TimerModule) CreateTimer(config TimerConfig) {
	tm.timers[config.ID] = NewTimer(config)
}

// GetTimer 获取定时器
func (tm *TimerModule) GetTimer(id string) *Timer {
	return tm.timers[id]
}

// StartTimer 启动指定定时器
func (tm *TimerModule) StartTimer(id string) {
	if t, ok := tm.timers[id]; ok {
		t.Start()
	}
}

// StopTimer 停止指定定时器
func (tm *TimerModule) StopTimer(id string) {
	if t, ok := tm.timers[id]; ok {
		t.Stop()
	}
}

// ResetTimer 重置指定定时器
func (tm *TimerModule) ResetTimer(id string) {
	if t, ok := tm.timers[id]; ok {
		t.Reset()
	}
}

// StartAll 启动所有定时器
func (tm *TimerModule) StartAll() {
	for _, t := range tm.timers {
		t.Start()
	}
}

// StopAll 停止所有定时器
func (tm *TimerModule) StopAll() {
	for _, t := range tm.timers {
		t.Stop()
	}
}

// Step 时钟步进
func (tm *TimerModule) Step(ic *InterruptController, simTime float64) bool {
	anyEvent := false
	for _, t := range tm.timers {
		if t.Step(ic, simTime) {
			anyEvent = true
		}
	}
	return anyEvent
}

// SetExternalPin 设置外部引脚电平
func (tm *TimerModule) SetExternalPin(timerID string, level bool) {
	if t, ok := tm.timers[timerID]; ok {
		t.SetExternalPin(level)
	}
}

// SetPWMDutyCycle 设置 PWM 占空比
func (tm *TimerModule) SetPWMDutyCycle(timerID string, duty float64) {
	if t, ok := tm.timers[timerID]; ok {
		t.SetPWMDutyCycle(duty)
	}
}

// SetCounter 写入定时器计数值
func (tm *TimerModule) SetCounter(id string, value int) {
	if t, ok := tm.timers[id]; ok {
		t.SetCounter(value)
	}
}

// GetCounter 读取定时器计数值
func (tm *TimerModule) GetCounter(id string) int {
	if t, ok := tm.timers[id]; ok {
		return t.GetCounter()
	}
	return 0
}

// GetAllStates 获取所有定时器状态
func (tm *TimerModule) GetAllStates() []TimerState {
	states := make([]TimerState, 0, len(tm.timers))
	for _, t := range tm.timers {
		states = append(states, t.State)
	}
	return states
}

// GetPWMWaveform 获取 PWM 波形数据
func (tm *TimerModule) GetPWMWaveform(id string) []PWMWaveformPoint {
	if t, ok := tm.timers[id]; ok {
		return t.GetPWMWaveform()
	}
	return nil
}

// Reset 重置所有定时器
func (tm *TimerModule) Reset() {
	for _, t := range tm.timers {
		t.Reset()
	}
}

// ==================== 预设定时器配置 ====================

// Timer0Config8051 8051 定时器 0 配置
func Timer0Config8051() TimerConfig {
	ovf := IntSourceTimer0Overflow
	cmp := IntSourceTimer0Compare
	return TimerConfig{
		ID:                      "timer0",
		Name:                    "定时器 0 (T0)",
		BitWidth:                8,
		Mode:                    TimerModeNormal,
		ClockSource:             TimerClockSystem,
		Prescaler:               12,
		Direction:               TimerDirUp,
		InitialValue:            0,
		CompareValue:            255,
		OverflowInterruptSource: &ovf,
		CompareInterruptSource:  &cmp,
	}
}

// Timer1Config8051 8051 定时器 1 配置
func Timer1Config8051() TimerConfig {
	ovf := IntSourceTimer1Overflow
	return TimerConfig{
		ID:                      "timer1",
		Name:                    "定时器 1 (T1)",
		BitWidth:                8,
		Mode:                    TimerModeNormal,
		ClockSource:             TimerClockSystem,
		Prescaler:               12,
		Direction:               TimerDirUp,
		InitialValue:            0,
		CompareValue:            255,
		OverflowInterruptSource: &ovf,
	}
}

// Timer0ConfigATmega ATmega 定时器 0 配置
func Timer0ConfigATmega() TimerConfig {
	ovf := IntSourceTimer0Overflow
	cmp := IntSourceTimer0Compare
	return TimerConfig{
		ID:                      "timer0",
		Name:                    "Timer/Counter 0",
		BitWidth:                8,
		Mode:                    TimerModeNormal,
		ClockSource:             TimerClockSystem,
		Prescaler:               1,
		Direction:               TimerDirUp,
		InitialValue:            0,
		CompareValue:            255,
		OverflowInterruptSource: &ovf,
		CompareInterruptSource:  &cmp,
		PWMConfig: &PWMConfig{
			Frequency:  1000,
			DutyCycle:  0.5,
			OutputPin:  "OC0A",
			OutputMode: "non_inverting",
		},
	}
}

// Timer1ConfigATmega ATmega 16 位定时器 1 配置
func Timer1ConfigATmega() TimerConfig {
	ovf := IntSourceTimer1Overflow
	cmp := IntSourceTimer1Compare
	return TimerConfig{
		ID:                      "timer1",
		Name:                    "Timer/Counter 1",
		BitWidth:                16,
		Mode:                    TimerModeNormal,
		ClockSource:             TimerClockSystem,
		Prescaler:               1,
		Direction:               TimerDirUp,
		InitialValue:            0,
		CompareValue:            0xFFFF,
		OverflowInterruptSource: &ovf,
		CompareInterruptSource:  &cmp,
		CaptureInterruptSource:  &cmp,
		CaptureConfig: &InputCaptureConfig{
			CapturePin:   "ICP1",
			CaptureEdge:  "rising",
			NoiseCancel:  false,
			UseInterrupt: true,
		},
		PWMConfig: &PWMConfig{
			Frequency:  1000,
			DutyCycle:  0.5,
			OutputPin:  "OC1A",
			OutputMode: "non_inverting",
		},
	}
}
