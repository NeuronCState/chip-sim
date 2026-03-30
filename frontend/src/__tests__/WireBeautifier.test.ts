import { describe, it, expect } from 'vitest';
import {
  calculateWireLength,
  calculateTotalWireLength,
  wiresIntersect,
  countAllCrossings,
  alignWireBends,
  beautifyWires,
  equalizeWireLengths,
  generateWireLabels,
} from '../lib/circuit/WireBeautifier';

import type { Wire, WirePoint } from '../types/circuit';

// ==================== 测试工具 ====================

function makeWire(id: string, points: WirePoint[], overrides: Partial<Wire> = {}): Wire {
  return {
    id,
    fromComponentId: 'comp1',
    fromPortId: 'port1',
    toComponentId: 'comp2',
    toPortId: 'port2',
    points,
    status: 'connected' as const,
    ...overrides,
  };
}

function pt(x: number, y: number, isBend?: boolean): WirePoint {
  return isBend !== undefined ? { x, y, isBend } : { x, y };
}

// ==================== calculateWireLength ====================

describe('calculateWireLength', () => {
  it('returns 0 for a wire with fewer than 2 points', () => {
    const wire = makeWire('w1', [pt(0, 0)]);
    expect(calculateWireLength(wire)).toBe(0);
  });

  it('calculates Manhattan distance for a 2-point horizontal wire', () => {
    // (0,0) → (100,0): distance = |100| + |0| = 100
    const wire = makeWire('w1', [pt(0, 0), pt(100, 0)]);
    expect(calculateWireLength(wire)).toBe(100);
  });

  it('calculates Manhattan distance for a 2-point vertical wire', () => {
    // (0,0) → (0,80): distance = |0| + |80| = 80
    const wire = makeWire('w1', [pt(0, 0), pt(0, 80)]);
    expect(calculateWireLength(wire)).toBe(80);
  });

  it('calculates Manhattan distance for a 2-point diagonal wire', () => {
    // (0,0) → (30,40): distance = |30| + |40| = 70
    const wire = makeWire('w1', [pt(0, 0), pt(30, 40)]);
    expect(calculateWireLength(wire)).toBe(70);
  });

  it('sums segment lengths for a multi-point wire (L-shape)', () => {
    // (0,0) → (50,0) → (50,80)
    // seg1: |50| + |0| = 50
    // seg2: |0| + |80| = 80
    // total: 130
    const wire = makeWire('w1', [pt(0, 0), pt(50, 0), pt(50, 80)]);
    expect(calculateWireLength(wire)).toBe(130);
  });

  it('sums segment lengths for a multi-point wire with multiple bends', () => {
    // (0,0) → (30,0) → (30,40) → (70,40)
    // seg1: 30, seg2: 40, seg3: 40 → total: 110
    const wire = makeWire('w1', [pt(0, 0), pt(30, 0), pt(30, 40), pt(70, 40)]);
    expect(calculateWireLength(wire)).toBe(110);
  });

  it('handles negative coordinates correctly', () => {
    // (-10,-10) → (20,30): |30| + |40| = 70
    const wire = makeWire('w1', [pt(-10, -10), pt(20, 30)]);
    expect(calculateWireLength(wire)).toBe(70);
  });

  it('handles zero-length wire (same start and end)', () => {
    const wire = makeWire('w1', [pt(50, 50), pt(50, 50)]);
    expect(calculateWireLength(wire)).toBe(0);
  });
});

// ==================== calculateTotalWireLength ====================

describe('calculateTotalWireLength', () => {
  it('returns 0 for empty array', () => {
    expect(calculateTotalWireLength([])).toBe(0);
  });

  it('returns the length of a single wire', () => {
    const wire = makeWire('w1', [pt(0, 0), pt(100, 0)]);
    expect(calculateTotalWireLength([wire])).toBe(100);
  });

  it('sums multiple wire lengths correctly', () => {
    const w1 = makeWire('w1', [pt(0, 0), pt(100, 0)]); // 100
    const w2 = makeWire('w2', [pt(0, 0), pt(0, 60)]);  // 60
    const w3 = makeWire('w3', [pt(0, 0), pt(30, 40)]); // 70
    expect(calculateTotalWireLength([w1, w2, w3])).toBe(230);
  });
});

// ==================== wiresIntersect ====================

