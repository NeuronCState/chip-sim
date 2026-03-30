/**
 * chartTheme.ts — 从 CSS 变量读取图表配色
 * 供 Canvas/SVG 渲染层使用
 */

export interface ChartColors {
  bg: string;
  plotBg: string;
  grid: string;
  axis: string;
  label: string;
  zeroLine: string;
  border: string;
  cursor: string;
  series: string[];
}

/** 读取 CSS 变量值 */
function readVar(name: string, fallback: string): string {
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return val || fallback;
}

/**
 * 获取当前主题下的图表配色
 * 从 CSS 变量实时读取，确保主题切换后自动更新
 */
export function getChartColors(): ChartColors {
  return {
    bg: readVar('--tk-chart-bg', '#ffffff'),
    plotBg: readVar('--tk-chart-plot-bg', '#ffffff'),
    grid: readVar('--tk-chart-grid', 'rgba(200, 200, 210, 0.8)'),
    axis: readVar('--tk-chart-axis', '#999999'),
    label: readVar('--tk-chart-label', '#666666'),
    zeroLine: readVar('--tk-chart-zero-line', 'rgba(150, 150, 170, 0.7)'),
    border: readVar('--tk-chart-border', '#cccccc'),
    cursor: readVar('--tk-chart-cursor', '#888888'),
    series: [
      readVar('--tk-chart-series-1', '#1677ff'),
      readVar('--tk-chart-series-2', '#13c2c2'),
      readVar('--tk-chart-series-3', '#ff4d4f'),
      readVar('--tk-chart-series-4', '#faad14'),
      readVar('--tk-chart-series-5', '#722ed1'),
      readVar('--tk-chart-series-6', '#eb2f96'),
    ],
  };
}

/** 检测当前是否为暗色主题 */
export function isDarkTheme(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

/**
 * 监听主题变化并回调
 * @returns 取消监听的函数
 */
export function onThemeChange(callback: (isDark: boolean) => void): () => void {
  const handler = (e: Event) => {
    const resolved = (e as CustomEvent).detail as string;
    callback(resolved === 'dark');
  };
  window.addEventListener('themechange', handler);
  return () => window.removeEventListener('themechange', handler);
}
