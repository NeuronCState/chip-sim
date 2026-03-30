// Package ws WebSocket 连接处理器
// 管理 WebSocket 连接生命周期、消息路由、仿真会话
package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"

	"chip-sim/pkg/types"
)

// Handler WebSocket 连接处理器
type Handler struct {
	upgrader  websocket.Upgrader
	clients   map[*Client]bool
	mu        sync.RWMutex
	onMessage func(*Client, *types.ClientMessage) // 消息回调
}

// NewHandler 创建新的 WebSocket 处理器
func NewHandler() *Handler {
	return &Handler{
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				// 开发环境允许所有来源
				// 生产环境应限制为特定域名
				return true
			},
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
		},
		clients: make(map[*Client]bool),
	}
}

// SetMessageHandler 设置消息处理回调
func (h *Handler) SetMessageHandler(handler func(*Client, *types.ClientMessage)) {
	h.onMessage = handler
}

// ServeHTTP 处理 HTTP 升级为 WebSocket
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WS] Upgrade failed: %v", err)
		return
	}

	client := &Client{
		conn:    conn,
		handler: h,
		send:    make(chan []byte, 256),
	}

	h.mu.Lock()
	h.clients[client] = true
	h.mu.Unlock()

	log.Printf("[WS] Client connected: %s", conn.RemoteAddr())

	go client.writePump()
	go client.readPump()
}

// removeClient 移除断开的客户端
func (h *Handler) removeClient(client *Client) {
	h.mu.Lock()
	delete(h.clients, client)
	h.mu.Unlock()
	close(client.send)
	log.Printf("[WS] Client disconnected: %s", client.conn.RemoteAddr())
}

// Broadcast 向所有连接的客户端广播消息
func (h *Handler) Broadcast(message *types.ServerMessage) {
	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("[WS] Marshal error: %v", err)
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.clients {
		select {
		case client.send <- data:
		default:
			// 客户端发送缓冲区满，关闭连接
			go func(c *Client) {
				c.conn.Close()
				h.removeClient(c)
			}(client)
		}
	}
}

// ClientCount 返回当前连接数
func (h *Handler) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// Client WebSocket 客户端连接
type Client struct {
	conn    *websocket.Conn
	handler *Handler
	send    chan []byte
}

// readPump 读取消息循环
func (c *Client) readPump() {
	defer func() {
		c.handler.removeClient(c)
		c.conn.Close()
	}()

	c.conn.SetReadLimit(4096)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Printf("[WS] Read error: %v", err)
			}
			break
		}

		var clientMsg types.ClientMessage
		if err := json.Unmarshal(message, &clientMsg); err != nil {
			log.Printf("[WS] Unmarshal error: %v", err)
			continue
		}

		// 处理 Ping 消息（直接响应）
		if clientMsg.Type == types.MsgPing {
			c.handlePing(&clientMsg)
			continue
		}

		// 其他消息交给回调处理
		if c.handler.onMessage != nil {
			c.handler.onMessage(c, &clientMsg)
		}
	}
}

// writePump 写入消息循环
func (c *Client) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handlePing 处理 Ping 消息，返回 Pong
func (c *Client) handlePing(msg *types.ClientMessage) {
	var payload types.PingPayload
	if data, ok := msg.Payload.(map[string]any); ok {
		if ts, ok := data["timestamp"].(float64); ok {
			payload.Timestamp = int64(ts)
		}
	}

	pong := &types.ServerMessage{
		Type: types.MsgPong,
		ID:   msg.ID,
		Payload: &types.PongPayload{
			Timestamp:  payload.Timestamp,
			ServerTime: time.Now().UnixMilli(),
		},
	}

	data, _ := json.Marshal(pong)
	select {
	case c.send <- data:
	default:
	}
}

// Send 向此客户端发送消息
func (c *Client) Send(message *types.ServerMessage) {
	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("[WS] Marshal error: %v", err)
		return
	}
	select {
	case c.send <- data:
	default:
	}
}
