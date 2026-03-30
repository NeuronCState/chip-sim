package spice

import (
	"fmt"
	"strings"

	"chip-sim/pkg/types"
)

// Exporter SPICE 网表导出器
type Exporter struct {
	nodeMap  *SpiceNodeMap
	models   []string // 收集需要导出的 .model 语句
	subckts  []string // 收集需要导出的 .subckt 定义
}

// NewExporter 创建新的导出器
func NewExporter() *Exporter {
	return &Exporter{
		nodeMap: NewSpiceNodeMap(),
	}
}

// Export 将 CircuitProject 导出为 SPICE 网表字符串
func (e *Exporter) Export(project *types.CircuitProject) string {
	var sb strings.Builder

	// 标题行（转义中文）
	title := escapeSpiceName(project.Name)
	if title == "" {
		title = "Chip-Sim-Exported-Circuit"
	}
	sb.WriteString(title)
	sb.WriteString("\n")

	// 构建节点映射
	e.buildNodeMapping(project)

	// 元件行（同时收集模型和子电路引用）
	for _, comp := range project.Components {
		line := e.exportComponent(&comp)
		if line != "" {
			sb.WriteString(line)
			sb.WriteString("\n")
		}
	}

	// 空行
	sb.WriteString("\n")

	// 模型定义（在元件之后、控制命令之前）
	for _, model := range e.models {
		sb.WriteString(model)
		sb.WriteString("\n")
	}
	if len(e.models) > 0 {
		sb.WriteString("\n")
	}

	// 子电路定义
	for _, subckt := range e.subckts {
		sb.WriteString(subckt)
		sb.WriteString("\n")
	}
	if len(e.subckts) > 0 {
		sb.WriteString("\n")
	}

	// 控制命令（根据仿真配置）
	cmdLines := e.exportAnalysisCommand(project)
	for _, cl := range cmdLines {
		sb.WriteString(cl)
		sb.WriteString("\n")
	}

	// .END
	sb.WriteString(".END\n")

	return sb.String()
}

// buildNodeMapping 构建 chip-sim 节点到 SPICE 节点名的映射
func (e *Exporter) buildNodeMapping(project *types.CircuitProject) {
	// 反向映射
	for _, node := range project.Nodes {
		spiceName := node.Name
		if spiceName == "" {
			spiceName = node.ID
		}
		if node.Type == types.NodeGround {
			spiceName = "0"
		}
		e.nodeMap.Map(spiceName, node.ID)
	}
}

