package spice

import (
	"math"
	"strings"
	"testing"

	"chip-sim/pkg/types"
)

func TestParseBasicResistorCircuit(t *testing.T) {
	netlist := `Basic RC Circuit
R1 node1 0 10k
R2 node1 node2 4.7k
C1 node2 0 1u
V1 node1 0 DC 5
.OP
.END`

	parser := NewParser()
	result, err := parser.Parse(strings.NewReader(netlist))
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}

	if len(result.Project.Components) != 4 {
		t.Errorf("expected 4 components, got %d", len(result.Project.Components))
	}

	// 验证元件类型
	compTypes := make(map[string]types.ComponentType)
	for _, c := range result.Project.Components {
		compTypes[c.Name] = c.Type
	}

	if compTypes["R1"] != types.ComponentResistor {
		t.Errorf("R1 should be resistor, got %s", compTypes["R1"])
	}
	if compTypes["C1"] != types.ComponentCapacitor {
		t.Errorf("C1 should be capacitor, got %s", compTypes["C1"])
	}
	if compTypes["V1"] != types.ComponentVoltageSource {
		t.Errorf("V1 should be voltage_source, got %s", compTypes["V1"])
	}

	// 验证 R1 的值
	for _, c := range result.Project.Components {
		if c.Name == "R1" {
			if c.Value.Value != 10000 {
				t.Errorf("R1 value should be 10000, got %g", c.Value.Value)
			}
		}
	}

	// 验证节点数
	if len(result.Project.Nodes) < 3 {
		t.Errorf("expected at least 3 nodes, got %d", len(result.Project.Nodes))
	}

	// 验证 .OP 命令被记录
	if result.Project.SimulationConfig.Analysis.Type != types.AnalysisDC {
		t.Errorf("analysis type should be DC, got %s", result.Project.SimulationConfig.Analysis.Type)
	}
}

func TestParseTransientCircuit(t *testing.T) {
	netlist := `RC Transient Circuit
R1 1 0 1k
C1 1 0 1u IC=0
V1 1 0 PULSE(0 5 1u 1n 1n 10u 20u)
.TRAN 0.1u 100u
.END`

	parser := NewParser()
	result, err := parser.Parse(strings.NewReader(netlist))
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}

	if result.Project.SimulationConfig.Analysis.Type != types.AnalysisTransient {
		t.Errorf("analysis type should be transient, got %s",
			result.Project.SimulationConfig.Analysis.Type)
	}
	if result.Project.SimulationConfig.Analysis.StepTime != 0.1e-6 {
		t.Errorf("step time should be 0.1u, got %g",
			result.Project.SimulationConfig.Analysis.StepTime)
	}
	if math.Abs(result.Project.SimulationConfig.Analysis.StopTime-100e-6)/100e-6 > 1e-9 {
		t.Errorf("stop time should be 100u, got %g",
			result.Project.SimulationConfig.Analysis.StopTime)
	}
}

func TestParseACSweepCircuit(t *testing.T) {
	netlist := `AC Sweep Test
R1 1 0 1k
C1 1 0 1u
V1 1 0 AC 1
.AC DEC 10 1 1meg
.END`

	parser := NewParser()
	result, err := parser.Parse(strings.NewReader(netlist))
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}

	if result.Project.SimulationConfig.Analysis.Type != types.AnalysisAC {
		t.Errorf("analysis type should be AC, got %s",
			result.Project.SimulationConfig.Analysis.Type)
	}
	if result.Project.SimulationConfig.Analysis.SweepMode != types.SweepLog {
		t.Errorf("sweep mode should be log, got %s",
			result.Project.SimulationConfig.Analysis.SweepMode)
	}
}

func TestParseDiodeCircuit(t *testing.T) {
	netlist := `Diode Test
D1 anode cathode D1N4148
R1 cathode 0 1k
V1 anode 0 DC 5
.END`

	parser := NewParser()
	result, err := parser.Parse(strings.NewReader(netlist))
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}

	found := false
	for _, c := range result.Project.Components {
		if c.Type == types.ComponentDiode {
			found = true
			if c.Params["modelName"] != "D1N4148" {
				t.Errorf("diode model should be D1N4148, got %v", c.Params["modelName"])
			}
		}
	}
	if !found {
		t.Error("diode not found in parsed components")
	}
}

func TestParseBJTCircuit(t *testing.T) {
	netlist := `BJT Amplifier
Q1 out in 0 NPN
Rc vcc out 1k
Rb in 0 100k
Vcc vcc 0 DC 12
Vin in 0 SIN(0 0.1 1k)
.END`

	parser := NewParser()
	result, err := parser.Parse(strings.NewReader(netlist))
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}

	found := false
	for _, c := range result.Project.Components {
		if c.Type == types.ComponentBJTNPN {
			found = true
			if len(c.Ports) != 3 {
				t.Errorf("BJT should have 3 ports, got %d", len(c.Ports))
			}
		}
	}
	if !found {
		t.Error("BJT not found in parsed components")
	}
}

