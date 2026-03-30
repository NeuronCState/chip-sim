// Package protocols CAN 总线协议时序仿真引擎
// 支持 CAN 2.0B 规范：标准帧(11-bit ID)、扩展帧(29-bit ID)
// 实现位填充、CRC-15 校验、仲裁机制、错误检测与错误状态机
package protocols

import (
	"fmt"
	"math"

	"chip-sim/pkg/types"
)

// ==================== CRC-15 计算 ====================

// canCRC15 使用多项式 x^15 + x^14 + x^10 + x^8 + x^7 + x^4 + x^3 + 1 (0x4599)
// 计算 CRC-15 校验值，这是 CAN 总线标准 CRC 算法
func canCRC15(data []bool) uint16 {
	var crc uint16 = 0
	for _, bit := range data {
		// 取 CRC 最高位与当前数据位异或
		xor := (crc>>14)&1 != 0
		if bit {
			xor = !xor
		}
		// 左移一位
		crc <<= 1
		crc &= 0x7FFF
		// 如果异或结果为 1，则与多项式异或
		if xor {
			crc ^= 0x4599
		}
	}
	return crc
}

// ==================== 位填充 ====================

// canBitStuff 对原始比特流执行 CAN 位填充
// 连续 5 个相同电平后插入一个反相位
func canBitStuff(bits []bool) []bool {
	if len(bits) == 0 {
		return bits
	}

	var stuffed []bool
	consecutive := 1
	lastBit := bits[0]
	stuffed = append(stuffed, lastBit)

	for i := 1; i < len(bits); i++ {
		if bits[i] == lastBit {
			consecutive++
		} else {
			consecutive = 1
			lastBit = bits[i]
		}
		stuffed = append(stuffed, bits[i])

		// 连续 5 个相同比特，插入反相位
		if consecutive == 5 {
			stuffedBit := !lastBit
			stuffed = append(stuffed, stuffedBit)
			consecutive = 1
			lastBit = stuffedBit
		}
	}
	return stuffed
}

// canBitDestuff 对填充后的比特流执行去填充
func canBitDestuff(bits []bool) []bool {
	if len(bits) <= 5 {
		return bits
	}

	var destuffed []bool
	consecutive := 1
	lastBit := bits[0]
	destuffed = append(destuffed, lastBit)

	for i := 1; i < len(bits); i++ {
		if bits[i] == lastBit {
			consecutive++
		} else {
			consecutive = 1
			lastBit = bits[i]
		}

		if consecutive == 5 {
			// 跳过下一个填充位
			if i+1 < len(bits) {
				i++ // 跳过填充位
			}
			consecutive = 1
			// 下一个位更新 lastBit
			if i+1 < len(bits) {
				// 不在这里更新，让循环处理
			}
			continue
		}

		destuffed = append(destuffed, bits[i])
	}
	return destuffed
}

// ==================== 帧构建 ====================

// canBuildStandardFrame 构建标准 CAN 帧的比特流（不含位填充）
// 帧结构: SOF(1) + ID(11) + RTR(1) + IDE(1)=0 + r0(1) + DLC(4) + Data(0-64) + CRC(15) + CRC Delimiter(1) + ACK Slot(1) + ACK Delimiter(1) + EOF(7)
func canBuildStandardFrame(cfg *types.CANConfig) []bool {
	var bits []bool

	// SOF - 帧起始 (显性 = 0)
	bits = append(bits, false)

	// 11-bit ID (MSB first)
	id := cfg.ID & 0x7FF
	for i := 10; i >= 0; i-- {
		bits = append(bits, (id>>uint(i))&1 == 1)
	}

	// RTR - 远程传输请求 (数据帧=0, 远程帧=1)
	isRemote := cfg.FrameType == types.CANFrameRemote
	bits = append(bits, isRemote)

	// IDE - 标识符扩展 (标准帧=0)
	bits = append(bits, false)

	// r0 - 保留位 (0)
	bits = append(bits, false)

	// DLC - 数据长度码 (4 bits)
	dlc := cfg.DLC
	if dlc > 8 {
		dlc = 8
	}
	if dlc < 0 {
		dlc = 0
	}
	for i := 3; i >= 0; i-- {
		bits = append(bits, (dlc>>uint(i))&1 == 1)
	}

	// 数据域 (远程帧也包含 DLC 指定的字节数，但实际无意义)
	if cfg.FrameType != types.CANFrameRemote {
		dataLen := dlc
		if dataLen > len(cfg.Data) {
			dataLen = len(cfg.Data)
		}
		for b := 0; b < dataLen; b++ {
			byteVal := cfg.Data[b]
			for i := 7; i >= 0; i-- {
				bits = append(bits, (byteVal>>uint(i))&1 == 1)
			}
		}
	}

	// CRC 域 (计算 SOF 到数据域结束的 CRC)
	crcData := bits // SOF + ID + RTR + IDE + r0 + DLC + Data
	crc := canCRC15(crcData)
	// CRC 15 bits (MSB first)
	for i := 14; i >= 0; i-- {
		bits = append(bits, (crc>>uint(i))&1 == 1)
	}

	// CRC 分隔符 (隐性 = 1)
	bits = append(bits, true)

	// ACK 槽 (由接收方填充，初始为隐性 = 1)
	bits = append(bits, true)

	// ACK 分隔符 (隐性 = 1)
	bits = append(bits, true)

	// EOF - 帧结束 (7 个隐性位)
	for i := 0; i < 7; i++ {
		bits = append(bits, true)
	}

	return bits
}

