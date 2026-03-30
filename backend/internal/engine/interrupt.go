// Package engine MCU 中断控制器
// 支持中断源定义、优先级、嵌套中断、中断向量表
package engine

// ==================== 中断源类型 ====================

// InterruptSourceType 中断源类型
type InterruptSourceType string

const (
	IntSourceExternalINT0    InterruptSourceType = "ext_int0"      // 外部中断 0
	IntSourceExternalINT1    InterruptSourceType = "ext_int1"      // 外部中断 1
	IntSourceTimer0Overflow  InterruptSourceType = "tmr0_ovf"      // 定时器 0 溢出
	IntSourceTimer1Overflow  InterruptSourceType = "tmr1_ovf"      // 定时器 1 溢出
	IntSourceTimer2Overflow  InterruptSourceType = "tmr2_ovf"      // 定时器 2 溢出
	IntSourceTimer0Compare   InterruptSourceType = "tmr0_cmp"      // 定时器 0 比较匹配
	IntSourceTimer1Compare   InterruptSourceType = "tmr1_cmp"      // 定时器 1 比较匹配
	IntSourceUARTReceive     InterruptSourceType = "uart_rx"       // UART 接收
	IntSourceUARTTransmit    InterruptSourceType = "uart_tx"       // UART 发送
	IntSourceSPIComplete     InterruptSourceType = "spi_done"      // SPI 完成
	IntSourceI2CComplete     InterruptSourceType = "i2c_done"      // I2C 完成
	IntSourceADCComplete     InterruptSourceType = "adc_done"      // ADC 完成
	IntSourceSoftware        InterruptSourceType = "swi"           // 软件中断
)

// ==================== 中断触发边沿 ====================

// InterruptEdge 中断触发边沿
type InterruptEdge string

const (
	IntEdgeLowLevel  InterruptEdge = "low_level"
	IntEdgeHighLevel InterruptEdge = "high_level"
	IntEdgeRising    InterruptEdge = "rising"
	IntEdgeFalling   InterruptEdge = "falling"
	IntEdgeBoth      InterruptEdge = "both"
)

// ==================== 中断源配置 ====================

// InterruptSourceConfig 单个中断源的配置
type InterruptSourceConfig struct {
	ID              InterruptSourceType `json:"id"`
	Name            string              `json:"name"`
	VectorAddress   uint16              `json:"vectorAddress"`
	DefaultPriority int                 `json:"defaultPriority"`
	DefaultEdge     InterruptEdge       `json:"defaultEdge"`
	CanBeMasked     bool                `json:"canBeMasked"`
	LatencyCycles  int                 `json:"latencyCycles"`
}

// ==================== 中断源运行时状态 ====================

// InterruptSourceState 单个中断源的运行时状态
type InterruptSourceState struct {
	SourceID      InterruptSourceType `json:"sourceId"`
	Enabled       bool                `json:"enabled"`
	Pending       bool                `json:"pending"`
	InService     bool                `json:"inService"`
	Edge          InterruptEdge       `json:"edge"`
	Priority      int                 `json:"priority"`
	PrevLevel     bool                `json:"prevLevel"`
	FlagNeedsClear bool               `json:"flagNeedsClear"`
}

// ==================== 全局中断状态 ====================

// GlobalInterruptState 全局中断使能状态
type GlobalInterruptState struct {
	GlobalEnable    bool                   `json:"globalEnable"`
	ActiveInterrupt *InterruptSourceType   `json:"activeInterrupt"`
	NestingDepth    int                    `json:"nestingDepth"`
	MaxNestingDepth int                    `json:"maxNestingDepth"`
}

// ==================== 中断控制器 ====================

// InterruptController 中断控制器核心
type InterruptController struct {
	sources       map[InterruptSourceType]*InterruptSourceState
	configs       map[InterruptSourceType]InterruptSourceConfig
	globalState   GlobalInterruptState
	pendingQueue  []InterruptSourceType
	latencyCounters map[InterruptSourceType]int
}

