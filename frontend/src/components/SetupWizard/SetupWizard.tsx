/**
 * SetupWizard — 多阶段项目创建引导
 * 阶段1：选择芯片系列
 * 阶段2：选择芯片型号
 * 阶段3：输入工程名称 + 选择保存路径
 * 底部：打开已有文件夹
 */

import { useState, useMemo } from 'react';
import { pickProjectDirectory, pickExistingProjectFolder, readCodeFilesFromDirectory, isFileSystemSupported } from '../../utils/fileSystem';
import './SetupWizard.css';

// ─── 芯片数据（与 ChipSelector 保持一致）───

const CHIP_FAMILIES = [
  {
    id: 'C51', label: '51 系列', icon: '🔧',
    desc: '经典 8051 内核单片机',
    models: [
      { value: 'at89c51', label: 'AT89C51' },
      { value: 'at89s52', label: 'AT89S52' },
      { value: 'stc89c52rc', label: 'STC89C52' },
      { value: 'stc12c5a60s2', label: 'STC12C5A60S2' },
      { value: 'stc15w4k', label: 'STC15W4K' },
    ],
  },
  {
    id: 'STM32', label: 'STM32', icon: '⚡',
    desc: 'ARM Cortex-M 系列',
    models: [
      { value: 'stm32f103c8t6', label: 'STM32F103C8 (Blue Pill)' },
      { value: 'stm32f407vgt6', label: 'STM32F407VG' },
      { value: 'stm32f411ceu6', label: 'STM32F411CE (Black Pill)' },
      { value: 'stm32h743vit6', label: 'STM32H743VI' },
      { value: 'stm32g431cbt6', label: 'STM32G431CB' },
    ],
  },
  {
    id: 'ESP32', label: 'ESP32', icon: '📡',
    desc: 'Wi-Fi + 蓝牙 SoC',
    models: [
      { value: 'esp32-wroom-32', label: 'ESP32-WROOM-32' },
      { value: 'esp32-s3', label: 'ESP32-S3' },
      { value: 'esp32-c3', label: 'ESP32-C3' },
      { value: 'esp8266', label: 'ESP8266' },
    ],
  },
  {
    id: 'Arduino', label: 'Arduino', icon: '🟢',
    desc: '开源硬件平台',
    models: [
      { value: 'uno', label: 'Arduino Uno' },
      { value: 'mega', label: 'Arduino Mega' },
      { value: 'nano', label: 'Arduino Nano' },
      { value: 'leonardo', label: 'Arduino Leonardo' },
      { value: 'due', label: 'Arduino Due' },
    ],
  },
];

export interface WizardResult {
  family: string;
  model: string;
  projectName: string;
  projectDir: string;
  importedFiles?: Array<{ path: string; content: string; lang: string }>;
}

interface Props {
  onComplete: (result: WizardResult) => void;
}

type Step = 'chip-family' | 'chip-model' | 'project-info';

