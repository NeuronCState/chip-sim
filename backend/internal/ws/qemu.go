package ws

import (
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"

	"chip-sim/internal/handler"
)

// QEMUUpgrader 升级 HTTP 为 QEMU WebSocket 连接
var qemuUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// HandleQEMU 处理 QEMU 仿真 WebSocket 连接
func HandleQEMU(w http.ResponseWriter, r *http.Request) {
	conn, err := qemuUpgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[QEMU-WS] Upgrade failed: %v", err)
		return
	}
	log.Printf("[QEMU-WS] Client connected: %s", conn.RemoteAddr())

	// 创建带写锁的发送函数，确保并发安全
	writeMu := make(chan struct{}, 1)
	writeMu <- struct{}{}

	sendFunc := func(data []byte) error {
		<-writeMu
		defer func() { writeMu <- struct{}{} }()
		conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
		return conn.WriteMessage(websocket.TextMessage, data)
	}

	// 创建 QEMU 消息处理器
	qemuHandler := handler.NewQEMUHandler(sendFunc)

	// 读取消息循环
	go func() {
		defer func() {
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
			qemuHandler.HandleMessage(message)
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
