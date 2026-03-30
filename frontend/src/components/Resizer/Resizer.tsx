/**
 * Resizer — 可拖拽分隔线组件
 * 支持水平（左-中、中-右）和垂直（主-底）两种方向
 */

import { useCallback, useRef, useState } from 'react';
import './Resizer.css';

export interface ResizerProps {
  /** 拖拽方向 */
  direction: 'horizontal' | 'vertical';
  /** 拖拽回调，返回新的尺寸（px） */
  onResize: (delta: number) => void;
  /** 拖拽结束回调（用于持久化等） */
  onPointerUp?: () => void;
  /** 最小尺寸（px） */
  minSize?: number;
  /** 最大尺寸（px） */
  maxSize?: number;
  /** 额外 className */
  className?: string;
}

export function Resizer({
  direction,
  onResize,
  onPointerUp,
  minSize = 100,
  maxSize = Infinity,
  className = '',
}: ResizerProps) {
  const [dragging, setDragging] = useState(false);
  const startPosRef = useRef(0);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(true);
      startPosRef.current = direction === 'horizontal' ? e.clientX : e.clientY;

      const handlePointerMove = (ev: PointerEvent) => {
        const currentPos = direction === 'horizontal' ? ev.clientX : ev.clientY;
        const delta = currentPos - startPosRef.current;
        if (delta === 0) return;
        onResize(delta);
        startPosRef.current = currentPos;
      };

      const handlePointerUp = () => {
        setDragging(false);
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        onPointerUp?.();
      };

      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);

      // 设置拖拽时的光标
      document.body.style.cursor =
        direction === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [direction, onResize],
  );

  return (
    <div
      className={`resizer resizer-${direction} ${dragging ? 'resizer-dragging' : ''} ${className}`}
      onPointerDown={handlePointerDown}
      role="separator"
      aria-orientation={direction === 'horizontal' ? 'vertical' : 'horizontal'}
    >
      <div className="resizer-grip" />
    </div>
  );
}
