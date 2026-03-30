/**
 * WebGL 着色器源码
 * 包含网格、线条、圆形、虚线四种着色器程序
 */

// ==================== 通用顶点着色器 ====================

export const BASE_VERT = `
attribute vec2 a_position;
uniform vec2 u_resolution;

void main() {
  vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
}
`;

// ==================== 网格着色器 ====================

export const GRID_FRAG = `
precision mediump float;
uniform vec4 u_bgColor;
uniform vec4 u_gridColor;
uniform float u_gridSize;
uniform vec2 u_offset;
uniform vec2 u_resolution;

void main() {
  vec2 adj = mod(gl_FragCoord.xy + vec2(u_offset.x, -u_offset.y), u_gridSize);
  float lineX = 1.0 - step(0.8, adj.x);
  float lineY = 1.0 - step(0.8, adj.y);
  float isGrid = max(lineX, lineY);
  gl_FragColor = mix(u_bgColor, u_gridColor, isGrid);
}
`;

// ==================== 线段着色器 ====================
// 从线段生成矩形（两个三角形），支持任意粗细

export const LINE_VERT = `
attribute vec2 a_p1;
attribute vec2 a_p2;
attribute float a_thickness;
attribute vec4 a_color;
uniform vec2 u_resolution;

varying vec4 v_color;

void main() {
  vec2 dir = a_p2 - a_p1;
  float len = length(dir);

  vec2 pos;
  if (len < 0.001) {
    pos = a_p1;
  } else {
    vec2 norm = normalize(vec2(-dir.y, dir.x)) * a_thickness * 0.5;
    float tx = float(gl_VertexID == 1 || gl_VertexID == 2);
    float ty = float(gl_VertexID == 2 || gl_VertexID == 3);
    pos = mix(a_p1, a_p1 + dir, tx) + norm * (ty * 2.0 - 1.0);
  }

  vec2 clip = (pos / u_resolution) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  v_color = a_color;
}
`;

export const LINE_FRAG = `
precision mediump float;
varying vec4 v_color;

void main() {
  gl_FragColor = v_color;
}
`;

// ==================== 圆形着色器（SDF）====================
// 用四边形覆盖边界框，片元着色器中用 SDF 绘制

export const CIRCLE_VERT = `
attribute vec2 a_center;
attribute float a_radius;
attribute vec4 a_color;
attribute float a_fill;
attribute float a_outlineWidth;
uniform vec2 u_resolution;

varying vec2 v_center;
varying float v_radius;
varying vec4 v_color;
varying float v_fill;
varying float v_outlineWidth;

void main() {
  float pad = a_outlineWidth + 1.0;
  float totalR = a_radius + pad;

  vec2 corner;
  corner.x = float(gl_VertexID == 1 || gl_VertexID == 2);
  corner.y = float(gl_VertexID == 2 || gl_VertexID == 3);
  vec2 pos = a_center + (corner * 2.0 - 1.0) * totalR;

  vec2 clip = (pos / u_resolution) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);

  v_center = a_center;
  v_radius = a_radius;
  v_color = a_color;
  v_fill = a_fill;
  v_outlineWidth = a_outlineWidth;
}
`;

export const CIRCLE_FRAG = `
precision mediump float;
varying vec2 v_center;
varying float v_radius;
varying vec4 v_color;
varying float v_fill;
varying float v_outlineWidth;

void main() {
  float dist = distance(gl_FragCoord.xy, vec2(v_center.x, v_center.y));

  if (v_fill > 0.5) {
    float alpha = 1.0 - smoothstep(v_radius - 0.5, v_radius + 0.5, dist);
    gl_FragColor = vec4(v_color.rgb, v_color.a * alpha);
  } else {
    float inner = v_radius - v_outlineWidth * 0.5;
    float outer = v_radius + v_outlineWidth * 0.5;
    float alpha = (1.0 - smoothstep(outer - 0.5, outer + 0.5, dist))
                * smoothstep(inner - 0.5, inner + 0.5, dist);
    gl_FragColor = vec4(v_color.rgb, v_color.a * alpha);
  }

  if (gl_FragColor.a < 0.01) discard;
}
`;

// ==================== 虚线着色器 ====================
// 用于选中高亮框和连线预览

export const DASHED_VERT = `
attribute vec2 a_p1;
attribute vec2 a_p2;
attribute float a_thickness;
attribute vec4 a_color;
attribute float a_dashSize;
attribute float a_gapSize;
uniform vec2 u_resolution;

varying vec4 v_color;
varying float v_dashSize;
varying float v_gapSize;
varying float v_segLen;
varying float v_coordX;

void main() {
  vec2 dir = a_p2 - a_p1;
  float len = length(dir);

  vec2 pos;
  float tx = float(gl_VertexID == 1 || gl_VertexID == 2);
  float ty = float(gl_VertexID == 2 || gl_VertexID == 3);

  if (len < 0.001) {
    pos = a_p1;
  } else {
    vec2 norm = normalize(vec2(-dir.y, dir.x)) * a_thickness * 0.5;
    pos = mix(a_p1, a_p1 + dir, tx) + norm * (ty * 2.0 - 1.0);
  }

  vec2 clip = (pos / u_resolution) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);

  v_color = a_color;
  v_dashSize = a_dashSize;
  v_gapSize = a_gapSize;
  v_segLen = len;
  v_coordX = tx * len;
}
`;

export const DASHED_FRAG = `
precision mediump float;
varying vec4 v_color;
varying float v_dashSize;
varying float v_gapSize;
varying float v_segLen;
varying float v_coordX;

void main() {
  float period = v_dashSize + v_gapSize;
  if (period > 0.0) {
    float pos = mod(v_coordX, period);
    if (pos > v_dashSize) discard;
  }
  gl_FragColor = v_color;
}
`;

// ==================== 填充矩形着色器 ====================
// 用于框选半透明背景

export const FILL_VERT = `
attribute vec2 a_position;
attribute vec4 a_color;
uniform vec2 u_resolution;

varying vec4 v_color;

void main() {
  vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  v_color = a_color;
}
`;

export const FILL_FRAG = `
precision mediump float;
varying vec4 v_color;

void main() {
  gl_FragColor = v_color;
}
`;
