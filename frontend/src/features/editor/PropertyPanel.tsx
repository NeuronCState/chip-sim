/**
 * 属性编辑面板
 * 选中元件后显示右侧属性面板，可编辑元件参数
 */

import { useState, useEffect } from 'react';
import { ComponentType, defaultMCUConfig, type CircuitComponent, type GPIOPinConfig, type MCUConfig, type GPIOMode, type GPIOPull, type GPIOOutputType, type GPIOInterruptTrigger } from '../../types/circuit';
import { useCircuitStore } from '../../stores/circuit-store';
import { formatComponentValue } from '../../utils/format';
import { ProtocolPanel } from './ProtocolPanel';
import './PropertyPanel.css';

/** 获取元件类型的单位 */
function getUnitForType(type: ComponentType): string {
  switch (type) {
    case ComponentType.Resistor:
      return 'Ω';
    case ComponentType.Capacitor:
      return 'F';
    case ComponentType.Inductor:
      return 'H';
    case ComponentType.DCSource:
    case ComponentType.VoltageSource:
    case ComponentType.ACSource:
      return 'V';
    case ComponentType.CurrentSource:
      return 'A';
    case ComponentType.Ground:
      return 'V';
    case ComponentType.SPIMaster:
    case ComponentType.I2CMaster:
      return 'Hz';
    case ComponentType.UARTTX:
    case ComponentType.UARTRX:
      return 'bps';
    default:
      return '';
  }
}

/** 获取元件类型的中文名称 */
function getTypeName(type: ComponentType): string {
  switch (type) {
    case ComponentType.Resistor:
      return '电阻';
    case ComponentType.Capacitor:
      return '电容';
    case ComponentType.Inductor:
      return '电感';
    case ComponentType.DCSource:
    case ComponentType.VoltageSource:
      return '直流电源';
    case ComponentType.ACSource:
      return '交流电源';
    case ComponentType.Ground:
      return '接地';
    case ComponentType.CurrentSource:
      return '电流源';
    case ComponentType.Diode:
      return '二极管';
    case ComponentType.BJTNPN:
      return 'NPN 晶体管';
    case ComponentType.BJTPNP:
      return 'PNP 晶体管';
    case ComponentType.MOSFET_NMOS:
      return 'N-MOSFET';
    case ComponentType.MOSFET_PMOS:
      return 'P-MOSFET';
    case ComponentType.OpAmp:
      return '运算放大器';
    case ComponentType.LogicAND:
      return 'AND 门';
    case ComponentType.LogicOR:
      return 'OR 门';
    case ComponentType.LogicNOT:
      return 'NOT 门';
    case ComponentType.LogicNAND:
      return 'NAND 门';
    case ComponentType.LogicNOR:
      return 'NOR 门';
    case ComponentType.LogicXOR:
      return 'XOR 门';
    case ComponentType.SPIMaster:
      return 'SPI Master';
    case ComponentType.SPISlave:
      return 'SPI Slave';
    case ComponentType.I2CMaster:
      return 'I2C Master';
    case ComponentType.I2CSlave:
      return 'I2C Slave';
    case ComponentType.UARTTX:
      return 'UART TX';
    case ComponentType.UARTRX:
      return 'UART RX';
    case ComponentType.MCU:
      return 'MCU (GPIO)';
    default:
      return '未知';
  }
}

/** 数值前缀映射 */
const VALUE_PREFIXES: Record<string, number> = {
  '': 1,
  k: 1e3,
  M: 1e6,
  G: 1e9,
  m: 1e-3,
  μ: 1e-6,
  n: 1e-9,
  p: 1e-12,
};

