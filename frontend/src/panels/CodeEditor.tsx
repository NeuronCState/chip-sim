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
  importedFiles?: Array<{ path: string; content: string; lang: string }> | null;
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

// ========== 元件参数组件 ==========
interface ElementParamsProps {
  type: string;
  properties?: Record<string, unknown>;
}

function EditableRow({ label, value, onChange }: { label: string; value: string; onChange?: (v: string) => void }) {
  return (
    <div className="prop-row">
      <span className="prop-label">{label}</span>
      {onChange ? (
        <input
          className="prop-value"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ background: 'transparent', border: '1px solid var(--sil-border, #4a7a8a)', borderRadius: 3, padding: '1px 4px', color: 'inherit', font: 'inherit', width: '60%' }}
        />
      ) : (
        <span className="prop-value">{value}</span>
      )}
    </div>
  );
}

function SelectRow({ label, value, options, onChange }: { label: string; value: string; options: { label: string; value: string }[]; onChange?: (v: string) => void }) {
  return (
    <div className="prop-row">
      <span className="prop-label">{label}</span>
      {onChange ? (
        <select
          className="prop-value"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ background: 'transparent', border: '1px solid var(--sil-border, #4a7a8a)', borderRadius: 3, padding: '1px 4px', color: 'inherit', font: 'inherit', width: '60%' }}
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <span className="prop-value">{value}</span>
      )}
    </div>
  );
}

function ElementParams({ type, properties }: ElementParamsProps) {
  const [localProps, setLocalProps] = useState<Record<string, unknown>>({});
  // 1b: 定时刷新 tick，让仿真状态实时更新
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  // 合并传入的 properties 作为初始值
  const merged = { ...(properties || {}), ...localProps };
  // 引用 tick 确保 re-render（放在 hidden span 中）
  void tick;

  const setProp = (key: string, val: unknown) => {
    setLocalProps(prev => ({ ...prev, [key]: val }));
  };

  switch (type) {
    case 'resistor':
      return (
        <>
          <EditableRow label="阻值" value={String(merged.resistance ?? '1k')} onChange={v => setProp('resistance', v)} />
          <EditableRow label="公差" value={String(merged.tolerance ?? '±5%')} onChange={v => setProp('tolerance', v)} />
          <EditableRow label="功率" value={String(merged.power ?? '0.25W')} onChange={v => setProp('power', v)} />
        </>
      );
    case 'capacitor':
      return (
        <>
          <EditableRow label="容值" value={String(merged.capacitance ?? '100nF')} onChange={v => setProp('capacitance', v)} />
          <EditableRow label="耐压" value={String(merged.voltage_rating ?? '16V')} onChange={v => setProp('voltage_rating', v)} />
          <SelectRow label="类型" value={String(merged.cap_type ?? 'MLCC')} options={[
            { label: 'MLCC', value: 'MLCC' }, { label: '电解', value: 'electrolytic' }, { label: '钽', value: 'tantalum' }, { label: '薄膜', value: 'film' },
          ]} onChange={v => setProp('cap_type', v)} />
        </>
      );
    case 'led':
      return (
        <>
          <SelectRow label="颜色" value={String(merged.color ?? 'red')} options={[
            { label: '红', value: 'red' }, { label: '绿', value: 'green' }, { label: '蓝', value: 'blue' },
            { label: '黄', value: 'yellow' }, { label: '白', value: 'white' }, { label: 'RGB', value: 'rgb' },
          ]} onChange={v => setProp('color', v)} />
          <EditableRow label="正向压降" value={String(merged.forward_voltage ?? '1.8V')} onChange={v => setProp('forward_voltage', v)} />
          <EditableRow label="正向电流" value={String(merged.forward_current ?? '20mA')} onChange={v => setProp('forward_current', v)} />
        </>
      );
    case 'battery':
      return (
        <>
          <EditableRow label="电压" value={String(merged.voltage ?? '3.3V')} onChange={v => setProp('voltage', v)} />
          <EditableRow label="容量" value={String(merged.capacity ?? '2000mAh')} onChange={v => setProp('capacity', v)} />
        </>
      );
    case 'button':
    case 'switch':
      return (
        <>
          <SelectRow label="类型" value={String(merged.btn_type ?? 'NO')} options={[
            { label: '常开 (NO)', value: 'NO' }, { label: '常闭 (NC)', value: 'NC' },
          ]} onChange={v => setProp('btn_type', v)} />
          <EditableRow label="操作力" value={String(merged.force ?? '1.6N')} onChange={v => setProp('force', v)} />
        </>
      );
    case 'sensor':
      return (
        <>
          <EditableRow label="型号" value={String(merged.model ?? 'DS18B20')} onChange={v => setProp('model', v)} />
          <EditableRow label="接口" value={String(merged.interface ?? '1-Wire')} onChange={v => setProp('interface', v)} />
          <EditableRow label="精度" value={String(merged.accuracy ?? '±0.5°C')} onChange={v => setProp('accuracy', v)} />
        </>
      );
    default:
      return (
        <>
          <EditableRow label="当前值" value={String(merged.value ?? '-') } onChange={v => setProp('value', v)} />
          <EditableRow label="标签" value={String(merged.label ?? '-') } onChange={v => setProp('label', v)} />
        </>
      );
  }
}

