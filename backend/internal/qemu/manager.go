package qemu

import (
	"context"
	"encoding/binary"
	"fmt"
	"log"
	"os/exec"
	"strings"
	"sync"
	"time"
)

// QEMUConfig QEMU 启动配置
type QEMUConfig struct {
	// 芯片类型: "stm32", "esp32", "c51"
	ChipFamily string
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
		ChipFamily: "stm32",
		Binary:     "qemu-system-arm",
		Machine:    "stm32vldiscovery",
		CPU:        "cortex-m3",
		Kernel:     kernelPath,
		GDBPort:    1234,
		UARTPort:   5678,
		NoGraphics: true,
	}
}

// DefaultSTM32F4Config STM32F4 默认配置（Cortex-M4）
func DefaultSTM32F4Config(kernelPath string) QEMUConfig {
	return QEMUConfig{
		ChipFamily: "stm32f4",
		Binary:     "qemu-system-arm",
		Machine:    "netduinoplus2",
		CPU:        "cortex-m4",
		Kernel:     kernelPath,
		GDBPort:    1234,
		UARTPort:   5678,
		NoGraphics: true,
	}
}

// DefaultStellarisConfig Stellaris LM3S6965 配置
func DefaultStellarisConfig(kernelPath string) QEMUConfig {
	return QEMUConfig{
		ChipFamily: "stellaris",
		Binary:     "qemu-system-arm",
		Machine:    "lm3s6965evb",
		CPU:        "cortex-m3",
		Kernel:     kernelPath,
		GDBPort:    1234,
		UARTPort:   5678,
		NoGraphics: true,
	}
}

// DefaultMicrobitConfig BBC micro:bit 配置（Cortex-M0）
func DefaultMicrobitConfig(kernelPath string) QEMUConfig {
	return QEMUConfig{
		ChipFamily: "microbit",
		Binary:     "qemu-system-arm",
		Machine:    "microbit",
		CPU:        "cortex-m0",
		Kernel:     kernelPath,
		GDBPort:    1234,
		UARTPort:   5678,
		NoGraphics: true,
	}
}

// DefaultOlimexConfig Olimex STM32-H405 配置（Cortex-M4）
func DefaultOlimexConfig(kernelPath string) QEMUConfig {
	return QEMUConfig{
		ChipFamily: "stm32f1",
		Binary:     "qemu-system-arm",
		Machine:    "olimex-stm32-h405",
		CPU:        "cortex-m4",
		Kernel:     kernelPath,
		GDBPort:    1234,
		UARTPort:   5678,
		NoGraphics: true,
	}
}

// GetConfigForChip 根据芯片型号返回 QEMU 配置
func GetConfigForChip(chipModel string, kernelPath string) QEMUConfig {
	model := strings.ToLower(chipModel)

	switch {
	case strings.Contains(model, "stm32f4"):
		return DefaultSTM32F4Config(kernelPath)
	case strings.Contains(model, "stm32f1"):
		return DefaultSTM32Config(kernelPath)
	case strings.Contains(model, "stm32h7"):
		return DefaultSTM32Config(kernelPath) // fallback to F1
	case strings.Contains(model, "stm32"):
		return DefaultSTM32Config(kernelPath)
	case strings.Contains(model, "esp32"):
		return ESP32QEMUConfig(kernelPath)
	case strings.Contains(model, "lm3s"):
		return DefaultStellarisConfig(kernelPath)
	case strings.Contains(model, "microbit") || strings.Contains(model, "nrf51"):
		return DefaultMicrobitConfig(kernelPath)
	case strings.Contains(model, "at89") || strings.Contains(model, "stc89") || strings.Contains(model, "stc12"):
		return QEMUConfig{
			ChipFamily: "c51",
			Kernel:     kernelPath, // .ihx file for s51
		}
	default:
		return DefaultSTM32Config(kernelPath)
	}
}

