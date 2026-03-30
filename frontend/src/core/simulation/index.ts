/**
 * 仿真引擎模块导出
 *
 * 提供 MCU 仿真引擎的所有公共接口
 */

// 核心引擎
export { SimulationEngine, getGlobalEngine } from './SimulationEngine';
export type { SimComponent, SimCanvasWire, SimChipPin } from './SimulationEngine';

// MCU 模型
export { MCUSim, createDefaultPinState } from './MCUSim';
export type { PinBehavior, PinBehaviorConfig } from './MCUSim';

// 信号总线
export { SignalBus } from './SignalBus';
export type { SimWire, PinSignal, SignalSource } from './SignalBus';

// 元件行为
export {
  getComponentBehavior,
  hasComponentBehavior,
  getBehaviorTypes,
  ledBehavior,
  buttonBehavior,
  buzzerBehavior,
  buzzerPassiveBehavior,
  relayBehavior,
  motorBehavior,
  sensorBehavior,
  toggleButton,
  setButtonState,
  getButtonStates,
} from './ComponentBehaviors';

// 类型
export type {
  MCUPinState,
  PinMode,
  PinLevel,
  ComponentSimState,
  BehaviorInput,
  BehaviorOutput,
  ComponentBehaviorFn,
  SimEngineConfig,
  UARTOutput,
  TimerConfig,
  UARTConfig,
} from './types';

export { DEFAULT_SIM_STATE } from './types';
