/**
 * 文件系统工具
 * Tauri 桌面端：原生对话框 + plugin-fs
 * 浏览器端：File System Access API fallback
 */

/** 检测是否在 Tauri 环境中 */
function isTauriEnv(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

/** 检测是否支持 File System Access API（浏览器） */
export function isFileSystemSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

// ─── Tauri 原生对话框 ───────────────────────

async function tauriPickDirectory(): Promise<{ name: string; path: string } | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({
    directory: true,
    multiple: false,
    title: '选择项目文件夹',
  });
  if (!selected) return null;
  // selected 是路径字符串
  const path = selected as string;
  const name = path.split(/[/\\]/).pop() || path;
  return { name, path };
}

async function tauriReadCodeFiles(dirPath: string): Promise<Array<{ path: string; content: string; lang: string }>> {
  const { readDir, readTextFile } = await import('@tauri-apps/plugin-fs');
  const files: Array<{ path: string; content: string; lang: string }> = [];
  const codeExts = new Set(['.c', '.h', '.cpp', '.ino', '.py', '.s', '.asm', '.ld']);
  const skipDirs = new Set(['node_modules', '.git', 'build', 'dist', 'target', '__pycache__']);

  async function walk(currentPath: string, prefix: string) {
    const entries = await readDir(currentPath);
    for (const entry of entries) {
      const name = entry.name;
      const fullPath = prefix ? `${prefix}/${name}` : name;

      if (entry.isDirectory) {
        if (skipDirs.has(name)) continue;
        await walk(`${currentPath}/${name}`, fullPath);
      } else if (entry.isFile) {
        const ext = '.' + (name.split('.').pop()?.toLowerCase() || '');
        if (codeExts.has(ext)) {
          try {
            const content = await readTextFile(`${currentPath}/${name}`);
            const lang = ['.c', '.h', '.cpp', '.ino'].includes(ext) ? 'c'
              : ext === '.py' ? 'python'
              : ext === '.s' || ext === '.asm' ? 'asm'
              : 'text';
            files.push({ path: fullPath, content, lang });
          } catch { /* skip unreadable */ }
        }
      }
    }
  }

  await walk(dirPath, '');
  return files;
}

async function tauriWriteFile(dirPath: string, fileName: string, content: string): Promise<boolean> {
  try {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    const separator = dirPath.includes('\\') ? '\\' : '/';
    await writeTextFile(`${dirPath}${separator}${fileName}`, content);
    return true;
  } catch {
    return false;
  }
}

// ─── 浏览器 File System Access API ─────────

async function browserPickDirectory(): Promise<{ name: string; handle: FileSystemDirectoryHandle } | null> {
  try {
    const handle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents',
    });
    return { name: handle.name, handle };
  } catch {
    return null;
  }
}

async function browserReadCodeFiles(dirHandle: FileSystemDirectoryHandle): Promise<Array<{ path: string; content: string; lang: string }>> {
  const files: Array<{ path: string; content: string; lang: string }> = [];
  const codeExts = new Set(['.c', '.h', '.cpp', '.ino', '.py', '.s', '.asm', '.ld']);
  const skipDirs = new Set(['node_modules', '.git', 'build', 'dist', 'target', '__pycache__']);

  async function walk(handle: any, prefix: string) {
    for await (const [name, entry] of handle) {
      const fullPath = prefix ? `${prefix}/${name}` : name;
      if (entry.kind === 'file') {
        const ext = '.' + (name.split('.').pop()?.toLowerCase() || '');
        if (codeExts.has(ext)) {
          try {
            const file = await entry.getFile();
            const content = await file.text();
            const lang = ['.c', '.h', '.cpp', '.ino'].includes(ext) ? 'c'
              : ext === '.py' ? 'python' : 'text';
            files.push({ path: fullPath, content, lang });
          } catch { /* skip */ }
        }
      } else if (entry.kind === 'directory') {
        if (skipDirs.has(name)) continue;
        await walk(entry, fullPath);
      }
    }
  }

  await walk(dirHandle, '');
  return files;
}

// ─── 统一 API ──────────────────────────────

export interface PickedDirectory {
  name: string;
  /** Tauri: 路径字符串; 浏览器: FileSystemDirectoryHandle */
  pathOrHandle: string | FileSystemDirectoryHandle;
}

/** 选择目录（原生对话框或浏览器弹窗） */
export async function pickProjectDirectory(): Promise<PickedDirectory | null> {
  if (isTauriEnv()) {
    const result = await tauriPickDirectory();
    if (!result) return null;
    return { name: result.name, pathOrHandle: result.path };
  }

  const result = await browserPickDirectory();
  if (!result) return null;
  return { name: result.name, pathOrHandle: result.handle };
}

/** 选择已有项目文件夹并读取代码文件 */
export async function pickExistingProjectFolder(): Promise<{
  name: string;
  files: Array<{ path: string; content: string; lang: string }>;
} | null> {
  if (isTauriEnv()) {
    const result = await tauriPickDirectory();
    if (!result) return null;
    const files = await tauriReadCodeFiles(result.path);
    return { name: result.name, files };
  }

  const result = await browserPickDirectory();
  if (!result) return null;
  const files = await browserReadCodeFiles(result.handle);
  return { name: result.name, files };
}

/** 写文件到指定目录 */
export async function writeFileToDirectory(dir: PickedDirectory, fileName: string, content: string): Promise<boolean> {
  if (isTauriEnv() && typeof dir.pathOrHandle === 'string') {
    return tauriWriteFile(dir.pathOrHandle, fileName, content);
  }

  // 浏览器 fallback
  try {
    const handle = dir.pathOrHandle as FileSystemDirectoryHandle;
    const fileHandle = await handle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}
