/**
 * WASM Worker 管理器
 * 管理 Web Worker 生命周期：启动、超时监控、中断恢复
 * 统一错误格式传递到前端错误系统
 * 参考规划: JJC-20260328-007 §六.2
 */

import { createErrorReport, type ErrorReport } from '../errors/error-report';
import { addActivity } from '../activity/activity-log';

// ── 类型定义 ──

export interface SimError {
  code: string;
  message: string;
  step?: number;
  node?: string;
}

export type SimMessageType =
  | 'simulate'
  | 'progress'
  | 'result'
  | 'error'
  | 'terminate';

export interface SimWorkerMessage {
  type: SimMessageType;
  requestId?: string;
  step?: number;
  total?: number;
  data?: unknown;
  message?: string;
  code?: string;
  node?: string;
}

export type SimWorkerCallback = {
  onProgress?: (step: number, total: number, requestId: string) => void;
  onResult?: (data: unknown, requestId: string) => void;
  onError?: (report: ErrorReport) => void;
};

export interface SimWorkerManagerOptions {
  /** 超时毫秒数（默认 30s） */
  timeoutMs?: number;
  /** Worker 脚本路径 */
  workerUrl?: string;
}

// ── Worker 管理器 ──

export class SimWorkerManager {
  private worker: Worker | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private timeoutMs: number;
  private workerUrl: string;
  private callbacks: SimWorkerCallback = {};
  private isRunning = false;
  private _currentRequestId: string | null = null;

  /** 当前运行的请求 ID */
  get currentRequestId() {
    return this._currentRequestId;
  }

  constructor(options: SimWorkerManagerOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 30000;
    this.workerUrl = options.workerUrl ?? new URL('../../workers/sim-worker.ts', import.meta.url).href;
  }

  /** 设置回调 */
  setCallbacks(cb: SimWorkerCallback) {
    this.callbacks = cb;
  }

  /** 启动 Worker */
  private startWorker() {
    if (this.worker) {
      this.worker.terminate();
    }
    this.worker = new Worker(this.workerUrl, { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<SimWorkerMessage>) => {
      this.handleMessage(e.data);
    };
    this.worker.onerror = (e) => {
      this.handleWorkerError(e);
    };
  }

  /** 处理 Worker 消息 */
  private handleMessage(msg: SimWorkerMessage) {
    switch (msg.type) {
      case 'progress':
        if (msg.step !== undefined && msg.total !== undefined && msg.requestId) {
          this.callbacks.onProgress?.(msg.step, msg.total, msg.requestId);
        }
        break;

      case 'result':
        this.clearTimeout();
        this.isRunning = false;
        if (msg.requestId) {
          addActivity('sim_stop', '仿真完成', `requestId=${msg.requestId}`);
          this.callbacks.onResult?.(msg.data, msg.requestId);
        }
        break;

      case 'error':
        this.clearTimeout();
        this.isRunning = false;
        const simErr: SimError = {
          code: msg.code || 'SIM_INTERNAL_ERROR',
          message: msg.message || '仿真计算异常',
          step: msg.step,
          node: msg.node,
        };
        const report = createErrorReport('simulator', 'warning', simErr.message,
          `错误码: ${simErr.code}${simErr.step ? ` | 步骤: ${simErr.step}` : ''}${simErr.node ? ` | 节点: ${simErr.node}` : ''}`,
        );
        addActivity('sim_error', `仿真错误: ${simErr.message}`, simErr.code);
        this.callbacks.onError?.(report);
        break;
    }
  }

  /** Worker 全局错误 */
  private handleWorkerError(e: ErrorEvent) {
    this.clearTimeout();
    this.isRunning = false;
    const report = createErrorReport('simulator', 'fatal', '仿真 Worker 崩溃',
      e.message || 'Worker 线程发生未捕获异常', { stack: e.error?.stack },
    );
    addActivity('sim_error', '仿真 Worker 崩溃', e.message);
    this.callbacks.onError?.(report);
  }

  /** 启动超时监控 */
  private startTimeout() {
    this.clearTimeout();
    this.timeoutId = setTimeout(() => {
      this.handleTimeout();
    }, this.timeoutMs);
  }

  /** 清除超时 */
  private clearTimeout() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /** 超时处理：中断 Worker 并创建错误报告 */
  private handleTimeout() {
    this.interrupt();
    const report = createErrorReport('simulator', 'warning', '仿真执行超时',
      `仿真运行超过 ${this.timeoutMs / 1000}s 无响应，已自动中断`,
    );
    addActivity('sim_error', '仿真超时中断', `timeout=${this.timeoutMs}ms`);
    this.callbacks.onError?.(report);
  }

  // ── 公开 API ──

  /**
   * 发送仿真请求
   */
  run(payload: Record<string, unknown>, requestId: string) {
    this.startWorker();
    this.isRunning = true;
    this._currentRequestId = requestId;
    this.startTimeout();
    addActivity('sim_start', '启动仿真', `requestId=${requestId}`);

    this.worker?.postMessage({
      type: 'simulate',
      ...payload,
      requestId,
    });
  }

  /**
   * 中断当前仿真（terminate Worker）
   */
  interrupt() {
    this.clearTimeout();
    this.isRunning = false;
    this._currentRequestId = null;
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      addActivity('sim_stop', '仿真已中断');
    }
  }

  /**
   * 中断后恢复到可运行状态
   */
  restart() {
    this.interrupt();
    // Worker 会在下次 run() 时重新创建
  }

  /** 是否正在运行 */
  get running() {
    return this.isRunning;
  }

  /** 销毁 */
  dispose() {
    this.interrupt();
    this.callbacks = {};
  }
}

/** 全局单例 */
let _instance: SimWorkerManager | null = null;

export function getSimWorkerManager(options?: SimWorkerManagerOptions): SimWorkerManager {
  if (!_instance) {
    _instance = new SimWorkerManager(options);
  }
  return _instance;
}
