import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  NetManager,
  NetLabelType,
  autoConnectNetLabels,
  GLOBAL_POWER_NETS,
  GLOBAL_GROUND_NETS,
} from '../lib/circuit/NetManager';
import type { NetLabel } from '../lib/circuit/NetManager';
import type { CircuitComponent, Wire } from '../types/circuit';

// ── Mock external dependencies ──────────────────────────────────────
vi.mock('../lib/circuit/circuit-utils', () => ({
  generateId: () => `mock-${Math.random().toString(36).slice(2, 9)}`,
  getPortAbsolutePosition: (comp: CircuitComponent, portId: string) => {
    const port = comp.ports?.find((p) => p.id === portId);
    return port ? { x: 100, y: 200 } : undefined;
  },
}));

vi.mock('../lib/circuit/SmartRouter', () => ({
  routeWireByPorts: () => [{ x: 0, y: 0 }, { x: 50, y: 50 }],
}));

// ── Helpers ─────────────────────────────────────────────────────────
function makeLabel(overrides: Partial<NetLabel> = {}): NetLabel {
  return {
    id: `label-${Math.random().toString(36).slice(2, 8)}`,
    name: 'SIGNAL',
    position: { x: 10, y: 20 },
    type: NetLabelType.Signal,
    isGlobal: false,
    ...overrides,
  };
}

