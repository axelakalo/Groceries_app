import { describe, expect, test, vi } from 'vitest';
import {
  formatDisplayDate,
  getDaysUntil,
  getExpirationStatus,
  normalizeDateForDb,
  parseUserDateInput,
} from './dates';

describe('parseUserDateInput', () => {
  test('accepts US date formats and ISO dates', () => {
    expect(parseUserDateInput('3/4/2026')).toBe('2026-03-04');
    expect(parseUserDateInput('03/04/26')).toBe('2026-03-04');
    expect(parseUserDateInput('2026-03-04')).toBe('2026-03-04');
  });

  test('handles two-digit year boundary', () => {
    expect(parseUserDateInput('1/1/49')).toBe('2049-01-01');
    expect(parseUserDateInput('1/1/50')).toBe('1950-01-01');
  });

  test('validates real dates and leap years', () => {
    expect(parseUserDateInput('02/29/2024')).toBe('2024-02-29');
    expect(parseUserDateInput('02/29/2025')).toBeNull();
    expect(parseUserDateInput('13/45/2026')).toBeNull();
    expect(parseUserDateInput('2026-02-30')).toBeNull();
  });
});

describe('date formatting and comparison', () => {
  test('normalizes dates in local time', () => {
    expect(normalizeDateForDb(new Date(2026, 11, 31, 23, 30))).toBe(
      '2026-12-31',
    );
  });

  test('formats current-year and other-year dates', () => {
    vi.setSystemTime(new Date(2026, 4, 25, 12));
    expect(formatDisplayDate('2026-03-12')).toBe('Thu, Mar 12');
    expect(formatDisplayDate('2027-03-12')).toBe('Mar 12, 2027');
    vi.useRealTimers();
  });

  test('calculates local-day differences across year boundary', () => {
    vi.setSystemTime(new Date(2026, 11, 31, 12));
    expect(getDaysUntil('2027-01-01')).toBe(1);
    expect(getDaysUntil('2026-12-31')).toBe(0);
    expect(getDaysUntil('2026-12-30')).toBe(-1);
    vi.useRealTimers();
  });

  test('classifies expiration states', () => {
    vi.setSystemTime(new Date(2026, 4, 25, 12));
    expect(getExpirationStatus(null)).toBe('no_expiration');
    expect(getExpirationStatus('2026-05-24')).toBe('expired');
    expect(getExpirationStatus('2026-05-25')).toBe('today');
    expect(getExpirationStatus('2026-06-01')).toBe('soon');
    expect(getExpirationStatus('2026-06-15')).toBe('month');
    expect(getExpirationStatus('2026-07-01')).toBe('safe');
    vi.useRealTimers();
  });
});
