/**
 * WebGL 电路渲染器
 * 使用 WebGL 1.0 批量渲染电路元件、连线、网格
 * 文本通过 2D overlay canvas 渲染
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
  GPIOLevel,
} from '../../types/circuit';
import { ComponentType, ValidationSeverity, NetLabelKind } from '../../types/circuit';
import { calculateWirePoints } from '../circuit/wire-routing';
import { createProgram, hexToRgba } from './webgl-utils';
import { BASE_VERT, GRID_FRAG, FILL_VERT, FILL_FRAG } from './shaders';
import { VisualEffectsEngine, type VFXConfig } from './VisualEffectsEngine';

/** 引脚电平对应 RGBA 颜色 */
function pinLevelColorRGBA(level?: GPIOLevel): [number, number, number, number] {
  switch (level) {
    case 'high': return [0.18, 0.80, 0.44, 1.0];   // #2ecc71 绿色
    case 'low':  return [0.42, 0.54, 0.60, 1.0];    // 灰色
    default:     return [0.95, 0.77, 0.06, 1.0];    // #f1c40f 黄色（高阻/浮动）
  }
}

/** 渲染器配置（与 CanvasRenderer 一致） */
export interface RendererConfig {
  gridSize: number;
  showGrid: boolean;
  backgroundColor: string;
  gridColor: string;
  wireColor: string;
  componentColor: string;
  selectionColor: string;
  wireSelectionColor: string;
  portColor: string;
  portSnapColor: string;
  wirePreviewColor: string;
}

const DEFAULT_RENDERER_CONFIG: RendererConfig = {
  gridSize: 20,
  showGrid: true,
  backgroundColor: '#1a1a2e',
  gridColor: '#2a2a4a',
  wireColor: '#00d4ff',
  componentColor: '#e0e0e0',
  selectionColor: '#4488ff',
  wireSelectionColor: '#ff6b6b',
  portColor: '#4ecdc4',
  portSnapColor: '#ffd93d',
  wirePreviewColor: '#8888ff',
};

/** 6 floats per vertex: px, py, r, g, b, a */
const FVF = 6;

