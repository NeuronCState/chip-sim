import { describe, it, expect } from 'vitest';
import {
  computeProbeMeasurement,
  detectFrequency,
  computePhaseDifference,
  extractProbeChannelData,
  generateMeasurementReport,
  exportProbeDataCSV,
  exportMeasurementReportCSV,
} from '../lib/measurement/MeasurementEngine';
import type {
  SimulationDataPoint,
  SimulationChannel,
  ProbeMeasurement,
  PhaseMeasurement,
} from '../types/circuit';

// Helper: generate sine wave data
// NOTE: dt must NOT equal 1/freq or the samples will all land on sin(2π*n) = 0
function makeSineWave(freq = 1000, amplitude = 1, samples = 100, dt = 0.0001): SimulationDataPoint[] {
  return Array.from({ length: samples }, (_, i) => ({
    x: i * dt,
    y: amplitude * Math.sin(2 * Math.PI * freq * i * dt),
  }));
}

// Helper: generate two sine waves with a time shift (phase difference)
function makeShiftedSinePair(
  freq = 1000,
  timeShift: number,
  samples = 100,
  dt = 0.0001
): [SimulationDataPoint[], SimulationDataPoint[]] {
  const dataA = Array.from({ length: samples }, (_, i) => ({
    x: i * dt,
    y: Math.sin(2 * Math.PI * freq * i * dt),
  }));
  const dataB = Array.from({ length: samples }, (_, i) => ({
    x: i * dt,
    y: Math.sin(2 * Math.PI * freq * (i * dt - timeShift)),
  }));
  return [dataA, dataB];
}

