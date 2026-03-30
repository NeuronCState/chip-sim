/** 寄存器面板 — MCU 外设寄存器状态（模拟） */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Panel, Toggle, Segmented, Tabs } from '../ui';

/* ── 类型 ───────────────────────────────── */

type Peripheral = 'gpio' | 'uart' | 'timer' | 'adc';

interface GpioPort {
  name: string;
  bits: boolean[];
}

interface UartConfig {
  baudRate: number;
  dataBits: number;
  stopBits: number;
  parity: 'none' | 'even' | 'odd';
}

interface TimerConfig {
  mode: 'up' | 'down' | 'center';
  prescaler: number;
  reload: number;
}

interface AdcConfig {
  channels: boolean[];
  resolution: number;
}

/* ── 模拟数据 ───────────────────────────── */

function generateGpioBits(): boolean[] {
  return Array.from({ length: 16 }, () => Math.random() > 0.6);
}

const INITIAL_GPIO: GpioPort[] = [
  { name: 'GPIOA', bits: generateGpioBits() },
  { name: 'GPIOB', bits: generateGpioBits() },
  { name: 'GPIOC', bits: generateGpioBits() },
];

const INITIAL_UART: UartConfig = {
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
};

const INITIAL_TIMER: TimerConfig = {
  mode: 'up',
  prescaler: 72,
  reload: 1000,
};

const INITIAL_ADC: AdcConfig = {
  channels: [true, true, false, false, true, false, false, false],
  resolution: 12,
};

/* ── 子组件 ─────────────────────────────── */

function BitField({ bits, onChange }: { bits: boolean[]; onChange: (i: number) => void }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(8, 1fr)',
      gap: 6,
    }}>
      {bits.map((bit, i) => (
        <div key={i} style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
        }}>
          <span style={{ fontSize: 10, color: 'var(--sil-text-soft)', fontWeight: 600 }}>{15 - i}</span>
          <Toggle checked={bit} onChange={() => onChange(15 - i)} />
        </div>
      ))}
    </div>
  );
}

function LabelValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '6px 0',
      borderBottom: '1px solid var(--sil-panel-dark)',
    }}>
      <span style={{ fontSize: 12, color: 'var(--sil-text-soft)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--sil-text-main)' }}>{children}</span>
    </div>
  );
}

/* ── 主组件 ─────────────────────────────── */

interface Props {
  chipModel: string;
}