// exportComponent 导出单个元件为 SPICE 行
func (e *Exporter) exportComponent(comp *types.Component) string {
	prefix, ok := ComponentToSpiceMap[comp.Type]
	if !ok {
		// 不支持的类型跳过
		return fmt.Sprintf("* Unsupported component: %s (type=%s)", comp.Name, comp.Type)
	}

	name := comp.Name
	if name == "" {
		name = prefix + strings.TrimPrefix(comp.ID, "comp_")
	}
	name = escapeSpiceName(name) // 转义中文和特殊字符

	ports := comp.Ports
	nodes := e.getNodeNames(ports)

	switch comp.Type {
	case types.ComponentResistor:
		if len(nodes) < 2 {
			return fmt.Sprintf("* Incomplete resistor: %s", name)
		}
		val := formatSpiceValue(comp.Value)
		return fmt.Sprintf("%s %s %s %s", name, nodes[0], nodes[1], val)

	case types.ComponentCapacitor:
		if len(nodes) < 2 {
			return fmt.Sprintf("* Incomplete capacitor: %s", name)
		}
		val := formatSpiceValue(comp.Value)
		return fmt.Sprintf("%s %s %s %s", name, nodes[0], nodes[1], val)

	case types.ComponentInductor:
		if len(nodes) < 2 {
			return fmt.Sprintf("* Incomplete inductor: %s", name)
		}
		val := formatSpiceValue(comp.Value)
		return fmt.Sprintf("%s %s %s %s", name, nodes[0], nodes[1], val)

	case types.ComponentDiode:
		if len(nodes) < 2 {
			return fmt.Sprintf("* Incomplete diode: %s", name)
		}
		model := "D1N4148"
		if m, ok := comp.Params["modelName"].(string); ok && m != "" {
			model = m
		}
		e.addDiodeModel(model, comp.Params)
		return fmt.Sprintf("%s %s %s %s", escapeSpiceName(name), nodes[0], nodes[1], model)

	case types.ComponentBJTNPN, types.ComponentBJTPNP:
		if len(nodes) < 3 {
			return fmt.Sprintf("* Incomplete BJT: %s", name)
		}
		model := "2N2222"
		if comp.Type == types.ComponentBJTPNP {
			model = "2N2907"
		}
		if m, ok := comp.Params["modelName"].(string); ok && m != "" {
			model = m
		}
		e.addBJTModel(model, comp.Type, comp.Params)
		return fmt.Sprintf("%s %s %s %s %s", escapeSpiceName(name), nodes[0], nodes[1], nodes[2], model)

	case types.ComponentMOSFETNMOS, types.ComponentMOSFETPMOS:
		if len(nodes) < 4 {
			return fmt.Sprintf("* Incomplete MOSFET: %s", name)
		}
		model := "2N7000"
		if comp.Type == types.ComponentMOSFETPMOS {
			model = "BS250"
		}
		if m, ok := comp.Params["modelName"].(string); ok && m != "" {
			model = m
		}
		e.addMOSFETModel(model, comp.Type, comp.Params)
		return fmt.Sprintf("%s %s %s %s %s %s", escapeSpiceName(name), nodes[0], nodes[1], nodes[2], nodes[3], model)

	case types.ComponentOpAmp:
		return e.exportOpAmp(comp, nodes)

	// 74 系列 IC
	case types.Component7400, types.Component7402, types.Component7404,
		types.Component7408, types.Component7432, types.Component7486,
		types.Component7474, types.Component7473, types.Component74373,
		types.Component7490, types.Component74194, types.Component74164:
		return e.exportChip74(comp, nodes)

	case types.ComponentVoltageSource, types.ComponentDCSource, types.ComponentACSource:
		if len(nodes) < 2 {
			return fmt.Sprintf("* Incomplete voltage source: %s", name)
		}
		srcType := "DC"
		if st, ok := comp.Params["sourceType"].(string); ok {
			srcType = strings.ToUpper(st)
		}
		val := formatSpiceValue(comp.Value)
		if srcType == "AC" {
			return fmt.Sprintf("%s %s %s AC %s", name, nodes[0], nodes[1], val)
		}
		return fmt.Sprintf("%s %s %s DC %s", name, nodes[0], nodes[1], val)

	case types.ComponentCurrentSource:
		if len(nodes) < 2 {
			return fmt.Sprintf("* Incomplete current source: %s", name)
		}
		val := formatSpiceValue(comp.Value)
		return fmt.Sprintf("%s %s %s DC %s", name, nodes[0], nodes[1], val)

	default:
		return fmt.Sprintf("* Unsupported: %s", name)
	}
}

// exportAnalysisCommand 导出仿真分析命令
func (e *Exporter) exportAnalysisCommand(project *types.CircuitProject) []string {
	var cmds []string
	cfg := project.SimulationConfig.Analysis

	switch cfg.Type {
	case types.AnalysisDC:
		if cfg.SweepSource != "" {
			cmds = append(cmds, fmt.Sprintf(".DC %s %g %g %g",
				cfg.SweepSource, cfg.SweepStart, cfg.SweepStop, cfg.SweepStep))
		} else {
			cmds = append(cmds, ".OP")
		}

	case types.AnalysisAC:
		mode := "DEC"
		if cfg.SweepMode == types.SweepLinear {
			mode = "LIN"
		}
		n := cfg.PointsPerDecade
		if n == 0 {
			n = cfg.NumPoints
		}
		if n == 0 {
			n = 10
		}
		cmds = append(cmds, fmt.Sprintf(".AC %s %d %g %g",
			mode, n, cfg.StartFreq, cfg.StopFreq))

	case types.AnalysisTransient:
		step := cfg.StepTime
		stop := cfg.StopTime
		maxStep := cfg.MaxStep
		if maxStep > 0 {
			cmds = append(cmds, fmt.Sprintf(".TRAN %g %g %g", step, stop, maxStep))
		} else {
			cmds = append(cmds, fmt.Sprintf(".TRAN %g %g", step, stop))
		}
	}

	return cmds
}

