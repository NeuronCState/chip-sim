/**
 * 元件库统一导出
 *
 * 按类别组织的嵌入式常用元件定义
 * 包含被动元件、传感器、电源管理、通信模块、执行器等
 */

// 被动元件（电阻、电容、电感）
export * from './passive';
// 温度传感器
export * from './sensors/temperature';
// 光传感器
export * from './sensors/light';
// 运动传感器
export * from './sensors/motion';
// 电源管理
export * from './power';
// 通信模块
export * from './communication';
// 执行器
export * from './actuators';
// 半导体元件
export * from './semiconductors';
// PTC 热敏电阻
export * from './sensors/ptc-thermistor';
// 晶体振荡器
export * from './oscillators';
// 七段数码管
export * from './display';
// 集成电路（555 定时器等）
export * from './ics';
