/**
 * 诊断引擎
 * 
 * 管理实时电路诊断状态，提供：
 * - 定时/事件触发的自动诊断
 * - 诊断结果缓存和变更通知
 * - 严重级别统计
 * - 规则开关管理
 */

import type { CircuitComponent, CircuitNode, Wire } from '../../types/circuit';
import {
  runDRC,
  canSimulate,
  getAllRules,
  type DRCDiagnostic,
  type DRCRule,
} from './CircuitDRC';

/** 诊断状态 */
export interface DiagnosticState {
  /** 当前诊断结果 */
  diagnostics: DRCDiagnostic[];
  /** 上次运行时间戳 */
  lastRunTime: number;
  /** 是否正在运行 */
  isRunning: boolean;
  /** 错误数量 */
  errorCount: number;
  /** 警告数量 */
  warningCount: number;
  /** 建议数量 */
  suggestionCount: number;
}

/** 诊断变更回调 */
export type DiagnosticListener = (state: DiagnosticState) => void;

/**
 * 诊断引擎类
 * 管理 DRC 规则的执行和诊断结果的状态
 */
export class DiagnosticEngine {
  private state: DiagnosticState = {
    diagnostics: [],
    lastRunTime: 0,
    isRunning: false,
    errorCount: 0,
    warningCount: 0,
    suggestionCount: 0,
  };

  private listeners: Set<DiagnosticListener> = new Set();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly debounceMs: number;

  constructor(debounceMs: number = 300) {
    this.debounceMs = debounceMs;
  }

  /** 获取当前状态 */
  getState(): DiagnosticState {
    return { ...this.state };
  }

  /** 获取所有诊断结果 */
  getDiagnostics(): DRCDiagnostic[] {
    return [...this.state.diagnostics];
  }

  /** 获取指定严重级别的诊断 */
  getDiagnosticsBySeverity(severity: DRCDiagnostic['severity']): DRCDiagnostic[] {
    return this.state.diagnostics.filter((d) => d.severity === severity);
  }

  /** 获取指定规则的诊断 */
  getDiagnosticsByRule(ruleId: string): DRCDiagnostic[] {
    return this.state.diagnostics.filter((d) => d.ruleId === ruleId);
  }

  /** 获取指定元件的诊断 */
  getDiagnosticsForComponent(componentId: string): DRCDiagnostic[] {
    return this.state.diagnostics.filter((d) => d.targetId === componentId);
  }

  /** 检查是否可以运行仿真 */
  checkSimulation(
    components: CircuitComponent[],
    nodes: CircuitNode[],
    wires: Wire[]
  ): { allowed: boolean; errors: DRCDiagnostic[]; warnings: DRCDiagnostic[] } {
    return canSimulate(components, nodes, wires);
  }

  /** 获取所有可用规则 */
  getRules(): DRCRule[] {
    return getAllRules();
  }

  /** 启用/禁用规则 */
  setRuleEnabled(ruleId: string, enabled: boolean): void {
    const rules = getAllRules();
    const rule = rules.find((r) => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  /** 订阅诊断变更 */
  subscribe(listener: DiagnosticListener): () => void {
    this.listeners.add(listener);
    // 立即通知当前状态
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 触发诊断（防抖）
   * 在电路变更时调用，避免频繁执行规则检查
   */
  trigger(
    components: CircuitComponent[],
    nodes: CircuitNode[],
    wires: Wire[]
  ): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.run(components, nodes, wires);
    }, this.debounceMs);
  }

  /**
   * 立即运行诊断
   */
  run(
    components: CircuitComponent[],
    nodes: CircuitNode[],
    wires: Wire[]
  ): DRCDiagnostic[] {
    this.state.isRunning = true;
    this.notifyListeners();

    const diagnostics = runDRC(components, nodes, wires);

    this.state = {
      diagnostics,
      lastRunTime: Date.now(),
      isRunning: false,
      errorCount: diagnostics.filter((d) => d.severity === 'error').length,
      warningCount: diagnostics.filter((d) => d.severity === 'warning').length,
      suggestionCount: diagnostics.filter((d) => d.severity === 'suggestion').length,
    };

    this.notifyListeners();
    return diagnostics;
  }

  /** 清除所有诊断 */
  clear(): void {
    this.state = {
      diagnostics: [],
      lastRunTime: Date.now(),
      isRunning: false,
      errorCount: 0,
      warningCount: 0,
      suggestionCount: 0,
    };
    this.notifyListeners();
  }

  /** 销毁引擎 */
  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.listeners.clear();
  }

  private notifyListeners(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}

/** 全局诊断引擎实例 */
export const diagnosticEngine = new DiagnosticEngine();
