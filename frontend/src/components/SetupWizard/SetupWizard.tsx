/**
 * SetupWizard — 多阶段项目创建引导
 * 阶段1：选择芯片系列
 * 阶段2：选择芯片型号
 * 阶段3：输入工程名称 + 选择保存路径
 * 底部：打开已有文件夹
 */

import { useState, useMemo } from 'react';
import { pickProjectDirectory, pickExistingProjectFolder, writeFileToDirectory, isFileSystemSupported } from '../../utils/fileSystem';

// ─── 工程初始化模板 ───────────────────────

function getMainTemplate(family: string, model: string): string {
  const f = family.toLowerCase();
  if (f === 'stm32') {
    return `#include "stm32f1xx_hal.h"

void SystemClock_Config(void);

int main(void) {
  HAL_Init();
  SystemClock_Config();

  // PA5 LED 输出
  __HAL_RCC_GPIOA_CLK_ENABLE();
  GPIO_InitTypeDef gpio = {GPIO_PIN_5, GPIO_MODE_OUTPUT_PP, GPIO_NOPULL, GPIO_SPEED_FREQ_LOW};
  HAL_GPIO_Init(GPIOA, &gpio);

  while (1) {
    HAL_GPIO_TogglePin(GPIOA, GPIO_PIN_5);
    HAL_Delay(500);
  }
}
`;
  }
  if (f === 'esp32') {
    return `#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"

#define LED_PIN GPIO_NUM_2

void app_main(void) {
  gpio_reset_pin(LED_PIN);
  gpio_set_direction(LED_PIN, GPIO_MODE_OUTPUT);

  int level = 0;
  while (1) {
    gpio_set_level(LED_PIN, level);
    level = !level;
    vTaskDelay(500 / portTICK_PERIOD_MS);
  }
}
`;
  }
  if (f === 'arduino') {
    return `// Arduino 项目
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  delay(500);
}
`;
  }
  // C51 / 默认
  return `#include <reg52.h>

sbit LED = P1^0;

void delay(unsigned int ms) {
  unsigned int i, j;
  for (i = 0; i < ms; i++)
    for (j = 0; j < 120; j++);
}

void main(void) {
  while (1) {
    LED = 0;
    delay(500);
    LED = 1;
    delay(500);
  }
}
`;
}

function getMakefileContent(family: string, model: string): string {
  const f = family.toLowerCase();
  if (f === 'stm32') {
    return `# ${model} 项目 Makefile
TARGET = firmware
CC = arm-none-eabi-gcc
CFLAGS = -mcpu=cortex-m3 -mthumb -Os -Wall -I./include
LDFLAGS = -T linker.ld -nostartfiles

SRC = $(wildcard src/*.c)
OBJ = $(SRC:.c=.o)

all: \$(TARGET).elf

\$(TARGET).elf: \$(OBJ)
	\$(CC) \$(CFLAGS) \$(LDFLAGS) -o \$@ \$^

%.o: %.c
	\$(CC) \$(CFLAGS) -c \$< -o \$@

clean:
	rm -f \$(OBJ) \$(TARGET).elf

.PHONY: all clean
`;
  }
  if (f === 'esp32') {
    return `# ${model} 项目
# 使用 ESP-IDF 编译
# idf.py build
# idf.py flash monitor
`;
  }
  return `# ${model} 项目 Makefile
# 请根据你的工具链配置
CC = gcc
CFLAGS = -Wall -Os -I./include
SRC = \$(wildcard src/*.c)
TARGET = firmware

all: \$(TARGET)

\$(TARGET): \$(SRC)
	\$(CC) \$(CFLAGS) -o \$@ \$^

clean:
	rm -f \$(TARGET)

.PHONY: all clean
`;
}
import './SetupWizard.css';

// ─── 芯片数据（与 ChipSelector 保持一致）───