// canBuildExtendedFrame 构建扩展 CAN 帧的比特流
// 帧结构: SOF(1) + ID_A(11) + SRR(1)=1 + IDE(1)=1 + ID_B(18) + RTR(1) + r1(1) + r0(1) + DLC(4) + Data(0-64) + CRC(15) + CRC Delim(1) + ACK Slot(1) + ACK Delim(1) + EOF(7)
func canBuildExtendedFrame(cfg *types.CANConfig) []bool {
	var bits []bool

	// SOF - 帧起始 (显性 = 0)
	bits = append(bits, false)

	// ID_A - 标准 ID 部分 (11 bits, MSB first)
	idA := (cfg.ID >> 18) & 0x7FF
	for i := 10; i >= 0; i-- {
		bits = append(bits, (idA>>uint(i))&1 == 1)
	}

	// SRR - 替代远程请求 (扩展帧固定为隐性 = 1)
	bits = append(bits, true)

	// IDE - 标识符扩展 (扩展帧 = 1)
	bits = append(bits, true)

	// ID_B - 扩展 ID 部分 (18 bits, MSB first)
	idB := cfg.ID & 0x3FFFF
	for i := 17; i >= 0; i-- {
		bits = append(bits, (idB>>uint(i))&1 == 1)
	}

	// RTR - 远程传输请求
	isRemote := cfg.FrameType == types.CANFrameRemote
	bits = append(bits, isRemote)

	// r1, r0 - 保留位 (0)
	bits = append(bits, false)
	bits = append(bits, false)

	// DLC - 数据长度码
	dlc := cfg.DLC
	if dlc > 8 {
		dlc = 8
	}
	if dlc < 0 {
		dlc = 0
	}
	for i := 3; i >= 0; i-- {
		bits = append(bits, (dlc>>uint(i))&1 == 1)
	}

	// 数据域
	if cfg.FrameType != types.CANFrameRemote {
		dataLen := dlc
		if dataLen > len(cfg.Data) {
			dataLen = len(cfg.Data)
		}
		for b := 0; b < dataLen; b++ {
			byteVal := cfg.Data[b]
			for i := 7; i >= 0; i-- {
				bits = append(bits, (byteVal>>uint(i))&1 == 1)
			}
		}
	}

	// CRC
	crcData := bits
	crc := canCRC15(crcData)
	for i := 14; i >= 0; i-- {
		bits = append(bits, (crc>>uint(i))&1 == 1)
	}

	// CRC 分隔符
	bits = append(bits, true)

	// ACK 槽
	bits = append(bits, true)

	// ACK 分隔符
	bits = append(bits, true)

	// EOF (7 个隐性位)
	for i := 0; i < 7; i++ {
		bits = append(bits, true)
	}

	return bits
}

// ==================== 错误帧 ====================

