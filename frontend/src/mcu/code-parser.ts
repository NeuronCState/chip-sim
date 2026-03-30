// C 代码解析器 — V1 简化版，基于正则模式匹配

export interface ParsedOperation {
  type:
    | 'gpio_write'
    | 'gpio_read'
    | 'uart_send'
    | 'uart_recv'
    | 'timer_start'
    | 'timer_stop'
    | 'delay'
    | 'pwm_set'
    | 'adc_read'
    | 'unknown';
  target: string; // 如 'P1_0', 'PA5', 'GPIO2'
  value?: string; // 如 'HIGH', '0xFF', '128'
  raw: string; // 原始代码行
}

// ─── C51 模式 ───────────────────────────────────────────────

const c51PortAssign = /^\s*(P[0-3])\s*=\s*(0x[0-9a-fA-F]+|\d+)\s*;/; // P1 = 0xFF;
const c51PinAssign = /^\s*(P[0-3]_[0-7])\s*=\s*(0|1|0x[0-9a-fA-F]+)\s*;/; // P1_0 = 1;
const c51SfrWrite = /^\s*(TMOD|TCON|SCON|TH0|TL0|TH1|TL1|PCON|IE|IP|SBUF)\s*=\s*(0x[0-9a-fA-F]+|'.')\s*;/; // TMOD = 0x01;
const c51BitAssign = /^\s*(TR[01]|ET[01]|EA|ES|TI|RI)\s*=\s*(0|1)\s*;/; // TR0 = 1;

// ─── STM32 模式 ─────────────────────────────────────────────

const stm32GpioWrite =
  /^\s*HAL_GPIO_WritePin\(\s*(GPIO[A-Z])\s*,\s*(GPIO_PIN_\d+)\s*,\s*(GPIO_PIN_SET|GPIO_PIN_RESET)\s*\)\s*;/;
const stm32GpioToggle =
  /^\s*HAL_GPIO_TogglePin\(\s*(GPIO[A-Z])\s*,\s*(GPIO_PIN_\d+)\s*\)\s*;/;
const stm32GpioRead =
  /^\s*HAL_GPIO_ReadPin\(\s*(GPIO[A-Z])\s*,\s*(GPIO_PIN_\d+)\s*\)\s*;/;
const stm32UartTransmit =
  /^\s*HAL_UART_Transmit\(\s*(&huart\d+)\s*,\s*"([^"]*)"\s*,\s*(\d+)\s*,\s*(\d+)\s*\)\s*;/;
const stm32TimPwmStart =
  /^\s*HAL_TIM_PWM_Start\(\s*(&htim\d+)\s*,\s*(TIM_CHANNEL_\d+)\s*\)\s*;/;
const stm32TimBaseStart =
  /^\s*HAL_TIM_Base_Start(?:_IT)?\(\s*(&htim\d+)\s*\)\s*;/;
const stm32TimBaseStop =
  /^\s*HAL_TIM_Base_Stop(?:_IT)?\(\s*(&htim\d+)\s*\)\s*;/;
const stm32AdcStart =
  /^\s*HAL_ADC_Start\(\s*(&hadc\d+)\s*\)\s*;/;
const stm32AdcGetValue =
  /^\s*HAL_ADC_GetValue\(\s*(&hadc\d+)\s*\)\s*;/;

// ─── ESP32 模式 ─────────────────────────────────────────────

const esp32DigitalWrite =
  /^\s*digitalWrite\(\s*(\d+)\s*,\s*(HIGH|LOW)\s*\)\s*;/;
const esp32DigitalRead =
  /^\s*digitalRead\(\s*(\d+)\s*\)\s*;/;
const esp32AnalogRead =
  /^\s*analogRead\(\s*(\d+)\s*\)\s*;/;
const esp32SerialBegin =
  /^\s*Serial\.begin\(\s*(\d+)\s*\)\s*;/;
const esp32SerialPrintln =
  /^\s*Serial\.println\(\s*"([^"]*)"\s*\)\s*;/;
const esp32LedcWrite =
  /^\s*ledcWrite\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*;/;
const esp32Delay =
  /^\s*delay\(\s*(\d+)\s*\)\s*;/;

// ─── 通用延迟 ───────────────────────────────────────────────

const genericDelay = /^\s*(?:delay|Delay|HAL_Delay|vTaskDelay)\(\s*(\d+)\s*\)\s*;/;

// ─── 解析逻辑 ───────────────────────────────────────────────

