import { describe, it, expect } from 'vitest';
import {
  snapToGridPoint,
  distanceToNearestGrid,
  findNearestPortSnap,
  smartSnap,
  generateWirePreview,
  calculateGuideLines,
  alignComponentPortsToGrid,
} from '../core/snapToGrid';
import type { CircuitComponent } from '../types/circuit';

const makeComp = (
  id: string,
  x: number,
  y: number,
  ports: { id: string; ox: number; oy: number }[]
): CircuitComponent => ({
  id,
  type: 'resistor',
  name: id,
  position: { x, y },
  rotation: 0,
  value: { value: 1000, unit: 'Ω' },
  ports: ports.map((p) => ({ id: p.id, offset: { x: p.ox, y: p.oy } })),
});

describe('snapToGrid', () => {
  describe('snapToGridPoint', () => {
    it('should snap to nearest grid point', () => {
      expect(snapToGridPoint(23, 37, 20)).toEqual({ x: 20, y: 40 });
    });

    it('should snap to exact grid point', () => {
      expect(snapToGridPoint(40, 60, 20)).toEqual({ x: 40, y: 60 });
    });

    it('should handle negative coordinates', () => {
      expect(snapToGridPoint(-23, -37, 20)).toEqual({ x: -20, y: -40 });
    });

    it('should handle different grid sizes', () => {
      expect(snapToGridPoint(12, 18, 10)).toEqual({ x: 10, y: 20 });
      expect(snapToGridPoint(12, 18, 5)).toEqual({ x: 10, y: 20 });
    });
  });

  describe('distanceToNearestGrid', () => {
    it('should return 0 for exact grid point', () => {
      expect(distanceToNearestGrid(40, 60, 20)).toBe(0);
    });

    it('should calculate distance correctly', () => {
      const dist = distanceToNearestGrid(25, 35, 20);
      expect(dist).toBeCloseTo(Math.hypot(5, 5));
    });
  });

  describe('findNearestPortSnap', () => {
    const components = [
      makeComp('c1', 100, 200, [
        { id: 'p1', ox: -25, oy: 0 },
        { id: 'p2', ox: 25, oy: 0 },
      ]),
      makeComp('c2', 300, 200, [
        { id: 'p3', ox: -25, oy: 0 },
        { id: 'p4', ox: 25, oy: 0 },
      ]),
    ];

    it('should find nearest port within radius', () => {
      const result = findNearestPortSnap(76, 200, components, 20);
      expect(result).not.toBeNull();
      expect(result!.portInfo?.componentId).toBe('c1');
      expect(result!.portInfo?.portId).toBe('p1');
    });

    it('should return null when no port in range', () => {
      const result = findNearestPortSnap(200, 200, components, 10);
      expect(result).toBeNull();
    });

    it('should exclude specified components', () => {
      const result = findNearestPortSnap(
        76, 200, components, 20, new Set(['c1'])
      );
      // c1 is excluded, c2 ports are too far
      expect(result).toBeNull();
    });
  });

  describe('smartSnap', () => {
    const components = [
      makeComp('c1', 100, 200, [
        { id: 'p1', ox: -25, oy: 0 },
        { id: 'p2', ox: 25, oy: 0 },
      ]),
    ];

    it('should prefer port snap over grid snap', () => {
      const result = smartSnap(76, 200, components, {
        portSnapRadius: 20,
        gridSnapRadius: 10,
        gridSize: 20,
      });
      expect(result.type).toBe('port');
      expect(result.portInfo?.portId).toBe('p1');
    });

    it('should fall back to grid snap when no port nearby', () => {
      const result = smartSnap(25, 35, components, {
        portSnapRadius: 10,
        gridSnapRadius: 15,
        gridSize: 20,
      });
      expect(result.type).toBe('grid');
      expect(result.position).toEqual({ x: 20, y: 40 });
    });
  });

  describe('generateWirePreview', () => {
    const components = [
      makeComp('c1', 100, 200, [
        { id: 'p1', ox: -25, oy: 0 },
        { id: 'p2', ox: 25, oy: 0 },
      ]),
      makeComp('c2', 300, 200, [
        { id: 'p3', ox: -25, oy: 0 },
        { id: 'p4', ox: 25, oy: 0 },
      ]),
    ];

    it('should generate preview with valid path', () => {
      const preview = generateWirePreview(
        { x: 125, y: 200 },
        275, 200,
        components,
        'orthogonal'
      );

      expect(preview.points.length).toBeGreaterThanOrEqual(2);
      expect(preview.from).toEqual({ x: 125, y: 200 });
    });

    it('should detect snap to port', () => {
      const preview = generateWirePreview(
        { x: 125, y: 200 },
        276, 200,
        components,
        'orthogonal'
      );

      expect(preview.snappedToPort).toBe(true);
      expect(preview.snapTarget?.portInfo?.componentId).toBe('c2');
    });
  });

  describe('calculateGuideLines', () => {
    it('should find horizontal alignment', () => {
      const drag = makeComp('drag', 200, 100, []);
      const others = [
        makeComp('c1', 300, 100, []),
        makeComp('c2', 200, 300, []),
      ];

      const guides = calculateGuideLines(drag, others, { guideTolerance: 5 });
      const hGuides = guides.filter((g) => g.type === 'horizontal');
      expect(hGuides.length).toBeGreaterThan(0);
    });

    it('should find vertical alignment', () => {
      const drag = makeComp('drag', 200, 100, []);
      const others = [
        makeComp('c1', 200, 300, []),
      ];

      const guides = calculateGuideLines(drag, others, { guideTolerance: 5 });
      const vGuides = guides.filter((g) => g.type === 'vertical');
      expect(vGuides.length).toBeGreaterThan(0);
    });

    it('should not include guides for itself', () => {
      const drag = makeComp('drag', 200, 100, []);
      const guides = calculateGuideLines(drag, [drag]);
      expect(guides.every((g) => g.relatedComponentId !== 'drag')).toBe(true);
    });
  });

  describe('alignComponentPortsToGrid', () => {
    it('should align component to grid', () => {
      const comp = makeComp('c1', 123, 456, [
        { id: 'p1', ox: -25, oy: 0 },
        { id: 'p2', ox: 25, oy: 0 },
      ]);

      const result = alignComponentPortsToGrid(comp, 20);
      // Should return grid-aligned position
      expect(result.x % 20).toBe(0);
      expect(result.y % 20).toBe(0);
    });
  });
});
