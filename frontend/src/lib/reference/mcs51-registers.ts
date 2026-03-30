/** MCS-51 (8051) 寄存器速查数据 */
import type { LibEntry } from './stm32-hal';

export const mcs51Registers: LibEntry[] = [
  // ═══════════════════════════════════════════
  //  并行 I/O 端口
  // ═══════════════════════════════════════════
  {
    name: 'P0',
    category: 'IO端口',
    platform: 'mcs51',
    description: 'P0 端口寄存器（地址 80H，位寻址）',
    signature: 'sfr P0 = 0x80;',
    example: `// P0 口输出 0xFF（全部高电平）
P0 = 0xFF;

// 单位操作（P0.0 接 LED）
P0_0 = 0;  // LED 亮（低电平驱动）
P0_0 = 1;  // LED 灭`,
    keywords: ['p0', '端口', 'io', '输出', '输入', '80h'],
  },
  {
    name: 'P1',
    category: 'IO端口',
    platform: 'mcs51',
    description: 'P1 端口寄存器（地址 90H，位寻址）— 无外部总线功能',
    signature: 'sfr P1 = 0x90;',
    example: `// 读 P1 口状态
unsigned char val = P1;

// P1.0 接按键
if (P1_0 == 0) {
  // 按键按下
}`,
    keywords: ['p1', '端口', 'io', '90h', '按键'],
  },
  {
    name: 'P2',
    category: 'IO端口',
    platform: 'mcs51',
    description: 'P2 端口寄存器（地址 A0H，位寻址）',
    signature: 'sfr P2 = 0xA0;',
    example: `// P2 口常用于外部存储器高8位地址
P2 = 0xFE;`,
    keywords: ['p2', '端口', 'io', 'a0h', '地址'],
  },
  {
    name: 'P3',
    category: 'IO端口',
    platform: 'mcs51',
    description: 'P3 端口寄存器（地址 B0H，位寻址）— 具有第二功能',
    signature: 'sfr P3 = 0xB0;',
    example: `// P3 第二功能：
// P3.0 = RXD (串口接收)
// P3.1 = TXD (串口发送)
// P3.2 = INT0 (外部中断0)
// P3.3 = INT1 (外部中断1)
// P3.4 = T0 (定时器0外部输入)
// P3.5 = T1 (定时器1外部输入)
// P3.6 = WR (外部RAM写)
// P3.7 = RD (外部RAM读)

P3 = 0xFF;  // 作为普通 IO`,
    keywords: ['p3', '端口', 'io', 'b0h', 'rxd', 'txd', 'int', '第二功能'],
  },

  // ═══════════════════════════════════════════
  //  定时器/计数器
  // ═══════════════════════════════════════════
  {
    name: 'TMOD',
    category: '定时器',
    platform: 'mcs51',
    description: '定时器模式寄存器（地址 89H，不可位寻址）',
    signature: 'sfr TMOD = 0x89;',
    example: `// TMOD 格式: [GATE|C/T|M1|M0|GATE|C/T|M1|M0]
//            高4位 = Timer1  低4位 = Timer0

// Timer0: 模式1 (16位定时器)
TMOD = 0x01;

// Timer0: 模式2 (8位自动重装)
TMOD = 0x02;

// Timer0 定时 + Timer1 计数
TMOD = 0x51;`,
    keywords: ['tmod', '定时器', '模式', '89h', '16位', '8位'],
  },
  {
    name: 'TCON',
    category: '定时器',
    platform: 'mcs51',
    description: '定时器控制寄存器（地址 88H，可位寻址）',
    signature: 'sfr TCON = 0x88;',
    example: `// TCON 位: TF1 TR1 TF0 TR0 IE1 IT1 IE0 IT0
// TFx = 溢出标志  TRx = 运行控制

// 启动 Timer0
TR0 = 1;

// Timer0 溢出时 TF0 自动置1
if (TF0 == 1) {
  TF0 = 0;         // 清标志
  // 重装初值
  TH0 = 0xFC;
  TL0 = 0x18;
}`,
    keywords: ['tcon', '定时器', '控制', '88h', '启动', '溢出', 'tr0', 'tf0'],
  },
  {
    name: 'TH0 / TL0',
    category: '定时器',
    platform: 'mcs51',
    description: 'Timer0 高/低字节（TH0: 8CH, TL0: 8AH）',
    signature: 'sfr TH0 = 0x8C; sfr TL0 = 0x8A;',
    example: `// 11.0592MHz 晶振, 定时 1ms
// 初值 = 65536 - 11059200/12/1000 = 65536-921 = 64615 = 0xFC67
TH0 = 0xFC;
TL0 = 0x67;`,
    keywords: ['th0', 'tl0', '定时器', '初值', '计数', '重装'],
  },
  {
    name: 'TH1 / TL1',
    category: '定时器',
    platform: 'mcs51',
    description: 'Timer1 高/低字节（TH1: 8DH, TL1: 8BH）',
    signature: 'sfr TH1 = 0x8D; sfr TL1 = 0x8B;',
    example: `// Timer1 用于波特率生成
// 模式2: 8位自动重装
// 9600 bps @ 11.0592MHz
// TH1 = 256 - 11059200/32/12/9600 = 256-3 = 253 = 0xFD
TH1 = 0xFD;`,
    keywords: ['th1', 'tl1', '定时器', '波特率'],
  },

  // ═══════════════════════════════════════════
  //  串口 (UART)
  // ═══════════════════════════════════════════
  {
    name: 'SCON',
    category: '串口',
    platform: 'mcs51',
    description: '串口控制寄存器（地址 98H，可位寻址）',
    signature: 'sfr SCON = 0x98;',
    example: `// SCON 位: SM0 SM1 SM2 REN TB8 RB8 TI RI
// SM0 SM1 = 模式选择

// 模式1 (8位UART, 可变波特率)
SCON = 0x50;  // SM1=1, REN=1 (允许接收)

// 模式1 + 允许接收
SCON = 0x50;

// 查询方式发送
SBUF = 'A';   // 写入发送缓冲
while (TI == 0);  // 等待发送完成
TI = 0;           // 清发送标志

// 查询方式接收
while (RI == 0);  // 等待接收完成
unsigned char ch = SBUF;
RI = 0;           // 清接收标志`,
    keywords: ['scon', '串口', '控制', '98h', '模式', 'uart', 'ren', 'ti', 'ri'],
  },
  {
    name: 'SBUF',
    category: '串口',
    platform: 'mcs51',
    description: '串口数据缓冲寄存器（地址 99H，发送/接收共用）',
    signature: 'sfr SBUF = 0x99;',
    example: `// 发送一个字节
SBUF = 0x41;  // 发送 'A'
while (!TI);
TI = 0;

// 接收一个字节
while (!RI);
unsigned char data = SBUF;
RI = 0;`,
    keywords: ['sbuf', '串口', '数据', '缓冲', '99h', '发送', '接收'],
  },
  {
    name: 'PCON',
    category: '电源',
    platform: 'mcs51',
    description: '电源控制寄存器（地址 87H）— SMOD 位影响波特率',
    signature: 'sfr PCON = 0x87;',
    example: `// SMOD = 1: 波特率翻倍
PCON |= 0x80;  // SMOD 置1

// 空闲模式
PCON |= 0x01;  // IDL = 1

// 掉电模式
PCON |= 0x02;  // PD = 1`,
    keywords: ['pcon', '电源', '87h', 'smod', '波特率', '空闲', '掉电'],
  },

  // ═══════════════════════════════════════════
  //  中断系统
  // ═══════════════════════════════════════════
  {
    name: 'IE',
    category: '中断',
    platform: 'mcs51',
    description: '中断使能寄存器（地址 A8H，可位寻址）',
    signature: 'sfr IE = 0xA8;',
    example: `// IE 位: EA - - ES ET1 EX1 ET0 EX0
// EA = 总开关

// 开启总中断 + Timer0中断
IE = 0x82;  // EA=1, ET0=1

// 或使用位操作
EA = 1;  // 总中断使能
ET0 = 1; // Timer0 中断使能
ES = 1;  // 串口中断使能`,
    keywords: ['ie', '中断', '使能', 'a8h', 'ea', '总开关'],
  },
  {
    name: 'IP',
    category: '中断',
    platform: 'mcs51',
    description: '中断优先级寄存器（地址 B8H，可位寻址）',
    signature: 'sfr IP = 0xB8;',
    example: `// IP 位: - - PS PT1 PX1 PT0 PX0
// 1 = 高优先级, 0 = 低优先级

// 串口中断设为高优先级
PS = 1;

// Timer0 高优先级
PT0 = 1;`,
    keywords: ['ip', '中断', '优先级', 'b8h', 'ps', 'pt0'],
  },
  {
    name: 'TCON (中断位)',
    category: '中断',
    platform: 'mcs51',
    description: 'TCON 中的外部中断控制位（IE0/IE1/IT0/IT1）',
    signature: 'TCON 低4位: IE1 IT1 IE0 IT0',
    example: `// IT0 = 1: 外部中断0 下降沿触发
IT0 = 1;

// IT0 = 0: 外部中断0 低电平触发
IT0 = 0;

// IE0: 外部中断0 请求标志 (硬件自动置1)
if (IE0) {
  IE0 = 0; // 清标志
}`,
    keywords: ['tcon', '中断', '外部', '触发', 'it0', 'ie0', '下降沿'],
  },

  // ═══════════════════════════════════════════
  //  堆栈指针与数据指针
  // ═══════════════════════════════════════════
  {
    name: 'SP',
    category: '堆栈',
    platform: 'mcs51',
    description: '堆栈指针寄存器（地址 81H）',
    signature: 'sfr SP = 0x81;',
    example: `// 复位后 SP = 07H
// 建议改为 0x60 以上，避免占用寄存器区
SP = 0x60;`,
    keywords: ['sp', '堆栈', '指针', '81h'],
  },
  {
    name: 'DPL / DPH',
    category: '堆栈',
    platform: 'mcs51',
    description: '数据指针低/高字节（DPL: 82H, DPH: 83H）',
    signature: 'sfr DPL = 0x82; sfr DPH = 0x83;',
    example: `// 指向外部 RAM 地址 0x1234
DPH = 0x12;
DPL = 0x34;

// 使用 DPTR 查表
unsigned char code table[] = {0x3F, 0x06, 0x5B, 0x4F};
DPTR = (unsigned int)table;
unsigned char val;
__asm
  MOVC A, @A+DPTR
  MOV _val, A
__endasm;`,
    keywords: ['dpl', 'dph', 'dptr', '数据指针', '外部', 'ram', '查表'],
  },

  // ═══════════════════════════════════════════
  //  累加器与程序状态字
  // ═══════════════════════════════════════════
  {
    name: 'ACC',
    category: 'CPU',
    platform: 'mcs51',
    description: '累加器 A（地址 E0H，可位寻址）',
    signature: 'sfr ACC = 0xE0;',
    example: `// 汇编中常用 A 表示
// C 语言中通过 ACC 访问
ACC = 0x55;
unsigned char val = ACC;`,
    keywords: ['acc', 'a', '累加器', 'e0h'],
  },
  {
    name: 'B',
    category: 'CPU',
    platform: 'mcs51',
    description: 'B 寄存器（地址 F0H，可位寻址）— 乘除法使用',
    signature: 'sfr B = 0xF0;',
    example: `// 乘法: A × B → BA (高8位在B, 低8位在A)
// 除法: A ÷ B → A(商) B(余数)
ACC = 10;
B = 20;
// MUL AB → B=0, A=200 (10×20=200)`,
    keywords: ['b', '寄存器', 'f0h', '乘法', '除法'],
  },
  {
    name: 'PSW',
    category: 'CPU',
    platform: 'mcs51',
    description: '程序状态字寄存器（地址 D0H，可位寻址）',
    signature: 'sfr PSW = 0xD0;',
    example: `// PSW 位: CY AC F0 RS1 RS0 OV - P
// CY = 进位标志
// RS1 RS0 = 寄存器区选择
//   00=区0(R0-R7@00-07H)
//   01=区1(R0-R7@08-0FH)
//   10=区2(R0-R7@10-17H)
//   11=区3(R0-R7@18-1FH)

// 选择寄存器区1
PSW = (PSW & 0xE7) | 0x08;

if (CY) {
  // 有进位
}`,
    keywords: ['psw', '程序状态', 'd0h', '进位', '寄存器区', 'cy', 'ov'],
  },

  // ═══════════════════════════════════════════
  //  看门狗
  // ═══════════════════════════════════════════
  {
    name: 'WDT_CONTR',
    category: '看门狗',
    platform: 'mcs51',
    description: '看门狗定时器控制寄存器（STC 系列增强型）',
    signature: 'sfr WDT_CONTR = 0xC1;',
    example: `// EN_WDT = 1: 使能看门狗
// CLR_WDT = 1: 喂狗
// IDLE_WDT = 1: 空闲时计数
// PS2~PS0: 预分频

// 使能看门狗, 约2s溢出
WDT_CONTR = 0x35;  // EN=1, IDLE=1, PS=101(256分频)

// 喂狗
WDT_CONTR |= 0x10; // CLR_WDT = 1`,
    keywords: ['wdt', '看门狗', 'watchdog', '喂狗', '溢出', '复位'],
  },

  // ═══════════════════════════════════════════
  //  中断向量表
  // ═══════════════════════════════════════════
  {
    name: '中断向量表',
    category: '中断',
    platform: 'mcs51',
    description: 'MCS-51 中断源与入口地址',
    signature: 'interrupt 0~4 对应5个基本中断',
    example: `// 中断号    中断源          入口地址
// 0         外部中断0 INT0  0003H
// 1         Timer0 溢出     000BH
// 2         外部中断1 INT1  0013H
// 3         Timer1 溢出     001BH
// 4         串口 RI/TI      0023H

// C51 中断服务函数
void Timer0_ISR() interrupt 1 {
  TH0 = 0xFC;
  TL0 = 0x67;
  // 定时处理
}

void UART_ISR() interrupt 4 {
  if (RI) {
    RI = 0;
    unsigned char ch = SBUF;
  }
}`,
    keywords: ['中断', '向量', '入口', 'interrupt', 'isr', '服务函数'],
  },

  // ═══════════════════════════════════════════
  //  常用 SFR 速查
  // ═══════════════════════════════════════════
  {
    name: 'SFR 地址速查表',
    category: '速查',
    platform: 'mcs51',
    description: '常用特殊功能寄存器地址一览',
    signature: 'sfr 名称 = 地址;',
    example: `// ┌──────────┬──────┬────────────────┐
// │ 寄存器   │ 地址 │ 用途           │
// ├──────────┼──────┼────────────────┤
// │ P0       │ 0x80 │ 端口0          │
// │ SP       │ 0x81 │ 堆栈指针       │
// │ DPL/DPH  │ 0x82 │ 数据指针       │
// │ TCON     │ 0x88 │ 定时器控制     │
// │ TMOD     │ 0x89 │ 定时器模式     │
// │ TL0/TH0  │ 0x8A │ Timer0 计数    │
// │ TL1/TH1  │ 0x8B │ Timer1 计数    │
// │ P1       │ 0x90 │ 端口1          │
// │ SCON     │ 0x98 │ 串口控制       │
// │ SBUF     │ 0x99 │ 串口数据       │
// │ P2       │ 0xA0 │ 端口2          │
// │ IE       │ 0xA8 │ 中断使能       │
// │ P3       │ 0xB0 │ 端口3          │
// │ IP       │ 0xB8 │ 中断优先级     */
// │ PCON     │ 0x87 │ 电源控制       │
// │ PSW      │ 0xD0 │ 程序状态字     │
// │ ACC      │ 0xE0 │ 累加器         │
// │ B        │ 0xF0 │ B 寄存器       │
// └──────────┴──────┴────────────────┘`,
    keywords: ['sfr', '地址', '速查', '特殊功能', '寄存器', '表'],
  },
];
