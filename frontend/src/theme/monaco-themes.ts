/**
 * Monaco Editor 自定义暗色主题
 * 与 ChipSim 全局暗色体系一致
 */

import type { editor } from 'monaco-editor';

/** chip-sim-dark 主题定义 */
export const chipSimDarkTheme: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'c084fc' },
    { token: 'string', foreground: '86efac' },
    { token: 'number', foreground: 'fbbf24' },
    { token: 'type', foreground: '67e8f9' },
    { token: 'function', foreground: '93c5fd' },
    { token: 'variable', foreground: 'f1f5f9' },
    { token: 'operator', foreground: '94a3b8' },
    { token: 'delimiter', foreground: '94a3b8' },
    { token: 'tag', foreground: 'f472b6' },
    { token: 'attribute.name', foreground: 'fbbf24' },
    { token: 'attribute.value', foreground: '86efac' },
    { token: 'regexp', foreground: 'f472b6' },
  ],
  colors: {
    'editor.background': '#1e293b',
    'editor.foreground': '#f1f5f9',
    'editor.lineHighlightBackground': '#334155',
    'editor.selectionBackground': '#3b82f640',
    'editor.inactiveSelectionBackground': '#3b82f620',
    'editorCursor.foreground': '#60a5fa',
    'editorLineNumber.foreground': '#64748b',
    'editorLineNumber.activeForeground': '#94a3b8',
    'editor.selectionHighlightBackground': '#3b82f620',
    'editorIndentGuide.background': '#334155',
    'editorIndentGuide.activeBackground': '#475569',
    'editorWidget.background': '#1e293b',
    'editorWidget.border': '#334155',
    'editorSuggestWidget.background': '#1e293b',
    'editorSuggestWidget.border': '#334155',
    'editorSuggestWidget.selectedBackground': '#334155',
    'editorHoverWidget.background': '#1e293b',
    'editorHoverWidget.border': '#334155',
    'scrollbar.shadow': '#00000040',
    'scrollbarSlider.background': '#64748b40',
    'scrollbarSlider.hoverBackground': '#64748b60',
    'scrollbarSlider.activeBackground': '#64748b80',
    'minimap.background': '#1e293b',
  },
};

/** 亮色主题（VS 默认） */
export const lightThemeName = 'vs';
/** 暗色主题名称 */
export const darkThemeName = 'chip-sim-dark';

/**
 * 注册自定义主题到 Monaco
 * 需要在 Monaco 初始化前调用
 */
export function registerChipSimTheme(
  monacoModule: typeof import('monaco-editor')
): void {
  monacoModule.editor.defineTheme(darkThemeName, chipSimDarkTheme);
}

/**
 * 动态切换 Monaco 主题
 * @param theme 'light' | 'dark'
 * @param monacoModule 可选的 monaco 模块引用
 */
export function applyMonacoTheme(
  theme: 'light' | 'dark',
  monacoModule?: typeof import('monaco-editor')
): void {
  const targetTheme = theme === 'dark' ? darkThemeName : lightThemeName;

  if (monacoModule) {
    monacoModule.editor.setTheme(targetTheme);
  }

  // 同时通过全局事件通知其他 Monaco 实例
  window.dispatchEvent(
    new CustomEvent('monaco-theme-change', { detail: targetTheme })
  );
}

/**
 * 监听全局主题变化事件，自动同步 Monaco 主题
 */
export function syncMonacoWithGlobalTheme(
  monacoModule: typeof import('monaco-editor')
): () => void {
  // 注册主题
  registerChipSimTheme(monacoModule);

  // 监听主题变化
  const handler = (e: Event) => {
    const resolved = (e as CustomEvent).detail as 'light' | 'dark';
    applyMonacoTheme(resolved, monacoModule);
  };

  window.addEventListener('themechange', handler);

  // 初始同步
  const currentTheme = document.documentElement.getAttribute('data-theme');
  if (currentTheme === 'dark') {
    applyMonacoTheme('dark', monacoModule);
  }

  return () => window.removeEventListener('themechange', handler);
}
