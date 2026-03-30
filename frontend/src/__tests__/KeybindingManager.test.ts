import { describe, it, expect, beforeEach } from 'vitest';
import { KeybindingManager, DEFAULT_KEYBINDINGS, CATEGORY_LABELS } from '../core/KeybindingManager';
import type { ShortcutCategory, ShortcutContext } from '../core/KeybindingManager';

describe('KeybindingManager', () => {
  let manager: KeybindingManager;

  beforeEach(() => {
    manager = new KeybindingManager();
  });

  describe('默认快捷键加载', () => {
    it('应加载所有默认快捷键', () => {
      const all = manager.getAll();
      expect(all.length).toBe(DEFAULT_KEYBINDINGS.length);
    });

    it('默认快捷键应包含撤销操作', () => {
      const undo = manager.get('edit.undo');
      expect(undo).toBeDefined();
      expect(undo!.key).toBe('z');
      expect(undo!.modifiers?.ctrl).toBe(true);
      expect(undo!.action).toBe('undo');
    });

    it('默认快捷键应包含保存操作', () => {
      const save = manager.get('file.save');
      expect(save).toBeDefined();
      expect(save!.key).toBe('s');
      expect(save!.modifiers?.ctrl).toBe(true);
      expect(save!.action).toBe('save');
    });

    it('不存在的快捷键 ID 应返回 undefined', () => {
      expect(manager.get('nonexistent.binding')).toBeUndefined();
    });
  });

  describe('快捷键查询与搜索', () => {
    it('应按描述搜索快捷键', () => {
      const results = manager.search('撤销');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some(b => b.id === 'edit.undo')).toBe(true);
    });

    it('应按按键搜索快捷键', () => {
      const results = manager.search('F5');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some(b => b.action === 'runSimulation')).toBe(true);
    });

    it('应按分类分组获取快捷键', () => {
      const byCategory = manager.getAllByCategory();
      expect(byCategory.has('edit' as ShortcutCategory)).toBe(true);
      expect(byCategory.has('file' as ShortcutCategory)).toBe(true);
      expect(byCategory.has('view' as ShortcutCategory)).toBe(true);

      const editBindings = byCategory.get('edit' as ShortcutCategory)!;
      expect(editBindings.some(b => b.id === 'edit.undo')).toBe(true);
      expect(editBindings.some(b => b.id === 'edit.redo')).toBe(true);
    });

    it('搜索应不区分大小写', () => {
      const results1 = manager.search('UNDO');
      const results2 = manager.search('undo');
      expect(results1.length).toBe(results2.length);
    });
  });

  describe('快捷键上下文检测', () => {
    it('global 上下文的快捷键应在 canvas 上下文中生效', () => {
      const save = manager.get('file.save')!;
      expect(manager.isContextActive(save, 'canvas' as ShortcutContext)).toBe(true);
      expect(manager.isContextActive(save, 'input' as ShortcutContext)).toBe(true);
    });

    it('仅 canvas 上下文的快捷键不应在 input 上下文中生效', () => {
      const copy = manager.get('edit.copy')!;
      expect(manager.isContextActive(copy, 'canvas' as ShortcutContext)).toBe(true);
      expect(manager.isContextActive(copy, 'input' as ShortcutContext)).toBe(false);
    });
  });

  describe('快捷键冲突检测', () => {
    it('默认配置不应有冲突', () => {
      const conflicts = manager.detectConflicts();
      expect(conflicts.length).toBe(0);
    });

    it('手动添加冲突绑定应被检测到', () => {
      // 添加一个与 edit.undo 相同组合键的绑定
      (manager as any).bindings.set('custom.conflict', {
        id: 'custom.conflict',
        key: 'z',
        modifiers: { ctrl: true },
        category: 'edit',
        description: '自定义冲突',
        context: ['canvas'],
        action: 'copy',
      });
      (manager as any).rebuildKeyMap();

      const conflicts = manager.detectConflicts();
      expect(conflicts.length).toBeGreaterThanOrEqual(1);
      expect(conflicts[0].composite).toBe('ctrl+z');
    });
  });

  describe('自定义配置应用', () => {
    it('应能覆盖默认快捷键', () => {
      const customManager = new KeybindingManager({
        'edit.undo': { key: 'u', modifiers: { ctrl: true, shift: true } },
      });

      const undo = customManager.get('edit.undo')!;
      expect(undo.key).toBe('u');
      expect(undo.modifiers?.ctrl).toBe(true);
      expect(undo.modifiers?.shift).toBe(true);
    });

    it('导出配置应只包含可自定义项', () => {
      const config = manager.exportConfig();
      expect(typeof config).toBe('object');
      // 默认所有绑定都可自定义
      expect(Object.keys(config).length).toBe(DEFAULT_KEYBINDINGS.length);
    });
  });

  describe('快捷键格式化', () => {
    it('应正确格式化带修饰键的快捷键', () => {
      const save = manager.get('file.save')!;
      const formatted = manager.formatBinding(save);
      // 至少包含修饰键和按键
      expect(formatted).toContain('s');
      expect(formatted.split('+').length).toBeGreaterThanOrEqual(2);
    });

    it('应正确格式化纯按键', () => {
      const fit = manager.get('view.fitToScreen')!;
      const formatted = manager.formatBinding(fit);
      expect(formatted).toBe('f');
    });
  });

  describe('分类标签完整性', () => {
    it('所有分类都应有中文标签', () => {
      const categories: ShortcutCategory[] = ['file', 'edit', 'view', 'tool', 'component', 'simulation', 'help'];
      for (const cat of categories) {
        expect(CATEGORY_LABELS[cat]).toBeTruthy();
        expect(CATEGORY_LABELS[cat].length).toBeGreaterThan(0);
      }
    });
  });
});
