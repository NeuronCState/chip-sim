/**
 * 教程系统类型定义
 * 支持多步骤交互式教程、新手引导、示例电路库
 */

// ==================== 难度等级 ====================

export const TutorialDifficulty = {
  Beginner: 'beginner',
  Intermediate: 'intermediate',
  Advanced: 'advanced',
} as const;
export type TutorialDifficulty =
  (typeof TutorialDifficulty)[keyof typeof TutorialDifficulty];

// ==================== 步骤动作类型 ====================

export const TutorialActionType = {
  /** 点击目标元素 */
  Click: 'click',
  /** 拖拽元件到画布 */
  DragToCanvas: 'drag_to_canvas',
  /** 从端口开始连线 */
  StartWire: 'start_wire',
  /** 完成连线（到目标端口） */
  CompleteWire: 'complete_wire',
  /** 选中元件 */
  SelectComponent: 'select_component',
  /** 修改属性值 */
  ModifyProperty: 'modify_property',
  /** 运行仿真 */
  RunSimulation: 'run_simulation',
  /** 查看波形 */
  ViewWaveform: 'view_waveform',
  /** 打开面板/标签 */
  OpenPanel: 'open_panel',
  /** 仅阅读（无交互） */
  Read: 'read',
  /** 旋转元件 */
  RotateComponent: 'rotate_component',
  /** 删除元件 */
  DeleteComponent: 'delete_component',
  /** 键盘快捷键 */
  Keyboard: 'keyboard',
} as const;
export type TutorialActionType =
  (typeof TutorialActionType)[keyof typeof TutorialActionType];

// ==================== 弹窗位置 ====================

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right' | 'center';

// ==================== 教程步骤 ====================

export interface TutorialStep {
  /** 步骤唯一 ID */
  id: string;
  /** 步骤标题 */
  title: string;
  /** 步骤详细说明（支持简单 HTML） */
  instruction: string;
  /** 高亮元素的 CSS 选择器（空则居中显示） */
  highlightSelector?: string;
  /** 要求用户执行的动作 */
  action: TutorialActionType;
  /** 弹窗相对位置 */
  position?: TooltipPosition;
  /** 弹窗偏移量 (px) */
  offset?: number;
  /** 动作验证配置 */
  validation?: StepValidation;
  /** 提示（验证失败时显示） */
  hint?: string;
  /** 此步骤需要预加载的电路模板 ID */
  loadTemplateId?: string;
  /** 自定义数据（传递给验证逻辑） */
  data?: Record<string, unknown>;
}

// ==================== 步骤验证 ====================

export interface StepValidation {
  /** 验证方式 */
  type: ValidationType;
  /** CSS 选择器：检查元素是否存在/可见 */
  selector?: string;
  /** 检查属性值是否匹配 */
  expectedValue?: string | number;
  /** 属性路径（用于 ModifyProperty 验证） */
  propertyPath?: string;
  /** 电路状态验证的组件名 */
  componentName?: string;
  /** 超时时间 (ms)，超过后自动跳过 */
  timeout?: number;
}

export const ValidationType = {
  /** 检查元素存在且可见 */
  ElementExists: 'element_exists',
  /** 检查元素被点击 */
  ElementClicked: 'element_clicked',
  /** 检查属性值已修改 */
  PropertyChanged: 'property_changed',
  /** 检查电路中有指定元件 */
  ComponentExists: 'component_exists',
  /** 检查电路中有连线 */
  WireExists: 'wire_exists',
  /** 检查仿真正在运行 */
  SimulationRunning: 'simulation_running',
  /** 检查仿真已完成 */
  SimulationCompleted: 'simulation_completed',
  /** 自动通过（阅读类步骤） */
  AutoPass: 'auto_pass',
  /** 自定义验证函数名 */
  Custom: 'custom',
} as const;
export type ValidationType =
  (typeof ValidationType)[keyof typeof ValidationType];

// ==================== 教程定义 ====================

export interface Tutorial {
  /** 教程唯一 ID */
  id: string;
  /** 教程标题 */
  title: string;
  /** 教程描述 */
  description: string;
  /** 教程步骤列表 */
  steps: TutorialStep[];
  /** 难度 */
  difficulty: TutorialDifficulty;
  /** 预计完成时间（分钟） */
  estimatedTime: number;
  /** 图标 */
  icon: string;
  /** 前置教程 ID（需先完成） */
  prerequisiteIds?: string[];
  /** 标签 */
  tags?: string[];
  /** 分类 */
  category: TutorialCategory;
}

// ==================== 教程分类 ====================

export const TutorialCategory = {
  GettingStarted: 'getting_started',
  Analog: 'analog',
  Digital: 'digital',
  Embedded: 'embedded',
  Measurement: 'measurement',
} as const;
export type TutorialCategory =
  (typeof TutorialCategory)[keyof typeof TutorialCategory];

// ==================== 教程进度 ====================

export interface TutorialProgress {
  /** 教程 ID */
  tutorialId: string;
  /** 当前步骤索引 */
  currentStepIndex: number;
  /** 是否已完成 */
  completed: boolean;
  /** 已完成的步骤 ID */
  completedStepIds: string[];
  /** 开始时间 (ISO string) */
  startedAt: string;
  /** 完成时间 (ISO string) */
  completedAt?: string;
  /** 最后活动时间 */
  lastActiveAt: string;
}

// ==================== 教程引擎状态 ====================

export interface TutorialEngineState {
  /** 是否正在运行教程 */
  isActive: boolean;
  /** 当前教程 */
  currentTutorial: Tutorial | null;
  /** 当前步骤索引 */
  currentStepIndex: number;
  /** 是否正在等待用户操作 */
  waitingForAction: boolean;
  /** 是否显示提示 */
  showHint: boolean;
  /** 所有教程进度 */
  progress: Record<string, TutorialProgress>;
}

// ==================== 教程引擎事件 ====================

export type TutorialEventType =
  | 'tutorial_started'
  | 'tutorial_completed'
  | 'tutorial_skipped'
  | 'step_started'
  | 'step_completed'
  | 'step_skipped'
  | 'action_detected';

export interface TutorialEvent {
  type: TutorialEventType;
  tutorialId: string;
  stepId?: string;
  stepIndex?: number;
  timestamp: number;
}

export type TutorialEventListener = (event: TutorialEvent) => void;
