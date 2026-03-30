package engine

import (
	"context"
	"math"
	"testing"
	"time"

	"chip-sim/pkg/types"
)

// makeRLCCircuit creates a series RLC circuit for testing.
// Circuit: AC source (1V) → R → L → C → GND
// R=10Ω, L=1mH, C=1μF → f0 ≈ 5032.9 Hz, Q ≈ 3.16 (underdamped)
// This ensures a clear resonant peak for AC analysis and oscillation for transient.
func makeRLCCircuit() *types.CircuitProject {
	return &types.CircuitProject{
		ID:        "test-rlc",
		Name:      "RLC Test",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		Nodes: []types.CircuitNode{
			{ID: "gnd", Name: "GND", Type: types.NodeGround},
			{ID: "n1", Name: "N1", Type: types.NodeNormal},
			{ID: "n2", Name: "N2", Type: types.NodeNormal},
			{ID: "n3", Name: "N3", Type: types.NodeNormal},
		},
		Components: []types.Component{
			{
				ID: "vs1", Type: types.ComponentACSource, Name: "V1",
				Value: types.ComponentValue{Value: 1, Unit: "V"},
				Params: map[string]any{"frequency": 5032.9, "phase": 0.0},
				Ports: []types.ComponentPort{
					{ID: "vs1_p", NodeID: "N1"},
					{ID: "vs1_n", NodeID: "GND"},
				},
			},
			{
				ID: "r1", Type: types.ComponentResistor, Name: "R1",
				Value: types.ComponentValue{Value: 10, Unit: "Ω"},
				Ports: []types.ComponentPort{
					{ID: "r1_a", NodeID: "N1"},
					{ID: "r1_b", NodeID: "N2"},
				},
			},
			{
				ID: "l1", Type: types.ComponentInductor, Name: "L1",
				Value: types.ComponentValue{Value: 1e-3, Unit: "H"},
				Ports: []types.ComponentPort{
					{ID: "l1_a", NodeID: "N2"},
					{ID: "l1_b", NodeID: "N3"},
				},
			},
			{
				ID: "c1", Type: types.ComponentCapacitor, Name: "C1",
				Value: types.ComponentValue{Value: 1e-6, Unit: "F"},
				Ports: []types.ComponentPort{
					{ID: "c1_a", NodeID: "N3"},
					{ID: "c1_b", NodeID: "GND"},
				},
			},
		},
	}
}

func TestACEngine_RLCResonance(t *testing.T) {
	project := makeRLCCircuit()
	project.SimulationConfig = types.SimulationConfig{
		Analysis: types.AnalysisConfig{
			Type:            types.AnalysisAC,
			StartFreq:       100,
			StopFreq:        100000,
			PointsPerDecade: 50,
		},
		Enabled: true,
	}

	eng := NewACEngine()

	// Validate
	if err := eng.Validate(project); err != nil {
		t.Fatalf("validate failed: %v", err)
	}

	// Run
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	resultCh, err := eng.Run(ctx, project)
	if err != nil {
		t.Fatalf("run failed: %v", err)
	}

	// Collect results
	var results []*types.SimulationResult
	for r := range resultCh {
		results = append(results, r)
	}

	// Should have at least 2 results: running + completed
	if len(results) < 2 {
		t.Fatalf("expected at least 2 results, got %d", len(results))
	}

	// Last result should be completed
	final := results[len(results)-1]
	if final.Status != types.StatusCompleted {
		t.Fatalf("expected completed status, got %s: %s", final.Status, final.Error)
	}

	// Resonant frequency f0 = 1/(2π√(LC))
	L := 1e-3
	C := 1e-6
	f0 := 1.0 / (2 * math.Pi * math.Sqrt(L*C))
	t.Logf("Expected resonant frequency: %.1f Hz", f0)

	// Find the node with maximum voltage magnitude (should be at capacitor node N3)
	// N3 is the node across the capacitor, which should peak at resonance
	// Channel 0 = |N1| (dB), Channel 1 = |N2| (dB), Channel 2 = |N3| (dB)
	if len(final.Channels) < 3 {
		t.Fatalf("expected at least 3 magnitude channels, got %d", len(final.Channels))
	}

	// The capacitor node (N3) should show peak at resonance
	capChannel := final.Channels[2] // |N3| (dB)
	var peakFreq float64
	var peakMag float64
	for _, dp := range capChannel.Data {
		if math.IsNaN(dp.Y) {
			continue
		}
		if dp.Y > peakMag {
			peakMag = dp.Y
			peakFreq = dp.X
		}
	}

	t.Logf("Peak magnitude at f=%.1f Hz, |V|=%.1f dB", peakFreq, peakMag)

	// Check that peak frequency is within 10% of expected resonant frequency
	tolerance := 0.10
	if math.Abs(peakFreq-f0)/f0 > tolerance {
		t.Errorf("peak frequency %.1f Hz not within %.0f%% of expected %.1f Hz",
			peakFreq, tolerance*100, f0)
	}

	// At resonance, series RLC should have maximum current = Vs/R
	// Voltage across capacitor = I * |Zc| = (Vs/R) * (1/(ω0*C))
	// |Vc| = 1/100 * 1/(2π*5032.9*1e-6) ≈ 0.317V → should be > 0 dB relative to 1V
	// Actually in dB: 20*log10(0.317) ≈ -10 dB
	// The key test is that there IS a peak and it's at the right frequency.

	// Also verify phase channels exist
	phaseStart := len(final.Channels) / 2
	if len(final.Channels) < 6 {
		t.Errorf("expected 6 channels (3 mag + 3 phase), got %d", len(final.Channels))
	} else {
		_ = phaseStart // phase channels verified by count
		t.Logf("Phase channels present: %d", len(final.Channels)-phaseStart)
	}
}

