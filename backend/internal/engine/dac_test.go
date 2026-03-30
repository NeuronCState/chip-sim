package engine

import (
	"math"
	"testing"

	"chip-sim/pkg/types"
)

// ==================== DAC 配置测试 ====================

func TestDefaultDACConfig(t *testing.T) {
	cfg := DefaultDACConfig()
	if cfg.Resolution != 12 {
		t.Errorf("默认分辨率应为 12 位，实际 %d", cfg.Resolution)
	}
	if cfg.VRefHigh != 3.3 {
		t.Errorf("默认 VRefHigh 应为 3.3V，实际 %v", cfg.VRefHigh)
	}
	if cfg.VRefLow != 0 {
		t.Errorf("默认 VRefLow 应为 0V，实际 %v", cfg.VRefLow)
	}
	if cfg.SettlingTime != 1e-6 {
		t.Errorf("默认建立时间应为 1μs，实际 %v", cfg.SettlingTime)
	}
}

func TestDACConfigFromComponent(t *testing.T) {
	comp := types.Component{
		ID:   "test-dac",
		Type: types.ComponentType("dac"),
		Name: "dac1",
		Value: types.ComponentValue{
			Value: 5.0,
			Unit:  "V",
		},
		Params: map[string]any{
			"resolution":   16.0,
			"settlingTime": 5e-6,
			"vRefLow":      -2.5,
			"inl":          1.0,
			"dnl":          0.5,
		},
	}
	cfg := DACConfigFromComponent(comp)
	if cfg.Resolution != 16 {
		t.Errorf("Resolution = %d, want 16", cfg.Resolution)
	}
	if cfg.VRefHigh != 5.0 {
		t.Errorf("VRefHigh = %v, want 5.0", cfg.VRefHigh)
	}
	if cfg.VRefLow != -2.5 {
		t.Errorf("VRefLow = %v, want -2.5", cfg.VRefLow)
	}
	if cfg.SettlingTime != 5e-6 {
		t.Errorf("SettlingTime = %v, want 5e-6", cfg.SettlingTime)
	}
	if cfg.INL != 1.0 {
		t.Errorf("INL = %v, want 1.0", cfg.INL)
	}
	if cfg.DNL != 0.5 {
		t.Errorf("DNL = %v, want 0.5", cfg.DNL)
	}
}

func TestDACConfigInvalidResolution(t *testing.T) {
	comp := types.Component{
		ID:   "test-dac",
		Type: types.ComponentType("dac"),
		Name: "dac1",
		Params: map[string]any{
			"resolution": 13.0, // 无效分辨率
		},
	}
	cfg := DACConfigFromComponent(comp)
	if cfg.Resolution != 12 {
		t.Errorf("无效分辨率应回退到 12，实际 %d", cfg.Resolution)
	}
}

// ==================== DAC 转换核心测试 ====================

func TestDACConvert12Bit(t *testing.T) {
	cfg := DACConfig{Resolution: 12, VRefHigh: 3.3, VRefLow: 0}

	tests := []struct {
		name    string
		digital int
		wantV   float64
	}{
		{"零码", 0, 0},
		{"满码", 4095, 3.3},
		{"中间码", 2048, 2048.0 / 4095.0 * 3.3},
		{"1/4码", 1024, 1024.0 / 4095.0 * 3.3},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			v := DACConvert(tt.digital, cfg)
			if math.Abs(v-tt.wantV) > 1e-6 {
				t.Errorf("DACConvert(%d) = %v, want %v", tt.digital, v, tt.wantV)
			}
		})
	}
}

func TestDACConvert8Bit(t *testing.T) {
	cfg := DACConfig{Resolution: 8, VRefHigh: 5.0, VRefLow: 0}

	tests := []struct {
		name    string
		digital int
		wantV   float64
	}{
		{"零码", 0, 0},
		{"满码", 255, 5.0},
		{"中间码", 128, 128.0 / 255.0 * 5.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			v := DACConvert(tt.digital, cfg)
			if math.Abs(v-tt.wantV) > 1e-6 {
				t.Errorf("8-bit DACConvert(%d) = %v, want %v", tt.digital, v, tt.wantV)
			}
		})
	}
}

func TestDACConvert16Bit(t *testing.T) {
	cfg := DACConfig{Resolution: 16, VRefHigh: 3.3, VRefLow: 0}

	tests := []struct {
		name    string
		digital int
		wantV   float64
	}{
		{"零码", 0, 0},
		{"满码", 65535, 3.3},
		{"中间码", 32768, 32768.0 / 65535.0 * 3.3},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			v := DACConvert(tt.digital, cfg)
			if math.Abs(v-tt.wantV) > 1e-9 {
				t.Errorf("16-bit DACConvert(%d) = %v, want %v", tt.digital, v, tt.wantV)
			}
		})
	}
}

// ==================== 边界条件测试 ====================

func TestDACConvertClamping(t *testing.T) {
	cfg := DACConfig{Resolution: 12, VRefHigh: 3.3, VRefLow: 0}

	tests := []struct {
		name    string
		digital int
		wantV   float64
	}{
		{"负值钳位", -10, 0},
		{"超范围钳位", 5000, 3.3},
		{"严重超范围", 100000, 3.3},
		{"严重负值", -100000, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			v := DACConvert(tt.digital, cfg)
			if math.Abs(v-tt.wantV) > 1e-6 {
				t.Errorf("DACConvert(%d) = %v, want %v", tt.digital, v, tt.wantV)
			}
		})
	}
}

