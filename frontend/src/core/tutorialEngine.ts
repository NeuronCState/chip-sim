/**
 * 教程引擎
 * 管理教程步骤导航、元素高亮、动作验证、进度保存
 */

import type {
  Tutorial,
  TutorialStep,
  TutorialProgress,
  TutorialEngineState,
  TutorialEvent,
  TutorialEventListener,
  TutorialEventType,
} from '../types/tutorial';
import { TutorialActionType } from '../types/tutorial';

// ==================== 存储 Key ====================

const PROGRESS_STORAGE_KEY = 'chip-sim-tutorial-progress';
const COMPLETED_TUTORIALS_KEY = 'chip-sim-completed-tutorials';

// ==================== 教程引擎类 ====================

export class TutorialEngine {
  private state: TutorialEngineState;
  private listeners: Map<TutorialEventType, Set<TutorialEventListener>> = new Map();
  private mutationObserver: MutationObserver | null = null;
  private actionListeners: Array<{ target: EventTarget; type: string; handler: EventListener }> = [];
  private validationTimer: ReturnType<typeof setInterval> | null = null;
  private highlightCleanup: (() => void) | null = null;

  constructor() {
    this.state = {
      isActive: false,
      currentTutorial: null,
      currentStepIndex: 0,
      waitingForAction: false,
      showHint: false,
      progress: this.loadProgress(),
    };
  }

  // ==================== 公共 API ====================

  /** 获取当前状态（只读） */
  getState(): Readonly<TutorialEngineState> {
    return { ...this.state };
  }

  /** 启动教程 */
  startTutorial(tutorial: Tutorial): void {
    this.cleanup();

    const existingProgress = this.state.progress[tutorial.id];
    const startIndex = existingProgress && !existingProgress.completed
      ? existingProgress.currentStepIndex
      : 0;

    this.state = {
      ...this.state,
      isActive: true,
      currentTutorial: tutorial,
      currentStepIndex: startIndex,
      waitingForAction: false,
      showHint: false,
    };

    // 初始化进度
    if (!this.state.progress[tutorial.id]) {
      this.state.progress[tutorial.id] = {
        tutorialId: tutorial.id,
        currentStepIndex: 0,
        completed: false,
        completedStepIds: [],
        startedAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      };
    }

    this.emit('tutorial_started', tutorial.id);
    this.startStep(startIndex);
    this.saveProgress();
  }

  /** 停止当前教程 */
  stopTutorial(): void {
    if (!this.state.currentTutorial) return;
    this.cleanup();
    this.emit('tutorial_skipped', this.state.currentTutorial.id);
    this.state = {
      ...this.state,
      isActive: false,
      currentTutorial: null,
      currentStepIndex: 0,
      waitingForAction: false,
      showHint: false,
    };
  }

  /** 完成当前教程 */
  finishTutorial(): void {
    if (!this.state.currentTutorial) return;
    const tutorialId = this.state.currentTutorial.id;

    // 标记进度完成
    if (this.state.progress[tutorialId]) {
      this.state.progress[tutorialId].completed = true;
      this.state.progress[tutorialId].completedAt = new Date().toISOString();
    }

    // 保存已完成列表
    const completed = this.getCompletedTutorialIds();
    if (!completed.includes(tutorialId)) {
      completed.push(tutorialId);
      localStorage.setItem(COMPLETED_TUTORIALS_KEY, JSON.stringify(completed));
    }

    this.cleanup();
    this.emit('tutorial_completed', tutorialId);
    this.state = {
      ...this.state,
      isActive: false,
      currentTutorial: null,
      currentStepIndex: 0,
      waitingForAction: false,
      showHint: false,
    };
    this.saveProgress();
  }

