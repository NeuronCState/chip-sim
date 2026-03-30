/** STM32 HAL 库函数速查数据 */

export interface LibEntry {
  /** 函数/寄存器/API 名称 */
  name: string;
  /** 分类标签 */
  category: string;
  /** 所属平台 */
  platform: 'stm32' | 'arduino' | 'mcs51';
  /** 简要描述 */
  description: string;
  /** 函数签名或用法 */
  signature: string;
  /** 参数说明 */
  params?: { name: string; desc: string }[];
  /** 返回值说明 */
  returns?: string;
  /** 使用示例代码 */
  example: string;
  /** 搜索关键词 */
  keywords: string[];
}

export const stm32HalFunctions: LibEntry[] = [
  // ═══════════════════════════════════════════
  //  GPIO
  // ═══════════════════════════════════════════
  {
    name: 'HAL_GPIO_Init',
    category: 'GPIO',
    platform: 'stm32',
    description: '初始化 GPIO 引脚模式、上下拉、速度',
    signature: 'void HAL_GPIO_Init(GPIO_TypeDef *GPIOx, GPIO_InitTypeDef *GPIO_Init)',
    params: [
      { name: 'GPIOx', desc: 'GPIO 端口 (GPIOA~GPIOG)' },
      { name: 'GPIO_Init', desc: '初始化结构体指针' },
    ],
    example: `GPIO_InitTypeDef gpio = {
  .Pin   = GPIO_PIN_5,
  .Mode  = GPIO_MODE_OUTPUT_PP,
  .Pull  = GPIO_NOPULL,
  .Speed = GPIO_SPEED_FREQ_LOW,
};
HAL_GPIO_Init(GPIOA, &gpio);`,
    keywords: ['gpio', 'init', '初始化', '引脚', '模式'],
  },
  {
    name: 'HAL_GPIO_WritePin',
    category: 'GPIO',
    platform: 'stm32',
    description: '设置 GPIO 引脚输出电平',
    signature: 'void HAL_GPIO_WritePin(GPIO_TypeDef *GPIOx, uint16_t GPIO_Pin, GPIO_PinState PinState)',
    params: [
      { name: 'GPIOx', desc: 'GPIO 端口' },
      { name: 'GPIO_Pin', desc: '引脚号 (GPIO_PIN_0 ~ GPIO_PIN_15)' },
      { name: 'PinState', desc: 'GPIO_PIN_SET / GPIO_PIN_RESET' },
    ],
    example: `HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_SET);   // 高电平
HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_RESET); // 低电平`,
    keywords: ['gpio', 'write', '输出', '高电平', '低电平', 'set', 'reset'],
  },
  {
    name: 'HAL_GPIO_ReadPin',
    category: 'GPIO',
    platform: 'stm32',
    description: '读取 GPIO 引脚输入电平',
    signature: 'GPIO_PinState HAL_GPIO_ReadPin(GPIO_TypeDef *GPIOx, uint16_t GPIO_Pin)',
    returns: 'GPIO_PIN_SET (1) 或 GPIO_PIN_RESET (0)',
    example: `GPIO_PinState state = HAL_GPIO_ReadPin(GPIOA, GPIO_PIN_0);
if (state == GPIO_PIN_SET) {
  // 按键按下
}`,
    keywords: ['gpio', 'read', '读取', '输入', '按键'],
  },
  {
    name: 'HAL_GPIO_TogglePin',
    category: 'GPIO',
    platform: 'stm32',
    description: '翻转 GPIO 引脚电平',
    signature: 'void HAL_GPIO_TogglePin(GPIO_TypeDef *GPIOx, uint16_t GPIO_Pin)',
    example: `HAL_GPIO_TogglePin(GPIOA, GPIO_PIN_5); // LED 闪烁`,
    keywords: ['gpio', 'toggle', '翻转', '闪烁', 'led'],
  },
  {
    name: '__HAL_RCC_GPIOx_CLK_ENABLE',
    category: 'GPIO',
    platform: 'stm32',
    description: '使能 GPIO 端口时钟（使用前必须开启）',
    signature: '__HAL_RCC_GPIOx_CLK_ENABLE()',
    example: `__HAL_RCC_GPIOA_CLK_ENABLE();
__HAL_RCC_GPIOB_CLK_ENABLE();`,
    keywords: ['rcc', 'clock', '时钟', '使能', 'enable'],
  },

  // ═══════════════════════════════════════════
  //  UART / USART
  // ═══════════════════════════════════════════
  {
    name: 'HAL_UART_Init',
    category: 'UART',
    platform: 'stm32',
    description: '初始化 UART 外设（波特率、数据位等）',
    signature: 'HAL_StatusTypeDef HAL_UART_Init(UART_HandleTypeDef *huart)',
    example: `UART_HandleTypeDef huart2;
huart2.Instance          = USART2;
huart2.Init.BaudRate     = 115200;
huart2.Init.WordLength   = UART_WORDLENGTH_8B;
huart2.Init.StopBits     = UART_STOPBITS_1;
huart2.Init.Parity       = UART_PARITY_NONE;
huart2.Init.Mode         = UART_MODE_TX_RX;
HAL_UART_Init(&huart2);`,
    keywords: ['uart', '串口', '初始化', '波特率', '115200'],
  },
  {
    name: 'HAL_UART_Transmit',
    category: 'UART',
    platform: 'stm32',
    description: '阻塞方式发送数据',
    signature: 'HAL_StatusTypeDef HAL_UART_Transmit(UART_HandleTypeDef *huart, uint8_t *pData, uint16_t Size, uint32_t Timeout)',
    params: [
      { name: 'huart', desc: 'UART 句柄' },
      { name: 'pData', desc: '发送数据缓冲区' },
      { name: 'Size', desc: '数据长度（字节）' },
      { name: 'Timeout', desc: '超时时间 (ms)' },
    ],
    example: `uint8_t msg[] = "Hello\\r\\n";
HAL_UART_Transmit(&huart2, msg, sizeof(msg)-1, 100);`,
    keywords: ['uart', 'transmit', '发送', 'tx', 'printf'],
  },
  {
    name: 'HAL_UART_Receive',
    category: 'UART',
    platform: 'stm32',
    description: '阻塞方式接收数据',
    signature: 'HAL_StatusTypeDef HAL_UART_Receive(UART_HandleTypeDef *huart, uint8_t *pData, uint16_t Size, uint32_t Timeout)',
    example: `uint8_t rx_buf[10];
HAL_UART_Receive(&huart2, rx_buf, 10, 1000);`,
    keywords: ['uart', 'receive', '接收', 'rx'],
  },
  {
    name: 'HAL_UART_Transmit_IT',
    category: 'UART',
    platform: 'stm32',
    description: '中断方式发送数据',
    signature: 'HAL_StatusTypeDef HAL_UART_Transmit_IT(UART_HandleTypeDef *huart, uint8_t *pData, uint16_t Size)',
    example: `uint8_t msg[] = "IT TX\\r\\n";
HAL_UART_Transmit_IT(&huart2, msg, sizeof(msg)-1);`,
    keywords: ['uart', '中断', '发送', 'it', 'interrupt'],
  },
  {
    name: 'HAL_UART_Receive_IT',
    category: 'UART',
    platform: 'stm32',
    description: '中断方式接收数据（需实现 HAL_UART_RxCpltCallback）',
    signature: 'HAL_StatusTypeDef HAL_UART_Receive_IT(UART_HandleTypeDef *huart, uint8_t *pData, uint16_t Size)',
    example: `uint8_t rx_byte;
HAL_UART_Receive_IT(&huart2, &rx_byte, 1);

void HAL_UART_RxCpltCallback(UART_HandleTypeDef *huart) {
  HAL_UART_Receive_IT(huart, &rx_byte, 1); // 重新开启
}`,
    keywords: ['uart', '中断', '接收', 'it', 'callback'],
  },

  // ═══════════════════════════════════════════
  //  SPI
  // ═══════════════════════════════════════════
  {
    name: 'HAL_SPI_Init',
    category: 'SPI',
    platform: 'stm32',
    description: '初始化 SPI 外设',
    signature: 'HAL_StatusTypeDef HAL_SPI_Init(SPI_HandleTypeDef *hspi)',
    example: `SPI_HandleTypeDef hspi1;
hspi1.Instance               = SPI1;
hspi1.Init.Mode              = SPI_MODE_MASTER;
hspi1.Init.Direction         = SPI_DIRECTION_2LINES;
hspi1.Init.DataSize          = SPI_DATASIZE_8BIT;
hspi1.Init.CLKPolarity       = SPI_POLARITY_LOW;
hspi1.Init.CLKPhase          = SPI_PHASE_1EDGE;
hspi1.Init.BaudRatePrescaler = SPI_BAUDRATEPRESCALER_16;
HAL_SPI_Init(&hspi1);`,
    keywords: ['spi', '初始化', 'master', '主机'],
  },
  {
    name: 'HAL_SPI_Transmit',
    category: 'SPI',
    platform: 'stm32',
    description: 'SPI 阻塞发送',
    signature: 'HAL_StatusTypeDef HAL_SPI_Transmit(SPI_HandleTypeDef *hspi, uint8_t *pData, uint16_t Size, uint32_t Timeout)',
    example: `uint8_t tx_data[4] = {0x01, 0x02, 0x03, 0x04};
HAL_SPI_Transmit(&hspi1, tx_data, 4, 100);`,
    keywords: ['spi', 'transmit', '发送', 'write'],
  },
  {
    name: 'HAL_SPI_Receive',
    category: 'SPI',
    platform: 'stm32',
    description: 'SPI 阻塞接收',
    signature: 'HAL_StatusTypeDef HAL_SPI_Receive(SPI_HandleTypeDef *hspi, uint8_t *pData, uint16_t Size, uint32_t Timeout)',
    example: `uint8_t rx_data[4];
HAL_SPI_Receive(&hspi1, rx_data, 4, 100);`,
    keywords: ['spi', 'receive', '接收', 'read'],
  },
  {
    name: 'HAL_SPI_TransmitReceive',
    category: 'SPI',
    platform: 'stm32',
    description: 'SPI 全双工同时收发',
    signature: 'HAL_StatusTypeDef HAL_SPI_TransmitReceive(SPI_HandleTypeDef *hspi, uint8_t *pTxData, uint8_t *pRxData, uint16_t Size, uint32_t Timeout)',
    example: `uint8_t tx[2] = {0x80, 0x00};
uint8_t rx[2];
HAL_SPI_TransmitReceive(&hspi1, tx, rx, 2, 100);`,
    keywords: ['spi', '全双工', '收发', 'duplex', 'transmit', 'receive'],
  },

  // ═══════════════════════════════════════════
  //  TIM (定时器)
  // ═══════════════════════════════════════════
  {
    name: 'HAL_TIM_Base_Init',
    category: 'TIM',
    platform: 'stm32',
    description: '初始化定时器基本功能',
    signature: 'HAL_StatusTypeDef HAL_TIM_Base_Init(TIM_HandleTypeDef *htim)',
    example: `TIM_HandleTypeDef htim2;
htim2.Instance       = TIM2;
htim2.Init.Prescaler = 72 - 1;       // 72MHz / 72 = 1MHz
htim2.Init.Period    = 1000 - 1;     // 1MHz / 1000 = 1kHz
htim2.Init.CounterMode = TIM_COUNTERMODE_UP;
HAL_TIM_Base_Init(&htim2);`,
    keywords: ['timer', '定时器', '初始化', 'prescaler', 'period', '频率'],
  },
  {
    name: 'HAL_TIM_Base_Start_IT',
    category: 'TIM',
    platform: 'stm32',
    description: '启动定时器中断',
    signature: 'HAL_StatusTypeDef HAL_TIM_Base_Start_IT(TIM_HandleTypeDef *htim)',
    example: `HAL_TIM_Base_Start_IT(&htim2);
// 实现回调:
void HAL_TIM_PeriodElapsedCallback(TIM_HandleTypeDef *htim) {
  if (htim->Instance == TIM2) {
    HAL_GPIO_TogglePin(GPIOA, GPIO_PIN_5);
  }
}`,
    keywords: ['timer', '定时器', '中断', 'start', 'it'],
  },
  {
    name: 'HAL_TIM_PWM_Start',
    category: 'TIM',
    platform: 'stm32',
    description: '启动 PWM 输出',
    signature: 'HAL_StatusTypeDef HAL_TIM_PWM_Start(TIM_HandleTypeDef *htim, uint32_t Channel)',
    example: `// 先配置 PWM 模式，再启动
__HAL_TIM_SET_COMPARE(&htim3, TIM_CHANNEL_1, 500); // 占空比
HAL_TIM_PWM_Start(&htim3, TIM_CHANNEL_1);`,
    keywords: ['timer', 'pwm', '输出', '占空比', '舵机', '电机'],
  },
  {
    name: '__HAL_TIM_SET_COMPARE',
    category: 'TIM',
    platform: 'stm32',
    description: '设置 PWM 比较值（控制占空比）',
    signature: '__HAL_TIM_SET_COMPARE(__HANDLE__, __CHANNEL__, __COMPARE__)',
    example: `// PWM 频率 = TIM_CLK / (PSC+1) / (ARR+1)
// 占空比 = CCR / (ARR+1)
__HAL_TIM_SET_COMPARE(&htim3, TIM_CHANNEL_1, 750); // 75%`,
    keywords: ['pwm', 'compare', '占空比', 'duty', 'ccr'],
  },
  {
    name: '__HAL_TIM_SET_COUNTER',
    category: 'TIM',
    platform: 'stm32',
    description: '设置定时器计数器当前值',
    signature: '__HAL_TIM_SET_COUNTER(__HANDLE__, __COUNTER__)',
    example: `__HAL_TIM_SET_COUNTER(&htim2, 0); // 从0开始计数`,
    keywords: ['timer', 'counter', '计数器', '重置'],
  },
  {
    name: 'HAL_TIM_IC_Start_IT',
    category: 'TIM',
    platform: 'stm32',
    description: '启动输入捕获（测频率/脉宽）',
    signature: 'HAL_StatusTypeDef HAL_TIM_IC_Start_IT(TIM_HandleTypeDef *htim, uint32_t Channel)',
    example: `HAL_TIM_IC_Start_IT(&htim2, TIM_CHANNEL_1);
void HAL_TIM_IC_CaptureCallback(TIM_HandleTypeDef *htim) {
  uint32_t capture = HAL_TIM_ReadCapturedValue(htim, TIM_CHANNEL_1);
}`,
    keywords: ['timer', '输入捕获', 'capture', '频率', '脉宽'],
  },

  // ═══════════════════════════════════════════
  //  ADC
  // ═══════════════════════════════════════════
  {
    name: 'HAL_ADC_Init',
    category: 'ADC',
    platform: 'stm32',
    description: '初始化 ADC 外设',
    signature: 'HAL_StatusTypeDef HAL_ADC_Init(ADC_HandleTypeDef *hadc)',
    example: `ADC_HandleTypeDef hadc1;
hadc1.Instance                   = ADC1;
hadc1.Init.ScanConvMode          = ADC_SCAN_DISABLE;
hadc1.Init.ContinuousConvMode    = DISABLE;
hadc1.Init.DataAlign             = ADC_DATAALIGN_RIGHT;
hadc1.Init.NbrOfConversion       = 1;
HAL_ADC_Init(&hadc1);`,
    keywords: ['adc', '初始化', '模数转换', 'analog'],
  },
  {
    name: 'HAL_ADC_ConfigChannel',
    category: 'ADC',
    platform: 'stm32',
    description: '配置 ADC 采样通道',
    signature: 'HAL_StatusTypeDef HAL_ADC_ConfigChannel(ADC_HandleTypeDef *hadc, ADC_ChannelConfTypeDef *sConfig)',
    example: `ADC_ChannelConfTypeDef ch;
ch.Channel      = ADC_CHANNEL_0;
ch.Rank         = 1;
ch.SamplingTime = ADC_SAMPLETIME_71CYCLES_5;
HAL_ADC_ConfigChannel(&hadc1, &ch);`,
    keywords: ['adc', 'channel', '通道', '采样'],
  },
  {
    name: 'HAL_ADC_Start',
    category: 'ADC',
    platform: 'stm32',
    description: '启动 ADC 转换',
    signature: 'HAL_StatusTypeDef HAL_ADC_Start(ADC_HandleTypeDef *hadc)',
    example: `HAL_ADC_Start(&hadc1);
HAL_ADC_PollForConversion(&hadc1, 100);
uint32_t val = HAL_ADC_GetValue(&hadc1); // 0~4095`,
    keywords: ['adc', 'start', '启动', '转换'],
  },
  {
    name: 'HAL_ADC_GetValue',
    category: 'ADC',
    platform: 'stm32',
    description: '获取 ADC 转换结果（12位: 0~4095）',
    signature: 'uint32_t HAL_ADC_GetValue(ADC_HandleTypeDef *hadc)',
    returns: '转换结果，12位 ADC 范围 0~4095',
    example: `uint32_t raw = HAL_ADC_GetValue(&hadc1);
float voltage = raw * 3.3f / 4096.0f;`,
    keywords: ['adc', 'value', '读取', '电压', '结果'],
  },
  {
    name: 'HAL_ADC_Start_IT',
    category: 'ADC',
    platform: 'stm32',
    description: '中断方式启动 ADC 转换',
    signature: 'HAL_StatusTypeDef HAL_ADC_Start_IT(ADC_HandleTypeDef *hadc)',
    example: `HAL_ADC_Start_IT(&hadc1);
void HAL_ADC_ConvCpltCallback(ADC_HandleTypeDef *hadc) {
  uint32_t val = HAL_ADC_GetValue(hadc);
}`,
    keywords: ['adc', '中断', 'it', 'interrupt', 'callback'],
  },

  // ═══════════════════════════════════════════
  //  I2C
  // ═══════════════════════════════════════════
  {
    name: 'HAL_I2C_Init',
    category: 'I2C',
    platform: 'stm32',
    description: '初始化 I2C 外设',
    signature: 'HAL_StatusTypeDef HAL_I2C_Init(I2C_HandleTypeDef *hi2c)',
    example: `I2C_HandleTypeDef hi2c1;
hi2c1.Instance             = I2C1;
hi2c1.Init.ClockSpeed      = 100000; // 100kHz
hi2c1.Init.DutyCycle       = I2C_DUTYCYCLE_2;
hi2c1.Init.OwnAddress1     = 0x00;
hi2c1.Init.AddressingMode  = I2C_ADDRESSINGMODE_7BIT;
HAL_I2C_Init(&hi2c1);`,
    keywords: ['i2c', '初始化', 'scl', 'sda', '100k'],
  },
  {
    name: 'HAL_I2C_Master_Transmit',
    category: 'I2C',
    platform: 'stm32',
    description: 'I2C 主机发送数据到从机',
    signature: 'HAL_StatusTypeDef HAL_I2C_Master_Transmit(I2C_HandleTypeDef *hi2c, uint16_t DevAddress, uint8_t *pData, uint16_t Size, uint32_t Timeout)',
    example: `uint8_t data[2] = {0x00, 0xFF};
HAL_I2C_Master_Transmit(&hi2c1, 0x50 << 1, data, 2, 100);`,
    keywords: ['i2c', 'transmit', '发送', '写入', '主机'],
  },
  {
    name: 'HAL_I2C_Master_Receive',
    category: 'I2C',
    platform: 'stm32',
    description: 'I2C 主机从从机接收数据',
    signature: 'HAL_StatusTypeDef HAL_I2C_Master_Receive(I2C_HandleTypeDef *hi2c, uint16_t DevAddress, uint8_t *pData, uint16_t Size, uint32_t Timeout)',
    example: `uint8_t buf[6];
HAL_I2C_Master_Receive(&hi2c1, 0x68 << 1, buf, 6, 100);`,
    keywords: ['i2c', 'receive', '接收', '读取', '主机'],
  },
  {
    name: 'HAL_I2C_Mem_Write',
    category: 'I2C',
    platform: 'stm32',
    description: 'I2C 写从机寄存器（常用：传感器配置）',
    signature: 'HAL_StatusTypeDef HAL_I2C_Mem_Write(I2C_HandleTypeDef *hi2c, uint16_t DevAddress, uint16_t MemAddress, uint16_t MemAddSize, uint8_t *pData, uint16_t Size, uint32_t Timeout)',
    example: `// MPU6050 唤醒
uint8_t val = 0x00;
HAL_I2C_Mem_Write(&hi2c1, 0x68 << 1, 0x6B, 1, &val, 1, 100);`,
    keywords: ['i2c', 'mem', 'write', '寄存器', '传感器', '配置'],
  },
  {
    name: 'HAL_I2C_Mem_Read',
    category: 'I2C',
    platform: 'stm32',
    description: 'I2C 读从机寄存器（常用：传感器数据读取）',
    signature: 'HAL_StatusTypeDef HAL_I2C_Mem_Read(I2C_HandleTypeDef *hi2c, uint16_t DevAddress, uint16_t MemAddress, uint16_t MemAddSize, uint8_t *pData, uint16_t Size, uint32_t Timeout)',
    example: `// MPU6050 读加速度
uint8_t accel[6];
HAL_I2C_Mem_Read(&hi2c1, 0x68 << 1, 0x3B, 1, accel, 6, 100);`,
    keywords: ['i2c', 'mem', 'read', '寄存器', '传感器', '数据'],
  },

  // ═══════════════════════════════════════════
  //  通用 HAL
  // ═══════════════════════════════════════════
  {
    name: 'HAL_Init',
    category: '系统',
    platform: 'stm32',
    description: 'HAL 库初始化（main 中第一个调用）',
    signature: 'HAL_StatusTypeDef HAL_Init(void)',
    example: `int main(void) {
  HAL_Init();
  SystemClock_Config();
  // ...`,
    keywords: ['hal', 'init', '初始化', '系统'],
  },
  {
    name: 'HAL_Delay',
    category: '系统',
    platform: 'stm32',
    description: '毫秒级阻塞延时',
    signature: 'void HAL_Delay(uint32_t Delay)',
    example: `HAL_Delay(500); // 延时 500ms`,
    keywords: ['delay', '延时', '毫秒', 'ms'],
  },
  {
    name: 'HAL_GetTick',
    category: '系统',
    platform: 'stm32',
    description: '获取系统 Tick 计数（ms）',
    signature: 'uint32_t HAL_GetTick(void)',
    returns: '系统启动后的毫秒数',
    example: `uint32_t start = HAL_GetTick();
while (HAL_GetTick() - start < 1000) {
  // 非阻塞等待 1s
}`,
    keywords: ['tick', '计时', '非阻塞', '时间戳'],
  },
  {
    name: 'HAL_NVIC_SetPriority',
    category: '系统',
    platform: 'stm32',
    description: '设置中断优先级',
    signature: 'void HAL_NVIC_SetPriority(IRQn_Type IRQn, uint32_t PreemptPriority, uint32_t SubPriority)',
    example: `HAL_NVIC_SetPriority(USART2_IRQn, 1, 0);
HAL_NVIC_EnableIRQ(USART2_IRQn);`,
    keywords: ['nvic', '中断', '优先级', 'priority'],
  },
  {
    name: 'HAL_NVIC_EnableIRQ',
    category: '系统',
    platform: 'stm32',
    description: '使能中断线',
    signature: 'void HAL_NVIC_EnableIRQ(IRQn_Type IRQn)',
    example: `HAL_NVIC_EnableIRQ(EXTI0_IRQn);`,
    keywords: ['nvic', 'enable', '使能', '中断'],
  },
];
