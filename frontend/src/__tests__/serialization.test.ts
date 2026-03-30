import { describe, it, expect } from 'vitest';
import {
  serializeProject,
  exportToJson,
  importFromJson,
} from '../lib/circuit/serialization';
import { ComponentType, NodeType, WireStatus } from '../types/circuit';
import type { CircuitComponent, CircuitNode, Wire } from '../types/circuit';

function makeComponent(id: string): CircuitComponent {
  return {
    id,
    type: ComponentType.Resistor,
    name: 'R1',
    position: { x: 100, y: 200 },
    rotation: 0 as CircuitComponent['rotation'],
    value: { value: 1000, unit: 'Ω' },
    ports: [{ id: `${id}-port1`, offset: { x: -20, y: 0 } }],
  };
}

function makeNode(id: string): CircuitNode {
  return {
    id,
    name: 'N1',
    type: NodeType.Normal,
    position: { x: 50, y: 50 },
    connectedPorts: [],
  };
}

function makeWire(id: string): Wire {
  return {
    id,
    fromComponentId: 'c1',
    fromPortId: 'c1-port1',
    toComponentId: 'c2',
    toPortId: 'c2-port1',
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    status: WireStatus.Connected,
  };
}

describe('serialization', () => {
  describe('serializeProject', () => {
    it('should create a valid CircuitProject', () => {
      const comps = [makeComponent('c1')];
      const nodes = [makeNode('n1')];
      const wires = [makeWire('w1')];

      const project = serializeProject('Test Circuit', comps, nodes, wires);

      expect(project.name).toBe('Test Circuit');
      expect(project.components).toHaveLength(1);
      expect(project.nodes).toHaveLength(1);
      expect(project.wires).toHaveLength(1);
      expect(project.version).toBe('1.0.0');
      expect(project.id).toMatch(/^proj-/);
      expect(project.createdAt).toBeTruthy();
      expect(project.updatedAt).toBeTruthy();
    });

    it('should deep copy data (not reference)', () => {
      const comps = [makeComponent('c1')];
      const nodes = [makeNode('n1')];
      const wires = [makeWire('w1')];

      const project = serializeProject('Test', comps, nodes, wires);

      // Modifying original should not affect project
      comps[0].name = 'MODIFIED';
      expect(project.components[0].name).toBe('R1');
    });

    it('should use default simulation config', () => {
      const project = serializeProject('Test', [], [], []);
      expect(project.simulationConfig).toEqual({
        analysis: { type: 'dc' },
        enabled: false,
      });
    });
  });

  describe('exportToJson / importFromJson roundtrip', () => {
    it('should serialize and deserialize correctly', () => {
      const comps = [makeComponent('c1'), makeComponent('c2')];
      const nodes = [makeNode('n1')];
      const wires = [makeWire('w1')];

      const project = serializeProject('Roundtrip Test', comps, nodes, wires);
      const json = exportToJson(project);
      const imported = importFromJson(json);

      expect(imported.name).toBe(project.name);
      expect(imported.components).toHaveLength(2);
      expect(imported.components[0].id).toBe('c1');
      expect(imported.components[1].id).toBe('c2');
      expect(imported.nodes).toHaveLength(1);
      expect(imported.wires).toHaveLength(1);
      expect(imported.version).toBe('1.0.0');
    });

    it('should preserve wire points in roundtrip', () => {
      const wires = [makeWire('w1')];
      const project = serializeProject('Test', [makeComponent('c1')], [makeNode('n1')], wires);
      const json = exportToJson(project);
      const imported = importFromJson(json);

      expect(imported.wires[0].points).toHaveLength(2);
      expect(imported.wires[0].points[0]).toEqual({ x: 0, y: 0 });
    });
  });

  describe('importFromJson error handling', () => {
    it('should throw on invalid JSON', () => {
      expect(() => importFromJson('not json')).toThrow();
    });

    it('should throw when components array is missing', () => {
      expect(() => importFromJson('{"wires":[]}')).toThrow('components');
    });

    it('should throw when wires array is missing', () => {
      expect(() => importFromJson('{"components":[]}')).toThrow('wires');
    });

    it('should throw when components is not an array', () => {
      expect(() => importFromJson('{"components":"bad","wires":[]}')).toThrow();
    });
  });
});
