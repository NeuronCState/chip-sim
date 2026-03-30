/** Arduino API 速查数据 */
import type { LibEntry } from './stm32-hal';

export const arduinoApiFunctions: LibEntry[] = [
  // ═══════════════════════════════════════════
  //  数字 I/O
  // ═══════════════════════════════════════════
  {
    name: 'pinMode',
    category: '数字IO',
    platform: 'arduino',
    description: '设置引脚为输入或输出模式',
    signature: 'void pinMode(uint8_t pin, uint8_t mode)',
    params: [
      { name: 'pin', desc: '引脚编号 (0~13, A0~A5)' },
      { name: 'mode', desc: 'INPUT / OUTPUT / INPUT_PULLUP' },
    ],
    example: `pinMode(13, OUTPUT);      // LED引脚设为输出
pinMode(2, INPUT_PULLUP); // 按键引脚设为带上拉输入`,
    keywords: ['pin', 'mode', '引脚', '输入', '输出', '上拉'],
  },
  {
    name: 'digitalWrite',
    category: '数字IO',
    platform: 'arduino',
    description: '设置数字引脚输出电平',
    signature: 'void digitalWrite(uint8_t pin, uint8_t val)',
    params: [
      { name: 'pin', desc: '引脚编号' },
      { name: 'val', desc: 'HIGH (5V) / LOW (0V)' },
    ],
    example: `digitalWrite(13, HIGH);  // LED亮
digitalWrite(13, LOW);   // LED灭`,
    keywords: ['digital', 'write', '输出', '高电平', '低电平', 'led'],
  },
  {
    name: 'digitalRead',
    category: '数字IO',
    platform: 'arduino',
    description: '读取数字引脚电平',
    signature: 'int digitalRead(uint8_t pin)',
    returns: 'HIGH (1) 或 LOW (0)',
    example: `int btnState = digitalRead(2);
if (btnState == LOW) {
  // 按键按下（INPUT_PULLUP 低有效）
}`,
    keywords: ['digital', 'read', '读取', '按键', '输入'],
  },
  {
    name: 'analogRead',
    category: '模拟IO',
    platform: 'arduino',
    description: '读取模拟引脚值（10位ADC: 0~1023）',
    signature: 'int analogRead(uint8_t pin)',
    returns: '0~1023 对应 0~5V（UNO/Nano）',
    example: `int val = analogRead(A0);
float voltage = val * 5.0 / 1023.0;`,
    keywords: ['analog', 'read', '读取', 'adc', '电压', '传感器'],
  },
  {
    name: 'analogWrite',
    category: '模拟IO',
    platform: 'arduino',
    description: 'PWM 输出（~引脚支持）',
    signature: 'void analogWrite(uint8_t pin, int val)',
    params: [
      { name: 'pin', desc: '支持 PWM 的引脚 (3, 5, 6, 9, 10, 11)' },
      { name: 'val', desc: '0~255 (占空比 0~100%)' },
    ],
    example: `analogWrite(9, 128);  // 50% 占空比
analogWrite(9, 255); // 100%`,
    keywords: ['analog', 'write', 'pwm', '占空比', '舵机', '调光'],
  },

  // ═══════════════════════════════════════════
  //  时间
  // ═══════════════════════════════════════════
  {
    name: 'delay',
    category: '时间',
    platform: 'arduino',
    description: '毫秒级阻塞延时',
    signature: 'void delay(unsigned long ms)',
    example: `delay(1000); // 延时 1 秒`,
    keywords: ['delay', '延时', '等待', 'ms', '毫秒'],
  },
  {
    name: 'delayMicroseconds',
    category: '时间',
    platform: 'arduino',
    description: '微秒级精确延时',
    signature: 'void delayMicroseconds(unsigned int us)',
    example: `delayMicroseconds(10); // 延时 10 微秒`,
    keywords: ['delay', '微秒', 'us', '精确'],
  },
  {
    name: 'millis',
    category: '时间',
    platform: 'arduino',
    description: '获取程序运行毫秒数（约50天溢出）',
    signature: 'unsigned long millis(void)',
    returns: '系统启动以来的毫秒数',
    example: `unsigned long start = millis();
while (millis() - start < 5000) {
  // 非阻塞等待 5 秒
}`,
    keywords: ['millis', '计时', '毫秒', '非阻塞'],
  },
  {
    name: 'micros',
    category: '时间',
    platform: 'arduino',
    description: '获取程序运行微秒数',
    signature: 'unsigned long micros(void)',
    returns: '系统启动以来的微秒数（精度 4μs）',
    example: `unsigned long t = micros();
// ... 执行操作 ...
unsigned long elapsed = micros() - t;`,
    keywords: ['micros', '计时', '微秒', '精度'],
  },

  // ═══════════════════════════════════════════
  //  Serial (UART)
  // ═══════════════════════════════════════════
  {
    name: 'Serial.begin',
    category: 'Serial',
    platform: 'arduino',
    description: '初始化串口通信',
    signature: 'void Serial.begin(long baudrate)',
    example: `void setup() {
  Serial.begin(9600);    // 常用波特率
  Serial.begin(115200);  // 高速
}`,
    keywords: ['serial', 'begin', '串口', '初始化', '波特率'],
  },
  {
    name: 'Serial.print',
    category: 'Serial',
    platform: 'arduino',
    description: '串口输出数据（不换行）',
    signature: 'void Serial.print(val, format)',
    example: `Serial.print("Hello");
Serial.print(42);
Serial.print(3.14, 2);   // 保留2位小数
Serial.print(255, HEX);  // 十六进制`,
    keywords: ['serial', 'print', '串口', '输出', '调试'],
  },
  {
    name: 'Serial.println',
    category: 'Serial',
    platform: 'arduino',
    description: '串口输出数据并换行',
    signature: 'void Serial.println(val, format)',
    example: `Serial.println("Hello World");
Serial.println(analogRead(A0));`,
    keywords: ['serial', 'println', '串口', '输出', '换行'],
  },
  {
    name: 'Serial.available',
    category: 'Serial',
    platform: 'arduino',
    description: '检查串口接收缓冲区是否有数据',
    signature: 'int Serial.available(void)',
    returns: '缓冲区中可读字节数',
    example: `if (Serial.available() > 0) {
  char c = Serial.read();
}`,
    keywords: ['serial', 'available', '串口', '接收', '缓冲'],
  },
  {
    name: 'Serial.read',
    category: 'Serial',
    platform: 'arduino',
    description: '读取串口接收的一个字节',
    signature: 'int Serial.read(void)',
    returns: '收到的字节 (-1 表示无数据)',
    example: `while (Serial.available()) {
  char ch = Serial.read();
  Serial.print(ch);
}`,
    keywords: ['serial', 'read', '串口', '读取', '接收'],
  },
  {
    name: 'Serial.readString',
    category: 'Serial',
    platform: 'arduino',
    description: '读取串口接收的字符串',
    signature: 'String Serial.readString(void)',
    example: `String cmd = Serial.readString();
if (cmd == "LED_ON") {
  digitalWrite(13, HIGH);
}`,
    keywords: ['serial', 'readString', '串口', '字符串', '命令'],
  },

  // ═══════════════════════════════════════════
  //  Wire (I2C)
  // ═══════════════════════════════════════════
  {
    name: 'Wire.begin',
    category: 'Wire (I2C)',
    platform: 'arduino',
    description: '初始化 I2C（主机模式或指定从机地址）',
    signature: 'void Wire.begin(uint8_t address)',
    example: `Wire.begin();           // 主机模式
Wire.begin(0x20);       // 从机模式，地址 0x20`,
    keywords: ['wire', 'begin', 'i2c', '初始化', '主机', '从机'],
  },
  {
    name: 'Wire.beginTransmission',
    category: 'Wire (I2C)',
    platform: 'arduino',
    description: '开始 I2C 传输（指定从机地址）',
    signature: 'void Wire.beginTransmission(uint8_t address)',
    example: `Wire.beginTransmission(0x68); // MPU6050`,
    keywords: ['wire', 'transmission', 'i2c', '开始', '地址'],
  },
  {
    name: 'Wire.write',
    category: 'Wire (I2C)',
    platform: 'arduino',
    description: '向 I2C 发送数据',
    signature: 'size_t Wire.write(uint8_t data)',
    example: `Wire.beginTransmission(0x68);
Wire.write(0x6B);  // 寄存器地址
Wire.write(0x00);  // 写入值
Wire.endTransmission();`,
    keywords: ['wire', 'write', 'i2c', '写入', '发送'],
  },
  {
    name: 'Wire.endTransmission',
    category: 'Wire (I2C)',
    platform: 'arduino',
    description: '结束 I2C 传输',
    signature: 'uint8_t Wire.endTransmission(uint8_t stop)',
    returns: '0=成功, 其他=错误码',
    example: `Wire.endTransmission();    // 发送停止信号
Wire.endTransmission(0); // 不发送停止信号`,
    keywords: ['wire', 'end', 'transmission', 'i2c', '停止'],
  },
  {
    name: 'Wire.requestFrom',
    category: 'Wire (I2C)',
    platform: 'arduino',
    description: '从 I2C 从机请求数据',
    signature: 'uint8_t Wire.requestFrom(uint8_t address, uint8_t quantity)',
    example: `Wire.requestFrom(0x68, 6); // 从MPU6050读6字节
while (Wire.available()) {
  byte b = Wire.read();
}`,
    keywords: ['wire', 'request', 'i2c', '请求', '读取'],
  },
  {
    name: 'Wire.read',
    category: 'Wire (I2C)',
    platform: 'arduino',
    description: '读取 I2C 接收到的数据',
    signature: 'int Wire.read(void)',
    example: `int highByte = Wire.read();
int lowByte  = Wire.read();
int16_t accelX = (highByte << 8) | lowByte;`,
    keywords: ['wire', 'read', 'i2c', '读取', '数据'],
  },

  // ═══════════════════════════════════════════
  //  SPI
  // ═══════════════════════════════════════════
  {
    name: 'SPI.begin',
    category: 'SPI',
    platform: 'arduino',
    description: '初始化 SPI 总线（设置 SCK/MOSI/MISO 为对应模式）',
    signature: 'void SPI.begin(void)',
    example: `#include <SPI.h>
void setup() {
  SPI.begin();
  pinMode(10, OUTPUT); // SS 引脚
}`,
    keywords: ['spi', 'begin', '初始化', '总线'],
  },
  {
    name: 'SPI.beginTransaction',
    category: 'SPI',
    platform: 'arduino',
    description: '开始 SPI 事务（设置时钟、顺序、模式）',
    signature: 'void SPI.beginTransaction(SPISettings settings)',
    example: `SPISettings settings(1000000, MSBFIRST, SPI_MODE0);
SPI.beginTransaction(settings);
digitalWrite(10, LOW);  // 选中从机`,
    keywords: ['spi', 'transaction', '事务', '配置', '时钟'],
  },
  {
    name: 'SPI.transfer',
    category: 'SPI',
    platform: 'arduino',
    description: 'SPI 传输一个字节（同时收发）',
    signature: 'uint8_t SPI.transfer(uint8_t data)',
    example: `digitalWrite(10, LOW);
byte response = SPI.transfer(0x42); // 发送0x42, 收到响应
digitalWrite(10, HIGH);`,
    keywords: ['spi', 'transfer', '传输', '全双工', '收发'],
  },
  {
    name: 'SPI.endTransaction',
    category: 'SPI',
    platform: 'arduino',
    description: '结束 SPI 事务并释放总线',
    signature: 'void SPI.endTransaction(void)',
    example: `SPI.endTransaction();
digitalWrite(10, HIGH); // 释放从机`,
    keywords: ['spi', 'end', 'transaction', '结束', '释放'],
  },

  // ═══════════════════════════════════════════
  //  中断
  // ═══════════════════════════════════════════
  {
    name: 'attachInterrupt',
    category: '中断',
    platform: 'arduino',
    description: '绑定外部中断回调函数',
    signature: 'void attachInterrupt(uint8_t pin, void (*)(), int mode)',
    params: [
      { name: 'pin', desc: '中断引脚 (2, 3 对应 INT0, INT1)' },
      { name: 'mode', desc: 'LOW / CHANGE / RISING / FALLING' },
    ],
    example: `volatile bool flag = false;
void isr() { flag = true; }

void setup() {
  attachInterrupt(digitalPinToInterrupt(2), isr, FALLING);
}`,
    keywords: ['attach', 'interrupt', '中断', '外部', '回调', 'isr'],
  },
  {
    name: 'detachInterrupt',
    category: '中断',
    platform: 'arduino',
    description: '解除外部中断绑定',
    signature: 'void detachInterrupt(uint8_t pin)',
    example: `detachInterrupt(digitalPinToInterrupt(2));`,
    keywords: ['detach', 'interrupt', '解除', '中断'],
  },

  // ═══════════════════════════════════════════
  //  其他常用
  // ═══════════════════════════════════════════
  {
    name: 'map',
    category: '数学',
    platform: 'arduino',
    description: '将值从一个范围映射到另一个范围',
    signature: 'long map(long x, long in_min, long in_max, long out_min, long out_max)',
    example: `int sensorVal = analogRead(A0);      // 0~1023
int pwmVal = map(sensorVal, 0, 1023, 0, 255); // 映射到PWM`,
    keywords: ['map', '映射', '范围', '转换', '比例'],
  },
  {
    name: 'constrain',
    category: '数学',
    platform: 'arduino',
    description: '将值限制在指定范围内',
    signature: 'constrain(x, a, b)',
    example: `int val = constrain(sensorVal, 0, 100);`,
    keywords: ['constrain', '限制', '范围', '钳位'],
  },
  {
    name: 'tone',
    category: '声音',
    platform: 'arduino',
    description: '在引脚上生成指定频率的方波（驱动蜂鸣器）',
    signature: 'void tone(uint8_t pin, unsigned int frequency, unsigned long duration)',
    example: `tone(8, 1000, 500); // 引脚8, 1kHz, 持续500ms
tone(8, 262);        // 中音Do`,
    keywords: ['tone', '蜂鸣器', '频率', '声音', '方波'],
  },
  {
    name: 'noTone',
    category: '声音',
    platform: 'arduino',
    description: '停止 tone 产生的方波',
    signature: 'void noTone(uint8_t pin)',
    example: `noTone(8); // 停止发声`,
    keywords: ['noTone', '停止', '蜂鸣器', '静音'],
  },
  {
    name: 'pulseIn',
    category: '脉冲',
    platform: 'arduino',
    description: '测量脉冲持续时间（微秒）',
    signature: 'unsigned long pulseIn(uint8_t pin, uint8_t value, unsigned long timeout)',
    example: `// 超声波测距
digitalWrite(trigPin, HIGH);
delayMicroseconds(10);
digitalWrite(trigPin, LOW);
long duration = pulseIn(echoPin, HIGH);
float dist = duration * 0.034 / 2; // cm`,
    keywords: ['pulseIn', '脉冲', '超声波', '距离', '测距'],
  },
  {
    name: 'digitalPinToInterrupt',
    category: '中断',
    platform: 'arduino',
    description: '将数字引脚编号转换为中断编号',
    signature: 'uint8_t digitalPinToInterrupt(uint8_t pin)',
    example: `int intNum = digitalPinToInterrupt(2); // UNO: INT0`,
    keywords: ['interrupt', 'pin', '引脚', '中断号'],
  },
];
