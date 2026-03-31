/**
 * QEMU 事件 → 画布状态 适配器
 * 将后端推来的 GPIO/UART 事件映射到 WebGLCanvas 的引脚状态
 */

import type { QEMUEvent, GPIOEvent, UARTEvent } from './events';

export interface CanvasStateUpdater {
  setChipPinLevel(pinId: string, level: 'high' | 'low' | 'floating'): void;
  appendUARTData(data: string): void;
  setSimRunning(running: boolean): void;
}

export class QEMUAdapter {
  private updater: CanvasStateUpdater;
  private pinLevelCache = new Map<string, 'high' | 'low' | 'floating'>();

  constructor(updater: CanvasStateUpdater) {
    this.updater = updater;
  }

  handleEvent(event: QEMUEvent): void {
    switch (event.type) {
      case 'gpio': this.handleGPIO(event); break;
      case 'uart': this.handleUART(event); break;
      case 'state': this.handleState(event); break;
    }
  }

  private handleGPIO(event: GPIOEvent): void {
    const level = event.level === 1 ? 'high' as const : 'low' as const;
    const prev = this.pinLevelCache.get(event.pin);
    if (prev !== level) {
      this.pinLevelCache.set(event.pin, level);
      this.updater.setChipPinLevel(event.pin, level);
    }
  }

  private handleUART(event: UARTEvent): void {
    this.updater.appendUARTData(event.data);
  }

  private handleState(event: { running: boolean }): void {
    this.updater.setSimRunning(event.running);
    if (!event.running) {
      this.pinLevelCache.clear();
    }
  }
}
