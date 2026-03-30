/**
 * 代码编辑器 — Monaco Editor + 信息面板标签页
 * 代码文件用 Monaco 渲染，信息面板用 React 组件渲染
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import * as monaco from 'monaco-editor';
import type { SelectedElement } from '../canvas/interaction';
import { LibraryReference } from '../components/LibraryReference';
import { PinListPanel } from '../components/PinListPanel';
import { compileCode, detectCompilers, isDesktop, type CompilerInfo, type CompileResult } from '../lib/compiler-api';
import './CodeEditor.css';

// ========== 类型 ==========
interface VFile {
  path: string;
  content: string;
  lang: string;
}

interface CodeEditorProps {
  selectedElement?: SelectedElement | null;
  pinConfigs?: Record<string, string>;
  onPinConfigChange?: (configs: Record<string, string>) => void;
  chipFamily?: string;
  chipModel?: string;
  wires?: Array<{ from: { componentId: string; pinId: string }; to: { componentId: string; pinId: string } }>;
  chipPins?: Array<{ id: string; name: string; side: string; connected: boolean }>;
}

type VirtualPanel = 'properties' | 'pins' | 'reference' | 'simlog' | null;

// ========== STM32F103C8T6 示例文件 ==========
const STM32F103_EXAMPLES: VFile[] = [
  {
    path: 'main.c',
    lang: 'c',
    content: `#include "stm32f1xx_hal.h"

// PA5: 板载LED
void SystemClock_Config(void);

int main(void) {
  HAL_Init();
  SystemClock_Config();
  
  // PA5 GPIO输出
  __HAL_RCC_GPIOA_CLK_ENABLE();
  GPIO_InitTypeDef gpio = {GPIO_PIN_5, GPIO_MODE_OUTPUT_PP, GPIO_NOPULL, GPIO_SPEED_FREQ_LOW};
  HAL_GPIO_Init(GPIOA, &gpio);
  
  while (1) {
    HAL_GPIO_TogglePin(GPIOA, GPIO_PIN_5);
    HAL_Delay(500);
  }
}
`,
  },
  {
    path: 'key_led.c',
    lang: 'c',
    content: `#include "stm32f1xx_hal.h"

int main(void) {
  HAL_Init();
  SystemClock_Config();
  
  // PA5 LED输出
  __HAL_RCC_GPIOA_CLK_ENABLE();
  GPIO_InitTypeDef led = {GPIO_PIN_5, GPIO_MODE_OUTPUT_PP, GPIO_NOPULL, GPIO_SPEED_FREQ_LOW};
  HAL_GPIO_Init(GPIOA, &led);
  
  // PB12 按键输入（内部上拉）
  __HAL_RCC_GPIOB_CLK_ENABLE();
  GPIO_InitTypeDef key = {GPIO_PIN_12, GPIO_MODE_INPUT, GPIO_PULLUP, GPIO_SPEED_FREQ_LOW};
  HAL_GPIO_Init(GPIOB, &key);
  
  while (1) {
    if (HAL_GPIO_ReadPin(GPIOB, GPIO_PIN_12) == GPIO_PIN_RESET) {
      HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_SET);
    } else {
      HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_RESET);
    }
    HAL_Delay(10);
  }
}
`,
  },
  {
    path: 'uart_echo.c',
    lang: 'c',
    content: `#include "stm32f1xx_hal.h"

UART_HandleTypeDef huart2;

int main(void) {
  HAL_Init();
  SystemClock_Config();
  
  // USART2: PA2(TX)/PA3(RX)
  __HAL_RCC_GPIOA_CLK_ENABLE();
  __HAL_RCC_USART2_CLK_ENABLE();
  
  huart2.Instance = USART2;
  huart2.Init.BaudRate = 115200;
  huart2.Init.WordLength = UART_WORDLENGTH_8B;
  huart2.Init.StopBits = UART_STOPBITS_1;
  huart2.Init.Parity = UART_PARITY_NONE;
  HAL_UART_Init(&huart2);
  
  uint8_t buf;
  while (1) {
    if (HAL_UART_Receive(&huart2, &buf, 1, 100) == HAL_OK) {
      HAL_UART_Transmit(&huart2, &buf, 1, 100);
    }
  }
}
`,
  },
  {
    path: 'adc_temp.c',
    lang: 'c',
    content: `#include "stm32f1xx_hal.h"

ADC_HandleTypeDef hadc1;

int main(void) {
  HAL_Init();
  SystemClock_Config();
  
  // PA4 ADC
  __HAL_RCC_GPIOA_CLK_ENABLE();
  __HAL_RCC_ADC1_CLK_ENABLE();
  
  hadc1.Instance = ADC1;
  hadc1.Init.ScanConvMode = DISABLE;
  hadc1.Init.ContinuousConvMode = ENABLE;
  HAL_ADC_Init(&hadc1);
  
  HAL_ADC_Start(&hadc1);
  while (1) {
    HAL_ADC_PollForConversion(&hadc1, 100);
    uint16_t val = HAL_ADC_GetValue(&hadc1);
    // val: 0-4095 → 温度
    HAL_Delay(500);
  }
}
`,
  },
  {
    path: 'oled_i2c.c',
    lang: 'c',
    content: `#include "stm32f1xx_hal.h"

I2C_HandleTypeDef hi2c1;
// OLED: PB6(SCL)/PB7(SDA), 地址0x78

void OLED_Init(void) {
  uint8_t init_cmds[] = {0xAE, 0xD5, 0x80, 0xA8, 0x3F, 0xD3, 0x00, 0x40, 0x8D, 0x14, 0x20, 0x00, 0xA1, 0xC8, 0xDA, 0x12, 0x81, 0xCF, 0xD9, 0xF1, 0xDB, 0x40, 0xA4, 0xA6, 0xAF};
  HAL_I2C_Master_Transmit(&hi2c1, 0x78, init_cmds, sizeof(init_cmds), 100);
}

int main(void) {
  HAL_Init();
  SystemClock_Config();
  OLED_Init();
  
  // 显示"Hello"
  // ... (简化的OLED绘制逻辑)
  while (1) {
    HAL_Delay(1000);
  }
}
`,
  },
  {
    path: 'include/stm32f1xx_hal.h',
    lang: 'c',
    content: `/**
 * STM32F1xx HAL 库头文件（简化版）
 * 完整版请从 ST 官网获取
 */
