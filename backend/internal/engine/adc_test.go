package engine

import (
	"math"
	"testing"

	"chip-sim/pkg/types"
)

// ==================== ADC 配置测试 ====================

func TestDefaultADCConfig(t *testing.T) {
	cfg := DefaultADCConfig()
	if cfg.Resolution != 12 {
		t.Errorf("默认分辨率应为 12 位，实际 %d", cfg.Resolution)
	}
	if cfg.VRefHigh != 3.3 {
		t.Errorf("默认 VRefHigh 应为 3.3V，实际 %v", cfg.VRefHigh)
	}
	if cfg.VRefLow != 0 {
		t.Errorf("默认 VRefLow 应为 0V，实际 %v", cfg.VRefLow)
	}
	if cfg.SampleRateHz != 100000 {
		t.Errorf("默认采样率应为 100kHz，实际 %v", cfg.SampleRateHz)
	}
	if cfg.InputChannels != 1 {
		t.Errorf("默认通道数应为 1，实际 %d", cfg.InputChannels)
	}
}

func TestADCConfigFromComponent(t *testing.T) {
	comp := types.Component{
		ID:   "test-adc",
		Type: types.ComponentType("adc"),
		Name: "adc1",
		Value: types.ComponentValue{
			Value: 3.3,
			Unit:  "V",
		},
		Params: map[string]any{
			"resolution":  10.0,
			"sampleRate":  44100.0,
			"vRefLow":     -1.0,
			"inl":         0.5,
			"dnl":         0.3,
			"inputChannels": 4.0,
		},
	}
	cfg := ADCConfigFromComponent(comp)
	if cfg.Resolution != 10 {
		t.Errorf("Resolution = %d, want 10", cfg.Resolution)
	}
	if cfg.SampleRateHz != 44100 {
		t.Errorf("SampleRate = %v, want 44100", cfg.SampleRateHz)
	}
	if cfg.VRefHigh != 3.3 {
		t.Errorf("VRefHigh = %v, want 3.3", cfg.VRefHigh)
	}
	if cfg.VRefLow != -1.0 {
		t.Errorf("VRefLow = %v, want -1.0", cfg.VRefLow)
	}
	if cfg.INL != 0.5 {
		t.Errorf("INL = %v, want 0.5", cfg.INL)
	}
	if cfg.DNL != 0.3 {
		t.Errorf("DNL = %v, want 0.3", cfg.DNL)
	}
	if cfg.InputChannels != 4 {
		t.Errorf("InputChannels = %d, want 4", cfg.InputChannels)
	}
}

func TestADCConfigInvalidResolution(t *testing.T) {
	comp := types.Component{
		ID:   "test-adc",
		Type: types.ComponentType("adc"),
		Name: "adc1",
		Params: map[string]any{
			"resolution": 7.0, // 无效分辨率
		},
	}
	cfg := ADCConfigFromComponent(comp)
	if cfg.Resolution != 12 {
		t.Errorf("无效分辨率应回退到 12，实际 %d", cfg.Resolution)
	}
}

// ==================== ADC 量化核心测试 ====================

func TestADCQuantize12Bit(t *testing.T) {
	cfg := ADCConfig{Resolution: 12, VRefHigh: 3.3, VRefLow: 0}

	tests := []struct {
		name     string
		voltage  float64
		wantCode int
	}{
		{"零电压", 0, 0},
		{"满量程", 3.3, 4095},
		{"中间值", 1.65, 2048},
		{"1/4量程", 0.825, 1024},
		{"3/4量程", 2.475, 3071},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			code, _ := ADCQuantize(tt.voltage, cfg)
			if code != tt.wantCode {
				t.Errorf("ADCQuantize(%v) code = %d, want %d", tt.voltage, code, tt.wantCode)
			}
		})
	}
}

func TestADCQuantize8Bit(t *testing.T) {
	cfg := ADCConfig{Resolution: 8, VRefHigh: 5.0, VRefLow: 0}

	tests := []struct {
		name     string
		voltage  float64
		wantCode int
	}{
		{"零电压", 0, 0},
		{"满量程", 5.0, 255},
		{"中间值", 2.5, 128}, // 2.5/5.0 * 255 = 127.5 → rounds to 128
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			code, _ := ADCQuantize(tt.voltage, cfg)
			if code != tt.wantCode {
				t.Errorf("8-bit ADCQuantize(%v) code = %d, want %d", tt.voltage, code, tt.wantCode)
			}
		})
	}
}

