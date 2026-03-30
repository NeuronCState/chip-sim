// Package engine 74 系列 TTL 逻辑 IC 定义
// 包含引脚图、真值表、传播延迟等完整参数
package engine

import "chip-sim/pkg/types"

// ChipRegistry 所有支持的 74 系列 IC 定义
var ChipRegistry map[string]*types.ChipDefinition

func init() {
	ChipRegistry = make(map[string]*types.ChipDefinition)
	register7400()
	register7402()
	register7404()
	register7408()
	register7432()
	register7486()
	register7474()
	register7473()
	register74373()
	register7490()
	register74194()
	register74164()
}

// ==================== 7400 四2输入与非门 ====================

func register7400() {
	ChipRegistry["7400"] = &types.ChipDefinition{
		PartNumber:         "7400",
		Name:               "四2输入与非门",
		Description:        "Quad 2-Input NAND Gate",
		Package:            "DIP-14",
		PropagationDelayNs: 10,
		FanOut:             10,
		Pins: []types.ChipPin{
			{Number: 1, Name: "1A", Direction: types.PinInput, Index: 0},
			{Number: 2, Name: "1B", Direction: types.PinInput, Index: 1},
			{Number: 3, Name: "1Y", Direction: types.PinOutput, Index: 0},
			{Number: 4, Name: "2A", Direction: types.PinInput, Index: 2},
			{Number: 5, Name: "2B", Direction: types.PinInput, Index: 3},
			{Number: 6, Name: "2Y", Direction: types.PinOutput, Index: 1},
			{Number: 7, Name: "GND", Direction: types.PinGnd, Index: -1},
			{Number: 8, Name: "3Y", Direction: types.PinOutput, Index: 2},
			{Number: 9, Name: "3A", Direction: types.PinInput, Index: 4},
			{Number: 10, Name: "3B", Direction: types.PinInput, Index: 5},
			{Number: 11, Name: "4Y", Direction: types.PinOutput, Index: 3},
			{Number: 12, Name: "4A", Direction: types.PinInput, Index: 6},
			{Number: 13, Name: "4B", Direction: types.PinInput, Index: 7},
			{Number: 14, Name: "VCC", Direction: types.PinPower, Index: -1},
		},
		TruthTables: []types.TruthTable{
			{
				Inputs:  []string{"A", "B"},
				Outputs: []string{"Y"},
				Rows: [][]string{
					{"0", "0", "1"},
					{"0", "1", "1"},
					{"1", "0", "1"},
					{"1", "1", "0"},
				},
			},
		},
	}
}

// ==================== 7402 四2输入或非门 ====================

func register7402() {
	ChipRegistry["7402"] = &types.ChipDefinition{
		PartNumber:         "7402",
		Name:               "四2输入或非门",
		Description:        "Quad 2-Input NOR Gate",
		Package:            "DIP-14",
		PropagationDelayNs: 10,
		FanOut:             10,
		Pins: []types.ChipPin{
			{Number: 1, Name: "1Y", Direction: types.PinOutput, Index: 0},
			{Number: 2, Name: "1A", Direction: types.PinInput, Index: 0},
			{Number: 3, Name: "1B", Direction: types.PinInput, Index: 1},
			{Number: 4, Name: "2Y", Direction: types.PinOutput, Index: 1},
			{Number: 5, Name: "2A", Direction: types.PinInput, Index: 2},
			{Number: 6, Name: "2B", Direction: types.PinInput, Index: 3},
			{Number: 7, Name: "GND", Direction: types.PinGnd, Index: -1},
			{Number: 8, Name: "3A", Direction: types.PinInput, Index: 4},
			{Number: 9, Name: "3B", Direction: types.PinInput, Index: 5},
			{Number: 10, Name: "3Y", Direction: types.PinOutput, Index: 2},
			{Number: 11, Name: "4A", Direction: types.PinInput, Index: 6},
			{Number: 12, Name: "4B", Direction: types.PinInput, Index: 7},
			{Number: 13, Name: "4Y", Direction: types.PinOutput, Index: 3},
			{Number: 14, Name: "VCC", Direction: types.PinPower, Index: -1},
		},
		TruthTables: []types.TruthTable{
			{
				Inputs:  []string{"A", "B"},
				Outputs: []string{"Y"},
				Rows: [][]string{
					{"0", "0", "1"},
					{"0", "1", "0"},
					{"1", "0", "0"},
					{"1", "1", "0"},
				},
			},
		},
	}
}