export function parseCode(code: string, chipFamily: string): ParsedOperation[] {
  const operations: ParsedOperation[] = [];
  const lines = code.split('\n');

  const family = chipFamily.toUpperCase();

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      continue;
    }

    let op: ParsedOperation | null = null;

    // 先匹配通用延迟
    const delayMatch = trimmed.match(genericDelay);
    if (delayMatch) {
      operations.push({ type: 'delay', target: 'delay', value: delayMatch[1], raw: trimmed });
      continue;
    }

    switch (family) {
      case 'C51':
        op = parseC51(trimmed);
        break;
      case 'STM32':
        op = parseSTM32(trimmed);
        break;
      case 'ESP32':
        op = parseESP32(trimmed);
        break;
      default:
        // 尝试全部匹配
        op = parseC51(trimmed) ?? parseSTM32(trimmed) ?? parseESP32(trimmed);
    }

    if (op) {
      operations.push(op);
    }
  }

  return operations;
}

// ─── C51 解析 ───────────────────────────────────────────────

function parseC51(line: string): ParsedOperation | null {
  let m: RegExpMatchArray | null;

  if ((m = line.match(c51PortAssign))) {
    return { type: 'gpio_write', target: m[1], value: m[2], raw: line };
  }
  if ((m = line.match(c51PinAssign))) {
    return { type: 'gpio_write', target: m[1], value: m[2], raw: line };
  }
  if ((m = line.match(c51BitAssign))) {
    return { type: 'gpio_write', target: m[1], value: m[2], raw: line };
  }
  if ((m = line.match(c51SfrWrite))) {
    const name = m[1];
    const val = m[2];
    if (name === 'TR0' || name === 'TR1' || name === 'TMOD') {
      if (name.startsWith('TR') && val === '0') {
        return { type: 'timer_stop', target: name, value: val, raw: line };
      }
      return { type: 'timer_start', target: name, value: val, raw: line };
    }
    if (name === 'SCON' || name === 'SBUF') {
      if (name === 'SBUF') {
        return { type: 'uart_send', target: name, value: val, raw: line };
      }
      return { type: 'uart_send', target: name, value: val, raw: line };
    }
    return { type: 'gpio_write', target: name, value: val, raw: line };
  }

  return null;
}

// ─── STM32 解析 ─────────────────────────────────────────────

function parseSTM32(line: string): ParsedOperation | null {
  let m: RegExpMatchArray | null;

  if ((m = line.match(stm32GpioWrite))) {
    return { type: 'gpio_write', target: `${m[1]}_${m[2]}`, value: m[3], raw: line };
  }
  if ((m = line.match(stm32GpioToggle))) {
    return { type: 'gpio_write', target: `${m[1]}_${m[2]}`, value: 'TOGGLE', raw: line };
  }
  if ((m = line.match(stm32GpioRead))) {
    return { type: 'gpio_read', target: `${m[1]}_${m[2]}`, raw: line };
  }
  if ((m = line.match(stm32UartTransmit))) {
    return { type: 'uart_send', target: m[1], value: m[2], raw: line };
  }
  if ((m = line.match(stm32TimPwmStart))) {
    return { type: 'pwm_set', target: `${m[1]}_${m[2]}`, value: 'START', raw: line };
  }
  if ((m = line.match(stm32TimBaseStart))) {
    return { type: 'timer_start', target: m[1], raw: line };
  }
  if ((m = line.match(stm32TimBaseStop))) {
    return { type: 'timer_stop', target: m[1], raw: line };
  }
  if ((m = line.match(stm32AdcStart))) {
    return { type: 'adc_read', target: m[1], raw: line };
  }
  if ((m = line.match(stm32AdcGetValue))) {
    return { type: 'adc_read', target: m[1], value: 'GET', raw: line };
  }

  return null;
}

// ─── ESP32 解析 ─────────────────────────────────────────────

function parseESP32(line: string): ParsedOperation | null {
  let m: RegExpMatchArray | null;

  if ((m = line.match(esp32DigitalWrite))) {
    return { type: 'gpio_write', target: `GPIO${m[1]}`, value: m[2], raw: line };
  }
  if ((m = line.match(esp32DigitalRead))) {
    return { type: 'gpio_read', target: `GPIO${m[1]}`, raw: line };
  }
  if ((m = line.match(esp32AnalogRead))) {
    return { type: 'adc_read', target: `ADC${m[1]}`, raw: line };
  }
  if ((m = line.match(esp32SerialBegin))) {
    return { type: 'uart_send', target: 'Serial', value: `${m[1]} baud`, raw: line };
  }
  if ((m = line.match(esp32SerialPrintln))) {
    return { type: 'uart_send', target: 'Serial', value: m[1], raw: line };
  }
  if ((m = line.match(esp32LedcWrite))) {
    return { type: 'pwm_set', target: `LEDC_CH${m[1]}`, value: m[2], raw: line };
  }
  if ((m = line.match(esp32Delay))) {
    return { type: 'delay', target: 'delay', value: m[1], raw: line };
  }

  return null;
}
