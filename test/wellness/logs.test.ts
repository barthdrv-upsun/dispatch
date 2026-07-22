import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../../src/lib/errors.js';
import {
  buildHydrationLog,
  buildSleepLog,
  meanSleepHours,
  sleepByDay,
} from '../../src/domain/wellness/logs.js';

const NOW = '2026-05-20T13:00:00Z';

function withClock<T>(run: () => T): T {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date(NOW));
    return run();
  } finally {
    vi.useRealTimers();
  }
}

describe('buildSleepLog', () => {
  const base = { athleteId: 'athlete-a', timeZone: 'Europe/Berlin', localDate: '2026-05-19', hours: 7.5 };

  it('accepts a night from yesterday', () => {
    const log = withClock(() => buildSleepLog(base));
    expect(log).toEqual({ athleteId: 'athlete-a', localDate: '2026-05-19', hours: 7.5, quality: null });
  });

  it('reads hours that arrive as a string', () => {
    expect(withClock(() => buildSleepLog({ ...base, hours: '6.25' })).hours).toBe(6.25);
  });

  it('keeps a quality score', () => {
    expect(withClock(() => buildSleepLog({ ...base, quality: 4 })).quality).toBe(4);
  });

  it('refuses hours nobody sleeps', () => {
    expect(() => withClock(() => buildSleepLog({ ...base, hours: 25 }))).toThrow(ValidationError);
    expect(() => withClock(() => buildSleepLog({ ...base, hours: -1 }))).toThrow(ValidationError);
    expect(() => withClock(() => buildSleepLog({ ...base, hours: 'ages' }))).toThrow(ValidationError);
  });

  it('refuses a quality score off the scale', () => {
    expect(() => withClock(() => buildSleepLog({ ...base, quality: 6 }))).toThrow(ValidationError);
    expect(() => withClock(() => buildSleepLog({ ...base, quality: 0 }))).toThrow(ValidationError);
  });

  it('refuses a day that has not happened yet where the athlete is', () => {
    expect(() => withClock(() => buildSleepLog({ ...base, localDate: '2026-05-21' }))).toThrow(
      ValidationError,
    );
  });

  it('measures "yet" in the athlete\'s own timezone', () => {
    // 13:00Z on the 20th is mid-afternoon in Berlin but already 01:00 on the
    // 21st in Auckland, so an Auckland athlete may log the 21st and a Berlin
    // one may not.
    expect(() =>
      withClock(() => buildSleepLog({ ...base, timeZone: 'Pacific/Auckland', localDate: '2026-05-21' })),
    ).not.toThrow();
    expect(() =>
      withClock(() => buildSleepLog({ ...base, timeZone: 'Europe/Berlin', localDate: '2026-05-21' })),
    ).toThrow(ValidationError);
  });

  it('refuses a backfill from months ago', () => {
    expect(() => withClock(() => buildSleepLog({ ...base, localDate: '2026-01-01' }))).toThrow(
      ValidationError,
    );
  });

  it('refuses something that is not a day', () => {
    expect(() => withClock(() => buildSleepLog({ ...base, localDate: 'yesterday' }))).toThrow(
      ValidationError,
    );
  });
});

describe('buildHydrationLog', () => {
  const base = { athleteId: 'athlete-a', timeZone: 'Europe/Berlin', localDate: '2026-05-19', litres: 2.4 };

  it('accepts a sensible day', () => {
    expect(withClock(() => buildHydrationLog(base))).toEqual({
      athleteId: 'athlete-a',
      localDate: '2026-05-19',
      litres: 2.4,
    });
  });

  it('refuses a bathtub', () => {
    expect(() => withClock(() => buildHydrationLog({ ...base, litres: 16 }))).toThrow(ValidationError);
  });

  it('refuses a negative', () => {
    expect(() => withClock(() => buildHydrationLog({ ...base, litres: -0.5 }))).toThrow(ValidationError);
  });

  it('refuses a future day', () => {
    expect(() => withClock(() => buildHydrationLog({ ...base, localDate: '2026-05-21' }))).toThrow(
      ValidationError,
    );
  });
});
