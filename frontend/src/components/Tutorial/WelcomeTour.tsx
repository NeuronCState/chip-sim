/**
 * 新手引导组件
 * 分步高亮UI元素，引导用户了解编辑器功能
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { TOUR_STEPS } from './tour-steps';
import type { TourStep } from './tour-steps';
import { t, getLocale } from '../../i18n';
import './WelcomeTour.css';

interface WelcomeTourProps {
  isActive: boolean;
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onFinish: () => void;
  onResumeLater?: () => void;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function WelcomeTour({
  isActive,
  currentStep,
  onNext,
  onPrev,
  onSkip,
  onFinish,
  onResumeLater,
}: WelcomeTourProps) {
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step: TourStep | undefined = TOUR_STEPS[currentStep];
  const isLast = currentStep >= TOUR_STEPS.length - 1;
  const isFirst = currentStep === 0;

  // 查找并跟踪高亮目标位置
  const updateTargetRect = useCallback(() => {
    if (!step) return;
    if (step.target === 'body') {
      setTargetRect(null);
      return;
    }
    // 尝试多个选择器
    const targets = step.target.split(',').map(s => s.trim());
    let el: Element | null = null;
    for (const sel of targets) {
      el = document.querySelector(sel);
      if (el) break;
    }
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
    if (!isActive) return;
    updateTargetRect();
    window.addEventListener('resize', updateTargetRect);
    window.addEventListener('scroll', updateTargetRect, true);
    return () => {
      window.removeEventListener('resize', updateTargetRect);
      window.removeEventListener('scroll', updateTargetRect, true);
    };
  }, [isActive, currentStep, updateTargetRect]);

  // ESC 快捷键
  useEffect(() => {
    if (!isActive) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
      if (e.key === 'ArrowRight' || e.key === 'Enter') onNext();
      if (e.key === 'ArrowLeft') onPrev();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isActive, onNext, onPrev, onSkip]);

  if (!isActive || !step) return null;

  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const offset = step.offset ?? 12;
    const style: React.CSSProperties = { position: 'fixed' };

    switch (step.position) {
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

  // 步骤标题如"第1步：欢迎"
  const locale = getLocale();
  const stepLabel = locale === 'zh' ? `第${currentStep + 1}步` : `Step ${currentStep + 1}`;
  const stepTitle = `${stepLabel}：${t(step.titleKey)}`;

  return (
    <div className="tour-overlay">
      {/* 背景遮罩 */}
      <div className="tour-backdrop" />

      {/* 高亮区域 */}
      {targetRect && (
        <div className="tour-highlight" style={getHighlightStyle()} />
      )}

      {/* 引导弹窗 */}
      <div
        ref={tooltipRef}
        className="tour-tooltip"
        style={getTooltipStyle()}
      >
        <div className="tour-tooltip-header">
          <span className="tour-step-indicator">
            {currentStep + 1} / {TOUR_STEPS.length}
          </span>
          <button className="tour-close-btn" onClick={onSkip} title={t('common.skip')}>
            ✕
          </button>
        </div>

        {/* 步骤标题 + 图标 */}
        <div className="tour-step-title-row">
          <span className="tour-step-icon">{step.icon}</span>
          <h3 className="tour-tooltip-title">{stepTitle}</h3>
        </div>
        <p className="tour-tooltip-desc">{t(step.descKey)}</p>

        {/* 进度条 */}
        <div className="tour-progress-bar">
          <div
            className="tour-progress-fill"
            style={{ width: `${((currentStep + 1) / TOUR_STEPS.length) * 100}%` }}
          />
        </div>

        <div className="tour-tooltip-actions">
          {!isFirst && (
            <button className="tour-btn tour-btn-secondary" onClick={onPrev}>
              ← {t('common.prev')}
            </button>
          )}
          <button className="tour-btn tour-btn-skip" onClick={onSkip}>
            {t('common.skip')}
          </button>
          {!isLast && onResumeLater && (
            <button className="tour-btn tour-btn-skip" onClick={onResumeLater} title={t('tour.resumeLaterHint')}>
              {t('tour.resumeLater')}
            </button>
          )}
          <div style={{ flex: 1 }} />
          {isLast ? (
            <button className="tour-btn tour-btn-primary" onClick={onFinish}>
              {t('common.finish')} ✓
            </button>
          ) : (
            <button className="tour-btn tour-btn-primary" onClick={onNext}>
              {t('common.next')} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
