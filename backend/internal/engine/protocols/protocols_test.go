package protocols

import (
	"testing"

	"chip-sim/pkg/types"
)

// ==================== SPI Tests ====================

func TestSimulateSPI_Mode0(t *testing.T) {
	cfg := &types.SPIConfig{
		Mode:           types.SPIMode0,
		ClockFreqHz:    1e6, // 1 MHz
		DataBits:       8,
		MOSIData:       []uint32{0xA5, 0x3C},
		MISOData:       []uint32{0x55, 0xAA},
		CSPolActiveLow: true,
	}

	result, err := SimulateSPI(cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Protocol != types.ProtocolSPI {
		t.Errorf("expected protocol SPI, got %s", result.Protocol)
	}
	if len(result.Signals) != 4 {
		t.Fatalf("expected 4 signals (SCLK/MOSI/MISO/CS), got %d", len(result.Signals))
	}
	if result.TotalTimeNs <= 0 {
		t.Errorf("expected positive total time, got %f", result.TotalTimeNs)
	}

	// SCLK 信号应有跳变
	sclk := result.Signals[0]
	if sclk.Name != "SCLK" {
		t.Errorf("expected first signal SCLK, got %s", sclk.Name)
	}
	if len(sclk.Transitions) < 4 {
		t.Errorf("expected at least 4 SCLK transitions, got %d", len(sclk.Transitions))
	}

	// CS 信号：起始 idle=1, 然后 active=0, 最后 deassert=1
	cs := result.Signals[3]
	if cs.Name != "CS" {
		t.Errorf("expected CS signal, got %s", cs.Name)
	}
	if cs.Transitions[0].Value != 1 {
		t.Errorf("CS should start idle (1)")
	}

	// bit 标注应存在
	if len(result.BitAnnotations) == 0 {
		t.Error("expected bit annotations")
	}

	// bus events
	if len(result.BusEvents) == 0 {
		t.Error("expected bus events")
	}
}

func TestSimulateSPI_AllModes(t *testing.T) {
	for mode := types.SPIMode0; mode <= types.SPIMode3; mode++ {
		cfg := &types.SPIConfig{
			Mode:        mode,
			ClockFreqHz: 500000,
			DataBits:    8,
			MOSIData:    []uint32{0xFF},
		}
		result, err := SimulateSPI(cfg)
		if err != nil {
			t.Errorf("mode %d failed: %v", mode, err)
			continue
		}
		if result.TotalTimeNs <= 0 {
			t.Errorf("mode %d: expected positive total time", mode)
		}
	}
}

func TestSimulateSPI_16Bit(t *testing.T) {
	cfg := &types.SPIConfig{
		Mode:        types.SPIMode0,
		ClockFreqHz: 1e6,
		DataBits:    16,
		MOSIData:    []uint32{0xDEAD},
	}
	result, err := SimulateSPI(cfg)
	if err != nil {
		t.Fatalf("16-bit SPI failed: %v", err)
	}
	// 16 bits × 2 half-cycles = 32 clock edges minimum
	sclk := result.Signals[0]
	if len(sclk.Transitions) < 32 {
		t.Errorf("expected at least 32 SCLK transitions for 16-bit, got %d", len(sclk.Transitions))
	}
}

func TestSimulateSPI_Invalid(t *testing.T) {
	_, err := SimulateSPI(nil)
	if err == nil {
		t.Error("expected error for nil config")
	}

	_, err = SimulateSPI(&types.SPIConfig{Mode: 4, ClockFreqHz: 1e6, DataBits: 8})
	if err == nil {
		t.Error("expected error for invalid mode")
	}
}

// ==================== I2C Tests ====================

func TestSimulateI2C_StandardWrite(t *testing.T) {
	cfg := &types.I2CConfig{
		AddressMode:  types.I2CAddr7bit,
		SpeedMode:    types.I2CStandard,
		SlaveAddress: 0x50,
		TransferType: types.I2CWrite,
		Data:         []uint8{0x01, 0x02, 0x03},
		HasACK:       true,
	}

	result, err := SimulateI2C(cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Protocol != types.ProtocolI2C {
		t.Errorf("expected protocol I2C, got %s", result.Protocol)
	}
	if len(result.Signals) != 2 {
		t.Fatalf("expected 2 signals (SCL/SDA), got %d", len(result.Signals))
	}
	if result.TotalTimeNs <= 0 {
		t.Error("expected positive total time")
	}

	// 应有 START 和 STOP 事件
	hasStart := false
	hasStop := false
	for _, ev := range result.BusEvents {
		if ev.State == "start" {
			hasStart = true
		}
		if ev.State == "stop" {
			hasStop = true
		}
	}
	if !hasStart {
		t.Error("missing START bus event")
	}
	if !hasStop {
		t.Error("missing STOP bus event")
	}
}

func TestSimulateI2C_FastRead(t *testing.T) {
	cfg := &types.I2CConfig{
		AddressMode:  types.I2CAddr7bit,
		SpeedMode:    types.I2CFast,
		SlaveAddress: 0x48,
		TransferType: types.I2CRead,
		Data:         []uint8{0xAB, 0xCD},
		HasACK:       true,
	}

	result, err := SimulateI2C(cfg)
	if err != nil {
		t.Fatalf("fast read failed: %v", err)
	}
	if result.TotalTimeNs <= 0 {
		t.Error("expected positive total time")
	}
}

func TestSimulateI2C_10Bit(t *testing.T) {
	cfg := &types.I2CConfig{
		AddressMode:  types.I2CAddr10bit,
		SpeedMode:    types.I2CStandard,
		SlaveAddress: 0x2AB,
		TransferType: types.I2CWrite,
		Data:         []uint8{0x42},
		HasACK:       true,
	}

	result, err := SimulateI2C(cfg)
	if err != nil {
		t.Fatalf("10-bit addr failed: %v", err)
	}
	if result.TotalTimeNs <= 0 {
		t.Error("expected positive total time")
	}
}

func TestSimulateI2C_NACK(t *testing.T) {
	cfg := &types.I2CConfig{
		AddressMode:  types.I2CAddr7bit,
		SpeedMode:    types.I2CStandard,
		SlaveAddress: 0x50,
		TransferType: types.I2CWrite,
		Data:         []uint8{0x01},
		HasACK:       false,
	}

	result, err := SimulateI2C(cfg)
	if err != nil {
		t.Fatalf("NACK test failed: %v", err)
	}
	// 应有 NACK 事件
	hasNack := false
	for _, ev := range result.BusEvents {
		if ev.State == "nack" {
			hasNack = true
		}
	}
	if !hasNack {
		t.Error("expected NACK bus event")
	}
}

// ==================== UART Tests ====================

func TestSimulateUART_Standard(t *testing.T) {
	cfg := &types.UARTConfig{
		BaudRate:    115200,
		DataBits:    8,
		StopBits:    1,
		Parity:      types.ParityNone,
		TXData:      []uint8{0x48, 0x65, 0x6C, 0x6C, 0x6F}, // "Hello"
		BitOrderLSB: true,
	}

	result, err := SimulateUART(cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Protocol != types.ProtocolUART {
		t.Errorf("expected protocol UART, got %s", result.Protocol)
	}
	if len(result.Signals) != 2 {
		t.Fatalf("expected 2 signals (TX/RX), got %d", len(result.Signals))
	}
	if result.TotalTimeNs <= 0 {
		t.Error("expected positive total time")
	}

	// TX 应有大量跳变
	tx := result.Signals[0]
	if tx.Name != "TX" {
		t.Errorf("expected TX signal, got %s", tx.Name)
	}
	if len(tx.Transitions) < 10 {
		t.Errorf("expected many transitions for 5 bytes, got %d", len(tx.Transitions))
	}
}

func TestSimulateUART_WithParity(t *testing.T) {
	for _, parity := range []types.UARTParity{types.ParityEven, types.ParityOdd} {
		cfg := &types.UARTConfig{
			BaudRate:    9600,
			DataBits:    8,
			StopBits:    1,
			Parity:      parity,
			TXData:      []uint8{0xFF},
			BitOrderLSB: true,
		}
		result, err := SimulateUART(cfg)
		if err != nil {
			t.Errorf("parity %s failed: %v", parity, err)
			continue
		}
		if result.TotalTimeNs <= 0 {
			t.Errorf("parity %s: expected positive time", parity)
		}
	}
}

func TestSimulateUART_DifferentBaudRates(t *testing.T) {
	for _, baud := range []int{9600, 38400, 115200, 460800} {
		cfg := &types.UARTConfig{
			BaudRate: baud,
			DataBits: 8,
			StopBits: 1,
			Parity:   types.ParityNone,
			TXData:   []uint8{0xAA},
		}
		result, err := SimulateUART(cfg)
		if err != nil {
			t.Errorf("baud %d failed: %v", baud, err)
			continue
		}
		// 验证总时间与波特率一致
		expectedBitNs := 1e9 / float64(baud)
		// 1 byte = start + 8 data + stop = 10 bits
		minTime := expectedBitNs * 10
		if result.TotalTimeNs < minTime {
			t.Errorf("baud %d: total time %f < min %f", baud, result.TotalTimeNs, minTime)
		}
	}
}

func TestSimulateUART_Invalid(t *testing.T) {
	_, err := SimulateUART(nil)
	if err == nil {
		t.Error("expected error for nil config")
	}

	_, err = SimulateUART(&types.UARTConfig{BaudRate: 0, DataBits: 8})
	if err == nil {
		t.Error("expected error for zero baud rate")
	}
}

// ==================== Dispatcher Tests ====================

func TestSimulate_Dispatch(t *testing.T) {
	req := &types.ProtocolSimRequest{
		Protocol: types.ProtocolSPI,
		SPI: &types.SPIConfig{
			Mode:        types.SPIMode0,
			ClockFreqHz: 1e6,
			DataBits:    8,
			MOSIData:    []uint32{0x01},
		},
	}
	result, err := Simulate(req)
	if err != nil {
		t.Fatalf("SPI dispatch failed: %v", err)
	}
	if result.Protocol != types.ProtocolSPI {
		t.Errorf("expected SPI, got %s", result.Protocol)
	}
}

func TestSimulate_Unsupported(t *testing.T) {
	req := &types.ProtocolSimRequest{Protocol: "unknown"}
	_, err := Simulate(req)
	if err == nil {
		t.Error("expected error for unsupported protocol")
	}
}

// ==================== CAN Tests ====================

// TestSimulateCAN_StandardData 标准数据帧测试
func TestSimulateCAN_StandardData(t *testing.T) {
	cfg := &types.CANConfig{
		BaudRate:    types.CANBaud500K,
		FrameFormat: types.CANStandard,
		FrameType:   types.CANFrameData,
		ID:          0x123,
		DLC:         8,
		Data:        []uint8{0xDE, 0xAD, 0xBE, 0xEF, 0x01, 0x02, 0x03, 0x04},
		SamplePoint: 0.875,
		NodeCount:   2,
	}

	result, err := SimulateCAN(cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Protocol != types.ProtocolCAN {
		t.Errorf("expected protocol CAN, got %s", result.Protocol)
	}
	if len(result.Signals) != 2 {
		t.Fatalf("expected 2 signals (TX/RX), got %d", len(result.Signals))
	}
	if result.TotalTimeNs <= 0 {
		t.Errorf("expected positive total time, got %f", result.TotalTimeNs)
	}

	// TX 和 RX 应有跳变
	tx := result.Signals[0]
	if tx.Name != "TX" {
		t.Errorf("expected TX signal, got %s", tx.Name)
	}
	if len(tx.Transitions) < 2 {
		t.Errorf("expected multiple transitions, got %d", len(tx.Transitions))
	}

	// 应有总线事件
	if len(result.BusEvents) == 0 {
		t.Error("expected bus events")
	}

	// 应有 bit 标注
	if len(result.BitAnnotations) == 0 {
		t.Error("expected bit annotations")
	}
}

// TestSimulateCAN_ExtendedFrame 扩展帧测试 (29-bit ID)
func TestSimulateCAN_ExtendedFrame(t *testing.T) {
	cfg := &types.CANConfig{
		BaudRate:    types.CANBaud1M,
		FrameFormat: types.CANExtended,
		FrameType:   types.CANFrameData,
		ID:          0x18FEDF01, // 29-bit ID
		DLC:         4,
		Data:        []uint8{0xAA, 0xBB, 0xCC, 0xDD},
		SamplePoint: 0.875,
		NodeCount:   2,
	}

	result, err := SimulateCAN(cfg)
	if err != nil {
		t.Fatalf("extended frame error: %v", err)
	}
	if result.TotalTimeNs <= 0 {
		t.Error("expected positive total time")
	}

	// 扩展帧比标准帧更长（更多位）
	if len(result.BitAnnotations) == 0 {
		t.Error("expected bit annotations for extended frame")
	}
}

// TestSimulateCAN_RemoteFrame 远程帧测试
func TestSimulateCAN_RemoteFrame(t *testing.T) {
	cfg := &types.CANConfig{
		BaudRate:    types.CANBaud250K,
		FrameFormat: types.CANStandard,
		FrameType:   types.CANFrameRemote,
		ID:          0x200,
		DLC:         0,
		Data:        nil,
		NodeCount:   2,
	}

	result, err := SimulateCAN(cfg)
	if err != nil {
		t.Fatalf("remote frame error: %v", err)
	}
	if result.TotalTimeNs <= 0 {
		t.Error("expected positive total time for remote frame")
	}
}

// TestSimulateCAN_ErrorFrame 主动错误帧测试
func TestSimulateCAN_ErrorFrame(t *testing.T) {
	cfg := &types.CANConfig{
		BaudRate:    types.CANBaud500K,
		FrameFormat: types.CANStandard,
		FrameType:   types.CANFrameError,
		ID:          0x100,
		DLC:         0,
	}

	result, err := SimulateCAN(cfg)
	if err != nil {
		t.Fatalf("error frame error: %v", err)
	}
	if result.TotalTimeNs <= 0 {
		t.Error("expected positive total time for error frame")
	}

	// 错误帧: 6 显性 + 8 隐性 = 14 bits
	tx := result.Signals[0]
	expectedTransitions := 1 + 14 + 1 // idle + error bits + idle
	if len(tx.Transitions) < expectedTransitions {
		t.Errorf("expected at least %d transitions for error frame, got %d", expectedTransitions, len(tx.Transitions))
	}
}

// TestSimulateCAN_OverloadFrame 过载帧测试
func TestSimulateCAN_OverloadFrame(t *testing.T) {
	cfg := &types.CANConfig{
		BaudRate:    types.CANBaud125K,
		FrameFormat: types.CANStandard,
		FrameType:   types.CANFrameOverload,
		ID:          0x0,
		DLC:         0,
	}

	result, err := SimulateCAN(cfg)
	if err != nil {
		t.Fatalf("overload frame error: %v", err)
	}
	if result.TotalTimeNs <= 0 {
		t.Error("expected positive total time for overload frame")
	}
}

// TestSimulateCAN_AllBaudRates 测试所有标准波特率
func TestSimulateCAN_AllBaudRates(t *testing.T) {
	baudRates := []types.CANBaudRate{
		types.CANBaud125K,
		types.CANBaud250K,
		types.CANBaud500K,
		types.CANBaud1M,
	}

	for _, baud := range baudRates {
		cfg := &types.CANConfig{
			BaudRate:    baud,
			FrameFormat: types.CANStandard,
			FrameType:   types.CANFrameData,
			ID:          0x100,
			DLC:         1,
			Data:        []uint8{0x55},
		}
		result, err := SimulateCAN(cfg)
		if err != nil {
			t.Errorf("baud %d failed: %v", baud, err)
			continue
		}
		if result.TotalTimeNs <= 0 {
			t.Errorf("baud %d: expected positive total time", baud)
		}

		// 验证 1Mbps 比 125K 更快
		expectedBitNs := 1e9 / float64(baud)
		if expectedBitNs <= 0 {
			t.Errorf("baud %d: invalid bit period", baud)
		}
	}
}

// TestSimulateCAN_BitStuffing 测试位填充机制
func TestSimulateCAN_BitStuffing(t *testing.T) {
	// 构造一个包含连续 5 个 0 的比特流
	bits := []bool{false, false, false, false, false, true, false}
	stuffed := canBitStuff(bits)

	// 填充后应该比原始长
	if len(stuffed) <= len(bits) {
		t.Errorf("bit stuffing should increase length: original=%d, stuffed=%d", len(bits), len(stuffed))
	}

	// 连续 5 个 0 后应该有填充位 (1)
	// bits[0..4] = 0,0,0,0,0 → stuffed[0..4] = 0,0,0,0,0, stuffed[5] = 1(填充), stuffed[6] = 1, stuffed[7] = 0
	if len(stuffed) < 8 {
		t.Errorf("expected at least 8 bits after stuffing, got %d", len(stuffed))
	}
	if stuffed[5] != true {
		t.Errorf("stuffing bit after 5 zeros should be 1 (true), got %v", stuffed[5])
	}
}

// TestSimulateCAN_CRC15 测试 CRC-15 计算
func TestSimulateCAN_CRC15(t *testing.T) {
	// 空数据 CRC 应为 0
	crc := canCRC15([]bool{})
	if crc != 0 {
		t.Errorf("empty CRC should be 0, got 0x%X", crc)
	}

	// 已知数据测试
	// SOF=0 + ID=0x123(00100100011) + RTR=0 + IDE=0 + r0=0 + DLC=0001 + Data=0x55
	bits := []bool{
		false,                         // SOF
		false, false, false, true,     // ID[10:7] = 0010
		false, true, false, false,     // ID[6:3]  = 0100
		true, false, false,            // ID[2:0]  = 100
		false,                         // RTR
		false,                         // IDE
		false,                         // r0
		false, false, false, true,     // DLC = 1
		// Data byte: 0x55 = 01010101
		false, true, false, true, false, true, false, true,
	}
	crc = canCRC15(bits)
	if crc == 0 {
		t.Error("CRC should not be 0 for non-empty data")
	}
	// CRC 值应在 15 bit 范围内
	if crc > 0x7FFF {
		t.Errorf("CRC exceeds 15 bits: 0x%X", crc)
	}
}

// TestSimulateCAN_ErrorCounters 测试错误计数器状态机
func TestSimulateCAN_ErrorCounters(t *testing.T) {
	ec := NewCANErrorCounter()

	// 初始状态应为主动错误
	if ec.State != types.CANErrorActive {
		t.Errorf("initial state should be active, got %s", ec.State)
	}

	// 发送 16 次错误 → TEC = 128 → 被动错误
	for i := 0; i < 16; i++ {
		ec.OnTransmitError()
	}
	if ec.State != types.CANErrorPassive {
		t.Errorf("after 16 tx errors (TEC=%d), state should be passive, got %s", ec.TEC, ec.State)
	}

	// 继续发送错误 → TEC >= 256 → 总线关闭
	for i := 0; i < 16; i++ {
		ec.OnTransmitError()
	}
	if ec.State != types.CANBusOff {
		t.Errorf("after 32 tx errors (TEC=%d), state should be bus_off, got %s", ec.TEC, ec.State)
	}
}

// TestSimulateCAN_ReceiveErrors 测试接收错误计数器
func TestSimulateCAN_ReceiveErrors(t *testing.T) {
	ec := NewCANErrorCounter()

	// 接收 128 次错误 → REC = 128 → 被动错误
	for i := 0; i < 128; i++ {
		ec.OnReceiveError()
	}
	if ec.State != types.CANErrorPassive {
		t.Errorf("after 128 rx errors (REC=%d), state should be passive, got %s", ec.REC, ec.State)
	}

	// CAN 规范: REC > 127 时成功接收不再减少计数
	ec.OnSuccessfulReceive()
	if ec.REC != 128 {
		t.Errorf("REC=128 should not decrement on successful receive, got %d", ec.REC)
	}

	// REC 在 1-127 范围内成功接收可以减少
	ec2 := NewCANErrorCounter()
	for i := 0; i < 10; i++ {
		ec2.OnReceiveError()
	}
	ec2.OnSuccessfulReceive()
	if ec2.REC != 9 {
		t.Errorf("REC in [1,127] should decrement on success, expected 9, got %d", ec2.REC)
	}
}

// TestSimulateCAN_ErrorRecovery 测试错误恢复
func TestSimulateCAN_ErrorRecovery(t *testing.T) {
	ec := NewCANErrorCounter()

	// 人为制造被动错误状态
	ec.TEC = 127
	ec.OnTransmitError() // TEC = 135, passive
	if ec.State != types.CANErrorPassive {
		t.Errorf("should be passive (TEC=%d), got %s", ec.TEC, ec.State)
	}

	// 多次成功发送减少 TEC
	for i := 0; i < 20; i++ {
		ec.OnSuccessfulSend()
	}
	if ec.State != types.CANErrorActive {
		t.Errorf("after recovery, should be active (TEC=%d), got %s", ec.TEC, ec.State)
	}
}

// TestSimulateCAN_Invalid 测试无效配置
func TestSimulateCAN_Invalid(t *testing.T) {
	_, err := SimulateCAN(nil)
	if err == nil {
		t.Error("expected error for nil config")
	}

	_, err = SimulateCAN(&types.CANConfig{
		BaudRate:    types.CANBaud500K,
		FrameFormat: types.CANStandard,
		ID:          0x800, // 超过 11-bit
		DLC:         0,
	})
	if err == nil {
		t.Error("expected error for oversized standard ID")
	}

	_, err = SimulateCAN(&types.CANConfig{
		BaudRate:    types.CANBaud500K,
		FrameFormat: types.CANStandard,
		ID:          0x100,
		DLC:         10, // DLC > 8
	})
	if err == nil {
		t.Error("expected error for DLC > 8")
	}
}

// TestSimulateCAN_MultiNodeArbitration 多节点仲裁测试
func TestSimulateCAN_MultiNodeArbitration(t *testing.T) {
	// ID 0x001 = 00000000001 (最高优先级)
	// 另一个节点 ID 0x7FF = 11111111111 (最低优先级)
	// 0x001 在仲裁域发送更多 0 (显性), 应该赢得仲裁
	cfg := &types.CANConfig{
		BaudRate:    types.CANBaud500K,
		FrameFormat: types.CANStandard,
		FrameType:   types.CANFrameData,
		ID:          0x001, // 最高优先级 (ID 越小优先级越高)
		DLC:         2,
		Data:        []uint8{0xAA, 0xBB},
		NodeCount:   2, // 本节点 + 一个竞争节点 (ID = 0x001 + 0x100 = 0x101)
	}

	result, err := SimulateCAN(cfg)
	if err != nil {
		t.Fatalf("multi-node arbitration error: %v", err)
	}
	if result.TotalTimeNs <= 0 {
		t.Error("expected positive total time")
	}

	// 0x001 vs 0x101: 比较 ID bit 位
	// 0x001 = 00000000001, 0x101 = 00100000001
	// bit 10: 0 vs 0 → 平
	// bit 9: 0 vs 0 → 平
	// bit 8: 0 vs 1 → 0x001 发送显性(0), 0x101 发送隐性(1) → 0x001 赢
	// 所以 0x001 应赢得仲裁
	hasArbLost := false
	for _, ev := range result.BusEvents {
		if ev.State == "arbitration_lost" {
			hasArbLost = true
		}
	}
	if hasArbLost {
		t.Error("lowest ID should win arbitration, but got arbitration_lost")
	}
}

// TestSimulateCAN_Dispatch 测试 CAN 协议调度
func TestSimulateCAN_Dispatch(t *testing.T) {
	req := &types.ProtocolSimRequest{
		Protocol: types.ProtocolCAN,
		CAN: &types.CANConfig{
			BaudRate:    types.CANBaud500K,
			FrameFormat: types.CANStandard,
			FrameType:   types.CANFrameData,
			ID:          0x100,
			DLC:         4,
			Data:        []uint8{0x01, 0x02, 0x03, 0x04},
		},
	}
	result, err := Simulate(req)
	if err != nil {
		t.Fatalf("CAN dispatch failed: %v", err)
	}
	if result.Protocol != types.ProtocolCAN {
		t.Errorf("expected CAN, got %s", result.Protocol)
	}
}
