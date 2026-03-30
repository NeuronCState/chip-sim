// Package protocols 协议仿真引擎入口
// 提供统一的协议仿真调度接口
package protocols

import (
	"fmt"

	"chip-sim/pkg/types"
)

// Simulate 根据请求类型分发到对应的协议仿真引擎
func Simulate(req *types.ProtocolSimRequest) (*types.ProtocolSimResult, error) {
	if req == nil {
		return nil, fmt.Errorf("protocol simulation request is nil")
	}

	switch req.Protocol {
	case types.ProtocolSPI:
		return SimulateSPI(req.SPI)
	case types.ProtocolI2C:
		return SimulateI2C(req.I2C)
	case types.ProtocolUART:
		return SimulateUART(req.UART)
	case types.ProtocolCAN:
		return SimulateCAN(req.CAN)
	default:
		return nil, fmt.Errorf("unsupported protocol: %s", req.Protocol)
	}
}
