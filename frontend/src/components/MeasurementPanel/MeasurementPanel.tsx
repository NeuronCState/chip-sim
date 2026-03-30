/**
 * 测量面板组件
 * 显示所有探针的实时测量数据
 */

import { useMemo, useCallback, useState } from 'react';
import { useCircuitStore } from '../../stores/circuit-store';
import type { ProbeMeasurement, PhaseMeasurement } from '../../types/circuit';
import { ProbeType } from '../../types/circuit';
import {
  computeProbeMeasurement,
  computePhaseDifference,
  exportProbeDataCSV,
  exportMeasurementReportCSV,
} from '../../lib/measurement/MeasurementEngine';
import { downloadFile } from '../../features/waveform/waveform-utils';
import './MeasurementPanel.css';

/** 格式化工程数值 */
function fmtVal(val: number): string {
  const abs = Math.abs(val);
  if (abs === 0) return '0';
  if (abs >= 1e6) return (val / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return (val / 1e3).toFixed(2) + 'k';
  if (abs >= 1) return val.toFixed(3);
  if (abs >= 1e-3) return (val * 1e3).toFixed(2) + 'm';
  if (abs >= 1e-6) return (val * 1e6).toFixed(2) + 'μ';
  if (abs >= 1e-9) return (val * 1e9).toFixed(2) + 'n';
  return val.toExponential(2);
}

/** 探针类型标签 */
function probeTypeLabel(type: ProbeType): string {
  switch (type) {
    case ProbeType.Voltage: return '电压';
    case ProbeType.Current: return '电流';
    case ProbeType.Power: return '功率';
  }
}

/** 探针类型图标 */
function probeTypeIcon(type: ProbeType): string {
  switch (type) {
    case ProbeType.Voltage: return 'V';
    case ProbeType.Current: return 'I';
    case ProbeType.Power: return 'P';
  }
}

export function MeasurementPanel() {
  const components = useCircuitStore((s) => s.components);
  const simulationResult = useCircuitStore((s) => s.simulationResult);

  const [collapsed, setCollapsed] = useState(false);

  // 获取所有探针元件
  const probes = useMemo(
    () =>
      components.filter(
        (c) =>
          c.type === ComponentType_VoltageProbe ||
          c.type === ComponentType_CurrentProbe ||
          c.type === ComponentType_PowerProbe
      ),
    [components]
  );

  // 计算探针测量值
  const measurements: ProbeMeasurement[] = useMemo(() => {
    if (!simulationResult || probes.length === 0) return [];

    const results: ProbeMeasurement[] = [];
    for (const probe of probes) {
      const probeType = getProbeType(probe.type);
      if (!probeType) continue;

      // 找到探针关联的节点（通过 params.nodeId 或连线推断）
      const nodeId = (probe.params as any)?.nodeId as string | undefined;
      if (!nodeId) continue;

      // 找到对应的仿真通道
      const channel = simulationResult.channels.find(
        (ch) => ch.nodeId === nodeId
      );
      if (!channel) continue;

      const measurement = computeProbeMeasurement(
        probe.id,
        probeType,
        nodeId,
        probe.name,
        channel.data,
        getProbeUnit(probeType)
      );
      if (measurement) {
        results.push(measurement);
      }
    }
    return results;
  }, [probes, simulationResult]);

  // 计算相位差（所有电压探针对）
  const phaseMeasurements: PhaseMeasurement[] = useMemo(() => {
    if (measurements.length < 2) return [];

    const voltageProbes = measurements.filter(
      (m) => m.probeType === ProbeType.Voltage
    );
    if (voltageProbes.length < 2) return [];

    const results: PhaseMeasurement[] = [];
    // 只计算第一个和第二个电压探针之间的相位差
    for (let i = 0; i < voltageProbes.length - 1; i++) {
      for (let j = i + 1; j < voltageProbes.length; j++) {
        const pm = computePhaseDifference(
          voltageProbes[i].data,
          voltageProbes[j].data
        );
        if (pm) {
          pm.probeAId = voltageProbes[i].name;
          pm.probeBId = voltageProbes[j].name;
          results.push(pm);
        }
      }
    }
    return results;
  }, [measurements]);

  // 导出探针数据 CSV
  const handleExportProbeCSV = useCallback(() => {
    const csv = exportProbeDataCSV(measurements);
    if (!csv) return;
    const filename = `probe-data-${new Date().toISOString().slice(0, 19)}.csv`;
    downloadFile(csv, filename, 'text/csv;charset=utf-8;');
  }, [measurements]);

  // 导出测量报告
  const handleExportReport = useCallback(() => {
    const csv = exportMeasurementReportCSV(measurements, phaseMeasurements);
    if (!csv) return;
    const filename = `measurement-report-${new Date().toISOString().slice(0, 19)}.csv`;
    downloadFile(csv, filename, 'text/csv;charset=utf-8;');
  }, [measurements, phaseMeasurements]);

  if (probes.length === 0) {
    return (
      <div className="measurement-panel">
        <div className="measurement-panel-header">
          <span className="measurement-panel-title">📐 测量</span>
        </div>
        <div className="measurement-panel-empty">
          <p>放置探针以开始测量</p>
          <p className="hint">从元件库中拖放电压/电流/功率探针</p>
        </div>
      </div>
    );
  }

  return (
    <div className="measurement-panel">
      <div className="measurement-panel-header">
        <span className="measurement-panel-title">
          📐 测量 ({probes.length}个探针)
        </span>
        <div className="measurement-panel-actions">
          {measurements.length > 0 && (
            <>
              <button
                className="mp-btn"
                onClick={handleExportProbeCSV}
                title="导出探针数据为CSV"
              >
                📥 CSV
              </button>
              <button
                className="mp-btn"
                onClick={handleExportReport}
                title="导出测量报告"
              >
                📋 报告
              </button>
            </>
          )}
          <button
            className="mp-btn mp-btn-toggle"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? '▶' : '▼'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="measurement-panel-body">
          {measurements.length === 0 ? (
            <div className="measurement-panel-waiting">
              <p>探针已放置，等待仿真数据...</p>
            </div>
          ) : (
            <>
              {/* 测量表格 */}
              <div className="measurement-table">
                <div className="measurement-table-header">
                  <span>探针</span>
                  <span>瞬时值</span>
                  <span>Vpp/Ipp</span>
                  <span>RMS</span>
                  <span>频率</span>
                </div>
                {measurements.map((m) => (
                  <div key={m.probeId} className="measurement-table-row">
                    <span className="measurement-probe-name">
                      <span
                        className="probe-type-badge"
                        style={{ backgroundColor: m.color }}
                      >
                        {probeTypeIcon(m.probeType)}
                      </span>
                      <span>{m.name}</span>
                      <span className="probe-type-label">
                        {probeTypeLabel(m.probeType)}
                      </span>
                    </span>
                    <span className="measurement-value">
                      {fmtVal(m.currentValue)} {m.unit}
                    </span>
                    <span className="measurement-value">
                      {fmtVal(m.peakToPeak)} {m.unit}
                    </span>
                    <span className="measurement-value">
                      {fmtVal(m.rms)} {m.unit}
                    </span>
                    <span className="measurement-value">
                      {m.frequency !== null
                        ? fmtVal(m.frequency) + 'Hz'
                        : '—'}
                    </span>
                  </div>
                ))}
              </div>

              {/* 详细统计 */}
              <div className="measurement-details">
                {measurements.map((m) => (
                  <div key={m.probeId} className="measurement-detail-card">
                    <div className="detail-card-header">
                      <span
                        className="probe-type-badge"
                        style={{ backgroundColor: m.color }}
                      >
                        {probeTypeIcon(m.probeType)}
                      </span>
                      <span>{m.name}</span>
                    </div>
                    <div className="detail-card-body">
                      <div className="detail-row">
                        <span>最小值:</span>
                        <span>{fmtVal(m.min)} {m.unit}</span>
                      </div>
                      <div className="detail-row">
                        <span>最大值:</span>
                        <span>{fmtVal(m.max)} {m.unit}</span>
                      </div>
                      <div className="detail-row">
                        <span>平均值:</span>
                        <span>{fmtVal(m.mean)} {m.unit}</span>
                      </div>
                      <div className="detail-row">
                        <span>峰峰值:</span>
                        <span>{fmtVal(m.peakToPeak)} {m.unit}</span>
                      </div>
                      <div className="detail-row">
                        <span>RMS:</span>
                        <span>{fmtVal(m.rms)} {m.unit}</span>
                      </div>
                      <div className="detail-row">
                        <span>频率:</span>
                        <span>
                          {m.frequency !== null
                            ? fmtVal(m.frequency) + ' Hz'
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 相位差测量 */}
              {phaseMeasurements.length > 0 && (
                <div className="phase-measurement">
                  <div className="phase-header">📐 相位差</div>
                  {phaseMeasurements.map((pm, idx) => (
                    <div key={idx} className="phase-row">
                      <span>
                        {pm.probeAId} ↔ {pm.probeBId}
                      </span>
                      <span className="phase-value">
                        {pm.phaseDeg.toFixed(1)}°
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============ 辅助函数 ============

const ComponentType_VoltageProbe = 'voltage_probe';
const ComponentType_CurrentProbe = 'current_probe';
const ComponentType_PowerProbe = 'power_probe';

function getProbeType(componentType: string): ProbeType | null {
  switch (componentType) {
    case ComponentType_VoltageProbe:
      return ProbeType.Voltage;
    case ComponentType_CurrentProbe:
      return ProbeType.Current;
    case ComponentType_PowerProbe:
      return ProbeType.Power;
    default:
      return null;
  }
}

function getProbeUnit(probeType: ProbeType): string {
  switch (probeType) {
    case ProbeType.Voltage: return 'V';
    case ProbeType.Current: return 'A';
    case ProbeType.Power: return 'W';
  }
}