#ifndef __STM32F1xx_HAL_H
#define __STM32F1xx_HAL_H

#include <stdint.h>

// GPIO
typedef struct { uint32_t Pin; uint32_t Mode; uint32_t Pull; uint32_t Speed; } GPIO_InitTypeDef;
typedef enum { GPIO_PIN_RESET = 0, GPIO_PIN_SET } GPIO_PinState;
typedef void GPIO_TypeDef;

#define GPIO_PIN_0   0x0001
#define GPIO_PIN_5   0x0020
#define GPIO_PIN_12  0x1000
#define GPIO_MODE_OUTPUT_PP  0x01
#define GPIO_MODE_INPUT      0x00
#define GPIO_PULLUP          0x01
#define GPIO_NOPULL          0x00
#define GPIO_SPEED_FREQ_LOW  0x00

// UART
typedef struct {
  void* Instance;
  struct { uint32_t BaudRate; uint32_t WordLength; uint32_t StopBits; uint32_t Parity; } Init;
} UART_HandleTypeDef;

#define UART_WORDLENGTH_8B  0x00
#define UART_STOPBITS_1     0x00
#define UART_PARITY_NONE    0x00

// ADC
typedef struct {
  void* Instance;
  struct { uint32_t ScanConvMode; uint32_t ContinuousConvMode; } Init;
} ADC_HandleTypeDef;

// I2C
typedef struct { void* Instance; } I2C_HandleTypeDef;

// HAL 函数声明
void HAL_Init(void);
void SystemClock_Config(void);
void HAL_Delay(uint32_t ms);

void HAL_GPIO_Init(GPIO_TypeDef* port, GPIO_InitTypeDef* init);
void HAL_GPIO_WritePin(GPIO_TypeDef* port, uint16_t pin, GPIO_PinState state);
GPIO_PinState HAL_GPIO_ReadPin(GPIO_TypeDef* port, uint16_t pin);
void HAL_GPIO_TogglePin(GPIO_TypeDef* port, uint16_t pin);

HAL_StatusTypeDef HAL_UART_Init(UART_HandleTypeDef* huart);
HAL_StatusTypeDef HAL_UART_Transmit(UART_HandleTypeDef* huart, uint8_t* data, uint16_t size, uint32_t timeout);
HAL_StatusTypeDef HAL_UART_Receive(UART_HandleTypeDef* huart, uint8_t* data, uint16_t size, uint32_t timeout);

HAL_StatusTypeDef HAL_ADC_Init(ADC_HandleTypeDef* hadc);
HAL_StatusTypeDef HAL_ADC_Start(ADC_HandleTypeDef* hadc);
HAL_StatusTypeDef HAL_ADC_PollForConversion(ADC_HandleTypeDef* hadc, uint32_t timeout);
uint32_t HAL_ADC_GetValue(ADC_HandleTypeDef* hadc);

HAL_StatusTypeDef HAL_I2C_Master_Transmit(I2C_HandleTypeDef* hi2c, uint16_t addr, uint8_t* data, uint16_t size, uint32_t timeout);

typedef enum { HAL_OK = 0, HAL_ERROR = 1, HAL_BUSY = 2, HAL_TIMEOUT = 3 } HAL_StatusTypeDef;

// GPIO 端口
extern GPIO_TypeDef* GPIOA;
extern GPIO_TypeDef* GPIOB;

#define __HAL_RCC_GPIOA_CLK_ENABLE()  ((void)0)
#define __HAL_RCC_GPIOB_CLK_ENABLE()  ((void)0)
#define __HAL_RCC_ADC1_CLK_ENABLE()   ((void)0)
#define __HAL_RCC_USART2_CLK_ENABLE() ((void)0)
#define __HAL_RCC_I2C1_CLK_ENABLE()   ((void)0)