func TestParseContinuationLines(t *testing.T) {
	netlist := `Continuation Test
R1 node1
+ node2 10k
V1 node1 0 DC 5
.END`

	parser := NewParser()
	result, err := parser.Parse(strings.NewReader(netlist))
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}

	if len(result.Project.Components) != 2 {
		t.Errorf("expected 2 components, got %d", len(result.Project.Components))
	}
}

func TestParseComments(t *testing.T) {
	netlist := `Comment Test
* This is a comment
R1 1 0 1k
; Another comment style
V1 1 0 DC 5
.END`

	parser := NewParser()
	result, err := parser.Parse(strings.NewReader(netlist))
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}

	if len(result.Project.Components) != 2 {
		t.Errorf("expected 2 components, got %d", len(result.Project.Components))
	}
}

func TestParseSpiceValue(t *testing.T) {
	tests := []struct {
		input    string
		expected float64
	}{
		{"10k", 10000},
		{"4.7K", 4700},
		{"1u", 1e-6},
		{"100n", 100e-9},
		{"2.2p", 2.2e-12},
		{"1MEG", 1e6},
		{"5", 5},
		{"0.1", 0.1},
		{"10m", 0.01},
	}

	for _, tt := range tests {
		val, _, _ := parseSpiceValue(tt.input)
		if math.Abs(val-tt.expected)/tt.expected > 1e-9 {
			t.Errorf("parseSpiceValue(%q) = %g, want %g", tt.input, val, tt.expected)
		}
	}
}

func TestExportBasicCircuit(t *testing.T) {
	project := &types.CircuitProject{
		ID:   "test-1",
		Name: "Test Circuit",
		Components: []types.Component{
			{
				ID:   "comp_1",
				Type: types.ComponentResistor,
				Name: "R1",
				Value: types.ComponentValue{Value: 10000, Unit: "Ω", Prefix: "k"},
				Ports: []types.ComponentPort{
					{ID: "p1", NodeID: "node_1"},
					{ID: "p2", NodeID: "node_gnd"},
				},
			},
			{
				ID:   "comp_2",
				Type: types.ComponentVoltageSource,
				Name: "V1",
				Value: types.ComponentValue{Value: 5, Unit: "V"},
				Ports: []types.ComponentPort{
					{ID: "p1", NodeID: "node_1"},
					{ID: "p2", NodeID: "node_gnd"},
				},
				Params: map[string]any{"sourceType": "dc"},
			},
		},
		Nodes: []types.CircuitNode{
			{ID: "node_1", Name: "1", Type: types.NodeNormal},
			{ID: "node_gnd", Name: "0", Type: types.NodeGround},
		},
		SimulationConfig: types.SimulationConfig{
			Analysis: types.AnalysisConfig{Type: types.AnalysisDC},
			Enabled: true,
		},
	}

	exporter := NewExporter()
	netlist := exporter.Export(project)

	// 验证输出包含关键元素
	if !strings.Contains(netlist, "Test") {
		t.Error("netlist should contain title")
	}
	if !strings.Contains(netlist, "R1") {
		t.Error("netlist should contain R1")
	}
	if !strings.Contains(netlist, "10k") {
		t.Error("netlist should contain 10k value")
	}
	if !strings.Contains(netlist, "V1") {
		t.Error("netlist should contain V1")
	}
	if !strings.Contains(netlist, ".OP") && !strings.Contains(netlist, ".DC") {
		t.Error("netlist should contain analysis command")
	}
	if !strings.Contains(netlist, ".END") {
		t.Error("netlist should contain .END")
	}

	t.Logf("Exported netlist:\n%s", netlist)
}

func TestRoundTrip(t *testing.T) {
	original := `Round Trip Test
R1 1 0 10k
C1 1 0 1u
V1 1 0 DC 5
.OP
.END`

	// Parse
	parser := NewParser()
	result, err := parser.Parse(strings.NewReader(original))
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}

	// Export
	exporter := NewExporter()
	exported := exporter.Export(result.Project)

	// Re-parse exported
	result2, err := parser.Parse(strings.NewReader(exported))
	if err != nil {
		t.Fatalf("re-parse failed: %v", err)
	}

	// 验证元件数量一致
	if len(result.Project.Components) != len(result2.Project.Components) {
		t.Errorf("component count mismatch: original=%d, roundtrip=%d",
			len(result.Project.Components), len(result2.Project.Components))
	}
}

