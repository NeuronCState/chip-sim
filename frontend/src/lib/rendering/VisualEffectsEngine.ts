/**
 * 视觉效果引擎 VisualEffectsEngine
 * 在 WebGL 渲染器之上叠加视觉增强效果层
 * 负责：光晕、流动动画、脉冲、端口发光
 * 可通过设置开关全局启用/禁用
 */

import type { CircuitComponent, Wire, ViewTransform } from '../../types/circuit';
import { createProgram } from './webgl-utils';
import {
  GLOW_VERT, GLOW_FRAG,
  FLOW_PARTICLE_VERT, FLOW_PARTICLE_FRAG,
  PORT_GLOW_VERT, PORT_GLOW_FRAG,
} from './visual-shaders';

/** 视觉效果配置 */
export interface VFXConfig {
  /** 全局启用/禁用 */
  enabled: boolean;
  /** 选中光晕 */
  selectionGlow: boolean;
  /** 连线流动动画 */
  wireFlow: boolean;
  /** 端口发光 */
  portGlow: boolean;
  /** 仿真脉冲 */
  simulationPulse: boolean;
  /** 元件悬停效果 */
  hoverEffect: boolean;
  /** 光晕颜色 */
  glowColor: [number, number, number, number];
  /** 光晕强度 */
  glowIntensity: number;
  /** 流动粒子颜色 */
  flowColor: [number, number, number, number];
  /** 流动速度 (1-10) */
  flowSpeed: number;
}

const DEFAULT_VFX: VFXConfig = {
  enabled: true,
  selectionGlow: true,
  wireFlow: true,
  portGlow: true,
  simulationPulse: true,
  hoverEffect: true,
  glowColor: [0, 0.83, 1, 0.6],
  glowIntensity: 0.6,
  flowColor: [0, 1, 0.67, 0.8],
  flowSpeed: 3,
};

export class VisualEffectsEngine {
  private gl: WebGLRenderingContext;
  private config: VFXConfig;
  private canvas: HTMLCanvasElement;

  // Shader programs
  private glowProg: WebGLProgram | null = null;
  private flowProg: WebGLProgram | null = null;
  private portGlowProg: WebGLProgram | null = null;

  // Buffers
  private glowVBO: WebGLBuffer;
  private flowVBO: WebGLBuffer;

  // 时间追踪
  private startTime: number = performance.now();
  private flowOffset: number = 0;

  constructor(gl: WebGLRenderingContext, canvas: HTMLCanvasElement, config: Partial<VFXConfig> = {}) {
    this.gl = gl;
    this.canvas = canvas;
    this.config = { ...DEFAULT_VFX, ...config };

    // 编译着色器
    try {
      this.glowProg = createProgram(gl, GLOW_VERT, GLOW_FRAG);
      this.flowProg = createProgram(gl, FLOW_PARTICLE_VERT, FLOW_PARTICLE_FRAG);
      this.portGlowProg = createProgram(gl, PORT_GLOW_VERT, PORT_GLOW_FRAG);
    } catch (e) {
      console.warn('VFX shaders failed to compile, effects disabled:', e);
      this.config.enabled = false;
    }

    // 创建缓冲区
    this.glowVBO = gl.createBuffer()!;
    this.flowVBO = gl.createBuffer()!;
  }

