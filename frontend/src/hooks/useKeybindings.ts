/**
 * 快捷键 React Hook
 * 
 * 统一管理键盘事件，通过 KeybindingManager 解析按键，
 * 分发到 circuit-store 的对应 action。
 * 支持上下文感知：画布焦点 vs 输入框焦点。
 */

import { useEffect, useRef, useCallback } from 'react';
import {
  KeybindingManager,
  QUICKPLACE_MAP,
  type KeyBinding,
  type ShortcutContext,
} from '../core/KeybindingManager';
import { useCircuitStore } from '../stores/circuit-store';
import { toast } from '../stores/ui-store';
import { ToolMode } from '../types/circuit';
import { resetComponentCounters } from '../features/editor/ComponentLibrary';

// 快速放置计数器
const quickPlaceCounters: Record<string, number> = {};

/** 全局 KeybindingManager 实例 */
let globalManager: KeybindingManager | null = null;

export function getKeybindingManager(): KeybindingManager {
  if (!globalManager) {
    globalManager = new KeybindingManager();
    globalManager.loadFromStorage();
  }
  return globalManager;
}

/**
 * useKeybindings Hook
 * 在 EditorPage 或 CircuitCanvas 中调用一次即可激活全部快捷键
 */
export function useKeybindings() {
  const managerRef = useRef<KeybindingManager>(getKeybindingManager());

  /** 判断当前焦点上下文 */
  const getContext = useCallback((): ShortcutContext => {
    const el = document.activeElement;
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement ||
      (el instanceof HTMLElement && el.isContentEditable)
    ) {
      return 'input';
    }
    return 'canvas';
  }, []);

  /** 执行快捷键动作 */
  const executeAction = useCallback((binding: KeyBinding) => {
    const store = useCircuitStore.getState();

    switch (binding.action) {
      // --- 编辑 ---
      case 'undo':
        store.undo();
        break;
      case 'redo':
        store.redo();
        break;
      case 'copy':
        store.copySelected();
        toast.info('已复制到剪贴板');
        break;
      case 'cut':
        store.cutSelected();
        toast.info('已剪切');
        break;
      case 'paste':
        store.paste();
        break;
      case 'selectAll':
        store.selectAll();
        break;
      case 'delete':
        store.deleteSelected();
        break;
      case 'duplicate':
        store.duplicate();
        break;
      case 'escape':
        store.cancelWire();
        store.clearSelection();
        store.setToolMode(ToolMode.Select);
        break;
      case 'group':
        // 暂时无分组功能，提示用户
        toast.info('组合功能开发中');
        break;

      // --- 文件 ---
      case 'save':
        store.exportProject('my-circuit');
        toast.success('电路已导出');
        break;
      case 'newProject':
        if (store.components.length > 0 && !confirm('新建电路将清空当前内容，确定？')) return;
        resetComponentCounters();
        store.reset();
        toast.info('已创建新电路');
        break;

      // --- 视图 ---
      case 'fitToScreen':
        store.fitToScreen();
        break;
      case 'zoomIn': {
        const newScale = Math.min(5, store.viewTransform.scale * 1.2);
        const cx = store.canvasW / 2;
        const cy = store.canvasH / 2;
        const factor = newScale / store.viewTransform.scale;
        store.setViewTransform({
          scale: newScale,
          offsetX: cx - (cx - store.viewTransform.offsetX) * factor,
          offsetY: cy - (cy - store.viewTransform.offsetY) * factor,
        });
        break;
      }
      case 'zoomOut': {
        const newScale2 = Math.max(0.1, store.viewTransform.scale / 1.2);
        const cx2 = store.canvasW / 2;
        const cy2 = store.canvasH / 2;
        const factor2 = newScale2 / store.viewTransform.scale;
        store.setViewTransform({
          scale: newScale2,
          offsetX: cx2 - (cx2 - store.viewTransform.offsetX) * factor2,
          offsetY: cy2 - (cy2 - store.viewTransform.offsetY) * factor2,
        });
        break;
      }
      case 'toggleGrid':
        store.setShowGrid(!store.showGrid);
        break;
      case 'toggleSnap':
        store.setSnapToGrid(!store.snapToGrid);
        toast.info(store.snapToGrid ? '吸附已关闭' : '吸附已开启');
        break;
      case 'cycleRouting': {
        const next = store.wireRouting === 'orthogonal' ? 'straight' : 'orthogonal';
        store.setWireRouting(next);
        toast.info(next === 'orthogonal' ? '直角连线' : '直线连线');
        break;
      }
      case 'toggleTheme':
        store.toggleTheme();
        break;

      // --- 工具 ---
      case 'toolSelect':
        store.setToolMode(ToolMode.Select);
        break;
      case 'toolWire':
        store.setToolMode(ToolMode.DrawWire);
        break;
      case 'toolPan':
        store.setToolMode(ToolMode.Pan);
        break;
      case 'toolDelete':
        store.setToolMode(ToolMode.Delete);
        break;

      // --- 元件 ---
      case 'rotate':
        if (store.selectedComponentIds.size > 0) {
          store.rotateSelected();
        } else if (store.selectedComponentId) {
          store.rotateComponent(store.selectedComponentId);
        }
        break;
      case 'quickPlace': {
        const ct = binding.actionParams?.componentType as string | undefined;
        if (!ct) break;
        const mapping = QUICKPLACE_MAP[ct];
        if (!mapping) break;
        quickPlaceCounters[ct] = (quickPlaceCounters[ct] || 0) + 1;
        const name = `${mapping.prefix}${quickPlaceCounters[ct]}`;
        const count = store.components.length;
        const x = 200 + (count % 5) * 100;
        const y = 200 + Math.floor(count / 5) * 80;
        store.addComponent(mapping.type as any, name, x, y);
        toast.info(`已放置 ${mapping.name}`);
        break;
      }

      // --- 仿真 ---
      case 'runSimulation':
        toast.info('仿真功能触发（F5）');
        break;

      // --- 帮助 ---
      case 'toggleShortcutsHelp':
        store.toggleShortcutsHelp();
        break;

      default:
        console.warn('未知快捷键动作:', binding.action);
    }
  }, []);

  // 键盘事件监听
  useEffect(() => {
    const manager = managerRef.current;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Space is handled by useCanvas for pan+drag
      if (e.code === 'Space') return;

      const context = getContext();
      const binding = manager.resolve(e);
      if (!binding) return;

      // 上下文检查
      if (!manager.isContextActive(binding, context)) return;

      // 需要选中状态检查
      const store = useCircuitStore.getState();
      if (binding.requiresSelection) {
        const hasSelection =
          store.selectedComponentId !== null ||
          store.selectedComponentIds.size > 0 ||
          store.selectedWireId !== null;
        if (!hasSelection) return;
      }
      if (binding.requiresMultiSelection) {
        if (store.selectedComponentIds.size < 2) return;
      }

      if (binding.preventDefault) {
        e.preventDefault();
      }

      executeAction(binding);
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [getContext, executeAction]);

  return {
    manager: managerRef.current,
  };
}