func TestADCQuantize16Bit(t *testing.T) {
	cfg := ADCConfig{Resolution: 16, VRefHigh: 3.3, VRefLow: 0}

	tests := []struct {
		name     string
		voltage  float64
		wantCode int
	}{
		{"零电压", 0, 0},
		{"满量程", 3.3, 65535},
		{"中间值", 1.65, 32768}, // 1.65/3.3 * 65535 = 32767.5 → rounds to 32768
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			code, _ := ADCQuantize(tt.voltage, cfg)
			if code != tt.wantCode {
				t.Errorf("16-bit ADCQuantize(%v) code = %d, want %d", tt.voltage, code, tt.wantCode)
			}
		})
	}
}

func TestADCQuantize10Bit(t *testing.T) {
	cfg := ADCConfig{Resolution: 10, VRefHigh: 3.3, VRefLow: 0}

	// 满量程 = 1023
	code, _ := ADCQuantize(3.3, cfg)
	if code != 1023 {
		t.Errorf("10-bit 满量程: code = %d, want 1023", code)
	}

	code, _ = ADCQuantize(0, cfg)
	if code != 0 {
		t.Errorf("10-bit 零值: code = %d, want 0", code)
	}
}

// ==================== 边界条件测试 ====================

func TestADCQuantizeClamping(t *testing.T) {
	cfg := ADCConfig{Resolution: 12, VRefHigh: 3.3, VRefLow: 0}

	tests := []struct {
		name     string
		voltage  float64
		wantCode int
	}{
		{"负电压钳位", -1.0, 0},
		{"超范围钳位", 5.0, 4095},
		{"严重超范围", 100.0, 4095},
		{"严重欠范围", -100.0, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			code, _ := ADCQuantize(tt.voltage, cfg)
			if code != tt.wantCode {
				t.Errorf("ADCQuantize(%v) code = %d, want %d", tt.voltage, code, tt.wantCode)
			}
		})
	}
}

func TestADCQuantizeNegativeRef(t *testing.T) {
	// 双极性参考电压：VRefLow = -1.65V, VRefHigh = 1.65V
	cfg := ADCConfig{Resolution: 12, VRefHigh: 1.65, VRefLow: -1.65}

	// 零输入应映射到中间值
	code, _ := ADCQuantize(0, cfg)
	if code != 2048 {
		t.Errorf("双极性零输入: code = %d, want 2048", code)
	}

	// 正满量程
	code, _ = ADCQuantize(1.65, cfg)
	if code != 4095 {
		t.Errorf("双极性正满量程: code = %d, want 4095", code)
	}

	// 负满量程
	code, _ = ADCQuantize(-1.65, cfg)
	if code != 0 {
		t.Errorf("双极性负满量程: code = %d, want 0", code)
	}
}

func TestADCQuantizeZeroRange(t *testing.T) {
	cfg := ADCConfig{Resolution: 12, VRefHigh: 3.3, VRefLow: 3.3}
	code, qErr := ADCQuantize(3.3, cfg)
	if code != 0 || qErr != 0 {
		t.Errorf("零范围应返回 (0, 0)，实际 (%d, %v)", code, qErr)
	}
}

// ==================== 量化误差测试 ====================

func TestADCQuantizationError(t *testing.T) {
	cfg := ADCConfig{Resolution: 12, VRefHigh: 3.3, VRefLow: 0}
	qStep := 3.3 / 4095.0

	// 量化误差绝对值不应超过 0.5 LSB
	for i := 0; i < 100; i++ {
		v := float64(i) / 100.0 * 3.3
		_, qErr := ADCQuantize(v, cfg)
		if math.Abs(qErr) > qStep*0.5+1e-12 {
			t.Errorf("ADCQuantize(%v) 量化误差 %v 超过 0.5 LSB (%v)", v, qErr, qStep*0.5)
		}
	}
}

