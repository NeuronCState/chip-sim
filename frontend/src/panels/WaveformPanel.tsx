/** 波形面板 — Canvas 绘制多通道波形 */
import { useRef, useEffect, useState } from 'react';
import { Panel, Segmented } from '../ui';

/* ── 类型 ───────────────────────────────── */

interface WaveformChannel {
  label: string;
  color: string;
  data: number[]; // 0-1 范围的电压值
}

/* ── 模拟波形数据 ───────────────────────── */

function generateSine(freq: number, phase: number, len: number): number[] {
  return Array.from({ length: len }, (_, i) =>
    0.5 + 0.45 * Math.sin(2 * Math.PI * freq * (i / len) + phase)
  );
}

function generateSquare(freq: number, phase: number, len: number): number[] {
  return Array.from({ length: len }, (_, i) =>
    Math.sin(2 * Math.PI * freq * (i / len) + phase) >= 0 ? 0.9 : 0.1
  );
}

function generateSawtooth(freq: number, phase: number, len: number): number[] {
  return Array.from({ length: len }, (_, i) => {
    const t = ((i / len) * freq + phase / (2 * Math.PI)) % 1;
    return 0.1 + 0.8 * t;
  });
}

const POINT_COUNT = 500;

const CHANNELS: WaveformChannel[] = [
  { label: 'PA0 (ADC)', color: 'var(--sil-mint)', data: generateSine(3, 0, POINT_COUNT) },
  { label: 'PA2 (UART TX)', color: 'var(--sil-ocean)', data: generateSquare(8, 0, POINT_COUNT) },
  { label: 'PB0 (PWM)', color: 'var(--sil-peach)', data: generateSawtooth(5, 0, POINT_COUNT) },
  { label: 'PA5 (SPI CLK)', color: 'var(--sil-danger)', data: generateSquare(12, Math.PI / 4, POINT_COUNT) },
];

/* ── 绘制函数 ───────────────────────────── */

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  channels: WaveformChannel[],
  activeChannels: boolean[],
  timeOffset: number,
) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const bgGrid = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
  const axisColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';
  const textColor = isDark ? '#8ab0c4' : '#5a707a';

  ctx.clearRect(0, 0, width, height);

  /* 背景 */
  ctx.fillStyle = isDark ? '#0d1b22' : '#f4f8fb';
  ctx.fillRect(0, 0, width, height);

  /* 网格 */
  const padLeft = 40;
  const padRight = 16;
  const padTop = 20;
  const padBottom = 30;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  ctx.strokeStyle = bgGrid;
  ctx.lineWidth = 1;

  // 水平网格线 + 电压标签
  for (let i = 0; i <= 4; i++) {
    const y = padTop + (plotH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(padLeft + plotW, y);
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${((4 - i) * 0.825).toFixed(1)}V`, padLeft - 6, y + 3);
  }

  // 垂直网格线 + 时间标签
  for (let i = 0; i <= 10; i++) {
    const x = padLeft + (plotW * i) / 10;
    ctx.beginPath();
    ctx.moveTo(x, padTop);
    ctx.lineTo(x, padTop + plotH);
    ctx.stroke();

    if (i % 2 === 0) {
      ctx.fillStyle = textColor;
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      const ms = ((timeOffset + i * 0.5) * 10).toFixed(0);
      ctx.fillText(`${ms}ms`, x, padTop + plotH + 16);
    }
  }

  // 坐标轴
  ctx.strokeStyle = axisColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padLeft, padTop);
  ctx.lineTo(padLeft, padTop + plotH);
  ctx.lineTo(padLeft + plotW, padTop + plotH);
  ctx.stroke();

  /* 波形 */
  channels.forEach((ch, ci) => {
    if (!activeChannels[ci]) return;
    ctx.strokeStyle = ch.color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ch.data.forEach((v, i) => {
      const x = padLeft + (i / (ch.data.length - 1)) * plotW;
      const y = padTop + plotH - v * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });
}

/* ── 主组件 ─────────────────────────────── */

export function WaveformPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeChannels, setActiveChannels] = useState([true, true, false, false]);
  const [hoveredChannel, setHoveredChannel] = useState<string | null>(null);

  const toggleChannel = (idx: number) => {
    setActiveChannels(prev => prev.map((v, i) => (i === idx ? !v : v)));
  };

  /* Canvas 渲染 */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    drawWaveform(ctx, rect.width, rect.height, CHANNELS, activeChannels, 0);
  }, [activeChannels]);

  /* 窗口尺寸变化时重绘 */
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      drawWaveform(ctx, rect.width, rect.height, CHANNELS, activeChannels, 0);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeChannels]);

  return (
    <Panel>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* 通道切换 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}>
          {CHANNELS.map((ch, i) => (
            <button
              key={i}
              onClick={() => toggleChannel(i)}
              onMouseEnter={() => setHoveredChannel(ch.label)}
              onMouseLeave={() => setHoveredChannel(null)}
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 12px',
                borderRadius: 20,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'inherit',
                background: activeChannels[i] ? ch.color : 'var(--sil-surface-pressed)',
                color: activeChannels[i] ? '#fff' : 'var(--sil-text-soft)',
                opacity: activeChannels[i] ? 1 : 0.6,
                transition: 'all var(--sil-transition-spring)',
                boxShadow: activeChannels[i] ? 'var(--sil-shadow-soft)' : 'none',
              }}
            >
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: activeChannels[i] ? '#fff' : ch.color,
              }} />
              {ch.label}
            </button>
          ))}
        </div>

        {/* 画布 */}
        <div style={{
          flex: 1,
          minHeight: 200,
          borderRadius: 'var(--sil-radius-sm)',
          overflow: 'hidden',
          boxShadow: 'var(--sil-shadow-pressed)',
          position: 'relative',
        }}>
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
          {hoveredChannel && (
            <div style={{
              position: 'absolute',
              top: 8,
              right: 12,
              fontSize: 11,
              color: 'var(--sil-text-soft)',
              background: 'var(--sil-surface-glass)',
              padding: '3px 8px',
              borderRadius: 6,
            }}>
              {hoveredChannel}
            </div>
          )}
        </div>

        {/* 轴标签 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 6,
          fontSize: 10,
          color: 'var(--sil-text-soft)',
        }}>
          <span>← 时间 (ms)</span>
          <span>电压 (V) →</span>
        </div>
      </div>
    </Panel>
  );
}
