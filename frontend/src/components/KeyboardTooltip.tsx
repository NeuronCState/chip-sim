/**
 * 键盘操作提示组件
 * 
 * 当鼠标悬停在元件上时，显示可用的键盘操作提示
 * 提升用户对快捷键的认知
 */

import { useState, useEffect } from 'react';
import { useCircuitStore } from '../stores/circuit-store';
import './KeyboardTooltip.css';

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  componentName: string;
}

/** 可用操作提示列表 */
const AVAILABLE_ACTIONS = [
  { key: 'R', desc: '旋转' },
  { key: 'Del', desc: '删除' },
  { key: 'Ctrl+C', desc: '复制' },
  { key: 'Ctrl+D', desc: '克隆' },
  { key: 'Ctrl+X', desc: '剪切' },
];

export function KeyboardTooltip() {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    componentName: '',
  });

  const showShortcutsHelp = useCircuitStore((s) => s.showShortcutsHelp);

  // 监听鼠标位置和选中状态
  useEffect(() => {
    if (showShortcutsHelp) {
      setTooltip((t) => ({ ...t, visible: false }));
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const store = useCircuitStore.getState();
      const hasSelection =
        store.selectedComponentId !== null || store.selectedComponentIds.size > 0;

      if (!hasSelection) {
        setTooltip((t) => (t.visible ? { ...t, visible: false } : t));
        return;
      }

      // 获取鼠标附近的元件名称
      const comp = store.selectedComponentId
        ? store.components.find((c) => c.id === store.selectedComponentId)
        : null;

      const name = comp
        ? comp.name
        : store.selectedComponentIds.size > 1
          ? `${store.selectedComponentIds.size} 个元件`
          : '';

      setTooltip({
        visible: true,
        x: e.clientX + 16,
        y: e.clientY - 8,
        componentName: name,
      });
    };

    const handleMouseLeave = () => {
      setTooltip((t) => ({ ...t, visible: false }));
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [showShortcutsHelp]);

  // 检测操作系统
  const isMac = navigator.platform.includes('Mac');
  const ctrlKey = isMac ? '⌘' : 'Ctrl';

  if (!tooltip.visible) return null;

  return (
    <div
      className="keyboard-tooltip"
      style={{ left: tooltip.x, top: tooltip.y }}
    >
      <div className="kb-tooltip-title">{tooltip.componentName}</div>
      <div className="kb-tooltip-actions">
        {AVAILABLE_ACTIONS.map((action) => (
          <div key={action.key} className="kb-tooltip-row">
            <kbd className="kb-tooltip-key">
              {action.key.replace('Ctrl', ctrlKey)}
            </kbd>
            <span className="kb-tooltip-desc">{action.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
