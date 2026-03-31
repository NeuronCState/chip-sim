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
  const scrollRef = useRef<HTMLDivElement>(null);

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
          <span className={styles.statusIndicator}>● 监听中</span>
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
              等待仿真 UART 数据输出...
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
