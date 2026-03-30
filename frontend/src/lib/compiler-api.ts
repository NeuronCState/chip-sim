/**
 * Tauri IPC API — 编译器调用接口
 * 仅在 Tauri 桌面环境下可用，浏览器环境返回降级信息
 */

// 检测是否在 Tauri 环境中
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

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
 * 检测系统中已安装的编译器
 */
export async function detectCompilers(): Promise<CompilerInfo[]> {
  if (!isTauri) {
    // 浏览器环境返回空
    return [
      { name: 'sdcc', family: 'c51', path: '', version: '', available: false },
      { name: 'avr-gcc', family: 'arduino', path: '', version: '', available: false },
      { name: 'arm-none-eabi-gcc', family: 'stm32', path: '', version: '', available: false },
      { name: 'xtensa-gcc', family: 'esp32', path: '', version: '', available: false },
    ];
  }
  const { invoke } = (window as any).__TAURI__.core;
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
  const { invoke } = (window as any).__TAURI__.core;
  return invoke('compile_code', { req });
}

/**
 * 判断当前是否在 Tauri 桌面环境中
 */
export function isDesktop(): boolean {
  return isTauri;
}
