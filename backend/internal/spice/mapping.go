// Package spice 提供 SPICE 网表解析和导出功能
// 支持标准 SPICE 网表格式 (.cir/.sp)，包括元件定义、子电路、控制命令
package spice

import "chip-sim/pkg/types"

// ==================== SPICE 元件类型前缀 ====================

const (
	PrefixResistor      = "R" // 电阻
	PrefixCapacitor     = "C" // 电容
	PrefixInductor      = "L" // 电感
	PrefixDiode         = "D" // 二极管
	PrefixBJTNPN        = "Q" // NPN BJT
	PrefixBJTPNP        = "Q" // PNP BJT（用 model 区分）
	PrefixMOSFETNMOS    = "M" // NMOS
	PrefixMOSFETPMOS    = "M" // PMOS（用 model 区分）
	PrefixVoltageSource = "V" // 电压源
	PrefixCurrentSource = "I" // 电流源
	PrefixSubcircuit    = "X" // 子电路实例
)

// ==================== SPICE 分析命令 ====================

const (
	CmdOp        = ".OP"        // 直流工作点
	CmdDC        = ".DC"        // 直流扫描
	CmdAC        = ".AC"        // 交流分析
	CmdTran      = ".TRAN"      // 瞬态分析
	CmdSubckt    = ".SUBCKT"    // 子电路定义
	CmdEndSubckt = ".ENDS"      // 子电路结束
	CmdModel     = ".MODEL"     // 模型定义
	CmdInclude   = ".INCLUDE"   // 包含文件
	CmdLib       = ".LIB"       // 库引用
	CmdParam     = ".PARAM"     // 参数定义
	CmdEnd       = ".END"       // 网表结束
	CmdOptions   = ".OPTIONS"   // 选项设置
	CmdGlobal    = ".GLOBAL"    // 全局节点
	CmdIC        = ".IC"        // 初始条件
)

// ==================== 元件映射 ====================

// SpiceToComponentMap SPICE 前缀到 chip-sim 元件类型的映射
var SpiceToComponentMap = map[byte]types.ComponentType{
	'R': types.ComponentResistor,
	'C': types.ComponentCapacitor,
	'L': types.ComponentInductor,
	'D': types.ComponentDiode,
	'V': types.ComponentVoltageSource,
	'I': types.ComponentCurrentSource,
	'Q': types.ComponentBJTNPN,      // 默认 NPN，根据 model 区分 PNP
	'M': types.ComponentMOSFETNMOS,  // 默认 NMOS，根据 model 区分 PMOS
}

// ComponentToSpiceMap chip-sim 元件类型到 SPICE 前缀的映射
var ComponentToSpiceMap = map[types.ComponentType]string{
	types.ComponentResistor:      PrefixResistor,
	types.ComponentCapacitor:     PrefixCapacitor,
	types.ComponentInductor:      PrefixInductor,
	types.ComponentDiode:         PrefixDiode,
	types.ComponentBJTNPN:        PrefixBJTNPN,
	types.ComponentBJTPNP:        PrefixBJTPNP,
	types.ComponentMOSFETNMOS:    PrefixMOSFETNMOS,
	types.ComponentMOSFETPMOS:    PrefixMOSFETPMOS,
	types.ComponentVoltageSource: PrefixVoltageSource,
	types.ComponentCurrentSource: PrefixCurrentSource,
	types.ComponentDCSource:      PrefixVoltageSource,
	types.ComponentACSource:      PrefixVoltageSource,
	types.ComponentOpAmp:         PrefixSubcircuit,
	// 74 系列 IC 全部映射为 X（子电路实例化）
	types.Component7400:  PrefixSubcircuit,
	types.Component7402:  PrefixSubcircuit,
	types.Component7404:  PrefixSubcircuit,
	types.Component7408:  PrefixSubcircuit,
	types.Component7432:  PrefixSubcircuit,
	types.Component7486:  PrefixSubcircuit,
	types.Component7474:  PrefixSubcircuit,
	types.Component7473:  PrefixSubcircuit,
	types.Component74373: PrefixSubcircuit,
	types.Component7490:  PrefixSubcircuit,
	types.Component74194: PrefixSubcircuit,
	types.Component74164: PrefixSubcircuit,
}