// ==================== 7404 六反相器 ====================

func register7404() {
	ChipRegistry["7404"] = &types.ChipDefinition{
		PartNumber:         "7404",
		Name:               "六反相器",
		Description:        "Hex Inverter",
		Package:            "DIP-14",
		PropagationDelayNs: 10,
		FanOut:             10,
		Pins: []types.ChipPin{
			{Number: 1, Name: "1A", Direction: types.PinInput, Index: 0},
			{Number: 2, Name: "1Y", Direction: types.PinOutput, Index: 0},
			{Number: 3, Name: "2A", Direction: types.PinInput, Index: 1},
			{Number: 4, Name: "2Y", Direction: types.PinOutput, Index: 1},
			{Number: 5, Name: "3A", Direction: types.PinInput, Index: 2},
			{Number: 6, Name: "3Y", Direction: types.PinOutput, Index: 2},
			{Number: 7, Name: "GND", Direction: types.PinGnd, Index: -1},
			{Number: 8, Name: "4Y", Direction: types.PinOutput, Index: 3},
			{Number: 9, Name: "4A", Direction: types.PinInput, Index: 3},
			{Number: 10, Name: "5Y", Direction: types.PinOutput, Index: 4},
			{Number: 11, Name: "5A", Direction: types.PinInput, Index: 4},
			{Number: 12, Name: "6Y", Direction: types.PinOutput, Index: 5},
			{Number: 13, Name: "6A", Direction: types.PinInput, Index: 5},
			{Number: 14, Name: "VCC", Direction: types.PinPower, Index: -1},
		},
		TruthTables: []types.TruthTable{
			{
				Inputs:  []string{"A"},
				Outputs: []string{"Y"},
				Rows: [][]string{
					{"0", "1"},
					{"1", "0"},
				},
			},
		},
	}
}

// ==================== 7408 四2输入与门 ====================

func register7408() {
	ChipRegistry["7408"] = &types.ChipDefinition{
		PartNumber:         "7408",
		Name:               "四2输入与门",
		Description:        "Quad 2-Input AND Gate",
		Package:            "DIP-14",
		PropagationDelayNs: 12,
		FanOut:             10,
		Pins: []types.ChipPin{
			{Number: 1, Name: "1A", Direction: types.PinInput, Index: 0},
			{Number: 2, Name: "1B", Direction: types.PinInput, Index: 1},
			{Number: 3, Name: "1Y", Direction: types.PinOutput, Index: 0},
			{Number: 4, Name: "2A", Direction: types.PinInput, Index: 2},
			{Number: 5, Name: "2B", Direction: types.PinInput, Index: 3},
			{Number: 6, Name: "2Y", Direction: types.PinOutput, Index: 1},
			{Number: 7, Name: "GND", Direction: types.PinGnd, Index: -1},
			{Number: 8, Name: "3Y", Direction: types.PinOutput, Index: 2},
			{Number: 9, Name: "3A", Direction: types.PinInput, Index: 4},
			{Number: 10, Name: "3B", Direction: types.PinInput, Index: 5},
			{Number: 11, Name: "4Y", Direction: types.PinOutput, Index: 3},
			{Number: 12, Name: "4A", Direction: types.PinInput, Index: 6},
			{Number: 13, Name: "4B", Direction: types.PinInput, Index: 7},
			{Number: 14, Name: "VCC", Direction: types.PinPower, Index: -1},
		},
		TruthTables: []types.TruthTable{
			{
				Inputs:  []string{"A", "B"},
				Outputs: []string{"Y"},
				Rows: [][]string{
					{"0", "0", "0"},
					{"0", "1", "0"},
					{"1", "0", "0"},
					{"1", "1", "1"},
				},
			},
		},
	}
}

// ==================== 7432 四2输入或门 ====================

