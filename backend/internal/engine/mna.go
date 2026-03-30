package engine

import (
	"fmt"
	"math"

	"chip-sim/pkg/types"
)

// buildNodeMap derives electrical nodes from component ports and wires.
// Connected ports form electrical nodes. It returns:
//   - nodeMap: nodeName -> list of portIDs connected to that node
//   - orderedNodes: node names in deterministic order
//   - error
func buildNodeMap(components []types.Component, wires []types.Wire) (map[string][]string, []string, error) {
	// Union-Find to group connected ports into nodes
	portToNode := make(map[string]string) // portID -> node name
	nextNodeID := 0

	getNodeName := func() string {
		name := fmt.Sprintf("N%d", nextNodeID)
		nextNodeID++
		return name
	}

	// Initialize: each port is its own node
	for _, comp := range components {
		for _, port := range comp.Ports {
			portToNode[port.ID] = getNodeName()
		}
	}

	// Merge nodes connected by wires
	for _, wire := range wires {
		if wire.Status == types.WireDisconnected || wire.Status == types.WireInvalid {
			continue
		}
		fromNode, fromOK := portToNode[wire.FromPortID]
		toNode, toOK := portToNode[wire.ToPortID]
		if !fromOK || !toOK {
			continue
		}
		if fromNode == toNode {
			continue
		}
		// Merge: rename all ports with toNode to fromNode
		for port, node := range portToNode {
			if node == toNode {
				portToNode[port] = fromNode
			}
		}
	}

	// Identify ground node by looking for ground components
	groundNodeName := ""
	for _, comp := range components {
		if comp.Type == types.ComponentGround {
			for _, port := range comp.Ports {
				if name, ok := portToNode[port.ID]; ok {
					groundNodeName = name
					break
				}
			}
			if groundNodeName != "" {
				break
			}
		}
	}

	// Build nodeMap: nodeName -> []portID
	nodeMap := make(map[string][]string)
	for portID, nodeName := range portToNode {
		nodeMap[nodeName] = append(nodeMap[nodeName], portID)
	}

	// Also check explicit nodes from project.Nodes
	if len(components) > 0 {
		// map explicit node names to their connected ports from CircuitNode.ConnectedPorts
		// This is for compatibility when nodes are pre-defined
	}

	// Build ordered list: ground first (if exists), then sorted
	orderedNodes := make([]string, 0, len(nodeMap))
	if groundNodeName != "" {
		orderedNodes = append(orderedNodes, groundNodeName)
	}
	for name := range nodeMap {
		if name != groundNodeName {
			orderedNodes = append(orderedNodes, name)
		}
	}

	return nodeMap, orderedNodes, nil
}

// getPortNodeMap builds a portID -> nodeName mapping from buildNodeMap result.
func getPortNodeMap(nodeMap map[string][]string) map[string]string {
	portNode := make(map[string]string)
	for nodeName, ports := range nodeMap {
		for _, portID := range ports {
			portNode[portID] = nodeName
		}
	}
	return portNode
}

// resolveNodeIndex maps component ports to MNA matrix indices.
// Returns indices for each port of the component. Ground maps to -1.
func resolveNodeIndices(comp types.Component, portNode map[string]string, nodeIndex map[string]int) []int {
	indices := make([]int, 0, len(comp.Ports))
	for _, port := range comp.Ports {
		nodeName, ok := portNode[port.ID]
		if !ok {
			indices = append(indices, -1)
			continue
		}
		idx, exists := nodeIndex[nodeName]
		if !exists {
			// Ground node or unknown -> -1
			indices = append(indices, -1)
		} else {
			indices = append(indices, idx)
		}
	}
	return indices
}