// canBuildErrorFrame 构建错误帧
// 主动错误: 6 个显性位 + 8 个隐性位
// 被动错误: 6 个隐性位 + 8 个隐性位
func canBuildErrorFrame(isPassive bool) []bool {
	var bits []bool

	// 错误标志
	errorBit := false // 主动错误: 显性
	if isPassive {
		errorBit = true // 被动错误: 隐性
	}
	for i := 0; i < 6; i++ {
		bits = append(bits, errorBit)
	}

	// 错误分隔符 (8 个隐性位)
	for i := 0; i < 8; i++ {
		bits = append(bits, true)
	}

	return bits
}

// ==================== 过载帧 ====================

// canBuildOverloadFrame 构建过载帧
// 过载标志: 6 个显性位 + 过载分隔符: 8 个隐性位
func canBuildOverloadFrame() []bool {
	var bits []bool

	// 过载标志 (6 个显性位)
	for i := 0; i < 6; i++ {
		bits = append(bits, false)
	}

	// 过载分隔符 (8 个隐性位)
	for i := 0; i < 8; i++ {
		bits = append(bits, true)
	}

	return bits
}

// ==================== 检测位填充错误 ====================

// canDetectStuffError 检测填充后的比特流是否存在位填充错误
// 如果在 CRC 结束后仍然存在 5 个连续相同比特，视为填充错误
func canDetectStuffError(bits []bool) bool {
	if len(bits) < 5 {
		return false
	}
	consecutive := 1
	for i := 1; i < len(bits); i++ {
		if bits[i] == bits[i-1] {
			consecutive++
			if consecutive > 5 {
				return true
			}
		} else {
			consecutive = 1
		}
	}
	return false
}

// ==================== CAN 波特率辅助 ====================

// canBitPeriodNs 根据波特率返回一个 bit 的时长 (ns)
func canBitPeriodNs(baudRate types.CANBaudRate) float64 {
	if baudRate <= 0 {
		baudRate = types.CANBaud500K
	}
	return 1e9 / float64(baudRate)
}

// ==================== 错误计数器与状态机 ====================

// CANErrorCounter CAN 错误计数器状态
type CANErrorCounter struct {
	TEC        int              // 发送错误计数器
	REC        int              // 接收错误计数器
	State      types.CANErrorState // 当前错误状态
}

// NewCANErrorCounter 创建新的错误计数器（主动错误状态）
func NewCANErrorCounter() *CANErrorCounter {
	return &CANErrorCounter{
		TEC:   0,
		REC:   0,
		State: types.CANErrorActive,
	}
}

// OnTransmitError 发送错误发生时更新计数器
// CAN 规范: +8 (正常发送错误), +8 (发送主动错误标志时检测到错误)
func (ec *CANErrorCounter) OnTransmitError() {
	ec.TEC += 8
	ec.updateState()
}

// OnReceiveError 接收错误发生时更新计数器
// CAN 规范: +1
func (ec *CANErrorCounter) OnReceiveError() {
	ec.REC += 1
	ec.updateState()
}

// OnSuccessfulSend 发送成功时更新计数器
// CAN 规范: TEC > 0 时 -1
func (ec *CANErrorCounter) OnSuccessfulSend() {
	if ec.TEC > 0 {
		ec.TEC--
	}
	ec.updateState()
}

// OnSuccessfulReceive 接收成功时更新计数器
// CAN 规范: 1 <= REC <= 127 时 -1
func (ec *CANErrorCounter) OnSuccessfulReceive() {
	if ec.REC > 0 && ec.REC <= 127 {
		ec.REC--
	}
	ec.updateState()
}

// updateState 根据错误计数器值更新节点状态
func (ec *CANErrorCounter) updateState() {
	if ec.TEC >= 256 {
		ec.State = types.CANBusOff
	} else if ec.TEC >= 128 || ec.REC >= 128 {
		ec.State = types.CANErrorPassive
	} else {
		ec.State = types.CANErrorActive
	}
}

// ==================== SimulateCAN ====================

