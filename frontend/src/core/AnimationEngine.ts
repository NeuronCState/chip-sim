/**
 * 动画引擎 AnimationEngine
 * 基于 Spring 物理模型 + requestAnimationFrame 驱动
 * 支持：弹性动画、淡入淡出、脉冲、连线流动、信号流动
 * 所有动画可通过 enable/disable 全局开关控制
 */

// ==================== 基础类型 ====================

/** 动画缓动函数类型 */
export type EasingFn = (t: number) => number;

/** 单个动画任务 */
interface AnimationTask {
  id: string;
  /** 动画类型 */
  type: AnimationType;
  /** 起始值 */
  from: number;
  /** 目标值 */
  to: number;
  /** 当前值 */
  current: number;
  /** 持续时间(ms)，spring 模式下忽略 */
  duration: number;
  /** 已逝时间(ms) */
  elapsed: number;
  /** 缓动函数 */
  easing: EasingFn;
  /** 每帧回调 */
  onUpdate: (value: number) => void;
  /** 完成回调 */
  onComplete?: () => void;
  /** Spring 参数（type=spring 时使用） */
  spring?: SpringConfig;
  /** 速度（spring 内部状态） */
  velocity: number;
  /** 循环 */
  loop: boolean;
  /** 延迟(ms) */
  delay: number;
  /** 延迟已逝 */
  delayElapsed: number;
}

/** 动画类型 */
export type AnimationType = 'tween' | 'spring' | 'pulse' | 'flow';

/** Spring 配置 */
export interface SpringConfig {
  /** 刚度 (默认 170) */
  stiffness: number;
  /** 阻尼 (默认 26) */
  damping: number;
  /** 质量 (默认 1) */
  mass: number;
  /** 精度阈值 (默认 0.001) */
  precision: number;
}

/** 默认 Spring 配置 */
const DEFAULT_SPRING: SpringConfig = {
  stiffness: 170,
  damping: 26,
  mass: 1,
  precision: 0.001,
};

// ==================== 缓动函数库 ====================

export const Ease = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => (--t) * t * t + 1,
  easeInOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeOutElastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1;
  },
  easeOutBounce: (t: number) => {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
  },
};

// ==================== 动画引擎 ====================

export class AnimationEngine {
  private tasks: Map<string, AnimationTask> = new Map();
  private rafId: number | null = null;
  private lastTime: number = 0;
  private _enabled: boolean = true;
  private onFrameCallbacks: Set<() => void> = new Set();

  /** 全局启用/禁用动画 */
  get enabled(): boolean { return this._enabled; }
  set enabled(v: boolean) {
    this._enabled = v;
    if (!v) this.stopAll();
  }

  /** 注册每帧回调（用于渲染同步） */
  onFrame(cb: () => void): () => void {
    this.onFrameCallbacks.add(cb);
    return () => this.onFrameCallbacks.delete(cb);
  }

  // ==================== Tween 动画 ====================

  /**
   * 创建补间动画
   * @param id 唯一 ID（同 ID 会替换旧动画）
   * @param from 起始值
   * @param to 目标值
   * @param duration 持续时间(ms)
   * @param easing 缓动函数
   * @param onUpdate 每帧回调
   * @param onComplete 完成回调
   */
  tween(
    id: string,
    from: number,
    to: number,
    duration: number,
    easing: EasingFn = Ease.easeOutCubic,
    onUpdate: (value: number) => void,
    onComplete?: () => void,
  ): void {
    this.cancel(id);
    if (!this._enabled) {
      onUpdate(to);
      onComplete?.();
      return;
    }
    const task: AnimationTask = {
      id, type: 'tween', from, to, current: from,
      duration, elapsed: 0, easing, onUpdate, onComplete,
      velocity: 0, loop: false, delay: 0, delayElapsed: 0,
    };
    this.tasks.set(id, task);
    this.ensureRunning();
  }

  // ==================== Spring 弹性动画 ====================

  /**
   * 创建弹性动画
   */
  spring(
    id: string,
    from: number,
    to: number,
    onUpdate: (value: number) => void,
    config: Partial<SpringConfig> = {},
    onComplete?: () => void,
  ): void {
    this.cancel(id);
    if (!this._enabled) {
      onUpdate(to);
      onComplete?.();
      return;
    }
    const task: AnimationTask = {
      id, type: 'spring', from, to, current: from,
      duration: 0, elapsed: 0, easing: Ease.linear, onUpdate, onComplete,
      spring: { ...DEFAULT_SPRING, ...config },
      velocity: 0, loop: false, delay: 0, delayElapsed: 0,
    };
    this.tasks.set(id, task);
    this.ensureRunning();
  }

  // ==================== 脉冲动画 ====================

  /**
   * 创建脉冲动画（0→1→0 循环）
   */
  pulse(
    id: string,
    frequency: number,
    onUpdate: (value: number) => void,
  ): void {
    this.cancel(id);
    if (!this._enabled) {
      onUpdate(0);
      return;
    }
    const task: AnimationTask = {
      id, type: 'pulse', from: 0, to: 1, current: 0,
      duration: 1000 / frequency, elapsed: 0,
      easing: Ease.easeInOutQuad, onUpdate,
      velocity: 0, loop: true, delay: 0, delayElapsed: 0,
    };
    this.tasks.set(id, task);
    this.ensureRunning();
  }