export function PropertyPanel() {
  const selectedComponentId = useCircuitStore((s) => s.selectedComponentId);
  const selectedComponentIds = useCircuitStore((s) => s.selectedComponentIds);
  const components = useCircuitStore((s) => s.components);
  const updateComponentValue = useCircuitStore((s) => s.updateComponentValue);
  const updateComponentName = useCircuitStore((s) => s.updateComponentName);
  const updateComponentParams = useCircuitStore((s) => s.updateComponentParams);
  const rotateComponent = useCircuitStore((s) => s.rotateComponent);
  const rotateSelected = useCircuitStore((s) => s.rotateSelected);
  const removeComponent = useCircuitStore((s) => s.removeComponent);
  const deleteSelected = useCircuitStore((s) => s.deleteSelected);

  const multiSelected = selectedComponentIds.size > 1;
  const selectedCount = selectedComponentIds.size;

  // Get all selected components for multi-select view
  const selectedComps = multiSelected
    ? components.filter((c) => selectedComponentIds.has(c.id))
    : [];

  const selectedComponent = components.find(
    (c) => c.id === selectedComponentId
  );

  // Multi-select view
  if (multiSelected) {
    // Check if all selected components share the same type
    const types = [...new Set(selectedComps.map((c) => c.type))];
    const sameType = types.length === 1;
    const typeName = sameType ? getTypeName(types[0]) : '混合类型';

    return (
      <div className="property-panel">
        <h3 className="panel-title">属性</h3>
        <div className="component-properties">
          <div className="prop-section">
            <label className="prop-label">已选中</label>
            <span className="prop-value">{selectedCount} 个元件</span>
          </div>

          <div className="prop-section">
            <label className="prop-label">类型</label>
            <span className="prop-value">{typeName}</span>
          </div>

          {sameType && types[0] !== ComponentType.Ground && (
            <div className="prop-section">
              <label className="prop-label">共同单位</label>
              <span className="prop-value">{getUnitForType(types[0])}</span>
            </div>
          )}

          <div className="prop-section">
            <label className="prop-label">选中列表</label>
            <div className="multi-select-list">
              {selectedComps.map((c) => (
                <div key={c.id} className="multi-select-item">
                  <span className="multi-select-name">{c.name}</span>
                  <span className="multi-select-type">{getTypeName(c.type)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="prop-actions">
            <button
              className="btn-action btn-rotate"
              onClick={rotateSelected}
              title="旋转选中元件 90° (快捷键 R)"
            >
              批量旋转 90°
            </button>
            <button
              className="btn-action btn-delete"
              onClick={deleteSelected}
              title="删除选中元件 (Del)"
            >
              🗑️ 批量删除
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedComponent) {
    return (
      <div className="property-panel">
        <h3 className="panel-title">属性</h3>
        <div className="panel-empty">
          <p>选择一个元件查看属性</p>
          <div className="panel-shortcuts">
            <p><b>快捷键：</b></p>
            <p>V - 选择</p>
            <p>W - 连线</p>
            <p>H - 平移</p>
            <p>Ctrl+A - 全选</p>
            <p>Ctrl+点击 - 多选</p>
            <p>Ctrl+拖拽 - 框选追加</p>
            <p>R - 旋转选中元件</p>
            <p>Del - 删除选中</p>
            <p>Ctrl+C/V - 复制/粘贴</p>
            <p>Ctrl+D - 复制并粘贴</p>
            <p>Esc - 取消/退出</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="property-panel">
      <h3 className="panel-title">属性</h3>
      <ComponentProperties
        component={selectedComponent}
        onUpdateValue={updateComponentValue}
        onUpdateName={updateComponentName}
        onUpdateParams={updateComponentParams}
        onRotate={rotateComponent}
        onRemove={removeComponent}
      />
    </div>
  );
}

// ==================== MCU GPIO 引脚配置面板 ====================

interface MCUPinConfigPanelProps {
  component: CircuitComponent;
  onUpdateParams: (id: string, params: Record<string, number | string>) => void;
}

function MCUPinConfigPanel({ component, onUpdateParams }: MCUPinConfigPanelProps) {
  const mcuConfig = (component.params?.mcuConfig as MCUConfig | undefined) ?? defaultMCUConfig();
  const [selectedPin, setSelectedPin] = useState(0);

  const handlePinConfigChange = (field: keyof GPIOPinConfig, value: string | number) => {
    const newPins = [...mcuConfig.pins];
    newPins[selectedPin] = { ...newPins[selectedPin], [field]: value };
    const newConfig: MCUConfig = { ...mcuConfig, pins: newPins };
    onUpdateParams(component.id, { mcuConfig: newConfig as any });
  };

  const handleChipNameChange = (name: string) => {
    const newConfig: MCUConfig = { ...mcuConfig, chipName: name };
    onUpdateParams(component.id, { mcuConfig: newConfig as any });
  };

  const handleVDDChange = (vdd: number) => {
    const newConfig: MCUConfig = { ...mcuConfig, vdd };
    onUpdateParams(component.id, { mcuConfig: newConfig as any });
  };

  const pin = mcuConfig.pins[selectedPin];

  const modeOptions: { value: GPIOMode; label: string }[] = [
    { value: 'input', label: '输入' },
    { value: 'output', label: '输出' },
    { value: 'analog', label: '模拟 (ADC)' },
    { value: 'pwm', label: 'PWM' },
  ];

  const pullOptions: { value: GPIOPull; label: string }[] = [
    { value: 'none', label: '无' },
    { value: 'up', label: '上拉' },
    { value: 'down', label: '下拉' },
  ];

  const outputTypeOptions: { value: GPIOOutputType; label: string }[] = [
    { value: 'push_pull', label: '推挽' },
    { value: 'open_drain', label: '开漏' },
  ];

  const interruptOptions: { value: GPIOInterruptTrigger; label: string }[] = [
    { value: 'none', label: '无中断' },
    { value: 'rising', label: '上升沿' },
    { value: 'falling', label: '下降沿' },
    { value: 'both', label: '双边沿' },
    { value: 'level', label: '电平' },
  ];

  return (
    <div className="mcu-pin-config">
      <div className="mcu-section">
        <h4 className="mcu-title">🔲 MCU 配置</h4>

        <div className="prop-section">
          <label className="prop-label">芯片名称</label>
          <input
            type="text"
            className="prop-input"
            value={mcuConfig.chipName}
            onChange={(e) => handleChipNameChange(e.target.value)}
          />
        </div>

        <div className="prop-section">
          <label className="prop-label">供电电压 (VDD)</label>
          <div className="prop-value-row">
            <input
              type="number"
              className="prop-input prop-input-number"
              value={mcuConfig.vdd}
              onChange={(e) => handleVDDChange(parseFloat(e.target.value) || 3.3)}
              step="0.1"
              min="1"
              max="5"
            />
            <span className="prop-unit">V</span>
          </div>
        </div>
      </div>

      <div className="mcu-section">
        <h4 className="mcu-title">📌 引脚配置</h4>

        <div className="prop-section">
          <label className="prop-label">选择引脚</label>
          <div className="pin-selector">
            {mcuConfig.pins.map((p: GPIOPinConfig, idx: number) => (
              <button
                key={idx}
                className={`pin-btn ${idx === selectedPin ? 'pin-btn-active' : ''} pin-mode-${p.mode}`}
                onClick={() => setSelectedPin(idx)}
                title={`${p.name} - ${p.mode}`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {pin && (
          <>
            <div className="prop-section">
              <label className="prop-label">引脚名称</label>
              <span className="prop-value">{pin.name}</span>
            </div>

            <div className="prop-section">
              <label className="prop-label">工作模式</label>
              <select
                className="prop-select prop-select-full"
                value={pin.mode}
                onChange={(e) => handlePinConfigChange('mode', e.target.value)}
              >
                {modeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="prop-section">
              <label className="prop-label">上拉/下拉</label>
              <select
                className="prop-select prop-select-full"
                value={pin.pull}
                onChange={(e) => handlePinConfigChange('pull', e.target.value)}
              >
                {pullOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {(pin.mode === 'output' || pin.mode === 'pwm') && (
              <div className="prop-section">
                <label className="prop-label">输出类型</label>
                <select
                  className="prop-select prop-select-full"
                  value={pin.outputType}
                  onChange={(e) => handlePinConfigChange('outputType', e.target.value)}
                >
                  {outputTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="prop-section">
              <label className="prop-label">中断模式</label>
              <select
                className="prop-select prop-select-full"
                value={pin.interruptMode}
                onChange={(e) => handlePinConfigChange('interruptMode', e.target.value)}
              >
                {interruptOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {pin.mode === 'analog' && (
              <>
                <div className="prop-section">
                  <label className="prop-label">ADC 参考电压</label>
                  <div className="prop-value-row">
                    <input
                      type="number"
                      className="prop-input prop-input-number"
                      value={pin.adcRefVoltage}
                      onChange={(e) => handlePinConfigChange('adcRefVoltage', parseFloat(e.target.value) || 3.3)}
                      step="0.1"
                      min="0.1"
                      max="5"
                    />
                    <span className="prop-unit">V</span>
                  </div>
                </div>
                <div className="prop-section">
                  <label className="prop-label">ADC 分辨率</label>
                  <div className="prop-value-row">
                    <input
                      type="number"
                      className="prop-input prop-input-number"
                      value={pin.adcResolution}
                      onChange={(e) => handlePinConfigChange('adcResolution', parseInt(e.target.value) || 12)}
                      step="1"
                      min="8"
                      max="16"
                    />
                    <span className="prop-unit">bit</span>
                  </div>
                </div>
              </>
            )}

            {pin.mode === 'pwm' && (
              <>
                <div className="prop-section">
                  <label className="prop-label">PWM 频率</label>
                  <div className="prop-value-row">
                    <input
                      type="number"
                      className="prop-input prop-input-number"
                      value={pin.pwmFrequency}
                      onChange={(e) => handlePinConfigChange('pwmFrequency', parseFloat(e.target.value) || 1000)}
                      step="100"
                      min="1"
                    />
                    <span className="prop-unit">Hz</span>
                  </div>
                </div>
                <div className="prop-section">
                  <label className="prop-label">PWM 占空比</label>
                  <div className="prop-value-row">
                    <input
                      type="number"
                      className="prop-input prop-input-number"
                      value={Math.round(pin.pwmDutyCycle * 100)}
                      onChange={(e) => handlePinConfigChange('pwmDutyCycle', (parseInt(e.target.value) || 50) / 100)}
                      step="1"
                      min="0"
                      max="100"
                    />
                    <span className="prop-unit">%</span>
                  </div>
                </div>
              </>
            )}

            <div className="prop-section">
              <label className="prop-label">驱动能力</label>
              <div className="drive-specs">
                <span>源电流: {pin.sourceCurrent}mA</span>
                <span>灌电流: {pin.sinkCurrent}mA</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}interface ComponentPropertiesProps {
  component: CircuitComponent;
  onUpdateValue: (id: string, value: number, unit?: string) => void;
  onUpdateName: (id: string, name: string) => void;
  onUpdateParams: (id: string, params: Record<string, number | string>) => void;
  onRotate: (id: string) => void;
  onRemove: (id: string) => void;
}

function ComponentProperties({
  component,
  onUpdateValue,
  onUpdateName,
  onUpdateParams,
  onRotate,
  onRemove,
}: ComponentPropertiesProps) {
  const [nameValue, setNameValue] = useState(component.name);
  const [numValue, setNumValue] = useState(
    component.value.value.toString()
  );
  const [prefixValue, setPrefixValue] = useState(
    component.value.prefix || ''
  );

  // 当选中元件变化时更新本地状态
  useEffect(() => {
    setNameValue(component.name);
    setNumValue(component.value.value.toString());
    setPrefixValue(component.value.prefix || '');
  }, [component.id, component.name, component.value]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNameValue(e.target.value);
  };

  const handleNameBlur = () => {
    if (nameValue.trim() && nameValue !== component.name) {
      onUpdateName(component.id, nameValue.trim());
    }
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNumValue(e.target.value);
  };

  const handleValueBlur = () => {
    const parsed = parseFloat(numValue);
    if (!isNaN(parsed) && parsed > 0) {
      const multiplier = VALUE_PREFIXES[prefixValue] ?? 1;
      const realValue = parsed * multiplier;
      onUpdateValue(component.id, realValue, component.value.unit);
    }
  };

  const handlePrefixChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPrefix = e.target.value;
    setPrefixValue(newPrefix);
    const parsed = parseFloat(numValue);
    if (!isNaN(parsed) && parsed > 0) {
      const multiplier = VALUE_PREFIXES[newPrefix] ?? 1;
      const realValue = parsed * multiplier;
      onUpdateValue(component.id, realValue, component.value.unit);
    }
  };

  const unit = getUnitForType(component.type);
  const typeName = getTypeName(component.type);

  return (
    <div className="component-properties">
      <div className="prop-section">
        <label className="prop-label">类型</label>
        <span className="prop-value">{typeName}</span>
      </div>

      <div className="prop-section">
        <label className="prop-label">名称</label>
        <input
          type="text"
          className="prop-input"
          value={nameValue}
          onChange={handleNameChange}
          onBlur={handleNameBlur}
          onKeyDown={(e) => e.key === 'Enter' && handleNameBlur()}
        />
      </div>

      {component.type !== ComponentType.Ground && (
        <div className="prop-section">
          <label className="prop-label">参数值</label>
          <div className="prop-value-row">
            <input
              type="number"
              className="prop-input prop-input-number"
              value={numValue}
              onChange={handleValueChange}
              onBlur={handleValueBlur}
              onKeyDown={(e) => e.key === 'Enter' && handleValueBlur()}
              step="any"
              min="0"
            />
            <select
              className="prop-select"
              value={prefixValue}
              onChange={handlePrefixChange}
            >
              <option value="">-</option>
              <option value="k">k (千)</option>
              <option value="M">M (兆)</option>
              <option value="m">m (毫)</option>
              <option value="μ">μ (微)</option>
              <option value="n">n (纳)</option>
              <option value="p">p (皮)</option>
            </select>
            <span className="prop-unit">{unit}</span>
          </div>
          <div className="prop-formatted">
            当前值: {formatComponentValue(component.value.value, component.value.unit)}
          </div>
        </div>
      )}

      <div className="prop-section">
        <label className="prop-label">位置</label>
        <span className="prop-value prop-value-small">
          ({Math.round(component.position.x)}, {Math.round(component.position.y)})
        </span>
      </div>

      <div className="prop-section">
        <label className="prop-label">旋转</label>
        <span className="prop-value prop-value-small">
          {component.rotation}°
        </span>
      </div>

      {/* MCU GPIO 引脚配置面板 */}
      {component.type === ComponentType.MCU && (
        <MCUPinConfigPanel
          component={component}
          onUpdateParams={onUpdateParams}
        />
      )}

      <div className="prop-actions">
        <button
          className="btn-action btn-rotate"
          onClick={() => onRotate(component.id)}
          title="旋转 90° (快捷键 R)"
        >
          旋转 90°
        </button>
        <button
          className="btn-action btn-delete"
          onClick={() => onRemove(component.id)}
          title="删除元件 (Del)"
        >
          🗑️ 删除
        </button>
      </div>
      <ProtocolPanel component={component} />
    </div>
  );
}