// SimulateCAN 生成 CAN 总线通信的精确时序波形
// 支持标准帧、扩展帧、数据帧、远程帧、错误帧、过载帧
func SimulateCAN(cfg *types.CANConfig) (*types.ProtocolSimResult, error) {
	if cfg == nil {
		return nil, fmt.Errorf("CAN config is nil")
	}

	// 参数验证
	if cfg.FrameFormat == types.CANExtended {
		if cfg.ID > 0x1FFFFFFF {
			return nil, fmt.Errorf("extended CAN ID exceeds 29 bits: 0x%X", cfg.ID)
		}
	} else {
		if cfg.ID > 0x7FF {
			return nil, fmt.Errorf("standard CAN ID exceeds 11 bits: 0x%X", cfg.ID)
		}
	}

	if cfg.DLC < 0 || cfg.DLC > 8 {
		return nil, fmt.Errorf("DLC must be 0-8, got %d", cfg.DLC)
	}

	// 默认参数
	samplePoint := cfg.SamplePoint
	if samplePoint <= 0 || samplePoint > 1 {
		samplePoint = 0.875 // 默认采样点 87.5%
	}
	nodeCount := cfg.NodeCount
	if nodeCount < 2 {
		nodeCount = 2
	}

	bitPeriodNs := canBitPeriodNs(cfg.BaudRate)
	sampleTimeNs := bitPeriodNs * samplePoint // 采样时刻

	var canTx, canRx []types.SignalTransition
	var annotations []types.BitAnnotation
	var busEvents []types.BusEvent

	currentTime := 0.0

	// 初始空闲状态 (总线空闲 = 隐性 = 1)
	canTx = append(canTx, types.SignalTransition{TimeNs: currentTime, Value: 1, Phase: "idle"})
	canRx = append(canRx, types.SignalTransition{TimeNs: currentTime, Value: 1, Phase: "idle"})
	busEvents = append(busEvents, types.BusEvent{TimeNs: currentTime, State: "idle", Label: "总线空闲 (隐性)"})

	// ====== 帧类型处理 ======
	switch cfg.FrameType {
	case types.CANFrameError:
		return simulateCANErrorFrame(cfg, &canTx, &canRx, &busEvents, &annotations, currentTime)
	case types.CANFrameOverload:
		return simulateCANOverloadFrame(cfg, &canTx, &canRx, &busEvents, &annotations, currentTime)
	}

	// ====== 构建数据帧/远程帧 ======
	var rawBits []bool
	frameLabel := "数据帧"
	if cfg.FrameType == types.CANFrameRemote {
		frameLabel = "远程帧"
	}

	if cfg.FrameFormat == types.CANExtended {
		rawBits = canBuildExtendedFrame(cfg)
		busEvents = append(busEvents, busEvents[len(busEvents)-1]) // 占位
		busEvents[len(busEvents)-1] = types.BusEvent{TimeNs: currentTime, State: "transfer", Label: fmt.Sprintf("扩展帧 %s ID=0x%X", frameLabel, cfg.ID)}
	} else {
		rawBits = canBuildStandardFrame(cfg)
		busEvents = append(busEvents, busEvents[len(busEvents)-1])
		busEvents[len(busEvents)-1] = types.BusEvent{TimeNs: currentTime, State: "transfer", Label: fmt.Sprintf("标准帧 %s ID=0x%X", frameLabel, cfg.ID)}
	}

	// ====== 位填充 ======
	stuffedBits := canBitStuff(rawBits)

	// 检测是否需要注入错误
	var errorBitIndex int = -1
	if cfg.ErrorInject != nil {
		switch *cfg.ErrorInject {
		case types.CANErrStuff:
			// 在填充区域注入额外相同比特，制造填充错误
			if len(stuffedBits) > 10 {
				errorBitIndex = 10
			}
		case types.CANErrCRC:
			// 翻转 CRC 域中的一个位 (倒数第 10 位)
			if len(stuffedBits) > 20 {
				errorBitIndex = len(stuffedBits) - 10
			}
		case types.CANErrForm:
			// 在固定域（如 CRC 分隔符）注入显性位
			if len(stuffedBits) > 3 {
				errorBitIndex = len(stuffedBits) - 3 // CRC delimiter
			}
		case types.CANErrAck:
			// ACK 槽不被拉低（保持隐性 = 1，模拟无应答）
			// 这种情况下直接使用原始帧，ACK 槽已经是 1
		case types.CANErrBit:
			// 在仲裁域注入位错误
			if len(stuffedBits) > 5 {
				errorBitIndex = 5
			}
		}
	}

	// ====== 仲裁模拟 (多节点) ======
	// 注意: 仲裁在原始比特流上进行（位填充仅在仲裁域之后才开始应用）
	// 但 CAN 规范: 位填充从 SOF 开始到 CRC 结束
	// 仲裁检测: 检查本节点在原始流上某位发隐性(1)时是否有其他节点发显性(0)
	arbitrationLost := false
	arbitrationBitCount := 0
	arbitrationEnd := 12 // 标准帧仲裁域: SOF(1) + ID(11) = 12 bits
	if cfg.FrameFormat == types.CANExtended {
		arbitrationEnd = 32 // 扩展帧: SOF(1) + ID_A(11) + SRR(1) + IDE(1) + ID_B(18) = 32
	}

	// 模拟其他节点的 ID（用于仲裁竞争）
	// 其他节点 ID 设为全隐性(1)，确保本节点在仲裁中始终获胜
	otherNodeIDs := make([]uint32, nodeCount-1)
	for i := 0; i < nodeCount-1; i++ {
		if cfg.FrameFormat == types.CANExtended {
			otherNodeIDs[i] = 0x1FFFFFFF // 29 位全隐性
		} else {
			otherNodeIDs[i] = 0x7FF // 11 位全隐性
		}
	}

	// 在原始比特流上预先计算仲裁结果
	for rawIdx := 0; rawIdx < arbitrationEnd && rawIdx < len(rawBits); rawIdx++ {
		if rawBits[rawIdx] { // 本节点发隐性(1)
			arbitrationBitCount++
			for _, otherID := range otherNodeIDs {
				otherDominant := false
				if cfg.FrameFormat == types.CANExtended {
					if rawIdx == 0 {
						otherDominant = true // SOF
					} else if rawIdx >= 1 && rawIdx <= 11 {
						idABits := (otherID >> 18) & 0x7FF
						otherDominant = (idABits>>uint(10-(rawIdx-1)))&1 == 0
					} else if rawIdx == 12 {
						otherDominant = false // SRR 隐性
					} else if rawIdx == 13 {
						otherDominant = false // IDE 隐性
					} else if rawIdx >= 14 && rawIdx <= 31 {
						idBBits := otherID & 0x3FFFF
						otherDominant = (idBBits>>uint(17-(rawIdx-14)))&1 == 0
					}
				} else {
					if rawIdx == 0 {
						otherDominant = true // SOF
					} else {
						otherDominant = (otherID>>uint(10-(rawIdx-1)))&1 == 0
					}
				}
				if otherDominant {
					arbitrationLost = true
					break
				}
			}
			if arbitrationLost {
				break
			}
		}
	}

	// ====== 如果仲裁在预计算阶段失败，立即处理 ======
	if arbitrationLost {
		// 发送仲裁失败的部分帧（到仲裁失败的 raw bit 为止）
		// 需要映射 rawBitIndex 到 stuffedBitIndex
		stuffedIdx := 0
		for rawIdx := 0; rawIdx <= arbitrationBitCount && rawIdx < len(rawBits); rawIdx++ {
			if stuffedIdx < len(stuffedBits) {
				bitVal := stuffedBits[stuffedIdx]
				canTx = append(canTx, types.SignalTransition{
					TimeNs: currentTime,
					Value:  boolToInt(bitVal),
					Phase:  "data",
				})
				canRx = append(canRx, types.SignalTransition{
					TimeNs: currentTime + sampleTimeNs,
					Value:  boolToInt(bitVal),
					Phase:  "data",
				})
				currentTime += bitPeriodNs
				stuffedIdx++
			}
		}

		canTx = append(canTx, types.SignalTransition{TimeNs: currentTime, Value: 1, Phase: "arbitration_lost"})
		canRx = append(canRx, types.SignalTransition{TimeNs: currentTime, Value: 1, Phase: "arbitration_lost"})
		busEvents = append(busEvents, types.BusEvent{
			TimeNs: currentTime,
			State:  "arbitration_lost",
			Label:  fmt.Sprintf("仲裁失败 (bit %d), ID=0x%X", arbitrationBitCount, cfg.ID),
		})

		// 总线恢复空闲
		currentTime += bitPeriodNs
		canTx = append(canTx, types.SignalTransition{TimeNs: currentTime, Value: 1, Phase: "idle"})
		canRx = append(canRx, types.SignalTransition{TimeNs: currentTime, Value: 1, Phase: "idle"})
		busEvents = append(busEvents, types.BusEvent{TimeNs: currentTime, State: "idle", Label: "总线空闲"})

		return &types.ProtocolSimResult{
			Protocol: types.ProtocolCAN,
			Signals: []types.SignalChannel{
				{Name: "TX", Color: "#ff6b6b", Transitions: canTx},
				{Name: "RX", Color: "#4ecdc4", Transitions: canRx},
			},
			BusEvents:      busEvents,
			BitAnnotations: annotations,
			TotalTimeNs:    currentTime,
		}, nil
	}

	// ====== 逐 bit 生成波形 ======
	for bitIdx, bitVal := range stuffedBits {

		// 错误注入
		actualBit := bitVal
		if errorBitIndex == bitIdx {
			actualBit = !bitVal // 翻转位
		}

		bitStart := currentTime

		// TX: 发送端在 bit 周期开始时设置电平
		canTx = append(canTx, types.SignalTransition{
			TimeNs: currentTime,
			Value:  boolToInt(actualBit),
			Phase:  "data",
		})

		// RX: 接收端在采样点采样
		canRx = append(canRx, types.SignalTransition{
			TimeNs: currentTime + sampleTimeNs,
			Value:  boolToInt(actualBit),
			Phase:  "data",
		})

		// bit 标注
		bitLabel := "0"
		if actualBit {
			bitLabel = "1"
		}
		annotations = append(annotations, types.BitAnnotation{
			SignalName:  "TX",
			StartTimeNs: bitStart,
			EndTimeNs:   currentTime + bitPeriodNs,
			Value:       bitLabel,
		})

		currentTime += bitPeriodNs
	}

	// ====== ACK 处理 ======
	// 检测到错误时的处理
	errorDetected := false
	if errorBitIndex >= 0 {
		errorDetected = true
	}

	// ====== 帧间间隔 (IFS - 3 个隐性位) ======
	currentTime += bitPeriodNs * 0.5
	canTx = append(canTx, types.SignalTransition{TimeNs: currentTime, Value: 1, Phase: "ifs"})
	canRx = append(canRx, types.SignalTransition{TimeNs: currentTime, Value: 1, Phase: "ifs"})

	// IFS 3 bits
	for i := 0; i < 3; i++ {
		currentTime += bitPeriodNs
	}

	// 恢复空闲
	canTx = append(canTx, types.SignalTransition{TimeNs: currentTime, Value: 1, Phase: "idle"})
	canRx = append(canRx, types.SignalTransition{TimeNs: currentTime, Value: 1, Phase: "idle"})

	// 总线事件
	frameTypeStr := "数据帧"
	if cfg.FrameType == types.CANFrameRemote {
		frameTypeStr = "远程帧"
	}
	frameFormatStr := "标准"
	if cfg.FrameFormat == types.CANExtended {
		frameFormatStr = "扩展"
	}

	ackLabel := "ACK"
	if errorDetected {
		ackLabel = fmt.Sprintf("错误检测 (%s)", *cfg.ErrorInject)
	}
	busEvents = append(busEvents, types.BusEvent{
		TimeNs: currentTime,
		State:  "stop",
		Label:  fmt.Sprintf("%s帧完成 %s [%s]", frameFormatStr, frameTypeStr, ackLabel),
	})
	busEvents = append(busEvents, types.BusEvent{TimeNs: currentTime, State: "idle", Label: "总线空闲 (IFS)"})

	return &types.ProtocolSimResult{
		Protocol: types.ProtocolCAN,
		Signals: []types.SignalChannel{
			{Name: "TX", Color: "#ff6b6b", Transitions: canTx},
			{Name: "RX", Color: "#4ecdc4", Transitions: canRx},
		},
		BusEvents:      busEvents,
		BitAnnotations: annotations,
		TotalTimeNs:    currentTime,
	}, nil
}