describe('wiresIntersect', () => {
  it('detects a crossing between a horizontal and vertical segment', () => {
    // Wire1: horizontal (0,50) → (100,50)
    // Wire2: vertical  (50,0) → (50,100)
    // They cross at (50,50)
    const w1 = makeWire('w1', [pt(0, 50), pt(100, 50)]);
    const w2 = makeWire('w2', [pt(50, 0), pt(50, 100)]);
    expect(wiresIntersect(w1, w2)).toBe(1);
  });

  it('returns 0 for non-crossing parallel horizontal wires', () => {
    const w1 = makeWire('w1', [pt(0, 10), pt(100, 10)]);
    const w2 = makeWire('w2', [pt(0, 20), pt(100, 20)]);
    expect(wiresIntersect(w1, w2)).toBe(0);
  });

  it('returns 0 for non-crossing parallel vertical wires', () => {
    const w1 = makeWire('w1', [pt(10, 0), pt(10, 100)]);
    const w2 = makeWire('w2', [pt(20, 0), pt(20, 100)]);
    expect(wiresIntersect(w1, w2)).toBe(0);
  });

  it('returns 0 for non-crossing H and V segments that do not overlap', () => {
    // Horizontal (0,10) → (50,10), Vertical (60,0) → (60,50)
    // V's x=60 is NOT strictly between hMinX=0 and hMaxX=50
    const w1 = makeWire('w1', [pt(0, 10), pt(50, 10)]);
    const w2 = makeWire('w2', [pt(60, 0), pt(60, 50)]);
    expect(wiresIntersect(w1, w2)).toBe(0);
  });

  it('returns 0 when vertical segment just touches horizontal end (exclusive bounds)', () => {
    // The implementation uses strict > and <, so touching at endpoints does not count
    const w1 = makeWire('w1', [pt(0, 50), pt(50, 50)]);
    const w2 = makeWire('w2', [pt(50, 0), pt(50, 100)]);
    expect(wiresIntersect(w1, w2)).toBe(0);
  });

  it('detects multiple crossings in a multi-segment wire', () => {
    // Wire1: (0,50) → (100,50) (one horizontal segment)
    // Wire2: (25,0) → (25,100) → (75,100) → (75,0)
    // Only the vertical segments cross wire1: at x=25 and x=75
    const w1 = makeWire('w1', [pt(0, 50), pt(100, 50)]);
    const w2 = makeWire('w2', [pt(25, 0), pt(25, 100), pt(75, 100), pt(75, 0)]);
    // Segment (25,0)→(25,100) crosses (0,50)→(100,50) at (25,50) ✓
    // Segment (75,100)→(75,0) crosses (0,50)→(100,50) at (75,50) ✓
    expect(wiresIntersect(w1, w2)).toBe(2);
  });
});

// ==================== countAllCrossings ====================

describe('countAllCrossings', () => {
  it('returns 0 for empty array', () => {
    expect(countAllCrossings([])).toBe(0);
  });

  it('returns 0 for single wire', () => {
    const w1 = makeWire('w1', [pt(0, 0), pt(100, 0)]);
    expect(countAllCrossings([w1])).toBe(0);
  });

  it('returns 0 for two non-crossing wires', () => {
    const w1 = makeWire('w1', [pt(0, 10), pt(100, 10)]);
    const w2 = makeWire('w2', [pt(0, 20), pt(100, 20)]);
    expect(countAllCrossings([w1, w2])).toBe(0);
  });

  it('counts crossings across all wire pairs', () => {
    // Center vertical wire crossing two horizontal wires
    // w1: horizontal at y=30, x=0..100
    // w2: horizontal at y=70, x=0..100
    // w3: vertical at x=50, y=0..100
    const w1 = makeWire('w1', [pt(0, 30), pt(100, 30)]);
    const w2 = makeWire('w2', [pt(0, 70), pt(100, 70)]);
    const w3 = makeWire('w3', [pt(50, 0), pt(50, 100)]);
    // w1∩w2: 0 (parallel), w1∩w3: 1, w2∩w3: 1 → total = 2
    expect(countAllCrossings([w1, w2, w3])).toBe(2);
  });

  it('counts correctly when multiple pairs cross', () => {
    // w1: horizontal (0,50)→(100,50)
    // w2: vertical (25,0)→(25,100)
    // w3: vertical (75,0)→(75,100)
    const w1 = makeWire('w1', [pt(0, 50), pt(100, 50)]);
    const w2 = makeWire('w2', [pt(25, 0), pt(25, 100)]);
    const w3 = makeWire('w3', [pt(75, 0), pt(75, 100)]);
    // w1∩w2: 1, w1∩w3: 1, w2∩w3: 0 → total = 2
    expect(countAllCrossings([w1, w2, w3])).toBe(2);
  });
});

