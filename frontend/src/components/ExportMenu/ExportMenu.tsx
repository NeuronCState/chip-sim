/**
 * 项目导出下拉菜单
 * 支持导出 PNG、导出项目 JSON、导出模板、导入项目
 * 使用 Portal 渲染下拉菜单，避免被父容器 overflow:hidden 裁剪
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useCircuitStore } from '../../stores/circuit-store';
import './ExportMenu.css';

export function ExportMenu() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const exportProject = useCircuitStore((s) => s.exportProject);
  const importProject = useCircuitStore((s) => s.importProject);
  const saveAsTemplate = useCircuitStore((s) => s.saveAsTemplate);

  // 计算下拉位置
  const updatePos = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
  }, []);

  const handleToggle = useCallback(() => {
    if (!open) updatePos();
    setOpen((v) => !v);
  }, [open, updatePos]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  /** 导出画布为 PNG */
  const handleExportPng = useCallback(() => {
    setOpen(false);
    const canvas = document.querySelector('#main-canvas canvas') as HTMLCanvasElement | null;
    if (!canvas) {
      alert('未找到画布元素，无法导出 PNG');
      return;
    }
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `circuit-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }, []);

  /** 导出项目为 JSON */
  const handleExportProject = useCallback(() => {
    setOpen(false);
    const name = prompt('请输入项目名称:', `project-${new Date().toLocaleDateString()}`);
    if (!name) return;
    exportProject(name);
  }, [exportProject]);

  /** 导出为模板 */
  const handleExportTemplate = useCallback(() => {
    setOpen(false);
    const name = prompt('请输入模板名称:');
    if (!name) return;
    const desc = prompt('请输入模板描述（可选）:') || '';
    saveAsTemplate(name, desc);
  }, [saveAsTemplate]);

  /** 导入项目 JSON */
  const handleImportProject = useCallback(() => {
    setOpen(false);
    importProject();
  }, [importProject]);

  return (
    <div className="export-menu">
      <button
        ref={btnRef}
        className="mcu-btn-sm"
        onClick={handleToggle}
        title="导出/导入"
      >
        导出 ▾
      </button>
      {open && createPortal(
        <div
          ref={dropdownRef}
          className="export-menu-dropdown"
          style={{
            position: 'fixed',
            top: pos.top,
            right: pos.right,
          }}
        >
          <button className="export-menu-item" onClick={handleExportPng}>
            <span>导出电路图 PNG</span>
          </button>
          <button className="export-menu-item" onClick={handleExportProject}>
            <span>导出项目 JSON</span>
          </button>
          <button className="export-menu-item" onClick={handleExportTemplate}>
            <span>导出电路模板</span>
          </button>
          <div className="export-menu-divider" />
          <button className="export-menu-item" onClick={handleImportProject}>
            <span>导入项目</span>
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
