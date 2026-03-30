/**
 * 快捷键管理器
 * 
 * 统一管理 chip-sim 所有键盘快捷键，支持：
 * - 可配置的快捷键映射（KeybindingConfig）
 * - 快捷键冲突检测
 * - 上下文感知（画布焦点 vs 输入框焦点）
 * - 分类管理（编辑、视图、仿真、文件等）
 * - 搜索功能
 */

import type { ComponentType } from '../types/circuit';

// ==================== 类型定义 ====================

/** 快捷键修饰键 */
export interface KeyModifiers {
  ctrl?: boolean;   // 也映射 Cmd (macOS)
  shift?: boolean;
  alt?: boolean;
}

/** 快捷键定义 */
export interface KeyBinding {
  /** 唯一标识 */
  id: string;
  /** 按键（如 'z', 's', '/', 'F1' 等） */
  key: string;
  /** 修饰键 */
  modifiers?: KeyModifiers;
  /** 分类 */
  category: ShortcutCategory;
  /** 中文描述 */
  description: string;
  /** 英文描述（可选，用于国际化） */
  descriptionEn?: string;
  /** 上下文：哪些场景下生效 */
  context: ShortcutContext[];
  /** 是否可被用户自定义 */
  configurable?: boolean;
  /** 执行的动作 ID（对应 store action） */
  action: ShortcutAction;
  /** 附加参数（如快速放置元件的类型） */
  actionParams?: Record<string, unknown>;
  /** 需要选中元件才生效 */
  requiresSelection?: boolean;
  /** 需要选中多个元件才生效 */
  requiresMultiSelection?: boolean;
  /** 是否阻止默认行为 */
  preventDefault?: boolean;
}

/** 快捷键分类 */
export type ShortcutCategory =
  | 'file'      // 文件操作
  | 'edit'      // 编辑操作
  | 'view'      // 视图控制
  | 'tool'      // 工具切换
  | 'component' // 元件操作
  | 'simulation' // 仿真
  | 'help';     // 帮助

/** 快捷键上下文 */
export type ShortcutContext =
  | 'canvas'    // 画布获得焦点
  | 'global'    // 全局生效
  | 'input';    // 输入框获得焦点（特殊处理）

/** 快捷键动作 */
export type ShortcutAction =
  | 'undo'
  | 'redo'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'selectAll'
  | 'delete'
  | 'duplicate'
  | 'save'
  | 'newProject'
  | 'escape'
  | 'rotate'
  | 'fitToScreen'
  | 'zoomIn'
  | 'zoomOut'
  | 'toggleGrid'
  | 'toggleSnap'
  | 'toolSelect'
  | 'toolWire'
  | 'toolPan'
  | 'toolDelete'
  | 'toggleShortcutsHelp'
  | 'runSimulation'
  | 'quickPlace'
  | 'group'
  | 'ungroup'
  | 'cycleRouting'
  | 'toggleTheme';

/** 快捷键配置（用户自定义时使用） */
export type KeybindingConfig = Record<string, Partial<KeyBinding>>;

// ==================== 默认快捷键映射 ====================

