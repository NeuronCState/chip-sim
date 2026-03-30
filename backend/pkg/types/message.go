// Package types WebSocket 消息协议定义
package types

// ==================== 消息类型 ====================

// ClientMessageType 客户端→服务端消息类型
type ClientMessageType string

const (
	MsgPing            ClientMessageType = "ping"
	MsgStartSimulation ClientMessageType = "start_simulation"
	MsgStopSimulation  ClientMessageType = "stop_simulation"
	MsgUpdateParams    ClientMessageType = "update_params"
	MsgSubmitCircuit   ClientMessageType = "submit_circuit"
)

// ServerMessageType 服务端→客户端消息类型
type ServerMessageType string

const (
	MsgPong              ServerMessageType = "pong"
	MsgSimulationData    ServerMessageType = "simulation_data"
	MsgSimulationComplete ServerMessageType = "simulation_complete"
	MsgSimulationError   ServerMessageType = "simulation_error"
	MsgStatusUpdate      ServerMessageType = "status_update"
)

// ==================== 客户端消息 ====================

// ClientMessage 客户端发送的基础消息
type ClientMessage struct {
	Type    ClientMessageType `json:"type"`
	ID      string            `json:"id"`
	Payload any               `json:"payload"`
}

// PingPayload Ping 消息载荷
type PingPayload struct {
	Timestamp int64 `json:"timestamp"`
}

// StartSimulationPayload 启动仿真载荷
type StartSimulationPayload struct {
	ProjectID string            `json:"projectId"`
	Config    SimulationConfig  `json:"config"`
	Circuit   *CircuitProject   `json:"circuit,omitempty"`
}

// StopSimulationPayload 停止仿真载荷
type StopSimulationPayload struct {
	ProjectID string `json:"projectId"`
}

// SubmitCircuitPayload 提交电路数据载荷
type SubmitCircuitPayload struct {
	ProjectID  string          `json:"projectId"`
	Components []Component     `json:"components"`
	Nodes      []CircuitNode   `json:"nodes"`
	Wires      []Wire          `json:"wires"`
}

// ==================== 服务端消息 ====================

// ServerMessage 服务端发送的基础消息
type ServerMessage struct {
	Type    ServerMessageType `json:"type"`
	ID      string            `json:"id,omitempty"`
	Payload any               `json:"payload"`
}

// PongPayload Pong 消息载荷
type PongPayload struct {
	Timestamp  int64 `json:"timestamp"`
	ServerTime int64 `json:"serverTime"`
}

// SimulationErrorPayload 仿真错误载荷
type SimulationErrorPayload struct {
	ProjectID string `json:"projectId"`
	Error     string `json:"error"`
	Code      int    `json:"code"`
}

// StatusUpdatePayload 状态更新载荷
type StatusUpdatePayload struct {
	Status  string         `json:"status"`
	Details map[string]any `json:"details,omitempty"`
}
