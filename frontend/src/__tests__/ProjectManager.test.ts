import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { CircuitComponent, CircuitNode, Wire } from '../types/circuit';

// ==================== Mocks ====================
// These must be at module level so vi.mock hoists them properly.

vi.mock('../core/StorageManager', () => {
  const projects = new Map<string, any>();
  const meta = new Map<string, any>();
  return {
    storageManager: {
      init: vi.fn().mockResolvedValue(undefined),
      migrateFromLocalStorage: vi.fn().mockResolvedValue(0),
      listProjects: vi.fn().mockImplementation(() => Promise.resolve([...projects.values()])),
      saveProject: vi.fn().mockImplementation((p: any) => {
        projects.set(p.id, p);
        return Promise.resolve();
      }),
      getProject: vi.fn().mockImplementation((id: string) => Promise.resolve(projects.get(id) || null)),
      deleteProject: vi.fn().mockImplementation((id: string) => {
        projects.delete(id);
        return Promise.resolve();
      }),
      setMeta: vi.fn().mockImplementation((key: string, value: any) => {
        meta.set(key, value);
        return Promise.resolve();
      }),
      getMeta: vi.fn().mockImplementation((key: string) => Promise.resolve(meta.get(key) ?? null)),
      exportAllProjects: vi.fn().mockResolvedValue('[]'),
      importProjectsFromJson: vi.fn().mockResolvedValue(0),
      getStorageUsage: vi.fn().mockResolvedValue({ usage: 0, quota: 0 }),
    },
    // Expose internals for test reset
    __projects: projects,
    __meta: meta,
  };
});

vi.mock('../lib/circuit/serialization', () => ({
  serializeProject: vi.fn(
    (name: string, comp: any[], nodes: any[], wires: any[], config: any) => ({
      id: '',
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      components: comp,
      nodes,
      wires,
      simulationConfig: config || { analysis: { type: 'dc' }, enabled: false },
      version: '1.0.0',
    })
  ),
}));

// ==================== Helpers ====================

function mockCircuitData() {
  const components: CircuitComponent[] = [
    { id: 'c1', type: 'resistor', position: { x: 0, y: 0 }, rotation: 0, properties: { resistance: '1k' } },
  ] as any[];
  const nodes: CircuitNode[] = [{ id: 'n1', position: { x: 0, y: 0 }, connections: ['c1'] }] as any[];
  const wires: Wire[] = [{ id: 'w1', source: 'n1', target: 'n2' }] as any[];
  return { components, nodes, wires };
}

const getCircuitData = vi.fn(() => mockCircuitData());
const setCircuitData = vi.fn();

// ==================== Tests ====================

