package qemu

import "fmt"

// ESP32 GPIO 寄存器
const (
	ESP32_GPIO_BASE        = 0x3FF44000
	ESP32_GPIO_OUT_REG     = 0x3FF44004  // 输出寄存器
	ESP32_GPIO_OUT1_REG    = 0x3FF44010  // 输出寄存器 (GPIO32-39)
	ESP32_GPIO_ENABLE_REG  = 0x3FF44020  // 使能寄存器
)

// ESP32 UART 寄存器
const (
	ESP32_UART0_BASE = 0x3FF40000
	ESP32_UART1_BASE = 0x3FF50000
	ESP32_UART2_BASE = 0x3FF6E000
	ESP32_UART_FIFO  = 0x00 // TX/RX FIFO
)

// ESP32QEMUConfig ESP32 QEMU 配置
func ESP32QEMUConfig(kernelPath string) QEMUConfig {
	return QEMUConfig{
		Binary:     FindQEMUBinary("qemu-system-xtensa"),
		Machine:    "esp32",
		CPU:        "esp32",
		Kernel:     kernelPath,
		GDBPort:    1234,
		UARTPort:   5678,
		NoGraphics: true,
		ChipFamily: "esp32",
	}
}

// IsESP32GPIOOUT 判断地址是否为 ESP32 GPIO 输出寄存器
func IsESP32GPIOOUT(addr uint32) (reg string, ok bool) {
	switch addr {
	case ESP32_GPIO_OUT_REG:
		return "OUT", true
	case ESP32_GPIO_OUT1_REG:
		return "OUT1", true
	}
	return "", false
}

// ESP32OUTToPins 将 ESP32 GPIO OUT 寄存器值解析为引脚电平
// OUT_REG 控制 GPIO0-31, OUT1_REG 控制 GPIO32-39
func ESP32OUTToPins(reg string, value uint32) []GPIOEvent {
	events := make([]GPIOEvent, 0, 32)
	basePin := 0
	count := 32
	if reg == "OUT1" {
		basePin = 32
		count = 8
	}
	for i := 0; i < count; i++ {
		level := 0
		if (value>>uint(i))&1 == 1 {
			level = 1
		}
		events = append(events, GPIOEvent{
			Type:  EventGPIO,
			Pin:   fmt.Sprintf("GPIO%d", basePin+i),
			Level: level,
		})
	}
	return events
}

// IsESP32UARTFIFO 判断地址是否为 ESP32 UART FIFO
func IsESP32UARTFIFO(addr uint32) (uart string, ok bool) {
	switch {
	case addr >= ESP32_UART0_BASE+ESP32_UART_FIFO && addr < ESP32_UART0_BASE+ESP32_UART_FIFO+4:
		return "UART0", true
	case addr >= ESP32_UART1_BASE+ESP32_UART_FIFO && addr < ESP32_UART1_BASE+ESP32_UART_FIFO+4:
		return "UART1", true
	case addr >= ESP32_UART2_BASE+ESP32_UART_FIFO && addr < ESP32_UART2_BASE+ESP32_UART_FIFO+4:
		return "UART2", true
	}
	return "", false
}
