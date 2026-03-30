package engine

import (
	"testing"

	"chip-sim/pkg/types"
)

func TestDCEngine_Validate(t *testing.T) {
	engine := NewDCEngine()

	t.Run("nil project", func(t *testing.T) {
		if err := engine.Validate(nil); err == nil {
			t.Error("expected error for nil project")
		}
	})

	t.Run("no ground node", func(t *testing.T) {
		project := &types.CircuitProject{
			Nodes: []types.CircuitNode{
				{Name: "N1", Type: types.NodeNormal},
			},
			Components: []types.Component{
				{Type: types.ComponentResistor},
			},
		}
		if err := engine.Validate(project); err != ErrNoGroundNode {
			t.Errorf("expected ErrNoGroundNode, got %v", err)
		}
	})

	t.Run("no components", func(t *testing.T) {
		project := &types.CircuitProject{
			Nodes: []types.CircuitNode{
				{Name: "GND", Type: types.NodeGround},
				{Name: "N1", Type: types.NodeNormal},
			},
		}
		if err := engine.Validate(project); err == nil {
			t.Error("expected error for no components")
		}
	})

	t.Run("valid circuit", func(t *testing.T) {
		project := &types.CircuitProject{
			Nodes: []types.CircuitNode{
				{Name: "GND", Type: types.NodeGround},
				{Name: "N1", Type: types.NodeNormal},
			},
			Components: []types.Component{
				{Type: types.ComponentResistor, Value: types.ComponentValue{Value: 1000, Unit: "Ω"}},
			},
		}
		if err := engine.Validate(project); err != nil {
			t.Errorf("unexpected error: %v", err)
		}
	})
}

func TestGaussianElimination(t *testing.T) {
	t.Run("simple 2x2 system", func(t *testing.T) {
		// 2x + y = 5
		// x + 3y = 10
		// Solution: x = 1, y = 3
		A := [][]float64{
			{2, 1},
			{1, 3},
		}
		b := []float64{5, 10}

		x, err := gaussianElimination(A, b)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		tolerance := 1e-10
		if abs(x[0]-1.0) > tolerance || abs(x[1]-3.0) > tolerance {
			t.Errorf("expected [1, 3], got [%v, %v]", x[0], x[1])
		}
	})

	t.Run("singular matrix", func(t *testing.T) {
		A := [][]float64{
			{1, 1},
			{1, 1},
		}
		b := []float64{2, 3}

		_, err := gaussianElimination(A, b)
		if err != ErrSingularMatrix {
			t.Errorf("expected ErrSingularMatrix, got %v", err)
		}
	})
}

func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}
