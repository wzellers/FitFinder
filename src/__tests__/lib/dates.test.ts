import { describe, it, expect } from 'vitest';
import { toLocalDateString } from '@/lib/dates';

describe('toLocalDateString', () => {
  it('uses the local calendar day, not UTC', () => {
    // 9pm local on Apr 22 — UTC may already be Apr 23 in the Americas.
    expect(toLocalDateString(new Date(2026, 3, 22, 21, 18))).toBe('2026-04-22');
  });

  it('zero-pads month and day', () => {
    expect(toLocalDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