#endif
`,
  },
  {
    path: 'include/stm32f1xx_hal_conf.h',
    lang: 'c',
    content: `/**
 * STM32F1xx HAL 配置文件（简化版）
 */
#ifndef __STM32F1xx_HAL_CONF_H
#define __STM32F1xx_HAL_CONF_H

#define HAL_MODULE_ENABLED
#define HAL_GPIO_MODULE_ENABLED
#define HAL_UART_MODULE_ENABLED
#define HAL_ADC_MODULE_ENABLED
#define HAL_I2C_MODULE_ENABLED
#define HAL_TIM_MODULE_ENABLED
#define HAL_RCC_MODULE_ENABLED
#define HAL_CORTEX_MODULE_ENABLED

#define HSE_VALUE    8000000U   // 外部晶振 8MHz
#define HSI_VALUE    8000000U   // 内部 RC 8MHz

#endif
`,
  },
  {
    path: 'Makefile',
    lang: 'text',
    content: `# STM32F103C8T6 项目 Makefile
TARGET = firmware
MCU = STM32F103C8T6
CC = arm-none-eabi-gcc
CFLAGS = -mcpu=cortex-m3 -mthumb -Os -Wall -I./include
LDFLAGS = -T stm32f103c8.ld -nostartfiles

SRC = $(wildcard src/*.c)
OBJ = $(SRC:.c=.o)

all: $(TARGET).elf

$(TARGET).elf: $(OBJ)
	$(CC) $(CFLAGS) $(LDFLAGS) -o $@ $^

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

clean:
	rm -f $(OBJ) $(TARGET).elf $(TARGET).bin

flash: $(TARGET).elf
	openocd -f interface/stlink.cfg -f target/stm32f1x.cfg -c "program $< verify reset exit"

.PHONY: all clean flash
`,
  },
  {
    path: 'README.md',
    lang: 'text',
    content: `# STM32F103C8T6 示例项目

## 文件说明

| 文件 | 功能 |
|------|------|
| main.c | LED闪烁（PA5） |
| key_led.c | 按键控制LED（PB12→PA5） |
| uart_echo.c | 串口回显（PA2/PA3 USART2 115200） |
| adc_temp.c | ADC读取温度（PA4） |
| oled_i2c.c | OLED显示（PB6/PB7 I2C） |

## 硬件连接
- LED → PA5（板载）
- 按键 → PB12（内部上拉）
- 串口 → PA2(TX)/PA3(RX)
- OLED → PB6(SCL)/PB7(SDA)
- NTC → PA4(ADC)

## 编译
\`\`\`bash
make
\`\`\`

## 烧录
\`\`\`bash
make flash
\`\`\`
`,
  },
];

// ========== C51 示例文件 ==========
const C51_EXAMPLES: VFile[] = [
  {
    path: 'main.c',
    lang: 'c',
    content: `#include <reg52.h>

sbit LED = P1^0;  // P1.0 接 LED

void delay(unsigned int ms) {
  unsigned int i, j;
  for (i = 0; i < ms; i++)
    for (j = 0; j < 120; j++);
}

void main(void) {
  while (1) {
    LED = 0;   // 点亮 LED（低电平驱动）
    delay(500);
    LED = 1;   // 熄灭
    delay(500);
  }
}
`,
  },
  {
    path: 'key_led.c',
    lang: 'c',
    content: `#include <reg52.h>

sbit LED = P1^0;
sbit KEY = P3^2;  // P3.2 接按键

void delay(unsigned int ms) {
  unsigned int i, j;
  for (i = 0; i < ms; i++)
    for (j = 0; j < 120; j++);
}

void main(void) {
  LED = 1;  // 初始熄灭
  while (1) {
    if (KEY == 0) {       // 按键按下（低电平有效）
      delay(20);           // 消抖
      if (KEY == 0) {
        LED = ~LED;        // 翻转 LED
        while (KEY == 0);  // 等待释放
      }
    }
  }
}
`,
  },
  {
    path: 'uart.c',
    lang: 'c',
    content: `#include <reg52.h>

void UART_Init(void) {
  TMOD = 0x20;   // 定时器1，模式2
  TH1 = 0xFD;    // 9600bps @ 11.0592MHz
  TL1 = 0xFD;
  SCON = 0x50;   // 串口模式1，允许接收
  TR1 = 1;       // 启动定时器1
}

void UART_Send(unsigned char dat) {
  SBUF = dat;
  while (!TI);
  TI = 0;
}

void main(void) {
  unsigned char ch;
  UART_Init();
  UART_Send('H');
  UART_Send('i');
  UART_Send('\\n');
  while (1) {
    if (RI) {
      ch = SBUF;
      RI = 0;
      UART_Send(ch);  // 回显
    }
  }
}
`,
  },
  {
    path: 'include/reg52.h',
    lang: 'c',
    content: `/**
 * 51 系列寄存器定义（简化版）
 */
#ifndef __REG52_H__
#define __REG52_H__

// 特殊功能寄存器
sfr P0   = 0x80;
sfr P1   = 0x90;
sfr P2   = 0xA0;
sfr P3   = 0xB0;
sfr SP   = 0x81;
sfr DPL  = 0x82;
sfr DPH  = 0x83;
sfr PSW  = 0xD0;
sfr ACC  = 0xE0;
sfr B    = 0xF0;
sfr TCON = 0x88;
sfr TMOD = 0x89;
sfr TL0  = 0x8A;
sfr TL1  = 0x8B;
sfr TH0  = 0x8C;
sfr TH1  = 0x8D;
sfr IE   = 0xA8;
sfr IP   = 0xB8;
sfr SCON = 0x98;
sfr SBUF = 0x99;

// TCON 位
sbit TR0 = TCON^4;
sbit TR1 = TCON^6;
sbit TF0 = TCON^5;
sbit TF1 = TCON^7;

// IE 位
sbit EA  = IE^7;

// SCON 位
sbit TI = SCON^1;
sbit RI = SCON^0;

#endif
`,
  },
  {
    path: 'README.md',
    lang: 'text',
    content: `# 51 单片机示例项目

## 文件说明

| 文件 | 功能 |
|------|------|
| main.c | LED 闪烁（P1.0） |
| key_led.c | 按键控制 LED（P3.2→P1.0） |
| uart.c | 串口通信（9600bps） |

## 硬件连接
- LED → P1.0
- 按键 → P3.2（低电平有效）
- 串口 → P3.0(RXD)/P3.1(TXD)

## 编译
使用 Keil uVision 或 SDCC 编译
`,
  },
];

// ========== ESP32 示例文件 ==========
const ESP32_EXAMPLES: VFile[] = [
  {
    path: 'main.c',
    lang: 'c',
    content: `#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"

#define LED_PIN GPIO_NUM_2  // 板载 LED

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
`,
  },
  {
    path: 'wifi_ap.c',
    lang: 'c',
    content: `#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_log.h"
#include "nvs_flash.h"

static const char *TAG = "wifi_ap";

void app_main(void) {
  ESP_ERROR_CHECK(nvs_flash_init());
  ESP_ERROR_CHECK(esp_netif_init());
  ESP_ERROR_CHECK(esp_event_loop_create_default());

  esp_netif_create_default_wifi_ap();

  wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
  ESP_ERROR_CHECK(esp_wifi_init(&cfg));

  wifi_config_t ap_config = {
    .ap = {
      .ssid = "ChipSim-ESP32",
      .ssid_len = 0,
      .password = "12345678",
      .max_connection = 4,
      .authmode = WIFI_AUTH_WPA_WPA2_PSK,
    },
  };

  ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_AP));
  ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_AP, &ap_config));
  ESP_ERROR_CHECK(esp_wifi_start());

  ESP_LOGI(TAG, "WiFi AP started. SSID: %s", ap_config.ap.ssid);
}
`,
  },
  {
    path: 'README.md',
    lang: 'text',
    content: `# ESP32 示例项目

