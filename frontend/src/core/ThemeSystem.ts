/**
 * 主题系统 ThemeSystem
 * 定义完整的色彩体系（暗色/亮色），统一管理元件、连线、画布颜色
 * 支持主题切换时的平滑过渡动画
 */

// ==================== 色彩 Token 定义 ====================

/** 完整色彩体系 Token */
export interface ThemeTokens {
  // === 背景 ===
  bgApp: string;
  bgPanel: string;
  bgInput: string;
  bgToolbar: string;
  bgCanvas: string;
  bgOverlay: string;

  // === 边框 ===
  border: string;
  borderLight: string;
  borderAccent: string;

  // === 文本 ===
  text: string;
  textDim: string;
  textMuted: string;
  textInverse: string;

  // === 强调色 ===
  accent: string;
  accentHover: string;
  accentSubtle: string;

  // === 状态色 ===
  success: string;
  successSubtle: string;
  danger: string;
  dangerSubtle: string;
  warning: string;
  warningSubtle: string;
  info: string;
  infoSubtle: string;

  // === 画布 ===
  gridColor: string;
  gridColorMajor: string;
  wireColor: string;
  wireColorSelected: string;
  wireColorPreview: string;
  componentColor: string;
  componentColorSelected: string;
  componentColorHover: string;
  portColor: string;
  portColorSnap: string;
  portGlow: string;
  selectionColor: string;
  nodeColor: string;
  nodeColorGround: string;

  // === 热力图 ===
  heatmapLow: string;
  heatmapMid: string;
  heatmapHigh: string;
  heatmapOverlayOpacity: number;

  // === 动画 ===
  glowColor: string;
  glowIntensity: number;
  flowColor: string;
  pulseColor: string;

  // === 阴影 ===
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;
  shadowGlow: string;
}

// ==================== 暗色主题 ====================

export const darkTheme: ThemeTokens = {
  bgApp: '#0d0d1a',
  bgPanel: '#16162a',
  bgInput: '#1a1a2e',
  bgToolbar: '#12122a',
  bgCanvas: '#0d0d1a',
  bgOverlay: 'rgba(0, 0, 0, 0.6)',

  border: '#2a2a4a',
  borderLight: '#3a3a5a',
  borderAccent: '#4488ff',

  text: '#e0e0e0',
  textDim: '#888888',
  textMuted: '#555555',
  textInverse: '#0d0d1a',

  accent: '#0066cc',
  accentHover: '#0088ff',
  accentSubtle: 'rgba(0, 102, 204, 0.15)',

  success: '#4ecdc4',
  successSubtle: 'rgba(78, 205, 196, 0.15)',
  danger: '#ff6b6b',
  dangerSubtle: 'rgba(255, 107, 107, 0.15)',
  warning: '#ffaa00',
  warningSubtle: 'rgba(255, 170, 0, 0.15)',
  info: '#44aaff',
  infoSubtle: 'rgba(68, 170, 255, 0.15)',

  gridColor: '#2a2a4a',
  gridColorMajor: '#3a3a5a',
  wireColor: '#00d4ff',
  wireColorSelected: '#ff6b6b',
  wireColorPreview: '#8888ff',
  componentColor: '#e0e0e0',
  componentColorSelected: '#4488ff',
  componentColorHover: '#66bbff',
  portColor: '#4ecdc4',
  portColorSnap: '#ffd93d',
  portGlow: 'rgba(78, 205, 196, 0.6)',
  selectionColor: '#4488ff',
  nodeColor: '#ff6b6b',
  nodeColorGround: '#4ecdc4',

  heatmapLow: '#1a3a6e',
  heatmapMid: '#cc8800',
  heatmapHigh: '#ff2222',
  heatmapOverlayOpacity: 0.45,

  glowColor: '#00d4ff',
  glowIntensity: 0.6,
  flowColor: '#00ffaa',
  pulseColor: '#4488ff',

  shadowSm: '0 1px 3px rgba(0,0,0,0.4)',
  shadowMd: '0 4px 12px rgba(0,0,0,0.5)',
  shadowLg: '0 8px 32px rgba(0,0,0,0.6)',
  shadowGlow: '0 0 20px rgba(0, 212, 255, 0.3)',
};

// ==================== 亮色主题 ====================

export const lightTheme: ThemeTokens = {
  bgApp: '#f0f2f5',
  bgPanel: '#ffffff',
  bgInput: '#f5f5f5',
  bgToolbar: '#ffffff',
  bgCanvas: '#f8f9fa',
  bgOverlay: 'rgba(255, 255, 255, 0.7)',

  border: '#d9d9d9',
  borderLight: '#e8e8e8',
  borderAccent: '#1677ff',

  text: '#1a1a2e',
  textDim: '#666666',
  textMuted: '#999999',
  textInverse: '#ffffff',

  accent: '#1677ff',
  accentHover: '#4096ff',
  accentSubtle: 'rgba(22, 119, 255, 0.1)',

  success: '#13c2c2',
  successSubtle: 'rgba(19, 194, 194, 0.1)',
  danger: '#ff4d4f',
  dangerSubtle: 'rgba(255, 77, 79, 0.1)',
  warning: '#faad14',
  warningSubtle: 'rgba(250, 173, 20, 0.1)',
  info: '#1677ff',
  infoSubtle: 'rgba(22, 119, 255, 0.1)',

  gridColor: '#e0e0e0',
  gridColorMajor: '#d0d0d0',
  wireColor: '#1677ff',
  wireColorSelected: '#ff4d4f',
  wireColorPreview: '#7c9eff',
  componentColor: '#333333',
  componentColorSelected: '#1677ff',
  componentColorHover: '#4096ff',
  portColor: '#13c2c2',
  portColorSnap: '#faad14',
  portGlow: 'rgba(19, 194, 194, 0.5)',
  selectionColor: '#1677ff',
  nodeColor: '#ff4d4f',
  nodeColorGround: '#13c2c2',

  heatmapLow: '#4488ff',
  heatmapMid: '#ffaa00',
  heatmapHigh: '#ff2222',
  heatmapOverlayOpacity: 0.35,

  glowColor: '#1677ff',
  glowIntensity: 0.4,
  flowColor: '#13c2c2',
  pulseColor: '#1677ff',

  shadowSm: '0 1px 3px rgba(0,0,0,0.1)',
  shadowMd: '0 4px 12px rgba(0,0,0,0.12)',
  shadowLg: '0 8px 32px rgba(0,0,0,0.16)',
  shadowGlow: '0 0 20px rgba(22, 119, 255, 0.2)',
};

