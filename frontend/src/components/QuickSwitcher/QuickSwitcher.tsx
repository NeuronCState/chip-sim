/**
 * QuickSwitcher - 快速项目切换面板 (Ctrl/Cmd + P)
 * 类似 VSCode Ctrl+P 的快速项目切换
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { projectManager } from '../../core/ProjectManager';
import type { ProjectIndexEntry } from '../../core/StorageManager';
import './QuickSwitcher.css';

interface QuickSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  /** 打开项目后的回调 */
  onProjectOpened?: (id: string) => void;
  /** 当前打开的项目 ID */
  currentProjectId?: string | null;
}

export function QuickSwitcher({ isOpen, onClose, onProjectOpened, currentProjectId }: QuickSwitcherProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [projects, setProjects] = useState<ProjectIndexEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setProjects(projectManager.getProjects());
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 10);

  const handleSelect = useCallback(async (id: string) => {
    await projectManager.openProject(id);
    onProjectOpened?.(id);
    onClose();
  }, [onProjectOpened, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      handleSelect(filtered[selectedIndex].id);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="qs-overlay" onClick={onClose}>
      <div className="qs-panel" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="qs-input"
          placeholder="🔍 输入项目名称搜索..."
          value={query}
          onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
          onKeyDown={handleKeyDown}
        />
        <div className="qs-list">
          {filtered.length === 0 ? (
            <div className="qs-empty">没有匹配的项目</div>
          ) : (
            filtered.map((p, i) => (
              <div
                key={p.id}
                className={`qs-item ${i === selectedIndex ? 'qs-item-active' : ''} ${p.id === currentProjectId ? 'qs-item-current' : ''}`}
                onClick={() => handleSelect(p.id)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span className="qs-item-icon">📄</span>
                <span className="qs-item-name">{p.name}</span>
                {p.id === currentProjectId && <span className="qs-badge">当前</span>}
                <span className="qs-item-meta">{p.componentCount} 元件</span>
              </div>
            ))
          )}
        </div>
        <div className="qs-footer">
          <span>↑↓ 导航</span>
          <span>Enter 打开</span>
          <span>Esc 关闭</span>
        </div>
      </div>
    </div>
  );
}
