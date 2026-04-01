/**
 * 电路序列化/反序列化模块
 * 支持导出为 JSON 和从 JSON 导入
 */

import type {
  CircuitComponent,
  CircuitNode,
  Wire,
  CircuitProject,
  SimulationConfig,
} from '../../types/circuit';
import { toast } from '../../stores/ui-store';

const PROJECT_VERSION = '1.0.0';

/**
 * 将当前电路状态序列化为 CircuitProject 对象
 */
export function serializeProject(
  name: string,
  components: CircuitComponent[],
  nodes: CircuitNode[],
  wires: Wire[],
  simulationConfig?: SimulationConfig
): CircuitProject {
  return {
    id: `proj-${Date.now().toString(36)}`,
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    components: JSON.parse(JSON.stringify(components)) as CircuitComponent[],
    nodes: JSON.parse(JSON.stringify(nodes)) as CircuitNode[],
    wires: JSON.parse(JSON.stringify(wires)) as Wire[],
    simulationConfig: simulationConfig ?? {
      analysis: { type: 'dc' },
      enabled: false,
    },
    version: PROJECT_VERSION,
  };
}

/**
 * 将 CircuitProject 导出为 JSON 字符串
 */
export function exportToJson(project: CircuitProject): string {
  return JSON.stringify(project, null, 2);
}

/**
 * 从 JSON 字符串导入 CircuitProject
 */
export function importFromJson(json: string): CircuitProject {
  const data = JSON.parse(json) as Record<string, unknown>;

  // 基本验证
  if (!data['components'] || !Array.isArray(data['components'])) {
    throw new Error('无效的电路文件：缺少 components 数组');
  }
  if (!data['wires'] || !Array.isArray(data['wires'])) {
    throw new Error('无效的电路文件：缺少 wires 数组');
  }

  return data as unknown as CircuitProject;
}

/**
 * 触发浏览器下载 JSON 文件
 */
export function downloadJson(project: CircuitProject): void {
  const json = exportToJson(project);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name || 'circuit'}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 从文件选择器读取 JSON 文件
 */
export function loadJsonFile(): Promise<CircuitProject> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('未选择文件'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const project = importFromJson(reader.result as string);
          resolve(project);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    };
    input.click();
  });
}

/**
 * 保存到 localStorage
 */
export function saveToLocalStorage(
  key: string,
  project: CircuitProject
): void {
  try {
    localStorage.setItem(key, exportToJson(project));
  } catch {
    console.warn('localStorage 保存失败');
    toast.warning('自动保存失败，localStorage 可能已满');
  }
}

/**
 * 从 localStorage 加载
 */
export function loadFromLocalStorage(key: string): CircuitProject | null {
  try {
    const json = localStorage.getItem(key);
    if (!json) return null;
    return importFromJson(json);
  } catch {
    return null;
  }
}
