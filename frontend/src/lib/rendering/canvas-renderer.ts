/**
 * Canvas 2D 电路渲染器
 * 负责在 Canvas 上绘制电路元件、节点、连线
 * Phase 1 使用 Canvas 2D，Phase 2 可升级为 WebGL
 */

import type {
  CircuitComponent,
  CircuitNode,
  Wire,
  Point,
  ViewTransform,
  WirePreview,
  ValidationMessage,
  CanvasNetLabel,
} from '../../types/circuit';
import { ComponentType, ValidationSeverity, NetLabelKind } from '../../types/circuit';
import { calculateWirePoints } from '../circuit/wire-routing';

/** 渲染器配置 */
export interface RendererConfig {
  /** 网格大小 */
  gridSize: number;
  /** 是否显示网格 */
  showGrid: boolean;
  /** 背景色 */
  backgroundColor: string;
  /** 网格颜色 */
  gridColor: string;
  /** 连线颜色 */
  wireColor: string;
  /** 元件颜色 */
  componentColor: string;
  /** 选中高亮色 */
  selectionColor: string;
  /** 连线选中色 */
  wireSelectionColor: string;
  /** 端口颜色 */
  portColor: string;
  /** 端口吸附高亮 */
  portSnapColor: string;
  /** 预览连线颜色 */
  wirePreviewColor: string;
}

const DEFAULT_RENDERER_CONFIG: RendererConfig = {
  gridSize: 20,
  showGrid: true,
  backgroundColor: '#1a1a2e',
  gridColor: '#2a2a4a',
  wireColor: '#00d4ff',
  componentColor: '#e0e0e0',
  selectionColor: '#ff6b6b',
  wireSelectionColor: '#ff6b6b',
  portColor: '#4ecdc4',
  portSnapColor: '#ffd93d',
  wirePreviewColor: '#8888ff',
};

/**
 * Canvas 2D 电路渲染器
 */
