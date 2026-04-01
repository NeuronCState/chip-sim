/**
 * 电路状态管理 Store
 * 使用 Zustand 管理电路拓扑、元件选择、仿真参数等全局状态
 */

import { create } from 'zustand';
import type {
  CircuitComponent,
  CircuitNode,
  Wire,
  ViewTransform,
  ToolMode,
  WirePreview,
  WireRouting,
  ValidationMessage,
  Rotation,
  BoxSelectRect,
  Point,
  CanvasNetLabel,
} from '../types/circuit';
import type { SimulationResult } from '../types/circuit';
import {
  generateId,
  createComponent,
  getPortAbsolutePosition,
  snapToGrid,
} from '../lib/circuit/circuit-utils';
import { ComponentType, WireStatus, NetLabelKind } from '../types/circuit';
import { calculateWirePoints, routeSmartWire } from '../lib/circuit/wire-routing';
import { autoConnectComponents, autoConnectNetLabels, autoConnectPowerNets, NetManager } from '../lib/circuit/NetManager';
import { beautifyWires, type BeautifyConfig, DEFAULT_BEAUTIFY_CONFIG } from '../lib/circuit/WireBeautifier';
import { toValidationMessages } from '../lib/circuit/CircuitDRC';
import { diagnosticEngine } from '../lib/circuit/DiagnosticEngine';
import {
  serializeProject,
  downloadJson,
  loadJsonFile,
  saveToLocalStorage,
  loadFromLocalStorage,
} from '../lib/circuit/serialization';
import { toast } from './ui-store';
import { CleanupManager } from '../core/memory';
import { getAllTemplates, createTemplateFromProject, saveUserTemplate } from '../core/ProjectTemplates';

const AUTOSAVE_KEY = 'chip-sim-autosave';
const PROJECT_INDEX_KEY = 'chip-sim-project-index';
const PROJECT_DATA_PREFIX = 'chip-sim-project-';

// 历史记录压缩器和清理管理器
const cleanupManager = new CleanupManager();

// ==================== 工程索引类型 ====================

interface ProjectMeta {
  id: string;
  name: string;
  updatedAt: string;
  componentCount: number;
  starred?: boolean;
}

interface ProjectIndex {
  projects: ProjectMeta[];
}

// ==================== Undo/Redo ====================

interface Snapshot {
  components: CircuitComponent[];
  nodes: CircuitNode[];
  wires: Wire[];
}

function takeSnapshot(state: { components: CircuitComponent[]; nodes: CircuitNode[]; wires: Wire[] }): Snapshot {
  return {
    components: JSON.parse(JSON.stringify(state.components)),
    nodes: JSON.parse(JSON.stringify(state.nodes)),
    wires: JSON.parse(JSON.stringify(state.wires)),
  };
}

const MAX_UNDO = 50;

// ==================== 主题 ====================

export type Theme = 'dark' | 'light';

// ==================== Store 接口 ====================

/** 电路 Store 状态 */
interface CircuitStore {
  // === 数据 ===
  components: CircuitComponent[];
  nodes: CircuitNode[];
  wires: Wire[];
  selectedComponentId: string | null;
  selectedWireId: string | null;
  selectedComponentIds: Set<string>;

  // === 多工程管理 ===
  projects: ProjectMeta[];
  currentProjectId: string | null;
  _readProjectIndex: () => ProjectIndex;
  _writeProjectIndex: (index: ProjectIndex) => void;

  // === 画布 ===
  toolMode: ToolMode;
  viewTransform: ViewTransform;
  gridSize: number;
  snapToGrid: boolean;
  showGrid: boolean;

  // === 连线 ===
  wirePreview: WirePreview | null;
  wireRouting: WireRouting;

  // === 框选 ===
  boxSelectRect: BoxSelectRect | null;

  // === 验证 ===
  validationMessages: ValidationMessage[];

  // === 仿真 ===
  simulationResult: SimulationResult | null;
  isSimulating: boolean;
  /** 仿真速度倍率 (0.25, 0.5, 1, 2, 4) */
  simSpeed: number;
  /** 仿真是否暂停 */
  isSimPaused: boolean;
  /** 单步执行请求 */
  stepRequested: boolean;
  setSimSpeed: (speed: number) => void;
  setIsSimPaused: (paused: boolean) => void;
  requestStep: () => void;

  // === 主题 ===
  theme: Theme;

  // === Undo/Redo ===
  undoStack: Snapshot[];
  redoStack: Snapshot[];

  // === 剪贴板 ===
  clipboard: { components: CircuitComponent[]; wires: Wire[] };
  showShortcutsHelp: boolean;

  // === 鼠标位置（状态栏用） ===
  mouseCanvasPos: { x: number; y: number };

  // === 画布尺寸（由 resize handler 更新） ===
  canvasW: number;
  canvasH: number;
  setCanvasSize: (w: number, h: number) => void;

  // === 渲染器模式 ===
  rendererMode: 'webgl' | 'canvas2d';
  setRendererMode: (mode: 'webgl' | 'canvas2d') => void;

  // === 加载/错误状态 ===
  wsError: string | null;
  simLoading: boolean;
  /** 大型电路操作 loading 状态（批量删除、复杂布线等） */
  bulkOperationLoading: boolean;
  bulkOperationMessage: string | null;

  // === 操作：元件 ===
  addComponent: (type: ComponentType, name: string, x: number, y: number) => void;
  removeComponent: (id: string) => void;
  selectComponent: (id: string | null) => void;
  selectComponentMulti: (id: string) => void;
  clearSelection: () => void;
  moveComponent: (id: string, x: number, y: number) => void;
  moveSelectedComponents: (dx: number, dy: number) => void;
  rotateComponent: (id: string) => void;
  rotateSelected: () => void;
  flipSelected: () => void;
  updateComponentValue: (id: string, value: number, unit?: string) => void;
  updateComponentName: (id: string, name: string) => void;
  updateComponentParams: (id: string, params: Record<string, number | string>) => void;

  // === 操作：节点 ===
  addNode: (name: string, x: number, y: number) => void;
  removeNode: (id: string) => void;

  // === 操作：连线 ===
  startWire: (componentId: string, portId: string) => void;
  updateWirePreview: (mouseX: number, mouseY: number) => void;
  endWire: (componentId: string, portId: string) => void;
  cancelWire: () => void;
  addWire: (fromComponentId: string, fromPortId: string, toComponentId: string, toPortId: string) => void;
  removeWire: (id: string) => void;
  selectWire: (id: string | null) => void;
  setWireRouting: (routing: WireRouting) => void;

  // === 操作：智能连线和自动布线 ===
  autoRouteSelected: () => void;
  autoRoutePowerNets: () => void;
  beautifyAllWires: (config?: Partial<BeautifyConfig>) => void;
  highlightNet: (netName: string | null) => void;
  highlightedNetWires: string[];

  // === 操作：网络标签 ===
  netLabels: CanvasNetLabel[];
  selectedNetLabelId: string | null;
  addNetLabel: (name: string, x: number, y: number, portInfo?: { componentId: string; portId: string }) => void;
  removeNetLabel: (id: string) => void;
  updateNetLabelPosition: (id: string, x: number, y: number) => void;
  renameNetLabel: (id: string, name: string) => void;
  selectNetLabel: (id: string | null) => void;
  autoConnectNetLabels: () => void;

  // === 操作：画布 ===
  setToolMode: (mode: ToolMode) => void;
  setViewTransform: (transform: Partial<ViewTransform>) => void;
  setSnapToGrid: (enabled: boolean) => void;
  setShowGrid: (show: boolean) => void;
  setMouseCanvasPos: (x: number, y: number) => void;
  fitToScreen: () => void;

  // === 框选 ===
  startBoxSelect: (x: number, y: number) => void;
  updateBoxSelect: (x: number, y: number) => void;
  endBoxSelect: () => void;

  // === 操作：仿真 ===
  setSimulationResult: (result: SimulationResult | null) => void;
  setIsSimulating: (running: boolean) => void;
  setWsError: (error: string | null) => void;
  setSimLoading: (loading: boolean) => void;
  setBulkOperationLoading: (loading: boolean, message?: string) => void;

  // === 操作：验证 ===
  runValidation: () => void;

  // === 操作：保存/加载 ===
  exportProject: (name: string) => void;
  importProject: () => Promise<void>;
  autoSave: () => void;
  loadAutoSave: () => boolean;

