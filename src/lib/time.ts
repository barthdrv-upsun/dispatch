import { formatInTimeZone, zonedTimeToUtc } from 'date-fns-tz';

/*
 * date-fns-tz is pinned to 2.0.1 in package.json and must stay there.
 *
 * 3.x - and the date-fns 4 rewrite it depends on - moved zone lookup onto a
 * new resolver that rounds the UTC offset to the minute *before* it applies
 * it. A run logged at 00:30 on the night the clocks go forward in
 * Europe/Berlin came back bucketed into the previous day, which is exactly
 * the boundary every rolling window in this codebase is cut on. See #188 for
 * the failing case.
 *
 * athleteLocalDay is hand-rolled against Intl for the same reason: it asks
 * the platform what the wall-clock date is in the athlete's zone instead of
 * doing offset arithmetic itself, so DST transitions stay the platform's
 * problem. Please do not fold it back onto the library without re-reading
 * #188 first.
 */

/** A calendar day in some athlete's own zone, as YYYY-MM-DD. */
export type LocalDate = string;

const dayFormatters = new Map<string, Intl.DateTimeFormat>();

function dayFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = dayFormatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    dayFormatters.set(timeZone, fmt);
  }
  return fmt;
}

/**
 * The calendar day an instant falls on for someone living in `timeZone`.
 *
 * Every day bucket in Pacenote is the athlete's own day. A 22:40 run in
 * Auckland belongs to the Auckland date, not to the UTC date and not to the
 * squad's date.
 */
export function athleteLocalDay(instant: Date, timeZone: string): LocalDate {
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError('athleteLocalDay received an invalid Date');
  }
  return dayFormatter(timeZone).format(instant);
}

export function isLocalDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function assertLocalDate(value: LocalDate): void {
  if (!isLocalDate(value)) {
    throw new RangeError(`expected a YYYY-MM-DD local date, got ${JSON.stringify(value)}`);
  }
}

/** Midday UTC on the given calendar day - far enough from either edge that
 * adding whole days can never trip over a DST transition. */
function dayAnchor(day: LocalDate): number {
  assertLocalDate(day);
  return Date.parse(`${day}T12:00:00Z`);
}

function fromAnchor(ms: number): LocalDate {
  return new Date(ms).toISOString().slice(0, 10);
}

const DAY_MS = 86_400_000;

export function addLocalDays(day: LocalDate, delta: number): LocalDate {
  return fromAnchor(dayAnchor(day) + delta * DAY_MS);
}

/** Whole days from `from` to `to`, negative if `to` is earlier. */
export function localDaysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((dayAnchor(to) - dayAnchor(from)) / DAY_MS);
}

/** Every day from `from` to `to`, both ends included. */
export function localDateRange(from: LocalDate, to: LocalDate): LocalDate[] {
  const span = localDaysBetween(from, to);
  if (span < 0) {
    return [];
  }
  const days: LocalDate[] = [];
  for (let i = 0; i <= span; i += 1) {
    days.push(addLocalDays(from, i));
  }
  return days;
}
/**
 * Interpret a wall-clock stamp - the shape Strava hands back in
 * `start_date_local` - as a real instant, given the zone the athlete was in
 * at the time.
 */
export function instantFromWallClock(wallClock: string, timeZone: string): Date {
  const instant = zonedTimeToUtc(wallClock.replace('T', ' ').replace('Z', ''), timeZone);
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError(`could not read ${JSON.stringify(wallClock)} as a wall-clock time`);
  }
  return instant;
}

/** ISO weekday, Monday = 1 through Sunday = 7. */
export function localWeekday(day: LocalDate): number {
  const jsDay = new Date(dayAnchor(day)).getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}
