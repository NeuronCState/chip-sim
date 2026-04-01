/**
 * ThemeSwitcher — 主题切换控件
 * L 亮色 / D 暗色 / S 跟随系统
 */

import React from 'react';
import { useThemeContext } from './ThemeProvider';
import type { ThemePreference } from './useTheme';
import './switcher.css';

const options: { value: ThemePreference; label: string; icon: string }[] = [
  { value: 'light', label: '亮色', icon: 'L' },
  { value: 'dark', label: '暗色', icon: 'D' },
  { value: 'system', label: '系统', icon: 'S' },
];

export function ThemeSwitcher() {
  const { preference, setPreference } = useThemeContext();

  return (
    <div
      className="theme-switcher"
      role="radiogroup"
      aria-label="主题切换"
    >
      {options.map(opt => (
        <button
          key={opt.value}
          className={`theme-switcher-btn ${preference === opt.value ? 'active' : ''}`}
          role="radio"
          aria-checked={preference === opt.value}
          aria-label={`${opt.label}主题`}
          onClick={() => setPreference(opt.value)}
          title={opt.label}
        >
          <span className="theme-switcher-icon" aria-hidden="true">{opt.icon}</span>
          <span className="theme-switcher-label">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

/** 简洁版切换按钮（仅图标，点击轮转） */
export function ThemeToggle() {
  const { preference, setPreference, isDark } = useThemeContext();

  const cyclePreference = () => {
    const order: ThemePreference[] = ['light', 'dark', 'system'];
    const idx = order.indexOf(preference);
    setPreference(order[(idx + 1) % order.length]);
  };

  const icon = preference === 'light' ? 'L' : preference === 'dark' ? 'D' : 'S';

  return (
    <button
      className="theme-toggle"
      onClick={cyclePreference}
      aria-label={`当前主题：${preference === 'light' ? '亮色' : preference === 'dark' ? '暗色' : '跟随系统'}，点击切换`}
      title={preference === 'light' ? '亮色' : preference === 'dark' ? '暗色' : '跟随系统'}
    >
      {icon}
    </button>
  );
}
