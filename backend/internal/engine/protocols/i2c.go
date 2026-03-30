// Package protocols I2C 协议时序仿真引擎
// 支持 7/10 位地址、标准/快速模式、ACK/NACK
package protocols

import (
	"fmt"
	"math"

	"chip-sim/pkg/types"
)

// i2cClockPeriodNs 根据速度模式返回 SCL 时钟周期 (ns)
func i2cClockPeriodNs(speed types.I2CSpeedMode) float64 {
	switch speed {
	case types.I2CStandard:
		return 1e9 / 100e3 // 10 µs
	case types.I2CFast:
		return 1e9 / 400e3 // 2.5 µs
	case types.I2CFastPlus:
		return 1e9 / 1e6 // 1 µs
	default:
		return 1e9 / 100e3
	}
}

// SimulateI2C 生成 I2C 通信的精确时序波形
func SimulateI2C(cfg *types.I2CConfig) (*types.ProtocolSimResult, error) {
	if cfg == nil {
		return nil, fmt.Errorf("I2C config is nil")
	}

	clkPeriodNs := i2cClockPeriodNs(cfg.SpeedMode)
	halfClkNs := clkPeriodNs / 2.0

	var scl, sda []types.SignalTransition
	var annotations []types.BitAnnotation
	var busEvents []types.BusEvent

	currentTime := 0.0

	// 初始空闲状态：SCL=1, SDA=1
	scl = append(scl, types.SignalTransition{TimeNs: currentTime, Value: 1, Phase: "idle"})
	sda = append(sda, types.SignalTransition{TimeNs: currentTime, Value: 1, Phase: "idle"})
	busEvents = append(busEvents, types.BusEvent{TimeNs: currentTime, State: "idle", Label: "Bus Idle"})

	// ====== START 条件：SCL 高时 SDA 从高到低 ======
	startHoldNs := halfClkNs * 0.8
	currentTime += halfClkNs
	// SDA 拉低（SCL 保持高）
	sda = append(sda, types.SignalTransition{TimeNs: currentTime, Value: 0, Phase: "start", Label: "START↓"})
	busEvents = append(busEvents, types.BusEvent{TimeNs: currentTime, State: "start", Label: "START"})
	annotations = append(annotations, types.BitAnnotation{
		SignalName: "SDA", StartTimeNs: currentTime - halfClkNs*0.3, EndTimeNs: currentTime + startHoldNs, Value: "S",
	})
	currentTime += startHoldNs

	// ====== 发送地址 ======
	var addrBits int
	var addrVal uint16
	var addrLabel string

	if cfg.AddressMode == types.I2CAddr7bit {
		addrBits = 7
		addrVal = cfg.SlaveAddress & 0x7F
		addrLabel = fmt.Sprintf("Addr:0x%02X", addrVal)
	} else {
		addrBits = 10
		addrVal = cfg.SlaveAddress & 0x3FF
		addrLabel = fmt.Sprintf("Addr:0x%03X", addrVal)
	}

	// R/W bit：0=write, 1=read
	rwBit := 0
	if cfg.TransferType == types.I2CRead {
		rwBit = 1
	}

	busEvents = append(busEvents, types.BusEvent{TimeNs: currentTime, State: "transfer", Label: addrLabel})

	// 发送地址位（MSB first）
	addrBitStart := currentTime
	for i := addrBits - 1; i >= 0; i-- {
		bitVal := int((addrVal >> uint(i)) & 1)
		currentTime = i2cSendBit(&scl, &sda, currentTime, halfClkNs, bitVal, "address")
		annotations = append(annotations, types.BitAnnotation{
			SignalName: "SDA", StartTimeNs: addrBitStart, EndTimeNs: currentTime,
			Value: fmt.Sprintf("%d", bitVal),
		})
		addrBitStart = currentTime
	}

	// R/W bit
	currentTime = i2cSendBit(&scl, &sda, currentTime, halfClkNs, rwBit, "address")
	rwLabel := "W"
	if rwBit == 1 {
		rwLabel = "R"
	}
	annotations = append(annotations, types.BitAnnotation{
		SignalName: "SDA", StartTimeNs: addrBitStart, EndTimeNs: currentTime,
		Value: rwLabel,
	})
	busEvents = append(busEvents, types.BusEvent{TimeNs: currentTime, State: "transfer", Label: fmt.Sprintf("R/%s", rwLabel)})

	// ====== ACK/NACK (地址) ======
	ackResult := 0 // ACK
	if !cfg.HasACK {
		ackResult = 1 // NACK
	}
	currentTime = i2cReceiveACK(&scl, &sda, &annotations, currentTime, halfClkNs, ackResult, "addr_ack")
	ackLabel := "ACK"
	if ackResult == 1 {
		ackLabel = "NACK"
	}
	busEvents = append(busEvents, types.BusEvent{TimeNs: currentTime, State: ackLabel, Label: fmt.Sprintf("Addr %s", ackLabel)})

	// ====== 10 位地址的第二字节 ======
	if cfg.AddressMode == types.I2CAddr10bit {
		secondByte := uint8(cfg.SlaveAddress & 0xFF)
		byteStart := currentTime
		for i := 7; i >= 0; i-- {
			bitVal := int((secondByte >> uint(i)) & 1)
			currentTime = i2cSendBit(&scl, &sda, currentTime, halfClkNs, bitVal, "address")
			annotations = append(annotations, types.BitAnnotation{
				SignalName: "SDA", StartTimeNs: byteStart, EndTimeNs: currentTime,
				Value: fmt.Sprintf("%d", bitVal),
			})
			byteStart = currentTime
		}
		currentTime = i2cReceiveACK(&scl, &sda, &annotations, currentTime, halfClkNs, ackResult, "addr_ack")
	}

	// ====== 数据传输 ======
	if cfg.TransferType == types.I2CWrite {
		// Master 写数据
		for byteIdx, dataByte := range cfg.Data {
			byteStart := currentTime
			for i := 7; i >= 0; i-- {
				bitVal := int((dataByte >> uint(i)) & 1)
				currentTime = i2cSendBit(&scl, &sda, currentTime, halfClkNs, bitVal, "data")
			}
			annotations = append(annotations, types.BitAnnotation{
				SignalName: "SDA", StartTimeNs: byteStart, EndTimeNs: currentTime,
				Value: fmt.Sprintf("0x%02X", dataByte),
			})
			busEvents = append(busEvents, types.BusEvent{
				TimeNs: currentTime, State: "transfer",
				Label: fmt.Sprintf("Byte %d: 0x%02X", byteIdx, dataByte),
			})

			// 每字节后 ACK
			isLast := byteIdx == len(cfg.Data)-1
			if isLast && !cfg.HasACK {
				currentTime = i2cReceiveACK(&scl, &sda, &annotations, currentTime, halfClkNs, 1, "nack")
				busEvents = append(busEvents, types.BusEvent{TimeNs: currentTime, State: "nack", Label: "NACK"})
			} else {
				currentTime = i2cReceiveACK(&scl, &sda, &annotations, currentTime, halfClkNs, 0, "ack")
				busEvents = append(busEvents, types.BusEvent{TimeNs: currentTime, State: "ack", Label: "ACK"})
			}
		}
	} else {
		// Master 读数据 — Slave 驱动 SDA
		for byteIdx, dataByte := range cfg.Data {
			byteStart := currentTime
			for i := 7; i >= 0; i-- {
				bitVal := int((dataByte >> uint(i)) & 1)
				currentTime = i2cSendBit(&scl, &sda, currentTime, halfClkNs, bitVal, "data")
			}
			annotations = append(annotations, types.BitAnnotation{
				SignalName: "SDA", StartTimeNs: byteStart, EndTimeNs: currentTime,
				Value: fmt.Sprintf("0x%02X", dataByte),
			})

			isLast := byteIdx == len(cfg.Data)-1
			if isLast {
				currentTime = i2cReceiveACK(&scl, &sda, &annotations, currentTime, halfClkNs, 1, "nack")
				busEvents = append(busEvents, types.BusEvent{TimeNs: currentTime, State: "nack", Label: "Master NACK"})
			} else {
				currentTime = i2cReceiveACK(&scl, &sda, &annotations, currentTime, halfClkNs, 0, "ack")
				busEvents = append(busEvents, types.BusEvent{TimeNs: currentTime, State: "ack", Label: "Master ACK"})
			}
		}
	}

	// ====== STOP 条件：SCL 高时 SDA 从低到高 ======
	currentTime += halfClkNs * 0.5
	scl = append(scl, types.SignalTransition{TimeNs: currentTime, Value: 1, Phase: "stop"})
	currentTime += halfClkNs * 0.5
	sda = append(sda, types.SignalTransition{TimeNs: currentTime, Value: 1, Phase: "stop", Label: "STOP↑"})
	busEvents = append(busEvents, types.BusEvent{TimeNs: currentTime, State: "stop", Label: "STOP"})
	annotations = append(annotations, types.BitAnnotation{
		SignalName: "SDA", StartTimeNs: currentTime - halfClkNs*0.5, EndTimeNs: currentTime + halfClkNs, Value: "P",
	})

	// 空闲恢复
	currentTime += halfClkNs
	scl = append(scl, types.SignalTransition{TimeNs: currentTime, Value: 1, Phase: "idle"})
	sda = append(sda, types.SignalTransition{TimeNs: currentTime, Value: 1, Phase: "idle"})
	busEvents = append(busEvents, types.BusEvent{TimeNs: currentTime, State: "idle", Label: "Bus Idle"})

	return &types.ProtocolSimResult{
		Protocol: types.ProtocolI2C,
		Signals: []types.SignalChannel{
			{Name: "SCL", Color: "#ff6b6b", Transitions: scl},
			{Name: "SDA", Color: "#4ecdc4", Transitions: sda},
		},
		BusEvents:      busEvents,
		BitAnnotations: annotations,
		TotalTimeNs:    currentTime,
	}, nil
}