  // === 多工程管理 ===
  listProjects: () => void;
  createProject: (name: string) => void;
  openProject: (id: string) => void;
  saveProject: () => void;
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  duplicateProject: (sourceId: string) => void;

  // === 项目模板 ===
  createFromTemplate: (templateId: string, projectName: string) => void;
  saveAsTemplate: (name: string, description: string) => void;

  // === 标签系统 ===
  addTag: (projectId: string, tag: string) => void;
  removeTag: (projectId: string, tag: string) => void;
  getAllTags: () => string[];

  // === 星标收藏 ===
  toggleStar: (projectId: string) => void;

  // === 增强搜索 ===
  searchProjects: (query: { search?: string; tags?: string[]; starred?: boolean }) => ProjectMeta[];

  // === Undo/Redo ===
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;

  // === 主题 ===
  toggleTheme: () => void;

  // === RLC 测试 ===
  loadRLCTestCircuit: () => void;

  // === 键盘快捷键 ===
  deleteSelected: () => void;

  // === 复制/粘贴/剪切 ===
  copySelected: () => void;
  cutSelected: () => void;
  paste: (offsetX?: number, offsetY?: number) => void;
  duplicate: () => void;
  selectAll: () => void;
  toggleShortcutsHelp: () => void;

  // === 模板加载状态（示例加载前置条件） ===
  templateLoaded: boolean;
  setTemplateLoaded: (loaded: boolean) => void;

  // === 重置 ===
  reset: () => void;
}

const initialState = {
  components: [] as CircuitComponent[],
  nodes: [] as CircuitNode[],
  wires: [] as Wire[],
  selectedComponentId: null as string | null,
  selectedWireId: null as string | null,
  selectedComponentIds: new Set<string>(),
  toolMode: 'select' as ToolMode,
  viewTransform: { scale: 1, offsetX: 0, offsetY: 0 },
  gridSize: 20,
  snapToGrid: true,
  showGrid: true,
  wirePreview: null as WirePreview | null,
  wireRouting: 'orthogonal' as WireRouting,
  highlightedNetWires: [] as string[],
  netLabels: [] as CanvasNetLabel[],
  selectedNetLabelId: null as string | null,
  boxSelectRect: null as BoxSelectRect | null,
  validationMessages: [] as ValidationMessage[],
  simulationResult: null as SimulationResult | null,
  isSimulating: false,
  simSpeed: 1,
  isSimPaused: false,
  stepRequested: false,
  theme: 'dark' as Theme,
  undoStack: [] as Snapshot[],
  redoStack: [] as Snapshot[],
  clipboard: { components: [], wires: [] } as { components: CircuitComponent[]; wires: Wire[] },
  showShortcutsHelp: false,
  mouseCanvasPos: { x: 0, y: 0 },
  canvasW: 800,
  canvasH: 600,
  wsError: null as string | null,
  simLoading: false,
  bulkOperationLoading: false,
  bulkOperationMessage: null as string | null,
  // 渲染器模式
  rendererMode: 'webgl' as 'webgl' | 'canvas2d',
  // 多工程管理
  projects: [] as ProjectMeta[],
  currentProjectId: null as string | null,
  // 模板加载状态
  templateLoaded: false,
};