## 文件说明

| 文件 | 功能 |
|------|------|
| main.c | LED 闪烁（GPIO2） |
| wifi_ap.c | 创建 WiFi 热点 |

## 硬件连接
- 板载 LED → GPIO2

## 编译
使用 ESP-IDF：
\`\`\`bash
idf.py build
idf.py flash monitor
\`\`\`
`,
  },
];

// ========== Arduino 示例文件 ==========
const ARDUINO_EXAMPLES: VFile[] = [
  {
    path: 'sketch.ino',
    lang: 'c',
    content: `// Arduino LED 闪烁
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  delay(500);
}
`,
  },
  {
    path: 'key_led.ino',
    lang: 'c',
    content: `// Arduino 按键控制 LED
const int BUTTON_PIN = 2;
const int LED_PIN = 13;

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  if (digitalRead(BUTTON_PIN) == LOW) {
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }
  delay(10);
}
`,
  },
  {
    path: 'serial_echo.ino',
    lang: 'c',
    content: `// Arduino 串口回显
void setup() {
  Serial.begin(9600);
  Serial.println("Hello from Arduino!");
}

void loop() {
  if (Serial.available()) {
    char ch = Serial.read();
    Serial.print(ch);
  }
}
`,
  },
  {
    path: 'README.md',
    lang: 'text',
    content: `# Arduino 示例项目

## 文件说明

| 文件 | 功能 |
|------|------|
| sketch.ino | LED 闪烁 |
| key_led.ino | 按键控制 LED |
| serial_echo.ino | 串口回显 |

## 硬件连接
- LED → D13（板载）
- 按键 → D2（内部上拉）
- 串口 → USB（9600bps）
`,
  },
];

