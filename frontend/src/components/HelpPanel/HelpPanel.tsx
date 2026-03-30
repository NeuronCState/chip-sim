/**
 * 帮助面板主组件
 * 整合元件帮助、错误提示、示例电路
 */

import { useState } from 'react';
import { ComponentHelp } from './ComponentHelp';
import { ErrorHints } from './ErrorHints';
import { ExampleLibrary } from './ExampleLibrary';
import { TutorialPanel } from '../Tutorial/TutorialPanel';
import { useCircuitStore } from '../../stores/circuit-store';
import { useTour } from '../Tutorial';
import { t } from '../../i18n';
import './HelpPanel.css';

type HelpTab = 'component' | 'errors' | 'examples' | 'tutorials';

export function HelpPanel() {
  const [activeTab, setActiveTab] = useState<HelpTab>('component');
  const selectedComponentId = useCircuitStore((s) => s.selectedComponentId);
  const validationMessages = useCircuitStore((s) => s.validationMessages);
  const { resetTour } = useTour();

  // 选中元件时自动切换到元件帮助
  const currentTab = selectedComponentId ? 'component' : activeTab;

  return (
    <div className="help-panel">
      <div className="help-panel-header">
        <h3 className="help-panel-title">📖 {t('help.title')}</h3>
        <button
          className="help-tour-btn"
          onClick={resetTour}
          title={t('common.replay')}
        >
          🎓 {t('common.replay')}
        </button>
      </div>

      <div className="help-panel-tabs">
        <button
          className={`help-tab ${currentTab === 'component' ? 'help-tab-active' : ''}`}
          onClick={() => setActiveTab('component')}
        >
          📦 元件
        </button>
        <button
          className={`help-tab ${currentTab === 'errors' ? 'help-tab-active' : ''}`}
          onClick={() => setActiveTab('errors')}
        >
          ⚠️ 检查
          {validationMessages.length > 0 && (
            <span className="help-tab-badge">{validationMessages.length}</span>
          )}
        </button>
        <button
          className={`help-tab ${currentTab === 'examples' ? 'help-tab-active' : ''}`}
          onClick={() => setActiveTab('examples')}
        >
          📚 示例
        </button>
        <button
          className={`help-tab ${currentTab === 'tutorials' ? 'help-tab-active' : ''}`}
          onClick={() => setActiveTab('tutorials')}
        >
          🎓 教程
        </button>
      </div>

      <div className="help-panel-content">
        {currentTab === 'component' && <ComponentHelp />}
        {currentTab === 'errors' && <ErrorHints />}
        {currentTab === 'examples' && <ExampleLibrary />}
        {currentTab === 'tutorials' && <TutorialPanel />}
      </div>
    </div>
  );
}