// getNodeNames 获取端口对应的 SPICE 节点名称
func (e *Exporter) getNodeNames(ports []types.ComponentPort) []string {
	names := make([]string, len(ports))
	for i, port := range ports {
		names[i] = e.nodeMap.GetSpiceName(port.NodeID)
		if names[i] == "" {
			names[i] = port.NodeID
		}
	}
	return names
}

// formatSpiceValue 将 ComponentValue 格式化为 SPICE 值字符串
func formatSpiceValue(v types.ComponentValue) string {
	if v.Value == 0 {
		return "0"
	}
	prefix := v.Prefix
	if prefix == "" {
		prefix = choosePrefix(v.Value)
	}
	numStr := formatFloat(v.Value / prefixMultiplier(prefix))
	return numStr + prefix
}

// choosePrefix 自动选择合适的 SI 前缀
func choosePrefix(val float64) string {
	abs := val
	if abs < 0 {
		abs = -abs
	}
	switch {
	case abs >= 1e12:
		return "T"
	case abs >= 1e9:
		return "G"
	case abs >= 1e6:
		return "MEG"
	case abs >= 1e3:
		return "k"
	case abs >= 1:
		return ""
	case abs >= 1e-3:
		return "m"
	case abs >= 1e-6:
		return "u"
	case abs >= 1e-9:
		return "n"
	case abs >= 1e-12:
		return "p"
	default:
		return "f"
	}
}

func prefixMultiplier(p string) float64 {
	switch p {
	case "T":
		return 1e12
	case "G":
		return 1e9
	case "MEG":
		return 1e6
	case "k", "K":
		return 1e3
	case "m":
		return 1e-3
	case "u", "U":
		return 1e-6
	case "n", "N":
		return 1e-9
	case "p", "P":
		return 1e-12
	case "f", "F":
		return 1e-15
	default:
		return 1
	}
}

func formatFloat(f float64) string {
	// 去掉尾部多余的零
	s := fmt.Sprintf("%.6g", f)
	return s
}

// ==================== 模型和子电路收集 ====================

// addDiodeModel 收集二极管模型定义
func (e *Exporter) addDiodeModel(modelName string, params map[string]any) {
	// 检查是否已收集
	for _, m := range e.models {
		if strings.Contains(m, modelName) {
			return
		}
	}
	if modelName == "D1N4148" {
		e.models = append(e.models, DefaultDiodeModel)
		return
	}
	// 从参数构建 .model
	if len(params) > 0 {
		e.models = append(e.models, fmt.Sprintf(".MODEL %s D(Is=2.52n Rs=0.568 N=1.752)", modelName))
	}
}

// addBJTModel 收集 BJT 模型定义
func (e *Exporter) addBJTModel(modelName string, compType types.ComponentType, params map[string]any) {
	for _, m := range e.models {
		if strings.Contains(m, modelName) {
			return
		}
	}
	switch modelName {
	case "2N2222", "NPN":
		e.models = append(e.models, DefaultNPNModel)
	case "2N2907", "PNP":
		e.models = append(e.models, DefaultPNPModel)
	default:
		if compType == types.ComponentBJTPNP {
			e.models = append(e.models, fmt.Sprintf(".MODEL %s PNP(Is=1e-14 Bf=100)", modelName))
		} else {
			e.models = append(e.models, fmt.Sprintf(".MODEL %s NPN(Is=1e-14 Bf=100)", modelName))
		}
	}
}

// addMOSFETModel 收集 MOSFET 模型定义
func (e *Exporter) addMOSFETModel(modelName string, compType types.ComponentType, params map[string]any) {
	for _, m := range e.models {
		if strings.Contains(m, modelName) {
			return
		}
	}
	switch modelName {
	case "2N7000", "NMOS":
		e.models = append(e.models, DefaultNMOSModel)
	case "BS250", "PMOS":
		e.models = append(e.models, DefaultPMOSModel)
	default:
		if compType == types.ComponentMOSFETPMOS {
			e.models = append(e.models, fmt.Sprintf(".MODEL %s PMOS(Level=1 Vto=-2 Kp=0.3)", modelName))
		} else {
			e.models = append(e.models, fmt.Sprintf(".MODEL %s NMOS(Level=1 Vto=2 Kp=0.3)", modelName))
		}
	}
}

