/**
 * 教程遮罩层组件
 * 全屏遮罩 + 高亮区域 + 提示气泡
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useTutorialStore } from '../../stores/tutorial-store';
import type { TooltipPosition } from '../../types/tutorial';
import { TutorialActionType } from '../../types/tutorial';
import './TutorialOverlay.css';

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function TutorialOverlay() {
  const {
    isActive,
    currentTutorial,
    currentStepIndex,
    showHint,
    nextStep,
    prevStep,
    skipStep,
    toggleHint,
    stopTutorial,
    finishTutorial,
  } = useTutorialStore();

  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = currentTutorial?.steps[currentStepIndex];
  const isLast = step ? currentStepIndex >= (currentTutorial?.steps.length ?? 0) - 1 : false;
  const isFirst = currentStepIndex === 0;
  const totalSteps = currentTutorial?.steps.length ?? 0;

  // 查找并跟踪高亮目标位置
  const updateTargetRect = useCallback(() => {
    if (!step?.highlightSelector) {
      setTargetRect(null);
      return;
    }
    const el = document.querySelector(step.highlightSelector);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    } else {
      setTargetRect(null);
    }
  }, [step]);

  useEffect(() => {
    if (!isActive || !step) return;
    updateTargetRect();
    window.addEventListener('resize', updateTargetRect);
    window.addEventListener('scroll', updateTargetRect, true);
    const intervalId = setInterval(updateTargetRect, 300);
    return () => {
      window.removeEventListener('resize', updateTargetRect);
      window.removeEventListener('scroll', updateTargetRect, true);
      clearInterval(intervalId);
    };
  }, [isActive, currentStepIndex, updateTargetRect]);

  // ESC 快捷键
  useEffect(() => {
    if (!isActive) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stopTutorial();
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        if (!step || step.action === TutorialActionType.Read) {
          nextStep();
        }
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevStep();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isActive, step, nextStep, prevStep, stopTutorial]);

  if (!isActive || !step || !currentTutorial) return null;

  const getTooltipStyle = (): React.CSSProperties => {
    const position: TooltipPosition = step.position ?? (targetRect ? 'right' : 'center');

    if (position === 'center' || !targetRect) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const offset = step.offset ?? 12;
    const style: React.CSSProperties = { position: 'fixed' };

    switch (position) {
      case 'right':
        style.left = targetRect.left + targetRect.width + offset;
        style.top = targetRect.top + targetRect.height / 2;
        style.transform = 'translateY(-50%)';
        break;
      case 'left':
        style.right = window.innerWidth - targetRect.left + offset;
        style.top = targetRect.top + targetRect.height / 2;
        style.transform = 'translateY(-50%)';
        break;
      case 'bottom':
        style.top = targetRect.top + targetRect.height + offset;
        style.left = targetRect.left + targetRect.width / 2;
        style.transform = 'translateX(-50%)';
        break;
      case 'top':
        style.bottom = window.innerHeight - targetRect.top + offset;
        style.left = targetRect.left + targetRect.width / 2;
        style.transform = 'translateX(-50%)';
        break;
    }

    return style;
  };

  const getHighlightStyle = (): React.CSSProperties | undefined => {
    if (!targetRect) return undefined;
    return {
      position: 'fixed',
      top: targetRect.top - 4,
      left: targetRect.left - 4,
      width: targetRect.width + 8,
      height: targetRect.height + 8,
    };
  };

  const getActionLabel = (): string => {
    switch (step.action) {
      case TutorialActionType.Click: return '👆 请点击高亮区域';
      case TutorialActionType.DragToCanvas: return '🖱️ 请拖拽元件到画布';
      case TutorialActionType.StartWire: return '🔗 请从端口开始连线';
      case TutorialActionType.CompleteWire: return '🔗 请完成连线到目标端口';
      case TutorialActionType.SelectComponent: return '🖱️ 请点击选中元件';
      case TutorialActionType.ModifyProperty: return '✏️ 请修改属性值';
      case TutorialActionType.RunSimulation: return '▶️ 请运行仿真';
      case TutorialActionType.ViewWaveform: return '📊 请查看波形面板';
      case TutorialActionType.Keyboard: return `⌨️ 请按 ${step.data?.key ?? ''} 键`;
      case TutorialActionType.RotateComponent: return '🔄 请旋转元件';
      case TutorialActionType.DeleteComponent: return '🗑️ 请删除元件';
      default: return '';
    }
  };

  const isReadAction = step.action === TutorialActionType.Read;

  return (
    <div className="tutorial-overlay" data-testid="tutorial-overlay">
      {/* 背景遮罩 */}
      <div className="tutorial-backdrop" onClick={stopTutorial} />

      {/* 高亮区域 */}
      {targetRect && (
        <div className="tutorial-highlight" style={getHighlightStyle()} />
      )}

      {/* 引导弹窗 */}
      <div
        ref={tooltipRef}
        className="tutorial-tooltip"
        style={getTooltipStyle()}
      >
        <div className="tutorial-tooltip-header">
          <div className="tutorial-badge">
            <span className="tutorial-badge-icon">{currentTutorial.icon}</span>
            <span className="tutorial-badge-title">{currentTutorial.title}</span>
          </div>
          <button className="tutorial-close-btn" onClick={stopTutorial} title="关闭教程">
            ✕
          </button>
        </div>

        <div className="tutorial-step-indicator">
          步骤 {currentStepIndex + 1} / {totalSteps}
        </div>

        <h3 className="tutorial-tooltip-title">{step.title}</h3>

        <div
          className="tutorial-tooltip-instruction"
          dangerouslySetInnerHTML={{ __html: step.instruction }}
        />

        {/* 操作提示 */}
        {!isReadAction && (
          <div className="tutorial-action-hint">
            {getActionLabel()}
          </div>
        )}

        {/* 提示按钮 */}
        {step.hint && (
          <div className="tutorial-hint-section">
            <button
              className="tutorial-hint-toggle"
              onClick={toggleHint}
            >
              {showHint ? '💡 隐藏提示' : '💡 需要帮助？'}
            </button>
            {showHint && (
              <div className="tutorial-hint-content">
                {step.hint}
              </div>
            )}
          </div>
        )}

        {/* 进度条 */}
        <div className="tutorial-progress-bar">
          <div
            className="tutorial-progress-fill"
            style={{ width: `${((currentStepIndex + 1) / totalSteps) * 100}%` }}
          />
        </div>

        <div className="tutorial-tooltip-actions">
          {!isFirst && (
            <button className="tutorial-btn tutorial-btn-secondary" onClick={prevStep}>
              ← 上一步
            </button>
          )}

          <button className="tutorial-btn tutorial-btn-skip" onClick={skipStep}>
            跳过此步
          </button>

          <div style={{ flex: 1 }} />

          {isReadAction && (
            isLast ? (
              <button className="tutorial-btn tutorial-btn-primary" onClick={finishTutorial}>
                完成 ✓
              </button>
            ) : (
              <button className="tutorial-btn tutorial-btn-primary" onClick={nextStep}>
                下一步 →
              </button>
            )
          )}

          {!isReadAction && (
            <span className="tutorial-waiting-hint">
              ⏳ 等待操作...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
