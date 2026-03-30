import { describe, it, expect } from 'vitest';
import {
  generateId,
  createComponent,
  createNode,
  getPortAbsolutePosition,
  snapToGrid,
  isPointInComponent,
} from '../lib/circuit/circuit-utils';
import { ComponentType, NodeType } from '../types/circuit';
import type { CircuitComponent, ComponentPort } from '../types/circuit';

describe('circuit-utils', () => {
  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });

    it('should return a non-empty string', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });
  });

  describe('createComponent', () => {
    it('should create a component with correct properties', () => {
      const ports: Omit<ComponentPort, 'id'>[] = [
        { offset: { x: -20, y: 0 } },
        { offset: { x: 20, y: 0 } },
      ];
      const comp = createComponent(
        ComponentType.Resistor,
        'R1',
        { x: 100, y: 200 },
        1000,
        'Ω',
        ports
      );

      expect(comp.type).toBe(ComponentType.Resistor);
      expect(comp.name).toBe('R1');
      expect(comp.position).toEqual({ x: 100, y: 200 });
      expect(comp.rotation).toBe(0);
      expect(comp.value).toEqual({ value: 1000, unit: 'Ω' });
      expect(comp.ports).toHaveLength(2);
      expect(comp.ports[0].id).toBeTruthy();
      expect(comp.ports[0].offset).toEqual({ x: -20, y: 0 });
    });

    it('should assign unique IDs to each port', () => {
      const ports: Omit<ComponentPort, 'id'>[] = [
        { offset: { x: -10, y: 0 } },
        { offset: { x: 10, y: 0 } },
      ];
      const comp = createComponent(ComponentType.Capacitor, 'C1', { x: 0, y: 0 }, 1e-6, 'F', ports);
      const portIds = comp.ports.map((p) => p.id);
      expect(new Set(portIds).size).toBe(2);
    });
  });

  describe('createNode', () => {
    it('should create a normal node by default', () => {
      const node = createNode('N1', { x: 50, y: 50 });
      expect(node.name).toBe('N1');
      expect(node.type).toBe(NodeType.Normal);
      expect(node.position).toEqual({ x: 50, y: 50 });
      expect(node.connectedPorts).toEqual([]);
      expect(node.id).toBeTruthy();
    });

    it('should create a ground node when type specified', () => {
      const node = createNode('GND', { x: 0, y: 0 }, NodeType.Ground);
      expect(node.type).toBe(NodeType.Ground);
    });
  });

  describe('getPortAbsolutePosition', () => {
    const makeComponent = (rotation: number, portOffset: { x: number; y: number }): CircuitComponent => ({
      id: 'comp-1',
      type: ComponentType.Resistor,
      name: 'R1',
      position: { x: 100, y: 100 },
      rotation: rotation as CircuitComponent['rotation'],
      value: { value: 1000, unit: 'Ω' },
      ports: [{ id: 'port-1', offset: portOffset }],
    });

    it('should return correct position with 0° rotation', () => {
      const comp = makeComponent(0, { x: 20, y: 0 });
      const pos = getPortAbsolutePosition(comp, 'port-1');
      expect(pos).toEqual({ x: 120, y: 100 });
    });

    it('should return correct position with 90° rotation', () => {
      const comp = makeComponent(90, { x: 20, y: 0 });
      const pos = getPortAbsolutePosition(comp, 'port-1');
      expect(pos!.x).toBeCloseTo(100, 5);
      expect(pos!.y).toBeCloseTo(120, 5);
    });

    it('should return correct position with 180° rotation', () => {
      const comp = makeComponent(180, { x: 20, y: 0 });
      const pos = getPortAbsolutePosition(comp, 'port-1');
      expect(pos!.x).toBeCloseTo(80, 5);
      expect(pos!.y).toBeCloseTo(100, 5);
    });

    it('should return null for unknown port ID', () => {
      const comp = makeComponent(0, { x: 20, y: 0 });
      const pos = getPortAbsolutePosition(comp, 'unknown-port');
      expect(pos).toBeNull();
    });
  });

  describe('snapToGrid', () => {
    it('should snap to nearest grid point with default grid size', () => {
      expect(snapToGrid(15, 15)).toEqual({ x: 20, y: 20 });
      expect(snapToGrid(5, 5)).toEqual({ x: 0, y: 0 });
      expect(snapToGrid(25, 25)).toEqual({ x: 20, y: 20 });
    });

    it('should snap exactly when already on grid', () => {
      expect(snapToGrid(40, 60)).toEqual({ x: 40, y: 60 });
    });

    it('should respect custom grid size', () => {
      expect(snapToGrid(17, 17, 10)).toEqual({ x: 20, y: 20 });
      expect(snapToGrid(12, 12, 10)).toEqual({ x: 10, y: 10 });
    });

    it('should handle negative coordinates', () => {
      expect(snapToGrid(-15, -15)).toEqual({ x: -20, y: -20 });
    });
  });

  describe('isPointInComponent', () => {
    const makeComponent = (rotation: number): CircuitComponent => ({
      id: 'comp-1',
      type: ComponentType.Resistor,
      name: 'R1',
      position: { x: 100, y: 100 },
      rotation: rotation as CircuitComponent['rotation'],
      value: { value: 1000, unit: 'Ω' },
      ports: [],
    });

    it('should return true for point inside component', () => {
      const comp = makeComponent(0);
      expect(isPointInComponent(100, 100, comp)).toBe(true);
    });

    it('should return false for point outside component', () => {
      const comp = makeComponent(0);
      expect(isPointInComponent(200, 200, comp)).toBe(false);
    });

    it('should respect padding parameter', () => {
      const comp = makeComponent(0);
      // 默认 padding=5, halfW=35, halfH=25
      expect(isPointInComponent(136, 100, comp, 5)).toBe(false);
      expect(isPointInComponent(134, 100, comp, 5)).toBe(true);
    });

    it('should handle rotated component', () => {
      const comp = makeComponent(90);
      // After 90° rotation, width and height swap
      expect(isPointInComponent(100, 100, comp)).toBe(true);
    });
  });
});