func TestExportDiodeCircuit(t *testing.T) {
	project := &types.CircuitProject{
		Components: []types.Component{
			{
				ID:   "comp_1",
				Type: types.ComponentDiode,
				Name: "D1",
				Ports: []types.ComponentPort{
					{ID: "p1", NodeID: "node_1"},
					{ID: "p2", NodeID: "node_gnd"},
				},
				Params: map[string]any{"modelName": "D1N4148"},
			},
		},
		Nodes: []types.CircuitNode{
			{ID: "node_1", Name: "1", Type: types.NodeNormal},
			{ID: "node_gnd", Name: "0", Type: types.NodeGround},
		},
	}

	exporter := NewExporter()
	netlist := exporter.Export(project)

	if !strings.Contains(netlist, "D1N4148") {
		t.Error("netlist should contain diode model")
	}
}

func TestParseGroundNode(t *testing.T) {
	netlist := `Ground Test
R1 1 0 1k
V1 1 GND 5
.END`

	parser := NewParser()
	result, err := parser.Parse(strings.NewReader(netlist))
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}

	// 验证地节点
	groundFound := false
	for _, n := range result.Project.Nodes {
		if n.Type == types.NodeGround {
			groundFound = true
		}
	}
	if !groundFound {
		t.Error("ground node not found")
	}
}

func TestParseEmptyNetlist(t *testing.T) {
	parser := NewParser()
	_, err := parser.Parse(strings.NewReader(""))
	if err == nil {
		t.Error("expected error for empty netlist")
	}
}

func TestParseMOSFETCircuit(t *testing.T) {
	netlist := `MOSFET Test
M1 out in 0 0 NMOS
Rd vcc out 1k
Vd vcc 0 DC 5
.END`

	parser := NewParser()
	result, err := parser.Parse(strings.NewReader(netlist))
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}

	found := false
	for _, c := range result.Project.Components {
		if c.Type == types.ComponentMOSFETNMOS {
			found = true
			if len(c.Ports) != 4 {
				t.Errorf("MOSFET should have 4 ports, got %d", len(c.Ports))
			}
		}
	}
	if !found {
		t.Error("MOSFET not found")
	}
}

func TestParseSubcircuitInstance(t *testing.T) {
	netlist := `Subcircuit Test
X1 1 0 mysub
R1 1 0 1k
.END`

	parser := NewParser()
	result, err := parser.Parse(strings.NewReader(netlist))
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}

	// X1 should now be parsed as a component (not a warning)
	found := false
	for _, c := range result.Project.Components {
		if c.Name == "X1" {
			found = true
			if c.Params["subcircuitName"] != "mysub" {
				t.Errorf("X1 subcircuit name should be mysub, got %v", c.Params["subcircuitName"])
			}
		}
	}
	if !found {
		t.Error("X1 subcircuit instance not found in parsed components")
	}
}

// ==================== 新增测试：半导体元件导出 ====================

func TestExportBJTCircuit(t *testing.T) {
	project := &types.CircuitProject{
		ID:   "test-bjt",
		Name: "BJT Amplifier",
		Components: []types.Component{
			{
				ID:   "comp_1",
				Type: types.ComponentBJTNPN,
				Name: "Q1",
				Ports: []types.ComponentPort{
					{ID: "collector", NodeID: "node_vcc"},
					{ID: "base", NodeID: "node_in"},
					{ID: "emitter", NodeID: "node_gnd"},
				},
				Params: map[string]any{"modelName": "2N2222"},
			},
			{
				ID:   "comp_2",
				Type: types.ComponentResistor,
				Name: "Rc",
				Value: types.ComponentValue{Value: 1000, Unit: "Ω", Prefix: ""},
				Ports: []types.ComponentPort{
					{ID: "p1", NodeID: "node_vcc"},
					{ID: "p2", NodeID: "node_out"},
				},
			},
			{
				ID:   "comp_3",
				Type: types.ComponentVoltageSource,
				Name: "Vcc",
				Value: types.ComponentValue{Value: 12, Unit: "V"},
				Ports: []types.ComponentPort{
					{ID: "p1", NodeID: "node_vcc"},
					{ID: "p2", NodeID: "node_gnd"},
				},
				Params: map[string]any{"sourceType": "dc"},
			},
		},
		Nodes: []types.CircuitNode{
			{ID: "node_vcc", Name: "vcc", Type: types.NodeNormal},
			{ID: "node_in", Name: "in", Type: types.NodeNormal},
			{ID: "node_out", Name: "out", Type: types.NodeNormal},
			{ID: "node_gnd", Name: "0", Type: types.NodeGround},
		},
		SimulationConfig: types.SimulationConfig{
			Analysis: types.AnalysisConfig{Type: types.AnalysisDC},
			Enabled: true,
		},
	}

	exporter := NewExporter()
	netlist := exporter.Export(project)

	if !strings.Contains(netlist, "Q1") {
		t.Error("netlist should contain Q1")
	}
	if !strings.Contains(netlist, "2N2222") {
		t.Error("netlist should contain 2N2222 model")
	}
	// 检查 .model 语句
	if !strings.Contains(netlist, ".MODEL 2N2222 NPN") {
		t.Error("netlist should contain .MODEL 2N2222 NPN")
	}
	t.Logf("BJT netlist:\n%s", netlist)
}