// NewInterruptController 创建中断控制器
func NewInterruptController() *InterruptController {
	return &InterruptController{
		sources:       make(map[InterruptSourceType]*InterruptSourceState),
		configs:       make(map[InterruptSourceType]InterruptSourceConfig),
		globalState:   GlobalInterruptState{MaxNestingDepth: 2},
		pendingQueue:  make([]InterruptSourceType, 0),
		latencyCounters: make(map[InterruptSourceType]int),
	}
}

// RegisterSource 注册中断源
func (ic *InterruptController) RegisterSource(config InterruptSourceConfig) {
	ic.configs[config.ID] = config
	ic.sources[config.ID] = &InterruptSourceState{
		SourceID:       config.ID,
		Enabled:        false,
		Pending:        false,
		InService:      false,
		Edge:           config.DefaultEdge,
		Priority:       config.DefaultPriority,
		PrevLevel:      false,
		FlagNeedsClear: true,
	}
}

// RegisterSources 批量注册中断源
func (ic *InterruptController) RegisterSources(configs []InterruptSourceConfig) {
	for _, cfg := range configs {
		ic.RegisterSource(cfg)
	}
}

// SetGlobalEnable 设置全局中断使能
func (ic *InterruptController) SetGlobalEnable(enabled bool) {
	ic.globalState.GlobalEnable = enabled
}

// IsGlobalEnabled 获取全局中断使能状态
func (ic *InterruptController) IsGlobalEnabled() bool {
	return ic.globalState.GlobalEnable
}

// SetSourceEnable 设置单个中断源使能
func (ic *InterruptController) SetSourceEnable(sourceID InterruptSourceType, enabled bool) {
	state, exists := ic.sources[sourceID]
	if !exists {
		return
	}
	config := ic.configs[sourceID]
	if enabled && !config.CanBeMasked {
		return // NMI 不能被禁止
	}
	state.Enabled = enabled
}

// IsSourceEnabled 检查中断源是否使能
func (ic *InterruptController) IsSourceEnabled(sourceID InterruptSourceType) bool {
	if state, exists := ic.sources[sourceID]; exists {
		return state.Enabled
	}
	return false
}

// SetInterruptEnableRegister 设置中断使能寄存器 (模拟 IE 寄存器)
func (ic *InterruptController) SetInterruptEnableRegister(value uint8) {
	ic.globalState.GlobalEnable = (value & 0x80) != 0

	mapping := []struct {
		source InterruptSourceType
		bit    uint8
	}{
		{IntSourceExternalINT0, 0x01},
		{IntSourceTimer0Overflow, 0x02},
		{IntSourceExternalINT1, 0x04},
		{IntSourceTimer1Overflow, 0x08},
		{IntSourceUARTReceive, 0x10},
		{IntSourceUARTTransmit, 0x10},
	}

	for _, m := range mapping {
		if state, exists := ic.sources[m.source]; exists {
			state.Enabled = (value & m.bit) != 0
		}
	}
}

// GetInterruptEnableRegister 读取中断使能寄存器值
func (ic *InterruptController) GetInterruptEnableRegister() uint8 {
	var value uint8
	if ic.globalState.GlobalEnable {
		value |= 0x80
	}

	if state, ok := ic.sources[IntSourceExternalINT0]; ok && state.Enabled {
		value |= 0x01
	}
	if state, ok := ic.sources[IntSourceTimer0Overflow]; ok && state.Enabled {
		value |= 0x02
	}
	if state, ok := ic.sources[IntSourceExternalINT1]; ok && state.Enabled {
		value |= 0x04
	}
	if state, ok := ic.sources[IntSourceTimer1Overflow]; ok && state.Enabled {
		value |= 0x08
	}
	if state, ok := ic.sources[IntSourceUARTReceive]; ok && state.Enabled {
		value |= 0x10
	}
	return value
}

