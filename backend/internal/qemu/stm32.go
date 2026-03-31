package qemu

import "fmt"

// STM32F103 GPIO 寄存器基地址（QEMU stm32vldiscovery 机器）
const (
	GPIOA_BASE = 0x40010800
	GPIOB_BASE = 0x40010C00
	GPIOC_BASE = 0x40011000
)

// GPIO 寄存器偏移
const (
	GPIO_CRL  = 0x00 // 端口配置低寄存器
	GPIO_CRH  = 0x04 // 端口配置高寄存器
	GPIO_IDR  = 0x08 // 输入数据寄存器
	GPIO_ODR  = 0x0C // 输出数据寄存器
	GPIO_BSRR = 0x10 // 位设置/复位寄存器
)

// UART 寄存器基地址
const (
	USART1_BASE = 0x40013800
	USART2_BASE = 0x40004400
	USART3_BASE = 0x40004800
)

// USART 寄存器偏移
const (
	USART_SR  = 0x00 // 状态寄存器
	USART_DR  = 0x04 // 数据寄存器
	USART_BRR = 0x08 // 波特率寄存器
)

// IsGPIOODR 判断写入地址是否为 GPIO ODR 寄存器
func IsGPIOODR(addr uint32) (port string, ok bool) {
	switch {
	case addr >= GPIOA_BASE+GPIO_ODR && addr < GPIOA_BASE+GPIO_ODR+4:
		return "A", true
	case addr >= GPIOB_BASE+GPIO_ODR && addr < GPIOB_BASE+GPIO_ODR+4:
		return "B", true
	case addr >= GPIOC_BASE+GPIO_ODR && addr < GPIOC_BASE+GPIO_ODR+4:
		return "C", true
	}
	return "", false
}

// ODRToPins 将 ODR 值解析为各个引脚电平
func ODRToPins(port string, odr uint32) []GPIOEvent {
	events := make([]GPIOEvent, 0, 16)
	for i := 0; i < 16; i++ {
		level := 0
		if (odr>>i)&1 == 1 {
			level = 1
		}
		events = append(events, GPIOEvent{
			Type:  EventGPIO,
			Pin:   fmt.Sprintf("P%s%d", port, i),
			Level: level,
		})
	}
	return events
}

// IsUARTDR 判断写入地址是否为 USART 数据寄存器
func IsUARTDR(addr uint32) (uart string, ok bool) {
	switch {
	case addr >= USART1_BASE+USART_DR && addr < USART1_BASE+USART_DR+4:
		return "USART1", true
	case addr >= USART2_BASE+USART_DR && addr < USART2_BASE+USART_DR+4:
		return "USART2", true
	case addr >= USART3_BASE+USART_DR && addr < USART3_BASE+USART_DR+4:
		return "USART3", true
	}
	return "", false
}
