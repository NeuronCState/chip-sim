/**
 * 电路搭建向导
 * 按类别选择模板，一键加载到画布
 */

import { useState, useCallback } from 'react';
import { useCircuitStore } from '../../stores/circuit-store';
import { TEMPLATES, TEMPLATE_CATEGORIES } from '../../templates/template-data';
import type { CircuitTemplate } from '../../templates/template-data';
import { t } from '../../i18n';
import { resetComponentCounters } from '../../features/editor/ComponentLibrary';
import './CircuitWizard.css';

interface CircuitWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CircuitWizard({ isOpen, onClose }: CircuitWizardProps) {
  const [activeCategory, setActiveCategory] = useState<CircuitTemplate['category']>('basic');
  const [previewTemplate, setPreviewTemplate] = useState<CircuitTemplate | null>(null);

  const reset = useCircuitStore((s) => s.reset);
  const fitToScreen = useCircuitStore((s) => s.fitToScreen);

  const categoryTemplates = TEMPLATES.filter((t) => t.category === activeCategory);

  const handleLoadTemplate = useCallback(
    (template: CircuitTemplate) => {
      const { components, wires } = template.createCircuit();

      resetComponentCounters();
      reset();

      // 直接设置 store 中的元件和连线
      const store = useCircuitStore.getState();
      // 通过 pushUndo + 批量设置
      store.pushUndo();
      useCircuitStore.setState({
        components,
        wires,
        nodes: [],
        selectedComponentId: null,
        selectedWireId: null,
        selectedComponentIds: new Set(),
      });

      setTimeout(() => fitToScreen(), 50);
      onClose();
    },
    [reset, fitToScreen, onClose]
  );

  const handleBlankCircuit = useCallback(() => {
    resetComponentCounters();
    reset();
    onClose();
  }, [reset, onClose]);

  if (!isOpen) return null;

  const getDifficultyStars = (level: number) =>
    Array.from({ length: 3 }, (_, i) => (i < level ? '⭐' : '☆')).join('');

  return (
    <div className="wizard-overlay" onClick={onClose}>
      <div className="wizard-dialog" onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <div className="wizard-header">
          <div>
            <h2 className="wizard-title">🚀 {t('wizard.title')}</h2>
            <p className="wizard-subtitle">{t('wizard.subtitle')}</p>
          </div>
          <button className="wizard-close" onClick={onClose}>✕</button>
        </div>

        <div className="wizard-body">
          {/* 分类标签 */}
          <div className="wizard-categories">
            {TEMPLATE_CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                className={`wizard-cat-btn ${activeCategory === cat.key ? 'wizard-cat-active' : ''}`}
                onClick={() => setActiveCategory(cat.key)}
              >
                {t(cat.titleKey)}
              </button>
            ))}
          </div>

          {/* 模板列表 */}
          <div className="wizard-grid">
            {/* 空白电路 */}
            <div className="wizard-card wizard-card-blank" onClick={handleBlankCircuit}>
              <div className="wizard-card-icon">📄</div>
              <div className="wizard-card-title">{t('wizard.blank')}</div>
              <div className="wizard-card-desc">{t('wizard.blank.desc')}</div>
            </div>

            {/* 模板卡片 */}
            {categoryTemplates.map((template) => (
              <div
                key={template.id}
                className={`wizard-card ${previewTemplate?.id === template.id ? 'wizard-card-active' : ''}`}
                onClick={() => setPreviewTemplate(template)}
                onDoubleClick={() => handleLoadTemplate(template)}
              >
                <div className="wizard-card-icon">{template.icon}</div>
                <div className="wizard-card-title">{t(template.titleKey)}</div>
                <div className="wizard-card-desc">{t(template.descKey)}</div>
                <div className="wizard-card-meta">
                  <span className="wizard-difficulty">{getDifficultyStars(template.difficulty)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* 预览区域 */}
          {previewTemplate && (
            <div className="wizard-preview">
              <div className="wizard-preview-header">
                <h3>{previewTemplate.icon} {t(previewTemplate.titleKey)}</h3>
                <button
                  className="wizard-load-btn"
                  onClick={() => handleLoadTemplate(previewTemplate)}
                >
                  {t('wizard.load')} →
                </button>
              </div>
              <p className="wizard-preview-desc">{t(previewTemplate.descKey)}</p>
              <div className="wizard-preview-info">
                <span>📦 {previewTemplate.createCircuit().components.length} 元件</span>
                <span>🔗 {previewTemplate.createCircuit().wires.length} 连线</span>
                <span>难度: {getDifficultyStars(previewTemplate.difficulty)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
