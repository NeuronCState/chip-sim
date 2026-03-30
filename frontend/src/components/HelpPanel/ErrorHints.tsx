/**
 * 常见错误提示组件
 * 根据电路验证结果提供修复建议
 */

import { useCircuitStore } from '../../stores/circuit-store';
import { ValidationSeverity } from '../../types/circuit';
import { t } from '../../i18n';
import './ErrorHints.css';

/** 错误类型到修复建议的映射 */
const ERROR_SUGGESTIONS: Record<string, { hint: string; hintEn: string }> = {
  'no_ground': {
    hint: '电路缺少接地点。每个电路必须至少有一个接地元件作为参考电位。',
    hintEn: 'Circuit is missing a ground. Every circuit needs at least one ground reference.',
  },
  'no_components': {
    hint: '电路为空。从左侧元件面板拖入元件开始搭建。',
    hintEn: 'Circuit is empty. Drag components from the left panel to start building.',
  },
  'floating_node': {
    hint: '存在未连接的节点。检查元件端口是否都已正确连线。',
    hintEn: 'There are floating nodes. Check that all component ports are properly connected.',
  },
  'short_circuit': {
    hint: '检测到可能的短路。电源正负极之间应有负载（电阻等）。',
    hintEn: 'Possible short circuit detected. There should be a load between power supply terminals.',
  },
  'high_current': {
    hint: '电阻值过小可能导致电流过大。建议增大阻值或检查电源电压。',
    hintEn: 'Low resistance may cause excessive current. Consider increasing resistance or checking supply voltage.',
  },
};

export function ErrorHints() {
  const validationMessages = useCircuitStore((s) => s.validationMessages);

  if (validationMessages.length === 0) {
    return (
      <div className="error-hints-empty">
        <span className="error-hints-ok">✅</span>
        <span>{t('help.noSelection') === '选择一个元件查看帮助信息' ? '电路检查通过' : 'Circuit check passed'}</span>
      </div>
    );
  }

  return (
    <div className="error-hints">
      <h4 className="error-hints-title">{t('help.validationErrors')}</h4>
      {validationMessages.map((msg, i) => {
        const icon =
          msg.severity === ValidationSeverity.Error ? '❌'
            : msg.severity === ValidationSeverity.Warning ? '⚠️'
            : 'ℹ️';

        // 尝试匹配已知错误类型
        const suggestion = findSuggestion(msg.message);

        return (
          <div key={i} className={`error-hint-item error-hint-${msg.severity}`}>
            <div className="error-hint-header">
              <span className="error-hint-icon">{icon}</span>
              <span className="error-hint-msg">{msg.message}</span>
            </div>
            {suggestion && (
              <div className="error-hint-suggestion">
                💡 {suggestion}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function findSuggestion(message: string): string | undefined {
  const lowerMsg = message.toLowerCase();
  for (const [key, data] of Object.entries(ERROR_SUGGESTIONS)) {
    if (lowerMsg.includes(key.replace('_', ' ')) || lowerMsg.includes(key)) {
      return data.hint;
    }
  }
  // 通用建议
  if (lowerMsg.includes('ground') || lowerMsg.includes('接地')) {
    return ERROR_SUGGESTIONS['no_ground'].hint;
  }
  if (lowerMsg.includes('empty') || lowerMsg.includes('空')) {
    return ERROR_SUGGESTIONS['no_components'].hint;
  }
  if (lowerMsg.includes('short') || lowerMsg.includes('短路')) {
    return ERROR_SUGGESTIONS['short_circuit'].hint;
  }
  if (lowerMsg.includes('current') || lowerMsg.includes('电流')) {
    return ERROR_SUGGESTIONS['high_current'].hint;
  }
  return undefined;
}
