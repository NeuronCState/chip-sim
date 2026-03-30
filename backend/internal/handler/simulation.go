// Package handler 业务消息处理器
// 路由 WebSocket 消息到对应的业务逻辑
package handler

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"chip-sim/internal/engine"
	"chip-sim/internal/ws"
	"chip-sim/pkg/types"
)

// SimulationHandler 仿真消息处理器
type SimulationHandler struct {
	factory  engine.EngineFactory
	cancelFn context.CancelFunc
}

// NewSimulationHandler 创建仿真消息处理器
func NewSimulationHandler() *SimulationHandler {
	return &SimulationHandler{
		factory: engine.DefaultFactory,
	}
}

// HandleMessage 处理客户端消息
func (h *SimulationHandler) HandleMessage(client *ws.Client, msg *types.ClientMessage) {
	switch msg.Type {
	case types.MsgStartSimulation:
		h.handleStartSimulation(client, msg)
	case types.MsgStopSimulation:
		h.handleStopSimulation(client, msg)
	case types.MsgSubmitCircuit:
		h.handleSubmitCircuit(client, msg)
	default:
		log.Printf("[Handler] Unknown message type: %s", msg.Type)
		h.sendError(client, msg.ID, "unknown message type", 400)
	}
}

// handleStartSimulation 处理启动仿真请求
func (h *SimulationHandler) handleStartSimulation(client *ws.Client, msg *types.ClientMessage) {
	// 解析载荷
	payloadBytes, err := json.Marshal(msg.Payload)
	if err != nil {
		h.sendError(client, msg.ID, "invalid payload", 400)
		return
	}

	var payload types.StartSimulationPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		h.sendError(client, msg.ID, "failed to parse payload", 400)
		return
	}

	log.Printf("[Handler] Start simulation for project: %s, type: %s", payload.ProjectID, payload.Config.Analysis.Type)

	// 发送状态更新
	client.Send(&types.ServerMessage{
		Type: types.MsgStatusUpdate,
		Payload: &types.StatusUpdatePayload{
			Status: "simulation_started",
			Details: map[string]any{
				"projectId": payload.ProjectID,
				"analysis":  string(payload.Config.Analysis.Type),
			},
		},
	})

	// Build circuit project
	var project *types.CircuitProject
	if payload.Circuit != nil {
		project = payload.Circuit
		if project.ID == "" {
			project.ID = payload.ProjectID
		}
		project.SimulationConfig = payload.Config
	} else {
		// No circuit data provided - create minimal project for testing
		project = &types.CircuitProject{
			ID:               payload.ProjectID,
			Name:             payload.ProjectID,
			CreatedAt:        time.Now(),
			UpdatedAt:        time.Now(),
			SimulationConfig: payload.Config,
		}
	}

	// Get engine
	eng, err := h.factory(payload.Config.Analysis.Type)
	if err != nil {
		h.sendError(client, msg.ID, err.Error(), 400)
		return
	}

	// Validate
	if err := eng.Validate(project); err != nil {
		h.sendError(client, msg.ID, err.Error(), 400)
		return
	}

	// Create cancellable context
	ctx, cancel := context.WithCancel(context.Background())
	h.cancelFn = cancel

	// Run simulation
	resultCh, err := eng.Run(ctx, project)
	if err != nil {
		cancel()
		h.sendError(client, msg.ID, err.Error(), 500)
		return
	}

	// Stream results
	go h.streamResults(client, msg.ID, resultCh, cancel)
}

// streamResults reads from the result channel and sends to client
func (h *SimulationHandler) streamResults(client *ws.Client, msgID string, resultCh <-chan *types.SimulationResult, cancel context.CancelFunc) {
	defer cancel()

	for result := range resultCh {
		switch result.Status {
		case types.StatusRunning:
			client.Send(&types.ServerMessage{
				Type: types.MsgStatusUpdate,
				Payload: &types.StatusUpdatePayload{
					Status: "running",
					Details: map[string]any{
						"analysis": string(result.AnalysisType),
					},
				},
			})

		case types.StatusCompleted:
			client.Send(&types.ServerMessage{
				Type:    types.MsgSimulationComplete,
				ID:      msgID,
				Payload: result,
			})

		case types.StatusError:
			client.Send(&types.ServerMessage{
				Type: types.MsgSimulationError,
				ID:   msgID,
				Payload: &types.SimulationErrorPayload{
					ProjectID: result.ProjectID,
					Error:     result.Error,
					Code:      500,
				},
			})
		}
	}
}

// handleStopSimulation 处理停止仿真请求
func (h *SimulationHandler) handleStopSimulation(client *ws.Client, msg *types.ClientMessage) {
	log.Printf("[Handler] Stop simulation requested")

	if h.cancelFn != nil {
		h.cancelFn()
		h.cancelFn = nil
	}

	client.Send(&types.ServerMessage{
		Type: types.MsgStatusUpdate,
		Payload: &types.StatusUpdatePayload{
			Status: "simulation_stopped",
		},
	})
}

// handleSubmitCircuit 处理电路数据提交
func (h *SimulationHandler) handleSubmitCircuit(client *ws.Client, msg *types.ClientMessage) {
	log.Printf("[Handler] Circuit data submitted")

	client.Send(&types.ServerMessage{
		Type: types.MsgStatusUpdate,
		Payload: &types.StatusUpdatePayload{
			Status: "circuit_received",
		},
	})
}

// sendError 发送错误响应
func (h *SimulationHandler) sendError(client *ws.Client, msgID string, errMsg string, code int) {
	client.Send(&types.ServerMessage{
		Type: types.MsgSimulationError,
		ID:   msgID,
		Payload: &types.SimulationErrorPayload{
			Error: errMsg,
			Code:  code,
		},
	})
}
