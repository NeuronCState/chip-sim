/**
 * 电路画布骨架屏
 * 电路加载时显示，替代空白/闪烁
 */

import { Skeleton } from './Skeleton';
import './Skeleton.css';

/** 电路画布骨架屏 */
export function CircuitCanvasSkeleton() {
  return (
    <div className="skeleton-circuit-canvas">
      {/* 模拟几个元件位置 */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="skeleton-circuit-component"
          style={{
            left: `${15 + i * 18}%`,
            top: `${25 + (i % 3) * 20}%`,
          }}
        >
          <Skeleton variant="rect" width={60} height={30} />
          <Skeleton variant="text" width={40} height={10} />
        </div>
      ))}
      {/* 模拟连线 */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={`wire-${i}`}
          className="skeleton-circuit-wire"
          style={{
            left: `${25 + i * 20}%`,
            top: `${35 + (i % 2) * 15}%`,
            width: `${12 + i * 3}%`,
          }}
        />
      ))}
    </div>
  );
}

/** 编辑器页面整体骨架屏 */
export function EditorPageSkeleton() {
  return (
    <div className="skeleton-editor-page">
      <div className="skeleton-editor-toolbar">
        <Skeleton variant="button" width={80} height={28} />
        <Skeleton variant="button" width={80} height={28} />
        <Skeleton variant="button" width={60} height={28} />
        <Skeleton variant="rect" width={1} height={20} />
        <Skeleton variant="button" width={70} height={28} />
      </div>
      <div className="skeleton-editor-body">
        <div className="skeleton-editor-sidebar">
          <Skeleton variant="text" width="80%" height={16} />
          <Skeleton variant="rect" width="100%" height={200} />
          <Skeleton variant="text" width="60%" height={14} />
        </div>
        <div className="skeleton-editor-canvas">
          <CircuitCanvasSkeleton />
        </div>
        <div className="skeleton-editor-right">
          <Skeleton variant="text" width="70%" height={16} />
          <Skeleton variant="rect" width="100%" height={100} />
          <Skeleton variant="rect" width="100%" height={150} />
        </div>
      </div>
    </div>
  );
}
