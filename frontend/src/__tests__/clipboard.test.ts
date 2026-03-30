import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCircuitStore } from '../stores/circuit-store';
import { ComponentType } from '../types/circuit';

// requestAnimationFrame 在测试环境不可用，同步执行回调
if (typeof requestAnimationFrame === 'undefined') {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
}

/** 获取 store 状态的快照 */
function snap() {
  return useCircuitStore.getState();
}

/** 重置 store 到干净状态 */
function resetStore() {
  const s = snap();
  s.reset();
}

describe('clipboard operations', () => {
  beforeEach(resetStore);

  describe('copySelected', () => {
    it('should not copy when nothing is selected', () => {
      const s = snap();
      s.copySelected();
      const after = snap();
      expect(after.clipboard.components).toHaveLength(0);
      expect(after.clipboard.wires).toHaveLength(0);
    });

    it('should copy selected components', () => {
      const s = snap();
      // 添加两个元件
      s.addComponent(ComponentType.Resistor, 'R1', 100, 100);
      s.addComponent(ComponentType.Capacitor, 'C1', 200, 100);
      const ids = snap().components.map((c) => c.id);

      // 选中第一个
      s.selectComponent(ids[0]);
      s.copySelected();

      const after = snap();
      expect(after.clipboard.components).toHaveLength(1);
      expect(after.clipboard.components[0].type).toBe(ComponentType.Resistor);
      expect(after.clipboard.components[0].name).toBe('R1');
    });

    it('should deep copy (not reference original)', () => {
      const s = snap();
      s.addComponent(ComponentType.Resistor, 'R1', 100, 100);
      const id = snap().components[0].id;
      s.selectComponent(id);
      s.copySelected();

      // 修改原件位置
      const original = snap().components[0];
      original.position.x = 999;

      // 副本不应受影响
      const clip = snap().clipboard.components[0];
      expect(clip.position.x).not.toBe(999);
    });
  });

  describe('paste', () => {
    it('should paste components with offset', () => {
      const s = snap();
      s.addComponent(ComponentType.Resistor, 'R1', 100, 100);
      const id = snap().components[0].id;
      s.selectComponent(id);
      s.copySelected();

      const beforeCount = snap().components.length;
      s.paste(30, 40);

      const after = snap();
      expect(after.components.length).toBe(beforeCount + 1);
      const pasted = after.components.find((c) => c.id !== id)!;
      expect(pasted).toBeDefined();
      expect(pasted.position.x).toBeCloseTo(130); // 100 + 30
      expect(pasted.position.y).toBeCloseTo(140); // 100 + 40
    });

    it('should not paste when clipboard is empty', () => {
      const s = snap();
      s.addComponent(ComponentType.Resistor, 'R1', 100, 100);
      const beforeCount = snap().components.length;

      // clipboard 初始为空
      s.paste();

      expect(snap().components.length).toBe(beforeCount);
    });

    it('should generate new IDs for pasted components', () => {
      const s = snap();
      s.addComponent(ComponentType.Resistor, 'R1', 100, 100);
      const origId = snap().components[0].id;
      s.selectComponent(origId);
      s.copySelected();
      s.paste();

      const after = snap();
      const pasted = after.components.find((c) => c.id !== origId)!;
      expect(pasted.id).not.toBe(origId);
    });

    it('should select pasted components', () => {
      const s = snap();
      s.addComponent(ComponentType.Resistor, 'R1', 100, 100);
      const origId = snap().components[0].id;
      s.selectComponent(origId);
      s.copySelected();
      s.paste();

      const after = snap();
      // 应该选中新粘贴的元件，而不是原件
      expect(after.selectedComponentId).not.toBe(origId);
      expect(after.selectedComponentId).toBeTruthy();
    });
  });

  describe('duplicate', () => {
    it('should duplicate selected component with offset', () => {
      const s = snap();
      s.addComponent(ComponentType.Resistor, 'R1', 100, 100);
      const origId = snap().components[0].id;
      s.selectComponent(origId);
      s.duplicate();

      const after = snap();
      expect(after.components.length).toBe(2);
      const dup = after.components.find((c) => c.id !== origId)!;
      expect(dup.position.x).toBeCloseTo(140); // 100 + 40
      expect(dup.position.y).toBeCloseTo(140); // 100 + 40
    });
  });

  describe('cutSelected', () => {
    it('should cut and remove selected component', () => {
      const s = snap();
      s.addComponent(ComponentType.Resistor, 'R1', 100, 100);
      s.addComponent(ComponentType.Capacitor, 'C1', 200, 100);
      const ids = snap().components.map((c) => c.id);

      s.selectComponent(ids[0]);
      s.cutSelected();

      const after = snap();
      expect(after.components.length).toBe(1);
      expect(after.components[0].type).toBe(ComponentType.Capacitor);
      // clipboard 应该有被剪切的元件
      expect(after.clipboard.components).toHaveLength(1);
      expect(after.clipboard.components[0].type).toBe(ComponentType.Resistor);
    });
  });
});
