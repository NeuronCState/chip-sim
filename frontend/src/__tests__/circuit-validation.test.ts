import { describe, it, expect } from 'vitest';
import { validateCircuit, validateWire } from '../lib/circuit/circuit-validation';
import { ComponentType, ValidationSeverity, WireStatus } from '../types/circuit';
import type { CircuitComponent, Wire, ValidationMessage } from '../types/circuit';

/** 辅助函数：创建测试元件 */
function makeComponent(
  id: string,
  type: ComponentType = ComponentType.Resistor,
  name: string = 'R1',
  portIds: string[] = ['p1', 'p2']
): CircuitComponent {
  return {
    id,
    type,
    name,
    position: { x: 0, y: 0 },
    rotation: 0 as CircuitComponent['rotation'],
    value: { value: 1000, unit: 'Ω' },
    ports: portIds.map((pid) => ({ id: pid, offset: { x: 0, y: 0 } })),
  };
}

function makeWire(
  id: string,
  fromCompId: string,
  fromPortId: string,
  toCompId: string,
  toPortId: string
): Wire {
  return {
    id,
    fromComponentId: fromCompId,
    fromPortId,
    toComponentId: toCompId,
    toPortId,
    points: [],
    status: WireStatus.Connected,
  };
}

function findMsg(
  messages: ValidationMessage[],
  severity: ValidationSeverity,
  substring: string
): boolean {
  return messages.some(
    (m) => m.severity === severity && m.message.includes(substring)
  );
}

describe('circuit-validation', () => {
  describe('validateCircuit', () => {
    it('should return info for empty circuit', () => {
      const msgs = validateCircuit([], [], []);
      expect(msgs).toHaveLength(1);
      expect(msgs[0].severity).toBe(ValidationSeverity.Info);
      expect(msgs[0].message).toContain('空');
    });

    it('should report missing ground', () => {
      const comps = [makeComponent('c1', ComponentType.Resistor)];
      const msgs = validateCircuit(comps, [], []);
      expect(findMsg(msgs, ValidationSeverity.Error, '接地')).toBe(true);
    });

    it('should not report missing ground when ground exists', () => {
      const comps = [makeComponent('c1', ComponentType.Resistor), makeComponent('g1', ComponentType.Ground, 'GND')];
      const msgs = validateCircuit(comps, [], []);
      const hasGroundError = msgs.some(
        (m) => m.severity === ValidationSeverity.Error && m.message.includes('接地')
      );
      expect(hasGroundError).toBe(false);
    });

    it('should report no wires warning when components have no ports', () => {
      // Components with no ports won't trigger unconnected-ports warning,
      // so the no-wires warning can be detected
      const comps: CircuitComponent[] = [
        {
          id: 'c1',
          type: ComponentType.Resistor,
          name: 'R1',
          position: { x: 0, y: 0 },
          rotation: 0 as CircuitComponent['rotation'],
          value: { value: 1000, unit: 'Ω' },
          ports: [],
        },
        {
          id: 'g1',
          type: ComponentType.Ground,
          name: 'GND',
          position: { x: 0, y: 0 },
          rotation: 0 as CircuitComponent['rotation'],
          value: { value: 0, unit: 'V' },
          ports: [],
        },
      ];
      const msgs = validateCircuit(comps, [], []);
      const noWireMsgs = msgs.filter(m => m.severity === ValidationSeverity.Warning);
      const hasNoWire = noWireMsgs.some(m => m.message === '电路中没有任何连线');
      expect(hasNoWire).toBe(true);
    });

    it('should report unconnected ports', () => {
      const comp1 = makeComponent('c1', ComponentType.Resistor, 'R1', ['p1', 'p2']);
      const comp2 = makeComponent('c2', ComponentType.Ground, 'GND', ['p3']);
      // Wire from p1 to p3, but p2 is unconnected
      const wires = [makeWire('w1', 'c1', 'p1', 'c2', 'p3')];
      const msgs = validateCircuit([comp1, comp2], [], wires);
      expect(findMsg(msgs, ValidationSeverity.Warning, '未连接的端口')).toBe(true);
    });

    it('should report isolated components', () => {
      const comp1 = makeComponent('c1', ComponentType.Resistor, 'R1', ['p1', 'p2']);
      const comp2 = makeComponent('c2', ComponentType.Ground, 'GND', ['p3']);
      const comp3 = makeComponent('c3', ComponentType.Capacitor, 'C1', ['p4', 'p5']);
      // Wire connects c1 and c2, but c3 is isolated
      const wires = [makeWire('w1', 'c1', 'p1', 'c2', 'p3')];
      const msgs = validateCircuit([comp1, comp2, comp3], [], wires);
      expect(findMsg(msgs, ValidationSeverity.Warning, '未连接到')).toBe(true);
    });

    it('should report no source warning', () => {
      const comps = [
        makeComponent('c1', ComponentType.Resistor),
        makeComponent('g1', ComponentType.Ground, 'GND'),
      ];
      const wires = [makeWire('w1', 'c1', 'p1', 'g1', 'p2')];
      const msgs = validateCircuit(comps, [], wires);
      expect(findMsg(msgs, ValidationSeverity.Warning, '没有电源')).toBe(true);
    });

    it('should report structure complete when all ports are connected', () => {
      // All 5 ports must be connected (2+2+1) for "结构完整"
      const comps = [
        makeComponent('src', ComponentType.DCSource, 'V1', ['ps1', 'ps2']),
        makeComponent('r1', ComponentType.Resistor, 'R1', ['pr1', 'pr2']),
        makeComponent('gnd', ComponentType.Ground, 'GND', ['pg1']),
      ];
      const wires = [
        makeWire('w1', 'src', 'ps1', 'r1', 'pr1'),
        makeWire('w2', 'r1', 'pr2', 'src', 'ps2'),      // connect ps2
        makeWire('w3', 'src', 'ps1', 'gnd', 'pg1'),      // connect pg1
      ];
      const msgs = validateCircuit(comps, [], wires);
      expect(findMsg(msgs, ValidationSeverity.Info, '结构完整')).toBe(true);
    });
  });

  describe('validateWire', () => {
    it('should return true for valid wire', () => {
      const comps = [
        makeComponent('c1', ComponentType.Resistor, 'R1', ['p1', 'p2']),
        makeComponent('c2', ComponentType.Ground, 'GND', ['p3']),
      ];
      const wire = makeWire('w1', 'c1', 'p1', 'c2', 'p3');
      expect(validateWire(wire, comps)).toBe(true);
    });

    it('should return false when component is missing', () => {
      const comps = [makeComponent('c1', ComponentType.Resistor, 'R1', ['p1'])];
      const wire = makeWire('w1', 'c1', 'p1', 'c99', 'p2');
      expect(validateWire(wire, comps)).toBe(false);
    });

    it('should return false when port is missing', () => {
      const comps = [
        makeComponent('c1', ComponentType.Resistor, 'R1', ['p1']),
        makeComponent('c2', ComponentType.Ground, 'GND', ['p3']),
      ];
      const wire = makeWire('w1', 'c1', 'p99', 'c2', 'p3');
      expect(validateWire(wire, comps)).toBe(false);
    });
  });
});
