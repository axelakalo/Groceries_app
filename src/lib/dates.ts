export type ExpirationStatus =
  | 'no_expiration'
  | 'expired'
  | 'today'
  | 'soon'
  | 'month'
  | 'safe';

const isoPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const slashPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/;

function pad(value: number) {
  return value.toString().padStart(2, '0');
}

function toIso(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function isRealDate(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function expandYear(value: string) {
  if (value.length === 4) {
    return Number(value);
  }

  const year = Number(value);
  return year <= 49 ? 2000 + year : 1900 + year;
}

export function parseUserDateInput(input: string): string | null {
  const trimmed = input.trim();
  const isoMatch = isoPattern.exec(trimmed);

  if (isoMatch) {
    const [, yearValue, monthValue, dayValue] = isoMatch;
    const year = Number(yearValue);
    const month = Number(monthValue);
    const day = Number(dayValue);

    return isRealDate(year, month, day) ? toIso(year, month, day) : null;
  }

  const slashMatch = slashPattern.exec(trimmed);

  if (!slashMatch) {
    return null;
  }

  const [, monthValue, dayValue, yearValue] = slashMatch;
  const year = expandYear(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);

  return isRealDate(year, month, day) ? toIso(year, month, day) : null;
}

export function normalizeDateForDb(date: Date): string {
  return toIso(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function parseIsoLocal(iso: string) {
  const parsed = parseUserDateInput(iso);

  if (!parsed) {
    throw new Error(`Invalid ISO date: ${iso}`);
  }

  const [year, month, day] = parsed.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatDisplayDate(iso: string): string {
  const date = parseIsoLocal(iso);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();

  return new Intl.DateTimeFormat('en-US', {
    weekday: sameYear ? 'short' : undefined,
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  }).format(date);
}

export function getDaysUntil(iso: string): number {
  const target = parseIsoLocal(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msPerDay = 24 * 60 * 60 * 1000;

  return Math.round((target.getTime() - today.getTime()) / msPerDay);
}

export function getExpirationStatus(iso: string | null): ExpirationStatus {
  if (!iso) {
    return 'no_expiration';
  }

  const days = getDaysUntil(iso);

  if (days < 0) {
    return 'expired';
  }

  if (days === 0) {
    return 'today';
  }

  if (days <= 7) {
    return 'soon';
  }

  if (days <= 30) {
    return 'month';
  }

  return 'safe';
}
