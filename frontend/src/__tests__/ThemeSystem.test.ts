import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ThemeManager,
  darkTheme,
  lightTheme,
  parseColor,
  rgbToHex,
  lerpColor,
  rgba,
  voltageToColor,
  currentToBrightness,
} from '../core/ThemeSystem';
import type { ThemeTokens } from '../core/ThemeSystem';

// Mock document for Node.js test environment
const mockStyle: Record<string, string> = {};
const mockDocumentElement = {
  style: {
    setProperty: (key: string, value: string) => { mockStyle[key] = value; },
    removeProperty: (key: string) => { delete mockStyle[key]; },
  },
  setAttribute: vi.fn(),
};
vi.stubGlobal('document', {
  documentElement: mockDocumentElement,
});
vi.stubGlobal('window', {
  matchMedia: () => ({ matches: false }),
});
vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
});

describe('ThemeSystem', () => {
  // ==================== 颜色工具函数 ====================

  describe('parseColor', () => {
    it('应解析 HEX 颜色', () => {
      expect(parseColor('#ff0000')).toEqual([255, 0, 0]);
      expect(parseColor('#00ff00')).toEqual([0, 255, 0]);
      expect(parseColor('#0000ff')).toEqual([0, 0, 255]);
    });

    it('应解析短 HEX 颜色（如果有）', () => {
      const result = parseColor('#aabbcc');
      expect(result).toEqual([170, 187, 204]);
    });

    it('应解析 rgb() 颜色', () => {
      expect(parseColor('rgb(100, 150, 200)')).toEqual([100, 150, 200]);
    });

    it('无效颜色应返回默认灰色', () => {
      expect(parseColor('invalid')).toEqual([128, 128, 128]);
    });
  });

  describe('rgbToHex', () => {
    it('应正确转换 RGB 为 HEX', () => {
      expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
      expect(rgbToHex(0, 255, 0)).toBe('#00ff00');
      expect(rgbToHex(0, 0, 255)).toBe('#0000ff');
    });

    it('应正确处理小于 16 的值（补零）', () => {
      expect(rgbToHex(0, 0, 0)).toBe('#000000');
      expect(rgbToHex(1, 2, 3)).toBe('#010203');
    });
  });

  describe('lerpColor', () => {
    it('t=0 应返回起始颜色', () => {
      expect(lerpColor('#ff0000', '#0000ff', 0)).toBe('#ff0000');
    });

    it('t=1 应返回终止颜色', () => {
      expect(lerpColor('#ff0000', '#0000ff', 1)).toBe('#0000ff');
    });

    it('t=0.5 应返回中间颜色', () => {
      const mid = lerpColor('#000000', '#ffffff', 0.5);
      expect(mid).toBe('#808080');
    });
  });

  describe('rgba', () => {
    it('应生成正确的 rgba 字符串', () => {
      expect(rgba('#ff0000', 0.5)).toBe('rgba(255,0,0,0.5)');
      expect(rgba('#0000ff', 1)).toBe('rgba(0,0,255,1)');
    });
  });

  describe('voltageToColor', () => {
    it('相同 min/max 应返回默认蓝色', () => {
      expect(voltageToColor(5, 5, 5)).toBe('#4488ff');
    });

    it('最小值应返回蓝色调', () => {
      const color = voltageToColor(0, 0, 10);
      expect(color).toContain('1a3a6e');
    });

    it('最大值应返回红色调', () => {
      const color = voltageToColor(10, 0, 10);
      expect(color).toContain('ff2222');
    });

    it('超出范围应被 clamp', () => {
      const colorLow = voltageToColor(-5, 0, 10);
      const colorHigh = voltageToColor(15, 0, 10);
      expect(colorLow).toBe(voltageToColor(0, 0, 10));
      expect(colorHigh).toBe(voltageToColor(10, 0, 10));
    });
  });

  describe('currentToBrightness', () => {
    it('maxCurrent 为 0 应返回 0.3', () => {
      expect(currentToBrightness(1, 0)).toBe(0.3);
    });

    it('电流为 0 应返回最低亮度', () => {
      expect(currentToBrightness(0, 10)).toBe(0.3);
    });

    it('最大电流应返回 1.0', () => {
      expect(currentToBrightness(10, 10)).toBe(1.0);
    });
  });

  // ==================== ThemeManager ====================

  describe('ThemeManager', () => {
    let themeManager: ThemeManager;

    beforeEach(() => {
      themeManager = new ThemeManager();
    });

    it('默认主题应为 dark', () => {
      expect(themeManager.current).toBe('dark');
    });

    it('应能获取暗色主题 tokens', () => {
      const tokens = themeManager.tokens;
      expect(tokens.bgApp).toBe(darkTheme.bgApp);
      expect(tokens.text).toBe(darkTheme.text);
    });

    it('getTokens 应能获取指定主题', () => {
      const darkTokens = themeManager.getTokens('dark');
      const lightTokens = themeManager.getTokens('light');
      expect(darkTokens.bgApp).toBe(darkTheme.bgApp);
      expect(lightTokens.bgApp).toBe(lightTheme.bgApp);
      expect(darkTokens.bgApp).not.toBe(lightTokens.bgApp);
    });

    it('切换主题应触发监听器', async () => {
      const listener = vi.fn();
      themeManager.onChange(listener);

      await themeManager.switch('light', false);
      expect(listener).toHaveBeenCalledWith('light');
      expect(themeManager.current).toBe('light');
    });

    it('切换到相同主题不应触发监听器', async () => {
      const listener = vi.fn();
      themeManager.onChange(listener);

      await themeManager.switch('dark', false);
      expect(listener).not.toHaveBeenCalled();
    });

    it('toggle 应在 dark/light 之间切换', async () => {
      await themeManager.toggle(false);
      expect(themeManager.current).toBe('light');
      await themeManager.toggle(false);
      expect(themeManager.current).toBe('dark');
    });

    it('onChange 返回的取消函数应取消订阅', async () => {
      const listener = vi.fn();
      const unsub = themeManager.onChange(listener);

      unsub();
      await themeManager.switch('light', false);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ==================== 主题 Token 完整性 ====================

  describe('Token 完整性', () => {
    const requiredKeys: (keyof ThemeTokens)[] = [
      'bgApp', 'bgPanel', 'bgInput', 'bgToolbar', 'bgCanvas', 'bgOverlay',
      'border', 'borderLight', 'borderAccent',
      'text', 'textDim', 'textMuted', 'textInverse',
      'accent', 'accentHover', 'accentSubtle',
      'success', 'danger', 'warning', 'info',
      'gridColor', 'wireColor', 'componentColor', 'portColor',
      'selectionColor', 'nodeColor',
    ];

    it('暗色主题应包含所有必需 token', () => {
      for (const key of requiredKeys) {
        expect(darkTheme[key]).toBeDefined();
        expect(String(darkTheme[key]).length).toBeGreaterThan(0);
      }
    });

    it('亮色主题应包含所有必需 token', () => {
      for (const key of requiredKeys) {
        expect(lightTheme[key]).toBeDefined();
        expect(String(lightTheme[key]).length).toBeGreaterThan(0);
      }
    });

    it('暗色和亮色主题的背景色应不同', () => {
      expect(darkTheme.bgApp).not.toBe(lightTheme.bgApp);
      expect(darkTheme.bgPanel).not.toBe(lightTheme.bgPanel);
      expect(darkTheme.text).not.toBe(lightTheme.text);
    });
  });
});