export function SetupWizard({ onComplete }: Props) {
  const [step, setStep] = useState<Step>('chip-family');
  const [selectedFamily, setSelectedFamily] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectDir, setProjectDir] = useState('');
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [importedFiles, setImportedFiles] = useState<Array<{ path: string; content: string; lang: string }>>([]);
  const [importing, setImporting] = useState(false);

  const familyData = useMemo(() => CHIP_FAMILIES.find(f => f.id === selectedFamily), [selectedFamily]);
  const fsSupported = isFileSystemSupported();

  const handleSelectFamily = (familyId: string) => {
    setSelectedFamily(familyId);
    setSelectedModel('');
    setStep('chip-model');
  };

  const handleSelectModel = (model: string) => {
    setSelectedModel(model);
    setStep('project-info');
  };

  const handlePickDir = async () => {
    const handle = await pickProjectDirectory();
    if (handle) {
      setDirHandle(handle);
      setProjectDir(handle.name);
    }
  };

  const handleConfirm = async () => {
    const name = projectName.trim() || `${selectedFamily} 项目`;
    const dir = projectDir.trim() || '未选择路径';

    // 如果选择了目录，尝试写入项目标记文件
    if (dirHandle) {
      try {
        const { writeFileToDirectory } = await import('../../utils/fileSystem');
        await writeFileToDirectory(dirHandle, '.chipsim.json', JSON.stringify({
          name,
          chipFamily: selectedFamily,
          chipModel: selectedModel,
          version: '2.0.0',
          createdAt: new Date().toISOString(),
        }, null, 2));
      } catch { /* 写入失败不阻塞 */ }
    }

    onComplete({
      family: selectedFamily,
      model: selectedModel,
      projectName: name,
      projectDir: dir,
    });
  };

  /** 打开已有文件夹并导入代码 */
  const handleOpenFolder = async () => {
    setImporting(true);
    try {
      const handle = await pickExistingProjectFolder();
      if (!handle) { setImporting(false); return; }

      const files = await readCodeFilesFromDirectory(handle);
      if (files.length === 0) {
        alert('该文件夹中没有找到代码文件（.c/.h/.cpp/.ino）');
        setImporting(false);
        return;
      }

      // 尝试读取 .chipsim.json 获取项目配置
      let family = 'STM32';
      let model = 'stm32f103c8t6';
      let name = handle.name;
      try {
        const configEntry = await (handle as any).getFileHandle('.chipsim.json');
        const configFile = await configEntry.getFile();
        const config = JSON.parse(await configFile.text());
        if (config.chipFamily) family = config.chipFamily;
        if (config.chipModel) model = config.chipModel;
        if (config.name) name = config.name;
      } catch { /* 没有配置文件，用默认值 */ }

      onComplete({
        family,
        model,
        projectName: name,
        projectDir: handle.name,
        importedFiles: files,
      });
    } catch {
      /* 用户取消 */
    }
    setImporting(false);
  };

  const handleBack = () => {
    if (step === 'chip-model') {
      setStep('chip-family');
      setSelectedFamily('');
    } else if (step === 'project-info') {
      setStep('chip-model');
      setSelectedModel('');
    }
  };

  return (
    <div className="wizard-overlay">
      <div className="wizard-card">
        {/* 进度指示 */}
        <div className="wizard-steps">
          <div className={`wizard-step-dot ${step === 'chip-family' ? 'active' : 'done'}`}>1</div>
          <div className={`wizard-step-line ${step !== 'chip-family' ? 'done' : ''}`} />
          <div className={`wizard-step-dot ${step === 'chip-model' ? 'active' : step === 'project-info' ? 'done' : ''}`}>2</div>
          <div className={`wizard-step-line ${step === 'project-info' ? 'done' : ''}`} />
          <div className={`wizard-step-dot ${step === 'project-info' ? 'active' : ''}`}>3</div>
        </div>

        {/* 阶段 1：选择芯片系列 */}
        {step === 'chip-family' && (
          <div className="wizard-section">
            <h2 className="wizard-title">选择芯片系列</h2>
            <p className="wizard-desc">选择你想要仿真的单片机平台</p>
            <div className="wizard-family-grid">
              {CHIP_FAMILIES.map(f => (
                <button
                  key={f.id}
                  className={`wizard-family-card ${selectedFamily === f.id ? 'selected' : ''}`}
                  onClick={() => handleSelectFamily(f.id)}
                >
                  <span className="wizard-family-icon">{f.icon}</span>
                  <span className="wizard-family-label">{f.label}</span>
                  <span className="wizard-family-desc">{f.desc}</span>
                  <span className="wizard-family-count">{f.models.length} 款</span>
                </button>
              ))}
            </div>

            {/* 底部：打开已有文件夹 */}
            <div className="wizard-divider">
              <span>或</span>
            </div>
            <button
              className="wizard-open-folder-btn"
              onClick={handleOpenFolder}
              disabled={importing}
            >
              📂 {importing ? '正在导入...' : '打开已有工程文件夹'}
            </button>
            {!fsSupported && (
              <p className="wizard-hint">⚠ 当前浏览器不支持文件夹访问，请使用桌面版</p>
            )}
          </div>
        )}

        {/* 阶段 2：选择芯片型号 */}
        {step === 'chip-model' && familyData && (
          <div className="wizard-section">
            <h2 className="wizard-title">
              <button className="wizard-back-btn" onClick={handleBack}>←</button>
              {familyData.icon} {familyData.label} — 选择型号
            </h2>
            <p className="wizard-desc">{familyData.desc}</p>
            <div className="wizard-model-list">
              {familyData.models.map(m => (
                <button
                  key={m.value}
                  className={`wizard-model-item ${selectedModel === m.value ? 'selected' : ''}`}
                  onClick={() => handleSelectModel(m.value)}
                >
                  <span className="wizard-model-icon">🔲</span>
                  <span className="wizard-model-label">{m.label}</span>
                  <span className="wizard-model-value">{m.value}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 阶段 3：工程名称 + 路径 */}
        {step === 'project-info' && (
          <div className="wizard-section">
            <h2 className="wizard-title">
              <button className="wizard-back-btn" onClick={handleBack}>←</button>
              创建工程
            </h2>
            <p className="wizard-desc">
              芯片：<strong>{familyData?.models.find(m => m.value === selectedModel)?.label}</strong>
            </p>

            <div className="wizard-name-input-wrap">
              <label className="wizard-name-label">工程名称</label>
              <input
                className="wizard-name-input"
                type="text"
                placeholder="例如：LED闪烁实验"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                autoFocus
              />
            </div>

            <div className="wizard-name-input-wrap">
              <label className="wizard-name-label">保存位置</label>
              <div className="wizard-path-row">
                <input
                  className="wizard-name-input"
                  type="text"
                  placeholder="点击右侧按钮选择文件夹..."
                  value={projectDir}
                  onChange={e => setProjectDir(e.target.value)}
                  readOnly={!!dirHandle}
                  style={{ flex: 1 }}
                />
                <button className="wizard-browse-btn" onClick={handlePickDir}>
                  📁 浏览
                </button>
              </div>
              {!fsSupported && (
                <p className="wizard-hint">⚠ 当前浏览器不支持选择文件夹，可手动输入路径</p>
              )}
            </div>

            <button className="wizard-confirm-btn" onClick={handleConfirm}>
              🚀 进入仿真
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
