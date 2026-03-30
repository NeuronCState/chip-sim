/**
 * ChipSim — 主入口
 * 顶栏：ChipSim | [芯片选择器] | [MCU/电路 Tab] | [主题]
 */

import { useState } from 'react';
import { ThemeProvider } from './theme/ThemeProvider';
import { McuSimulator } from './pages/McuSimulator';
import { EditorPage } from './features/editor/EditorPage';
import { ChipSelector } from './components/ChipSelector';
import { CIRCUIT_TEMPLATES } from './canvas/WebGLCanvas';
import { ThemeSwitcher } from './theme/switcher';
import './App.css';

type AppTab = 'mcu' | 'circuit';

function AppShell() {
  const [tab, setTab] = useState<AppTab>('mcu');
  const [chip, setChip] = useState({ family: 'C51', model: 'AT89C51' });
  const [loadTemplateId, setLoadTemplateId] = useState<string | null>(null);
  const handleLoadTemplate = (id: string) => {
    setLoadTemplateId(null);
    if (id === 'full-dev-board') {
      setChip({ family: 'STM32', model: 'stm32f103c8t6' });
    }
    setTimeout(() => setLoadTemplateId(id), 50);
  };

  return (
    <div className="sil-app">
      <header className="sil-topbar">
        <div className="sil-topbar-left">
          <span className="sil-logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </span>
          <h1 className="sil-title">ChipSim</h1>
        </div>
        <div className="sil-topbar-center">
          {tab === 'mcu' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ChipSelector onChipSelected={(f, m) => setChip({ family: f, model: m })} />
              <span style={{ color: 'var(--sil-text-soft)', fontSize: 12 }}>|</span>
              {CIRCUIT_TEMPLATES.map(tpl => (
                <button key={tpl.id}
                  className="sil-app-tab"
                  style={{
                    padding: '3px 10px', fontSize: 11, fontWeight: 500,
                    background: loadTemplateId === tpl.id ? 'var(--sil-accent-soft, #dbeafe)' : 'transparent',
                    color: loadTemplateId === tpl.id ? 'var(--sil-accent, #0969da)' : 'var(--sil-text-soft)',
                    border: `1px solid ${loadTemplateId === tpl.id ? 'var(--sil-accent, #0969da)' : 'transparent'}`,
                  }}
                  onClick={() => handleLoadTemplate(tpl.id)}
                >
                  {tpl.name}
                </button>
              ))}
              <button className="sil-app-tab"
                style={{ padding: '3px 10px', fontSize: 11, color: 'var(--sil-text-soft)' }}
                onClick={() => handleLoadTemplate('__clear__')}>
                清空
              </button>
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
        {tab === 'mcu' ? <McuSimulator chipFamily={chip.family} chipModel={chip.model} loadTemplateId={loadTemplateId} /> : <EditorPage />}
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
