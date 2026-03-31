/**
 * ChipSim — 主入口
 * 向导 → 选择芯片 → 输入工程名 → 进入仿真
 */

import { useState, useRef, useEffect } from 'react';
import { ThemeProvider } from './theme/ThemeProvider';
import { McuSimulator } from './pages/McuSimulator';
import { EditorPage } from './features/editor/EditorPage';
import { ChipSelector } from './components/ChipSelector';
import { SetupWizard } from './components/SetupWizard/SetupWizard';
import { CIRCUIT_TEMPLATES } from './canvas/WebGLCanvas';
import { ThemeSwitcher } from './theme/switcher';
import './App.css';

type AppTab = 'mcu' | 'circuit';

function AppShell() {
  const [inProject, setInProject] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDir, setProjectDir] = useState('');
  const [tab, setTab] = useState<AppTab>('mcu');
  const [chip, setChip] = useState({ family: 'C51', model: 'AT89C51' });
  const [loadTemplateId, setLoadTemplateId] = useState<string | null>(null);
  const [tplDropdownOpen, setTplDropdownOpen] = useState(false);
  const [importedFiles, setImportedFiles] = useState<Array<{ path: string; content: string; lang: string }> | null>(null);
  const tplDropdownRef = useRef<HTMLDivElement>(null);

  const handleWizardComplete = (result: { family: string; model: string; projectName: string; projectDir: string; importedFiles?: Array<{ path: string; content: string; lang: string }> }) => {
    setChip({ family: result.family, model: result.model });
    setProjectName(result.projectName);
    setProjectDir(result.projectDir);
    setImportedFiles(result.importedFiles || null);
    setInProject(true);
  };

  const handleNewProject = () => {
    setInProject(false);
    setLoadTemplateId(null);
    setImportedFiles(null);
  };

  const handleLoadTemplate = (id: string) => {
    if (id === 'full-dev-board') {
      setChip({ family: 'STM32', model: 'stm32f103c8t6' });
    }
    setLoadTemplateId(id);
    setTplDropdownOpen(false);
  };

  // 点击外部关闭下拉
  useEffect(() => {
    if (!tplDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (tplDropdownRef.current && !tplDropdownRef.current.contains(e.target as Node)) {
        setTplDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [tplDropdownOpen]);

  // 未进入工程 → 显示向导
  if (!inProject) {
    return (
      <ThemeProvider>
        <SetupWizard onComplete={handleWizardComplete} />
      </ThemeProvider>
    );
  }

  const activeTemplate = CIRCUIT_TEMPLATES.find(t => t.id === loadTemplateId);

  return (
    <div className="sil-app">
      <header className="sil-topbar">
        <div className="sil-topbar-left">
          <span className="sil-logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </span>
          <h1 className="sil-title">ChipSim</h1>
          <span style={{ color: 'var(--sil-text-soft)', fontSize: 11, marginLeft: 4 }}>
            {projectName}
          </span>
          <button
            className="sil-app-tab"
            style={{ padding: '2px 8px', fontSize: 10, color: 'var(--sil-text-soft)', marginLeft: 4 }}
            onClick={handleNewProject}
            title="新建工程"
          >
            + 新建
          </button>
        </div>
        <div className="sil-topbar-center">
          {tab === 'mcu' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ChipSelector onChipSelected={(f, m) => setChip({ family: f, model: m })} />
              <span style={{ color: 'var(--sil-text-soft)', fontSize: 12 }}>|</span>
              {/* 电路模板下拉选择 */}
              <div ref={tplDropdownRef} style={{ position: 'relative' }}>
                <button
                  className="sil-app-tab"
                  style={{
                    padding: '3px 12px', fontSize: 11, fontWeight: 600,
                    background: activeTemplate ? 'var(--sil-accent-soft, #dbeafe)' : 'transparent',
                    color: activeTemplate ? 'var(--sil-accent, #0969da)' : 'var(--sil-text-soft)',
                    border: `1px solid ${activeTemplate ? 'var(--sil-accent, #0969da)' : 'var(--sil-border, #d0d7de)'}`,
                    borderRadius: 6, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                  onClick={() => setTplDropdownOpen(prev => !prev)}
                >
                  <span>📋</span>
                  <span>{activeTemplate ? activeTemplate.name : '电路模板'}</span>
                  <span style={{ fontSize: 8, opacity: 0.6 }}>{tplDropdownOpen ? '▲' : '▼'}</span>
                </button>
                {tplDropdownOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, marginTop: 4,
                    minWidth: 180, background: 'var(--sil-surface-raised, #edf3f7)',
                    borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    border: '1px solid var(--sil-border, #d0d7de)',
                    zIndex: 100, overflow: 'hidden',
                    animation: 'fadeIn 0.12s ease',
                  }}>
                    {CIRCUIT_TEMPLATES.map(tpl => (
                      <button key={tpl.id}
                        style={{
                          display: 'block', width: '100%', padding: '8px 14px',
                          border: 'none', background: loadTemplateId === tpl.id ? 'var(--sil-accent-soft, #dbeafe)' : 'transparent',
                          color: loadTemplateId === tpl.id ? 'var(--sil-accent, #0969da)' : 'var(--sil-text-main)',
                          fontSize: 12, fontWeight: loadTemplateId === tpl.id ? 700 : 500,
                          textAlign: 'left', cursor: 'pointer',
                          borderBottom: '1px solid var(--sil-border, #d0d7de)',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => (e.target as HTMLElement).style.background = 'var(--sil-surface-muted, #e6edf2)'}
                        onMouseLeave={e => (e.target as HTMLElement).style.background = loadTemplateId === tpl.id ? 'var(--sil-accent-soft, #dbeafe)' : 'transparent'}
                        onClick={() => handleLoadTemplate(tpl.id)}
                      >
                        {loadTemplateId === tpl.id && '✓ '}{tpl.name}
                      </button>
                    ))}
                    <button
                      style={{
                        display: 'block', width: '100%', padding: '8px 14px',
                        border: 'none', background: 'transparent',
                        color: 'var(--sil-text-soft)', fontSize: 12, fontWeight: 500,
                        textAlign: 'left', cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => (e.target as HTMLElement).style.background = 'var(--sil-surface-muted, #e6edf2)'}
                      onMouseLeave={e => (e.target as HTMLElement).style.background = 'transparent'}
                      onClick={() => handleLoadTemplate('__clear__')}
                    >
                      🗑️ 清空画布
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="sil-topbar-right">
          <div className="sil-app-tabs">
            <button className={`sil-app-tab ${tab === 'mcu' ? 'active' : ''}`} onClick={() => setTab('mcu')}>
              MCU 仿真
            </button>
            <button className={`sil-app-tab ${tab === 'circuit' ? 'active' : ''}`} onClick={() => setTab('circuit')}>
              电路编辑
            </button>
          </div>
          <ThemeSwitcher />
        </div>
      </header>

      <div className="sil-tab-content">
        {tab === 'mcu' ? <McuSimulator chipFamily={chip.family} chipModel={chip.model} loadTemplateId={loadTemplateId} importedFiles={importedFiles} /> : <EditorPage />}
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}

export default App;
