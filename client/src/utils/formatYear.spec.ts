import { describe, it, expect } from 'vitest';
import { formatYear } from './formatYear';

describe('formatYear', () => {
  it('formats BC years', () => expect(formatYear(-3200)).toBe('3200 BC'));
  it('formats AD years', () => expect(formatYear(1939)).toBe('1939'));
  it('formats year 1', () => expect(formatYear(1)).toBe('1'));
  it('formats year 0', () => expect(formatYear(0)).toBe('0'));
  it('formats year -1 as 1 BC', () => expect(formatYear(-1)).toBe('1 BC'));
});
