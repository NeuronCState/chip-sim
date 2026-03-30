/**
 * MCU 仿真平台
 * 左上：元件库 | 左下：芯片引脚 (PinListPanel)
 * 中：画布（点击元件→属性显示在编辑器虚拟标签页）
 * 右：代码编辑器+文件管理+虚拟文件标签页（可收起）
 * 底：串口/波形（收起）
 * Resizer 分隔线：左-中、中-右、主-底
 */

import { useState, useCallback } from 'react';
import { WebGLCanvas, CIRCUIT_TEMPLATES } from '../canvas/WebGLCanvas';
import { SerialMonitor } from '../panels/SerialMonitor';
import { CodeEditor } from '../panels/CodeEditor';
import { ToastContainer } from '../ui/Toast';
import { Resizer } from '../components/Resizer';
import type { ToastItem } from '../ui/Toast';
import type { SelectedElement } from '../canvas/interaction';

/** 分类定义 */
const LIBRARY_CATEGORIES = [
  {
    id: 'passive', label: '无源元件',
    items: [
      { id: 'resistor', label: '电阻' },
      { id: 'capacitor', label: '电容' },
      { id: 'inductor', label: '电感' },
      { id: 'ferrite_bead', label: '磁珠' },
      { id: 'crystal', label: '晶振' },
      { id: 'potentiometer', label: '电位器' },
    ],
  },
  {
    id: 'input', label: '输入器件',
    items: [
      { id: 'button', label: '按键' },
      { id: 'switch', label: '开关' },
      { id: 'ir_receiver', label: '红外接收' },
    ],
  },
  {
    id: 'semiconductor', label: '半导体',
    items: [
      { id: 'led', label: 'LED' },
      { id: 'diode', label: '二极管' },
      { id: 'zener_diode', label: '稳压二极管' },
      { id: 'bjt_npn', label: 'NPN三极管' },
      { id: 'bjt_pnp', label: 'PNP三极管' },
      { id: 'mosfet_nmos', label: 'NMOS' },
      { id: 'mosfet_pmos', label: 'PMOS' },
      { id: 'op_amp', label: '运放' },
      { id: 'optocoupler', label: '光耦' },
    ],
  },
  {
    id: 'ic', label: 'IC芯片',
    items: [
      { id: 'timer_555', label: 'NE555' },
      { id: 'voltage_regulator_7805', label: 'LM7805' },
      { id: 'voltage_regulator_7812', label: 'LM7812' },
      { id: 'eeprom_i2c', label: 'EEPROM(I2C)' },
      { id: 'eeprom_spi', label: 'EEPROM(SPI)' },
    ],
  },
  {
    id: 'sensor', label: '传感器',
    items: [
      { id: 'ntc_thermistor', label: 'NTC热敏' },
      { id: 'ptc_thermistor', label: 'PTC热敏' },
      { id: 'ds18b20', label: 'DS18B20' },
      { id: 'ldr', label: '光敏电阻' },
      { id: 'photodiode', label: '光电二极管' },
      { id: 'piezo_sensor', label: '压电传感器' },
      { id: 'accelerometer', label: '加速度计' },
      { id: 'gyroscope', label: '陀螺仪' },
    ],
  },
  {
    id: 'communication', label: '通信模块',
    items: [
      { id: 'uart_tx', label: 'UART TX' },
      { id: 'uart_rx', label: 'UART RX' },
      { id: 'spi_master', label: 'SPI主机' },
      { id: 'spi_slave', label: 'SPI从机' },
      { id: 'i2c_master', label: 'I2C主机' },
      { id: 'i2c_slave', label: 'I2C从机' },
      { id: 'bluetooth_module', label: '蓝牙' },
      { id: 'wifi_module', label: 'WiFi' },
      { id: 'can_transceiver', label: 'CAN' },
      { id: 'rs485_transceiver', label: 'RS485' },
      { id: 'usb_serial', label: 'USB转串口' },
    ],
  },
  {
    id: 'actuator', label: '执行器',
    items: [
      { id: 'buzzer_active', label: '有源蜂鸣器' },
      { id: 'buzzer_passive', label: '无源蜂鸣器' },
      { id: 'relay', label: '继电器' },
      { id: 'dc_motor', label: '直流电机' },
      { id: 'stepper_motor', label: '步进电机' },
      { id: 'servo_motor', label: '舵机' },
    ],
  },
  {
    id: 'display', label: '显示',
    items: [
      { id: 'led_indicator', label: 'LED指示灯' },
      { id: 'seven_segment', label: '七段数码管' },
      { id: 'lcd_display', label: 'LCD1602' },
      { id: 'oled_display', label: 'OLED' },
    ],
  },
  {
    id: 'power', label: '电源',
    items: [
      { id: 'ground', label: '接地' },
      { id: 'battery', label: '电池' },
      { id: 'ldo', label: 'LDO稳压' },
      { id: 'buck_converter', label: 'DC-DC降压' },
      { id: 'boost_converter', label: 'DC-DC升压' },
    ],
  },
  {
    id: 'connector', label: '接插件',
    items: [
      { id: 'pin_header', label: '排针' },
      { id: 'dupont_wire', label: '杜邦线' },
    ],
  },
];

