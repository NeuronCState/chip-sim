// Package engine GPIO 引擎单元测试
package engine

import (
	"testing"

	"chip-sim/pkg/types"
)

func TestNewGPIOEngine(t *testing.T) {
	config := types.DefaultMCUConfig()
	engine := NewGPIOEngine(config)

	if len(engine.pinStates) != 16 {
		t.Errorf("expected 16 pin states, got %d", len(engine.pinStates))
	}
	for _, state := range engine.pinStates {
		if state.Level != types.GPIOLevelFloating {
			t.Errorf("pin %d: expected floating level, got %s", state.PinNumber, state.Level)
		}
	}
}

func TestGPIOInputMode_NoExternal(t *testing.T) {
	config := types.DefaultMCUConfig()
	// PA0: input, no pull
	engine := NewGPIOEngine(config)

	result := engine.Step(types.GPIOSimulationStep{
		ExternalSignals: []types.GPIOExternalSignal{},
		Time:            0,
	})

	pa0 := result.PinStates[0]
	if pa0.Level != types.GPIOLevelFloating {
		t.Errorf("PA0: expected floating, got %s", pa0.Level)
	}
}

func TestGPIOInputMode_WithPullUp(t *testing.T) {
	config := types.DefaultMCUConfig()
	config.Pins[0].Pull = types.GPIOPullUp
	engine := NewGPIOEngine(config)

	result := engine.Step(types.GPIOSimulationStep{
		ExternalSignals: []types.GPIOExternalSignal{},
		Time:            0,
	})

	pa0 := result.PinStates[0]
	if pa0.Level != types.GPIOLevelHigh {
		t.Errorf("PA0: expected high with pull-up, got %s", pa0.Level)
	}
	if pa0.Voltage != config.VDD {
		t.Errorf("PA0: expected VDD voltage, got %f", pa0.Voltage)
	}
}

func TestGPIOInputMode_WithPullDown(t *testing.T) {
	config := types.DefaultMCUConfig()
	config.Pins[0].Pull = types.GPIOPullDown
	engine := NewGPIOEngine(config)

	result := engine.Step(types.GPIOSimulationStep{
		ExternalSignals: []types.GPIOExternalSignal{},
		Time:            0,
	})

	pa0 := result.PinStates[0]
	if pa0.Level != types.GPIOLevelLow {
		t.Errorf("PA0: expected low with pull-down, got %s", pa0.Level)
	}
}

func TestGPIOInputMode_ExternalSignal(t *testing.T) {
	config := types.DefaultMCUConfig()
	engine := NewGPIOEngine(config)

	result := engine.Step(types.GPIOSimulationStep{
		ExternalSignals: []types.GPIOExternalSignal{
			{PinNumber: 0, Voltage: 2.5}, // PA0: 2.5V > VDD/2 = 1.65V
		},
		Time: 0,
	})

	pa0 := result.PinStates[0]
	if pa0.Level != types.GPIOLevelHigh {
		t.Errorf("PA0: expected high (2.5V > 1.65V), got %s", pa0.Level)
	}
	if pa0.Voltage != 2.5 {
		t.Errorf("PA0: expected 2.5V, got %f", pa0.Voltage)
	}
}

func TestGPIOAnalogMode(t *testing.T) {
	config := types.DefaultMCUConfig()
	config.Pins[0].Mode = types.GPIOModeAnalog
	config.Pins[0].ADCResolution = 12
	config.Pins[0].ADCRefVoltage = 3.3
	engine := NewGPIOEngine(config)

	// 1.65V input = half of 3.3V → ADC value = 2047 (4095/2)
	result := engine.Step(types.GPIOSimulationStep{
		ExternalSignals: []types.GPIOExternalSignal{
			{PinNumber: 0, Voltage: 1.65},
		},
		Time: 0,
	})

	pa0 := result.PinStates[0]
	if pa0.ADCValue < 2040 || pa0.ADCValue > 2055 {
		t.Errorf("PA0: expected ADC ~2047, got %d", pa0.ADCValue)
	}
}

func TestGPIOAnalogMode_Clamp(t *testing.T) {
	config := types.DefaultMCUConfig()
	config.Pins[0].Mode = types.GPIOModeAnalog
	config.Pins[0].ADCResolution = 10
	config.Pins[0].ADCRefVoltage = 3.3
	engine := NewGPIOEngine(config)

	// 5V input should be clamped to 3.3V → ADC = 1023
	result := engine.Step(types.GPIOSimulationStep{
		ExternalSignals: []types.GPIOExternalSignal{
			{PinNumber: 0, Voltage: 5.0},
		},
		Time: 0,
	})

	pa0 := result.PinStates[0]
	if pa0.ADCValue != 1023 {
		t.Errorf("PA0: expected ADC 1023 (clamped), got %d", pa0.ADCValue)
	}
}

