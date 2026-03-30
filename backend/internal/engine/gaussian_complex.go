package engine

import "fmt"

// gaussianEliminationComplex solves Ax = b for complex-valued systems using
// Gaussian elimination with partial pivot selection.
func gaussianEliminationComplex(A [][]Complex, b []Complex) ([]Complex, error) {
	n := len(b)
	if n == 0 {
		return nil, fmt.Errorf("empty system")
	}
	for i := range A {
		if len(A[i]) != n {
			return nil, fmt.Errorf("matrix dimension mismatch")
		}
	}

	// Build augmented matrix
	aug := make([][]Complex, n)
	for i := range aug {
		aug[i] = make([]Complex, n+1)
		copy(aug[i], A[i])
		aug[i][n] = b[i]
	}

	// Forward elimination with partial pivoting
	for col := 0; col < n; col++ {
		// Find pivot: largest absolute value in column
		maxRow := col
		maxVal := aug[col][col].Abs()
		for row := col + 1; row < n; row++ {
			if v := aug[row][col].Abs(); v > maxVal {
				maxVal = v
				maxRow = row
			}
		}
		aug[col], aug[maxRow] = aug[maxRow], aug[col]

		if aug[col][col].Abs() < 1e-15 {
			return nil, ErrSingularMatrix
		}

		// Eliminate below
		for row := col + 1; row < n; row++ {
			factor := aug[row][col].Div(aug[col][col])
			for j := col; j <= n; j++ {
				aug[row][j] = aug[row][j].Sub(factor.Mul(aug[col][j]))
			}
		}
	}

	// Back substitution
	x := make([]Complex, n)
	for i := n - 1; i >= 0; i-- {
		x[i] = aug[i][n]
		for j := i + 1; j < n; j++ {
			x[i] = x[i].Sub(aug[i][j].Mul(x[j]))
		}
		x[i] = x[i].Div(aug[i][i])
	}

	return x, nil
}
