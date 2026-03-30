/**
 * 快捷键帮助面板（增强版）
 * 
 * - 分类展示：编辑、视图、仿真、文件操作等
 * - 搜索功能：实时过滤快捷键
 * - 从 KeybindingManager 动态读取，支持自定义后自动更新
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useCircuitStore } from '../../stores/circuit-store';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from '../../core/KeybindingManager';
import { getKeybindingManager } from '../../hooks/useKeybindings';
import type { KeyBinding, ShortcutCategory } from '../../core/KeybindingManager';
import './ShortcutsHelp.css';

export function ShortcutsHelp() {
  const show = useCircuitStore((s) => s.showShortcutsHelp);
  const toggle = useCircuitStore((s) => s.toggleShortcutsHelp);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const manager = getKeybindingManager();

  // 面板打开时自动聚焦搜索框
  useEffect(() => {
    if (show) {
      setSearch('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [show]);

  // 按分类获取快捷键
  const grouped = useMemo(() => {
    const all = manager.getAllByCategory();
    // 按固定顺序排列
    const sorted = new Map<ShortcutCategory, KeyBinding[]>();
    for (const cat of CATEGORY_ORDER) {
      const items = all.get(cat);
      if (items && items.length > 0) {
        sorted.set(cat, items);
      }
    }
    return sorted;
  }, [manager]);

  // 搜索结果
  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    return manager.search(search.trim());
  }, [search, manager]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) toggle();
    },
    [toggle]
  );

  // ESC 关闭
  useEffect(() => {
    if (!show) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [show, toggle]);

  if (!show) return null;

  return (
    <div className="shortcuts-overlay" onClick={handleOverlayClick}>
      <div className="shortcuts-panel" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-header">
          <h3>⌨️ 快捷键速查</h3>
          <button className="shortcuts-close" onClick={toggle} title="关闭 (Esc)">✕</button>
        </div>

        {/* 搜索框 */}
        <div className="shortcuts-search">
          <input
            ref={inputRef}
            type="text"
            className="shortcuts-search-input"
            placeholder="🔍 搜索快捷键..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="shortcuts-search-clear" onClick={() => setSearch('')}>
              ✕
            </button>
          )}
        </div>

        <div className="shortcuts-body">
          {searchResults ? (
            // 搜索结果
            searchResults.length > 0 ? (
              <div className="shortcuts-search-results">
                <div className="shortcuts-result-count">
                  找到 {searchResults.length} 个匹配项
                </div>
                {searchResults.map((binding) => (
                  <div key={binding.id} className="shortcuts-result-item">
                    <kbd className="shortcut-keys">{manager.formatBinding(binding)}</kbd>
                    <span className="shortcut-desc">{binding.description}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="shortcuts-no-results">
                未找到匹配「{search}」的快捷键
              </div>
            )
          ) : (
            // 分类展示
            Array.from(grouped.entries()).map(([category, items]) => (
              <div key={category} className="shortcuts-group">
                <h4>{CATEGORY_LABELS[category]}</h4>
                <table>
                  <tbody>
                    {items.map((binding) => (
                      <tr key={binding.id}>
                        <td className="shortcut-keys">
                          <kbd>{manager.formatBinding(binding)}</kbd>
                        </td>
                        <td className="shortcut-desc">{binding.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>

        <div className="shortcuts-footer">
          按 <kbd>?</kbd> 或 <kbd>F1</kbd> 打开 · <kbd>Esc</kbd> 关闭
        </div>
      </div>
    </div>
  );
}
