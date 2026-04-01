/**
 * 仿真控制面板
 * 分析类型选择、参数输入、启动/停止、状态显示
 * 集成连接状态、仿真进度指示器和确认对话框
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useCircuitStore } from '../../stores/circuit-store';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import { useConfirm } from '../../hooks/useConfirm';
import { diagnosticEngine } from '../../lib/circuit/DiagnosticEngine';
import { ConnectionStatus } from '../../components/ConnectionStatus';
import { SimulationProgress } from '../../components/SimulationProgress';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ClientMessageType } from '../../types/message';
import { AnalysisType, ACSweepMode } from '../../types/circuit';
import type { AnalysisConfig } from '../../types/circuit';
import './SimulatorControl.css';

/** 默认参数值 */
const DEFAULTS = {
  ac: { startFreq: 1, stopFreq: 1e6, pointsPerDecade: 10, numPoints: 200, sweepMode: ACSweepMode.Log },
  transient: { stepTime: 1e-6, stopTime: 1e-3, adaptiveStep: true, truncErrorTol: 1e-4 },
};

const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4];

export function SimulatorControl() {
  const { isSimulating, simulationResult, setIsSimulating, setSimulationResult, wsError, setWsError, simLoading: _simLoading,
    simSpeed, setSimSpeed, isSimPaused, setIsSimPaused, requestStep } = useCircuitStore();
  const { send, isConnected, state: wsState, connect, reconnectAttempt, maxReconnectAttempts } = useWebSocket();
  const { handleSimulationError: _handleSimulationError } = useErrorHandler();
  const { confirm, dialogProps } = useConfirm();

  // Inline error
  const [inlineError, setInlineError] = useState<string | null>(null);

  // Analysis type
  const [analysisType, setAnalysisType] = useState<typeof AnalysisType[keyof typeof AnalysisType]>(AnalysisType.DC);

  // AC params
  const [acStartFreq, setAcStartFreq] = useState(DEFAULTS.ac.startFreq);
  const [acStopFreq, setAcStopFreq] = useState(DEFAULTS.ac.stopFreq);
  const [acSweepMode, setAcSweepMode] = useState<ACSweepMode>(DEFAULTS.ac.sweepMode);
  const [acPPD, setAcPPD] = useState(DEFAULTS.ac.pointsPerDecade);
  const [acNumPoints, setAcNumPoints] = useState(DEFAULTS.ac.numPoints);
  const [acOutputNode, setAcOutputNode] = useState('');

  // Transient params
  const [tranStep, setTranStep] = useState(DEFAULTS.transient.stepTime);
  const [tranStop, setTranStop] = useState(DEFAULTS.transient.stopTime);
  const [tranAdaptive, setTranAdaptive] = useState(DEFAULTS.transient.adaptiveStep);
  const [tranTol, setTranTol] = useState(DEFAULTS.transient.truncErrorTol);

  // 仿真计时
  const [simStartTime, setSimStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 仿真计时器
  useEffect(() => {
    if (isSimulating && !simStartTime) {
      setSimStartTime(Date.now());
    }
    if (!isSimulating && simStartTime) {
      setSimStartTime(null);
      setElapsedSeconds(0);
    }
  }, [isSimulating, simStartTime]);

  useEffect(() => {
    if (simStartTime) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((Date.now() - simStartTime!) / 1000);
      }, 500);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [simStartTime]);

  const buildAnalysisConfig = useCallback((): AnalysisConfig => {
    switch (analysisType) {
      case AnalysisType.DC:
        return { type: AnalysisType.DC };
      case AnalysisType.AC:
        return {
          type: AnalysisType.AC,
          sweepMode: acSweepMode,
          startFreq: acStartFreq,
          stopFreq: acStopFreq,
          ...(acSweepMode === ACSweepMode.Log
            ? { pointsPerDecade: acPPD }
            : { numPoints: acNumPoints }),
          ...(acOutputNode ? { outputNode: acOutputNode } : {}),
        };
      case AnalysisType.Transient:
        return {
          type: AnalysisType.Transient,
          stepTime: tranStep,
          stopTime: tranStop,
          adaptiveStep: tranAdaptive,
          ...(tranAdaptive ? { truncErrorTol: tranTol } : {}),
        };
      default:
        return { type: AnalysisType.DC };
    }
  }, [analysisType, acStartFreq, acStopFreq, acSweepMode, acPPD, acNumPoints, acOutputNode, tranStep, tranStop, tranAdaptive, tranTol]);

  const handleStart = useCallback(() => {
    if (!isConnected) {
      setInlineError('WebSocket 未连接，无法启动仿真。请确认后端服务已启动。');
      return;
    }

    const storeState = useCircuitStore.getState();
    if (storeState.components.length === 0) {
      setInlineError('电路为空，请先添加元件。');
      return;
    }

    // ====== DRC 仿真前检查 ======
    const drcResult = diagnosticEngine.checkSimulation(
      storeState.components,
      storeState.nodes,
      storeState.wires
    );

    if (!drcResult.allowed) {
      const errorMessages = drcResult.errors.map((e) => `• ${e.message}`).join('\n');
      setInlineError(`仿真被阻止，电路存在严重问题：\n${errorMessages}`);
      return;
    }

    if (drcResult.warnings.length > 0) {
      const warningMessages = drcResult.warnings.map((w) => `• ${w.message}`).join('\n');
      setInlineError(null);
      console.warn('电路存在警告（仿真仍将继续）:\n' + warningMessages);
    }

    setInlineError(null);
    setIsSimulating(true);

    send({
      type: ClientMessageType.StartSimulation,
      id: `sim-${Date.now()}`,
      payload: {
        projectId: 'current',
        config: {
          analysis: buildAnalysisConfig(),
          enabled: true,
        },
        circuit: {
          id: 'current',
          name: 'current',
          components: storeState.components,
          nodes: storeState.nodes,
          wires: storeState.wires,
        },
      },
    });
  }, [isConnected, send, setIsSimulating, buildAnalysisConfig]);

  const handleStop = useCallback(async () => {
    const ok = await confirm({
      title: '确认停止仿真',
      message: '仿真正在运行中，确定要停止吗？当前进度将丢失。',
      variant: 'warning',
      confirmText: '停止仿真',
    });
    if (!ok) return;

    setIsSimulating(false);
    send({
      type: ClientMessageType.StopSimulation,
      id: `stop-${Date.now()}`,
      payload: { projectId: 'current' },
    });
  }, [send, setIsSimulating, confirm]);

  const handleClear = useCallback(() => {
    setSimulationResult(null);
    setIsSimulating(false);
    setInlineError(null);
  }, [setSimulationResult, setIsSimulating]);

  /** 分析类型中文名 */
  const analysisTypeName = (() => {
    switch (analysisType) {
      case AnalysisType.DC: return 'DC 工作点';
      case AnalysisType.AC: return 'AC 频率扫描';
      case AnalysisType.Transient: return '瞬态分析';
      default: return '仿真';
    }
  })();

  /** 进度百分比（简单估算） */
  const progressPercent = (() => {
    if (!isSimulating) return null;
    if (simulationResult?.status === 'running') {
      // 根据已有数据量估算进度
      const channels = simulationResult.channels;
      if (channels.length > 0) {
        // 简单启发式：如果有数据说明正在运行
        return Math.min(95, 30 + channels.length * 10);
      }
    }
    return null; // 不确定进度
  })();

  return (
    <div className="simulator-control">
      <h3 className="control-title">仿真控制</h3>

      {/* 连接状态 */}
      <ConnectionStatus
        wsState={wsState}
        isSimulating={isSimulating}
        reconnectAttempt={reconnectAttempt}
        maxReconnectAttempts={maxReconnectAttempts}
        onReconnect={connect}
      />

      {/* 内联错误提示 */}
      {(inlineError || wsError) && (
        <div className="sim-inline-error">
          <button className="error-dismiss" onClick={() => { setInlineError(null); setWsError(null); }}>×</button>
          ! {inlineError || wsError}
        </div>
      )}

      {/* 仿真进度 */}
      <SimulationProgress
        isRunning={isSimulating}
        progress={progressPercent}
        statusText={`${analysisTypeName}运行中`}
        elapsedSeconds={elapsedSeconds}
        error={simulationResult?.error}
        onStop={handleStop}
      />

      {/* 分析类型选择 */}
      <div className="analysis-selector">
        <label className="selector-label">分析类型</label>
        <div className="analysis-buttons">
          <button
            className={`analysis-btn ${analysisType === AnalysisType.DC ? 'active' : ''}`}
            onClick={() => setAnalysisType(AnalysisType.DC)}
            disabled={isSimulating}
          >
            DC
          </button>
          <button
            className={`analysis-btn ${analysisType === AnalysisType.AC ? 'active' : ''}`}
            onClick={() => setAnalysisType(AnalysisType.AC)}
            disabled={isSimulating}
          >
            AC
          </button>
          <button
            className={`analysis-btn ${analysisType === AnalysisType.Transient ? 'active' : ''}`}
            onClick={() => setAnalysisType(AnalysisType.Transient)}
            disabled={isSimulating}
          >
            瞬态
          </button>
        </div>
      </div>

      {/* AC 参数输入 */}
      {analysisType === AnalysisType.AC && (
        <div className="param-group">
          <div className="param-row">
            <label className="param-label">扫描模式</label>
            <div className="analysis-buttons" style={{ flex: 1 }}>
              <button
                className={`analysis-btn ${acSweepMode === ACSweepMode.Log ? 'active' : ''}`}
                onClick={() => setAcSweepMode(ACSweepMode.Log)}
                disabled={isSimulating}
              >
                对数
              </button>
              <button
                className={`analysis-btn ${acSweepMode === ACSweepMode.Linear ? 'active' : ''}`}
                onClick={() => setAcSweepMode(ACSweepMode.Linear)}
                disabled={isSimulating}
              >
                线性
              </button>
            </div>
          </div>
          <div className="param-row">
            <label className="param-label">起始频率 (Hz)</label>
            <input
              className="param-input"
              type="number"
              value={acStartFreq}
              onChange={e => setAcStartFreq(Number(e.target.value))}
              min={0}
              step={1}
              disabled={isSimulating}
            />
          </div>
          <div className="param-row">
            <label className="param-label">终止频率 (Hz)</label>
            <input
              className="param-input"
              type="number"
              value={acStopFreq}
              onChange={e => setAcStopFreq(Number(e.target.value))}
              min={0}
              step={100}
              disabled={isSimulating}
            />
          </div>
          {acSweepMode === ACSweepMode.Log ? (
            <div className="param-row">
              <label className="param-label">每十倍频点数</label>
              <input
                className="param-input"
                type="number"
                value={acPPD}
                onChange={e => setAcPPD(Number(e.target.value))}
                min={1}
                max={100}
                step={1}
                disabled={isSimulating}
              />
            </div>
          ) : (
            <div className="param-row">
              <label className="param-label">采样点数</label>
              <input
                className="param-input"
                type="number"
                value={acNumPoints}
                onChange={e => setAcNumPoints(Number(e.target.value))}
                min={2}
                max={100000}
                step={10}
                disabled={isSimulating}
              />
            </div>
          )}
          <div className="param-row">
            <label className="param-label">输出节点 (可选)</label>
            <input
              className="param-input"
              type="text"
              value={acOutputNode}
              onChange={e => setAcOutputNode(e.target.value)}
              placeholder="如 N1，用于计算 H(jω)"
              disabled={isSimulating}
            />
          </div>
        </div>
      )}

      {/* 瞬态参数输入 */}
      {analysisType === AnalysisType.Transient && (
        <div className="param-group">
          <div className="param-row">
            <label className="param-label">时间步长 (s)</label>
            <input
              className="param-input"
              type="number"
              value={tranStep}
              onChange={e => setTranStep(Number(e.target.value))}
              min={1e-12}
              step={1e-7}
              disabled={isSimulating}
            />
          </div>
          <div className="param-row">
            <label className="param-label">终止时间 (s)</label>
            <input
              className="param-input"
              type="number"
              value={tranStop}
              onChange={e => setTranStop(Number(e.target.value))}
              min={1e-9}
              step={1e-4}
              disabled={isSimulating}
            />
          </div>
          <div className="param-row">
            <label className="param-label">自适应步长</label>
            <div className="analysis-buttons" style={{ flex: 1 }}>
              <button
                className={`analysis-btn ${tranAdaptive ? 'active' : ''}`}
                onClick={() => setTranAdaptive(true)}
                disabled={isSimulating}
              >
                开启
              </button>
              <button
                className={`analysis-btn ${!tranAdaptive ? 'active' : ''}`}
                onClick={() => setTranAdaptive(false)}
                disabled={isSimulating}
              >
                关闭
              </button>
            </div>
          </div>
          {tranAdaptive && (
            <div className="param-row">
              <label className="param-label">截断误差容限</label>
              <input
                className="param-input"
                type="number"
                value={tranTol}
                onChange={e => setTranTol(Number(e.target.value))}
                min={1e-8}
                max={1}
                step={1e-5}
                disabled={isSimulating}
              />
            </div>
          )}
        </div>
      )}

      {/* 控制按钮 */}
      <div className="control-buttons">
        <button
          className="btn-start"
          onClick={handleStart}
          disabled={isSimulating || !isConnected}
        >
          {isSimulating ? '运行中...' : !isConnected ? '未连接' : '启动仿真'}
        </button>
        <button
          className="btn-stop"
          onClick={handleStop}
          disabled={!isSimulating}
        >
          停止
        </button>
        {simulationResult && (
          <button
            className="btn-clear"
            onClick={handleClear}
            disabled={isSimulating}
            title="清除仿真结果"
          >
            清除
          </button>
        )}
      </div>

      {/* 仿真速度控制 */}
      {isSimulating && (
        <div className="speed-control">
          <div className="speed-label">速度</div>
          <div className="speed-buttons">
            {SPEED_OPTIONS.map(s => (
              <button
                key={s}
                className={`speed-btn ${simSpeed === s ? 'active' : ''}`}
                onClick={() => setSimSpeed(s)}
              >
                {s}x
              </button>
            ))}
          </div>
          <div className="sim-actions">
            <button
              className={`btn-pause ${isSimPaused ? 'paused' : ''}`}
              onClick={() => setIsSimPaused(!isSimPaused)}
              title={isSimPaused ? '继续' : '暂停'}
            >
              {isSimPaused ? '▶ 继续' : '⏸ 暂停'}
            </button>
            <button
              className="btn-step"
              onClick={requestStep}
              disabled={!isSimPaused}
              title="单步执行（需先暂停）"
            >
              ⏭ 单步
            </button>
          </div>
        </div>
      )}

      {/* 确认对话框 */}
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
