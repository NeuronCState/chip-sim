/**
 * 元件帮助面板
 * 显示当前选中元件的详细文档
 */

import { useCircuitStore } from '../../stores/circuit-store';
import { getHelpForComponent } from './component-help-data';
import { t } from '../../i18n';
import './ComponentHelp.css';

export function ComponentHelp() {
  const selectedComponentId = useCircuitStore((s) => s.selectedComponentId);
  const components = useCircuitStore((s) => s.components);

  const selected = selectedComponentId
    ? components.find((c) => c.id === selectedComponentId)
    : null;

  if (!selected) {
    return (
      <div className="help-empty">
        <div className="help-empty-icon">📖</div>
        <p>{t('help.noSelection')}</p>
      </div>
    );
  }

  const help = getHelpForComponent(selected.type);
  if (!help) {
    return (
      <div className="help-section">
        <h4 className="help-section-title">{selected.name}</h4>
        <p className="help-text">{selected.type}</p>
      </div>
    );
  }

  return (
    <div className="component-help">
      {/* 标题 */}
      <div className="help-header">
        <span className="help-icon">{help.icon}</span>
        <div>
          <h4 className="help-title">{t(help.nameKey)}</h4>
          <span className="help-comp-name">{selected.name}</span>
        </div>
      </div>

      {/* 描述 */}
      <div className="help-section">
        <h5 className="help-section-title">{t('help.componentInfo')}</h5>
        <p className="help-text">{t(help.descKey)}</p>
        {help.keyParams.length > 0 && (
          <div className="help-params">
            {help.keyParams.map((p) => (
              <span key={p} className="help-param-tag">{p}</span>
            ))}
          </div>
        )}
      </div>

      {/* 典型用法 */}
      <div className="help-section">
        <h5 className="help-section-title">{t('help.typicalUsage')}</h5>
        <p className="help-text">{t(help.usageKey)}</p>
      </div>

      {/* 接线提示 */}
      <div className="help-section">
        <h5 className="help-section-title">{t('help.wiringTip')}</h5>
        <p className="help-text">{t(help.wiringKey)}</p>
      </div>

      {/* 常见错误 */}
      <div className="help-section help-section-warning">
        <h5 className="help-section-title">⚠️ {t('help.commonMistakes')}</h5>
        <p className="help-text help-text-warning">{t(help.mistakeKey)}</p>
      </div>
    </div>
  );
}