// ========== 组件 ==========
export function CodeEditor({ selectedElement, pinConfigs, onPinConfigChange, chipFamily, chipModel, wires, chipPins, importedFiles }: CodeEditorProps) {
  const [files, setFiles] = useState<VFile[]>([]);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<VirtualPanel>('properties');
  const [openPanels, setOpenPanels] = useState<Set<VirtualPanel>>(new Set(['properties']));
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [treeWidth, setTreeWidth] = useState(140);
  const [treeCollapsed, setTreeCollapsed] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);
  const [compilers, setCompilers] = useState<CompilerInfo[]>([]);
  // 右键菜单
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; filePath: string } | null>(null);
  // 重命名
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  // Tab 拖拽
  const [dragTab, setDragTab] = useState<string | null>(null);
  // 1b: 仿真状态定时刷新
  const [simTick, setSimTick] = useState(0);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const modelsRef = useRef<Map<string, monaco.editor.ITextModel>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastLoadedModelRef = useRef<string | null>(null);
  const editorMountedRef = useRef(false);
  const mountedRef = useRef(true);
  /** 用于 Ctrl+S 等闭包中访问最新 activeFile/files/chipModel */
  const activeFileRef = useRef(activeFile);
  const filesRef = useRef(files);
  const chipModelRef = useRef(chipModel);
  activeFileRef.current = activeFile;
  filesRef.current = files;
  chipModelRef.current = chipModel;

  const isCodeFile = activeFile && !activePanel;
  const currentFile = files.find(f => f.path === activeFile);

  // 标记用户是否已主动初始化（选择模板/导入文件/新建文件）
  const projectInitializedRef = useRef(false);

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

        // 编译成功后，解析代码并配置仿真行为
        if (result.success) {
          try {
            const { parseCode } = await import('../mcu/code-parser');
            const operations = parseCode(file.content, chipFamily);

            // 派发事件：让仿真引擎配置引脚行为
            window.dispatchEvent(new CustomEvent('chip-sim:code-compiled', {
              detail: { operations, chipFamily, chipModel }
            }));

            // 同时派发启动仿真事件
            window.dispatchEvent(new CustomEvent('chip-sim:start-simulation'));
          } catch (parseErr) {
            console.warn('代码解析失败，跳过仿真配置:', parseErr);
            // 即使解析失败，也启动仿真（用户可能手动配置了电路）
            window.dispatchEvent(new CustomEvent('chip-sim:start-simulation'));
          }
        }
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

  // 1b: 仿真状态定时刷新（500ms 间隔触发 re-render）
  useEffect(() => {
    const id = setInterval(() => setSimTick(t => t + 1), 500);
    return () => clearInterval(id);
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

    // 1a: LibraryReference 插入代码监听
    const onInsertCode = (e: Event) => {
      const code = (e as CustomEvent).detail;
      if (editorRef.current && code) {
        const model = editorRef.current.getModel();
        if (model) {
          const position = editorRef.current.getPosition();
          if (position) {
            editorRef.current.executeEdits('library-ref', [{
              range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
              text: code,
            }]);
          }
        }
      }
    };
    window.addEventListener('chip-sim:insert-code', onInsertCode);

    // 1c: Ctrl+S 快捷键 — 保存到 localStorage（按芯片型号隔离）
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      const currentModel = editor.getModel();
      if (currentModel) {
        const content = currentModel.getValue();
        const filePath = filesRef.current.find(f => f.path === activeFileRef.current)?.path;
        if (filePath) {
          try {
            const modelKey = (chipModelRef.current || 'default').toLowerCase();
            localStorage.setItem(`chip-sim-file-${modelKey}-${filePath}`, content);
          } catch (e) {
            console.warn('保存到 localStorage 失败:', e);
          }
        }
      }
    });

    const handler = () => monaco.editor.setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'chip-sim-dark' : 'vs');
    window.addEventListener('themechange', handler);
    return () => {
      window.removeEventListener('themechange', handler);
      window.removeEventListener('chip-sim:insert-code', onInsertCode);
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

  // 各芯片系列自动加载示例文件（仅在用户主动初始化后加载）
  useEffect(() => {
    if (!chipModel || !projectInitializedRef.current) return;
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

  // 导入的外部文件（从文件夹导入）
  useEffect(() => {
    if (!importedFiles || importedFiles.length === 0) return;
    projectInitializedRef.current = true;
    setFiles(importedFiles);
    setOpenTabs([importedFiles[0].path]);
    setActiveFile(importedFiles[0].path);
    setActivePanel(null);
    modelsRef.current.forEach(model => model.dispose());
    modelsRef.current.clear();
    lastLoadedModelRef.current = chipModel || 'imported';
  }, [importedFiles]);

  // 1c: 加载 localStorage 中已保存的文件内容（按芯片型号隔离，覆盖默认示例）
  useEffect(() => {
    if (files.length === 0 || !chipModel) return;
    const modelKey = chipModel.toLowerCase();
    setFiles(prev => prev.map(f => {
      const saved = localStorage.getItem(`chip-sim-file-${modelKey}-${f.path}`);
      if (saved !== null) {
        return { ...f, content: saved };
      }
      return f;
    }));
  }, [chipModel]); // 芯片型号变化时重新加载

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
    // 检查重复
    if (files.some(f => f.path === name)) {
      alert(`文件 "${name}" 已存在`);
      return;
    }
    projectInitializedRef.current = true;
    const lang = name.endsWith('.c') || name.endsWith('.h' ) ? 'c' : name.endsWith('.ino') ? 'c' : name.endsWith('.cpp') ? 'c' : name.endsWith('.py') ? 'python' : 'text';
    const newFile: VFile = { path: name, content: '', lang };
    setFiles(prev => [...prev, newFile]);
    openFile(name);
    setShowNewFileDialog(false);
    setNewFileName('');
  }, [newFileName, files, openFile]);

  const importFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    projectInitializedRef.current = true;
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

  // 右键菜单：重命名
  const handleRename = useCallback(() => {
    if (!contextMenu) return;
    setRenamingFile(contextMenu.filePath);
    const name = contextMenu.filePath.split('/').pop() || contextMenu.filePath;
    setRenameValue(name);
    setContextMenu(null);
  }, [contextMenu]);

  const confirmRename = useCallback(() => {
    if (!renamingFile || !renameValue.trim()) { setRenamingFile(null); return; }
    const newName = renameValue.trim();
    const parts = renamingFile.split('/');
    parts[parts.length - 1] = newName;
    const newPath = parts.join('/');
    if (newPath !== renamingFile && files.some(f => f.path === newPath)) {
      alert(`文件 "${newName}" 已存在`);
      setRenamingFile(null);
      return;
    }
    setFiles(prev => prev.map(f => f.path === renamingFile ? { ...f, path: newPath } : f));
    setOpenTabs(prev => prev.map(t => t === renamingFile ? newPath : t));
    if (activeFile === renamingFile) setActiveFile(newPath);
    // 更新 Monaco model
    const model = modelsRef.current.get(renamingFile);
    if (model) {
      modelsRef.current.delete(renamingFile);
      modelsRef.current.set(newPath, model);
    }
    setRenamingFile(null);
  }, [renamingFile, renameValue, files, activeFile]);

  // 右键菜单：删除
  const handleDelete = useCallback(() => {
    if (!contextMenu) return;
    const filePath = contextMenu.filePath;
    setContextMenu(null);
    if (!confirm(`确定删除文件 "${filePath}" 吗？`)) return;
    setFiles(prev => prev.filter(f => f.path !== filePath));
    setOpenTabs(prev => prev.filter(t => t !== filePath));
    if (activeFile === filePath) {
      const remaining = openTabs.filter(t => t !== filePath);
      setActiveFile(remaining.length > 0 ? remaining[remaining.length - 1] : null);
    }
    // 清理 Monaco model
    const model = modelsRef.current.get(filePath);
    if (model) { model.dispose(); modelsRef.current.delete(filePath); }
  }, [contextMenu, activeFile, openTabs]);

  // Tab 拖拽排序
  const handleTabDragStart = useCallback((path: string, e: React.DragEvent) => {
    setDragTab(path);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', path);
  }, []);

  const handleTabDragOver = useCallback((targetPath: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleTabDrop = useCallback((targetPath: string, e: React.DragEvent) => {
    e.preventDefault();
    const sourcePath = dragTab;
    if (!sourcePath || sourcePath === targetPath) return;
    setOpenTabs(prev => {
      const next = prev.filter(t => t !== sourcePath);
      const targetIdx = next.indexOf(targetPath);
      if (targetIdx === -1) return prev;
      next.splice(targetIdx, 0, sourcePath);
      return next;
    });
    setDragTab(null);
  }, [dragTab]);

  // Tab 中键关闭
  const handleTabMouseDown = useCallback((path: string, e: React.MouseEvent) => {
    if (e.button === 1) { // 中键
      e.preventDefault();
      setOpenTabs(prev => {
        const next = prev.filter(t => t !== path);
        if (activeFile === path) {
          setActiveFile(next.length > 0 ? next[next.length - 1] : null);
          setActivePanel(null);
        }
        return next;
      });
    }
  }, [activeFile]);

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
        {!treeCollapsed && (
          <div className="ide-file-tree" style={{ width: treeWidth, flexShrink: 0 }}>
            <div className="ide-tree-header">
              <span>信息</span>
              <button
                onClick={() => setTreeCollapsed(true)}
                title="收起文件树"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 11, padding: '0 2px' }}
              >◀</button>
            </div>
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
            const isRenaming = renamingFile === f.path;
            return (
              <div key={f.path}
                className={`ide-tree-file ${activeFile === f.path && !activePanel ? 'active' : ''}`}
                style={{ paddingLeft: 6 + (parts.length - 1) * 10 }}
                onClick={() => !isRenaming && openFile(f.path)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY, filePath: f.path });
                }}>
                {isRenaming ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setRenamingFile(null); }}
                    onBlur={confirmRename}
                    onClick={e => e.stopPropagation()}
                    style={{ width: '100%', fontSize: 11, padding: '0 2px', boxSizing: 'border-box' }}
                  />
                ) : (
                  <span>{parts[parts.length - 1]}</span>
                )}
              </div>
            );
          })}
        </div>
        )}

        {/* 右键菜单 */}
        {contextMenu && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setContextMenu(null)} />
            <div style={{
              position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 9999,
              background: 'var(--color-bg-input, #252536)', border: '1px solid var(--color-border, #444)',
              borderRadius: 6, padding: '4px 0', minWidth: 120, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}>
              <div
                style={{ padding: '6px 14px', cursor: 'pointer', fontSize: 12 }}
                onClick={handleRename}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >重命名</div>
              <div
                style={{ padding: '6px 14px', cursor: 'pointer', fontSize: 12, color: '#f87171' }}
                onClick={handleDelete}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >删除</div>
            </div>
          </>
        )}

        {/* 分隔线 */}
        {treeCollapsed ? (
          <button
            onClick={() => setTreeCollapsed(false)}
            title="展开文件树"
            style={{
              width: 24, flexShrink: 0, background: 'var(--sil-border, #d0d7de)', border: 'none',
              cursor: 'pointer', color: 'inherit', fontSize: 11, borderRadius: 0,
            }}
          >▶</button>
        ) : (
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
        )}

        {/* 编辑器区域 */}
        <div className="ide-editor-area">
          {/* 标签栏 — 只显示代码文件 */}
          <div className="ide-tab-bar">
            {openTabs.map(tab => (
              <div key={tab}
                className={`ide-tab ${activeFile === tab && !activePanel ? 'active' : ''} ${dragTab === tab ? 'ide-tab-dragging' : ''}`}
                onClick={() => openFile(tab)}
                onMouseDown={(e) => handleTabMouseDown(tab, e)}
                draggable
                onDragStart={(e) => handleTabDragStart(tab, e)}
                onDragOver={(e) => handleTabDragOver(tab, e)}
                onDrop={(e) => handleTabDrop(tab, e)}
              >
                <span>{tab.split('/').pop()}</span>
                <button className="ide-tab-close" onClick={(e) => closeTab(tab, e)}>×</button>
              </div>
            ))}
          </div>

          {/* 内容区 */}
          {activePanel === 'properties' && (() => {
            void simTick;
            return (
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

                  {/* 元件参数 — 动态可编辑 */}
                  <div className="prop-section">
                    <div className="prop-section-title">参数</div>
                    <ElementParams type={selectedElement.type} properties={selectedElement.properties} />
                  </div>

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
                    {(() => {
                      const simState = selectedElement.properties?.simState as Record<string, unknown> | undefined;
                      if (simState && Object.keys(simState).length > 0) {
                        return Object.entries(simState).map(([key, val]) => (
                          <div key={key} className="prop-row">
                            <span className="prop-label">{key}</span>
                            <span className="prop-value" style={{ color: '#4ade80' }}>{String(val)}</span>
                          </div>
                        ));
                      }
                      return <div className="prop-row"><span className="prop-label">状态</span><span className="prop-value">就绪</span></div>;
                    })()}
                  </div>
                </div>
              ) : (
                <div className="ide-empty"><p>点击画布上的元件查看属性</p></div>
              )}
            </div>
            );
          })()}

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
          {/* Monaco 编辑器 — 始终挂载，通过 display 控制可见性 */}
          <div ref={editorContainerRef} className="ide-monaco-container" style={{ display: isCodeFile ? '' : 'none' }} />

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
