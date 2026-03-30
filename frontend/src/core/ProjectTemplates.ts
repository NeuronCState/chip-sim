/**
 * 项目模板系统
 * 内置模板 + 用户自定义模板
 */

import type { CircuitComponent, CircuitNode, Wire } from '../types/circuit';
import { ComponentType } from '../types/circuit';
import { createComponent } from '../lib/circuit/circuit-utils';

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** 是否内置模板 */
  builtin: boolean;
  /** 模板数据 */
  data: {
    components: CircuitComponent[];
    nodes: CircuitNode[];
    wires: Wire[];
  };
}

const TEMPLATES_STORAGE_KEY = 'chip-sim-templates';

/** 内置模板 */
export const BUILTIN_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'blank',
    name: '空白项目',
    description: '从零开始创建电路',
    icon: '📄',
    builtin: true,
    data: { components: [], nodes: [], wires: [] },
  },
  {
    id: 'arduino-uno-led',
    name: 'Arduino Uno LED',
    description: '基础 LED 闪烁电路，含限流电阻',
    icon: '💡',
    builtin: true,
    data: generateArduinoLedTemplate(),
  },
  {
    id: 'timer-555-astable',
    name: '555 定时器（无稳态）',
    description: '经典 555 无稳态多谐振荡器电路',
    icon: '⏱️',
    builtin: true,
    data: generate555Template(),
  },
];

function generateArduinoLedTemplate() {
  const components: CircuitComponent[] = [
    createComponent(ComponentType.VoltageSource, 'V1', { x: 100, y: 200 }, 5, 'V', [
      { offset: { x: -25, y: 0 } }, { offset: { x: 25, y: 0 } },
    ]),
    createComponent(ComponentType.Resistor, 'R1 (220Ω)', { x: 250, y: 200 }, 220, 'Ω', [
      { offset: { x: -25, y: 0 } }, { offset: { x: 25, y: 0 } },
    ]),
    createComponent(ComponentType.Diode, 'D1 (LED)', { x: 400, y: 200 }, 2, 'V', [
      { offset: { x: -25, y: 0 } }, { offset: { x: 25, y: 0 } },
    ]),
    createComponent(ComponentType.Ground, 'GND', { x: 400, y: 300 }, 0, 'V', [
      { offset: { x: 0, y: -15 } },
    ]),
  ];

  return { components, nodes: [], wires: [] };
}

function generate555Template() {
  const components: CircuitComponent[] = [
    createComponent(ComponentType.VoltageSource, 'VCC', { x: 100, y: 100 }, 5, 'V', [
      { offset: { x: -25, y: 0 } }, { offset: { x: 25, y: 0 } },
    ]),
    createComponent(ComponentType.Timer555, 'U1 (555)', { x: 300, y: 200 }, 5, 'V', [
      { offset: { x: -25, y: -12 } },
      { offset: { x: -25, y: -4 } },
      { offset: { x: 25, y: 0 } },
      { offset: { x: 25, y: -10 } },
      { offset: { x: 25, y: 10 } },
      { offset: { x: -25, y: 4 } },
      { offset: { x: -25, y: 12 } },
      { offset: { x: 25, y: 18 } },
    ]),
    createComponent(ComponentType.Resistor, 'R1', { x: 180, y: 120 }, 10000, 'Ω', [
      { offset: { x: -25, y: 0 } }, { offset: { x: 25, y: 0 } },
    ]),
    createComponent(ComponentType.Resistor, 'R2', { x: 180, y: 160 }, 10000, 'Ω', [
      { offset: { x: -25, y: 0 } }, { offset: { x: 25, y: 0 } },
    ]),
    createComponent(ComponentType.Capacitor, 'C1', { x: 180, y: 260 }, 1e-6, 'F', [
      { offset: { x: -25, y: 0 } }, { offset: { x: 25, y: 0 } },
    ]),
    createComponent(ComponentType.Ground, 'GND', { x: 300, y: 340 }, 0, 'V', [
      { offset: { x: 0, y: -15 } },
    ]),
  ];

  return { components, nodes: [], wires: [] };
}

/** 获取所有模板（内置 + 用户自定义） */
export function getAllTemplates(): ProjectTemplate[] {
  const userTemplates = getUserTemplates();
  return [...BUILTIN_TEMPLATES, ...userTemplates];
}

/** 获取用户自定义模板 */
export function getUserTemplates(): ProjectTemplate[] {
  try {
    const json = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (!json) return [];
    return JSON.parse(json) as ProjectTemplate[];
  } catch {
    return [];
  }
}

/** 保存用户自定义模板 */
export function saveUserTemplate(template: ProjectTemplate): void {
  const templates = getUserTemplates();
  templates.push({ ...template, builtin: false });
  localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
}

/** 删除用户自定义模板 */
export function deleteUserTemplate(id: string): void {
  const templates = getUserTemplates().filter(t => t.id !== id);
  localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
}

/** 从当前项目创建模板 */
export function createTemplateFromProject(
  name: string,
  description: string,
  data: { components: CircuitComponent[]; nodes: CircuitNode[]; wires: Wire[] }
): ProjectTemplate {
  return {
    id: `tpl-${Date.now().toString(36)}`,
    name,
    description,
    icon: '📐',
    builtin: false,
    data: JSON.parse(JSON.stringify(data)),
  };
}