// ==================== alignWireBends ====================

describe('alignWireBends', () => {
  it('returns empty array for empty input', () => {
    expect(alignWireBends([])).toEqual([]);
  });

  it('returns wires unchanged when no bends exist', () => {
    const w1 = makeWire('w1', [pt(0, 0), pt(100, 100)]);
    const result = alignWireBends([w1]);
    expect(result).toHaveLength(1);
    expect(result[0].points).toEqual(w1.points);
  });

  it('clusters nearby bend points within tolerance', () => {
    // Two bends at x=52 and x=48 with tolerance=10 → should align to x=50
    const w1 = makeWire('w1', [
      pt(0, 0),
      pt(52, 0, true),
      pt(52, 100),
    ]);
    const w2 = makeWire('w2', [
      pt(0, 50),
      pt(48, 50, true),
      pt(48, 150),
    ]);
    const result = alignWireBends([w1, w2], 10);
    // Both bends should have their x aligned to the same value (50)
    const bend1 = result[0].points.find(p => p.isBend);
    const bend2 = result[1].points.find(p => p.isBend);
    expect(bend1).toBeDefined();
    expect(bend2).toBeDefined();
    expect(bend1!.x).toBe(bend2!.x);
  });

  it('does not align bend points beyond tolerance', () => {
    // Two bends at x=0 and x=100 with tolerance=10 → should NOT align together
    const w1 = makeWire('w1', [
      pt(0, 0),
      pt(0, 50, true),
      pt(0, 100),
    ]);
    const w2 = makeWire('w2', [
      pt(100, 0),
      pt(100, 50, true),
      pt(100, 100),
    ]);
    const result = alignWireBends([w1, w2], 10);
    const bend1 = result[0].points.find(p => p.isBend);
    const bend2 = result[1].points.find(p => p.isBend);
    // They should remain at their original positions (too far apart to cluster)
    expect(bend1!.x).toBe(0);
    expect(bend2!.x).toBe(100);
  });

  it('preserves non-bend points unchanged', () => {
    const w1 = makeWire('w1', [
      pt(0, 0),
      pt(50, 0, true),
      pt(50, 100),
    ]);
    const result = alignWireBends([w1], 10);
    // First and last points should be unchanged
    expect(result[0].points[0]).toEqual(pt(0, 0));
    expect(result[0].points[2]).toEqual(pt(50, 100));
  });

  it('aligns y-coordinates of nearby bends', () => {
    const w1 = makeWire('w1', [
      pt(0, 0),
      pt(0, 53, true),
      pt(100, 53),
    ]);
    const w2 = makeWire('w2', [
      pt(0, 100),
      pt(0, 47, true),
      pt(100, 47),
    ]);
    const result = alignWireBends([w1, w2], 10);
    const bend1 = result[0].points.find(p => p.isBend);
    const bend2 = result[1].points.find(p => p.isBend);
    // y=53 and y=47 are within 6 of each other, tolerance=10 → should cluster
    expect(bend1!.y).toBe(bend2!.y);
  });
});

// ==================== beautifyWires ====================