func TestExportBJTPNPCircuit(t *testing.T) {
	project := &types.CircuitProject{
		Components: []types.Component{
			{
				ID:   "comp_1",
				Type: types.ComponentBJTPNP,
				Name: "Q2",
				Ports: []types.ComponentPort{
					{ID: "collector", NodeID: "node_out"},
					{ID: "base", NodeID: "node_in"},
					{ID: "emitter", NodeID: "node_vcc"},
				},
				Params: map[string]any{"modelName": "2N2907"},
			},
		},
		Nodes: []types.CircuitNode{
			{ID: "node_vcc", Name: "vcc", Type: types.NodeNormal},
			{ID: "node_in", Name: "in", Type: types.NodeNormal},
			{ID: "node_out", Name: "out", Type: types.NodeNormal},
			{ID: "node_gnd", Name: "0", Type: types.NodeGround},
		},
	}

	exporter := NewExporter()
	netlist := exporter.Export(project)

	if !strings.Contains(netlist, "Q2") {
		t.Error("netlist should contain Q2")
	}
	if !strings.Contains(netlist, "2N2907") {
		t.Error("netlist should contain 2N2907 model")
	}
	if !strings.Contains(netlist, ".MODEL 2N2907 PNP") {
		t.Error("netlist should contain .MODEL 2N2907 PNP")
	}
	t.Logf("PNP netlist:\n%s", netlist)
}

func TestExportMOSFETCircuit(t *testing.T) {
	project := &types.CircuitProject{
		Components: []types.Component{
			{
				ID:   "comp_1",
				Type: types.ComponentMOSFETNMOS,
				Name: "M1",
				Ports: []types.ComponentPort{
					{ID: "drain", NodeID: "node_out"},
					{ID: "gate", NodeID: "node_in"},
					{ID: "source", NodeID: "node_gnd"},
					{ID: "bulk", NodeID: "node_gnd"},
				},
				Params: map[string]any{"modelName": "2N7000"},
			},
		},
		Nodes: []types.CircuitNode{
			{ID: "node_out", Name: "out", Type: types.NodeNormal},
			{ID: "node_in", Name: "in", Type: types.NodeNormal},
			{ID: "node_gnd", Name: "0", Type: types.NodeGround},
		},
	}

	exporter := NewExporter()
	netlist := exporter.Export(project)

	if !strings.Contains(netlist, "M1") {
		t.Error("netlist should contain M1")
	}
	if !strings.Contains(netlist, "2N7000") {
		t.Error("netlist should contain 2N7000 model")
	}
	if !strings.Contains(netlist, ".MODEL 2N7000 NMOS") {
		t.Error("netlist should contain .MODEL 2N7000 NMOS")
	}
	t.Logf("MOSFET netlist:\n%s", netlist)
}

func TestExportMOSFETPMOSCircuit(t *testing.T) {
	project := &types.CircuitProject{
		Components: []types.Component{
			{
				ID:   "comp_1",
				Type: types.ComponentMOSFETPMOS,
				Name: "M2",
				Ports: []types.ComponentPort{
					{ID: "drain", NodeID: "node_out"},
					{ID: "gate", NodeID: "node_in"},
					{ID: "source", NodeID: "node_vcc"},
					{ID: "bulk", NodeID: "node_vcc"},
				},
				Params: map[string]any{"modelName": "BS250"},
			},
		},
		Nodes: []types.CircuitNode{
			{ID: "node_out", Name: "out", Type: types.NodeNormal},
			{ID: "node_in", Name: "in", Type: types.NodeNormal},
			{ID: "node_vcc", Name: "vcc", Type: types.NodeNormal},
		},
	}

	exporter := NewExporter()
	netlist := exporter.Export(project)

	if !strings.Contains(netlist, "M2") {
		t.Error("netlist should contain M2")
	}
	if !strings.Contains(netlist, "BS250") {
		t.Error("netlist should contain BS250 model")
	}
	if !strings.Contains(netlist, ".MODEL BS250 PMOS") {
		t.Error("netlist should contain .MODEL BS250 PMOS")
	}
}

