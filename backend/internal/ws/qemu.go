package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"

	"chip-sim/internal/qemu"
)

var qemuUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// QEMUCommand 前端发来的 QEMU 命令
type QEMUCommand struct {
	Command string          `json:"command"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// StartPayload start 命令参数
type StartPayload struct {
	Firmware string `json:"firmware"`
}

// UARTSendPayload uart_send 命令参数
type UARTSendPayload struct {
	Data string `json:"data"`
}

// HandleQEMU 处理 QEMU 仿真 WebSocket 连接
func HandleQEMU(w http.ResponseWriter, r *http.Request) {
	conn, err := qemuUpgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[QEMU-WS] Upgrade failed: %v", err)
		return
	}
	log.Printf("[QEMU-WS] Client connected: %s", conn.RemoteAddr())

	var manager *qemu.Manager

	// 写锁，确保并发安全
	writeMu := make(chan struct{}, 1)
	writeMu <- struct{}{}

	sendJSON := func(data interface{}) {
		bytes, err := json.Marshal(data)
		if err != nil {
			log.Printf("[QEMU-WS] Marshal error: %v", err)
			return
		}
		<-writeMu
		conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
		err = conn.WriteMessage(websocket.TextMessage, bytes)
		writeMu <- struct{}{}
		if err != nil {
			log.Printf("[QEMU-WS] Write error: %v", err)
		}
	}

	forwardEvents := func(m *qemu.Manager) {
		for event := range m.Events() {
			sendJSON(event)
		}
	}

	handleMessage := func(msg []byte) {
		var cmd QEMUCommand
		if err := json.Unmarshal(msg, &cmd); err != nil {
			log.Printf("[QEMU-WS] Invalid message: %v", err)
			return
		}

		switch cmd.Command {
		case "start":
			if manager != nil && manager.IsRunning() {
				manager.Stop()
			}
			var p StartPayload
			if err := json.Unmarshal(cmd.Payload, &p); err != nil {
				log.Printf("[QEMU-WS] start payload error: %v", err)
				return
			}
			config := qemu.DefaultSTM32Config(p.Firmware)
			manager = qemu.NewManager(config)
			go forwardEvents(manager)
			if err := manager.Start(); err != nil {
				log.Printf("[QEMU-WS] start failed: %v", err)
				sendJSON(map[string]interface{}{
					"type":    "state",
					"running": false,
					"error":   err.Error(),
				})
			}
		case "stop":
			if manager != nil {
				manager.Stop()
			}
		case "pause":
			if manager != nil {
				manager.Pause()
			}
		case "resume":
			if manager != nil {
				manager.Resume()
			}
		case "step":
			if manager != nil {
				manager.Step()
			}
		case "uart_send":
			if manager != nil {
				var p UARTSendPayload
				if err := json.Unmarshal(cmd.Payload, &p); err == nil {
					manager.SendToUART([]byte(p.Data))
				}
			}
		default:
			log.Printf("[QEMU-WS] Unknown command: %s", cmd.Command)
		}
	}

	// 读取消息循环
	go func() {
		defer func() {
			if manager != nil {
				manager.Stop()
			}
			conn.Close()
			log.Printf("[QEMU-WS] Client disconnected: %s", conn.RemoteAddr())
		}()

		conn.SetReadLimit(8192)
		conn.SetReadDeadline(time.Now().Add(120 * time.Second))
		conn.SetPongHandler(func(string) error {
			conn.SetReadDeadline(time.Now().Add(120 * time.Second))
			return nil
		})

		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
					log.Printf("[QEMU-WS] Read error: %v", err)
				}
				break
			}
			handleMessage(message)
		}
	}()

	// 心跳检测
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			<-writeMu
			conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				writeMu <- struct{}{}
				return
			}
			writeMu <- struct{}{}
		}
	}()
}