  /** 更新配置 */
  updateConfig(config: Partial<VFXConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** 获取配置 */
  getConfig(): VFXConfig {
    return { ...this.config };
  }

  /** 渲染所有视觉效果 */
  render(
    components: CircuitComponent[],
    wires: Wire[],
    selectedIds: Set<string>,
    simulating: boolean,
    transform: ViewTransform,
  ): void {
    if (!this.config.enabled) return;

    const { gl: _gl } = this;
    const now = performance.now();
    const time = (now - this.startTime) / 1000;

    // 更新流动偏移
    this.flowOffset = (this.flowOffset + this.config.flowSpeed * 0.016) % 1.0;

    // 选中光晕
    if (this.config.selectionGlow && selectedIds.size > 0) {
      this.renderSelectionGlow(components, selectedIds, transform, time);
    }

    // 连线流动
    if (this.config.wireFlow && wires.length > 0) {
      this.renderWireFlow(wires, transform, time);
    }

    // 仿真脉冲
    if (this.config.simulationPulse && simulating) {
      this.renderSimulationPulse(wires, transform, time);
    }
  }

  // ==================== 选中光晕 ====================

  private renderSelectionGlow(
    components: CircuitComponent[],
    selectedIds: Set<string>,
    transform: ViewTransform,
    time: number,
  ): void {
    const { gl } = this;
    if (!this.glowProg) return;

    gl.useProgram(this.glowProg);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // 加法混合

    gl.uniform2f(
      gl.getUniformLocation(this.glowProg, 'u_resolution')!,
      this.canvas.width, this.canvas.height
    );

    const gc = this.config.glowColor;
    gl.uniform4f(
      gl.getUniformLocation(this.glowProg, 'u_glowColor')!,
      gc[0], gc[1], gc[2], gc[3]
    );

    const vertices: number[] = [];
    for (const comp of components) {
      if (!selectedIds.has(comp.id)) continue;
      const sx = comp.position.x * transform.scale + transform.offsetX;
      const sy = comp.position.y * transform.scale + transform.offsetY;
      const pulse = 0.7 + 0.3 * Math.sin(time * 3);
      const intensity = this.config.glowIntensity * pulse;
      const radius = 30 * transform.scale;

      // 每个 glow 是一个带属性的四边形
      for (let v = 0; v < 6; v++) {
        vertices.push(sx, sy, radius, intensity);
      }
    }

    if (vertices.length > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.glowVBO);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);

      const aPos = gl.getAttribLocation(this.glowProg, 'a_position');
      const aCenter = gl.getAttribLocation(this.glowProg, 'a_center');
      const aRadius = gl.getAttribLocation(this.glowProg, 'a_radius');
      const aIntensity = gl.getAttribLocation(this.glowProg, 'a_intensity');

      if (aPos >= 0) {
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
      }
      if (aCenter >= 0) {
        gl.enableVertexAttribArray(aCenter);
        gl.vertexAttribPointer(aCenter, 2, gl.FLOAT, false, 16, 0);
      }
      if (aRadius >= 0) {
        gl.enableVertexAttribArray(aRadius);
        gl.vertexAttribPointer(aRadius, 1, gl.FLOAT, false, 16, 8);
      }
      if (aIntensity >= 0) {
        gl.enableVertexAttribArray(aIntensity);
        gl.vertexAttribPointer(aIntensity, 1, gl.FLOAT, false, 16, 12);
      }

      gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 4);
    }

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); // 恢复
  }

  // ==================== 连线流动粒子 ====================

  private renderWireFlow(
    wires: Wire[],
    transform: ViewTransform,
    time: number,
  ): void {
    const { gl } = this;
    if (!this.flowProg) return;

    gl.useProgram(this.flowProg);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    gl.uniform2f(
      gl.getUniformLocation(this.flowProg, 'u_resolution')!,
      this.canvas.width, this.canvas.height
    );

    const fc = this.config.flowColor;
    gl.uniform4f(
      gl.getUniformLocation(this.flowProg, 'u_particleColor')!,
      fc[0], fc[1], fc[2], fc[3]
    );

    const vertices: number[] = [];
    const particleSpacing = 20;

    for (const wire of wires) {
      if (wire.points.length < 2) continue;

      // 计算总长度和段长度
      let totalLen = 0;
      const segLens: number[] = [];
      for (let i = 0; i < wire.points.length - 1; i++) {
        const dx = wire.points[i + 1].x - wire.points[i].x;
        const dy = wire.points[i + 1].y - wire.points[i].y;
        const len = Math.hypot(dx, dy);
        segLens.push(len);
        totalLen += len;
      }
      if (totalLen < 1) continue;

      const numParticles = Math.max(1, Math.ceil(totalLen / particleSpacing));
      for (let p = 0; p < numParticles; p++) {
        let dist = ((p * particleSpacing + this.flowOffset * totalLen) % totalLen + totalLen) % totalLen;

        for (let s = 0; s < segLens.length; s++) {
          if (dist <= segLens[s]) {
            const t = dist / segLens[s];
            const px = wire.points[s].x + (wire.points[s + 1].x - wire.points[s].x) * t;
            const py = wire.points[s].y + (wire.points[s + 1].y - wire.points[s].y) * t;
            const sx = px * transform.scale + transform.offsetX;
            const sy = py * transform.scale + transform.offsetY;
            const alpha = 0.5 + 0.5 * Math.sin(time * 4 + p * 0.5);
            const size = (3 + Math.sin(time * 2 + p) * 1) * transform.scale;

            vertices.push(sx, sy, size, alpha);
            break;
          }
          dist -= segLens[s];
        }
      }
    }

    if (vertices.length > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.flowVBO);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);

      const aPos = gl.getAttribLocation(this.flowProg, 'a_position');
      const aSize = gl.getAttribLocation(this.flowProg, 'a_size');
      const aAlpha = gl.getAttribLocation(this.flowProg, 'a_alpha');

      if (aPos >= 0) {
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 12, 0);
      }
      if (aSize >= 0) {
        gl.enableVertexAttribArray(aSize);
        gl.vertexAttribPointer(aSize, 1, gl.FLOAT, false, 12, 8);
      }
      if (aAlpha >= 0) {
        gl.enableVertexAttribArray(aAlpha);
        gl.vertexAttribPointer(aAlpha, 1, gl.FLOAT, false, 12, 4);
      }

      gl.drawArrays(gl.POINTS, 0, vertices.length / 3);
    }

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  // ==================== 仿真脉冲 ====================

  private renderSimulationPulse(
    wires: Wire[],
    transform: ViewTransform,
    time: number,
  ): void {
    // 使用 glow shader 渲染脉冲点
    if (!this.glowProg) return;
    const { gl } = this;

    gl.useProgram(this.glowProg);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    gl.uniform2f(
      gl.getUniformLocation(this.glowProg, 'u_resolution')!,
      this.canvas.width, this.canvas.height
    );
    gl.uniform4f(
      gl.getUniformLocation(this.glowProg, 'u_glowColor')!,
      0.27, 0.53, 1.0, 0.4
    );

    const vertices: number[] = [];

    for (const wire of wires) {
      if (wire.points.length < 2) continue;

      // 计算总长度
      let totalLen = 0;
      const segLens: number[] = [];
      for (let i = 0; i < wire.points.length - 1; i++) {
        const len = Math.hypot(
          wire.points[i + 1].x - wire.points[i].x,
          wire.points[i + 1].y - wire.points[i].y
        );
        segLens.push(len);
        totalLen += len;
      }
      if (totalLen < 1) continue;

      // 两个反向脉冲
      for (const dir of [1, -1]) {
        const phase = dir > 0 ? time * 0.5 : (time * 0.5 + 0.5) % 1.0;
        let dist = phase * totalLen;

        for (let s = 0; s < segLens.length; s++) {
          if (dist <= segLens[s]) {
            const t = dist / segLens[s];
            const px = wire.points[s].x + (wire.points[s + 1].x - wire.points[s].x) * t;
            const py = wire.points[s].y + (wire.points[s + 1].y - wire.points[s].y) * t;
            const sx = px * transform.scale + transform.offsetX;
            const sy = py * transform.scale + transform.offsetY;
            const radius = 8 * transform.scale;

            for (let v = 0; v < 6; v++) {
              vertices.push(sx, sy, radius, 0.5);
            }
            break;
          }
          dist -= segLens[s];
        }
      }
    }

    if (vertices.length > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.glowVBO);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);

      const aPos = gl.getAttribLocation(this.glowProg, 'a_position');
      const aCenter = gl.getAttribLocation(this.glowProg, 'a_center');
      const aRadius = gl.getAttribLocation(this.glowProg, 'a_radius');
      const aIntensity = gl.getAttribLocation(this.glowProg, 'a_intensity');

      if (aPos >= 0) {
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
      }
      if (aCenter >= 0) {
        gl.enableVertexAttribArray(aCenter);
        gl.vertexAttribPointer(aCenter, 2, gl.FLOAT, false, 16, 0);
      }
      if (aRadius >= 0) {
        gl.enableVertexAttribArray(aRadius);
        gl.vertexAttribPointer(aRadius, 1, gl.FLOAT, false, 16, 8);
      }
      if (aIntensity >= 0) {
        gl.enableVertexAttribArray(aIntensity);
        gl.vertexAttribPointer(aIntensity, 1, gl.FLOAT, false, 16, 12);
      }

      gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 4);
    }

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  /** 销毁资源 */
  dispose(): void {
    const { gl } = this;
    if (this.glowProg) gl.deleteProgram(this.glowProg);
    if (this.flowProg) gl.deleteProgram(this.flowProg);
    if (this.portGlowProg) gl.deleteProgram(this.portGlowProg);
    gl.deleteBuffer(this.glowVBO);
    gl.deleteBuffer(this.flowVBO);
  }
}
