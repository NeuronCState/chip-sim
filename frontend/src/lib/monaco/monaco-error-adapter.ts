/**
 * Monaco Editor 错误适配器
 * 将编译错误/警告映射为 Monaco editor markers（红色/黄色波浪线）
 * 支持 Quick Fix code action provider
 * 参考规划: JJC-20260328-007 §六.1
 *
 * 注意：使用运行时类型，不依赖 @types/monaco-editor 包。
 * 调用方需传入实际的 monaco 实例。
 */

import type { ErrorReport, ErrorSeverityLevel } from '../errors/error-report';

/** 编译诊断信息（从编译器/LSP 获得） */
export interface CompilerDiagnostic {
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  severity: ErrorSeverityLevel;
  message: string;
  code?: string;
  source?: string;
}

/** Marker 数据（与 monaco.editor.IMarkerData 兼容） */
export interface MarkerData {
  severity: number;
  message: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  code: string;
  source: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MonacoInstance = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MonacoModel = any;

// ── 严重度映射 ──

function toMarkerSeverity(sev: ErrorSeverityLevel): number {
  switch (sev) {
    case 'fatal': return 8;   // monaco.MarkerSeverity.Error
    case 'warning': return 4; // monaco.MarkerSeverity.Warning
    case 'info': return 2;    // monaco.MarkerSeverity.Info
    default: return 2;
  }
}

// ── 核心 API ──

/**
 * 将编译诊断信息设置为 Monaco model markers
 */
export function setCompilerMarkers(
  monaco: MonacoInstance,
  model: MonacoModel,
  diagnostics: CompilerDiagnostic[],
  owner: string = 'compiler',
): void {
  const markers: MarkerData[] = diagnostics.map((d) => ({
    severity: toMarkerSeverity(d.severity),
    message: d.message,
    startLineNumber: d.line,
    startColumn: d.column,
    endLineNumber: d.endLine ?? d.line,
    endColumn: d.endColumn ?? d.column + 1,
    code: d.code ?? '',
    source: d.source ?? owner,
  }));

  monaco.editor.setModelMarkers(model, owner, markers);
}

/**
 * 从 ErrorReport 列表设置 markers
 * 仅处理 source='compiler' 的错误
 */
export function setErrorReportMarkers(
  monaco: MonacoInstance,
  model: MonacoModel,
  reports: ErrorReport[],
  owner: string = 'error-reports',
): void {
  const compilerReports = reports.filter((r) => r.source === 'compiler' && !r.resolved);
  const markers: MarkerData[] = compilerReports.map((r) => ({
    severity: toMarkerSeverity(r.severity),
    message: r.message,
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: 1,
    endColumn: 2,
    code: r.id,
    source: 'ErrorReport',
  }));

  monaco.editor.setModelMarkers(model, owner, markers);
}

/**
 * 清除指定 owner 的所有 markers
 */
export function clearMarkers(
  monaco: MonacoInstance,
  model: MonacoModel,
  owner: string = 'compiler',
): void {
  monaco.editor.setModelMarkers(model, owner, []);
}

// ── Quick Fix Provider ──

const QUICK_FIX_SUGGESTIONS: Record<string, { title: string; fix: string }[]> = {
  'undefined-variable': [
    { title: '添加变量声明', fix: '// TODO: 在此添加变量声明' },
  ],
  'missing-connection': [
    { title: '添加连线提示', fix: '// 请检查元件引脚连接' },
  ],
  'syntax-error': [
    { title: '查看语法文档', fix: '// SPICE/Verilog 语法参考: /docs/syntax' },
  ],
};

/** Disposable 接口 */
interface IDisposable {
  dispose(): void;
}

/**
 * 注册 Code Action Provider（Quick Fix）
 */
export function registerQuickFixProvider(
  monaco: MonacoInstance,
  language: string = 'spice',
): IDisposable {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return monaco.languages.registerCodeActionProvider(language, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provideCodeActions(model: any, _range: any, context: any) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const actions: any[] = [];

      for (const marker of context.markers) {
        const suggestions = QUICK_FIX_SUGGESTIONS[marker.code as string] || [];
        for (const sug of suggestions) {
          actions.push({
            title: sug.title,
            kind: 'quickfix',
            diagnostics: [marker],
            edit: {
              edits: [{
                resource: model.uri,
                textEdit: {
                  range: marker,
                  text: sug.fix,
                },
                versionId: model.getVersionId(),
              }],
            },
          });
        }

        actions.push({
          title: '📋 复制错误信息',
          kind: 'quickfix',
          diagnostics: [marker],
          command: {
            id: 'copyErrorToClipboard',
            title: 'Copy Error',
            arguments: [marker.message],
          },
        });
      }

      return { actions, dispose: () => {} };
    },
  });
}

/**
 * 注册"复制错误"命令
 */
export function registerCopyErrorCommand(
  monaco: MonacoInstance,
): IDisposable {
  return monaco.editor.registerCommand('copyErrorToClipboard', (_accessor: unknown, message: string) => {
    navigator.clipboard.writeText(message).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = message;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
  });
}
