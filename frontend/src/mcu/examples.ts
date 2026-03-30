import { parseCode, type ParsedOperation } from './code-parser';

export interface Example {
  id: string;
  name: string;
  chipFamily: 'C51' | 'STM32' | 'ESP32';
  description: string;
  code: string;
  operations: ParsedOperation[];
}

// ─── C51 示例 ───────────────────────────────────────────────

const c51FlowLed: Example = {
  id: 'c51-flow-led',
  name: 'C51 LED 流水灯',
  chipFamily: 'C51',
  description: 'P1 口 8 个 LED 依次点亮，形成流水灯效果',
  code: `// 流水灯 — P1 口 8 个 LED 依次点亮
#include <reg52.h>

void delay(unsigned int ms) {
    unsigned int i, j;
    for (i = 0; i < ms; i++)
        for (j = 0; j < 120; j++);
}

void main() {
    unsigned char led = 0x01;
    while (1) {
        P1 = 0xFF;
        P1 = ~led;
        delay(500);
        led = led << 1;
        if (led == 0x00) led = 0x01;
    }
}`,
  operations: [],
};

const c51KeyDetect: Example = {
  id: 'c51-key-detect',
  name: 'C51 按键检测',
  chipFamily: 'C51',
  description: '检测 P3_2 按键，按下时点亮 P1_0 LED',
  code: `// 按键检测
#include <reg52.h>

sbit KEY = P3^2;
sbit LED = P1^0;

void main() {
    P1_0 = 1;  // LED 初始熄灭
    while (1) {
        if (KEY == 0) {
            P1_0 = 0;  // 按下，点亮 LED
        } else {
            P1_0 = 1;  // 松开，熄灭 LED
        }
    }
}`,
  operations: [],
};

const c51TimerInt: Example = {
  id: 'c51-timer-int',
  name: 'C51 定时器中断',
  chipFamily: 'C51',
  description: 'Timer0 定时 50ms，中断中翻转 P1_0 LED',
  code: `// 定时器中断
#include <reg52.h>

sbit LED = P1^0;
unsigned char count = 0;

void Timer0_Init() {
    TMOD = 0x01;   // Timer0 模式 1
    TH0 = 0xFC;    // 定时 1ms
    TL0 = 0x18;
    ET0 = 1;       // 使能 Timer0 中断
    EA = 1;        // 开总中断
    TR0 = 1;       // 启动 Timer0
}

void Timer0_ISR() interrupt 1 {
    TH0 = 0xFC;
    TL0 = 0x18;
    count++;
    if (count >= 50) {
        count = 0;
        P1_0 = !P1_0;  // 翻转 LED
    }
}

void main() {
    Timer0_Init();
    while (1);
}`,
  operations: [],
};

const c51UartComm: Example = {
  id: 'c51-uart-comm',
  name: 'C51 串口通信',
  chipFamily: 'C51',
  description: '通过串口发送字符串 "Hello"',
  code: `// 串口通信
#include <reg52.h>

void UART_Init() {
    TMOD = 0x20;   // Timer1 模式 2
    TH1 = 0xFD;    // 波特率 9600
    TL1 = 0xFD;
    SCON = 0x50;   // 串口模式 1
    TR1 = 1;       // 启动 Timer1
}

void UART_SendChar(char c) {
    SBUF = c;
    while (TI == 0);
    TI = 0;
}

void main() {
    UART_Init();
    UART_SendChar('H');
    UART_SendChar('e');
    UART_SendChar('l');
    UART_SendChar('l');
    UART_SendChar('o');
    while (1);
}`,
  operations: [],
};

// ─── STM32 示例 ─────────────────────────────────────────────

const stm32LedBlink: Example = {
  id: 'stm32-led-blink',
  name: 'STM32 LED 闪烁',
  chipFamily: 'STM32',
  description: '使用 HAL 库翻转 PA5 引脚上的 LED',
  code: `// STM32 LED 闪烁 — PA5
#include "stm32f1xx_hal.h"

int main(void) {
    HAL_Init();
    SystemClock_Config();

    __HAL_RCC_GPIOA_CLK_ENABLE();
    GPIO_InitTypeDef gpio = {0};
    gpio.Pin = GPIO_PIN_5;
    gpio.Mode = GPIO_MODE_OUTPUT_PP;
    HAL_GPIO_Init(GPIOA, &gpio);

    while (1) {
        HAL_GPIO_TogglePin(GPIOA, GPIO_PIN_5);
        HAL_Delay(500);
    }
}`,
  operations: [],
};

