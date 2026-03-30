/**
 * 智能诊断面板
 * 
 * 功能：
 * - 实时显示 DRC 诊断结果
 * - 按严重级别分组（错误/警告/建议）
 * - 点击诊断项自动定位并高亮对应元件
 * - 每条诊断附带修复建议
 * - 支持规则开关管理
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useCircuitStore } from '../../stores/circuit-store';
import { diagnosticEngine } from '../../lib/circuit/DiagnosticEngine';
import type { DRCDiagnostic } from '../../lib/circuit/CircuitDRC';
import './DiagnosticsPanel.css';

type SeverityTab = 'all' | 'error' | 'warning' | 'suggestion';

const SEVERITY_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  error: { icon: '❌', label: '错误', color: '#ef4444' },
  warning: { icon: '⚠️', label: '警告', color: '#f59e0b' },
  suggestion: { icon: '💡', label: '建议', color: '#3b82f6' },
};

export function DiagnosticsPanel() {
  const components = useCircuitStore((s) => s.components);
  const wires = useCircuitStore((s) => s.wires);
  const nodes = useCircuitStore((s) => s.nodes);
  const selectComponent = useCircuitStore((s) => s.selectComponent);

  const [diagnostics, setDiagnostics] = useState<DRCDiagnostic[]>([]);
  const [activeTab, setActiveTab] = useState<SeverityTab>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showRuleManager, setShowRuleManager] = useState(false);

  // 运行诊断
  const runDiag = useCallback(() => {
    const results = diagnosticEngine.run(components, nodes, wires);
    setDiagnostics(results);
  }, [components, nodes, wires]);

  // 订阅诊断引擎变更
  useEffect(() => {
    const unsub = diagnosticEngine.subscribe((state) => {
      setDiagnostics(state.diagnostics);
    });
    return unsub;
  }, []);

  // 电路变更时自动触发诊断
  useEffect(() => {
    diagnosticEngine.trigger(components, nodes, wires);
  }, [components, nodes, wires]);

  // 统计
  const counts = useMemo(() => ({
    error: diagnostics.filter((d) => d.severity === 'error').length,
    warning: diagnostics.filter((d) => d.severity === 'warning').length,
    suggestion: diagnostics.filter((d) => d.severity === 'suggestion').length,
    total: diagnostics.length,
  }), [diagnostics]);

  // 过滤
  const filtered = useMemo(() => {
    if (activeTab === 'all') return diagnostics;
    return diagnostics.filter((d) => d.severity === activeTab);
  }, [diagnostics, activeTab]);

  // 点击诊断项 → 定位并高亮元件
  const handleDiagnosticClick = useCallback((diag: DRCDiagnostic) => {
    const key = `${diag.ruleId}:${diag.targetId ?? 'circuit'}`;
    setExpandedId(expandedId === key ? null : key);

    if (diag.targetId && diag.targetType === 'component') {
      selectComponent(diag.targetId);
      // 触发画布定位事件
      const comp = components.find((c) => c.id === diag.targetId);
      if (comp) {
        window.dispatchEvent(
          new CustomEvent('locate-component', {
            detail: { componentId: diag.targetId, position: comp.position },
          })
        );
      }
    }
  }, [expandedId, selectComponent, components]);

  const rules = diagnosticEngine.getRules();

  return (
    <div className="diagnostics-panel">
      {/* 头部 */}
      <div className="diagnostics-header">
        <h3 className="panel-title">🔍 智能诊断</h3>
        <div className="header-actions">
          <button
            className="btn-rule-manager"
            onClick={() => setShowRuleManager(!showRuleManager)}
            title="规则管理"
          >
            ⚙️
          </button>
          <button className="btn-run-drc" onClick={runDiag} title="重新检查">
            🔄 检查
          </button>
        </div>
      </div>

      {/* 统计摘要 */}
      <div className="diagnostics-summary">
        {counts.error > 0 && (
          <span className="summary-badge summary-error">
            ❌ {counts.error}
          </span>
        )}
        {counts.warning > 0 && (
          <span className="summary-badge summary-warning">
            ⚠️ {counts.warning}
          </span>
        )}
        {counts.suggestion > 0 && (
          <span className="summary-badge summary-suggestion">
            💡 {counts.suggestion}
          </span>
        )}
        {counts.total === 0 && (
          <span className="summary-badge summary-ok">✅ 电路正常</span>
        )}
      </div>

      {/* 严重级别 Tabs */}
      <div className="severity-tabs">
        <button
          className={`sev-tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          全部 ({counts.total})
        </button>
        {counts.error > 0 && (
          <button
            className={`sev-tab sev-tab-error ${activeTab === 'error' ? 'active' : ''}`}
            onClick={() => setActiveTab('error')}
          >
            ❌ 错误 ({counts.error})
          </button>
        )}
        {counts.warning > 0 && (
          <button
            className={`sev-tab sev-tab-warning ${activeTab === 'warning' ? 'active' : ''}`}
            onClick={() => setActiveTab('warning')}
          >
            ⚠️ 警告 ({counts.warning})
          </button>
        )}
        {counts.suggestion > 0 && (
          <button
            className={`sev-tab sev-tab-suggestion ${activeTab === 'suggestion' ? 'active' : ''}`}
            onClick={() => setActiveTab('suggestion')}
          >
            💡 建议 ({counts.suggestion})
          </button>
        )}
      </div>

      {/* 规则管理器 */}
      {showRuleManager && (
        <div className="rule-manager">
          <div className="rule-manager-title">DRC 规则管理</div>
          {rules.map((rule) => (
            <label key={rule.id} className="rule-item">
              <input
                type="checkbox"
                checked={rule.enabled}
                onChange={(e) => {
                  diagnosticEngine.setRuleEnabled(rule.id, e.target.checked);
                  runDiag();
                }}
              />
              <div className="rule-info">
                <span className="rule-name">{rule.name}</span>
                <span className="rule-desc">{rule.description}</span>
              </div>
              <span className={`rule-severity sev-${rule.severity}`}>
                {SEVERITY_CONFIG[rule.severity]?.icon}
              </span>
            </label>
          ))}
        </div>
      )}

      {/* 诊断结果列表 */}
      <div className="diagnostics-list">
        {filtered.length === 0 ? (
          <div className="diagnostics-empty">
            {counts.total === 0
              ? '暂无诊断结果，电路设计正常 ✅'
              : '当前筛选条件下无诊断结果'}
          </div>
        ) : (
          filtered.map((diag) => {
            const key = `${diag.ruleId}:${diag.targetId ?? 'circuit'}`;
            const isExpanded = expandedId === key;
            const config = SEVERITY_CONFIG[diag.severity];

            return (
              <div
                key={key}
                className={`diagnostic-item diag-${diag.severity} ${isExpanded ? 'expanded' : ''}`}
                onClick={() => handleDiagnosticClick(diag)}
              >
                <div className="diagnostic-row">
                  <span className="diagnostic-icon">{config?.icon}</span>
                  <span className="diagnostic-message">{diag.message}</span>
                  <span className="diagnostic-expand">{isExpanded ? '▲' : '▼'}</span>
                </div>
                {isExpanded && (
                  <div className="diagnostic-detail">
                    <div className="diagnostic-suggestion">
                      <span className="suggestion-label">💡 修复建议：</span>
                      <span className="suggestion-text">{diag.suggestion}</span>
                    </div>
                    {diag.targetId && (
                      <div className="diagnostic-meta">
                        <span className="meta-tag">
                          关联元件：{diag.targetType}
                        </span>
                        <span className="meta-locate" title="点击定位">
                          📍 定位
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
