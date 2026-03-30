/**
 * 仿真进度指示器
 * 基于后端返回的进度百分比显示仿真执行进度
 * 包含预计剩余时间和诊断信息
 */

import { ProgressBar } from '../ProgressBar/ProgressBar';
import './SimulationProgress.css';

interface SimulationProgressProps {
  /** 是否正在仿真 */
  isRunning: boolean;
  /** 进度百分比 0-100，null 表示不确定 */
  progress: number | null;
  /** 仿真状态文本 */
  statusText?: string;
  /** 当前步骤描述 */
  currentStep?: string;
  /** 已用时间（秒） */
  elapsedSeconds?: number;
  /** 预计剩余时间（秒） */
  estimatedRemaining?: number;
  /** 错误信息 */
  error?: string | null;
  /** 停止回调 */
  onStop?: () => void;
}

/** 格式化时间 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}秒`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}分${secs}秒`;
}

export function SimulationProgress({
  isRunning,
  progress,
  statusText,
  currentStep,
  elapsedSeconds,
  estimatedRemaining,
  error,
  onStop,
}: SimulationProgressProps) {
  if (!isRunning && !error) return null;

  const variant = error ? 'danger' : 'primary';

  return (
    <div className={`sim-progress ${error ? 'sim-progress-error' : ''}`}>
      <div className="sim-progress-header">
        <div className="sim-progress-status">
          {error ? (
            <span className="sim-progress-error-icon">❌</span>
          ) : (
            <span className="sim-progress-running-icon">⚡</span>
          )}
          <span className="sim-progress-title">
            {error ? '仿真错误' : (statusText || '仿真运行中')}
          </span>
        </div>
        {isRunning && onStop && (
          <button className="sim-progress-stop" onClick={onStop}>
            ⏹ 停止
          </button>
        )}
      </div>

      {!error && (
        <ProgressBar
          progress={progress}
          showPercent={true}
          height={6}
          variant={variant}
          striped={progress === null}
          animated={true}
        />
      )}

      {currentStep && !error && (
        <div className="sim-progress-step">
          📍 {currentStep}
        </div>
      )}

      <div className="sim-progress-meta">
        {elapsedSeconds !== undefined && !error && (
          <span className="sim-progress-time">
            ⏱ 已用 {formatDuration(elapsedSeconds)}
          </span>
        )}
        {estimatedRemaining !== undefined && progress !== null && progress > 0 && !error && (
          <span className="sim-progress-remaining">
            预计剩余 {formatDuration(estimatedRemaining)}
          </span>
        )}
      </div>

      {error && (
        <div className="sim-progress-error-detail">
          <div className="sim-error-message">⚠ {error}</div>
          <div className="sim-error-hint">
            💡 请检查电路参数和拓扑，修改后可重新启动仿真
          </div>
        </div>
      )}
    </div>
  );
}
