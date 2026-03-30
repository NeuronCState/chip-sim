/**
 * useTheme Hook
 * 支持 light/dark/system 三态切换
 * localStorage 记忆 + OS prefers-color-scheme 跟随
 */

import { useState, useEffect, useCallback } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'theme-preference';

/** 将 system 偏好解析为实际主题 */
function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return preference;
}

/** 从 localStorage 读取已保存的偏好 */
function getSavedPreference(): ThemePreference {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark' || saved === 'system') {
    return saved;
  }
  return 'system';
}

/**
 * 主题 Hook
 * 
 * @example
 * const { theme, preference, setPreference, resolvedTheme } = useTheme();
 */
export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(getSavedPreference);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(getSavedPreference()));

  // 应用主题到 DOM
  const applyToDom = useCallback((resolved: ResolvedTheme) => {
    document.documentElement.setAttribute('data-theme', resolved);
    setResolvedTheme(resolved);

    // 通知其他系统（Monaco、图表等）
    window.dispatchEvent(new CustomEvent('themechange', { detail: resolved }));
  }, []);

  // 设置偏好（含持久化）
  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    localStorage.setItem(STORAGE_KEY, pref);
    const resolved = resolveTheme(pref);
    applyToDom(resolved);
  }, [applyToDom]);

  // 监听 OS 主题变化（仅 system 模式）
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (preference === 'system') {
        const resolved = resolveTheme('system');
        applyToDom(resolved);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [preference, applyToDom]);

  // 初始化：应用当前主题
  useEffect(() => {
    const resolved = resolveTheme(preference);
    applyToDom(resolved);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    /** 当前用户偏好 */
    preference,
    /** 实际解析后的主题 */
    resolvedTheme,
    /** 是否为暗色 */
    isDark: resolvedTheme === 'dark',
    /** 设置偏好 */
    setPreference,
    /** 便捷切换亮/暗 */
    toggle: () => setPreference(resolvedTheme === 'dark' ? 'light' : 'dark'),
  };
}
