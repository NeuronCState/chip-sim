package spice

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"chip-sim/pkg/types"
)

// ParseResult SPICE 解析结果
type ParseResult struct {
	Project    *types.CircuitProject // 电路工程
	Title      string                // 网表标题行
	Models     map[string]ModelDef   // 模型定义
	Subcircuits map[string]SubcircuitDef // 子电路定义
	Commands   []string              // 控制命令（.OP/.DC/.AC/.TRAN 等）
	Warnings   []string              // 警告信息
}

// ModelDef SPICE 模型定义
type ModelDef struct {
	Name    string
	Type    string            // MODEL TYPE (RES, CAP, D, NPN, PMOS, etc.)
	Params  map[string]string // 参数名 → 参数值
}

// Parser SPICE 网表解析器
type Parser struct {
	warnings []string
}

// NewParser 创建新的解析器
func NewParser() *Parser {
	return &Parser{}
}

// Parse 解析 SPICE 网表内容
func (p *Parser) Parse(r io.Reader) (*ParseResult, error) {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 0, 1024*1024), 1024*1024) // 1MB max line

	return p.parseFromScanner(scanner)
}

// ParseBytes 从字节切片解析 SPICE 网表
func (p *Parser) ParseBytes(data []byte) (*ParseResult, error) {
	return p.Parse(bytes.NewReader(data))
}

