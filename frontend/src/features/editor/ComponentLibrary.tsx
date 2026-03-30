/**
 * 元件库面板（优化版）
 * 使用懒加载和分类展示，支持搜索、拖拽放置
 */

import { useState, useMemo, useCallback } from 'react';
import type { ComponentType as CT } from '../../types/circuit';
import { useCircuitStore } from '../../stores/circuit-store';
import {
  getComponentMetas,
  getCategories,
  searchComponents,
} from '../../core/component-loader';
import type { ComponentCategory } from '../../core/component-loader';
import './ComponentLibrary.css';

/** 元件数量计数器（用于自动命名） */
const componentCounters: Partial<Record<string, number>> = {};

/** 重置计数器 */
export function resetComponentCounters(): void {
  for (const key of Object.keys(componentCounters)) {
    delete componentCounters[key];
  }
}

/** 默认值映射 */
const DEFAULT_VALUES: Record<string, { value: number; unit: string; prefix: string }> = {
  resistor: { value: 1000, unit: 'Ω', prefix: 'R' },
  capacitor: { value: 1e-6, unit: 'F', prefix: 'C' },
  inductor: { value: 1e-3, unit: 'H', prefix: 'L' },
  dc_source: { value: 5, unit: 'V', prefix: 'V' },
  ac_source: { value: 5, unit: 'V', prefix: 'AC' },
  voltage_source: { value: 5, unit: 'V', prefix: 'V' },
  current_source: { value: 0.01, unit: 'A', prefix: 'I' },
  ground: { value: 0, unit: 'V', prefix: 'G' },
  diode: { value: 0.7, unit: 'V', prefix: 'D' },
  bjt_npn: { value: 100, unit: 'β', prefix: 'Q' },
  bjt_pnp: { value: 100, unit: 'β', prefix: 'Q' },
  mosfet_nmos: { value: 1, unit: 'mA/V²', prefix: 'M' },
  mosfet_pmos: { value: 1, unit: 'mA/V²', prefix: 'M' },
  op_amp: { value: 100000, unit: 'A/V', prefix: 'U' },
  jfet_n: { value: 10, unit: 'mA', prefix: 'J' },
  jfet_p: { value: 10, unit: 'mA', prefix: 'J' },
  igbt: { value: 200, unit: 'β', prefix: 'IG' },
  darlington_npn: { value: 1000, unit: 'β', prefix: 'QD' },
  darlington_pnp: { value: 1000, unit: 'β', prefix: 'QD' },
  logic_and: { value: 0, unit: '', prefix: 'U' },
  logic_or: { value: 0, unit: '', prefix: 'U' },
  logic_not: { value: 0, unit: '', prefix: 'U' },
  logic_nand: { value: 0, unit: '', prefix: 'U' },
  logic_nor: { value: 0, unit: '', prefix: 'U' },
  logic_xor: { value: 0, unit: '', prefix: 'U' },
  spi_master: { value: 1000000, unit: 'Hz', prefix: 'SPI_M' },
  spi_slave: { value: 0, unit: '', prefix: 'SPI_S' },
  i2c_master: { value: 100000, unit: 'Hz', prefix: 'I2C_M' },
  i2c_slave: { value: 0, unit: '', prefix: 'I2C_S' },
  uart_tx: { value: 115200, unit: 'bps', prefix: 'UART_TX' },
  uart_rx: { value: 115200, unit: 'bps', prefix: 'UART_RX' },
  mcu: { value: 3.3, unit: 'V', prefix: 'MCU' },
  adc: { value: 3.3, unit: 'V', prefix: 'ADC' },
  dac: { value: 3.3, unit: 'V', prefix: 'DAC' },
  voltage_probe: { value: 0, unit: 'V', prefix: 'VP' },
  current_probe: { value: 0, unit: 'A', prefix: 'IP' },
  power_probe: { value: 0, unit: 'W', prefix: 'PP' },
};

/** 分类显示名称 */
const CATEGORY_LABELS: Record<string, string> = {
  passive: '无源元件',
  source: '电源',
  semiconductor: '半导体',
  logic: '逻辑门',
  protocol: '通信协议',
  mcu: '微控制器',
  measurement: '测量探针',
  sensor_temperature: '温度传感器',
  sensor_light: '光传感器',
  sensor_motion: '运动传感器',
  power_management: '电源管理',
  communication: '通信模块',
  actuator: '执行器',
};

