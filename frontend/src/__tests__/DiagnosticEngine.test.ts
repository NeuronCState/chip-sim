import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DiagnosticEngine } from '../lib/circuit/DiagnosticEngine';
import type { DRCDiagnostic, DRCRule } from '../lib/circuit/CircuitDRC';
import type { CircuitComponent, CircuitNode, Wire } from '../types/circuit';

// ── Mock CircuitDRC module ──────────────────────────────────────────
const mockDiagnostics: DRCDiagnostic[] = [];
const mockRules: DRCRule[] = [
  {
    id: 'rule-1',
    name: 'Test Rule 1',
    description: 'A test rule',
    severity: 'error',
    enabled: true,
    check: vi.fn(() => []),
  },
  {
    id: 'rule-2',
    name: 'Test Rule 2',
    description: 'Another test rule',
    severity: 'warning',
    enabled: true,
    check: vi.fn(() => []),
  },
];

const mockRunDRC = vi.fn(() => mockDiagnostics);
const mockCanSimulate = vi.fn(() => ({
  allowed: mockDiagnostics.filter((d) => d.severity === 'error').length === 0,
  errors: mockDiagnostics.filter((d) => d.severity === 'error'),
  warnings: mockDiagnostics.filter((d) => d.severity === 'warning'),
}));
const mockGetAllRules = vi.fn(() => mockRules);

vi.mock('../lib/circuit/CircuitDRC', () => ({
  runDRC: (...args: unknown[]) => mockRunDRC(...(args as [])),
  canSimulate: (...args: unknown[]) => mockCanSimulate(...(args as [])),
  getAllRules: () => mockGetAllRules(),
}));

// ── Helpers ─────────────────────────────────────────────────────────
function makeComponent(id: string, name = `Comp-${id}`): CircuitComponent {
  return {
    id,
    type: 'resistor' as any,
    name,
    position: { x: 0, y: 0 },
    rotation: 0,
    value: { value: 1000, unit: 'Ω', prefix: 'k' },
    ports: [{ id: `${id}-p1`, offset: { x: 0, y: 0 } }],
  };
}

function makeNode(id: string): CircuitNode {
  return { id, name: `Node-${id}`, type: 'junction' as any, position: { x: 0, y: 0 }, connectedPorts: [] };
}

function makeWire(id: string): Wire {
  return {
    id,
    fromComponentId: 'c1',
    fromPortId: 'c1-p1',
    toComponentId: 'c2',
    toPortId: 'c2-p1',
    points: [],
    status: 'connected' as any,
  };
}