export function RegisterPanel({ chipModel: _chipModel }: Props) {
  const [gpio, setGpio] = useState<GpioPort[]>(INITIAL_GPIO);
  const [uart] = useState<UartConfig>(INITIAL_UART);
  const [timer] = useState<TimerConfig>(INITIAL_TIMER);
  const [adc, setAdc] = useState<AdcConfig>(INITIAL_ADC);
  const [activePort, setActivePort] = useState(0);

  const toggleGpioBit = (portIdx: number, bitIdx: number) => {
    setGpio(prev => prev.map((port, pi) => {
      if (pi !== portIdx) return port;
      const newBits = [...port.bits];
      newBits[bitIdx] = !newBits[bitIdx];
      return { ...port, bits: newBits };
    }));
  };

  const toggleAdcChannel = (ch: number) => {
    setAdc(prev => ({
      ...prev,
      channels: prev.channels.map((c, i) => i === ch ? !c : c),
    }));
  };

  const hexValue = (bits: boolean[]) => {
    let val = 0;
    bits.forEach((b, i) => { if (b) val |= (1 << (15 - i)); });
    return `0x${val.toString(16).toUpperCase().padStart(4, '0')}`;
  };

  const tabItems = [
    {
      key: 'gpio',
      label: 'GPIO',
      content: (
        <div>
          <Segmented
            options={gpio.map((p, i) => ({ value: String(i), label: p.name }))}
            value={String(activePort)}
            onChange={(v) => setActivePort(Number(v))}
          />
          <div style={{ marginTop: 12 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}>
              <span style={{ fontSize: 11, color: 'var(--sil-text-soft)' }}>
                ODR 寄存器
              </span>
              <span style={{
                fontSize: 13,
                fontWeight: 700,
                fontFamily: 'monospace',
                color: 'var(--sil-mint-strong)',
              }}>
                {hexValue(gpio[activePort].bits)}
              </span>
            </div>
            <div style={{
              background: 'var(--sil-surface-muted)',
              borderRadius: 'var(--sil-radius-sm)',
              padding: 12,
              boxShadow: 'var(--sil-shadow-pressed)',
            }}>
              <BitField
                bits={gpio[activePort].bits}
                onChange={(bitIdx) => toggleGpioBit(activePort, bitIdx)}
              />
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 4,
              marginTop: 8,
            }}>
              {gpio[activePort].bits.map((bit, i) => (
                <div key={i} style={{
                  textAlign: 'center',
                  fontSize: 10,
                  color: 'var(--sil-text-soft)',
                  padding: '2px 0',
                }}>
                  P{activePort === 0 ? 'A' : activePort === 1 ? 'B' : 'C'}{15 - i}
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'uart',
      label: 'UART',
      content: (
        <div style={{
          background: 'var(--sil-surface-muted)',
          borderRadius: 'var(--sil-radius-sm)',
          padding: 12,
          boxShadow: 'var(--sil-shadow-pressed)',
        }}>
          <LabelValue label="波特率">{uart.baudRate.toLocaleString()} bps</LabelValue>
          <LabelValue label="数据位">{uart.dataBits} bit</LabelValue>
          <LabelValue label="停止位">{uart.stopBits} bit</LabelValue>
          <LabelValue label="校验">{uart.parity === 'none' ? '无' : uart.parity === 'even' ? '偶校验' : '奇校验'}</LabelValue>
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--sil-text-soft)' }}>
            USART2 @ PA2(TX) / PA3(RX)
          </div>
        </div>
      ),
    },
    {
      key: 'timer',
      label: 'Timer',
      content: (
        <div style={{
          background: 'var(--sil-surface-muted)',
          borderRadius: 'var(--sil-radius-sm)',
          padding: 12,
          boxShadow: 'var(--sil-shadow-pressed)',
        }}>
          <LabelValue label="模式">
            {timer.mode === 'up' ? '向上计数' : timer.mode === 'down' ? '向下计数' : '中心对齐'}
          </LabelValue>
          <LabelValue label="预分频">PSC = {timer.prescaler}</LabelValue>
          <LabelValue label="重载值">ARR = {timer.reload}</LabelValue>
          <LabelValue label="频率">
            {(72_000_000 / (timer.prescaler * timer.reload) / 1000).toFixed(1)} kHz
          </LabelValue>
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--sil-text-soft)' }}>
            TIM2 — 通用定时器
          </div>
        </div>
      ),
    },
    {
      key: 'adc',
      label: 'ADC',
      content: (
        <div>
          <div style={{
            background: 'var(--sil-surface-muted)',
            borderRadius: 'var(--sil-radius-sm)',
            padding: 12,
            boxShadow: 'var(--sil-shadow-pressed)',
            marginBottom: 10,
          }}>
            <LabelValue label="分辨率">{adc.resolution} bit</LabelValue>
            <LabelValue label="参考电压">3.3 V</LabelValue>
            <LabelValue label="精度">{(3300 / (1 << adc.resolution)).toFixed(3)} mV</LabelValue>
          </div>
          <div style={{ fontSize: 12, color: 'var(--sil-text-soft)', marginBottom: 6 }}>通道使能</div>
          <div style={{
            background: 'var(--sil-surface-muted)',
            borderRadius: 'var(--sil-radius-sm)',
            padding: 12,
            boxShadow: 'var(--sil-shadow-pressed)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {adc.channels.map((enabled, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ fontSize: 12, color: 'var(--sil-text-main)', fontWeight: 500 }}>
                    CH{i} — PA{i}
                  </span>
                  <Toggle checked={enabled} onChange={() => toggleAdcChannel(i)} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <Panel>
      <div style={{ padding: 16 }}>
        <Tabs items={tabItems} />
      </div>
    </Panel>
  );
}
