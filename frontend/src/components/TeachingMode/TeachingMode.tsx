/**
 * 教学模式面板
 * 引导式教学：每个课程有步骤说明，点击"开始"加载模板，引导完成操作
 */

import { useState, useEffect, useCallback } from 'react';
import './TeachingMode.css';

// ==================== 课程数据 ====================

interface CourseStep {
  title: string;
  instruction: string;
  hint?: string;
  /** 自动完成条件：检查事件或状态 */
  checkType?: 'code-modified' | 'sim-running' | 'component-added' | 'manual';
}

interface Course {
  id: string;
  title: string;
  desc: string;
  icon: string;
  templateId?: string;
  chipFamily: string;
  chipModel: string;
  steps: CourseStep[];
}

const COURSES: Course[] = [
  {
    id: 'gpio',
    title: 'GPIO基础',
    desc: '学习单片机GPIO输入输出',
    icon: 'IO',
    chipFamily: 'C51',
    chipModel: 'AT89C51',
    steps: [
      { title: '理解GPIO概念', instruction: 'GPIO（General Purpose Input/Output）是通用输入输出引脚，可以配置为高电平或低电平输出，也可以读取外部电平信号。', checkType: 'manual' },
      { title: '配置GPIO为输出模式', instruction: '在右侧代码编辑器中，将P1.0引脚配置为输出模式。点击引脚面板中的P1.0，选择GPIO_OUTPUT功能。', hint: '点击右侧"引脚"按钮打开引脚配置面板', checkType: 'manual' },
      { title: '编写LED控制代码', instruction: '在代码编辑器中输入代码，将P1.0设置为高电平点亮LED：\nP1_0 = 1; // 置高电平', hint: '点击运行按钮编译代码', checkType: 'code-modified' },
      { title: '配置GPIO为输入模式', instruction: '将P1.1引脚配置为输入模式，用于读取外部按键状态。在引脚面板中选择P1.1，配置为GPIO_INPUT。', checkType: 'manual' },
      { title: '读取按键状态', instruction: '编写代码读取P1.1的电平状态，实现按键检测：\nif (P1_1 == 0) {\n  // 按键按下\n}', checkType: 'code-modified' },
    ],
  },
  {
    id: 'button',
    title: '按键输入',
    desc: '按键检测与消抖',
    icon: 'KEY',
    chipFamily: 'C51',
    chipModel: 'AT89C51',
    steps: [
      { title: '连接按键电路', instruction: '从左侧元件库中拖拽一个"按键"元件到画布上，将其连接到MCU的P3.2引脚。', hint: '在"输入器件"分类中找到按键', checkType: 'component-added' },
      { title: '读取按键电平', instruction: '编写代码读取P3.2的电平状态。按键按下时为低电平，释放时为高电平。', checkType: 'code-modified' },
      { title: '软件消抖', instruction: '按键存在机械抖动，需要延时消抖。在检测到按键后延时10-20ms再次确认。', hint: '使用 delay_ms(15) 实现消抖延时', checkType: 'code-modified' },
      { title: '中断方式检测按键', instruction: '将P3.2配置为外部中断输入，使用中断方式检测按键，提高响应效率。', checkType: 'manual' },
    ],
  },
  {
    id: 'timer',
    title: '定时器',
    desc: '定时器中断与PWM',
    icon: 'TMR',
    chipFamily: 'C51',
    chipModel: 'AT89C51',
    steps: [
      { title: '定时器基本概念', instruction: '定时器是MCU内部的计数器模块，可以按固定频率计数，到达设定值时产生中断。51系列有Timer0和Timer1两个16位定时器。', checkType: 'manual' },
      { title: '配置定时器中断', instruction: '配置Timer0工作在模式1（16位定时器），设置初值实现1ms定时中断。\nTMOD = 0x01;\nTH0 = 0xFC; TL0 = 0x18;\nTR0 = 1;\nET0 = 1; EA = 1;', checkType: 'code-modified' },
      { title: '使用定时器计时', instruction: '在定时器中断服务函数中计数，实现精确的秒表功能。每1000次中断为1秒。', checkType: 'code-modified' },
      { title: 'PWM输出', instruction: '使用定时器产生PWM信号，控制LED亮度或电机转速。通过改变占空比实现调光效果。', hint: 'PWM频率建议1kHz，占空比0-100%', checkType: 'code-modified' },
    ],
  },
  {
    id: 'uart',
    title: 'UART串口',
    desc: '串口通信协议',
    icon: 'UART',
    chipFamily: 'C51',
    chipModel: 'AT89C51',
    steps: [
      { title: '串口参数配置', instruction: '配置串口波特率为9600，8位数据位，无校验，1位停止位（8N1）。\nSCON = 0x50;\nTMOD |= 0x20;\nTH1 = 0xFD; TR1 = 1;', checkType: 'code-modified' },
      { title: '发送数据', instruction: '使用SBUF寄存器发送一个字节数据，等待TI标志置位表示发送完成。\nSBUF = 0x41; // 发送字符 A\nwhile(!TI); TI = 0;', checkType: 'code-modified' },
      { title: '接收数据', instruction: '等待RI标志置位，从SBUF读取接收到的数据。\nwhile(!RI);\nchar c = SBUF;\nRI = 0;', checkType: 'code-modified' },
      { title: '串口调试', instruction: '编写完整的串口通信程序，实现PC与MCU之间的数据交互。在下方串口监视器中查看收发数据。', checkType: 'code-modified' },
    ],
  },
];

