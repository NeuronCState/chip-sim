package qemu

import (
	"bufio"
	"fmt"
	"net"
	"sync"
	"time"
)

// UARTCapture 通过 TCP 连接捕获 QEMU 的 UART 输出
type UARTCapture struct {
	conn    net.Conn
	events  chan UARTEvent
	done    chan struct{}
	mu      sync.Mutex
	stopped bool
	counter uint64
}

// NewUARTCapture 连接到 QEMU 的 -chardev tcp 端口
func NewUARTCapture(port int) (*UARTCapture, error) {
	// 等待 QEMU 启动 TCP server
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("localhost:%d", port), 5*time.Second)
	if err != nil {
		return nil, fmt.Errorf("连接 UART 端口失败: %w", err)
	}

	return &UARTCapture{
		conn:   conn,
		events: make(chan UARTEvent, 256),
		done:   make(chan struct{}),
	}, nil
}

// Start 开始读取 UART 数据
func (u *UARTCapture) Start() {
	go func() {
		reader := bufio.NewReader(u.conn)
		buf := make([]byte, 1024)

		for {
			select {
			case <-u.done:
				return
			default:
			}

			n, err := reader.Read(buf)
			if err != nil {
				return
			}

			u.mu.Lock()
			u.counter++
			event := UARTEvent{
				Type: EventUART,
				Data: string(buf[:n]),
				Time: u.counter,
			}
			u.mu.Unlock()

			select {
			case u.events <- event:
			default:
			}
		}
	}()
}

// Send 向 UART 发送数据（模拟用户输入）
func (u *UARTCapture) Send(data []byte) error {
	u.mu.Lock()
	defer u.mu.Unlock()
	_, err := u.conn.Write(data)
	return err
}

// Events 返回事件 channel
func (u *UARTCapture) Events() <-chan UARTEvent {
	return u.events
}

// Close 关闭连接
func (u *UARTCapture) Close() {
	u.mu.Lock()
	defer u.mu.Unlock()
	if u.stopped {
		return
	}
	u.stopped = true
	close(u.done)
	u.conn.Close()
}
