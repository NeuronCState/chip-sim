/**
 * SPICE 网表预览弹窗
 * 显示生成的网表、提供复制和下载功能
 */

import { useState, useCallback } from 'react';

interface SpicePreviewProps {
  netlist: string;
  filename: string;
  onClose: () => void;
}

export function SpicePreview({ netlist, filename, onClose }: SpicePreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(netlist);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = netlist;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [netlist]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([netlist], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename || 'circuit'}.cir`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [netlist, filename]);

  return (
    <div className="spice-overlay" onClick={onClose}>
      <div className="spice-modal" onClick={(e) => e.stopPropagation()}>
        <div className="spice-header">
          <h3>📄 SPICE 网表预览</h3>
          <button className="spice-close" onClick={onClose}>✕</button>
        </div>
        <pre className="spice-code">{netlist}</pre>
        <div className="spice-actions">
          <button className="spice-btn" onClick={handleCopy}>
            {copied ? '✅ 已复制' : '📋 复制到剪贴板'}
          </button>
          <button className="spice-btn" onClick={handleDownload}>
            💾 下载 .cir 文件
          </button>
          <button className="spice-btn spice-btn-secondary" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>

      <style>{`
        .spice-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .spice-modal {
          background: var(--bg-panel, #16162a);
          border: 1px solid var(--border, #2a2a4a);
          border-radius: 8px;
          width: 560px;
          max-width: 90vw;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        .spice-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border, #2a2a4a);
        }
        .spice-header h3 {
          margin: 0;
          font-size: 14px;
          color: var(--text, #e0e0e0);
        }
        .spice-close {
          background: none;
          border: none;
          color: var(--text-dim, #888);
          font-size: 16px;
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .spice-close:hover {
          background: var(--bg-input, #1a1a2e);
          color: var(--text, #e0e0e0);
        }
        .spice-code {
          flex: 1;
          overflow: auto;
          margin: 0;
          padding: 16px;
          font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
          font-size: 12px;
          line-height: 1.6;
          color: var(--success, #4ecdc4);
          background: var(--bg-app, #0d0d1a);
          white-space: pre;
        }
        .spice-actions {
          display: flex;
          gap: 8px;
          padding: 12px 16px;
          border-top: 1px solid var(--border, #2a2a4a);
        }
        .spice-btn {
          padding: 6px 14px;
          background: var(--accent, #0066cc);
          color: #fff;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: background 0.15s;
        }
        .spice-btn:hover {
          background: var(--accent-hover, #0088ff);
        }
        .spice-btn-secondary {
          background: transparent;
          color: var(--text-dim, #888);
          border: 1px solid var(--border, #2a2a4a);
        }
        .spice-btn-secondary:hover {
          background: var(--bg-input, #1a1a2e);
          color: var(--text, #e0e0e0);
        }
      `}</style>
    </div>
  );
}
