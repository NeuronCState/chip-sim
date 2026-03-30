// Package protocols UART 协议时序仿真引擎
// 支持可配置波特率、数据位、停止位、校验位
package protocols

import (
	"fmt"

	"chip-sim/pkg/types"
)

// SimulateUART 生成 UART 通信的精确时序波形
func SimulateUART(cfg *types.UARTConfig) (*types.ProtocolSimResult, error) {
	if cfg == nil {
		return nil, fmt.Errorf("UART config is nil")
	}
	if cfg.BaudRate <= 0 {
		return nil, fmt.Errorf("baud rate must be positive, got %d", cfg.BaudRate)
	}
	if cfg.DataBits < 5 || cfg.DataBits > 8 {
		return nil, fmt.Errorf("data bits must be 5-8, got %d", cfg.DataBits)
	}
	if cfg.StopBits != 1 && cfg.StopBits != 1.5 && cfg.StopBits != 2 {
		return nil, fmt.Errorf("stop bits must be 1, 1.5, or 2, got %f", cfg.StopBits)
	}

	bitPeriodNs := 1e9 / float64(cfg.BaudRate) // 一个 bit 的时长 (ns)

	var tx, rx []types.SignalTransition
	var annotations []types.BitAnnotation
	var busEvents []types.BusEvent

	currentTime := 0.0

	// 空闲状态：TX=1 (高电平)
	tx = append(tx, types.SignalTransition{TimeNs: currentTime, Value: 1, Phase: "idle"})
	rx = append(rx, types.SignalTransition{TimeNs: currentTime, Value: 1, Phase: "idle"})
	busEvents = append(busEvents, types.BusEvent{TimeNs: currentTime, State: "idle", Label: "Line Idle"})

	// 逐字节发送
	for byteIdx, dataByte := range cfg.TXData {
		byteStart := currentTime

		// ====== START bit ======
		tx = append(tx, types.SignalTransition{TimeNs: currentTime, Value: 0, Phase: "start", Label: "Start"})
		rx = append(rx, types.SignalTransition{TimeNs: currentTime, Value: 0, Phase: "start"})
		busEvents = append(busEvents, types.BusEvent{TimeNs: currentTime, State: "start", Label: fmt.Sprintf("Byte %d Start", byteIdx)})
		annotations = append(annotations, types.BitAnnotation{
			SignalName: "TX", StartTimeNs: currentTime, EndTimeNs: currentTime + bitPeriodNs, Value: "S",
		})
		currentTime += bitPeriodNs

		// ====== DATA bits ======
		onesCount := 0
		dataBitStart := currentTime
		for bit := 0; bit < cfg.DataBits; bit++ {
			var bitVal int
			if cfg.BitOrderLSB {
				// LSB first
				bitVal = int((dataByte >> uint(bit)) & 1)
			} else {
				// MSB first
				bitVal = int((dataByte >> uint(cfg.DataBits-1-bit)) & 1)
			}

			tx = append(tx, types.SignalTransition{TimeNs: currentTime, Value: bitVal, Phase: "data"})
			rx = append(rx, types.SignalTransition{TimeNs: currentTime, Value: bitVal, Phase: "data"})

			if bitVal == 1 {
				onesCount++
			}

			currentTime += bitPeriodNs
		}

		// data 区间标注
		annotations = append(annotations, types.BitAnnotation{
			SignalName:  "TX",
			StartTimeNs: dataBitStart,
			EndTimeNs:   currentTime,
			Value:       fmt.Sprintf("0x%02X", dataByte),
		})

		// ====== PARITY bit (可选) ======
		if cfg.Parity != types.ParityNone {
			var parityVal int
			if cfg.Parity == types.ParityEven {
				parityVal = onesCount % 2 // even: 偶数个1 → 0, 奇数个1 → 1
			} else {
				parityVal = (onesCount + 1) % 2 // odd: 偶数个1 → 1, 奇数个1 → 0
			}

			tx = append(tx, types.SignalTransition{TimeNs: currentTime, Value: parityVal, Phase: "parity"})
			rx = append(rx, types.SignalTransition{TimeNs: currentTime, Value: parityVal, Phase: "parity"})
			annotations = append(annotations, types.BitAnnotation{
				SignalName:  "TX",
				StartTimeNs: currentTime,
				EndTimeNs:   currentTime + bitPeriodNs,
				Value:       fmt.Sprintf("P=%d", parityVal),
			})
			currentTime += bitPeriodNs
		}

		// ====== STOP bit(s) ======
		tx = append(tx, types.SignalTransition{TimeNs: currentTime, Value: 1, Phase: "stop"})
		rx = append(rx, types.SignalTransition{TimeNs: currentTime, Value: 1, Phase: "stop"})
		annotations = append(annotations, types.BitAnnotation{
			SignalName:  "TX",
			StartTimeNs: currentTime,
			EndTimeNs:   currentTime + bitPeriodNs*cfg.StopBits,
			Value:       "P", // Stop
		})
		currentTime += bitPeriodNs * cfg.StopBits

		busEvents = append(busEvents, types.BusEvent{
			TimeNs: currentTime,
			State:  "transfer",
			Label:  fmt.Sprintf("Byte %d: 0x%02X", byteIdx, dataByte),
		})

		// 字节间间隔 (可选的 idle 时间)
		if byteIdx < len(cfg.TXData)-1 {
			currentTime += bitPeriodNs * 0.5
			tx = append(tx, types.SignalTransition{TimeNs: currentTime, Value: 1, Phase: "idle"})
			rx = append(rx, types.SignalTransition{TimeNs: currentTime, Value: 1, Phase: "idle"})
		}

		_ = byteStart
	}

	// 最终空闲
	currentTime += bitPeriodNs
	tx = append(tx, types.SignalTransition{TimeNs: currentTime, Value: 1, Phase: "idle"})
	rx = append(rx, types.SignalTransition{TimeNs: currentTime, Value: 1, Phase: "idle"})
	busEvents = append(busEvents, types.BusEvent{TimeNs: currentTime, State: "idle", Label: "Line Idle"})

	return &types.ProtocolSimResult{
		Protocol: types.ProtocolUART,
		Signals: []types.SignalChannel{
			{Name: "TX", Color: "#4ecdc4", Transitions: tx},
			{Name: "RX", Color: "#ffd93d", Transitions: rx},
		},
		BusEvents:      busEvents,
		BitAnnotations: annotations,
		TotalTimeNs:    currentTime,
	}, nil
}
