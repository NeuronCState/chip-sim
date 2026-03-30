package engine

import "math"

// Complex represents a complex number for AC analysis.
type Complex struct {
	R, I float64
}

// Add returns c + other.
func (c Complex) Add(other Complex) Complex {
	return Complex{c.R + other.R, c.I + other.I}
}

// Sub returns c - other.
func (c Complex) Sub(other Complex) Complex {
	return Complex{c.R - other.R, c.I - other.I}
}

// Mul returns c * other.
func (c Complex) Mul(other Complex) Complex {
	return Complex{
		c.R*other.R - c.I*other.I,
		c.R*other.I + c.I*other.R,
	}
}

// Div returns c / other.
func (c Complex) Div(other Complex) Complex {
	denom := other.R*other.R + other.I*other.I
	if denom == 0 {
		return Complex{math.Inf(1), 0}
	}
	return Complex{
		(c.R*other.R + c.I*other.I) / denom,
		(c.I*other.R - c.R*other.I) / denom,
	}
}

// Conj returns the complex conjugate of c.
func (c Complex) Conj() Complex {
	return Complex{c.R, -c.I}
}

// Abs returns the magnitude |c|.
func (c Complex) Abs() float64 {
	return math.Hypot(c.R, c.I)
}

// Phase returns the angle of c in radians.
func (c Complex) Phase() float64 {
	return math.Atan2(c.I, c.R)
}

// Scale returns c * s (scalar multiplication).
func (c Complex) Scale(s float64) Complex {
	return Complex{c.R * s, c.I * s}
}

// CExp returns e^(j*theta) = cos(theta) + j*sin(theta).
func CExp(theta float64) Complex {
	return Complex{math.Cos(theta), math.Sin(theta)}
}
