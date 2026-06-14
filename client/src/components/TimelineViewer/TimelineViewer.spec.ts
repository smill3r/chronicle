import { describe, it, expect } from 'vitest';
import { yearToPercent } from './TimelineViewer';

describe('yearToPercent', () => {
  it('returns 0 for the start year', () => {
    expect(yearToPercent(1789, 1789, 1799)).toBe(0);
  });

  it('returns 100 for the end year', () => {
    expect(yearToPercent(1799, 1789, 1799)).toBe(100);
  });

  it('returns 50 for the midpoint', () => {
    expect(yearToPercent(1794, 1789, 1799)).toBe(50);
  });

  it('handles BC years correctly', () => {
    // span = 0 - (-4000) = 4000; year -2000 is at 50%
    expect(yearToPercent(-2000, -4000, 0)).toBe(50);
  });

  it('handles a timeline spanning BC to AD', () => {
    // span = 476 - (-500) = 976; year 0 is at 500/976 ≈ 51.23%
    const result = yearToPercent(0, -500, 476);
    expect(result).toBeCloseTo(51.23, 1);
  });

  it('returns 0 when span is zero (guard)', () => {
    expect(yearToPercent(1789, 1789, 1789)).toBe(0);
  });

  it('can return values outside 0–100 for out-of-range years', () => {
    expect(yearToPercent(1800, 1789, 1799)).toBeCloseTo(110, 5);
  });
});
