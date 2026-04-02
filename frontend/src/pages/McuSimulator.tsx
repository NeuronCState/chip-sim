/**
 * MCU 仿真平台
 * 左：元件库 + 串口
 * 中：画布（点击元件→属性显示在编辑器虚拟标签页）
 * 右：代码编辑器+文件管理+虚拟文件标签页（可收起）
 * Resizer 分隔线：左-中、中-右
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { WebGLCanvas, CIRCUIT_TEMPLATES } from '../canvas/WebGLCanvas';
import { SerialMonitor } from '../panels/SerialMonitor';
import { CodeEditor } from '../panels/CodeEditor';
import { ToastContainer } from '../ui/Toast';
import { Resizer } from '../components/Resizer';
import { ExportMenu } from '../components/ExportMenu/ExportMenu';
import { TeachingMode } from '../components/TeachingMode/TeachingMode';
import { QEMUClient } from '../lib/qemu/client';
import { QEMUAdapter } from '../lib/qemu/adapter';
import { TimelineControl, EventHistory } from '../components/Timeline';
import { getGlobalRecorder } from '../core/simulation/SignalEventRecorder';
import type { ToastItem } from '../ui/Toast';
import type { SelectedElement } from '../canvas/interaction';
import type { SignalEvent } from '../core/simulation/SignalEventRecorder';

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

/** 元件拼音/英文映射（覆盖常见元件） */
const COMPONENT_PINYIN_MAP: Record<string, string[]> = {
  resistor: ['dianzu', 'resistor', 'r'],
  capacitor: ['dianrong', 'capacitor', 'c'],
  inductor: ['diangan', 'inductor', 'l'],
  ferrite_bead: ['cizhu', 'ferrite', 'bead'],
  crystal: ['jingzhen', 'crystal', 'oscillator'],
  potentiometer: ['dianweiqi', 'potentiometer', 'pot'],
  button: ['anjian', 'button', 'key', 'push'],
  switch: ['kaiguan', 'switch', 'sw'],
  ir_receiver: ['hongwai', 'infrared', 'ir'],
  led: ['led', 'erjiguan', '发光二极管'],
  diode: ['erjiguan', 'diode'],
  zener_diode: ['wenya', 'zener', '稳压二极管'],
  bjt_npn: ['sanjiguan', 'npn', 'transistor'],
  bjt_pnp: ['pnp', 'transistor'],
  mosfet_nmos: ['nmos', 'mosfet'],
  mosfet_pmos: ['pmos', 'mosfet'],
  op_amp: ['yunfang', 'opamp', 'amplifier'],
  optocoupler: ['guangou', 'optocoupler'],
  timer_555: ['555', 'ne555', 'dingishi'],
  voltage_regulator_7805: ['7805', 'lm7805', 'wenya'],
  voltage_regulator_7812: ['7812', 'lm7812', 'wenya'],
  eeprom_i2c: ['eeprom', 'i2c', 'cunchu'],
  eeprom_spi: ['eeprom', 'spi', 'cunchu'],
  ntc_thermistor: ['ntc', 'remin', 'thermistor'],
  ptc_thermistor: ['ptc', 'remin', 'thermistor'],
  ds18b20: ['ds18b20', 'wensensor', 'temperature'],
  ldr: ['guangmin', 'ldr', 'light'],
  photodiode: ['guangdian', 'photodiode'],
  piezo_sensor: ['yadian', 'piezo'],
  accelerometer: ['jiasudu', 'accelerometer', 'imu'],
  gyroscope: ['tuoluoyi', 'gyroscope', 'imu'],
  uart_tx: ['uart', 'chuanxou', 'serial', 'tx'],
  uart_rx: ['uart', 'chuanxou', 'serial', 'rx'],
  spi_master: ['spi', 'master', 'zhuji'],
  spi_slave: ['spi', 'slave', 'congji'],
  i2c_master: ['i2c', 'master', 'zhuji'],
  i2c_slave: ['i2c', 'slave', 'congji'],
  bluetooth_module: ['bluetooth', 'lanya', 'ble'],
  wifi_module: ['wifi', 'wulianwang'],
  can_transceiver: ['can', 'transceiver'],
  rs485_transceiver: ['rs485', 'transceiver'],
  usb_serial: ['usb', 'serial', 'chuankou'],
  buzzer_active: ['fengming', 'buzzer', 'active', 'youyuan'],
  buzzer_passive: ['fengming', 'buzzer', 'passive', 'wuyuan'],
  relay: ['jidianqi', 'relay'],
  dc_motor: ['dianji', 'motor', 'dc'],
  stepper_motor: ['buji', 'stepper', 'motor'],
  servo_motor: ['duoji', 'servo', 'motor'],
  led_indicator: ['zhishideng', 'led', 'indicator'],
  seven_segment: ['shumaguan', 'segment', 'display'],
  lcd_display: ['lcd', '1602', 'display'],
  oled_display: ['oled', 'display'],
  ground: ['jiedi', 'ground', 'gnd'],
  battery: ['dianchi', 'battery', 'power'],
  ldo: ['ldo', 'wenya'],
  buck_converter: ['jiangya', 'buck', 'dc-dc'],
  boost_converter: ['shengya', 'boost', 'dc-dc'],
  pin_header: ['paizhen', 'header', 'pin'],
  dupont_wire: ['dupont', 'wire', 'duxian'],
};