  // ==================== 流动动画 ====================

  /**
   * 创建流动动画（0→1 线性循环）
   */
  flow(
    id: string,
    speed: number,
    onUpdate: (offset: number) => void,
  ): void {
    this.cancel(id);
    if (!this._enabled) {
      onUpdate(0);
      return;
    }
    const task: AnimationTask = {
      id, type: 'flow', from: 0, to: 1, current: 0,
      duration: 1000 / speed, elapsed: 0,
      easing: Ease.linear, onUpdate,
      velocity: 0, loop: true, delay: 0, delayElapsed: 0,
    };
    this.tasks.set(id, task);
    this.ensureRunning();
  }

  // ==================== 淡入/淡出 ====================

  /** 淡入 */
  fadeIn(
    id: string,
    duration: number = 300,
    onUpdate: (opacity: number) => void,
    onComplete?: () => void,
  ): void {
    this.tween(id, 0, 1, duration, Ease.easeOutCubic, onUpdate, onComplete);
  }

  /** 淡出 */
  fadeOut(
    id: string,
    duration: number = 300,
    onUpdate: (opacity: number) => void,
    onComplete?: () => void,
  ): void {
    this.tween(id, 1, 0, duration, Ease.easeInCubic, onUpdate, onComplete);
  }

  // ==================== 控制 ====================

  /** 取消指定动画 */
  cancel(id: string): void {
    this.tasks.delete(id);
  }

  /** 停止所有动画 */
  stopAll(): void {
    this.tasks.clear();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /** 检查是否有指定动画 */
  isActive(id: string): boolean {
    return this.tasks.has(id);
  }

  /** 获取当前活跃动画数量 */
  get activeCount(): number {
    return this.tasks.size;
  }

  // ==================== 内部循环 ====================

  private ensureRunning(): void {
    if (this.rafId !== null) return;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    const dt = Math.min(now - this.lastTime, 50); // 最大 50ms 防止跳帧
    this.lastTime = now;

    const completed: string[] = [];

    for (const [id, task] of this.tasks) {
      // 延迟处理
      if (task.delay > 0) {
        task.delayElapsed += dt;
        if (task.delayElapsed < task.delay) continue;
        task.delay = 0;
      }

      if (task.type === 'spring') {
        this.tickSpring(task, dt);
      } else if (task.type === 'pulse') {
        this.tickPulse(task, dt);
      } else if (task.type === 'flow') {
        this.tickFlow(task, dt);
      } else {
        this.tickTween(task, dt);
      }

      task.onUpdate(task.current);

      if (!task.loop && this.isTaskDone(task)) {
        completed.push(id);
      }
    }

    for (const id of completed) {
      const task = this.tasks.get(id);
      if (task) {
        task.onComplete?.();
        this.tasks.delete(id);
      }
    }

    // 触发帧回调
    for (const cb of this.onFrameCallbacks) cb();

    if (this.tasks.size > 0) {
      this.rafId = requestAnimationFrame(this.tick);
    } else {
      this.rafId = null;
    }
  };

  private tickTween(task: AnimationTask, dt: number): void {
    task.elapsed += dt;
    const t = Math.min(task.elapsed / task.duration, 1);
    task.current = task.from + (task.to - task.from) * task.easing(t);
  }

  private tickSpring(task: AnimationTask, dt: number): void {
    const s = task.spring!;
    const dtSec = dt / 1000;
    const displacement = task.current - task.to;
    const springForce = -s.stiffness * displacement;
    const dampingForce = -s.damping * task.velocity;
    const acceleration = (springForce + dampingForce) / s.mass;
    task.velocity += acceleration * dtSec;
    task.current += task.velocity * dtSec;
  }

  private tickPulse(task: AnimationTask, dt: number): void {
    task.elapsed += dt;
    const phase = (task.elapsed % task.duration) / task.duration;
    // 正弦脉冲：0→1→0
    task.current = Math.sin(phase * Math.PI);
  }

  private tickFlow(task: AnimationTask, dt: number): void {
    task.elapsed += dt;
    task.current = (task.elapsed % task.duration) / task.duration;
  }

  private isTaskDone(task: AnimationTask): boolean {
    if (task.type === 'spring') {
      const s = task.spring!;
      return Math.abs(task.velocity) < s.precision && Math.abs(task.current - task.to) < s.precision;
    }
    return task.elapsed >= task.duration;
  }
}

// ==================== 全局单例 ====================

export const animationEngine = new AnimationEngine();

// ==================== 工具函数 ====================

/** 延迟执行 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** 执行一组动画序列 */
export async function sequence(
  animations: Array<() => void | Promise<void>>,
  gap: number = 0,
): Promise<void> {
  for (const fn of animations) {
    await fn();
    if (gap > 0) await delay(gap);
  }
}

/** 并行执行动画 */
export function parallel(...animations: Array<() => void>): void {
  for (const fn of animations) fn();
}
