// Package engine AC 小信号分析引擎
// 实现频率扫描：支持对数/线性扫描、传递函数 H(jω)、Bode 图数据
package engine

import (
	"context"
	"fmt"
	"math"
	"time"

	"chip-sim/pkg/types"
)

// ACEngine AC 频率扫描分析引擎
type ACEngine struct{}

// NewACEngine 创建新的 AC 引擎
func NewACEngine() *ACEngine {
	return &ACEngine{}
}

// Type 返回分析类型
func (e *ACEngine) Type() types.AnalysisType {
	return types.AnalysisAC
}

// Validate 验证电路是否可以进行 AC 分析
func (e *ACEngine) Validate(project *types.CircuitProject) error {
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

// Run 执行 AC 频率扫描分析
//
// 对每个频率点：
//  1. ω = 2πf
//  2. 构建复数导纳矩阵（电阻: 1/R, 电容: jωC, 电感: -j/(ωL)）
//  3. 求解复数 MNA
//  4. 计算每个节点的 |V| (dB) 和相位
//  5. 如果指定输入源和输出节点，计算传递函数 H(jω)
//  6. 输出幅度、相位、Bode 图数据
func (e *ACEngine) Run(ctx context.Context, project *types.CircuitProject) (<-chan *types.SimulationResult, error) {
	if err := e.Validate(project); err != nil {
		return nil, err
	}

	cfg := project.SimulationConfig.Analysis
	startFreq := cfg.StartFreq
	stopFreq := cfg.StopFreq
	ppd := cfg.PointsPerDecade
	numPoints := cfg.NumPoints
	sweepMode := cfg.SweepMode

	if startFreq <= 0 {
		startFreq = 1
	}
	if stopFreq <= startFreq {
		stopFreq = startFreq * 10
	}

	// Default sweep mode is logarithmic
	if sweepMode == "" {
		sweepMode = types.SweepLog
	}
	if sweepMode == types.SweepLog && ppd <= 0 {
		ppd = 10
	}
	if sweepMode == types.SweepLinear && numPoints <= 0 {
		numPoints = 100
	}

	resultCh := make(chan *types.SimulationResult, 1)

	go func() {
		defer close(resultCh)

		resultCh <- &types.SimulationResult{
			ProjectID:    project.ID,
			Timestamp:    time.Now(),
			AnalysisType: types.AnalysisAC,
			Status:       types.StatusRunning,
		}

		// Resolve nodes
		nonGroundNodes, nodeIndex, portNode, err := resolveNodes(project)
		if err != nil {
			sendError(resultCh, project, types.AnalysisAC, err.Error())
			return
		}

		n := len(nonGroundNodes)
		if n == 0 {
			sendError(resultCh, project, types.AnalysisAC, "no non-ground nodes to solve")
			return
		}

		// Collect voltage sources (including AC sources)
		vsources := make([]types.Component, 0)
		acSources := make([]types.Component, 0)
		for _, comp := range project.Components {
			if comp.Type == types.ComponentVoltageSource || comp.Type == types.ComponentDCSource || comp.Type == types.ComponentACSource {
				vsources = append(vsources, comp)
				if comp.Type == types.ComponentACSource {
					acSources = append(acSources, comp)
				}
			}
		}
		m := len(vsources)
		size := n + m

		// Find the input source for transfer function calculation
		var inputSrc *types.Component
		if cfg.InputSource != "" {
			for i, vs := range vsources {
				if vs.ID == cfg.InputSource {
					inputSrc = &vsources[i]
					break
				}
			}
		}
		// Default: first AC source
		if inputSrc == nil && len(acSources) > 0 {
			for i, vs := range vsources {
				if vs.ID == acSources[0].ID {
					inputSrc = &vsources[i]
					break
				}
			}
		}

		// Find output node index for transfer function
		outputNodeIdx := -1
		if cfg.OutputNode != "" {
			if idx, ok := nodeIndex[cfg.OutputNode]; ok {
				outputNodeIdx = idx
			}
		}

		// Generate frequency points
		var frequencies []float64
		if sweepMode == types.SweepLinear {
			frequencies = linSpace(startFreq, stopFreq, numPoints)
		} else {
			frequencies = logSpace(startFreq, stopFreq, ppd)
		}

		// Data accumulators
		magChannels := make([][]types.SimulationDataPoint, n)
		phaseChannels := make([][]types.SimulationDataPoint, n)
		for i := 0; i < n; i++ {
			magChannels[i] = make([]types.SimulationDataPoint, 0, len(frequencies))
			phaseChannels[i] = make([]types.SimulationDataPoint, 0, len(frequencies))
		}

		// Transfer function data
		var tfMagData []types.SimulationDataPoint
		var tfPhaseData []types.SimulationDataPoint
		hasTransferFunc := inputSrc != nil && outputNodeIdx >= 0
		if hasTransferFunc {
			tfMagData = make([]types.SimulationDataPoint, 0, len(frequencies))
			tfPhaseData = make([]types.SimulationDataPoint, 0, len(frequencies))
		}

		// Sweep
		for _, f := range frequencies {
			// Check cancellation
			select {
			case <-ctx.Done():
				sendError(resultCh, project, types.AnalysisAC, "cancelled")
				return
			default:
			}

			omega := 2 * math.Pi * f

			// Build complex MNA matrix
			M := make([][]Complex, size)
			b := make([]Complex, size)
			for i := range M {
				M[i] = make([]Complex, size)
			}

			// Stamp components
			vsrcIdx := 0
			for _, comp := range project.Components {
				indices := resolveNodeIndices(comp, portNode, nodeIndex)
				switch comp.Type {
				case types.ComponentResistor:
					stampResistorAC(M, comp, indices)
				case types.ComponentCapacitor:
					stampCapacitorAC(M, comp, indices, omega)
				case types.ComponentInductor:
					stampInductorAC(M, comp, indices, omega)
				case types.ComponentDCSource:
					// DC source = 0V in AC small-signal
					stampVoltageSourceAC(M, b, comp, indices, n, vsrcIdx, 0)
					vsrcIdx++
				case types.ComponentACSource:
					mag := comp.Value.Value
					if mag == 0 {
						mag = 1.0
					}
					stampVoltageSourceAC(M, b, comp, indices, n, vsrcIdx, mag)
					vsrcIdx++
				case types.ComponentVoltageSource:
					stampVoltageSourceAC(M, b, comp, indices, n, vsrcIdx, 0)
					vsrcIdx++
				case types.ComponentDiode:
					stampDiodeAC(M, comp, indices)
				case types.ComponentBJTNPN, types.ComponentBJTPNP:
					stampBJTAC(M, comp, indices)
				case types.ComponentMOSFETNMOS, types.ComponentMOSFETPMOS:
					stampMOSFETAC(M, comp, indices)
				case types.ComponentOpAmp:
					stampOpAmpAC(M, comp, indices, n, vsrcIdx)
					vsrcIdx++
				}
			}

			// Solve complex MNA
			V, err := gaussianEliminationComplex(M, b)
			if err != nil {
				// Singular at this frequency - output NaN
				for i := 0; i < n; i++ {
					magChannels[i] = append(magChannels[i], types.SimulationDataPoint{X: f, Y: math.NaN()})
					phaseChannels[i] = append(phaseChannels[i], types.SimulationDataPoint{X: f, Y: math.NaN()})
				}
				if hasTransferFunc {
					tfMagData = append(tfMagData, types.SimulationDataPoint{X: f, Y: math.NaN()})
					tfPhaseData = append(tfPhaseData, types.SimulationDataPoint{X: f, Y: math.NaN()})
				}
				continue
			}

			// Extract magnitude (dB) and phase for all nodes
			for i := 0; i < n; i++ {
				mag := V[i].Abs()
				magDB := 20 * math.Log10(mag+1e-30)
				phase := V[i].Phase() * 180 / math.Pi

				magChannels[i] = append(magChannels[i], types.SimulationDataPoint{X: f, Y: magDB})
				phaseChannels[i] = append(phaseChannels[i], types.SimulationDataPoint{X: f, Y: phase})
			}

			// Calculate transfer function H(jω) = V_out / V_in
			if hasTransferFunc {
				// V_in is the voltage source magnitude (already in b vector)
				vIn := Complex{R: inputSrc.Value.Value}
				if vIn.R == 0 {
					vIn.R = 1.0
				}
				vOut := V[outputNodeIdx]
				H := vOut.Div(vIn)

				tfMagDB := 20*math.Log10(H.Abs()+1e-30)
				tfPhaseDeg := H.Phase() * 180 / math.Pi

				tfMagData = append(tfMagData, types.SimulationDataPoint{X: f, Y: tfMagDB})
				tfPhaseData = append(tfPhaseData, types.SimulationDataPoint{X: f, Y: tfPhaseDeg})
			}
		}

		// Build result channels: magnitude channels + phase channels
		channels := make([]types.SimulationChannel, 0, 2*n+2)
		for i, node := range nonGroundNodes {
			channels = append(channels, types.SimulationChannel{
				Name:    fmt.Sprintf("|%s| (dB)", node.Name),
				NodeID:  node.ID,
				Color:   nodeColor(i),
				Visible: true,
				Data:    magChannels[i],
			})
		}
		for i, node := range nonGroundNodes {
			channels = append(channels, types.SimulationChannel{
				Name:    fmt.Sprintf("∠%s (°)", node.Name),
				NodeID:  node.ID,
				Color:   nodeColor(i + n),
				Visible: false,
				Data:    phaseChannels[i],
			})
		}

		// Add transfer function channels (Bode data)
		if hasTransferFunc && len(tfMagData) > 0 {
			channels = append(channels, types.SimulationChannel{
				Name:    "|H(jω)| (dB)",
				NodeID:  "transfer_function",
				Color:   "#ff9f43",
				Visible: true,
				Data:    tfMagData,
			})
			channels = append(channels, types.SimulationChannel{
				Name:    "∠H(jω) (°)",
				NodeID:  "transfer_function",
				Color:   "#ee5a24",
				Visible: false,
				Data:    tfPhaseData,
			})
		}

		resultCh <- &types.SimulationResult{
			ProjectID:    project.ID,
			Timestamp:    time.Now(),
			AnalysisType: types.AnalysisAC,
			Channels:     channels,
			Status:       types.StatusCompleted,
		}
	}()

	return resultCh, nil
}

// linSpace generates n linearly-spaced points between start and stop.
func linSpace(start, stop float64, n int) []float64 {
	if n < 2 {
		n = 2
	}
	if n > 100000 {
		n = 100000
	}
	step := (stop - start) / float64(n-1)
	pts := make([]float64, n)
	for i := 0; i < n; i++ {
		pts[i] = start + float64(i)*step
	}
	return pts
}

// stampDiodeAC stamps a diode in AC analysis using small-signal conductance.
// In AC, the diode is linearized around the DC operating point.
// We use a nominal conductance (gm) based on forward voltage.
func stampDiodeAC(M [][]Complex, comp types.Component, indices []int) {
	if len(indices) < 2 {
		return
	}
	n1, n2 := indices[0], indices[1] // anode, cathode
	// Small-signal conductance gm ≈ Is/(n*Vt) at operating point
	// Use a representative value: gm ≈ 0.0258 S for Vf=0.7V, n=1, Is=1e-14A
	gm := 0.0258
	g := Complex{R: gm}

	if n1 >= 0 {
		M[n1][n1] = M[n1][n1].Add(g)
	}
	if n2 >= 0 {
		M[n2][n2] = M[n2][n2].Add(g)
	}
	if n1 >= 0 && n2 >= 0 {
		M[n1][n2] = M[n1][n2].Sub(g)
		M[n2][n1] = M[n2][n1].Sub(g)
	}
}

// stampBJTAC stamps a BJT in AC using simplified hybrid-pi model.
func stampBJTAC(M [][]Complex, comp types.Component, indices []int) {
	if len(indices) < 3 {
		return
	}
	_ = indices[0] // base
	nc := indices[1] // collector
	ne := indices[2] // emitter

	// Small output conductance
	gCE := Complex{R: 1e-6}

	if nc >= 0 {
		M[nc][nc] = M[nc][nc].Add(gCE)
	}
	if ne >= 0 {
		M[ne][ne] = M[ne][ne].Add(gCE)
	}
	if nc >= 0 && ne >= 0 {
		M[nc][ne] = M[nc][ne].Sub(gCE)
		M[ne][nc] = M[ne][nc].Sub(gCE)
	}
}

// stampMOSFETAC stamps a MOSFET in AC using simplified model.
func stampMOSFETAC(M [][]Complex, comp types.Component, indices []int) {
	if len(indices) < 3 {
		return
	}
	_ = indices[0] // gate
	nd := indices[1] // drain
	ns := indices[2] // source

	gDS := Complex{R: 1e-6}

	if nd >= 0 {
		M[nd][nd] = M[nd][nd].Add(gDS)
	}
	if ns >= 0 {
		M[ns][ns] = M[ns][ns].Add(gDS)
	}
	if nd >= 0 && ns >= 0 {
		M[nd][ns] = M[nd][ns].Sub(gDS)
		M[ns][nd] = M[ns][nd].Sub(gDS)
	}
}

// stampOpAmpAC stamps an op-amp in AC analysis.
func stampOpAmpAC(M [][]Complex, comp types.Component, indices []int, n int, vsrcIdx int) {
	if len(indices) < 3 {
		return
	}
	np := indices[0] // non-inverting (+)
	nn := indices[1] // inverting (-)
	no := indices[2] // output
	col := n + vsrcIdx

	if np >= 0 {
		M[col][np] = M[col][np].Add(Complex{R: 1})
	}
	if nn >= 0 {
		M[col][nn] = M[col][nn].Sub(Complex{R: 1})
	}
	if no >= 0 {
		M[no][no] = M[no][no].Add(Complex{R: 1e-9})
	}
}

// stampCurrentSourceAC stamps a current source into the complex MNA.
func stampCurrentSourceAC(M [][]Complex, b []Complex, comp types.Component, indices []int, current float64) {
	if len(indices) < 2 {
		return
	}
	np, nn := indices[0], indices[1]
	I := Complex{R: current}

	if np >= 0 {
		b[np] = b[np].Sub(I)
	}
	if nn >= 0 {
		b[nn] = b[nn].Add(I)
	}
}

// logSpace generates n logarithmically-spaced points between start and stop.
func logSpace(start, stop float64, ppd int) []float64 {
	if start <= 0 || stop <= start {
		return []float64{start}
	}
	logStart := math.Log10(start)
	logStop := math.Log10(stop)
	numDecades := logStop - logStart
	nPts := int(math.Ceil(numDecades*float64(ppd))) + 1
	if nPts < 2 {
		nPts = 2
	}
	if nPts > 10000 {
		nPts = 10000
	}
	step := (logStop - logStart) / float64(nPts-1)
	pts := make([]float64, nPts)
	for i := 0; i < nPts; i++ {
		pts[i] = math.Pow(10, logStart+float64(i)*step)
	}
	return pts
}

// stampResistorAC stamps a resistor into the complex admittance matrix.
func stampResistorAC(M [][]Complex, comp types.Component, indices []int) {
	if len(indices) < 2 {
		return
	}
	n1, n2 := indices[0], indices[1]
	if comp.Value.Value == 0 {
		return
	}
	g := Complex{R: 1.0 / comp.Value.Value}

	if n1 >= 0 {
		M[n1][n1] = M[n1][n1].Add(g)
	}
	if n2 >= 0 {
		M[n2][n2] = M[n2][n2].Add(g)
	}
	if n1 >= 0 && n2 >= 0 {
		M[n1][n2] = M[n1][n2].Sub(g)
		M[n2][n1] = M[n2][n1].Sub(g)
	}
}

// stampCapacitorAC stamps a capacitor: Y = jωC
func stampCapacitorAC(M [][]Complex, comp types.Component, indices []int, omega float64) {
	if len(indices) < 2 {
		return
	}
	n1, n2 := indices[0], indices[1]
	if comp.Value.Value == 0 {
		return
	}
	y := Complex{I: omega * comp.Value.Value} // jωC

	if n1 >= 0 {
		M[n1][n1] = M[n1][n1].Add(y)
	}
	if n2 >= 0 {
		M[n2][n2] = M[n2][n2].Add(y)
	}
	if n1 >= 0 && n2 >= 0 {
		M[n1][n2] = M[n1][n2].Sub(y)
		M[n2][n1] = M[n2][n1].Sub(y)
	}
}

// stampInductorAC stamps an inductor: Y = 1/(jωL) = -j/(ωL)
func stampInductorAC(M [][]Complex, comp types.Component, indices []int, omega float64) {
	if len(indices) < 2 {
		return
	}
	n1, n2 := indices[0], indices[1]
	if comp.Value.Value == 0 || omega == 0 {
		return
	}
	y := Complex{I: -1.0 / (omega * comp.Value.Value)} // -j/(ωL)

	if n1 >= 0 {
		M[n1][n1] = M[n1][n1].Add(y)
	}
	if n2 >= 0 {
		M[n2][n2] = M[n2][n2].Add(y)
	}
	if n1 >= 0 && n2 >= 0 {
		M[n1][n2] = M[n1][n2].Sub(y)
		M[n2][n1] = M[n2][n1].Sub(y)
	}
}

// stampVoltageSourceAC stamps a voltage source into the augmented complex MNA matrix.
func stampVoltageSourceAC(M [][]Complex, b []Complex, comp types.Component, indices []int, n int, vsrcIdx int, voltage float64) {
	if len(indices) < 2 {
		return
	}
	np, nn := indices[0], indices[1]
	col := n + vsrcIdx

	if np >= 0 {
		M[np][col] = M[np][col].Add(Complex{R: 1})
		M[col][np] = M[col][np].Add(Complex{R: 1})
	}
	if nn >= 0 {
		M[nn][col] = M[nn][col].Sub(Complex{R: 1})
		M[col][nn] = M[col][nn].Sub(Complex{R: 1})
	}
	b[col] = b[col].Add(Complex{R: voltage})
}
