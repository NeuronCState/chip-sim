// Package engine 仿真引擎接口定义
// 定义所有仿真引擎必须实现的接口
package engine

import (
	"context"

	"chip-sim/pkg/types"
)

// SimulationEngine 仿真引擎接口
// 所有仿真引擎（DC、AC、瞬态）必须实现此接口
type SimulationEngine interface {
	// Run 执行仿真，返回结果通道
	// 仿真过程中可通过 context 取消
	// 结果通过 channel 流式返回，支持实时推送
	Run(ctx context.Context, project *types.CircuitProject) (<-chan *types.SimulationResult, error)

	// Validate 验证电路是否可以进行仿真
	Validate(project *types.CircuitProject) error

	// Type 返回引擎支持的分析类型
	Type() types.AnalysisType
}

// EngineFactory 仿真引擎工厂
// 根据分析类型创建对应的仿真引擎
type EngineFactory func(analysisType types.AnalysisType) (SimulationEngine, error)

// DefaultFactory 默认引擎工厂
func DefaultFactory(analysisType types.AnalysisType) (SimulationEngine, error) {
	switch analysisType {
	case types.AnalysisDC:
		return NewDCEngine(), nil
	case types.AnalysisAC:
		return NewACEngine(), nil
	case types.AnalysisTransient:
		return NewTransientEngine(), nil
	default:
		return nil, ErrUnsupportedAnalysis
	}
}
