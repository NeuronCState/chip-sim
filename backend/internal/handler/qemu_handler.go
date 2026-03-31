package handler

import (
	"encoding/json"
	"log"

	"chip-sim/internal/qemu"
)

// QEMUCommand 前端发来的 QEMU 命令
type QEMUCommand struct {
	Command string          `json:"command"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// StartPayload start 命令参数
type StartPayload struct {
	Firmware string `json:"firmware"` // ELF 文件路径
}

// UARTSendPayload uart_send 命令参数
type UARTSendPayload struct {
	Data string `json:"data"`
}

// QEMUHandler QEMU 仿真消息处理器
type QEMUHandler struct {
	manager  *qemu.Manager
	sendFunc func(data []byte) error // 发送消息到前端的回调
}

// NewQEMUHandler 创建 QEMU 处理器
func NewQEMUHandler(sendFunc func(data []byte) error) *QEMUHandler {
	return &QEMUHandler{
		sendFunc: sendFunc,
	}
}

// HandleMessage 处理前端 WebSocket 消息
func (h *QEMUHandler) HandleMessage(msg []byte) {
	var cmd QEMUCommand
	if err := json.Unmarshal(msg, &cmd); err != nil {
		log.Printf("QEMU: 无效消息: %v", err)
		return
	}

	switch cmd.Command {
	case "start":
		h.handleStart(cmd.Payload)
	case "stop":
		h.handleStop()
	case "pause":
		h.handlePause()
	case "resume":
		h.handleResume()
	case "step":
		h.handleStep()
	case "uart_send":
		h.handleUARTSend(cmd.Payload)
	default:
		log.Printf("QEMU: 未知命令: %s", cmd.Command)
	}
}

func (h *QEMUHandler) handleStart(payload json.RawMessage) {
	// 如果已有实例在运行，先停止
	if h.manager != nil && h.manager.IsRunning() {
		h.manager.Stop()
	}

	var p StartPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		log.Printf("QEMU: start 参数错误: %v", err)
		return
	}

	config := qemu.DefaultSTM32Config(p.Firmware)
	h.manager = qemu.NewManager(config)

	// 启动事件转发 goroutine
	go h.forwardEvents()

	if err := h.manager.Start(); err != nil {
		log.Printf("QEMU: 启动失败: %v", err)
		h.sendJSON(map[string]interface{}{
			"type":    "state",
			"running": false,
			"error":   err.Error(),
		})
		return
	}
}

func (h *QEMUHandler) handleStop() {
	if h.manager != nil {
		h.manager.Stop()
	}
}

func (h *QEMUHandler) handlePause() {
	if h.manager != nil {
		h.manager.Pause()
	}
}

func (h *QEMUHandler) handleResume() {
	if h.manager != nil {
		h.manager.Resume()
	}
}

func (h *QEMUHandler) handleStep() {
	if h.manager != nil {
		h.manager.Step()
	}
}

func (h *QEMUHandler) handleUARTSend(payload json.RawMessage) {
	if h.manager == nil {
		return
	}
	var p UARTSendPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return
	}
	h.manager.SendToUART([]byte(p.Data))
}

// forwardEvents 将 QEMU 事件转发到 WebSocket
func (h *QEMUHandler) forwardEvents() {
	if h.manager == nil {
		return
	}
	for event := range h.manager.Events() {
		h.sendJSON(event)
	}
}

func (h *QEMUHandler) sendJSON(data interface{}) {
	bytes, err := json.Marshal(data)
	if err != nil {
		log.Printf("QEMU: JSON 序列化失败: %v", err)
		return
	}
	if err := h.sendFunc(bytes); err != nil {
		log.Printf("QEMU: 发送失败: %v", err)
	}
}
