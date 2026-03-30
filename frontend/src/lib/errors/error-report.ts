/**
 * ErrorReport — 统一错误上报接口
 * 覆盖编译、仿真、网络、系统四类错误来源
 * 参考规划: JJC-20260328-007 §四.4.1
 */

import { createAppError, inferErrorCode, type ErrorCategory } from './error-types';

/** 错误来源 */
export type ErrorSource = 'compiler' | 'simulator' | 'network' | 'system';

/** 错误严重度（简化三级，与规划一致） */
export type ErrorSeverityLevel = 'fatal' | 'warning' | 'info';

/** 统一错误上报结构 */
export interface ErrorReport {
  id: string;
  timestamp: number;
  source: ErrorSource;
  severity: ErrorSeverityLevel;
  message: string;
  detail: string;
  stack?: string;
  context: ErrorContext;
  resolved: boolean;
}

/** 错误上下文快照 */
export interface ErrorContext {
  projectId: string;
  componentCount: number;
  simStep: number;
  userAgent: string;
}

let reportCounter = 0;

/** 生成默认上下文 */
export function defaultContext(): ErrorContext {
  return {
    projectId: '',
    componentCount: 0,
    simStep: 0,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  };
}

/** 创建 ErrorReport */
export function createErrorReport(
  source: ErrorSource,
  severity: ErrorSeverityLevel,
  message: string,
  detail: string = '',
  opts: { stack?: string; context?: Partial<ErrorContext> } = {},
): ErrorReport {
  return {
    id: `er-${Date.now()}-${++reportCounter}`,
    timestamp: Date.now(),
    source,
    severity,
    message,
    detail,
    stack: opts.stack,
    context: { ...defaultContext(), ...opts.context },
    resolved: false,
  };
}

/** 从 Error/AppError 推断 source */
export function inferSource(error: unknown): ErrorSource {
  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    if (obj.kind === 'network' || obj.kind === 'timeout' || obj.kind === 'auth') return 'network';
    if (obj.category === 'simulation') return 'simulator';
    if (obj.category === 'websocket') return 'network';
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('sim') || msg.includes('仿真') || msg.includes('wasm')) return 'simulator';
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('网络') || msg.includes('timeout')) return 'network';
    if (msg.includes('compile') || msg.includes('编译') || msg.includes('syntax')) return 'compiler';
  }
  return 'system';
}

/** 从 ErrorCategory 映射到 ErrorSeverityLevel */
export function categoryToSeverity(cat: ErrorCategory): ErrorSeverityLevel {
  switch (cat) {
    case 'simulation': return 'warning';
    case 'network': return 'warning';
    case 'validation': return 'info';
    case 'system': return 'fatal';
    default: return 'warning';
  }
}

/** 格式化为 Markdown（用于"复制详情"） */
export function formatReportAsMarkdown(r: ErrorReport): string {
  const time = new Date(r.timestamp).toLocaleString('zh-CN');
  const sourceMap: Record<ErrorSource, string> = {
    compiler: '编译器', simulator: '仿真引擎', network: '网络', system: '系统',
  };
  const sevMap: Record<ErrorSeverityLevel, string> = {
    fatal: '致命', warning: '警告', info: '提示',
  };
  return [
    '## 错误报告',
    `- 时间: ${time}`,
    `- 来源: ${sourceMap[r.source]}`,
    `- 严重度: ${sevMap[r.severity]}`,
    `- 消息: ${r.message}`,
    r.detail ? `- 详情: ${r.detail}` : '',
    r.stack ? `\n\`\`\`\n${r.stack}\n\`\`\`` : '',
  ].filter(Boolean).join('\n');
}

export { createAppError, inferErrorCode };