// simulateCANErrorFrame 生成错误帧的时序波形
func simulateCANErrorFrame(cfg *types.CANConfig, canTx, canRx *[]types.SignalTransition, busEvents *[]types.BusEvent, annotations *[]types.BitAnnotation, startTime float64) (*types.ProtocolSimResult, error) {
	bitPeriodNs := canBitPeriodNs(cfg.BaudRate)
	currentTime := startTime

	// 确定错误帧类型（主动/被动）
	isPassive := false
	if cfg.ErrorInject != nil && *cfg.ErrorInject == types.CANErrForm {
		isPassive = true
	}

	errorBits := canBuildErrorFrame(isPassive)
	errType := "主动错误帧"
	if isPassive {
		errType = "被动错误帧"
	}

	*busEvents = append(*busEvents, types.BusEvent{TimeNs: currentTime, State: "error", Label: errType})

	for _, bit := range errorBits {
		*canTx = append(*canTx, types.SignalTransition{
			TimeNs: currentTime,
			Value:  boolToInt(bit),
			Phase:  "error",
		})
		*canRx = append(*canRx, types.SignalTransition{
			TimeNs: currentTime,
			Value:  boolToInt(bit),
			Phase:  "error",
		})
		currentTime += bitPeriodNs
	}

	// 错误帧后恢复空闲
	*canTx = append(*canTx, types.SignalTransition{TimeNs: currentTime, Value: 1, Phase: "idle"})
	*canRx = append(*canRx, types.SignalTransition{TimeNs: currentTime, Value: 1, Phase: "idle"})
	*busEvents = append(*busEvents, types.BusEvent{TimeNs: currentTime, State: "idle", Label: "总线空闲"})

	*annotations = append(*annotations, types.BitAnnotation{
		SignalName:  "TX",
		StartTimeNs: startTime,
		EndTimeNs:   currentTime,
		Value:       errType,
	})

	return &types.ProtocolSimResult{
		Protocol: types.ProtocolCAN,
		Signals: []types.SignalChannel{
			{Name: "TX", Color: "#ff6b6b", Transitions: *canTx},
			{Name: "RX", Color: "#4ecdc4", Transitions: *canRx},
		},
		BusEvents:      *busEvents,
		BitAnnotations: *annotations,
		TotalTimeNs:    currentTime,
	}, nil
}