// ── Tests ───────────────────────────────────────────────────────────
describe('DiagnosticEngine', () => {
  let engine: DiagnosticEngine;
  const components: CircuitComponent[] = [makeComponent('c1'), makeComponent('c2')];
  const nodes: CircuitNode[] = [makeNode('n1')];
  const wires: Wire[] = [makeWire('w1')];

  beforeEach(() => {
    vi.useFakeTimers();
    mockDiagnostics.length = 0;
    mockRunDRC.mockClear();
    mockCanSimulate.mockClear();
    mockGetAllRules.mockClear();
    mockRules.forEach((r) => {
      (r as any).enabled = true;
    });
    engine = new DiagnosticEngine(300);
  });

  afterEach(() => {
    engine.dispose();
    vi.useRealTimers();
  });

  // 1 ── Initial state is empty
  it('starts with an empty diagnostic state', () => {
    const state = engine.getState();
    expect(state.diagnostics).toEqual([]);
    expect(state.errorCount).toBe(0);
    expect(state.warningCount).toBe(0);
    expect(state.suggestionCount).toBe(0);
    expect(state.isRunning).toBe(false);
    expect(state.lastRunTime).toBe(0);
  });

  // 2 ── run() populates diagnostics and counts
  it('run() populates diagnostics and counts', () => {
    mockDiagnostics.push(
      { ruleId: 'r1', severity: 'error', message: 'err', suggestion: 'fix' },
      { ruleId: 'r2', severity: 'warning', message: 'warn', suggestion: 'fix' },
      { ruleId: 'r3', severity: 'suggestion', message: 'tip', suggestion: 'fix' },
    );
    mockRunDRC.mockReturnValue([...mockDiagnostics]);

    const result = engine.run(components, nodes, wires);

    expect(result).toHaveLength(3);
    expect(mockRunDRC).toHaveBeenCalledWith(components, nodes, wires);

    const state = engine.getState();
    expect(state.errorCount).toBe(1);
    expect(state.warningCount).toBe(1);
    expect(state.suggestionCount).toBe(1);
    expect(state.diagnostics).toHaveLength(3);
    expect(state.lastRunTime).toBeGreaterThan(0);
    expect(state.isRunning).toBe(false);
  });

  // 3 ── getDiagnosticsBySeverity filters correctly
  it('getDiagnosticsBySeverity returns only matching severity', () => {
    mockDiagnostics.push(
      { ruleId: 'r1', severity: 'error', message: 'e1', suggestion: '' },
      { ruleId: 'r2', severity: 'warning', message: 'w1', suggestion: '' },
      { ruleId: 'r3', severity: 'error', message: 'e2', suggestion: '' },
    );
    mockRunDRC.mockReturnValue([...mockDiagnostics]);
    engine.run(components, nodes, wires);

    expect(engine.getDiagnosticsBySeverity('error')).toHaveLength(2);
    expect(engine.getDiagnosticsBySeverity('warning')).toHaveLength(1);
    expect(engine.getDiagnosticsBySeverity('suggestion')).toHaveLength(0);
  });

  // 4 ── getDiagnosticsForComponent filters by targetId
  it('getDiagnosticsForComponent returns only diagnostics for that component', () => {
    mockDiagnostics.push(
      { ruleId: 'r1', severity: 'error', message: '', suggestion: '', targetId: 'c1' },
      { ruleId: 'r2', severity: 'warning', message: '', suggestion: '', targetId: 'c2' },
      { ruleId: 'r3', severity: 'error', message: '', suggestion: '', targetId: 'c1' },
    );
    mockRunDRC.mockReturnValue([...mockDiagnostics]);
    engine.run(components, nodes, wires);

    expect(engine.getDiagnosticsForComponent('c1')).toHaveLength(2);
    expect(engine.getDiagnosticsForComponent('c2')).toHaveLength(1);
    expect(engine.getDiagnosticsForComponent('nope')).toHaveLength(0);
  });

  // 5 ── subscribe immediately notifies with current state
  it('subscribe immediately calls the listener with current state', () => {
    const listener = vi.fn();
    engine.subscribe(listener);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      diagnostics: [],
      errorCount: 0,
    }));
  });

  // 6 ── subscribe returns working unsubscribe function
  it('subscribe returns an unsubscribe that stops notifications', () => {
    const listener = vi.fn();
    const unsub = engine.subscribe(listener);

    listener.mockClear();
    unsub();

    // run should NOT trigger the listener after unsubscribe
    mockRunDRC.mockReturnValue([{ ruleId: 'r1', severity: 'error', message: '', suggestion: '' }]);
    engine.run(components, nodes, wires);

    expect(listener).not.toHaveBeenCalled();
  });

  // 7 ── clear() resets state
  it('clear() resets diagnostics and counts', () => {
    mockDiagnostics.push({ ruleId: 'r1', severity: 'error', message: '', suggestion: '' });
    mockRunDRC.mockReturnValue([...mockDiagnostics]);
    engine.run(components, nodes, wires);
    expect(engine.getState().errorCount).toBe(1);

    engine.clear();

    const state = engine.getState();
    expect(state.diagnostics).toEqual([]);
    expect(state.errorCount).toBe(0);
    expect(state.warningCount).toBe(0);
    expect(state.suggestionCount).toBe(0);
  });

  // 8 ── dispose() cleans up listeners
  it('dispose() removes all listeners', () => {
    const l1 = vi.fn();
    const l2 = vi.fn();
    engine.subscribe(l1);
    engine.subscribe(l2);

    l1.mockClear();
    l2.mockClear();

    engine.dispose();

    mockRunDRC.mockReturnValue([]);
    engine.run(components, nodes, wires);

    expect(l1).not.toHaveBeenCalled();
    expect(l2).not.toHaveBeenCalled();
  });

  // 9 ── setRuleEnabled toggles rule
  it('setRuleEnabled updates the enabled flag on the matching rule', () => {
    expect(mockRules[0].enabled).toBe(true);

    engine.setRuleEnabled('rule-1', false);
    expect(mockRules[0].enabled).toBe(false);

    engine.setRuleEnabled('rule-1', true);
    expect(mockRules[0].enabled).toBe(true);
  });

  // ── Bonus: trigger() debounces run()
  it('trigger() debounces and calls run() after delay', () => {
    mockRunDRC.mockReturnValue([]);
    triggerAndWait();
    expect(mockRunDRC).toHaveBeenCalledTimes(1);
  });

  function triggerAndWait() {
    engine.trigger(components, nodes, wires);
    vi.advanceTimersByTime(300);
  }

  // ── Bonus: checkSimulation delegates to canSimulate
  it('checkSimulation delegates to canSimulate', () => {
    mockCanSimulate.mockReturnValue({ allowed: true, errors: [], warnings: [] });
    const result = engine.checkSimulation(components, nodes, wires);
    expect(mockCanSimulate).toHaveBeenCalledWith(components, nodes, wires);
    expect(result.allowed).toBe(true);
  });

  // ── Bonus: getRules delegates to getAllRules
  it('getRules delegates to getAllRules', () => {
    const rules = engine.getRules();
    expect(mockGetAllRules).toHaveBeenCalled();
    expect(rules).toBe(mockRules);
  });

  // ── Bonus: multiple subscriptions all receive notifications
  it('notifies all subscribers on run()', () => {
    const l1 = vi.fn();
    const l2 = vi.fn();
    engine.subscribe(l1);
    engine.subscribe(l2);

    l1.mockClear();
    l2.mockClear();

    mockRunDRC.mockReturnValue([]);
    engine.run(components, nodes, wires);

    // Each listener gets called twice: once when isRunning=true, once when done
    expect(l1).toHaveBeenCalledTimes(2);
    expect(l2).toHaveBeenCalledTimes(2);
  });
});
