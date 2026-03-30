// Package types 协议仿真类型定义
// 覆盖 SPI、I2C、UART 数字通信协议的配置和结果类型
package types

// ==================== 协议类型枚举 ====================

// ProtocolType 数字通信协议类型
type ProtocolType string

const (
	ProtocolSPI  ProtocolType = "spi"
	ProtocolI2C  ProtocolType = "i2c"
	ProtocolUART ProtocolType = "uart"
	ProtocolCAN  ProtocolType = "can"
)

// ==================== SPI ====================

// SPIMode SPI 模式 (CPOL/CPHA 组合)
// Mode 0: CPOL=0, CPHA=0 — 空闲低电平，上升沿采样
// Mode 1: CPOL=0, CPHA=1 — 空闲低电平，下降沿采样
// Mode 2: CPOL=1, CPHA=0 — 空闲高电平，下降沿采样
// Mode 3: CPOL=1, CPHA=1 — 空闲高电平，上升沿采样
type SPIMode int

const (
	SPIMode0 SPIMode = 0
	SPIMode1 SPIMode = 1
	SPIMode2 SPIMode = 2
	SPIMode3 SPIMode = 3
)

// SPIConfig SPI 协议配置
type SPIConfig struct {
	Mode          SPIMode `json:"mode"`          // SPI 模式 0-3
	ClockFreqHz   float64 `json:"clockFreqHz"`   // 时钟频率 (Hz)
	DataBits      int     `json:"dataBits"`       // 数据位宽 (8/16/32)
	MOSIData      []uint32 `json:"mosiData"`      // Master 发送数据
	MISOData      []uint32 `json:"misoData"`      // Slave 发送数据 (可选)
	CSPolActiveLow bool   `json:"csPolActiveLow"` // CS 极性 (true=低有效)
}

// SPIPhase SPI 时序阶段
type SPIPhase string

const (
	SPIPhaseIdle      SPIPhase = "idle"
	SPIPhaseCSActive  SPIPhase = "cs_active"
	SPIPhaseClocking  SPIPhase = "clocking"
	SPIPhaseCSDeassert SPIPhase = "cs_deassert"
)

// SPISignalName SPI 信号线名称
type SPISignalName string

const (
	SPISignalSCLK SPISignalName = "SCLK"
	SPISignalMOSI SPISignalName = "MOSI"
	SPISignalMISO SPISignalName = "MISO"
	SPISignalCS   SPISignalName = "CS"
)

// ==================== I2C ====================

// I2CAddressMode I2C 地址模式
type I2CAddressMode int

const (
	I2CAddr7bit  I2CAddressMode = 7
	I2CAddr10bit I2CAddressMode = 10
)

// I2CSpeedMode I2C 速度模式
type I2CSpeedMode string

const (
	I2CStandard  I2CSpeedMode = "standard"  // 100 kHz
	I2CFast      I2CSpeedMode = "fast"      // 400 kHz
	I2CFastPlus  I2CSpeedMode = "fast_plus" // 1 MHz
)

// I2CTransferType I2C 传输类型
type I2CTransferType string

const (
	I2CWrite I2CTransferType = "write"
	I2CRead  I2CTransferType = "read"
)

// I2CConfig I2C 协议配置
type I2CConfig struct {
	AddressMode   I2CAddressMode  `json:"addressMode"`   // 7 或 10 位地址
	SpeedMode     I2CSpeedMode    `json:"speedMode"`     // 速度模式
	SlaveAddress  uint16          `json:"slaveAddress"`   // 从机地址
	TransferType  I2CTransferType `json:"transferType"`  // 读/写
	Data          []uint8         `json:"data"`          // 传输数据
	HasACK        bool            `json:"hasACK"`        // 是否期望 ACK
}

// I2CPhase I2C 时序阶段
type I2CPhase string

const (
	I2CPhaseIdle      I2CPhase = "idle"
	I2CPhaseStart     I2CPhase = "start"
	I2CPhaseAddress   I2CPhase = "address"
	I2CPhaseACK       I2CPhase = "ack"
	I2CPhaseData      I2CPhase = "data"
	I2CPhaseNACK      I2CPhase = "nack"
	I2CPhaseStop      I2CPhase = "stop"
)

// I2CSignalName I2C 信号线名称
type I2CSignalName string

const (
	I2CSignalSCL I2CSignalName = "SCL"
	I2CSignalSDA I2CSignalName = "SDA"
)

// ==================== UART ====================

// UARTParity UART 校验位
type UARTParity string

const (
	ParityNone UARTParity = "none"
	ParityEven UARTParity = "even"
	ParityOdd  UARTParity = "odd"
)

// UARTConfig UART 协议配置
type UARTConfig struct {
	BaudRate   int        `json:"baudRate"`   // 波特率 (如 9600, 115200)
	DataBits   int        `json:"dataBits"`   // 数据位 (5/6/7/8)
	StopBits   float64    `json:"stopBits"`   // 停止位 (1/1.5/2)
	Parity     UARTParity `json:"parity"`     // 校验位
	TXData     []uint8    `json:"txData"`     // TX 发送数据
	BitOrderLSB bool      `json:"bitOrderLSB"` // LSB 优先
}

// UARTPhase UART 时序阶段
type UARTPhase string

const (
	UARTPhaseIdle    UARTPhase = "idle"
	UARTPhaseStart  UARTPhase = "start"
	UARTPhaseData   UARTPhase = "data"
	UARTPhaseParity UARTPhase = "parity"
	UARTPhaseStop   UARTPhase = "stop"
)

// UARTSignalName UART 信号线名称
type UARTSignalName string

