package qemu

import (
	"testing"
)

func TestIsGPIOODR(t *testing.T) {
	tests := []struct {
		addr     uint32
		wantPort string
		wantOK   bool
	}{
		{GPIOA_BASE + GPIO_ODR, "A", true},
		{GPIOB_BASE + GPIO_ODR, "B", true},
		{GPIOC_BASE + GPIO_ODR, "C", true},
		{GPIOA_BASE + GPIO_CRL, "", false},
		{0x12345678, "", false},
	}

	for _, tt := range tests {
		port, ok := IsGPIOODR(tt.addr)
		if port != tt.wantPort || ok != tt.wantOK {
			t.Errorf("IsGPIOODR(0x%x) = (%q, %v), want (%q, %v)",
				tt.addr, port, ok, tt.wantPort, tt.wantOK)
		}
	}
}

func TestODRToPins(t *testing.T) {
	events := ODRToPins("A", 0x0020) // bit 5 = 1
	if len(events) != 16 {
		t.Fatalf("expected 16 events, got %d", len(events))
	}
	// PA5 应该是 HIGH
	if events[5].Level != 1 {
		t.Errorf("PA5 level = %d, want 1", events[5].Level)
	}
	// PA0 应该是 LOW
	if events[0].Level != 0 {
		t.Errorf("PA0 level = %d, want 0", events[0].Level)
	}
}

func TestIsUARTDR(t *testing.T) {
	port, ok := IsUARTDR(USART1_BASE + USART_DR)
	if port != "USART1" || !ok {
		t.Errorf("IsUARTDR(USART1_DR) = (%q, %v), want (USART1, true)", port, ok)
	}
}

func TestDefaultSTM32Config(t *testing.T) {
	cfg := DefaultSTM32Config("firmware.elf")
	if cfg.Machine != "stm32vldiscovery" {
		t.Errorf("Machine = %q, want stm32vldiscovery", cfg.Machine)
	}
	if cfg.Kernel != "firmware.elf" {
		t.Errorf("Kernel = %q, want firmware.elf", cfg.Kernel)
	}
}

func TestNewManager(t *testing.T) {
	cfg := DefaultSTM32Config("test.elf")
	mgr := NewManager(cfg)
	if mgr.IsRunning() {
		t.Error("新创建的 Manager 不应该在运行")
	}
}
