package qemu

import (
	"encoding/binary"
	"fmt"
)

// Stellaris LM3S6965 GPIO 寄存器
const (
	STELLARIS_GPIOA_BASE = 0x40004000
	STELLARIS_GPIOB_BASE = 0x40005000
	STELLARIS_GPIOC_BASE = 0x40006000
	STELLARIS_GPIOD_BASE = 0x40007000
	STELLARIS_GPIOE_BASE = 0x40024000
	STELLARIS_GPIOF_BASE = 0x40025000
	STELLARIS_GPIOG_BASE = 0x40026000

	STELLARIS_GPIO_DATA = 0x000 // 数据寄存器（位带别名）
	STELLARIS_GPIO_DIR  = 0x400 // 方向寄存器
)

// Stellaris UART 寄存器
const (
	STELLARIS_UART0_BASE = 0x4000C000
	STELLARIS_UART1_BASE = 0x4000D000
	STELLARIS_UART_DR    = 0x00 // 数据寄存器
)

// IsStellarisGPIOData 判断是否为 Stellaris GPIO 数据寄存器
func IsStellarisGPIOData(addr uint32) (port string, bit int, ok bool) {
	// Stellaris GPIO 使用位带别名，每个位对应一个地址
	bases := map[string]uint32{
		"A": STELLARIS_GPIOA_BASE,
		"B": STELLARIS_GPIOB_BASE,
		"C": STELLARIS_GPIOC_BASE,
		"D": STELLARIS_GPIOD_BASE,
		"E": STELLARIS_GPIOE_BASE,
		"F": STELLARIS_GPIOF_BASE,
		"G": STELLARIS_GPIOG_BASE,
	}
	for p, base := range bases {
		if addr >= base+0x000 && addr < base+0x400 {
			bit = int((addr - base) / 4)
			return p, bit, true
		}
	}
	return "", 0, false
}

// StellarisMonitorRegions 返回 Stellaris GPIO 监控区域
func StellarisMonitorRegions() []MonitorRegion {
	return []MonitorRegion{
		{
			Addr: STELLARIS_GPIOA_BASE + STELLARIS_GPIO_DATA,
			Len:  4,
			OnChange: func(addr uint32, old []byte, new_ []byte) []interface{} {
				oldVal := binary.LittleEndian.Uint32(old)
				newVal := binary.LittleEndian.Uint32(new_)
				if oldVal == newVal {
					return nil
				}
				events := make([]interface{}, 0)
				for i := 0; i < 8; i++ {
					if (oldVal>>uint(i))&1 != (newVal>>uint(i))&1 {
						level := 0
						if (newVal>>uint(i))&1 == 1 {
							level = 1
						}
						events = append(events, GPIOEvent{
							Type:  EventGPIO,
							Pin:   fmt.Sprintf("PA%d", i),
							Level: level,
						})
					}
				}
				return events
			},
		},
	}
}