describe('MeasurementEngine', () => {
  // -------------------------------------------------------------------------
  // computeProbeMeasurement
  // -------------------------------------------------------------------------
  describe('computeProbeMeasurement', () => {
    it('returns null for empty data', () => {
      const result = computeProbeMeasurement('p1', 'voltage', 'n1', 'V1', [], 'V');
      expect(result).toBeNull();
    });

    it('computes min, max, and mean correctly', () => {
      const data: SimulationDataPoint[] = [
        { x: 0, y: 1 },
        { x: 1, y: 3 },
        { x: 2, y: 5 },
      ];
      const result = computeProbeMeasurement('p1', 'voltage', 'n1', 'V1', data, 'V');
      expect(result).not.toBeNull();
      expect(result!.min).toBe(1);
      expect(result!.max).toBe(5);
      expect(result!.mean).toBeCloseTo(3, 10);
    });

    it('computes RMS for a sine wave', () => {
      // Use dt that doesn't alias with freq to get good samples
      const data = makeSineWave(1000, 1, 200, 0.00005);
      const result = computeProbeMeasurement('p1', 'voltage', 'n1', 'V1', data, 'V');
      expect(result).not.toBeNull();
      // RMS of sin = 1/sqrt(2) ≈ 0.7071
      expect(result!.rms).toBeCloseTo(1 / Math.sqrt(2), 1);
    });

    it('computes peak-to-peak voltage', () => {
      const data = makeSineWave(1000, 1, 200, 0.00005);
      const result = computeProbeMeasurement('p1', 'voltage', 'n1', 'V1', data, 'V');
      expect(result).not.toBeNull();
      // Peak-to-peak of sin with amplitude 1 is approximately 2
      expect(result!.peakToPeak).toBeCloseTo(2, 0);
      expect(result!.min).toBeCloseTo(-1, 1);
      expect(result!.max).toBeCloseTo(1, 1);
    });

    it('sets currentValue to last data point', () => {
      const data: SimulationDataPoint[] = [
        { x: 0, y: 10 },
        { x: 1, y: 20 },
        { x: 2, y: 30 },
      ];
      const result = computeProbeMeasurement('p1', 'current', 'n1', 'I1', data, 'A');
      expect(result).not.toBeNull();
      expect(result!.currentValue).toBe(30);
    });

    it('returns correct probe metadata fields', () => {
      const data: SimulationDataPoint[] = [
        { x: 0, y: 1 },
        { x: 1, y: 2 },
      ];
      const result = computeProbeMeasurement('probe-A', 'power', 'node-1', 'Power1', data, 'W');
      expect(result).not.toBeNull();
      expect(result!.probeId).toBe('probe-A');
      expect(result!.probeType).toBe('power');
      expect(result!.nodeId).toBe('node-1');
      expect(result!.name).toBe('Power1');
      expect(result!.unit).toBe('W');
    });
  });

  // -------------------------------------------------------------------------
  // detectFrequency
  // -------------------------------------------------------------------------
  describe('detectFrequency', () => {
    it('returns null for fewer than 3 data points', () => {
      expect(detectFrequency([])).toBeNull();
      expect(detectFrequency([{ x: 0, y: 0 }])).toBeNull();
      expect(detectFrequency([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBeNull();
    });

    it('detects 1000 Hz sine wave correctly', () => {
      // dt = 0.00005 s, freq = 1000 Hz → 200 samples cover 10 full periods
      const data = makeSineWave(1000, 1, 200, 0.00005);
      const freq = detectFrequency(data);
      expect(freq).not.toBeNull();
      expect(freq!).toBeCloseTo(1000, 0);
    });

    it('detects 500 Hz sine wave correctly', () => {
      const data = makeSineWave(500, 1, 200, 0.00005);
      const freq = detectFrequency(data);
      expect(freq).not.toBeNull();
      expect(freq!).toBeCloseTo(500, 0);
    });

    it('returns null when no zero crossings found', () => {
      // All positive values — no crossing
      const data: SimulationDataPoint[] = [
        { x: 0, y: 1 },
        { x: 0.001, y: 2 },
        { x: 0.002, y: 1.5 },
        { x: 0.003, y: 2 },
      ];
      expect(detectFrequency(data)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // computePhaseDifference
  // -------------------------------------------------------------------------
  describe('computePhaseDifference', () => {
    it('returns null when either channel has fewer than 3 points', () => {
      const short = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
      const normal = makeSineWave(1000, 1, 50, 0.0005);
      expect(computePhaseDifference(short, normal)).toBeNull();
      expect(computePhaseDifference(normal, short)).toBeNull();
    });

    it('returns ~0 degrees for identical sine waves', () => {
      const data = makeSineWave(1000, 1, 200, 0.0005);
      const result = computePhaseDifference(data, data);
      expect(result).not.toBeNull();
      expect(result!.phaseDeg).toBeCloseTo(0, 0);
    });

    it('returns non-zero phase for time-shifted sine wave', () => {
      // Shift B by half a period: T = 0.001 s, shift = 0.0005 s → 180°
      // Use dt=0.00005 to avoid aliasing
      const [dataA, dataB] = makeShiftedSinePair(1000, 0.0005, 200, 0.00005);
      const result = computePhaseDifference(dataA, dataB);
      expect(result).not.toBeNull();
      // Phase should be around 180° (or -180° equivalent)
      const normalizedPhase = ((result!.phaseDeg % 360) + 360) % 360;
      expect(normalizedPhase).toBeCloseTo(180, -1);
    });
  });

  // -------------------------------------------------------------------------
  // extractProbeChannelData
  // -------------------------------------------------------------------------
  describe('extractProbeChannelData', () => {
    it('returns the channel data array as-is', () => {
      const data: SimulationDataPoint[] = [
        { x: 0, y: 1 },
        { x: 1, y: 2 },
        { x: 2, y: 3 },
      ];
      const channel: SimulationChannel = {
        name: 'CH1',
        nodeId: 'n1',
        data,
        color: '#ff0000',
        visible: true,
      };
      const result = extractProbeChannelData(channel, 'voltage');
      expect(result).toEqual(data);
      expect(result).toBe(data); // same reference
    });
  });

  // -------------------------------------------------------------------------
  // generateMeasurementReport
  // -------------------------------------------------------------------------
  describe('generateMeasurementReport', () => {
    it('includes report header and probe measurement rows', () => {
      const data = makeSineWave(1000, 1, 100, 0.001);
      const m = computeProbeMeasurement('p1', 'voltage', 'n1', 'V1', data, 'V');
      expect(m).not.toBeNull();

      const report = generateMeasurementReport([m!], []);
      expect(report).toContain('测量报告');
      expect(report).toContain('探针测量');
      expect(report).toContain('V1');
      expect(report).toContain('voltage');
    });

    it('includes phase measurements section when provided', () => {
      makeSineWave(1000, 1, 100, 0.001);
      const phaseMeas: PhaseMeasurement = {
        probeAId: 'pA',
        probeBId: 'pB',
        phaseDeg: 45.5,
        timeDelta: 0.000125,
      };
      const report = generateMeasurementReport([], [phaseMeas]);
      expect(report).toContain('相位差测量');
      expect(report).toContain('pA');
      expect(report).toContain('pB');
      expect(report).toContain('45.50');
    });
  });

  // -------------------------------------------------------------------------
  // exportProbeDataCSV
  // -------------------------------------------------------------------------
  describe('exportProbeDataCSV', () => {
    it('returns empty string for no measurements', () => {
      expect(exportProbeDataCSV([])).toBe('');
    });

    it('formats CSV with time column and probe value columns', () => {
      const data: SimulationDataPoint[] = [
        { x: 0, y: 1 },
        { x: 0.001, y: 2 },
        { x: 0.002, y: 3 },
      ];
      const m: ProbeMeasurement = {
        probeId: 'p1',
        probeType: 'voltage',
        nodeId: 'n1',
        name: 'Probe1',
        color: '#ff0000',
        currentValue: 3,
        peakToPeak: 2,
        rms: 2.16,
        min: 1,
        max: 3,
        mean: 2,
        frequency: null,
        unit: 'V',
        data,
      };
      const csv = exportProbeDataCSV([m]);
      const lines = csv.split('\n');
      // Header row
      expect(lines[0]).toContain('Time (s)');
      expect(lines[0]).toContain('Probe1 (V)');
      // Data rows
      expect(lines[1]).toContain('0');
      expect(lines[1]).toContain('1');
      expect(lines[2]).toContain('0.001');
      expect(lines[2]).toContain('2');
    });
  });

  // -------------------------------------------------------------------------
  // exportMeasurementReportCSV
  // -------------------------------------------------------------------------
  describe('exportMeasurementReportCSV', () => {
    it('includes Probe Measurements section with headers', () => {
      const data: SimulationDataPoint[] = [
        { x: 0, y: 1 },
        { x: 1, y: 3 },
      ];
      const m = computeProbeMeasurement('p1', 'voltage', 'n1', 'V1', data, 'V');
      expect(m).not.toBeNull();

      const csv = exportMeasurementReportCSV([m!], []);
      expect(csv).toContain('Probe Measurements');
      expect(csv).toContain('Name,Type,Min,Max,PeakToPeak,RMS,Mean,Frequency,Unit');
      expect(csv).toContain('V1');
    });

    it('includes Phase Measurements section when phase data provided', () => {
      const pm: PhaseMeasurement = {
        probeAId: 'pA',
        probeBId: 'pB',
        phaseDeg: 90.0,
        timeDelta: 0.00025,
      };
      const csv = exportMeasurementReportCSV([], [pm]);
      expect(csv).toContain('Phase Measurements');
      expect(csv).toContain('ProbeA,ProbeB,PhaseDeg,TimeDelta');
      expect(csv).toContain('pA');
      expect(csv).toContain('pB');
      expect(csv).toContain('90');
    });

    it('omits phase section when no phase measurements', () => {
      const csv = exportMeasurementReportCSV([], []);
      expect(csv).not.toContain('Phase Measurements');
    });
  });
});