func register7432() {
	ChipRegistry["7432"] = &types.ChipDefinition{
		PartNumber:         "7432",
		Name:               "四2输入或门",
		Description:        "Quad 2-Input OR Gate",
		Package:            "DIP-14",
		PropagationDelayNs: 12,
		FanOut:             10,
		Pins: []types.ChipPin{
			{Number: 1, Name: "1A", Direction: types.PinInput, Index: 0},
			{Number: 2, Name: "1B", Direction: types.PinInput, Index: 1},
			{Number: 3, Name: "1Y", Direction: types.PinOutput, Index: 0},
			{Number: 4, Name: "2A", Direction: types.PinInput, Index: 2},
			{Number: 5, Name: "2B", Direction: types.PinInput, Index: 3},
			{Number: 6, Name: "2Y", Direction: types.PinOutput, Index: 1},
			{Number: 7, Name: "GND", Direction: types.PinGnd, Index: -1},
			{Number: 8, Name: "3Y", Direction: types.PinOutput, Index: 2},
			{Number: 9, Name: "3A", Direction: types.PinInput, Index: 4},
			{Number: 10, Name: "3B", Direction: types.PinInput, Index: 5},
			{Number: 11, Name: "4Y", Direction: types.PinOutput, Index: 3},
			{Number: 12, Name: "4A", Direction: types.PinInput, Index: 6},
			{Number: 13, Name: "4B", Direction: types.PinInput, Index: 7},
			{Number: 14, Name: "VCC", Direction: types.PinPower, Index: -1},
		},
		TruthTables: []types.TruthTable{
			{
				Inputs:  []string{"A", "B"},
				Outputs: []string{"Y"},
				Rows: [][]string{
					{"0", "0", "0"},
					{"0", "1", "1"},
					{"1", "0", "1"},
					{"1", "1", "1"},
				},
			},
		},
	}
}

// ==================== 7486 四2输入异或门 ====================

func register7486() {
	ChipRegistry["7486"] = &types.ChipDefinition{
		PartNumber:         "7486",
		Name:               "四2输入异或门",
		Description:        "Quad 2-Input XOR Gate",
		Package:            "DIP-14",
		PropagationDelayNs: 14,
		FanOut:             10,
		Pins: []types.ChipPin{
			{Number: 1, Name: "1A", Direction: types.PinInput, Index: 0},
			{Number: 2, Name: "1B", Direction: types.PinInput, Index: 1},
			{Number: 3, Name: "1Y", Direction: types.PinOutput, Index: 0},
			{Number: 4, Name: "2A", Direction: types.PinInput, Index: 2},
			{Number: 5, Name: "2B", Direction: types.PinInput, Index: 3},
			{Number: 6, Name: "2Y", Direction: types.PinOutput, Index: 1},
			{Number: 7, Name: "GND", Direction: types.PinGnd, Index: -1},
			{Number: 8, Name: "3Y", Direction: types.PinOutput, Index: 2},
			{Number: 9, Name: "3A", Direction: types.PinInput, Index: 4},
			{Number: 10, Name: "3B", Direction: types.PinInput, Index: 5},
			{Number: 11, Name: "4Y", Direction: types.PinOutput, Index: 3},
			{Number: 12, Name: "4A", Direction: types.PinInput, Index: 6},
			{Number: 13, Name: "4B", Direction: types.PinInput, Index: 7},
			{Number: 14, Name: "VCC", Direction: types.PinPower, Index: -1},
		},
		TruthTables: []types.TruthTable{
			{
				Inputs:  []string{"A", "B"},
				Outputs: []string{"Y"},
				Rows: [][]string{
					{"0", "0", "0"},
					{"0", "1", "1"},
					{"1", "0", "1"},
					{"1", "1", "0"},
				},
			},
		},
	}
}

// ==================== 7474 双D触发器（带预置/清除） ====================

