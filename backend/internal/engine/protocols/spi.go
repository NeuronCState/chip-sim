// Package protocols SPI 协议时序仿真引擎
// 支持 Mode 0-3，可配置时钟频率/CPOL/CPHA/数据位宽
package protocols

import (
	"fmt"

	"chip-sim/pkg/types"
)

// SimulateSPI 生成 SPI 通信的精确时序波形
func SimulateSPI(cfg *types.SPIConfig) (*types.ProtocolSimResult, error) {
	if cfg == nil {
		return nil, fmt.Errorf("SPI config is nil")
	}
	if cfg.Mode > 3 {
		return nil, fmt.Errorf("invalid SPI mode %d (must be 0-3)", cfg.Mode)
	}
	if cfg.ClockFreqHz <= 0 {
		return nil, fmt.Errorf("clock frequency must be positive, got %f", cfg.ClockFreqHz)
	}
	if cfg.DataBits != 8 && cfg.DataBits != 16 && cfg.DataBits != 32 {
		return nil, fmt.Errorf("unsupported data bits: %d (use 8/16/32)", cfg.DataBits)
	}

	cpol := int(cfg.Mode) >> 1 & 1
	cpha := int(cfg.Mode) & 1

	clkPeriodNs := 1e9 / cfg.ClockFreqHz // 一个完整时钟周期 (ns)
	halfPeriodNs := clkPeriodNs / 2.0

	// 信号通道
	var sclk, mosi, miso, cs []types.SignalTransition
	var annotations []types.BitAnnotation
	var busEvents []types.BusEvent

	csIdle := 1
	csActive := 0
	if !cfg.CSPolActiveLow {
		csIdle = 0
		csActive = 1
	}

	idleClk := cpol // 空闲时钟电平

	// CS 建立时间：1/4 时钟周期
	csSetupNs := halfPeriodNs / 2

	currentTime := 0.0

	// 初始空闲状态
	sclk = append(sclk, types.SignalTransition{TimeNs: currentTime, Value: idleClk, Phase: "idle"})
	mosi = append(mosi, types.SignalTransition{TimeNs: currentTime, Value: 0, Phase: "idle"})
	miso = append(miso, types.SignalTransition{TimeNs: currentTime, Value: 0, Phase: "idle"})
	cs = append(cs, types.SignalTransition{TimeNs: currentTime, Value: csIdle, Phase: "idle"})

	// CS 拉低（激活）
	currentTime += csSetupNs
	cs = append(cs, types.SignalTransition{TimeNs: currentTime, Value: csActive, Phase: "cs_active", Label: "CS↓"})
	busEvents = append(busEvents, types.BusEvent{TimeNs: currentTime, State: "transfer", Label: "CS Active"})

	// 传输每个字节
	allBytes := cfg.MOSIData
	maxBytes := len(allBytes)
	if len(cfg.MISOData) > maxBytes {
		maxBytes = len(cfg.MISOData)
	}

	byteStartNs := currentTime
	for byteIdx := 0; byteIdx < maxBytes; byteIdx++ {
		var mosiByte, misoByte uint32
		if byteIdx < len(allBytes) {
			mosiByte = allBytes[byteIdx]
		}
		if byteIdx < len(cfg.MISOData) {
			misoByte = cfg.MISOData[byteIdx]
		}

		// 对每个 bit 生成时序
		for bit := cfg.DataBits - 1; bit >= 0; bit-- {
			mosiBit := int((mosiByte >> uint(bit)) & 1)
			misoBit := int((misoByte >> uint(bit)) & 1)

			bitStartNs := currentTime

			if cpha == 0 {
				// CPHA=0: 数据在第一个边沿放置，第二个边沿采样
				// 第一个半周期：MOSI 输出数据，时钟第一个边沿
				edgeTime := currentTime + halfPeriodNs/2

				// MOSI 在时钟边沿之前就稳定
				mosi = append(mosi, types.SignalTransition{
					TimeNs: edgeTime - halfPeriodNs*0.1,
					Value:  mosiBit,
					Phase:  "clocking",
				})

				// 第一个时钟边沿
				firstEdge := 1 - idleClk
				sclk = append(sclk, types.SignalTransition{
					TimeNs: edgeTime,
					Value:  firstEdge,
					Phase:  "clocking",
					Label:  fmt.Sprintf("B%d:%d", cfg.DataBits-1-bit, mosiBit),
				})

				// MISO 在第一个边沿采样（从机输出）
				miso = append(miso, types.SignalTransition{
					TimeNs: edgeTime,
					Value:  misoBit,
					Phase:  "clocking",
				})

				// 第二个时钟边沿（回到空闲）
				secondEdgeTime := edgeTime + halfPeriodNs
				sclk = append(sclk, types.SignalTransition{
					TimeNs: secondEdgeTime,
					Value:  idleClk,
					Phase:  "clocking",
				})

				currentTime = secondEdgeTime
			} else {
				// CPHA=1: 第一个边沿采样，第二个边沿放置数据
				// 第一个时钟边沿
				edgeTime := currentTime + halfPeriodNs/2

				firstEdge := 1 - idleClk
				sclk = append(sclk, types.SignalTransition{
					TimeNs: edgeTime,
					Value:  firstEdge,
					Phase:  "clocking",
				})

				// 数据在第一个边沿之后稳定
				dataSetupTime := edgeTime + halfPeriodNs*0.1
				mosi = append(mosi, types.SignalTransition{
					TimeNs: dataSetupTime,
					Value:  mosiBit,
					Phase:  "clocking",
				})
				miso = append(miso, types.SignalTransition{
					TimeNs: dataSetupTime,
					Value:  misoBit,
					Phase:  "clocking",
				})

				// 第二个时钟边沿（采样）
				secondEdgeTime := edgeTime + halfPeriodNs
				sclk = append(sclk, types.SignalTransition{
					TimeNs: secondEdgeTime,
					Value:  idleClk,
					Phase:  "clocking",
					Label:  fmt.Sprintf("B%d:%d", cfg.DataBits-1-bit, mosiBit),
				})

				currentTime = secondEdgeTime
			}

			// bit 标注
			annotations = append(annotations, types.BitAnnotation{
				SignalName:  "MOSI",
				StartTimeNs: bitStartNs,
				EndTimeNs:   currentTime,
				Value:       fmt.Sprintf("%d", mosiBit),
			})
			annotations = append(annotations, types.BitAnnotation{
				SignalName:  "MISO",
				StartTimeNs: bitStartNs,
				EndTimeNs:   currentTime,
				Value:       fmt.Sprintf("%d", misoBit),
			})
		}

		// 字节间标注
		_ = byteStartNs
		busEvents = append(busEvents, types.BusEvent{
			TimeNs: currentTime,
			State:  "transfer",
			Label:  fmt.Sprintf("Byte %d done", byteIdx),
		})
	}

	// CS 释放
	currentTime += csSetupNs
	cs = append(cs, types.SignalTransition{TimeNs: currentTime, Value: csIdle, Phase: "cs_deassert", Label: "CS↑"})
	busEvents = append(busEvents, types.BusEvent{TimeNs: currentTime, State: "idle", Label: "CS Deassert"})

	// 确保所有信号在总时长处有最终值
	sclk = append(sclk, types.SignalTransition{TimeNs: currentTime + csSetupNs, Value: idleClk, Phase: "idle"})
	mosi = append(mosi, types.SignalTransition{TimeNs: currentTime + csSetupNs, Value: 0, Phase: "idle"})
	miso = append(miso, types.SignalTransition{TimeNs: currentTime + csSetupNs, Value: 0, Phase: "idle"})
	cs = append(cs, types.SignalTransition{TimeNs: currentTime + csSetupNs, Value: csIdle, Phase: "idle"})

	totalTime := currentTime + csSetupNs

	return &types.ProtocolSimResult{
		Protocol: types.ProtocolSPI,
		Signals: []types.SignalChannel{
			{Name: "SCLK", Color: "#ff6b6b", Transitions: sclk},
			{Name: "MOSI", Color: "#4ecdc4", Transitions: mosi},
			{Name: "MISO", Color: "#ffd93d", Transitions: miso},
			{Name: "CS", Color: "#ff9f43", Transitions: cs},
		},
		BusEvents:      busEvents,
		BitAnnotations: annotations,
		TotalTimeNs:    totalTime,
	}, nil
}
