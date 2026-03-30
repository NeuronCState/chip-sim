/**
 * SignalBus — 信号传播
 *
 * 遍历所有连线，将源引脚的信号值复制到目标引脚。
 * 实现引脚间的电平/值传递。
 */

import type { PinLevel, PinMode } from './types';

/** 连线定义（简化版，与 WebGLCanvas 中的 Wire 对应） */
export interface SimWire {
  id: string;
  from: { componentId: string; pinId: string };
  to: { componentId: string; pinId: string };
}

/** 引脚信号快照 */
export interface PinSignal {
  level: PinLevel;
  value: number;
  mode: PinMode;
}

/** 信号源接口 — 提供引脚信号查询 */
export interface SignalSource {
  /** 获取指定引脚的信号 */
  getPinSignal(componentId: string, pinId: string): PinSignal | null;
  /** 设置指定引脚的信号（由传播写入） */
  setPinSignal(componentId: string, pinId: string, signal: PinSignal): void;
}

/**
 * SignalBus
 *
 * 管理连线和信号传播。每个 tick 调用 propagate() 一次。
 */
export class SignalBus {
  private wires: SimWire[] = [];
  /** 连线电流缓存（wireId → current） */
  private wireCurrents: Map<string, number> = new Map();

  /**
   * 设置连线列表
   */
  setWires(wires: SimWire[]): void {
    this.wires = wires;
  }

  /**
   * 获取连线电流值
   */
  getWireCurrent(wireId: string): number {
    return this.wireCurrents.get(wireId) ?? 0;
  }

  /**
   * 获取所有连线电流
   */
  getAllWireCurrents(): Map<string, number> {
    return new Map(this.wireCurrents);
  }

  /**
   * 信号传播：将源引脚信号复制到目标引脚
   *
   * 遍历所有连线：
   * 1. 读取源引脚的电平和值
   * 2. 写入目标引脚
   * 3. 双向传播（对于无方向信号）
   *
   * @param source 信号源接口
   */
  propagate(source: SignalSource): void {
    // 清除旧电流值
    this.wireCurrents.clear();

    for (const wire of this.wires) {
      const fromSignal = source.getPinSignal(wire.from.componentId, wire.from.pinId);
      const toSignal = source.getPinSignal(wire.to.componentId, wire.to.pinId);

      if (!fromSignal || !toSignal) continue;

      // 确定信号方向：输出 → 输入
      const fromIsOutput = fromSignal.mode === 'output' || fromSignal.mode === 'pwm' ||
        fromSignal.mode === 'uart_tx' || fromSignal.mode === 'spi' || fromSignal.mode === 'i2c';
      const toIsOutput = toSignal.mode === 'output' || toSignal.mode === 'pwm' ||
        toSignal.mode === 'uart_tx' || toSignal.mode === 'spi' || toSignal.mode === 'i2c';

      // 计算电流（简化模型：电平差驱动）
      let current = 0;
      if (fromSignal.level === 'high' && toSignal.level !== 'high') {
        current = 1.0; // 正向电流
      } else if (fromSignal.level === 'low' && toSignal.level !== 'low') {
        current = -1.0; // 反向电流
      }
      this.wireCurrents.set(wire.id, current);

      if (fromIsOutput && !toIsOutput) {
        // 单向传播：from → to
        source.setPinSignal(wire.to.componentId, wire.to.pinId, {
          level: fromSignal.level,
          value: fromSignal.value,
          mode: toSignal.mode, // 保持目标引脚的模式
        });
      } else if (!fromIsOutput && toIsOutput) {
        // 单向传播：to → from
        source.setPinSignal(wire.from.componentId, wire.from.pinId, {
          level: toSignal.level,
          value: toSignal.value,
          mode: fromSignal.mode, // 保持源引脚的模式
        });
      } else if (!fromIsOutput && !toIsOutput) {
        // 双向传播：都是输入/模拟，高电平优先
        const resolvedLevel: PinLevel =
          fromSignal.level === 'high' ? 'high' :
          toSignal.level === 'high' ? 'high' :
          fromSignal.level === 'low' ? 'low' :
          toSignal.level === 'low' ? 'low' : 'floating';

        source.setPinSignal(wire.to.componentId, wire.to.pinId, {
          level: resolvedLevel,
          value: Math.max(fromSignal.value, toSignal.value),
          mode: toSignal.mode,
        });
        source.setPinSignal(wire.from.componentId, wire.from.pinId, {
          level: resolvedLevel,
          value: Math.max(fromSignal.value, toSignal.value),
          mode: fromSignal.mode,
        });
      }
      // 两个都是输出的情况跳过（可能冲突，不处理）
    }
  }

  /**
   * 重置
   */
  reset(): void {
    this.wireCurrents.clear();
  }
}
