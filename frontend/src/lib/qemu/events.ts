/**
 * QEMU 仿真事件类型定义
 * 与后端 Go qemu package 对应
 */

export type QEMUEventType = 'gpio' | 'uart' | 'state';

export interface GPIOEvent {
  type: 'gpio';
  pin: string;    // "PA5", "PB12"
  level: 0 | 1;
  time: number;
}

export interface UARTEvent {
  type: 'uart';
  data: string;
  time: number;
}

export interface StateEvent {
  type: 'state';
  running: boolean;
  pc: number;
  cycles: number;
}

export type QEMUEvent = GPIOEvent | UARTEvent | StateEvent;
