package qemu

import (
	"bufio"
	"fmt"
	"io"
	"os/exec"
	"sync"
)

// AVRManager AVR 模拟器管理器（使用 simavr）
type AVRManager struct {
	cmd     *exec.Cmd
	stdin   io.WriteCloser
	stdout  io.ReadCloser
	events  chan interface{}
	done    chan struct{}
	mu      sync.Mutex
	running bool
}

// NewAVRManager 创建 AVR 模拟器管理器
func NewAVRManager() *AVRManager {
	return &AVRManager{
		events: make(chan interface{}, 256),
		done:   make(chan struct{}),
	}
}

// Start 启动 simavr
func (m *AVRManager) Start(firmwarePath string, mcu string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.running {
		return fmt.Errorf("AVR 模拟器已在运行")
	}

	// simavr 命令: simavr -m <mcu> -f <freq> firmware.elf
	m.cmd = exec.Command("simavr", "-m", mcu, "-f", "16000000", firmwarePath)

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
		return fmt.Errorf("启动 simavr 失败: %w\n请确认已安装 simavr: brew install simavr", err)
	}

	m.running = true
	go m.readOutput()

	m.events <- StateEvent{Type: EventState, Running: true}
	return nil
}

func (m *AVRManager) readOutput() {
	scanner := bufio.NewScanner(m.stdout)
	for scanner.Scan() {
		line := scanner.Text()
		// simavr 输出 GPIO 变化时格式类似: "PORTB = 0x20"
		// 解析并转换为 GPIOEvent
		m.events <- UARTEvent{Type: EventUART, Data: line + "\n"}
	}
}

// Stop 停止模拟器
func (m *AVRManager) Stop() {
	m.mu.Lock()
	defer m.mu.Unlock()
	if !m.running {
		return
	}
	if m.cmd != nil && m.cmd.Process != nil {
		m.cmd.Process.Kill()
	}
	close(m.done)
	m.running = false
}

// Events 返回事件 channel
func (m *AVRManager) Events() <-chan interface{} { return m.events }

// IsRunning 返回模拟器是否在运行
func (m *AVRManager) IsRunning() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.running
}

// AVRMCUName 返回 simavr 对应的 MCU 名称
func AVRMCUName(chipModel string) string {
	switch chipModel {
	case "uno", "atmega328p":
		return "atmega328p"
	case "mega", "atmega2560":
		return "atmega2560"
	case "nano":
		return "atmega328p"
	case "leonardo":
		return "atmega32u4"
	default:
		return "atmega328p"
	}
}