function makeComponent(overrides: Partial<CircuitComponent> = {}): CircuitComponent {
  return {
    id: `comp-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Resistor',
    type: 'resistor',
    position: { x: 0, y: 0 },
    params: {},
    ports: [{ id: 'p1', offset: { x: 0, y: 0 } }],
    ...overrides,
  } as CircuitComponent;
}

function makeWire(overrides: Partial<Wire> = {}): Wire {
  return {
    id: `wire-${Math.random().toString(36).slice(2, 8)}`,
    fromComponentId: 'c1',
    fromPortId: 'p1',
    toComponentId: 'c2',
    toPortId: 'p2',
    points: [],
    status: 'connected',
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────
describe('NetManager', () => {
  let manager: NetManager;

  beforeEach(() => {
    manager = new NetManager();
  });

  // 1. addLabel / getLabel / getAllLabels
  describe('addLabel / getLabel / getAllLabels', () => {
    it('should add a label and retrieve it by id', () => {
      const label = makeLabel({ id: 'lbl-1', name: 'CLK' });
      manager.addLabel(label);
      expect(manager.getLabel('lbl-1')).toEqual(label);
    });

    it('should return undefined for non-existent label', () => {
      expect(manager.getLabel('nope')).toBeUndefined();
    });

    it('should return all added labels', () => {
      manager.addLabel(makeLabel({ id: 'a' }));
      manager.addLabel(makeLabel({ id: 'b' }));
      manager.addLabel(makeLabel({ id: 'c' }));
      const all = manager.getAllLabels();
      expect(all).toHaveLength(3);
      expect(all.map((l) => l.id).sort()).toEqual(['a', 'b', 'c']);
    });

    it('should overwrite label with same id', () => {
      const l1 = makeLabel({ id: 'dup', name: 'OLD' });
      const l2 = makeLabel({ id: 'dup', name: 'NEW' });
      manager.addLabel(l1);
      manager.addLabel(l2);
      expect(manager.getLabel('dup')?.name).toBe('NEW');
      expect(manager.getAllLabels()).toHaveLength(1);
    });
  });

  // 2. removeLabel
  describe('removeLabel', () => {
    it('should remove an existing label', () => {
      manager.addLabel(makeLabel({ id: 'rm1' }));
      manager.removeLabel('rm1');
      expect(manager.getLabel('rm1')).toBeUndefined();
      expect(manager.getAllLabels()).toHaveLength(0);
    });

    it('should be a no-op when removing non-existent id', () => {
      manager.addLabel(makeLabel({ id: 'keep' }));
      manager.removeLabel('ghost');
      expect(manager.getAllLabels()).toHaveLength(1);
    });
  });

  // 3. findLabelsByName – case-insensitive
  describe('findLabelsByName', () => {
    it('should find labels case-insensitively', () => {
      manager.addLabel(makeLabel({ id: '1', name: 'VCC' }));
      manager.addLabel(makeLabel({ id: '2', name: 'vcc' }));
      manager.addLabel(makeLabel({ id: '3', name: 'Vcc' }));
      manager.addLabel(makeLabel({ id: '4', name: 'GND' }));

      const found = manager.findLabelsByName('Vcc');
      expect(found).toHaveLength(3);
      expect(found.map((l) => l.id).sort()).toEqual(['1', '2', '3']);
    });

    it('should return empty array when no match', () => {
      manager.addLabel(makeLabel({ name: 'CLK' }));
      expect(manager.findLabelsByName('DATA')).toHaveLength(0);
    });
  });

  // 4. renameLabel auto-detects power / ground type
  describe('renameLabel', () => {
    it('should auto-detect power type and set isGlobal for VCC', () => {
      const label = makeLabel({ id: 'pw', name: 'SIG', type: NetLabelType.Signal, isGlobal: false });
      manager.addLabel(label);
      manager.renameLabel('pw', 'VCC');

      const updated = manager.getLabel('pw')!;
      expect(updated.name).toBe('VCC');
      expect(updated.type).toBe(NetLabelType.Power);
      expect(updated.isGlobal).toBe(true);
    });

    it('should auto-detect ground type and set isGlobal for GND', () => {
      const label = makeLabel({ id: 'g', name: 'SIG', type: NetLabelType.Signal, isGlobal: false });
      manager.addLabel(label);
      manager.renameLabel('g', 'GND');

      const updated = manager.getLabel('g')!;
      expect(updated.name).toBe('GND');
      expect(updated.type).toBe(NetLabelType.Ground);
      expect(updated.isGlobal).toBe(true);
    });

    it('should work with lowercase rename (VCC → power)', () => {
      const label = makeLabel({ id: 'lc', name: 'x', type: NetLabelType.Signal });
      manager.addLabel(label);
      manager.renameLabel('lc', 'vdd');

      const updated = manager.getLabel('lc')!;
      expect(updated.type).toBe(NetLabelType.Power);
      expect(updated.isGlobal).toBe(true);
    });

    it('should not set isGlobal for ordinary signal names', () => {
      const label = makeLabel({ id: 'sg', name: 'OLD', type: NetLabelType.Bus });
      manager.addLabel(label);
      manager.renameLabel('sg', 'CLK');

      const updated = manager.getLabel('sg')!;
      expect(updated.name).toBe('CLK');
      expect(updated.type).toBe(NetLabelType.Bus); // unchanged
      expect(updated.isGlobal).toBe(false);
    });
  });

  // 5. clear removes all labels
  describe('clear', () => {
    it('should remove every label', () => {
      manager.addLabel(makeLabel());
      manager.addLabel(makeLabel());
      manager.addLabel(makeLabel());
      manager.clear();
      expect(manager.getAllLabels()).toHaveLength(0);
    });
  });

  // 6. updateLabelPosition
  describe('updateLabelPosition', () => {
    it('should update position of existing label', () => {
      manager.addLabel(makeLabel({ id: 'pos', position: { x: 0, y: 0 } }));
      manager.updateLabelPosition('pos', { x: 99, y: 88 });
      expect(manager.getLabel('pos')?.position).toEqual({ x: 99, y: 88 });
    });

    it('should silently ignore non-existent label', () => {
      manager.updateLabelPosition('ghost', { x: 1, y: 1 });
      expect(manager.getAllLabels()).toHaveLength(0);
    });
  });

  // 7. buildNetMap returns correct structure
  describe('buildNetMap', () => {
    it('should create a net entry from label with connected port', () => {
      const comp = makeComponent({ id: 'c1', name: 'R1' });
      const label = makeLabel({
        id: 'lbl-vcc',
        name: 'VCC',
        type: NetLabelType.Power,
        isGlobal: true,
        connectedPort: { componentId: 'c1', portId: 'p1' },
      });
      manager.addLabel(label);

      const netMap = manager.buildNetMap([comp], []);
      const net = netMap.get('vcc');

      expect(net).toBeDefined();
      expect(net!.name).toBe('VCC');
      expect(net!.type).toBe(NetLabelType.Power);
      expect(net!.isGlobal).toBe(true);
      expect(net!.labelIds).toContain('lbl-vcc');
      expect(net!.connectedPorts).toHaveLength(1);
      expect(net!.connectedPorts[0].componentId).toBe('c1');
      expect(net!.wireIds).toHaveLength(0);
    });

    it('should associate wires with nets via connected labels', () => {
      const comp = makeComponent({ id: 'c1', name: 'R1', ports: [{ id: 'p1', offset: { x: 0, y: 0 } }, { id: 'p2', offset: { x: 10, y: 0 } }] });
      const label = makeLabel({
        id: 'lbl-sig',
        name: 'DATA',
        connectedPort: { componentId: 'c1', portId: 'p1' },
      });
      manager.addLabel(label);

      const wire = makeWire({ id: 'w1', fromPortId: 'p1', toPortId: 'p2' });
      const netMap = manager.buildNetMap([comp], [wire]);
      const net = netMap.get('data');

      expect(net).toBeDefined();
      expect(net!.wireIds).toContain('w1');
    });

    it('should create implicit nets from wires without labels', () => {
      const wire = makeWire({ id: 'w-implicit', fromPortId: 'x1', toPortId: 'x2' });
      const netMap = manager.buildNetMap([], [wire]);

      // An unnamed net (_NET_0 etc.) should be created
      const unnamedNets = Array.from(netMap.values()).filter((n) => n.name.startsWith('_NET_'));
      expect(unnamedNets.length).toBeGreaterThanOrEqual(1);
      expect(unnamedNets[0].wireIds).toContain('w-implicit');
    });
  });

  // 8. getNetList returns sorted list (global first)
  describe('getNetList', () => {
    it('should sort global nets before non-global, then alphabetically', () => {
      manager.addLabel(makeLabel({ id: 'a', name: 'CLK', type: NetLabelType.Signal, isGlobal: false }));
      manager.addLabel(makeLabel({ id: 'b', name: 'GND', type: NetLabelType.Ground, isGlobal: true }));
      manager.addLabel(makeLabel({ id: 'c', name: 'DATA', type: NetLabelType.Signal, isGlobal: false }));
      manager.addLabel(makeLabel({ id: 'd', name: 'VCC', type: NetLabelType.Power, isGlobal: true }));

      const list = manager.getNetList([], []);
      const names = list.map((n) => n.name);

      // Global nets first
      const firstNonGlobal = names.findIndex((n) => !['VCC', 'GND'].includes(n));
      const lastGlobal = names.findLastIndex((n) => ['VCC', 'GND'].includes(n));
      expect(lastGlobal).toBeLessThan(firstNonGlobal);

      // Alphabetical within groups
      const globalNames = names.filter((n) => ['VCC', 'GND'].includes(n));
      expect(globalNames).toEqual(['GND', 'VCC']);
    });

    it('should return empty array when no labels', () => {
      expect(manager.getNetList([], [])).toEqual([]);
    });
  });

  // 9. searchNets filters by query
  describe('searchNets', () => {
    it('should return nets matching query (case-insensitive)', () => {
      manager.addLabel(makeLabel({ id: 's1', name: 'VCC' }));
      manager.addLabel(makeLabel({ id: 's2', name: 'GND' }));
      manager.addLabel(makeLabel({ id: 's3', name: 'CLK' }));
      manager.addLabel(makeLabel({ id: 's4', name: 'DATA_BUS' }));

      const results = manager.searchNets('da', [], []);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('DATA_BUS');
    });

    it('should match partial query', () => {
      manager.addLabel(makeLabel({ id: 'p1', name: 'AVCC' }));
      manager.addLabel(makeLabel({ id: 'p2', name: 'DVCC' }));
      manager.addLabel(makeLabel({ id: 'p3', name: 'GND' }));

      const results = manager.searchNets('vcc', [], []);
      expect(results).toHaveLength(2);
      expect(results.map((n) => n.name).sort()).toEqual(['AVCC', 'DVCC']);
    });

    it('should return empty when nothing matches', () => {
      manager.addLabel(makeLabel({ name: 'CLK' }));
      expect(manager.searchNets('XYZ', [], [])).toHaveLength(0);
    });
  });
});

// ── Exported constants ──────────────────────────────────────────────
describe('GLOBAL_POWER_NETS / GLOBAL_GROUND_NETS', () => {
  it('should contain expected power nets', () => {
    expect(GLOBAL_POWER_NETS.has('VCC')).toBe(true);
    expect(GLOBAL_POWER_NETS.has('VDD')).toBe(true);
    expect(GLOBAL_POWER_NETS.has('AVCC')).toBe(true);
    expect(GLOBAL_POWER_NETS.has('GND')).toBe(false);
  });

  it('should contain expected ground nets', () => {
    expect(GLOBAL_GROUND_NETS.has('GND')).toBe(true);
    expect(GLOBAL_GROUND_NETS.has('AGND')).toBe(true);
    expect(GLOBAL_GROUND_NETS.has('DGND')).toBe(true);
    expect(GLOBAL_GROUND_NETS.has('VCC')).toBe(false);
  });
});

// ── NetLabelType enum ───────────────────────────────────────────────
describe('NetLabelType', () => {
  it('should export correct string values', () => {
    expect(NetLabelType.Signal).toBe('signal');
    expect(NetLabelType.Power).toBe('power');
    expect(NetLabelType.Ground).toBe('ground');
    expect(NetLabelType.Bus).toBe('bus');
  });
});

// ── autoConnectNetLabels ────────────────────────────────────────────
describe('autoConnectNetLabels', () => {
  it('should group labels by name and create wires between same-named connected labels', () => {
    const comp1 = makeComponent({ id: 'c1', ports: [{ id: 'p1', offset: { x: 0, y: 0 } }] });
    const comp2 = makeComponent({ id: 'c2', ports: [{ id: 'p2', offset: { x: 10, y: 0 } }] });
    const comp3 = makeComponent({ id: 'c3', ports: [{ id: 'p3', offset: { x: 20, y: 0 } }] });

    const labels: NetLabel[] = [
      makeLabel({ id: 'ln1', name: 'CLK', connectedPort: { componentId: 'c1', portId: 'p1' } }),
      makeLabel({ id: 'ln2', name: 'CLK', connectedPort: { componentId: 'c2', portId: 'p2' } }),
      makeLabel({ id: 'ln3', name: 'CLK', connectedPort: { componentId: 'c3', portId: 'p3' } }),
    ];

    const result = autoConnectNetLabels(labels, [comp1, comp2, comp3], []);

    // Chain: c1→c2, c2→c3 = 2 wires
    expect(result.wires).toHaveLength(2);
    expect(result.failed).toHaveLength(0);
    expect(result.wires[0].fromComponentId).toBe('c1');
    expect(result.wires[0].toComponentId).toBe('c2');
    expect(result.wires[1].fromComponentId).toBe('c2');
    expect(result.wires[1].toComponentId).toBe('c3');
  });

  it('should skip labels without connectedPort', () => {
    const labels: NetLabel[] = [
      makeLabel({ id: 'no-p1', name: 'SIG' }),
      makeLabel({ id: 'no-p2', name: 'SIG' }),
    ];

    const result = autoConnectNetLabels(labels, [], []);
    expect(result.wires).toHaveLength(0);
  });

  it('should skip single-label groups', () => {
    const comp = makeComponent({ id: 'c1', ports: [{ id: 'p1', offset: { x: 0, y: 0 } }] });
    const labels: NetLabel[] = [
      makeLabel({ id: 'solo', name: 'ONLY', connectedPort: { componentId: 'c1', portId: 'p1' } }),
    ];

    const result = autoConnectNetLabels(labels, [comp], []);
    expect(result.wires).toHaveLength(0);
  });

  it('should not duplicate existing wires', () => {
    const comp1 = makeComponent({ id: 'c1', ports: [{ id: 'p1', offset: { x: 0, y: 0 } }] });
    const comp2 = makeComponent({ id: 'c2', ports: [{ id: 'p2', offset: { x: 10, y: 0 } }] });

    const labels: NetLabel[] = [
      makeLabel({ id: 'dup1', name: 'BUS', connectedPort: { componentId: 'c1', portId: 'p1' } }),
      makeLabel({ id: 'dup2', name: 'BUS', connectedPort: { componentId: 'c2', portId: 'p2' } }),
    ];

    const existing: Wire[] = [
      makeWire({ fromPortId: 'p1', toPortId: 'p2' }),
    ];

    const result = autoConnectNetLabels(labels, [comp1, comp2], existing);
    expect(result.wires).toHaveLength(0); // already connected
  });

  it('should group by lowercase name (VCC and vcc together)', () => {
    const comp1 = makeComponent({ id: 'c1', ports: [{ id: 'p1', offset: { x: 0, y: 0 } }] });
    const comp2 = makeComponent({ id: 'c2', ports: [{ id: 'p2', offset: { x: 10, y: 0 } }] });

    const labels: NetLabel[] = [
      makeLabel({ id: 'mix1', name: 'VCC', connectedPort: { componentId: 'c1', portId: 'p1' } }),
      makeLabel({ id: 'mix2', name: 'vcc', connectedPort: { componentId: 'c2', portId: 'p2' } }),
    ];

    const result = autoConnectNetLabels(labels, [comp1, comp2], []);
    expect(result.wires).toHaveLength(1);
  });

  it('should return AutoRouteResult shape with wires, labels, failed', () => {
    const result = autoConnectNetLabels([], [], []);
    expect(result).toHaveProperty('wires');
    expect(result).toHaveProperty('labels');
    expect(result).toHaveProperty('failed');
    expect(Array.isArray(result.wires)).toBe(true);
    expect(Array.isArray(result.labels)).toBe(true);
    expect(Array.isArray(result.failed)).toBe(true);
  });
});