// ==================== 运放导出测试 ====================

func TestExportOpAmpCircuit(t *testing.T) {
	project := &types.CircuitProject{
		ID:   "test-opamp",
		Name: "OpAmp Amplifier",
		Components: []types.Component{
			{
				ID:   "comp_1",
				Type: types.ComponentOpAmp,
				Name: "U1",
				Ports: []types.ComponentPort{
					{ID: "in+", NodeID: "node_in"},
					{ID: "in-", NodeID: "node_fb"},
					{ID: "out", NodeID: "node_out"},
					{ID: "vcc", NodeID: "node_vcc"},
					{ID: "vee", NodeID: "node_vee"},
				},
			},
			{
				ID:   "comp_2",
				Type: types.ComponentResistor,
				Name: "R1",
				Value: types.ComponentValue{Value: 10000, Unit: "Ω", Prefix: "k"},
				Ports: []types.ComponentPort{
					{ID: "p1", NodeID: "node_in"},
					{ID: "p2", NodeID: "node_gnd"},
				},
			},
			{
				ID:   "comp_3",
				Type: types.ComponentResistor,
				Name: "Rf",
				Value: types.ComponentValue{Value: 100000, Unit: "Ω", Prefix: "k"},
				Ports: []types.ComponentPort{
					{ID: "p1", NodeID: "node_out"},
					{ID: "p2", NodeID: "node_fb"},
				},
			},
		},
		Nodes: []types.CircuitNode{
			{ID: "node_in", Name: "in", Type: types.NodeNormal},
			{ID: "node_fb", Name: "fb", Type: types.NodeNormal},
			{ID: "node_out", Name: "out", Type: types.NodeNormal},
			{ID: "node_vcc", Name: "vcc", Type: types.NodeNormal},
			{ID: "node_vee", Name: "vee", Type: types.NodeNormal},
			{ID: "node_gnd", Name: "0", Type: types.NodeGround},
		},
	}

	exporter := NewExporter()
	netlist := exporter.Export(project)

	// 应包含子电路实例化（X 前缀）
	if !strings.Contains(netlist, "U1") {
		t.Error("netlist should contain U1")
	}
	// 应包含运放子电路定义
	if !strings.Contains(netlist, ".SUBCKT opamp") {
		t.Error("netlist should contain .SUBCKT opamp")
	}
	if !strings.Contains(netlist, ".ENDS opamp") {
		t.Error("netlist should contain .ENDS opamp")
	}
	t.Logf("OpAmp netlist:\n%s", netlist)
}

// ==================== 74 系列 IC 导出测试 ====================

func TestExport7400Circuit(t *testing.T) {
	project := &types.CircuitProject{
		ID:   "test-7400",
		Name: "7400 NAND Gate",
		Components: []types.Component{
			{
				ID:   "comp_1",
				Type: types.Component7400,
				Name: "U1",
				Ports: []types.ComponentPort{
					{ID: "1A", NodeID: "node_a"},
					{ID: "1B", NodeID: "node_b"},
					{ID: "1Y", NodeID: "node_y1"},
					{ID: "2A", NodeID: "node_c"},
					{ID: "2B", NodeID: "node_d"},
					{ID: "2Y", NodeID: "node_y2"},
					{ID: "GND", NodeID: "node_gnd"},
					{ID: "3Y", NodeID: "node_y3"},
					{ID: "3A", NodeID: "node_e"},
					{ID: "3B", NodeID: "node_f"},
					{ID: "4Y", NodeID: "node_y4"},
					{ID: "4A", NodeID: "node_g"},
					{ID: "4B", NodeID: "node_h"},
					{ID: "VCC", NodeID: "node_vcc"},
				},
			},
		},
		Nodes: []types.CircuitNode{
			{ID: "node_a", Name: "A", Type: types.NodeNormal},
			{ID: "node_b", Name: "B", Type: types.NodeNormal},
			{ID: "node_y1", Name: "Y1", Type: types.NodeNormal},
			{ID: "node_gnd", Name: "0", Type: types.NodeGround},
			{ID: "node_vcc", Name: "VCC", Type: types.NodeNormal},
		},
	}

	exporter := NewExporter()
	netlist := exporter.Export(project)

	if !strings.Contains(netlist, "U1") {
		t.Error("netlist should contain U1")
	}
	if !strings.Contains(netlist, "ttl7400") {
		t.Error("netlist should contain ttl7400 subcircuit")
	}
	if !strings.Contains(netlist, ".SUBCKT ttl7400") {
		t.Error("netlist should contain .SUBCKT ttl7400 definition")
	}
	t.Logf("7400 netlist:\n%s", netlist)
}