export class WebGLRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private config: RendererConfig;
  private transform: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };

  // Shader programs
  private gridProg: WebGLProgram;
  private fillProg: WebGLProgram;

  // Buffers
  private vbo: WebGLBuffer;

  // Attribute locations
  private gridAPos = 0;
  private fillAPos = 0;
  private fillAColor = 0;

  // Batch accumulators (screen-space coordinates)
  private lineV: number[] = [];
  private dashV: number[] = [];
  private circV: number[] = [];
  private fillV: number[] = [];

  // Text overlay (2D canvas)
  private overlay: HTMLCanvasElement | null = null;
  private octx: CanvasRenderingContext2D | null = null;

  // Visual effects engine
  private vfx: VisualEffectsEngine | null = null;
  private _simulating: boolean = false;

  // Animation time tracking
  private _animTime: number = 0;
  private _lastFrameTime: number = 0;

  constructor(canvas: HTMLCanvasElement, config: Partial<RendererConfig> = {}) {
    this.canvas = canvas;
    this.config = { ...DEFAULT_RENDERER_CONFIG, ...config };

    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: true,
      premultipliedAlpha: false,
    });
    if (!gl) throw new Error('Failed to get WebGL context');
    this.gl = gl;

    // Compile shader programs
    this.gridProg = createProgram(gl, BASE_VERT, GRID_FRAG);
    this.fillProg = createProgram(gl, FILL_VERT, FILL_FRAG);

    // Create shared VBO
    const buf = gl.createBuffer();
    if (!buf) throw new Error('Failed to create buffer');
    this.vbo = buf;

    // Cache attribute locations
    this.gridAPos = gl.getAttribLocation(this.gridProg, 'a_position');
    this.fillAPos = gl.getAttribLocation(this.fillProg, 'a_position');
    this.fillAColor = gl.getAttribLocation(this.fillProg, 'a_color');

    // Setup text overlay canvas for labels
    this.setupOverlay();

    // Initialize visual effects engine
    try {
      this.vfx = new VisualEffectsEngine(gl, canvas);
    } catch (e) {
      console.warn('VFX engine init failed:', e);
    }

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  /** 更新视觉效果配置 */
  setVFXConfig(config: Partial<VFXConfig>): void {
    this.vfx?.updateConfig(config);
  }

  /** 设置仿真运行状态 */
  setSimulating(running: boolean): void {
    this._simulating = running;
  }

  /** Create a transparent 2D canvas overlay for text rendering */
  private setupOverlay(): void {
    const overlay = document.createElement('canvas');
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '1';

    const parent = this.canvas.parentElement;
    if (parent) {
      const cs = getComputedStyle(parent);
      if (cs.position === 'static') parent.style.position = 'relative';
      parent.appendChild(overlay);
    }

    this.overlay = overlay;
    this.octx = overlay.getContext('2d');
  }

  // ==================== Public API ====================

  setTransform(transform: ViewTransform): void {
    this.transform = transform;
  }

  getTransform(): ViewTransform {
    return { ...this.transform };
  }

  screenToCanvas(screenX: number, screenY: number): Point {
    return {
      x: (screenX - this.transform.offsetX) / this.transform.scale,
      y: (screenY - this.transform.offsetY) / this.transform.scale,
    };
  }

  /** Update canvas and overlay dimensions */
  resize(): void {
    const { gl } = this;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    if (this.overlay) {
      this.overlay.width = this.canvas.width;
      this.overlay.height = this.canvas.height;
    }
  }

  // ==================== Batch Helpers ====================

  private resetBatches(): void {
    this.lineV.length = 0;
    this.dashV.length = 0;
    this.circV.length = 0;
    this.fillV.length = 0;
  }

  /** Add a thick line segment to the regular line batch (screen coords) */
  private addLine(
    x1: number, y1: number, x2: number, y2: number,
    thickness: number, color: [number, number, number, number]
  ): void {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const half = thickness * 0.5;
    let nx = 0, ny = 0;
    if (len > 0.001) { nx = (-dy / len) * half; ny = (dx / len) * half; }
    const [r, g, b, a] = color;
    const ax = x1+nx, ay = y1+ny, bx = x1-nx, by = y1-ny;
    const cx = x2+nx, cy = y2+ny, dx2 = x2-nx, dy2 = y2-ny;
    this.lineV.push(
      ax,ay,r,g,b,a, bx,by,r,g,b,a, cx,cy,r,g,b,a,
      bx,by,r,g,b,a, cx,cy,r,g,b,a, dx2,dy2,r,g,b,a
    );
  }

  /** Add a dashed line segment to the dashed batch (screen coords) */
  private addDashed(
    x1: number, y1: number, x2: number, y2: number,
    thickness: number, color: [number, number, number, number],
    dash: number, gap: number
  ): void {
    const dx = x2-x1, dy = y2-y1, len = Math.hypot(dx, dy);
    if (len < 0.001) return;
    const dirX = dx/len, dirY = dy/len, half = thickness*0.5;
    const nx = -dirY*half, ny = dirX*half;
    const [r,g,b,a] = color;
    const period = dash + gap;
    let dist = 0;
    while (dist < len) {
      const end = Math.min(dist + dash, len);
      const sx = x1+dirX*dist, sy = y1+dirY*dist;
      const ex = x1+dirX*end, ey = y1+dirY*end;
      this.dashV.push(
        sx+nx,sy+ny,r,g,b,a, sx-nx,sy-ny,r,g,b,a, ex+nx,ey+ny,r,g,b,a,
        sx-nx,sy-ny,r,g,b,a, ex+nx,ey+ny,r,g,b,a, ex-nx,ey-ny,r,g,b,a
      );
      dist += period;
    }
  }

  /** Add a filled rectangle to the batch (screen coords) */
  private addFill(
    x: number, y: number, w: number, h: number,
    color: [number, number, number, number]
  ): void {
    const [r,g,b,a] = color, x2 = x+w, y2 = y+h;
    this.fillV.push(
      x,y,r,g,b,a, x2,y,r,g,b,a, x,y2,r,g,b,a,
      x2,y,r,g,b,a, x2,y2,r,g,b,a, x,y2,r,g,b,a
    );
  }

  // ==================== Flush (upload + draw) ====================

  private flushAll(): void {
    const { gl } = this;
    gl.useProgram(this.fillProg);
    gl.uniform2f(
      gl.getUniformLocation(this.fillProg, 'u_resolution'),
      this.canvas.width, this.canvas.height
    );
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);

    if (this.fillAPos >= 0) {
      gl.enableVertexAttribArray(this.fillAPos);
      gl.vertexAttribPointer(this.fillAPos, 2, gl.FLOAT, false, 24, 0);
    }
    if (this.fillAColor >= 0) {
      gl.enableVertexAttribArray(this.fillAColor);
      gl.vertexAttribPointer(this.fillAColor, 4, gl.FLOAT, false, 24, 8);
    }

    // Filled rects
    if (this.fillV.length > 0) {
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.fillV), gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, this.fillV.length / FVF);
    }

    // Lines
    if (this.lineV.length > 0) {
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.lineV), gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, this.lineV.length / FVF);
    }

    // Circles (same vertex layout as fill)
    if (this.circV.length > 0) {
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.circV), gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, this.circV.length / FVF);
    }

    // Dashed lines
    if (this.dashV.length > 0) {
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.dashV), gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, this.dashV.length / FVF);
    }
  }

  // ==================== Grid ====================

  private drawGrid(): void {
    const { gl } = this;
    gl.useProgram(this.gridProg);

    const bg = hexToRgba(this.config.backgroundColor);
    const gc = hexToRgba(this.config.gridColor);
    gl.uniform4f(gl.getUniformLocation(this.gridProg, 'u_bgColor')!, bg[0], bg[1], bg[2], bg[3]);
    gl.uniform4f(gl.getUniformLocation(this.gridProg, 'u_gridColor')!, gc[0], gc[1], gc[2], gc[3]);
    gl.uniform1f(gl.getUniformLocation(this.gridProg, 'u_gridSize')!, this.config.gridSize * this.transform.scale);
    gl.uniform2f(gl.getUniformLocation(this.gridProg, 'u_offset')!, this.transform.offsetX, this.transform.offsetY);
    gl.uniform2f(gl.getUniformLocation(this.gridProg, 'u_resolution')!, this.canvas.width, this.canvas.height);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    if (this.gridAPos >= 0) {
      gl.enableVertexAttribArray(this.gridAPos);
      gl.vertexAttribPointer(this.gridAPos, 2, gl.FLOAT, false, 0, 0);
    }
    // Disable fill color attribute during grid pass
    if (this.fillAColor >= 0) gl.disableVertexAttribArray(this.fillAColor);

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, 0, this.canvas.width, 0, 0, this.canvas.height,
      this.canvas.width, 0, this.canvas.width, this.canvas.height, 0, this.canvas.height,
    ]), gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // ==================== Component Geometry (local coords) ====================

  /** Transform a local point by component position and rotation, return screen coords */
  private tx(x: number, y: number, comp: CircuitComponent): [number, number] {
    const rad = (comp.rotation * Math.PI) / 180;
    const c = Math.cos(rad), s = Math.sin(rad);
    return [
      (comp.position.x + x*c - y*s) * this.transform.scale + this.transform.offsetX,
      (comp.position.y + x*s + y*c) * this.transform.scale + this.transform.offsetY,
    ];
  }

  /** Helper: add line in local component coords */
  private cLine(
    x1: number, y1: number, x2: number, y2: number,
    comp: CircuitComponent, thickness: number,
    color: [number, number, number, number]
  ): void {
    const [a, b] = this.tx(x1, y1, comp);
    const [c, d] = this.tx(x2, y2, comp);
    this.addLine(a, b, c, d, thickness, color);
  }

  /** Helper: add dashed rect in local component coords */
  private cDashRect(
    x: number, y: number, w: number, h: number,
    comp: CircuitComponent, thickness: number,
    color: [number, number, number, number]
  ): void {
    const [x1,y1] = this.tx(x, y, comp);
    const [x2,y2] = this.tx(x+w, y, comp);
    const [x3,y3] = this.tx(x+w, y+h, comp);
    const [x4,y4] = this.tx(x, y+h, comp);
    this.addDashed(x1,y1,x2,y2, thickness, color, 4, 4);
    this.addDashed(x2,y2,x3,y3, thickness, color, 4, 4);
    this.addDashed(x3,y3,x4,y4, thickness, color, 4, 4);
    this.addDashed(x4,y4,x1,y1, thickness, color, 4, 4);
  }

  /** Approximate filled circle as triangle fan (screen coords) */
  private addCircleFill(
    cx: number, cy: number, radius: number,
    color: [number, number, number, number]
  ): void {
    const seg = Math.max(8, Math.ceil(radius * 0.8));
    const [r, g, b, a] = color;
    for (let i = 0; i < seg; i++) {
      const a1 = (i / seg) * Math.PI * 2;
      const a2 = ((i + 1) / seg) * Math.PI * 2;
      this.circV.push(
        cx, cy, r, g, b, a,
        cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius, r, g, b, a,
        cx + Math.cos(a2) * radius, cy + Math.sin(a2) * radius, r, g, b, a
      );
    }
  }

  /** Approximate circle outline via short line segments (screen coords) */
  private addCircleOutline(
    cx: number, cy: number, radius: number, thickness: number,
    color: [number, number, number, number]
  ): void {
    const seg = Math.max(12, Math.ceil(radius * 1.2));
    for (let i = 0; i < seg; i++) {
      const a1 = (i / seg) * Math.PI * 2;
      const a2 = ((i + 1) / seg) * Math.PI * 2;
      this.addLine(
        cx + Math.cos(a1)*radius, cy + Math.sin(a1)*radius,
        cx + Math.cos(a2)*radius, cy + Math.sin(a2)*radius,
        thickness, color
      );
    }
  }

  // ==================== LED & Simulation Drawing ====================

  /** 径向渐变发光圆（多层半透明圆模拟） */
  private addGlowCircle(
    cx: number, cy: number, radius: number,
    color: [number, number, number, number],
    layers: number = 5,
  ): void {
    const [r, g, b] = color;
    for (let i = layers; i >= 0; i--) {
      const t = i / layers;
      const layerR = radius * (0.3 + t * 0.7);
      const alpha = (1 - t) * 0.2;
      this.addCircleFill(cx, cy, layerR, [r, g, b, alpha]);
    }
  }

  /** 绘制 LED（带 PWM 亮度发光效果） */
  private drawLED(comp: CircuitComponent, col: [number, number, number, number]): void {
    const T = 2;
    const duty = comp.simState?.pwmDuty ?? 0;
    const { scale } = this.transform;
    const [cx, cy] = this.tx(0, 0, comp);

    // 引脚线
    this.cLine(0, -20, 0, -14, comp, T, col);
    this.cLine(0, 14, 0, 20, comp, T, col);

    // 三角形（二极管符号）
    const triR = 12 * scale;
    const t1x = this.tx(-triR / scale, -triR / scale, comp);
    const t2x = this.tx(triR / scale, -triR / scale, comp);
    const t3x = this.tx(0, triR / scale, comp);

    // 填充三角形
    const [r, g, b, a] = col;
    this.fillV.push(
      t1x[0], t1x[1], r, g, b, a,
      t2x[0], t2x[1], r, g, b, a,
      t3x[0], t3x[1], r, g, b, a,
    );

    // 竖线（二极管右侧）
    this.cLine(10, -12, 10, 12, comp, T, col);

    // === PWM 亮度发光效果 ===
    if (duty > 0.01) {
      const glowR = (14 + duty * 14) * scale;
      const glowAlpha = duty * 0.7;

      // 主发光层（黄橙色）
      const glowCol: [number, number, number, number] = [
        1.0,
        0.85 - duty * 0.3,
        0.24 - duty * 0.15,
        glowAlpha,
      ];
      this.addGlowCircle(cx, cy, glowR, glowCol, 6);

      // 核心亮点
      const coreR = (4 + duty * 4) * scale;
      const pulse = 0.85 + 0.15 * Math.sin(this._animTime * 8 * duty);
      this.addCircleFill(cx, cy, coreR, [1.0, 0.9, 0.3, glowAlpha * pulse]);

      // 外围脉冲光晕
      if (duty > 0.3) {
        const pulseR = glowR * (0.9 + 0.1 * Math.sin(this._animTime * 6));
        this.addCircleOutline(cx, cy, pulseR, 1.5, [1.0, 0.85, 0.2, duty * 0.15 * pulse]);
      }
    } else {
      // 熄灭状态 - 暗色内核
      this.addCircleFill(cx, cy, 5 * scale, [0.29, 0.23, 0.16, 1.0]);
    }
  }

  /** 绘制连线上的电流流动小点 */
  private drawCurrentDots(wire: Wire, col: [number, number, number, number]): void {
    const current = wire.current ?? 0;
    if (Math.abs(current) < 0.001) return;
    if (wire.points.length < 2) return;

    const { scale, offsetX, offsetY } = this.transform;

    // 计算各段长度
    const segments: { x1: number; y1: number; x2: number; y2: number; len: number }[] = [];
    let totalLen = 0;
    for (let i = 0; i < wire.points.length - 1; i++) {
      const p1 = wire.points[i], p2 = wire.points[i + 1];
      const sx1 = p1.x * scale + offsetX, sy1 = p1.y * scale + offsetY;
      const sx2 = p2.x * scale + offsetX, sy2 = p2.y * scale + offsetY;
      const len = Math.hypot(sx2 - sx1, sy2 - sy1);
      segments.push({ x1: sx1, y1: sy1, x2: sx2, y2: sy2, len });
      totalLen += len;
    }
    if (totalLen < 1) return;

    const dotSpacing = 18 * scale;
    const numDots = Math.max(1, Math.ceil(totalLen / dotSpacing));
    const flowSpeed = Math.sign(current) * Math.min(Math.abs(current) * 30, 80) * scale;
    const flowOffset = (this._animTime * flowSpeed) % dotSpacing;

    for (let d = 0; d < numDots; d++) {
      let dist = (((d * dotSpacing + flowOffset) % totalLen) + totalLen) % totalLen;

      for (const seg of segments) {
        if (dist <= seg.len) {
          const t = seg.len > 0 ? dist / seg.len : 0;
          const px = seg.x1 + (seg.x2 - seg.x1) * t;
          const py = seg.y1 + (seg.y2 - seg.y1) * t;
          const alpha = 0.5 + 0.5 * Math.sin(this._animTime * 5 + d * 0.7);
          const dotR = 2.5 * scale;
          // 发光小点
          this.addCircleFill(px, py, dotR, [0, 1.0, 0.78, alpha]);
          // 外层光晕
          this.addCircleFill(px, py, dotR * 2, [0, 1.0, 0.78, alpha * 0.15]);
          break;
        }
        dist -= seg.len;
      }
    }
  }

  // ==================== Component Symbol Drawing ====================

  private drawResistor(comp: CircuitComponent, col: [number, number, number, number]): void {
    const T = 2;
    // Leads
    this.cLine(-25,0, -15,0, comp, T, col);
    this.cLine(15,0, 25,0, comp, T, col);
    // Zigzag body
    for (let i = 0; i < 4; i++) {
      const x = -15 + i * 8;
      this.cLine(x, 0, x+2, -6, comp, T, col);
      this.cLine(x+2, -6, x+4, 6, comp, T, col);
      this.cLine(x+4, 6, x+6, -6, comp, T, col);
    }
    this.cLine(14, 0, 15, 0, comp, T, col);
  }

  private drawCapacitor(comp: CircuitComponent, col: [number, number, number, number]): void {
    const T = 2;
    this.cLine(-25,0, -4,0, comp, T, col);
    this.cLine(-4,-10, -4,10, comp, T, col);
    this.cLine(4,-10, 4,10, comp, T, col);
    this.cLine(4,0, 25,0, comp, T, col);
  }

  private drawInductor(comp: CircuitComponent, col: [number, number, number, number]): void {
    const T = 2;
    this.cLine(-25,0, -15,0, comp, T, col);
    this.cLine(15,0, 25,0, comp, T, col);
    // 4 semicircle arcs approximated with line segments
    for (let i = 0; i < 4; i++) {
      const cx = -10 + i * 7;
      const seg = 10;
      for (let j = 0; j < seg; j++) {
        const a1 = Math.PI + (j / seg) * Math.PI;
        const a2 = Math.PI + ((j + 1) / seg) * Math.PI;
        this.cLine(
          cx + Math.cos(a1)*4, Math.sin(a1)*4,
          cx + Math.cos(a2)*4, Math.sin(a2)*4,
          comp, T, col
        );
      }
    }
  }

  private drawDCSource(comp: CircuitComponent, col: [number, number, number, number]): void {
    const T = 2;
    this.cLine(-25,0, -15,0, comp, T, col);
    this.cLine(15,0, 25,0, comp, T, col);
    this.addCircleOutline(...this.tx(0,0,comp), 15*this.transform.scale, T, col);
    // + / − symbols
    this.cLine(-4,-5, 4,-5, comp, T, col);
    this.cLine(0,-9, 0,-1, comp, T, col);
    this.cLine(-4,7, 4,7, comp, T, col);
  }

  private drawACSource(comp: CircuitComponent, col: [number, number, number, number]): void {
    const T = 2;
    this.cLine(-25,0, -15,0, comp, T, col);
    this.cLine(15,0, 25,0, comp, T, col);
    this.addCircleOutline(...this.tx(0,0,comp), 15*this.transform.scale, T, col);
    // Sine wave symbol
    const seg = 16;
    for (let j = 0; j < seg; j++) {
      const x1 = -8 + (j / seg) * 16;
      const x2 = -8 + ((j + 1) / seg) * 16;
      this.cLine(
        x1, Math.sin((x1 / 8) * Math.PI) * 5,
        x2, Math.sin((x2 / 8) * Math.PI) * 5,
        comp, T, col
      );
    }
  }

  private drawGround(comp: CircuitComponent, col: [number, number, number, number]): void {
    const T = 2;
    this.cLine(0, -15, 0, 0, comp, T, col);
    this.cLine(-10, 0, 10, 0, comp, T, col);
    this.cLine(-6, 5, 6, 5, comp, T, col);
    this.cLine(-3, 10, 3, 10, comp, T, col);
  }

  // ==================== Main Render Methods ====================

  private drawComponentSymbol(comp: CircuitComponent): void {
    const col = hexToRgba(this.config.componentColor);
    switch (comp.type) {
      case ComponentType.LED:
      case ComponentType.Diode:        this.drawLED(comp, col); break;
      case ComponentType.Resistor:     this.drawResistor(comp, col); break;
      case ComponentType.Capacitor:    this.drawCapacitor(comp, col); break;
      case ComponentType.Inductor:     this.drawInductor(comp, col); break;
      case ComponentType.DCSource:
      case ComponentType.VoltageSource: this.drawDCSource(comp, col); break;
      case ComponentType.ACSource:     this.drawACSource(comp, col); break;
      case ComponentType.Ground:       this.drawGround(comp, col); break;
      default: {
        // 模块类元件：根据端口动态渲染多引脚芯片
        const ports = comp.ports;
        if (ports.length === 0) { break; }

        // 将端口按方向分组
        const topPins: typeof ports = [];
        const bottomPins: typeof ports = [];
        const leftPins: typeof ports = [];
        const rightPins: typeof ports = [];
        const pinGap = 8; // 引脚间距

        for (const p of ports) {
          if (p.offset.y < 0 && Math.abs(p.offset.y) >= Math.abs(p.offset.x)) topPins.push(p);
          else if (p.offset.y > 0 && Math.abs(p.offset.y) >= Math.abs(p.offset.x)) bottomPins.push(p);
          else if (p.offset.x < 0) leftPins.push(p);
          else rightPins.push(p);
        }

        // 引脚线长度
        const pinLen = 10;

        // 计算矩形边界
        const leftWidth = leftPins.length > 0 ? pinLen : 0;
        const rightWidth = rightPins.length > 0 ? pinLen : 0;
        const topHeight = topPins.length > 0 ? pinLen : 0;
        const bottomHeight = bottomPins.length > 0 ? pinLen : 0;

        // 排列引脚并计算矩形大小
        const sidePinCount = Math.max(leftPins.length, rightPins.length, 2);
        const vertSpan = sidePinCount * pinGap;
        const boxH = Math.max(vertSpan, 30);
        const topBottomPinCount = Math.max(topPins.length, bottomPins.length, 1);
        const horizSpan = topBottomPinCount * pinGap;
        const boxW = Math.max(horizSpan, 30);

        const boxL = -boxW / 2;
        const boxR = boxW / 2;
        const boxT = -boxH / 2;
        const boxB = boxH / 2;

        // 画芯片矩形
        this.cLine(boxL, boxT, boxR, boxT, comp, 2, col);
        this.cLine(boxR, boxT, boxR, boxB, comp, 2, col);
        this.cLine(boxR, boxB, boxL, boxB, comp, 2, col);
        this.cLine(boxL, boxB, boxL, boxT, comp, 2, col);

        // 左侧引脚（从上到下排列）
        for (let i = 0; i < leftPins.length; i++) {
          const y = boxT + (i + 1) * boxH / (leftPins.length + 1);
          this.cLine(boxL - pinLen, y, boxL, y, comp, 2, col);
        }
        // 右侧引脚
        for (let i = 0; i < rightPins.length; i++) {
          const y = boxT + (i + 1) * boxH / (rightPins.length + 1);
          this.cLine(boxR, y, boxR + pinLen, y, comp, 2, col);
        }
        // 上方引脚
        for (let i = 0; i < topPins.length; i++) {
          const x = boxL + (i + 1) * boxW / (topPins.length + 1);
          this.cLine(x, boxT - pinLen, x, boxT, comp, 2, col);
        }
        // 下方引脚
        for (let i = 0; i < bottomPins.length; i++) {
          const x = boxL + (i + 1) * boxW / (bottomPins.length + 1);
          this.cLine(x, boxB, x, boxB + pinLen, comp, 2, col);
        }
        break;
      }
    }
  }

  /** @internal 保留供后续重构，当前渲染逻辑内联在 render() 中 */
  // private _drawComponent(comp: CircuitComponent): void {
  //   // Selection highlight (dashed rectangle) — uses selected property
  //   if (comp.selected) {
  //     this.cDashRect(-32, -22, 64, 44, comp, 2, hexToRgba(this.config.selectionColor));
  //   }
  //   // Symbol
  //   this.drawComponentSymbol(comp);
  //   // Port dots
  //   this.drawPortsLocal(comp, false);
  // }

  private drawPortsLocal(comp: CircuitComponent, highlight: boolean, unconnectedPorts?: Set<string>): void {
    const defaultCol = hexToRgba(highlight ? this.config.portSnapColor : this.config.portColor);
    const unconnectedCol: [number, number, number, number] = [1.0, 0.267, 0.267, 1.0]; // #ff4444
    const r = (highlight ? 5 : 3) * this.transform.scale;
    for (const port of comp.ports) {
      const [px, py] = this.tx(port.offset.x, port.offset.y, comp);
      const isUnconnected = unconnectedPorts?.has(port.id) ?? false;

      // 引脚电平颜色优先
      const level = comp.portStates?.[port.id]?.level;
      const levelCol = level ? pinLevelColorRGBA(level) : null;

      const portCol = isUnconnected ? unconnectedCol : (levelCol ?? defaultCol);
      this.addCircleFill(px, py, r, portCol);
      if (highlight) {
        this.addCircleOutline(px, py, 8 * this.transform.scale, 1, portCol);
      }
      // 未连接端口红色虚线圈
      if (isUnconnected && !highlight) {
        this.addCircleOutline(px, py, 7 * this.transform.scale, 1.5, unconnectedCol);
      }
      // 高电平引脚发光效果
      if (level === 'high') {
        const pulse = 0.6 + 0.4 * Math.sin(this._animTime * 4);
        const glowR = r * 2.5;
        this.addCircleFill(px, py, glowR, [0.18, 0.80, 0.44, 0.2 * pulse]);
      }
    }
  }

  private drawWires(wires: Wire[], selectedId: string | null | undefined, highlightedSet?: Set<string>): void {
    const wCol = hexToRgba(this.config.wireColor);
    const sCol = hexToRgba(this.config.wireSelectionColor);
    const hCol: [number, number, number, number] = [1.0, 0.85, 0.24, 1.0]; // #ffd93d for highlighted
    const { scale, offsetX, offsetY } = this.transform;

    for (const wire of wires) {
      if (wire.points.length < 2) continue;
      const sel = wire.id === selectedId;
      const hl = highlightedSet?.has(wire.id) ?? false;
      const col = sel ? sCol : hl ? hCol : wCol;
      const T = sel || hl ? 3 : 2;

      // Wire segments
      for (let i = 0; i < wire.points.length - 1; i++) {
        const p1 = wire.points[i], p2 = wire.points[i+1];
        this.addLine(
          p1.x*scale+offsetX, p1.y*scale+offsetY,
          p2.x*scale+offsetX, p2.y*scale+offsetY,
          T, col
        );
      }

      // Bend dots
      for (const pt of wire.points) {
        if (pt.isBend) {
          this.addCircleFill(pt.x*scale+offsetX, pt.y*scale+offsetY, (hl ? 4 : 3)*scale, col);
        }
      }

      // 电流流动动画
      this.drawCurrentDots(wire, col);
    }
  }

  private drawWirePreview(preview: WirePreview): void {
    const { transform, config } = this;
    const points = calculateWirePoints(preview.fromPosition, preview.mousePosition, preview.routing);
    const col = hexToRgba(config.wirePreviewColor);

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i], p2 = points[i+1];
      this.addDashed(
        p1.x*transform.scale+transform.offsetX, p1.y*transform.scale+transform.offsetY,
        p2.x*transform.scale+transform.offsetX, p2.y*transform.scale+transform.offsetY,
        2, col, 5, 5
      );
    }

    // Snap target highlight
    if (preview.snapTarget) {
      const pos = preview.snapTarget.position;
      const sx = pos.x*transform.scale+transform.offsetX;
      const sy = pos.y*transform.scale+transform.offsetY;
      this.addCircleFill(sx, sy, 6*transform.scale, hexToRgba(config.portSnapColor));
    }
  }

  private drawBoxSelect(rect: { startX: number; startY: number; endX: number; endY: number }): void {
    const { transform } = this;
    const x1 = Math.min(rect.startX, rect.endX)*transform.scale+transform.offsetX;
    const y1 = Math.min(rect.startY, rect.endY)*transform.scale+transform.offsetY;
    const w = Math.abs(rect.endX-rect.startX)*transform.scale;
    const h = Math.abs(rect.endY-rect.startY)*transform.scale;
    this.addFill(x1, y1, w, h, [0.4, 0.63, 1.0, 0.08]);
    this.addDashed(x1,y1, x1+w,y1, 1, [0.4,0.63,1.0,0.6], 4,4);
    this.addDashed(x1+w,y1, x1+w,y1+h, 1, [0.4,0.63,1.0,0.6], 4,4);
    this.addDashed(x1+w,y1+h, x1,y1+h, 1, [0.4,0.63,1.0,0.6], 4,4);
    this.addDashed(x1,y1+h, x1,y1, 1, [0.4,0.63,1.0,0.6], 4,4);
  }

  private drawNodes(nodes: CircuitNode[]): void {
    const { transform } = this;
    for (const node of nodes) {
      const x = node.position.x*transform.scale+transform.offsetX;
      const y = node.position.y*transform.scale+transform.offsetY;
      if (node.type === 'ground') {
        const col: [number,number,number,number] = [0.306, 0.796, 0.769, 1];
        this.addLine(x, y, x, y+10, 2, col);
        this.addLine(x-8, y+10, x+8, y+10, 2, col);
        this.addLine(x-5, y+14, x+5, y+14, 2, col);
        this.addLine(x-2, y+18, x+2, y+18, 2, col);
      } else {
        this.addCircleFill(x, y, 4, [1, 0.42, 0.42, 1]);
      }
    }
  }

  private drawValidation(messages: ValidationMessage[], components: CircuitComponent[]): void {
    const { transform } = this;
    for (const msg of messages) {
      if (!msg.targetId || msg.targetType !== 'component') continue;
      const comp = components.find(c => c.id === msg.targetId);
      if (!comp) continue;
      const x = comp.position.x*transform.scale+transform.offsetX;
      const y = comp.position.y*transform.scale+transform.offsetY;
      const col = msg.severity === ValidationSeverity.Error
        ? [1, 0.267, 0.267, 1] as [number,number,number,number]
        : msg.severity === ValidationSeverity.Warning
        ? [1, 0.667, 0, 1] as [number,number,number,number]
        : [0.267, 0.667, 1, 1] as [number,number,number,number];
      this.addCircleFill(x+28, y-22, 8, col);
    }
  }

  // ==================== Text Overlay ====================

  private drawTextLabels(components: CircuitComponent[]): void {
    const ctx = this.octx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const { scale } = this.transform;

    // Skip text when too small
    if (scale < 0.3) return;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const comp of components) {
      const sx = comp.position.x*scale+this.transform.offsetX;
      const sy = comp.position.y*scale+this.transform.offsetY;

      // Component name
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate((comp.rotation * Math.PI) / 180);
      ctx.font = `bold ${Math.round(11*scale)}px monospace`;
      ctx.fillStyle = '#e0e0e0';
      ctx.fillText(comp.name, 0, -28*scale);
      // Value
      ctx.font = `${Math.round(10*scale)}px monospace`;
      ctx.fillStyle = '#888888';
      ctx.fillText(this.formatValue(comp.value.value, comp.value.unit), 0, 30*scale);
      ctx.restore();
    }

    // Node labels are rendered via WebGL primitives; text overlay is for component labels only
  }

  /** 绘制网络标签（2D overlay） */
  private drawNetLabelsOverlay(
    labels: CanvasNetLabel[],
    selectedId: string | null
  ): void {
    const ctx = this.octx;
    if (!ctx || !labels.length) return;
    const { scale, offsetX, offsetY } = this.transform;
    if (scale < 0.3) return;

    for (const label of labels) {
      const x = label.position.x * scale + offsetX;
      const y = label.position.y * scale + offsetY;

      let color: string;
      switch (label.labelType) {
        case NetLabelKind.Power: color = '#ff4444'; break;
        case NetLabelKind.Ground: color = '#44ff44'; break;
        case NetLabelKind.Bus: color = '#ffaa44'; break;
        default: color = '#00d4ff';
      }

      const isSelected = label.id === selectedId;
      const fontSize = Math.round(11 * scale);

      // 连接线
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5 * scale;
      ctx.beginPath();
      ctx.moveTo(x, y + 6 * scale);
      ctx.lineTo(x, y + 18 * scale);
      ctx.stroke();

      // 标签文字
      ctx.font = label.isGlobal ? `bold ${fontSize}px monospace` : `${fontSize}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textWidth = ctx.measureText(label.name).width + 12 * scale;

      // 背景
      ctx.fillStyle = isSelected ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.5)';
      ctx.strokeStyle = isSelected ? '#fff' : color;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(x - textWidth / 2, y - 10 * scale, textWidth, 18 * scale, 3);
      ctx.fill();
      ctx.stroke();

      // 文字
      ctx.fillStyle = color;
      ctx.fillText(label.name, x, y - 1 * scale);
      ctx.restore();
    }
  }

  private formatValue(value: number, unit: string): string {
    const prefixes: [number, string][] = [
      [1e12,'T'], [1e9,'G'], [1e6,'M'], [1e3,'k'],
      [1,''], [1e-3,'m'], [1e-6,'μ'], [1e-9,'n'], [1e-12,'p'],
    ];
    for (const [threshold, prefix] of prefixes) {
      if (Math.abs(value) >= threshold) {
        const formatted = (value / threshold).toFixed(threshold >= 1 ? 0 : 2);
        return `${formatted}${prefix}${unit}`;
      }
    }
    return `${value}${unit}`;
  }

  // ==================== Public Render Entry ====================

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
      componentsWithoutPower?: Set<string>;
      netLabels?: CanvasNetLabel[];
      selectedNetLabelId?: string | null;
      /** 当前时间戳（ms），用于动画计算；不传则用 performance.now() */
      timestamp?: number;
    } = {}
  ): void {
    // 更新动画时间
    const now = options.timestamp ?? performance.now();
    if (this._lastFrameTime > 0) {
      this._animTime += (now - this._lastFrameTime) / 1000;
    }
    this._lastFrameTime = now;

    const { gl } = this;

    this.resetBatches();

    // 1) Grid background
    if (options.showGrid !== false) {
      this.drawGrid();
    } else {
      const bg = hexToRgba(this.config.backgroundColor);
      gl.clearColor(bg[0], bg[1], bg[2], bg[3]);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    // 2) Wires
    const highlightedSet = options.highlightedNetWires
      ? new Set(options.highlightedNetWires)
      : undefined;
    this.drawWires(wires, options.selectedWireId, highlightedSet);

    // 3) Wire preview
    if (options.wirePreview) {
      this.drawWirePreview(options.wirePreview);
    }

    // 4) Components
    const multiIds = options.selectedComponentIds;
    for (const comp of components) {
      const isSelected = multiIds?.has(comp.id) ?? false;
      // Draw selection highlight for all selected components (blue dashed rect)
      if (isSelected) {
        this.cDashRect(-32, -22, 64, 44, comp, 2, hexToRgba(this.config.selectionColor));
      }
      // 电源缺失：红色边框
      if (options.componentsWithoutPower?.has(comp.id)) {
        this.cDashRect(-34, -24, 68, 48, comp, 2.5, [1.0, 0.267, 0.267, 0.8]);
      }
      this.drawComponentSymbol(comp);
      this.drawPortsLocal(comp, false, options.unconnectedPorts);
    }

    // 5) Highlighted ports for selected components
    for (const comp of components) {
      const highlighted = multiIds?.has(comp.id) ?? false;
      if (highlighted) this.drawPortsLocal(comp, true, options.unconnectedPorts);
    }

    // 6) Nodes
    this.drawNodes(nodes);

    // 7) Validation messages
    if (options.validationMessages) {
      this.drawValidation(options.validationMessages, components);
    }

    // 8) Box selection rectangle
    if (options.boxSelectRect) {
      this.drawBoxSelect(options.boxSelectRect);
    }

    // Flush all batches to GPU
    this.flushAll();

    // Visual effects overlay (光晕、流动、脉冲)
    if (this.vfx) {
      this.vfx.render(
        components, wires,
        options.selectedComponentIds ?? new Set(),
        this._simulating,
        this.transform,
      );
    }

    // Text overlay (2D canvas)
    this.drawTextLabels(components);

    // Net labels overlay
    if (options.netLabels && options.netLabels.length > 0) {
      this.drawNetLabelsOverlay(options.netLabels, options.selectedNetLabelId ?? null);
    }
  }
}
