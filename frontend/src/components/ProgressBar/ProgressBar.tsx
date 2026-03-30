/**
 * 进度条组件
 * 支持确定进度和不确定进度（loading animation）
 * 用于仿真计算、文件上传等长时间操作
 */

import './ProgressBar.css';

interface ProgressBarProps {
  /** 进度百分比 0-100，传 null 表示不确定进度 */
  progress: number | null;
  /** 标签文字 */
  label?: string;
  /** 是否显示百分比文字 */
  showPercent?: boolean;
  /** 高度（px） */
  height?: number;
  /** 颜色主题 */
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  /** 是否显示动画条纹 */
  striped?: boolean;
  /** 动画条纹是否运动 */
  animated?: boolean;
}

export function ProgressBar({
  progress,
  label,
  showPercent = true,
  height = 6,
  variant = 'primary',
  striped = false,
  animated = true,
}: ProgressBarProps) {
  const isIndeterminate = progress === null;
  const clampedProgress = isIndeterminate ? 30 : Math.min(100, Math.max(0, progress));

  return (
    <div className="progress-bar-wrapper">
      {(label || showPercent) && (
        <div className="progress-bar-header">
          {label && <span className="progress-bar-label">{label}</span>}
          {showPercent && !isIndeterminate && (
            <span className="progress-bar-percent">{Math.round(clampedProgress)}%</span>
          )}
          {isIndeterminate && <span className="progress-bar-indeterminate">处理中...</span>}
        </div>
      )}
      <div
        className={`progress-bar-track progress-bar-${variant}`}
        style={{ height }}
        role="progressbar"
        aria-valuenow={isIndeterminate ? undefined : clampedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || '进度'}
      >
        <div
          className={`progress-bar-fill ${isIndeterminate ? 'progress-bar-indeterminate-fill' : ''} ${striped ? 'progress-bar-striped' : ''} ${animated ? 'progress-bar-animated' : ''}`}
          style={isIndeterminate ? undefined : { width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
}
