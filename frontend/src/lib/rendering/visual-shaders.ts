/**
 * 视觉增强着色器
 * 包含：光晕(glow)、流动粒子(flow)、脉冲(pulse)、热力图(heatmap)着色器
 * 与现有 shaders.ts 配合使用
 */

// ==================== 光晕着色器 ====================
// 用于元件选中/悬停时的发光效果

export const GLOW_VERT = `
attribute vec2 a_position;
attribute vec2 a_center;
attribute float a_radius;
attribute float a_intensity;
uniform vec2 u_resolution;

varying vec2 v_center;
varying float v_radius;
varying float v_intensity;

void main() {
  float pad = a_radius * 2.0;
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
  v_intensity = a_intensity;
}
`;

export const GLOW_FRAG = `
precision mediump float;
varying vec2 v_center;
varying float v_radius;
varying float v_intensity;
uniform vec4 u_glowColor;

void main() {
  float dist = distance(gl_FragCoord.xy, v_center);
  float normalizedDist = dist / (v_radius * 2.0);

  // 高斯衰减
  float glow = exp(-normalizedDist * normalizedDist * 3.0) * v_intensity;

  gl_FragColor = vec4(u_glowColor.rgb, u_glowColor.a * glow);

  if (gl_FragColor.a < 0.005) discard;
}
`;

// ==================== 流动粒子着色器 ====================
// 在连线上绘制移动的发光粒子

export const FLOW_PARTICLE_VERT = `
attribute vec2 a_position;
attribute float a_size;
attribute float a_alpha;
uniform vec2 u_resolution;

varying float v_alpha;

void main() {
  vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = a_size;
  v_alpha = a_alpha;
}
`;

export const FLOW_PARTICLE_FRAG = `
precision mediump float;
varying float v_alpha;
uniform vec4 u_particleColor;

void main() {
  vec2 center = gl_PointCoord - 0.5;
  float dist = length(center);
  float glow = 1.0 - smoothstep(0.0, 0.5, dist);
  gl_FragColor = vec4(u_particleColor.rgb, u_particleColor.a * glow * v_alpha);
  if (gl_FragColor.a < 0.01) discard;
}
`;

// ==================== 脉冲着色器 ====================
// 仿真运行时的信号脉冲效果

export const PULSE_VERT = `
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

export const PULSE_FRAG = `
precision mediump float;
varying vec4 v_color;
uniform float u_time;
uniform float u_frequency;
uniform vec2 u_startPos;
uniform vec2 u_endPos;

void main() {
  // 沿连线方向的脉冲位置
  vec2 dir = u_endPos - u_startPos;
  float len = length(dir);
  if (len < 0.001) {
    gl_FragColor = v_color;
    return;
  }

  vec2 normDir = dir / len;
  vec2 relPos = gl_FragCoord.xy - u_startPos;
  float proj = dot(relPos, normDir);
  float t = proj / len;

  // 脉冲：移动的高亮段
  float pulsePos = mod(u_time * u_frequency, 1.0);
  float pulseDist = abs(t - pulsePos);
  float pulse = smoothstep(0.15, 0.0, pulseDist);

  // 第二个反向脉冲
  float pulsePos2 = mod(u_time * u_frequency + 0.5, 1.0);
  float pulseDist2 = abs(t - pulsePos2);
  float pulse2 = smoothstep(0.15, 0.0, pulseDist2);

  float intensity = max(pulse, pulse2 * 0.6);

  vec4 baseColor = v_color;
  gl_FragColor = vec4(
    baseColor.rgb + intensity * 0.5,
    baseColor.a * (0.3 + intensity * 0.7)
  );
}
`;

// ==================== 热力图叠加着色器 ====================
// 在连线/节点上叠加半透明热力图

export const HEATMAP_VERT = `
attribute vec2 a_position;
attribute float a_value;
uniform vec2 u_resolution;

varying float v_value;

void main() {
  vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  v_value = a_value;
}
`;

export const HEATMAP_FRAG = `
precision mediump float;
varying float v_value;
uniform float u_minValue;
uniform float u_maxValue;
uniform float u_opacity;

vec3 heatColor(float t) {
  // 蓝 → 青 → 黄 → 红
  if (t < 0.33) {
    return mix(vec3(0.1, 0.23, 0.43), vec3(0.13, 0.5, 0.8), t * 3.0);
  } else if (t < 0.66) {
    return mix(vec3(0.13, 0.5, 0.8), vec3(0.8, 0.67, 0.0), (t - 0.33) * 3.0);
  } else {
    return mix(vec3(0.8, 0.67, 0.0), vec3(1.0, 0.13, 0.13), (t - 0.66) * 3.0);
  }
}

void main() {
  float t = clamp((v_value - u_minValue) / (u_maxValue - u_minValue), 0.0, 1.0);
  vec3 color = heatColor(t);
  gl_FragColor = vec4(color, u_opacity);
}
`;

// ==================== 端口发光着色器 ====================

export const PORT_GLOW_VERT = `
attribute vec2 a_position;
attribute float a_radius;
attribute float a_brightness;
uniform vec2 u_resolution;

varying float v_radius;
varying float v_brightness;

void main() {
  float pad = a_radius * 3.0;
  vec2 corner;
  corner.x = float(gl_VertexID == 1 || gl_VertexID == 2);
  corner.y = float(gl_VertexID == 2 || gl_VertexID == 3);
  vec2 pos = a_position + (corner * 2.0 - 1.0) * (a_radius + pad);

  vec2 clip = (pos / u_resolution) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);

  v_radius = a_radius;
  v_brightness = a_brightness;
}
`;

export const PORT_GLOW_FRAG = `
precision mediump float;
varying float v_radius;
varying float v_brightness;
uniform vec4 u_portColor;
uniform float u_time;

void main() {
  float dist = distance(gl_FragCoord.xy, vec2(gl_FragCoord.x, gl_FragCoord.y));
  // 使用 v_radius 和 v_brightness 进行发光计算
  float normalizedDist = dist / (v_radius * 3.0);
  float pulse = 0.7 + 0.3 * sin(u_time * 3.0);
  float glow = exp(-normalizedDist * normalizedDist * 2.0) * v_brightness * pulse;

  gl_FragColor = vec4(u_portColor.rgb, u_portColor.a * glow);
  if (gl_FragColor.a < 0.005) discard;
}
`;