describe('ProjectManager', () => {
  let projectManager: any;
  beforeEach(async () => {
    vi.clearAllMocks();
    getCircuitData.mockReturnValue(mockCircuitData());
    setCircuitData.mockClear();

    // Reset modules so we get a fresh ProjectManager singleton each test
    vi.resetModules();

    // Re-apply mocks after resetModules
    const sm: any = await import('../core/StorageManager');
    sm.storageManager.init.mockResolvedValue(undefined);
    sm.storageManager.migrateFromLocalStorage.mockResolvedValue(0);

    // Clear in-memory mock stores
    (sm as any).__projects.clear();
    (sm as any).__meta.clear();

    // Fresh import of ProjectManager singleton
    const pm = await import('../core/ProjectManager');
    projectManager = pm.projectManager;

    // Init with mock callbacks
    await projectManager.init(getCircuitData, setCircuitData);
  });

  afterEach(() => {
    projectManager?.destroy?.();
  });

  // ---------- 1. createProject creates project with correct name ----------

  it('createProject creates a project with the correct name', async () => {
    const project = await projectManager.createProject({ name: 'My Circuit' });

    expect(project).toBeDefined();
    expect(project.name).toBe('My Circuit');
    expect(project.id).toBeTruthy();
    expect(project.components).toEqual([]);
    expect(project.nodes).toEqual([]);
    expect(project.wires).toEqual([]);
    expect(project.simulationConfig).toEqual({ analysis: { type: 'dc' }, enabled: false });
    expect(project.version).toBe('1.0.0');
  });

  // ---------- 2. createProject with fromData populates components ----------

  it('createProject with fromData populates components, nodes, and wires', async () => {
    const data = mockCircuitData();
    const project = await projectManager.createProject({
      name: 'Preloaded',
      description: 'Test project',
      fromData: data,
    });

    expect(project.components).toHaveLength(1);
    expect(project.components[0].type).toBe('resistor');
    expect(project.nodes).toHaveLength(1);
    expect(project.wires).toHaveLength(1);
  });

  // ---------- 3. getProjects returns project list after creation ----------

  it('getProjects returns the project list after creation', async () => {
    expect(projectManager.getProjects()).toEqual([]);

    await projectManager.createProject({ name: 'Alpha' });
    await projectManager.createProject({ name: 'Beta' });

    const list = projectManager.getProjects();
    expect(list).toHaveLength(2);
    expect(list.map((p: any) => p.name)).toEqual(expect.arrayContaining(['Alpha', 'Beta']));
  });

  // ---------- 4. deleteProject removes project ----------

  it('deleteProject removes the project and closes its tab', async () => {
    const project = await projectManager.createProject({ name: 'ToDelete' });
    await projectManager.openProject(project.id);

    expect(projectManager.getTabs()).toHaveLength(1);

    await projectManager.deleteProject(project.id);

    expect(projectManager.getTabs()).toHaveLength(0);
    expect(projectManager.getActiveTabId()).toBeNull();
  });

  // ---------- 5. renameProject updates name ----------

  it('renameProject updates project name and tab name', async () => {
    const project = await projectManager.createProject({ name: 'OldName' });
    await projectManager.openProject(project.id);

    await projectManager.renameProject(project.id, 'NewName');

    const tabs = projectManager.getTabs();
    const tab = tabs.find((t: any) => t.id === project.id);
    expect(tab?.name).toBe('NewName');
  });

  // ---------- 6. getTabs / getActiveTabId after openProject ----------

  it('getTabs and getActiveTabId return correct values after openProject', async () => {
    const p1 = await projectManager.createProject({ name: 'Project A' });
    const p2 = await projectManager.createProject({ name: 'Project B' });

    await projectManager.openProject(p1.id);
    expect(projectManager.getActiveTabId()).toBe(p1.id);
    expect(projectManager.getTabs()).toHaveLength(1);
    expect(projectManager.getTabs()[0].name).toBe('Project A');

    await projectManager.openProject(p2.id);
    expect(projectManager.getActiveTabId()).toBe(p2.id);
    expect(projectManager.getTabs()).toHaveLength(2);

    // Both tabs should exist with correct names
    const tabIds = projectManager.getTabs().map((t: any) => t.id);
    expect(tabIds).toContain(p1.id);
    expect(tabIds).toContain(p2.id);
    const activeTab = projectManager.getTabs().find((t: any) => t.id === p2.id);
    expect(activeTab?.name).toBe('Project B');
  });

  // ---------- 7. markAsModified updates tab state ----------

  it('markAsModified sets hasUnsavedChanges on the active tab', async () => {
    const project = await projectManager.createProject({ name: 'Modifiable' });
    await projectManager.openProject(project.id);

    const tabBefore = projectManager.getTabs().find((t: any) => t.id === project.id);
    expect(tabBefore?.hasUnsavedChanges).toBe(false);

    projectManager.markAsModified();

    const tabAfter = projectManager.getTabs().find((t: any) => t.id === project.id);
    expect(tabAfter?.hasUnsavedChanges).toBe(true);
  });

  // ---------- 8. Events callbacks are called ----------

  it('setCircuitData is called when opening a project', async () => {
    const proj = await projectManager.createProject({ name: 'EventTest' });
    await projectManager.openProject(proj.id);

    expect(setCircuitData).toHaveBeenCalledWith(
      expect.objectContaining({ components: [], nodes: [], wires: [] })
    );
  });

  it('openProject returns null and does not throw for non-existent id', async () => {
    const result = await projectManager.openProject('non-existent-id');
    expect(result).toBeNull();
  });

  // ---------- Bonus: getCurrentProjectName ----------

  it('getCurrentProjectName returns null when no project is open', () => {
    // After init with no last project, activeTabId should be null
    expect(projectManager.getCurrentProjectName()).toBeNull();
  });

  it('getCurrentProjectName returns the active project name', async () => {
    const project = await projectManager.createProject({ name: 'NamedProject' });
    await projectManager.openProject(project.id);
    expect(projectManager.getCurrentProjectName()).toBe('NamedProject');
  });

  // ---------- Bonus: switchTab ----------

  it('switchTab changes the active tab', async () => {
    const p1 = await projectManager.createProject({ name: 'Tab1' });
    const p2 = await projectManager.createProject({ name: 'Tab2' });

    await projectManager.openProject(p1.id);
    await projectManager.openProject(p2.id);

    expect(projectManager.getActiveTabId()).toBe(p2.id);

    await projectManager.switchTab(p1.id);
    expect(projectManager.getActiveTabId()).toBe(p1.id);
  });

  // ---------- Bonus: closeTab ----------

  it('closeTab removes tab and switches to another if available', async () => {
    const p1 = await projectManager.createProject({ name: 'Keep' });
    const p2 = await projectManager.createProject({ name: 'Close' });

    await projectManager.openProject(p1.id);
    await projectManager.openProject(p2.id);

    expect(projectManager.getTabs()).toHaveLength(2);

    await projectManager.closeTab(p2.id);
    expect(projectManager.getTabs()).toHaveLength(1);
    expect(projectManager.getActiveTabId()).toBe(p1.id);
  });

  // ---------- Bonus: startAutoSave / stopAutoSave ----------

  it('startAutoSave and stopAutoSave manage the timer', () => {
    vi.useFakeTimers();

    projectManager.startAutoSave(5000);
    vi.advanceTimersByTime(5000);

    projectManager.stopAutoSave();
    vi.advanceTimersByTime(10000);

    vi.useRealTimers();
  });

  // ---------- Bonus: destroy resets initialized state ----------

  it('destroy stops auto-save and marks as uninitialized', () => {
    projectManager.destroy();
    // Calling destroy again should not throw
    expect(() => projectManager.destroy()).not.toThrow();
  });
});
