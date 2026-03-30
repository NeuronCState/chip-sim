import { describe, it, expect, beforeEach } from 'vitest';
import { RenderOptimizer, getRenderOptimizer } from '../lib/rendering/RenderOptimizer';
import type { CircuitComponent, Wire, ViewTransform } from '../types/circuit';

// ==================== Mock Helpers ====================

function createMockComponent(i: number): CircuitComponent {
  return {
    id: `c${i}`,
    type: 'resistor',
    name: `R${i}`,
    position: { x: i * 100, y: 0 },
    rotation: 0,
    value: { value: 1000, unit: 'Ω' },
    ports: [],
  } as CircuitComponent;
}

function createMockWire(i: number, count: number): Wire {
  return {
    id: `w${i}`,
    fromComponentId: `c${i}`,
    fromPortId: `p${i}-1`,
    toComponentId: `c${(i + 1) % count}`,
    toPortId: `p${(i + 1) % count}-0`,
    points: [
      { x: i * 100, y: 0 },
      { x: (i + 1) * 100, y: 0 },
    ],
    status: 'connected',
  } as Wire;
}

function createComponents(n: number): CircuitComponent[] {
  return Array.from({ length: n }, (_, i) => createMockComponent(i));
}

function createWires(n: number): Wire[] {
  return Array.from({ length: n }, (_, i) => createMockWire(i, n));
}

const defaultViewTransform: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };

// ==================== Tests ====================

