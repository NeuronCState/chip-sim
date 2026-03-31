package qemu

import (
	"context"
	"fmt"
	"log"
	"os/exec"
	"sync"
	"time"
)

// QEMUConfig QEMU 启动配置
type QEMUConfig struct {
	// 可执行文件路径（默认从 PATH 查找）
	Binary string
	// 机器类型（如 "stm32vldiscovery"）
	Machine string
	// CPU 类型
	CPU string
	// 固件 ELF 文件路径
	Kernel string
	// GDB stub 端口
	GDBPort int
	// UART 输出 TCP 端口
	UARTPort int
	// 是否启用 nographic 模式
	NoGraphics bool
}

// DefaultSTM32Config STM32F103 默认配置
func DefaultSTM32Config(kernelPath string) QEMUConfig {
	return QEMUConfig{
		Binary:     "qemu-system-arm",
		Machine:    "stm32vldiscovery",
		CPU:        "cortex-m3",
		Kernel:     kernelPath,
		GDBPort:    1234,
		UARTPort:   5678,
		NoGraphics: true,
	}
}

// Manager QEMU 进程管理器
type Manager struct {
	config   QEMUConfig
	cmd      *exec.Cmd
	gdb      *GDBClient
	uart     *UARTCapture
	events   chan interface{}
	done     chan struct{}
	mu       sync.Mutex
	running  bool
	cancelFn context.CancelFunc
}

// NewManager 创建 QEMU 管理器
func NewManager(config QEMUConfig) *Manager {
	if config.Binary == "" {
		config.Binary = "qemu-system-arm"
	}
	return &Manager{
		config: config,
		events: make(chan interface{}, 512),
		done:   make(chan struct{}),
	}
}

// Start 启动 QEMU 进程
func (m *Manager) Start() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.running {
		return fmt.Errorf("QEMU 已在运行")
	}

	// 构建命令行参数
	args := []string{
		"-machine", m.config.Machine,
		"-cpu", m.config.CPU,
		"-kernel", m.config.Kernel,
		"-nographic",
		"-gdb", fmt.Sprintf("tcp::%d", m.config.GDBPort),
		"-chardev", fmt.Sprintf("socket,id=uart0,port=%d,server=on,wait=off", m.config.UARTPort),
		"-serial", "chardev:uart0",
	}

	ctx, cancel := context.WithCancel(context.Background())
	m.cancelFn = cancel

	m.cmd = exec.CommandContext(ctx, m.config.Binary, args...)

	if err := m.cmd.Start(); err != nil {
		cancel()
		return fmt.Errorf("启动 QEMU 失败: %w\n请确认已安装 QEMU: brew install qemu", err)
	}

	m.running = true

	// 等待 QEMU 启动
	time.Sleep(500 * time.Millisecond)

	// 连接 GDB stub
	gdb, err := NewGDBClient(m.config.GDBPort)
	if err != nil {
		log.Printf("警告: GDB 连接失败: %v", err)
	} else {
		m.gdb = gdb
		// 启动寄存器监控
		regions := []MonitorRegion{
			{
				Addr: GPIOA_BASE + GPIO_ODR,
				Len:  4,
				OnChange: func(addr uint32, old []byte, new []byte) []interface{} {
					oldVal := uint32(old[0]) | uint32(old[1])<<8 | uint32(old[2])<<16 | uint32(old[3])<<24
					newVal := uint32(new[0]) | uint32(new[1])<<8 | uint32(new[2])<<16 | uint32(new[3])<<24
					if oldVal == newVal {
						return nil
					}
					events := make([]interface{}, 0)
					for i := 0; i < 16; i++ {
						if (oldVal>>i)&1 != (newVal>>i)&1 {
							level := 0
							if (newVal>>i)&1 == 1 {
								level = 1
							}
							events = append(events, GPIOEvent{
								Type:  EventGPIO,
								Pin:   fmt.Sprintf("PA%d", i),
								Level: level,
								Time:  0,
							})
						}
					}
					return events
				},
			},
			{
				Addr: GPIOB_BASE + GPIO_ODR,
				Len:  4,
				OnChange: func(addr uint32, old []byte, new []byte) []interface{} {
					oldVal := uint32(old[0]) | uint32(old[1])<<8 | uint32(old[2])<<16 | uint32(old[3])<<24
					newVal := uint32(new[0]) | uint32(new[1])<<8 | uint32(new[2])<<16 | uint32(new[3])<<24
					if oldVal == newVal {
						return nil
					}
					events := make([]interface{}, 0)
					for i := 0; i < 16; i++ {
						if (oldVal>>i)&1 != (newVal>>i)&1 {
							level := 0
							if (newVal>>i)&1 == 1 {
								level = 1
							}
							events = append(events, GPIOEvent{
								Type:  EventGPIO,
								Pin:   fmt.Sprintf("PB%d", i),
								Level: level,
								Time:  0,
							})
						}
					}
					return events
				},
			},
		}
		m.gdb.MonitorLoop(regions)
	}

	// 连接 UART
	uart, err := NewUARTCapture(m.config.UARTPort)
	if err != nil {
		log.Printf("警告: UART 连接失败: %v", err)
	} else {
		m.uart = uart
		m.uart.Start()
	}

	// 合并事件
	go m.mergeEvents()

	// 监控进程退出
	go func() {
		m.cmd.Wait()
		m.mu.Lock()
		m.running = false
		m.mu.Unlock()
		m.events <- StateEvent{Type: EventState, Running: false}
	}()

	m.events <- StateEvent{Type: EventState, Running: true}
	return nil
}

// mergeEvents 合并 GDB 和 UART 事件到统一 channel
func (m *Manager) mergeEvents() {
	for {
		select {
		case <-m.done:
			return
		case ev, ok := <-m.gdb.Events():
			if ok {
				m.events <- ev
			}
		case ev, ok := <-m.uart.Events():
			if ok {
				m.events <- ev
			}
		}
	}
}

// Stop 停止 QEMU
func (m *Manager) Stop() {
	m.mu.Lock()
	defer m.mu.Unlock()

	if !m.running {
		return
	}

	close(m.done)
	if m.cancelFn != nil {
		m.cancelFn()
	}
	if m.gdb != nil {
		m.gdb.Close()
	}
	if m.uart != nil {
		m.uart.Close()
	}
	m.running = false
}

// Pause 暂停执行
func (m *Manager) Pause() error {
	if m.gdb == nil {
		return fmt.Errorf("GDB 未连接")
	}
	return m.gdb.Halt()
}

// Resume 恢复执行
func (m *Manager) Resume() error {
	if m.gdb == nil {
		return fmt.Errorf("GDB 未连接")
	}
	return m.gdb.Continue()
}

// Step 单步执行
func (m *Manager) Step() error {
	if m.gdb == nil {
		return fmt.Errorf("GDB 未连接")
	}
	return m.gdb.SingleStep()
}

// IsRunning 返回 QEMU 是否在运行
func (m *Manager) IsRunning() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.running
}

// Events 返回事件 channel
func (m *Manager) Events() <-chan interface{} {
	return m.events
}

// SendToUART 向 UART 发送数据
func (m *Manager) SendToUART(data []byte) error {
	if m.uart == nil {
		return fmt.Errorf("UART 未连接")
	}
	return m.uart.Send(data)
}
