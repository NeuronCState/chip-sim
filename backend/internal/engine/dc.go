// Package engine 直流工作点求解器
// 实现 Modified Nodal Analysis (MNA) 直流求解，支持电压源扩展矩阵
package engine

import (
	"context"
	"fmt"
	"time"

	"chip-sim/pkg/types"
)

// DCEngine 直流工作点分析引擎
// 使用 Modified Nodal Analysis (MNA) 方法求解电路直流工作点
type DCEngine struct{}

// NewDCEngine 创建新的直流引擎
func NewDCEngine() *DCEngine {
	return &DCEngine{}
}

// Type 返回分析类型
func (e *DCEngine) Type() types.AnalysisType {
	return types.AnalysisDC
}

// Validate 验证电路是否可以进行直流分析
func (e *DCEngine) Validate(project *types.CircuitProject) error {
	if project == nil {
		return ErrInvalidCircuit
	}

	hasGround := false
	for _, node := range project.Nodes {
		if node.Type == types.NodeGround {
			hasGround = true
			break
		}
	}
	if !hasGround {
		return ErrNoGroundNode
	}

	if len(project.Components) == 0 {
		return fmt.Errorf("%w: no components", ErrInvalidCircuit)
	}

	return nil
}

// Run 执行直流工作点分析
//
// MNA with voltage source augmentation:
//   G·V = I
//   For n non-ground nodes and m voltage sources, the system is (n+m)×(n+m).
//   Voltage source Vs from node+ to node- adds:
//     M[node+][n+k] += 1, M[n+k][node+] += 1
//     M[node-][n+k] -= 1, M[n+k][node-] -= 1
//     b[n+k] += Vs
func (e *DCEngine) Run(ctx context.Context, project *types.CircuitProject) (<-chan *types.SimulationResult, error) {
	if err := e.Validate(project); err != nil {
		return nil, err
	}

	resultCh := make(chan *types.SimulationResult, 1)

	go func() {
		defer close(resultCh)

		resultCh <- &types.SimulationResult{
			ProjectID:    project.ID,
			Timestamp:    time.Now(),
			AnalysisType: types.AnalysisDC,
			Status:       types.StatusRunning,
		}

		// Resolve nodes and indices
		nonGroundNodes, nodeIndex, portNode, err := resolveNodes(project)
		if err != nil {
			sendError(resultCh, project, types.AnalysisDC, err.Error())
			return
		}

		n := len(nonGroundNodes)
		if n == 0 {
			sendError(resultCh, project, types.AnalysisDC, "no non-ground nodes to solve")
			return
		}

		// Count voltage sources for augmented matrix sizing
		vsources := make([]types.Component, 0)
		for _, comp := range project.Components {
			if comp.Type == types.ComponentVoltageSource || comp.Type == types.ComponentDCSource {
				vsources = append(vsources, comp)
			}
		}
		m := len(vsources)
		size := n + m

		// Build MNA matrix
		M := make([][]float64, size)
		b := make([]float64, size)
		for i := range M {
			M[i] = make([]float64, size)
		}

		// Stamp passive components and collect voltage source stamps
		vsrcIdx := 0
		for _, comp := range project.Components {
			indices := resolveNodeIndices(comp, portNode, nodeIndex)
			switch comp.Type {
			case types.ComponentResistor:
				stampResistorDC(M, comp, indices)
			case types.ComponentInductor:
				// Inductor in DC: short circuit (very small resistance)
				stampResistorDC(M, comp, indices)
			case types.ComponentCapacitor:
				// Capacitor in DC: open circuit (no contribution)
			case types.ComponentACSource:
				// AC source ignored in DC analysis
			case types.ComponentVoltageSource, types.ComponentDCSource:
				stampVoltageSourceDC(M, b, comp, indices, n, vsrcIdx)
				vsrcIdx++
			case types.ComponentDiode:
				stampDiodeDC(M, comp, indices)
			case types.ComponentBJTNPN, types.ComponentBJTPNP:
				stampBJTDC(M, comp, indices)
			case types.ComponentMOSFETNMOS, types.ComponentMOSFETPMOS:
				stampMOSFETDC(M, comp, indices)
			case types.ComponentJFETNJFET, types.ComponentJFETPJFET:
				stampJFETDC(M, comp, indices)
			case types.ComponentLDO:
				stampLDODC(M, b, comp, indices, n, vsrcIdx)
				vsrcIdx++
			case types.ComponentIGBT:
				stampIGBTDC(M, comp, indices)
			case types.ComponentDarlingtonNPN, types.ComponentDarlingtonPNP:
				stampDarlingtonDC(M, comp, indices)
			case types.ComponentOpAmp:
				// Op-Amp: ideal op-amp as nullator/norator or VCVS with high gain
				stampOpAmpDC(M, b, comp, indices, n, vsrcIdx)
				vsrcIdx++
			case types.ComponentLogicAND, types.ComponentLogicOR,
				types.ComponentLogicNOT, types.ComponentLogicNAND,
				types.ComponentLogicNOR, types.ComponentLogicXOR:
				// Logic gates: skip in DC analog analysis (digital components)
			case types.ComponentADC:
				// ADC in DC: input draws negligible current, output at mid-scale
				// Add small conductance on analog input to avoid floating
				stampADCDC(M, b, comp, indices)
			case types.ComponentDAC:
				// DAC in DC: output at 0V (no digital input in DC)
				stampDACDC(M, b, comp, indices)
			}
		}

		// Solve
		V, err := gaussianElimination(M, b)
		if err != nil {
			sendError(resultCh, project, types.AnalysisDC, fmt.Sprintf("solve failed: %v", err))
			return
		}

		// Build result channels (only node voltages, not vsource currents)
		channels := make([]types.SimulationChannel, n)
		for i, node := range nonGroundNodes {
			channels[i] = types.SimulationChannel{
				Name:    node.Name,
				NodeID:  node.ID,
				Color:   nodeColor(i),
				Visible: true,
				Data: []types.SimulationDataPoint{
					{X: 0, Y: V[i]},
				},
			}
		}

		resultCh <- &types.SimulationResult{
			ProjectID:    project.ID,
			Timestamp:    time.Now(),
			AnalysisType: types.AnalysisDC,
			Channels:     channels,
			Status:       types.StatusCompleted,
		}
	}()

	return resultCh, nil
}