export function ComponentLibrary() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<ComponentCategory>>(
    new Set(['passive', 'source'])
  );

  const addComponent = useCircuitStore((s) => s.addComponent);
  const components = useCircuitStore((s) => s.components);

  // 获取元件元数据（轻量级）
  const allMetas = useMemo(() => getComponentMetas(), []);
  const categories = useMemo(() => getCategories(), []);

  // 搜索过滤
  const filteredMetas = useMemo(() => {
    if (!searchQuery.trim()) return null; // null 表示显示分类视图
    return searchComponents(searchQuery);
  }, [searchQuery]);

  // 按分类分组
  const groupedMetas = useMemo(() => {
    if (filteredMetas) return null;
    const groups = new Map<ComponentCategory, typeof allMetas>();
    for (const meta of allMetas) {
      const cat = meta.category as ComponentCategory;
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(meta);
    }
    return groups;
  }, [allMetas, filteredMetas]);

  const handleAddComponent = useCallback(
    (type: string, name: string, _unit: string) => {
      const count = components.length;
      const x = 200 + (count % 5) * 100;
      const y = 200 + Math.floor(count / 5) * 80;

      addComponent(type as CT, name, x, y);
    },
    [addComponent, components.length]
  );

  const handleDragStart = (
    e: React.DragEvent<HTMLButtonElement>,
    type: string,
    name: string
  ) => {
    e.dataTransfer.setData(
      'application/circuit-component',
      JSON.stringify({ type, name })
    );
    e.dataTransfer.effectAllowed = 'copy';
  };

  const getComponentName = (type: string): string => {
    const dv = DEFAULT_VALUES[type];
    const prefix = dv?.prefix || 'X';
    componentCounters[type] = (componentCounters[type] || 0) + 1;
    return `${prefix}${componentCounters[type]}`;
  };

  const toggleCategory = (cat: ComponentCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <div className="component-library">
      <h3 className="library-title">元件库</h3>

      {/* 搜索框 */}
      <div className="library-search">
        <input
          type="text"
          placeholder="搜索元件..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        {searchQuery && (
          <button
            className="search-clear"
            onClick={() => setSearchQuery('')}
          >
            ✕
          </button>
        )}
      </div>

      <div className="library-grid">
        {/* 搜索结果视图 */}
        {filteredMetas && (
          <div className="search-results">
            {filteredMetas.length === 0 ? (
              <div className="no-results">未找到匹配的元件</div>
            ) : (
              filteredMetas.map((meta) => {
                const dv = DEFAULT_VALUES[meta.type] || { value: 0, unit: '', prefix: 'X' };
                return (
                  <button
                    key={meta.type}
                    className="library-item"
                    onClick={() => {
                      const name = getComponentName(meta.type);
                      handleAddComponent(meta.type, name, dv.unit);
                    }}
                    draggable
                    onDragStart={(e) => {
                      const name = getComponentName(meta.type);
                      handleDragStart(e, meta.type, name);
                    }}
                    title={meta.name}
                  >
                    <span className="item-icon">{meta.icon}</span>
                    <span className="item-label">{meta.name}</span>
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* 分类视图 */}
        {!filteredMetas && groupedMetas && categories.map((cat) => (
          <div key={cat.id} className="category-group">
            <button
              className="category-header"
              onClick={() => toggleCategory(cat.id as ComponentCategory)}
            >
              <span className="category-toggle">
                {expandedCategories.has(cat.id as ComponentCategory) ? '▼' : '▶'}
              </span>
              <span className="category-name">
                {CATEGORY_LABELS[cat.id as ComponentCategory] || cat.id}
              </span>
              <span className="category-count">{cat.count}</span>
            </button>

            {expandedCategories.has(cat.id as ComponentCategory) && (
              <div className="category-items">
                {groupedMetas.get(cat.id as ComponentCategory)?.map((meta) => {
                  const dv = DEFAULT_VALUES[meta.type] || { value: 0, unit: '', prefix: 'X' };
                  return (
                    <button
                      key={meta.type}
                      className="library-item"
                      onClick={() => {
                        const name = getComponentName(meta.type);
                        handleAddComponent(meta.type, name, dv.unit);
                      }}
                      draggable
                      onDragStart={(e) => {
                        const name = getComponentName(meta.type);
                        handleDragStart(e, meta.type, name);
                      }}
                      title={meta.name}
                    >
                      <span className="item-icon">{meta.icon}</span>
                      <span className="item-label">{meta.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="library-hint">
        点击或拖拽到画布放置
      </div>
    </div>
  );
}
