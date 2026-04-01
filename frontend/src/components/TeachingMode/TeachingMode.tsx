/**
 * 教学模式面板
 * 包含预设课程列表，步骤完成状态保存在 localStorage
 */

import { useState, useEffect, useCallback } from 'react';
import './TeachingMode.css';

// ==================== 课程数据 ====================

interface Course {
  id: string;
  title: string;
  desc: string;
  icon: string;
  steps: string[];
}

const COURSES: Course[] = [
  {
    id: 'gpio',
    title: 'GPIO基础',
    desc: '学习单片机GPIO输入输出',
    icon: '💡',
    steps: ['理解GPIO概念', '配置GPIO为输出模式', '控制LED亮灭', '配置GPIO为输入模式', '读取按键状态'],
  },
  {
    id: 'button',
    title: '按键输入',
    desc: '按键检测与消抖',
    icon: '🔘',
    steps: ['连接按键电路', '读取按键电平', '软件消抖', '中断方式检测按键'],
  },
  {
    id: 'timer',
    title: '定时器',
    desc: '定时器中断与PWM',
    icon: '⏱️',
    steps: ['定时器基本概念', '配置定时器中断', '使用定时器计时', 'PWM输出'],
  },
  {
    id: 'interrupt',
    title: '中断系统',
    desc: '外部中断与优先级',
    icon: '⚡',
    steps: ['中断概念', '外部中断配置', '中断服务函数', '中断优先级'],
  },
  {
    id: 'uart',
    title: 'UART串口',
    desc: '串口通信协议',
    icon: '📡',
    steps: ['串口参数配置', '发送数据', '接收数据', '串口调试'],
  },
  {
    id: 'spi',
    title: 'SPI通信',
    desc: 'SPI总线协议',
    icon: '🔗',
    steps: ['SPI协议介绍', 'SPI主机配置', 'SPI数据传输', 'SPI从机通信'],
  },
  {
    id: 'i2c',
    title: 'I2C通信',
    desc: 'I2C总线协议',
    icon: '🔌',
    steps: ['I2C协议介绍', 'I2C主机配置', 'I2C读写操作', '连接I2C设备'],
  },
];

const STORAGE_KEY = 'chip-sim-course-progress';

// ==================== 进度类型 ====================

/** courseId → Set of step indices */
type CourseProgress = Record<string, number[]>;

function loadProgress(): CourseProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as CourseProgress;
  } catch {
    return {};
  }
}

function saveProgress(progress: CourseProgress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

// ==================== Props ====================

interface TeachingModeProps {
  isOpen: boolean;
  onClose: () => void;
}

// ==================== 组件 ====================

export function TeachingMode({ isOpen, onClose }: TeachingModeProps) {
  const [progress, setProgress] = useState<CourseProgress>({});
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setProgress(loadProgress());
    }
  }, [isOpen]);

  const toggleStep = useCallback((courseId: string, stepIndex: number) => {
    setProgress((prev) => {
      const current = prev[courseId] || [];
      const next = current.includes(stepIndex)
        ? current.filter((i) => i !== stepIndex)
        : [...current, stepIndex];
      const updated = { ...prev, [courseId]: next };
      saveProgress(updated);
      return updated;
    });
  }, []);

  if (!isOpen) return null;

  return (
    <div className="tm-overlay" onClick={onClose}>
      <div className="tm-panel" onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <div className="tm-header">
          <h2 className="tm-title">🎓 教学模式</h2>
          <button className="tm-close" onClick={onClose}>✕</button>
        </div>

        {/* 课程列表 */}
        <div className="tm-course-list">
          {COURSES.map((course) => {
            const doneSteps = progress[course.id] || [];
            const pct = Math.round((doneSteps.length / course.steps.length) * 100);
            const isExpanded = expandedCourse === course.id;

            return (
              <div key={course.id} className={`tm-course ${isExpanded ? 'tm-course-expanded' : ''}`}>
                <button
                  className="tm-course-header"
                  onClick={() => setExpandedCourse(isExpanded ? null : course.id)}
                >
                  <span className="tm-course-icon">{course.icon}</span>
                  <div className="tm-course-info">
                    <div className="tm-course-name">{course.title}</div>
                    <div className="tm-course-desc">{course.desc}</div>
                  </div>
                  <div className="tm-course-progress">
                    <div className="tm-progress-bar">
                      <div className="tm-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="tm-progress-text">{doneSteps.length}/{course.steps.length}</span>
                  </div>
                  <span className="tm-course-arrow">{isExpanded ? '▼' : '▶'}</span>
                </button>

                {isExpanded && (
                  <div className="tm-steps">
                    {course.steps.map((step, idx) => {
                      const done = doneSteps.includes(idx);
                      return (
                        <button
                          key={idx}
                          className={`tm-step ${done ? 'tm-step-done' : ''}`}
                          onClick={() => toggleStep(course.id, idx)}
                        >
                          <span className="tm-step-check">{done ? '✅' : '⬜'}</span>
                          <span className="tm-step-label">{step}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