func TestExport7404Circuit(t *testing.T) {
	project := &types.CircuitProject{
		Components: []types.Component{
			{
				ID:   "comp_1",
				Type: types.Component7404,
				Name: "U2",
				Ports: []types.ComponentPort{
					{ID: "1A", NodeID: "node_in1"},
					{ID: "1Y", NodeID: "node_out1"},
					{ID: "2A", NodeID: "node_in2"},
					{ID: "2Y", NodeID: "node_out2"},
					{ID: "3A", NodeID: "node_in3"},
					{ID: "3Y", NodeID: "node_out3"},
					{ID: "GND", NodeID: "node_gnd"},
					{ID: "4Y", NodeID: "node_out4"},
					{ID: "4A", NodeID: "node_in4"},
					{ID: "5Y", NodeID: "node_out5"},
					{ID: "5A", NodeID: "node_in5"},
					{ID: "6Y", NodeID: "node_out6"},
					{ID: "6A", NodeID: "node_in6"},
					{ID: "VCC", NodeID: "node_vcc"},
				},
			},
		},
		Nodes: []types.CircuitNode{
			{ID: "node_gnd", Name: "0", Type: types.NodeGround},
			{ID: "node_vcc", Name: "VCC", Type: types.NodeNormal},
		},
	}

	exporter := NewExporter()
	netlist := exporter.Export(project)

	if !strings.Contains(netlist, "U2") {
		t.Error("netlist should contain U2")
	}
	if !strings.Contains(netlist, "ttl7404") {
		t.Error("netlist should contain ttl7404")
	}
}

// ==================== 往返测试 (Round-Trip) ====================

func TestRoundTripBJT(t *testing.T) {
	netlist := `BJT Round Trip
Q1 out in 0 2N2222
Rc vcc out 1k
Rb in 0 100k
Vcc vcc 0 DC 12
.MODEL 2N2222 NPN(Is=14.34f Bf=255.9)
.OP
.END`

	parser := NewParser()
	result, err := parser.Parse(strings.NewReader(netlist))
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}

	// Export
	exporter := NewExporter()
	exported := exporter.Export(result.Project)

	// Re-parse
	result2, err := parser.Parse(strings.NewReader(exported))
	if err != nil {
		t.Fatalf("re-parse failed: %v", err)
	}

	// 验证元件数量
	if len(result.Project.Components) != len(result2.Project.Components) {
		t.Errorf("component count mismatch: original=%d, roundtrip=%d",
			len(result.Project.Components), len(result2.Project.Components))
	}

	// 验证 BJT 类型一致
	bjtFound := false
	for _, c := range result2.Project.Components {
		if c.Type == types.ComponentBJTNPN {
			bjtFound = true
		}
	}
	if !bjtFound {
		t.Error("BJT not found after round-trip")
	}
}

func TestRoundTripMOSFET(t *testing.T) {
	netlist := `MOSFET Round Trip
M1 out in 0 0 2N7000
Rd vcc out 1k
Vd vcc 0 DC 5
.MODEL 2N7000 NMOS(Level=1 Vto=2.094 Kp=0.2628)
.END`

	parser := NewParser()
	result, err := parser.Parse(strings.NewReader(netlist))
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}

	exporter := NewExporter()
	exported := exporter.Export(result.Project)

	result2, err := parser.Parse(strings.NewReader(exported))
	if err != nil {
		t.Fatalf("re-parse failed: %v", err)
	}

	if len(result.Project.Components) != len(result2.Project.Components) {
		t.Errorf("component count mismatch: original=%d, roundtrip=%d",
			len(result.Project.Components), len(result2.Project.Components))
	}
}

func TestRoundTripMixedSemiconductors(t *testing.T) {
	netlist := `Mixed Semiconductors
R1 1 0 10k
D1 1 2 D1N4148
Q1 2 1 0 NPN
M1 3 2 0 0 NMOS
V1 1 0 DC 5
.MODEL D1N4148 D(Is=2.52n N=1.752)
.MODEL NPN NPN(Is=1e-14 Bf=100)
.MODEL NMOS NMOS(Level=1 Vto=2 Kp=0.3)
.OP
.END`

	parser := NewParser()
	result, err := parser.Parse(strings.NewReader(netlist))
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}

	// 验证所有元件被解析
	compTypes := make(map[types.ComponentType]int)
	for _, c := range result.Project.Components {
		compTypes[c.Type]++
	}

	if compTypes[types.ComponentResistor] < 1 {
		t.Error("resistor not found")
	}
	if compTypes[types.ComponentDiode] < 1 {
		t.Error("diode not found")
	}
	if compTypes[types.ComponentBJTNPN] < 1 {
		t.Error("NPN BJT not found")
	}
	if compTypes[types.ComponentMOSFETNMOS] < 1 {
		t.Error("NMOS not found")
	}

	// Export and re-parse
	exporter := NewExporter()
	exported := exporter.Export(result.Project)

	result2, err := parser.Parse(strings.NewReader(exported))
	if err != nil {
		t.Fatalf("re-parse failed: %v", err)
	}

	if len(result.Project.Components) != len(result2.Project.Components) {
		t.Errorf("component count mismatch: original=%d, roundtrip=%d",
			len(result.Project.Components), len(result2.Project.Components))
	}

	t.Logf("Mixed semiconductor netlist:\n%s", exported)
}

