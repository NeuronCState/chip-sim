// Package types 定义电路仿真平台的核心数据类型
// 覆盖电路元件、节点、连线、仿真参数等所有业务实体
package types

// ==================== 元件类型 ====================

// ComponentType 元件类型枚举
type ComponentType string

const (
	ComponentResistor      ComponentType = "resistor"
	ComponentCapacitor     ComponentType = "capacitor"
	ComponentInductor      ComponentType = "inductor"
	ComponentDCSource      ComponentType = "dc_source"
	ComponentACSource      ComponentType = "ac_source"
	ComponentGround        ComponentType = "ground"
	ComponentVoltageSource ComponentType = "voltage_source"
	ComponentCurrentSource ComponentType = "current_source"
	ComponentDiode         ComponentType = "diode"
	ComponentBJTNPN        ComponentType = "bjt_npn"
	ComponentBJTPNP        ComponentType = "bjt_pnp"
	ComponentMOSFETNMOS    ComponentType = "mosfet_nmos"
	ComponentMOSFETPMOS    ComponentType = "mosfet_pmos"
	ComponentOpAmp         ComponentType = "op_amp"
	ComponentLogicAND      ComponentType = "logic_and"
	ComponentLogicOR       ComponentType = "logic_or"
	ComponentLogicNOT      ComponentType = "logic_not"
	ComponentLogicNAND     ComponentType = "logic_nand"
	ComponentLogicNOR      ComponentType = "logic_nor"
	ComponentLogicXOR      ComponentType = "logic_xor"
	ComponentMCU           ComponentType = "mcu"
	ComponentADC           ComponentType = "adc"
	ComponentDAC           ComponentType = "dac"

	// ==================== 高级半导体器件 ====================

	ComponentJFETNJFET     ComponentType = "jfet_n"
	ComponentJFETPJFET     ComponentType = "jfet_p"
	ComponentLDO           ComponentType = "ldo"
	ComponentIGBT          ComponentType = "igbt"
	ComponentDarlingtonNPN ComponentType = "darlington_npn"
	ComponentDarlingtonPNP ComponentType = "darlington_pnp"
	ComponentRelay         ComponentType = "relay"

	// ==================== 经典 IC 元件 ====================

	ComponentTimer555             ComponentType = "timer_555"
	ComponentVoltageRegulator7805 ComponentType = "voltage_regulator_7805"
	ComponentVoltageRegulator7812 ComponentType = "voltage_regulator_7812"
	ComponentOptocoupler          ComponentType = "optocoupler"

	// ==================== 74 系列 TTL IC ====================

	// 基础逻辑门 IC
	Component7400  ComponentType = "7400"  // 四2输入与非门
	Component7402  ComponentType = "7402"  // 四2输入或非门
	Component7404  ComponentType = "7404"  // 六反相器
	Component7408  ComponentType = "7408"  // 四2输入与门
	Component7432  ComponentType = "7432"  // 四2输入或门
	Component7486  ComponentType = "7486"  // 四2输入异或门

	// 触发器和锁存器
	Component7474  ComponentType = "7474"  // 双D触发器（带预置/清除）
	Component7473  ComponentType = "7473"  // 双JK触发器
	Component74373 ComponentType = "74373" // 八D锁存器

	// 计数器和移位寄存器
	Component7490  ComponentType = "7490"  // 十进制计数器
	Component74194 ComponentType = "74194" // 4位双向移位寄存器
	Component74164 ComponentType = "74164" // 8位移位寄存器
)

// ==================== 四值逻辑 ====================

// LogicValue 四值逻辑值：0, 1, X(未知), Z(高阻)
type LogicValue int

const (
	LogicLow      LogicValue = iota // 0
	LogicHigh                       // 1
	LogicUnknown                    // X
	LogicHiZ                        // Z
)

func (v LogicValue) String() string {
	switch v {
	case LogicLow:
		return "0"
	case LogicHigh:
		return "1"
	case LogicUnknown:
		return "X"
	case LogicHiZ:
		return "Z"
	}
	return "?"
}

// IsHigh returns true if the value is logic high.
func (v LogicValue) IsHigh() bool { return v == LogicHigh }

// IsLow returns true if the value is logic low.
func (v LogicValue) IsLow() bool { return v == LogicLow }

// IsDefined returns true if the value is 0 or 1.
func (v LogicValue) IsDefined() bool { return v == LogicLow || v == LogicHigh }

// ==================== 74 系列 IC 定义 ====================

// PinDirection 引脚方向
type PinDirection int

