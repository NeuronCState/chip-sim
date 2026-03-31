package qemu

import (
	"bytes"
	"fmt"
	"net"
	"strconv"
	"strings"
	"sync"
	"time"
)

// GDBClient GDB RSP 客户端，连接 QEMU 的 -gdb 端口
type GDBClient struct {
	conn    net.Conn
	mu      sync.Mutex
	events  chan interface{}
	done    chan struct{}
	stopped bool
}

// NewGDBClient 连接到 QEMU 的 GDB stub
func NewGDBClient(port int) (*GDBClient, error) {
	conn, err := net.Dial("tcp", fmt.Sprintf("localhost:%d", port))
	if err != nil {
		return nil, fmt.Errorf("连接 GDB stub 失败: %w", err)
	}
	return &GDBClient{
		conn:   conn,
		events: make(chan interface{}, 256),
		done:   make(chan struct{}),
	}, nil
}

// Close 关闭连接
func (g *GDBClient) Close() {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.stopped {
		return
	}
	g.stopped = true
	close(g.done)
	g.conn.Close()
}

// sendPacket 发送 GDB RSP 数据包
func (g *GDBClient) sendPacket(data string) error {
	checksum := 0
	for _, b := range []byte(data) {
		checksum += int(b)
	}
	packet := fmt.Sprintf("$%s#%02x", data, checksum%256)
	_, err := g.conn.Write([]byte(packet))
	return err
}

// readAck 读取确认 (+/-)
func (g *GDBClient) readAck() error {
	buf := make([]byte, 1)
	_, err := g.conn.Read(buf)
	if err != nil {
		return err
	}
	if buf[0] != '+' {
		return fmt.Errorf("GDB NACK: %c", buf[0])
	}
	return nil
}

// readResponse 读取 GDB 响应数据包
func (g *GDBClient) readResponse() (string, error) {
	buf := make([]byte, 4096)
	n, err := g.conn.Read(buf)
	if err != nil {
		return "", err
	}

	data := string(buf[:n])
	// 找 $ 和 # 之间的数据
	start := strings.Index(data, "$")
	end := strings.Index(data, "#")
	if start == -1 || end == -1 || end <= start {
		return "", fmt.Errorf("无效的 GDB 数据包: %s", data)
	}

	// 发送 ACK
	g.conn.Write([]byte("+"))

	return data[start+1 : end], nil
}

// ReadMemory 读取内存（用于监控寄存器）
func (g *GDBClient) ReadMemory(addr uint32, length int) ([]byte, error) {
	g.mu.Lock()
	defer g.mu.Unlock()

	cmd := fmt.Sprintf("m%x,%x", addr, length)
	if err := g.sendPacket(cmd); err != nil {
		return nil, err
	}
	if err := g.readAck(); err != nil {
		return nil, err
	}

	resp, err := g.readResponse()
	if err != nil {
		return nil, err
	}

	// 将十六进制字符串转为字节
	result := make([]byte, 0, length)
	for i := 0; i < len(resp)-1; i += 2 {
		b, err := strconv.ParseUint(resp[i:i+2], 16, 8)
		if err != nil {
			return nil, err
		}
		result = append(result, byte(b))
	}
	return result, nil
}

// ReadRegister 读取单个寄存器值
func (g *GDBClient) ReadRegister(reg int) (uint32, error) {
	g.mu.Lock()
	defer g.mu.Unlock()

	cmd := fmt.Sprintf("p%x", reg)
	if err := g.sendPacket(cmd); err != nil {
		return 0, err
	}
	if err := g.readAck(); err != nil {
		return 0, err
	}

	resp, err := g.readResponse()
	if err != nil {
		return 0, err
	}

	val, err := strconv.ParseUint(resp, 16, 32)
	return uint32(val), err
}

// SingleStep 单步执行一条指令
func (g *GDBClient) SingleStep() error {
	g.mu.Lock()
	defer g.mu.Unlock()

	if err := g.sendPacket("s"); err != nil {
		return err
	}
	return g.readAck()
}

// Continue 继续执行
func (g *GDBClient) Continue() error {
	g.mu.Lock()
	defer g.mu.Unlock()

	if err := g.sendPacket("c"); err != nil {
		return err
	}
	return g.readAck()
}

// Halt 暂停执行
func (g *GDBClient) Halt() error {
	// 发送中断字符 0x03
	_, err := g.conn.Write([]byte{0x03})
	return err
}

// MonitorRegion 监控区域定义
type MonitorRegion struct {
	Addr     uint32
	Len      int
	OnChange func(addr uint32, old []byte, new []byte) []interface{}
}

// MonitorLoop 循环监控指定内存区域的变化
// 检测到变化时发送事件到 events channel
func (g *GDBClient) MonitorLoop(regions []MonitorRegion) {
	// 保存上一次读取的值
	prev := make(map[uint32][]byte)
	for _, r := range regions {
		data, err := g.ReadMemory(r.Addr, r.Len)
		if err == nil {
			prev[r.Addr] = data
		}
	}

	go func() {
		ticker := time.NewTicker(1 * time.Millisecond)
		defer ticker.Stop()

		for {
			select {
			case <-g.done:
				return
			case <-ticker.C:
				for _, r := range regions {
					data, err := g.ReadMemory(r.Addr, r.Len)
					if err != nil {
						continue
					}
					old := prev[r.Addr]
					if old != nil && !bytes.Equal(data, old) {
						// 检测到变化，解析事件
						events := r.OnChange(r.Addr, old, data)
						for _, ev := range events {
							select {
							case g.events <- ev:
							default:
								// channel 满了丢弃旧事件
							}
						}
					}
					prev[r.Addr] = data
				}
			}
		}
	}()
}

// Events 返回事件 channel
func (g *GDBClient) Events() <-chan interface{} {
	return g.events
}