func TestADCQuantizationNoise(t *testing.T) {
	cfg := ADCConfig{Resolution: 12, VRefHigh: 3.3, VRefLow: 0}
	qStep := 3.3 / 4095.0

	var sumErr, sumErrSq float64
	N := 1000
	for i := 0; i < N; i++ {
		v := float64(i) / float64(N) * 3.3
		_, qErr := ADCQuantize(v, cfg)
		sumErr += qErr
		sumErrSq += qErr * qErr
	}

	meanErr := sumErr / float64(N)
	rmsErr := math.Sqrt(sumErrSq / float64(N))

	// 平均误差应接近零
	if math.Abs(meanErr) > qStep {
		t.Errorf("平均量化误差 = %v，应接近 0", meanErr)
	}
	// RMS 应接近 qStep / sqrt(12)
	expectedRMS := qStep / math.Sqrt(12)
	if math.Abs(rmsErr-expectedRMS) > qStep {
		t.Errorf("RMS 量化误差 = %v，应接近 %v", rmsErr, expectedRMS)
	}
}

// ==================== 辅助函数测试 ====================

func TestADCOutputVoltage(t *testing.T) {
	cfg := ADCConfig{Resolution: 12, VRefHigh: 3.3, VRefLow: 0}

	tests := []struct {
		name    string
		code    int
		wantV   float64
	}{
		{"零码", 0, 0},
		{"满码", 4095, 3.3},
		{"中间码", 2048, 2048.0 / 4095.0 * 3.3},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			v := ADCOutputVoltage(tt.code, cfg)
			if math.Abs(v-tt.wantV) > 1e-6 {
				t.Errorf("ADCOutputVoltage(%d) = %v, want %v", tt.code, v, tt.wantV)
			}
		})
	}
}

func TestADCMaxCode(t *testing.T) {
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
		cfg := ADCConfig{Resolution: tt.resolution}
		got := ADCMaxCode(cfg)
		if got != tt.wantMax {
			t.Errorf("ADCMaxCode(%d-bit) = %d, want %d", tt.resolution, got, tt.wantMax)
		}
	}
}

func TestADCQuantizationStep(t *testing.T) {
	cfg := ADCConfig{Resolution: 12, VRefHigh: 3.3, VRefLow: 0}
	step := ADCQuantizationStep(cfg)
	expected := 3.3 / 4095.0
	if math.Abs(step-expected) > 1e-9 {
		t.Errorf("QuantizationStep = %v, want %v", step, expected)
	}
}

// ==================== INL 误差模型测试 ====================

func TestADCQuantizeWithINL(t *testing.T) {
	cfg := ADCConfig{Resolution: 12, VRefHigh: 3.3, VRefLow: 0, INL: 2.0}

	// INL = 2.0 LSB 表示输出偏移 2 个码值
	code, _ := ADCQuantize(1.65, cfg) // 理想中间值 = 2048
	// 带 INL 偏移后应为 2048 + 2 = 2050（或因 rounding 接近）
	idealCode, _ := ADCQuantize(1.65, ADCConfig{Resolution: 12, VRefHigh: 3.3, VRefLow: 0})
	if code == idealCode {
		t.Errorf("INL 应导致码值偏移，但 code = idealCode = %d", code)
	}
}

// ==================== ADC ↔ DAC 往返测试 ====================

func TestADCDACRoundTrip(t *testing.T) {
	adcCfg := ADCConfig{Resolution: 12, VRefHigh: 3.3, VRefLow: 0}
	dacCfg := DACConfig{Resolution: 12, VRefHigh: 3.3, VRefLow: 0}

	testVoltages := []float64{0, 0.5, 1.0, 1.65, 2.5, 3.3}
	for _, v := range testVoltages {
		code, _ := ADCQuantize(v, adcCfg)
		reconstructed := DACConvert(code, dacCfg)
		// 同分辨率往返应精确匹配（在同一量化台阶内）
		if math.Abs(reconstructed-v) > 3.3/4095.0+1e-9 {
			t.Errorf("往返失配 v=%vV: code=%d, reconstructed=%v", v, code, reconstructed)
		}
	}
}
