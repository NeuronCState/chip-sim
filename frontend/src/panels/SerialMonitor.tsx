/** 串口监视器 — UART 输出与输入（逐字弹出动画） */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Panel, Button, Input, Dropdown, Toggle } from '../ui';
import styles from './SerialMonitor.module.css';

/* ── 常量 ───────────────────────────────── */

const BAUD_RATES = [
  { value: '9600', label: '9600' },
  { value: '19200', label: '19200' },
  { value: '38400', label: '38400' },
  { value: '57600', label: '57600' },
  { value: '115200', label: '115200' },
  { value: '230400', label: '230400' },
  { value: '460800', label: '460800' },
  { value: '921600', label: '921600' },
] as const;

/* 模拟串口输出数据 */
const MOCK_LINES = [
  '[BOOT] STM32F103C8T6 初始化完成',
  '[SYS]  时钟频率: 72 MHz',
  '[GPIO] PA0 配置为输出模式',
  '[UART] USART2 波特率 115200',
  '[ADC]  通道 0 校准完成',
  '[INFO] 系统就绪，等待指令...',
  '[DATA] ADC CH0 = 2048 (1.65V)',
  '[DATA] ADC CH0 = 2103 (1.68V)',
  '[DATA] ADC CH0 = 1987 (1.62V)',
  '[GPIO] PA0 翻转 → HIGH',
  '[GPIO] PA0 翻转 → LOW',
  '[DATA] ADC CH0 = 2051 (1.65V)',
  '[UART] 收到命令: LED_ON',
  '[GPIO] PC13 输出 LOW (LED ON)',
  '[UART] 收到命令: STATUS',
  '[UART] 发送: OK 72MHz 3.3V',
];

/* ── 逐字动画行组件 ─────────────────────── */

interface TypewriterLineProps {
  text: string;
  charDelay?: number;
  onComplete?: () => void;
}

function TypewriterLine({ text, charDelay = 18, onComplete }: TypewriterLineProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setVisibleCount(0);
    let idx = 0;
    const tick = () => {
      idx++;
      setVisibleCount(idx);
      if (idx < text.length) {
        timerRef.current = setTimeout(tick, charDelay);
      } else {
        onComplete?.();
      }
    };
    timerRef.current = setTimeout(tick, charDelay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text, charDelay, onComplete]);

  return (
    <div className={styles.line}>
      <span>{text.slice(0, visibleCount)}</span>
      {visibleCount < text.length && <span className={styles.cursor} />}
    </div>
  );
}

/* ── 主组件 ─────────────────────────────── */

export function SerialMonitor() {
  const [lines, setLines] = useState<string[]>([]);
  /** 待逐字显示的队列 */
  const [pendingLines, setPendingLines] = useState<string[]>([]);
  /** 当前正在逐字显示的行 */
  const [typingLine, setTypingLine] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [baudRate, setBaudRate] = useState('115200');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lineIdx = useRef(0);

  /* 自动滚动 */
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, typingLine, autoScroll]);

  /* 处理逐字队列：当没有正在打字的行时，从队列取出下一行 */
  useEffect(() => {
    if (!typingLine && pendingLines.length > 0) {
      const next = pendingLines[0];
      setPendingLines(prev => prev.slice(1));
      setTypingLine(next);
    }
  }, [typingLine, pendingLines]);

  /* 一行打字完成 */
  const handleLineComplete = useCallback(() => {
    if (typingLine) {
      setLines(prev => [...prev, typingLine]);
      setTypingLine(null);
    }
  }, [typingLine]);

  /* 模拟串口数据 → 加入逐字队列 */
  const startSimulation = useCallback(() => {
    setIsRunning(true);
    lineIdx.current = 0;
    timerRef.current = setInterval(() => {
      const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      const line = MOCK_LINES[lineIdx.current % MOCK_LINES.length];
      setPendingLines(prev => [...prev, `[${ts}] ${line}`]);
      lineIdx.current += 1;
    }, 1200); // 每行间隔 1.2s
  }, []);

  const stopSimulation = useCallback(() => {
    setIsRunning(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  /* 监听仿真引擎 UART 输出事件 */
  useEffect(() => {
    const handleUARTOutput = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail || !detail.data) return;
      const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      const baudInfo = detail.baudRate ? ` @${detail.baudRate}` : '';
      setPendingLines(prev => [...prev, `[${ts}]${baudInfo} ${detail.data}`]);
    };

    window.addEventListener('chip-sim:uart-output', handleUARTOutput);
    return () => window.removeEventListener('chip-sim:uart-output', handleUARTOutput);
  }, []);

  /* 发送 */
  const handleSend = () => {
    if (!input.trim()) return;
    const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    setPendingLines(prev => [...prev, `[${ts}] TX → ${input.trim()}`]);
    setInput('');
  };

  const handleClear = () => {
    setLines([]);
    setPendingLines([]);
    setTypingLine(null);
  };

  return (
    <Panel>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* 工具栏 */}
        <div className={styles.toolbar}>
          <Dropdown
            options={[...BAUD_RATES]}
            value={baudRate}
            onChange={setBaudRate}
          />
          <Button
            variant={isRunning ? 'danger' : 'primary'}
            size="sm"
            onClick={isRunning ? stopSimulation : startSimulation}
          >
            {isRunning ? '停止' : '开始'}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClear}>
            清空
          </Button>
          <div className={styles.toolbarRight}>
            <span className={styles.toolbarLabel}>自动滚动</span>
            <Toggle checked={autoScroll} onChange={setAutoScroll} />
          </div>
        </div>

        {/* 输出区域 */}
        <div ref={scrollRef} className={styles.output}>
          {lines.length === 0 && !typingLine && pendingLines.length === 0 && (
            <div className={styles.emptyHint}>
              等待 UART 数据... 点击"开始"模拟串口输出
            </div>
          )}
          {/* 已完成的行 */}
          {lines.map((line, i) => (
            <div key={i} className={styles.line}>{line}</div>
          ))}
          {/* 正在逐字显示的行 */}
          {typingLine && (
            <TypewriterLine
              text={typingLine}
              charDelay={22}
              onComplete={handleLineComplete}
            />
          )}
          {/* 队列等待指示 */}
          {pendingLines.length > 0 && !typingLine && (
            <div className={styles.queueHint}>
              ⏳ 等待 {pendingLines.length} 行数据...
            </div>
          )}
        </div>

        {/* 输入区 */}
        <div className={styles.inputRow}>
          <Input
            placeholder="输入要发送的数据..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
            clearable
            onClear={() => setInput('')}
            className={styles.inputField}
          />
          <Button variant="primary" size="sm" onClick={handleSend} disabled={!input.trim()}>
            发送
          </Button>
        </div>
      </div>
    </Panel>
  );
}
