/**
 * 电路编辑器页面
 * 三栏布局 + 顶部工具栏 + 底部状态栏 + 主题切换
 * 响应式：侧边栏可折叠、底部 Tab 切换、工具栏溢出折叠
 */

import { useCallback, useEffect, useState } from 'react';
import { CircuitCanvas } from '../../components/CircuitCanvas';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { ComponentLibrary } from './ComponentLibrary';
import { PropertyPanel } from './PropertyPanel';
import { ValidationPanel } from './ValidationPanel';
import { DiagnosticsPanel } from '../../components/DiagnosticsPanel';
import { SimulatorControl } from '../simulator/SimulatorControl';
import { SimulationBridge } from '../simulator/SimulationBridge';
import { WaveformPanel } from '../waveform/WaveformPanel';
import { MeasurementPanel } from '../../components/MeasurementPanel';
import { ShortcutsHelp } from './ShortcutsHelp';
import { KeyboardTooltip } from '../../components/KeyboardTooltip';
import { TabBar } from '../../components/TabBar';
import { ProjectList } from '../../components/ProjectList';
import { QuickSwitcher } from '../../components/QuickSwitcher';
import { ProjectSettings } from '../../components/ProjectSettings';
import { useCircuitStore } from '../../stores/circuit-store';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useKeybindings } from '../../hooks/useKeybindings';
import { toast } from '../../stores/toast-store';
import { resetComponentCounters } from './ComponentLibrary';
import { projectManager, type TabInfo } from '../../core/ProjectManager';
import { WireRouting } from '../../types/circuit';
import { WelcomeTour, useTour, TutorialOverlay, TutorialProgress } from '../../components/Tutorial';
import { CircuitWizard } from '../../components/Wizard';
import { HelpPanel } from '../../components/HelpPanel';
import { PerfPanel } from '../../components/PerfPanel';
import { RoutingToolbar } from '../../components/RoutingToolbar';
import './EditorPage.css';

/** 响应式断点常量 */
const BREAKPOINTS = {
  large: 1200,
  medium: 900,
  small: 600,
} as const;

type ScreenSize = 'large' | 'medium' | 'small' | 'phone';

/** 根据窗口宽度判断屏幕尺寸 */
function getScreenSize(width: number): ScreenSize {
  if (width >= BREAKPOINTS.large) return 'large';
  if (width >= BREAKPOINTS.medium) return 'medium';
  if (width >= BREAKPOINTS.small) return 'small';
  return 'phone';
}

/** 底部 Tab 标签 */
type BottomTab = 'waveform' | 'measurement' | 'property' | 'validation' | 'diagnostics' | 'simulator';

const BOTTOM_TABS: { key: BottomTab; label: string; icon: string }[] = [
  { key: 'waveform', label: '波形', icon: '' },
  { key: 'measurement', label: '测量', icon: '' },
  { key: 'property', label: '属性', icon: '' },
  { key: 'diagnostics', label: '诊断', icon: '' },
  { key: 'validation', label: '验证', icon: '' },
  { key: 'simulator', label: '仿真控制', icon: '' },
];

/** WebSocket 连接状态指示器 */
function WSStatusIndicator() {
  const { state: wsState } = useWebSocket();

  const statusMap: Record<string, { label: string; className: string }> = {
    connected: { label: '已连接', className: 'ws-connected' },
    connecting: { label: '连接中', className: 'ws-connecting' },
    reconnecting: { label: '重连中', className: 'ws-reconnecting' },
    disconnected: { label: '未连接', className: 'ws-disconnected' },
  };

  const status = statusMap[wsState] ?? statusMap.disconnected;

  return (
    <span className={`status-item ws-status ${status.className}`} title={`WebSocket: ${wsState}`}>
      {status.label}
    </span>
  );
}