func TestGPIOPWM(t *testing.T) {
	config := types.DefaultMCUConfig()
	config.Pins[0].Mode = types.GPIOModePWM
	config.Pins[0].PWMFrequency = 1000 // 1ms period
	config.Pins[0].PWMDutyCycle = 0.5
	engine := NewGPIOEngine(config)

	// At t=0.0002s (0.2ms), phase=0.2 → duty cycle=0.5 → HIGH
	result := engine.Step(types.GPIOSimulationStep{
		ExternalSignals: []types.GPIOExternalSignal{},
		Time:            0.0002,
	})
	pa0 := result.PinStates[0]
	if pa0.Level != types.GPIOLevelHigh {
		t.Errorf("PA0 PWM: expected high at phase 0.2 (duty=0.5), got %s", pa0.Level)
	}

	// At t=0.0007s (0.7ms), phase=0.7 → LOW
	result2 := engine.Step(types.GPIOSimulationStep{
		ExternalSignals: []types.GPIOExternalSignal{},
		Time:            0.0007,
	})
	pa0b := result2.PinStates[0]
	if pa0b.Level != types.GPIOLevelLow {
		t.Errorf("PA0 PWM: expected low at phase 0.7 (duty=0.5), got %s", pa0b.Level)
	}
}

func TestGPIOInterrupt_Rising(t *testing.T) {
	config := types.DefaultMCUConfig()
	config.Pins[0].Mode = types.GPIOModeInput
	config.Pins[0].InterruptMode = types.GPIOInterruptRising
	engine := NewGPIOEngine(config)

	// Step 1: Low
	engine.Step(types.GPIOSimulationStep{
		ExternalSignals: []types.GPIOExternalSignal{
			{PinNumber: 0, Voltage: 0},
		},
		Time: 0,
	})

	// Step 2: Rising edge
	result := engine.Step(types.GPIOSimulationStep{
		ExternalSignals: []types.GPIOExternalSignal{
			{PinNumber: 0, Voltage: 3.3},
		},
		Time: 0.001,
	})

	pa0 := result.PinStates[0]
	if !pa0.InterruptPending {
		t.Error("PA0: expected interrupt pending on rising edge")
	}
}

func TestGPIOInterrupt_Falling(t *testing.T) {
	config := types.DefaultMCUConfig()
	config.Pins[0].Mode = types.GPIOModeInput
	config.Pins[0].InterruptMode = types.GPIOInterruptFalling
	engine := NewGPIOEngine(config)

	// Step 1: High
	engine.Step(types.GPIOSimulationStep{
		ExternalSignals: []types.GPIOExternalSignal{
			{PinNumber: 0, Voltage: 3.3},
		},
		Time: 0,
	})

	// Step 2: Falling edge
	result := engine.Step(types.GPIOSimulationStep{
		ExternalSignals: []types.GPIOExternalSignal{
			{PinNumber: 0, Voltage: 0},
		},
		Time: 0.001,
	})

	pa0 := result.PinStates[0]
	if !pa0.InterruptPending {
		t.Error("PA0: expected interrupt pending on falling edge")
	}
}

func TestGPIOSetPinLevel(t *testing.T) {
	config := types.DefaultMCUConfig()
	config.Pins[0].Mode = types.GPIOModeOutput
	engine := NewGPIOEngine(config)

	engine.SetPinLevel(0, types.GPIOLevelHigh)

	result := engine.Step(types.GPIOSimulationStep{
		ExternalSignals: []types.GPIOExternalSignal{},
		Time:            0,
	})

	pa0 := result.PinStates[0]
	if pa0.Level != types.GPIOLevelHigh {
		t.Errorf("PA0: expected high after SetPinLevel, got %s", pa0.Level)
	}
	if pa0.Voltage != config.VDD {
		t.Errorf("PA0: expected VDD, got %f", pa0.Voltage)
	}
}

func TestGPIOSetPinConfig(t *testing.T) {
	config := types.DefaultMCUConfig()
	engine := NewGPIOEngine(config)

	newPin := config.Pins[0]
	newPin.Mode = types.GPIOModeOutput
	newPin.Pull = types.GPIOPullUp
	engine.SetPinConfig(newPin)

	updated := engine.GetConfig().Pins[0]
	if updated.Mode != types.GPIOModeOutput {
		t.Errorf("expected output mode, got %s", updated.Mode)
	}
	if updated.Pull != types.GPIOPullUp {
		t.Errorf("expected pull-up, got %s", updated.Pull)
	}
}