const RECENT_STORAGE_KEY = 'chip-sim-recent-components';
const MAX_RECENT = 8;

function getRecentComponents(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function addRecentComponent(id: string): void {
  try {
    let recent = getRecentComponents();
    recent = [id, ...recent.filter(r => r !== id)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recent));
  } catch { /* ignore */ }
}
const MIN_RIGHT = 200;
const MIN_BOTTOM = 80;

interface Props {
  chipFamily: string;
  chipModel: string;
  loadTemplateId?: string | null;
  importedFiles?: Array<{ path: string; content: string; lang: string }> | null;
}

export function McuSimulator({ chipFamily, chipModel, loadTemplateId, importedFiles }: Props) {
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [leftWidth, setLeftWidth] = useState(200);
  const [rightWidth, setRightWidth] = useState(420);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [libSearch, setLibSearch] = useState('');
  const [recentIds, setRecentIds] = useState<string[]>(getRecentComponents());
  const [pinConfigs, setPinConfigs] = useState<Record<string, string>>({});
  const [qemuConnected, setQemuConnected] = useState(false);
  const [qemuRunning, setQemuRunning] = useState(false);
  const [teachingOpen, setTeachingOpen] = useState(false);
  const qemuClientRef = useRef<QEMUClient | null>(null);

  // Timeline 状态
  const [timelineOpen, setTimelineOpen] = useState(true);
  const [timelineHeight, setTimelineHeight] = useState(200);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [events, setEvents] = useState<SignalEvent[]>([]);
  const recorder = useRef(getGlobalRecorder());
  const playbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 监听录制器事件
  useEffect(() => {
    const unsub = recorder.current.onEvent((event) => {
      setEvents(recorder.current.getAllEvents());
      const range = recorder.current.getTimeRange();
      if (range) {
        setTotalTime(range.end);
      }
    });
    return () => unsub();
  }, []);

  const dismissToast = useCallback((id: string) => setToasts(prev => prev.filter(t => t.id !== id)), []);
  const addToast = useCallback((msg: string, type: ToastItem['type'] = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message: msg, type }]);
    setTimeout(() => dismissToast(id), 4000);
  }, [dismissToast]);

  const handleQEMUStart = useCallback(async () => {
    if (qemuRunning && qemuClientRef.current) {
      qemuClientRef.current.stop();
      qemuClientRef.current.disconnect();
      qemuClientRef.current = null;
      setQemuRunning(false);
      setQemuConnected(false);
      return;
    }

    const updater = {
      setChipPinLevel: (pinId: string, level: 'high' | 'low' | 'floating') => {
        window.dispatchEvent(new CustomEvent('chip-sim:set-pin-level', {
          detail: { pinId, level }
        }));
      },
      appendUARTData: (data: string) => {
        window.dispatchEvent(new CustomEvent('chip-sim:uart-output', {
          detail: { data, timestamp: Date.now(), baudRate: 115200 }
        }));
      },
      setSimRunning: (running: boolean) => {
        setQemuRunning(running);
      },
    };

    const adapter = new QEMUAdapter(updater);
    const client = new QEMUClient({
      onEvent: (event) => adapter.handleEvent(event),
      onConnect: () => setQemuConnected(true),
      onDisconnect: () => { setQemuConnected(false); setQemuRunning(false); },
    });

    qemuClientRef.current = client;
    client.connect();

    setTimeout(() => {
      client.startFirmware('/tmp/chipsim/firmware.elf');
    }, 500);
  }, [qemuRunning]);

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

  /** 时间轴分隔线拖拽 */
  const handleTimelineResize = useCallback((delta: number) => {
    setTimelineHeight(prev => {
      const next = prev - delta;
      return Math.max(100, Math.min(400, next));
    });
  }, []);

  // Timeline 控制回调
  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      // 暂停
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
      setIsPlaying(false);
    } else {
      // 播放
      setIsPlaying(true);
      const interval = Math.round(1000 / (60 * playbackSpeed));
      playbackTimerRef.current = setInterval(() => {
        setCurrentTime(prev => {
          const next = prev + (1000 / 60) * playbackSpeed;
          if (next >= totalTime) {
            if (playbackTimerRef.current) {
              clearInterval(playbackTimerRef.current);
              playbackTimerRef.current = null;
            }
            setIsPlaying(false);
            return totalTime;
          }
          return next;
        });
      }, interval);
    }
  }, [isPlaying, playbackSpeed, totalTime]);

  const handleStop = useCallback(() => {
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const handleSeek = useCallback((time: number) => {
    setCurrentTime(Math.max(0, Math.min(totalTime, time)));
    // 回溯到指定时间点
    recorder.current.seekTo(time);
  }, [totalTime]);

  const handleSpeedChange = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
    // 如果正在播放，重新启动定时器
    if (isPlaying && playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
      const interval = Math.round(1000 / (60 * speed));
      playbackTimerRef.current = setInterval(() => {
        setCurrentTime(prev => {
          const next = prev + (1000 / 60) * speed;
          if (next >= totalTime) {
            if (playbackTimerRef.current) {
              clearInterval(playbackTimerRef.current);
              playbackTimerRef.current = null;
            }
            setIsPlaying(false);
            return totalTime;
          }
          return next;
        });
      }, interval);
    }
  }, [isPlaying, totalTime]);

  const handleToggleRecord = useCallback(() => {
    if (isRecording) {
      recorder.current.pause();
    } else {
      recorder.current.resume();
    }
    setIsRecording(!isRecording);
  }, [isRecording]);

  const handleExportCSV = useCallback(() => {
    const csv = recorder.current.exportCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chip-sim-events-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportJSON = useCallback(() => {
    const json = recorder.current.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chip-sim-events-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleEventClick = useCallback((event: SignalEvent) => {
    handleSeek(event.timestamp);
  }, [handleSeek]);

  return (
    <div className="mcu-simulator">
      <div className="mcu-body" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* 上方主行：左栏 + Resizer + 画布 + Resizer + 右栏 */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

          {/* ===== 左栏：元件库 ===== */}
          {leftOpen && (
            <>
              <aside className="mcu-panel mcu-left" style={{ width: leftWidth, flexShrink: 0 }}>
                {/* 元件库 */}
                <div className="mcu-section" style={{ flex: '1 1 auto', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div className="mcu-section-header" style={{ padding: '4px 8px' }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>元件库</span>
                    <button className="mcu-btn-sm" onClick={() => setLeftOpen(false)}>◀</button>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '2px 4px' }}>
                    {/* 搜索框 */}
                    <input
                      type="text"
                      placeholder="搜索元件（支持中文/拼音/英文）..."
                      value={libSearch}
                      onChange={e => setLibSearch(e.target.value)}
                      style={{
                        width: '100%', boxSizing: 'border-box', padding: '4px 6px', marginBottom: 4,
                        borderRadius: 3, border: '1px solid var(--sil-border, #d0d7de)',
                        fontSize: 11, background: 'transparent', color: 'inherit', outline: 'none',
                      }}
                    />

                    {/* 搜索模式：跨分类过滤 */}
                    {libSearch.trim() ? (() => {
                      const q = libSearch.trim().toLowerCase();
                      const matched: { id: string; label: string }[] = [];
                      LIBRARY_CATEGORIES.forEach(cat => {
                        cat.items.forEach(item => {
                          const pinyinKeys = COMPONENT_PINYIN_MAP[item.id] || [];
                          const haystack = [item.label.toLowerCase(), item.id.toLowerCase(), ...pinyinKeys.map(k => k.toLowerCase())];
                          if (haystack.some(h => h.includes(q))) {
                            matched.push(item);
                          }
                        });
                      });
                      if (matched.length === 0) {
                        return <div style={{ fontSize: 11, opacity: 0.5, textAlign: 'center', padding: '12px 0' }}>未找到匹配元件</div>;
                      }
                      return (
                        <div className="mcu-component-grid" style={{ padding: '2px 4px', gap: 2 }}>
                          {matched.map(item => (
                            <button
                              key={item.id}
                              className="mcu-comp-btn"
                              draggable
                              onDragStart={(e) => { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('component-type', item.id); }}
                              onClick={() => { addRecentComponent(item.id); setRecentIds(getRecentComponents()); }}
                              title={item.label}
                              style={{ fontSize: 10, padding: '4px 2px' }}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      );
                    })() : (
                      <>
                        {/* 最近使用 */}
                        {recentIds.length > 0 && (
                          <div style={{ marginBottom: 4 }}>
                            <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.6, padding: '2px 4px' }}>最近使用</div>
                            <div className="mcu-component-grid" style={{ padding: '2px 4px', gap: 2 }}>
                              {recentIds.map(id => {
                                let label = id;
                                for (const cat of LIBRARY_CATEGORIES) {
                                  const found = cat.items.find(i => i.id === id);
                                  if (found) { label = found.label; break; }
                                }
                                return (
                                  <button
                                    key={id}
                                    className="mcu-comp-btn"
                                    draggable
                                    onDragStart={(e) => { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('component-type', id); }}
                                    onClick={() => { addRecentComponent(id); setRecentIds(getRecentComponents()); }}
                                    title={label}
                                    style={{ fontSize: 10, padding: '4px 2px' }}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 分类展开列表 */}
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
                                    onDragStart={(e) => { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('component-type', item.id); }}
                                    onClick={() => { addRecentComponent(item.id); setRecentIds(getRecentComponents()); }}
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
                      </>
                    )}
                  </div>
                </div>

                {/* 串口监视器（左下） */}
                <div className="mcu-section" style={{ flex: '1 1 50%', minHeight: 0, overflow: 'hidden' }}>
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
                  <button className="mcu-btn-sm"
                    style={{ background: qemuRunning ? '#e74c3c' : '#3498db', color: '#fff', fontWeight: 700 }}
                    onClick={handleQEMUStart}>
                    {qemuRunning ? 'QEMU 停止' : 'QEMU 仿真'}
                  </button>
                  <button className="mcu-btn-sm" onClick={() => window.dispatchEvent(new CustomEvent('chip-sim:new-file'))}>新建</button>
                  <button className="mcu-btn-sm" onClick={() => window.dispatchEvent(new CustomEvent('chip-sim:import-file'))}>导入</button>
                  <span style={{ flex: 1 }} />
                  <button className="mcu-btn-sm" onClick={() => setTeachingOpen(true)}>教学</button>
                  <ExportMenu />
                  <button className="mcu-btn-sm" onClick={() => window.dispatchEvent(new CustomEvent('chip-sim:open-reference'))}>速查</button>
                  <button className="mcu-btn-sm" onClick={() => window.dispatchEvent(new CustomEvent('chip-sim:open-pins'))}>引脚</button>
                  <button className="mcu-btn-sm" onClick={() => setRightOpen(false)}>▶</button>
                </div>
                <div className="mcu-section-grow">
                  <CodeEditor
                    selectedElement={selectedElement}
                    pinConfigs={pinConfigs}
                    onPinConfigChange={setPinConfigs}
                    chipFamily={chipFamily}
                    chipModel={chipModel}
                    importedFiles={importedFiles}
                  />
                </div>
              </aside>
            </>
          )}

          {!rightOpen && (
            <button className="mcu-expand-btn" style={{ width: 28, flexShrink: 0 }} onClick={() => setRightOpen(true)}>◀</button>
          )}
        </div>

        {/* 底部：时间轴 */}
        {timelineOpen && (
          <>
            <Resizer direction="vertical" onResize={handleTimelineResize} />
            <div style={{ height: timelineHeight, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                {/* 时间轴控制 */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <TimelineControl
                    currentTime={currentTime}
                    totalTime={totalTime}
                    isPlaying={isPlaying}
                    isRecording={isRecording}
                    playbackSpeed={playbackSpeed}
                    events={events}
                    onPlayPause={handlePlayPause}
                    onStop={handleStop}
                    onSeek={handleSeek}
                    onSpeedChange={handleSpeedChange}
                    onToggleRecord={handleToggleRecord}
                    onExportCSV={handleExportCSV}
                    onExportJSON={handleExportJSON}
                  />
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <EventHistory
                      events={events}
                      currentTime={currentTime}
                      onEventClick={handleEventClick}
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <TeachingMode isOpen={teachingOpen} onClose={() => setTeachingOpen(false)} />
    </div>
  );
}
