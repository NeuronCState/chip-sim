/**
 * 骨架屏组件
 * 替代传统 loading spinner，提供更好的感知性能
 * 支持多种预设形状和自定义尺寸
 */

import './Skeleton.css';

interface SkeletonProps {
  /** 骨架类型 */
  variant?: 'text' | 'rect' | 'circle' | 'button';
  /** 宽度（CSS 值） */
  width?: string | number;
  /** 高度（CSS 值） */
  height?: string | number;
  /** 自定义类名 */
  className?: string;
  /** 动画类型 */
  animation?: 'pulse' | 'shimmer' | 'none';
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  className = '',
  animation = 'shimmer',
}: SkeletonProps) {
  const style: React.CSSProperties = {
    ...(width !== undefined && { width: typeof width === 'number' ? `${width}px` : width }),
    ...(height !== undefined && { height: typeof height === 'number' ? `${height}px` : height }),
  };

  return (
    <div
      className={`skeleton skeleton-${variant} skeleton-${animation} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

// ==================== 预设组合 ====================

/** 元件库骨架屏 */
export function ComponentLibrarySkeleton() {
  return (
    <div className="skeleton-library">
      <Skeleton variant="text" width="60%" height={20} />
      <div className="skeleton-library-grid">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="skeleton-library-item">
            <Skeleton variant="circle" width={32} height={32} />
            <Skeleton variant="text" width="70%" height={14} />
            <Skeleton variant="text" width="50%" height={12} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** 属性面板骨架屏 */
export function PropertyPanelSkeleton() {
  return (
    <div className="skeleton-property">
      <Skeleton variant="text" width="50%" height={18} />
      <Skeleton variant="rect" width="100%" height={36} />
      <Skeleton variant="text" width="40%" height={14} />
      <Skeleton variant="rect" width="100%" height={36} />
      <Skeleton variant="text" width="45%" height={14} />
      <Skeleton variant="rect" width="100%" height={36} />
      <Skeleton variant="text" width="35%" height={14} />
      <Skeleton variant="rect" width="60%" height={32} />
    </div>
  );
}

/** 波形面板骨架屏 */
export function WaveformPanelSkeleton() {
  return (
    <div className="skeleton-waveform">
      <Skeleton variant="rect" width="100%" height={200} />
      <div className="skeleton-waveform-legend">
        <Skeleton variant="rect" width={60} height={24} />
        <Skeleton variant="rect" width={60} height={24} />
        <Skeleton variant="rect" width={60} height={24} />
      </div>
    </div>
  );
}

/** 验证面板骨架屏 */
export function ValidationPanelSkeleton() {
  return (
    <div className="skeleton-validation">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="skeleton-validation-item">
          <Skeleton variant="circle" width={20} height={20} />
          <Skeleton variant="text" width="80%" height={14} />
        </div>
      ))}
    </div>
  );
}
