/**
 * SetupWizard — 多阶段项目创建引导
 * 阶段1：选择芯片系列和型号
 * 阶段2：输入工程名称
 * 阶段3：进入仿真（可选加载模板）
 */

import { useState, useMemo } from 'react';
import './SetupWizard.css';

// ─── 芯片数据 ──────────────────────────────

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
    ],
  },
  {
    id: 'AVR', label: 'AVR', icon: '🔴',
    desc: 'Atmel 8 位 MCU',
    models: [
      { value: 'atmega328p', label: 'ATmega328P' },
      { value: 'atmega2560', label: 'ATmega2560' },
      { value: 'attiny85', label: 'ATtiny85' },
    ],
  },
  {
    id: 'RISC-V', label: 'RISC-V', icon: '🟣',
    desc: '开源指令集架构',
    models: [
      { value: 'ch32v', label: 'CH32V' },
      { value: 'gd32vf103', label: 'GD32VF103' },
      { value: 'bl602', label: 'BL602' },
    ],
  },
];

interface WizardResult {
  family: string;
  model: string;
  projectName: string;
}

interface Props {
  onComplete: (result: WizardResult) => void;
}

type Step = 'chip-family' | 'chip-model' | 'project-name';

export function SetupWizard({ onComplete }: Props) {
  const [step, setStep] = useState<Step>('chip-family');
  const [selectedFamily, setSelectedFamily] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [projectName, setProjectName] = useState('');

  const familyData = useMemo(
    () => CHIP_FAMILIES.find(f => f.id === selectedFamily),
    [selectedFamily]
  );

  const handleSelectFamily = (familyId: string) => {
    setSelectedFamily(familyId);
    setSelectedModel('');
    setStep('chip-model');
  };

  const handleSelectModel = (model: string) => {
    setSelectedModel(model);
    setStep('project-name');
  };

  const handleConfirm = () => {
    const name = projectName.trim() || `${selectedFamily} 项目`;
    onComplete({ family: selectedFamily, model: selectedModel, projectName: name });
  };

  const handleBack = () => {
    if (step === 'chip-model') {
      setStep('chip-family');
      setSelectedFamily('');
    } else if (step === 'project-name') {
      setStep('chip-model');
      setSelectedModel('');
    }
  };

  return (
    <div className="wizard-overlay">
      <div className="wizard-card">
        {/* 进度指示 */}
        <div className="wizard-steps">
          <div className={`wizard-step-dot ${step === 'chip-family' ? 'active' : step !== 'chip-family' ? 'done' : ''}`}>1</div>
          <div className={`wizard-step-line ${step !== 'chip-family' ? 'done' : ''}`} />
          <div className={`wizard-step-dot ${step === 'chip-model' ? 'active' : step === 'project-name' ? 'done' : ''}`}>2</div>
          <div className={`wizard-step-line ${step === 'project-name' ? 'done' : ''}`} />
          <div className={`wizard-step-dot ${step === 'project-name' ? 'active' : ''}`}>3</div>
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

        {/* 阶段 3：输入工程名称 */}
        {step === 'project-name' && (
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
            <button className="wizard-confirm-btn" onClick={handleConfirm}>
              🚀 进入仿真
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