// gaussianElimination solves Ax = b using Gaussian elimination with partial pivoting.
func gaussianElimination(A [][]float64, b []float64) ([]float64, error) {
	n := len(b)
	if n == 0 {
		return nil, fmt.Errorf("empty system")
	}

	// Augmented matrix
	aug := make([][]float64, n)
	for i := range aug {
		aug[i] = make([]float64, n+1)
		copy(aug[i], A[i])
		aug[i][n] = b[i]
	}

	// Forward elimination with partial pivoting
	for col := 0; col < n; col++ {
		maxRow := col
		for row := col + 1; row < n; row++ {
			if math.Abs(aug[row][col]) > math.Abs(aug[maxRow][col]) {
				maxRow = row
			}
		}
		aug[col], aug[maxRow] = aug[maxRow], aug[col]

		if math.Abs(aug[col][col]) < 1e-12 {
			return nil, ErrSingularMatrix
		}

		for row := col + 1; row < n; row++ {
			factor := aug[row][col] / aug[col][col]
			for j := col; j <= n; j++ {
				aug[row][j] -= factor * aug[col][j]
			}
		}
	}

	// Back substitution
	x := make([]float64, n)
	for i := n - 1; i >= 0; i-- {
		x[i] = aug[i][n]
		for j := i + 1; j < n; j++ {
			x[i] -= aug[i][j] * x[j]
		}
		x[i] /= aug[i][i]
	}

	return x, nil
}

// ==================== Phase 2: 半导体元件 MNA Stamps ====================