  /** 下一步 */
  nextStep(): void {
    if (!this.state.currentTutorial) return;
    const nextIndex = this.state.currentStepIndex + 1;

    if (nextIndex >= this.state.currentTutorial.steps.length) {
      this.finishTutorial();
      return;
    }

    // 标记当前步骤完成
    const currentStep = this.state.currentTutorial.steps[this.state.currentStepIndex];
    this.markStepCompleted(currentStep.id);

    this.state.currentStepIndex = nextIndex;
    this.startStep(nextIndex);
    this.saveProgress();
  }

  /** 上一步 */
  prevStep(): void {
    if (!this.state.currentTutorial) return;
    const prevIndex = Math.max(0, this.state.currentStepIndex - 1);
    this.state.currentStepIndex = prevIndex;
    this.startStep(prevIndex);
    this.saveProgress();
  }

  /** 跳过当前步骤 */
  skipStep(): void {
    if (!this.state.currentTutorial) return;
    const currentStep = this.state.currentTutorial.steps[this.state.currentStepIndex];
    this.emit('step_skipped', this.state.currentTutorial.id, currentStep.id);
    this.nextStep();
  }

  /** 跳转到指定步骤 */
  goToStep(index: number): void {
    if (!this.state.currentTutorial) return;
    if (index < 0 || index >= this.state.currentTutorial.steps.length) return;
    this.state.currentStepIndex = index;
    this.startStep(index);
    this.saveProgress();
  }

  /** 显示/隐藏提示 */
  toggleHint(): void {
    this.state.showHint = !this.state.showHint;
  }

  /** 获取当前步骤 */
  getCurrentStep(): TutorialStep | null {
    if (!this.state.currentTutorial) return null;
    return this.state.currentTutorial.steps[this.state.currentStepIndex] ?? null;
  }

  /** 获取总步骤数 */
  getTotalSteps(): number {
    return this.state.currentTutorial?.steps.length ?? 0;
  }

  /** 获取当前步骤索引 */
  getCurrentStepIndex(): number {
    return this.state.currentStepIndex;
  }

  /** 是否已完成指定教程 */
  isTutorialCompleted(tutorialId: string): boolean {
    return this.state.progress[tutorialId]?.completed ?? false;
  }