func register7474() {
	ChipRegistry["7474"] = &types.ChipDefinition{
		PartNumber:         "7474",
		Name:               "双D触发器",
		Description:        "Dual D Flip-Flop with Preset and Clear",
		Package:            "DIP-14",
		PropagationDelayNs: 25,
		FanOut:             10,
		Pins: []types.ChipPin{
			{Number: 1, Name: "1CLR", Direction: types.PinInput, Index: 0},  // 清除（低有效）
			{Number: 2, Name: "1D", Direction: types.PinInput, Index: 1},     // 数据输入
			{Number: 3, Name: "1CLK", Direction: types.PinInput, Index: 2},   // 时钟
			{Number: 4, Name: "1PRE", Direction: types.PinInput, Index: 3},   // 预置（低有效）
			{Number: 5, Name: "1Q", Direction: types.PinOutput, Index: 0},    // 输出
			{Number: 6, Name: "1Q̄", Direction: types.PinOutput, Index: 1},    // 反相输出
			{Number: 7, Name: "GND", Direction: types.PinGnd, Index: -1},
			{Number: 8, Name: "2Q̄", Direction: types.PinOutput, Index: 3},    // 反相输出
			{Number: 9, Name: "2Q", Direction: types.PinOutput, Index: 2},    // 输出
			{Number: 10, Name: "2PRE", Direction: types.PinInput, Index: 7},  // 预置
			{Number: 11, Name: "2CLK", Direction: types.PinInput, Index: 6},  // 时钟
			{Number: 12, Name: "2D", Direction: types.PinInput, Index: 5},    // 数据输入
			{Number: 13, Name: "2CLR", Direction: types.PinInput, Index: 4},  // 清除
			{Number: 14, Name: "VCC", Direction: types.PinPower, Index: -1},
		},
		TruthTables: []types.TruthTable{
			{
				Inputs:  []string{"PRE", "CLR", "CLK", "D"},
				Outputs: []string{"Q", "Q̄"},
				Rows: [][]string{
					{"0", "1", "X", "X", "1", "0"},  // 预置
					{"1", "0", "X", "X", "0", "1"},  // 清除
					{"0", "0", "X", "X", "1", "1"},  // 无效
					{"1", "1", "↑", "0", "0", "1"},  // 时钟上升沿，D=0
					{"1", "1", "↑", "1", "1", "0"},  // 时钟上升沿，D=1
				},
			},
		},
	}
}

// ==================== 7473 双JK触发器 ====================

func register7473() {
	ChipRegistry["7473"] = &types.ChipDefinition{
		PartNumber:         "7473",
		Name:               "双JK触发器",
		Description:        "Dual JK Flip-Flop with Clear",
		Package:            "DIP-14",
		PropagationDelayNs: 25,
		FanOut:             10,
		Pins: []types.ChipPin{
			{Number: 1, Name: "1CLK", Direction: types.PinInput, Index: 0},   // 时钟
			{Number: 2, Name: "1CLR", Direction: types.PinInput, Index: 1},   // 清除（低有效）
			{Number: 3, Name: "1K", Direction: types.PinInput, Index: 2},     // K输入
			{Number: 4, Name: "VCC", Direction: types.PinPower, Index: -1},
			{Number: 5, Name: "2CLK", Direction: types.PinInput, Index: 3},   // 时钟
			{Number: 6, Name: "2CLR", Direction: types.PinInput, Index: 4},   // 清除
			{Number: 7, Name: "2J", Direction: types.PinInput, Index: 5},     // J输入
			{Number: 8, Name: "2Q̄", Direction: types.PinOutput, Index: 2},    // 反相输出
			{Number: 9, Name: "2Q", Direction: types.PinOutput, Index: 3},    // 输出
			{Number: 10, Name: "2K", Direction: types.PinInput, Index: 6},    // K输入
			{Number: 11, Name: "GND", Direction: types.PinGnd, Index: -1},
			{Number: 12, Name: "1Q̄", Direction: types.PinOutput, Index: 1},   // 反相输出
			{Number: 13, Name: "1Q", Direction: types.PinOutput, Index: 0},   // 输出
			{Number: 14, Name: "1J", Direction: types.PinInput, Index: 7},    // J输入
		},
		TruthTables: []types.TruthTable{
			{
				Inputs:  []string{"CLR", "CLK", "J", "K"},
				Outputs: []string{"Q", "Q̄"},
				Rows: [][]string{
					{"0", "X", "X", "X", "0", "1"},   // 清除
					{"1", "↑", "0", "0", "Q0", "Q̄0"}, // 保持
					{"1", "↑", "0", "1", "0", "1"},    // 复位
					{"1", "↑", "1", "0", "1", "0"},    // 置位
					{"1", "↑", "1", "1", "Q̄0", "Q0"},  // 翻转
				},
			},
		},
	}
}

// ==================== 74373 八D锁存器 ====================

