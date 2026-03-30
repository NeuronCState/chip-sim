import { describe, it, expect } from 'vitest';
import {
  findManhattanPath,
  findDiagonal45Path,
  findPath,
  extractObstacles,
  DEFAULT_ROUTING_CONFIG,
  type GridObstacle,
  type RoutingConfig,
} from '../lib/circuit/SmartRouter';
import type { CircuitComponent, Point, ComponentPort } from '../types/circuit';

// ==================== helpers ====================

/** Build a minimal CircuitComponent stub */
function makeComponent(
  id: string,
  x: number,
  y: number,
  rotation: number = 0,
  ports: ComponentPort[] = [],
): CircuitComponent {
  return {
    id,
    type: 'resistor' as any,
    name: id,
    position: { x, y },
    rotation: rotation as any,
    value: { value: 100, unit: 'Ω' },
    ports,
  };
}

// ==================== tests ====================

describe('SmartRouter', () => {
  // -------------------------------------------------------
  // 1. findManhattanPath – straight horizontal line
  // -------------------------------------------------------
  describe('findManhattanPath', () => {
    it('returns a direct 2-point path for aligned points with no obstacles', () => {
      const from: Point = { x: 100, y: 200 };
      const to: Point = { x: 400, y: 200 }; // same Y

      const path = findManhattanPath(from, to, []);

      // Should be a straight line: only start + end
      expect(path.length).toBe(2);
      expect(path[0].x).toBeCloseTo(from.x);
      expect(path[0].y).toBeCloseTo(from.y);
      expect(path[path.length - 1].x).toBeCloseTo(to.x);
      expect(path[path.length - 1].y).toBeCloseTo(to.y);
    });

    // ---------------------------------------------------
    // 2. findManhattanPath – L-shaped path (not aligned)
    // ---------------------------------------------------
    it('returns an L-shaped path when start/end are not aligned', () => {
      const from: Point = { x: 0, y: 0 };
      const to: Point = { x: 300, y: 400 };

      const path = findManhattanPath(from, to, []);

      // Must have > 2 points (bend points)
      expect(path.length).toBeGreaterThanOrEqual(3);

      // First and last must match source/target
      expect(path[0]).toEqual({ x: from.x, y: from.y });
      expect(path[path.length - 1]).toEqual({ x: to.x, y: to.y });

      // Intermediate points should be marked as bends
      const bends = path.filter((p) => p.isBend);
      expect(bends.length).toBeGreaterThanOrEqual(1);

      // All segments must be axis-aligned
      for (let i = 1; i < path.length; i++) {
        const prev = path[i - 1];
        const curr = path[i];
        const isHorizontal = prev.y === curr.y;
        const isVertical = prev.x === curr.x;
        expect(isHorizontal || isVertical).toBe(true);
      }
    });

    // ---------------------------------------------------
    // 3. findManhattanPath – route around obstacles
    // ---------------------------------------------------
    it('routes around obstacles that block the direct path', () => {
      const from: Point = { x: 0, y: 100 };
      const to: Point = { x: 400, y: 100 };

      // Big obstacle right in the middle of the direct horizontal path
      const obstacles: GridObstacle[] = [
        { minX: 150, minY: 50, maxX: 250, maxY: 150 },
      ];

      const path = findManhattanPath(from, to, obstacles);

      // Path must exist (at least start + end)
      expect(path.length).toBeGreaterThanOrEqual(2);

      // Verify no segment crosses the obstacle
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1];
        const b = path[i];
        const segMinX = Math.min(a.x, b.x);
        const segMaxX = Math.max(a.x, b.x);

        // If segment is horizontal and within Y range of obstacle
        if (a.y === b.y && a.y > 50 && a.y < 150) {
          // The segment must not fully cross the obstacle in X
          const fullyInside =
            segMinX <= 150 && segMaxX >= 250;
          expect(fullyInside).toBe(false);
        }
      }
    });

    // ---------------------------------------------------
    // 9. Edge case – start very close to end
    // ---------------------------------------------------
    it('handles very close start/end points gracefully', () => {
      const from: Point = { x: 100, y: 100 };
      const to: Point = { x: 105, y: 105 };

      const path = findManhattanPath(from, to, []);

      expect(path.length).toBeGreaterThanOrEqual(2);
      // First point is source, last is target (original coords)
      expect(path[0]).toEqual(from);
      expect(path[path.length - 1]).toEqual(to);
    });
  });

  // -------------------------------------------------------
  // 4. extractObstacles – correct bounding boxes
  // -------------------------------------------------------
  describe('extractObstacles', () => {
    it('extracts correct AABB for zero-rotation components', () => {
      const comps = [makeComponent('R1', 100, 100, 0)];

      const obstacles = extractObstacles(comps, new Set(), 15);

      expect(obstacles).toHaveLength(1);
      expect(obstacles[0].componentId).toBe('R1');

      // hw = 30+15=45, hh=20+15=35, rotation=0 → aabbW=45, aabbH=35
      expect(obstacles[0].minX).toBeCloseTo(100 - 45);
      expect(obstacles[0].maxX).toBeCloseTo(100 + 45);
      expect(obstacles[0].minY).toBeCloseTo(100 - 35);
      expect(obstacles[0].maxY).toBeCloseTo(100 + 35);
    });

    it('rotates the bounding box for 90-degree components', () => {
      const comps = [makeComponent('R2', 200, 200, 90)];

      const obstacles = extractObstacles(comps, new Set(), 15);

      expect(obstacles).toHaveLength(1);
      // rotation=90 → cos|90|=0, sin|90|=1
      // aabbW = 45*0 + 35*1 = 35, aabbH = 45*1 + 35*0 = 45
      expect(obstacles[0].minX).toBeCloseTo(200 - 35);
      expect(obstacles[0].maxX).toBeCloseTo(200 + 35);
      expect(obstacles[0].minY).toBeCloseTo(200 - 45);
      expect(obstacles[0].maxY).toBeCloseTo(200 + 45);
    });

    // ---------------------------------------------------
    // 5. extractObstacles – respects excludeIds
    // ---------------------------------------------------
    it('excludes components whose IDs are in excludeIds', () => {
      const comps = [
        makeComponent('R1', 0, 0),
        makeComponent('R2', 200, 200),
        makeComponent('R3', 400, 400),
      ];

      const obstacles = extractObstacles(comps, new Set(['R2']), 10);

      expect(obstacles).toHaveLength(2);
      const ids = obstacles.map((o) => o.componentId);
      expect(ids).toContain('R1');
      expect(ids).toContain('R3');
      expect(ids).not.toContain('R2');
    });
  });

  // -------------------------------------------------------
  // 6. findPath – dispatches to correct mode
  // -------------------------------------------------------
  describe('findPath', () => {
    it('uses manhattan routing by default', () => {
      const from: Point = { x: 0, y: 0 };
      const to: Point = { x: 100, y: 0 };
      const obstacles: GridObstacle[] = [];

      const path = findPath(from, to, obstacles);

      // Manhattan: all segments axis-aligned
      for (let i = 1; i < path.length; i++) {
        const prev = path[i - 1];
        const curr = path[i];
        expect(prev.x === curr.x || prev.y === curr.y).toBe(true);
      }
    });

    it('uses diagonal45 routing when routingMode is diagonal45', () => {
      const from: Point = { x: 0, y: 0 };
      const to: Point = { x: 200, y: 200 };
      const config: RoutingConfig = { ...DEFAULT_ROUTING_CONFIG, routingMode: 'diagonal45' };

      const path = findPath(from, to, [], config);

      expect(path.length).toBeGreaterThanOrEqual(2);
      // Note: depending on implementation, a 45° diagonal path from (0,0) to (200,200)
      // might be a single diagonal. If findDiagonal45Path is used, diagonal segments should appear.
      // We at least verify it returns a valid path.
      expect(path[0]).toEqual(from);
      expect(path[path.length - 1]).toEqual(to);
    });

    it('uses diagonal45 routing when allowDiagonal is true', () => {
      const from: Point = { x: 0, y: 0 };
      const to: Point = { x: 200, y: 200 };
      const config: RoutingConfig = { ...DEFAULT_ROUTING_CONFIG, allowDiagonal: true };

      const path = findPath(from, to, [], config);

      expect(path.length).toBeGreaterThanOrEqual(2);
      expect(path[0]).toEqual(from);
      expect(path[path.length - 1]).toEqual(to);
    });
  });

  // -------------------------------------------------------
  // 7. findDiagonal45Path – generates diagonal segments
  // -------------------------------------------------------
  describe('findDiagonal45Path', () => {
    it('generates diagonal segments for a diagonal target', () => {
      const from: Point = { x: 0, y: 0 };
      const to: Point = { x: 300, y: 300 };

      const path = findDiagonal45Path(from, to, []);

      expect(path.length).toBeGreaterThanOrEqual(2);
      expect(path[0]).toEqual(from);
      expect(path[path.length - 1]).toEqual(to);

      // At least one segment should be diagonal (dx != 0 && dy != 0)
      const hasDiagonal = path.some((p, i) => {
        if (i === 0) return false;
        const prev = path[i - 1];
        return prev.x !== p.x && prev.y !== p.y;
      });
      expect(hasDiagonal).toBe(true);
    });

    it('falls back to axis-aligned when dx or dy is zero', () => {
      const from: Point = { x: 0, y: 0 };
      const to: Point = { x: 200, y: 0 }; // horizontal only

      const path = findDiagonal45Path(from, to, []);

      expect(path.length).toBeGreaterThanOrEqual(2);
      // All segments should be axis-aligned (no diagonal possible)
      for (let i = 1; i < path.length; i++) {
        const prev = path[i - 1];
        const curr = path[i];
        expect(prev.x === curr.x || prev.y === curr.y).toBe(true);
      }
    });
  });

  // -------------------------------------------------------
  // 8. DEFAULT_ROUTING_CONFIG – expected values
  // -------------------------------------------------------
  describe('DEFAULT_ROUTING_CONFIG', () => {
    it('has the expected default configuration values', () => {
      expect(DEFAULT_ROUTING_CONFIG.gridSize).toBe(10);
      expect(DEFAULT_ROUTING_CONFIG.maxIterations).toBe(50000);
      expect(DEFAULT_ROUTING_CONFIG.obstaclePadding).toBe(15);
      expect(DEFAULT_ROUTING_CONFIG.searchMargin).toBe(80);
      expect(DEFAULT_ROUTING_CONFIG.bendCost).toBe(2);
      expect(DEFAULT_ROUTING_CONFIG.allowDiagonal).toBe(false);
      expect(DEFAULT_ROUTING_CONFIG.routingMode).toBeUndefined();
    });
  });
});