  /** 获取已完成教程 ID 列表 */
  getCompletedTutorialIds(): string[] {
    try {
      const data = localStorage.getItem(COMPLETED_TUTORIALS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /** 获取教程进度 */
  getTutorialProgress(tutorialId: string): TutorialProgress | null {
    return this.state.progress[tutorialId] ?? null;
  }

  /** 重置教程进度 */
  resetProgress(tutorialId?: string): void {
    if (tutorialId) {
      delete this.state.progress[tutorialId];
      const completed = this.getCompletedTutorialIds().filter((id) => id !== tutorialId);
      localStorage.setItem(COMPLETED_TUTORIALS_KEY, JSON.stringify(completed));
    } else {
      this.state.progress = {};
      localStorage.removeItem(COMPLETED_TUTORIALS_KEY);
    }
    this.saveProgress();
  }

  // ==================== 事件系统 ====================

  on(type: TutorialEventType, listener: TutorialEventListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
    return () => this.listeners.get(type)?.delete(listener);
  }

  private emit(
    type: TutorialEventType,
    tutorialId: string,
    stepId?: string,
  ): void {
    const event: TutorialEvent = {
      type,
      tutorialId,
      stepId,
      stepIndex: this.state.currentStepIndex,
      timestamp: Date.now(),
    };
    this.listeners.get(type)?.forEach((fn) => fn(event));
  }

  // ==================== 内部方法 ====================

  /** 启动指定步骤 */
  private startStep(index: number): void {
    this.cleanup();
    const tutorial = this.state.currentTutorial;
    if (!tutorial) return;

    const step = tutorial.steps[index];
    if (!step) return;

    this.state.waitingForAction = step.action !== TutorialActionType.Read;
    this.state.showHint = false;

    // 更新进度
    if (this.state.progress[tutorial.id]) {
      this.state.progress[tutorial.id].currentStepIndex = index;
      this.state.progress[tutorial.id].lastActiveAt = new Date().toISOString();
    }

    this.emit('step_started', tutorial.id, step.id);
    this.emit('step_completed', tutorial.id, step.id); // Notify overlay to render

    // 高亮目标元素
    this.highlightElement(step.highlightSelector);

    // 设置动作监听
    if (this.state.waitingForAction) {
      this.setupActionListener(step);
    }
  }

  /** 高亮目标元素 */
  private highlightElement(selector?: string): void {
    if (!selector) return;

    // 等待元素出现
    const waitForElement = (): void => {
      const el = document.querySelector(selector);
      if (el) {
        this.applyHighlight(el as HTMLElement);
      } else {
        // 使用 MutationObserver 等待元素出现
        this.mutationObserver = new MutationObserver(() => {
          const el = document.querySelector(selector);
          if (el) {
            this.mutationObserver?.disconnect();
            this.mutationObserver = null;
            this.applyHighlight(el as HTMLElement);
          }
        });
        this.mutationObserver.observe(document.body, {
          childList: true,
          subtree: true,
        });
      }
    };

    waitForElement();
  }

  /** 应用高亮效果 */
  private applyHighlight(el: HTMLElement): void {
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    el.classList.add('tutorial-highlight-target');
    el.style.zIndex = '10001';
    el.style.position = 'relative';

    this.highlightCleanup = () => {
      el.classList.remove('tutorial-highlight-target');
      el.style.zIndex = '';
      el.style.position = '';
    };
  }

  /** 设置动作监听 */
  private setupActionListener(step: TutorialStep): void {
    const { action, highlightSelector } = step;

    switch (action) {
      case TutorialActionType.Click:
      case TutorialActionType.SelectComponent:
        if (highlightSelector) {
          this.addClickListener(highlightSelector, step);
        }
        break;

      case TutorialActionType.DragToCanvas:
        // 监听画布上的放置事件
        this.setupCanvasDropListener(step);
        break;

      case TutorialActionType.StartWire:
      case TutorialActionType.CompleteWire:
        this.setupWireListener(step);
        break;

      case TutorialActionType.RunSimulation:
        this.setupSimulationListener(step);
        break;

      case TutorialActionType.ModifyProperty:
        this.setupPropertyChangeListener(step);
        break;

      case TutorialActionType.ViewWaveform:
        this.setupWaveformListener(step);
        break;

      case TutorialActionType.Keyboard:
        this.setupKeyboardListener(step);
        break;

      case TutorialActionType.RotateComponent:
      case TutorialActionType.DeleteComponent:
        this.setupMutationListener(step);
        break;

      default:
        // 其他动作类型：轮询检查验证条件
        if (step.validation) {
          this.setupPollingValidation(step);
        }
        break;
    }
  }

  /** 添加点击监听 */
  private addClickListener(selector: string, step: TutorialStep): void {
    const handler = () => {
      this.completeCurrentStep(step);
    };
    const el = document.querySelector(selector);
    if (el) {
      el.addEventListener('click', handler, { once: true });
      this.actionListeners.push({ target: el, type: 'click', handler });
    }
  }

  /** 设置画布放置监听 */
  private setupCanvasDropListener(step: TutorialStep): void {
    const canvas = document.querySelector('.editor-canvas-area, canvas');
    if (!canvas) return;

    const handler = () => {
      // 检查是否添加了新元件
      setTimeout(() => this.checkValidation(step), 100);
    };
    canvas.addEventListener('drop', handler);
    this.actionListeners.push({ target: canvas, type: 'drop', handler: handler as EventListener });
  }

  /** 设置连线监听 */
  private setupWireListener(step: TutorialStep): void {
    this.setupMutationListener(step);
  }

  /** 设置仿真监听 */
  private setupSimulationListener(step: TutorialStep): void {
    this.setupPollingValidation(step);
  }

  /** 设置属性变化监听 */
  private setupPropertyChangeListener(step: TutorialStep): void {
    this.setupPollingValidation(step);
  }

  /** 设置波形监听 */
  private setupWaveformListener(step: TutorialStep): void {
    this.setupPollingValidation(step);
  }

  /** 设置键盘监听 */
  private setupKeyboardListener(step: TutorialStep): void {
    const expectedKey = (step.data?.key as string) || '';
    const handler = (e: Event) => {
      const keyEvent = e as KeyboardEvent;
      if (keyEvent.key === expectedKey || keyEvent.code === expectedKey) {
        this.completeCurrentStep(step);
      }
    };
    document.addEventListener('keydown', handler);
    this.actionListeners.push({ target: document, type: 'keydown', handler });
  }

  /** 设置 DOM 变化监听 */
  private setupMutationListener(step: TutorialStep): void {
    this.mutationObserver = new MutationObserver(() => {
      this.checkValidation(step);
    });
    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  }

  /** 设置轮询验证 */
  private setupPollingValidation(step: TutorialStep): void {
    const timeout = step.validation?.timeout ?? 30000;
    const startTime = Date.now();

    this.validationTimer = setInterval(() => {
      if (Date.now() - startTime > timeout) {
        this.completeCurrentStep(step);
        return;
      }
      this.checkValidation(step);
    }, 500);
  }

  /** 检查验证条件 */
  private checkValidation(step: TutorialStep): void {
    if (!step.validation) {
      // 无验证配置 → 自动通过
      this.completeCurrentStep(step);
      return;
    }

    const { type, selector, expectedValue: _expectedValue, componentName: _componentName } = step.validation;
    let passed = false;

    switch (type) {
      case 'element_exists':
        passed = !!document.querySelector(selector ?? '');
        break;

      case 'element_clicked':
        // 由 click handler 处理
        passed = true;
        break;

      case 'auto_pass':
        passed = true;
        break;

      case 'component_exists':
      case 'wire_exists':
      case 'simulation_running':
      case 'simulation_completed':
      case 'property_changed':
      case 'custom':
        // 这些需要外部回调验证
        passed = true;
        break;
    }

    if (passed) {
      this.completeCurrentStep(step);
    }
  }

  /** 完成当前步骤 */
  private completeCurrentStep(step: TutorialStep): void {
    if (!this.state.currentTutorial) return;
    this.markStepCompleted(step.id);
    this.emit('step_completed', this.state.currentTutorial.id, step.id);
    this.emit('action_detected', this.state.currentTutorial.id, step.id);
    this.nextStep();
  }

  /** 标记步骤完成 */
  private markStepCompleted(stepId: string): void {
    if (!this.state.currentTutorial) return;
    const progress = this.state.progress[this.state.currentTutorial.id];
    if (progress && !progress.completedStepIds.includes(stepId)) {
      progress.completedStepIds.push(stepId);
    }
  }

  /** 清理所有监听器和定时器 */
  private cleanup(): void {
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;

    if (this.validationTimer) {
      clearInterval(this.validationTimer);
      this.validationTimer = null;
    }

    this.actionListeners.forEach(({ target, type, handler }) => {
      target.removeEventListener(type, handler);
    });
    this.actionListeners = [];

    this.highlightCleanup?.();
    this.highlightCleanup = null;

    // 清除所有高亮 CSS 类
    document.querySelectorAll('.tutorial-highlight-target').forEach((el) => {
      (el as HTMLElement).classList.remove('tutorial-highlight-target');
      (el as HTMLElement).style.zIndex = '';
      (el as HTMLElement).style.position = '';
    });
  }

  // ==================== 持久化 ====================

  private loadProgress(): Record<string, TutorialProgress> {
    try {
      const data = localStorage.getItem(PROGRESS_STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  private saveProgress(): void {
    try {
      localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(this.state.progress));
    } catch {
      // ignore storage errors
    }
  }
}

// ==================== 单例导出 ====================

export const tutorialEngine = new TutorialEngine();