const stm32PwmServo: Example = {
  id: 'stm32-pwm-servo',
  name: 'STM32 PWM 舵机控制',
  chipFamily: 'STM32',
  description: '使用 TIM2 通道 1 输出 PWM 控制舵机角度',
  code: `// STM32 PWM 舵机控制
#include "stm32f1xx_hal.h"

TIM_HandleTypeDef htim2;

void TIM2_Init(void) {
    __HAL_RCC_TIM2_CLK_ENABLE();
    htim2.Instance = TIM2;
    htim2.Init.Prescaler = 72 - 1;
    htim2.Init.CounterMode = TIM_COUNTERMODE_UP;
    htim2.Init.Period = 20000 - 1;
    HAL_TIM_PWM_Init(&htim2);

    TIM_OC_InitTypeDef oc = {0};
    oc.OCMode = TIM_OCMODE_PWM1;
    oc.Pulse = 1500;  // 中位 1.5ms
    HAL_TIM_PWM_ConfigChannel(&htim2, &oc, TIM_CHANNEL_1);
}

int main(void) {
    HAL_Init();
    SystemClock_Config();
    TIM2_Init();
    HAL_TIM_PWM_Start(&htim2, TIM_CHANNEL_1);

    while (1) {
        HAL_Delay(1000);
    }
}`,
  operations: [],
};

const stm32UartPrint: Example = {
  id: 'stm32-uart-print',
  name: 'STM32 串口打印',
  chipFamily: 'STM32',
  description: '通过 UART1 发送 "Hello STM32"',
  code: `// STM32 串口打印
#include "stm32f1xx_hal.h"

UART_HandleTypeDef huart1;

int main(void) {
    HAL_Init();
    SystemClock_Config();

    __HAL_RCC_USART1_CLK_ENABLE();
    huart1.Instance = USART1;
    huart1.Init.BaudRate = 115200;
    huart1.Init.WordLength = UART_WORDLENGTH_8B;
    HAL_UART_Init(&huart1);

    HAL_UART_Transmit(&huart1, "Hello STM32", 11, 100);

    while (1) {
        HAL_Delay(1000);
    }
}`,
  operations: [],
};

const stm32AdcRead: Example = {
  id: 'stm32-adc-read',
  name: 'STM32 ADC 读取',
  chipFamily: 'STM32',
  description: '读取 ADC1 通道 0 的模拟电压值',
  code: `// STM32 ADC 读取
#include "stm32f1xx_hal.h"

ADC_HandleTypeDef hadc1;

void ADC1_Init(void) {
    __HAL_RCC_ADC1_CLK_ENABLE();
    hadc1.Instance = ADC1;
    hadc1.Init.ScanConvMode = ADC_SCAN_DISABLE;
    hadc1.Init.ContinuousConvMode = DISABLE;
    HAL_ADC_Init(&hadc1);
}

int main(void) {
    HAL_Init();
    SystemClock_Config();
    ADC1_Init();

    while (1) {
        HAL_ADC_Start(&hadc1);
        HAL_ADC_PollForConversion(&hadc1, 100);
        uint32_t value = HAL_ADC_GetValue(&hadc1);
        HAL_Delay(500);
    }
}`,
  operations: [],
};

// ─── ESP32 示例 ─────────────────────────────────────────────

const esp32WifiSensor: Example = {
  id: 'esp32-wifi-sensor',
  name: 'ESP32 WiFi 传感器',
  chipFamily: 'ESP32',
  description: '连接 WiFi 并读取模拟传感器数据通过串口发送',
  code: `// ESP32 WiFi 传感器
#include <WiFi.h>

const char* ssid = "MyWiFi";
const char* password = "12345678";

void setup() {
    Serial.begin(115200);
    Serial.println("Connecting to WiFi...");
    WiFi.begin(ssid, password);
    Serial.println("WiFi Connected");
}

void loop() {
    int sensorValue = analogRead(34);
    Serial.println("Sensor read OK");
    delay(2000);
}`,
  operations: [],
};

const esp32BleLed: Example = {
  id: 'esp32-ble-led',
  name: 'ESP32 蓝牙控制 LED',
  chipFamily: 'ESP32',
  description: '通过 BLE 接收指令控制 GPIO2 上的 LED',
  code: `// ESP32 蓝牙控制 LED
#include <BLEDevice.h>
#include <BLEServer.h>

#define LED_PIN 2

void setup() {
    Serial.begin(115200);
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);
    BLEDevice::init("ESP32-BLE-LED");
    Serial.println("BLE LED Ready");
}

void loop() {
    // 模拟收到 BLE 指令
    digitalWrite(2, HIGH);
    delay(500);
    digitalWrite(2, LOW);
    delay(500);
}`,
  operations: [],
};

// ─── 示例集合 ───────────────────────────────────────────────

const rawExamples: Example[] = [
  c51FlowLed,
  c51KeyDetect,
  c51TimerInt,
  c51UartComm,
  stm32LedBlink,
  stm32PwmServo,
  stm32UartPrint,
  stm32AdcRead,
  esp32WifiSensor,
  esp32BleLed,
];

// 预解析所有示例的操作序列
export const examples: Example[] = rawExamples.map((ex) => ({
  ...ex,
  operations: parseCode(ex.code, ex.chipFamily),
}));

export function getExampleById(id: string): Example | undefined {
  return examples.find((e) => e.id === id);
}

export function getExamplesByChipFamily(family: string): Example[] {
  return examples.filter((e) => e.chipFamily === family);
}