// stampResistorDC stamps a resistor (or DC-equivalent inductor) into the real MNA matrix.
// For an inductor in DC, the effective resistance is 1e-9 (short circuit).
func stampResistorDC(M [][]float64, comp types.Component, indices []int) {
	if len(indices) < 2 {
		return
	}
	n1, n2 := indices[0], indices[1]

	R := comp.Value.Value
	if comp.Type == types.ComponentInductor {
		R = 1e-9 // Short circuit approximation
	}
	if R == 0 {
		return
	}
	g := 1.0 / R

	if n1 >= 0 {
		M[n1][n1] += g
	}
	if n2 >= 0 {
		M[n2][n2] += g
	}
	if n1 >= 0 && n2 >= 0 {
		M[n1][n2] -= g
		M[n2][n1] -= g
	}
}

// stampVoltageSourceDC stamps a voltage source into the augmented MNA matrix.
// indices[0] = positive terminal, indices[1] = negative terminal.
// vsrcIdx is the index among voltage sources (0-based).
func stampVoltageSourceDC(M [][]float64, b []float64, comp types.Component, indices []int, n int, vsrcIdx int) {
	if len(indices) < 2 {
		return
	}
	np, nn := indices[0], indices[1] // positive, negative
	col := n + vsrcIdx                // column for this vsource current variable

	if np >= 0 {
		M[np][col] += 1
		M[col][np] += 1
	}
	if nn >= 0 {
		M[nn][col] -= 1
		M[col][nn] -= 1
	}
	b[col] += comp.Value.Value
}

// resolveNodes determines non-ground nodes from project data.
// Tries wire-based node derivation first, falls back to project.Nodes.
func resolveNodes(project *types.CircuitProject) ([]types.CircuitNode, map[string]int, map[string]string, error) {
	if len(project.Wires) > 0 {
		return resolveNodesFromWires(project)
	}
	return resolveNodesFromList(project)
}

// resolveNodesFromWires uses buildNodeMap to derive nodes from wires.
func resolveNodesFromWires(project *types.CircuitProject) ([]types.CircuitNode, map[string]int, map[string]string, error) {
	nodeMap, orderedNodes, err := buildNodeMap(project.Components, project.Wires)
	if err != nil {
		return nil, nil, nil, err
	}
	portNode := getPortNodeMap(nodeMap)

	// Identify ground
	groundNode := ""
	for _, comp := range project.Components {
		if comp.Type == types.ComponentGround {
			for _, port := range comp.Ports {
				if name, ok := portNode[port.ID]; ok {
					groundNode = name
					break
				}
			}
			if groundNode != "" {
				break
			}
		}
	}

	// Also check for explicit ground nodes
	for _, node := range project.Nodes {
		if node.Type == types.NodeGround {
			// Find which derived node contains this node's connected ports
			for _, portID := range node.ConnectedPorts {
				if name, ok := portNode[portID]; ok {
					groundNode = name
					break
				}
			}
		}
	}

	nonGroundNodes := make([]types.CircuitNode, 0)
	nodeIndex := make(map[string]int)
	idx := 0
	for _, name := range orderedNodes {
		if name == groundNode {
			continue
		}
		nonGroundNodes = append(nonGroundNodes, types.CircuitNode{
			ID:   name,
			Name: name,
			Type: types.NodeNormal,
		})
		nodeIndex[name] = idx
		idx++
	}

	return nonGroundNodes, nodeIndex, portNode, nil
}

// resolveNodesFromList uses project.Nodes and port.NodeID (legacy path).
func resolveNodesFromList(project *types.CircuitProject) ([]types.CircuitNode, map[string]int, map[string]string, error) {
	nonGroundNodes := make([]types.CircuitNode, 0)
	nodeIndex := make(map[string]int)
	idx := 0
	groundName := ""

	for _, node := range project.Nodes {
		if node.Type == types.NodeGround {
			groundName = node.Name
			continue
		}
		nonGroundNodes = append(nonGroundNodes, node)
		nodeIndex[node.Name] = idx
		idx++
	}

	// Build portNode map from port.NodeID (treated as node name)
	portNode := make(map[string]string)
	for _, comp := range project.Components {
		for _, port := range comp.Ports {
			if port.NodeID != "" {
				portNode[port.ID] = port.NodeID
			}
		}
	}

	// Remap: remove ground from nodeIndex
	if groundName != "" {
		delete(nodeIndex, groundName)
		// Rebuild nodeIndex with sequential indices
		newIndex := make(map[string]int)
		newIdx := 0
		for _, node := range nonGroundNodes {
			newIndex[node.Name] = newIdx
			newIdx++
		}
		nodeIndex = newIndex
	}

	return nonGroundNodes, nodeIndex, portNode, nil
}

// sendError sends an error result on the channel.
func sendError(ch chan<- *types.SimulationResult, project *types.CircuitProject, at types.AnalysisType, msg string) {
	ch <- &types.SimulationResult{
		ProjectID:    project.ID,
		Timestamp:    time.Now(),
		AnalysisType: at,
		Status:       types.StatusError,
		Error:        msg,
	}
}