func register74373() {
	ChipRegistry["74373"] = &types.ChipDefinition{
		PartNumber:         "74373",
		Name:               "八D锁存器",
		Description:        "Octal D-Type Latch with 3-State Output",
		Package:            "DIP-20",
		PropagationDelayNs: 15,
		FanOut:             10,
		Pins: []types.ChipPin{
			{Number: 1, Name: "OE", Direction: types.PinInput, Index: 0},    // 输出使能（低有效）
			{Number: 2, Name: "1Q", Direction: types.PinOutput, Index: 0},
			{Number: 3, Name: "1D", Direction: types.PinInput, Index: 1},
			{Number: 4, Name: "2D", Direction: types.PinInput, Index: 2},
			{Number: 5, Name: "2Q", Direction: types.PinOutput, Index: 1},
			{Number: 6, Name: "3Q", Direction: types.PinOutput, Index: 2},
			{Number: 7, Name: "3D", Direction: types.PinInput, Index: 3},
			{Number: 8, Name: "4D", Direction: types.PinInput, Index: 4},
			{Number: 9, Name: "4Q", Direction: types.PinOutput, Index: 3},
			{Number: 10, Name: "GND", Direction: types.PinGnd, Index: -1},
			{Number: 11, Name: "LE", Direction: types.PinInput, Index: 5},    // 锁存使能
			{Number: 12, Name: "5Q", Direction: types.PinOutput, Index: 4},
			{Number: 13, Name: "5D", Direction: types.PinInput, Index: 6},
			{Number: 14, Name: "6D", Direction: types.PinInput, Index: 7},
			{Number: 15, Name: "6Q", Direction: types.PinOutput, Index: 5},
			{Number: 16, Name: "7Q", Direction: types.PinOutput, Index: 6},
			{Number: 17, Name: "7D", Direction: types.PinInput, Index: 8},
			{Number: 18, Name: "8D", Direction: types.PinInput, Index: 9},
			{Number: 19, Name: "8Q", Direction: types.PinOutput, Index: 7},
			{Number: 20, Name: "VCC", Direction: types.PinPower, Index: -1},
		},
		TruthTables: []types.TruthTable{
			{
				Inputs:  []string{"OE", "LE", "D"},
				Outputs: []string{"Q"},
				Rows: [][]string{
					{"1", "X", "X", "Z"},   // 输出高阻
					{"0", "1", "0", "0"},   // 透明模式
					{"0", "1", "1", "1"},   // 透明模式
					{"0", "0", "X", "Q0"},  // 锁存
				},
			},
		},
	}
}

// ==================== 7490 十进制计数器 ====================

func register7490() {
	ChipRegistry["7490"] = &types.ChipDefinition{
		PartNumber:         "7490",
		Name:               "十进制计数器",
		Description:        "Decade Counter",
		Package:            "DIP-14",
		PropagationDelayNs: 18,
		FanOut:             10,
		Pins: []types.ChipPin{
			{Number: 1, Name: "CKB", Direction: types.PinInput, Index: 0},    // ÷5 时钟输入
			{Number: 2, Name: "R0(1)", Direction: types.PinInput, Index: 1},  // 复位
			{Number: 3, Name: "R0(2)", Direction: types.PinInput, Index: 2},  // 复位
			{Number: 4, Name: "NC", Direction: types.PinInput, Index: -1},
			{Number: 5, Name: "VCC", Direction: types.PinPower, Index: -1},
			{Number: 6, Name: "S9(1)", Direction: types.PinInput, Index: 3},  // 置9
			{Number: 7, Name: "S9(2)", Direction: types.PinInput, Index: 4},  // 置9
			{Number: 8, Name: "QC", Direction: types.PinOutput, Index: 2},
			{Number: 9, Name: "QB", Direction: types.PinOutput, Index: 1},
			{Number: 10, Name: "GND", Direction: types.PinGnd, Index: -1},
			{Number: 11, Name: "QD", Direction: types.PinOutput, Index: 3},
			{Number: 12, Name: "QA", Direction: types.PinOutput, Index: 0},
			{Number: 13, Name: "NC", Direction: types.PinInput, Index: -1},
			{Number: 14, Name: "CKA", Direction: types.PinInput, Index: 5},  // ÷2 时钟输入
		},
		TruthTables: []types.TruthTable{
			{
				Inputs:  []string{"R0(1)", "R0(2)", "S9(1)", "S9(2)"},
				Outputs: []string{"QD", "QC", "QB", "QA"},
				Rows: [][]string{
					{"1", "1", "0", "X", "0", "0", "0", "0"}, // 复位
					{"1", "1", "X", "0", "0", "0", "0", "0"}, // 复位
					{"X", "X", "1", "1", "1", "0", "0", "1"}, // 置9
					{"0", "X", "0", "X", "-", "-", "-", "-"},  // 计数
					{"X", "0", "X", "0", "-", "-", "-", "-"},  // 计数
				},
			},
		},
	}
}

