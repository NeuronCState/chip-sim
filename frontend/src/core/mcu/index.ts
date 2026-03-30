/**
 * MCU 仿真模块导出
 * 提供中断控制器、定时器、时钟系统、MCU 仿真引擎
 */

// ClockSystem
export {
  ClockSystem,
  ClockSource,
  MCU_CLOCK_PRESETS,
  PRESET_8051,
  PRESET_AVR,
  PRESET_STM32,
  defaultClockConfig,
} from './ClockSystem';
export type {
  ClockSystemConfig,
  ClockSystemEvents,
  ClockSnapshot,
  MCUClockPreset,
} from './ClockSystem';

// InterruptController
export {
  InterruptController,
  InterruptSourceType,
  InterruptEdge,
  InterruptEventType,
  INTERRUPT_SOURCES_8051,
  INTERRUPT_SOURCES_STM32_EXTI,
} from './InterruptController';
export type {
  InterruptSourceConfig,
  InterruptVectorEntry,
  InterruptPriority,
  InterruptSourceState,
  InterruptEvent,
  InterruptControllerEvents,
  InterruptControllerSnapshot,
  GlobalInterruptState,
} from './InterruptController';

// TimerModule
export {
  TimerModule,
  TimerMode,
  TimerDirection,
  TimerClockSource,
  createTimer0_8051,
  createTimer1_8051,
  createTimer0_ATmega,
  createTimer1_ATmega,
} from './TimerModule';
export type {
  TimerConfig,
  TimerState,
  TimerModuleEvents,
  TimerSnapshot,
  PWMConfig,
  InputCaptureConfig,
  PWMWaveformPoint,
  TimerEvent,
} from './TimerModule';

// MCUSimulator
export {
  MCUSimulator,
  MCUModel,
  MCU_PRESETS,
  create8051Simulator,
  createATmegaSimulator,
  createSTM32Simulator,
} from './MCUSimulator';
export type {
  MCUModelConfig,
  MCUSimEvents,
  MCUState,
  MCUSnapshot,
} from './MCUSimulator';