export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: RendererConfig;
  private transform: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };

  constructor(
    canvas: HTMLCanvasElement,
    config: Partial<RendererConfig> = {}
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;
    this.config = { ...DEFAULT_RENDERER_CONFIG, ...config };
  }

  /** 更新视图变换 */
  setTransform(transform: ViewTransform): void {
    this.transform = transform;
  }

  /** 获取当前视图变换 */
  getTransform(): ViewTransform {
    return { ...this.transform };
  }

  /** 屏幕坐标转画布坐标 */
  screenToCanvas(screenX: number, screenY: number): Point {
    return {
      x: (screenX - this.transform.offsetX) / this.transform.scale,
      y: (screenY - this.transform.offsetY) / this.transform.scale,
    };
  }

  /** 清空画布并绘制背景 */
  clear(): void {
    const { width, height } = this.canvas;
    this.ctx.fillStyle = this.config.backgroundColor;
    this.ctx.fillRect(0, 0, width, height);
  }

  /** 绘制网格 */
  drawGrid(): void {
    if (!this.config.showGrid) return;

    const { width, height } = this.canvas;
    const { gridSize } = this.config;
    const { scale, offsetX, offsetY } = this.transform;

    const scaledGrid = gridSize * scale;
    const startX = offsetX % scaledGrid;
    const startY = offsetY % scaledGrid;

    this.ctx.strokeStyle = this.config.gridColor;
    this.ctx.lineWidth = 0.5;
    this.ctx.beginPath();

    for (let x = startX; x < width; x += scaledGrid) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
    }
    for (let y = startY; y < height; y += scaledGrid) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
    }
    this.ctx.stroke();
  }

  /** 绘制单个电路元件 */
  drawComponent(component: CircuitComponent): void {
    const { ctx, config, transform } = this;
    const { position, rotation, type, name, selected } = component;

    ctx.save();
    ctx.translate(
      position.x * transform.scale + transform.offsetX,
      position.y * transform.scale + transform.offsetY
    );
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(transform.scale, transform.scale);

    // 绘制选中高亮
    if (selected) {
      ctx.strokeStyle = config.selectionColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(-32, -22, 64, 44);
      ctx.setLineDash([]);
    }

    // 绘制元件符号
    ctx.strokeStyle = config.componentColor;
    ctx.lineWidth = 2;
    ctx.fillStyle = config.componentColor;
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';

    switch (type) {
      case ComponentType.Resistor:
        this.drawResistor(ctx);
        break;
      case ComponentType.Capacitor:
        this.drawCapacitor(ctx);
        break;
      case ComponentType.Inductor:
        this.drawInductor(ctx);
        break;
      case ComponentType.DCSource:
      case ComponentType.VoltageSource:
        this.drawVoltageSource(ctx);
        break;
      case ComponentType.ACSource:
        this.drawACSource(ctx);
        break;
      case ComponentType.Ground:
        this.drawGround(ctx);
        break;
      case ComponentType.Diode:
        this.drawDiode(ctx);
        break;
      case ComponentType.BJTNPN:
        this.drawBJT(ctx, 'NPN');
        break;
      case ComponentType.BJTPNP:
        this.drawBJT(ctx, 'PNP');
        break;
      case ComponentType.MOSFET_NMOS:
        this.drawMOSFET(ctx, 'NMOS');
        break;
      case ComponentType.MOSFET_PMOS:
        this.drawMOSFET(ctx, 'PMOS');
        break;
      case ComponentType.JFET_N:
        this.drawJFET(ctx, 'N');
        break;
      case ComponentType.JFET_P:
        this.drawJFET(ctx, 'P');
        break;
      case ComponentType.IGBT:
        this.drawIGBT(ctx);
        break;
      case ComponentType.DarlingtonNPN:
        this.drawDarlington(ctx, 'NPN');
        break;
      case ComponentType.DarlingtonPNP:
        this.drawDarlington(ctx, 'PNP');
        break;
      case ComponentType.OpAmp:
        this.drawOpAmp(ctx);
        break;
      case ComponentType.LogicAND:
        this.drawLogicGate(ctx, 'AND');
        break;
      case ComponentType.LogicOR:
        this.drawLogicGate(ctx, 'OR');
        break;
      case ComponentType.LogicNOT:
        this.drawLogicGate(ctx, 'NOT');
        break;
      case ComponentType.LogicNAND:
        this.drawLogicGate(ctx, 'NAND');
        break;
      case ComponentType.LogicNOR:
        this.drawLogicGate(ctx, 'NOR');
        break;
      case ComponentType.LogicXOR:
        this.drawLogicGate(ctx, 'XOR');
        break;
      case ComponentType.SPIMaster:
        this.drawProtocolBlock(ctx, 'SPI', '#4ecdc4', true);
        break;
      case ComponentType.SPISlave:
        this.drawProtocolBlock(ctx, 'SPI', '#ffd93d', false);
        break;
      case ComponentType.I2CMaster:
        this.drawProtocolBlock(ctx, 'I2C', '#4ecdc4', true);
        break;
      case ComponentType.I2CSlave:
        this.drawProtocolBlock(ctx, 'I2C', '#ffd93d', false);
        break;
      case ComponentType.UARTTX:
        this.drawProtocolBlock(ctx, 'TX', '#4ecdc4', true);
        break;
      case ComponentType.UARTRX:
        this.drawProtocolBlock(ctx, 'RX', '#ffd93d', false);
        break;
      case ComponentType.MCU:
        this.drawMCU(ctx, component);
        break;
      case ComponentType.ADC:
        this.drawADC(ctx, component);
        break;
      case ComponentType.DAC:
        this.drawDAC(ctx, component);
        break;
      // === 温度传感器 ===
      case ComponentType.NTCThermistor:
        this.drawNTCThermistor(ctx);
        break;
      case ComponentType.Thermocouple:
        this.drawThermocouple(ctx);
        break;
      case ComponentType.DS18B20:
        this.drawDigitalSensor(ctx, 'DS18B20', '#ff9500');
        break;
      // === 光传感器 ===
      case ComponentType.LDR:
        this.drawLDR(ctx);
        break;
      case ComponentType.Photodiode:
        this.drawPhotodiode(ctx);
        break;
      case ComponentType.Phototransistor:
        this.drawPhototransistor(ctx);
        break;
      // === 压力/加速度传感器 ===
      case ComponentType.PiezoSensor:
        this.drawPiezoSensor(ctx);
        break;
      case ComponentType.Accelerometer:
        this.drawDigitalSensor(ctx, 'ACC', '#4ecdc4');
        break;
      case ComponentType.Gyroscope:
        this.drawDigitalSensor(ctx, 'GYRO', '#a78bfa');
        break;
      // === 电源管理IC ===
      case ComponentType.LDO:
        this.drawVoltageRegulator(ctx, 'LDO');
        break;
      case ComponentType.BuckConverter:
        this.drawDCDCConverter(ctx, 'BUCK');
        break;
      case ComponentType.BoostConverter:
        this.drawDCDCConverter(ctx, 'BOOST');
        break;
      case ComponentType.Battery:
        this.drawBattery(ctx);
        break;
      case ComponentType.PowerSupervisor:
        this.drawDigitalSensor(ctx, 'PWR', '#ff6b6b');
        break;
      // === 通信模块 ===
      case ComponentType.BluetoothModule:
        this.drawCommModule(ctx, 'BT', '#4488ff');
        break;
      case ComponentType.WiFiModule:
        this.drawCommModule(ctx, 'WiFi', '#44bb44');
        break;
      case ComponentType.CANTransceiver:
        this.drawProtocolBlock(ctx, 'CAN', '#ffaa44', true);
        break;
      case ComponentType.RS485Transceiver:
        this.drawProtocolBlock(ctx, '485', '#ff7744', true);
        break;
      // === 执行器 ===
      case ComponentType.BuzzerActive:
        this.drawBuzzer(ctx, true);
        break;
      case ComponentType.BuzzerPassive:
        this.drawBuzzer(ctx, false);
        break;
      case ComponentType.Relay:
        this.drawRelay(ctx);
        break;
      case ComponentType.StepperMotor:
        this.drawStepperMotor(ctx);
        break;
      case ComponentType.LCDDisplay:
        this.drawLCDDisplay(ctx);
        break;
      case ComponentType.VoltageProbe:
        this.drawVoltageProbe(ctx);
        break;
      case ComponentType.CurrentProbe:
        this.drawCurrentProbe(ctx);
        break;
      case ComponentType.PowerProbe:
        this.drawPowerProbe(ctx);
        break;
      case ComponentType.Timer555:
        this.drawTimer555(ctx);
        break;
      case ComponentType.VoltageRegulator7805:
        this.drawVoltageRegulator(ctx, '7805');
        break;
      case ComponentType.VoltageRegulator7812:
        this.drawVoltageRegulator(ctx, '7812');
        break;
      case ComponentType.Optocoupler:
        this.drawOptocoupler(ctx);
        break;
      default:
        ctx.strokeRect(-20, -10, 40, 20);
    }

    // 绘制元件名称（不跟随旋转，始终水平）
    ctx.rotate((-rotation * Math.PI) / 180);
    ctx.fillStyle = config.componentColor;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(name, 0, -28);

    // 绘制元件值
    const valueStr = this.formatValue(component.value.value, component.value.unit);
    ctx.font = '10px monospace';
    ctx.fillStyle = '#888';
    ctx.fillText(valueStr, 0, 30);

    ctx.restore();
  }

  /** 绘制连线 */
  drawWire(wire: Wire, selected: boolean = false, highlighted: boolean = false): void {
    const { ctx, config, transform } = this;
    if (wire.points.length < 2) return;

    ctx.save();

    // 确定连线颜色和宽度
    let color: string;
    let lineWidth: number;

    if (selected) {
      color = config.wireSelectionColor;
      lineWidth = 3;
    } else if (highlighted) {
      color = '#ffd93d'; // 网络高亮色
      lineWidth = 3;
      // 添加辉光效果
      ctx.shadowColor = '#ffd93d';
      ctx.shadowBlur = 8;
    } else {
      color = config.wireColor;
      lineWidth = 2;
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();

    const firstPoint = wire.points[0];
    ctx.moveTo(
      firstPoint.x * transform.scale + transform.offsetX,
      firstPoint.y * transform.scale + transform.offsetY
    );

    for (let i = 1; i < wire.points.length; i++) {
      const point = wire.points[i];
      ctx.lineTo(
        point.x * transform.scale + transform.offsetX,
        point.y * transform.scale + transform.offsetY
      );
    }
    ctx.stroke();

    // 重置阴影
    ctx.shadowBlur = 0;

    // 绘制拐点小圆点
    for (const point of wire.points) {
      if (point.isBend) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(
          point.x * transform.scale + transform.offsetX,
          point.y * transform.scale + transform.offsetY,
          highlighted ? 4 : 3,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /** 绘制连线预览 */
  drawWirePreview(preview: WirePreview): void {
    const { ctx, config, transform } = this;

    const targetPos = preview.mousePosition;
    const points = calculateWirePoints(
      preview.fromPosition,
      targetPos,
      preview.routing
    );

    ctx.save();
    ctx.strokeStyle = config.wirePreviewColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();

    ctx.moveTo(
      points[0].x * transform.scale + transform.offsetX,
      points[0].y * transform.scale + transform.offsetY
    );

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(
        points[i].x * transform.scale + transform.offsetX,
        points[i].y * transform.scale + transform.offsetY
      );
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // 绘制吸附高亮
    if (preview.snapTarget) {
      const pos = preview.snapTarget.position;
      ctx.fillStyle = config.portSnapColor;
      ctx.beginPath();
      ctx.arc(
        pos.x * transform.scale + transform.offsetX,
        pos.y * transform.scale + transform.offsetY,
        6,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    ctx.restore();
  }

  /** 绘制端口 */
  drawPorts(
    component: CircuitComponent,
    highlightHovered: boolean = false,
    unconnectedPorts?: Set<string>
  ): void {
    const { ctx, config, transform } = this;

    for (const port of component.ports) {
      const rad = (component.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const absX = component.position.x + port.offset.x * cos - port.offset.y * sin;
      const absY = component.position.y + port.offset.x * sin + port.offset.y * cos;

      const screenX = absX * transform.scale + transform.offsetX;
      const screenY = absY * transform.scale + transform.offsetY;

      const isUnconnected = unconnectedPorts?.has(port.id) ?? false;

      ctx.save();
      ctx.fillStyle = highlightHovered ? config.portSnapColor : config.portColor;
      ctx.beginPath();
      ctx.arc(screenX, screenY, highlightHovered ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();

      // 端口外圈
      if (highlightHovered) {
        ctx.strokeStyle = config.portSnapColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(screenX, screenY, 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 未连接端口悬空高亮提示
      if (isUnconnected && !highlightHovered) {
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.arc(screenX, screenY, 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
    }
  }

  /** 绘制节点 */
  drawNode(node: CircuitNode): void {
    const { ctx, transform } = this;
    const x = node.position.x * transform.scale + transform.offsetX;
    const y = node.position.y * transform.scale + transform.offsetY;

    ctx.save();

    if (node.type === 'ground') {
      ctx.strokeStyle = '#4ecdc4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 10);
      ctx.moveTo(x - 8, y + 10);
      ctx.lineTo(x + 8, y + 10);
      ctx.moveTo(x - 5, y + 14);
      ctx.lineTo(x + 5, y + 14);
      ctx.moveTo(x - 2, y + 18);
      ctx.lineTo(x + 2, y + 18);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#aaa';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(node.name, x, y - 8);

    ctx.restore();
  }

  /** 绘制验证错误提示 */
  drawValidationTooltips(messages: ValidationMessage[], components: CircuitComponent[]): void {
    const { ctx, transform } = this;

    // 只绘制有 targetId 的 message
    const targetedMessages = messages.filter(
      (m) => m.targetId && m.targetType === 'component'
    );

    for (const msg of targetedMessages) {
      const comp = components.find((c) => c.id === msg.targetId);
      if (!comp) continue;

      const x = comp.position.x * transform.scale + transform.offsetX;
      const y = comp.position.y * transform.scale + transform.offsetY;

      const color =
        msg.severity === ValidationSeverity.Error
          ? '#ff4444'
          : msg.severity === ValidationSeverity.Warning
          ? '#ffaa00'
          : '#44aaff';

      // 警告图标
      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + 28, y - 22, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        msg.severity === ValidationSeverity.Error ? '!' : '⚠',
        x + 28,
        y - 22
      );
      ctx.restore();
    }
  }

  /** 绘制网络标签 */
  drawNetLabel(label: CanvasNetLabel, selected: boolean = false): void {
    const { ctx, config: _config, transform } = this;
    const x = label.position.x * transform.scale + transform.offsetX;
    const y = label.position.y * transform.scale + transform.offsetY;

    // 标签颜色
    let color: string;
    switch (label.labelType) {
      case NetLabelKind.Power:
        color = '#ff4444';
        break;
      case NetLabelKind.Ground:
        color = '#44ff44';
        break;
      case NetLabelKind.Bus:
        color = '#ffaa44';
        break;
      default:
        color = '#00d4ff';
    }

    ctx.save();

    // 连接线（从标签向下画一条短线到连接点）
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y + 6);
    ctx.lineTo(x, y + 18);
    ctx.stroke();

    // 标签背景
    const textWidth = ctx.measureText(label.name).width + 12;
    const bgX = x - textWidth / 2;
    const bgY = y - 10;
    const bgH = 18;

    ctx.fillStyle = selected ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.5)';
    ctx.strokeStyle = selected ? '#fff' : color;
    ctx.lineWidth = selected ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(bgX, bgY, textWidth, bgH, 3);
    ctx.fill();
    ctx.stroke();

    // 标签文字
    ctx.fillStyle = color;
    ctx.font = label.isGlobal ? 'bold 11px monospace' : '11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label.name, x, y - 1);

    // 全局网络标记
    if (label.isGlobal) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '8px sans-serif';
      ctx.fillText('G', x + textWidth / 2 - 5, bgY + 5);
    }

    // 总线标记
    if (label.labelType === NetLabelKind.Bus && label.busWidth) {
      ctx.fillStyle = '#ffaa44';
      ctx.font = '9px monospace';
      ctx.fillText(`[${label.busWidth}]`, x, y + 10);
    }

    ctx.restore();
  }

  /** 完整渲染一帧 */
  render(
    components: CircuitComponent[],
    wires: Wire[],
    nodes: CircuitNode[],
    options: {
      wirePreview?: WirePreview | null;
      selectedComponentId?: string | null;
      selectedWireId?: string | null;
      selectedComponentIds?: Set<string>;
      validationMessages?: ValidationMessage[];
      boxSelectRect?: { startX: number; startY: number; endX: number; endY: number } | null;
      showGrid?: boolean;
      highlightedNetWires?: string[];
      unconnectedPorts?: Set<string>;
      netLabels?: CanvasNetLabel[];
      selectedNetLabelId?: string | null;
    } = {}
  ): void {
    this.clear();

    // Grid
    if (options.showGrid !== false) {
      this.drawGrid();
    }

    // 绘制连线（支持网络高亮）
    const highlightedSet = options.highlightedNetWires
      ? new Set(options.highlightedNetWires)
      : null;

    wires.forEach((wire) => {
      const isSelected = wire.id === options.selectedWireId;
      const isHighlighted = highlightedSet?.has(wire.id) ?? false;
      this.drawWire(wire, isSelected, isHighlighted);
    });

    // 绘制连线预览
    if (options.wirePreview) {
      this.drawWirePreview(options.wirePreview);
    }

    // 绘制元件
    const multiIds = options.selectedComponentIds;
    components.forEach((comp) => {
      const isMultiSelected = multiIds ? multiIds.has(comp.id) : false;
      if (isMultiSelected && comp.id !== options.selectedComponentId) {
        // Draw a subtle multi-select highlight
        const { ctx, transform } = this;
        const x = comp.position.x * transform.scale + transform.offsetX;
        const y = comp.position.y * transform.scale + transform.offsetY;
        ctx.save();
        ctx.strokeStyle = '#66aaff';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(x - 32, y - 22, 64, 44);
        ctx.setLineDash([]);
        ctx.restore();
      }
      this.drawComponent(comp);
    });

    // 绘制端口（选中元件的端口高亮 + 未连接端口提示）
    // 计算所有已连接的端口
    const connectedPorts = new Set<string>();
    wires.forEach(wire => {
      connectedPorts.add(wire.fromPortId);
      connectedPorts.add(wire.toPortId);
    });
    const allPorts = new Set<string>();
    components.forEach(comp => {
      comp.ports.forEach(port => allPorts.add(port.id));
    });
    const unconnectedPorts = new Set<string>();
    allPorts.forEach(pid => {
      if (!connectedPorts.has(pid)) unconnectedPorts.add(pid);
    });

    components.forEach((comp) => {
      const isHighlighted = comp.id === options.selectedComponentId || (multiIds?.has(comp.id) ?? false);
      this.drawPorts(comp, isHighlighted, unconnectedPorts);
    });

    // 绘制节点
    nodes.forEach((node) => this.drawNode(node));

    // 绘制验证提示
    if (options.validationMessages) {
      this.drawValidationTooltips(options.validationMessages, components);
    }

    // 绘制网络标签
    if (options.netLabels) {
      for (const label of options.netLabels) {
        const isSelected = label.id === options.selectedNetLabelId;
        this.drawNetLabel(label, isSelected);
      }
    }

    // 绘制框选矩形
    if (options.boxSelectRect) {
      const { ctx, transform } = this;
      const r = options.boxSelectRect;
      const x1 = Math.min(r.startX, r.endX) * transform.scale + transform.offsetX;
      const y1 = Math.min(r.startY, r.endY) * transform.scale + transform.offsetY;
      const w = (Math.abs(r.endX - r.startX)) * transform.scale;
      const h = (Math.abs(r.endY - r.startY)) * transform.scale;
      ctx.save();
      ctx.fillStyle = 'rgba(100, 160, 255, 0.08)';
      ctx.fillRect(x1, y1, w, h);
      ctx.strokeStyle = 'rgba(100, 160, 255, 0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x1, y1, w, h);
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  // ==================== 元件符号绘制 ====================

  private drawResistor(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    ctx.lineTo(-15, 0);
    for (let i = 0; i < 4; i++) {
      const x = -15 + i * 8;
      ctx.lineTo(x + 2, -6);
      ctx.lineTo(x + 4, 6);
      ctx.lineTo(x + 6, -6);
    }
    ctx.lineTo(15, 0);
    ctx.lineTo(25, 0);
    ctx.stroke();
  }

  private drawCapacitor(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    ctx.lineTo(-4, 0);
    ctx.moveTo(-4, -10);
    ctx.lineTo(-4, 10);
    ctx.moveTo(4, -10);
    ctx.lineTo(4, 10);
    ctx.moveTo(4, 0);
    ctx.lineTo(25, 0);
    ctx.stroke();
  }

  private drawInductor(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    ctx.lineTo(-15, 0);
    for (let i = 0; i < 4; i++) {
      const cx = -10 + i * 7;
      ctx.arc(cx, 0, 4, Math.PI, 0, false);
    }
    ctx.lineTo(25, 0);
    ctx.stroke();
  }

  private drawVoltageSource(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = '14px monospace';
    ctx.fillText('+', 0, -4);
    ctx.fillText('−', 0, 10);
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    ctx.lineTo(-15, 0);
    ctx.moveTo(15, 0);
    ctx.lineTo(25, 0);
    ctx.stroke();
  }

  private drawACSource(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.stroke();
    // 正弦波符号
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    for (let x = -8; x <= 8; x += 0.5) {
      ctx.lineTo(x, Math.sin((x / 8) * Math.PI) * 5);
    }
    ctx.stroke();
    // 引脚
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    ctx.lineTo(-15, 0);
    ctx.moveTo(15, 0);
    ctx.lineTo(25, 0);
    ctx.stroke();
  }

  private drawGround(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(0, 0);
    ctx.moveTo(-10, 0);
    ctx.lineTo(10, 0);
    ctx.moveTo(-6, 5);
    ctx.lineTo(6, 5);
    ctx.moveTo(-3, 10);
    ctx.lineTo(3, 10);
    ctx.stroke();
  }

  // ==================== Phase 2: 半导体元件 ====================

  /** 二极管：三角形+竖线 */
  private drawDiode(ctx: CanvasRenderingContext2D): void {
    // 引脚线
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    ctx.lineTo(-8, 0);
    ctx.moveTo(8, 0);
    ctx.lineTo(25, 0);
    ctx.stroke();
    // 三角形（阳极→阴极）
    ctx.beginPath();
    ctx.moveTo(-8, -10);
    ctx.lineTo(8, 0);
    ctx.lineTo(-8, 10);
    ctx.closePath();
    ctx.stroke();
    // 阴极竖线
    ctx.beginPath();
    ctx.moveTo(8, -10);
    ctx.lineTo(8, 10);
    ctx.stroke();
  }

  /** BJT NPN/PNP：圆圈+三条线 */
  private drawBJT(ctx: CanvasRenderingContext2D, variant: 'NPN' | 'PNP'): void {
    // 圆圈
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.stroke();

    // 基极引脚（左侧进入）
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    ctx.lineTo(-8, 0);
    ctx.stroke();

    // 基极线段（圆内）
    ctx.beginPath();
    ctx.moveTo(-8, -12);
    ctx.lineTo(-8, 12);
    ctx.stroke();

    if (variant === 'NPN') {
      // 集电极（右上）
      ctx.beginPath();
      ctx.moveTo(-3, -8);
      ctx.lineTo(18, -8);
      ctx.lineTo(25, -10); // port[1] offset (20, 0) -> 绘制在右上
      ctx.stroke();
      // 发射极（右下）
      ctx.beginPath();
      ctx.moveTo(-3, 8);
      ctx.lineTo(18, 8);
      ctx.lineTo(25, 10);  // port[2] offset (20, 20) -> 绘制在右下
      ctx.stroke();
      // NPN箭头：从内部向外指
      ctx.beginPath();
      ctx.moveTo(12, 4);
      ctx.lineTo(18, 8);
      ctx.lineTo(12, 11);
      ctx.stroke();
    } else {
      // PNP: 集电极（右上）- 箭头方向相反
      ctx.beginPath();
      ctx.moveTo(-3, -8);
      ctx.lineTo(18, -8);
      ctx.lineTo(25, -10);
      ctx.stroke();
      // 发射极（右下）
      ctx.beginPath();
      ctx.moveTo(-3, 8);
      ctx.lineTo(18, 8);
      ctx.lineTo(25, 10);
      ctx.stroke();
      // PNP箭头：从外部向内指
      ctx.beginPath();
      ctx.moveTo(18, 4);
      ctx.lineTo(12, 8);
      ctx.lineTo(18, 11);
      ctx.stroke();
    }
  }

  /** MOSFET N/P 沟道 */
  private drawMOSFET(ctx: CanvasRenderingContext2D, variant: 'NMOS' | 'PMOS'): void {
    // 圆圈
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.stroke();

    // 栅极引脚（左）
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    ctx.lineTo(-8, 0);
    ctx.stroke();

    // 栅极（竖线，不与沟道连接）
    ctx.beginPath();
    ctx.moveTo(-8, -12);
    ctx.lineTo(-8, 12);
    ctx.stroke();

    // 沟道竖线（两段）
    ctx.beginPath();
    ctx.moveTo(2, -10);
    ctx.lineTo(2, -3);
    ctx.moveTo(2, 3);
    ctx.lineTo(2, 10);
    ctx.stroke();

    // 漏极（右上）
    ctx.beginPath();
    ctx.moveTo(2, -8);
    ctx.lineTo(18, -8);
    ctx.lineTo(25, -10);
    ctx.stroke();

    // 源极（右下）
    ctx.beginPath();
    ctx.moveTo(2, 8);
    ctx.lineTo(18, 8);
    ctx.lineTo(25, 10);
    ctx.stroke();

    // 箭头：NMOS从body指向沟道，PMOS从沟道指向body
    if (variant === 'NMOS') {
      ctx.beginPath();
      ctx.moveTo(10, 2);
      ctx.lineTo(2, 5);
      ctx.lineTo(10, 8);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(2, 2);
      ctx.lineTo(10, 5);
      ctx.lineTo(2, 8);
      ctx.stroke();
    }
  }

  /** JFET N/P 沟道 */
  private drawJFET(ctx: CanvasRenderingContext2D, variant: 'N' | 'P'): void {
    // 圆圈
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.stroke();

    // 栅极引脚（左）
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    ctx.lineTo(-8, 0);
    ctx.stroke();

    // 栅极线段（竖线 + 箭头指向沟道 = JFET符号特征）
    ctx.beginPath();
    ctx.moveTo(-8, -12);
    ctx.lineTo(-8, 12);
    ctx.stroke();

    // 沟道竖线（连续，不像 MOSFET 分两段）
    ctx.beginPath();
    ctx.moveTo(2, -10);
    ctx.lineTo(2, 10);
    ctx.stroke();

    // 漏极（右上）
    ctx.beginPath();
    ctx.moveTo(2, -8);
    ctx.lineTo(18, -8);
    ctx.lineTo(25, -10);
    ctx.stroke();

    // 源极（右下）
    ctx.beginPath();
    ctx.moveTo(2, 8);
    ctx.lineTo(18, 8);
    ctx.lineTo(25, 10);
    ctx.stroke();

    // 箭头：N-JFET栅极箭头指向沟道，P-JFET箭头从沟道指向栅极
    if (variant === 'N') {
      ctx.beginPath();
      ctx.moveTo(-4, -3);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-4, 3);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(-8, -3);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-8, 3);
      ctx.stroke();
    }
  }

  /** IGBT：NPN符号 + MOSFET栅极 */
  private drawIGBT(ctx: CanvasRenderingContext2D): void {
    // 圆圈
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.stroke();

    // 栅极引脚（左，类似 MOSFET）
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    ctx.lineTo(-8, 0);
    ctx.stroke();

    // 栅极竖线（左侧）
    ctx.beginPath();
    ctx.moveTo(-8, -12);
    ctx.lineTo(-8, 12);
    ctx.stroke();

    // BJT部分：基极线（从栅极连接到内部）
    ctx.beginPath();
    ctx.moveTo(-3, -10);
    ctx.lineTo(-3, 10);
    ctx.stroke();

    // 集电极（右上）
    ctx.beginPath();
    ctx.moveTo(2, -8);
    ctx.lineTo(18, -8);
    ctx.lineTo(25, -10);
    ctx.stroke();

    // 发射极（右下）
    ctx.beginPath();
    ctx.moveTo(2, 8);
    ctx.lineTo(18, 8);
    ctx.lineTo(25, 10);
    ctx.stroke();

    // 箭头：从发射极指向外部（NPN型）
    ctx.beginPath();
    ctx.moveTo(12, 4);
    ctx.lineTo(18, 8);
    ctx.lineTo(12, 11);
    ctx.stroke();

    // IGBT 标记：栅极处加竖线表示绝缘栅
    ctx.beginPath();
    ctx.moveTo(-8, -12);
    ctx.lineTo(-4, -12);
    ctx.moveTo(-8, 12);
    ctx.lineTo(-4, 12);
    ctx.stroke();
  }

  /** 达林顿管：两个 NPN/PNP 叠联 */
  private drawDarlington(ctx: CanvasRenderingContext2D, variant: 'NPN' | 'PNP'): void {
    // 圆圈
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.stroke();

    // 基极引脚（左）
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    ctx.lineTo(-10, 0);
    ctx.stroke();

    // 基极竖线
    ctx.beginPath();
    ctx.moveTo(-10, -14);
    ctx.lineTo(-10, 14);
    ctx.stroke();

    // 第一个晶体管（内侧，小）
    ctx.beginPath();
    ctx.moveTo(-5, -5);
    ctx.lineTo(6, -5);
    ctx.stroke();

    // 第二个晶体管（外侧）
    ctx.beginPath();
    ctx.moveTo(-5, 5);
    ctx.lineTo(6, 5);
    ctx.lineTo(20, 5);
    ctx.lineTo(25, 10);
    ctx.stroke();

    // 集电极（右上，两个晶体管集电极相连）
    ctx.beginPath();
    ctx.moveTo(6, -5);
    ctx.lineTo(12, -5);
    ctx.lineTo(20, -10);
    ctx.lineTo(25, -10);
    ctx.stroke();

    // 集电极连线（两个管子的集电极连接在一起）
    ctx.beginPath();
    ctx.moveTo(12, -5);
    ctx.lineTo(12, 5);
    ctx.stroke();

    // 发射极从第二个管子输出
    ctx.beginPath();
    ctx.moveTo(20, 5);
    ctx.lineTo(25, 10);
    ctx.stroke();

    // 箭头：根据 NPN/PNP
    if (variant === 'NPN') {
      // 第一个管子箭头
      ctx.beginPath();
      ctx.moveTo(2, -8);
      ctx.lineTo(6, -5);
      ctx.lineTo(2, -2);
      ctx.stroke();
      // 第二个管子箭头
      ctx.beginPath();
      ctx.moveTo(14, 2);
      ctx.lineTo(20, 5);
      ctx.lineTo(14, 8);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(6, -8);
      ctx.lineTo(2, -5);
      ctx.lineTo(6, -2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(20, 2);
      ctx.lineTo(14, 5);
      ctx.lineTo(20, 8);
      ctx.stroke();
    }

    // 内部连接线：Q1 发射极 → Q2 基极
    ctx.beginPath();
    ctx.moveTo(-5, 5);
    ctx.lineTo(-10, 5);
    ctx.stroke();
  }

  /** 运算放大器：三角形 */
  private drawOpAmp(ctx: CanvasRenderingContext2D): void {
    // 三角形
    ctx.beginPath();
    ctx.moveTo(-20, -18);
    ctx.lineTo(20, 0);
    ctx.lineTo(-20, 18);
    ctx.closePath();
    ctx.stroke();

    // 正输入标记
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('+', -12, -6);
    // 负输入标记
    ctx.fillText('−', -12, 10);
  }

  /** 逻辑门：IEC矩形符号 + 标注 */
  private drawLogicGate(ctx: CanvasRenderingContext2D, gateType: string): void {
    // 矩形主体
    if (gateType === 'NOT') {
      // NOT: 较小矩形 + 小圆圈
      ctx.strokeRect(-16, -12, 28, 24);
      // 小圆圈（取反）
      ctx.beginPath();
      ctx.arc(16, 0, 4, 0, Math.PI * 2);
      ctx.stroke();
      // 输出引脚延长
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(25, 0);
      ctx.stroke();
    } else if (gateType === 'NAND') {
      // AND + 小圆圈
      ctx.strokeRect(-16, -15, 28, 30);
      ctx.beginPath();
      ctx.arc(16, 0, 4, 0, Math.PI * 2);
      ctx.stroke();
    } else if (gateType === 'NOR') {
      // OR + 小圆圈
      ctx.strokeRect(-16, -15, 28, 30);
      ctx.beginPath();
      ctx.arc(16, 0, 4, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // AND, OR, XOR: 标准矩形
      ctx.strokeRect(-16, -15, 28, 30);
    }

    // 输入引脚线
    ctx.beginPath();
    ctx.moveTo(-25, -10);
    ctx.lineTo(-16, -10);
    ctx.moveTo(-25, 10);
    ctx.lineTo(-16, 10);
    ctx.stroke();

    // 输出引脚（非NOT、非NAND/NOR已在上方处理）
    if (gateType !== 'NOT' && gateType !== 'NAND' && gateType !== 'NOR') {
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(25, 0);
      ctx.stroke();
    }

    // XOR额外曲线
    if (gateType === 'XOR') {
      ctx.beginPath();
      ctx.arc(-22, 0, 18, -0.6, 0.6, false);
      ctx.stroke();
    }

    // 门类型文字
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(gateType, 0, 0);
  }

  /** MCU 元件：矩形芯片 + 引脚指示 + 引脚状态灯 */
  private drawMCU(ctx: CanvasRenderingContext2D, component: CircuitComponent): void {
    const pinCount = component.ports.length;
    const cols = 4;
    const rows = Math.ceil(pinCount / 2 / cols);
    const pinSpacing = 20;
    const mcuW = 60;
    const mcuH = Math.max(40, rows * pinSpacing + 10);

    // 芯片主体矩形
    ctx.fillStyle = '#2a2a3e';
    ctx.fillRect(-mcuW / 2, -mcuH / 2, mcuW, mcuH);
    ctx.strokeStyle = this.config.componentColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(-mcuW / 2, -mcuH / 2, mcuW, mcuH);

    // 芯片名称
    ctx.fillStyle = '#aaa';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MCU', 0, -4);

    // VDD 标注
    ctx.fillStyle = '#ff6b6b';
    ctx.font = '7px monospace';
    ctx.fillText('VDD', 0, 8);

    // 引脚状态指示灯（从 params 读取 pinStates）
    const pinStates = (component.params as any)?.pinStates as Record<number, string> | undefined;
    const halfPin = pinCount / 2;
    for (let i = 0; i < pinCount; i++) {
      const side = i < halfPin ? 'left' : 'right';
      const localIdx = side === 'left' ? i : i - halfPin;
      const rowOffset = (localIdx - (rows - 1) / 2) * pinSpacing;

      // 引脚连接线
      ctx.strokeStyle = this.config.portColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (side === 'left') {
        ctx.moveTo(-mcuW / 2, rowOffset);
        ctx.lineTo(-mcuW / 2 - 10, rowOffset);
      } else {
        ctx.moveTo(mcuW / 2, rowOffset);
        ctx.lineTo(mcuW / 2 + 10, rowOffset);
      }
      ctx.stroke();

      // 引脚状态灯
      const level = pinStates?.[i] ?? 'floating';
      let ledColor: string;
      switch (level) {
        case 'high': ledColor = '#00ff88'; break;
        case 'low': ledColor = '#ff4444'; break;
        default: ledColor = '#666666'; break;
      }

      const ledX = side === 'left' ? -mcuW / 2 + 6 : mcuW / 2 - 6;
      const ledY = rowOffset;
      ctx.fillStyle = ledColor;
      ctx.beginPath();
      ctx.arc(ledX, ledY, 3, 0, Math.PI * 2);
      ctx.fill();

      // 引脚编号小字
      const config = (component.params as any)?.mcuConfig as { pins?: Array<{ name: string }> } | undefined;
      const pinName = config?.pins?.[i]?.name ?? `P${i}`;
      ctx.fillStyle = '#888';
      ctx.font = '6px monospace';
      ctx.textAlign = side === 'left' ? 'right' : 'left';
      ctx.fillText(pinName, ledX + (side === 'left' ? -5 : 5), ledY + 2);
    }
  }

  // ==================== ADC/DAC 元件 ====================

  /** ADC 元件：梯形符号 + A/D 标注 */
  private drawADC(ctx: CanvasRenderingContext2D, component: CircuitComponent): void {
    const w = 50;
    const h = 36;

    // 梯形主体（窄边在左 = 模拟，宽边在右 = 数字）
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h / 2);       // 左上
    ctx.lineTo(w / 2 - 6, -h / 2);    // 右上（窄）
    ctx.lineTo(w / 2, -h / 2 + 6);    // 右上角收缩
    ctx.lineTo(w / 2, h / 2 - 6);     // 右下角收缩
    ctx.lineTo(w / 2 - 6, h / 2);     // 右下（窄）
    ctx.lineTo(-w / 2, h / 2);        // 左下
    ctx.closePath();
    ctx.fillStyle = '#2a2a3e';
    ctx.fill();
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 2;
    ctx.stroke();

    // A/D 标注
    ctx.fillStyle = '#a78bfa';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ADC', 0, -4);

    // 分辨率显示（从 params 读取）
    const resolution = (component.params as any)?.resolution ?? 12;
    ctx.font = '8px monospace';
    ctx.fillStyle = '#888';
    ctx.fillText(`${resolution}bit`, 0, 10);

    // 引脚标注
    ctx.font = '7px monospace';
    ctx.fillStyle = '#888';
    ctx.textAlign = 'right';
    ctx.fillText('AIN', -w / 2 - 3, -10);
    ctx.fillText('CLK', -w / 2 - 3, 10);
    ctx.textAlign = 'left';
    ctx.fillText('DOUT', w / 2 + 3, -10);
    ctx.fillText('GND', w / 2 + 3, 10);

    // 采样保持指示（小锯齿波形示意）
    ctx.strokeStyle = '#a78bfa66';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const stepW = 8;
    for (let i = 0; i < 4; i++) {
      const x = -16 + i * stepW;
      // 水平线（保持）
      ctx.moveTo(x, 6);
      ctx.lineTo(x + stepW, 6);
      // 阶梯（采样）
      ctx.moveTo(x + stepW, 6);
      ctx.lineTo(x + stepW, 6 + ((i % 3) - 1) * 3);
    }
    ctx.stroke();
  }

  /** DAC 元件：梯形符号 + D/A 标注 */
  private drawDAC(ctx: CanvasRenderingContext2D, component: CircuitComponent): void {
    const w = 50;
    const h = 36;

    // 梯形主体（宽边在左 = 数字，窄边在右 = 模拟）
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 6, -h / 2);   // 左上（窄）
    ctx.lineTo(w / 2, -h / 2);        // 右上
    ctx.lineTo(w / 2, h / 2);         // 右下
    ctx.lineTo(-w / 2 + 6, h / 2);    // 左下（窄）
    ctx.lineTo(-w / 2, h / 2 - 6);    // 左下角收缩
    ctx.lineTo(-w / 2, -h / 2 + 6);   // 左上角收缩
    ctx.closePath();
    ctx.fillStyle = '#2a2a3e';
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // D/A 标注
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DAC', 0, -4);

    // 分辨率显示
    const resolution = (component.params as any)?.resolution ?? 12;
    ctx.font = '8px monospace';
    ctx.fillStyle = '#888';
    ctx.fillText(`${resolution}bit`, 0, 10);

    // 引脚标注
    ctx.font = '7px monospace';
    ctx.fillStyle = '#888';
    ctx.textAlign = 'right';
    ctx.fillText('DIN', -w / 2 - 3, -10);
    ctx.textAlign = 'left';
    ctx.fillText('AOUT', w / 2 + 3, -10);
    ctx.fillText('GND', w / 2 + 3, 10);

    // 重构波形示意（阶梯波 → 平滑）
    ctx.strokeStyle = '#f59e0b66';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // 阶梯输入
    for (let i = 0; i < 4; i++) {
      const x = -16 + i * 8;
      ctx.moveTo(x, -6);
      ctx.lineTo(x + 4, -6);
      ctx.moveTo(x + 4, -6);
      ctx.lineTo(x + 4, -6 + ((i % 3) - 1) * 3);
    }
    ctx.stroke();
  }

  /** 通信协议元件：矩形块 + 协议标签 + Master/Slave 标记 */
  private drawProtocolBlock(ctx: CanvasRenderingContext2D, label: string, accentColor: string, isMaster: boolean): void {
    const w = 40;
    const h = 32;

    // 矩形主体
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-w / 2, -h / 2, w, h);

    // 填充背景（半透明）
    ctx.fillStyle = accentColor + '15';
    ctx.fillRect(-w / 2, -h / 2, w, h);

    // 协议标签
    ctx.fillStyle = accentColor;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, -5);

    // M/S 标记
    ctx.font = '8px monospace';
    ctx.fillStyle = '#888';
    ctx.fillText(isMaster ? 'M' : 'S', 0, 9);
  }

  // ==================== 温度传感器 ====================

  /** NTC热敏电阻：电阻符号 + θ 标记 */
  private drawNTCThermistor(ctx: CanvasRenderingContext2D): void {
    // 引脚线
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    ctx.lineTo(-15, 0);
    ctx.moveTo(15, 0);
    ctx.lineTo(25, 0);
    ctx.stroke();
    // 电阻体（带斜线标记 - NTC符号）
    ctx.strokeRect(-15, -6, 30, 12);
    // NTC标记：斜线表示负温度系数
    ctx.beginPath();
    ctx.moveTo(-10, 6);
    ctx.lineTo(-2, -6);
    ctx.moveTo(2, 6);
    ctx.lineTo(10, -6);
    ctx.stroke();
    // θ 符号（温度）
    ctx.font = '10px serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = this.config.componentColor;
    ctx.fillText('θ', 0, -12);
  }

  /** 热电偶：两条不同材质线 + 接点 */
  private drawThermocouple(ctx: CanvasRenderingContext2D): void {
    // 上引线
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    ctx.lineTo(-5, 0);
    ctx.stroke();
    // 下引线
    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.lineTo(25, 0);
    ctx.stroke();
    // 接点圆
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ff6b6b';
    ctx.fill();
    ctx.strokeStyle = this.config.componentColor;
    ctx.stroke();
    // 热端标记
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(0, -15);
    ctx.moveTo(-4, -15);
    ctx.lineTo(4, -15);
    ctx.stroke();
    // 箭头
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(-3, -12);
    ctx.moveTo(0, -15);
    ctx.lineTo(3, -12);
    ctx.stroke();
  }

  /** 光敏电阻 LDR：电阻符号 + 箭头 */
  private drawLDR(ctx: CanvasRenderingContext2D): void {
    // 引脚线
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    ctx.lineTo(-15, 0);
    ctx.moveTo(15, 0);
    ctx.lineTo(25, 0);
    ctx.stroke();
    // 电阻体
    ctx.strokeRect(-15, -6, 30, 12);
    // 入射光箭头
    ctx.beginPath();
    ctx.moveTo(-8, -18);
    ctx.lineTo(0, -10);
    ctx.moveTo(0, -10);
    ctx.lineTo(-4, -13);
    ctx.moveTo(0, -10);
    ctx.lineTo(-2, -15);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(2, -18);
    ctx.lineTo(10, -10);
    ctx.moveTo(10, -10);
    ctx.lineTo(6, -13);
    ctx.moveTo(10, -10);
    ctx.lineTo(8, -15);
    ctx.stroke();
  }

  /** 光电二极管：二极管 + 光箭头 */
  private drawPhotodiode(ctx: CanvasRenderingContext2D): void {
    // 引脚线
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    ctx.lineTo(-8, 0);
    ctx.moveTo(8, 0);
    ctx.lineTo(25, 0);
    ctx.stroke();
    // 三角形（阴极→阳极方向）
    ctx.beginPath();
    ctx.moveTo(8, -10);
    ctx.lineTo(-8, 0);
    ctx.lineTo(8, 10);
    ctx.closePath();
    ctx.stroke();
    // 竖线
    ctx.beginPath();
    ctx.moveTo(-8, -10);
    ctx.lineTo(-8, 10);
    ctx.stroke();
    // 光箭头（指向二极管）
    ctx.beginPath();
    ctx.moveTo(-4, -18);
    ctx.lineTo(4, -10);
    ctx.moveTo(4, -10);
    ctx.lineTo(0, -13);
    ctx.moveTo(4, -10);
    ctx.lineTo(2, -15);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(4, -18);
    ctx.lineTo(12, -10);
    ctx.moveTo(12, -10);
    ctx.lineTo(8, -13);
    ctx.moveTo(12, -10);
    ctx.lineTo(10, -15);
    ctx.stroke();
  }

  /** 光电晶体管：晶体管 + 光箭头 */
  private drawPhototransistor(ctx: CanvasRenderingContext2D): void {
    // 圆圈
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.stroke();
    // 基极线（无引脚，接收光）
    ctx.beginPath();
    ctx.moveTo(-8, -10);
    ctx.lineTo(-8, 10);
    ctx.stroke();
    // 集电极
    ctx.beginPath();
    ctx.moveTo(-3, -6);
    ctx.lineTo(15, -10);
    ctx.lineTo(25, -10);
    ctx.stroke();
    // 发射极
    ctx.beginPath();
    ctx.moveTo(-3, 6);
    ctx.lineTo(15, 10);
    ctx.lineTo(25, 10);
    ctx.stroke();
    // 箭头
    ctx.beginPath();
    ctx.moveTo(10, 6);
    ctx.lineTo(15, 10);
    ctx.lineTo(10, 13);
    ctx.stroke();
    // 光箭头
    ctx.beginPath();
    ctx.moveTo(-12, -18);
    ctx.lineTo(-4, -10);
    ctx.moveTo(-4, -10);
    ctx.lineTo(-8, -13);
    ctx.moveTo(-4, -10);
    ctx.lineTo(-6, -15);
    ctx.stroke();
  }

  // ==================== 压力/加速度传感器 ====================

  /** 压电传感器：电容符号 + 压力标记 */
  private drawPiezoSensor(ctx: CanvasRenderingContext2D): void {
    // 引脚
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    ctx.lineTo(-6, 0);
    ctx.moveTo(6, 0);
    ctx.lineTo(25, 0);
    ctx.stroke();
    // 平行板（更宽）
    ctx.beginPath();
    ctx.moveTo(-6, -14);
    ctx.lineTo(-6, 14);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(6, -14);
    ctx.lineTo(6, 14);
    ctx.stroke();
    // 压力箭头（从上往下）
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(0, -16);
    ctx.moveTo(-5, -16);
    ctx.lineTo(5, -16);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(-3, -18);
    ctx.moveTo(0, -16);
    ctx.lineTo(3, -18);
    ctx.stroke();
    // P 标记
    ctx.font = '9px monospace';
    ctx.fillStyle = this.config.componentColor;
    ctx.textAlign = 'center';
    ctx.fillText('P', 0, 22);
  }

  // ==================== 电源管理IC ====================

  /** 线性稳压器 (LDO)：矩形芯片 */
  private drawVoltageRegulator(ctx: CanvasRenderingContext2D, label: string): void {
    const w = 40;
    const h = 30;
    // 芯片主体
    ctx.fillStyle = '#2a2a3e';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = this.config.componentColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    // 标签
    ctx.fillStyle = this.config.componentColor;
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, -4);
    // VIN / VOUT 标注
    ctx.font = '7px monospace';
    ctx.fillStyle = '#ff6b6b';
    ctx.fillText('IN', -8, 8);
    ctx.fillStyle = '#4ecdc4';
    ctx.fillText('OUT', 8, 8);
    // GND
    ctx.fillStyle = '#888';
    ctx.fillText('GND', 0, 18);
  }

  /** DC-DC 变换器 */
  private drawDCDCConverter(ctx: CanvasRenderingContext2D, label: string): void {
    const w = 44;
    const h = 32;
    // 芯片主体
    ctx.fillStyle = '#2a2a3e';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = label === 'BUCK' ? '#4ecdc4' : '#ff9500';
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    // 标签
    ctx.fillStyle = label === 'BUCK' ? '#4ecdc4' : '#ff9500';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, -5);
    // 电感符号（DC-DC典型拓扑）
    ctx.strokeStyle = this.config.componentColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-10, 4);
    ctx.arc(-7, 4, 3, Math.PI, 0, false);
    ctx.arc(-1, 4, 3, Math.PI, 0, false);
    ctx.stroke();
    // VIN/VOUT
    ctx.font = '6px monospace';
    ctx.fillStyle = '#888';
    ctx.fillText('VIN', -10, 12);
    ctx.fillText('VOUT', 10, 12);
  }

  /** 电池符号 */
  private drawBattery(ctx: CanvasRenderingContext2D): void {
    // 正极（长线）
    ctx.beginPath();
    ctx.moveTo(-8, -10);
    ctx.lineTo(-8, 10);
    ctx.stroke();
    // 负极（短线）
    ctx.beginPath();
    ctx.moveTo(-2, -6);
    ctx.lineTo(-2, 6);
    ctx.stroke();
    // 第二对
    ctx.beginPath();
    ctx.moveTo(6, -10);
    ctx.lineTo(6, 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(12, -6);
    ctx.lineTo(12, 6);
    ctx.stroke();
    // 引脚
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    ctx.lineTo(-14, 0);
    ctx.moveTo(18, 0);
    ctx.lineTo(25, 0);
    ctx.stroke();
    // + / - 标记
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff6b6b';
    ctx.fillText('+', -18, -12);
    ctx.fillStyle = '#4ecdc4';
    ctx.fillText('−', 22, -12);
  }

  // ==================== 通信模块 ====================

  /** 无线通信模块 (BT/WiFi) */
  private drawCommModule(ctx: CanvasRenderingContext2D, label: string, color: string): void {
    const w = 44;
    const h = 34;
    // 芯片主体
    ctx.fillStyle = '#2a2a3e';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    // 模块标签
    ctx.fillStyle = color;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, -4);
    // 天线符号（波浪线）
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(0, -h / 2 - 8);
    ctx.stroke();
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(0, -h / 2 - 8 - i * 4, i * 3, -Math.PI * 0.7, -Math.PI * 0.3);
      ctx.stroke();
    }
    // 引脚标注
    ctx.font = '6px monospace';
    ctx.fillStyle = '#888';
    ctx.fillText('VCC', 0, 8);
  }

  /** 通用数字传感器模块 */
  private drawDigitalSensor(ctx: CanvasRenderingContext2D, label: string, color: string): void {
    const w = 40;
    const h = 28;
    // 芯片主体
    ctx.fillStyle = '#2a2a3e';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    // 标签
    ctx.fillStyle = color;
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, -3);
    // 接口标注
    ctx.font = '6px monospace';
    ctx.fillStyle = '#888';
    ctx.fillText('DATA', 0, 8);
  }

  /** 蜂鸣器符号 */
  private drawBuzzer(ctx: CanvasRenderingContext2D, isActive: boolean): void {
    // 圆形外壳
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.stroke();
    // 引脚
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    ctx.lineTo(-14, 0);
    ctx.moveTo(14, 0);
    ctx.lineTo(25, 0);
    ctx.stroke();
    // 内部符号
    if (isActive) {
      // 有源：+ 标记
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = this.config.componentColor;
      ctx.fillText('+', 0, 0);
    } else {
      // 无源：声波符号
      ctx.beginPath();
      ctx.arc(4, 0, 6, -0.5, 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(4, 0, 10, -0.4, 0.4);
      ctx.stroke();
    }
  }

  /** 继电器：线圈 + 开关 */
  private drawRelay(ctx: CanvasRenderingContext2D): void {
    // 线圈（左侧）
    ctx.beginPath();
    ctx.moveTo(-25, -8);
    ctx.lineTo(-18, -8);
    for (let i = 0; i < 3; i++) {
      const cx = -14 + i * 6;
      ctx.arc(cx, -8, 3, Math.PI, 0, false);
    }
    ctx.lineTo(2, -8);
    ctx.stroke();
    // 开关触点（右侧）
    ctx.beginPath();
    ctx.moveTo(2, -8);
    ctx.lineTo(8, -4);
    ctx.moveTo(8, -4);
    ctx.lineTo(18, -4);
    ctx.stroke();
    // 常闭触点
    ctx.beginPath();
    ctx.moveTo(8, -4);
    ctx.lineTo(8, 4);
    ctx.stroke();
    // 常闭引脚
    ctx.beginPath();
    ctx.moveTo(18, 4);
    ctx.lineTo(8, 4);
    ctx.lineTo(25, 4);
    ctx.stroke();
    // COM 引脚
    ctx.beginPath();
    ctx.moveTo(-25, -8);
    ctx.moveTo(2, -8);
    ctx.lineTo(2, -14);
    ctx.lineTo(25, -14);
    ctx.stroke();
    // NO 引脚
    ctx.beginPath();
    ctx.moveTo(18, -4);
    ctx.lineTo(25, -4);
    ctx.stroke();
    // 线圈引脚
    ctx.beginPath();
    ctx.moveTo(-25, -8);
    ctx.lineTo(-30, -8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(2, -8);
    ctx.lineTo(2, 8);
    ctx.lineTo(-30, 8);
    ctx.stroke();
    // 标注
    ctx.font = '7px monospace';
    ctx.fillStyle = '#888';
    ctx.textAlign = 'center';
    ctx.fillText('COM', 14, -16);
    ctx.fillText('NO', 22, -6);
    ctx.fillText('NC', 22, 6);
  }

  /** 步进电机：圆圈 + M */
  private drawStepperMotor(ctx: CanvasRenderingContext2D): void {
    // 圆形外壳
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#2a2a3e';
    ctx.fill();
    ctx.strokeStyle = this.config.componentColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    // M 标记
    ctx.fillStyle = this.config.componentColor;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('M', 0, 0);
    // 引脚（四线）
    ctx.strokeStyle = this.config.portColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-25, -10);
    ctx.lineTo(-18, -10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-25, 10);
    ctx.lineTo(-18, 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(18, -10);
    ctx.lineTo(25, -10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(18, 10);
    ctx.lineTo(25, 10);
    ctx.stroke();
    // 绕组标记
    ctx.strokeStyle = this.config.componentColor;
    ctx.beginPath();
    ctx.moveTo(-12, -10);
    for (let i = 0; i < 2; i++) {
      ctx.arc(-8 + i * 8, -10, 4, Math.PI, 0, false);
    }
    ctx.lineTo(4, -10);
    ctx.stroke();
  }

  /** LCD 显示屏接口 */
  private drawLCDDisplay(ctx: CanvasRenderingContext2D): void {
    const w = 50;
    const h = 36;
    // 屏幕主体
    ctx.fillStyle = '#1a2a3e';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = '#4ecdc4';
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    // 屏幕文字
    ctx.fillStyle = '#4ecdc4';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LCD', 0, -6);
    ctx.font = '6px monospace';
    ctx.fillStyle = '#888';
    ctx.fillText('16x2', 0, 6);
    // 引脚（底部6个）
    for (let i = 0; i < 6; i++) {
      const x = -20 + i * 8;
      ctx.strokeStyle = this.config.portColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, h / 2);
      ctx.lineTo(x, h / 2 + 10);
      ctx.stroke();
    }
    // 引脚标注
    ctx.font = '5px monospace';
    ctx.fillStyle = '#666';
    ctx.fillText('VSS VDD V0 RS RW E', 0, h / 2 + 16);
  }

  // ==================== 测量探针 ====================

  /** 电压探针：向下三角形 + V 标记 */
  private drawVoltageProbe(ctx: CanvasRenderingContext2D): void {
    // 探针尖端（向下）
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(-10, 5);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-3, 12);
    ctx.lineTo(3, 12);
    ctx.lineTo(3, 0);
    ctx.lineTo(10, 5);
    ctx.closePath();
    ctx.fillStyle = '#ff6b6b30';
    ctx.fill();
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // V 标记
    ctx.fillStyle = '#ff6b6b';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('V', 0, 4);

    // 连接引脚（向上）
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(0, -25);
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  /** 电流探针：圆形钳口 + I 标记 */
  private drawCurrentProbe(ctx: CanvasRenderingContext2D): void {
    // 钳形外观
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#4ecdc420';
    ctx.fill();
    ctx.strokeStyle = '#4ecdc4';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 内部缺口（钳口）
    ctx.beginPath();
    ctx.moveTo(-4, -12);
    ctx.lineTo(-4, -5);
    ctx.moveTo(4, -12);
    ctx.lineTo(4, -5);
    ctx.stroke();

    // I 标记
    ctx.fillStyle = '#4ecdc4';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('I', 0, 3);

    // 引脚
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(0, -25);
    ctx.strokeStyle = '#4ecdc4';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  /** 功率探针：菱形 + P 标记 */
  private drawPowerProbe(ctx: CanvasRenderingContext2D): void {
    // 菱形
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(12, 0);
    ctx.lineTo(0, 15);
    ctx.lineTo(-12, 0);
    ctx.closePath();
    ctx.fillStyle = '#ffd93d20';
    ctx.fill();
    ctx.strokeStyle = '#ffd93d';
    ctx.lineWidth = 2;
    ctx.stroke();

    // P 标记
    ctx.fillStyle = '#ffd93d';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('P', 0, 0);

    // 引脚
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(0, -25);
    ctx.strokeStyle = '#ffd93d';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  /** 555 定时器：8 引脚 DIP 封装 */
  private drawTimer555(ctx: CanvasRenderingContext2D): void {
    const w = 44;
    const h = 36;
    // 芯片主体
    ctx.fillStyle = '#2a2a3e';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = '#e05555';
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    // 标签
    ctx.fillStyle = '#e05555';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('555', 0, -3);
    // 引脚标签
    ctx.font = '6px monospace';
    ctx.fillStyle = '#888';
    ctx.fillText('TRG', -16, -8);
    ctx.fillText('THR', -16, 4);
    ctx.fillText('DIS', -16, 14);
    ctx.fillText('OUT', 16, -4);
    ctx.fillText('CTL', 16, 8);
  }

  /** 光电耦合器：LED + 光敏管 */
  private drawOptocoupler(ctx: CanvasRenderingContext2D): void {
    const w = 44;
    const h = 34;
    // 芯片主体
    ctx.fillStyle = '#2a2a3e';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = '#ff9500';
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    // 输入侧 LED 符号
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-12, -8);
    ctx.lineTo(-12, 8);
    ctx.stroke();
    // LED 三角
    ctx.beginPath();
    ctx.moveTo(-12, -6);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-12, 6);
    ctx.closePath();
    ctx.stroke();
    // 箭头（光）
    ctx.strokeStyle = '#ffd93d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-2, -4);
    ctx.lineTo(8, -4);
    ctx.moveTo(6, -6);
    ctx.lineTo(8, -4);
    ctx.lineTo(6, -2);
    ctx.stroke();
    // 输出侧光敏管
    ctx.strokeStyle = '#4ecdc4';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(12, -8);
    ctx.lineTo(12, 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(12, -6);
    ctx.lineTo(20, 0);
    ctx.lineTo(12, 6);
    ctx.stroke();
    // 基极线
    ctx.beginPath();
    ctx.moveTo(12, -2);
    ctx.lineTo(20, -8);
    ctx.stroke();
    // 标签
    ctx.fillStyle = '#ff9500';
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('OPTO', 0, 13);
  }

  /** 简单的值格式化 */
  private formatValue(value: number, unit: string): string {
    const prefixes: [number, string][] = [
      [1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'],
      [1, ''], [1e-3, 'm'], [1e-6, 'μ'], [1e-9, 'n'], [1e-12, 'p'],
    ];
    for (const [threshold, prefix] of prefixes) {
      if (Math.abs(value) >= threshold) {
        const formatted = (value / threshold).toFixed(threshold >= 1 ? 0 : 2);
        return `${formatted}${prefix}${unit}`;
      }
    }
    return `${value}${unit}`;
  }
}