const (
	PinInput  PinDirection = iota
	PinOutput
	PinPower // VCC
	PinGnd   // GND
	PinBidir // 双向
)

// ChipPin 芯片引脚定义
type ChipPin struct {
	Number    int          `json:"number"`    // 引脚编号（1-14/16）
	Name      string       `json:"name"`      // 引脚名称，如 "1A", "1Y", "VCC"
	Direction PinDirection `json:"direction"` // 引脚方向
	Index     int          `json:"index"`     // 在内部端口数组中的索引
}

// ChipDefinition 74 系列 IC 完整定义
type ChipDefinition struct {
	PartNumber         string       `json:"partNumber"`         // 型号，如 "7400"
	Name               string       `json:"name"`               // 中文名称
	Description        string       `json:"description"`        // 描述
	Package            string       `json:"package"`            // 封装，默认 "DIP-14"
	Pins               []ChipPin    `json:"pins"`               // 引脚列表
	TruthTables        []TruthTable `json:"truthTables"`        // 真值表
	PropagationDelayNs float64      `json:"propagationDelayNs"` // 传播延迟 ns
	FanOut             int          `json:"fanOut"`             // 扇出能力
}

// TruthTable 真值表
type TruthTable struct {
	Inputs  []string   `json:"inputs"`  // 输入引脚名称
	Outputs []string   `json:"outputs"` // 输出引脚名称
	Rows    [][]string `json:"rows"`    // 每行: [input1, input2, ..., output1, ...]
}

// ==================== 元件定义 ====================

// ComponentValue 元件参数值（带单位）
type ComponentValue struct {
	Value  float64 `json:"value"`           // 数值
	Unit   string  `json:"unit"`            // 单位，如 "Ω", "F", "H"
	Prefix string  `json:"prefix,omitempty"` // 前缀，如 "k", "m", "μ"
}

// ComponentPort 元件端口（连接点）
type ComponentPort struct {
	ID     string `json:"id"`     // 端口唯一 ID
	Offset Point  `json:"offset"` // 相对于元件中心的偏移
	NodeID string `json:"nodeId,omitempty"` // 连接到的节点 ID
}

// Component 电路元件
type Component struct {
	ID       string          `json:"id"`       // 元件唯一 ID
	Type     ComponentType   `json:"type"`     // 元件类型
	Name     string          `json:"name"`     // 显示名称，如 R1, C2
	Position Point           `json:"position"` // 画布坐标
	Rotation int             `json:"rotation"` // 旋转角度 (0, 90, 180, 270)
	Value    ComponentValue  `json:"value"`    // 元件参数值
	Ports    []ComponentPort `json:"ports"`    // 元件端口列表
	Params   map[string]any  `json:"params,omitempty"` // 额外参数
}

// ==================== 节点定义 ====================

// NodeType 节点类型
type NodeType string

const (
	NodeNormal  NodeType = "normal"
	NodeGround  NodeType = "ground"
	NodeInput   NodeType = "input"
	NodeOutput  NodeType = "output"
)

// CircuitNode 电路节点
type CircuitNode struct {
	ID             string   `json:"id"`             // 节点唯一 ID
	Name           string   `json:"name"`           // 节点名称，如 N1, GND
	Type           NodeType `json:"type"`           // 节点类型
	Position       Point    `json:"position"`       // 画布位置
	ConnectedPorts []string `json:"connectedPorts"` // 连接到此节点的端口 ID
	Voltage        *float64 `json:"voltage,omitempty"` // 仿真电压结果
}

// ==================== 连线定义 ====================

// WireStatus 连线状态
type WireStatus string

const (
	WireConnected    WireStatus = "connected"
	WireDisconnected WireStatus = "disconnected"
	WireInvalid      WireStatus = "invalid"
)

// WirePoint 连线路径点
type WirePoint struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	IsBend bool    `json:"isBend,omitempty"`
}

// Wire 连线
type Wire struct {
	ID               string      `json:"id"`               // 连线唯一 ID
	FromComponentID  string      `json:"fromComponentId"`  // 起始元件 ID
	FromPortID       string      `json:"fromPortId"`       // 起始端口 ID
	ToComponentID    string      `json:"toComponentId"`    // 目标元件 ID
	ToPortID         string      `json:"toPortId"`         // 目标端口 ID
	Points           []WirePoint `json:"points"`           // 连线路径点
	Status           WireStatus  `json:"status"`           // 连线状态
	Current          *float64    `json:"current,omitempty"` // 仿真电流结果
}

// ==================== 通用类型 ====================

// Point 2D 坐标点
type Point struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}