// SetInterruptPriorityRegister 设置中断优先级寄存器
func (ic *InterruptController) SetInterruptPriorityRegister(value uint8) {
	mapping := []struct {
		source InterruptSourceType
		bit    uint8
	}{
		{IntSourceExternalINT0, 0x01},
		{IntSourceTimer0Overflow, 0x02},
		{IntSourceExternalINT1, 0x04},
		{IntSourceTimer1Overflow, 0x08},
		{IntSourceUARTReceive, 0x10},
	}

	for _, m := range mapping {
		if state, exists := ic.sources[m.source]; exists {
			if (value & m.bit) != 0 {
				state.Priority = 0 // 高优先级
			} else {
				state.Priority = 1 // 低优先级
			}
		}
	}
}

// RequestInterrupt 请求中断
func (ic *InterruptController) RequestInterrupt(sourceID InterruptSourceType) {
	state, exists := ic.sources[sourceID]
	if !exists {
		return
	}
	if !state.Pending {
		state.Pending = true
	}
	ic.evaluateInterruptRequest(sourceID)
}

// TriggerExternalInterrupt 触发外部中断（边沿/电平检测）
func (ic *InterruptController) TriggerExternalInterrupt(sourceID InterruptSourceType, level bool) {
	state, exists := ic.sources[sourceID]
	if !exists {
		return
	}

	prevLevel := state.PrevLevel
	state.PrevLevel = level

	shouldTrigger := false
	switch state.Edge {
	case IntEdgeRising:
		shouldTrigger = !prevLevel && level
	case IntEdgeFalling:
		shouldTrigger = prevLevel && !level
	case IntEdgeBoth:
		shouldTrigger = prevLevel != level
	case IntEdgeHighLevel:
		shouldTrigger = level
	case IntEdgeLowLevel:
		shouldTrigger = !level
	}

	if shouldTrigger {
		ic.RequestInterrupt(sourceID)
	}
}

// evaluateInterruptRequest 评估中断请求
func (ic *InterruptController) evaluateInterruptRequest(sourceID InterruptSourceType) {
	state, exists := ic.sources[sourceID]
	if !exists {
		return
	}

	// 检查全局使能
	if !ic.globalState.GlobalEnable {
		return
	}
	// 检查源使能
	if !state.Enabled {
		return
	}
	// 检查是否已在服务
	if state.InService {
		return
	}

	// 检查嵌套条件
	if ic.globalState.ActiveInterrupt != nil {
		activeState, ok := ic.sources[*ic.globalState.ActiveInterrupt]
		if !ok {
			return
		}
		// 请求优先级必须高于当前服务中断
		if state.Priority >= activeState.Priority {
			ic.enqueuePending(sourceID)
			return
		}
		// 检查嵌套深度
		if ic.globalState.NestingDepth >= ic.globalState.MaxNestingDepth {
			ic.enqueuePending(sourceID)
			return
		}
	}

	// 响应中断 — 设置延迟计数器
	config := ic.configs[sourceID]
	ic.latencyCounters[sourceID] = config.LatencyCycles
}

// Step 时钟步进 — 处理中断延迟和服务状态
func (ic *InterruptController) Step() {
	for sourceID, remaining := range ic.latencyCounters {
		if remaining <= 1 {
			ic.enterISR(sourceID)
			delete(ic.latencyCounters, sourceID)
		} else {
			ic.latencyCounters[sourceID] = remaining - 1
		}
	}
}

// enterISR 进入中断服务程序
func (ic *InterruptController) enterISR(sourceID InterruptSourceType) {
	state, exists := ic.sources[sourceID]
	if !exists {
		return
	}

	// 如果有正在服务的中断，增加嵌套深度
	if ic.globalState.ActiveInterrupt != nil {
		ic.globalState.NestingDepth++
	}

	state.InService = true
	state.Pending = false // 清除挂起标志
	ic.globalState.ActiveInterrupt = &sourceID
}

