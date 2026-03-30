/**
 * 电路编辑器页面（旧版保留，作为 Tab 内容）
 */

export function CircuitEditor() {
  return (
    <div className="circuit-editor-body">
      <div className="sil-main" style={{ padding: '1rem' }}>
        <div className="sil-panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔧</div>
          <h2 style={{ margin: '0 0 0.5rem' }}>电路编辑器</h2>
          <p style={{ color: 'var(--sil-text-soft)' }}>
            通用电路编辑模式 — 可绘制任意电路，运行 RLC 仿真
          </p>
          <p style={{ color: 'var(--sil-text-soft)', fontSize: '0.85rem', marginTop: '1rem' }}>
            旧版电路编辑功能正在迁移中，敬请期待
          </p>
        </div>
      </div>
    </div>
  );
}