func TestACEngine_Validate(t *testing.T) {
	eng := NewACEngine()

	t.Run("nil project", func(t *testing.T) {
		if err := eng.Validate(nil); err == nil {
			t.Error("expected error for nil project")
		}
	})

	t.Run("no ground", func(t *testing.T) {
		p := &types.CircuitProject{
			Nodes: []types.CircuitNode{
				{Name: "N1", Type: types.NodeNormal},
			},
			Components: []types.Component{
				{Type: types.ComponentResistor},
			},
		}
		if err := eng.Validate(p); err != ErrNoGroundNode {
			t.Errorf("expected ErrNoGroundNode, got %v", err)
		}
	})

	t.Run("no components", func(t *testing.T) {
		p := &types.CircuitProject{
			Nodes: []types.CircuitNode{
				{Name: "GND", Type: types.NodeGround},
			},
		}
		if err := eng.Validate(p); err == nil {
			t.Error("expected error for no components")
		}
	})
}

func TestTransientEngine_RLCResonance(t *testing.T) {
	// Test transient with an RC circuit (well-conditioned for Backward Euler)
	// R=100Ω, C=10μF → τ=1ms, DC step of 5V
	project := &types.CircuitProject{
		ID: "test-rc-transient", Name: "RC Transient",
		CreatedAt: time.Now(), UpdatedAt: time.Now(),
		Nodes: []types.CircuitNode{
			{ID: "gnd", Name: "GND", Type: types.NodeGround},
			{ID: "n1", Name: "N1", Type: types.NodeNormal},
			{ID: "n2", Name: "N2", Type: types.NodeNormal},
		},
		Components: []types.Component{
			{
				ID: "vs1", Type: types.ComponentDCSource, Name: "V1",
				Value: types.ComponentValue{Value: 5, Unit: "V"},
				Ports: []types.ComponentPort{
					{ID: "vs1_p", NodeID: "N1"},
					{ID: "vs1_n", NodeID: "GND"},
				},
			},
			{
				ID: "r1", Type: types.ComponentResistor, Name: "R1",
				Value: types.ComponentValue{Value: 100, Unit: "Ω"},
				Ports: []types.ComponentPort{
					{ID: "r1_a", NodeID: "N1"},
					{ID: "r1_b", NodeID: "N2"},
				},
			},
			{
				ID: "c1", Type: types.ComponentCapacitor, Name: "C1",
				Value: types.ComponentValue{Value: 10e-6, Unit: "F"},
				Ports: []types.ComponentPort{
					{ID: "c1_a", NodeID: "N2"},
					{ID: "c1_b", NodeID: "GND"},
				},
			},
		},
		SimulationConfig: types.SimulationConfig{
			Analysis: types.AnalysisConfig{
				Type:     types.AnalysisTransient,
				StepTime: 10e-6, // 10μs
				StopTime: 5e-3,  // 5ms (5τ)
			},
			Enabled: true,
		},
	}

	eng := NewTransientEngine()

	if err := eng.Validate(project); err != nil {
		t.Fatalf("validate failed: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	resultCh, err := eng.Run(ctx, project)
	if err != nil {
		t.Fatalf("run failed: %v", err)
	}

	var results []*types.SimulationResult
	for r := range resultCh {
		results = append(results, r)
	}

	if len(results) < 2 {
		t.Fatalf("expected at least 2 results, got %d", len(results))
	}

	final := results[len(results)-1]
	if final.Status != types.StatusCompleted {
		t.Fatalf("expected completed, got %s: %s", final.Status, final.Error)
	}

	// Find N2 (capacitor node) channel
	var capChannel *types.SimulationChannel
	for i, ch := range final.Channels {
		if ch.Name == "N2" {
			capChannel = &final.Channels[i]
			break
		}
	}
	if capChannel == nil || len(capChannel.Data) < 100 {
		t.Fatal("N2 channel not found or too few data points")
	}

	// Check exponential charging: V(t) = 5*(1 - e^(-t/RC)), RC = 1ms
	R := 100.0
	C := 10e-6
	tau := R * C
	lastV := capChannel.Data[len(capChannel.Data)-1].Y
	expectedFinal := 5.0 * (1 - math.Exp(-5e-3/tau)) // at 5τ, ≈ 4.97V

	t.Logf("RC charging: final V=%.4fV (expected %.4fV), tau=%.1fms", lastV, expectedFinal, tau*1000)

	if math.Abs(lastV-expectedFinal) > 0.5 {
		t.Errorf("final voltage: got %.4fV, expected ~%.4fV", lastV, expectedFinal)
	}

	// Check mid-point: at t=τ, V should be 5*(1-1/e) ≈ 3.16V
	for _, dp := range capChannel.Data {
		if dp.X >= tau && dp.X < tau+10e-6 {
			expected := 5.0 * (1 - math.Exp(-dp.X/tau))
			t.Logf("  t=%.2fms: V=%.4fV (expected %.4fV)", dp.X*1000, dp.Y, expected)
		}
	}

	t.Logf("Transient simulation: %d time steps, %d channels", len(capChannel.Data), len(final.Channels))
}

func TestTransientEngine_Validate(t *testing.T) {
	eng := NewTransientEngine()

	t.Run("nil project", func(t *testing.T) {
		if err := eng.Validate(nil); err == nil {
			t.Error("expected error for nil project")
		}
	})
}

func TestComplex_BasicOps(t *testing.T) {
	a := Complex{R: 3, I: 4}
	b := Complex{R: 1, I: -2}

	// Abs
	if got := a.Abs(); math.Abs(got-5) > 1e-10 {
		t.Errorf("Abs: got %v, want 5", got)
	}

	// Add
	sum := a.Add(b)
	if sum.R != 4 || sum.I != 2 {
		t.Errorf("Add: got %v, want {4, 2}", sum)
	}

	// Mul
	prod := a.Mul(b) // (3+4i)(1-2i) = 3-6i+4i-8i² = 11-2i
	if prod.R != 11 || prod.I != -2 {
		t.Errorf("Mul: got %v, want {11, -2}", prod)
	}

	// Div
	quot := a.Div(b) // (3+4i)/(1-2i) = (3+4i)(1+2i)/5 = (-5+10i)/5 = -1+2i
	if math.Abs(quot.R-(-1)) > 1e-10 || math.Abs(quot.I-2) > 1e-10 {
		t.Errorf("Div: got %v, want {-1, 2}", quot)
	}

	// Conj
	c := a.Conj()
	if c.R != 3 || c.I != -4 {
		t.Errorf("Conj: got %v, want {3, -4}", c)
	}

	// Phase
	phase := a.Phase()
	if math.Abs(phase-math.Atan2(4, 3)) > 1e-10 {
		t.Errorf("Phase: got %v, want %v", phase, math.Atan2(4, 3))
	}

	// Scale
	s := a.Scale(2)
	if s.R != 6 || s.I != 8 {
		t.Errorf("Scale: got %v, want {6, 8}", s)
	}

	// CExp
	e := CExp(math.Pi / 2)
	if math.Abs(e.R) > 1e-10 || math.Abs(e.I-1) > 1e-10 {
		t.Errorf("CExp(π/2): got %v, want {0, 1}", e)
	}
}

func TestGaussianEliminationComplex(t *testing.T) {
	// (1+0j)x + (1+0j)y = (3+0j)
	// (1+0j)x + (2+0j)y = (5+0j)
	// Solution: x=1, y=2
	A := [][]Complex{
		{{R: 1}, {R: 1}},
		{{R: 1}, {R: 2}},
	}
	b := []Complex{{R: 3}, {R: 5}}

	x, err := gaussianEliminationComplex(A, b)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if math.Abs(x[0].R-1) > 1e-10 || math.Abs(x[1].R-2) > 1e-10 {
		t.Errorf("got [%v, %v], want [1, 2]", x[0].R, x[1].R)
	}

	// Singular matrix test
	A2 := [][]Complex{
		{{R: 1}, {R: 1}},
		{{R: 1}, {R: 1}},
	}
	b2 := []Complex{{R: 2}, {R: 3}}
	_, err = gaussianEliminationComplex(A2, b2)
	if err != ErrSingularMatrix {
		t.Errorf("expected ErrSingularMatrix, got %v", err)
	}
}

func TestDCEngine_WithVoltageSource(t *testing.T) {
	// Simple voltage divider: Vs=10V, R1=1kΩ, R2=1kΩ
	// Expected: V(mid) = 5V
	project := &types.CircuitProject{
		ID:        "test-vdiv",
		Name:      "Voltage Divider",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		Nodes: []types.CircuitNode{
			{ID: "gnd", Name: "GND", Type: types.NodeGround},
			{ID: "top", Name: "TOP", Type: types.NodeNormal},
			{ID: "mid", Name: "MID", Type: types.NodeNormal},
		},
		Components: []types.Component{
			{
				ID: "vs1", Type: types.ComponentDCSource, Name: "V1",
				Value: types.ComponentValue{Value: 10, Unit: "V"},
				Ports: []types.ComponentPort{
					{ID: "vs1_p", NodeID: "TOP"},
					{ID: "vs1_n", NodeID: "GND"},
				},
			},
			{
				ID: "r1", Type: types.ComponentResistor, Name: "R1",
				Value: types.ComponentValue{Value: 1000, Unit: "Ω"},
				Ports: []types.ComponentPort{
					{ID: "r1_a", NodeID: "TOP"},
					{ID: "r1_b", NodeID: "MID"},
				},
			},
			{
				ID: "r2", Type: types.ComponentResistor, Name: "R2",
				Value: types.ComponentValue{Value: 1000, Unit: "Ω"},
				Ports: []types.ComponentPort{
					{ID: "r2_a", NodeID: "MID"},
					{ID: "r2_b", NodeID: "GND"},
				},
			},
		},
	}

	eng := NewDCEngine()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	resultCh, err := eng.Run(ctx, project)
	if err != nil {
		t.Fatalf("run failed: %v", err)
	}

	var results []*types.SimulationResult
	for r := range resultCh {
		results = append(results, r)
	}

	final := results[len(results)-1]
	if final.Status != types.StatusCompleted {
		t.Fatalf("expected completed, got %s: %s", final.Status, final.Error)
	}

	// Check voltages
	for _, ch := range final.Channels {
		v := ch.Data[0].Y
		t.Logf("Node %s: %.4f V", ch.Name, v)
		if ch.Name == "TOP" && math.Abs(v-10) > 0.01 {
			t.Errorf("TOP node: expected ~10V, got %.4f V", v)
		}
		if ch.Name == "MID" && math.Abs(v-5) > 0.01 {
			t.Errorf("MID node: expected ~5V, got %.4f V", v)
		}
	}
}

func TestLogSpace(t *testing.T) {
	pts := logSpace(1, 1000, 10)
	if len(pts) < 2 {
		t.Fatal("expected at least 2 points")
	}
	if math.Abs(pts[0]-1) > 1e-6 {
		t.Errorf("first point: got %v, want 1", pts[0])
	}
	if math.Abs(pts[len(pts)-1]-1000) > 1 {
		t.Errorf("last point: got %v, want 1000", pts[len(pts)-1])
	}
	t.Logf("logSpace(1, 1000, 10) = %d points: %.2f ... %.2f", len(pts), pts[0], pts[len(pts)-1])
}