// ==================== 模型定义解析测试 ====================

func TestParseModelDefinitions(t *testing.T) {
	netlist := `Model Test
D1 anode cathode D1N4148
Q1 out in 0 NPN
M1 drain gate 0 0 NMOS
.MODEL D1N4148 D(Is=2.52n Rs=0.568 N=1.752)
.MODEL NPN NPN(Is=14.34f Bf=255.9 Ne=1.307)
.MODEL NMOS NMOS(Level=1 Vto=2.094 Kp=0.2628 Lambda=0.01147)
.END`

	parser := NewParser()
	result, err := parser.Parse(strings.NewReader(netlist))
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}

	// 验证模型被解析
	if len(result.Models) != 3 {
		t.Errorf("expected 3 models, got %d", len(result.Models))
	}

	diodeModel, ok := result.Models["D1N4148"]
	if !ok {
		t.Fatal("D1N4148 model not found")
	}
	if diodeModel.Type != "D" {
		t.Errorf("diode model type should be D, got %s", diodeModel.Type)
	}
	if diodeModel.Params["IS"] != "2.52n" {
		t.Errorf("diode IS should be 2.52n, got %s", diodeModel.Params["IS"])
	}

	npnModel, ok := result.Models["NPN"]
	if !ok {
		t.Fatal("NPN model not found")
	}
	if npnModel.Type != "NPN" {
		t.Errorf("NPN model type should be NPN, got %s", npnModel.Type)
	}
	if npnModel.Params["BF"] != "255.9" {
		t.Errorf("NPN Bf should be 255.9, got %s", npnModel.Params["BF"])
	}
}

// ==================== .SUBCKT 定义解析测试 ====================

func TestParseSubcircuitDefinition(t *testing.T) {
	netlist := `Subcircuit Def Test
.SUBCKT myamp in out vcc gnd
R1 in mid 10k
R2 mid out 1k
.ENDS myamp
X1 vin vout vcc 0 myamp
.END`

	parser := NewParser()
	result, err := parser.Parse(strings.NewReader(netlist))
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}

	sub, ok := result.Subcircuits["myamp"]
	if !ok {
		t.Fatal("myamp subcircuit not found")
	}
	if len(sub.Ports) != 4 {
		t.Errorf("subcircuit should have 4 ports, got %d", len(sub.Ports))
	}
	if len(sub.Body) != 2 {
		t.Errorf("subcircuit body should have 2 lines, got %d", len(sub.Body))
	}
}

// ==================== .IC 初始条件解析测试 ====================

func TestParseICCommand(t *testing.T) {
	netlist := `IC Test
R1 1 0 1k
C1 1 0 1u
V1 1 0 DC 5
.IC V(1)=3.3 V(2)=0
.TRAN 1u 100u
.END`

	parser := NewParser()
	result, err := parser.Parse(strings.NewReader(netlist))
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}

	ics := result.Project.SimulationConfig.Analysis.InitialVoltages
	if ics == nil {
		t.Fatal("initial voltages should not be nil")
	}
	if v, ok := ics["1"]; !ok || v != 3.3 {
		t.Errorf("V(1) should be 3.3, got %v", ics["1"])
	}
	if v, ok := ics["2"]; !ok || v != 0 {
		t.Errorf("V(2) should be 0, got %v", ics["2"])
	}
}

// ==================== 中文名称转义测试 ====================

