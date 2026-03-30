// Package types 仿真相关类型定义
package types

import "time"

// ==================== 仿真配置 ====================

// AnalysisType 仿真分析类型
type AnalysisType string

const (
	AnalysisDC        AnalysisType = "dc"
	AnalysisAC        AnalysisType = "ac"
	AnalysisTransient AnalysisType = "transient"
	AnalysisDigital   AnalysisType = "digital" // 数字逻辑仿真
)

// DCAnalysisConfig 直流分析配置
type DCAnalysisConfig struct {
	Type         AnalysisType `json:"type"`
	SweepSource  string       `json:"sweepSource,omitempty"`
	SweepStart   float64      `json:"sweepStart,omitempty"`
	SweepStop    float64      `json:"sweepStop,omitempty"`
	SweepStep    float64      `json:"sweepStep,omitempty"`
}

// ACSweepMode AC 扫描模式
type ACSweepMode string

const (
	SweepLog    ACSweepMode = "log"
	SweepLinear ACSweepMode = "linear"
)

// ACAnalysisConfig 交流分析配置
type ACAnalysisConfig struct {
	Type             AnalysisType `json:"type"`
	SweepMode        ACSweepMode  `json:"sweepMode,omitempty"` // "log" (default) or "linear"
	StartFreq        float64      `json:"startFreq"`
	StopFreq         float64      `json:"stopFreq"`
	PointsPerDecade  int          `json:"pointsPerDecade,omitempty"` // for log sweep
	NumPoints        int          `json:"numPoints,omitempty"`       // for linear sweep
	InputSource      string       `json:"inputSource,omitempty"`     // AC source ID for transfer function
	OutputNode       string       `json:"outputNode,omitempty"`      // output node name for transfer function
}

// TransientAnalysisConfig 瞬态分析配置
type TransientAnalysisConfig struct {
	Type            AnalysisType      `json:"type"`
	StepTime        float64           `json:"stepTime"`
	StopTime        float64           `json:"stopTime"`
	MaxStep         float64           `json:"maxStep,omitempty"`
	MinStep         float64           `json:"minStep,omitempty"`
	AdaptiveStep    bool              `json:"adaptiveStep,omitempty"`
	InitialVoltages map[string]float64 `json:"initialVoltages,omitempty"` // nodeID -> initial voltage
	TruncErrorTol   float64           `json:"truncErrorTol,omitempty"`   // truncation error tolerance for adaptive step
}

// SimulationConfig 仿真配置
type SimulationConfig struct {
	Analysis AnalysisConfig `json:"analysis"`
	Enabled  bool           `json:"enabled"`
}

// AnalysisConfig 仿真分析配置接口（JSON 多态）
type AnalysisConfig struct {
	Type             AnalysisType      `json:"type"`
	SweepSource      string            `json:"sweepSource,omitempty"`
	SweepStart       float64           `json:"sweepStart,omitempty"`
	SweepStop        float64           `json:"sweepStop,omitempty"`
	SweepStep        float64           `json:"sweepStep,omitempty"`
	SweepMode        ACSweepMode       `json:"sweepMode,omitempty"`
	StartFreq        float64           `json:"startFreq,omitempty"`
	StopFreq         float64           `json:"stopFreq,omitempty"`
	PointsPerDecade  int               `json:"pointsPerDecade,omitempty"`
	NumPoints        int               `json:"numPoints,omitempty"`
	InputSource      string            `json:"inputSource,omitempty"`
	OutputNode       string            `json:"outputNode,omitempty"`
	StepTime         float64           `json:"stepTime,omitempty"`
	StopTime         float64           `json:"stopTime,omitempty"`
	MaxStep          float64           `json:"maxStep,omitempty"`
	MinStep          float64           `json:"minStep,omitempty"`
	AdaptiveStep     bool              `json:"adaptiveStep,omitempty"`
	InitialVoltages  map[string]float64 `json:"initialVoltages,omitempty"`
	TruncErrorTol    float64           `json:"truncErrorTol,omitempty"`
}

// ==================== 仿真结果 ====================

// SimulationDataPoint 仿真数据点
type SimulationDataPoint struct {
	X float64 `json:"x"` // 时间或频率
	Y float64 `json:"y"` // 电压或电流值
}

// SimulationChannel 仿真数据通道
type SimulationChannel struct {
	Name   string                 `json:"name"`   // 通道名称
	NodeID string                 `json:"nodeId"` // 关联节点 ID
	Data   []SimulationDataPoint  `json:"data"`   // 数据点
	Color  string                 `json:"color"`  // 显示颜色
	Visible bool                  `json:"visible"` // 是否可见
}

// SimulationStatus 仿真状态
type SimulationStatus string

const (
	StatusRunning   SimulationStatus = "running"
	StatusCompleted SimulationStatus = "completed"
	StatusError     SimulationStatus = "error"
)

// SimulationResult 仿真结果
type SimulationResult struct {
	ProjectID    string             `json:"projectId"`
	Timestamp    time.Time          `json:"timestamp"`
	AnalysisType AnalysisType       `json:"analysisType"`
	Channels     []SimulationChannel `json:"channels"`
	Status       SimulationStatus   `json:"status"`
	Error        string             `json:"error,omitempty"`
}

// ==================== 电路工程 ====================

// CircuitProject 电路工程文件
type CircuitProject struct {
	ID               string            `json:"id"`
	Name             string            `json:"name"`
	CreatedAt        time.Time         `json:"createdAt"`
	UpdatedAt        time.Time         `json:"updatedAt"`
	Components       []Component       `json:"components"`
	Nodes            []CircuitNode     `json:"nodes"`
	Wires            []Wire            `json:"wires"`
	SimulationConfig SimulationConfig  `json:"simulationConfig"`
}