// ==================== 74194 4位双向移位寄存器 ====================

func register74194() {
	ChipRegistry["74194"] = &types.ChipDefinition{
		PartNumber:         "74194",
		Name:               "4位双向移位寄存器",
		Description:        "4-Bit Bidirectional Universal Shift Register",
		Package:            "DIP-16",
		PropagationDelayNs: 20,
		FanOut:             10,
		Pins: []types.ChipPin{
			{Number: 1, Name: "CLR", Direction: types.PinInput, Index: 0},    // 清除（低有效）
			{Number: 2, Name: "SR", Direction: types.PinInput, Index: 1},     // 串行右移输入
			{Number: 3, Name: "A", Direction: types.PinInput, Index: 2},      // 并行输入A
			{Number: 4, Name: "B", Direction: types.PinInput, Index: 3},      // 并行输入B
			{Number: 5, Name: "C", Direction: types.PinInput, Index: 4},      // 并行输入C
			{Number: 6, Name: "D", Direction: types.PinInput, Index: 5},      // 并行输入D
			{Number: 7, Name: "SL", Direction: types.PinInput, Index: 6},     // 串行左移输入
			{Number: 8, Name: "GND", Direction: types.PinGnd, Index: -1},
			{Number: 9, Name: "S0", Direction: types.PinInput, Index: 7},     // 模式选择
			{Number: 10, Name: "S1", Direction: types.PinInput, Index: 8},    // 模式选择
			{Number: 11, Name: "CLK", Direction: types.PinInput, Index: 9},   // 时钟
			{Number: 12, Name: "QD", Direction: types.PinOutput, Index: 3},
			{Number: 13, Name: "QC", Direction: types.PinOutput, Index: 2},
			{Number: 14, Name: "QB", Direction: types.PinOutput, Index: 1},
			{Number: 15, Name: "QA", Direction: types.PinOutput, Index: 0},
			{Number: 16, Name: "VCC", Direction: types.PinPower, Index: -1},
		},
		TruthTables: []types.TruthTable{
			{
				Inputs:  []string{"CLR", "S1", "S0", "CLK"},
				Outputs: []string{"QA", "QB", "QC", "QD"},
				Rows: [][]string{
					{"0", "X", "X", "X", "0", "0", "0", "0"},    // 清除
					{"1", "0", "0", "↑", "Qa0", "Qb0", "Qc0", "Qd0"}, // 保持
					{"1", "0", "1", "↑", "SR", "Qa0", "Qb0", "Qc0"},  // 右移
					{"1", "1", "0", "↑", "Qb0", "Qc0", "Qd0", "SL"},  // 左移
					{"1", "1", "1", "↑", "A", "B", "C", "D"},        // 并行置数
				},
			},
		},
	}
}

// ==================== 74164 8位移位寄存器 ====================

