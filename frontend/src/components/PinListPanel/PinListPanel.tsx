/**
 * PinListPanel — 芯片引脚配置面板（CubeMX 风格）
 * 点击引脚弹出功能选择下拉，配置引脚功能
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { loadChipDefinition, classifyPin } from '../../utils/chipLoader';
import type { ChipDefinition, ChipPin } from '../../types/chip';
import './PinListPanel.css';

export interface PinListPanelProps {
  chipFamily: string;
  chipModel: string;
  onPinConfigChange?: (configs: Record<string, string>) => void;
  pinStates?: Record<string, string>;
}

const TYPE_COLORS: Record<string, string> = {
  gpio: '#4ade80',
  power: '#f97316',
  control: '#f43f5e',
  analog: '#a78bfa',
  communication: '#38bdf8',
  other: '#94a3b8',
};

/** 功能分类颜色 */
const FUNC_COLORS: Record<string, string> = {
  GPIO: '#4ade80',
  ADC: '#a78bfa',
  DAC: '#c084fc',
  TIM: '#facc15',
  USART: '#38bdf8',
  UART: '#38bdf8',
  SPI: '#22d3ee',
  I2C: '#2dd4bf',
  CAN: '#fb923c',
  USB: '#f472b6',
  DAC_OUT: '#c084fc',
};

function getFuncColor(func: string): string {
  for (const [key, color] of Object.entries(FUNC_COLORS)) {
    if (func.startsWith(key)) return color;
  }
  return '#94a3b8';
}

export function PinListPanel({
  chipFamily,
  chipModel,
  onPinConfigChange,
  pinStates,
}: PinListPanelProps) {
  const [chip, setChip] = useState<ChipDefinition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [openDropdownPin, setOpenDropdownPin] = useState<string | null>(null);
  const [pinConfigs, setPinConfigs] = useState<Record<string, string>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setChip(null);
    setOpenDropdownPin(null);

    loadChipDefinition(chipFamily, chipModel).then((result) => {
      if (cancelled) return;
      if (result) {
        setChip(result);
      } else {
        setError(`未找到 ${chipModel} 的引脚定义`);
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [chipFamily, chipModel]);

  // 点击外部关闭下拉
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownPin(null);
      }
    };
    if (openDropdownPin) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [openDropdownPin]);

  const filteredPins = useMemo(() => {
    if (!chip) return [];
    if (!search.trim()) return chip.pins;
    const q = search.toLowerCase();
    return chip.pins.filter(
      (p) =>
        p.id.toLowerCase().includes(q) ||
        p.functions.some((f) => f.toLowerCase().includes(q)) ||
        p.port.toLowerCase().includes(q),
    );
  }, [chip, search]);

  const groupedPins = useMemo(() => {
    const groups: Record<string, ChipPin[]> = {};
    for (const pin of filteredPins) {
      const key = pin.port;
      if (!groups[key]) groups[key] = [];
      groups[key].push(pin);
    }
    return groups;
  }, [filteredPins]);

  const handlePinClick = useCallback((pin: ChipPin, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPinId(pin.id);
    setOpenDropdownPin(prev => prev === pin.id ? null : pin.id);
  }, []);

  const handleFuncSelect = useCallback((pinId: string, func: string) => {
    const newConfigs = { ...pinConfigs };
    if (func === 'GPIO' || func === pinId) {
      // 默认GPIO，不特别记录
      delete newConfigs[pinId];
    } else {
      newConfigs[pinId] = func;
    }
    setPinConfigs(newConfigs);
    setOpenDropdownPin(null);
    onPinConfigChange?.(newConfigs);
  }, [pinConfigs, onPinConfigChange]);

  /** 统计已配置引脚 */
  const configCount = Object.keys(pinConfigs).length;

  return (
    <div className="pin-list-panel">
      <div className="pin-list-panel-header">
        <span className="pin-list-panel-title">引脚配置</span>
        {chip && (
          <span className="pin-list-panel-count">
            {configCount > 0 ? `${configCount} 已配置` : `${chip.pins.length} 引脚`}
          </span>
        )}
      </div>

      <div className="pin-list-panel-search">
        <input
          className="pin-list-search-input"
          placeholder="搜索引脚或功能..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={loading || !chip}
        />
        {search && (
          <button className="pin-list-search-clear" onClick={() => setSearch('')}>✕</button>
        )}
      </div>

      <div className="pin-list-panel-body">
        {loading && <div className="pin-list-loading"><span>加载中...</span></div>}
        {error && <div className="pin-list-error"><span>{error}</span></div>}
        {!loading && !error && chip && filteredPins.length === 0 && (
          <div className="pin-list-empty"><span>无匹配引脚</span></div>
        )}

        {!loading && chip && Object.entries(groupedPins).map(([port, pins]) => (
          <div key={port} className="pin-list-group">
            <div className="pin-list-group-header">
              端口 {port}
              <span className="pin-list-group-count">{pins.length}</span>
            </div>
            {pins.map((pin) => {
              const classification = classifyPin(pin.functions);
              const config = pinConfigs[pin.id];
              const isSelected = selectedPinId === pin.id;
              const isDropdownOpen = openDropdownPin === pin.id;
              const displayFunc = config || pin.functions[0];

              return (
                <div key={pin.id} style={{ position: 'relative' }}>
                  <div
                    className={`pin-list-item ${isSelected ? 'selected' : ''} ${config ? 'configured' : ''}`}
                    onClick={(e) => handlePinClick(pin, e)}
                  >
                    <div className="pin-list-item-left">
                      <span
                        className="pin-list-type-dot"
                        style={{ background: getFuncColor(displayFunc) }}
                      />
                      <span className="pin-list-pin-id">{pin.id}</span>
                    </div>
                    <div className="pin-list-item-right">
                      <span className="pin-list-pin-func" style={{ color: getFuncColor(displayFunc) }}>
                        {displayFunc}
                      </span>
                      {pin.functions.length > 1 && (
                        <span className="pin-list-func-count">{pin.functions.length}</span>
                      )}
                    </div>
                  </div>

                  {/* 功能选择下拉 */}
                  {isDropdownOpen && (
                    <div className="pin-func-dropdown" ref={dropdownRef}>
                      <div className="pin-func-dropdown-title">{pin.id} 可用功能</div>
                      {pin.functions.map((func) => (
                        <button
                          key={func}
                          className={`pin-func-option ${func === displayFunc ? 'active' : ''}`}
                          onClick={(e) => { e.stopPropagation(); handleFuncSelect(pin.id, func); }}
                        >
                          <span className="pin-func-dot" style={{ background: getFuncColor(func) }} />
                          <span>{func}</span>
                          {func === displayFunc && <span className="pin-func-check">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {chip && (
        <div className="pin-list-panel-footer">
          <span>{chip.name} · {chip.package} · {chip.pinCount}pin</span>
        </div>
      )}
    </div>
  );
}