/** 默认快捷键列表 */
export const DEFAULT_KEYBINDINGS: KeyBinding[] = [
  // ---- 文件 ----
  {
    id: 'file.save',
    key: 's',
    modifiers: { ctrl: true },
    category: 'file',
    description: '保存项目',
    context: ['global'],
    action: 'save',
    preventDefault: true,
  },
  {
    id: 'file.new',
    key: 'n',
    modifiers: { ctrl: true },
    category: 'file',
    description: '新建电路',
    context: ['global'],
    action: 'newProject',
    preventDefault: true,
  },

  // ---- 编辑 ----
  {
    id: 'edit.undo',
    key: 'z',
    modifiers: { ctrl: true },
    category: 'edit',
    description: '撤销',
    context: ['canvas', 'global'],
    action: 'undo',
    preventDefault: true,
  },
  {
    id: 'edit.redo',
    key: 'y',
    modifiers: { ctrl: true },
    category: 'edit',
    description: '重做',
    context: ['canvas', 'global'],
    action: 'redo',
    preventDefault: true,
  },
  {
    id: 'edit.redo.alt',
    key: 'z',
    modifiers: { ctrl: true, shift: true },
    category: 'edit',
    description: '重做（备用）',
    context: ['canvas', 'global'],
    action: 'redo',
    preventDefault: true,
  },
  {
    id: 'edit.copy',
    key: 'c',
    modifiers: { ctrl: true },
    category: 'edit',
    description: '复制',
    context: ['canvas'],
    action: 'copy',
    requiresSelection: true,
    preventDefault: true,
  },
  {
    id: 'edit.cut',
    key: 'x',
    modifiers: { ctrl: true },
    category: 'edit',
    description: '剪切',
    context: ['canvas'],
    action: 'cut',
    requiresSelection: true,
    preventDefault: true,
  },
  {
    id: 'edit.paste',
    key: 'v',
    modifiers: { ctrl: true },
    category: 'edit',
    description: '粘贴',
    context: ['canvas', 'global'],
    action: 'paste',
    preventDefault: true,
  },
  {
    id: 'edit.selectAll',
    key: 'a',
    modifiers: { ctrl: true },
    category: 'edit',
    description: '全选',
    context: ['canvas'],
    action: 'selectAll',
    preventDefault: true,
  },
  {
    id: 'edit.duplicate',
    key: 'd',
    modifiers: { ctrl: true },
    category: 'edit',
    description: '复制并偏移 (Duplicate)',
    context: ['canvas'],
    action: 'duplicate',
    requiresSelection: true,
    preventDefault: true,
  },
  {
    id: 'edit.delete',
    key: 'Delete',
    category: 'edit',
    description: '删除选中',
    context: ['canvas'],
    action: 'delete',
    requiresSelection: true,
  },
  {
    id: 'edit.delete.alt',
    key: 'Backspace',
    category: 'edit',
    description: '删除选中（备用）',
    context: ['canvas'],
    action: 'delete',
    requiresSelection: true,
  },
  {
    id: 'edit.escape',
    key: 'Escape',
    category: 'edit',
    description: '取消操作 / 清除选择',
    context: ['canvas', 'global'],
    action: 'escape',
  },
  {
    id: 'edit.group',
    key: 'g',
    modifiers: { ctrl: true },
    category: 'edit',
    description: '组合/取消组合',
    context: ['canvas'],
    action: 'group',
    requiresSelection: true,
    preventDefault: true,
  },

  // ---- 视图 ----
  {
    id: 'view.fitToScreen',
    key: 'f',
    category: 'view',
    description: '适配屏幕',
    context: ['canvas'],
    action: 'fitToScreen',
  },
  {
    id: 'view.zoomIn',
    key: '=',
    modifiers: { ctrl: true },
    category: 'view',
    description: '放大',
    context: ['canvas', 'global'],
    action: 'zoomIn',
    preventDefault: true,
  },
  {
    id: 'view.zoomOut',
    key: '-',
    modifiers: { ctrl: true },
    category: 'view',
    description: '缩小',
    context: ['canvas', 'global'],
    action: 'zoomOut',
    preventDefault: true,
  },
  {
    id: 'view.toggleGrid',
    key: 'g',
    category: 'view',
    description: '切换网格显示',
    context: ['canvas'],
    action: 'toggleGrid',
  },
  {
    id: 'view.toggleSnap',
    key: 's',
    category: 'view',
    description: '切换吸附',
    context: ['canvas'],
    action: 'toggleSnap',
  },
  {
    id: 'view.cycleRouting',
    key: 'l',
    category: 'view',
    description: '切换连线模式',
    context: ['canvas'],
    action: 'cycleRouting',
  },

  // ---- 工具 ----
  {
    id: 'tool.select',
    key: 'v',
    category: 'tool',
    description: '选择工具',
    context: ['canvas'],
    action: 'toolSelect',
  },
  {
    id: 'tool.wire',
    key: 'w',
    category: 'tool',
    description: '连线工具',
    context: ['canvas'],
    action: 'toolWire',
  },
  {
    id: 'tool.pan',
    key: 'h',
    category: 'tool',
    description: '平移工具',
    context: ['canvas'],
    action: 'toolPan',
  },
  {
    id: 'tool.delete',
    key: 'e',
    category: 'tool',
    description: '删除工具',
    context: ['canvas'],
    action: 'toolDelete',
  },

  // ---- 元件操作 ----
  {
    id: 'component.rotate',
    key: 'r',
    category: 'component',
    description: '旋转选中元件 90°',
    context: ['canvas'],
    action: 'rotate',
    requiresSelection: true,
  },

  // ---- 快速放置 (1-9) ----
  {
    id: 'quickplace.1',
    key: '1',
    category: 'component',
    description: '快速放置：电阻',
    context: ['canvas'],
    action: 'quickPlace',
    actionParams: { componentType: 'resistor' },
  },
  {
    id: 'quickplace.2',
    key: '2',
    category: 'component',
    description: '快速放置：电容',
    context: ['canvas'],
    action: 'quickPlace',
    actionParams: { componentType: 'capacitor' },
  },
  {
    id: 'quickplace.3',
    key: '3',
    category: 'component',
    description: '快速放置：电感',
    context: ['canvas'],
    action: 'quickPlace',
    actionParams: { componentType: 'inductor' },
  },
  {
    id: 'quickplace.4',
    key: '4',
    category: 'component',
    description: '快速放置：直流源',
    context: ['canvas'],
    action: 'quickPlace',
    actionParams: { componentType: 'dc_source' },
  },
  {
    id: 'quickplace.5',
    key: '5',
    category: 'component',
    description: '快速放置：交流源',
    context: ['canvas'],
    action: 'quickPlace',
    actionParams: { componentType: 'ac_source' },
  },
  {
    id: 'quickplace.6',
    key: '6',
    category: 'component',
    description: '快速放置：接地',
    context: ['canvas'],
    action: 'quickPlace',
    actionParams: { componentType: 'ground' },
  },
  {
    id: 'quickplace.7',
    key: '7',
    category: 'component',
    description: '快速放置：二极管',
    context: ['canvas'],
    action: 'quickPlace',
    actionParams: { componentType: 'diode' },
  },
  {
    id: 'quickplace.8',
    key: '8',
    category: 'component',
    description: '快速放置：NPN晶体管',
    context: ['canvas'],
    action: 'quickPlace',
    actionParams: { componentType: 'bjt_npn' },
  },
  {
    id: 'quickplace.9',
    key: '9',
    category: 'component',
    description: '快速放置：运放',
    context: ['canvas'],
    action: 'quickPlace',
    actionParams: { componentType: 'op_amp' },
  },

  // ---- 仿真 ----
  {
    id: 'simulation.run',
    key: 'F5',
    category: 'simulation',
    description: '运行仿真',
    context: ['canvas', 'global'],
    action: 'runSimulation',
  },

  // ---- 帮助 ----
  {
    id: 'help.shortcuts',
    key: '?',
    category: 'help',
    description: '快捷键速查表',
    context: ['canvas', 'global'],
    action: 'toggleShortcutsHelp',
  },
  {
    id: 'help.shortcuts.alt',
    key: 'F1',
    category: 'help',
    description: '快捷键速查表（备用）',
    context: ['canvas', 'global'],
    action: 'toggleShortcutsHelp',
  },
  {
    id: 'view.toggleTheme',
    key: 't',
    category: 'view',
    description: '切换主题',
    context: ['canvas'],
    action: 'toggleTheme',
  },
];