func TestChineseNameEscaping(t *testing.T) {
	project := &types.CircuitProject{
		Name: "测试电路",
		Components: []types.Component{
			{
				ID:   "comp_1",
				Type: types.ComponentResistor,
				Name: "电阻R1",
				Value: types.ComponentValue{Value: 1000, Unit: "Ω"},
				Ports: []types.ComponentPort{
					{ID: "p1", NodeID: "node_1"},
					{ID: "p2", NodeID: "node_gnd"},
				},
			},
		},
		Nodes: []types.CircuitNode{
			{ID: "node_1", Name: "1", Type: types.NodeNormal},
			{ID: "node_gnd", Name: "0", Type: types.NodeGround},
		},
	}

	exporter := NewExporter()
	netlist := exporter.Export(project)

	// 中文标题应该被转义
	if strings.Contains(netlist, "测试电路") {
		t.Error("Chinese characters in title should be escaped")
	}
	// 中文元件名应该被转义
	if strings.Contains(netlist, "电阻R1") {
		t.Error("Chinese characters in component name should be escaped")
	}
	// 转义后的名字应该仍然可解析
	if !strings.Contains(netlist, "_R1") && !strings.Contains(netlist, "R1") {
		t.Error("escaped name should contain R1")
	}
	t.Logf("Escaped netlist:\n%s", netlist)
}

// ==================== 完整混合电路往返测试 ====================

func TestRoundTripFullCircuit(t *testing.T) {
	netlist := `Full Mixed Circuit
R1 in 0 10k
C1 out 0 1u
D1 mid out D1N4148
Q1 out mid 0 2N2222
M1 gate mid 0 0 2N7000
V1 in 0 DC 5
Vin gate 0 SIN(0 1 1k)
.MODEL D1N4148 D(Is=2.52n N=1.752)
.MODEL 2N2222 NPN(Is=14.34f Bf=255.9)
.MODEL 2N7000 NMOS(Level=1 Vto=2.094 Kp=0.2628)
.TRAN 1u 1m
.END`

	parser := NewParser()
	result, err := parser.Parse(strings.NewReader(netlist))
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}

	// Export
	exporter := NewExporter()
	exported := exporter.Export(result.Project)

	// Re-parse
	result2, err := parser.Parse(strings.NewReader(exported))
	if err != nil {
		t.Fatalf("re-parse failed: %v\nExported:\n%s", err, exported)
	}

	// 验证元件数量一致
	if len(result.Project.Components) != len(result2.Project.Components) {
		t.Errorf("component count mismatch: original=%d, roundtrip=%d\nOriginal: %d components\nExported:\n%s",
			len(result.Project.Components), len(result2.Project.Components),
			len(result.Project.Components), exported)
	}

	// 验证仿真配置
	if result.Project.SimulationConfig.Analysis.Type != result2.Project.SimulationConfig.Analysis.Type {
		t.Errorf("analysis type mismatch: original=%s, roundtrip=%s",
			result.Project.SimulationConfig.Analysis.Type,
			result2.Project.SimulationConfig.Analysis.Type)
	}

	t.Logf("Full circuit round-trip netlist:\n%s", exported)
}

// ==================== 格式兼容性测试 ====================

func TestExportLTspiceCompatibility(t *testing.T) {
	project := &types.CircuitProject{
		Name: "LTspice Compat Test",
		Components: []types.Component{
			{
				ID:   "comp_1",
				Type: types.ComponentDiode,
				Name: "D1",
				Ports: []types.ComponentPort{
					{ID: "anode", NodeID: "node_1"},
					{ID: "cathode", NodeID: "node_2"},
				},
				Params: map[string]any{"modelName": "D1N4148"},
			},
			{
				ID:   "comp_2",
				Type: types.ComponentResistor,
				Name: "R1",
				Value: types.ComponentValue{Value: 1000, Unit: "Ω", Prefix: ""},
				Ports: []types.ComponentPort{
					{ID: "p1", NodeID: "node_2"},
					{ID: "p2", NodeID: "node_gnd"},
				},
			},
			{
				ID:   "comp_3",
				Type: types.ComponentVoltageSource,
				Name: "V1",
				Value: types.ComponentValue{Value: 5, Unit: "V"},
				Ports: []types.ComponentPort{
					{ID: "p1", NodeID: "node_1"},
					{ID: "p2", NodeID: "node_gnd"},
				},
				Params: map[string]any{"sourceType": "dc"},
			},
		},
		Nodes: []types.CircuitNode{
			{ID: "node_1", Name: "1", Type: types.NodeNormal},
			{ID: "node_2", Name: "2", Type: types.NodeNormal},
			{ID: "node_gnd", Name: "0", Type: types.NodeGround},
		},
		SimulationConfig: types.SimulationConfig{
			Analysis: types.AnalysisConfig{Type: types.AnalysisDC},
			Enabled: true,
		},
	}

	exporter := NewExporter()
	netlist := exporter.Export(project)

	// LTspice 兼容性检查
	lines := strings.Split(netlist, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if len(line) == 0 || line[0] == '*' || line[0] == '.' {
			continue
		}
		// 元件行不应有连续空格
		if strings.Contains(line, "  ") {
			t.Errorf("line contains double spaces: %s", line)
		}
	}

	t.Logf("LTspice-compatible netlist:\n%s", netlist)
}