// i2cSendBit 在 I2C 总线上发送一个 bit（生成 SCL 脉冲 + SDA 数据）
func i2cSendBit(scl, sda *[]types.SignalTransition, currentTime, halfClkNs float64, bitVal int, phase string) float64 {
	// SDA 在 SCL 低电平时变化
	*sda = append(*sda, types.SignalTransition{TimeNs: currentTime, Value: bitVal, Phase: phase})

	// SCL 上升沿
	currentTime += halfClkNs * 0.5
	*scl = append(*scl, types.SignalTransition{TimeNs: currentTime, Value: 1, Phase: phase})

	// SCL 高电平保持（采样窗口）
	currentTime += halfClkNs * 0.5

	// SCL 下降沿
	*scl = append(*scl, types.SignalTransition{TimeNs: currentTime, Value: 0, Phase: phase})

	return currentTime
}

// i2cReceiveACK 模拟 ACK/NACK bit（第 9 个时钟脉冲）
func i2cReceiveACK(scl, sda *[]types.SignalTransition, annotations *[]types.BitAnnotation, currentTime, halfClkNs float64, ackVal int, phase string) float64 {
	// 接收方驱动 SDA（在 SCL 低电平时释放/拉低）
	ackStart := currentTime
	*sda = append(*sda, types.SignalTransition{TimeNs: currentTime, Value: ackVal, Phase: phase})

	// SCL 上升沿
	currentTime += halfClkNs * 0.5
	*scl = append(*scl, types.SignalTransition{TimeNs: currentTime, Value: 1, Phase: phase})

	// 采样窗口
	currentTime += halfClkNs * 0.5

	// SCL 下降沿
	*scl = append(*scl, types.SignalTransition{TimeNs: currentTime, Value: 0, Phase: phase})

	label := "ACK"
	if ackVal == 1 {
		label = "NACK"
	}
	*annotations = append(*annotations, types.BitAnnotation{
		SignalName: "SDA", StartTimeNs: ackStart, EndTimeNs: currentTime, Value: label,
	})

	return currentTime
}

// roundI2C 浮点取整辅助
func roundI2C(x float64) float64 {
	return math.Round(x*1e6) / 1e6
}
