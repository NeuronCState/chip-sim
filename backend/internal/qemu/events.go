package qemu

type EventType string

const (
	EventGPIO  EventType = "gpio"
	EventUART  EventType = "uart"
	EventState EventType = "state"
)

type GPIOEvent struct {
	Type  EventType `json:"type"`
	Pin   string    `json:"pin"`   // 如 "PA5"
	Level int       `json:"level"` // 0 或 1
	Time  uint64    `json:"time"`  // 仿真周期数
}

type UARTEvent struct {
	Type EventType `json:"type"`
	Data string    `json:"data"`
	Time uint64    `json:"time"`
}

type StateEvent struct {
	Type    EventType `json:"type"`
	Running bool      `json:"running"`
	PC      uint32    `json:"pc"`     // 程序计数器
	Cycles  uint64    `json:"cycles"` // 总周期数
}
