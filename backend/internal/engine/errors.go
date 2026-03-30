package engine

import "errors"

var (
	// ErrNotImplemented 功能未实现
	ErrNotImplemented = errors.New("engine: analysis type not yet implemented")

	// ErrUnsupportedAnalysis 不支持的分析类型
	ErrUnsupportedAnalysis = errors.New("engine: unsupported analysis type")

	// ErrInvalidCircuit 电路数据无效
	ErrInvalidCircuit = errors.New("engine: invalid circuit data")

	// ErrNoGroundNode 缺少接地节点
	ErrNoGroundNode = errors.New("engine: circuit has no ground node")

	// ErrSingularMatrix 矩阵奇异，无法求解
	ErrSingularMatrix = errors.New("engine: singular matrix, cannot solve")
)