const (
	UARTSignalTX UARTSignalName = "TX"
	UARTSignalRX UARTSignalName = "RX"
)

// ==================== CAN ====================

// CANBaudRate CAN 波特率 (bps)
type CANBaudRate int

const (
	CANBaud125K  CANBaudRate = 125000
	CANBaud250K  CANBaudRate = 250000
	CANBaud500K  CANBaudRate = 500000
	CANBaud1M    CANBaudRate = 1000000
)

// CANFrameType CAN 帧类型
type CANFrameType string

const (
	CANFrameData      CANFrameType = "data"      // 数据帧
	CANFrameRemote    CANFrameType = "remote"    // 远程帧 (RTR)
	CANFrameError     CANFrameType = "error"     // 错误帧
	CANFrameOverload  CANFrameType = "overload"  // 过载帧
)

// CANFrameFormat CAN 帧格式
type CANFrameFormat string

const (
	CANStandard CANFrameFormat = "standard" // 标准帧 11-bit ID
	CANExtended CANFrameFormat = "extended" // 扩展帧 29-bit ID
)

// CANErrorState CAN 节点错误状态
type CANErrorState string

const (
	CANErrorActive  CANErrorState = "active"   // 主动错误 (TEC/REC < 128)
	CANErrorPassive CANErrorState = "passive"  // 被动错误 (128 <= TEC/REC < 256)
	CANBusOff       CANErrorState = "bus_off"  // 总线关闭 (TEC >= 256)
)

// CANErrorType CAN 错误类型
type CANErrorType string

const (
	CANErrCRC       CANErrorType = "crc"        // CRC 错误
	CANErrForm      CANErrorType = "form"       // 格式错误
	CANErrAck       CANErrorType = "ack"        // 应答错误
	CANErrBit       CANErrorType = "bit"        // 位错误
	CANErrStuff     CANErrorType = "stuff"      // 位填充错误
)

// CANConfig CAN 协议配置
type CANConfig struct {
	BaudRate     CANBaudRate    `json:"baudRate"`           // 波特率 (125K/250K/500K/1M)
	FrameFormat  CANFrameFormat `json:"frameFormat"`        // 标准/扩展帧
	FrameType    CANFrameType   `json:"frameType"`          // 数据帧/远程帧
	ID           uint32         `json:"id"`                 // CAN ID (11-bit 或 29-bit)
	DLC          int            `json:"dlc"`                // 数据长度码 (0-8)
	Data         []uint8        `json:"data"`               // 数据域 (最多 8 字节)
	SamplePoint  float64        `json:"samplePoint"`        // 采样点位置 (0.0-1.0, 默认 0.875)
	SJW          int            `json:"sjw"`                // 同步跳转宽度 (1-4, 默认 1)
	NodeCount    int            `json:"nodeCount"`          // 参与仲裁的节点数 (默认 2)
	ErrorInject  *CANErrorType  `json:"errorInject,omitempty"` // 注入的错误类型 (测试用)
}

// CANSignalName CAN 信号线名称
type CANSignalName string

const (
	CANSignalCANH CANSignalName = "CAN_H" // CAN 高电平
	CANSignalCANL CANSignalName = "CAN_L" // CAN 低电平
	CANSignalTX   CANSignalName = "TX"    // 逻辑电平 (差分前)
	CANSignalRX   CANSignalName = "RX"    // 逻辑电平 (差分后)
)

// ==================== 通用协议仿真 ====================

// ProtocolSimRequest 协议仿真请求
type ProtocolSimRequest struct {
	Protocol ProtocolType `json:"protocol"` // 协议类型
	SPI      *SPIConfig   `json:"spi,omitempty"`
	I2C      *I2CConfig   `json:"i2c,omitempty"`
	UART     *UARTConfig  `json:"uart,omitempty"`
	CAN      *CANConfig   `json:"can,omitempty"`
}

// SignalTransition 信号跳变事件
type SignalTransition struct {
	TimeNs   float64 `json:"timeNs"`   // 时间 (ns)
	Value    int     `json:"value"`     // 信号值 (0/1/高阻)
	Label    string  `json:"label,omitempty"` // 标注 (如 bit 值、ACK 等)
	Phase    string  `json:"phase,omitempty"` // 当前阶段
}

// SignalChannel 一个信号通道的完整时序
type SignalChannel struct {
	Name        string             `json:"name"`        // 信号名称 (SCLK/MOSI/...)
	Color       string             `json:"color"`       // 显示颜色
	Transitions []SignalTransition `json:"transitions"` // 信号跳变列表
}

// BusEvent 总线状态事件
type BusEvent struct {
	TimeNs float64 `json:"timeNs"`
	State  string  `json:"state"` // idle/transfer/ack/nack/start/stop
	Label  string  `json:"label,omitempty"`
}

// ProtocolSimResult 协议仿真结果
type ProtocolSimResult struct {
	Protocol    ProtocolType   `json:"protocol"`
	Signals     []SignalChannel `json:"signals"`     // 信号通道列表
	BusEvents   []BusEvent     `json:"busEvents"`   // 总线状态事件
	BitAnnotations []BitAnnotation `json:"bitAnnotations,omitempty"` // bit 级标注
	TotalTimeNs float64        `json:"totalTimeNs"` // 总仿真时长 (ns)
	Error       string         `json:"error,omitempty"`
}

// BitAnnotation bit 级标注 (用于波形面板显示)
type BitAnnotation struct {
	SignalName string  `json:"signalName"`
	StartTimeNs float64 `json:"startTimeNs"`
	EndTimeNs   float64 `json:"endTimeNs"`
	Value       string  `json:"value"` // "0", "1", "ACK", "NACK", "Start", "Stop"
}