// ========== 组件 ==========
export function CodeEditor({ selectedElement, pinConfigs, onPinConfigChange, chipFamily, chipModel, wires, chipPins }: CodeEditorProps) {
  const [files, setFiles] = useState<VFile[]>([]);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<VirtualPanel>('properties');
  const [openPanels, setOpenPanels] = useState<Set<VirtualPanel>>(new Set(['properties']));
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [treeWidth, setTreeWidth] = useState(140);
  const [compiling, setCompiling] = useState(false);
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);
  const [compilers, setCompilers] = useState<CompilerInfo[]>([]);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const modelsRef = useRef<Map<string, monaco.editor.ITextModel>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastLoadedModelRef = useRef<string | null>(null);
  const editorMountedRef = useRef(false);
  const mountedRef = useRef(true);

  const isCodeFile = activeFile && !activePanel;
  const currentFile = files.find(f => f.path === activeFile);

  // 监听事件
  useEffect(() => {
    const onNew = () => setShowNewFileDialog(true);
    const onImport = () => fileInputRef.current?.click();
    const onRef = () => openPanel('reference');
    const onPins = () => openPanel('pins');
    const onCompile = async () => {
      if (compiling) return;
      const file = files.find(f => f.path === activeFile);
      if (!file) { setCompileResult({ success: false, stdout: '', stderr: '请先打开一个代码文件', output_path: null, output_format: null }); return; }
      if (!chipFamily) { setCompileResult({ success: false, stdout: '', stderr: '请先选择芯片型号', output_path: null, output_format: null }); return; }
      setCompiling(true);
      setCompileResult(null);
      try {
        const result = await compileCode({ source: file.content, chip_family: chipFamily.toLowerCase(), chip_model: chipModel || '', filename: file.path.split('/').pop() || file.path });
        if (!mountedRef.current) return;
        setCompileResult(result);
      } catch (e: any) {
        if (!mountedRef.current) return;
        setCompileResult({ success: false, stdout: '', stderr: String(e), output_path: null, output_format: null });
      }
      if (!mountedRef.current) return;
      setCompiling(false);
    };
    window.addEventListener('chip-sim:new-file', onNew);
    window.addEventListener('chip-sim:import-file', onImport);
    window.addEventListener('chip-sim:open-reference', onRef);
    window.addEventListener('chip-sim:open-pins', onPins);
    window.addEventListener('chip-sim:compile', onCompile);
    return () => {
      window.removeEventListener('chip-sim:new-file', onNew);
      window.removeEventListener('chip-sim:import-file', onImport);
      window.removeEventListener('chip-sim:open-reference', onRef);
      window.removeEventListener('chip-sim:open-pins', onPins);
      window.removeEventListener('chip-sim:compile', onCompile);
    };
  }, [files, activeFile, chipFamily, chipModel, compiling]);

  // mountedRef cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // 检测可用编译器（仅桌面版）
  useEffect(() => {
    if (isDesktop()) {
      detectCompilers().then(setCompilers).catch(() => {});
    }
  }, []);

  // selectedElement 变化 → 打开属性面板
  useEffect(() => {
    if (selectedElement) {
      openPanel('properties');
    }
  }, [selectedElement?.id]);

  // 初始化 Monaco（只初始化一次）
  useEffect(() => {
    if (editorMountedRef.current || !editorContainerRef.current) return;
    editorMountedRef.current = true;

    monaco.editor.defineTheme('chip-sim-dark', {
      base: 'vs-dark', inherit: true,
      rules: [
        { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'c084fc' },
        { token: 'string', foreground: '86efac' },
        { token: 'number', foreground: 'fbbf24' },
        { token: 'type', foreground: '67e8f9' },
        { token: 'function', foreground: '93c5fd' },
      ],
      colors: {
        'editor.background': '#1e1e2e', 'editor.foreground': '#cdd6f4',
        'editor.lineHighlightBackground': '#2a2a3e', 'editorCursor.foreground': '#f5e0dc',
        'editorLineNumber.foreground': '#585b70',
      },
    });

    if (!monaco.languages.getLanguages().find(l => l.id === 'c')) {
      monaco.languages.register({ id: 'c' });
      monaco.languages.setMonarchTokensProvider('c', {
        tokenizer: { root: [
          [/#include|#define|#ifdef|#ifndef/, 'keyword'],
          [/\b(int|char|float|double|void|unsigned|const|volatile|static|return|if|else|while|for|struct|typedef|uint8_t|uint16_t|uint32_t)\b/, 'type'],
          [/\b(HAL_GPIO_WritePin|HAL_GPIO_ReadPin|HAL_Delay|main|printf)\b/, 'function'],
          [/0x[0-9a-fA-F]+|\b\d+\b/, 'number'], [/".*?"/, 'string'],
          [/\/\/.*$/, 'comment'], [/\/\*[\s\S]*?\*\//, 'comment'],
        ]},
      });
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const editor = monaco.editor.create(editorContainerRef.current, {
      value: '', language: 'c',
      theme: isDark ? 'chip-sim-dark' : 'vs',
      fontSize: 13, fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, monospace",
      lineNumbers: 'on', minimap: { enabled: false }, scrollBeyondLastLine: false,
      automaticLayout: true, tabSize: 2, bracketPairColorization: { enabled: true },
      padding: { top: 8 },
    });
    editorRef.current = editor;

    const handler = () => monaco.editor.setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'chip-sim-dark' : 'vs');
    window.addEventListener('themechange', handler);
    return () => {
      window.removeEventListener('themechange', handler);
      editor.dispose();
      modelsRef.current.forEach(m => m.dispose());
      modelsRef.current.clear();
      editorRef.current = null;
      editorMountedRef.current = false;
    };
  }, []);

  // 切换代码文件时更新 Monaco
  useEffect(() => {
    if (!editorRef.current || !activeFile || activePanel) return;
    let model = modelsRef.current.get(activeFile);
    if (!model) {
      const file = files.find(f => f.path === activeFile);
      if (!file) return;
      model = monaco.editor.createModel(file.content, file.lang === 'c' ? 'c' : 'plaintext');
      modelsRef.current.set(activeFile, model);
    }
    editorRef.current.setModel(model);
    const sub = model.onDidChangeContent(() => {
      setFiles(prev => prev.map(f => f.path === activeFile ? { ...f, content: model!.getValue() } : f));
    });
    return () => sub.dispose();
  }, [activeFile, activePanel]);

  // 各芯片系列自动加载示例文件
  useEffect(() => {
    if (!chipModel) return;
    // 仅在芯片真正变化时加载（忽略大小写差异）
    if (lastLoadedModelRef.current?.toLowerCase() === chipModel.toLowerCase() && files.length > 0) return;
    lastLoadedModelRef.current = chipModel;

    let examples: VFile[] | null = null;
    const m = chipModel.toLowerCase();

    if (m.includes('stm32f103c8')) {
      examples = STM32F103_EXAMPLES;
    } else if (m.startsWith('stm32')) {
      examples = STM32F103_EXAMPLES;
    } else if (m.startsWith('esp32') || m.startsWith('esp8266')) {
      examples = ESP32_EXAMPLES;
    } else if (m === 'uno' || m === 'mega' || m === 'nano' || m === 'leonardo' || m === 'due') {
      examples = ARDUINO_EXAMPLES;
    } else if (m.startsWith('at89') || m.startsWith('stc89') || m.startsWith('stc12') || m.startsWith('stc15')) {
      examples = C51_EXAMPLES;
    }

    if (examples) {
      setFiles(examples);
      setOpenTabs([examples[0].path]);
      setActiveFile(examples[0].path);
      setActivePanel(null);
      modelsRef.current.forEach(model => model.dispose());
      modelsRef.current.clear();
    }
  }, [chipModel]);

  // 兜底：如果挂载后没有文件，自动加载 C51 示例
  useEffect(() => {
    if (files.length === 0 && !lastLoadedModelRef.current) {
      lastLoadedModelRef.current = 'AT89C51';
      setFiles(C51_EXAMPLES);
      setOpenTabs(['main.c']);
      setActiveFile('main.c');
      setActivePanel(null);
    }
  }, []);

  // ========== 操作 ==========
  const openPanel = useCallback((panel: VirtualPanel) => {
    setActivePanel(panel);
    setActiveFile(null);
    setOpenPanels(prev => { const n = new Set(prev); n.add(panel); return n; });
  }, []);

  const closePanel = useCallback((panel: VirtualPanel, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenPanels(prev => {
      const n = new Set(prev);
      n.delete(panel);
      if (activePanel === panel) {
        setActivePanel(n.size > 0 ? [...n][n.size - 1] : null);
      }
      return n;
    });
  }, [activePanel]);

  const openFile = useCallback((path: string) => {
    setActiveFile(path);
    setActivePanel(null);
    setOpenTabs(prev => prev.includes(path) ? prev : [...prev, path]);
  }, []);

  const closeTab = useCallback((path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenTabs(prev => {
      const next = prev.filter(t => t !== path);
      if (activeFile === path) {
        setActiveFile(next.length > 0 ? next[next.length - 1] : null);
        setActivePanel(null);
      }
      return next;
    });
  }, [activeFile]);

  const createFile = useCallback(() => {
    const name = newFileName.trim();
    if (!name) return;
    const lang = name.endsWith('.c') ? 'c' : name.endsWith('.h') ? 'c' : name.endsWith('.py') ? 'python' : 'text';
    const newFile: VFile = { path: name, content: '', lang };
    setFiles(prev => [...prev, newFile]);
    openFile(name);
    setShowNewFileDialog(false);
    setNewFileName('');
  }, [newFileName, openFile]);

  const importFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    Array.from(fileList).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const lang = file.name.endsWith('.c') || file.name.endsWith('.h') ? 'c' : 'text';
        setFiles(prev => [...prev, { path: file.name, content: reader.result as string, lang }]);
        openFile(file.name);
      };
      reader.readAsText(file);
    });
  };

  const dirs = new Set<string>();
  files.forEach(f => { const p = f.path.split('/'); for (let i = 1; i < p.length; i++) dirs.add(p.slice(0, i).join('/')); });

  // 面板标签
  const panelTabs = [
    { id: 'properties' as VirtualPanel, label: '元件属性' },
    { id: 'pins' as VirtualPanel, label: '引脚配置' },
    { id: 'reference' as VirtualPanel, label: '速查手册' },
  ];

  // ========== 渲染 ==========
  return (
    <div className="ide-editor">
      <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }}
        accept=".c,.h,.cpp,.py,.md,.txt,.json"
        onChange={(e) => importFiles(e.target.files)} />

      <div className="ide-body">
        {/* 文件树 */}
        <div className="ide-file-tree" style={{ width: treeWidth, flexShrink: 0 }}>
          <div className="ide-tree-header">信息</div>
          {panelTabs.map(p => (
            <div key={p.id}
              className={`ide-tree-file ${activePanel === p.id ? 'active' : ''}`}
              onClick={() => openPanel(p.id)}>
              <span>{p.label}</span>
            </div>
          ))}

          <div className="ide-tree-header" style={{ marginTop: 8 }}>项目</div>
          {Array.from(dirs).sort().map(dir => {
            const depth = dir.split('/').length - 1;
            return (
              <div key={dir} className="ide-tree-dir" style={{ paddingLeft: 6 + depth * 10 }}
                onClick={() => setExpandedDirs(prev => { const n = new Set(prev); n.has(dir) ? n.delete(dir) : n.add(dir); return n; })}>
                <span className="ide-tree-arrow">{expandedDirs.has(dir) ? '▼' : '▶'}</span>
                <span>{dir.split('/').pop()}</span>
              </div>
            );
          })}
          {files.map(f => {
            const parts = f.path.split('/');
            const parentDir = parts.slice(0, -1).join('/');
            if (parts.length > 1 && !expandedDirs.has(parentDir)) return null;
            return (
              <div key={f.path}
                className={`ide-tree-file ${activeFile === f.path && !activePanel ? 'active' : ''}`}
                style={{ paddingLeft: 6 + (parts.length - 1) * 10 }}
                onClick={() => openFile(f.path)}>
                <span>{parts[parts.length - 1]}</span>
              </div>
            );
          })}
        </div>

        {/* 分隔线 */}
        <div
          style={{ width: 3, cursor: 'col-resize', background: 'var(--sil-border, #d0d7de)', flexShrink: 0 }}
          onPointerDown={(e) => {
            e.preventDefault();
            const startX = e.clientX, startW = treeWidth;
            const onMove = (ev: PointerEvent) => setTreeWidth(Math.max(80, Math.min(300, startW + ev.clientX - startX)));
            const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
          }}
        />

        {/* 编辑器区域 */}
        <div className="ide-editor-area">
          {/* 标签栏 — 只显示代码文件 */}
          <div className="ide-tab-bar">
            {openTabs.map(tab => (
              <div key={tab}
                className={`ide-tab ${activeFile === tab && !activePanel ? 'active' : ''}`}
                onClick={() => openFile(tab)}>
                <span>{tab.split('/').pop()}</span>
                <button className="ide-tab-close" onClick={(e) => closeTab(tab, e)}>×</button>
              </div>
            ))}
          </div>

          {/* 内容区 */}
          {activePanel === 'properties' && (
            <div className="ide-panel-content">
              {selectedElement ? (
                <div className="prop-panel">
                  <h3 className="prop-title">{selectedElement.name || selectedElement.id}</h3>
                  <div className="prop-section">
                    <div className="prop-section-title">基本信息</div>
                    <div className="prop-row"><span className="prop-label">类型</span><span className="prop-value">{selectedElement.type || selectedElement.properties?.type}</span></div>
                    <div className="prop-row"><span className="prop-label">ID</span><span className="prop-value">{selectedElement.id}</span></div>
                    <div className="prop-row"><span className="prop-label">名称</span><span className="prop-value">{selectedElement.name || '-'}</span></div>
                  </div>

                  {/* 元件参数 */}
                  {selectedElement.type === 'resistor' && (
                    <div className="prop-section">
                      <div className="prop-section-title">参数</div>
                      <div className="prop-row"><span className="prop-label">阻值</span><span className="prop-value">1 kΩ</span></div>
                      <div className="prop-row"><span className="prop-label">公差</span><span className="prop-value">±5%</span></div>
                      <div className="prop-row"><span className="prop-label">功率</span><span className="prop-value">0.25 W</span></div>
                      <div className="prop-row"><span className="prop-label">封装</span><span className="prop-value">0805</span></div>
                    </div>
                  )}
                  {selectedElement.type === 'led' && (
                    <div className="prop-section">
                      <div className="prop-section-title">参数</div>
                      <div className="prop-row"><span className="prop-label">颜色</span><span className="prop-value">红色</span></div>
                      <div className="prop-row"><span className="prop-label">正向压降</span><span className="prop-value">1.8 V</span></div>
                      <div className="prop-row"><span className="prop-label">正向电流</span><span className="prop-value">20 mA</span></div>
                      <div className="prop-row"><span className="prop-label">波长</span><span className="prop-value">620 nm</span></div>
                    </div>
                  )}
                  {selectedElement.type === 'capacitor' && (
                    <div className="prop-section">
                      <div className="prop-section-title">参数</div>
                      <div className="prop-row"><span className="prop-label">容值</span><span className="prop-value">100 nF</span></div>
                      <div className="prop-row"><span className="prop-label">耐压</span><span className="prop-value">16 V</span></div>
                      <div className="prop-row"><span className="prop-label">类型</span><span className="prop-value">MLCC</span></div>
                    </div>
                  )}
                  {selectedElement.type === 'button' && (
                    <div className="prop-section">
                      <div className="prop-section-title">参数</div>
                      <div className="prop-row"><span className="prop-label">类型</span><span className="prop-value">轻触开关</span></div>
                      <div className="prop-row"><span className="prop-label">触点</span><span className="prop-value">常开 (NO)</span></div>
                      <div className="prop-row"><span className="prop-label">操作力</span><span className="prop-value">1.6 N</span></div>
                    </div>
                  )}
                  {selectedElement.type === 'sensor' && (
                    <div className="prop-section">
                      <div className="prop-section-title">参数</div>
                      <div className="prop-row"><span className="prop-label">型号</span><span className="prop-value">DS18B20</span></div>
                      <div className="prop-row"><span className="prop-label">接口</span><span className="prop-value">1-Wire</span></div>
                      <div className="prop-row"><span className="prop-label">精度</span><span className="prop-value">±0.5°C</span></div>
                      <div className="prop-row"><span className="prop-label">范围</span><span className="prop-value">-55~125°C</span></div>
                    </div>
                  )}

                  <div className="prop-section">
                    <div className="prop-section-title">引脚连接</div>
                    {selectedElement.properties?.connections ? (
                      Object.entries(selectedElement.properties.connections as Record<string, string>).map(([pin, target]) => (
                        <div key={pin} className="prop-row">
                          <span className="prop-label">{pin}</span>
                          <span className="prop-value" style={{ color: '#4ade80' }}>→ {target}</span>
                        </div>
                      ))
                    ) : (
                      <div className="prop-row"><span className="prop-label">状态</span><span className="prop-value" style={{ color: '#f97316' }}>未连接</span></div>
                    )}
                  </div>

                  <div className="prop-section">
                    <div className="prop-section-title">仿真状态</div>
                    <div className="prop-row"><span className="prop-label">状态</span><span className="prop-value">就绪</span></div>
                  </div>
                </div>
              ) : (
                <div className="ide-empty"><p>点击画布上的元件查看属性</p></div>
              )}
            </div>
          )}

          {activePanel === 'pins' && (
            <div className="ide-panel-content">
              {chipFamily && chipModel ? (
                <PinListPanel
                  chipFamily={chipFamily}
                  chipModel={chipModel}
                  onPinConfigChange={onPinConfigChange}
                />
              ) : (
                <div className="ide-empty"><p>请先选择芯片型号</p></div>
              )}
            </div>
          )}

          {activePanel === 'reference' && (
            <div className="ide-panel-content">
              <LibraryReference onInsert={(code) => {
                window.dispatchEvent(new CustomEvent('chip-sim:insert-code', { detail: code }));
              }} />
            </div>
          )}

          {activePanel === 'simlog' && (
            <div className="ide-panel-content">
              <div className="prop-panel">
                <h3 className="prop-title">仿真日志</h3>
                <div className="ide-empty"><p>仿真运行时显示日志</p></div>
              </div>
            </div>
          )}

          {/* Monaco 编辑器 */}
          {isCodeFile && <div ref={editorContainerRef} className="ide-monaco-container" />}

          {/* 编译输出 */}
          {(compileResult || compiling) && (
            <div style={{ borderTop: '1px solid var(--sil-border, #d0d7de)', maxHeight: 160, overflow: 'auto', padding: '6px 10px', fontSize: 11, fontFamily: 'monospace', background: '#1a1a2e', color: '#cdd6f4', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, color: compiling ? '#fbbf24' : compileResult?.success ? '#4ade80' : '#f87171' }}>
                  {compiling ? '⏳ 编译中...' : compileResult?.success ? '✅ 编译成功' : '❌ 编译失败'}
                </span>
                <button onClick={() => setCompileResult(null)} style={{ background: 'none', border: 'none', color: '#6c7086', cursor: 'pointer', fontSize: 14 }}>×</button>
              </div>
              {compileResult?.stdout && <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#a6adc8' }}>{compileResult.stdout}</pre>}
              {compileResult?.stderr && <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#f87171' }}>{compileResult.stderr}</pre>}
              {compileResult?.output_path && <div style={{ color: '#4ade80', marginTop: 2 }}>产物: {compileResult.output_path}</div>}
              {!isDesktop() && <div style={{ color: '#fbbf24', marginTop: 4 }}>⚠ 编译功能需要桌面版 ChipSim (Tauri)</div>}
            </div>
          )}

          {/* 无文件 */}
          {!activePanel && !activeFile && (
            <div className="ide-empty">
              <p>新建或导入文件开始编辑</p>
              <p className="ide-empty-hint">或点击左侧面板查看信息</p>
            </div>
          )}
        </div>
      </div>

      {/* 新建文件弹窗 */}
      {showNewFileDialog && (
        <div className="ide-modal-overlay" onClick={() => setShowNewFileDialog(false)}>
          <div className="ide-modal" onClick={(e) => e.stopPropagation()}>
            <h3>新建文件</h3>
            <input className="ide-modal-input" placeholder="文件名 (如 main.c)" value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createFile()} autoFocus />
            <div className="ide-modal-actions">
              <button onClick={() => setShowNewFileDialog(false)}>取消</button>
              <button onClick={createFile}>创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