// ReturnFromInterrupt 中断返回 (RETI)
func (ic *InterruptController) ReturnFromInterrupt(sourceID InterruptSourceType) {
	state, exists := ic.sources[sourceID]
	if !exists {
		return
	}
	state.InService = false

	if ic.globalState.NestingDepth > 0 {
		ic.globalState.NestingDepth--
	}

	if ic.globalState.NestingDepth == 0 {
		ic.globalState.ActiveInterrupt = nil
	}

	// 处理等待中的中断
	ic.processNextPending()
}

// ClearInterruptFlag 手动清除中断标志
func (ic *InterruptController) ClearInterruptFlag(sourceID InterruptSourceType) {
	if state, exists := ic.sources[sourceID]; exists {
		state.Pending = false
	}
}

// enqueuePending 将中断源加入等待队列
func (ic *InterruptController) enqueuePending(sourceID InterruptSourceType) {
	for _, id := range ic.pendingQueue {
		if id == sourceID {
			return
		}
	}
	ic.pendingQueue = append(ic.pendingQueue, sourceID)
}

// processNextPending 处理下一个等待中的中断
func (ic *InterruptController) processNextPending() {
	for len(ic.pendingQueue) > 0 {
		nextID := ic.pendingQueue[0]
		ic.pendingQueue = ic.pendingQueue[1:]
		if state, ok := ic.sources[nextID]; ok && state.Pending && state.Enabled {
			ic.evaluateInterruptRequest(nextID)
			break
		}
	}
}

// GetGlobalState 获取全局中断状态
func (ic *InterruptController) GetGlobalState() GlobalInterruptState {
	return ic.globalState
}

// GetSourceState 获取指定中断源状态
func (ic *InterruptController) GetSourceState(sourceID InterruptSourceType) *InterruptSourceState {
	if state, exists := ic.sources[sourceID]; exists {
		copy := *state
		return &copy
	}
	return nil
}

// GetAllSourceStates 获取所有中断源状态
func (ic *InterruptController) GetAllSourceStates() []InterruptSourceState {
	result := make([]InterruptSourceState, 0, len(ic.sources))
	for _, state := range ic.sources {
		result = append(result, *state)
	}
	return result
}

// GetPendingInterrupts 获取等待中的中断源
func (ic *InterruptController) GetPendingInterrupts() []InterruptSourceType {
	result := make([]InterruptSourceType, len(ic.pendingQueue))
	copy(result, ic.pendingQueue)
	return result
}

// Reset 重置控制器
func (ic *InterruptController) Reset() {
	for _, state := range ic.sources {
		state.Enabled = false
		state.Pending = false
		state.InService = false
		state.PrevLevel = false
	}
	ic.globalState.GlobalEnable = false
	ic.globalState.ActiveInterrupt = nil
	ic.globalState.NestingDepth = 0
	ic.pendingQueue = make([]InterruptSourceType, 0)
	ic.latencyCounters = make(map[InterruptSourceType]int)
}

// ==================== 预设中断源 ====================

// InterruptSources8051 8051 标准中断源
var InterruptSources8051 = []InterruptSourceConfig{
	{IntSourceExternalINT0, "外部中断 0 (INT0)", 0x0003, 0, IntEdgeFalling, true, 3},
	{IntSourceTimer0Overflow, "定时器 0 溢出", 0x000B, 1, IntEdgeHighLevel, true, 3},
	{IntSourceExternalINT1, "外部中断 1 (INT1)", 0x0013, 2, IntEdgeFalling, true, 3},
	{IntSourceTimer1Overflow, "定时器 1 溢出", 0x001B, 3, IntEdgeHighLevel, true, 3},
	{IntSourceUARTReceive, "串口接收 (RI)", 0x0023, 4, IntEdgeHighLevel, true, 3},
	{IntSourceUARTTransmit, "串口发送 (TI)", 0x0023, 4, IntEdgeHighLevel, true, 3},
}
