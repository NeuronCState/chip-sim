package qemu

import (
	"bufio"
	"fmt"
	"io"
	"os/exec"
	"strings"
	"sync"
)

// C51Manager C51 模拟器管理器（使用 SDCC s51）
type C51Manager struct {
	cmd     *exec.Cmd
	stdin   io.WriteCloser
	stdout  io.ReadCloser
	events  chan interface{}
	done    chan struct{}
	mu      sync.Mutex
	running bool
}

// C51Config C51 模拟器配置
type C51Config struct {
	IHXPath string // 编译产物 .ihx 文件路径
}

// NewC51Manager 创建 C51 模拟器管理器
func NewC51Manager(config C51Config) *C51Manager {
	return &C51Manager{
		events: make(chan interface{}, 256),
		done:   make(chan struct{}),
	}
}

// Start 启动 s51 模拟器
func (m *C51Manager) Start(ihxPath string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.running {
		return fmt.Errorf("C51 模拟器已在运行")
	}

	m.cmd = exec.Command("s51", ihxPath)

	var err error
	m.stdin, err = m.cmd.StdinPipe()
	if err != nil {
		return err
	}

	m.stdout, err = m.cmd.StdoutPipe()
	if err != nil {
		return err
	}

	if err := m.cmd.Start(); err != nil {
		return fmt.Errorf("启动 s51 失败: %w\n请确认已安装 SDCC: brew install sdcc", err)
	}

	m.running = true

	// 启动输出解析 goroutine
	go m.readOutput()

	// 发送初始命令
	m.sendCommand("go")

	m.events <- StateEvent{Type: EventState, Running: true}
	return nil
}

// readOutput 读取 s51 输出并解析事件
func (m *C51Manager) readOutput() {
	scanner := bufio.NewScanner(m.stdout)
	for scanner.Scan() {
		line := scanner.Text()

		// 解析 s51 输出
		// 典型输出: "P1 = 0xFF" 或 "SBUF = 'H'"
		if strings.Contains(line, "P0") || strings.Contains(line, "P1") ||
			strings.Contains(line, "P2") || strings.Contains(line, "P3") {
			events := parseC51PortOutput(line)
			for _, ev := range events {
				select {
				case m.events <- ev:
				default:
				}
			}
		}

		if strings.Contains(line, "SBUF") || strings.Contains(line, "UART") {
			m.events <- UARTEvent{
				Type: EventUART,
				Data: extractC51UARTData(line),
			}
		}
	}
}

func (m *C51Manager) sendCommand(cmd string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.stdin != nil {
		fmt.Fprintln(m.stdin, cmd)
	}
}

// Step 单步执行
func (m *C51Manager) Step() {
	m.sendCommand("t")
}

// Stop 停止模拟器
func (m *C51Manager) Stop() {
	m.mu.Lock()
	defer m.mu.Unlock()
	if !m.running {
		return
	}
	m.sendCommand("quit")
	close(m.done)
	m.running = false
}

// Events 返回事件 channel
func (m *C51Manager) Events() <-chan interface{} {
	return m.events
}

// IsRunning 返回模拟器是否在运行
func (m *C51Manager) IsRunning() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.running
}

// parseC51PortOutput 解析 C51 端口输出
// 输入如 "P1 = 0xFF" 或 "P1_0 = 1"
func parseC51PortOutput(line string) []interface{} {
	// 简化实现：检测端口赋值
	events := make([]interface{}, 0)
	// 实际实现需要正则解析 s51 的输出格式
	return events
}

func extractC51UARTData(line string) string {
	// 从 SBUF 输出中提取数据
	idx := strings.Index(line, "SBUF")
	if idx >= 0 {
		return strings.TrimSpace(line[idx:])
	}
	return line
}