const CHIP_FAMILIES = [
  {
    id: 'C51', label: '51 系列', icon: '',
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
    id: 'STM32', label: 'STM32', icon: '',
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
    id: 'ESP32', label: 'ESP32', icon: '',
    desc: 'Wi-Fi + 蓝牙 SoC',
    models: [
      { value: 'esp32-wroom-32', label: 'ESP32-WROOM-32' },
      { value: 'esp32-s3', label: 'ESP32-S3' },
      { value: 'esp32-c3', label: 'ESP32-C3' },
      { value: 'esp8266', label: 'ESP8266' },
    ],
  },
  {
    id: 'Arduino', label: 'Arduino', icon: '',
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
  initialFiles?: Array<{ path: string; content: string; lang: string }>;
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
  const [dirRef, setDirRef] = useState<{ name: string; pathOrHandle: string | FileSystemDirectoryHandle } | null>(null);
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
    const picked = await pickProjectDirectory();
    if (picked) {
      setDirRef(picked);
      setProjectDir(picked.name);
    }
  };

  const handleConfirm = async () => {
    const name = projectName.trim() || `${selectedFamily} 项目`;
    const dir = projectDir.trim() || '未选择路径';

    // 如果选择了目录，写入项目初始化文件
    if (dirRef) {
      try {
        const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
        const isBrowser = !isTauri && typeof window !== 'undefined' && 'showDirectoryPicker' in window;

        // .chipsim.json 项目标记
        await writeFileToDirectory(dirRef, '.chipsim.json', JSON.stringify({
          name, chipFamily: selectedFamily, chipModel: selectedModel,
          version: '2.0.0', createdAt: new Date().toISOString(),
        }, null, 2));

        // main.c 模板
        const mainContent = getMainTemplate(selectedFamily, selectedModel);
        await writeFileToDirectory(dirRef, 'main.c', mainContent);

        // Makefile
        await writeFileToDirectory(dirRef, 'Makefile', getMakefileContent(selectedFamily, selectedModel));

        // README.md
        await writeFileToDirectory(dirRef, 'README.md', `# ${name}\n\n芯片: ${selectedFamily} ${selectedModel}\n\n## 编译\n\n\`\`\`bash\nmake\n\`\`\`\n`);

        // 浏览器环境：创建 src/ 和 include/ 子目录（写入 .gitkeep 占位）
        if (isBrowser && dirRef.pathOrHandle instanceof FileSystemDirectoryHandle) {
          try {
            const srcDir = await dirRef.pathOrHandle.getDirectoryHandle('src', { create: true });
            const srcFile = await srcDir.getFileHandle('.gitkeep', { create: true });
            const w = await srcFile.createWritable();
            await w.write('');
            await w.close();
          } catch { /* 忽略 */ }
          try {
            const incDir = await dirRef.pathOrHandle.getDirectoryHandle('include', { create: true });
            const incFile = await incDir.getFileHandle('.gitkeep', { create: true });
            const w = await incFile.createWritable();
            await w.write('');
            await w.close();
          } catch { /* 忽略 */ }
        }
      } catch { /* 写入失败不阻塞 */ }
    }

    // 生成编辑器中的初始文件
    const initialFiles = [
      { path: 'main.c', content: getMainTemplate(selectedFamily, selectedModel), lang: 'c' as const },
      { path: 'Makefile', content: getMakefileContent(selectedFamily, selectedModel), lang: 'text' as const },
      { path: 'README.md', content: `# ${name}\n\n芯片: ${selectedFamily} ${selectedModel}\n`, lang: 'text' as const },
    ];

    onComplete({
      family: selectedFamily,
      model: selectedModel,
      projectName: name,
      projectDir: dir,
      initialFiles,
    });
  };

  const handleOpenFolder = async () => {
    setImporting(true);
    try {
      const result = await pickExistingProjectFolder();
      if (!result) { setImporting(false); return; }

      if (result.files.length === 0) {
        alert('该文件夹中没有找到代码文件（.c/.h/.cpp/.ino）');
        setImporting(false);
        return;
      }

      onComplete({
        family: 'STM32', model: 'stm32f103c8t6',
        projectName: result.name, projectDir: result.name,
        importedFiles: result.files,
      });
    } catch { /* 用户取消 */ }
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
              {importing ? '正在导入...' : '打开已有工程文件夹'}
            </button>
            {!fsSupported && (
              <p className="wizard-hint">! 当前浏览器不支持文件夹访问，请使用桌面版</p>
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
                  <span className="wizard-model-icon" style={{color:'var(--sil-accent)'}}>&#9647;</span>
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
                  readOnly={!!dirRef}
                  style={{ flex: 1 }}
                />
                <button className="wizard-browse-btn" onClick={handlePickDir}>
                  浏览
                </button>
              </div>
              {!fsSupported && (
                <p className="wizard-hint">! 当前浏览器不支持选择文件夹，可手动输入路径</p>
              )}
            </div>

            <button className="wizard-confirm-btn" onClick={handleConfirm}>
              进入仿真
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