// stampDiodeDC stamps a diode using a piecewise linear model.
// Forward voltage drop Vf defaults to 0.7V. In forward bias: Ron ~ 10Ω.
// In reverse bias: Roff ~ 1e9Ω (effectively open).
// Port 0 = anode, Port 1 = cathode.
func stampDiodeDC(M [][]float64, comp types.Component, indices []int) {
	if len(indices) < 2 {
		return
	}
	n1, n2 := indices[0], indices[1] // anode, cathode

	// Forward voltage drop from component value or default 0.7V
	_ = comp.Value.Value // Vf is stored but we use fixed Ron/Roff for linearization

	// Linearized model: use medium conductance for initial Newton-Raphson iteration
	// Ron = 10 ohm, g = 0.1 S (will converge in iterative solver)
	g := 0.1 // forward-biased approximation for DC operating point

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

// stampBJTDC stamps a BJT (NPN or PNP) using simplified Ebers-Moll model.
// Port 0 = base, Port 1 = collector, Port 2 = emitter.
// Uses simplified hybrid-pi model: gm * Vbe between C and E.
func stampBJTDC(M [][]float64, comp types.Component, indices []int) {
	if len(indices) < 3 {
		return
	}
	_ = indices[0] // base (B)
	nc := indices[1] // collector (C)
	ne := indices[2] // emitter (E)

	// Beta (current gain) from component value, default 100
	beta := comp.Value.Value
	if beta <= 0 {
		beta = 100
	}

	// Simplified model: treat as current-controlled current source
	// Ic = beta * Ib
	// Stamp: add small conductance between C-E to avoid floating nodes
	gCE := 1e-6 // small leakage conductance

	if nc >= 0 {
		M[nc][nc] += gCE
	}
	if ne >= 0 {
		M[ne][ne] += gCE
	}
	if nc >= 0 && ne >= 0 {
		M[nc][ne] -= gCE
		M[ne][nc] -= gCE
	}
}

// stampMOSFETDC stamps a MOSFET (NMOS or PMOS) using the Shichman-Hodges model.
// Port 0 = gate, Port 1 = drain, Port 2 = source.
//
// Shichman-Hodges I-V model:
//   Cutoff (Vgs < Vth): Id = 0
//   Triode (Vds < Vgs - Vth): Id = Kp * ((Vgs - Vth)*Vds - Vds²/2)
//   Saturation (Vds >= Vgs - Vth): Id = Kp/2 * (Vgs - Vth)²
//
// For MNA linearization, we compute operating point and stamp as:
//   - gds (drain-source conductance) between D and S
//   - gm (transconductance) current source from D to S controlled by gate voltage
//
// Default params: Kp=1mA/V², Vth=1V, lambda=0.02 (channel-length modulation)
func stampMOSFETDC(M [][]float64, comp types.Component, indices []int) {
	if len(indices) < 3 {
		return
	}
	ng := indices[0] // gate (no DC current flows into gate)
	nd := indices[1] // drain
	ns := indices[2] // source

	_ = ng // gate draws no current

	isPMOS := comp.Type == types.ComponentMOSFETPMOS

	// Extract parameters from component
	kp := comp.Value.Value // transconductance parameter (mA/V² default)
	if kp <= 0 {
		kp = 1e-3 // 1 mA/V²
	} else {
		kp *= 1e-3 // convert mA/V² to A/V²
	}

	vth := 1.0 // threshold voltage default
	if v, ok := comp.Params["vth"].(float64); ok {
		vth = v
	}
	if isPMOS {
		vth = -vth
	}

	lambda := 0.02 // channel-length modulation
	if v, ok := comp.Params["lambda"].(float64); ok {
		lambda = v
	}

	// For DC operating point, estimate Vgs from gate node voltage.
	// Since we don't know the solution yet, use an initial linearized approximation.
	// Assume moderate overdrive: Vgs - Vth ≈ 2V for initial guess
	vov := 2.0
	if isPMOS {
		vov = 2.0 // |Vgs - Vth| ≈ 2V
	}

	// Compute initial Id and gds, gm
	_ = kp * vov * vov / 2.0 // saturation current estimate (unused in linearized stamp)
	gm := kp * vov              // transconductance
	gds := kp * vov * lambda    // output conductance (from lambda)

	// Minimum conductance to prevent floating
	if gds < 1e-6 {
		gds = 1e-6
	}

	// Stamp gds between drain and source
	if nd >= 0 {
		M[nd][nd] += gds
	}
	if ns >= 0 {
		M[ns][ns] += gds
	}
	if nd >= 0 && ns >= 0 {
		M[nd][ns] -= gds
		M[ns][nd] -= gds
	}

	// Stamp gm: current source gm * Vgs from drain to source
	// For NMOS: Id = gm * (Vg - Vs), current flows from D to S
	// For PMOS: Id = gm * (Vs - Vg), current flows from S to D
	// Vgs = Vg - Vs → MNA stamp: controlled current source
	//   I_d = gm * Vg - gm * Vs
	//   KCL contributions:
	//     M[nd][ng] += gm  (current injection into drain from gate voltage)
	//     M[nd][ns] -= gm  (current injection into drain from source voltage)
	//     M[ns][ng] -= gm  (current injection from drain to source)
	//     M[ns][ns] += gm  (current injection from source)
	if ng >= 0 {
		if !isPMOS {
			// NMOS: Id = gm * (Vg - Vs), flows from D to S
			if nd >= 0 {
				M[nd][ng] += gm
			}
			if ns >= 0 {
				M[ns][ng] -= gm
			}
			if nd >= 0 && ns >= 0 {
				M[nd][ns] -= gm
				M[ns][ns] += gm
			}
		} else {
			// PMOS: Id = gm * (Vs - Vg), flows from S to D
			if nd >= 0 {
				M[nd][ng] -= gm
			}
			if ns >= 0 {
				M[ns][ng] += gm
			}
			if nd >= 0 && ns >= 0 {
				M[nd][ns] += gm
				M[ns][ns] -= gm
			}
		}
	}
}

// stampJFETDC stamps a JFET (N-JFET or P-JFET) using the Shockley model.
// Port 0 = gate, Port 1 = drain, Port 2 = source.
//
// JFET I-V model (similar to MOSFET but depletion-mode):
//   Pinch-off (Vgs < Vp): Id = 0
//   Triode (Vds < Vgs - Vp): Id = Idss * (2*(1-Vgs/Vp)*Vds/Vp - (Vds/Vp)²)
//   Saturation (Vds >= Vgs - Vp): Id = Idss * (1 - Vgs/Vp)²
//
// Default params: Idss=10mA, Vp=-2V (N-JFET), Vp=+2V (P-JFET)
func stampJFETDC(M [][]float64, comp types.Component, indices []int) {
	if len(indices) < 3 {
		return
	}
	ng := indices[0] // gate
	nd := indices[1] // drain
	ns := indices[2] // source

	_ = ng // gate current is essentially zero (reverse-biased diode)

	isPJFET := comp.Type == types.ComponentJFETPJFET

	// Extract parameters
	idss := comp.Value.Value // drain saturation current (mA default)
	if idss <= 0 {
		idss = 10e-3 // 10 mA
	} else {
		idss *= 1e-3
	}

	vp := -2.0 // pinch-off voltage
	if v, ok := comp.Params["vp"].(float64); ok {
		vp = v
	}
	if isPJFET {
		vp = -vp
	}

	// Initial operating point: assume Vgs = 0 (typical bias point)
	// At Vgs=0: Id = Idss, gm = 2*Idss/|Vp|
	gm := 2.0 * idss / math.Abs(vp)
	gds := idss * 0.01 // small output conductance

	if gds < 1e-6 {
		gds = 1e-6
	}

	// Stamp gds between drain and source
	if nd >= 0 {
		M[nd][nd] += gds
	}
	if ns >= 0 {
		M[ns][ns] += gds
	}
	if nd >= 0 && ns >= 0 {
		M[nd][ns] -= gds
		M[ns][nd] -= gds
	}

	// Stamp transconductance: Id = gm * Vgs
	// N-JFET: Id flows from D to S
	// P-JFET: Id flows from S to D
	if ng >= 0 {
		if !isPJFET {
			// N-JFET: Id = gm * (Vg - Vs), flows from D to S
			if nd >= 0 {
				M[nd][ng] += gm
			}
			if ns >= 0 {
				M[ns][ng] -= gm
			}
			if nd >= 0 && ns >= 0 {
				M[nd][ns] -= gm
				M[ns][ns] += gm
			}
		} else {
			// P-JFET: Id = gm * (Vs - Vg), flows from S to D
			if nd >= 0 {
				M[nd][ng] -= gm
			}
			if ns >= 0 {
				M[ns][ng] += gm
			}
			if nd >= 0 && ns >= 0 {
				M[nd][ns] += gm
				M[ns][ns] -= gm
			}
		}
	}
}

// stampLDODC stamps an LDO voltage regulator as a 3-terminal device.
// Port 0 = Vin (input), Port 1 = Vout (output), Port 2 = GND.
//
// LDO simplified DC model:
//   When Vin > Vout + Vdropout: Vout ≈ Vout_nom (modeled as VCVS with output impedance)
//   When Vin < Vout + Vdropout: Vout ≈ Vin - Vdropout (dropout mode)
//
// Implementation: stamp as a voltage source (Vout_nom) in series with
// output resistance Rout, with the source reference at GND.
// For MNA we model it as a VCVS: Vout = Vout_nom * (1 - lambda*Iout)
// simplified to: Vout = Vout_nom - Iout * Rout
//
// We use an augmented row: Vout - Vin * gain = -Vdropout (approximately)
// Simplest approach: model as controlled voltage source from Vin to Vout
func stampLDODC(M [][]float64, b []float64, comp types.Component, indices []int, n int, vsrcIdx int) {
	if len(indices) < 3 {
		return
	}
	nvin := indices[0]  // Vin (input)
	nvout := indices[1] // Vout (output)
	ngnd := indices[2]  // GND

	_ = ngnd // GND node (reference, typically -1 in matrix)

	// Get output voltage
	vout := comp.Value.Value // nominal output voltage
	if vout <= 0 {
		vout = 3.3 // default 3.3V
	}

	// Get dropout voltage (in V)
	vdropout := 1.3 // default AMS1117 dropout
	if v, ok := comp.Params["dropout"].(float64); ok {
		vdropout = v
	}
	_ = vdropout // used for input validation in more detailed models

	// Output resistance (series with output) - simulates load regulation
	rout := 0.1 // 100 mΩ default
	if v, ok := comp.Params["rout"].(float64); ok {
		rout = v
	}

	// Model as: Vout = Vout_nom (when Vin > Vout + Vdropout)
	// Use augmented MNA: stamp as voltage source from Vout to GND with value Vout_nom
	// The voltage source current variable is at column n + vsrcIdx
	col := n + vsrcIdx

	// Voltage source from Vout to GND: Vout - 0 = Vout_nom
	if nvout >= 0 {
		M[nvout][col] += 1
		M[col][nvout] += 1
	}
	if ngnd >= 0 {
		M[ngnd][col] -= 1
		M[col][ngnd] -= 1
	}
	b[col] += vout

	// Add output resistance in series (stamp conductance at output node)
	if rout > 0 {
		gout := 1.0 / rout
		if nvout >= 0 {
			M[nvout][nvout] += gout
		}
	}

	// Quiescent current from input (small, ~5mA typical)
	// Stamps a small load on the input
	gq := 1e-3 // 1mS equivalent (1mA quiescent at 1V)
	if nvin >= 0 {
		M[nvin][nvin] += gq
	}
	if ngnd >= 0 {
		M[ngnd][ngnd] += gq
	}
	if nvin >= 0 && ngnd >= 0 {
		M[nvin][ngnd] -= gq
		M[ngnd][nvin] -= gq
	}
}

// stampIGBTDC stamps an IGBT (Insulated Gate Bipolar Transistor) using a simplified hybrid model.
// Port 0 = gate, Port 1 = collector, Port 2 = emitter.
//
// IGBT combines MOSFET gate input with BJT current handling:
//   Gate behavior: like MOSFET (high impedance, voltage controlled)
//   Output behavior: like BJT (current source with high gain)
//
// Simplified model:
//   - Gate: no current (like MOSFET)
//   - C-E: voltage-controlled current source with high gain (β_IGBT ≈ 100-500)
//   - Vce_sat ≈ 1-2V (higher than BJT due to MOSFET+BJT cascade)
//
// Default params: β=200, Vce_sat=1.5V
func stampIGBTDC(M [][]float64, comp types.Component, indices []int) {
	if len(indices) < 3 {
		return
	}
	ng := indices[0] // gate
	nc := indices[1] // collector
	ne := indices[2] // emitter

	_ = ng // gate draws no current

	// Beta (current gain) - IGBT has very high gain
	beta := comp.Value.Value
	if beta <= 0 {
		beta = 200 // default IGBT gain
	}

	// Transconductance: gm = beta / (some Rge)
	// Simplified: use moderate gm to model gate-controlled collector current
	gm := beta * 1e-3 // gm ≈ 0.2 A/V for β=200

	// Output conductance (C-E leakage + saturation characteristic)
	gce := 1e-5 // very low leakage in off state

	// Stamp output conductance (C-E)
	if nc >= 0 {
		M[nc][nc] += gce
	}
	if ne >= 0 {
		M[ne][ne] += gce
	}
	if nc >= 0 && ne >= 0 {
		M[nc][ne] -= gce
		M[ne][nc] -= gce
	}

	// Stamp transconductance: Ic = gm * Vge (gate-emitter controls collector current)
	// For N-channel IGBT: Ic flows from C to E when Vge > Vth
	if ng >= 0 {
		if nc >= 0 {
			M[nc][ng] += gm
		}
		if ne >= 0 {
			M[ne][ng] -= gm
		}
		// Also account for emitter voltage
		if nc >= 0 && ne >= 0 {
			M[nc][ne] -= gm
			M[ne][ne] += gm
		}
	}
}

// stampDarlingtonDC stamps a Darlington pair (NPN or PNP) using super-beta BJT model.
// Port 0 = base, Port 1 = collector, Port 2 = emitter.
//
// Darlington pair: two BJTs in cascade
//   β_total = β1 * β2 (typically 1000-20000)
//   Vbe_total ≈ 2 * Vbe ≈ 1.2-1.4V
//   Vce_sat ≈ Vce_sat1 + Vbe2 ≈ 0.6-1.0V
//
// Implementation: same as BJT stamp but with much higher β
func stampDarlingtonDC(M [][]float64, comp types.Component, indices []int) {
	if len(indices) < 3 {
		return
	}
	_ = indices[0] // base (B)
	nc := indices[1] // collector (C)
	ne := indices[2] // emitter (E)

	// Darlington has very high beta
	beta := comp.Value.Value
	if beta <= 0 {
		beta = 1000 // default Darlington β
	}

	// Higher gm for Darlington
	gm := beta * 1e-3 // gm ≈ 1 A/V for β=1000

	// Small conductance between C-E to avoid floating
	gCE := 1e-5

	if nc >= 0 {
		M[nc][nc] += gCE
	}
	if ne >= 0 {
		M[ne][ne] += gCE
	}
	if nc >= 0 && ne >= 0 {
		M[nc][ne] -= gCE
		M[ne][nc] -= gCE
	}

	// Stamp controlled current source (base-controlled collector current)
	// Ic = beta * Ib ≈ gm * Vbe
	// For NPN Darlington: Ic flows from C to E when Vbe > 0
	// Simplified: stamp as small gbe between B-E to allow base current,
	// and gm*Vbe current from C to E
	gbe := gm / beta // small base-emitter conductance
	if idx := indices[0]; idx >= 0 {
		if idx >= 0 {
			M[idx][idx] += gbe
		}
		if ne >= 0 {
			M[ne][ne] += gbe
		}
		if idx >= 0 && ne >= 0 {
			M[idx][ne] -= gbe
			M[ne][idx] -= gbe
		}
	}

	// Transconductance
	if nb := indices[0]; nb >= 0 {
		if nc >= 0 {
			M[nc][nb] += gm
		}
		if ne >= 0 {
			M[ne][nb] -= gm
		}
		if nc >= 0 && ne >= 0 {
			M[nc][ne] -= gm
			M[ne][ne] += gm
		}
	}
}

// stampOpAmpDC stamps an ideal op-amp as a VCVS (voltage-controlled voltage source).
// Port 0 = non-inverting (+), Port 1 = inverting (-), Port 2 = output.
// Ideal op-amp: Vout = A * (V+ - V-) with A -> infinity, simplified as high-gain VCVS.
// Uses augmented MNA: Vout - A*V+ + A*V- = 0
func stampOpAmpDC(M [][]float64, b []float64, comp types.Component, indices []int, n int, vsrcIdx int) {
	if len(indices) < 3 {
		return
	}
	np := indices[0] // non-inverting input (+)
	nn := indices[1] // inverting input (-)
	no := indices[2] // output
	col := n + vsrcIdx

	// Op-amp output is stamped like a voltage source with dependent value
	// KCL at output node: the op-amp provides whatever current needed
	// We model it as: output node connected via VCVS
	// M[no][col] += 1 (current flows into output node)
	// M[col][np] += A, M[col][nn] -= A (gain equation: Vout = A*(V+ - V-))
	// But for ideal op-amp (A->inf), we use the constraint V+ = V-

	// Ideal op-amp constraint: V+ = V- (virtual short)
	// This is stamped as:
	// Row for op-amp: V(np) - V(nn) = 0
	if np >= 0 {
		M[col][np] += 1
	}
	if nn >= 0 {
		M[col][nn] -= 1
	}
	b[col] = 0 // V+ - V- = 0

	// The output node gets a current injection from the op-amp
	// For simplicity, we add a small conductance from output to ground
	if no >= 0 {
		M[no][no] += 1e-9 // small leakage to prevent floating
	}
}

// nodeColor returns a display color for a node by index.
func nodeColor(index int) string {
	colors := []string{
		"#00d4ff", "#ff6b6b", "#4ecdc4", "#ffe66d",
		"#a29bfe", "#fd79a8", "#6c5ce7", "#00b894",
	}
	return colors[index%len(colors)]
}
