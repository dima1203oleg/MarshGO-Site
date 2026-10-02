const timeZone = 'Europe/Kyiv';
const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

type WallTime = { year: number; month: number; day: number; hour: number; minute: number };

function partsAt(instant: number): WallTime {
  const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(({ type, value }) => [type, value]));
  return {
    year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    hour: Number(parts.hour), minute: Number(parts.minute),
  };
}

function sameWallTime(a: WallTime, b: WallTime) {
  return a.year === b.year && a.month === b.month && a.day === b.day && a.hour === b.hour && a.minute === b.minute;
}

function wallTimeEpoch(value: WallTime) {
  return Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute);
}

function parseWallTime(input: string): WallTime | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(input);
  if (!match) return null;
  const value = {
    year: Number(match[1]), month: Number(match[2]), day: Number(match[3]),
    hour: Number(match[4]), minute: Number(match[5]),
  };
  if (value.year < 1900 || value.month < 1 || value.month > 12 || value.day < 1 || value.hour > 23 || value.minute > 59) return null;
  const calendarCheck = new Date(Date.UTC(value.year, value.month - 1, value.day));
  if (calendarCheck.getUTCFullYear() !== value.year || calendarCheck.getUTCMonth() !== value.month - 1 || calendarCheck.getUTCDate() !== value.day) return null;
  return value;
}

/** Convert a datetime-local value interpreted in Europe/Kyiv to a UTC instant.
 * DST gaps return null. Repeated clock times resolve to the earlier instant. */
export function kyivDateTimeInputToDate(input: string): Date | null {
  const wallTime = parseWallTime(input);
  if (!wallTime) return null;
  const wallEpoch = wallTimeEpoch(wallTime);
  const offsets = new Set([-12, 12].map((hours) => {
    const sample = wallEpoch + hours * 60 * 60 * 1000;
    return wallTimeEpoch(partsAt(sample)) - sample;
  }));
  const candidates = [...offsets]
    .map((offset) => wallEpoch - offset)
    .filter((instant) => sameWallTime(partsAt(instant), wallTime))
    .sort((a, b) => a - b);
  return candidates.length ? new Date(candidates[0]) : null;
}

export function kyivDateTimeInputToIso(input: string): string | null {
  return kyivDateTimeInputToDate(input)?.toISOString() ?? null;
}

export function formatKyivDateTimeInput(instant: string | Date): string {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (!Number.isFinite(date.getTime())) return '';
  const { year, month, day, hour, minute } = partsAt(date.getTime());
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}

export function defaultKyivDateTime(daysFromToday: number, hour: number, now: Date = new Date()): string {
  if (!Number.isInteger(daysFromToday) || !Number.isInteger(hour) || hour < 0 || hour > 23) throw new RangeError('Invalid Kyiv date/time default');
  const today = partsAt(now.getTime());
  const date = new Date(Date.UTC(today.year, today.month - 1, today.day + daysFromToday));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00`;
}
