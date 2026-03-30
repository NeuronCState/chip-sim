/**
 * 协议仿真配置面板
 * 在属性面板中显示协议配置，支持 SPI/I2C/UART 参数编辑和一键仿真
 */

import { useState, useCallback } from 'react';
import type {
  CircuitComponent,
  SPIConfig,
  I2CConfig,
  UARTConfig,
  ProtocolSimRequest,
  ProtocolSimResult,
  SPIMode,
  I2CAddressMode,
  I2CSpeedMode,
  I2CTransferType,
  UARTParity,
} from '../../types/circuit';
import { ComponentType } from '../../types/circuit';
import { runProtocolSimulation, transitionsToDataPoints } from '../../lib/simulation/protocol-client';
import { useCircuitStore } from '../../stores/circuit-store';
import './ProtocolPanel.css';

interface ProtocolPanelProps {
  component: CircuitComponent;
}

/** 解析逗号分隔的 hex/dec 数值字符串 */
function parseDataValues(text: string): number[] {
  return text
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      if (s.startsWith('0x') || s.startsWith('0X')) return parseInt(s, 16);
      return parseInt(s, 10);
    })
    .filter((n) => !isNaN(n));
}

export function ProtocolPanel({ component }: ProtocolPanelProps) {
  const setSimulationResult = useCircuitStore((s) => s.setSimulationResult);
  const setIsSimulating = useCircuitStore((s) => s.setIsSimulating);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // SPI state
  const [spiMode, setSpiMode] = useState<SPIMode>(0);
  const [spiFreq, setSpiFreq] = useState('1000000');
  const [spiDataBits, setSpiDataBits] = useState<8 | 16 | 32>(8);
  const [spiMOSI, setSpiMOSI] = useState('0xA5, 0x3C');
  const [spiMISO, setSpiMISO] = useState('');

  // I2C state
  const [i2cAddrMode, setI2cAddrMode] = useState<I2CAddressMode>(7);
  const [i2cSpeed, setI2cSpeed] = useState<I2CSpeedMode>('standard');
  const [i2cAddr, setI2cAddr] = useState('0x50');
  const [i2cTransfer, setI2cTransfer] = useState<I2CTransferType>('write');
  const [i2cData, setI2cData] = useState('0x01, 0x02, 0x03');
  const [i2cACK, setI2cACK] = useState(true);

  // UART state
  const [uartBaud, setUartBaud] = useState('115200');
  const [uartDataBits, setUartDataBits] = useState<5 | 6 | 7 | 8>(8);
  const [uartStopBits, setUartStopBits] = useState<1 | 1.5 | 2>(1);
  const [uartParity, setUartParity] = useState<UARTParity>('none');
  const [uartTX, setUartTX] = useState('0x48, 0x65, 0x6C, 0x6C, 0x6F');

  const isSPI = component.type === ComponentType.SPIMaster || component.type === ComponentType.SPISlave;
  const isI2C = component.type === ComponentType.I2CMaster || component.type === ComponentType.I2CSlave;
  const isUART = component.type === ComponentType.UARTTX || component.type === ComponentType.UARTRX;

  const handleSimulate = useCallback(async () => {
    setError(null);
    setSimulating(true);
    setIsSimulating(true);

    try {
      let request: ProtocolSimRequest;

      if (isSPI) {
        const mosiData = parseDataValues(spiMOSI);
        const misoData = parseDataValues(spiMISO);
        if (mosiData.length === 0) {
          throw new Error('MOSI 数据不能为空');
        }
        const spi: SPIConfig = {
          mode: spiMode,
          clockFreqHz: parseFloat(spiFreq) || 1000000,
          dataBits: spiDataBits,
          mosiData,
          misoData,
          csPolActiveLow: true,
        };
        request = { protocol: 'spi', spi };
      } else if (isI2C) {
        const addrVal = parseInt(i2cAddr, 16) || parseInt(i2cAddr, 10);
        const data = parseDataValues(i2cData);
        if (data.length === 0) {
          throw new Error('数据不能为空');
        }
        const i2c: I2CConfig = {
          addressMode: i2cAddrMode,
          speedMode: i2cSpeed,
          slaveAddress: addrVal,
          transferType: i2cTransfer,
          data,
          hasACK: i2cACK,
        };
        request = { protocol: 'i2c', i2c };
      } else {
        const txData = parseDataValues(uartTX);
        if (txData.length === 0) {
          throw new Error('TX 数据不能为空');
        }
        const uart: UARTConfig = {
          baudRate: parseInt(uartBaud) || 115200,
          dataBits: uartDataBits,
          stopBits: uartStopBits,
          parity: uartParity,
          txData,
          bitOrderLSB: true,
        };
        request = { protocol: 'uart', uart };
      }

      const result: ProtocolSimResult = await runProtocolSimulation(request);

      if (result.error) {
        throw new Error(result.error);
      }

      // 转换为 SimulationResult 格式供波形面板显示
      const simResult = {
        projectId: 'protocol-sim',
        timestamp: Date.now(),
        analysisType: 'transient' as const,
        channels: result.signals.map((sig) => ({
          name: sig.name,
          nodeId: sig.name,
          color: sig.color,
          visible: true,
          data: transitionsToDataPoints(sig.transitions, result.totalTimeNs),
        })),
        status: 'completed' as const,
      };

      setSimulationResult(simResult);
    } catch (e: any) {
      setError(e.message || '仿真失败');
    } finally {
      setSimulating(false);
      setIsSimulating(false);
    }
  }, [
    isSPI, isI2C,
    spiMode, spiFreq, spiDataBits, spiMOSI, spiMISO,
    i2cAddrMode, i2cSpeed, i2cAddr, i2cTransfer, i2cData, i2cACK,
    uartBaud, uartDataBits, uartStopBits, uartParity, uartTX,
    setSimulationResult, setIsSimulating,
  ]);

  if (!isSPI && !isI2C && !isUART) return null;

  return (
    <div className="protocol-panel">
      <div className="protocol-panel-header">
        <span className="protocol-panel-title">协议仿真</span>
      </div>

      {isSPI && (
        <div className="protocol-config">
          <div className="config-row">
            <label>模式</label>
            <select value={spiMode} onChange={(e) => setSpiMode(parseInt(e.target.value) as SPIMode)}>
              <option value={0}>Mode 0 (CPOL=0, CPHA=0)</option>
              <option value={1}>Mode 1 (CPOL=0, CPHA=1)</option>
              <option value={2}>Mode 2 (CPOL=1, CPHA=0)</option>
              <option value={3}>Mode 3 (CPOL=1, CPHA=1)</option>
            </select>
          </div>
          <div className="config-row">
            <label>时钟频率</label>
            <div className="config-input-group">
              <input type="number" value={spiFreq} onChange={(e) => setSpiFreq(e.target.value)} />
              <span>Hz</span>
            </div>
          </div>
          <div className="config-row">
            <label>数据位宽</label>
            <select value={spiDataBits} onChange={(e) => setSpiDataBits(parseInt(e.target.value) as 8 | 16 | 32)}>
              <option value={8}>8 bit</option>
              <option value={16}>16 bit</option>
              <option value={32}>32 bit</option>
            </select>
          </div>
          <div className="config-row">
            <label>MOSI 数据</label>
            <input type="text" value={spiMOSI} onChange={(e) => setSpiMOSI(e.target.value)} placeholder="0xA5, 0x3C" />
          </div>
          <div className="config-row">
            <label>MISO 数据</label>
            <input type="text" value={spiMISO} onChange={(e) => setSpiMISO(e.target.value)} placeholder="可选" />
          </div>
        </div>
      )}

      {isI2C && (
        <div className="protocol-config">
          <div className="config-row">
            <label>地址模式</label>
            <select value={i2cAddrMode} onChange={(e) => setI2cAddrMode(parseInt(e.target.value) as I2CAddressMode)}>
              <option value={7}>7-bit</option>
              <option value={10}>10-bit</option>
            </select>
          </div>
          <div className="config-row">
            <label>速度</label>
            <select value={i2cSpeed} onChange={(e) => setI2cSpeed(e.target.value as I2CSpeedMode)}>
              <option value="standard">Standard (100 kHz)</option>
              <option value="fast">Fast (400 kHz)</option>
              <option value="fast_plus">Fast+ (1 MHz)</option>
            </select>
          </div>
          <div className="config-row">
            <label>从机地址</label>
            <input type="text" value={i2cAddr} onChange={(e) => setI2cAddr(e.target.value)} placeholder="0x50" />
          </div>
          <div className="config-row">
            <label>传输方向</label>
            <select value={i2cTransfer} onChange={(e) => setI2cTransfer(e.target.value as I2CTransferType)}>
              <option value="write">Write</option>
              <option value="read">Read</option>
            </select>
          </div>
          <div className="config-row">
            <label>数据</label>
            <input type="text" value={i2cData} onChange={(e) => setI2cData(e.target.value)} placeholder="0x01, 0x02" />
          </div>
          <div className="config-row">
            <label>ACK</label>
            <input type="checkbox" checked={i2cACK} onChange={(e) => setI2cACK(e.target.checked)} />
          </div>
        </div>
      )}

      {isUART && (
        <div className="protocol-config">
          <div className="config-row">
            <label>波特率</label>
            <select value={uartBaud} onChange={(e) => setUartBaud(e.target.value)}>
              <option value="9600">9600</option>
              <option value="19200">19200</option>
              <option value="38400">38400</option>
              <option value="57600">57600</option>
              <option value="115200">115200</option>
              <option value="460800">460800</option>
              <option value="921600">921600</option>
            </select>
          </div>
          <div className="config-row">
            <label>数据位</label>
            <select value={uartDataBits} onChange={(e) => setUartDataBits(parseInt(e.target.value) as 5 | 6 | 7 | 8)}>
              <option value={5}>5</option>
              <option value={6}>6</option>
              <option value={7}>7</option>
              <option value={8}>8</option>
            </select>
          </div>
          <div className="config-row">
            <label>停止位</label>
            <select value={uartStopBits} onChange={(e) => setUartStopBits(parseFloat(e.target.value) as 1 | 1.5 | 2)}>
              <option value={1}>1</option>
              <option value={1.5}>1.5</option>
              <option value={2}>2</option>
            </select>
          </div>
          <div className="config-row">
            <label>校验位</label>
            <select value={uartParity} onChange={(e) => setUartParity(e.target.value as UARTParity)}>
              <option value="none">None</option>
              <option value="even">Even</option>
              <option value="odd">Odd</option>
            </select>
          </div>
          <div className="config-row">
            <label>TX 数据</label>
            <input type="text" value={uartTX} onChange={(e) => setUartTX(e.target.value)} placeholder="0x48, 0x65, ..." />
          </div>
        </div>
      )}

      {error && <div className="protocol-error">{error}</div>}

      <button
        className="protocol-sim-btn"
        onClick={handleSimulate}
        disabled={simulating}
      >
        {simulating ? '⏳ 仿真中...' : '▶ 运行协议仿真'}
      </button>
    </div>
  );
}