const STORAGE_KEY = 'chip-sim-teaching-progress';

// ==================== 进度类型 ====================

interface CourseState {
  started: boolean;
  currentStep: number;
  completedSteps: number[];
}

type ProgressMap = Record<string, CourseState>;

function loadProgress(): ProgressMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveProgress(p: ProgressMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

// ==================== Props ====================

interface TeachingModeProps {
  isOpen: boolean;
  onClose: () => void;
}

// ==================== 组件 ====================

export function TeachingMode({ isOpen, onClose }: TeachingModeProps) {
  const [progress, setProgress] = useState<ProgressMap>({});
  const [activeCourse, setActiveCourse] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) setProgress(loadProgress());
  }, [isOpen]);

  const getCourseState = useCallback((courseId: string): CourseState => {
    return progress[courseId] || { started: false, currentStep: 0, completedSteps: [] };
  }, [progress]);

  const updateCourseState = useCallback((courseId: string, update: Partial<CourseState>) => {
    setProgress(prev => {
      const current = prev[courseId] || { started: false, currentStep: 0, completedSteps: [] };
      const next = { ...current, ...update };
      const updated = { ...prev, [courseId]: next };
      saveProgress(updated);
      return updated;
    });
  }, []);

  /** 开始课程：加载模板并进入引导 */
  const handleStartCourse = useCallback((course: Course) => {
    updateCourseState(course.id, { started: true, currentStep: 0, completedSteps: [] });
    setActiveCourse(course.id);

    // 派发事件加载对应的芯片和模板
    window.dispatchEvent(new CustomEvent('chip-sim:teaching-start', {
      detail: {
        courseId: course.id,
        chipFamily: course.chipFamily,
        chipModel: course.chipModel,
        templateId: course.templateId,
      },
    }));
  }, [updateCourseState]);

  /** 完成当前步骤 */
  const handleCompleteStep = useCallback((courseId: string, stepIndex: number) => {
    const state = getCourseState(courseId);
    const course = COURSES.find(c => c.id === courseId);
    if (!course) return;

    const newCompleted = state.completedSteps.includes(stepIndex)
      ? state.completedSteps
      : [...state.completedSteps, stepIndex];

    const nextStep = stepIndex + 1;
    const isLastStep = nextStep >= course.steps.length;

    updateCourseState(courseId, {
      completedSteps: newCompleted,
      currentStep: isLastStep ? stepIndex : nextStep,
    });
  }, [getCourseState, updateCourseState]);

  /** 重置课程 */
  const handleResetCourse = useCallback((courseId: string) => {
    updateCourseState(courseId, { started: false, currentStep: 0, completedSteps: [] });
    if (activeCourse === courseId) setActiveCourse(null);
  }, [updateCourseState, activeCourse]);

  if (!isOpen) return null;

  // 如果有活跃课程，显示引导步骤视图
  const activeCourseData = activeCourse ? COURSES.find(c => c.id === activeCourse) : null;
  const activeState = activeCourse && activeCourseData ? getCourseState(activeCourse) : null;

  return (
    <div className="tm-overlay" onClick={onClose}>
      <div className="tm-panel" onClick={(e) => e.stopPropagation()}>
        <div className="tm-header">
          <h2 className="tm-title">教学模式</h2>
          <button className="tm-close" onClick={onClose}>✕</button>
        </div>

        {/* 引导步骤视图 */}
        {activeCourseData && activeState?.started ? (
          <div className="tm-guide">
            <div className="tm-guide-header">
              <button className="tm-guide-back" onClick={() => setActiveCourse(null)}>
                ← 返回课程列表
              </button>
              <span className="tm-guide-course-name">{activeCourseData.icon} {activeCourseData.title}</span>
              <button className="tm-guide-reset" onClick={() => handleResetCourse(activeCourseData.id)}>
                重置
              </button>
            </div>

            <div className="tm-guide-steps">
              {activeCourseData.steps.map((step, idx) => {
                const isCompleted = activeState.completedSteps.includes(idx);
                const isCurrent = activeState.currentStep === idx;
                const isFuture = idx > activeState.currentStep && !isCompleted;

                return (
                  <div
                    key={idx}
                    className={`tm-guide-step ${isCurrent ? 'tm-guide-step-current' : ''} ${isCompleted ? 'tm-guide-step-done' : ''} ${isFuture ? 'tm-guide-step-future' : ''}`}
                  >
                    <div className="tm-guide-step-marker">
                      {isCompleted ? '✓' : idx + 1}
                    </div>
                    <div className="tm-guide-step-content">
                      <div className="tm-guide-step-title">{step.title}</div>
                      {isCurrent && (
                        <>
                          <div className="tm-guide-step-instruction">{step.instruction}</div>
                          {step.hint && (
                            <div className="tm-guide-step-hint">提示: {step.hint}</div>
                          )}
                          <div className="tm-guide-step-actions">
                            <button
                              className="tm-guide-complete-btn"
                              onClick={() => handleCompleteStep(activeCourseData.id, idx)}
                            >
                              完成此步骤
                            </button>
                          </div>
                        </>
                      )}
                      {isCompleted && (
                        <div className="tm-guide-step-done-label">已完成</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 完成提示 */}
            {activeState.completedSteps.length === activeCourseData.steps.length && (
              <div className="tm-guide-complete">
                <div className="tm-guide-complete-title">课程完成！</div>
                <div className="tm-guide-complete-desc">你已完成「{activeCourseData.title}」的所有步骤</div>
                <button className="tm-guide-complete-btn" onClick={() => setActiveCourse(null)}>
                  返回课程列表
                </button>
              </div>
            )}
          </div>
        ) : (
          /* 课程列表视图 */
          <div className="tm-course-list">
            {COURSES.map((course) => {
              const state = getCourseState(course.id);
              const pct = state.started
                ? Math.round((state.completedSteps.length / course.steps.length) * 100)
                : 0;

              return (
                <div key={course.id} className="tm-course">
                  <div className="tm-course-header">
                    <span className="tm-course-icon">{course.icon}</span>
                    <div className="tm-course-info">
                      <div className="tm-course-name">{course.title}</div>
                      <div className="tm-course-desc">{course.desc}</div>
                    </div>
                    <div className="tm-course-meta">
                      <span className="tm-course-steps-count">{course.steps.length} 步骤</span>
                      {state.started && (
                        <div className="tm-progress-bar">
                          <div className="tm-progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="tm-course-actions">
                    {state.started ? (
                      <>
                        <button className="tm-course-btn tm-course-btn-resume" onClick={() => setActiveCourse(course.id)}>
                          继续学习 ({state.completedSteps.length}/{course.steps.length})
                        </button>
                        <button className="tm-course-btn tm-course-btn-reset" onClick={() => handleResetCourse(course.id)}>
                          重置
                        </button>
                      </>
                    ) : (
                      <button className="tm-course-btn tm-course-btn-start" onClick={() => handleStartCourse(course)}>
                        开始学习
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
