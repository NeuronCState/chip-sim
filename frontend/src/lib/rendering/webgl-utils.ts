/**
 * WebGL 工具函数
 * 着色器编译、程序链接、缓冲区管理、颜色转换
 */

/**
 * 编译着色器
 */
export function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || 'Unknown error';
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}\nSource:\n${source}`);
  }
  return shader;
}

/**
 * 链接着色器程序
 */
export function createProgram(
  gl: WebGLRenderingContext,
  vertSrc: string,
  fragSrc: string
): WebGLProgram {
  const vert = createShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = createShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  const program = gl.createProgram();
  if (!program) throw new Error('Failed to create program');
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || 'Unknown error';
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${info}`);
  }
  // 链接后可以安全删除着色器对象
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  return program;
}

/**
 * 创建并填充 VBO
 */
export function createBuffer(
  gl: WebGLRenderingContext,
  data: Float32Array,
  usage: number = gl.DYNAMIC_DRAW
): WebGLBuffer {
  const buffer = gl.createBuffer();
  if (!buffer) throw new Error('Failed to create buffer');
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, usage);
  return buffer;
}

/**
 * 更新 VBO 数据
 */
export function updateBuffer(
  gl: WebGLRenderingContext,
  buffer: WebGLBuffer,
  data: Float32Array
): void {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
}

/**
 * 设置顶点属性指针
 */
export function setupAttribute(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  name: string,
  size: number,
  stride: number,
  offset: number
): void {
  const loc = gl.getAttribLocation(program, name);
  if (loc < 0) return;
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
}

/**
 * 设置 uniform 值的辅助函数
 */
export function setUniform2f(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  name: string,
  x: number,
  y: number
): void {
  const loc = gl.getUniformLocation(program, name);
  if (loc) gl.uniform2f(loc, x, y);
}

export function setUniform1f(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  name: string,
  value: number
): void {
  const loc = gl.getUniformLocation(program, name);
  if (loc) gl.uniform1f(loc, value);
}

export function setUniform4f(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  name: string,
  r: number,
  g: number,
  b: number,
  a: number
): void {
  const loc = gl.getUniformLocation(program, name);
  if (loc) gl.uniform4f(loc, r, g, b, a);
}

/**
 * HEX 颜色转 RGBA [0-1]
 */
export function hexToRgba(hex: string, alpha: number = 1.0): [number, number, number, number] {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return [r, g, b, alpha];
}

/**
 * 生成线段批次的顶点数据
 * 每条线段 6 个顶点（2 个三角形 = 1 个矩形）
 * 布局：[x1, y1, x2, y2, thickness, r, g, b, a] × 6
 */
export function buildLineBatch(
  lines: Array<{
    x1: number; y1: number; x2: number; y2: number;
    thickness: number; color: [number, number, number, number];
  }>
): Float32Array {
  // Layout: 9 floats per vertex (x, y, p1x, p1y, p2x, p2y, thickness, r, g, b, a → actually 6: px, py, r, g, b, a)
  // Actually, let me reconsider the attribute layout.
  // Each "line instance" has 6 vertices (a quad).
  // Per-vertex data: a_p1(2), a_p2(2), a_thickness(1), a_color(4) = 9 floats
  // But p1, p2, thickness, color are the same for all 6 vertices of a line.
  // Only the vertex position varies.

  // For simplicity, let me use a flat layout:
  // For each vertex: px, py (actual position), p1x, p1y, p2x, p2y, thickness, r, g, b, a
  // That's 11 floats per vertex, 6 vertices per line = 66 floats per line.

  // Actually, let me use the attribute approach from the shader:
  // a_p1(2), a_p2(2), a_thickness(1), a_color(4) = 9 floats per vertex
  // The vertex position is computed in the shader using gl_VertexID.

  // Hmm, gl_VertexID is not available in WebGL 1.0 by default.
  // It's available in WebGL 2.0 or with the OES_vertex_id extension.
  // Let me change the approach: pass the actual vertex position directly.

  // New approach: generate actual quad vertices.
  // For each line segment, compute the 4 corner positions of the quad.
  // Layout per vertex: px, py, r, g, b, a = 6 floats
  // 6 vertices per line (2 triangles).

  const vertices: number[] = [];

  for (const line of lines) {
    const { x1, y1, x2, y2, thickness, color } = line;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const halfT = thickness * 0.5;

    let nx = 0, ny = 0;
    if (len > 0.001) {
      nx = (-dy / len) * halfT;
      ny = (dx / len) * halfT;
    }

    // Four corners of the quad
    const ax = x1 + nx, ay = y1 + ny;
    const bx = x1 - nx, by = y1 - ny;
    const cx = x2 + nx, cy = y2 + ny;
    const dx2 = x2 - nx, dy2 = y2 - ny;

    // Triangle 1: a, b, c
    // Triangle 2: b, c, d
    const [r, g, b, a] = color;
    vertices.push(
      ax, ay, r, g, b, a,
      bx, by, r, g, b, a,
      cx, cy, r, g, b, a,
      bx, by, r, g, b, a,
      cx, cy, r, g, b, a,
      dx2, dy2, r, g, b, a
    );
  }

  return new Float32Array(vertices);
}

/**
 * 生成虚线批次的顶点数据
 * 与 buildLineBatch 类似，但每段线段需要拆分为多段以实现虚线效果
 */
export function buildDashedLineBatch(
  lines: Array<{
    x1: number; y1: number; x2: number; y2: number;
    thickness: number; color: [number, number, number, number];
    dashSize: number; gapSize: number;
  }>
): Float32Array {
  const vertices: number[] = [];

  for (const line of lines) {
    const { x1, y1, x2, y2, thickness, color, dashSize, gapSize } = line;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.001) continue;

    const dirX = dx / len;
    const dirY = dy / len;
    const halfT = thickness * 0.5;
    const nx = -dirY * halfT;
    const ny = dirX * halfT;
    const [r, g, b, a] = color;

    // Split the line into dash/gap segments
    const period = dashSize + gapSize;
    let dist = 0;
    while (dist < len) {
      const dashEnd = Math.min(dist + dashSize, len);
      const sx = x1 + dirX * dist;
      const sy = y1 + dirY * dist;
      const ex = x1 + dirX * dashEnd;
      const ey = y1 + dirY * dashEnd;

      const ax = sx + nx, ay = sy + ny;
      const bx = sx - nx, by = sy - ny;
      const cx = ex + nx, cy = ey + ny;
      const dx2 = ex - nx, dy2 = ey - ny;

      vertices.push(
        ax, ay, r, g, b, a,
        bx, by, r, g, b, a,
        cx, cy, r, g, b, a,
        bx, by, r, g, b, a,
        cx, cy, r, g, b, a,
        dx2, dy2, r, g, b, a
      );

      dist += period;
    }
  }

  return new Float32Array(vertices);
}

/**
 * 生成填充矩形批次
 * 每个矩形 6 个顶点（2 个三角形）
 * 布局：px, py, r, g, b, a
 */
export function buildRectBatch(
  rects: Array<{
    x: number; y: number; w: number; h: number;
    color: [number, number, number, number];
  }>
): Float32Array {
  const vertices: number[] = [];

  for (const rect of rects) {
    const { x, y, w, h, color } = rect;
    const [r, g, b, a] = color;
    const x2 = x + w;
    const y2 = y + h;

    vertices.push(
      x, y, r, g, b, a,
      x2, y, r, g, b, a,
      x, y2, r, g, b, a,
      x2, y, r, g, b, a,
      x2, y2, r, g, b, a,
      x, y2, r, g, b, a
    );
  }

  return new Float32Array(vertices);
}
