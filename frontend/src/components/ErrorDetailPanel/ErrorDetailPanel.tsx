/**
 * 错误详情面板组件
 * 展示错误列表，支持展开/收起、搜索、复制详情、上报
 * 参考规划: JJC-20260328-007 §四.3
 */

import { useState, useMemo, useCallback } from 'react';
import { useErrorReport } from '../../hooks/useErrorReport';
import { type ErrorReport, type ErrorSource, type ErrorSeverityLevel } from '../../lib/errors/error-report';

const SOURCE_LABEL: Record<ErrorSource, string> = {
  compiler: '编译器', simulator: '仿真引擎', network: '网络', system: '系统',
};

const SEVERITY_ICON: Record<ErrorSeverityLevel, string> = {
  fatal: '🔴', warning: '🟡', info: '🔵',
};

const SOURCE_ICON: Record<ErrorSource, string> = {
  compiler: '📝', simulator: '⚡', network: '🌐', system: '⚙️',
};

export function ErrorDetailPanel() {
  const { reports, dismissError, removeError, copyErrorDetail, clearAll } = useErrorReport();
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState<ErrorSource | 'all'>('all');
  const [filterSev, setFilterSev] = useState<ErrorSeverityLevel | 'all'>('all');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = reports;
    if (filterSource !== 'all') list = list.filter((r) => r.source === filterSource);
    if (filterSev !== 'all') list = list.filter((r) => r.severity === filterSev);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) => r.message.toLowerCase().includes(q) || r.detail.toLowerCase().includes(q),
      );
    }
    return list;
  }, [reports, search, filterSource, filterSev]);

  const handleCopy = useCallback(async (id: string) => {
    const ok = await copyErrorDetail(id);
    if (ok) {
      setCopyFeedback(id);
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  }, [copyErrorDetail]);

  const handleReport = useCallback(async (report: ErrorReport) => {
    try {
      await fetch('/api/error-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });
      setCopyFeedback(`reported-${report.id}`);
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch {
      // 静默失败
    }
  }, []);

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <h3 style={styles.title}>错误详情</h3>
        <span style={styles.count}>{filtered.length} 条</span>
        {reports.length > 0 && (
          <button style={styles.clearBtn} onClick={clearAll}>清空</button>
        )}
      </div>

      {/* 搜索 + 筛选 */}
      <div style={styles.filters}>
        <input
          style={styles.search}
          placeholder="搜索错误..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          style={styles.select}
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value as ErrorSource | 'all')}
        >
          <option value="all">全部来源</option>
          <option value="compiler">编译器</option>
          <option value="simulator">仿真</option>
          <option value="network">网络</option>
          <option value="system">系统</option>
        </select>
        <select
          style={styles.select}
          value={filterSev}
          onChange={(e) => setFilterSev(e.target.value as ErrorSeverityLevel | 'all')}
        >
          <option value="all">全部级别</option>
          <option value="fatal">致命</option>
          <option value="warning">警告</option>
          <option value="info">提示</option>
        </select>
      </div>

      {/* 错误列表 */}
      <div style={styles.list}>
        {filtered.length === 0 && (
          <div style={styles.empty}>暂无错误记录 ✓</div>
        )}
        {filtered.map((r) => (
          <div
            key={r.id}
            style={{
              ...styles.item,
              opacity: r.resolved ? 0.5 : 1,
              borderLeft: `3px solid ${r.severity === 'fatal' ? '#ff4444' : r.severity === 'warning' ? '#f0a500' : '#4488ff'}`,
            }}
          >
            <div
              style={styles.itemHeader}
              onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
            >
              <span style={styles.badge}>
                {SEVERITY_ICON[r.severity]} {SOURCE_ICON[r.source]}
              </span>
              <span style={styles.itemMessage}>{r.message}</span>
              <span style={styles.itemTime}>
                {new Date(r.timestamp).toLocaleTimeString('zh-CN')}
              </span>
              {r.resolved && <span style={styles.resolvedBadge}>已解决</span>}
            </div>

            {expandedId === r.id && (
              <div style={styles.detail}>
                <div style={styles.detailRow}>
                  <strong>来源:</strong> {SOURCE_LABEL[r.source]}
                </div>
                <div style={styles.detailRow}>
                  <strong>严重度:</strong> {SEVERITY_ICON[r.severity]} {r.severity}
                </div>
                {r.detail && (
                  <div style={styles.detailRow}>
                    <strong>详情:</strong>
                    <pre style={styles.detailPre}>{r.detail}</pre>
                  </div>
                )}
                {r.stack && (
                  <details style={styles.stackDetails}>
                    <summary>堆栈信息</summary>
                    <pre style={styles.stack}>{r.stack}</pre>
                  </details>
                )}
                <div style={styles.actions}>
                  <button
                    style={styles.actionBtn}
                    onClick={() => handleCopy(r.id)}
                  >
                    {copyFeedback === r.id ? '✅ 已复制' : '📋 复制详情'}
                  </button>
                  <button
                    style={styles.actionBtn}
                    onClick={() => handleReport(r)}
                  >
                    {copyFeedback === `reported-${r.id}` ? '✅ 已上报' : '📤 上报错误'}
                  </button>
                  {!r.resolved && (
                    <button
                      style={styles.actionBtn}
                      onClick={() => dismissError(r.id)}
                    >
                      ✓ 标记已解决
                    </button>
                  )}
                  <button
                    style={{ ...styles.actionBtn, color: '#ff6b6b' }}
                    onClick={() => removeError(r.id)}
                  >
                    🗑 删除
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    background: '#16162a', borderRadius: '8px', padding: '16px',
    color: '#e0e0e0', fontFamily: '-apple-system, sans-serif',
    maxHeight: '600px', overflow: 'auto',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px',
  },
  title: { fontSize: '15px', fontWeight: 600, margin: 0, flex: 1 },
  count: { fontSize: '12px', color: '#888' },
  clearBtn: {
    background: 'none', border: '1px solid #444', borderRadius: '4px',
    color: '#aaa', padding: '4px 8px', fontSize: '11px', cursor: 'pointer',
  },
  filters: { display: 'flex', gap: '8px', marginBottom: '12px' },
  search: {
    flex: 1, background: '#1e1e2e', border: '1px solid #333', borderRadius: '4px',
    padding: '6px 10px', color: '#e0e0e0', fontSize: '12px', outline: 'none',
  },
  select: {
    background: '#1e1e2e', border: '1px solid #333', borderRadius: '4px',
    padding: '6px 8px', color: '#e0e0e0', fontSize: '12px',
  },
  list: { display: 'flex', flexDirection: 'column', gap: '4px' },
  empty: { textAlign: 'center', padding: '24px', color: '#666', fontSize: '13px' },
  item: {
    background: '#1e1e2e', borderRadius: '6px', overflow: 'hidden',
  },
  itemHeader: {
    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
    cursor: 'pointer', fontSize: '13px',
  },
  badge: { fontSize: '14px', flexShrink: 0 },
  itemMessage: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemTime: { fontSize: '11px', color: '#666', flexShrink: 0 },
  resolvedBadge: {
    fontSize: '10px', color: '#4caf50', background: '#1a3a1a',
    padding: '2px 6px', borderRadius: '3px',
  },
  detail: { padding: '8px 12px 12px', borderTop: '1px solid #2a2a4a' },
  detailRow: { fontSize: '12px', marginBottom: '4px', color: '#bbb' },
  detailPre: {
    background: '#0d0d1a', padding: '8px', borderRadius: '4px', fontSize: '11px',
    whiteSpace: 'pre-wrap', marginTop: '4px', color: '#ccc',
  },
  stackDetails: { marginTop: '8px' },
  stack: {
    background: '#0d0d1a', padding: '8px', borderRadius: '4px', fontSize: '10px',
    color: '#ff6b6b', maxHeight: '120px', overflow: 'auto', whiteSpace: 'pre-wrap',
  },
  actions: { display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' },
  actionBtn: {
    background: '#2a2a4a', border: 'none', borderRadius: '4px',
    padding: '4px 10px', fontSize: '11px', color: '#ccc', cursor: 'pointer',
  },
};
