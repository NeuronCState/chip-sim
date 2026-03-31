/**
 * Tauri IPC API — 编译器调用接口
 * 仅在 Tauri 桌面环境下可用，浏览器环境返回降级信息
 */

// 检测是否在 Tauri 环境中（v2 暴露 __TAURI_INTERNALS__，v1 暴露 __TAURI__）
const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

// ==================== 类型 ====================

export interface CompilerInfo {
  name: string;
  family: string;
  path: string;
  version: string;
  available: boolean;
}

export interface CompileRequest {
  source: string;
  chip_family: string;
  chip_model: string;
  filename: string;
}

export interface CompileResult {
  success: boolean;
  stdout: string;
  stderr: string;
  output_path: string | null;
  output_format: string | null;
}

// ==================== API ====================

/**
 * 获取 Tauri invoke 函数（兼容 v1 和 v2）
 */
async function getInvoke(): Promise<(cmd: string, args?: any) => Promise<any>> {
  // Tauri v2: 使用 ES module import
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke;
  } catch {
    // Tauri v1 fallback: window.__TAURI__.core.invoke
    const w = window as any;
    if (w.__TAURI__?.core?.invoke) return w.__TAURI__.core.invoke;
    throw new Error('Tauri API not available');
  }
}

/**
 * 检测系统中已安装的编译器
 */
export async function detectCompilers(): Promise<CompilerInfo[]> {
  if (!isTauri) {
    return [
      { name: 'sdcc', family: 'c51', path: '', version: '', available: false },
      { name: 'avr-gcc', family: 'arduino', path: '', version: '', available: false },
      { name: 'arm-none-eabi-gcc', family: 'stm32', path: '', version: '', available: false },
      { name: 'xtensa-gcc', family: 'esp32', path: '', version: '', available: false },
    ];
  }
  const invoke = await getInvoke();
  return invoke('detect_compilers');
}

/**
 * 编译代码
 */
export async function compileCode(req: CompileRequest): Promise<CompileResult> {
  if (!isTauri) {
    return {
      success: false,
      stdout: '',
      stderr: '编译功能需要桌面版 ChipSim。请使用 Tauri 打包后运行。',
      output_path: null,
      output_format: null,
    };
  }
  const invoke = await getInvoke();
  return invoke('compile_code', { req });
}

/**
 * 判断当前是否在 Tauri 桌面环境中
 */
export function isDesktop(): boolean {
  return isTauri;
}
