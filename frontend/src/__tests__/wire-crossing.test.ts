import { describe, it, expect } from 'vitest';
import {
  detectWireCrossings,
  detectAllCrossings,
  generateJumperArc,
  jumperArcToSVG,
  detectParallelGroups,
  simplifyToBus,
  getCrossingReport,
} from '../core/wireCrossing';
import type { Wire } from '../types/circuit';

const makeWire = (
  id: string,
  points: { x: number; y: number; isBend?: boolean }[]
): Wire => ({
  id,
  fromComponentId: 'c1',
  fromPortId: 'p1',
  toComponentId: 'c2',
  toPortId: 'p2',
  points,
  status: 'connected',
});

describe('wireCrossing', () => {
  describe('detectWireCrossings', () => {
    it('should detect crossing between horizontal and vertical wires', () => {
      const wire1 = makeWire('w1', [
        { x: 0, y: 100 },
        { x: 200, y: 100 },
      ]);
      const wire2 = makeWire('w2', [
        { x: 100, y: 0 },
        { x: 100, y: 200 },
      ]);

      const crossings = detectWireCrossings(wire1, wire2);
      expect(crossings).toHaveLength(1);
      expect(crossings[0].position).toEqual({ x: 100, y: 100 });
    });

    it('should not detect crossing for parallel wires', () => {
      const wire1 = makeWire('w1', [
        { x: 0, y: 100 },
        { x: 200, y: 100 },
      ]);
      const wire2 = makeWire('w2', [
        { x: 0, y: 200 },
        { x: 200, y: 200 },
      ]);

      const crossings = detectWireCrossings(wire1, wire2);
      expect(crossings).toHaveLength(0);
    });

    it('should detect multiple crossings for L-shaped wires', () => {
      const wire1 = makeWire('w1', [
        { x: 0, y: 50 },
        { x: 150, y: 50, isBend: true },
        { x: 150, y: 150 },
      ]);
      const wire2 = makeWire('w2', [
        { x: 100, y: 0 },
        { x: 100, y: 200 },
      ]);

      const crossings = detectWireCrossings(wire1, wire2);
      expect(crossings.length).toBeGreaterThanOrEqual(1);
    });

    it('should not detect crossing when segments do not overlap', () => {
      const wire1 = makeWire('w1', [
        { x: 0, y: 100 },
        { x: 50, y: 100 },
      ]);
      const wire2 = makeWire('w2', [
        { x: 100, y: 0 },
        { x: 100, y: 50 },
      ]);

      const crossings = detectWireCrossings(wire1, wire2);
      expect(crossings).toHaveLength(0);
    });
  });

  describe('detectAllCrossings', () => {
    it('should find crossings among multiple wires', () => {
      const wires = [
        makeWire('w1', [{ x: 0, y: 100 }, { x: 200, y: 100 }]),
        makeWire('w2', [{ x: 50, y: 0 }, { x: 50, y: 200 }]),
        makeWire('w3', [{ x: 150, y: 0 }, { x: 150, y: 200 }]),
      ];

      const crossings = detectAllCrossings(wires);
      expect(crossings).toHaveLength(2);
    });

    it('should return empty for no crossings', () => {
      const wires = [
        makeWire('w1', [{ x: 0, y: 100 }, { x: 200, y: 100 }]),
        makeWire('w2', [{ x: 0, y: 200 }, { x: 200, y: 200 }]),
      ];

      expect(detectAllCrossings(wires)).toHaveLength(0);
    });
  });

  describe('generateJumperArc', () => {
    it('should generate arc at crossing point', () => {
      const arc = generateJumperArc({
        position: { x: 100, y: 100 },
        wireId1: 'w1',
        wireId2: 'w2',
        segmentIndex1: 0,
        segmentIndex2: 0,
      });

      expect(arc.center).toEqual({ x: 100, y: 100 });
      expect(arc.radius).toBe(6);
      expect(arc.pathPoints.length).toBeGreaterThan(0);
      expect(arc.overWireId).toBe('w1');
      expect(arc.underWireId).toBe('w2');
    });

    it('should respect custom radius', () => {
      const arc = generateJumperArc(
        {
          position: { x: 50, y: 50 },
          wireId1: 'w1',
          wireId2: 'w2',
          segmentIndex1: 0,
          segmentIndex2: 0,
        },
        { jumperRadius: 10 }
      );

      expect(arc.radius).toBe(10);
    });
  });

  describe('jumperArcToSVG', () => {
    it('should generate valid SVG path', () => {
      const arc = generateJumperArc({
        position: { x: 100, y: 200 },
        wireId1: 'w1',
        wireId2: 'w2',
        segmentIndex1: 0,
        segmentIndex2: 0,
      });

      const svg = jumperArcToSVG(arc);
      expect(svg).toContain('M');
      expect(svg).toContain('A');
      // Arc is centered at (100,200) with radius 6: starts at 94, ends at 106
      expect(svg).toContain('94 200');
      expect(svg).toContain('106 200');
    });
  });

  describe('detectParallelGroups', () => {
    it('should detect parallel wire groups', () => {
      const wires = [
        makeWire('w1', [{ x: 0, y: 100 }, { x: 200, y: 100 }]),
        makeWire('w2', [{ x: 0, y: 120 }, { x: 200, y: 120 }]),
        makeWire('w3', [{ x: 0, y: 140 }, { x: 200, y: 140 }]),
        makeWire('w4', [{ x: 0, y: 300 }, { x: 200, y: 300 }]),
      ];

      const groups = detectParallelGroups(wires, { minParallelDistance: 10 });
      expect(groups.length).toBeGreaterThanOrEqual(1);

      const mainGroup = groups.find((g) => g.wireIds.includes('w1'));
      expect(mainGroup).toBeDefined();
      expect(mainGroup!.wireIds.length).toBeGreaterThanOrEqual(2);
      expect(mainGroup!.direction).toBe('horizontal');
    });

    it('should not group non-parallel wires', () => {
      const wires = [
        makeWire('w1', [{ x: 0, y: 100 }, { x: 200, y: 100 }]),
        makeWire('w2', [{ x: 100, y: 0 }, { x: 100, y: 200 }]),
      ];

      const groups = detectParallelGroups(wires, { minParallelDistance: 10 });
      // horizontal and vertical are not parallel
      expect(groups).toHaveLength(0);
    });
  });

  describe('simplifyToBus', () => {
    it('should create bus from parallel group', () => {
      const wires = [
        makeWire('w1', [{ x: 0, y: 100 }, { x: 200, y: 100 }]),
        makeWire('w2', [{ x: 0, y: 120 }, { x: 200, y: 120 }]),
        makeWire('w3', [{ x: 0, y: 140 }, { x: 200, y: 140 }]),
      ];

      const groups = detectParallelGroups(wires, { minParallelDistance: 10 });
      expect(groups.length).toBeGreaterThanOrEqual(1);

      const bus = simplifyToBus(groups[0], wires);
      expect(bus.width).toBeGreaterThanOrEqual(2);
      expect(bus.points.length).toBeGreaterThan(0);
      expect(bus.originalWireIds).toEqual(groups[0].wireIds);
    });

    it('should generate proper label for named wires', () => {
      const wires = [
        makeWire('w1', [{ x: 0, y: 100 }, { x: 200, y: 100 }]),
        makeWire('w2', [{ x: 0, y: 120 }, { x: 200, y: 120 }]),
        makeWire('w3', [{ x: 0, y: 140 }, { x: 200, y: 140 }]),
      ];

      const nameMap = new Map([
        ['w1', 'D0'],
        ['w2', 'D1'],
        ['w3', 'D2'],
      ]);

      const groups = detectParallelGroups(wires, { minParallelDistance: 10 });
      if (groups.length > 0) {
        const bus = simplifyToBus(groups[0], wires, nameMap);
        expect(bus.label).toContain('D');
      }
    });
  });

  describe('getCrossingReport', () => {
    it('should return zero report for no crossings', () => {
      const wires = [
        makeWire('w1', [{ x: 0, y: 100 }, { x: 200, y: 100 }]),
        makeWire('w2', [{ x: 0, y: 200 }, { x: 200, y: 200 }]),
      ];

      const report = getCrossingReport(wires);
      expect(report.totalCrossings).toBe(0);
      expect(report.wiresWithCrossings).toBe(0);
    });

    it('should count crossings correctly', () => {
      const wires = [
        makeWire('w1', [{ x: 0, y: 100 }, { x: 200, y: 100 }]),
        makeWire('w2', [{ x: 50, y: 0 }, { x: 50, y: 200 }]),
        makeWire('w3', [{ x: 150, y: 0 }, { x: 150, y: 200 }]),
      ];

      const report = getCrossingReport(wires);
      expect(report.totalCrossings).toBe(2);
      expect(report.wiresWithCrossings).toBe(3);
      expect(report.mostCrossedWireId).toBe('w1');
      expect(report.mostCrossedCount).toBe(2);
    });
  });
});
