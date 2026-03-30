/**
 * ThemeProvider — React Context 提供主题状态
 */

import React, { createContext, useContext } from 'react';
import { useTheme } from './useTheme';
import type { ThemePreference, ResolvedTheme } from './useTheme';

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  isDark: boolean;
  setPreference: (pref: ThemePreference) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useTheme();

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

/** 获取主题上下文，必须在 ThemeProvider 内使用 */
export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useThemeContext must be used within <ThemeProvider>');
  }
  return ctx;
}
