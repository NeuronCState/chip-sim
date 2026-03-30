/**
 * 教程进度组件
 * 显示当前教程的进度条和步骤指示器
 */

import { useTutorialStore } from '../../stores/tutorial-store';
import './TutorialProgress.css';

export function TutorialProgress() {
  const {
    isActive,
    currentTutorial,
    currentStepIndex,
    stopTutorial,
  } = useTutorialStore();

  if (!isActive || !currentTutorial) return null;

  const steps = currentTutorial.steps;
  const totalSteps = steps.length;
  const progressPercent = ((currentStepIndex + 1) / totalSteps) * 100;

  return (
    <div className="tutorial-progress-container">
      <div className="tutorial-progress-header">
        <div className="tutorial-progress-info">
          <span className="tutorial-progress-icon">{currentTutorial.icon}</span>
          <span className="tutorial-progress-title">{currentTutorial.title}</span>
        </div>
        <button className="tutorial-progress-close" onClick={stopTutorial} title="关闭教程">
          ✕
        </button>
      </div>

      {/* 步骤指示器 */}
      <div className="tutorial-progress-steps">
        {steps.map((step, idx) => {
          const isCompleted = idx < currentStepIndex;
          const isCurrent = idx === currentStepIndex;
          const isPending = idx > currentStepIndex;

          return (
            <div
              key={step.id}
              className={`tutorial-progress-step ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''} ${isPending ? 'pending' : ''}`}
              title={step.title}
            >
              <div className="tutorial-progress-dot">
                {isCompleted ? '✓' : idx + 1}
              </div>
              {idx < totalSteps - 1 && <div className="tutorial-progress-line" />}
            </div>
          );
        })}
      </div>

      {/* 总体进度 */}
      <div className="tutorial-progress-bar-wrapper">
        <div className="tutorial-progress-bar-full">
          <div
            className="tutorial-progress-bar-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="tutorial-progress-text">
          {currentStepIndex + 1}/{totalSteps}
        </span>
      </div>
    </div>
  );
}