/** 面板最小宽度 */
const MIN_LEFT = 160;
const MIN_RIGHT = 200;
const MIN_BOTTOM = 80;

interface Props {
  chipFamily: string;
  chipModel: string;
  loadTemplateId?: string | null;
}

export function McuSimulator({ chipFamily, chipModel, loadTemplateId }: Props) {
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [leftWidth, setLeftWidth] = useState(200);
  const [rightWidth, setRightWidth] = useState(420);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [libPinSplit, setLibPinSplit] = useState(0.5);
  const [pinConfigs, setPinConfigs] = useState<Record<string, string>>({});

  const addToast = useCallback((msg: string, type: ToastItem['type'] = 'info') => {
    setToasts(prev => [...prev, { id: Date.now().toString(), message: msg, type }]);
  }, []);
  const dismissToast = useCallback((id: string) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  /** 左-中分隔线拖拽 */
  const handleLeftResize = useCallback((delta: number) => {
    setLeftWidth(prev => {
      const next = prev + delta;
      return Math.max(MIN_LEFT, Math.min(500, next));
    });
  }, []);

  /** 中-右分隔线拖拽 */
  const handleRightResize = useCallback((delta: number) => {
    setRightWidth(prev => {
      const next = prev - delta;
      return Math.max(MIN_RIGHT, Math.min(600, next));
    });
  }, []);

  return (
    <div className="mcu-simulator">
      <div className="mcu-body" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* 上方主行：左栏 + Resizer + 画布 + Resizer + 右栏 */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

          {/* ===== 左栏：元件库 + PinListPanel ===== */}
          {leftOpen && (
            <>
              <aside className="mcu-panel mcu-left" style={{ width: leftWidth, flexShrink: 0 }}>
                {/* 元件库 */}
                <div className="mcu-section" style={{ flex: `0 0 ${libPinSplit * 100}%`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div className="mcu-section-header" style={{ padding: '4px 8px' }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>元件库</span>
                    <button className="mcu-btn-sm" onClick={() => setLeftOpen(false)}>◀</button>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '2px 4px' }}>
                    {LIBRARY_CATEGORIES.map(cat => (
                      <div key={cat.id} style={{ marginBottom: 1 }}>
                        <button
                          className="mcu-comp-btn"
                          style={{ width: '100%', justifyContent: 'space-between', borderRadius: 3, fontSize: 11, fontWeight: 600, padding: '3px 6px', flexWrap: 'nowrap' }}
                          onClick={() => setExpandedCats(prev => {
                            const next = new Set(prev);
                            next.has(cat.id) ? next.delete(cat.id) : next.add(cat.id);
                            return next;
                          })}
                        >
                          <span>{expandedCats.has(cat.id) ? '▼' : '▶'} {cat.label}</span>
                          <span style={{ fontSize: 9, opacity: 0.4 }}>{cat.items.length}</span>
                        </button>
                        {expandedCats.has(cat.id) && (
                          <div className="mcu-component-grid" style={{ padding: '2px 4px 4px', gap: 2 }}>
                            {cat.items.map(item => (
                              <button
                                key={item.id}
                                className="mcu-comp-btn"
                                draggable
                                onDragStart={(e) => e.dataTransfer.setData('component-type', item.id)}
                                title={item.label}
                                style={{ fontSize: 10, padding: '4px 2px' }}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 引脚列表与元件库之间的可拖拽分隔线 */}
                <div
                  style={{ height: 4, cursor: 'row-resize', background: 'var(--sil-border, #d0d7de)', flexShrink: 0, borderRadius: 2 }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    const startY = e.clientY;
                    const startRatio = libPinSplit;
                    const panelHeight = (e.currentTarget.parentElement?.clientHeight ?? 400);
                    const onMove = (ev: PointerEvent) => {
                      const delta = ev.clientY - startY;
                      setLibPinSplit(Math.max(0.2, Math.min(0.8, startRatio + delta / panelHeight)));
                    };
                    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
                    window.addEventListener('pointermove', onMove);
                    window.addEventListener('pointerup', onUp);
                  }}
                />

                {/* 串口监视器（左下） */}
                <div className="mcu-section" style={{ flex: `1 1 ${100 - libPinSplit * 100}%`, minHeight: 0, overflow: 'hidden' }}>
                  <SerialMonitor />
                </div>
              </aside>
              <Resizer direction="horizontal" onResize={handleLeftResize} />
            </>
          )}

          {!leftOpen && (
            <button className="mcu-expand-btn" style={{ width: 28, flexShrink: 0 }} onClick={() => setLeftOpen(true)}>▶</button>
          )}

          {/* ===== 中央画布 ===== */}
          <main className="mcu-canvas" id="main-canvas" style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <WebGLCanvas chipFamily={chipFamily} chipModel={chipModel} onSelect={setSelectedElement} loadTemplateId={loadTemplateId} />
          </main>

          {/* ===== 右栏：IDE 编辑器 ===== */}
          {rightOpen && (
            <>
              <Resizer direction="horizontal" onResize={handleRightResize} />
              <aside className="mcu-panel mcu-right" style={{ width: rightWidth, flexShrink: 0 }}>
                <div className="mcu-section-header" style={{ gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>编辑器</span>
                  <button className="mcu-btn-sm" style={{ background: '#2ecc71', color: '#fff', fontWeight: 700 }} onClick={() => window.dispatchEvent(new CustomEvent('chip-sim:compile'))}>▶ 运行</button>
                  <button className="mcu-btn-sm" onClick={() => window.dispatchEvent(new CustomEvent('chip-sim:new-file'))}>新建</button>
                  <button className="mcu-btn-sm" onClick={() => window.dispatchEvent(new CustomEvent('chip-sim:import-file'))}>导入</button>
                  <span style={{ flex: 1 }} />
                  <button className="mcu-btn-sm" onClick={() => window.dispatchEvent(new CustomEvent('chip-sim:open-reference'))}>📖 速查</button>
                  <button className="mcu-btn-sm" onClick={() => window.dispatchEvent(new CustomEvent('chip-sim:open-pins'))}>📌 引脚</button>
                  <button className="mcu-btn-sm" onClick={() => setRightOpen(false)}>▶</button>
                </div>
                <div className="mcu-section-grow">
                  <CodeEditor
                    selectedElement={selectedElement}
                    pinConfigs={pinConfigs}
                    onPinConfigChange={setPinConfigs}
                    chipFamily={chipFamily}
                    chipModel={chipModel}
                  />
                </div>
              </aside>
            </>
          )}

          {!rightOpen && (
            <button className="mcu-expand-btn" style={{ width: 28, flexShrink: 0 }} onClick={() => setRightOpen(true)}>◀</button>
          )}
        </div>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