describe('beautifyWires', () => {
  it('returns BeautifyResult with correct structure', () => {
    const w1 = makeWire('w1', [pt(0, 0), pt(100, 0)]);
    const result = beautifyWires([w1], [], {
      eliminateCrossings: false,
      alignBends: false,
      equalizeLength: false,
      alignTolerance: 10,
      targetLength: 0,
    });
    // Must have the correct shape
    expect(result).toHaveProperty('wires');
    expect(result).toHaveProperty('changedCount');
    expect(result).toHaveProperty('crossingsEliminated');
    expect(Array.isArray(result.wires)).toBe(true);
    expect(typeof result.changedCount).toBe('number');
    expect(typeof result.crossingsEliminated).toBe('number');
  });

  it('returns wires unchanged when all options disabled', () => {
    const w1 = makeWire('w1', [pt(0, 50), pt(100, 50)]);
    const w2 = makeWire('w2', [pt(50, 0), pt(50, 100)]);
    const result = beautifyWires([w1, w2], [], {
      eliminateCrossings: false,
      alignBends: false,
      equalizeLength: false,
      alignTolerance: 10,
      targetLength: 0,
    });
    expect(result.wires).toHaveLength(2);
    expect(result.changedCount).toBe(0);
    expect(result.crossingsEliminated).toBe(0);
  });

  it('preserves wire count in output', () => {
    const wires = [
      makeWire('w1', [pt(0, 0), pt(50, 50)]),
      makeWire('w2', [pt(0, 50), pt(50, 0)]),
      makeWire('w3', [pt(25, 0), pt(25, 50)]),
    ];
    const result = beautifyWires(wires, [], {
      eliminateCrossings: false,
      alignBends: true,
      equalizeLength: false,
      alignTolerance: 10,
      targetLength: 0,
    });
    expect(result.wires).toHaveLength(3);
  });
});

// ==================== equalizeWireLengths ====================

describe('equalizeWireLengths', () => {
  it('returns wires unchanged when only 1 wire provided', () => {
    const w1 = makeWire('w1', [pt(0, 0), pt(50, 0)]);
    const result = equalizeWireLengths([w1]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(w1);
  });

  it('returns wires unchanged for empty array', () => {
    const result = equalizeWireLengths([]);
    expect(result).toEqual([]);
  });

  it('extends shorter wires to match the longest', () => {
    const w1 = makeWire('w1', [pt(0, 0), pt(100, 0)]); // length 100
    const w2 = makeWire('w2', [pt(0, 50), pt(30, 50)]); // length 30
    const result = equalizeWireLengths([w1, w2]);
    // w1 should stay the same (already longest)
    expect(calculateWireLength(result[0])).toBe(100);
    // w2 should have been extended
    expect(calculateWireLength(result[1])).toBeGreaterThan(30);
  });

  it('does not modify wires already at or above target length', () => {
    const w1 = makeWire('w1', [pt(0, 0), pt(100, 0)]);
    const w2 = makeWire('w2', [pt(0, 50), pt(50, 50)]);
    const result = equalizeWireLengths([w1, w2], 80);
    // w1 is 100, already >= 80, should be unchanged
    expect(result[0]).toBe(w1);
  });
});

// ==================== generateWireLabels ====================

describe('generateWireLabels', () => {
  it('returns empty array for empty wires', () => {
    const netNames = new Map<string, string>();
    const result = generateWireLabels([], [], netNames);
    expect(result).toEqual([]);
  });

  it('generates a label for a wire with named net', () => {
    const w1 = makeWire('w1', [pt(0, 50), pt(100, 50)], { fromPortId: 'p1' });
    const netNames = new Map([['p1', 'VCC']]);
    const result = generateWireLabels([w1], [], netNames);
    expect(result).toHaveLength(1);
    expect(result[0].wireId).toBe('w1');
    expect(result[0].label).toBe('VCC');
    expect(result[0].position).toHaveProperty('x');
    expect(result[0].position).toHaveProperty('y');
  });

  it('skips wires with auto-generated net names starting with _NET_', () => {
    const w1 = makeWire('w1', [pt(0, 50), pt(100, 50)], { fromPortId: 'p1' });
    const netNames = new Map([['p1', '_NET_123']]);
    const result = generateWireLabels([w1], [], netNames);
    expect(result).toHaveLength(0);
  });

  it('places label at midpoint of wire', () => {
    const w1 = makeWire('w1', [pt(0, 50), pt(100, 50)], { fromPortId: 'p1' });
    const netNames = new Map([['p1', 'CLK']]);
    const result = generateWireLabels([w1], [], netNames);
    // midIdx = floor(2/2) = 1, point is (100,50), position is (100,40)
    expect(result[0].position.x).toBe(100);
    expect(result[0].position.y).toBe(40); // y - 10
  });

  it('falls back to toPortId when fromPortId has no net name', () => {
    const w1 = makeWire('w1', [pt(0, 50), pt(100, 50)], {
      fromPortId: 'p1',
      toPortId: 'p2',
    });
    const netNames = new Map([['p2', 'GND']]);
    const result = generateWireLabels([w1], [], netNames);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('GND');
  });
});