// ==================== OpAmp 导出 ====================

// exportOpAmp 导出运放为子电路实例化（X 前缀）
func (e *Exporter) exportOpAmp(comp *types.Component, nodes []string) string {
	// 运放端口顺序：in+, in-, out, vcc, vee
	// 添加运放子电路定义（仅添加一次）
	for _, s := range e.subckts {
		if strings.Contains(s, "opamp") {
			return e.buildOpAmpInstance(comp, nodes)
		}
	}
	e.subckts = append(e.subckts, OpAmpDefaultSubcircuit)
	return e.buildOpAmpInstance(comp, nodes)
}

func (e *Exporter) buildOpAmpInstance(comp *types.Component, nodes []string) string {
	name := escapeSpiceName(comp.Name)
	if name == "" {
		name = "X" + strings.TrimPrefix(comp.ID, "comp_")
	}
	// 端口：in+, in-, out, vcc, vee
	portNames := []string{"in+", "in-", "out", "vcc", "vee"}
	nodeStrs := make([]string, 0, len(nodes))
	for i, n := range nodes {
		if i < len(portNames) {
			nodeStrs = append(nodeStrs, n)
		}
	}
	// 补齐到 5 个端口（VCC/VEE 可以接全局节点）
	for len(nodeStrs) < 5 {
		if len(nodeStrs) == 3 {
			nodeStrs = append(nodeStrs, "vcc") // VCC
		} else {
			nodeStrs = append(nodeStrs, "vee") // VEE
		}
	}
	return fmt.Sprintf("%s %s %s", name, strings.Join(nodeStrs, " "), OpAmpDefaultModel)
}

// ==================== 74 系列 IC 导出 ====================

// exportChip74 导出 74 系列 IC 为子电路实例化（X 前缀）
func (e *Exporter) exportChip74(comp *types.Component, nodes []string) string {
	modelName, ok := Chip74ModelNameMap[comp.Type]
	if !ok {
		return fmt.Sprintf("* Unknown 74-series IC: %s", comp.Name)
	}

	// 添加子电路定义（仅添加一次）
	subcktDef, hasSubckt := Chip74SubcircuitMap[comp.Type]
	if hasSubckt {
		alreadyAdded := false
		for _, s := range e.subckts {
			if strings.Contains(s, modelName) {
				alreadyAdded = true
				break
			}
		}
		if !alreadyAdded {
			e.subckts = append(e.subckts, subcktDef)
		}
	}

	name := escapeSpiceName(comp.Name)
	if name == "" {
		name = "X" + strings.TrimPrefix(comp.ID, "comp_")
	}

	// 端口映射：将 component ports 按照 Chip74SubcircuitPortsMap 的顺序排列
	expectedPorts := Chip74SubcircuitPortsMap[comp.Type]
	portNodeMap := make(map[string]string)
	for _, port := range comp.Ports {
		portNodeMap[port.ID] = port.NodeID
	}

	nodeStrs := make([]string, 0, len(expectedPorts))
	for _, portName := range expectedPorts {
		if nodeID, exists := portNodeMap[portName]; exists {
			nodeStrs = append(nodeStrs, e.nodeMap.GetSpiceName(nodeID))
		} else {
			// 未连接的端口默认接地
			nodeStrs = append(nodeStrs, "0")
		}
	}

	return fmt.Sprintf("%s %s %s", name, strings.Join(nodeStrs, " "), modelName)
}

// ==================== 工具函数 ====================

// escapeSpiceName 转义 SPICE 元件名中的中文和特殊字符
func escapeSpiceName(name string) string {
	if name == "" {
		return ""
	}
	// SPICE 不支持中文和特殊字符，替换为下划线
	var sb strings.Builder
	for _, r := range name {
		if (r >= 'A' && r <= 'Z') || (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' {
			sb.WriteRune(r)
		} else if r >= 0x4E00 && r <= 0x9FFF {
			// 中文字符：保留拼音首字母或用下划线
			sb.WriteRune('_')
		} else {
			sb.WriteRune('_')
		}
	}
	result := sb.String()
	// 确保以字母开头
	if len(result) > 0 && result[0] >= '0' && result[0] <= '9' {
		result = "X" + result
	}
	return result
}
