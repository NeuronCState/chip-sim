/**
 * Canvas 画布交互 Hook
 * 处理鼠标事件、缩放平移、拖拽、连线、端口吸附、键盘快捷键
 * 增强：框选多选、Ctrl+Z/Y 撤销重做、Space+拖拽平移、Ctrl+S 保存
 */

import { useRef, useEffect, useCallback } from 'react';
import { useCircuitStore } from '../stores/circuit-store';
import { toast } from '../stores/toast-store';
import { WebGLRenderer } from '../lib/rendering/webgl-renderer';
import { getRenderOptimizer } from '../lib/rendering/RenderOptimizer';
import { ToolMode } from '../types/circuit';
import {
  findNearestPort,
  isPointInComponent,
} from '../lib/circuit/circuit-utils';
import { distanceToWire } from '../lib/circuit/wire-routing';

/**
 * 使用电路画布
 * @param canvasRef Canvas 元素引用
 */
export function useCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const spaceHeld = useRef(false);
  const boxSelecting = useRef(false);
  const dragUndoPushed = useRef(false);

  const store = useCircuitStore();

  // 初始化渲染器
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    rendererRef.current = new WebGLRenderer(canvas);

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        rendererRef.current?.resize();
        useCircuitStore.getState().setCanvasSize(parent.clientWidth, parent.clientHeight);
      }
    };
    resize();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      // Remove overlay canvas on cleanup
      const overlay = canvas.parentElement?.querySelector('canvas[style*="pointer-events: none"]') as HTMLCanvasElement | null;
      overlay?.remove();
    };
  }, [canvasRef]);

  // 渲染（带视口裁剪优化 + 未接引脚检测 + 电源缺失检测）
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    renderer.setTransform(store.viewTransform);

    // 使用 RenderOptimizer 进行视口裁剪
    const optimizer = getRenderOptimizer();
    optimizer.markDirty();

    const visibleComponents = optimizer.getVisibleComponents(
      store.components,
      store.wires,
      store.viewTransform,
      store.canvasW,
      store.canvasH
    );

    const visibleWires = optimizer.getVisibleWires(
      store.wires,
      store.components,
      store.viewTransform,
      store.canvasW,
      store.canvasH
    );

    // 计算未连接的端口
    const connectedPorts = new Set<string>();
    for (const wire of store.wires) {
      connectedPorts.add(wire.fromPortId);
      connectedPorts.add(wire.toPortId);
    }
    const unconnectedPorts = new Set<string>();
    for (const comp of store.components) {
      for (const port of comp.ports) {
        if (!connectedPorts.has(port.id)) {
          unconnectedPorts.add(port.id);
        }
      }
    }

    // 检测电源缺失：没有连接到 VCC/GND 类型引脚的元件
    const componentsWithoutPower = new Set<string>();
    for (const comp of store.components) {
      const hasPowerConnection = comp.ports.some(port => {
        if (!connectedPorts.has(port.id)) return false;
        // 检查该端口是否连接到了电源相关的元件
        for (const wire of store.wires) {
          if (wire.fromPortId === port.id || wire.toPortId === port.id) {
            const otherCompId = wire.fromPortId === port.id ? wire.toComponentId : wire.fromComponentId;
            const otherComp = store.components.find(c => c.id === otherCompId);
            if (otherComp && (
              otherComp.type === 'ground' || 
              otherComp.type === 'dc_source' || 
              otherComp.type === 'voltage_source' ||
              otherComp.type === 'battery' ||
              otherComp.type === 'ac_source'
            )) {
              return true;
            }
          }
        }
        return false;
      });
      // 非电源类元件且没有任何电源连接
      if (!hasPowerConnection && 
          comp.type !== 'ground' && 
          comp.type !== 'dc_source' && 
          comp.type !== 'voltage_source' &&
          comp.type !== 'battery' &&
          comp.type !== 'ac_source' &&
          comp.type !== 'resistor' &&
          comp.type !== 'capacitor' &&
          comp.type !== 'inductor') {
        componentsWithoutPower.add(comp.id);
      }
    }

    renderer.render(visibleComponents, visibleWires, store.nodes, {
      wirePreview: store.wirePreview,
      selectedComponentId: store.selectedComponentId,
      selectedWireId: store.selectedWireId,
      selectedComponentIds: store.selectedComponentIds,
      validationMessages: store.validationMessages,
      boxSelectRect: store.boxSelectRect,
      showGrid: store.showGrid,
      unconnectedPorts,
      componentsWithoutPower,
    });
  }, [
    store.components,
    store.nodes,
    store.wires,
    store.viewTransform,
    store.wirePreview,
    store.selectedComponentId,
    store.selectedWireId,
    store.selectedComponentIds,
    store.validationMessages,
    store.boxSelectRect,
    store.showGrid,
    store.canvasW,
    store.canvasH,
  ]);

  // Space held for pan — used by mouse drag handlers below
  // Other keyboard shortcuts are handled by the centralized useKeybindings hook
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        spaceHeld.current = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeld.current = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // 鼠标按下
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !rendererRef.current) return;

      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const canvasPos = rendererRef.current.screenToCanvas(screenX, screenY);

      lastMouse.current = { x: e.clientX, y: e.clientY };

      // === Space+拖拽 或 中键 → 平移 ===
      if (spaceHeld.current || store.toolMode === ToolMode.Pan || e.button === 1) {
        isDragging.current = true;
        return;
      }

      // === 连线模式 ===
      if (store.toolMode === ToolMode.DrawWire) {
        const nearestPort = findNearestPort(
          canvasPos.x,
          canvasPos.y,
          store.components
        );

        if (nearestPort) {
          if (store.wirePreview) {
            store.endWire(nearestPort.componentId, nearestPort.portId);
          } else {
            store.startWire(nearestPort.componentId, nearestPort.portId);
          }
        } else if (store.wirePreview) {
          store.cancelWire();
        }
        return;
      }

      // === 删除模式 ===
      if (store.toolMode === ToolMode.Delete) {
        const clickedComp = store.components.find((c) =>
          isPointInComponent(canvasPos.x, canvasPos.y, c)
        );
        if (clickedComp) {
          store.removeComponent(clickedComp.id);
          return;
        }
        for (const wire of store.wires) {
          const dist = distanceToWire(canvasPos.x, canvasPos.y, wire.points);
          if (dist < 8) {
            store.removeWire(wire.id);
            return;
          }
        }
        return;
      }

      // === 选择模式 ===
      if (store.toolMode === ToolMode.Select) {
        // 检查是否点击了连线
        for (const wire of store.wires) {
          const dist = distanceToWire(canvasPos.x, canvasPos.y, wire.points);
          if (dist < 8) {
            store.selectWire(wire.id);
            return;
          }
        }

        // 检查是否点击了元件
        const clickedComp = store.components.find((c) =>
          isPointInComponent(canvasPos.x, canvasPos.y, c)
        );

        if (clickedComp) {
          if (e.ctrlKey || e.metaKey) {
            // Ctrl+点击：切换选中状态（多选）
            store.selectComponentMulti(clickedComp.id);
          } else if (store.selectedComponentIds.has(clickedComp.id)) {
            // 点击已选中元件：开始拖拽，不清除选择
          } else {
            // 点击未选中元件：单选该元件
            store.selectComponent(clickedComp.id);
          }
          // 拖拽开始前保存快照，使移动操作可撤销
          if (!dragUndoPushed.current) {
            store.pushUndo();
            dragUndoPushed.current = true;
          }
          isDragging.current = true;
        } else {
          // 点击空白 → 开始框选（不清除选择，支持 Ctrl+框选追加）
          if (!e.ctrlKey && !e.metaKey) {
            store.clearSelection();
          }
          store.startBoxSelect(canvasPos.x, canvasPos.y);
          boxSelecting.current = true;
        }
      }
    },
    [canvasRef, store]
  );

  // 鼠标移动
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !rendererRef.current) return;

      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const canvasPos = rendererRef.current.screenToCanvas(screenX, screenY);

      // Update mouse position for status bar
      store.setMouseCanvasPos(canvasPos.x, canvasPos.y);

      // === 连线模式：更新预览 ===
      if (store.toolMode === ToolMode.DrawWire && store.wirePreview) {
        store.updateWirePreview(canvasPos.x, canvasPos.y);
      }

      // === 平移 (Space+拖拽 或 Pan模式) ===
      if (isDragging.current && (spaceHeld.current || store.toolMode === ToolMode.Pan)) {
        const dx = e.clientX - lastMouse.current.x;
        const dy = e.clientY - lastMouse.current.y;
        lastMouse.current = { x: e.clientX, y: e.clientY };

        store.setViewTransform({
          offsetX: store.viewTransform.offsetX + dx,
          offsetY: store.viewTransform.offsetY + dy,
        });
        return;
      }

      // === 框选 ===
      if (boxSelecting.current && store.boxSelectRect) {
        store.updateBoxSelect(canvasPos.x, canvasPos.y);
        return;
      }

      // === 拖拽移动元件 ===
      if (
        isDragging.current &&
        store.toolMode === ToolMode.Select &&
        (store.selectedComponentId || store.selectedComponentIds.size > 0)
      ) {
        // Push undo once at drag start
        if (!dragUndoPushed.current) {
          store.pushUndo();
          dragUndoPushed.current = true;
        }

        const dx = e.clientX - lastMouse.current.x;
        const dy = e.clientY - lastMouse.current.y;
        lastMouse.current = { x: e.clientX, y: e.clientY };

        const scaledDx = dx / store.viewTransform.scale;
        const scaledDy = dy / store.viewTransform.scale;

        if (store.selectedComponentIds.size > 1) {
          store.moveSelectedComponents(scaledDx, scaledDy);
        } else if (store.selectedComponentId) {
          const comp = store.components.find(
            (c) => c.id === store.selectedComponentId
          );
          if (comp) {
            store.moveComponent(
              store.selectedComponentId,
              comp.position.x + scaledDx,
              comp.position.y + scaledDy
            );
          }
        }
        return;
      }

      lastMouse.current = { x: e.clientX, y: e.clientY };
    },
    [canvasRef, store]
  );

  // 鼠标释放
  const handleMouseUp = useCallback(() => {
    if (boxSelecting.current) {
      boxSelecting.current = false;
      store.endBoxSelect();
    }
    isDragging.current = false;
    dragUndoPushed.current = false;
  }, [store]);

  // 滚轮缩放（降低灵敏度）
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.97 : 1.03;
      const newScale = Math.min(
        5,
        Math.max(0.1, store.viewTransform.scale * factor)
      );

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const scaleFactor = newScale / store.viewTransform.scale;
      store.setViewTransform({
        scale: newScale,
        offsetX:
          mouseX - (mouseX - store.viewTransform.offsetX) * scaleFactor,
        offsetY:
          mouseY - (mouseY - store.viewTransform.offsetY) * scaleFactor,
      });
    },
    [canvasRef, store]
  );

  // 拖拽放置处理（带自动吸附最近引脚）
  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas || !rendererRef.current) return;

      const data = e.dataTransfer.getData('application/circuit-component');
      if (!data) return;

      try {
        const { type, name } = JSON.parse(data) as {
          type: string;
          name: string;
        };

        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        let canvasPos = rendererRef.current.screenToCanvas(
          screenX,
          screenY
        );

        // 自动吸附：查找最近的未连接引脚并吸附
        const snapTarget = findNearestPort(canvasPos.x, canvasPos.y, store.components, 50);
        if (snapTarget) {
          // 将元件放置在靠近目标引脚的位置
          canvasPos = {
            x: snapTarget.position.x - 30,
            y: snapTarget.position.y,
          };
        }

        store.addComponent(
          type as (typeof import('../types/circuit').ComponentType)[keyof typeof import('../types/circuit').ComponentType],
          name,
          canvasPos.x,
          canvasPos.y
        );

        // 放置后自动连线到最近引脚
        if (snapTarget) {
          const state = useCircuitStore.getState();
          const newComp = state.components[state.components.length - 1];
          if (newComp && newComp.ports.length > 0) {
            // 找到新元件最近的端口
            const nearestNewPort = findNearestPort(
              snapTarget.position.x,
              snapTarget.position.y,
              [newComp],
              100
            );
            if (nearestNewPort) {
              state.addWire(
                nearestNewPort.componentId,
                nearestNewPort.portId,
                snapTarget.componentId,
                snapTarget.portId
              );
            }
          }
        }
      } catch {
        console.error('Invalid drag data');
        toast.error('元件添加失败：无效的拖拽数据');
      }
    },
    [canvasRef, store]
  );

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    handleDragOver,
    handleDrop,
    renderer: rendererRef,
  };
}