describe('RenderOptimizer', () => {
  let optimizer: RenderOptimizer;

  beforeEach(() => {
    optimizer = new RenderOptimizer();
  });

  // -------------------------------------------------------
  // 1. rebuildIndex populates stats correctly
  // -------------------------------------------------------
  it('rebuildIndex populates totalComponents and totalWires in stats', () => {
    const components = createComponents(10);
    const wires = createWires(5);

    optimizer.rebuildIndex(components, wires);
    const stats = optimizer.getStats();

    expect(stats.totalComponents).toBe(10);
    expect(stats.totalWires).toBe(5);
    expect(stats.indexBuildTime).toBeGreaterThanOrEqual(0);
  });

  // -------------------------------------------------------
  // 2. getVisibleComponents returns all for small component count (<50)
  // -------------------------------------------------------
  it('getVisibleComponents returns all components when count < 50', () => {
    const components = createComponents(20);
    const wires = createWires(10);

    const visible = optimizer.getVisibleComponents(
      components,
      wires,
      defaultViewTransform,
      800,
      600,
    );

    expect(visible).toHaveLength(20);
    expect(optimizer.getStats().cullingRatio).toBe(0);
  });

  // -------------------------------------------------------
  // 3. getVisibleComponents culls components outside viewport (for large count)
  // -------------------------------------------------------
  it('getVisibleComponents culls components far outside viewport when count >= 50', () => {
    // Create 100 components spread across x = 0..9900
    const components = createComponents(100);
    const wires = createWires(50);

    // Viewport at origin, 800×600 at scale=1 → visible world coords roughly [-50..850, -50..650]
    const visible = optimizer.getVisibleComponents(
      components,
      wires,
      defaultViewTransform,
      800,
      600,
    );

    // Should be strictly less than total
    expect(visible.length).toBeLessThan(100);
    // All returned components should be within or near the viewport
    for (const comp of visible) {
      // component bbox: position.x ± 35, position.y ± 25
      // viewport with margin: [-100, 900] x [-100, 700]
      expect(comp.position.x).toBeLessThan(900);
    }
    expect(optimizer.getStats().cullingRatio).toBeGreaterThan(0);
  });

  // -------------------------------------------------------
  // 4. getVisibleWires returns all for small wire count (<50)
  // -------------------------------------------------------
  it('getVisibleWires returns all wires when count < 50', () => {
    const wires = createWires(10);
    const components = createComponents(10);

    const visible = optimizer.getVisibleWires(
      wires,
      components,
      defaultViewTransform,
      800,
      600,
    );

    expect(visible).toHaveLength(10);
  });

  // -------------------------------------------------------
  // 5. markDirty clears cached results
  // -------------------------------------------------------
  it('markDirty invalidates cached viewport results', () => {
    const components = createComponents(20);
    const wires = createWires(10);

    // First call populates cache
    const first = optimizer.getVisibleComponents(
      components,
      wires,
      defaultViewTransform,
      800,
      600,
    );
    expect(first).toHaveLength(20);

    // markDirty should clear the cache
    optimizer.markDirty();

    // Mutate components to verify cache was cleared (fresh computation)
    const updated = [...components, createMockComponent(99)];
    const second = optimizer.getVisibleComponents(
      updated,
      wires,
      defaultViewTransform,
      800,
      600,
    );

    // Should reflect the new component count
    expect(second).toHaveLength(21);
  });

  // -------------------------------------------------------
  // 6. getStats returns correct structure
  // -------------------------------------------------------
  it('getStats returns all expected fields with correct types', () => {
    const stats = optimizer.getStats();

    expect(stats).toHaveProperty('totalComponents');
    expect(stats).toHaveProperty('visibleComponents');
    expect(stats).toHaveProperty('totalWires');
    expect(stats).toHaveProperty('visibleWires');
    expect(stats).toHaveProperty('cullingRatio');
    expect(stats).toHaveProperty('indexBuildTime');
    expect(stats).toHaveProperty('queryTime');

    expect(typeof stats.totalComponents).toBe('number');
    expect(typeof stats.visibleComponents).toBe('number');
    expect(typeof stats.totalWires).toBe('number');
    expect(typeof stats.visibleWires).toBe('number');
    expect(typeof stats.cullingRatio).toBe('number');
    expect(typeof stats.indexBuildTime).toBe('number');
    expect(typeof stats.queryTime).toBe('number');
  });

  // -------------------------------------------------------
  // 7. getWiresForPort returns associated wire IDs
  // -------------------------------------------------------
  it('getWiresForPort returns wire IDs connected to the given port', () => {
    const components = createComponents(5);
    const wires = createWires(5);

    optimizer.rebuildIndex(components, wires);

    // Wire w0 uses fromPortId='p0-1' and toPortId='p1-0'
    const fromResult = optimizer.getWiresForPort('p0-1');
    expect(fromResult).toContain('w0');

    const toResult = optimizer.getWiresForPort('p1-0');
    expect(toResult).toContain('w0');

    // Non-existent port returns empty
    expect(optimizer.getWiresForPort('nonexistent')).toEqual([]);
  });

  // -------------------------------------------------------
  // 8. getWiresForComponent returns associated wire IDs
  // -------------------------------------------------------
  it('getWiresForComponent returns wire IDs connected to the given component', () => {
    const components = createComponents(5);
    const wires = createWires(5);

    optimizer.rebuildIndex(components, wires);

    // Component c0 is involved in w0 (from) and w4 (to, since w4 goes to c0)
    const result = optimizer.getWiresForComponent('c0');
    expect(result).toContain('w0');
    // Wire w4: fromComponentId=c4, toComponentId=c(4+1)%5=c0
    expect(result).toContain('w4');

    // Non-existent component returns empty
    expect(optimizer.getWiresForComponent('nonexistent')).toEqual([]);
  });

  // -------------------------------------------------------
  // 9. getVisibleWires culls wires outside viewport for large count
  // -------------------------------------------------------
  it('getVisibleWires culls wires whose points are all outside viewport when count >= 50', () => {
    const components = createComponents(100);
    const wires = createWires(100);

    // Viewport at origin, small canvas → only wires near x≈0 should be visible
    const visible = optimizer.getVisibleWires(
      wires,
      components,
      defaultViewTransform,
      800,
      600,
    );

    expect(visible.length).toBeLessThan(100);
  });

  // -------------------------------------------------------
  // 10. getVisibleComponents caches result for same viewport
  // -------------------------------------------------------
  it('getVisibleComponents returns cached result for identical viewport', () => {
    const components = createComponents(60);
    const wires = createWires(30);

    const first = optimizer.getVisibleComponents(
      components,
      wires,
      defaultViewTransform,
      800,
      600,
    );
    const second = optimizer.getVisibleComponents(
      components,
      wires,
      defaultViewTransform,
      800,
      600,
    );

    // Same reference (cached)
    expect(second).toBe(first);
  });

  // -------------------------------------------------------
  // 11. custom cellSize in constructor
  // -------------------------------------------------------
  it('constructor accepts custom cellSize without error', () => {
    const custom = new RenderOptimizer(200);
    const components = createComponents(5);
    const wires = createWires(3);

    custom.rebuildIndex(components, wires);
    expect(custom.getStats().totalComponents).toBe(5);
  });
});

// ==================== Singleton ====================

describe('getRenderOptimizer', () => {
  it('returns the same instance on multiple calls', () => {
    const a = getRenderOptimizer();
    const b = getRenderOptimizer();

    expect(a).toBe(b);
    expect(a).toBeInstanceOf(RenderOptimizer);
  });
});