// ==================== 快捷键管理器类 ====================

export class KeybindingManager {
  private bindings: Map<string, KeyBinding> = new Map();
  private keyMap: Map<string, KeyBinding> = new Map(); // composite key → binding

  constructor(customConfig?: KeybindingConfig) {
    this.loadDefaults();
    if (customConfig) {
      this.applyConfig(customConfig);
    }
  }

  /** 加载默认快捷键 */
  private loadDefaults(): void {
    for (const binding of DEFAULT_KEYBINDINGS) {
      this.bindings.set(binding.id, { ...binding });
    }
    this.rebuildKeyMap();
  }

  /** 重建按键查找表 */
  private rebuildKeyMap(): void {
    this.keyMap.clear();
    for (const binding of this.bindings.values()) {
      const composite = this.getCompositeKey(binding);
      this.keyMap.set(composite, binding);
    }
  }

  /** 生成组合键字符串 */
  private getCompositeKey(binding: KeyBinding): string {
    const parts: string[] = [];
    if (binding.modifiers?.ctrl) parts.push('ctrl');
    if (binding.modifiers?.shift) parts.push('shift');
    if (binding.modifiers?.alt) parts.push('alt');
    parts.push(binding.key.toLowerCase());
    return parts.join('+');
  }

  /** 从键盘事件生成组合键字符串 */
  private getCompositeFromEvent(e: KeyboardEvent): string {
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    parts.push(e.key.toLowerCase());
    return parts.join('+');
  }

  /** 应用用户自定义配置 */
  applyConfig(config: KeybindingConfig): void {
    for (const [id, partial] of Object.entries(config)) {
      const existing = this.bindings.get(id);
      if (existing) {
        this.bindings.set(id, { ...existing, ...partial });
      }
    }
    this.rebuildKeyMap();
  }

  /** 导出当前配置（仅可自定义项） */
  exportConfig(): KeybindingConfig {
    const config: KeybindingConfig = {};
    for (const binding of this.bindings.values()) {
      if (binding.configurable !== false) {
        config[binding.id] = {
          key: binding.key,
          modifiers: binding.modifiers,
        };
      }
    }
    return config;
  }

  /** 从本地存储加载配置 */
  loadFromStorage(): void {
    try {
      const json = localStorage.getItem('chip-sim-keybindings');
      if (json) {
        const config = JSON.parse(json) as KeybindingConfig;
        this.applyConfig(config);
      }
    } catch {
      console.warn('快捷键配置加载失败，使用默认配置');
    }
  }

