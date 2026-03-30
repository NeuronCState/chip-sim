import { describe, it, expect } from 'vitest';
import {
  formatComponentValue,
  formatTime,
  formatFrequency,
} from '../utils/format';

describe('format', () => {
  describe('formatComponentValue', () => {
    it('should format values with tera prefix', () => {
      expect(formatComponentValue(1e12, 'Ω')).toBe('1TΩ');
    });

    it('should format values with giga prefix', () => {
      expect(formatComponentValue(1e9, 'Hz')).toBe('1GHz');
    });

    it('should format values with mega prefix', () => {
      expect(formatComponentValue(1e6, 'Ω')).toBe('1MΩ');
    });

    it('should format values with kilo prefix', () => {
      expect(formatComponentValue(1000, 'Ω')).toBe('1kΩ');
    });

    it('should format values with no prefix', () => {
      expect(formatComponentValue(100, 'Ω')).toBe('100Ω');
    });

    it('should format values with milli prefix', () => {
      // threshold < 1, uses toFixed(2)
      expect(formatComponentValue(0.001, 'F')).toBe('1.00mF');
    });

    it('should format values with micro prefix', () => {
      expect(formatComponentValue(1e-6, 'F')).toBe('1.00μF');
    });

    it('should format values with nano prefix', () => {
      expect(formatComponentValue(1e-9, 'F')).toBe('1.00nF');
    });

    it('should format values with pico prefix', () => {
      expect(formatComponentValue(1e-12, 'F')).toBe('1.00pF');
    });

    it('should handle non-exact threshold values', () => {
      expect(formatComponentValue(4700, 'Ω')).toBe('5kΩ');
      expect(formatComponentValue(2.2e-6, 'F')).toBe('2.20μF');
    });

    it('should handle zero', () => {
      expect(formatComponentValue(0, 'V')).toBe('0V');
    });
  });

  describe('formatTime', () => {
    it('should format seconds', () => {
      expect(formatTime(1)).toBe('1.00s');
      expect(formatTime(5.5)).toBe('5.50s');
    });

    it('should format milliseconds', () => {
      expect(formatTime(0.001)).toBe('1.00ms');
      expect(formatTime(0.01)).toBe('10.00ms');
    });

    it('should format microseconds', () => {
      expect(formatTime(1e-6)).toBe('1.00μs');
    });

    it('should format nanoseconds', () => {
      expect(formatTime(1e-9)).toBe('1.00ns');
    });
  });

  describe('formatFrequency', () => {
    it('should format GHz', () => {
      expect(formatFrequency(1e9)).toBe('1.00GHz');
    });

    it('should format MHz', () => {
      expect(formatFrequency(1e6)).toBe('1.00MHz');
    });

    it('should format kHz', () => {
      expect(formatFrequency(1000)).toBe('1.00kHz');
    });

    it('should format Hz', () => {
      expect(formatFrequency(50)).toBe('50.00Hz');
    });
  });
});
