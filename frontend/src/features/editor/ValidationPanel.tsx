/**
 * 电路验证面板
 * 显示电路验证结果和错误提示
 */

import { useCircuitStore } from '../../stores/circuit-store';
import { ValidationSeverity } from '../../types/circuit';
import './ValidationPanel.css';

export function ValidationPanel() {
  const validationMessages = useCircuitStore((s) => s.validationMessages);
  const runValidation = useCircuitStore((s) => s.runValidation);

  const errorCount = validationMessages.filter(
    (m) => m.severity === ValidationSeverity.Error
  ).length;
  const warningCount = validationMessages.filter(
    (m) => m.severity === ValidationSeverity.Warning
  ).length;

  return (
    <div className="validation-panel">
      <div className="validation-header">
        <h3 className="panel-title">电路检查</h3>
        <button
          className="btn-validate"
          onClick={runValidation}
          title="运行电路验证"
        >
          🔍 检查
        </button>
      </div>

      {validationMessages.length === 0 ? (
        <div className="validation-empty">
          点击"检查"按钮验证电路
        </div>
      ) : (
        <>
          <div className="validation-summary">
            {errorCount > 0 && (
              <span className="summary-error">错误 {errorCount} 错误</span>
            )}
            {warningCount > 0 && (
              <span className="summary-warning">⚠️ {warningCount} 警告</span>
            )}
            {errorCount === 0 && warningCount === 0 && (
              <span className="summary-ok">电路正常</span>
            )}
          </div>
          <div className="validation-messages">
            {validationMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`validation-item validation-${msg.severity}`}
              >
                <span className="validation-icon">
                  {msg.severity === ValidationSeverity.Error
                    ? '错误'
                    : msg.severity === ValidationSeverity.Warning
                    ? '⚠️'
                    : 'ℹ️'}
                </span>
                <span className="validation-text">{msg.message}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
