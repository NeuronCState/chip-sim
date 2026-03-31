/**
 * 文件系统工具 — 使用浏览器 File System Access API
 * Tauri webview（Chromium）原生支持
 */

/** 检测是否支持 File System Access API */
export function isFileSystemSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/** 选择项目保存目录，返回目录句柄 */
export async function pickProjectDirectory(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents',
    });
    return handle;
  } catch {
    // 用户取消或不支持
    return null;
  }
}

/** 选择已有项目文件夹（只读），返回目录句柄 */
export async function pickExistingProjectFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await (window as any).showDirectoryPicker({
      mode: 'read',
      startIn: 'documents',
    });
    return handle;
  } catch {
    return null;
  }
}

/** 从目录句柄递归读取所有代码文件 */
export async function readCodeFilesFromDirectory(
  dirHandle: FileSystemDirectoryHandle,
  path = ''
): Promise<Array<{ path: string; content: string; lang: string }>> {
  const files: Array<{ path: string; content: string; lang: string }> = [];
  const codeExts = new Set(['.c', '.h', '.cpp', '.ino', '.py', '.s', '.asm', '.ld']);

  async function walk(handle: FileSystemDirectoryHandle, prefix: string) {
    // @ts-ignore - for-await-of on async iterable
    for await (const [name, entry] of handle as any) {
      const fullPath = prefix ? `${prefix}/${name}` : name;

      if (entry.kind === 'file') {
        const ext = '.' + name.split('.').pop()?.toLowerCase();
        if (codeExts.has(ext)) {
          try {
            const file = await entry.getFile();
            const content = await file.text();
            const lang = (ext === '.c' || ext === '.h' || ext === '.cpp' || ext === '.ino') ? 'c'
              : ext === '.py' ? 'python'
              : ext === '.s' || ext === '.asm' ? 'asm'
              : 'text';
            files.push({ path: fullPath, content, lang });
          } catch { /* 跳过无法读取的文件 */ }
        }
      } else if (entry.kind === 'directory') {
        // 跳过常见非代码目录
        if (['node_modules', '.git', 'build', 'dist', 'target', '__pycache__'].includes(name)) continue;
        await walk(entry, fullPath);
      }
    }
  }

  await walk(dirHandle, path);
  return files;
}

/** 将文件内容写入目录句柄 */
export async function writeFileToDirectory(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string,
  content: string
): Promise<boolean> {
  try {
    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

/** 获取目录路径信息（用于显示） */
export function getDirectoryPath(handle: FileSystemDirectoryHandle): string {
  return handle.name;
}
