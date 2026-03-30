/** 属性面板 — 显示选中元件属性或芯片概览 */
import { useState } from 'react';
import type { SelectedElement } from '../canvas/interaction';
import { Panel, Button, Segmented } from '../ui';

/** 生成元件属性 JSON 字符串（供 CodeEditor 虚拟文件使用） */
export function generatePropertiesJson(element: SelectedElement | null, chipModel?: string): string {
  if (!element) {
    const data = {
      type: 'chip',
      model: chipModel ?? 'Unknown',
      flash: '512 KB',
      sram: '64 KB',
      gpio: 37,
      peripherals: 12,
      note: '点击画布上的元件查看属性详情',
    };
    return JSON.stringify(data, null, 2);
  }

  const typeColors: Record<string, string> = {
    component: 'mint',
    wire: 'ocean',
    pin: 'peach',
    chip: 'danger',
  };

  const params = MOCK_PARAMS[element.type] ?? MOCK_PARAMS.component;
  const paramEntries: Record<string, { label: string; value: string | number; unit?: string }> = {};
  for (const [key, p] of Object.entries(params)) {
    paramEntries[key] = { label: p.label, value: p.value, ...(p.unit ? { unit: p.unit } : {}) };
  }

  const data = {
    type: element.type,
    id: element.id,
    name: element.name || element.id,
    color: typeColors[element.type] ?? 'mint',
    parameters: paramEntries,
    pins: MOCK_PINS.map(p => ({ name: p.name, function: p.func, direction: p.dir })),
  };

  return JSON.stringify(data, null, 2);
}

/* ── 内联轻量组件 ──────────────────────── */

function Badge({ label, color = 'var(--sil-mint)' }: { label: string; color?: string }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 700,
      color: '#fff',
      background: color,
      letterSpacing: 0.5,
    }}>{label}</span>
  );
}

function Metric({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div style={{
      background: 'var(--sil-surface-muted)',
      borderRadius: 'var(--sil-radius-sm)',
      padding: '10px 14px',
      boxShadow: 'var(--sil-shadow-pressed)',
      flex: 1,
      minWidth: 0,
    }}>
      <div style={{ fontSize: 11, color: 'var(--sil-text-soft)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--sil-text-main)' }}>
        {value}{unit && <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 2 }}>{unit}</span>}
      </div>
    </div>
  );
}

/* ── 模拟数据 ───────────────────────────── */

const MOCK_PARAMS: Record<string, Record<string, { label: string; value: string | number; unit?: string }>> = {
  component: {
    frequency: { label: '频率', value: 72, unit: 'MHz' },
    voltage: { label: '供电电压', value: 3.3, unit: 'V' },
    current: { label: '工作电流', value: 45, unit: 'mA' },
  },
  wire: {
    length: { label: '线长', value: 120, unit: 'px' },
  },
  pin: {
    pullup: { label: '上拉电阻', value: 10, unit: 'kΩ' },
  },
  chip: {
    flash: { label: 'Flash', value: 512, unit: 'KB' },
    ram: { label: 'SRAM', value: 64, unit: 'KB' },
  },
};

const MOCK_PINS = [
  { name: 'PA0', func: 'GPIO / ADC_IN0', dir: '双向' },
  { name: 'PA1', func: 'GPIO / ADC_IN1', dir: '双向' },
  { name: 'PA2', func: 'USART2_TX', dir: '输出' },
  { name: 'PA3', func: 'USART2_RX', dir: '输入' },
  { name: 'PB6', func: 'I2C1_SCL', dir: '输出' },
  { name: 'PB7', func: 'I2C1_SDA', dir: '双向' },
];

/* ── 主组件 ─────────────────────────────── */

interface Props {
  selectedElement: SelectedElement | null;
  chipModel: string;
}

export function PropertyPanel({ selectedElement, chipModel }: Props) {
  const [tab, setTab] = useState<'params' | 'pins'>('params');

  /* ---- 无选中：芯片概览 ---- */
  if (!selectedElement) {
    return (
      <Panel>
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Badge label="芯片" color="var(--sil-ocean)" />
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--sil-text-main)' }}>{chipModel}</span>
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <Metric label="Flash" value={512} unit="KB" />
            <Metric label="SRAM" value={64} unit="KB" />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Metric label="GPIO" value={37} unit="个" />
            <Metric label="外设" value={12} unit="个" />
          </div>
          <div style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 'var(--sil-radius-sm)',
            background: 'var(--sil-surface-muted)',
            boxShadow: 'var(--sil-shadow-pressed)',
            fontSize: 12,
            color: 'var(--sil-text-soft)',
            lineHeight: 1.6,
          }}>
            点击画布上的元件查看属性详情
          </div>
        </div>
      </Panel>
    );
  }

  /* ---- 有选中：元件属性 ---- */
  const typeColors: Record<string, string> = {
    component: 'var(--sil-mint)',
    wire: 'var(--sil-ocean)',
    pin: 'var(--sil-peach)',
    chip: 'var(--sil-danger)',
  };
  const params = MOCK_PARAMS[selectedElement.type] ?? MOCK_PARAMS.component;

  return (
    <Panel>
      <div style={{ padding: 16 }}>
        {/* 标题区 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Badge label={selectedElement.type} color={typeColors[selectedElement.type] ?? 'var(--sil-mint)'} />
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--sil-text-main)' }}>
            {selectedElement.name || selectedElement.id}
          </span>
        </div>

        {/* Tab 切换 */}
        <Segmented
          options={[
            { value: 'params', label: '参数' },
            { value: 'pins', label: '引脚' },
          ]}
          value={tab}
          onChange={(v) => setTab(v as 'params' | 'pins')}
        />

        <div style={{ marginTop: 12 }}>
          {tab === 'params' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(params).map(([key, p]) => (
                <Metric key={key} label={p.label} value={p.value} unit={p.unit} />
              ))}
            </div>
          )}

          {tab === 'pins' && (
            <div style={{
              borderRadius: 'var(--sil-radius-sm)',
              overflow: 'hidden',
              boxShadow: 'var(--sil-shadow-pressed)',
            }}>
              {/* 表头 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '60px 1fr 60px',
                gap: 4,
                padding: '8px 12px',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--sil-text-soft)',
                background: 'var(--sil-surface-muted)',
              }}>
                <span>引脚</span>
                <span>功能</span>
                <span>方向</span>
              </div>
              {/* 表体 */}
              {MOCK_PINS.map((pin) => (
                <div key={pin.name} style={{
                  display: 'grid',
                  gridTemplateColumns: '60px 1fr 60px',
                  gap: 4,
                  padding: '7px 12px',
                  fontSize: 12,
                  color: 'var(--sil-text-main)',
                  borderTop: '1px solid var(--sil-panel-dark)',
                }}>
                  <span style={{ fontWeight: 600 }}>{pin.name}</span>
                  <span style={{ color: 'var(--sil-text-soft)' }}>{pin.func}</span>
                  <span>{pin.dir}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
          <Button variant="secondary" size="sm" style={{ flex: 1 }}>编辑</Button>
          <Button variant="ghost" size="sm">删除</Button>
        </div>
      </div>
    </Panel>
  );
}