export function EditorPage() {
  // 激活全局快捷键系统
  useKeybindings();

  const wireRouting = useCircuitStore((s) => s.wireRouting);
  const setWireRouting = useCircuitStore((s) => s.setWireRouting);
  const snapToGrid = useCircuitStore((s) => s.snapToGrid);
  const setSnapToGrid = useCircuitStore((s) => s.setSnapToGrid);
  const showGrid = useCircuitStore((s) => s.showGrid);
  const setShowGrid = useCircuitStore((s) => s.setShowGrid);
  const theme = useCircuitStore((s) => s.theme);
  const toggleTheme = useCircuitStore((s) => s.toggleTheme);
  const undo = useCircuitStore((s) => s.undo);
  const redo = useCircuitStore((s) => s.redo);
  const undoStack = useCircuitStore((s) => s.undoStack);
  const redoStack = useCircuitStore((s) => s.redoStack);
  const fitToScreen = useCircuitStore((s) => s.fitToScreen);
  const loadRLCTestCircuit = useCircuitStore((s) => s.loadRLCTestCircuit);
  const viewTransform = useCircuitStore((s) => s.viewTransform);
  const mouseCanvasPos = useCircuitStore((s) => s.mouseCanvasPos);
  const isSimulating = useCircuitStore((s) => s.isSimulating);
  const simLoading = useCircuitStore((s) => s.simLoading);
  const bulkOperationLoading = useCircuitStore((s) => s.bulkOperationLoading);
  const bulkOperationMessage = useCircuitStore((s) => s.bulkOperationMessage);
  const components = useCircuitStore((s) => s.components);
  const wires = useCircuitStore((s) => s.wires);

  // ====== 响应式状态 ======
  const [screenSize, setScreenSize] = useState<ScreenSize>(getScreenSize(window.innerWidth));
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [bottomTab, setBottomTab] = useState<BottomTab>('waveform');
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  // ====== 多工程管理状态 ======
  const [showProjectList, setShowProjectList] = useState(false);
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [projectSettingsId, setProjectSettingsId] = useState<string | null>(null);
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);

  // ====== 新手引导 & 向导状态 ======
  const tour = useTour();
  const [showWizard, setShowWizard] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<'property' | 'help'>('property');
  const [showPerfPanel, setShowPerfPanel] = useState(false);

  // ====== 初始化 ProjectManager ======
  useEffect(() => {
    const getCircuitData = () => {
      const state = useCircuitStore.getState();
      return {
        components: state.components,
        nodes: state.nodes,
        wires: state.wires,
      };
    };

    const setCircuitData = (data: { components: typeof components; nodes: ReturnType<typeof useCircuitStore.getState>['nodes']; wires: typeof wires }) => {
      useCircuitStore.setState({
        components: data.components,
        nodes: data.nodes,
        wires: data.wires,
        selectedComponentId: null,
        selectedWireId: null,
        selectedComponentIds: new Set(),
        undoStack: [],
        redoStack: [],
      });
    };

    projectManager.init(
      getCircuitData,
      setCircuitData
    ).then(() => {
      setTabs(projectManager.getTabs());
      setActiveTabId(projectManager.getActiveTabId());
    });

    // 注册事件回调
    projectManager['events'] = {
      onProjectsChanged: () => {},
      onTabChanged: (newTabs, newActiveId) => {
        setTabs([...newTabs]);
        setActiveTabId(newActiveId);
      },
      onProjectLoaded: () => {},
      onAutoSaved: () => {
        toast.info('已自动保存', 1500);
      },
      onError: (error) => {
        toast.error(error);
      },
    };

    return () => {
      projectManager.destroy();
    };
  }, []);

  // 监听电路数据变化，标记为已修改
  useEffect(() => {
    const unsubscribe = useCircuitStore.subscribe(() => {
      projectManager.markAsModified();
    });
    return unsubscribe;
  }, []);

  // 监听窗口尺寸变化
  useEffect(() => {
    const handleResize = () => {
      const newSize = getScreenSize(window.innerWidth);
      setScreenSize(newSize);
      // 小屏幕自动折叠侧边栏
      if (newSize === 'small' || newSize === 'phone') {
        setLeftCollapsed(true);
        setRightCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isLarge = screenSize === 'large';
  const isMedium = screenSize === 'medium';
  const isSmall = screenSize === 'small';
  const isPhone = screenSize === 'phone';
  const isCompact = isSmall || isPhone;

  const handleExport = useCallback(() => {
    projectManager.exportProjectAsJson();
    toast.success('项目已导出');
  }, []);

  const handleImport = useCallback(async () => {
    try {
      // 通过文件选择器导入
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.chipsim,.json';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (file) {
          const count = await projectManager.importProjectFromFile(file);
          toast.success(`成功导入 ${count} 个项目`);
        }
      };
      input.click();
    } catch {
      toast.error('导入失败，请检查文件格式');
    }
  }, []);

  const handleNew = useCallback(() => {
    setShowProjectList(true);
  }, []);

  const handleLoadRLC = useCallback(() => {
    resetComponentCounters();
    loadRLCTestCircuit();
    toast.success('RLC 测试电路已加载');
  }, [loadRLCTestCircuit]);

  // 工具栏按钮点击外部关闭"更多"菜单
  useEffect(() => {
    if (!moreMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.toolbar-more-wrapper')) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [moreMenuOpen]);

  // Ctrl/Cmd + P 快速切换面板
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        setShowQuickSwitcher(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ====== 渲染底部面板内容 ======
  const renderBottomPanel = (tab: BottomTab) => {
    switch (tab) {
      case 'waveform':
        return <WaveformPanel />;
      case 'measurement':
        return <MeasurementPanel />;
      case 'property':
        return <PropertyPanel />;
      case 'diagnostics':
        return <DiagnosticsPanel />;
      case 'validation':
        return <ValidationPanel />;
      case 'simulator':
        return <SimulatorControl />;
    }
  };

  // ====== 折叠状态下左侧图标按钮 ======
  const renderCollapsedLeft = () => (
    <div className="collapsed-sidebar collapsed-left">
      <button className="collapsed-btn" onClick={() => setLeftCollapsed(false)} title="展开元件库">库</button>
      <button className="collapsed-btn" onClick={() => { setLeftCollapsed(false); setBottomTab('validation'); }} title="电路检查">检</button>
      <button className="collapsed-btn" onClick={() => { setLeftCollapsed(false); setBottomTab('simulator'); }} title="仿真控制">仿</button>
    </div>
  );

  // ====== 折叠状态下右侧图标按钮 ======
  const renderCollapsedRight = () => (
    <div className="collapsed-sidebar collapsed-right">
      <button className="collapsed-btn" onClick={() => { setRightCollapsed(false); setRightPanelTab('property'); }} title="展开属性">属</button>
      <button className="collapsed-btn" onClick={() => { setRightCollapsed(false); setRightPanelTab('help'); }} title="展开帮助">助</button>
    </div>
  );

  return (
    <div className={`editor-page theme-${theme}`} data-screen={screenSize}>
      {/* ====== 顶部工具栏 ====== */}
      <header className="top-toolbar">
        {/* 品牌 */}
        <span className="toolbar-brand">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign: 'middle', marginRight: 4}}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          ChipSim
        </span>
        <span className="toolbar-divider" />

        {/* 文件操作 — 始终显示 */}
        <div className="toolbar-section">
          <button className="tb-btn" onClick={handleNew} title="新建电路 (Ctrl+N)">新建</button>
          <button className="tb-btn" onClick={handleImport} title="导入电路">导入</button>
          <button className="tb-btn" onClick={handleExport} title="导出电路 (Ctrl+S)">导出</button>
        </div>

        {/* 工程管理 — 始终显示 */}
        <div className="toolbar-section">
          <span className="toolbar-divider" />
          <button 
            className="tb-btn tb-btn-project" 
            onClick={() => setShowProjectList(true)} 
            title="项目管理"
          >
            项目
            {projectManager.getCurrentProjectName() && (
              <span className="tb-project-name">: {projectManager.getCurrentProjectName()}</span>
            )}
          </button>
          {activeTabId && (
            <button 
              className="tb-btn" 
              onClick={() => {
                setProjectSettingsId(activeTabId);
                setShowProjectSettings(true);
              }} 
              title="项目设置"
            >
              设置
            </button>
          )}
          {activeTabId && (
            <button 
              className="tb-btn" 
              onClick={() => {
                projectManager.saveCurrentProject();
                toast.success('项目已保存');
              }} 
              title="保存当前项目 (Ctrl+S)"
            >
              保存
            </button>
          )}
        </div>

        {/* 编辑操作 — 大屏幕/中屏幕显示 */}
        {!isCompact && (
          <div className="toolbar-section">
            <span className="toolbar-divider" />
            <button className="tb-btn" onClick={undo} disabled={undoStack.length === 0} title="撤销 (Ctrl/Z)">撤销</button>
            <button className="tb-btn" onClick={redo} disabled={redoStack.length === 0} title="重做 (Ctrl+Y)">重做</button>
          </div>
        )}

        {/* 视图控制 — 大屏幕完整显示 */}
        {isLarge && (
          <div className="toolbar-section">
            <span className="toolbar-divider" />
            <button className="tb-btn" onClick={fitToScreen} title="适配屏幕 (F)">适配</button>
            <button className={`tb-btn ${showGrid ? 'tb-active' : ''}`} onClick={() => setShowGrid(!showGrid)} title="网格开关">网格</button>
            <label className="tb-label">
              <input type="checkbox" checked={snapToGrid} onChange={(e) => setSnapToGrid(e.target.checked)} />
              吸附
            </label>
            <div className="tb-routing">
              <button className={`tb-btn-sm ${wireRouting === WireRouting.Orthogonal ? 'tb-active' : ''}`} onClick={() => setWireRouting(WireRouting.Orthogonal)} title="直角连线">⌐</button>
              <button className={`tb-btn-sm ${wireRouting === WireRouting.Diagonal45 ? 'tb-active' : ''}`} onClick={() => setWireRouting(WireRouting.Diagonal45)} title="45度连线">╱</button>
              <button className={`tb-btn-sm ${wireRouting === WireRouting.Straight ? 'tb-active' : ''}`} onClick={() => setWireRouting(WireRouting.Straight)} title="直线连线">/</button>
            </div>
          </div>
        )}

        {/* 仿真 — 非手机显示 */}
        {!isPhone && (
          <div className="toolbar-section">
            <span className="toolbar-divider" />
            <button className="tb-btn tb-btn-test" onClick={handleLoadRLC} title="加载 RLC 串联谐振测试电路">RLC测试</button>
            <button className="tb-btn tb-btn-wizard" onClick={() => setShowWizard(true)} title="快速创建电路向导">快速创建</button>
          </div>
        )}

        {/* "更多"下拉菜单 — 非大屏幕显示 */}
        {!isLarge && (
          <div className="toolbar-section toolbar-more-wrapper">
            <span className="toolbar-divider" />
            <button className="tb-btn tb-btn-more" onClick={() => setMoreMenuOpen(!moreMenuOpen)} title="更多操作">
              ⋯ 更多 ▾
            </button>
            {moreMenuOpen && (
              <div className="toolbar-more-dropdown">
                {!isCompact && (
                  <>
                    <button className="tb-dropdown-item" onClick={() => { undo(); setMoreMenuOpen(false); }} disabled={undoStack.length === 0}>撤销</button>
                    <button className="tb-dropdown-item" onClick={() => { redo(); setMoreMenuOpen(false); }} disabled={redoStack.length === 0}>重做</button>
                    <div className="tb-dropdown-sep" />
                  </>
                )}
                <button className="tb-dropdown-item" onClick={() => { fitToScreen(); setMoreMenuOpen(false); }}>适配屏幕</button>
                <button className={`tb-dropdown-item ${showGrid ? 'tb-active' : ''}`} onClick={() => { setShowGrid(!showGrid); setMoreMenuOpen(false); }}>网格 {showGrid ? '关' : '开'}</button>
                <button className={`tb-dropdown-item ${snapToGrid ? 'tb-active' : ''}`} onClick={() => { setSnapToGrid(!snapToGrid); setMoreMenuOpen(false); }}>吸附 {snapToGrid ? '关' : '开'}</button>
                <div className="tb-dropdown-sep" />
                <button className={`tb-dropdown-item ${wireRouting === WireRouting.Orthogonal ? 'tb-active' : ''}`} onClick={() => { setWireRouting(WireRouting.Orthogonal); setMoreMenuOpen(false); }}>直角连线</button>
                <button className={`tb-dropdown-item ${wireRouting === WireRouting.Diagonal45 ? 'tb-active' : ''}`} onClick={() => { setWireRouting(WireRouting.Diagonal45); setMoreMenuOpen(false); }}>45度连线</button>
                <button className={`tb-dropdown-item ${wireRouting === WireRouting.Straight ? 'tb-active' : ''}`} onClick={() => { setWireRouting(WireRouting.Straight); setMoreMenuOpen(false); }}>直线连线</button>
                {isPhone && (
                  <>
                    <div className="tb-dropdown-sep" />
                    <button className="tb-dropdown-item tb-btn-test" onClick={() => { handleLoadRLC(); setMoreMenuOpen(false); }}>RLC测试</button>
                    <button className="tb-dropdown-item tb-btn-wizard" onClick={() => { setShowWizard(true); setMoreMenuOpen(false); }}>快速创建</button>
                    <button className="tb-dropdown-item" onClick={() => { undo(); setMoreMenuOpen(false); }} disabled={undoStack.length === 0}>撤销</button>
                    <button className="tb-dropdown-item" onClick={() => { redo(); setMoreMenuOpen(false); }} disabled={redoStack.length === 0}>重做</button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* 主题 + 快捷键 */}
        <div className="toolbar-section toolbar-right">
          <button className="tb-btn" onClick={() => useCircuitStore.getState().toggleShortcutsHelp()} title="快捷键帮助 (?)">快捷键</button>
          <button className="tb-btn tb-btn-theme" onClick={toggleTheme} title="切换主题">{theme === 'dark' ? '亮色' : '暗色'}</button>
        </div>
      </header>

      {/* ====== 标签页栏 ====== */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSwitchTab={(id) => projectManager.switchTab(id)}
        onCloseTab={(id) => projectManager.closeTab(id)}
        onReorder={(from, to) => projectManager.reorderTabs(from, to)}
        onOpenProjectList={() => setShowProjectList(true)}
      />

      {/* ====== 智能布线工具栏 ====== */}
      <RoutingToolbar />

      {/* ====== 主体三栏 ====== */}
      <div className="editor-body">
        {(!isCompact || !leftCollapsed) && (
          <aside className={`editor-left ${leftCollapsed ? 'collapsed' : ''}`}>
            <div className="panel-header">
              <span className="panel-header-title">面板</span>
              <button className="panel-collapse-btn" onClick={() => setLeftCollapsed(true)} title="收起左侧面板">◀</button>
            </div>
            <ComponentLibrary />
            {!isPhone && <DiagnosticsPanel />}
            {!isPhone && <ValidationPanel />}
            {!isPhone && <SimulatorControl />}
          </aside>
        )}
        {leftCollapsed && renderCollapsedLeft()}

        <main className="editor-center">
          <div className="editor-canvas-area">
            <ErrorBoundary>
              <CircuitCanvas />
            </ErrorBoundary>
            {(simLoading || bulkOperationLoading) && (
              <div className="loading-overlay">
                <div className="loading-spinner" />
                <span className="loading-text">
                  {bulkOperationLoading
                    ? (bulkOperationMessage || '处理中...')
                    : isSimulating
                      ? '仿真运行中...'
                      : '加载中...'}
                </span>
              </div>
            )}
          </div>

          {isLarge && <WaveformPanel />}

          {(isMedium || isCompact) && (
            <div className="bottom-tabs-container">
              <div className="bottom-tabs-bar">
                {BOTTOM_TABS.map(tab => (
                  <button
                    key={tab.key}
                    className={`bottom-tab-btn ${bottomTab === tab.key ? 'bottom-tab-active' : ''}`}
                    onClick={() => setBottomTab(tab.key)}
                  >
                    <span className="tab-icon">{tab.icon}</span>
                    <span className="tab-label">{tab.label}</span>
                  </button>
                ))}
              </div>
              <div className="bottom-tab-content">
                {renderBottomPanel(bottomTab)}
              </div>
            </div>
          )}
        </main>

        {(!isCompact) && (
          <>
            {rightCollapsed ? renderCollapsedRight() : (
              <aside className="editor-right">
                <div className="panel-header">
                  <button className="panel-collapse-btn" onClick={() => setRightCollapsed(true)} title="收起右侧面板">▶</button>
                  <div className="panel-header-tabs">
                    <button
                      className={`panel-tab-btn ${rightPanelTab === 'property' ? 'panel-tab-active' : ''}`}
                      onClick={() => setRightPanelTab('property')}
                    >
                      属性
                    </button>
                    <button
                      className={`panel-tab-btn ${rightPanelTab === 'help' ? 'panel-tab-active' : ''}`}
                      onClick={() => setRightPanelTab('help')}
                    >
                      帮助
                    </button>
                  </div>
                </div>
                {rightPanelTab === 'property' ? <PropertyPanel /> : <HelpPanel />}
              </aside>
            )}
          </>
        )}
        {isCompact && rightCollapsed && renderCollapsedRight()}
      </div>

      {/* ====== 底部状态栏 ====== */}
      <footer className="status-bar">
        <span className="status-item">
          ({Math.round(mouseCanvasPos.x)}, {Math.round(mouseCanvasPos.y)})
        </span>
        {!isPhone && (
          <span className="status-item">
            {(viewTransform.scale * 100).toFixed(0)}%
          </span>
        )}
        <span className="status-item">
          {components.length} 元件 | {wires.length} 连线
        </span>
        <WSStatusIndicator />
        <span className="status-item status-right">
          <button
            className="tb-btn tb-btn-sm"
            onClick={() => setShowPerfPanel(!showPerfPanel)}
            title="性能监控面板"
            style={{ padding: '2px 6px', fontSize: '11px' }}
          >
            性能
          </button>
          {isSimulating ? '仿真运行中...' : '就绪'}
        </span>
      </footer>

      <SimulationBridge />
      <ShortcutsHelp />
      <KeyboardTooltip />
      <QuickSwitcher
        isOpen={showQuickSwitcher}
        onClose={() => setShowQuickSwitcher(false)}
        onProjectOpened={(id) => {
          setTabs(projectManager.getTabs());
          setActiveTabId(id);
        }}
        currentProjectId={activeTabId}
      />

      {/* ====== 项目管理对话框 ====== */}
      <ProjectList
        isOpen={showProjectList}
        onClose={() => setShowProjectList(false)}
        onProjectOpened={(id) => {
          setTabs(projectManager.getTabs());
          setActiveTabId(id);
        }}
      />

      {projectSettingsId && (
        <ProjectSettings
          isOpen={showProjectSettings}
          onClose={() => {
            setShowProjectSettings(false);
            setProjectSettingsId(null);
            // 刷新标签名
            setTabs([...projectManager.getTabs()]);
          }}
          projectId={projectSettingsId}
        />
      )}

      {/* ====== 新手引导 ====== */}
      <WelcomeTour
        isActive={tour.isActive}
        currentStep={tour.currentStep}
        onNext={tour.nextStep}
        onPrev={tour.prevStep}
        onSkip={tour.skipTour}
        onFinish={tour.finishTour}
      />

      {/* ====== 交互式教程系统 ====== */}
      <TutorialOverlay />
      <TutorialProgress />

      {/* ====== 电路搭建向导 ====== */}
      <CircuitWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
      />

      {/* ====== 性能监控面板 ====== */}
      <PerfPanel
        visible={showPerfPanel}
        componentCount={components.length}
        nodeCount={useCircuitStore.getState().nodes.length}
        wireCount={wires.length}
      />
    </div>
  );
}