// ==================== 主题管理器 ====================

export type ThemeName = 'dark' | 'light';

const THEME_MAP: Record<ThemeName, ThemeTokens> = {
  dark: darkTheme,
  light: lightTheme,
};

/** CSS 变量名映射：token → CSS var */
function tokenToCssVar(token: string): string {
  return `--vis-${token.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
}

/** 主题管理器 */
export class ThemeManager {
  private _current: ThemeName = 'dark';
  private _transitioning = false;
  private listeners: Set<(theme: ThemeName) => void> = new Set();

  get current(): ThemeName { return this._current; }
  get tokens(): ThemeTokens { return THEME_MAP[this._current]; }
  get transitioning(): boolean { return this._transitioning; }

  /** 获取指定主题的 Token */
  getTokens(theme?: ThemeName): ThemeTokens {
    return THEME_MAP[theme ?? this._current];
  }

  /** 注册主题变更监听 */
  onChange(cb: (theme: ThemeName) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** 切换主题（带动画过渡） */
  async switch(theme: ThemeName, animate: boolean = true): Promise<void> {
    if (theme === this._current) return;

    this._transitioning = true;
    const target = THEME_MAP[theme];

    if (animate) {
      // 启用 CSS 过渡
      document.documentElement.style.setProperty(
        'transition',
        'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
      );
    }

    // 应用 CSS 变量
    this.applyCssVars(target);

    this._current = theme;
    document.documentElement.setAttribute('data-theme', theme);

    // 通知监听器
    for (const cb of this.listeners) cb(theme);

    if (animate) {
      await new Promise(resolve => setTimeout(resolve, 400));
      document.documentElement.style.removeProperty('transition');
    }

    this._transitioning = false;
  }

  /** 切换亮/暗 */
  async toggle(animate: boolean = true): Promise<void> {
    await this.switch(this._current === 'dark' ? 'light' : 'dark', animate);
  }

  /** 应用所有 CSS 变量到 :root */
  applyCssVars(tokens?: ThemeTokens): void {
    const t = tokens ?? this.tokens;
    const root = document.documentElement;
    for (const [key, value] of Object.entries(t)) {
      root.style.setProperty(
        tokenToCssVar(key),
        typeof value === 'number' ? String(value) : value
      );
    }
  }

  /** 初始化：从 localStorage 读取或检测系统偏好 */
  init(): void {
    const saved = localStorage.getItem('chip-sim-theme') as ThemeName | null;
    if (saved && (saved === 'dark' || saved === 'light')) {
      this._current = saved;
    } else if (window.matchMedia?.('(prefers-color-scheme: light)').matches) {
      this._current = 'light';
    }
    this.applyCssVars();
    document.documentElement.setAttribute('data-theme', this._current);
  }

  /** 持久化 */
  save(): void {
    localStorage.setItem('chip-sim-theme', this._current);
  }
}

// ==================== 全局单例 ====================

export const themeManager = new ThemeManager();

// ==================== 颜色工具 ====================

/** 解析颜色为 RGB 分量 */
export function parseColor(color: string): [number, number, number] {
  if (color.startsWith('#')) {
    const h = color.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return [r, g, b];
  }
  if (color.startsWith('rgb')) {
    const m = color.match(/\d+/g);
    if (m && m.length >= 3) return [+m[0], +m[1], +m[2]];
  }
  return [128, 128, 128];
}

/** RGB → HEX */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

/** 在两个颜色之间插值 (t: 0→1) */
export function lerpColor(c1: string, c2: string, t: number): string {
  const [r1, g1, b1] = parseColor(c1);
  const [r2, g2, b2] = parseColor(c2);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return rgbToHex(r, g, b);
}

/** 生成带 alpha 的 rgba 字符串 */
export function rgba(color: string, alpha: number): string {
  const [r, g, b] = parseColor(color);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** 电压值映射到颜色 (蓝→黄→红) */
export function voltageToColor(voltage: number, min: number, max: number): string {
  if (max === min) return '#4488ff';
  const t = Math.max(0, Math.min(1, (voltage - min) / (max - min)));
  if (t < 0.5) {
    // 蓝 → 黄
    const s = t * 2;
    return lerpColor('#1a3a6e', '#ccaa00', s);
  } else {
    // 黄 → 红
    const s = (t - 0.5) * 2;
    return lerpColor('#ccaa00', '#ff2222', s);
  }
}

/** 电流值映射到连线亮度 (0→暗, 1→亮) */
export function currentToBrightness(current: number, maxCurrent: number): number {
  if (maxCurrent === 0) return 0.3;
  return 0.3 + 0.7 * Math.min(1, Math.abs(current) / maxCurrent);
}
