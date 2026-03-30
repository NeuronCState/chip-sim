/**
 * 项目导入导出服务
 * 支持 .chipsim JSON 文件导入导出、SVG 导出、版本兼容性检查
 */

import type { Project, ExportFile, BundleExportFile, ImportResult } from '../types/project';
import {
  CURRENT_PROJECT_VERSION,
  checkVersionCompat,
  upgradeFromLegacy,
} from '../types/project';
import { projectStorage } from './projectStorage';

// ==================== 导出 ====================

/** 将项目导出为 JSON 字符串 */
export function projectToJson(project: Project): string {
  const exportFile: ExportFile = {
    header: {
      format: 'chip-sim-project',
      version: CURRENT_PROJECT_VERSION,
      exportedAt: new Date().toISOString(),
    },
    project: {
      ...project,
      version: CURRENT_PROJECT_VERSION,
      updatedAt: new Date().toISOString(),
    },
  };
  return JSON.stringify(exportFile, null, 2);
}

/** 导出项目为 .chipsim 文件并触发下载 */
export function exportProject(project: Project): void {
  const json = projectToJson(project);
  const blob = new Blob([json], { type: 'application/json' });
  const filename = `${sanitizeFilename(project.name)}.chipsim`;
  downloadBlob(blob, filename);
}

/** 批量导出所有项目 */
export async function exportAllProjects(): Promise<void> {
  const summaries = await projectStorage.listProjects();
  const projects: Project[] = [];

  for (const summary of summaries) {
    const project = await projectStorage.getProject(summary.id);
    if (project) projects.push(project);
  }

  const bundle: BundleExportFile = {
    header: {
      format: 'chip-sim-bundle',
      version: CURRENT_PROJECT_VERSION,
      exportedAt: new Date().toISOString(),
      projectCount: projects.length,
    },
    projects,
  };

  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `chip-sim-backup-${date}.chipsim`);
}

// ==================== 导入 ====================

/** 从文件导入项目 */
export async function importProjectFromFile(file: File): Promise<ImportResult> {
  try {
    const text = await readFileAsText(file);
    return importProjectFromJson(text);
  } catch (err) {
    return { success: false, error: `文件读取失败: ${err}` };
  }
}

/** 从 JSON 字符串导入项目 */
export async function importProjectFromJson(json: string): Promise<ImportResult> {
  const warnings: string[] = [];

  try {
    const data = JSON.parse(json);

    // 检查是否为导出文件格式（带 header）
    if (data.header && data.header.format === 'chip-sim-project') {
      const compat = checkVersionCompat(data.header.version);
      if (compat === 'incompatible') {
        return {
          success: false,
          error: `文件版本 ${data.header.version} 不兼容，当前支持 ${CURRENT_PROJECT_VERSION}`,
        };
      }
      if (compat === 'upgradeable') {
        warnings.push(`文件版本 ${data.header.version} 已自动升级到 ${CURRENT_PROJECT_VERSION}`);
      }

      const project = data.project as Project;
      project.version = CURRENT_PROJECT_VERSION;
      project.id = generateProjectId();
      project.createdAt = new Date().toISOString();
      project.updatedAt = new Date().toISOString();

      await projectStorage.saveProject(project);
      return { success: true, projectId: project.id, projectName: project.name, warnings };
    }

    // 批量导入格式
    if (data.header && data.header.format === 'chip-sim-bundle') {
      if (!Array.isArray(data.projects)) {
        return { success: false, error: '批量文件格式无效：缺少 projects 数组' };
      }

      let importedCount = 0;
      for (const raw of data.projects) {
        const project = upgradeFromLegacy(raw);
        project.id = generateProjectId();
        project.createdAt = new Date().toISOString();
        project.updatedAt = new Date().toISOString();
        await projectStorage.saveProject(project);
        importedCount++;
      }

      return {
        success: true,
        projectName: `${importedCount} 个项目`,
        warnings: [`成功导入 ${importedCount} 个项目`],
      };
    }

    // 兼容旧版 CircuitProject 格式（无 header）
    if (data.components && Array.isArray(data.components)) {
      const project = upgradeFromLegacy(data);
      project.id = generateProjectId();
      project.createdAt = new Date().toISOString();
      project.updatedAt = new Date().toISOString();

      await projectStorage.saveProject(project);
      warnings.push('已从旧版格式导入并升级');
      return { success: true, projectId: project.id, projectName: project.name, warnings };
    }

    return { success: false, error: '无法识别的文件格式' };
  } catch (err) {
    return { success: false, error: `JSON 解析失败: ${err}` };
  }
}

/** 通过文件选择器导入 */
export async function importProjectPicker(): Promise<ImportResult> {
  return new Promise<ImportResult>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.chipsim,.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve({ success: false, error: '未选择文件' });
        return;
      }
      resolve(await importProjectFromFile(file));
    };
    input.click();
  });
}

// ==================== SVG 导出 ====================

/**
 * 将画布导出为 SVG
 * @param canvas 画布元素
 * @param project 当前项目（用于标题）
 */
export function exportCanvasAsSVG(canvas: HTMLCanvasElement, projectName: string): void {
  // 从 canvas 获取图像数据并包装为 SVG
  const dataUrl = canvas.toDataURL('image/png');
  const width = canvas.width;
  const height = canvas.height;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <title>${escapeXml(projectName)}</title>
  <rect width="100%" height="100%" fill="#1a1a2e"/>
  <image xlink:href="${dataUrl}" width="${width}" height="${height}"/>
</svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  downloadBlob(blob, `${sanitizeFilename(projectName)}.svg`);
}

/**
 * 将画布导出为 PNG
 */
export function exportCanvasAsPNG(canvas: HTMLCanvasElement, projectName: string): void {
  canvas.toBlob((blob) => {
    if (blob) {
      downloadBlob(blob, `${sanitizeFilename(projectName)}.png`);
    }
  }, 'image/png');
}

// ==================== 版本兼容性 ====================

/** 验证导入文件版本 */
export function validateImportFile(json: string): { valid: boolean; version?: string; error?: string } {
  try {
    const data = JSON.parse(json);

    if (data.header?.format === 'chip-sim-project') {
      const compat = checkVersionCompat(data.header.version);
      return {
        valid: compat !== 'incompatible',
        version: data.header.version,
        error: compat === 'incompatible' ? `版本 ${data.header.version} 不兼容` : undefined,
      };
    }

    if (data.header?.format === 'chip-sim-bundle') {
      const compat = checkVersionCompat(data.header.version);
      return {
        valid: compat !== 'incompatible',
        version: data.header.version,
        error: compat === 'incompatible' ? `批量文件版本 ${data.header.version} 不兼容` : undefined,
      };
    }

    // 无 header 的旧格式，视为可升级
    if (data.components) {
      return { valid: true, version: '1.0.0' };
    }

    return { valid: false, error: '无法识别的文件格式' };
  } catch {
    return { valid: false, error: 'JSON 解析失败' };
  }
}

// ==================== 辅助函数 ====================

function generateProjectId(): string {
  return `proj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 100) || 'untitled';
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
