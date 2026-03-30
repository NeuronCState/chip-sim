/**
 * TabBar - 多标签页组件
 * 支持标签页切换、关闭、拖拽排序、未保存更改指示
 */

import { useState, useRef, useCallback } from 'react';
import type { TabInfo } from '../../core/ProjectManager';
import './TabBar.css';

interface TabBarProps {
  tabs: TabInfo[];
  activeTabId: string | null;
  onSwitchTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  /** 打开项目列表 */
  onOpenProjectList: () => void;
}

export function TabBar({ tabs, activeTabId, onSwitchTab, onCloseTab, onReorder, onOpenProjectList }: TabBarProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);

  // 拖拽处理
  const handleDragStart = (index: number, e: React.DragEvent) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // 设置透明拖拽图像
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(img, 0, 0);
  };

  const handleDragOver = (index: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropIndex(index);
  };

  const handleDragEnd = () => {
    if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
      onReorder(dragIndex, dropIndex);
    }
    setDragIndex(null);
    setDropIndex(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // 关闭标签前确认未保存更改
  const handleCloseTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const tab = tabs.find((t) => t.id === id);
    if (tab?.hasUnsavedChanges) {
      if (!confirm(`"${tab.name}" 有未保存的更改，确定关闭吗？`)) return;
    }
    onCloseTab(id);
  };

  // 滚轮横向滚动
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (tabBarRef.current && e.deltaY !== 0) {
      tabBarRef.current.scrollLeft += e.deltaY;
    }
  }, []);

  if (tabs.length === 0) {
    return (
      <div className="tab-bar">
        <div className="tab-bar-empty">
          <button className="tab-new-btn" onClick={onOpenProjectList} title="打开项目">
            📁 打开项目
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-bar" ref={tabBarRef} onWheel={handleWheel}>
      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          className={`tab-item ${tab.id === activeTabId ? 'tab-active' : ''} ${dragIndex === index ? 'tab-dragging' : ''} ${dropIndex === index && dragIndex !== index ? 'tab-drop-target' : ''}`}
          onClick={() => onSwitchTab(tab.id)}
          draggable
          onDragStart={(e) => handleDragStart(index, e)}
          onDragOver={(e) => handleDragOver(index, e)}
          onDragEnd={handleDragEnd}
          onDrop={handleDrop}
          title={tab.name}
        >
          <span className="tab-name">
            {tab.hasUnsavedChanges && <span className="tab-unsaved">● </span>}
            {tab.name}
          </span>
          <button
            className="tab-close"
            onClick={(e) => handleCloseTab(tab.id, e)}
            title="关闭标签"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        className="tab-add-btn"
        onClick={onOpenProjectList}
        title="打开项目"
      >
        ＋
      </button>
    </div>
  );
}