// Manager QEMU 进程管理器
type Manager struct {
	config     QEMUConfig
	cmd        *exec.Cmd
	gdb        *GDBClient
	uart       *UARTCapture
	c51Manager *C51Manager
	avrManager *AVRManager
	events     chan interface{}
	done       chan struct{}
	mu         sync.Mutex
	running    bool
	cancelFn   context.CancelFunc
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

// Start 启动仿真器
func (m *Manager) Start() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.running {
		return fmt.Errorf("仿真器已在运行")
	}

	// 根据芯片类型选择后端
	switch m.config.ChipFamily {
	case "c51":
		return m.startC51()
	case "esp32":
		return m.startQEMU() // ESP32 也用 QEMU
	case "arduino":
		return m.startAVR()
	default: // stm32, stellaris, microbit, etc.
		return m.startQEMU()
	}
}

// startQEMU 启动 QEMU 后端（STM32 / ESP32）
func (m *Manager) startQEMU() error {
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
		// 根据芯片类型选择监控区域
		var regions []MonitorRegion
		switch m.config.ChipFamily {
		case "esp32":
			regions = m.getESP32MonitorRegions()
		case "stellaris":
			regions = StellarisMonitorRegions()
		default:
			regions = m.getSTM32MonitorRegions()
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

// startC51 启动 C51 后端（SDCC s51 模拟器）
func (m *Manager) startC51() error {
	m.c51Manager = NewC51Manager(C51Config{IHXPath: m.config.Kernel})
	if err := m.c51Manager.Start(m.config.Kernel); err != nil {
		return err
	}
	m.running = true
	go m.mergeC51Events()
	return nil
}

// getSTM32MonitorRegions 返回 STM32 GPIO 监控区域
func (m *Manager) getSTM32MonitorRegions() []MonitorRegion {
	return []MonitorRegion{
		{
			Addr: GPIOA_BASE + GPIO_ODR,
			Len:  4,
			OnChange: func(addr uint32, old []byte, new []byte) []interface{} {
				oldVal := binary.LittleEndian.Uint32(old)
				newVal := binary.LittleEndian.Uint32(new)
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
				oldVal := binary.LittleEndian.Uint32(old)
				newVal := binary.LittleEndian.Uint32(new)
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
}

// getESP32MonitorRegions 返回 ESP32 GPIO 监控区域
func (m *Manager) getESP32MonitorRegions() []MonitorRegion {
	return []MonitorRegion{
		{
			Addr: ESP32_GPIO_OUT_REG,
			Len:  4,
			OnChange: func(addr uint32, old []byte, new []byte) []interface{} {
				oldVal := binary.LittleEndian.Uint32(old)
				newVal := binary.LittleEndian.Uint32(new)
				if oldVal == newVal {
					return nil
				}
				events := make([]interface{}, 0)
				for i := 0; i < 32; i++ {
					if (oldVal>>uint(i))&1 != (newVal>>uint(i))&1 {
						level := 0
						if (newVal>>uint(i))&1 == 1 {
							level = 1
						}
						events = append(events, GPIOEvent{
							Type:  EventGPIO,
							Pin:   fmt.Sprintf("GPIO%d", i),
							Level: level,
						})
					}
				}
				return events
			},
		},
	}
}

// mergeEvents 合并 GDB / UART / C51 事件到统一 channel
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

// mergeC51Events 将 C51 模拟器事件转发到统一 channel
func (m *Manager) mergeC51Events() {
	if m.c51Manager == nil {
		return
	}
	for {
		select {
		case <-m.done:
			return
		case ev, ok := <-m.c51Manager.Events():
			if ok {
				m.events <- ev
			}
		}
	}
}

// startAVR 启动 AVR 后端（simavr）
func (m *Manager) startAVR() error {
	m.avrManager = NewAVRManager()
	mcu := AVRMCUName(m.config.Machine) // Machine 字段存储芯片型号
	if err := m.avrManager.Start(m.config.Kernel, mcu); err != nil {
		return err
	}
	m.running = true
	go m.mergeAVREvents()
	return nil
}

// mergeAVREvents 将 AVR 模拟器事件转发到统一 channel
func (m *Manager) mergeAVREvents() {
	if m.avrManager == nil {
		return
	}
	for {
		select {
		case <-m.done:
			return
		case ev, ok := <-m.avrManager.Events():
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
	if m.avrManager != nil {
		m.avrManager.Stop()
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