// parseFromScanner 核心解析逻辑
func (p *Parser) parseFromScanner(scanner *bufio.Scanner) (*ParseResult, error) {

	// 预处理：合并续行（+ 开头的行合并到上一行）
	var lines []string
	for scanner.Scan() {
		line := strings.TrimRight(scanner.Text(), " \t\r")
		if len(line) > 0 && line[0] == '+' && len(lines) > 0 {
			// 续行：去掉 + 后合并到上一行
			lines[len(lines)-1] = lines[len(lines)-1] + " " + strings.TrimLeft(line[1:], " \t")
		} else {
			lines = append(lines, line)
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("read error: %w", err)
	}

	if len(lines) == 0 {
		return nil, fmt.Errorf("empty netlist")
	}

	result := &ParseResult{
		Project: &types.CircuitProject{
			ID:               "",
			Name:             "",
			CreatedAt:        time.Now(),
			UpdatedAt:        time.Now(),
			Components:       make([]types.Component, 0),
			Nodes:            make([]types.CircuitNode, 0),
			Wires:            make([]types.Wire, 0),
			SimulationConfig: types.SimulationConfig{},
		},
		Models:      make(map[string]ModelDef),
		Subcircuits: make(map[string]SubcircuitDef),
		Commands:    make([]string, 0),
		Warnings:    make([]string, 0),
	}

	nodeMap := NewSpiceNodeMap()
	componentID := 0

	// 第一行是标题（SPICE 规范）
	result.Title = lines[0]

	// 解析后续行
	for i := 1; i < len(lines); i++ {
		line := strings.TrimSpace(lines[i])

		// 跳过空行和注释
		if len(line) == 0 || line[0] == '*' {
			continue
		}

		// 跳过 .END
		upper := strings.ToUpper(line)
		if upper == ".END" {
			break
		}

		// 控制命令
		if line[0] == '.' {
			upperCmd := strings.ToUpper(strings.Fields(line)[0])
			// .SUBCKT 需要特殊处理（捕获子电路体）
			if upperCmd == CmdSubckt {
				endIdx, err := p.parseSubcircuitDef(lines, i, result)
				if err != nil {
					result.Warnings = append(result.Warnings,
						fmt.Sprintf("line %d: %v", i+1, err))
				}
				i = endIdx // 跳到 .ENDS
				continue
			}
			// .ENDS 跳过（已被 .SUBCKT 处理）
			if upperCmd == CmdEndSubckt {
				continue
			}
			p.parseCommand(line, result, nodeMap)
			continue
		}

		// 元件定义
		if err := p.parseComponent(line, result, nodeMap, &componentID); err != nil {
			result.Warnings = append(result.Warnings,
				fmt.Sprintf("line %d: %v", i+1, err))
		}
	}

	// 从 nodeMap 构建节点列表
	p.buildNodes(result, nodeMap)

	return result, nil
}

// parseComponent 解析元件行
func (p *Parser) parseComponent(line string, result *ParseResult, nodeMap *SpiceNodeMap, componentID *int) error {
	fields := splitSpiceFields(line)
	if len(fields) < 2 {
		return fmt.Errorf("too few fields: %s", line)
	}

	name := fields[0]
	if len(name) == 0 {
		return fmt.Errorf("empty component name")
	}

	prefix := name[0]
	prefixUpper := strings.ToUpper(string(prefix))

	// 跳过未知前缀
	if prefixUpper == "X" {
		// 子电路实例 — 解析为子电路组件
		return p.parseSubcircuitInstance(fields, result, nodeMap, componentID, line)
	}

	compType, ok := SpiceToComponentMap[prefix]
	if !ok {
		return fmt.Errorf("unsupported component prefix '%c' in '%s'", prefix, name)
	}

	*componentID++
	comp := types.Component{
		ID:       fmt.Sprintf("comp_%d", *componentID),
		Type:     compType,
		Name:     name,
		Position: types.Point{X: float64(*componentID) * 120, Y: 200},
		Rotation: 0,
		Value:    types.ComponentValue{},
		Params:   make(map[string]any),
	}

	switch prefix {
	case 'R', 'C', 'L':
		// R1 n1 n2 value
		if len(fields) < 4 {
			return fmt.Errorf("R/C/L requires 4 fields: %s", line)
		}
		nPlus := nodeMap.GetID(fields[1])
		nMinus := nodeMap.GetID(fields[2])
		val, unit, prefix2 := parseSpiceValue(fields[3])
		comp.Value = types.ComponentValue{Value: val, Unit: unit, Prefix: prefix2}
		comp.Ports = buildTwoPorts(nPlus, nMinus)

	case 'V', 'I':
		// V1 n+ n- DC 5V 或 V1 n+ n- SIN(0 5 1k)
		if len(fields) < 4 {
			return fmt.Errorf("V/I source requires >= 4 fields: %s", line)
		}
		nPlus := nodeMap.GetID(fields[1])
		nMinus := nodeMap.GetID(fields[2])
		comp.Ports = buildTwoPorts(nPlus, nMinus)

		// 解析源类型和参数
		srcType := "dc"
		if len(fields) > 4 {
			upper := strings.ToUpper(fields[3])
			if upper == "DC" || upper == "AC" || upper == "SIN" || upper == "PULSE" || upper == "PWL" {
				srcType = strings.ToLower(upper)
			}
		}

		val, unit, prefix2 := parseSpiceValue(fields[len(fields)-1])
		comp.Value = types.ComponentValue{Value: val, Unit: unit, Prefix: prefix2}
		comp.Params["sourceType"] = srcType

		if prefix == 'I' {
			// 电流源需要特殊类型
			comp.Type = types.ComponentCurrentSource
		}

	case 'D':
		// D1 n+ n- modelname
		if len(fields) < 4 {
			return fmt.Errorf("diode requires >= 4 fields: %s", line)
		}
		nPlus := nodeMap.GetID(fields[1])
		nMinus := nodeMap.GetID(fields[2])
		comp.Ports = buildTwoPorts(nPlus, nMinus)
		if len(fields) > 3 {
			comp.Params["modelName"] = fields[3]
		}

	case 'Q':
		// Q1 nc nb ne model [area]
		if len(fields) < 5 {
			return fmt.Errorf("BJT requires >= 5 fields: %s", line)
		}
		nc := nodeMap.GetID(fields[1])
		nb := nodeMap.GetID(fields[2])
		ne := nodeMap.GetID(fields[3])
		comp.Ports = buildThreePorts(nc, nb, ne)
		comp.Params["modelName"] = fields[4]
		// 根据模型名称推断 NPN/PNP
		comp.Type = inferBJTTypeFromModel(fields[4])

	case 'M':
		// M1 nd ng ns nb model [params...]
		if len(fields) < 6 {
			return fmt.Errorf("MOSFET requires >= 6 fields: %s", line)
		}
		nd := nodeMap.GetID(fields[1])
		ng := nodeMap.GetID(fields[2])
		ns := nodeMap.GetID(fields[3])
		nb := nodeMap.GetID(fields[4])
		comp.Ports = buildFourPorts(nd, ng, ns, nb)
		comp.Params["modelName"] = fields[5]
		// 根据模型名称推断 NMOS/PMOS
		comp.Type = inferMOSFETTypeFromModel(fields[5])

	default:
		return fmt.Errorf("unsupported component: %s", name)
	}

	result.Project.Components = append(result.Project.Components, comp)
	return nil
}

// parseCommand 解析控制命令
func (p *Parser) parseCommand(line string, result *ParseResult, nodeMap *SpiceNodeMap) {
	fields := splitSpiceFields(line)
	if len(fields) == 0 {
		return
	}

	cmd := strings.ToUpper(fields[0])

	switch cmd {
	case CmdDC:
		result.Commands = append(result.Commands, line)
		if len(fields) >= 5 {
			// .DC src start stop step
			result.Project.SimulationConfig.Analysis.Type = types.AnalysisDC
			result.Project.SimulationConfig.Analysis.SweepSource = fields[1]
			result.Project.SimulationConfig.Analysis.SweepStart, _ = strconv.ParseFloat(fields[2], 64)
			result.Project.SimulationConfig.Analysis.SweepStop, _ = strconv.ParseFloat(fields[3], 64)
			result.Project.SimulationConfig.Analysis.SweepStep, _ = strconv.ParseFloat(fields[4], 64)
			result.Project.SimulationConfig.Enabled = true
		}

	case CmdAC:
		result.Commands = append(result.Commands, line)
		if len(fields) >= 4 {
			// .AC DEC/lin/OCT np fstart fstop
			result.Project.SimulationConfig.Analysis.Type = types.AnalysisAC
			mode := strings.ToLower(fields[1])
			if mode == "dec" {
				result.Project.SimulationConfig.Analysis.SweepMode = types.SweepLog
			} else {
				result.Project.SimulationConfig.Analysis.SweepMode = types.SweepLinear
			}
			n, _ := strconv.Atoi(fields[2])
			result.Project.SimulationConfig.Analysis.PointsPerDecade = n
			result.Project.SimulationConfig.Analysis.NumPoints = n
			result.Project.SimulationConfig.Analysis.StartFreq, _ = strconv.ParseFloat(fields[3], 64)
			if len(fields) > 4 {
				result.Project.SimulationConfig.Analysis.StopFreq, _ = strconv.ParseFloat(fields[4], 64)
			}
			result.Project.SimulationConfig.Enabled = true
		}

	case CmdTran:
		result.Commands = append(result.Commands, line)
		if len(fields) >= 3 {
			// .TRAN tstep tstop [tstart [tmax]] [UIC]
			result.Project.SimulationConfig.Analysis.Type = types.AnalysisTransient
			stepVal, _, _ := parseSpiceValue(fields[1])
			result.Project.SimulationConfig.Analysis.StepTime = stepVal
			stopVal, _, _ := parseSpiceValue(fields[2])
			result.Project.SimulationConfig.Analysis.StopTime = stopVal
			if len(fields) > 3 {
				maxStepVal, _, _ := parseSpiceValue(fields[3])
				result.Project.SimulationConfig.Analysis.MaxStep = maxStepVal
			}
			result.Project.SimulationConfig.Enabled = true
		}

	case CmdOp:
		result.Commands = append(result.Commands, line)
		result.Project.SimulationConfig.Analysis.Type = types.AnalysisDC
		result.Project.SimulationConfig.Enabled = true

	case CmdModel:
		// .MODEL mname TYPE (params...)
		if len(fields) >= 3 {
			modelType := strings.ToUpper(fields[2])
			// 处理 TYPE( 没有空格的情况，如 "D(Is=...)"
			if idx := strings.Index(modelType, "("); idx > 0 {
				modelType = modelType[:idx]
			}
			model := ModelDef{
				Name:   fields[1],
				Type:   modelType,
				Params: make(map[string]string),
			}
			// 解析括号内的参数
			parenStart := strings.Index(line, "(")
			parenEnd := strings.LastIndex(line, ")")
			if parenStart >= 0 && parenEnd > parenStart {
				paramStr := line[parenStart+1 : parenEnd]
				params := splitSpiceFields(paramStr)
				for _, param := range params {
					kv := strings.SplitN(param, "=", 2)
					if len(kv) == 2 {
						model.Params[strings.ToUpper(kv[0])] = kv[1]
					}
				}
			}
			result.Models[model.Name] = model
		}

	case CmdSubckt:
		// .SUBCKT 已在主循环中处理，这里跳过
		// 兼容：如果主循环未处理（不应发生），简单记录
		result.Commands = append(result.Commands, line)

	case CmdOptions, CmdParam, CmdGlobal:
		result.Commands = append(result.Commands, line)

	case CmdIC:
		// .IC V(node1)=5 V(node2)=3.3
		result.Commands = append(result.Commands, line)
		p.parseIC(fields, result)

	default:
		// 未知命令，记录 warning
		result.Warnings = append(result.Warnings,
			fmt.Sprintf("unknown command: %s", fields[0]))
	}
}

// buildNodes 从 nodeMap 构建节点列表
func (p *Parser) buildNodes(result *ParseResult, nodeMap *SpiceNodeMap) {
	seen := make(map[string]bool)
	for spiceName, nodeID := range nodeMap.AllNodes() {
		if seen[nodeID] {
			continue
		}
		seen[nodeID] = true

		nodeType := types.NodeNormal
		if nodeID == "node_gnd" {
			nodeType = types.NodeGround
		}

		result.Project.Nodes = append(result.Project.Nodes, types.CircuitNode{
			ID:       nodeID,
			Name:     spiceName,
			Type:     nodeType,
			Position: types.Point{X: 0, Y: float64(len(result.Project.Nodes)) * 50},
		})
	}
}

// ==================== 辅助函数 ====================

// splitSpiceFields 按空白分隔 SPICE 字段，忽略注释
func splitSpiceFields(line string) []string {
	// 去掉行内注释（$ 或 ;）
	if idx := strings.IndexAny(line, "$;"); idx >= 0 {
		line = line[:idx]
	}
	fields := strings.Fields(line)
	return fields
}

// parseSpiceValue 解析 SPICE 值字符串，如 "10k", "1u", "4.7n"
func parseSpiceValue(s string) (float64, string, string) {
	s = strings.TrimSpace(s)
	if len(s) == 0 {
		return 0, "", ""
	}

	// 去掉可能的单位后缀（如 "V", "A", "Ohm", "F", "H"）
	unitSuffixes := []string{"V", "A", "OHM", "F", "H", "v", "a", "ohm", "f", "h"}
	unit := ""
	clean := s
	for _, suffix := range unitSuffixes {
		if strings.HasSuffix(clean, suffix) {
			clean = strings.TrimSuffix(clean, suffix)
			unit = suffix
			break
		}
	}

	// 处理 MEG（兆）
	upper := strings.ToUpper(clean)
	if strings.HasSuffix(upper, "MEG") {
		numStr := clean[:len(clean)-3]
		val, err := strconv.ParseFloat(numStr, 64)
		if err != nil {
			return 0, unit, ""
		}
		return val * 1e6, unit, "MEG"
	}

	// 处理标准后缀
	if len(clean) > 0 {
		last := clean[len(clean)-1]
		if mult, ok := SpiceUnitMap[last]; ok {
			numStr := clean[:len(clean)-1]
			val, err := strconv.ParseFloat(numStr, 64)
			if err != nil {
				return 0, unit, ""
			}
			return val * mult, unit, string(last)
		}
	}

	val, err := strconv.ParseFloat(clean, 64)
	if err != nil {
		return 0, unit, ""
	}
	return val, unit, ""
}

func buildTwoPorts(nPlus, nMinus string) []types.ComponentPort {
	return []types.ComponentPort{
		{ID: "p1", Offset: types.Point{X: -30, Y: 0}, NodeID: nPlus},
		{ID: "p2", Offset: types.Point{X: 30, Y: 0}, NodeID: nMinus},
	}
}

func buildThreePorts(n1, n2, n3 string) []types.ComponentPort {
	return []types.ComponentPort{
		{ID: "collector", Offset: types.Point{X: 0, Y: -30}, NodeID: n1},
		{ID: "base", Offset: types.Point{X: -30, Y: 0}, NodeID: n2},
		{ID: "emitter", Offset: types.Point{X: 0, Y: 30}, NodeID: n3},
	}
}

func buildFourPorts(n1, n2, n3, n4 string) []types.ComponentPort {
	return []types.ComponentPort{
		{ID: "drain", Offset: types.Point{X: 0, Y: -30}, NodeID: n1},
		{ID: "gate", Offset: types.Point{X: -30, Y: 0}, NodeID: n2},
		{ID: "source", Offset: types.Point{X: 0, Y: 30}, NodeID: n3},
		{ID: "bulk", Offset: types.Point{X: 30, Y: 0}, NodeID: n4},
	}
}

// ==================== 新增解析方法 ====================

// parseSubcircuitInstance 解析 X 子电路实例化行
// 格式: Xname node1 node2 ... subcircuit_name [params]
// 格式: Xname node1 node2 ... subcircuit_name param=value ...
func (p *Parser) parseSubcircuitInstance(fields []string, result *ParseResult, nodeMap *SpiceNodeMap, componentID *int, line string) error {
	if len(fields) < 3 {
		return fmt.Errorf("X instance requires >= 3 fields: %s", line)
	}

	name := fields[0]
	// 最后一个非 param=value 字段是子电路名称
	subcktName := ""
	var nodeFields []string

	// 从后往前找 subcircuit name
	for i := len(fields) - 1; i >= 1; i-- {
		if !strings.Contains(fields[i], "=") {
			subcktName = fields[i]
			nodeFields = fields[1:i]
			break
		}
	}
	if subcktName == "" {
		return fmt.Errorf("cannot determine subcircuit name for: %s", line)
	}

	// 根据子电路名称推断元件类型
	compType := p.inferComponentTypeFromSubcircuit(subcktName)

	*componentID++
	comp := types.Component{
		ID:       fmt.Sprintf("comp_%d", *componentID),
		Type:     compType,
		Name:     name,
		Position: types.Point{X: float64(*componentID) * 120, Y: 200},
		Rotation: 0,
		Value:    types.ComponentValue{},
		Params:   map[string]any{"subcircuitName": subcktName},
	}

	// 构建端口
	ports := make([]types.ComponentPort, len(nodeFields))
	for i, n := range nodeFields {
		nodeID := nodeMap.GetID(n)
		ports[i] = types.ComponentPort{
			ID:     fmt.Sprintf("p%d", i+1),
			Offset: types.Point{X: float64(i*30 - len(nodeFields)*15), Y: 0},
			NodeID: nodeID,
		}
	}
	comp.Ports = ports

	// 解析 param=value 参数
	for _, f := range fields {
		if strings.Contains(f, "=") {
			kv := strings.SplitN(f, "=", 2)
			if len(kv) == 2 {
				comp.Params[kv[0]] = kv[1]
			}
		}
	}

	result.Project.Components = append(result.Project.Components, comp)
	return nil
}

// inferComponentTypeFromSubcircuit 根据子电路名称推断 chip-sim 元件类型
func (p *Parser) inferComponentTypeFromSubcircuit(subcktName string) types.ComponentType {
	upper := strings.ToUpper(subcktName)
	switch {
	case strings.Contains(upper, "OPAMP") || strings.Contains(upper, "OPA"):
		return types.ComponentOpAmp
	case strings.Contains(upper, "7400") || strings.Contains(upper, "TTL7400"):
		return types.Component7400
	case strings.Contains(upper, "7402") || strings.Contains(upper, "TTL7402"):
		return types.Component7402
	case strings.Contains(upper, "7404") || strings.Contains(upper, "TTL7404"):
		return types.Component7404
	case strings.Contains(upper, "7408") || strings.Contains(upper, "TTL7408"):
		return types.Component7408
	case strings.Contains(upper, "7432") || strings.Contains(upper, "TTL7432"):
		return types.Component7432
	case strings.Contains(upper, "7486") || strings.Contains(upper, "TTL7486"):
		return types.Component7486
	case strings.Contains(upper, "7474") || strings.Contains(upper, "TTL7474"):
		return types.Component7474
	case strings.Contains(upper, "7490") || strings.Contains(upper, "TTL7490"):
		return types.Component7490
	default:
		return types.ComponentOpAmp // 默认作为运放/子电路
	}
}

// inferBJTTypeFromModel 根据模型名称推断 BJT 类型
func inferBJTTypeFromModel(modelName string) types.ComponentType {
	upper := strings.ToUpper(modelName)
	if strings.Contains(upper, "PNP") {
		return types.ComponentBJTPNP
	}
	// 常见 PNP 型号
	pnpModels := []string{"2N2907", "2N3906", "BC557", "BC327", "A1015"}
	for _, m := range pnpModels {
		if strings.Contains(upper, m) {
			return types.ComponentBJTPNP
		}
	}
	return types.ComponentBJTNPN
}

// inferMOSFETTypeFromModel 根据模型名称推断 MOSFET 类型
func inferMOSFETTypeFromModel(modelName string) types.ComponentType {
	upper := strings.ToUpper(modelName)
	if strings.Contains(upper, "PMOS") || strings.Contains(upper, "BS250") || strings.Contains(upper, "IRF9") {
		return types.ComponentMOSFETPMOS
	}
	return types.ComponentMOSFETNMOS
}

// parseSubcircuitDef 解析 .SUBCKT 定义（支持捕获子电路体）
func (p *Parser) parseSubcircuitDef(lines []string, startIdx int, result *ParseResult) (int, error) {
	line := lines[startIdx]
	fields := splitSpiceFields(line)
	if len(fields) < 2 {
		return startIdx, fmt.Errorf("invalid .SUBCKT: %s", line)
	}

	sub := SubcircuitDef{
		Name:  fields[1],
		Ports: make([]string, 0),
		Body:  make([]string, 0),
	}

	// 解析端口和参数
	for _, f := range fields[2:] {
		if strings.Contains(f, "=") {
			sub.Params = append(sub.Params, f)
		} else {
			sub.Ports = append(sub.Ports, f)
		}
	}

	// 捕获子电路体直到 .ENDS
	i := startIdx + 1
	for i < len(lines) {
		bodyLine := strings.TrimSpace(lines[i])
		upper := strings.ToUpper(bodyLine)

		if strings.HasPrefix(upper, ".ENDS") {
			break
		}
		if len(bodyLine) > 0 && bodyLine[0] != '*' {
			sub.Body = append(sub.Body, bodyLine)
		}
		i++
	}

	result.Subcircuits[sub.Name] = sub
	return i, nil // 返回 .ENDS 的索引
}

// parseIC 解析 .IC 初始条件
func (p *Parser) parseIC(fields []string, result *ParseResult) {
	// .IC V(node1)=5 V(node2)=3.3
	for _, f := range fields[1:] {
		if strings.Contains(f, "=") {
			kv := strings.SplitN(f, "=", 2)
			nodeExpr := kv[0] // V(node1)
			valStr := kv[1]

			// 提取节点名
			if strings.HasPrefix(nodeExpr, "V(") && strings.HasSuffix(nodeExpr, ")") {
				nodeName := nodeExpr[2 : len(nodeExpr)-1]
				val, err := strconv.ParseFloat(valStr, 64)
				if err == nil {
					if result.Project.SimulationConfig.Analysis.InitialVoltages == nil {
						result.Project.SimulationConfig.Analysis.InitialVoltages = make(map[string]float64)
					}
					result.Project.SimulationConfig.Analysis.InitialVoltages[nodeName] = val
				}
			}
		}
	}
}