func TestDACConvertNegativeRef(t *testing.T) {
	cfg := DACConfig{Resolution: 12, VRefHigh: 1.65, VRefLow: -1.65}

	// 中间码 (2048/4095) 应接近 0V（4095 为奇数，不完全对称）
	midV := DACConvert(2048, cfg)
	// 2048/4095 * 3.3 - 1.65 ≈ 0.0004V
	if math.Abs(midV) > 0.001 {
		t.Errorf("双极性中间码输出 = %v, 应接近 0", midV)
	}

	// 满码应输出 1.65V
	v := DACConvert(4095, cfg)
	if math.Abs(v-1.65) > 1e-6 {
		t.Errorf("双极性满码输出 = %v, want 1.65", v)
	}

	// 零码应输出 -1.65V
	v = DACConvert(0, cfg)
	if math.Abs(v-(-1.65)) > 1e-6 {
		t.Errorf("双极性零码输出 = %v, want -1.65", v)
	}
}

// ==================== 建立时间测试 ====================

func TestDACConvertWithSettlingZeroTime(t *testing.T) {
	// 零建立时间应立即到达目标值
	cfg := DACConfig{Resolution: 12, VRefHigh: 3.3, VRefLow: 0, SettlingTime: 0}
	v := DACConvertWithSettling(2048, cfg, 0, 1e-9)
	expected := DACConvert(2048, cfg)
	if math.Abs(v-expected) > 1e-6 {
		t.Errorf("零建立时间: v = %v, want %v", v, expected)
	}
}

func TestDACConvertWithSettlingExponential(t *testing.T) {
	cfg := DACConfig{Resolution: 12, VRefHigh: 3.3, VRefLow: 0, SettlingTime: 1e-6}

	// 从 0V 到中间值，小 dt 后输出不应完全到达目标
	targetV := DACConvert(2048, cfg)
	v := DACConvertWithSettling(2048, cfg, 0, 1e-7) // dt = 0.1μs < settlingTime
	if v >= targetV {
		t.Errorf("建立过程: v = %v 应小于目标 %v（dt 很小时）", v, targetV)
	}
	if v <= 0 {
		t.Errorf("建立过程: v = %v 应大于 0", v)
	}

	// 大 dt 后应完全到达
	v = DACConvertWithSettling(2048, cfg, 0, 10e-6) // dt >> settlingTime
	if math.Abs(v-targetV) > 1e-6 {
		t.Errorf("充分建立: v = %v, want %v", v, targetV)
	}
}

func TestDACConvertWithSettlingFullStep(t *testing.T) {
	// dt >= 5 * SettlingTime 应直接返回目标值
	cfg := DACConfig{Resolution: 12, VRefHigh: 3.3, VRefLow: 0, SettlingTime: 1e-6}
	v := DACConvertWithSettling(4095, cfg, 0, 5e-6)
	expected := 3.3
	if math.Abs(v-expected) > 1e-6 {
		t.Errorf("大步长建立: v = %v, want %v", v, expected)
	}
}

// ==================== 辅助函数测试 ====================

func TestDACMaxCode(t *testing.T) {
	tests := []struct {
		resolution int
		wantMax    int
	}{
		{8, 255},
		{10, 1023},
		{12, 4095},
		{16, 65535},
	}
	for _, tt := range tests {
		cfg := DACConfig{Resolution: tt.resolution}
		got := DACMaxCode(cfg)
		if got != tt.wantMax {
			t.Errorf("DACMaxCode(%d-bit) = %d, want %d", tt.resolution, got, tt.wantMax)
		}
	}
}

func TestDACQuantizationStep(t *testing.T) {
	cfg := DACConfig{Resolution: 12, VRefHigh: 3.3, VRefLow: 0}
	step := DACQuantizationStep(cfg)
	expected := 3.3 / 4095.0
	if math.Abs(step-expected) > 1e-9 {
		t.Errorf("QuantizationStep = %v, want %v", step, expected)
	}
}

// ==================== DAC 内部状态测试 ====================

func TestDACInternalStateInit(t *testing.T) {
	state := &DACInternalState{
		Config:          DefaultDACConfig(),
		LastDigitalVal:  0,
		LastOutputVolt:  0,
		LastConvertTime: 0,
	}
	if state.Config.Resolution != 12 {
		t.Errorf("State config resolution = %d, want 12", state.Config.Resolution)
	}
}

// ==================== 多分辨率一致性测试 ====================

func TestDACAllResolutions(t *testing.T) {
	resolutions := []int{8, 10, 12, 16}
	for _, res := range resolutions {
		cfg := DACConfig{Resolution: res, VRefHigh: 3.3, VRefLow: 0}
		maxCode := DACMaxCode(cfg)

		// 零码应输出 0V
		v := DACConvert(0, cfg)
		if v != 0 {
			t.Errorf("%d-bit: DACConvert(0) = %v, want 0", res, v)
		}

		// 满码应输出 VRefHigh
		v = DACConvert(maxCode, cfg)
		if math.Abs(v-3.3) > 1e-9 {
			t.Errorf("%d-bit: DACConvert(%d) = %v, want 3.3", res, maxCode, v)
		}

		// 中间码应输出 VRefHigh/2
		midCode := maxCode / 2
		v = DACConvert(midCode, cfg)
		expected := float64(midCode) / float64(maxCode) * 3.3
		if math.Abs(v-expected) > 1e-9 {
			t.Errorf("%d-bit: DACConvert(%d) = %v, want %v", res, midCode, v, expected)
		}
	}
}
