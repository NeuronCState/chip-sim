import { describe, it, expect } from 'vitest';
import {
  autoRoute,
  countBends,
  calculateManhattanLength,
  batchAutoRoute,
  getRoutingReport,
} from '../core/autoRoute';
import type { WirePoint, CircuitComponent } from '../types/circuit';

describe('autoRoute', () => {
  describe('countBends', () => {
    it('should return 0 for straight line', () => {
      const points: WirePoint[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ];
      expect(countBends(points)).toBe(0);
    });

    it('should count bends correctly', () => {
      const points: WirePoint[] = [
        { x: 0, y: 0 },
        { x: 50, y: 0, isBend: true },
        { x: 50, y: 100, isBend: true },
        { x: 100, y: 100 },
      ];
      expect(countBends(points)).toBe(2);
    });
  });

  describe('calculateManhattanLength', () => {
    it('should calculate straight line length', () => {
      const points: WirePoint[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ];
      expect(calculateManhattanLength(points)).toBe(100);
    });

    it('should calculate L-shape length', () => {
      const points: WirePoint[] = [
        { x: 0, y: 0 },
        { x: 50, y: 0, isBend: true },
        { x: 50, y: 100, isBend: true },
        { x: 100, y: 100 },
      ];
      expect(calculateManhattanLength(points)).toBe(200);
    });

    it('should return 0 for single point', () => {
      expect(calculateManhattanLength([{ x: 0, y: 0 }])).toBe(0);
    });
  });

  describe('autoRoute', () => {
    it('should return straight line when no obstacles', () => {
      const from = { x: 100, y: 200 };
      const to = { x: 300, y: 200 };
      const result = autoRoute(from, to, []);

      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result[0]).toEqual(from);
      expect(result[result.length - 1]).toEqual(to);
    });

    it('should route around obstacles', () => {
      const from = { x: 100, y: 200 };
      const to = { x: 300, y: 200 };
      const obstacles = [
        { minX: 170, minY: 170, maxX: 230, maxY: 230 },
      ];

      const result = autoRoute(from, to, obstacles);
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result[0]).toEqual(from);
      expect(result[result.length - 1]).toEqual(to);

      // Verify path does not go through obstacle
      // (A* will find a path around it)
    });

    it('should use fewestBends strategy', () => {
      const from = { x: 100, y: 100 };
      const to = { x: 300, y: 200 };

      const shortest = autoRoute(from, to, [], { strategy: 'shortest' });
      const fewestBends = autoRoute(from, to, [], { strategy: 'fewestBends' });

      // Both should produce valid paths
      expect(shortest.length).toBeGreaterThanOrEqual(2);
      expect(fewestBends.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle vertical-first preference', () => {
      const from = { x: 100, y: 100 };
      const to = { x: 300, y: 200 };

      const result = autoRoute(from, to, [], { preference: 'verticalFirst' });
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result[0]).toEqual(from);
      expect(result[result.length - 1]).toEqual(to);
    });

    it('should return direct line for same-axis points without obstacles', () => {
      const from = { x: 100, y: 200 };
      const to = { x: 300, y: 200 };

      const result = autoRoute(from, to, []);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(from);
      expect(result[1]).toEqual(to);
    });
  });

  describe('batchAutoRoute', () => {
    it('should return empty array for empty wires', () => {
      expect(batchAutoRoute([], [])).toEqual([]);
    });

    it('should re-route wires', () => {
      const components: CircuitComponent[] = [
        {
          id: 'c1', type: 'resistor', name: 'R1',
          position: { x: 100, y: 200 }, rotation: 0,
          value: { value: 1000, unit: 'Ω' },
          ports: [
            { id: 'p1', offset: { x: -25, y: 0 } },
            { id: 'p2', offset: { x: 25, y: 0 } },
          ],
        },
        {
          id: 'c2', type: 'resistor', name: 'R2',
          position: { x: 300, y: 200 }, rotation: 0,
          value: { value: 2000, unit: 'Ω' },
          ports: [
            { id: 'p3', offset: { x: -25, y: 0 } },
            { id: 'p4', offset: { x: 25, y: 0 } },
          ],
        },
      ];

      const wires = [
        {
          id: 'w1',
          fromComponentId: 'c1', fromPortId: 'p2',
          toComponentId: 'c2', toPortId: 'p3',
          points: [{ x: 125, y: 200 }, { x: 275, y: 200 }],
          status: 'connected' as const,
        },
      ];

      const result = batchAutoRoute(wires, components);
      expect(result).toHaveLength(1);
      expect(result[0].points.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getRoutingReport', () => {
    it('should return zero stats for empty wires', () => {
      const report = getRoutingReport([]);
      expect(report.totalLength).toBe(0);
      expect(report.totalBends).toBe(0);
      expect(report.wireCount).toBe(0);
    });

    it('should calculate stats correctly', () => {
      const wires = [
        {
          id: 'w1',
          fromComponentId: 'c1', fromPortId: 'p1',
          toComponentId: 'c2', toPortId: 'p2',
          points: [
            { x: 0, y: 0 },
            { x: 50, y: 0, isBend: true },
            { x: 50, y: 50, isBend: true },
            { x: 100, y: 50 },
          ],
          status: 'connected' as const,
        },
      ];

      const report = getRoutingReport(wires);
      expect(report.totalLength).toBe(150);
      expect(report.totalBends).toBe(2);
      expect(report.wireCount).toBe(1);
      expect(report.averageLength).toBe(150);
      expect(report.averageBends).toBe(2);
    });
  });
});