  /** 保存配置到本地存储 */
  saveToStorage(): void {
    try {
      const config = this.exportConfig();
      localStorage.setItem('chip-sim-keybindings', JSON.stringify(config));
    } catch {
      console.warn('快捷键配置保存失败');
    }
  }

  /** 根据键盘事件查找对应快捷键 */
  resolve(e: KeyboardEvent): KeyBinding | null {
    const composite = this.getCompositeFromEvent(e);
    return this.keyMap.get(composite) ?? null;
  }

  /** 检查当前上下文是否匹配 */
  isContextActive(binding: KeyBinding, currentContext: ShortcutContext): boolean {
    return binding.context.includes('global') || binding.context.includes(currentContext);
  }

  /** 获取所有快捷键（按分类分组） */
  getAllByCategory(): Map<ShortcutCategory, KeyBinding[]> {
    const grouped = new Map<ShortcutCategory, KeyBinding[]>();
    for (const binding of this.bindings.values()) {
      const list = grouped.get(binding.category) ?? [];
      list.push(binding);
      grouped.set(binding.category, list);
    }
    return grouped;
  }

  /** 搜索快捷键 */
  search(query: string): KeyBinding[] {
    const q = query.toLowerCase();
    return Array.from(this.bindings.values()).filter(
      (b) =>
        b.description.toLowerCase().includes(q) ||
        b.descriptionEn?.toLowerCase().includes(q) ||
        b.key.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q) ||
        this.formatBinding(b).toLowerCase().includes(q)
    );
  }

  /** 格式化快捷键为可读字符串 */
  formatBinding(binding: KeyBinding): string {
    const parts: string[] = [];
    if (binding.modifiers?.ctrl) parts.push(navigator.platform.includes('Mac') ? '⌘' : 'Ctrl');
    if (binding.modifiers?.shift) parts.push('Shift');
    if (binding.modifiers?.alt) parts.push('Alt');
    // 美化按键名
    let keyDisplay = binding.key;
    if (keyDisplay === ' ') keyDisplay = 'Space';
    if (keyDisplay === '=') keyDisplay = '+';
    parts.push(keyDisplay);
    return parts.join('+');
  }

  /** 冲突检测：返回所有冲突的快捷键对 */
  detectConflicts(): Array<{ a: KeyBinding; b: KeyBinding; composite: string }> {
    const conflicts: Array<{ a: KeyBinding; b: KeyBinding; composite: string }> = [];
    const seen = new Map<string, KeyBinding>();

    for (const binding of this.bindings.values()) {
      const composite = this.getCompositeKey(binding);
      const prev = seen.get(composite);
      if (prev) {
        // 同一组合键但不同上下文不算冲突
        const overlap = binding.context.filter((c) => prev.context.includes(c) || c === 'global' || prev.context.includes('global'));
        if (overlap.length > 0) {
          conflicts.push({ a: prev, b: binding, composite });
        }
      } else {
        seen.set(composite, binding);
      }
    }
    return conflicts;
  }

  /** 获取单个快捷键 */
  get(id: string): KeyBinding | undefined {
    return this.bindings.get(id);
  }

  /** 获取所有快捷键 */
  getAll(): KeyBinding[] {
    return Array.from(this.bindings.values());
  }
}

// ==================== 快速放置元件映射 ====================

/** 快速放置序号 → 元件类型映射 */
export const QUICKPLACE_MAP: Record<string, { type: ComponentType; name: string; prefix: string }> = {
  'resistor':   { type: 'resistor' as ComponentType,    name: 'R', prefix: 'R' },
  'capacitor':  { type: 'capacitor' as ComponentType,   name: 'C', prefix: 'C' },
  'inductor':   { type: 'inductor' as ComponentType,    name: 'L', prefix: 'L' },
  'dc_source':  { type: 'dc_source' as ComponentType,   name: 'V', prefix: 'V' },
  'ac_source':  { type: 'ac_source' as ComponentType,   name: 'AC', prefix: 'AC' },
  'ground':     { type: 'ground' as ComponentType,      name: 'GND', prefix: 'G' },
  'diode':      { type: 'diode' as ComponentType,       name: 'D', prefix: 'D' },
  'bjt_npn':    { type: 'bjt_npn' as ComponentType,     name: 'Q', prefix: 'Q' },
  'op_amp':     { type: 'op_amp' as ComponentType,      name: 'U', prefix: 'U' },
};

/** 分类中文名 */
export const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  file: '📄 文件',
  edit: '✏️ 编辑',
  view: '👁️ 视图',
  tool: '🔧 工具',
  component: '📦 元件',
  simulation: '▶️ 仿真',
  help: '❓ 帮助',
};

/** 分类排序 */
export const CATEGORY_ORDER: ShortcutCategory[] = [
  'file', 'edit', 'component', 'tool', 'view', 'simulation', 'help',
];