// BJTSubtypeMap BJT 子类型映射（通过 model 语句区分）
var BJTSubtypeMap = map[string]types.ComponentType{
	"NPN": types.ComponentBJTNPN,
	"PNP": types.ComponentBJTPNP,
}

// MOSFETSubtypeMap MOSFET 子类型映射
var MOSFETSubtypeMap = map[string]types.ComponentType{
	"NMOS": types.ComponentMOSFETNMOS,
	"PMOS": types.ComponentMOSFETPMOS,
}

// SpiceUnitMap SPICE 单位后缀到倍率的映射
var SpiceUnitMap = map[byte]float64{
	'T': 1e12,
	'G': 1e9,
	'M': 1e6, // 注意：SPICE 中 MEG 表示兆
	'K': 1e3,
	'k': 1e3,
	'm': 1e-3,
	'u': 1e-6,
	'U': 1e-6,
	'n': 1e-9,
	'N': 1e-9,
	'p': 1e-12,
	'P': 1e-12,
	'f': 1e-15,
	'F': 1e-15,
}

// UnknownModel 是默认的 SPICE 模型名称
const UnknownModel = "unknown"

// SubcircuitDef 子电路定义
type SubcircuitDef struct {
	Name   string   // 子电路名称
	Ports  []string // 端口列表（节点名称）
	Body   []string // 子电路内部元件行
	Params []string // 参数名称
}

// ==================== OpAmp 子电路定义 ====================

// OpAmpDefaultSubcircuit 默认运放子电路（简化宏模型）
const OpAmpDefaultSubcircuit = `.SUBCKT opamp in+ in- out vcc vee
Rin+ in+ 0 1MEG
Rin- in- 0 1MEG
Egain out_int 0 in+ in- 100k
Rout out_int out 75
Cout out 0 1p
.ENDS opamp`

// OpAmpDefaultModel 默认运放模型名称
const OpAmpDefaultModel = "opamp"

// ==================== 74 系列 IC 子电路定义 ====================

// Chip74SubcircuitMap 74 系列 IC → SPICE 子电路定义
var Chip74SubcircuitMap = map[types.ComponentType]string{
	types.Component7400:  chip7400Subckt,
	types.Component7402:  chip7402Subckt,
	types.Component7404:  chip7404Subckt,
	types.Component7408:  chip7408Subckt,
	types.Component7432:  chip7432Subckt,
	types.Component7486:  chip7486Subckt,
	types.Component7474:  chip7474Subckt,
	types.Component7490:  chip7490Subckt,
}

// Chip74ModelNameMap 74 系列 IC → 子电路实例化模型名称
var Chip74ModelNameMap = map[types.ComponentType]string{
	types.Component7400:  "ttl7400",
	types.Component7402:  "ttl7402",
	types.Component7404:  "ttl7404",
	types.Component7408:  "ttl7408",
	types.Component7432:  "ttl7432",
	types.Component7486:  "ttl7486",
	types.Component7474:  "ttl7474",
	types.Component7473:  "ttl7473",
	types.Component74373: "ttl74373",
	types.Component7490:  "ttl7490",
	types.Component74194: "ttl74194",
	types.Component74164: "ttl74164",
}