func register74164() {
	ChipRegistry["74164"] = &types.ChipDefinition{
		PartNumber:         "74164",
		Name:               "8位移位寄存器",
		Description:        "8-Bit Serial-In Parallel-Out Shift Register",
		Package:            "DIP-14",
		PropagationDelayNs: 20,
		FanOut:             10,
		Pins: []types.ChipPin{
			{Number: 1, Name: "A", Direction: types.PinInput, Index: 0},     // 串行输入A
			{Number: 2, Name: "B", Direction: types.PinInput, Index: 1},     // 串行输入B
			{Number: 3, Name: "QA", Direction: types.PinOutput, Index: 0},
			{Number: 4, Name: "QB", Direction: types.PinOutput, Index: 1},
			{Number: 5, Name: "QC", Direction: types.PinOutput, Index: 2},
			{Number: 6, Name: "QD", Direction: types.PinOutput, Index: 3},
			{Number: 7, Name: "GND", Direction: types.PinGnd, Index: -1},
			{Number: 8, Name: "CLK", Direction: types.PinInput, Index: 2},   // 时钟
			{Number: 9, Name: "CLR", Direction: types.PinInput, Index: 3},   // 清除（低有效）
			{Number: 10, Name: "QE", Direction: types.PinOutput, Index: 4},
			{Number: 11, Name: "QF", Direction: types.PinOutput, Index: 5},
			{Number: 12, Name: "QG", Direction: types.PinOutput, Index: 6},
			{Number: 13, Name: "QH", Direction: types.PinOutput, Index: 7},
			{Number: 14, Name: "VCC", Direction: types.PinPower, Index: -1},
		},
		TruthTables: []types.TruthTable{
			{
				Inputs:  []string{"CLR", "CLK", "A", "B"},
				Outputs: []string{"QA", "QB", "...", "QH"},
				Rows: [][]string{
					{"0", "X", "X", "X", "0", "0", "...", "0"},    // 清除
					{"1", "↑", "1", "1", "1", "Qa0", "...", "Qg0"}, // 移入1
					{"1", "↑", "0", "X", "0", "Qa0", "...", "Qg0"}, // 移入0
					{"1", "↑", "X", "0", "0", "Qa0", "...", "Qg0"}, // 移入0
				},
			},
		},
	}
}

// ==================== 逻辑计算函数 ====================

// EvalNAND 与非门计算
func EvalNAND(a, b types.LogicValue) types.LogicValue {
	if a == types.LogicUnknown || b == types.LogicUnknown {
		return types.LogicUnknown
	}
	if a == types.LogicHiZ || b == types.LogicHiZ {
		return types.LogicUnknown
	}
	if a.IsHigh() && b.IsHigh() {
		return types.LogicLow
	}
	return types.LogicHigh
}

// EvalNOR 或非门计算
func EvalNOR(a, b types.LogicValue) types.LogicValue {
	if a == types.LogicUnknown || b == types.LogicUnknown {
		return types.LogicUnknown
	}
	if a == types.LogicHiZ || b == types.LogicHiZ {
		return types.LogicUnknown
	}
	if a.IsLow() && b.IsLow() {
		return types.LogicHigh
	}
	return types.LogicLow
}

// EvalNOT 反相器计算
func EvalNOT(a types.LogicValue) types.LogicValue {
	if a == types.LogicUnknown || a == types.LogicHiZ {
		return types.LogicUnknown
	}
	if a.IsHigh() {
		return types.LogicLow
	}
	return types.LogicHigh
}

// EvalAND 与门计算
func EvalAND(a, b types.LogicValue) types.LogicValue {
	if a == types.LogicUnknown || b == types.LogicUnknown {
		return types.LogicUnknown
	}
	if a == types.LogicHiZ || b == types.LogicHiZ {
		return types.LogicUnknown
	}
	if a.IsHigh() && b.IsHigh() {
		return types.LogicHigh
	}
	return types.LogicLow
}

// EvalOR 或门计算
func EvalOR(a, b types.LogicValue) types.LogicValue {
	if a == types.LogicUnknown || b == types.LogicUnknown {
		return types.LogicUnknown
	}
	if a == types.LogicHiZ || b == types.LogicHiZ {
		return types.LogicUnknown
	}
	if a.IsHigh() || b.IsHigh() {
		return types.LogicHigh
	}
	return types.LogicLow
}

// EvalXOR 异或门计算
func EvalXOR(a, b types.LogicValue) types.LogicValue {
	if a == types.LogicUnknown || b == types.LogicUnknown {
		return types.LogicUnknown
	}
	if a == types.LogicHiZ || b == types.LogicHiZ {
		return types.LogicUnknown
	}
	if a != b {
		return types.LogicHigh
	}
	return types.LogicLow
}

// LogicValueFromString 从字符串解析逻辑值
func LogicValueFromString(s string) types.LogicValue {
	switch s {
	case "0", "L", "l":
		return types.LogicLow
	case "1", "H", "h":
		return types.LogicHigh
	case "X", "x":
		return types.LogicUnknown
	case "Z", "z":
		return types.LogicHiZ
	default:
		return types.LogicUnknown
	}
}
