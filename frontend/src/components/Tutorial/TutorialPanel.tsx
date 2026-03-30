/**
 * 教程列表面板
 * 展示所有可用教程，支持分类、搜索、难度筛选
 */

import { useState, useMemo } from 'react';
import { useTutorialStore } from '../../stores/tutorial-store';
import { TUTORIALS, TUTORIAL_CATEGORIES } from '../../templates/tutorials';
import type { Tutorial, TutorialDifficulty } from '../../types/tutorial';
import './TutorialPanel.css';

const DIFFICULTY_LABELS: Record<TutorialDifficulty, { label: string; stars: string }> = {
  beginner: { label: '入门', stars: '⭐' },
  intermediate: { label: '中级', stars: '⭐⭐' },
  advanced: { label: '高级', stars: '⭐⭐⭐' },
};

export function TutorialPanel() {
  const {
    startTutorial,
    isTutorialCompleted,
    getTutorialProgress,
  } = useTutorialStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredTutorials = useMemo(() => {
    let result = TUTORIALS;

    if (activeCategory) {
      result = result.filter((t) => t.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags?.some((tag) => tag.includes(q))
      );
    }

    return result;
  }, [searchQuery, activeCategory]);

  const handleStart = (tutorial: Tutorial) => {
    startTutorial(tutorial);
  };

  return (
    <div className="tutorial-panel">
      <h4 className="tutorial-panel-title">🎓 交互式教程</h4>

      {/* 搜索框 */}
      <div className="tutorial-search">
        <input
          type="text"
          className="tutorial-search-input"
          placeholder="搜索教程..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="tutorial-search-clear" onClick={() => setSearchQuery('')}>
            ✕
          </button>
        )}
      </div>

      {/* 分类标签 */}
      <div className="tutorial-categories">
        <button
          className={`tutorial-cat-btn ${activeCategory === null ? 'active' : ''}`}
          onClick={() => setActiveCategory(null)}
        >
          全部
        </button>
        {TUTORIAL_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            className={`tutorial-cat-btn ${activeCategory === cat.key ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat.key)}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* 教程计数 */}
      <div className="tutorial-count">
        {filteredTutorials.length} 个教程
      </div>

      {/* 教程列表 */}
      <div className="tutorial-list">
        {filteredTutorials.map((tutorial) => {
          const isExpanded = expandedId === tutorial.id;
          const completed = isTutorialCompleted(tutorial.id);
          const progress = getTutorialProgress(tutorial.id);
          const diffLabel = DIFFICULTY_LABELS[tutorial.difficulty];

          // 前置条件检查
          const prereqsMet = !tutorial.prerequisiteIds?.length ||
            tutorial.prerequisiteIds.every((id) => isTutorialCompleted(id));

          return (
            <div
              key={tutorial.id}
              className={`tutorial-card ${completed ? 'tutorial-card-completed' : ''} ${!prereqsMet ? 'tutorial-card-locked' : ''} ${isExpanded ? 'tutorial-card-expanded' : ''}`}
            >
              <div className="tutorial-card-header">
                <span className="tutorial-card-icon">{tutorial.icon}</span>
                <div
                  className="tutorial-card-info"
                  onClick={() => setExpandedId(isExpanded ? null : tutorial.id)}
                >
                  <div className="tutorial-card-name-row">
                    <h5 className="tutorial-card-name">{tutorial.title}</h5>
                    {completed && <span className="tutorial-card-check">✅</span>}
                  </div>
                  <p className="tutorial-card-desc">{tutorial.description}</p>
                </div>
                <div className="tutorial-card-actions">
                  <span className="tutorial-card-difficulty" title={diffLabel.label}>
                    {diffLabel.stars}
                  </span>
                  <span className="tutorial-card-time">
                    {tutorial.estimatedTime}分钟
                  </span>
                  {prereqsMet ? (
                    <button
                      className={`tutorial-card-start-btn ${completed ? 'tutorial-card-replay-btn' : ''}`}
                      onClick={() => handleStart(tutorial)}
                    >
                      {completed ? '重放' : progress ? '继续' : '开始'}
                    </button>
                  ) : (
                    <span className="tutorial-card-locked-label">🔒 需先完成前置</span>
                  )}
                </div>
              </div>

              {/* 展开详情 */}
              {isExpanded && (
                <div className="tutorial-card-details">
                  <div className="tutorial-card-meta">
                    <span>📝 {tutorial.steps.length} 个步骤</span>
                    <span>⏱️ 约 {tutorial.estimatedTime} 分钟</span>
                    <span>🎯 {diffLabel.label}级别</span>
                  </div>

                  {/* 步骤预览 */}
                  <div className="tutorial-steps-preview">
                    {tutorial.steps.map((step, idx) => {
                      const stepDone = progress?.completedStepIds.includes(step.id);
                      return (
                        <div key={step.id} className={`tutorial-step-item ${stepDone ? 'tutorial-step-done' : ''}`}>
                          <span className="tutorial-step-num">{idx + 1}</span>
                          <span className="tutorial-step-name">{step.title}</span>
                          {stepDone && <span className="tutorial-step-check">✓</span>}
                        </div>
                      );
                    })}
                  </div>

                  {/* 标签 */}
                  {tutorial.tags && tutorial.tags.length > 0 && (
                    <div className="tutorial-card-tags">
                      {tutorial.tags.map((tag) => (
                        <span key={tag} className="tutorial-card-tag">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredTutorials.length === 0 && (
          <div className="tutorial-empty">
            <span>🔍</span>
            <p>没有找到匹配的教程</p>
          </div>
        )}
      </div>
    </div>
  );
}
