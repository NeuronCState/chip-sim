// Package engine 瞬态分析引擎
// 使用 Backward Euler / Trapezoidal 伴随模型实现时域仿真
// 支持自适应步长、Newton-Raphson 非线性迭代、初始条件设定
package engine

import (
	"context"
	"fmt"
	"math"
	"time"

	"chip-sim/pkg/types"
)

const (
	// Newton-Raphson 参数
	defaultMaxIter    = 100
	defaultNRTol      = 1e-8
	defaultDampFactor = 1.0

	// 自适应步长参数
	defaultTruncErrorTol = 1e-4
	defaultMinStepFactor = 1e-6 // min step = dt * minStepFactor
	defaultMaxStepFactor = 5.0  // max step = dt * maxStepFactor
)

// compInfo holds pre-computed component data with resolved node indices.
type compInfo struct {
	comp    types.Component
	indices []int
}

// TransientEngine 瞬态分析引擎
type TransientEngine struct{}

// NewTransientEngine 创建新的瞬态引擎
func NewTransientEngine() *TransientEngine {
	return &TransientEngine{}
}

// Type 返回分析类型
func (e *TransientEngine) Type() types.AnalysisType {
	return types.AnalysisTransient
}

// Validate 验证电路是否可以进行瞬态分析
func (e *TransientEngine) Validate(project *types.CircuitProject) error {
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

// Run 执行瞬态分析
//
// 算法：
//  1. t=0, 用初始条件设定 V_prev
//  2. 每个时间步：构建 MNA（含伴随模型） → Newton-Raphson 迭代求解 → 存储
//  3. 可选自适应步长：局部截断误差估计调整 dt
func (e *TransientEngine) Run(ctx context.Context, project *types.CircuitProject) (<-chan *types.SimulationResult, error) {
	if err := e.Validate(project); err != nil {
		return nil, err
	}

	cfg := project.SimulationConfig.Analysis
	dt := cfg.StepTime
	stopTime := cfg.StopTime
	if dt <= 0 {
		return nil, fmt.Errorf("%w: stepTime must be > 0", ErrInvalidCircuit)
	}
	if stopTime <= 0 {
		return nil, fmt.Errorf("%w: stopTime must be > 0", ErrInvalidCircuit)
	}

	adaptive := cfg.AdaptiveStep
	maxStep := cfg.MaxStep
	minStep := cfg.MinStep
	truncTol := cfg.TruncErrorTol

	if maxStep <= 0 {
		maxStep = dt * defaultMaxStepFactor
	}
	if minStep <= 0 {
		minStep = dt * defaultMinStepFactor
	}
	if truncTol <= 0 {
		truncTol = defaultTruncErrorTol
	}

	resultCh := make(chan *types.SimulationResult, 1)

	go func() {
		defer close(resultCh)

		resultCh <- &types.SimulationResult{
			ProjectID:    project.ID,
			Timestamp:    time.Now(),
			AnalysisType: types.AnalysisTransient,
			Status:       types.StatusRunning,
		}

		// Resolve nodes
		nonGroundNodes, nodeIndex, portNode, err := resolveNodes(project)
		if err != nil {
			sendError(resultCh, project, types.AnalysisTransient, err.Error())
			return
		}

		n := len(nonGroundNodes)
		if n == 0 {
			sendError(resultCh, project, types.AnalysisTransient, "no non-ground nodes to solve")
			return
		}

		// Count voltage sources
		vsources := make([]types.Component, 0)
		for _, comp := range project.Components {
			if comp.Type == types.ComponentVoltageSource || comp.Type == types.ComponentDCSource || comp.Type == types.ComponentACSource {
				vsources = append(vsources, comp)
			}
		}
		m := len(vsources)
		size := n + m

		// Pre-compute component indices
		compInfos := make([]compInfo, 0, len(project.Components))
		for _, comp := range project.Components {
			indices := resolveNodeIndices(comp, portNode, nodeIndex)
			compInfos = append(compInfos, compInfo{comp, indices})
		}

		// Initialize node voltages from initial conditions
		V_prev := make([]float64, n)
		if cfg.InitialVoltages != nil {
			for nodeName, v := range cfg.InitialVoltages {
				if idx, ok := nodeIndex[nodeName]; ok {
					V_prev[idx] = v
				}
			}
		}

		// Inductor currents state
		inductorCurrents := make(map[string]float64)

		// ADC internal states
		adcStates := make(map[string]*ADCInternalState)

		// DAC internal states
		dacStates := make(map[string]*DACInternalState)

		// Data accumulators
		nodeData := make([][]types.SimulationDataPoint, n)

		// Also track voltage source currents for output
		vsrcCurrentData := make([][]types.SimulationDataPoint, m)
		for i := 0; i < m; i++ {
			vsrcCurrentData[i] = make([]types.SimulationDataPoint, 0)
		}

		// Current time step (may vary with adaptive stepping)
		currentDt := dt
		t := 0.0

		// Time stepping
		stepCount := 0
		maxSteps := int(math.Ceil(stopTime/dt)) + 1
		if maxSteps > 2000000 {
			maxSteps = 2000000
		}

		for t < stopTime && stepCount < maxSteps {
			select {
			case <-ctx.Done():
				sendError(resultCh, project, types.AnalysisTransient, "cancelled")
				return
			default:
			}

			// Clamp last step
			if t+currentDt > stopTime {
				currentDt = stopTime - t
			}

			// Solve with Newton-Raphson iteration
			V, converged := solveTransientStep(
				compInfos, V_prev, inductorCurrents, adcStates, dacStates,
				n, m, size, t, currentDt,
			)

			if !converged {
				if adaptive && currentDt > minStep {
					// Reduce step size and retry
					currentDt = math.Max(currentDt*0.5, minStep)
					continue
				}
				// Non-adaptive or at min step: warn but continue
				// Use the last iterate anyway
			}

			// Store data
			for i := 0; i < n; i++ {
				nodeData[i] = append(nodeData[i], types.SimulationDataPoint{X: t, Y: V[i]})
			}

			// Record voltage source currents from the augmented MNA solution
			for i := 0; i < m; i++ {
				if n+i < len(V) {
					vsrcCurrentData[i] = append(vsrcCurrentData[i], types.SimulationDataPoint{X: t, Y: V[n+i]})
				}
			}

			// Update inductor currents
			for _, ci := range compInfos {
				if ci.comp.Type == types.ComponentInductor && ci.comp.Value.Value != 0 {
					indices := ci.indices
					if len(indices) >= 2 {
						va := 0.0
						vb := 0.0
						if indices[0] >= 0 {
							va = V[indices[0]]
						}
						if indices[1] >= 0 {
							vb = V[indices[1]]
						}
						// i_L(t) = i_L(t-dt) + dt/L * (V_a - V_b) (trapezoidal average)
						vPrevA := 0.0
						vPrevB := 0.0
						if indices[0] >= 0 {
							vPrevA = V_prev[indices[0]]
						}
						if indices[1] >= 0 {
							vPrevB = V_prev[indices[1]]
						}
						inductorCurrents[ci.comp.ID] = inductorCurrents[ci.comp.ID] +
							(currentDt/ci.comp.Value.Value)*0.5*((vPrevA-vPrevB)+(va-vb))
					}
				}
			}

			// Advance time
			V_prev = make([]float64, n)
			copy(V_prev, V[:n])
			t += currentDt
			stepCount++

			// Adaptive step size control using local truncation error
			if adaptive && stepCount > 1 {
				// Estimate LTE: compare Backward Euler (1st order) with Trapezoidal (2nd order)
				// If LTE is small, increase step; if large, decrease
				maxLTE := 0.0
				for i := 0; i < n; i++ {
					// Use the difference as a rough error indicator
					// For proper LTE we'd need two solutions; approximate with voltage change rate
					if len(nodeData[i]) >= 2 {
						prev := nodeData[i][len(nodeData[i])-2].Y
						curr := nodeData[i][len(nodeData[i])-1].Y
						dV := math.Abs(curr - prev)
						// Normalized error estimate
						scale := math.Max(math.Abs(curr), 1.0)
						ltEst := dV / scale
						if ltEst > maxLTE {
							maxLTE = ltEst
						}
					}
				}

				if maxLTE > 0 {
					// Optimal step: dt_new = dt * (tol / LTE)^(1/2)
					optimalDt := currentDt * math.Sqrt(truncTol/maxLTE)
					optimalDt = math.Min(optimalDt, maxStep)
					optimalDt = math.Max(optimalDt, minStep)
					// Smooth step change (limit to 2x increase, 0.5x decrease)
					if optimalDt > currentDt {
						currentDt = math.Min(optimalDt, currentDt*2)
					} else {
						currentDt = math.Max(optimalDt, currentDt*0.5)
					}
				}
			}
		}

		// Build result channels
		channels := make([]types.SimulationChannel, 0, n+m)
		for i, node := range nonGroundNodes {
			channels = append(channels, types.SimulationChannel{
				Name:    node.Name,
				NodeID:  node.ID,
				Color:   nodeColor(i),
				Visible: true,
				Data:    nodeData[i],
			})
		}

		// Add voltage source current channels
		for i, vs := range vsources {
			if i < len(vsrcCurrentData) && len(vsrcCurrentData[i]) > 0 {
				channels = append(channels, types.SimulationChannel{
					Name:    fmt.Sprintf("I(%s)", vs.Name),
					NodeID:  vs.ID,
					Color:   nodeColor(n + i),
					Visible: false,
					Data:    vsrcCurrentData[i],
				})
			}
		}

		resultCh <- &types.SimulationResult{
			ProjectID:    project.ID,
			Timestamp:    time.Now(),
			AnalysisType: types.AnalysisTransient,
			Channels:     channels,
			Status:       types.StatusCompleted,
		}
	}()

	return resultCh, nil
}

// solveTransientStep solves one time step with Newton-Raphson iteration for nonlinear components.
// Returns the solution vector V and whether NR converged.
func solveTransientStep(
	compInfos []compInfo,
	V_prev []float64,
	inductorCurrents map[string]float64,
	adcStates map[string]*ADCInternalState,
	dacStates map[string]*DACInternalState,
	n, m, size int,
	t, dt float64,
) ([]float64, bool) {
	// Initial guess: previous solution
	V := make([]float64, size)
	copy(V, V_prev)

	converged := false

	for iter := 0; iter < defaultMaxIter; iter++ {
		// Build MNA matrix and RHS
		M := make([][]float64, size)
		b := make([]float64, size)
		for i := range M {
			M[i] = make([]float64, size)
		}

		// Stamp components
		vsrcIdx := 0
		for _, ci := range compInfos {
			comp := ci.comp
			indices := ci.indices
			switch comp.Type {
			case types.ComponentResistor:
				stampResistorDC(M, comp, indices)
			case types.ComponentCapacitor:
				stampCapacitorTransient(M, b, comp, indices, dt, V_prev)
			case types.ComponentInductor:
				iLPrev := inductorCurrents[comp.ID]
				stampInductorTransient(M, b, comp, indices, dt, iLPrev)
			case types.ComponentDCSource:
				stampVoltageSourceTransient(M, b, comp, indices, n, vsrcIdx, comp.Value.Value)
				vsrcIdx++
			case types.ComponentACSource:
				v := comp.Value.Value * math.Sin(2*math.Pi*getParamFreq(comp)*t+getParamPhase(comp))
				stampVoltageSourceTransient(M, b, comp, indices, n, vsrcIdx, v)
				vsrcIdx++
			case types.ComponentVoltageSource:
				stampVoltageSourceTransient(M, b, comp, indices, n, vsrcIdx, comp.Value.Value)
				vsrcIdx++
			case types.ComponentDiode:
				stampDiodeTransientNR(M, b, comp, indices, V)
			case types.ComponentBJTNPN, types.ComponentBJTPNP:
				stampBJTTransientNR(M, b, comp, indices, V)
			case types.ComponentMOSFETNMOS, types.ComponentMOSFETPMOS:
				stampMOSFETTransientNR(M, b, comp, indices, V)
			case types.ComponentOpAmp:
				stampOpAmpDC(M, b, comp, indices, n, vsrcIdx)
				vsrcIdx++
			case types.ComponentCurrentSource:
				stampCurrentSourceTransient(M, b, comp, indices, t)
			case types.ComponentADC:
				stampADCTransient(M, b, comp, indices, V, t, dt, adcStates)
			case types.ComponentDAC:
				stampDACTransient(M, b, comp, indices, V, t, dt, dacStates)
			}
		}

		// Solve
		VNew, err := gaussianElimination(M, b)
		if err != nil {
			// Singular matrix - return best guess
			return V, false
		}

		// Check convergence
		maxDiff := 0.0
		for i := 0; i < n; i++ {
			diff := math.Abs(VNew[i] - V[i])
			scale := math.Max(math.Abs(VNew[i]), 1.0)
			if diff/scale > maxDiff {
				maxDiff = diff / scale
			}
		}

		V = VNew

		if maxDiff < defaultNRTol {
			converged = true
			break
		}

		// Damping for stability
		if defaultDampFactor < 1.0 {
			for i := range V {
				V[i] = V[i]*defaultDampFactor + V_prev[i]*(1-defaultDampFactor)
			}
		}
	}

	return V, converged
}

// stampDiodeTransientNR stamps a diode using Shockley equation with Newton-Raphson linearization.
// I_D = Is * (exp(V_D / (n*Vt)) - 1)
// Linearized: G_eq = dI/dV, I_eq = I_D - G_eq * V_D
//
// Port 0 = anode, Port 1 = cathode.
func stampDiodeTransientNR(M [][]float64, b []float64, comp types.Component, indices []int, V []float64) {
	if len(indices) < 2 {
		return
	}
	na, nc := indices[0], indices[1] // anode, cathode

	// Diode parameters
	Is := 1e-14   // saturation current (A)
	nF := 1.0     // ideality factor
	Vt := 0.02585 // thermal voltage at 300K

	// Get current voltage across diode
	va := 0.0
	vc := 0.0
	if na >= 0 && na < len(V) {
		va = V[na]
	}
	if nc >= 0 && nc < len(V) {
		vc = V[nc]
	}
	vd := va - vc

	// Clamp Vd to avoid overflow
	vdMax := nF * Vt * 40 // exp(40) ~ 1.6e17
	if vd > vdMax {
		vd = vdMax
	}
	if vd < -5*vdMax {
		vd = -5 * vdMax
	}

	// Shockley equation
	expVd := math.Exp(vd / (nF * Vt))
	iD := Is * (expVd - 1)

	// Small-signal conductance (derivative)
	gm := Is / (nF * Vt) * expVd

	// Companion model: current source Ieq = iD - gm*vd
	ieq := iD - gm*vd

	// Stamp conductance (gm in parallel)
	if na >= 0 {
		M[na][na] += gm
	}
	if nc >= 0 {
		M[nc][nc] += gm
	}
	if na >= 0 && nc >= 0 {
		M[na][nc] -= gm
		M[nc][na] -= gm
	}

	// Stamp current source (flows from anode to cathode)
	if na >= 0 {
		b[na] -= ieq
	}
	if nc >= 0 {
		b[nc] += ieq
	}
}

// stampBJTTransientNR stamps a BJT using simplified Ebers-Moll with NR.
// NPN: Ic = Is*(exp(Vbe/Vt) - 1), Ib = Ic/beta
// Port 0 = base, Port 1 = collector, Port 2 = emitter.
func stampBJTTransientNR(M [][]float64, b []float64, comp types.Component, indices []int, V []float64) {
	if len(indices) < 3 {
		return
	}
	nb := indices[0] // base
	nc := indices[1] // collector
	ne := indices[2] // emitter

	beta := comp.Value.Value
	if beta <= 0 {
		beta = 100
	}

	Is := 1e-16
	Vt := 0.02585

	// Get Vbe
	vb := 0.0
	ve := 0.0
	if nb >= 0 && nb < len(V) {
		vb = V[nb]
	}
	if ne >= 0 && ne < len(V) {
		ve = V[ne]
	}
	vbe := vb - ve

	// Clamp
	vbeMax := Vt * 40
	if vbe > vbeMax {
		vbe = vbeMax
	}
	if vbe < -vbeMax*5 {
		vbe = -vbeMax * 5
	}

	expVbe := math.Exp(vbe / Vt)
	ic := Is * (expVbe - 1)
	ib := ic / beta

	// Transconductance
	gm := Is / Vt * expVbe
	gpi := gm / beta // base-emitter conductance

	// Stamp base-emitter conductance
	if nb >= 0 {
		M[nb][nb] += gpi
	}
	if ne >= 0 {
		M[ne][ne] += gpi
	}
	if nb >= 0 && ne >= 0 {
		M[nb][ne] -= gpi
		M[ne][nb] -= gpi
	}

	// Stamp collector current source: Ic = gm * Vbe (VCCS)
	// From collector to emitter, controlled by Vbe
	if nc >= 0 && nb >= 0 {
		M[nc][nb] += gm
	}
	if nc >= 0 && ne >= 0 {
		M[nc][ne] -= gm
	}
	if ne >= 0 && nb >= 0 {
		M[ne][nb] -= gm
	}
	if ne >= 0 {
		M[ne][ne] += gm
	}

	// Companion current source
	ieq := ic - gm*vbe
	ieqBase := ib - gpi*vbe

	if nc >= 0 {
		b[nc] -= ieq
	}
	if ne >= 0 {
		b[ne] += ieq
	}
	if nb >= 0 {
		b[nb] += ieqBase
	}
	if ne >= 0 {
		b[ne] -= ieqBase
	}
}

// stampMOSFETTransientNR stamps a MOSFET using simplified Shockley model with NR.
// Port 0 = gate, Port 1 = drain, Port 2 = source.
func stampMOSFETTransientNR(M [][]float64, b []float64, comp types.Component, indices []int, V []float64) {
	if len(indices) < 3 {
		return
	}
	ng := indices[0] // gate
	nd := indices[1] // drain
	ns := indices[2] // source

	kn := comp.Value.Value * 1e-3 // transconductance parameter (convert mA/V² to A/V²)
	if kn <= 0 {
		kn = 1e-3
	}
	Vth := 1.0 // threshold voltage (V)
	lambda := 0.02 // channel-length modulation

	// Get Vgs and Vds
	vg := 0.0
	vd := 0.0
	vs := 0.0
	if ng >= 0 && ng < len(V) {
		vg = V[ng]
	}
	if nd >= 0 && nd < len(V) {
		vd = V[nd]
	}
	if ns >= 0 && ns < len(V) {
		vs = V[ns]
	}

	vgs := vg - vs
	vds := vd - vs

	// Operating region
	var id, gm, gds float64
	if vgs < Vth {
		// Cutoff
		id = 0
		gm = 0
		gds = 1e-12 // small leakage
	} else if vds < vgs-Vth {
		// Linear region
		id = kn * ((vgs-Vth)*vds - 0.5*vds*vds) * (1 + lambda*vds)
		gm = kn * vds * (1 + lambda*vds)
		gds = kn*((vgs-Vth)-vds)*(1+lambda*vds) + kn*((vgs-Vth)*vds-0.5*vds*vds)*lambda
	} else {
		// Saturation region
		vov := vgs - Vth
		id = 0.5 * kn * vov * vov * (1 + lambda*vds)
		gm = kn * vov * (1 + lambda*vds)
		gds = 0.5 * kn * vov * vov * lambda
	}

	// Ensure positive conductances
	if gds < 1e-12 {
		gds = 1e-12
	}
	if gm < 0 {
		gm = 0
	}

	// Stamp drain-source conductance
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

	// Stamp VCCS: Id = gm * Vgs (drain current from drain to source)
	if nd >= 0 && ng >= 0 {
		M[nd][ng] += gm
	}
	if nd >= 0 && ns >= 0 {
		M[nd][ns] -= gm
	}
	if ns >= 0 && ng >= 0 {
		M[ns][ng] -= gm
	}
	if ns >= 0 {
		M[ns][ns] += gm
	}

	// Companion current source
	ieq := id - gm*vgs - gds*vds
	if nd >= 0 {
		b[nd] -= ieq
	}
	if ns >= 0 {
		b[ns] += ieq
	}
}

// stampCurrentSourceTransient stamps an independent current source for transient analysis.
func stampCurrentSourceTransient(M [][]float64, b []float64, comp types.Component, indices []int, t float64) {
	if len(indices) < 2 {
		return
	}
	np, nn := indices[0], indices[1]
	current := comp.Value.Value

	// If AC params, apply sinusoidal
	if comp.Params != nil {
		if freq, ok := comp.Params["frequency"].(float64); ok {
			phase := 0.0
			if p, ok := comp.Params["phase"].(float64); ok {
				phase = p
			}
			current = current * math.Sin(2*math.Pi*freq*t+phase)
		}
	}

	if np >= 0 {
		b[np] -= current
	}
	if nn >= 0 {
		b[nn] += current
	}
}

// stampCapacitorTransient stamps Backward Euler companion model for a capacitor.
// I_eq = C/dt * V_prev(a,b), G_eq = C/dt
func stampCapacitorTransient(M [][]float64, b []float64, comp types.Component, indices []int, dt float64, V_prev []float64) {
	if len(indices) < 2 || comp.Value.Value == 0 {
		return
	}
	na, nb := indices[0], indices[1]
	C := comp.Value.Value
	geq := C / dt

	va := 0.0
	vb := 0.0
	if na >= 0 && na < len(V_prev) {
		va = V_prev[na]
	}
	if nb >= 0 && nb < len(V_prev) {
		vb = V_prev[nb]
	}
	ieq := geq * (va - vb)

	if na >= 0 {
		M[na][na] += geq
	}
	if nb >= 0 {
		M[nb][nb] += geq
	}
	if na >= 0 && nb >= 0 {
		M[na][nb] -= geq
		M[nb][na] -= geq
	}

	if na >= 0 {
		b[na] += ieq
	}
	if nb >= 0 {
		b[nb] -= ieq
	}
}

// stampInductorTransient stamps Backward Euler companion model for an inductor.
func stampInductorTransient(M [][]float64, b []float64, comp types.Component, indices []int, dt float64, iLPrev float64) {
	if len(indices) < 2 || comp.Value.Value == 0 {
		return
	}
	na, nb := indices[0], indices[1]
	L := comp.Value.Value
	geq := dt / L

	ieq := iLPrev

	if na >= 0 {
		M[na][na] += geq
	}
	if nb >= 0 {
		M[nb][nb] += geq
	}
	if na >= 0 && nb >= 0 {
		M[na][nb] -= geq
		M[nb][na] -= geq
	}

	if na >= 0 {
		b[na] += ieq
	}
	if nb >= 0 {
		b[nb] -= ieq
	}
}

// stampVoltageSourceTransient stamps a voltage source into the augmented MNA for transient analysis.
func stampVoltageSourceTransient(M [][]float64, b []float64, comp types.Component, indices []int, n int, vsrcIdx int, voltage float64) {
	if len(indices) < 2 {
		return
	}
	np, nn := indices[0], indices[1]
	col := n + vsrcIdx

	if np >= 0 {
		M[np][col] += 1
		M[col][np] += 1
	}
	if nn >= 0 {
		M[nn][col] -= 1
		M[col][nn] -= 1
	}
	b[col] += voltage
}

// getParamFreq extracts frequency from component params, defaulting to 1000 Hz.
func getParamFreq(comp types.Component) float64 {
	if comp.Params != nil {
		if f, ok := comp.Params["frequency"].(float64); ok {
			return f
		}
		if f, ok := comp.Params["freq"].(float64); ok {
			return f
		}
	}
	return 1000
}

// getParamPhase extracts phase from component params in radians, defaulting to 0.
func getParamPhase(comp types.Component) float64 {
	if comp.Params != nil {
		if p, ok := comp.Params["phase"].(float64); ok {
			return p
		}
	}
	return 0
}
