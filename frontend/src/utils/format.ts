/**
 * 格式化工具函数
 */

/**
 * 格式化元件值，如 1000 → "1kΩ", 0.000001 → "1μF"
 */
export function formatComponentValue(
  value: number,
  unit: string
): string {
  const prefixes: [number, string][] = [
    [1e12, 'T'],
    [1e9, 'G'],
    [1e6, 'M'],
    [1e3, 'k'],
    [1, ''],
    [1e-3, 'm'],
    [1e-6, 'μ'],
    [1e-9, 'n'],
    [1e-12, 'p'],
  ];

  for (const [threshold, prefix] of prefixes) {
    if (Math.abs(value) >= threshold) {
      const formatted = (value / threshold).toFixed(
        threshold >= 1 ? 0 : 2
      );
      return `${formatted}${prefix}${unit}`;
    }
  }

  return `${value}${unit}`;
}

/**
 * 格式化时间值，如 0.001 → "1ms"
 */
export function formatTime(seconds: number): string {
  if (seconds >= 1) return `${seconds.toFixed(2)}s`;
  if (seconds >= 1e-3) return `${(seconds * 1e3).toFixed(2)}ms`;
  if (seconds >= 1e-6) return `${(seconds * 1e6).toFixed(2)}μs`;
  return `${(seconds * 1e9).toFixed(2)}ns`;
}

/**
 * 格式化频率值，如 1000 → "1kHz"
 */
export function formatFrequency(hz: number): string {
  if (hz >= 1e9) return `${(hz / 1e9).toFixed(2)}GHz`;
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(2)}MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(2)}kHz`;
  return `${hz.toFixed(2)}Hz`;
}
