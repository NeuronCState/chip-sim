/**
 * 教程状态管理 Store
 * 桥接 TutorialEngine 与 React 组件
 */

import { create } from 'zustand';
import type { Tutorial, TutorialProgress, TutorialEventType } from '../types/tutorial';
import { tutorialEngine } from '../core/tutorialEngine';

interface TutorialStore {
  // 状态
  isActive: boolean;
  currentTutorial: Tutorial | null;
  currentStepIndex: number;
  waitingForAction: boolean;
  showHint: boolean;
  progress: Record<string, TutorialProgress>;

  // 操作
  startTutorial: (tutorial: Tutorial) => void;
  stopTutorial: () => void;
  finishTutorial: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipStep: () => void;
  goToStep: (index: number) => void;
  toggleHint: () => void;
  resetProgress: (tutorialId?: string) => void;

  // 查询
  isTutorialCompleted: (tutorialId: string) => boolean;
  getCompletedTutorialIds: () => string[];
  getTutorialProgress: (tutorialId: string) => TutorialProgress | null;

  // 内部同步
  _syncState: () => void;
}

/** 从引擎同步状态到 Store */
function syncFromEngine(set: (partial: Partial<TutorialStore>) => void): void {
  const state = tutorialEngine.getState();
  set({
    isActive: state.isActive,
    currentTutorial: state.currentTutorial,
    currentStepIndex: state.currentStepIndex,
    waitingForAction: state.waitingForAction,
    showHint: state.showHint,
    progress: { ...state.progress },
  });
}

export const useTutorialStore = create<TutorialStore>((set) => {
  // 监听引擎事件，自动同步状态
  const eventTypes: TutorialEventType[] = [
    'tutorial_started',
    'tutorial_completed',
    'tutorial_skipped',
    'step_started',
    'step_completed',
    'step_skipped',
    'action_detected',
  ];

  eventTypes.forEach((type) => {
    tutorialEngine.on(type, () => {
      syncFromEngine(set);
    });
  });

  return {
    // 初始状态
    isActive: false,
    currentTutorial: null,
    currentStepIndex: 0,
    waitingForAction: false,
    showHint: false,
    progress: {},

    // 操作
    startTutorial: (tutorial) => {
      tutorialEngine.startTutorial(tutorial);
      syncFromEngine(set);
    },

    stopTutorial: () => {
      tutorialEngine.stopTutorial();
      syncFromEngine(set);
    },

    finishTutorial: () => {
      tutorialEngine.finishTutorial();
      syncFromEngine(set);
    },

    nextStep: () => {
      tutorialEngine.nextStep();
      syncFromEngine(set);
    },

    prevStep: () => {
      tutorialEngine.prevStep();
      syncFromEngine(set);
    },

    skipStep: () => {
      tutorialEngine.skipStep();
      syncFromEngine(set);
    },

    goToStep: (index) => {
      tutorialEngine.goToStep(index);
      syncFromEngine(set);
    },

    toggleHint: () => {
      tutorialEngine.toggleHint();
      syncFromEngine(set);
    },

    resetProgress: (tutorialId) => {
      tutorialEngine.resetProgress(tutorialId);
      syncFromEngine(set);
    },

    // 查询
    isTutorialCompleted: (tutorialId) => {
      return tutorialEngine.isTutorialCompleted(tutorialId);
    },

    getCompletedTutorialIds: () => {
      return tutorialEngine.getCompletedTutorialIds();
    },

    getTutorialProgress: (tutorialId) => {
      return tutorialEngine.getTutorialProgress(tutorialId);
    },

    _syncState: () => {
      syncFromEngine(set);
    },
  };
});
