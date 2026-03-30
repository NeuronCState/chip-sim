import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialIndex, WireIndex, bboxIntersects } from '../core/SpatialIndex';
import type { BBox, SpatialEntry } from '../core/SpatialIndex';

describe('SpatialIndex', () => {
  // ==================== bboxIntersects ====================

  describe('bboxIntersects', () => {
    it('相交的矩形应返回 true', () => {
      const a: BBox = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
      const b: BBox = { minX: 50, minY: 50, maxX: 150, maxY: 150 };
      expect(bboxIntersects(a, b)).toBe(true);
    });

    it('不相交的矩形应返回 false', () => {
      const a: BBox = { minX: 0, minY: 0, maxX: 50, maxY: 50 };
      const b: BBox = { minX: 100, minY: 100, maxX: 150, maxY: 150 };
      expect(bboxIntersects(a, b)).toBe(false);
    });

    it('相邻的矩形（共享边）应返回 true', () => {
      const a: BBox = { minX: 0, minY: 0, maxX: 50, maxY: 50 };
      const b: BBox = { minX: 50, minY: 0, maxX: 100, maxY: 50 };
      expect(bboxIntersects(a, b)).toBe(true);
    });

    it('完全包含的矩形应返回 true', () => {
      const outer: BBox = { minX: 0, minY: 0, maxX: 200, maxY: 200 };
      const inner: BBox = { minX: 50, minY: 50, maxX: 100, maxY: 100 };
      expect(bboxIntersects(outer, inner)).toBe(true);
    });
  });

  // ==================== SpatialIndex ====================

  describe('SpatialIndex', () => {
    let index: SpatialIndex<SpatialEntry>;

    beforeEach(() => {
      index = new SpatialIndex<SpatialEntry>(100);
    });

    it('插入后 size 应增加', () => {
      index.insert({ id: 'e1', bbox: { minX: 10, minY: 10, maxX: 50, maxY: 50 } });
      expect(index.size()).toBe(1);
    });

    it('重复插入相同 ID 应更新条目', () => {
      index.insert({ id: 'e1', bbox: { minX: 10, minY: 10, maxX: 50, maxY: 50 } });
      index.insert({ id: 'e1', bbox: { minX: 200, minY: 200, maxX: 250, maxY: 250 } });
      expect(index.size()).toBe(1);
      const result = index.query({ minX: 190, minY: 190, maxX: 260, maxY: 260 });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('e1');
    });

    it('remove 应移除条目', () => {
      index.insert({ id: 'e1', bbox: { minX: 10, minY: 10, maxX: 50, maxY: 50 } });
      index.remove('e1');
      expect(index.size()).toBe(0);
    });

    it('remove 不存在的 ID 应无副作用', () => {
      index.remove('nonexistent');
      expect(index.size()).toBe(0);
    });

    it('query 应返回相交的条目', () => {
      index.insert({ id: 'e1', bbox: { minX: 0, minY: 0, maxX: 50, maxY: 50 } });
      index.insert({ id: 'e2', bbox: { minX: 200, minY: 200, maxX: 250, maxY: 250 } });
      index.insert({ id: 'e3', bbox: { minX: 30, minY: 30, maxX: 80, maxY: 80 } });

      const result = index.query({ minX: 0, minY: 0, maxX: 100, maxY: 100 });
      const ids = result.map(e => e.id);
      expect(ids).toContain('e1');
      expect(ids).toContain('e3');
      expect(ids).not.toContain('e2');
    });

    it('query 不应返回重复条目', () => {
      // 跨越多个 cell 的条目不应重复
      index.insert({ id: 'big', bbox: { minX: 0, minY: 0, maxX: 300, maxY: 300 } });
      const result = index.query({ minX: 0, minY: 0, maxX: 500, maxY: 500 });
      const ids = result.map(e => e.id);
      expect(ids.filter(id => id === 'big').length).toBe(1);
    });

    it('queryViewport 是 query 的便捷方法', () => {
      index.insert({ id: 'e1', bbox: { minX: 50, minY: 50, maxX: 100, maxY: 100 } });
      index.insert({ id: 'e2', bbox: { minX: 500, minY: 500, maxX: 550, maxY: 550 } });

      const result = index.queryViewport(0, 0, 200, 200);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('e1');
    });

    it('bulkInsert 应批量插入条目', () => {
      const entries: SpatialEntry[] = [];
      for (let i = 0; i < 100; i++) {
        entries.push({ id: `e${i}`, bbox: { minX: i * 10, minY: 0, maxX: i * 10 + 5, maxY: 5 } });
      }
      index.bulkInsert(entries);
      expect(index.size()).toBe(100);
    });

    it('update 应更新条目位置', () => {
      index.insert({ id: 'e1', bbox: { minX: 0, minY: 0, maxX: 50, maxY: 50 } });
      index.update({ id: 'e1', bbox: { minX: 300, minY: 300, maxX: 350, maxY: 350 } });

      const old = index.query({ minX: 0, minY: 0, maxX: 60, maxY: 60 });
      expect(old.length).toBe(0);

      const fresh = index.query({ minX: 290, minY: 290, maxX: 360, maxY: 360 });
      expect(fresh.length).toBe(1);
    });

    it('clear 应清空所有条目', () => {
      index.insert({ id: 'e1', bbox: { minX: 0, minY: 0, maxX: 50, maxY: 50 } });
      index.insert({ id: 'e2', bbox: { minX: 100, minY: 100, maxX: 150, maxY: 150 } });
      index.clear();
      expect(index.size()).toBe(0);
    });

    it('getStats 应返回统计信息', () => {
      index.insert({ id: 'e1', bbox: { minX: 0, minY: 0, maxX: 50, maxY: 50 } });
      index.insert({ id: 'e2', bbox: { minX: 200, minY: 200, maxX: 250, maxY: 250 } });
      const stats = index.getStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.totalCells).toBeGreaterThan(0);
      expect(stats.avgEntriesPerCell).toBeGreaterThan(0);
    });
  });

  // ==================== WireIndex ====================

  describe('WireIndex', () => {
    let wireIdx: WireIndex;

    beforeEach(() => {
      wireIdx = new WireIndex();
    });

    it('addWire 后应能通过端口查找连线', () => {
      wireIdx.addWire('w1', 'R1-pin2', 'U1-A0', 'R1', 'U1');
      const wires = wireIdx.getWiresByPort('R1-pin2');
      expect(wires).toContain('w1');
    });

    it('addWire 后应能通过元件查找连线', () => {
      wireIdx.addWire('w1', 'R1-pin2', 'U1-A0', 'R1', 'U1');
      const r1Wires = wireIdx.getWiresByComponent('R1');
      const u1Wires = wireIdx.getWiresByComponent('U1');
      expect(r1Wires).toContain('w1');
      expect(u1Wires).toContain('w1');
    });

    it('removeWire 应移除连线', () => {
      wireIdx.addWire('w1', 'R1-pin2', 'U1-A0', 'R1', 'U1');
      wireIdx.removeWire('w1');
      expect(wireIdx.getWiresByPort('R1-pin2').length).toBe(0);
      expect(wireIdx.getWiresByComponent('R1').length).toBe(0);
    });

    it('removeWire 不存在的 ID 应无副作用', () => {
      wireIdx.removeWire('nonexistent');
    });

    it('getWiresByPort 应同时搜索起始和目标端口', () => {
      wireIdx.addWire('w1', 'A-out', 'B-in', 'A', 'B');
      wireIdx.addWire('w2', 'C-out', 'A-in', 'C', 'A');
      const aPortWires = wireIdx.getWiresByPort('A-out');
      expect(aPortWires).toContain('w1');
    });

    it('clear 应清空所有索引', () => {
      wireIdx.addWire('w1', 'A-out', 'B-in', 'A', 'B');
      wireIdx.addWire('w2', 'C-out', 'D-in', 'C', 'D');
      wireIdx.clear();
      expect(wireIdx.getWiresByPort('A-out').length).toBe(0);
      expect(wireIdx.getWiresByComponent('A').length).toBe(0);
    });

    it('重复添加相同 wireId 应先移除旧的', () => {
      wireIdx.addWire('w1', 'A-out', 'B-in', 'A', 'B');
      wireIdx.addWire('w1', 'C-out', 'D-in', 'C', 'D');
      expect(wireIdx.getWiresByComponent('A').length).toBe(0);
      expect(wireIdx.getWiresByComponent('C').length).toBe(1);
    });

    it('同元件的两个端口不应重复添加连线', () => {
      wireIdx.addWire('w1', 'U1-out', 'U1-in', 'U1', 'U1');
      const u1Wires = wireIdx.getWiresByComponent('U1');
      expect(u1Wires.length).toBe(1);
    });
  });
});