// Chip74SubcircuitPortsMap 74 系列 IC → 端口顺序（用于子电路实例化）
var Chip74SubcircuitPortsMap = map[types.ComponentType][]string{
	types.Component7400:  {"1A", "1B", "1Y", "2A", "2B", "2Y", "GND", "3Y", "3A", "3B", "4Y", "4A", "4B", "VCC"},
	types.Component7402:  {"1Y", "1A", "1B", "2Y", "2A", "2B", "GND", "3A", "3B", "3Y", "4A", "4B", "4Y", "VCC"},
	types.Component7404:  {"1A", "1Y", "2A", "2Y", "3A", "3Y", "GND", "4Y", "4A", "5Y", "5A", "6Y", "6A", "VCC"},
	types.Component7408:  {"1A", "1B", "1Y", "2A", "2B", "2Y", "GND", "3Y", "3A", "3B", "4Y", "4A", "4B", "VCC"},
	types.Component7432:  {"1A", "1B", "1Y", "2A", "2B", "2Y", "GND", "3Y", "3A", "3B", "4Y", "4A", "4B", "VCC"},
	types.Component7486:  {"1A", "1B", "1Y", "2A", "2B", "2Y", "GND", "3Y", "3A", "3B", "4Y", "4A", "4B", "VCC"},
	types.Component7474:  {"1CLR", "1D", "1CLK", "1PRE", "1Q", "1Q_", "GND", "2Q", "2Q_", "2PRE", "2CLK", "2D", "2CLR", "VCC"},
	types.Component7490:  {"CKB", "R01", "R02", "NC1", "NC2", "R91", "R92", "GND", "QC", "QB", "NC3", "QA", "CKA", "VCC"},
}

const chip7400Subckt = `.SUBCKT ttl7400 1A 1B 1Y 2A 2B 2Y GND 3Y 3A 3B 4Y 4A 4B VCC
* Simplified TTL NAND gate model
.ENDS ttl7400`

const chip7402Subckt = `.SUBCKT ttl7402 1Y 1A 1B 2Y 2A 2B GND 3A 3B 3Y 4A 4B 4Y VCC
* Simplified TTL NOR gate model
.ENDS ttl7402`

const chip7404Subckt = `.SUBCKT ttl7404 1A 1Y 2A 2Y 3A 3Y GND 4Y 4A 5Y 5A 6Y 6A VCC
* Simplified TTL inverter model
.ENDS ttl7404`

const chip7408Subckt = `.SUBCKT ttl7408 1A 1B 1Y 2A 2B 2Y GND 3Y 3A 3B 4Y 4A 4B VCC
* Simplified TTL AND gate model
.ENDS ttl7408`

const chip7432Subckt = `.SUBCKT ttl7432 1A 1B 1Y 2A 2B 2Y GND 3Y 3A 3B 4Y 4A 4B VCC
* Simplified TTL OR gate model
.ENDS ttl7432`

const chip7486Subckt = `.SUBCKT ttl7486 1A 1B 1Y 2A 2B 2Y GND 3Y 3A 3B 4Y 4A 4B VCC
* Simplified TTL XOR gate model
.ENDS ttl7486`

const chip7474Subckt = `.SUBCKT ttl7474 1CLR 1D 1CLK 1PRE 1Q 1Q_ GND 2Q 2Q_ 2PRE 2CLK 2D 2CLR VCC
* Simplified TTL dual D flip-flop model
.ENDS ttl7474`

const chip7490Subckt = `.SUBCKT ttl7490 CKB R01 R02 NC1 NC2 R91 R92 GND QC QB NC3 QA CKA VCC
* Simplified TTL decade counter model
.ENDS ttl7490`

// ==================== 默认半导体模型参数 ====================

// DefaultDiodeModel 默认二极管 SPICE 模型参数
const DefaultDiodeModel = `.MODEL D1N4148 D(Is=2.52n Rs=0.568 N=1.752 Cjo=4p M=0.333 Vj=0.75 Tt=11.54n Bv=100 Ibv=100u)`

// DefaultNPNModel 默认 NPN BJT SPICE 模型参数
const DefaultNPNModel = `.MODEL 2N2222 NPN(Is=14.34f Xti=3 Eg=1.11 Vaf=74.03 Bf=255.9 Ne=1.307 Ise=14.34f Ikf=0.2847 Xtb=1.5 Br=6.092 Nc=2 Isc=0 Ikr=0 Rc=1 Cjc=7.306p Mjc=0.3416 Vjc=0.75 Fc=0.5 Cje=22.01p Mje=0.377 Vje=0.75 Tr=46.91n Tf=411.1p Itf=0.6 Xtf=1.6 Vtf=6.049)`