export const useCircuitStore = create<CircuitStore>((set, get) => ({
  ...initialState,

  // ==================== Undo/Redo ====================

  pushUndo: () => {
    const state = get();
    const snapshot = takeSnapshot(state);
    set((s) => ({
      undoStack: [...s.undoStack.slice(-MAX_UNDO + 1), snapshot],
      redoStack: [],
    }));
  },

  undo: () => {
    const state = get();
    if (state.undoStack.length === 0) return;
    const prev = state.undoStack[state.undoStack.length - 1];
    const currentSnapshot = takeSnapshot(state);
    set({
      components: prev.components,
      nodes: prev.nodes,
      wires: prev.wires,
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, currentSnapshot],
      selectedComponentId: null,
      selectedWireId: null,
      selectedComponentIds: new Set(),
    });
  },

  redo: () => {
    const state = get();
    if (state.redoStack.length === 0) return;
    const next = state.redoStack[state.redoStack.length - 1];
    const currentSnapshot = takeSnapshot(state);
    set({
      components: next.components,
      nodes: next.nodes,
      wires: next.wires,
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, currentSnapshot],
      selectedComponentId: null,
      selectedWireId: null,
      selectedComponentIds: new Set(),
    });
  },

  // ==================== 主题 ====================

  toggleTheme: () => {
    set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' }));
  },

  // ==================== 元件操作 ====================

  addComponent: (type, name, x, y) => {
    get().pushUndo();
    const state = get();
    const pos = state.snapToGrid ? snapToGrid(x, y, state.gridSize) : { x, y };

    let ports: { offset: Point }[];
    let defaultValue: number;
    let unit: string;

    switch (type) {
      case ComponentType.Ground:
        ports = [{ offset: { x: 0, y: -15 } }];
        defaultValue = 0;
        unit = 'V';
        break;
      // 二极管：2端口（阳极、阴极）
      case ComponentType.Diode:
        ports = [
          { offset: { x: -25, y: 0 } },  // 阳极
          { offset: { x: 25, y: 0 } },   // 阴极
        ];
        defaultValue = 0.7;
        unit = 'V';
        break;
      // BJT NPN/PNP：3端口（基极、集电极、发射极）
      case ComponentType.BJTNPN:
      case ComponentType.BJTPNP:
        ports = [
          { offset: { x: 0, y: -20 } },   // 基极 (Base)
          { offset: { x: 20, y: 0 } },    // 集电极 (Collector)
          { offset: { x: 20, y: 20 } },   // 发射极 (Emitter)
        ];
        defaultValue = 100;
        unit = 'β';
        break;
      // MOSFET：3端口（栅极、漏极、源极）
      case ComponentType.MOSFET_NMOS:
      case ComponentType.MOSFET_PMOS:
        ports = [
          { offset: { x: 0, y: -20 } },   // 栅极 (Gate)
          { offset: { x: 20, y: 0 } },    // 漏极 (Drain)
          { offset: { x: 20, y: 20 } },   // 源极 (Source)
        ];
        defaultValue = 1;
        unit = 'mA/V²';
        break;
      // JFET：3端口（栅极、漏极、源极）
      case ComponentType.JFET_N:
      case ComponentType.JFET_P:
        ports = [
          { offset: { x: 0, y: -20 } },   // 栅极 (Gate)
          { offset: { x: 20, y: 0 } },    // 漏极 (Drain)
          { offset: { x: 20, y: 20 } },   // 源极 (Source)
        ];
        defaultValue = 10;
        unit = 'mA';
        break;
      // IGBT：3端口（栅极、集电极、发射极）
      case ComponentType.IGBT:
        ports = [
          { offset: { x: 0, y: -20 } },   // 栅极 (Gate)
          { offset: { x: 20, y: 0 } },    // 集电极 (Collector)
          { offset: { x: 20, y: 20 } },   // 发射极 (Emitter)
        ];
        defaultValue = 200;
        unit = 'β';
        break;
      // 达林顿管：3端口（基极、集电极、发射极）
      case ComponentType.DarlingtonNPN:
      case ComponentType.DarlingtonPNP:
        ports = [
          { offset: { x: 0, y: -20 } },   // 基极 (Base)
          { offset: { x: 20, y: 0 } },    // 集电极 (Collector)
          { offset: { x: 20, y: 20 } },   // 发射极 (Emitter)
        ];
        defaultValue = 1000;
        unit = 'β';
        break;
      // 运放：3端口（正输入、负输入、输出）
      case ComponentType.OpAmp:
        ports = [
          { offset: { x: -25, y: -10 } },  // 正输入 (+)
          { offset: { x: -25, y: 10 } },   // 负输入 (-)
          { offset: { x: 25, y: 0 } },     // 输出
        ];
        defaultValue = 100000;
        unit = 'A/V';
        break;
      // NOT门：2端口（输入、输出）
      case ComponentType.LogicNOT:
        ports = [
          { offset: { x: -25, y: 0 } },   // 输入
          { offset: { x: 25, y: 0 } },    // 输出
        ];
        defaultValue = 0;
        unit = '';
        break;
      // AND/OR/NAND/NOR/XOR：3端口（输入A、输入B、输出）
      case ComponentType.LogicAND:
      case ComponentType.LogicOR:
      case ComponentType.LogicNAND:
      case ComponentType.LogicNOR:
      case ComponentType.LogicXOR:
        ports = [
          { offset: { x: -25, y: -10 } },  // 输入A
          { offset: { x: -25, y: 10 } },   // 输入B
          { offset: { x: 25, y: 0 } },     // 输出
        ];
        defaultValue = 0;
        unit = '';
        break;
      // === 通信协议元件 ===
      // SPI Master: SCLK, MOSI, MISO, CS
      case ComponentType.SPIMaster:
        ports = [
          { offset: { x: 25, y: -15 } },   // SCLK
          { offset: { x: 25, y: -5 } },    // MOSI
          { offset: { x: 25, y: 5 } },     // MISO
          { offset: { x: 25, y: 15 } },    // CS
        ];
        defaultValue = 1000000;
        unit = 'Hz';
        break;
      // SPI Slave: SCLK, MOSI, MISO, CS
      case ComponentType.SPISlave:
        ports = [
          { offset: { x: -25, y: -15 } },  // SCLK
          { offset: { x: -25, y: -5 } },   // MOSI
          { offset: { x: -25, y: 5 } },    // MISO
          { offset: { x: -25, y: 15 } },   // CS
        ];
        defaultValue = 0;
        unit = '';
        break;
      // I2C Master: SCL, SDA
      case ComponentType.I2CMaster:
        ports = [
          { offset: { x: 25, y: -5 } },    // SCL
          { offset: { x: 25, y: 5 } },     // SDA
        ];
        defaultValue = 100000;
        unit = 'Hz';
        break;
      // I2C Slave: SCL, SDA
      case ComponentType.I2CSlave:
        ports = [
          { offset: { x: -25, y: -5 } },   // SCL
          { offset: { x: -25, y: 5 } },    // SDA
        ];
        defaultValue = 0;
        unit = '';
        break;
      // UART TX: TX
      case ComponentType.UARTTX:
        ports = [
          { offset: { x: 25, y: 0 } },     // TX
        ];
        defaultValue = 115200;
        unit = 'bps';
        break;
      // UART RX: RX
      case ComponentType.UARTRX:
        ports = [
          { offset: { x: -25, y: 0 } },    // RX
        ];
        defaultValue = 115200;
        unit = 'bps';
        break;
      // ADC 元件: 模拟输入、时钟、数字输出、接地
      case ComponentType.ADC:
        ports = [
          { offset: { x: -25, y: -10 } },   // 模拟输入 (AIN)
          { offset: { x: -25, y: 10 } },    // 采样时钟 (CLK)
          { offset: { x: 25, y: -10 } },    // 数字输出 (DOUT)
          { offset: { x: 25, y: 10 } },     // 接地参考 (GND)
        ];
        defaultValue = 3.3;
        unit = 'V';
        break;
      // DAC 元件: 数字输入、模拟输出、接地
      case ComponentType.DAC:
        ports = [
          { offset: { x: -25, y: -10 } },   // 数字输入 (DIN)
          { offset: { x: 25, y: -10 } },    // 模拟输出 (AOUT)
          { offset: { x: 25, y: 10 } },     // 接地参考 (GND)
        ];
        defaultValue = 3.3;
        unit = 'V';
        break;
      // MCU 元件：根据 params.pinCount 创建引脚（默认 16）
      case ComponentType.MCU: {
        const pinCount = 16; // 默认 16 引脚
        const cols = 4; // 每侧引脚列数
        const rows = Math.ceil(pinCount / cols);
        const pinSpacing = 20;
        const mcuW = 60;
        const pins: { offset: Point }[] = [];
        for (let i = 0; i < pinCount; i++) {
          const side = i < pinCount / 2 ? 'left' : 'right';
          const localIdx = side === 'left' ? i : i - pinCount / 2;
          const rowOffset = (localIdx - (rows - 1) / 2) * pinSpacing;
          if (side === 'left') {
            pins.push({ offset: { x: -mcuW / 2 - 10, y: rowOffset } });
          } else {
            pins.push({ offset: { x: mcuW / 2 + 10, y: rowOffset } });
          }
        }
        ports = pins;
        defaultValue = 3.3;
        unit = 'V';
        break;
      }
      // LDO 稳压器：3端口（Vin, Vout, GND）
      case ComponentType.LDO:
        ports = [
          { offset: { x: -25, y: -10 } },  // Vin (input)
          { offset: { x: 25, y: -10 } },   // Vout (output)
          { offset: { x: 0, y: 20 } },     // GND
        ];
        defaultValue = 3.3;
        unit = 'V';
        break;
      // === 测量探针 ===
      case ComponentType.VoltageProbe:
        ports = [{ offset: { x: 0, y: 25 } }];
        defaultValue = 0;
        unit = 'V';
        break;
      case ComponentType.CurrentProbe:
        ports = [{ offset: { x: 0, y: 25 } }];
        defaultValue = 0;
        unit = 'A';
        break;
      case ComponentType.PowerProbe:
        ports = [{ offset: { x: 0, y: 25 } }];
        defaultValue = 0;
        unit = 'W';
        break;
      // 555 定时器：8 引脚（GND, TRG, OUT, RST, CTL, THR, DIS, VCC）
      case ComponentType.Timer555:
        ports = [
          { offset: { x: -25, y: -12 } },  // GND (pin 1)
          { offset: { x: -25, y: -4 } },   // TRG (pin 2)
          { offset: { x: 25, y: 0 } },     // OUT (pin 3)
          { offset: { x: 25, y: -10 } },   // RST (pin 4)
          { offset: { x: 25, y: 10 } },    // CTL (pin 5)
          { offset: { x: -25, y: 4 } },    // THR (pin 6)
          { offset: { x: -25, y: 12 } },   // DIS (pin 7)
          { offset: { x: 25, y: 18 } },    // VCC (pin 8)
        ];
        defaultValue = 5;
        unit = 'V';
        break;
      // 三端稳压器 7805/7812：3 引脚（IN, GND, OUT）
      case ComponentType.VoltageRegulator7805:
      case ComponentType.VoltageRegulator7812:
        ports = [
          { offset: { x: -25, y: 0 } },    // IN
          { offset: { x: 0, y: 20 } },     // GND
          { offset: { x: 25, y: 0 } },     // OUT
        ];
        defaultValue = type === ComponentType.VoltageRegulator7805 ? 5 : 12;
        unit = 'V';
        break;
      // 光电耦合器：4 引脚（A, K, C, E）
      case ComponentType.Optocoupler:
        ports = [
          { offset: { x: -25, y: -8 } },   // LED 阳极 (A)
          { offset: { x: -25, y: 8 } },    // LED 阴极 (K)
          { offset: { x: 25, y: -8 } },    // 集电极 (C)
          { offset: { x: 25, y: 8 } },     // 发射极 (E)
        ];
        defaultValue = 0;
        unit = 'CTR%';
        break;
      // 继电器：5 引脚（COIL+, COIL-, NO, NC, COM）
      case ComponentType.Relay:
        ports = [
          { offset: { x: -25, y: -8 } },   // COIL+
          { offset: { x: -25, y: 8 } },    // COIL-
          { offset: { x: 25, y: -12 } },   // NO
          { offset: { x: 25, y: 0 } },     // COM
          { offset: { x: 25, y: 12 } },    // NC
        ];
        defaultValue = 5;
        unit = 'V';
        break;
      default:
        // 原有元件：Resistor, Capacitor, Inductor, DC/AC Source, VoltageSource, CurrentSource
        ports = [
          { offset: { x: -25, y: 0 } },
          { offset: { x: 25, y: 0 } },
        ];
        defaultValue =
          type === ComponentType.Resistor ? 1000
            : type === ComponentType.Capacitor ? 1e-6
            : type === ComponentType.Inductor ? 1e-3
            : 5;
        unit =
          type === ComponentType.Resistor ? 'Ω'
            : type === ComponentType.Capacitor ? 'F'
            : type === ComponentType.Inductor ? 'H'
            : 'V';
        break;
    }

    const component = createComponent(type, name, pos, defaultValue, unit, ports);

    set((s) => ({
      components: [...s.components, component],
      selectedComponentId: component.id,
      selectedComponentIds: new Set([component.id]),
    }));

    get().autoSave();
  },

  removeComponent: (id) => {
    get().pushUndo();
    set((state) => {
      const newWires = state.wires.filter(
        (w) => w.fromComponentId !== id && w.toComponentId !== id
      );
      const newSelected = new Set(state.selectedComponentIds);
      newSelected.delete(id);
      return {
        components: state.components.filter((c) => c.id !== id),
        wires: newWires,
        selectedComponentId:
          state.selectedComponentId === id ? null : state.selectedComponentId,
        selectedComponentIds: newSelected,
      };
    });
    get().autoSave();
  },

  selectComponent: (id) =>
    set({ selectedComponentId: id, selectedWireId: null, selectedComponentIds: id ? new Set([id]) : new Set() }),

  selectComponentMulti: (id) =>
    set((s) => {
      const newSet = new Set(s.selectedComponentIds);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return { selectedComponentIds: newSet, selectedComponentId: id, selectedWireId: null };
    }),

  clearSelection: () =>
    set({ selectedComponentId: null, selectedWireId: null, selectedComponentIds: new Set() }),

  moveComponent: (id, x, y) => {
    const state = get();
    const pos = state.snapToGrid ? snapToGrid(x, y, state.gridSize) : { x, y };
    set((s) => ({
      components: s.components.map((c) =>
        c.id === id ? { ...c, position: pos } : c
      ),
    }));
  },

  moveSelectedComponents: (dx, dy) => {
    const state = get();
    const ids = state.selectedComponentIds;
    if (ids.size === 0) return;
    // Move all selected components by the same delta (no per-component snapping to avoid collapse)
    set((s) => ({
      components: s.components.map((c) => {
        if (!ids.has(c.id)) return c;
        return { ...c, position: { x: c.position.x + dx, y: c.position.y + dy } };
      }),
    }));
  },

  rotateComponent: (id) => {
    get().pushUndo();
    set((state) => ({
      components: state.components.map((c) => {
        if (c.id !== id) return c;
        const nextRotation = ((c.rotation + 90) % 360) as Rotation;
        return { ...c, rotation: nextRotation };
      }),
    }));
    get().autoSave();
  },

  rotateSelected: () => {
    const state = get();
    if (state.selectedComponentIds.size === 0) return;
    get().pushUndo();
    const ids = state.selectedComponentIds;
    set((s) => ({
      components: s.components.map((c) => {
        if (!ids.has(c.id)) return c;
        return { ...c, rotation: ((c.rotation + 90) % 360) as Rotation };
      }),
    }));
    get().autoSave();
  },

  flipSelected: () => {
    const state = get();
    if (state.selectedComponentIds.size === 0) return;
    get().pushUndo();
    const ids = state.selectedComponentIds;
    set((s) => ({
      components: s.components.map((c) => {
        if (!ids.has(c.id)) return c;
        // 水平翻转：镜像端口 X 偏移 + 旋转 180°
        return {
          ...c,
          rotation: ((c.rotation + 180) % 360) as Rotation,
          ports: c.ports.map((p) => ({
            ...p,
            offset: { x: -p.offset.x, y: p.offset.y },
          })),
        };
      }),
    }));
    get().autoSave();
  },

  updateComponentValue: (id, value, unit) => {
    get().pushUndo();
    set((state) => ({
      components: state.components.map((c) =>
        c.id === id
          ? {
              ...c,
              value: {
                ...c.value,
                value,
                ...(unit ? { unit } : {}),
              },
            }
          : c
      ),
    }));
    get().autoSave();
  },

  updateComponentName: (id, name) => {
    get().pushUndo();
    set((state) => ({
      components: state.components.map((c) =>
        c.id === id ? { ...c, name } : c
      ),
    }));
    get().autoSave();
  },

  updateComponentParams: (id, params) => {
    get().pushUndo();
    set((state) => ({
      components: state.components.map((c) =>
        c.id === id ? { ...c, params: { ...c.params, ...params } } : c
      ),
    }));
    get().autoSave();
  },

  // ==================== 节点操作 ====================

  addNode: (name, x, y) => {
    const node: CircuitNode = {
      id: generateId(),
      name,
      type: 'normal',
      position: { x, y },
      connectedPorts: [],
    };
    set((state) => ({ nodes: [...state.nodes, node] }));
  },

  removeNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
    })),

  // ==================== 连线操作 ====================

  startWire: (componentId, portId) => {
    const state = get();
    const comp = state.components.find((c) => c.id === componentId);
    if (!comp) return;

    const portPos = getPortAbsolutePosition(comp, portId);
    if (!portPos) return;

    set({
      wirePreview: {
        fromComponentId: componentId,
        fromPortId: portId,
        fromPosition: portPos,
        mousePosition: portPos,
        routing: state.wireRouting,
      },
    });
  },

  updateWirePreview: (mouseX, mouseY) => {
    const state = get();
    if (!state.wirePreview) return;

    let snapTarget: WirePreview['snapTarget'] = undefined;
    for (const comp of state.components) {
      if (comp.id === state.wirePreview.fromComponentId) continue;

      for (const port of comp.ports) {
        const pos = getPortAbsolutePosition(comp, port.id);
        if (!pos) continue;
        const dist = Math.hypot(mouseX - pos.x, mouseY - pos.y);
        if (dist < 15) {
          snapTarget = {
            componentId: comp.id,
            portId: port.id,
            position: pos,
          };
          break;
        }
      }
      if (snapTarget) break;
    }

    set({
      wirePreview: {
        ...state.wirePreview,
        mousePosition: snapTarget ? snapTarget.position : { x: mouseX, y: mouseY },
        snapTarget,
      },
    });
  },

  endWire: (componentId, portId) => {
    const state = get();
    if (!state.wirePreview) return;

    if (
      state.wirePreview.fromComponentId === componentId &&
      state.wirePreview.fromPortId === portId
    ) {
      set({ wirePreview: null });
      return;
    }

    const exists = state.wires.some(
      (w) =>
        (w.fromPortId === state.wirePreview!.fromPortId &&
          w.toPortId === portId) ||
        (w.fromPortId === portId &&
          w.toPortId === state.wirePreview!.fromPortId)
    );

    if (exists) {
      set({ wirePreview: null });
      return;
    }

    get().addWire(
      state.wirePreview.fromComponentId,
      state.wirePreview.fromPortId,
      componentId,
      portId
    );

    set({ wirePreview: null });
  },

  cancelWire: () => set({ wirePreview: null }),

  addWire: (fromComponentId, fromPortId, toComponentId, toPortId) => {
    get().pushUndo();
    const state = get();
    const fromComp = state.components.find((c) => c.id === fromComponentId);
    const toComp = state.components.find((c) => c.id === toComponentId);
    if (!fromComp || !toComp) return;

    const fromPos = getPortAbsolutePosition(fromComp, fromPortId);
    const toPos = getPortAbsolutePosition(toComp, toPortId);
    if (!fromPos || !toPos) return;

    // 使用智能路由（带障碍物避让）
    let points = routeSmartWire(
      fromPos,
      toPos,
      state.components,
      fromComponentId,
      toComponentId
    );

    // 如果智能路由失败，回退到简单正交路径
    if (points.length < 2) {
      points = calculateWirePoints(fromPos, toPos, state.wireRouting);
    }

    const wire: Wire = {
      id: generateId(),
      fromComponentId,
      fromPortId,
      toComponentId,
      toPortId,
      points,
      status: WireStatus.Connected,
    };

    set((s) => ({ wires: [...s.wires, wire] }));
    get().autoSave();
  },

  removeWire: (id) => {
    get().pushUndo();
    set((state) => ({
      wires: state.wires.filter((w) => w.id !== id),
      selectedWireId: state.selectedWireId === id ? null : state.selectedWireId,
    }));
    get().autoSave();
  },

  selectWire: (id) => set({ selectedWireId: id, selectedComponentId: null, selectedComponentIds: new Set() }),

  setWireRouting: (routing) => {
    set({ wireRouting: routing });
    const state = get();
    const newWires = state.wires.map((wire) => {
      const fromComp = state.components.find((c) => c.id === wire.fromComponentId);
      const toComp = state.components.find((c) => c.id === wire.toComponentId);
      if (!fromComp || !toComp) return wire;

      const fromPos = getPortAbsolutePosition(fromComp, wire.fromPortId);
      const toPos = getPortAbsolutePosition(toComp, wire.toPortId);
      if (!fromPos || !toPos) return wire;

      // 使用智能路由
      const smartPoints = routeSmartWire(
        fromPos,
        toPos,
        state.components,
        wire.fromComponentId,
        wire.toComponentId
      );

      return {
        ...wire,
        points: smartPoints.length >= 2 ? smartPoints : calculateWirePoints(fromPos, toPos, routing),
      };
    });
    set({ wires: newWires });
  },

  // ==================== 智能连线和自动布线 ====================

  autoRouteSelected: () => {
    const state = get();
    const ids = state.selectedComponentIds;
    if (ids.size < 2) {
      toast.error('请至少选中两个元件进行自动布线');
      return;
    }

    get().pushUndo();

    const selectedComps = state.components.filter(c => ids.has(c.id));
    let allWires: Wire[] = [];
    let totalFailed = 0;

    // 两两配对自动布线
    for (let i = 0; i < selectedComps.length; i++) {
      for (let j = i + 1; j < selectedComps.length; j++) {
        const result = autoConnectComponents(
          selectedComps[i],
          selectedComps[j],
          state.components,
          [...state.wires, ...allWires]
        );
        allWires.push(...result.wires);
        totalFailed += result.failed.length;
      }
    }

    if (allWires.length > 0) {
      set((s) => ({ wires: [...s.wires, ...allWires] }));
      toast.success(`自动布线完成：创建 ${allWires.length} 条连线`);
    } else {
      toast.warning('未找到可自动连接的端口对');
    }

    if (totalFailed > 0) {
      toast.warning(`${totalFailed} 个连接布线失败，需要手动处理`);
    }

    get().autoSave();
  },

  autoRoutePowerNets: () => {
    const state = get();
    get().pushUndo();

    const result = autoConnectPowerNets(state.components, state.wires);

    if (result.wires.length > 0) {
      set((s) => ({ wires: [...s.wires, ...result.wires] }));
      toast.success(`电源/地网络自动连接：创建 ${result.wires.length} 条连线`);
    } else {
      toast.info('没有需要自动连接的电源/地网络');
    }

    get().autoSave();
  },

  beautifyAllWires: (config) => {
    const state = get();
    get().pushUndo();

    set({ bulkOperationLoading: true, bulkOperationMessage: '正在整理连线...' });

    // 使用 requestAnimationFrame 确保 loading 状态显示
    requestAnimationFrame(() => {
      const finalConfig = { ...DEFAULT_BEAUTIFY_CONFIG, ...config };
      const result = beautifyWires(state.wires, state.components, finalConfig);

      if (result.changedCount > 0) {
        set({ wires: result.wires, bulkOperationLoading: false, bulkOperationMessage: null });
        toast.success(
          `连线整理完成：修改 ${result.changedCount} 条连线，消除 ${result.crossingsEliminated} 个交叉`
        );
      } else {
        set({ bulkOperationLoading: false, bulkOperationMessage: null });
        toast.info('连线布局已经很整齐，无需调整');
      }

      get().autoSave();
    });
  },

  highlightNet: (netName) => {
    const state = get();
    if (!netName) {
      set({ highlightedNetWires: [] });
      return;
    }

    const netManager = new NetManager();
    const wireIds = netManager.getNetWireIds(netName, state.wires);
    set({ highlightedNetWires: wireIds });
  },

  // ==================== 网络标签操作 ====================

  addNetLabel: (name, x, y, portInfo) => {
    get().pushUndo();
    const state = get();
    const pos = state.snapToGrid ? snapToGrid(x, y, state.gridSize) : { x, y };

    // 自动判断标签类型
    const upperName = name.toUpperCase();
    let labelType: NetLabelKind = NetLabelKind.Signal;
    let isGlobal = false;

    if (['VCC', 'VDD', 'VSS', 'VEE', 'VPP', 'AVCC', 'AVDD', 'DVCC', 'DVDD'].includes(upperName)) {
      labelType = NetLabelKind.Power;
      isGlobal = true;
    } else if (['GND', 'AGND', 'DGND', 'PGND', 'GNDA', 'GNDD'].includes(upperName)) {
      labelType = NetLabelKind.Ground;
      isGlobal = true;
    } else if (name.includes('[') && name.includes(']')) {
      labelType = NetLabelKind.Bus;
    }

    const label: CanvasNetLabel = {
      id: generateId(),
      name,
      position: pos,
      connectedPort: portInfo,
      labelType,
      isGlobal,
    };

    set((s) => ({
      netLabels: [...s.netLabels, label],
      selectedNetLabelId: label.id,
    }));
    get().autoSave();
  },

  removeNetLabel: (id) => {
    get().pushUndo();
    set((s) => ({
      netLabels: s.netLabels.filter(l => l.id !== id),
      selectedNetLabelId: s.selectedNetLabelId === id ? null : s.selectedNetLabelId,
    }));
    get().autoSave();
  },

  updateNetLabelPosition: (id, x, y) => {
    const state = get();
    const pos = state.snapToGrid ? snapToGrid(x, y, state.gridSize) : { x, y };
    set((s) => ({
      netLabels: s.netLabels.map(l => l.id === id ? { ...l, position: pos } : l),
    }));
  },

  renameNetLabel: (id, name) => {
    get().pushUndo();
    set((s) => ({
      netLabels: s.netLabels.map(l => {
        if (l.id !== id) return l;
        const upperName = name.toUpperCase();
        let labelType: NetLabelKind = NetLabelKind.Signal;
        let isGlobal = false;
        if (['VCC', 'VDD', 'VSS', 'VEE', 'VPP', 'AVCC', 'AVDD', 'DVCC', 'DVDD'].includes(upperName)) {
          labelType = NetLabelKind.Power;
          isGlobal = true;
        } else if (['GND', 'AGND', 'DGND', 'PGND', 'GNDA', 'GNDD'].includes(upperName)) {
          labelType = NetLabelKind.Ground;
          isGlobal = true;
        } else if (name.includes('[') && name.includes(']')) {
          labelType = NetLabelKind.Bus;
        }
        return { ...l, name, labelType, isGlobal };
      }),
    }));
    get().autoSave();
  },

  selectNetLabel: (id) => set({ selectedNetLabelId: id, selectedComponentId: null, selectedWireId: null, selectedComponentIds: new Set() }),

  autoConnectNetLabels: () => {
    const state = get();
    if (state.netLabels.length < 2) {
      toast.info('至少需要两个网络标签才能自动连接');
      return;
    }

    get().pushUndo();

    // 转换为 NetManager 的格式
    const netManagerLabels = state.netLabels
      .filter(l => l.connectedPort)
      .map(l => ({
        id: l.id,
        name: l.name,
        position: l.position,
        connectedPort: l.connectedPort,
        type: l.labelType === NetLabelKind.Power ? 'power' as const
            : l.labelType === NetLabelKind.Ground ? 'ground' as const
            : l.labelType === NetLabelKind.Bus ? 'bus' as const
            : 'signal' as const,
        isGlobal: l.isGlobal,
      }));

    const result = autoConnectNetLabels(netManagerLabels as any, state.components, state.wires);

    if (result.wires.length > 0) {
      set((s) => ({ wires: [...s.wires, ...result.wires] }));
      toast.success(`网络标签自动连接：创建 ${result.wires.length} 条连线`);
    } else {
      toast.info('没有找到需要连接的同名网络标签');
    }

    if (result.failed.length > 0) {
      toast.warning(`${result.failed.length} 个连接布线失败`);
    }

    get().autoSave();
  },

  // ==================== 画布操作 ====================

  setToolMode: (mode) =>
    set({
      toolMode: mode,
      wirePreview: null,
      boxSelectRect: null,
    }),

  setViewTransform: (transform) =>
    set((state) => ({
      viewTransform: { ...state.viewTransform, ...transform },
    })),

  setSnapToGrid: (enabled) => set({ snapToGrid: enabled }),
  setShowGrid: (show) => set({ showGrid: show }),
  setMouseCanvasPos: (x, y) => set({ mouseCanvasPos: { x, y } }),
  setCanvasSize: (w, h) => set({ canvasW: w, canvasH: h }),
  setRendererMode: (mode) => set({ rendererMode: mode }),

  fitToScreen: () => {
    const state = get();
    const { components, canvasW, canvasH } = state;
    if (components.length === 0) {
      set({ viewTransform: { scale: 1, offsetX: 0, offsetY: 0 } });
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of components) {
      if (c.position.x - 40 < minX) minX = c.position.x - 40;
      if (c.position.y - 30 < minY) minY = c.position.y - 30;
      if (c.position.x + 40 > maxX) maxX = c.position.x + 40;
      if (c.position.y + 30 > maxY) maxY = c.position.y + 30;
    }
    const contentW = maxX - minX || 1;
    const contentH = maxY - minY || 1;
    const scale = Math.min(canvasW / contentW, canvasH / contentH, 2);
    const offsetX = (canvasW - contentW * scale) / 2 - minX * scale;
    const offsetY = (canvasH - contentH * scale) / 2 - minY * scale;
    set({ viewTransform: { scale, offsetX, offsetY } });
  },

  // ==================== 框选 ====================

  startBoxSelect: (x, y) => {
    set({ boxSelectRect: { startX: x, startY: y, endX: x, endY: y } });
  },

  updateBoxSelect: (x, y) => {
    set((s) => {
      if (!s.boxSelectRect) return {};
      return { boxSelectRect: { ...s.boxSelectRect, endX: x, endY: y } };
    });
  },

  endBoxSelect: () => {
    const state = get();
    const rect = state.boxSelectRect;
    if (!rect) return;

    const x1 = Math.min(rect.startX, rect.endX);
    const y1 = Math.min(rect.startY, rect.endY);
    const x2 = Math.max(rect.startX, rect.endX);
    const y2 = Math.max(rect.startY, rect.endY);

    // Only select if box is large enough (>5px)
    if (x2 - x1 < 5 && y2 - y1 < 5) {
      set({ boxSelectRect: null });
      return;
    }

    const selected = new Set<string>();
    for (const c of state.components) {
      if (c.position.x >= x1 && c.position.x <= x2 && c.position.y >= y1 && c.position.y <= y2) {
        selected.add(c.id);
      }
    }

    // If Ctrl was held during box select, merge with existing selection
    // The useCanvas handler already skips clearSelection when Ctrl is held
    // So we merge here: if boxSelectRect exists and there are already selected items, add to them
    const existingIds = state.selectedComponentIds;
    if (existingIds.size > 0) {
      for (const id of existingIds) {
        selected.add(id);
      }
    }

    set({ selectedComponentIds: selected, boxSelectRect: null });
  },

  // ==================== 仿真操作 ====================

  setSimulationResult: (result) => set({ simulationResult: result }),
  setIsSimulating: (running) => set({ isSimulating: running, isSimPaused: false, stepRequested: false }),
  setWsError: (error) => set({ wsError: error }),
  setSimLoading: (loading) => set({ simLoading: loading }),
  setBulkOperationLoading: (loading, message) => set({ bulkOperationLoading: loading, bulkOperationMessage: message ?? null }),
  setSimSpeed: (speed) => set({ simSpeed: speed }),
  setIsSimPaused: (paused) => set({ isSimPaused: paused }),
  requestStep: () => set({ stepRequested: true, isSimPaused: true }),

  // ==================== 验证 ====================

  runValidation: () => {
    const state = get();
    // 运行完整 DRC 检查
    const drcDiagnostics = diagnosticEngine.run(
      state.components,
      state.nodes,
      state.wires
    );
    // 转换为 ValidationMessage 格式（兼容现有验证面板）
    const messages = toValidationMessages(drcDiagnostics);
    set({ validationMessages: messages });
  },

  // ==================== 保存/加载 ====================

  exportProject: (name) => {
    const state = get();
    const project = serializeProject(
      name,
      state.components,
      state.nodes,
      state.wires
    );
    downloadJson(project);
  },

  importProject: async () => {
    try {
      const project = await loadJsonFile();
      get().pushUndo();
      set({
        components: project.components,
        nodes: project.nodes,
        wires: project.wires,
        selectedComponentId: null,
        selectedWireId: null,
        selectedComponentIds: new Set(),
      });
      get().autoSave();
    } catch (e) {
      console.error('导入失败:', e);
      toast.error('导入失败，请检查文件格式');
    }
  },

  autoSave: () => {
    const state = get();
    const project = serializeProject(
      'autosave',
      state.components,
      state.nodes,
      state.wires
    );
    saveToLocalStorage(AUTOSAVE_KEY, project);
    
    // 如果有当前工程，同时更新工程数据
    if (state.currentProjectId) {
      const index = (get() as any)._readProjectIndex();
      const meta = index.projects.find((p: ProjectMeta) => p.id === state.currentProjectId);
      const name = meta?.name || '未命名';
      const projectData = serializeProject(name, state.components, state.nodes, state.wires);
      saveToLocalStorage(`${PROJECT_DATA_PREFIX}${state.currentProjectId}`, projectData);
      
      // 更新索引中的元件数量和修改时间
      const now = new Date().toISOString();
      const updatedMeta: ProjectMeta = {
        id: state.currentProjectId,
        name,
        updatedAt: now,
        componentCount: state.components.length,
      };
      const newProjects = index.projects.map((p: ProjectMeta) =>
        p.id === state.currentProjectId ? updatedMeta : p
      );
      (get() as any)._writeProjectIndex({ projects: newProjects });
    }
  },

  loadAutoSave: () => {
    const project = loadFromLocalStorage(AUTOSAVE_KEY);
    if (!project) return false;
    set({
      components: project.components,
      nodes: project.nodes,
      wires: project.wires,
      selectedComponentId: null,
      selectedWireId: null,
      selectedComponentIds: new Set(),
    });
    return true;
  },

  // ==================== 多工程管理 ====================

  // 辅助函数：读取工程索引
  _readProjectIndex: (): ProjectIndex => {
    try {
      const json = localStorage.getItem(PROJECT_INDEX_KEY);
      if (!json) return { projects: [] };
      return JSON.parse(json) as ProjectIndex;
    } catch {
      return { projects: [] };
    }
  },

  // 辅助函数：写入工程索引
  _writeProjectIndex: (index: ProjectIndex): void => {
    try {
      localStorage.setItem(PROJECT_INDEX_KEY, JSON.stringify(index));
    } catch {
      console.warn('工程索引保存失败');
    }
  },

  listProjects: () => {
    const index = (get() as any)._readProjectIndex();
    set({ projects: index.projects });
  },

  createProject: (name) => {
    const state = get();
    // 如果当前有内容，先提示保存
    if (state.components.length > 0) {
      if (!confirm('创建新工程将清空当前内容，是否先保存当前工程？')) {
        // 用户取消，不创建
        return;
      }
      // 保存当前工程
      if (state.currentProjectId) {
        get().saveProject();
      }
    }

    const id = `proj-${Date.now().toString(36)}-${generateId().slice(0, 6)}`;
    const now = new Date().toISOString();
    const meta: ProjectMeta = {
      id,
      name,
      updatedAt: now,
      componentCount: 0,
    };

    // 更新索引
    const index = (get() as any)._readProjectIndex();
    index.projects.unshift(meta);
    (get() as any)._writeProjectIndex(index);

    // 保存空工程数据
    const project = serializeProject(name, [], [], []);
    saveToLocalStorage(`${PROJECT_DATA_PREFIX}${id}`, project);

    // 切换到新工程
    set({
      components: [],
      nodes: [],
      wires: [],
      selectedComponentId: null,
      selectedWireId: null,
      selectedComponentIds: new Set(),
      undoStack: [],
      redoStack: [],
      currentProjectId: id,
      projects: index.projects,
    });
  },

  openProject: (id) => {
    const state = get();
    // 如果当前有内容且不是同一个工程，提示保存
    if (state.components.length > 0 && state.currentProjectId !== id) {
      if (!confirm('切换工程将清空当前内容，是否先保存？')) {
        return;
      }
      if (state.currentProjectId) {
        get().saveProject();
      }
    }

    const project = loadFromLocalStorage(`${PROJECT_DATA_PREFIX}${id}`);
    if (!project) {
      console.error('工程数据不存在:', id);
      return;
    }

    set({
      components: project.components,
      nodes: project.nodes,
      wires: project.wires,
      selectedComponentId: null,
      selectedWireId: null,
      selectedComponentIds: new Set(),
      undoStack: [],
      redoStack: [],
      currentProjectId: id,
    });
  },

  saveProject: () => {
    const state = get();
    const id = state.currentProjectId;
    if (!id) {
      console.warn('没有当前工程，无法保存');
      return;
    }

    // 从索引获取工程名
    const index = (get() as any)._readProjectIndex();
    const meta = index.projects.find((p: ProjectMeta) => p.id === id);
    const name = meta?.name || '未命名';

    // 保存工程数据
    const project = serializeProject(name, state.components, state.nodes, state.wires);
    saveToLocalStorage(`${PROJECT_DATA_PREFIX}${id}`, project);

    // 更新索引
    const now = new Date().toISOString();
    const updatedMeta: ProjectMeta = {
      id,
      name,
      updatedAt: now,
      componentCount: state.components.length,
    };
    const newProjects = index.projects.map((p: ProjectMeta) =>
      p.id === id ? updatedMeta : p
    );
    (get() as any)._writeProjectIndex({ projects: newProjects });
    set({ projects: newProjects });
  },

  deleteProject: (id) => {
    if (!confirm('确定删除此工程？此操作不可撤销。')) {
      return;
    }

    // 从索引中移除
    const index = (get() as any)._readProjectIndex();
    const newProjects = index.projects.filter((p: ProjectMeta) => p.id !== id);
    (get() as any)._writeProjectIndex({ projects: newProjects });

    // 删除工程数据
    localStorage.removeItem(`${PROJECT_DATA_PREFIX}${id}`);

    // 如果删除的是当前工程，重置画布
    const state = get();
    if (state.currentProjectId === id) {
      set({
        components: [],
        nodes: [],
        wires: [],
        selectedComponentId: null,
        selectedWireId: null,
        selectedComponentIds: new Set(),
        undoStack: [],
        redoStack: [],
        currentProjectId: null,
      });
    }

    set({ projects: newProjects });
  },

  renameProject: (id, name) => {
    const index = (get() as any)._readProjectIndex();
    const now = new Date().toISOString();
    const newProjects = index.projects.map((p: ProjectMeta) =>
      p.id === id ? { ...p, name, updatedAt: now } : p
    );
    (get() as any)._writeProjectIndex({ projects: newProjects });
    set({ projects: newProjects });
  },

  duplicateProject: async (sourceId) => {
    const sourceData = loadFromLocalStorage(`${PROJECT_DATA_PREFIX}${sourceId}`);
    if (!sourceData) {
      toast.error('源项目不存在');
      return;
    }
    const newId = `proj-${Date.now().toString(36)}-${generateId().slice(0, 6)}`;
    const now = new Date().toISOString();
    const newMeta: ProjectMeta = {
      id: newId,
      name: `${sourceData.name || '未命名'} (副本)`,
      updatedAt: now,
      componentCount: sourceData.components?.length ?? 0,
    };
    const copiedProject = {
      ...sourceData,
      id: newId,
      name: newMeta.name,
      createdAt: now,
      updatedAt: now,
    };
    saveToLocalStorage(`${PROJECT_DATA_PREFIX}${newId}`, copiedProject);
    const index = (get() as any)._readProjectIndex();
    index.projects.unshift(newMeta);
    (get() as any)._writeProjectIndex(index);
    set({ projects: index.projects });
    toast.success(`已复制项目: ${newMeta.name}`);
  },

  // ==================== 项目模板 ====================

  createFromTemplate: (templateId, projectName) => {
    const templates = getAllTemplates();
    const template = templates.find(t => t.id === templateId);
    if (!template) {
      toast.error('模板不存在');
      return;
    }

    const id = `proj-${Date.now().toString(36)}-${generateId().slice(0, 6)}`;
    const now = new Date().toISOString();
    const meta: ProjectMeta = {
      id,
      name: projectName,
      updatedAt: now,
      componentCount: template.data.components.length,
    };

    const projectData = serializeProject(
      projectName,
      template.data.components,
      template.data.nodes,
      template.data.wires
    );
    // 覆盖 ID 以保持一致
    (projectData as any).id = id;
    saveToLocalStorage(`${PROJECT_DATA_PREFIX}${id}`, projectData);

    const index = (get() as any)._readProjectIndex();
    index.projects.unshift(meta);
    (get() as any)._writeProjectIndex(index);

    set({
      components: template.data.components,
      nodes: template.data.nodes,
      wires: template.data.wires,
      currentProjectId: id,
      projects: index.projects,
      undoStack: [],
      redoStack: [],
      selectedComponentId: null,
      selectedWireId: null,
      selectedComponentIds: new Set(),
    });
    toast.success(`已从模板创建: ${projectName}`);
  },

  saveAsTemplate: (name, description) => {
    const state = get();
    const template = createTemplateFromProject(name, description, {
      components: state.components,
      nodes: state.nodes,
      wires: state.wires,
    });
    saveUserTemplate(template);
    toast.success(`已保存为模板: ${name}`);
  },

  // ==================== 标签系统 ====================

  addTag: (projectId, tag) => {
    const index = (get() as any)._readProjectIndex();
    const meta = index.projects.find((p: ProjectMeta) => p.id === projectId);
    if (!meta) return;
    const data = loadFromLocalStorage(`${PROJECT_DATA_PREFIX}${projectId}`);
    if (!data) return;
    if (!data.metadata) data.metadata = { tags: [], description: '' };
    if (!data.metadata.tags) data.metadata.tags = [];
    if (!data.metadata.tags.includes(tag)) {
      data.metadata.tags.push(tag);
      saveToLocalStorage(`${PROJECT_DATA_PREFIX}${projectId}`, data);
    }
  },

  removeTag: (projectId, tag) => {
    const data = loadFromLocalStorage(`${PROJECT_DATA_PREFIX}${projectId}`);
    if (!data?.metadata?.tags) return;
    data.metadata.tags = data.metadata.tags.filter((t: string) => t !== tag);
    saveToLocalStorage(`${PROJECT_DATA_PREFIX}${projectId}`, data);
  },

  getAllTags: () => {
    const index = (get() as any)._readProjectIndex();
    const allTags = new Set<string>();
    for (const meta of index.projects) {
      const data = loadFromLocalStorage(`${PROJECT_DATA_PREFIX}${meta.id}`);
      if (data?.metadata?.tags) {
        data.metadata.tags.forEach((t: string) => allTags.add(t));
      }
    }
    return Array.from(allTags).sort();
  },

  // ==================== 星标收藏 ====================

  toggleStar: (projectId) => {
    const data = loadFromLocalStorage(`${PROJECT_DATA_PREFIX}${projectId}`);
    if (!data) return;
    if (!data.metadata) data.metadata = { tags: [], description: '' };
    data.metadata.starred = !data.metadata.starred;
    saveToLocalStorage(`${PROJECT_DATA_PREFIX}${projectId}`, data);
    // 刷新 projects 以触发 UI 更新
    set({ projects: [...get().projects] });
  },

  // ==================== 增强搜索 ====================

  searchProjects: (query) => {
    const index = (get() as any)._readProjectIndex();
    let results: ProjectMeta[] = index.projects;
    if (query.search) {
      const q = query.search.toLowerCase();
      results = results.filter((p: ProjectMeta) => p.name.toLowerCase().includes(q));
    }
    if (query.tags && query.tags.length > 0) {
      results = results.filter((p: ProjectMeta) => {
        const data = loadFromLocalStorage(`${PROJECT_DATA_PREFIX}${p.id}`);
        const projectTags = data?.metadata?.tags || [];
        return query.tags!.some((t: string) => projectTags.includes(t));
      });
    }
    if (query.starred) {
      results = results.filter((p: ProjectMeta) => {
        const data = loadFromLocalStorage(`${PROJECT_DATA_PREFIX}${p.id}`);
        return data?.metadata?.starred === true;
      });
    }
    return results;
  },

  // ==================== 删除选中 ====================

  deleteSelected: () => {
    const state = get();
    if (state.selectedComponentIds.size > 0) {
      get().pushUndo();
      const ids = state.selectedComponentIds;
      const compCount = ids.size;
      const wireCount = state.wires.filter(
        (w) => ids.has(w.fromComponentId) || ids.has(w.toComponentId)
      ).length;

      // 显示 loading 状态
      set({ bulkOperationLoading: true, bulkOperationMessage: `正在删除 ${compCount} 个元件...` });

      // 使用 requestAnimationFrame 确保 UI 更新
      requestAnimationFrame(() => {
        set((s) => ({
          components: s.components.filter((c) => !ids.has(c.id)),
          wires: s.wires.filter(
            (w) => !ids.has(w.fromComponentId) && !ids.has(w.toComponentId)
          ),
          selectedComponentIds: new Set(),
          selectedComponentId: null,
          bulkOperationLoading: false,
          bulkOperationMessage: null,
        }));
        get().autoSave();

        // 反馈
        const msg = wireCount > 0
          ? `已删除 ${compCount} 个元件和 ${wireCount} 条连线`
          : `已删除 ${compCount} 个元件`;
        toast.success(msg);
      });
    } else if (state.selectedComponentId) {
      get().removeComponent(state.selectedComponentId);
    } else if (state.selectedWireId) {
      get().removeWire(state.selectedWireId);
    }
  },

  // ==================== 复制/粘贴/剪切 ====================

  copySelected: () => {
    const state = get();
    const ids = state.selectedComponentIds.size > 0
      ? state.selectedComponentIds
      : state.selectedComponentId
        ? new Set([state.selectedComponentId])
        : new Set<string>();

    if (ids.size === 0) return;

    const copiedComponents = state.components
      .filter((c) => ids.has(c.id))
      .map((c) => JSON.parse(JSON.stringify(c)));

    // 复制选中元件之间的连线
    const copiedWires = state.wires
      .filter((w) => ids.has(w.fromComponentId) && ids.has(w.toComponentId))
      .map((w) => JSON.parse(JSON.stringify(w)));

    set({ clipboard: { components: copiedComponents, wires: copiedWires } });
  },

  cutSelected: () => {
    const state = get();
    state.copySelected();
    state.deleteSelected();
  },

  paste: (offsetX = 20, offsetY = 20) => {
    const state = get();
    if (state.clipboard.components.length === 0) return;

    state.pushUndo();

    const idMap = new Map<string, string>();
    const newComponents: CircuitComponent[] = state.clipboard.components.map((c) => {
      const newId = generateId();
      idMap.set(c.id, newId);
      return {
        ...JSON.parse(JSON.stringify(c)),
        id: newId,
        position: {
          x: c.position.x + offsetX,
          y: c.position.y + offsetY,
        },
        ports: c.ports.map((p: { id: string; offset: { x: number; y: number } }) => ({
          ...p,
          id: generateId(),
        })),
      };
    });

    // 复制连线并更新引用
    const newWires: Wire[] = state.clipboard.wires
      .filter((w) => idMap.has(w.fromComponentId) && idMap.has(w.toComponentId))
      .map((w) => ({
        ...JSON.parse(JSON.stringify(w)),
        id: generateId(),
        fromComponentId: idMap.get(w.fromComponentId)!,
        toComponentId: idMap.get(w.toComponentId)!,
        fromPortId: generateId(),
        toPortId: generateId(),
      }));

    const newIds = new Set(newComponents.map((c) => c.id));

    set((s) => ({
      components: [...s.components, ...newComponents],
      wires: [...s.wires, ...newWires],
      clipboard: { components: newComponents, wires: newWires },
      selectedComponentIds: newIds,
      selectedComponentId: newComponents[0]?.id ?? null,
    }));

    get().autoSave();
  },

  duplicate: () => {
    const state = get();
    state.copySelected();
    state.paste(40, 40);
  },

  selectAll: () => {
    const state = get();
    set({
      selectedComponentIds: new Set(state.components.map((c) => c.id)),
      selectedComponentId: state.components[0]?.id ?? null,
      selectedWireId: null,
    });
  },

  toggleShortcutsHelp: () => {
    set((s) => ({ showShortcutsHelp: !s.showShortcutsHelp }));
  },

  // ==================== RLC 测试电路 ====================

  loadRLCTestCircuit: () => {
    get().pushUndo();
    get().reset();

    // AC Source (1V, 1kHz default)
    const acId = generateId();
    const acPort1 = generateId();
    const acPort2 = generateId();

    // Resistor 100Ω
    const rId = generateId();
    const rPort1 = generateId();
    const rPort2 = generateId();

    // Inductor 10mH
    const lId = generateId();
    const lPort1 = generateId();
    const lPort2 = generateId();

    // Capacitor 1μF
    const cId = generateId();
    const cPort1 = generateId();
    const cPort2 = generateId();

    // Ground
    const gndId = generateId();
    const gndPort = generateId();

    const components: CircuitComponent[] = [
      {
        id: acId, type: ComponentType.ACSource, name: 'V1',
        position: { x: 100, y: 200 }, rotation: 0,
        value: { value: 1, unit: 'V' },
        ports: [{ id: acPort1, offset: { x: -25, y: 0 } }, { id: acPort2, offset: { x: 25, y: 0 } }],
        params: { frequency: 1000, phase: 0 },
      },
      {
        id: rId, type: ComponentType.Resistor, name: 'R1',
        position: { x: 250, y: 200 }, rotation: 0,
        value: { value: 100, unit: 'Ω' },
        ports: [{ id: rPort1, offset: { x: -25, y: 0 } }, { id: rPort2, offset: { x: 25, y: 0 } }],
      },
      {
        id: lId, type: ComponentType.Inductor, name: 'L1',
        position: { x: 400, y: 200 }, rotation: 0,
        value: { value: 0.01, unit: 'H' },
        ports: [{ id: lPort1, offset: { x: -25, y: 0 } }, { id: lPort2, offset: { x: 25, y: 0 } }],
      },
      {
        id: cId, type: ComponentType.Capacitor, name: 'C1',
        position: { x: 550, y: 200 }, rotation: 0,
        value: { value: 1e-6, unit: 'F' },
        ports: [{ id: cPort1, offset: { x: -25, y: 0 } }, { id: cPort2, offset: { x: 25, y: 0 } }],
      },
      {
        id: gndId, type: ComponentType.Ground, name: 'GND',
        position: { x: 100, y: 300 }, rotation: 0,
        value: { value: 0, unit: 'V' },
        ports: [{ id: gndPort, offset: { x: 0, y: -15 } }],
      },
    ];

    const wires: Wire[] = [
      // AC+ to R1 left
      {
        id: generateId(), fromComponentId: acId, fromPortId: acPort2,
        toComponentId: rId, toPortId: rPort1,
        points: calculateWirePoints({ x: 125, y: 200 }, { x: 225, y: 200 }, 'orthogonal'),
        status: WireStatus.Connected,
      },
      // R1 right to L1 left
      {
        id: generateId(), fromComponentId: rId, fromPortId: rPort2,
        toComponentId: lId, toPortId: lPort1,
        points: calculateWirePoints({ x: 275, y: 200 }, { x: 375, y: 200 }, 'orthogonal'),
        status: WireStatus.Connected,
      },
      // L1 right to C1 left
      {
        id: generateId(), fromComponentId: lId, fromPortId: lPort2,
        toComponentId: cId, toPortId: cPort1,
        points: calculateWirePoints({ x: 425, y: 200 }, { x: 525, y: 200 }, 'orthogonal'),
        status: WireStatus.Connected,
      },
      // C1 right back to AC- (via bottom route)
      {
        id: generateId(), fromComponentId: cId, fromPortId: cPort2,
        toComponentId: gndId, toPortId: gndPort,
        points: [
          { x: 575, y: 200 }, { x: 575, y: 300 }, { x: 100, y: 300 },
        ],
        status: WireStatus.Connected,
      },
      // AC- to GND
      {
        id: generateId(), fromComponentId: acId, fromPortId: acPort1,
        toComponentId: gndId, toPortId: gndPort,
        points: [
          { x: 75, y: 200 }, { x: 75, y: 300 }, { x: 100, y: 300 },
        ],
        status: WireStatus.Connected,
      },
    ];

    set({ components, wires, nodes: [] });

    // Auto fit
    setTimeout(() => get().fitToScreen(), 50);
    get().autoSave();
  },

  // ==================== 模板加载状态 ====================

  setTemplateLoaded: (loaded) => set({ templateLoaded: loaded }),

  // ==================== 重置 ====================

  reset: () => {
    // 清理资源
    cleanupManager.cleanup();
    set({ ...initialState, undoStack: get().undoStack, redoStack: get().redoStack, theme: get().theme });
  },
}));