// simulateCANOverloadFrame 生成过载帧的时序波形
func simulateCANOverloadFrame(cfg *types.CANConfig, canTx, canRx *[]types.SignalTransition, busEvents *[]types.BusEvent, annotations *[]types.BitAnnotation, startTime float64) (*types.ProtocolSimResult, error) {
	bitPeriodNs := canBitPeriodNs(cfg.BaudRate)
	currentTime := startTime

	overloadBits := canBuildOverloadFrame()

	*busEvents = append(*busEvents, types.BusEvent{TimeNs: currentTime, State: "overload", Label: "过载帧"})

	for _, bit := range overloadBits {
		*canTx = append(*canTx, types.SignalTransition{
			TimeNs: currentTime,
			Value:  boolToInt(bit),
			Phase:  "overload",
		})
		*canRx = append(*canRx, types.SignalTransition{
			TimeNs: currentTime,
			Value:  boolToInt(bit),
			Phase:  "overload",
		})
		currentTime += bitPeriodNs
	}

	// 过载帧后恢复空闲
	*canTx = append(*canTx, types.SignalTransition{TimeNs: currentTime, Value: 1, Phase: "idle"})
	*canRx = append(*canRx, types.SignalTransition{TimeNs: currentTime, Value: 1, Phase: "idle"})
	*busEvents = append(*busEvents, types.BusEvent{TimeNs: currentTime, State: "idle", Label: "总线空闲"})

	*annotations = append(*annotations, types.BitAnnotation{
		SignalName:  "TX",
		StartTimeNs: startTime,
		EndTimeNs:   currentTime,
		Value:       "过载帧",
	})

	return &types.ProtocolSimResult{
		Protocol: types.ProtocolCAN,
		Signals: []types.SignalChannel{
			{Name: "TX", Color: "#ff6b6b", Transitions: *canTx},
			{Name: "RX", Color: "#4ecdc4", Transitions: *canRx},
		},
		BusEvents:      *busEvents,
		BitAnnotations: *annotations,
		TotalTimeNs:    currentTime,
	}, nil
}

// ==================== 辅助函数 ====================

// boolToInt 将布尔值转换为整数 (false=0, true=1)
func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

// roundCAN 浮点取整辅助
func roundCAN(x float64) float64 {
	return math.Round(x*1e6) / 1e6
}
