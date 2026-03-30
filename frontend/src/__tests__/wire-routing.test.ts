import { describe, it, expect } from 'vitest';
import {
  calculateWirePoints,
  distanceToWire,
  distanceToSegment,
} from '../lib/circuit/wire-routing';
import type { WirePoint } from '../types/circuit';

describe('wire-routing', () => {
  describe('calculateWirePoints', () => {
    it('should return straight line for "straight" routing', () => {
      const from = { x: 0, y: 0 };
      const to = { x: 100, y: 50 };
      const points = calculateWirePoints(from, to, 'straight');

      expect(points).toHaveLength(2);
      expect(points[0]).toEqual({ x: 0, y: 0 });
      expect(points[1]).toEqual({ x: 100, y: 50 });
    });

    it('should return orthogonal path for "orthogonal" routing', () => {
      const from = { x: 0, y: 0 };
      const to = { x: 100, y: 50 };
      const points = calculateWirePoints(from, to, 'orthogonal');

      expect(points).toHaveLength(4);
      expect(points[0]).toEqual({ x: 0, y: 0 });
      expect(points[1].isBend).toBe(true);
      expect(points[2].isBend).toBe(true);
      expect(points[3]).toEqual({ x: 100, y: 50 });
    });

    it('should return straight line for nearly horizontal points in orthogonal mode', () => {
      const from = { x: 0, y: 0 };
      const to = { x: 100, y: 3 }; // dy < 5
      const points = calculateWirePoints(from, to, 'orthogonal');

      expect(points).toHaveLength(2);
      expect(points[0]).toEqual({ x: 0, y: 0 });
      expect(points[1]).toEqual({ x: 100, y: 3 });
    });

    it('should return straight line for nearly vertical points in orthogonal mode', () => {
      const from = { x: 0, y: 0 };
      const to = { x: 3, y: 100 }; // dx < 5
      const points = calculateWirePoints(from, to, 'orthogonal');

      expect(points).toHaveLength(2);
    });

    it('should compute midX correctly for orthogonal routing', () => {
      const from = { x: 0, y: 0 };
      const to = { x: 80, y: 60 };
      const points = calculateWirePoints(from, to, 'orthogonal');

      const expectedMidX = (0 + 80) / 2; // 40
      expect(points[1].x).toBe(expectedMidX);
      expect(points[1].y).toBe(0);
      expect(points[2].x).toBe(expectedMidX);
      expect(points[2].y).toBe(60);
    });
  });

  describe('distanceToSegment', () => {
    it('should return distance to point on the segment', () => {
      // Point perpendicular to the middle of segment (0,0)-(10,0) at (5,3)
      const dist = distanceToSegment(5, 3, 0, 0, 10, 0);
      expect(dist).toBeCloseTo(3, 5);
    });

    it('should return distance to segment start when projection is before start', () => {
      const dist = distanceToSegment(-5, 0, 0, 0, 10, 0);
      expect(dist).toBeCloseTo(5, 5);
    });

    it('should return distance to segment end when projection is after end', () => {
      const dist = distanceToSegment(15, 0, 0, 0, 10, 0);
      expect(dist).toBeCloseTo(5, 5);
    });

    it('should handle zero-length segment', () => {
      const dist = distanceToSegment(3, 4, 0, 0, 0, 0);
      expect(dist).toBeCloseTo(5, 5); // 3-4-5 triangle
    });

    it('should return 0 for point on the segment', () => {
      const dist = distanceToSegment(5, 0, 0, 0, 10, 0);
      expect(dist).toBeCloseTo(0, 5);
    });
  });

  describe('distanceToWire', () => {
    it('should return Infinity for wire with fewer than 2 points', () => {
      expect(distanceToWire(0, 0, [])).toBe(Infinity);
      expect(distanceToWire(0, 0, [{ x: 0, y: 0 }])).toBe(Infinity);
    });

    it('should calculate distance to a straight wire', () => {
      const points: WirePoint[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ];
      const dist = distanceToWire(50, 10, points);
      expect(dist).toBeCloseTo(10, 5);
    });

    it('should calculate minimum distance across multiple segments', () => {
      const points: WirePoint[] = [
        { x: 0, y: 0 },
        { x: 50, y: 0, isBend: true },
        { x: 50, y: 50, isBend: true },
        { x: 100, y: 50 },
      ];
      // Point near the second segment (vertical)
      const dist = distanceToWire(55, 25, points);
      expect(dist).toBeCloseTo(5, 5);
    });
  });
});