// DefaultPNPModel 默认 PNP BJT SPICE 模型参数
const DefaultPNPModel = `.MODEL 2N2907 PNP(Is=1.02f Xti=3 Eg=1.11 Vaf=115.7 Bf=231.7 Ne=1.829 Ise=10.2f Ikf=1.079 Xtb=1.5 Br=3.563 Nc=2 Isc=0 Ikr=0 Rc=1.175 Cjc=14.76p Mjc=0.5383 Vjc=0.75 Fc=0.5 Cje=19.82p Mje=0.3357 Vje=0.75 Tr=59.74n Tf=603.7p Itf=0.6 Xtf=2.2 Vtf=6.049)`

// DefaultNMOSModel 默认 NMOS SPICE 模型参数
const DefaultNMOSModel = `.MODEL 2N7000 NMOS(Level=1 Vto=2.094 Kp=0.2628 Gamma=0 Phi=0.6 Lambda=0.01147 Rd=1.083 Rs=0.5333 Cbd=37.35p Cbs=34.79p Cgso=51.17p Cgdo=19.7p Cgbo=95.82p Is=4.375e-14 Pb=0.8 Mj=0.46 FC=0.5 Rsh=27.94)`

// DefaultPMOSModel 默认 PMOS SPICE 模型参数
const DefaultPMOSModel = `.MODEL BS250 PMOS(Level=1 Vto=-3.183 Kp=0.2948 Gamma=0.9 Phi=0.6 Lambda=0.02333 Rd=2.793 Rs=2.095 Cbd=47.3p Cbs=46.8p Cgso=51.17p Cgdo=19.7p Cgbo=95.82p Is=4.375e-14 Pb=0.8 Mj=0.46 FC=0.5 Rsh=64)`

// SpiceNodeMap 将 SPICE 节点名称（如 "0", "gnd"）映射到 chip-sim 节点 ID
type SpiceNodeMap struct {
	nameToID   map[string]string
	idToName   map[string]string
	nextNodeID int
}

// NewSpiceNodeMap 创建新的节点映射
func NewSpiceNodeMap() *SpiceNodeMap {
	m := &SpiceNodeMap{
		nameToID:   make(map[string]string),
		idToName:   make(map[string]string),
		nextNodeID: 1,
	}
	// SPICE 节点 0 和 "gnd" 等价于地
	m.Map("0", "node_gnd")
	m.Map("gnd", "node_gnd")
	m.Map("GND", "node_gnd")
	return m
}

// Map 添加节点映射
func (m *SpiceNodeMap) Map(spiceName, chipSimID string) {
	m.nameToID[spiceName] = chipSimID
	m.idToName[chipSimID] = spiceName
}

// GetID 获取 chip-sim 节点 ID，如果不存在则自动创建
func (m *SpiceNodeMap) GetID(spiceName string) string {
	if id, ok := m.nameToID[spiceName]; ok {
		return id
	}
	id := generateNodeID(m.nextNodeID)
	m.nextNodeID++
	m.Map(spiceName, id)
	return id
}

// GetSpiceName 获取 SPICE 节点名称
func (m *SpiceNodeMap) GetSpiceName(chipSimID string) string {
	if name, ok := m.idToName[chipSimID]; ok {
		return name
	}
	return chipSimID
}

// AllNodes 返回所有已映射的节点信息
func (m *SpiceNodeMap) AllNodes() map[string]string {
	return m.nameToID
}

func generateNodeID(n int) string {
	return "node_" + itoa(n)
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	s := ""
	for n > 0 {
		s = string(rune('0'+n%10)) + s
		n /= 10
	}
	return s
}
